import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // dev runs on 127.0.0.1 (Spotify OAuth requirement) but Next considers its
  // origin "localhost" — without this, client JS is blocked as cross-origin
  allowedDevOrigins: ["127.0.0.1"],
  // a stray package-lock.json higher up the disk makes Next guess the wrong
  // project root; pin it to this folder
  turbopack: { root: __dirname },
  outputFileTracingRoot: __dirname,
  // the card route reads its fonts from disk at runtime, which the bundler
  // can't see — ship them with the function explicitly
  outputFileTracingIncludes: {
    "/api/card": ["./public/fonts/**"],
  },
};

export default nextConfig;
