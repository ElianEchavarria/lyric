# Lyriq

Live, word-by-word lyrics for whatever's playing on Spotify, built for me: someone who wants to follow along with every song and keep the lines that hit.

**Author:** Elian Echavarria · **Course:** CMP 464/343 Product 1 · **Last updated:** November 2, 2026

**Live:** https://lyric-plum.vercel.app · jump to [Demo](#demo)

---

## 1. About Me (the User)

I'm a daily Spotify listener and a CS student who is learning TypeScript. **FILL IN: when and where you listen (commute, studying, gym, in the car), and any other role that matters here.**

**The last 3 times this happened:**

1. **FILL IN: when and where** / what went wrong / what it cost / what you did
2. **FILL IN: when and where** / what went wrong / what it cost / what you did
3. **FILL IN: when and where** / what went wrong / what it cost / what you did

**What it costs me:**

- ⏱️ **Time:** **FILL IN: minutes per day spent searching for lyrics or switching between screens**
- 💸 **Money:** **FILL IN: for example, $0, or what an Apple Music subscription would cost just for its lyrics**
- 🔋 **Energy:** **FILL IN: for example, leaving the song to go look up a line**
- 🙂 **Joy:** **FILL IN: what you lose when you can't follow a song you love**

---

## 2. Problem Statement

**Gut check:** I need lyrics that move with the song, for every song I play, because **FILL IN: your reason in your own words.**

**Five Whys:**

1. **Why** can't I follow along with a song? The lyrics in front of me are plain, or there are none. **CONFIRM**
2. **Why** does that matter? I lose my place and can't tell which word is being sung. **CONFIRM**
3. **Why** can't I just use what Spotify shows? It highlights whole lines, not words, and many songs don't have synced lyrics. **CONFIRM**
4. **Why** don't other sources fill the gap? They're separate pages with static text that doesn't know where I am in the song. **CONFIRM**
5. **Why** does nothing bring this together? The best display is locked to another subscription, and the widest lyric catalogs have no timing, so nothing joins my Spotify playback with timed lyrics from several sources. **CONFIRM**

**Problem statement:**

When I'm listening to a song on Spotify and want to follow the words, I struggle to see the right line at the right moment, and some songs show no synced lyrics at all, which costs me **FILL IN: minutes per day and/or the joy of the song**. This happens because the lyrics I can see are either timed only by line or stored somewhere that has no idea what I'm playing. Right now I **CONFIRM: look the song up on Genius or Google in another tab**, but that text doesn't move with the music, and I lose my place and pull myself out of the song.

**I'll know this is solved when:** I can press play on any device and see the words light up in time with the singing, without searching, and when timed lyrics don't exist I still get the plain words without doing anything.

---

## 3. Existing Solutions

| What I use or tried | What it does well | Why it falls short for me |
| --- | --- | --- |
| Spotify's built-in lyrics | Already where I listen, and timed by line | No word-level highlighting, and not every song has synced lyrics |
| Apple Music lyrics | Beautiful word-by-word display, the look I wanted | Only works inside Apple Music, and my music is on Spotify |
| Genius | Huge catalog, plus annotations | Static text in a separate page, with no timing or link to what I'm playing |
| Musixmatch | Large catalog of synced lyrics | Its own product to install or pay for, and it couldn't be built on without a paid plan |

**The gap:** nothing gives me Apple Music-style word-by-word lyrics for my Spotify listening, falls back automatically when a song has no timing, and lets me keep the lines I love.

---

## 4. Features & Benefits

| Feature (what it does) | Benefit (how my life gets better) | MVP or Later? |
| --- | --- | --- |
| Mirrors what's playing on Spotify, on any device | Nothing to search for; lyrics appear when I press play | **MVP** |
| Synced lyrics with a word-by-word karaoke sweep | I always know exactly which word is being sung | **MVP** |
| Lyric fallback: LRCLIB exact match → LRCLIB search → Genius | I still get words when a song has no timed lyrics | **MVP** |
| Album-art colors and cinema mode | It feels like the album, with nothing on screen but the words | Built beyond MVP |
| Tap a line to jump there | I can replay a line I missed | Built beyond MVP |
| Playlist shortcut | I can start music from the same screen | Built beyond MVP |
| Save moments, with a note and one-tap replay | I can get back to the exact second that hit me | Built beyond MVP |
| Share cards and short video reels | I can post a line without a screenshot | Built beyond MVP |

**MVP:** live mirroring, word-by-word synced lyrics, and automatic lyric fallback. That's the smallest version I'd actually use.

**Later:**

- On-screen timing control for phones (today the `[` and `]` adjustment needs a keyboard)
- Installable phone version that keeps the screen awake
- Karaoke scoring from the microphone
- Live listening rooms that friends can join
- Last.fm support, for listeners who aren't on Spotify

