import type { Palette } from "@/hooks/useColorPalette"
import type { LyricResult, Moment, SyncedLine, Word } from "@/types"

// Instagram/TikTok story size.
export const REEL_WIDTH = 1080
export const REEL_HEIGHT = 1920
const FPS = 30
export const MIN_REEL_MS = 5000
export const MAX_REEL_MS = 15000
const BITRATE = 6_000_000
// Plain-text lyrics have no timings, so each line gets this long on screen.
const UNTIMED_LINE_MS = 3000

const PADDING = 96
const ART_SIZE = 200
const HEADER_BOTTOM = PADDING + ART_SIZE + 60
const FOOTER_TOP = REEL_HEIGHT - PADDING - 60
const LYRIC_FONT = "800 76px Inter"
const LYRIC_LINE_HEIGHT = 92
const LYRIC_GAP = 40 // between separate lyric lines
const LIT = "#F4F2F8"
const DIM = "rgba(244, 242, 248, 0.28)"
const FEATHER = 0.08 // same soft edge as KaraokeLine, as a fraction of the word

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi)

// ── The plan: which lines, with what timings ────────────────────────────────

export interface ReelLine {
  startMs: number // relative to the start of the reel
  endMs: number
  text: string
  words: Word[]
}

export interface ReelPlan {
  lines: ReelLine[]
  durationMs: number
  timed: boolean // false = timings were invented (plain-text lyrics)
}

function spreadWords(text: string, startMs: number, endMs: number): Word[] {
  const tokens = text.split(/\s+/).filter(Boolean)
  const per = Math.max(endMs - startMs, 0) / (tokens.length || 1)
  return tokens.map((token, i) => ({
    text: token,
    startTime: Math.round(startMs + i * per),
    endTime: Math.round(startMs + (i + 1) * per),
  }))
}

// A moment only stores its text and window, so the timings come from the
// song's lyrics (the same ones the player uses). If those aren't available or
// no longer line up, the saved lines are spread evenly instead.
export function buildReelPlan(moment: Moment, lyrics: LyricResult | null): ReelPlan {
  const synced = lyrics?.type === "synced-lines" ? (lyrics.lines as SyncedLine[]) : []
  const inWindow = synced.filter(
    (line) =>
      line.startTime >= moment.startMs && line.startTime < moment.endMs && line.text.trim(),
  )

  if (inWindow.length && moment.endMs > moment.startMs) {
    // Short moments are held on screen; long ones are cut at the cap.
    const durationMs = clamp(moment.endMs - moment.startMs, MIN_REEL_MS, MAX_REEL_MS)
    const lines = inWindow
      .map((line, i) => {
        const startMs = line.startTime - moment.startMs
        const endMs = (inWindow[i + 1]?.startTime ?? moment.endMs) - moment.startMs
        const words = line.words?.length
          ? line.words.map((w) => ({
              text: w.text,
              startTime: w.startTime - moment.startMs,
              endTime: w.endTime - moment.startMs,
            }))
          : spreadWords(line.text, startMs, endMs)
        return { startMs, endMs, text: line.text, words }
      })
      .filter((line) => line.startMs < durationMs)
    return { lines, durationMs, timed: true }
  }

  const texts = moment.lines.filter((text) => text.trim())
  const durationMs = clamp(texts.length * UNTIMED_LINE_MS, MIN_REEL_MS, MAX_REEL_MS)
  const slot = durationMs / Math.max(texts.length, 1)
  const lines = texts.map((text, i) => ({
    startMs: i * slot,
    endMs: (i + 1) * slot,
    text,
    words: spreadWords(text, i * slot, (i + 1) * slot),
  }))
  return { lines, durationMs, timed: false }
}

export function estimateSizeMb(durationMs: number): number {
  return ((BITRATE / 8) * (durationMs / 1000)) / 1_000_000
}

// ── Assets: fonts and album art ─────────────────────────────────────────────

let fontsReady: Promise<void> | null = null

function loadFonts(): Promise<void> {
  fontsReady ??= (async () => {
    const faces = [
      new FontFace("Inter", "url(/fonts/Inter-Medium.woff)", { weight: "500" }),
      new FontFace("Inter", "url(/fonts/Inter-ExtraBold.woff)", { weight: "800" }),
    ]
    await Promise.all(faces.map((face) => face.load()))
    faces.forEach((face) => document.fonts.add(face))
  })().catch(() => {
    // Falls back to the system font; the reel still renders.
  })
  return fontsReady
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!url) return resolve(null)
    const img = new Image()
    // Without CORS the canvas becomes "tainted", and the browser then refuses
    // to record it. Spotify's image CDN allows cross-origin reads.
    img.crossOrigin = "anonymous"
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

