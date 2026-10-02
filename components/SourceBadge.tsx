import type { LyricResult } from "@/types"

const SOURCE_NAMES: Record<NonNullable<LyricResult["source"]>, string> = {
  lrclib: "LRCLIB",
  genius: "Genius",
}

// Tells the listener where the lyrics came from and whether they're timed —
// so a Genius song without the karaoke sweep reads as expected, not broken.
export function SourceBadge({
  source,
  type,
}: {
  source: LyricResult["source"]
  type: LyricResult["type"]
}) {
  if (!source) return null

  const synced = type === "synced-lines" || type === "synced-words"

  return (
    <div className="fixed right-5 top-5 z-20 flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 text-xs font-semibold text-[#EDEDF2]/70 backdrop-blur-xl">
      <span
        className={`h-2 w-2 rounded-full ${
          synced ? "animate-pulse bg-[#7BE29A]" : "bg-[#EDEDF2]/35"
        }`}
      />
      {SOURCE_NAMES[source]} · {synced ? "synced" : "not synced"}
    </div>
  )
}
