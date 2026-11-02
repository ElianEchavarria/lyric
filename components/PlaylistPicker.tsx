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
              className="group relative isolate flex flex-col gap-3 rounded-[24px] bg-gradient-to-b from-white/[0.09] to-white/[0.02] p-2.5 text-left ring-1 ring-white/[0.08] backdrop-blur-xl transition duration-300 ease-out hover:-translate-y-1.5 hover:ring-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C45478] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              {/* cover-colour glow that bleeds out behind the card on hover */}
              {playlist.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={playlist.imageUrl}
                  alt=""
                  aria-hidden
                  className="pointer-events-none absolute inset-4 -z-10 h-[calc(100%-2rem)] w-[calc(100%-2rem)] scale-90 rounded-full object-cover opacity-0 blur-2xl saturate-150 transition duration-500 group-hover:scale-110 group-hover:opacity-60 group-focus-visible:opacity-60"
                />
              )}

              <div className="relative aspect-square w-full overflow-hidden rounded-[18px] shadow-xl shadow-black/50">
                {playlist.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={playlist.imageUrl}
                    alt={`${playlist.name} cover`}
                    className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#5B2E91] via-[#3A1D5E] to-[#C45478]">
                    <svg viewBox="0 0 24 24" className="h-1/3 w-1/3 fill-white/70" aria-hidden>
                      <path d="M21 3v12.5a3.5 3.5 0 1 1-2-3.163V7.36L11 8.693V18.5a3.5 3.5 0 1 1-2-3.163V5.307L21 3Z" />
                    </svg>
                  </div>
                )}

                {/* legibility scrim + inner highlight */}
                <div className="pointer-events-none absolute inset-0 rounded-[18px] bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 ring-1 ring-inset ring-white/10 transition duration-300 group-hover:opacity-100" />

                {/* floating play button */}
                <span className="absolute bottom-3 right-3 flex h-11 w-11 translate-y-2 items-center justify-center rounded-full bg-gradient-to-br from-[#F4F2F8] to-[#D9D3E6] text-[#0A0A0F] opacity-0 shadow-lg shadow-black/40 transition duration-300 ease-out group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100 group-active:scale-95">
                  <svg viewBox="0 0 24 24" className="ml-0.5 h-5 w-5 fill-current" aria-hidden>
                    <path d="M8 5.14v13.72a1 1 0 0 0 1.52.85l10.8-6.86a1 1 0 0 0 0-1.7L9.52 4.29A1 1 0 0 0 8 5.14Z" />
                  </svg>
                </span>
              </div>

              <div className="flex min-w-0 flex-col gap-1.5 px-1.5 pb-1.5">
                <span className="truncate text-[15px] font-bold tracking-tight text-[#F4F2F8]">
                  {playlist.name}
                </span>
                <span className="w-fit rounded-full bg-white/[0.07] px-2 py-0.5 text-[11px] font-medium text-[#EDEDF2]/60 ring-1 ring-inset ring-white/[0.06]">
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
