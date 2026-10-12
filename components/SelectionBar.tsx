"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

const PILL =
  "rounded-full bg-white/[0.06] px-4 py-2 text-sm font-semibold text-[#F4F2F8] backdrop-blur-xl transition hover:bg-white/[0.12]"
const GHOST =
  "rounded-full px-3 py-1.5 font-semibold text-[#EDEDF2]/70 transition hover:text-[#F4F2F8]"
const PRIMARY =
  "rounded-full bg-[#F5A34A] px-4 py-1.5 font-semibold text-[#0A0A0F] transition hover:brightness-110 disabled:opacity-40"
const SECONDARY =
  "rounded-full bg-white/[0.12] px-4 py-1.5 font-semibold text-[#F4F2F8] transition hover:bg-white/[0.18] disabled:opacity-40"

const Bar = ({ children }: { children: React.ReactNode }) => (
  <div className="fixed inset-x-0 bottom-5 z-20 flex justify-center px-5">
    <div className="flex items-center gap-2 rounded-full bg-black/40 py-2 pl-5 pr-2 text-sm backdrop-blur-xl">
      {children}
    </div>
  </div>
)

// The bottom bar for working with selected lines: pick them, then either save
// them to the library (with an optional note) or share them as a card.
export function SelectionBar({
  selecting,
  count,
  max,
  onStart,
  onCancel,
  onShare,
  onSave,
}: {
  selecting: boolean
  count: number
  max: number
  onStart: () => void
  onCancel: () => void
  onShare: () => Promise<void>
  onSave: (note: string) => Promise<void>
}) {
  const [step, setStep] = useState<"pick" | "note">("pick")
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // the "Saved" confirmation clears itself
  useEffect(() => {
    if (!saved) return
    const id = setTimeout(() => setSaved(false), 4000)
    return () => clearTimeout(id)
  }, [saved])

  function reset() {
    setStep("pick")
    setNote("")
    setError(null)
  }

  async function run(action: () => Promise<void>, failure: string) {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (err) {
      console.error(err)
      setError(failure)
    } finally {
      setBusy(false)
    }
  }

  const save = () =>
    run(async () => {
      await onSave(note.trim())
      setSaved(true)
      reset()
    }, "Couldn't save. Try again.")

  const share = () => run(onShare, "Couldn't create the card. Try again.")

  if (!selecting) {
    return (
      <div className="lyriq-chrome fixed bottom-5 left-5 z-20 flex items-center gap-2">
        <button
          onClick={() => {
            reset()
            setSaved(false)
            onStart()
          }}
          className={PILL}
        >
          Save or share
        </button>
        {saved && (
          <Link
            href="/library"
            className="rounded-full bg-[#7BE29A]/15 px-4 py-2 text-sm font-semibold text-[#7BE29A] backdrop-blur-xl"
          >
            Saved ✓ · View library
          </Link>
        )}
      </div>
    )
  }

  if (step === "note") {
    return (
      <Bar>
        {error && <span className="text-[#F5A34A]">{error}</span>}
        <input
          autoFocus
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !busy && save()}
          maxLength={500}
          placeholder="Add a note (optional)"
          className="w-56 bg-transparent text-[#F4F2F8] outline-none placeholder:text-[#EDEDF2]/40"
        />
        <button onClick={() => setStep("pick")} className={GHOST}>
          Back
        </button>
        <button onClick={save} disabled={busy} className={PRIMARY}>
          {busy ? "Saving…" : "Save moment"}
        </button>
      </Bar>
    )
  }

  return (
    <Bar>
      {error ? (
        <span className="text-[#F5A34A]">{error}</span>
      ) : (
        // On a phone the three buttons leave little room, so the status shortens
        // rather than wrapping onto two lines.
        <span className="whitespace-nowrap text-[#EDEDF2]/70">
          <span className="sm:hidden">{count ? `${count}/${max}` : "Pick lines"}</span>
          <span className="hidden sm:inline">
            {count ? `${count} of ${max} lines` : `Tap up to ${max} lines`}
          </span>
        </span>
      )}
      <button
        onClick={() => {
          reset()
          onCancel()
        }}
        className={GHOST}
      >
        Cancel
      </button>
      <button onClick={() => setStep("note")} disabled={!count || busy} className={SECONDARY}>
        Save
      </button>
      <button onClick={share} disabled={!count || busy} className={PRIMARY}>
        {busy ? "Creating…" : "Share"}
      </button>
    </Bar>
  )
}
