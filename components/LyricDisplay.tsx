"use client"

import Link from "next/link"
import { useNowPlaying } from "@/hooks/useNowPlaying"
import { useLyrics } from "@/hooks/useLyrics"
import { usePlaybackClock } from "@/hooks/usePlaybackClock"
import { useColorPalette, type Palette } from "@/hooks/useColorPalette"
import { KaraokeLine } from "@/components/KaraokeLine"
import { SourceBadge } from "@/components/SourceBadge"
import { useSyncOffset } from "@/hooks/useSyncOffset"
import { useRef, useEffect, memo } from "react"
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
    <Link
      href="/playlists"
      className="fixed left-5 top-5 z-20 rounded-full bg-white/[0.06] px-4 py-2 text-sm font-semibold text-[#F4F2F8] backdrop-blur-xl transition hover:bg-white/[0.12]"
    >
      ← Playlists
    </Link>
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

const LyricRow = memo(function LyricRow({
  line,
  isActive,
  distance,
  progress,
  rowRef,
}: {
  line: SyncedLine
  isActive: boolean
  distance: number
  progress: number
  rowRef: React.Ref<HTMLParagraphElement> | null
}) {
  return (
    <p
      ref={rowRef}
      style={depthStyle(distance)}
      className={
        isActive
          ? "text-3xl font-bold tracking-tight text-[#F4F2F8] transition-all duration-500 will-change-[filter,opacity,transform]"
          : "text-2xl font-semibold tracking-tight text-[#EDEDF2] transition-all duration-500 will-change-[filter,opacity,transform]"
      }
    >
      {isActive ? (
        <KaraokeLine line={line} progress={progress} />
      ) : (
        line.text || "♪"
      )}
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
  const progress = usePlaybackClock(
    nowPlaying?.progressMs,
    nowPlaying?.isPlaying,
    syncOffset,
  )
  const palette = useColorPalette(nowPlaying?.albumArtUrl)
  const activeLineRef = useRef<HTMLParagraphElement>(null)

  const lines = lyrics?.type === "synced-lines" ? (lyrics.lines as SyncedLine[]) : []
  let activeIndex = -1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startTime <= progress) activeIndex = i
    else break
  }

  const prevIndexRef = useRef(-1)
  const prevTrackRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    const prevIndex = prevIndexRef.current
    const prevTrack = prevTrackRef.current
    prevIndexRef.current = activeIndex
    prevTrackRef.current = nowPlaying?.track

    if (!activeLineRef.current) return

    // A seek or a track change moves the active line by a lot. Smooth-scrolling
    // across that distance takes seconds and looks broken, so snap instead.
    const jumped =
      nowPlaying?.track !== prevTrack ||
      Math.abs(activeIndex - prevIndex) > SEEK_JUMP_LINES

    activeLineRef.current.scrollIntoView({
      behavior: jumped ? "auto" : "smooth",
      block: "center",
    })
  }, [activeIndex, nowPlaying?.track])

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
            <p key={i}>{line}</p>
          ))}
        </div>
      </Shell>
    )
  }

  return (
    <Shell palette={palette} syncOffset={syncOffset}>
      <SourceBadge source={lyrics.source} type={lyrics.type} />
      <div className="mx-auto max-w-2xl space-y-4 px-6 py-[40vh]">
        {lines.map((line, i) => (
          <LyricRow
            key={i}
            line={line}
            isActive={i === activeIndex}
            distance={activeIndex < 0 ? MAX_DEPTH : Math.abs(i - activeIndex)}
            // inactive rows get a constant 0, so memo skips them every frame
            progress={i === activeIndex ? progress : 0}
            rowRef={i === activeIndex ? activeLineRef : null}
          />
        ))}
      </div>
    </Shell>
  )
}
