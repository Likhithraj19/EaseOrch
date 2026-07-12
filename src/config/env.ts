import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().url(),
  GITHUB_WEBHOOK_SECRET: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3000),
  JIRA_ADAPTER_MODE: z.enum(["mock", "real"]).default("mock"),
  SLACK_ADAPTER_MODE: z.enum(["mock", "real"]).default("mock"),
  JIRA_BASE_URL: z
    .string()
    .url()
    .startsWith("https://", "JIRA_BASE_URL must use https")
    .optional(),
  JIRA_EMAIL: z.string().min(1).optional(),
  JIRA_API_TOKEN: z.string().min(1).optional(),
  SLACK_BOT_TOKEN: z.string().min(1).optional(),
  SLACK_DEFAULT_CHANNEL: z.string().min(1).optional()
});

export type AppEnv = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  return envSchema.parse(source);
}

export const env = loadEnv();
