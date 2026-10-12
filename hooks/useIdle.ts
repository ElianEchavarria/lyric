import { useEffect, useState } from "react"

// Real input from the person. Scroll is deliberately missing: the lyrics
// auto-scroll themselves, and that mustn't count as someone being active.
const ACTIVITY = ["mousemove", "mousedown", "keydown", "touchstart", "wheel"] as const

// True once there's been no input for `timeoutMs`; any input resets it.
export function useIdle(timeoutMs: number): boolean {
  const [idle, setIdle] = useState(false)

  useEffect(() => {
    let timer = setTimeout(() => setIdle(true), timeoutMs)
    const wake = () => {
      // same value → React skips the re-render, so this is cheap on mousemove
      setIdle(false)
      clearTimeout(timer)
      timer = setTimeout(() => setIdle(true), timeoutMs)
    }
    ACTIVITY.forEach((event) => window.addEventListener(event, wake, { passive: true }))
    return () => {
      clearTimeout(timer)
      ACTIVITY.forEach((event) => window.removeEventListener(event, wake))
    }
  }, [timeoutMs])

  return idle
}
