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
import { useRef, useEffect, useCallback, useState, useSyncExternalStore, memo } from "react"
import { useIdle } from "@/hooks/useIdle"
import type { SyncedLine } from "@/types"

const NAV_PILL =
  "rounded-full bg-white/[0.06] px-4 py-2 text-sm font-semibold text-[#F4F2F8] backdrop-blur-xl transition hover:bg-white/[0.12]"

// Seconds of no input before the buttons fade away and only lyrics remain.
const CINEMA_IDLE_MS = 10_000

const subscribeNever = () => () => {}
const subscribeFullscreen = (onChange: () => void) => {
  document.addEventListener("fullscreenchange", onChange)
  return () => document.removeEventListener("fullscreenchange", onChange)
}

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen()
  else document.documentElement.requestFullscreen().catch(() => {})
}

// Browsers only allow full screen from a click or key press, so cinema mode
// can't enter it on its own — this is the one-tap way in.
function FullscreenButton() {
  const active = useSyncExternalStore(
    subscribeFullscreen,
    () => Boolean(document.fullscreenElement),
    () => false,
  )
  const supported = useSyncExternalStore(
    subscribeNever,
    () => document.fullscreenEnabled,
    () => false, // unknown on the server
  )
  // iPhone Safari can't put a page in full screen at all
  if (!supported) return null
  return (
    // Hidden on phones: there's no room next to the badge, and on a phone
    // cinema mode already strips the screen down to the lyrics.
    <button
      onClick={toggleFullscreen}
      className={`${NAV_PILL} hidden sm:inline-block`}
      title="Full screen (F)"
    >
      {active ? "Exit full screen" : "Full screen"}
    </button>
  )
}

