import { useState, useEffect } from "react"

// Colors pulled out of the album art, used to tint the player background.
export interface Palette {
  dark: string
  mid: string
  accent: string
}

// The neutral Lyriq base, used before art loads and if extraction fails.
const FALLBACK: Palette = {
  dark: "#0A0A0F",
  mid: "#0F0B18",
  accent: "#241436",
}

export function useColorPalette(albumArtUrl: string | undefined) {
  const [palette, setPalette] = useState<Palette>(FALLBACK)

  useEffect(() => {
    // Nothing to extract; the return below falls back without touching state.
    if (!albumArtUrl) return

    // guards against a slow extraction landing after the track already changed
    let cancelled = false

    async function extract() {
      try {
        // v4 ships separate entry points; the root one throws on purpose.
        // Imported lazily so the library never ends up in the server bundle.
        const { Vibrant } = await import("node-vibrant/browser")
        const swatches = await Vibrant.from(albumArtUrl!).getPalette()

        if (cancelled) return

        // Fallback chains: some art has no Vibrant swatch, some no Muted.
        // accent is the brightest (used to tint the whole page + the top bloom).
        setPalette({
          dark: swatches.DarkMuted?.hex ?? swatches.DarkVibrant?.hex ?? FALLBACK.dark,
          mid: swatches.DarkVibrant?.hex ?? swatches.Muted?.hex ?? FALLBACK.mid,
          accent:
            swatches.Vibrant?.hex ??
            swatches.LightVibrant?.hex ??
            swatches.Muted?.hex ??
            FALLBACK.accent,
        })
      } catch (err) {
        console.error("palette error:", err)
        if (!cancelled) setPalette(FALLBACK)
      }
    }

    extract()

    return () => {
      cancelled = true
    }
  }, [albumArtUrl])

  // While a new track's colours are being extracted, the previous palette stays
  // up — the page then cross-fades old → new instead of flashing to grey first.
  return albumArtUrl ? palette : FALLBACK
}
