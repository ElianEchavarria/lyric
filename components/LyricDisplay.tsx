"use client"

import Link from "next/link"
import { useNowPlaying } from "@/hooks/useNowPlaying"
import { useLyrics } from "@/hooks/useLyrics"
import { usePlaybackClock } from "@/hooks/usePlaybackClock"
import { useColorPalette, type Palette } from "@/hooks/useColorPalette"
import { KaraokeLine } from "@/components/KaraokeLine"
import { SourceBadge } from "@/components/SourceBadge"
import { SelectionBar } from "@/components/SelectionBar"
import { useSyncOffset } from "@/hooks/useSyncOffset"
import { shareLyricCard } from "@/lib/shareCard"
import { useRef, useEffect, useCallback, useState, memo } from "react"
import type { SyncedLine } from "@/types"

const Shell = ({
  children,
  palette,
  syncOffset,
}: {
  children: React.ReactNode
  palette: Palette
  syncOffset?: number
}) => (
  <div
    className="relative min-h-screen transition-colors duration-700"
    style={{ backgroundColor: palette.dark }}
  >
    <div
      className="pointer-events-none fixed inset-0 transition-[background] duration-700"
      style={{
        background: `linear-gradient(180deg, ${palette.mid} 0%, ${palette.dark} 100%)`,
      }}
    />
    <div
      className="pointer-events-none fixed inset-0 opacity-25 transition-colors duration-700"
      style={{ backgroundColor: palette.accent }}
    />
    <div
      className="pointer-events-none fixed inset-0 opacity-45 transition-[background] duration-700"
      style={{
        background: `radial-gradient(75% 55% at 50% 0%, ${palette.accent}, transparent 70%)`,
      }}
    />
    <nav className="fixed left-5 top-5 z-20 flex gap-2">
      <Link
        href="/playlists"
        className="rounded-full bg-white/[0.06] px-4 py-2 text-sm font-semibold text-[#F4F2F8] backdrop-blur-xl transition hover:bg-white/[0.12]"
      >
        ← Playlists
      </Link>
      <Link
        href="/library"
        className="rounded-full bg-white/[0.06] px-4 py-2 text-sm font-semibold text-[#F4F2F8] backdrop-blur-xl transition hover:bg-white/[0.12]"
      >
        Library
      </Link>
    </nav>
    {syncOffset !== undefined && (
      <div className="fixed bottom-5 right-5 z-20 rounded-full bg-black/30 px-3 py-1.5 text-xs text-[#EDEDF2]/40 backdrop-blur-xl">
        sync {syncOffset}ms · [ ]
      </div>
    )}
    <div className="relative z-10">{children}</div>
  </div>
)

// Depth of field: the further a line sits from the active one, the blurrier,
// fainter and smaller it gets — so the current line reads as the focal plane.
// Capped at MAX_DEPTH because blur() is expensive and past ~4 lines it all
// looks the same anyway.
const MAX_DEPTH = 4

// Active-line moves bigger than this mean a seek/skip rather than normal
// playback, so the scroll snaps instead of animating through every line.
const SEEK_JUMP_LINES = 3

const MAX_CARD_LINES = 4

// Module-level so its identity never changes — a fresh [] each render would
// look like a new prop to every memoized row.
const NO_SELECTION: number[] = []

function depthStyle(distance: number): React.CSSProperties {
  if (distance === 0) {
    return { filter: "blur(0px)", opacity: 1, transform: "scale(1)" }
  }
  const depth = Math.min(distance, MAX_DEPTH)
  return {
    filter: `blur(${(depth * 1.3).toFixed(1)}px)`,
    opacity: Math.max(0.42 - (depth - 1) * 0.1, 0.13),
    transform: `scale(${(1 - depth * 0.03).toFixed(3)})`,
    transformOrigin: "left center",
  }
}

// While choosing lines for a card, depth of field gets in the way: you can't
// pick what you can't read. So it's swapped for a flat selected/unselected look.
function selectStyle(selected: boolean): React.CSSProperties {
  return { filter: "none", opacity: selected ? 1 : 0.4, transform: "none" }
}

const ROW = "cursor-pointer tracking-tight transition-all duration-500 will-change-[filter,opacity,transform]"

