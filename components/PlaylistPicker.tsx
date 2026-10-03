"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { Playlist } from "@/types"

const PlaylistPicker = () => {
  const [playlists, setPlaylists] = useState<Playlist[] | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const router = useRouter()

  async function play(uri: string) {
    setMessage(null)
    try {
      const res = await fetch("/api/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contextUri: uri }),
      })
      if (res.status === 404) {
        setMessage("Open Spotify on a device first and play a song, then tap again.")
        return
      }
      if (!res.ok) {
        setMessage("Couldn't start playback. Try again.")
        return
      }
      router.push("/player") // playback started → go straight to the lyrics
    } catch {
      setMessage("Couldn't start playback. Try again.")
    }
  }

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/playlists")
        if (!res.ok) {
          console.error("playlists failed:", res.status)
          return
        }
        const data = (await res.json()) as Playlist[]
        setPlaylists(data)
      } catch (err) {
        console.error("playlists error:", err)
      }
    }
    load()
  }, [])

  if (!playlists) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0A0F] text-[#EDEDF2]/50">
        <p>Loading playlists…</p>
      </div>
    )
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0A0A0F] px-6 py-12 sm:px-10">
      {/* ambient album-art bleed glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(60%_100%_at_50%_0%,rgba(91,46,145,0.35),rgba(196,84,120,0.12)_45%,transparent_75%)]" />

      <div className="relative mx-auto max-w-6xl">
        <header className="mb-10 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-[-0.04em] text-[#F4F2F8] sm:text-5xl">
              Your playlists
            </h1>
            <p className="mt-2 text-sm text-[#EDEDF2]/50">
              Tap one to play it on your active Spotify device.
            </p>
          </div>
          <nav className="flex shrink-0 gap-2">
            <Link
              href="/library"
              className="rounded-full bg-white/[0.06] px-4 py-2 text-sm font-semibold text-[#F4F2F8] backdrop-blur-xl transition hover:bg-white/[0.12]"
            >
              Library
            </Link>
            <Link
              href="/player"
              className="rounded-full bg-white/[0.06] px-4 py-2 text-sm font-semibold text-[#F4F2F8] backdrop-blur-xl transition hover:bg-white/[0.12]"
            >
              Now playing →
            </Link>
          </nav>
        </header>

        {message && (
          <p className="mb-6 inline-block rounded-full bg-[#F5A34A]/10 px-4 py-2 text-sm text-[#F5A34A]">
            {message}
          </p>
        )}

        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {playlists.map((playlist) => (
            <button
              key={playlist.id}
              onClick={() => play(playlist.uri)}
              className="group flex flex-col gap-3 rounded-[20px] bg-white/[0.06] p-3 text-left backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:bg-white/[0.10]"
            >
              {playlist.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={playlist.imageUrl}
                  alt={`${playlist.name} cover`}
                  className="aspect-square w-full rounded-2xl object-cover shadow-lg shadow-black/40"
                />
              ) : (
                <div className="aspect-square w-full rounded-2xl bg-white/[0.06]" />
              )}
              <div className="flex flex-col gap-0.5 px-1 pb-1">
                <span className="truncate text-sm font-semibold tracking-tight text-[#F4F2F8]">
                  {playlist.name}
                </span>
                <span className="text-xs text-[#EDEDF2]/45">
                  {playlist.trackCount} {playlist.trackCount === 1 ? "track" : "tracks"}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </main>
  )
}

export default PlaylistPicker
