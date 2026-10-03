// types/index.ts
export interface NowPlaying {
    trackId: string; // Spotify track ID — lets a saved moment replay this exact song
    track: string;
    artist: string;
    album: string;
    albumArtUrl: string;
    durationMs: number;
    progressMs: number;
    isPlaying: boolean;
}

// A saved lyric moment as the API returns it. The owner's userId stays
// server-side, and createdAt is a string because Dates turn into strings in JSON.
export interface Moment {
    id: string;
    trackId: string;
    track: string;
    artist: string;
    album: string;
    albumArtUrl: string;
    startMs: number;
    endMs: number;
    lines: string[];
    note: string | null;
    createdAt: string;
}

export interface Playlist {
    id: string;
    name: string;
    imageUrl: string;
    trackCount: number;
    uri: string; // "spotify:playlist:..." — the context_uri for starting playback
}

export interface Lyrics {
    track_name: string;
    artist_name: string;
    album_name: string;
    duration: number;
}

export interface Word {
    text: string;
    startTime: number; // ms from track start
    endTime: number;   // ms from track start
}

export interface SyncedLine {
    startTime: number; // ms from track start
    text: string;
    words?: Word[]; // real timings from enhanced LRC, or evenly interpolated
    interpolated?: boolean; // true when word timings were approximated, not parsed
}

export interface LyricResult {
    source: "lrclib" | "genius" | null;
    type: "synced-lines" | "synced-words" | "unsynced" | "none";
    lines: SyncedLine[] | string[];
}