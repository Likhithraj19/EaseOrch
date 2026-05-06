import { Prisma } from "@prisma/client";
import express, { Request, Response } from "express";
import { normalizeGitHubWebhookEvent } from "../../events/github-normalizer";
import { GitHubPullRequestPayload } from "../../github/github-webhook.types";
import { verifyGitHubSignature } from "../../github/github-signature";

export type NormalizedEventQueue = {
  enqueueNormalizedEvent: (job: { normalizedEventId: string }) => Promise<unknown> | unknown;
};

type CreateGitHubWebhookRouterOptions = {
  prisma: {
    webhookEvent: {
      create: (args: {
        data: {
          provider: string;
          deliveryId: string;
          eventName: string;
          eventAction: string | null;
          rawPayload: Prisma.InputJsonValue;
        };
      }) => Promise<{ id: string }>;
    };
    normalizedEvent: {
      create: (args: {
        data: {
          webhookEventId: string;
          providerEventRef: string;
          eventType: "PR_OPENED" | "PR_MERGED";
          repoOwner: string;
          repoName: string;
          repoFullName: string;
          prNumber: number;
          prTitle: string;
          prAuthor: string;
          prBranch: string;
          prUrl: string;
          mergedAt: Date | null;
          mediaLinks: Prisma.InputJsonValue;
        };
      }) => Promise<{ id: string }>;
    };
  };
  queue: NormalizedEventQueue;
  githubWebhookSecret: string;
};

function isUniqueConstraintError(error: unknown): error is { code: string } {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "P2002";
}

export function createGitHubWebhookRouter({
  prisma,
  queue,
  githubWebhookSecret
}: CreateGitHubWebhookRouterOptions) {
  const router = express.Router();

  router.post("/", createGitHubWebhookHandler({ prisma, queue, githubWebhookSecret }));

  return router;
}

export function createGitHubWebhookHandler({
  prisma,
  queue,
  githubWebhookSecret
}: CreateGitHubWebhookRouterOptions) {
  return async (req: Request, res: Response) => {
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from([]);
    const signatureHeader = req.header("X-Hub-Signature-256");

    if (
      !verifyGitHubSignature({
        rawBody,
        secret: githubWebhookSecret,
        signatureHeader
      })
    ) {
      return res.status(401).json({ error: "Invalid GitHub signature" });
    }

    const deliveryId = req.header("X-GitHub-Delivery");
    const eventName = req.header("X-GitHub-Event");

    if (!deliveryId || !eventName) {
      return res.status(400).json({ error: "Missing GitHub webhook headers" });
    }

    const payload = JSON.parse(rawBody.toString("utf8")) as GitHubPullRequestPayload;

    let webhookEventId: string;

    try {
      const webhookEvent = await prisma.webhookEvent.create({
        data: {
          provider: "github",
          deliveryId,
          eventName,
          eventAction: payload.action ?? null,
          rawPayload: payload as Prisma.InputJsonValue
        }
      });

      webhookEventId = webhookEvent.id;
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return res.status(200).json({ status: "duplicate" });
      }

      throw error;
    }

    const normalizedEvent = normalizeGitHubWebhookEvent({
      providerEventRef: deliveryId,
      eventName,
      payload
    });

    if (!normalizedEvent) {
      return res.status(202).json({ status: "ignored" });
    }

    const createdNormalizedEvent = await prisma.normalizedEvent.create({
      data: {
        webhookEventId,
        ...normalizedEvent,
        mediaLinks: normalizedEvent.mediaLinks as Prisma.InputJsonValue
      }
    });

    await queue.enqueueNormalizedEvent({
      normalizedEventId: createdNormalizedEvent.id
    });

    return res.status(202).json({ status: "accepted" });
  };
}
