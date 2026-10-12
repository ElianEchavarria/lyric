"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { Playlist } from "@/types"

type LoadState =
  | { status: "loading" }
  | { status: "ready"; playlists: Playlist[] }
  | { status: "signed-out" }
  | { status: "error" }

const Status = ({ children }: { children: React.ReactNode }) => (
  <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#0A0A0F] px-6 text-center text-[#EDEDF2]/60">
    {children}
  </div>
)

const PlaylistPicker = () => {
  const [load, setLoad] = useState<LoadState>({ status: "loading" })
  const [attempt, setAttempt] = useState(0)
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
    let cancelled = false
    fetch("/api/playlists")
      .then(async (res): Promise<LoadState> => {
        if (res.status === 401) return { status: "signed-out" }
        if (!res.ok) throw new Error(`playlists responded ${res.status}`)
        return { status: "ready", playlists: (await res.json()) as Playlist[] }
      })
      .catch((err): LoadState => {
        console.error("playlists error:", err)
        return { status: "error" }
      })
      .then((next) => {
        if (!cancelled) setLoad(next)
      })
    return () => {
      cancelled = true
    }
  }, [attempt])

  if (load.status === "loading") {
    return <Status>Loading playlists…</Status>
  }
  if (load.status === "signed-out") {
    return (
      <Status>
        <p>
          <Link href="/" className="font-semibold text-[#F4F2F8] underline underline-offset-4">
            Sign in with Spotify
          </Link>{" "}
          to see your playlists.
        </p>
      </Status>
    )
  }
  if (load.status === "error") {
    return (
      <Status>
        <p>Couldn&apos;t load your playlists.</p>
        <button
          onClick={() => {
            setLoad({ status: "loading" })
            setAttempt((n) => n + 1)
          }}
          className="font-semibold text-[#F4F2F8] underline underline-offset-4"
        >
          Try again
        </button>
      </Status>
    )
  }

  const { playlists } = load

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0A0A0F] px-6 py-12 sm:px-10">
      {/* ambient album-art bleed glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(60%_100%_at_50%_0%,rgba(91,46,145,0.35),rgba(196,84,120,0.12)_45%,transparent_75%)]" />

      <div className="relative mx-auto max-w-6xl">
        <header className="mb-10 flex flex-col-reverse gap-6 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
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
