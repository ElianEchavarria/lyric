"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { ReelExporter } from "@/components/ReelExporter"
import type { Moment } from "@/types"

// Warm→cool pairs from the design spec, cycled across song groups.
const GROUP_GRADIENTS = [
  ["rgba(245,163,74,0.20)", "rgba(91,46,145,0.20)"], // amber / violet
  ["rgba(45,212,191,0.18)", "rgba(79,70,229,0.20)"], // teal / indigo
  ["rgba(196,84,120,0.20)", "rgba(79,70,229,0.20)"], // rose / indigo
  ["rgba(123,226,154,0.16)", "rgba(59,130,246,0.20)"], // green / blue
]

const NAV =
  "rounded-full bg-white/[0.06] px-4 py-2 text-sm font-semibold text-[#F4F2F8] backdrop-blur-xl transition hover:bg-white/[0.12]"

interface Group {
  trackId: string
  track: string
  artist: string
  albumArtUrl: string
  moments: Moment[]
}

// Moments arrive newest-first; group them by song, keeping that order — a
// song sits where its most recent moment would.
function groupByTrack(moments: Moment[]): Group[] {
  const groups = new Map<string, Group>()
  for (const m of moments) {
    let group = groups.get(m.trackId)
    if (!group) {
      group = { trackId: m.trackId, track: m.track, artist: m.artist, albumArtUrl: m.albumArtUrl, moments: [] }
      groups.set(m.trackId, group)
    }
    group.moments.push(m)
  }
  return [...groups.values()]
}

type PageResult =
  | { kind: "ok"; moments: Moment[]; nextCursor: string | null }
  | { kind: "signed-out" }
  | { kind: "error" }

// Pure fetch — no state. Callers decide what to do with the result.
async function fetchPage(cursor?: string): Promise<PageResult> {
  try {
    const res = await fetch(
      cursor ? `/api/moments?cursor=${encodeURIComponent(cursor)}` : "/api/moments",
    )
    if (res.status === 401) return { kind: "signed-out" }
    if (!res.ok) return { kind: "error" }
    const data = (await res.json()) as { moments: Moment[]; nextCursor: string | null }
    return { kind: "ok", ...data }
  } catch {
    return { kind: "error" }
  }
}

