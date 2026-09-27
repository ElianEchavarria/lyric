import { useState, useEffect } from "react"

const STORAGE_KEY = "lyriq:syncOffsetMs"
const DEFAULT_OFFSET_MS = 650
const STEP_MS = 100

// How far ahead the lyric clock runs, to cancel out Spotify's round trip,
// its reporting lag, and audio output latency (Bluetooth is the big one).
// The right value is per-setup, so it's tunable live with [ and ] and
// remembered in localStorage.
export function useSyncOffset() {
  const [offset, setOffset] = useState(DEFAULT_OFFSET_MS)

  useEffect(() => {
    const saved = Number(localStorage.getItem(STORAGE_KEY))
    if (Number.isFinite(saved) && saved !== 0) setOffset(saved)
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "[" && e.key !== "]") return
      setOffset((prev) => {
        const next = Math.max(prev + (e.key === "]" ? STEP_MS : -STEP_MS), 0)
        localStorage.setItem(STORAGE_KEY, String(next))
        return next
      })
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  return offset
}
