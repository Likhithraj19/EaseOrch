import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().url(),
  GITHUB_WEBHOOK_SECRET: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3000),
  JIRA_ADAPTER_MODE: z.enum(["mock", "real"]).default("mock"),
  SLACK_ADAPTER_MODE: z.enum(["mock", "real"]).default("mock")
});

export type AppEnv = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  return envSchema.parse(source);
}

export const env = loadEnv();