function timestamp(ms: number): string {
  const total = Math.floor(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`
}

export function MomentLibrary() {
  const router = useRouter()
  const [moments, setMoments] = useState<Moment[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "signed-out" | "error">("loading")
  const [loadingMore, setLoadingMore] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  // Deleting takes two taps: the first arms it, the second confirms.
  const [armedDelete, setArmedDelete] = useState<string | null>(null)
  const [reelMoment, setReelMoment] = useState<Moment | null>(null)

  useEffect(() => {
    // ignore a response that arrives after the page was left
    let cancelled = false
    fetchPage().then((result) => {
      if (cancelled) return
      if (result.kind !== "ok") return setStatus(result.kind)
      setMoments(result.moments)
      setNextCursor(result.nextCursor)
      setStatus("ready")
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function loadMore() {
    if (!nextCursor) return
    setLoadingMore(true)
    const result = await fetchPage(nextCursor)
    setLoadingMore(false)
    // a failed "load more" shouldn't blank the moments already on screen
    if (result.kind !== "ok") return setMessage("Couldn't load more. Try again.")
    setMoments((prev) => [...prev, ...result.moments])
    setNextCursor(result.nextCursor)
  }

  async function replay(m: Moment) {
    setMessage(null)
    try {
      const res = await fetch("/api/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackUri: `spotify:track:${m.trackId}`, positionMs: m.startMs }),
      })
      if (res.status === 404) return setMessage("Open Spotify on a device first, then tap again.")
      if (!res.ok) return setMessage("Couldn't start playback. Try again.")
      router.push("/player")
    } catch {
      setMessage("Couldn't start playback. Try again.")
    }
  }

  async function remove(id: string) {
    if (armedDelete !== id) return setArmedDelete(id)
    setArmedDelete(null)

    // Optimistic: drop it from the list now, put it back if the server refuses.
    const before = moments
    setMoments((prev) => prev.filter((m) => m.id !== id))
    try {
      const res = await fetch(`/api/moments/${encodeURIComponent(id)}`, { method: "DELETE" })
      if (!res.ok) throw new Error(`delete responded ${res.status}`)
    } catch {
      setMoments(before)
      setMessage("Couldn't delete that moment. Try again.")
    }
  }

  const groups = groupByTrack(moments)

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0A0A0F] px-6 py-12 sm:px-10">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(60%_100%_at_50%_0%,rgba(91,46,145,0.35),rgba(196,84,120,0.12)_45%,transparent_75%)]" />

      <div className="relative mx-auto max-w-3xl">
        <header className="mb-10 flex flex-col-reverse gap-6 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-[-0.04em] text-[#F4F2F8] sm:text-5xl">
              Your moments
            </h1>
            {status === "ready" && moments.length > 0 && (
              <p className="mt-2 text-sm text-[#EDEDF2]/50">
                {moments.length}
                {nextCursor ? "+" : ""} saved · tap one to hear it again
              </p>
            )}
          </div>
          <nav className="flex shrink-0 gap-2">
            <Link href="/playlists" className={NAV}>
              Playlists
            </Link>
            <Link href="/player" className={NAV}>
              Now playing →
            </Link>
          </nav>
        </header>

        {message && (
          <p className="mb-6 inline-block rounded-full bg-[#F5A34A]/10 px-4 py-2 text-sm text-[#F5A34A]">
            {message}
          </p>
        )}

        {status === "loading" && <p className="text-[#EDEDF2]/50">Loading moments…</p>}

        {status === "signed-out" && (
          <p className="text-[#EDEDF2]/60">
            <Link href="/" className="underline">
              Sign in
            </Link>{" "}
            to see your moments.
          </p>
        )}

        {status === "error" && (
          <p className="text-[#EDEDF2]/60">Couldn&apos;t load your moments. Refresh to try again.</p>
        )}

        {status === "ready" && moments.length === 0 && (
          <p className="max-w-md text-[#EDEDF2]/60">
            No moments yet. On the player, tap <span className="text-[#F4F2F8]">Save or share</span>,
            pick the lines that hit, and save them with a note.
          </p>
        )}

        <div className="space-y-6">
          {groups.map((group, g) => {
            const [from, to] = GROUP_GRADIENTS[g % GROUP_GRADIENTS.length]
            return (
              <section
                key={group.trackId}
                className="rounded-[20px] bg-white/[0.04] p-5 backdrop-blur-xl"
                style={{ backgroundImage: `linear-gradient(135deg, ${from}, ${to})` }}
              >
                <div className="mb-4 flex items-center gap-4">
                  {group.albumArtUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={group.albumArtUrl}
                      alt={`${group.track} cover`}
                      className="h-14 w-14 rounded-xl object-cover shadow-lg shadow-black/40"
                    />
                  ) : (
                    <div className="h-14 w-14 rounded-xl bg-white/[0.06]" />
                  )}
                  <div className="min-w-0">
                    <h2 className="truncate font-bold tracking-tight text-[#F4F2F8]">{group.track}</h2>
                    <p className="truncate text-sm text-[#EDEDF2]/60">{group.artist}</p>
                  </div>
                </div>

                <ul className="space-y-3">
                  {group.moments.map((m) => (
                    <li key={m.id} className="rounded-2xl bg-black/20 p-4">
                      <button onClick={() => replay(m)} className="block w-full text-left">
                        {m.lines.map((line, i) => (
                          <p key={i} className="text-lg font-semibold tracking-tight text-[#F4F2F8]">
                            {line}
                          </p>
                        ))}
                        {m.note && <p className="mt-2 italic text-[#EDEDF2]/70">{m.note}</p>}
                      </button>
                      <div className="mt-3 flex items-center gap-3 text-xs text-[#EDEDF2]/45">
                        <span>
                          {timestamp(m.startMs)} ·{" "}
                          {new Date(m.createdAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                        <button
                          onClick={() => replay(m)}
                          className="font-semibold text-[#7BE29A] transition hover:brightness-125"
                        >
                          ▶ Replay
                        </button>
                        <button
                          onClick={() => setReelMoment(m)}
                          className="font-semibold text-[#F5A34A] transition hover:brightness-125"
                        >
                          ✦ Reel
                        </button>
                        <button
                          onClick={() => remove(m.id)}
                          className={`ml-auto font-semibold transition ${
                            armedDelete === m.id ? "text-[#F5A34A]" : "hover:text-[#EDEDF2]"
                          }`}
                        >
                          {armedDelete === m.id ? "Tap again to delete" : "Delete"}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>

        {nextCursor && (
          <button onClick={loadMore} disabled={loadingMore} className={`mt-8 ${NAV} disabled:opacity-40`}>
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        )}
      </div>

      {reelMoment && <ReelExporter moment={reelMoment} onClose={() => setReelMoment(null)} />}
    </main>
  )
}