export interface ReelAssets {
  art: HTMLImageElement | null
}

export async function loadReelAssets(albumArtUrl: string): Promise<ReelAssets> {
  const [, art] = await Promise.all([loadFonts(), loadImage(albumArtUrl)])
  return { art }
}

// ── Drawing ─────────────────────────────────────────────────────────────────

function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16)
  if (!/^#[0-9a-f]{6}$/i.test(hex) || Number.isNaN(n)) return `rgba(0,0,0,${alpha})`
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let cut = text
  while (cut && ctx.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1)
  return `${cut.trimEnd()}…`
}

// Everything that doesn't move — background, blurred art, header, footer —
// drawn once. Blurring a full-frame image is expensive; doing it 30 times a
// second while recording would drop frames.
export function renderStaticLayer(
  assets: ReelAssets,
  palette: Palette,
  meta: { track: string; artist: string },
): HTMLCanvasElement {
  const layer = document.createElement("canvas")
  layer.width = REEL_WIDTH
  layer.height = REEL_HEIGHT
  const ctx = layer.getContext("2d")!

  const bg = ctx.createLinearGradient(0, 0, 0, REEL_HEIGHT)
  bg.addColorStop(0, palette.mid)
  bg.addColorStop(1, palette.dark)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, REEL_WIDTH, REEL_HEIGHT)

  if (assets.art) {
    ctx.save()
    ctx.globalAlpha = 0.35
    ctx.filter = "blur(60px)"
    const size = REEL_HEIGHT * 1.1
    ctx.drawImage(assets.art, (REEL_WIDTH - size) / 2, (REEL_HEIGHT - size) / 2, size, size)
    ctx.restore()
  }

  const glow = ctx.createRadialGradient(REEL_WIDTH / 2, 0, 0, REEL_WIDTH / 2, 0, REEL_HEIGHT * 0.6)
  glow.addColorStop(0, withAlpha(palette.accent, 0.45))
  glow.addColorStop(1, withAlpha(palette.accent, 0))
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, REEL_WIDTH, REEL_HEIGHT)

  // Header: album art + track + artist
  let textX = PADDING
  if (assets.art) {
    ctx.save()
    ctx.beginPath()
    ctx.roundRect(PADDING, PADDING, ART_SIZE, ART_SIZE, 28)
    ctx.clip()
    ctx.drawImage(assets.art, PADDING, PADDING, ART_SIZE, ART_SIZE)
    ctx.restore()
    textX = PADDING + ART_SIZE + 36
  }
  const textWidth = REEL_WIDTH - PADDING - textX
  ctx.fillStyle = LIT
  ctx.font = "800 48px Inter"
  ctx.fillText(fitText(ctx, meta.track, textWidth), textX, PADDING + 88)
  ctx.globalAlpha = 0.7
  ctx.font = "500 36px Inter"
  ctx.fillText(fitText(ctx, meta.artist, textWidth), textX, PADDING + 140)

  ctx.globalAlpha = 0.5
  ctx.font = "800 32px Inter"
  ctx.fillText("Lyriq", PADDING, REEL_HEIGHT - PADDING)
  ctx.globalAlpha = 1

  return layer
}

interface PlacedWord {
  text: string
  x: number
  y: number // baseline
  width: number
  startMs: number
  endMs: number
}

export interface ReelLayout {
  lines: { startMs: number; words: PlacedWord[] }[]
}

// Where every word goes. Wraps each lyric line to the canvas width and centres
// the whole block between the header and the footer.
export function layoutReel(ctx: CanvasRenderingContext2D, plan: ReelPlan): ReelLayout {
  ctx.font = LYRIC_FONT
  const maxWidth = REEL_WIDTH - PADDING * 2
  const space = ctx.measureText(" ").width

  const blocks = plan.lines.map((line) => {
    const rows: { word: Word; x: number; width: number }[][] = [[]]
    let x = 0
    for (const word of line.words) {
      const width = ctx.measureText(word.text).width
      if (x > 0 && x + width > maxWidth) {
        rows.push([])
        x = 0
      }
      rows[rows.length - 1].push({ word, x, width })
      x += width + space
    }
    return { line, rows }
  })

  const rowCount = blocks.reduce((n, block) => n + block.rows.length, 0)
  const blockHeight = rowCount * LYRIC_LINE_HEIGHT + Math.max(blocks.length - 1, 0) * LYRIC_GAP
  let y = Math.max(HEADER_BOTTOM, HEADER_BOTTOM + (FOOTER_TOP - HEADER_BOTTOM - blockHeight) / 2)

  return {
    lines: blocks.map(({ line, rows }) => {
      const words: PlacedWord[] = []
      for (const row of rows) {
        y += LYRIC_LINE_HEIGHT
        for (const r of row) {
          words.push({
            text: r.word.text,
            x: PADDING + r.x,
            y,
            width: r.width,
            startMs: r.word.startTime,
            endMs: r.word.endTime,
          })
        }
      }
      y += LYRIC_GAP
      return { startMs: line.startMs, words }
    }),
  }
}

