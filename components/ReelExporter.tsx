"use client"

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { useColorPalette } from "@/hooks/useColorPalette"
import {
  REEL_HEIGHT,
  REEL_WIDTH,
  buildReelPlan,
  drawReelFrame,
  estimateSizeMb,
  layoutReel,
  loadReelAssets,
  pickRecordingFormat,
  recordReel,
  renderStaticLayer,
  type ReelAssets,
} from "@/lib/reel"
import { fileSlug, shareOrDownload } from "@/lib/shareFile"
import type { LyricResult, Moment } from "@/types"

type Phase =
  | { kind: "preview" }
  | { kind: "recording" }
  | { kind: "done"; blob: Blob; url: string }
  | { kind: "error"; message: string }

const BUTTON =
  "rounded-full px-4 py-2 text-sm font-semibold transition disabled:opacity-40"

// Recording support never changes during a visit, so there's nothing to subscribe to.
const subscribeNever = () => () => {}
const unknownOnServer = () => undefined

export function ReelExporter({ moment, onClose }: { moment: Moment; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const palette = useColorPalette(moment.albumArtUrl)

  // undefined = still loading; null = couldn't fetch (the reel falls back to
  // evenly spaced words)
  const [lyrics, setLyrics] = useState<LyricResult | null | undefined>(undefined)
  const [assets, setAssets] = useState<ReelAssets | null>(null)
  const [phase, setPhase] = useState<Phase>({ kind: "preview" })
  const [progress, setProgress] = useState(0)

  // MediaRecorder only exists in the browser. Reading it during render would
  // make the server and browser disagree (a hydration mismatch), so the server
  // reports "unknown" and the browser fills in the real answer after hydrating.
  const format = useSyncExternalStore(subscribeNever, pickRecordingFormat, unknownOnServer)
  const plan = useMemo(
    () => (lyrics === undefined ? null : buildReelPlan(moment, lyrics)),
    [moment, lyrics],
  )

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams({
      track: moment.track,
      artist: moment.artist,
      album: moment.album,
    })
    fetch(`/api/lyrics?${params}`)
      .then((res) => (res.ok ? (res.json() as Promise<LyricResult>) : null))
      .catch(() => null)
      .then((result) => {
        if (!cancelled) setLyrics(result)
      })
    loadReelAssets(moment.albumArtUrl).then((loaded) => {
      if (!cancelled) setAssets(loaded)
    })
    return () => {
      cancelled = true
    }
  }, [moment])

  // Loop the reel on the canvas while previewing.
  useEffect(() => {
    if (!plan || !assets || phase.kind !== "preview") return
    const ctx = canvasRef.current?.getContext("2d")
    if (!ctx) return

    const layer = renderStaticLayer(assets, palette, moment)
    const layout = layoutReel(ctx, plan)
    const startedAt = performance.now()
    let frame = 0
    const tick = () => {
      drawReelFrame(ctx, layer, layout, (performance.now() - startedAt) % plan.durationMs)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [plan, assets, palette, phase.kind, moment])

  // Release the finished video's memory when it's replaced or the modal closes.
  useEffect(() => {
    if (phase.kind !== "done") return
    const { url } = phase
    return () => URL.revokeObjectURL(url)
  }, [phase])

  // Stop any recording in progress if the modal is closed mid-way.
  useEffect(() => () => abortRef.current?.abort(), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  async function record() {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx || !plan || !assets || !format) return

    const layer = renderStaticLayer(assets, palette, moment)
    const layout = layoutReel(ctx, plan)
    const controller = new AbortController()
    abortRef.current = controller

    setProgress(0)
    setPhase({ kind: "recording" })
    try {
      const blob = await recordReel(
        canvas,
        plan.durationMs,
        (t) => drawReelFrame(ctx, layer, layout, t),
        // whole percents only, so React skips re-rendering on most frames
        (fraction) => setProgress(Math.round(fraction * 100)),
        format,
        controller.signal,
      )
      setPhase({ kind: "done", blob, url: URL.createObjectURL(blob) })
    } catch (err) {
      if ((err as Error).name === "AbortError") return
      console.error("reel recording failed:", err)
      setPhase({ kind: "error", message: "Recording failed. Try again." })
    }
  }

  async function save(blob: Blob) {
    try {
      const extension = format?.extension ?? "mp4"
      await shareOrDownload(blob, `${fileSlug(moment.artist, moment.track)}-reel.${extension}`)
    } catch (err) {
      console.error("reel share failed:", err)
      setPhase({ kind: "error", message: "Couldn't save the video. Try again." })
    }
  }

  const seconds = plan ? Math.round(plan.durationMs / 1000) : null
  const ready = Boolean(plan && assets)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-full w-full max-w-3xl flex-col items-center gap-6 overflow-y-auto rounded-[20px] bg-[#0F0B18]/90 p-6 sm:flex-row sm:items-start"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative shrink-0">
          {phase.kind === "done" ? (
            <video
              src={phase.url}
              controls
              autoPlay
              loop
              playsInline
              className="h-[480px] w-[270px] rounded-2xl bg-black"
            />
          ) : (
            <canvas
              ref={canvasRef}
              width={REEL_WIDTH}
              height={REEL_HEIGHT}
              className="h-[480px] w-[270px] rounded-2xl bg-[#0A0A0F]"
            />
          )}
          {!ready && (
            <p className="absolute inset-0 flex items-center justify-center text-sm text-[#EDEDF2]/50">
              Preparing…
            </p>
          )}
        </div>

        <div className="flex w-full flex-col gap-4 text-[#EDEDF2]">
          <div>
            <h2 className="text-2xl font-black tracking-[-0.03em] text-[#F4F2F8]">Lyric reel</h2>
            <p className="mt-1 text-sm text-[#EDEDF2]/60">
              {moment.track} · {moment.artist}
            </p>
          </div>

          {plan && seconds !== null && (
            <p className="text-sm text-[#EDEDF2]/60">
              {/* the bitrate is a ceiling; mostly-still lyric frames come in well under it */}
              {seconds}s · up to {estimateSizeMb(plan.durationMs).toFixed(1)} MB ·{" "}
              {format?.extension.toUpperCase() ?? "—"}
              {!plan.timed && " · words evenly paced (no timing data)"}
            </p>
          )}

          <p className="text-sm text-[#EDEDF2]/45">
            No audio — add the song as the sound when you post, like any reel.
          </p>

          {format === null && (
            <p className="text-sm text-[#F5A34A]">This browser can&apos;t record video.</p>
          )}
          {format?.extension === "webm" && (
            <p className="text-sm text-[#F5A34A]">
              This browser can only make WebM, which Instagram may reject. Chrome or Safari make MP4.
            </p>
          )}

          {phase.kind === "recording" && (
            <div className="flex flex-col gap-2">
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full bg-[#F5A34A] transition-[width]" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs text-[#EDEDF2]/50">
                Recording in real time — keep this tab in front ({progress}%)
              </p>
            </div>
          )}

          {phase.kind === "error" && <p className="text-sm text-[#F5A34A]">{phase.message}</p>}

          <div className="mt-auto flex flex-wrap gap-2">
            {phase.kind === "done" ? (
              <>
                <button
                  onClick={() => save(phase.blob)}
                  className={`${BUTTON} bg-[#F5A34A] text-[#0A0A0F] hover:brightness-110`}
                >
                  Download / Share
                </button>
                <button
                  onClick={() => setPhase({ kind: "preview" })}
                  className={`${BUTTON} bg-white/[0.08] text-[#F4F2F8] hover:bg-white/[0.14]`}
                >
                  Record again
                </button>
              </>
            ) : (
              <button
                onClick={record}
                disabled={!ready || !format || phase.kind === "recording"}
                className={`${BUTTON} bg-[#F5A34A] text-[#0A0A0F] hover:brightness-110`}
              >
                {phase.kind === "recording" ? "Recording…" : "Record reel"}
              </button>
            )}
            <button
              onClick={onClose}
              className={`${BUTTON} text-[#EDEDF2]/70 hover:text-[#F4F2F8]`}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
