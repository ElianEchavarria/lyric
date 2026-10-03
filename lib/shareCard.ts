import type { Palette } from "@/hooks/useColorPalette"

export interface CardInput {
  lines: string[]
  track: string
  artist: string
  albumArtUrl: string
  palette: Palette
}

function fileName(artist: string, track: string): string {
  const slug = `${artist} ${track}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
  return `${slug || "lyriq"}-lyrics.png`
}

// Renders the card on the server, then shares or downloads it. Throws on
// failure so the caller can show an error.
export async function shareLyricCard({
  lines,
  track,
  artist,
  albumArtUrl,
  palette,
}: CardInput): Promise<void> {
  const params = new URLSearchParams({
    track,
    artist,
    art: albumArtUrl,
    dark: palette.dark,
    mid: palette.mid,
    accent: palette.accent,
  })
  for (const line of lines) params.append("line", line)

  const res = await fetch(`/api/card?${params}`)
  if (!res.ok) throw new Error(`card responded ${res.status}`)

  const blob = await res.blob()
  const name = fileName(artist, track)
  const file = new File([blob], name, { type: "image/png" })

  // On phones, the native share sheet is how the image gets to Instagram,
  // Messages, etc. Desktops get a plain download instead.
  const isTouch = window.matchMedia("(pointer: coarse)").matches
  if (isTouch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
    } catch (err) {
      // closing the share sheet without picking anything isn't a failure
      if ((err as Error).name !== "AbortError") throw err
    }
    return
  }

  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = name
  link.click()
  // revoking immediately can cancel the download in some browsers
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
