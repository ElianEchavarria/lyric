import { useState, useEffect } from "react";
import type { NowPlaying } from "@/types";

// Spotify plays the music on the user's device. Lyriq just asks Spotify
// "what's playing right now?" — often while music plays (the lyric clock needs
// fresh positions), rarely while paused, and not at all in a hidden tab.
const PLAYING_MS = 3000;
// Long enough to cut wasted calls, short enough that pressing play again
// shows up within a few seconds.
const PAUSED_MS = 10000;

export type NowPlayingState =
    | { status: "loading" }
    | { status: "signed-out" }
    | { status: "error" } // only before the first successful poll
    | { status: "ready"; nowPlaying: NowPlaying | null }; // null = nothing playing

export function useNowPlaying(): NowPlayingState {
    const [state, setState] = useState<NowPlayingState>({ status: "loading" });

    useEffect(() => {
        let cancelled = false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        let inFlight = false;

        async function poll() {
            if (inFlight) return; // a poll is already running and will schedule the next
            inFlight = true;
            let next = PLAYING_MS;
            try {
                const res = await fetch("/api/now-playing");
                if (res.status === 401) {
                    if (!cancelled) setState({ status: "signed-out" });
                    next = PAUSED_MS;
                } else if (!res.ok) {
                    console.error("now-playing failed:", res.status);
                    // keep showing the last good data; only error if there's none
                    if (!cancelled) setState((prev) => (prev.status === "ready" ? prev : { status: "error" }));
                } else {
                    const nowPlaying = (await res.json()) as NowPlaying | null;
                    if (!cancelled) setState({ status: "ready", nowPlaying });
                    next = nowPlaying?.isPlaying ? PLAYING_MS : PAUSED_MS;
                }
            } catch (err) {
                console.error("poll error:", err); // network blip — keep the loop alive
            } finally {
                inFlight = false;
            }
            if (!cancelled && document.visibilityState === "visible") {
                timer = setTimeout(poll, next);
            }
        }

        // A hidden tab stops polling entirely; coming back polls at once.
        function onVisibilityChange() {
            clearTimeout(timer);
            if (document.visibilityState === "visible") poll();
        }

        poll();
        document.addEventListener("visibilitychange", onVisibilityChange);
        return () => {
            cancelled = true;
            clearTimeout(timer);
            document.removeEventListener("visibilitychange", onVisibilityChange);
        };
    }, []);

    return state;
}
