// lib/lyrics/parse.ts
import type { SyncedLine, Word } from "@/types";

// To handle enhanced LRC formats containing word-level timestamps (e.g., [mm:ss.xx] <mm:ss.xx> word <mm:ss.xx> word), we need to parse both the line-level timestamp and the intra-line word tags.

/**
 * Converts an LRC timestamp string (mm:ss.xx or mm:ss.xxx) to MILLISECONDS,
 * to match Spotify's progressMs — the value these timings get compared against.
 */
// Used to close the final word of the very last line, which has no following
// line to borrow an end time from.
const FINAL_WORD_FALLBACK_MS = 2000;

function parseTimestamp(timeStr: string): number {
    const [min, sec] = timeStr.split(':'); // ["01", "23.45"]
    const seconds = parseInt(min, 10) * 60 + parseFloat(sec); // 1 * 60 + 23.45 = 83.45
    return Math.round(seconds * 1000); // 83450
}



export function parseLrc(synced: string): SyncedLine[] {
    const lines = synced.split(/\r?\n/);
    const result: SyncedLine[] = [];


    // Matches line timers like [00:12.34]
    const lineTimeRegex = /^\[(\d{2}:\d{2}(?:\.\d{2,3})?)\](.*)/;
    // Matches word tags like <00:12.50>
    const wordTagRegex = /<(\d{2}:\d{2}(?:\.\d{2,3})?)>/g;




    for (const raw of lines) {
        const trimmed = raw.trim()
        if (!trimmed) continue
        // 1. match a timestamped line. 
        const match = trimmed.match(lineTimeRegex);

        // 2. no match → metadata ([ar:...], [ti:...]) or a blank line → skip
        if (!match) continue;

        const lineStartTime = parseTimestamp(match[1])
        const lineContent = match[2].trim();

        // If the line doesn't contain word tags, parse as standard LRC
        if (!lineContent.includes('<')) {
            result.push({
                startTime: lineStartTime,
                text: lineContent,
            });
            continue;
        }

        const words: Word[] = []

        // Find all word timestamp tags and their positions
        const tags: { time: number; index: number; rawLength: number }[] = [];
        let tagMatch;

        while ((tagMatch = wordTagRegex.exec(lineContent)) !== null) {
            tags.push({
                time: parseTimestamp(tagMatch[1]),
                index: tagMatch.index,
                rawLength: tagMatch[0].length,
            });
        }

        // Process every tag. The final tag has no next tag, so its text runs to
        // the end of the line and its endTime is patched in after the loop.
        for (let i = 0; i < tags.length; i++) {
            const currentTag = tags[i];
            const nextTag = tags[i + 1]; // undefined on the last tag

            const wordStartIdx = currentTag.index + currentTag.rawLength;
            const wordEndIdx = nextTag ? nextTag.index : lineContent.length;
            const wordText = lineContent.substring(wordStartIdx, wordEndIdx).trim();

            if (wordText) {
                words.push({
                    text: wordText,
                    startTime: currentTag.time,
                    // equal to startTime marks "needs patching" below
                    endTime: nextTag ? nextTag.time : currentTag.time,
                });
            }
        }

        // Clean up the text for the line object by removing all <...> tags
        const cleanText = lineContent.replace(wordTagRegex, ' ').replace(/\s+/g, ' ').trim();

        result.push({
            startTime: lineStartTime,
            text: cleanText,
            words
        });
    }

    // Second pass: both branches need to look ahead to the next line's start
    // time, which only exists once every line has been parsed.
    for (let i = 0; i < result.length; i++) {
        const line = result[i];
        const lineEnd =
            result[i + 1]?.startTime ?? line.startTime + FINAL_WORD_FALLBACK_MS;

        // Enhanced LRC: close the final word, which had no following tag.
        if (line.words?.length) {
            const lastWord = line.words[line.words.length - 1];
            if (lastWord.endTime <= lastWord.startTime) {
                lastWord.endTime = lineEnd;
            }
            continue;
        }

        // Plain LRC: no word tags, so approximate them by spreading the line's
        // text evenly across its duration.
        const tokens = line.text.split(/\s+/).filter(Boolean);
        if (!tokens.length) continue; // instrumental markers / empty lines

        const duration = Math.max(lineEnd - line.startTime, 0);
        const perWord = duration / tokens.length;

        line.words = tokens.map((text, n) => ({
            text,
            startTime: Math.round(line.startTime + n * perWord),
            endTime: Math.round(line.startTime + (n + 1) * perWord),
        }));
        line.interpolated = true;
    }

    return result
}