**Not doing:**

- **Apple Music support:** requires a paid developer membership
- **AI features:** the problem is timing and display, and AI doesn't help with either
- **Playing audio inside Lyriq:** it mirrors the Spotify I already use
- **Audio in reels:** Spotify's audio can't be captured, so reels are visual only
- **Musixmatch as a source:** it has no free plan
- **ffmpeg.wasm:** the browser can record MP4 by itself, so I avoided a heavy download
- **A public launch:** Spotify limits apps like this to a short list of approved accounts

---

## 5. Tech Stack

### Front end

- **Surface:** Web
- **Tools:** Next.js 16 (App Router), React 19, TypeScript in strict mode, Tailwind CSS 4
- **Why:** I listen on different devices, and a web page works on my phone and laptop with nothing to install. TypeScript is also what I'm here to learn.

### Back end

| Piece | Choice | Why |
| --- | --- | --- |
| Server / API | Next.js route handlers | The Spotify client secret must stay on a server, and Genius pages can't be fetched from a browser. This keeps one repo and one deploy instead of two apps. |
| Sign-in | Auth.js v5 with JWT sessions | It has a Spotify provider, and it's where hourly token refresh happens |
| Data storage | PostgreSQL (Neon) with Prisma | Saved moments have to survive across devices, and Prisma gives me typed queries |
| Outside services | Spotify Web API, LRCLIB, Genius | Spotify says what's playing; LRCLIB has free timed lyrics; Genius has the widest catalog as a backup |
| Hosting / deploy | Vercel | Built for Next.js, and it deploys on every push to `main` |

### Architecture sketch

```mermaid
flowchart LR
    Device["Spotify on any device"] --> Spotify["Spotify Web API"]

    subgraph Browser["Browser"]
        Hooks["useNowPlaying (polls every 3s)<br/>usePlaybackClock (fills the gaps)"]
        UI["Lyrics, library, cards, reels"]
        Hooks --> UI
    end

    subgraph Server["Next.js on Vercel"]
        NP["/api/now-playing<br/>/api/play<br/>/api/seek<br/>/api/playlists"]
        LY["/api/lyrics"]
        MO["/api/moments"]
        CA["/api/card"]
    end

    Hooks --> NP
    Hooks --> LY
    UI --> MO
    UI --> CA

    NP --> Spotify
    LY --> L1["LRCLIB exact match"]
    L1 -. "not found" .-> L2["LRCLIB search"]
    L2 -. "not found" .-> L3["Genius"]
    MO --> DB[("Neon PostgreSQL")]
```

**One action, start to finish: tapping Save on a moment**

1. I select up to 4 lines and tap **Save**. `SelectionBar` sends the lines, their timing and my note to `POST /api/moments`.
2. The route calls `auth()` to find out who I am, and validates the input.
3. Prisma stores the row in Neon, tied to my Spotify user ID.
4. The library loads it back through `GET /api/moments`, 20 at a time, only ever for my user ID. Closing the page loses nothing.

**Where the data lives**

| Data | Where | What happens when I close the page |
| --- | --- | --- |
| Saved moments | PostgreSQL | Kept |
| Sign-in and Spotify tokens | Encrypted session cookie | Kept until it expires |
| Timing adjustment | `localStorage`, per browser | Kept |
| Fetched lyrics | Server memory | Re-fetched when the server restarts |

---

## 6. Open Questions

- **Timing on phones:** the 650ms default was tuned on my own setup. Is it right for other devices and for Bluetooth headphones, given that phones can't adjust it yet?
- **Genius scraping:** it depends on their page markup, so it can break without warning. The parser is isolated so that it's easy to fix.
- **Lyric cache:** it lives in server memory, so it empties on every serverless restart. Would a database cache be worth it?
- **Word timing:** most sources only time whole lines, so word timing is usually an even estimate. How far off can it get before it feels wrong?
- **Sharing:** Spotify's approved-accounts limit means I add each friend by hand. How far can this go without an organization account?

---

## Demo

**Live link:** https://lyric-plum.vercel.app

> Spotify only allows approved accounts to sign in to this project. If you'd like to try it, send me your Spotify email and I'll add you. Otherwise you'll see a "Server error" page after signing in.

<!-- Add your screenshots and video here, then delete this comment:
![Player](docs/player.png)
![Library](docs/library.png)
[Demo video](YOUR-UNLISTED-LINK)
-->

## Run it locally

```bash
npm install
npx prisma migrate dev
npm run dev
```

Open http://127.0.0.1:3000 (not `localhost`, which Spotify rejects). Create `.env.local` with `AUTH_SECRET`, `AUTH_URL`, `AUTH_REDIRECT_PROXY_URL`, `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `GENIUS_ACCESS_TOKEN` and `DATABASE_URL`. Secrets are never committed.