const LyricRow = memo(function LyricRow({
  line,
  index,
  isActive,
  distance,
  progress,
  rowRef,
  selecting,
  selected,
  onSeek,
  onToggle,
}: {
  line: SyncedLine
  index: number
  isActive: boolean
  distance: number
  progress: number
  rowRef: React.Ref<HTMLParagraphElement> | null
  selecting: boolean
  selected: boolean
  onSeek: (positionMs: number) => void
  onToggle: (index: number) => void
}) {
  const showKaraoke = isActive && !selecting

  // `!` is needed because depthStyle/selectStyle set opacity and filter inline,
  // and inline styles beat normal classes — so hover couldn't otherwise lift it.
  const hover = selecting
    ? selected
      ? ""
      : "hover:opacity-70!"
    : isActive
      ? ""
      : "hover:opacity-80! hover:blur-none!"

  return (
    <p
      ref={rowRef}
      onClick={() => (selecting ? onToggle(index) : onSeek(line.startTime))}
      style={selecting ? selectStyle(selected) : depthStyle(distance)}
      className={
        showKaraoke
          ? `${ROW} text-3xl font-bold text-[#F4F2F8]`
          : `${ROW} text-2xl font-semibold text-[#EDEDF2] ${hover}`
      }
    >
      {showKaraoke ? <KaraokeLine line={line} progress={progress} /> : line.text || "♪"}
    </p>
  )
})

const Centered = ({ text }: { text: string }) => (
  <div className="flex min-h-screen items-center justify-center text-[#EDEDF2]/50">
    <p>{text}</p>
  </div>
)

