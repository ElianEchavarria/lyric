import { cleanTitle } from "./genius";
import type { LyricQuery, LyricSource } from "./types";

// A plain JSON lyrics API: no key, no timing data. Unlike Genius's song pages,
// it isn't blocked from server hosts, so it's the unsynced fallback in production.
export const lyricsOvh: LyricSource = {
    name: "lyrics.ovh",

    async fetchLyrics({ track, artist }: LyricQuery) {
        const leadArtist = artist.split(",")[0].trim();
        const path = [leadArtist, cleanTitle(track)].map(encodeURIComponent).join("/");

        const res = await fetch(`https://api.lyrics.ovh/v1/${path}`);
        // 404 is its normal "don't have this song" answer, not a failure.
        if (res.status === 404) return null;
        if (!res.ok) throw new Error(`lyrics.ovh responded ${res.status}`);

        const data = (await res.json()) as { lyrics?: string };
        const lines = (data.lyrics ?? "")
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean);
        if (!lines.length) return null;

        return { source: "lyrics.ovh", type: "unsynced", lines };
    },
};
