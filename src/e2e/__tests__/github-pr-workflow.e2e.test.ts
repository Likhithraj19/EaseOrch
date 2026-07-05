import crypto from "crypto";
import request from "supertest";
import { PrismaClient } from "@prisma/client";

import { createApp } from "../../http/create-app";
import { processWorkflowJob } from "../../worker/workflow-worker";
import { runWorkflowExecution } from "../../workflows/workflow-executor";
import { createAdapters } from "../../integrations/integration-adapters";

import {
  createTestPrisma,
  truncateAll,
  seedDefaultWorkflowConfig
} from "../../../prisma/test-setup";

const WEBHOOK_SECRET = "test-secret";

const payload = {
  action: "opened",
  pull_request: {
    number: 42,
    title: "[PROJ-123] Add login flow",
    html_url: "https://github.com/acme/easeorch/pull/42",
    merged: false,
    head: { ref: "feature/PROJ-123-add-login" },
    user: { login: "likhithraj" },
    body: "Preview: https://github.com/user-attachments/files/123/example.mp4"
  },
  repository: {
    name: "easeorch",
    full_name: "acme/easeorch",
    owner: { login: "acme" }
  }
};

function sign(secret: string, body: string): string {
  return "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");
}

describe("e2e: PR_OPENED → Jira comment + Slack notify", () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = createTestPrisma();
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
  });

  beforeEach(async () => {
    await truncateAll(prisma);
    await seedDefaultWorkflowConfig(prisma);
  });

  test("end-to-end happy path persists execution, attempt, action results, and logs", async () => {
    const enqueued: Array<{ normalizedEventId: string }> = [];

    const app = createApp({
      prisma,
      env: { GITHUB_WEBHOOK_SECRET: WEBHOOK_SECRET },
      queue: {
        enqueueNormalizedEvent: async (job) => {
          enqueued.push(job);
        }
      }
    });

    const body = JSON.stringify(payload);
    const deliveryId = crypto.randomUUID();

    const res = await request(app)
      .post("/webhooks/github")
      .set("X-Hub-Signature-256", sign(WEBHOOK_SECRET, body))
      .set("X-GitHub-Delivery", deliveryId)
      .set("X-GitHub-Event", "pull_request")
      .set("Content-Type", "application/json")
      .send(body);

    expect(res.status).toBe(202);
    expect(enqueued).toHaveLength(1);

    const adapters = createAdapters({ jiraMode: "mock", slackMode: "mock" });

    await processWorkflowJob(
      { data: { normalizedEventId: enqueued[0].normalizedEventId } },
      {
        executor: ({ normalizedEventId }) =>
          runWorkflowExecution({
            prisma: prisma as unknown as Parameters<typeof runWorkflowExecution>[0]["prisma"],
            normalizedEventId,
            adapters
          })
      }
    );

    const webhookEvents = await prisma.webhookEvent.findMany();
    expect(webhookEvents).toHaveLength(1);
    expect(webhookEvents[0].deliveryId).toBe(deliveryId);
    expect(webhookEvents[0].eventName).toBe("pull_request");

    const normalized = await prisma.normalizedEvent.findMany();
    expect(normalized).toHaveLength(1);
    expect(normalized[0].id).toBe(enqueued[0].normalizedEventId);
    expect(normalized[0].eventType).toBe("PR_OPENED");
    expect(normalized[0].webhookEventId).toBe(webhookEvents[0].id);

    const executions = await prisma.workflowExecution.findMany();
    expect(executions).toHaveLength(1);
    expect(executions[0].status).toBe("succeeded");
    expect(executions[0].normalizedEventId).toBe(normalized[0].id);

    const attempts = await prisma.workflowAttempt.findMany();
    expect(attempts).toHaveLength(1);
    expect(attempts[0].status).toBe("succeeded");
    expect(attempts[0].workflowExecutionId).toBe(executions[0].id);
    expect(attempts[0].attemptNumber).toBe(1);

    const results = await prisma.actionResult.findMany({
      orderBy: { actionType: "asc" }
    });
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.actionType)).toEqual([
      "JIRA_COMMENT",
      "SLACK_NOTIFY"
    ]);
    expect(results.every((r) => r.status === "succeeded")).toBe(true);
    expect(results.every((r) => r.workflowAttemptId === attempts[0].id)).toBe(true);

    const logs = await prisma.executionLog.findMany();
    expect(logs.length).toBeGreaterThanOrEqual(2);
    expect(logs.every((l) => l.workflowExecutionId === executions[0].id)).toBe(true);
  });
});
