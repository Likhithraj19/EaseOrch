import express from "express";
import { createGitHubWebhookRouter, NormalizedEventQueue } from "./routes/github-webhook.route";

type CreateAppOptions = {
  prisma: Parameters<typeof createGitHubWebhookRouter>[0]["prisma"];
  env: {
    GITHUB_WEBHOOK_SECRET: string;
  };
  queue: NormalizedEventQueue;
};

export function createApp({ prisma, env, queue }: CreateAppOptions) {
  const app = express();

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.use(
    "/webhooks/github",
    express.raw({ type: "application/json" }),
    createGitHubWebhookRouter({
      prisma,
      queue,
      githubWebhookSecret: env.GITHUB_WEBHOOK_SECRET
    })
  );

  return app;
}