export function LyricDisplay() {
  const nowPlaying = useNowPlaying()
  const lyrics = useLyrics(
    nowPlaying?.track,
    nowPlaying?.artist,
    nowPlaying?.album,
    nowPlaying?.durationMs,
  )
  const syncOffset = useSyncOffset()
  const { progress, seekTo } = usePlaybackClock(
    nowPlaying?.progressMs,
    nowPlaying?.isPlaying,
    syncOffset,
  )
  const palette = useColorPalette(nowPlaying?.albumArtUrl)
  const activeLineRef = useRef<HTMLParagraphElement>(null)

  // Card selection. It remembers which track it was started on, so when the
  // song changes it simply stops applying — no effect needed to reset it, and
  // stale line numbers from the old song can never highlight lines in the new one.
  const [selection, setSelection] = useState<{
    track: string | undefined
    indices: number[]
  } | null>(null)
  const selecting = selection !== null && selection.track === nowPlaying?.track
  const selected = selecting ? selection.indices : NO_SELECTION

  // Stable identity (functional update, no deps) so memoized rows aren't
  // re-rendered just because this function was recreated.
  const toggleLine = useCallback((index: number) => {
    setSelection((prev) => {
      if (!prev) return prev
      if (prev.indices.includes(index)) {
        return { ...prev, indices: prev.indices.filter((i) => i !== index) }
      }
      if (prev.indices.length >= MAX_CARD_LINES) return prev
      return { ...prev, indices: [...prev.indices, index].sort((a, b) => a - b) }
    })
  }, [])

  // useCallback keeps this function's identity stable across renders. LyricRow
  // is memoized, so a new function every frame would defeat the memo and
  // re-render every row 60 times a second again.
  const handleSeek = useCallback(
    async (positionMs: number) => {
      seekTo(positionMs) // move the highlight now; Spotify catches up behind it
      try {
        const res = await fetch("/api/seek", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ positionMs }),
        })
        if (!res.ok) console.error("seek failed:", res.status)
      } catch (err) {
        console.error("seek error:", err)
      }
    },
    [seekTo],
  )

  const lines = lyrics?.type === "synced-lines" ? (lyrics.lines as SyncedLine[]) : []
  let activeIndex = -1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startTime <= progress) activeIndex = i
    else break
  }

  // The text of every displayed line, synced or not — what a card is built from.
  const lineTexts =
    lyrics?.type === "synced-lines"
      ? lines.map((line) => line.text)
      : lyrics?.type === "unsynced"
        ? (lyrics.lines as string[])
        : []

  const prevIndexRef = useRef(-1)
  const prevTrackRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    const prevIndex = prevIndexRef.current
    const prevTrack = prevTrackRef.current
    prevIndexRef.current = activeIndex
    prevTrackRef.current = nowPlaying?.track

    // Don't scroll the page out from under someone picking lines.
    if (selecting || !activeLineRef.current) return

    // A seek or a track change moves the active line by a lot. Smooth-scrolling
    // across that distance takes seconds and looks broken, so snap instead.
    const jumped =
      nowPlaying?.track !== prevTrack ||
      Math.abs(activeIndex - prevIndex) > SEEK_JUMP_LINES

    activeLineRef.current.scrollIntoView({
      behavior: jumped ? "auto" : "smooth",
      block: "center",
    })
  }, [activeIndex, nowPlaying?.track, selecting])

  async function createCard() {
    if (!nowPlaying) return
    // instrumental "♪" lines have no text worth putting on a card
    const texts = selected.map((i) => lineTexts[i]).filter(Boolean)
    if (!texts.length) throw new Error("selected lines have no text")

    await shareLyricCard({
      lines: texts,
      track: nowPlaying.track,
      artist: nowPlaying.artist,
      albumArtUrl: nowPlaying.albumArtUrl,
      palette,
    })
    setSelection(null)
  }

  async function saveMoment(note: string) {
    if (!nowPlaying) return
    const texts = selected.map((i) => lineTexts[i]).filter((text) => text.trim())
    if (!texts.length) throw new Error("selected lines have no text")

    let startMs: number
    let endMs: number
    if (lyrics?.type === "synced-lines") {
      // The window runs from the first selected line to where the line after the
      // last one begins — exactly the stretch of song the moment covers.
      const first = selected[0]
      const last = selected[selected.length - 1]
      startMs = lines[first].startTime
      endMs = lines[last + 1]?.startTime ?? lines[last].startTime + 4000
    } else {
      // Plain-text lyrics have no timings, so remember where the song was when
      // saved. (progress runs ahead by the sync offset; take it back out.)
      startMs = Math.max(0, Math.round(progress - syncOffset))
      endMs = startMs
    }

    const res = await fetch("/api/moments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trackId: nowPlaying.trackId,
        track: nowPlaying.track,
        artist: nowPlaying.artist,
        album: nowPlaying.album,
        albumArtUrl: nowPlaying.albumArtUrl,
        startMs,
        endMs,
        lines: texts,
        note: note || null,
      }),
    })
    if (!res.ok) throw new Error(`save responded ${res.status}`)
    setSelection(null)
  }

  const shareBar = (
    <SelectionBar
      selecting={selecting}
      count={selected.length}
      max={MAX_CARD_LINES}
      onStart={() => setSelection({ track: nowPlaying?.track, indices: [] })}
      onCancel={() => setSelection(null)}
      onShare={createCard}
      onSave={saveMoment}
    />
  )

  // The sync-offset readout is only shown on synced lyrics — it does nothing
  // anywhere else, so showing it there would just be noise.
  if (!nowPlaying) {
    return <Shell palette={palette}><Centered text="Nothing playing" /></Shell>
  }
  if (!lyrics) {
    return <Shell palette={palette}><Centered text="Loading lyrics…" /></Shell>
  }
  if (lyrics.type === "none") {
    return <Shell palette={palette}><Centered text="No lyrics found" /></Shell>
  }

  if (lyrics.type === "unsynced") {
    return (
      <Shell palette={palette}>
        <SourceBadge source={lyrics.source} type={lyrics.type} />
        <div className="mx-auto max-w-2xl space-y-3 px-6 py-24 text-lg text-[#EDEDF2]/70">
          {(lyrics.lines as string[]).map((line, i) => (
            <p
              key={i}
              onClick={selecting ? () => toggleLine(i) : undefined}
              className={
                selecting
                  ? `cursor-pointer transition-opacity ${
                      selected.includes(i)
                        ? "text-[#F4F2F8] opacity-100"
                        : "opacity-50 hover:opacity-80"
                    }`
                  : undefined
              }
            >
              {line}
            </p>
          ))}
        </div>
        {shareBar}
      </Shell>
    )
  }

  return (
    // the share bar takes over the bottom edge, so the sync readout steps aside
    <Shell palette={palette} syncOffset={selecting ? undefined : syncOffset}>
      <SourceBadge source={lyrics.source} type={lyrics.type} />
      <div className="mx-auto max-w-2xl space-y-4 px-6 py-[40vh]">
        {lines.map((line, i) => (
          <LyricRow
            key={i}
            line={line}
            index={i}
            isActive={i === activeIndex}
            distance={activeIndex < 0 ? MAX_DEPTH : Math.abs(i - activeIndex)}
            // inactive rows get a constant 0, so memo skips them every frame
            progress={i === activeIndex ? progress : 0}
            rowRef={i === activeIndex ? activeLineRef : null}
            selecting={selecting}
            selected={selected.includes(i)}
            onSeek={handleSeek}
            onToggle={toggleLine}
          />
        ))}
      </div>
      {shareBar}
    </Shell>
  )
}
