"use client"

import type { SyncedLine } from "@/types"

const LIT = "#F4F2F8"
const DIM = "rgba(244, 242, 248, 0.25)"
const FEATHER = 8 // % of the word's width the lit→dim transition spans

export function KaraokeLine({
  line,
  progress,
}: {
  line: SyncedLine
  progress: number
}) {
  const words = line.words

  if (!words?.length) {
    return <span style={{ color: LIT }}>{line.text || "♪"}</span>
  }

  return (
    <span style={{ whiteSpace: "pre-wrap" }}>
      {words.map((word, i) => {
        const duration = Math.max(word.endTime - word.startTime, 1)
        const ratio = (progress - word.startTime) / duration
        const fill = Math.min(Math.max(ratio, 0), 1) * 100
        const isLast = i === words.length - 1

        return (
          <span
            key={i}
            style={{
              // FEATHER either side of the fill point softens the boundary so it
              // reads as paint soaking in rather than a hard moving line.
              backgroundImage: `linear-gradient(90deg, ${LIT} ${fill - FEATHER}%, ${DIM} ${fill + FEATHER}%)`,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            {isLast ? word.text : `${word.text} `}
          </span>
        )
      })}
    </span>
  )
}
