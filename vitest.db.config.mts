import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

if (existsSync(".env")) process.loadEnvFile(".env");

// Tests never call the model. The AI tests fake the network and set their own key.
process.env.GEMINI_API_KEY = "";

// Always a separate database, so these tests never touch the demo data.
const url = new URL(process.env.DATABASE_URL ?? "");
url.pathname = "/fee_tracker_test";
process.env.DATABASE_URL = url.href;

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["src/**/*.db.test.ts"],
    globalSetup: "./src/db/test-setup.ts",
    fileParallelism: false,
  },
});
