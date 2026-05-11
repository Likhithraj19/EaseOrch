import { Worker } from "bullmq";
import IORedis from "ioredis";
import { env } from "./config/env";
import { logger } from "./shared/logger";
import { prisma } from "./db/prisma";
import { createAdapters } from "./integrations/integration-adapters";
import { ExecutorPrisma, runWorkflowExecution } from "./workflows/workflow-executor";
import {
  finalizeExecutionOnTerminalFailure,
  processWorkflowJob
} from "./worker/workflow-worker";
import {
  WORKFLOW_QUEUE_NAME,
  WorkflowJobPayload
} from "./queue/workflow.queue";

export function startWorker(): Worker<WorkflowJobPayload> {
  const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
  const adapters = createAdapters({
    jiraMode: env.JIRA_ADAPTER_MODE,
    slackMode: env.SLACK_ADAPTER_MODE
  });
  const executorPrisma = prisma as unknown as ExecutorPrisma;

  const worker = new Worker<WorkflowJobPayload>(
    WORKFLOW_QUEUE_NAME,
    async (job) =>
      processWorkflowJob(job, {
        executor: ({ normalizedEventId }) =>
          runWorkflowExecution({
            prisma: executorPrisma,
            normalizedEventId,
            adapters
          })
      }),
    { connection }
  );

  worker.on("failed", async (job, err) => {
    logger.error("workflow-worker: job failed", {
      jobId: job?.id,
      attemptsMade: job?.attemptsMade,
      message: err instanceof Error ? err.message : "unknown"
    });

    if (!job) {
      return;
    }

    await finalizeExecutionOnTerminalFailure({
      prisma: executorPrisma,
      job,
      reason: "retries_exhausted"
    });
  });

  worker.on("ready", () => {
    logger.info("EaseOrch worker ready", {
      queue: WORKFLOW_QUEUE_NAME,
      mode: { jira: env.JIRA_ADAPTER_MODE, slack: env.SLACK_ADAPTER_MODE }
    });
  });

  return worker;
}

if (require.main === module) {
  startWorker();
}
