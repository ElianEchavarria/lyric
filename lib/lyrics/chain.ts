import type { LyricResult } from "@/types";
import { genius } from "./genius";
import { lrclib, lrclibSearch } from "./lrclib";
import { lyricsOvh } from "./lyricsOvh";
import { NO_LYRICS, type LyricQuery, type LyricSource } from "./types";

// Tried in order, best-quality and cheapest first:
//   lrclib/get    — exact match, synced, free
//   lrclib/search — fuzzy match, synced, free (catches album/duration mismatches)
//   lyrics.ovh    — unsynced only, free, no key
//   genius        — unsynced only, needs a token. Its song pages return 403 to
//                   Vercel's servers, so in production this only ever logs that
const SOURCES: LyricSource[] = [lrclib, lrclibSearch, lyricsOvh, genius];

// A slow source shouldn't hold up the whole chain.
const SOURCE_TIMEOUT_MS = 6000;

// Cache lives in module scope, so it survives across requests on a warm server.
// Negative results are cached too — a song lrclib doesn't have today is one we
// shouldn't re-ask every source about on the next poll.
const cache = new Map<string, LyricResult>();

function cacheKey({ track, artist }: LyricQuery): string {
    return `${artist}::${track}`.toLowerCase().replace(/\s+/g, " ").trim();
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error("source timed out")), ms),
        ),
    ]);
}

export async function getLyrics(query: LyricQuery): Promise<LyricResult> {
    const key = cacheKey(query);

    const cached = cache.get(key);
    if (cached) return cached;

    // If a source errored, we don't really know the answer: LRCLIB's brief 503s
    // would otherwise pin a song to plain text or "no lyrics" until a restart.
    let sourceFailed = false;

    for (const source of SOURCES) {
        try {
            const result = await withTimeout(source.fetchLyrics(query), SOURCE_TIMEOUT_MS);
            // null = this source doesn't have it → try the next one
            if (result) {
                if (!sourceFailed) cache.set(key, result);
                return result;
            }
        } catch (error) {
            // A broken source shouldn't break the chain; log and fall through.
            console.error(`lyrics source "${source.name}" failed:`, error);
            sourceFailed = true;
        }
    }

    if (!sourceFailed) cache.set(key, NO_LYRICS);
    return NO_LYRICS;
}
