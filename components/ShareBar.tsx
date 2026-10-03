"use client"

import { useState } from "react"

const PILL =
  "rounded-full bg-white/[0.06] px-4 py-2 text-sm font-semibold text-[#F4F2F8] backdrop-blur-xl transition hover:bg-white/[0.12]"

export function ShareBar({
  selecting,
  count,
  max,
  onStart,
  onCancel,
  onCreate,
}: {
  selecting: boolean
  count: number
  max: number
  onStart: () => void
  onCancel: () => void
  onCreate: () => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!selecting) {
    return (
      <button
        onClick={() => {
          setError(null)
          onStart()
        }}
        className={`fixed bottom-5 left-5 z-20 ${PILL}`}
      >
        Share lyrics
      </button>
    )
  }

  async function create() {
    setBusy(true)
    setError(null)
    try {
      await onCreate()
    } catch (err) {
      console.error("card error:", err)
      setError("Couldn't create the card. Try again.")
    } finally {
      setBusy(false)
    }
  }

  const status = error ?? (count ? `${count} of ${max} lines` : `Tap up to ${max} lines`)

  return (
    <div className="fixed inset-x-0 bottom-5 z-20 flex justify-center px-5">
      <div className="flex items-center gap-2 rounded-full bg-black/40 py-2 pl-5 pr-2 text-sm backdrop-blur-xl">
        <span className={error ? "text-[#F5A34A]" : "text-[#EDEDF2]/70"}>{status}</span>
        <button
          onClick={onCancel}
          className="rounded-full px-3 py-1.5 font-semibold text-[#EDEDF2]/70 transition hover:text-[#F4F2F8]"
        >
          Cancel
        </button>
        <button
          onClick={create}
          disabled={!count || busy}
          className="rounded-full bg-[#F5A34A] px-4 py-1.5 font-semibold text-[#0A0A0F] transition hover:brightness-110 disabled:opacity-40"
        >
          {busy ? "Creating…" : "Create card"}
        </button>
      </div>
    </div>
  )
}