const Shell = ({
  children,
  palette,
  art,
  syncOffset,
  cinema = false,
}: {
  children: React.ReactNode
  palette: Palette
  art?: string
  syncOffset?: number
  cinema?: boolean
}) => (
  <div
    data-cinema={cinema}
    className="lyriq-palette relative min-h-screen"
    // The palette goes in as CSS variables (registered in globals.css), so a
    // track change animates the colours instead of snapping the gradients.
    style={
      {
        "--lyriq-dark": palette.dark,
        "--lyriq-mid": palette.mid,
        "--lyriq-accent": palette.accent,
        backgroundColor: "var(--lyriq-dark)",
      } as React.CSSProperties
    }
  >
    <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(180deg,var(--lyriq-mid)_0%,var(--lyriq-dark)_100%)]" />
    {art && (
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        {/* The outer layer animates; the blur sits on the inner one, so the
            browser blurs once and only scales the result each frame. */}
        <div key={art} className="lyriq-art absolute inset-0 will-change-transform">
          <div
            className="absolute inset-0 bg-cover bg-center blur-[60px]"
            style={{ backgroundImage: `url("${art}")` }}
          />
        </div>
      </div>
    )}
    <div className="pointer-events-none fixed inset-0 bg-[var(--lyriq-accent)] opacity-25" />
    <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(75%_55%_at_50%_0%,var(--lyriq-accent),transparent_70%)] opacity-45" />
    <nav className="lyriq-chrome fixed left-5 top-5 z-20 flex flex-wrap gap-2">
      <Link href="/playlists" className={NAV_PILL}>
        ← Playlists
      </Link>
      <Link href="/library" className={NAV_PILL}>
        Library
      </Link>
      <FullscreenButton />
    </nav>
    {syncOffset !== undefined && (
      <div className="lyriq-chrome fixed bottom-5 right-5 z-20 rounded-full bg-black/30 px-3 py-1.5 text-xs text-[#EDEDF2]/40 backdrop-blur-xl">
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

// A long ease-out curve: lines glide into focus and settle, rather than moving
// at one speed and stopping abruptly.
const ROW =
  "cursor-pointer tracking-tight transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[filter,opacity,transform]"

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

// A full-screen status message: a headline plus an optional hint or action.
const Centered = ({ text, children }: { text: string; children?: React.ReactNode }) => (
  <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
    <p className="text-lg font-semibold text-[#EDEDF2]/70">{text}</p>
    {children && <div className="text-sm text-[#EDEDF2]/45">{children}</div>}
  </div>
)

const INLINE_LINK = "font-semibold text-[#F4F2F8] underline underline-offset-4"

export function LyricDisplay() {
  const player = useNowPlaying()
  const nowPlaying = player.status === "ready" ? player.nowPlaying : null
  const lyricsState = useLyrics(
    nowPlaying?.track,
    nowPlaying?.artist,
    nowPlaying?.album,
    nowPlaying?.durationMs,
  )
  const lyrics = lyricsState.status === "ready" ? lyricsState.lyrics : null
  const syncOffset = useSyncOffset()
  const { progress, seekTo } = usePlaybackClock(
    nowPlaying?.progressMs,
    nowPlaying?.isPlaying,
    syncOffset,
  )
  const palette = useColorPalette(nowPlaying?.albumArtUrl)
  const activeLineRef = useRef<HTMLParagraphElement>(null)
  const idle = useIdle(CINEMA_IDLE_MS)

  // Card selection. It remembers which track it was started on, so when the
  // song changes it simply stops applying — no effect needed to reset it, and
  // stale line numbers from the old song can never highlight lines in the new one.
  const [selection, setSelection] = useState<{
    track: string | undefined
    indices: number[]
  } | null>(null)
  const selecting = selection !== null && selection.track === nowPlaying?.track
  const selected = selecting ? selection.indices : NO_SELECTION

  // Cinema mode: only while lyrics are on screen, and never mid-selection (the
  // selection bar would vanish while someone is using it).
  const cinema =
    idle &&
    !selecting &&
    (lyricsState.status === "ready" &&
      (lyricsState.lyrics.type === "synced-lines" || lyricsState.lyrics.type === "unsynced"))

  // On a phone, the tap that wakes cinema mode would otherwise also land on
  // whatever is under the finger — the buttons are hidden, so usually a lyric
  // line, which seeks the song. So in cinema mode a touch only wakes the screen:
  // the click it produces is swallowed before anything sees it. (Hiding an
  // overlay isn't enough — React shows the buttons again between the touch and
  // the click.) Mouse users move the pointer, which wakes things, long before
  // they click, so this is touch-only.
  const cinemaRef = useRef(false)
  useEffect(() => {
    cinemaRef.current = cinema
  })
  useEffect(() => {
    function onTouchStart() {
      if (!cinemaRef.current) return
      function swallow(e: MouseEvent) {
        e.stopPropagation()
        e.preventDefault()
        stop()
      }
      function stop() {
        window.removeEventListener("click", swallow, true)
        clearTimeout(timer)
      }
      window.addEventListener("click", swallow, true)
      const timer = setTimeout(stop, 800) // a touch that never becomes a click
    }
    window.addEventListener("touchstart", onTouchStart, { capture: true, passive: true })
    return () => window.removeEventListener("touchstart", onTouchStart, { capture: true })
  }, [])

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
      behavior:
        jumped || window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      block: "center",
    })
  }, [activeIndex, nowPlaying?.track, selecting])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "f" || e.metaKey || e.ctrlKey || e.altKey) return
      // typing an "f" into the note field is text, not a shortcut
      if ((e.target as HTMLElement | null)?.closest("input, textarea, [contenteditable='true']")) return
      if (document.fullscreenEnabled) toggleFullscreen()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

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
  if (player.status === "loading") {
    return <Shell palette={palette}><Centered text="Connecting to Spotify…" /></Shell>
  }
  if (player.status === "signed-out") {
    return (
      <Shell palette={palette}>
        <Centered text="You're signed out">
          <Link href="/" className={INLINE_LINK}>Sign in with Spotify</Link> to see your lyrics.
        </Centered>
      </Shell>
    )
  }
  if (player.status === "error") {
    return (
      <Shell palette={palette}>
        <Centered text="Can't reach Spotify right now">Retrying automatically…</Centered>
      </Shell>
    )
  }
  if (!nowPlaying) {
    return (
      <Shell palette={palette}>
        <Centered text="Nothing playing">
          Play something on Spotify, or{" "}
          <Link href="/playlists" className={INLINE_LINK}>pick a playlist</Link>.
        </Centered>
      </Shell>
    )
  }
  if (lyricsState.status === "error") {
    return (
      <Shell palette={palette} art={nowPlaying?.albumArtUrl}>
        <Centered text="Couldn't load the lyrics">
          <button onClick={lyricsState.retry} className={INLINE_LINK}>Try again</button>
        </Centered>
      </Shell>
    )
  }
  if (!lyrics) {
    return <Shell palette={palette} art={nowPlaying?.albumArtUrl}><Centered text="Loading lyrics…" /></Shell>
  }
  if (lyrics.type === "none") {
    return (
      <Shell palette={palette} art={nowPlaying?.albumArtUrl}>
        <Centered text="No lyrics for this one">
          {nowPlaying.track} isn&apos;t in any of the lyric sources yet.
        </Centered>
      </Shell>
    )
  }

  if (lyrics.type === "unsynced") {
    return (
      <Shell palette={palette} art={nowPlaying?.albumArtUrl} cinema={cinema}>
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
    <Shell
      palette={palette}
      art={nowPlaying?.albumArtUrl}
      syncOffset={selecting ? undefined : syncOffset}
      cinema={cinema}
    >
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
