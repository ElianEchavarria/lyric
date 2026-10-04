/* eslint-disable @next/next/no-img-element -- ImageResponse renders to a PNG, not the DOM */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// The renderer's built-in font only has a regular weight, so bold text comes
// out thin unless we supply real font files. Read once, lazily, and reused.
// (They live in public/ so the browser can also load them for reel rendering.)
let fonts: Promise<[Buffer, Buffer]> | null = null;
function loadFonts() {
    fonts ??= Promise.all([
        readFile(join(process.cwd(), "public/fonts/Inter-Medium.woff")),
        readFile(join(process.cwd(), "public/fonts/Inter-ExtraBold.woff")),
    ]);
    return fonts;
}

// Instagram story size.
const WIDTH = 1080;
const HEIGHT = 1920;
const PADDING = 96;
const ART_SIZE = 200;

const MAX_LINES = 4;
const MAX_LINE_LENGTH = 200;
const HEX = /^#[0-9a-f]{6}$/i;

// Colours are interpolated into CSS, so only accept plain hex values.
function hexOr(value: string | null, fallback: string): string {
    return value && HEX.test(value) ? value : fallback;
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);

    const lines = searchParams
        .getAll("line")
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, MAX_LINES);

    if (!lines.length) {
        return Response.json({ error: "At least one line is required" }, { status: 400 });
    }
    if (lines.some((line) => line.length > MAX_LINE_LENGTH)) {
        return Response.json({ error: "Line too long" }, { status: 400 });
    }

    const track = (searchParams.get("track") ?? "").slice(0, 120);
    const artist = (searchParams.get("artist") ?? "").slice(0, 120);

    // The renderer fetches this URL server-side. Accepting any URL would let
    // anyone make the server request arbitrary addresses, so only allow
    // Spotify's image CDN.
    const art = searchParams.get("art");
    const artUrl = art?.startsWith("https://i.scdn.co/") ? art : null;

    const dark = hexOr(searchParams.get("dark"), "#0A0A0F");
    const mid = hexOr(searchParams.get("mid"), "#0F0B18");
    const accent = hexOr(searchParams.get("accent"), "#241436");

    const [medium, extraBold] = await loadFonts();

    // The renderer (satori) only understands flexbox: every element with more
    // than one child needs display: flex.
    return new ImageResponse(
        (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    padding: PADDING,
                    backgroundColor: dark,
                    backgroundImage: `linear-gradient(180deg, ${mid} 0%, ${dark} 100%)`,
                    color: "#F4F2F8",
                    fontFamily: "Inter",
                    fontWeight: 800,
                    letterSpacing: "-0.03em",
                    position: "relative",
                }}
            >
                <div
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: WIDTH,
                        height: HEIGHT * 0.6,
                        display: "flex",
                        opacity: 0.45,
                        backgroundImage: `radial-gradient(circle at 50% 0%, ${accent}, transparent 70%)`,
                    }}
                />

                <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
                    {artUrl && (
                        <img
                            src={artUrl}
                            alt=""
                            width={ART_SIZE}
                            height={ART_SIZE}
                            style={{ borderRadius: 28 }}
                        />
                    )}
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                            maxWidth: WIDTH - PADDING * 2 - ART_SIZE - 36,
                        }}
                    >
                        <div style={{ fontSize: 48 }}>{track}</div>
                        <div style={{ fontSize: 36, fontWeight: 500, opacity: 0.7, letterSpacing: 0 }}>
                            {artist}
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
                    {lines.map((line, i) => (
                        <div key={i} style={{ fontSize: 76, lineHeight: 1.15 }}>
                            {line}
                        </div>
                    ))}
                </div>

                <div style={{ display: "flex", fontSize: 32, opacity: 0.5 }}>
                    Lyriq
                </div>
            </div>
        ),
        {
            width: WIDTH,
            height: HEIGHT,
            fonts: [
                { name: "Inter", data: medium, weight: 500, style: "normal" },
                { name: "Inter", data: extraBold, weight: 800, style: "normal" },
            ],
        },
    );
}
