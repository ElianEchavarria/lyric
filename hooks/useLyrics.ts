import { useState, useEffect, useCallback } from "react"
import type { LyricResult } from "@/types"

export type LyricsState =
  | { status: "idle" } // nothing to look up yet
  | { status: "loading" }
  | { status: "ready"; lyrics: LyricResult }
  | { status: "error"; retry: () => void }

type Settled = { key: string } & (
  | { status: "ready"; lyrics: LyricResult }
  | { status: "error" }
)

// Fetches lyrics for the current track. Re-runs only when the track changes
// (not on every now-playing poll), because those strings stay stable per song.
export function useLyrics(
  track: string | undefined,
  artist: string | undefined,
  album?: string,
  durationMs?: number,
): LyricsState {
  const [settled, setSettled] = useState<Settled | null>(null)
  const [attempt, setAttempt] = useState(0)

  // Identifies one lookup. A result only counts if it carries the current key,
  // so a new track reads as "loading" straight away — no need to clear old
  // state in an effect, and a slow response for the old track can't show.
  const key = track && artist ? `${artist}::${track}::${album ?? ""}::${durationMs ?? ""}::${attempt}` : null

  useEffect(() => {
    if (!key || !track || !artist) return
    let cancelled = false

    const params = new URLSearchParams({ track, artist })
    if (album) params.set("album", album)
    if (durationMs) params.set("duration", String(Math.round(durationMs / 1000)))

    fetch(`/api/lyrics?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error(`lyrics responded ${res.status}`)
        return res.json() as Promise<LyricResult>
      })
      .then(
        (lyrics) => {
          if (!cancelled) setSettled({ key, status: "ready", lyrics })
        },
        (err) => {
          console.error("lyrics error:", err)
          if (!cancelled) setSettled({ key, status: "error" })
        },
      )

    return () => {
      cancelled = true
    }
  }, [key, track, artist, album, durationMs])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  if (!key) return { status: "idle" }
  if (settled?.key !== key) return { status: "loading" }
  return settled.status === "ready"
    ? { status: "ready", lyrics: settled.lyrics }
    : { status: "error", retry }
}
