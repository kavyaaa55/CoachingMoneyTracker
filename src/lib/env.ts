import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  GATEWAY_WEBHOOK_SECRET: z.string().min(32),
  CRON_SECRET: z.string().min(32),
  APP_URL: z.url().default("http://localhost:3000"),
  /** Connections per app server. Keep the sum across servers under Postgres's limit. */
  DATABASE_POOL_MAX: z.coerce.number().int().min(2).max(100).default(10),
  /** Optional. Without it, every AI step falls back to plain rules. */
  GEMINI_API_KEY: z
    .string()
    .optional()
    .transform((value) => value || undefined),
  GEMINI_MODEL: z.string().min(1).default("gemini-2.5-flash"),
  DEMO_MODE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

export const env = schema.parse(process.env);
