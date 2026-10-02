import type { LyricResult } from "@/types";
import { parseLrc } from "./parse";
import type { LyricQuery, LyricSource } from "./types";

const HEADERS = { "User-Agent": "Lyriq (https://github.com/elian/lyriq)" };

// A search hit may be a different recording (live, remix, radio edit). Synced
// timings from the wrong version drift, so only accept a close duration.
const DURATION_TOLERANCE_SEC = 3;

// Only the fields we care about from lrclib responses.
// syncedLyrics/plainLyrics are null for instrumental tracks.
interface LrclibEntry {
    duration: number;
    syncedLyrics: string | null;
    plainLyrics: string | null;
}

function toResult(entry: LrclibEntry): LyricResult | null {
    if (entry.syncedLyrics) {
        return { source: "lrclib", type: "synced-lines", lines: parseLrc(entry.syncedLyrics) };
    }
    if (entry.plainLyrics) {
        return { source: "lrclib", type: "unsynced", lines: entry.plainLyrics.split("\n") };
    }
    // Instrumental, or an entry with no text at all.
    return null;
}

// Exact match on track + artist + album + duration.
export const lrclib: LyricSource = {
    name: "lrclib/get",

    async fetchLyrics({ track, artist, album, durationSec }: LyricQuery) {
        // URLSearchParams URL-encodes every value (handles spaces, &, etc.);
        // only add album/duration when present so we never send "null".
        const params = new URLSearchParams({ artist_name: artist, track_name: track });
        if (album) params.set("album_name", album);
        if (durationSec) params.set("duration", durationSec);

        const res = await fetch(`https://lrclib.net/api/get?${params}`, { headers: HEADERS });

        // 404 = no exact match → fall through to the next source.
        if (res.status === 404) return null;
        if (!res.ok) throw new Error(`lrclib get responded ${res.status}`);

        return toResult((await res.json()) as LrclibEntry);
    },
};

// Fuzzy match on track + artist only. Catches songs /api/get misses because
// Spotify and lrclib disagree on album name ("Remastered", "Deluxe") or duration.
export const lrclibSearch: LyricSource = {
    name: "lrclib/search",

    async fetchLyrics({ track, artist, durationSec }: LyricQuery) {
        const params = new URLSearchParams({ track_name: track, artist_name: artist });
        const res = await fetch(`https://lrclib.net/api/search?${params}`, { headers: HEADERS });
        if (!res.ok) throw new Error(`lrclib search responded ${res.status}`);

        const target = durationSec ? Number(durationSec) : null;
        const candidates = ((await res.json()) as LrclibEntry[]).filter(
            (hit) =>
                (hit.syncedLyrics || hit.plainLyrics) &&
                (target === null || Math.abs(hit.duration - target) <= DURATION_TOLERANCE_SEC),
        );

        // Prefer a synced hit; fall back to any plain one.
        const best = candidates.find((hit) => hit.syncedLyrics) ?? candidates[0];
        return best ? toResult(best) : null;
    },
};
