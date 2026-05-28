import { PrismaClient } from "@prisma/client";

export function createTestPrisma(): PrismaClient {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) {
    throw new Error("DATABASE_URL_TEST is not set");
  }
  if (!/easeorch_test(\?|$)/.test(url)) {
    throw new Error(
      `DATABASE_URL_TEST must point at a database whose name ends with "easeorch_test". Got: ${url}`
    );
  }
  return new PrismaClient({ datasources: { db: { url } } });
}

export async function truncateAll(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "ExecutionLog",
      "ActionResult",
      "WorkflowAttempt",
      "WorkflowExecution",
      "NormalizedEvent",
      "WebhookEvent",
      "WorkflowConfig"
    RESTART IDENTITY CASCADE;
  `);
}

export async function seedDefaultWorkflowConfig(prisma: PrismaClient): Promise<void> {
  await prisma.workflowConfig.create({
    data: {
      id: "default-github-pr-workflow",
      name: "GitHub PR to Jira and Slack",
      enabledEvents: ["PR_OPENED", "PR_MERGED"],
      jiraKeySources: ["branch", "title"],
      jiraTransitionOnMerge: null,
      slackEnabled: true,
      mediaExtractionConfig: { enabled: true, source: "pr_body" }
    }
  });
}
