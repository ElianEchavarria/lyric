import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Next.js keeps secrets in .env.local, but the Prisma CLI doesn't load env
// files on its own — and dotenv's default only reads .env.
config({ path: ".env.local" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // process.env rather than prisma's env() helper: env() throws when the
    // variable is missing, which would break `prisma generate` on a fresh
    // clone or CI — and generating the client doesn't need a database.
    // Migrations take locks a connection pooler can't hold, so in production
    // they use Neon's direct URL; the app itself keeps the pooled DATABASE_URL.
    // (The Vercel ↔ Neon integration names the direct one DATABASE_URL_UNPOOLED.)
    url:
      process.env.DIRECT_URL ??
      process.env.DATABASE_URL_UNPOOLED ??
      process.env.DATABASE_URL,
  },
});