// The canvas version of KaraokeLine's gradient sweep.
function sweepFill(ctx: CanvasRenderingContext2D, word: PlacedWord, fill: number) {
  if (fill <= 0) return DIM
  if (fill >= 1) return LIT
  const gradient = ctx.createLinearGradient(word.x, 0, word.x + word.width, 0)
  gradient.addColorStop(0, LIT)
  gradient.addColorStop(Math.max(fill - FEATHER, 0), LIT)
  gradient.addColorStop(Math.min(fill + FEATHER, 1), DIM)
  gradient.addColorStop(1, DIM)
  return gradient
}

export function drawReelFrame(
  ctx: CanvasRenderingContext2D,
  staticLayer: HTMLCanvasElement,
  layout: ReelLayout,
  timeMs: number,
) {
  ctx.drawImage(staticLayer, 0, 0)
  ctx.font = LYRIC_FONT

  let active = -1
  layout.lines.forEach((line, i) => {
    if (line.startMs <= timeMs) active = i
  })

  layout.lines.forEach((line, i) => {
    ctx.globalAlpha = i === active ? 1 : 0.45
    for (const word of line.words) {
      const fill = (timeMs - word.startMs) / Math.max(word.endMs - word.startMs, 1)
      ctx.fillStyle = sweepFill(ctx, word, fill)
      ctx.fillText(word.text, word.x, word.y)
    }
  })
  ctx.globalAlpha = 1
}

// ── Recording ───────────────────────────────────────────────────────────────

export interface RecordingFormat {
  mimeType: string
  extension: "mp4" | "webm"
}

let cachedFormat: RecordingFormat | null | undefined

// MP4 where the browser can record it natively (Chrome, Safari, Edge);
// Firefox only records WebM. Cached so repeat calls return the same object —
// useSyncExternalStore treats a new object as "the value changed".
export function pickRecordingFormat(): RecordingFormat | null {
  if (cachedFormat !== undefined) return cachedFormat
  if (typeof MediaRecorder === "undefined") return null
  const options: RecordingFormat[] = [
    { mimeType: "video/mp4;codecs=avc1.42E01E", extension: "mp4" },
    { mimeType: "video/mp4", extension: "mp4" },
    { mimeType: "video/webm;codecs=vp9", extension: "webm" },
    { mimeType: "video/webm", extension: "webm" },
  ]
  cachedFormat =
    options.find((option) => MediaRecorder.isTypeSupported(option.mimeType)) ?? null
  return cachedFormat
}

// MediaRecorder captures in real time, so a 10s reel takes 10s to record.
// `draw` is called every frame with the reel time to paint.
export function recordReel(
  canvas: HTMLCanvasElement,
  durationMs: number,
  draw: (timeMs: number) => void,
  onProgress: (fraction: number) => void,
  format: RecordingFormat,
  signal: AbortSignal,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const stream = canvas.captureStream(FPS)
    const recorder = new MediaRecorder(stream, {
      mimeType: format.mimeType,
      videoBitsPerSecond: BITRATE,
    })
    const chunks: Blob[] = []
    let frame = 0

    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data)
    }
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop())
      if (signal.aborted) return reject(new DOMException("Recording cancelled", "AbortError"))
      resolve(new Blob(chunks, { type: format.mimeType.split(";")[0] }))
    }
    recorder.onerror = () => reject(new Error("Recording failed"))

    signal.addEventListener("abort", () => {
      cancelAnimationFrame(frame)
      if (recorder.state !== "inactive") recorder.stop()
    })

    draw(0)
    recorder.start()
    const startedAt = performance.now()
    const tick = () => {
      const elapsed = performance.now() - startedAt
      draw(Math.min(elapsed, durationMs))
      onProgress(Math.min(elapsed / durationMs, 1))
      if (elapsed < durationMs) frame = requestAnimationFrame(tick)
      else recorder.stop()
    }
    frame = requestAnimationFrame(tick)
  })
}
