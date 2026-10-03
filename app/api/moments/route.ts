import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const PAGE_SIZE = 20;
const MAX_LINES = 4;

interface MomentInput {
    trackId: string;
    track: string;
    artist: string;
    album: string;
    albumArtUrl: string;
    startMs: number;
    endMs: number;
    lines: string[];
    note: string | null;
}

const isText = (v: unknown, max: number): v is string =>
    typeof v === "string" && v.length <= max;

const isMs = (v: unknown): v is number =>
    typeof v === "number" && Number.isInteger(v) && v >= 0;

// The body comes from the browser, so nothing in it can be trusted —
// check every field rather than casting and hoping.
function parseMomentInput(body: unknown): MomentInput | null {
    if (typeof body !== "object" || body === null) return null;
    const b = body as Record<string, unknown>;

    if (!isText(b.trackId, 64) || !b.trackId) return null;
    if (!isText(b.track, 300) || !isText(b.artist, 300) || !isText(b.album, 300)) return null;
    if (!isText(b.albumArtUrl, 500)) return null;
    if (!isMs(b.startMs) || !isMs(b.endMs) || b.endMs < b.startMs) return null;

    if (!Array.isArray(b.lines) || b.lines.length < 1 || b.lines.length > MAX_LINES) return null;
    if (!b.lines.every((line) => isText(line, 200) && line.trim())) return null;

    const note = b.note == null || b.note === "" ? null : b.note;
    if (note !== null && !isText(note, 500)) return null;

    return {
        trackId: b.trackId,
        track: b.track,
        artist: b.artist,
        album: b.album,
        albumArtUrl: b.albumArtUrl,
        startMs: b.startMs,
        endMs: b.endMs,
        lines: b.lines as string[],
        note,
    };
}

// GET /api/moments?cursor=<id> — the signed-in user's moments, newest first.
export async function GET(request: Request) {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return new Response("Unauthorized", { status: 401 });

    const cursor = new URL(request.url).searchParams.get("cursor");

    try {
        // Ask for one extra row: if it comes back, there's another page.
        const rows = await db.moment.findMany({
            where: { userId },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: PAGE_SIZE + 1,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            omit: { userId: true },
        });

        const hasMore = rows.length > PAGE_SIZE;
        const moments = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

        return Response.json({
            moments,
            nextCursor: hasMore ? moments[moments.length - 1].id : null,
        });
    } catch (error) {
        console.error("Failed to list moments:", error);
        return Response.json({ error: "Failed to list moments" }, { status: 500 });
    }
}

// POST /api/moments — save a moment for the signed-in user.
export async function POST(request: Request) {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return new Response("Unauthorized", { status: 401 });

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const input = parseMomentInput(body);
    if (!input) return Response.json({ error: "Invalid moment" }, { status: 400 });

    try {
        const moment = await db.moment.create({
            data: { ...input, userId },
            omit: { userId: true },
        });
        return Response.json(moment, { status: 201 });
    } catch (error) {
        console.error("Failed to save moment:", error);
        return Response.json({ error: "Failed to save moment" }, { status: 500 });
    }
}
