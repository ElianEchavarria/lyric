import { useEffect, useSyncExternalStore } from "react"

const STORAGE_KEY = "lyriq:syncOffsetMs"
const DEFAULT_OFFSET_MS = 650
const STEP_MS = 100

// How far ahead the lyric clock runs, to cancel out Spotify's round trip,
// its reporting lag, and audio output latency (Bluetooth is the big one).
// The right value is per-setup, so it's tunable live with [ and ] and
// remembered in localStorage.

const listeners = new Set<() => void>()

// Used when storage is blocked (private browsing, strict privacy settings), so
// adjustments still work for the session even if they can't be remembered.
let memoryOffset: number | null = null

function read(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    // Check for "missing" explicitly: Number(null) is 0, which would make
    // "never set" indistinguishable from a deliberate 0ms offset.
    if (raw === null) return memoryOffset ?? DEFAULT_OFFSET_MS
    const value = Number(raw)
    return Number.isFinite(value) && value >= 0 ? value : DEFAULT_OFFSET_MS
  } catch {
    return memoryOffset ?? DEFAULT_OFFSET_MS
  }
}

function write(value: number) {
  memoryOffset = value
  try {
    localStorage.setItem(STORAGE_KEY, String(value))
  } catch {
    // storage blocked — memoryOffset still carries it for this session
  }
  listeners.forEach((notify) => notify())
}

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  // fires when another tab changes the value, so open tabs stay in step
  window.addEventListener("storage", onChange)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener("storage", onChange)
  }
}

export function useSyncOffset() {
  // localStorage doesn't exist during the server render, so the server (and
  // hydration) use the default; React then reads the stored value directly —
  // no effect, no render with the wrong offset first.
  const offset = useSyncExternalStore(subscribe, read, () => DEFAULT_OFFSET_MS)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "[" && e.key !== "]") return
      // Brackets typed into a text field are text, not a sync adjustment.
      const el = e.target as HTMLElement | null
      if (el?.closest("input, textarea, [contenteditable='true']")) return
      write(Math.max(read() + (e.key === "]" ? STEP_MS : -STEP_MS), 0))
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  return offset
}
