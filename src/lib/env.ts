import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  GATEWAY_WEBHOOK_SECRET: z.string().min(32),
  CRON_SECRET: z.string().min(32),
  APP_URL: z.url().default("http://localhost:3000"),
  DEMO_MODE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

export const env = schema.parse(process.env);
