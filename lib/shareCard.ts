import type { Palette } from "@/hooks/useColorPalette"
import { fileSlug, shareOrDownload } from "@/lib/shareFile"

export interface CardInput {
  lines: string[]
  track: string
  artist: string
  albumArtUrl: string
  palette: Palette
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

  await shareOrDownload(await res.blob(), `${fileSlug(artist, track)}-lyrics.png`)
}
