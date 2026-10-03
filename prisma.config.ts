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
    url: process.env.DATABASE_URL,
  },
});
