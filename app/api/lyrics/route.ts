import { getLyrics } from "@/lib/lyrics/chain";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const track = searchParams.get("track");
    const artist = searchParams.get("artist");
    const album = searchParams.get("album");
    const duration = searchParams.get("duration");

    if (!track || !artist) {
        return Response.json({ error: "Missing track or artist" }, { status: 400 });
    }

    try {
        const result = await getLyrics({
            track,
            artist,
            album: album ?? undefined,
            durationSec: duration ?? undefined,
        });
        return Response.json(result);
    } catch (error) {
        console.error("Failed to fetch lyrics:", error);
        return Response.json({ error: "Failed to fetch lyrics" }, { status: 500 });
    }
}
