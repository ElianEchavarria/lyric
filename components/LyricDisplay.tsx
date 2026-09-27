"use client"

import Link from "next/link"
import { useNowPlaying } from "@/hooks/useNowPlaying"
import { useLyrics } from "@/hooks/useLyrics"
import { usePlaybackClock } from "@/hooks/usePlaybackClock"
import { useColorPalette, type Palette } from "@/hooks/useColorPalette"
import { KaraokeLine } from "@/components/KaraokeLine"
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

const LyricRow = memo(function LyricRow({
  line,
  isActive,
  progress,
  rowRef,
}: {
  line: SyncedLine
  isActive: boolean
  progress: number
  rowRef: React.Ref<HTMLParagraphElement> | null
}) {
  return (
    <p
      ref={rowRef}
      className={
        isActive
          ? "text-3xl font-bold tracking-tight text-[#F4F2F8] transition-all duration-500"
          : "text-2xl font-semibold tracking-tight text-[#EDEDF2]/25 transition-all duration-500"
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

  useEffect(() => {
    activeLineRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [activeIndex])

  if (!nowPlaying) {
    return <Shell palette={palette} syncOffset={syncOffset}><Centered text="Nothing playing" /></Shell>
  }
  if (!lyrics) {
    return <Shell palette={palette} syncOffset={syncOffset}><Centered text="Loading lyrics…" /></Shell>
  }
  if (lyrics.type === "none") {
    return <Shell palette={palette} syncOffset={syncOffset}><Centered text="No lyrics found" /></Shell>
  }

  if (lyrics.type === "unsynced") {
    return (
      <Shell palette={palette} syncOffset={syncOffset}>
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
      <div className="mx-auto max-w-2xl space-y-4 px-6 py-[40vh]">
        {lines.map((line, i) => (
          <LyricRow
            key={i}
            line={line}
            isActive={i === activeIndex}
            // inactive rows get a constant 0, so memo skips them every frame
            progress={i === activeIndex ? progress : 0}
            rowRef={i === activeIndex ? activeLineRef : null}
          />
        ))}
      </div>
    </Shell>
  )
}
