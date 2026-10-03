import { auth } from "@/lib/auth";

const SPOTIFY_URI = /^spotify:(playlist|album|artist|track):[A-Za-z0-9]+$/;

// The album a track belongs to, or null if Spotify can't tell us.
async function albumUriFor(trackId: string, token: string): Promise<string | null> {
    try {
        const res = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return null;
        const track = (await res.json()) as { album?: { uri?: string } };
        return track.album?.uri ?? null;
    } catch {
        return null;
    }
}

// Starts playback on the user's ACTIVE Spotify device (phone/desktop).
// No audio plays in the browser — this is a remote-control command.
//
// Body is one of:
//   { contextUri }               — a playlist/album, from the playlist picker
//   { trackUri, positionMs? }    — one song from a point, for replaying a moment
export async function POST(request: Request) {
    const session = await auth();
    if (!session?.access_token) {
        return new Response("Unauthorized", { status: 401 });
    }

    let body: { contextUri?: unknown; trackUri?: unknown; positionMs?: unknown };
    try {
        body = await request.json();
    } catch {
        return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { contextUri, trackUri, positionMs } = body;
    const position =
        typeof positionMs === "number" && Number.isFinite(positionMs) && positionMs >= 0
            ? Math.round(positionMs)
            : undefined;

    let payload: Record<string, unknown>;
    if (typeof trackUri === "string" && trackUri.startsWith("spotify:track:") && SPOTIFY_URI.test(trackUri)) {
        const positionField = position !== undefined ? { position_ms: position } : {};
        // Play the track inside its album rather than as a bare one-track list.
        // Spotify's Mac app accepted the bare `{ uris: [track] }` form (204) but
        // never loaded the song, while album/playlist context plays fine.
        // Bonus: once the moment's song ends, the album carries on.
        const albumUri = await albumUriFor(trackUri.split(":")[2], session.access_token);
        payload = albumUri
            ? { context_uri: albumUri, offset: { uri: trackUri }, ...positionField }
            : { uris: [trackUri], ...positionField };
    } else if (typeof contextUri === "string" && SPOTIFY_URI.test(contextUri)) {
        payload = { context_uri: contextUri };
    } else {
        return Response.json(
            { error: "Provide a valid contextUri or trackUri" },
            { status: 400 },
        );
    }

    try {
        const res = await fetch("https://api.spotify.com/v1/me/player/play", {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify(payload),
        });

        // 204 = playback started. 404 = no device is currently active.
        if (res.status === 404) {
            return Response.json(
                { error: "No active device. Open Spotify on a device first." },
                { status: 404 },
            );
        }

        if (!res.ok) {
            const body = await res.text();
            console.error("Spotify play failed:", res.status, body);
            return Response.json(
                { error: "Failed to start playback", spotifyStatus: res.status },
                { status: 500 },
            );
        }

        return new Response(null, { status: 204 });
    } catch (error) {
        console.error("Failed to start playback:", error);
        return Response.json({ error: "Failed to start playback" }, { status: 500 });
    }
}
