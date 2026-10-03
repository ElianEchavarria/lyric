import { useState, useEffect, useRef, useCallback } from "react"

// After a click-to-seek, the next poll can still report the PRE-seek position
// if it lands before Spotify has applied the seek. Ignoring polls for this long
// stops the highlight from flickering back to the old line and then forward again.
const SEEK_GRACE_MS = 1500

// Spotify's progressMs only refreshes once per poll (~3s), so it sits frozen in
// between — which makes lyric highlighting lag behind the audio by up to 3s.
// This estimates the live position by adding the real time elapsed since the
// last poll, and re-anchors whenever a fresh poll arrives.
export function usePlaybackClock(
  polledProgressMs: number | undefined,
  isPlaying: boolean | undefined,
  // pushes the clock ahead to cancel API + audio latency; see useSyncOffset
  offsetMs = 0,
) {
  const [progress, setProgress] = useState(0)

  // The last trusted reading: the polled value + when we received it.
  // A ref (not state) because updating the anchor shouldn't cause a re-render —
  // only the visible `progress` should.
  const anchor = useRef({ base: 0, at: 0 })
  const lastSeekAt = useRef(-Infinity)

  // A fresh poll arrived → hard resync, so drift never accumulates.
  useEffect(() => {
    if (polledProgressMs == null) return
    if (performance.now() - lastSeekAt.current < SEEK_GRACE_MS) return
    const base = polledProgressMs + offsetMs
    anchor.current = { base, at: performance.now() }
    setProgress(base)
  }, [polledProgressMs, offsetMs])

  // While playing, tick forward from the anchor. Not running when paused means
  // the clock freezes — which is exactly right.
  useEffect(() => {
    if (!isPlaying) return

    // requestAnimationFrame (~60fps) rather than an interval, so the word-level
    // sweep in KaraokeLine paints smoothly instead of stepping.
    let frame: number
    const tick = () => {
      const { base, at } = anchor.current
      setProgress(base + (performance.now() - at))
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(frame)
  }, [isPlaying])

  // Optimistic seek: move the clock now instead of waiting up to 3s for the
  // next poll to confirm it, so clicking a line responds instantly.
  const seekTo = useCallback(
    (positionMs: number) => {
      lastSeekAt.current = performance.now()
      const base = positionMs + offsetMs
      anchor.current = { base, at: performance.now() }
      setProgress(base)
    },
    [offsetMs],
  )

  return { progress, seekTo }
}
