import type { LyricResult } from "@/types";

// What every lyric source is asked for.
export interface LyricQuery {
    track: string;
    artist: string;
    album?: string;
    durationSec?: string;
}

// Every source implements this. Returning null means "I don't have this song" —
// the waterfall then falls through to the next source. Throwing means the source
// itself failed (network, bad key), which is logged and also falls through.
export interface LyricSource {
    name: string; // for logs only — the result's `source` field is what the UI shows
    fetchLyrics(query: LyricQuery): Promise<LyricResult | null>;
}

export const NO_LYRICS: LyricResult = { source: null, type: "none", lines: [] };
