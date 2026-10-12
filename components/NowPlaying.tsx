"use client"

import Link from "next/link"
import { useNowPlaying } from "@/hooks/useNowPlaying"

const NowPlaying = () => {
  const player = useNowPlaying()
  const nowPlaying = player.status === "ready" ? player.nowPlaying : null

  return (
    <div className="relative min-h-screen bg-[#0A0A0F]">
      <Link
        href="/playlists"
        className="absolute left-5 top-5 z-10 rounded-full bg-white/[0.06] px-4 py-2 text-sm font-semibold text-[#F4F2F8] backdrop-blur-xl transition hover:bg-white/[0.12]"
      >
        ← Playlists
      </Link>

      {!nowPlaying ? (
        // null on first load AND when nothing is playing (route returns 204 → null)
        <div className="flex min-h-screen items-center justify-center text-[#EDEDF2]/60">
          <p>Nothing playing</p>
        </div>
      ) : (
        <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={nowPlaying.albumArtUrl}
            alt={`${nowPlaying.album} cover`}
            className="h-64 w-64 rounded-2xl shadow-2xl"
          />
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-black tracking-tight text-[#F4F2F8]">
              {nowPlaying.track}
            </h1>
            <p className="text-lg text-[#EDEDF2]/70">{nowPlaying.artist}</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default NowPlaying
