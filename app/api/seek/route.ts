import { auth } from "@/lib/auth";

// Jumps playback on the user's active Spotify device to a position.
export async function POST(request: Request) {
    const session = await auth();
    if (!session?.access_token) {
        return new Response("Unauthorized", { status: 401 });
    }

    let positionMs: unknown;
    try {
        ({ positionMs } = (await request.json()) as { positionMs?: unknown });
    } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (typeof positionMs !== "number" || !Number.isFinite(positionMs) || positionMs < 0) {
        return Response.json(
            { error: "positionMs must be a non-negative number" },
            { status: 400 },
        );
    }

    const params = new URLSearchParams({ position_ms: String(Math.round(positionMs)) });

    try {
        const res = await fetch(`https://api.spotify.com/v1/me/player/seek?${params}`, {
            method: "PUT",
            headers: { Authorization: `Bearer ${session.access_token}` },
        });

        // 404 = no device is currently active
        if (res.status === 404) {
            return Response.json({ error: "No active device" }, { status: 404 });
        }

        if (!res.ok) {
            const body = await res.text();
            console.error("Spotify seek failed:", res.status, body);
            return Response.json(
                { error: "Failed to seek", spotifyStatus: res.status },
                { status: 500 },
            );
        }

        return new Response(null, { status: 204 });
    } catch (error) {
        console.error("Failed to seek:", error);
        return Response.json({ error: "Failed to seek" }, { status: 500 });
    }
}
