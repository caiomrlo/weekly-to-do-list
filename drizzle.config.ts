import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

// Load environment variables for migrations and studio
dotenv.config({ path: ".env" });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // When running migrations from host, prioritize DATABASE_URL_HOST (localhost)
    url: process.env.DATABASE_URL || "postgresql://appuser:apppass@localhost:5432/weekly_todo_db",
  },
});
