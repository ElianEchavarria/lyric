import * as cheerio from "cheerio";
import type { LyricQuery, LyricSource } from "./types";

// Only the fields we use from Genius's GET /search response.
interface GeniusSearchResponse {
    response: {
        hits: {
            type: string;
            result: {
                url: string;
                title: string;
                primary_artist: { name: string };
            };
        }[];
    };
}

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// Spotify titles carry suffixes Genius doesn't use in its search index:
// "Song - Remastered 2011", "Song (feat. X)".
function cleanTitle(track: string): string {
    return track
        .split(" - ")[0]
        .replace(/\((feat|with|ft)\.?[^)]*\)/gi, "")
        .trim();
}

// Genius renders lyrics into one or more [data-lyrics-container] blocks, with
// <br> for line breaks and inline links/italics mixed in.
function extractLyrics(html: string): string[] {
    const $ = cheerio.load(html);
    const containers = $('[data-lyrics-container="true"]');

    // Headers like "12 Contributors · Song Lyrics" live inside the container.
    containers.find('[data-exclude-from-selection="true"]').remove();
    containers.find("br").replaceWith("\n");

    return containers
        .map((_, el) => $(el).text())
        .get()
        .join("\n")
        .split("\n")
        .map((line) => line.trim())
        // drop blanks and section headers like [Chorus], [Verse 2: Artist]
        .filter((line) => line && !/^\[.*\]$/.test(line));
}

export const genius: LyricSource = {
    name: "genius",

    async fetchLyrics({ track, artist }: LyricQuery) {
        const token = process.env.GENIUS_ACCESS_TOKEN;
        // Not configured → skip quietly instead of failing every request.
        if (!token) return null;

        // Spotify joins collaborators ("JBEE, Cash Cobain"); match on the lead.
        const leadArtist = artist.split(",")[0].trim();

        const q = new URLSearchParams({ q: `${leadArtist} ${cleanTitle(track)}` });
        const res = await fetch(`https://api.genius.com/search?${q}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`genius search responded ${res.status}`);

        const data = (await res.json()) as GeniusSearchResponse;

        // Showing the wrong song's lyrics is worse than showing none, so only
        // accept a hit whose artist actually matches.
        const want = normalize(leadArtist);
        const hit = data.response.hits.find((h) => {
            if (h.type !== "song") return false;
            const got = normalize(h.result.primary_artist.name);
            return got.includes(want) || want.includes(got);
        });
        if (!hit) return null;

        const page = await fetch(hit.result.url, {
            headers: { "User-Agent": "Lyriq (https://github.com/elian/lyriq)" },
        });
        if (!page.ok) throw new Error(`genius page responded ${page.status}`);

        const lines = extractLyrics(await page.text());
        if (!lines.length) return null;

        // Genius has no timing data, so these always render as plain text.
        return { source: "genius", type: "unsynced", lines };
    },
};
