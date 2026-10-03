import NextAuth from "next-auth"
import Spotify from "next-auth/providers/spotify"

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Spotify({
      clientId: process.env.SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
      authorization: {
        // must include the url: the provider's default `authorization` is a plain
        // string, and Auth.js can't merge a string default with a params-only object
        url: "https://accounts.spotify.com/authorize",
        params: {
          scope: 'user-read-currently-playing user-read-playback-state user-modify-playback-state playlist-read-private playlist-read-collaborative'
        }
      }
    })
  ],
  callbacks: {
    async redirect({ url, baseUrl }) {
      // dev: Next 16 coerces our origin to localhost, but the session cookie
      // lives on 127.0.0.1 — keep redirects on the real origin
      const proxy = process.env.AUTH_REDIRECT_PROXY_URL
      if (proxy && url.startsWith(new URL(proxy).origin)) return url
      if (url.startsWith("/")) return `${baseUrl}${url}`
      if (new URL(url).origin === baseUrl) return url
      return baseUrl
    },
    async jwt({ token, account }) {
      if (account) {
        // First-time login, save the `access_token`, its expiry and the `refresh_token`
        if (!account.access_token || !account.expires_at) {
          throw new TypeError("Missing access_token or expires_at")
        }
        return {
          ...token,
          access_token: account.access_token,
          expires_at: account.expires_at,
          refresh_token: account.refresh_token,
        }
      } else if (Date.now() < token.expires_at * 1000) {
        // Subsequent logins, but the `access_token` is still valid
        return token
      } else {
        // Subsequent logins, but the `access_token` has expired, try to refresh it
        if (!token.refresh_token) throw new TypeError("Missing refresh_token")

        try {
          const response = await fetch("https://accounts.spotify.com/api/token", {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              Authorization: `Basic ${Buffer.from(
                `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
              ).toString("base64")}`,
            },
            body: new URLSearchParams({
              grant_type: "refresh_token",
              refresh_token: token.refresh_token,
            }),
          })

          const tokensOrError = await response.json()
          if (!response.ok) throw tokensOrError

          const newTokens = tokensOrError as {
            access_token: string
            expires_in: number
            refresh_token?: string
          }

          return {
            ...token,
            access_token: newTokens.access_token,
            expires_at: Math.floor(Date.now() / 1000 + newTokens.expires_in),
            // Spotify usually omits refresh_token when refreshing — keep the old one
            refresh_token: newTokens.refresh_token ?? token.refresh_token,
          }
        } catch (error) {
          console.error("Error refreshing access_token", error)
          // Signal the failure so the UI can force a re-login
          token.error = "RefreshTokenError"
          return token
        }
      }
    },

    async session({ session, token }) {
      // exposed so route handlers can call Spotify via auth() (which refreshes);
      // getToken() would NOT run the refresh callback — see PLAN.md challenge #13
      session.access_token = token.access_token
      session.error = token.error
      // `sub` is the Spotify user ID (no DB adapter, so Auth.js takes it straight
      // from the Spotify profile). Stable across logins — moments are keyed on it.
      if (token.sub) session.user.id = token.sub
      return session
    },
  },
})

declare module "next-auth" {
  interface Session {
    access_token?: string
    error?: "RefreshTokenError"
  }
}

