import { logger } from "../shared/logger";
import { RetryableError } from "../integrations/errors";

export type WorkflowJobLike = {
  data: { normalizedEventId: string };
};

export type WorkflowExecutor = (input: { normalizedEventId: string }) => Promise<{
  executionId: string;
  status: string;
}>;

export type ProcessJobDeps = {
  executor: WorkflowExecutor;
};

export type ProcessJobResult = {
  executionId: string | null;
  status: string;
};

export async function processWorkflowJob(
  job: WorkflowJobLike,
  deps: ProcessJobDeps
): Promise<ProcessJobResult> {
  const { normalizedEventId } = job.data;

  try {
    const out = await deps.executor({ normalizedEventId });
    return { executionId: out.executionId, status: out.status };
  } catch (err) {
    if (err instanceof RetryableError) {
      logger.warn("workflow-worker: retryable failure, re-throwing for BullMQ retry", {
        normalizedEventId,
        message: err.message
      });
      throw err;
    }

    const message = err instanceof Error ? err.message : "unknown error";
    logger.error("workflow-worker: non-retryable failure, marking job failed", {
      normalizedEventId,
      message
    });
    return { executionId: null, status: "failed" };
  }
}

type FinalizerPrisma = {
  workflowExecution: {
    findFirst: (args: any) => Promise<{ id: string } | null>;
    update: (args: any) => Promise<any>;
  };
  executionLog: {
    create: (args: any) => Promise<any>;
  };
};

export type FinalizerJobLike = {
  data: { normalizedEventId: string };
  attemptsMade: number;
  opts: { attempts?: number };
};

export type FinalizerInput = {
  prisma: FinalizerPrisma;
  job: FinalizerJobLike;
  reason: string;
};

export async function finalizeExecutionOnTerminalFailure(input: FinalizerInput): Promise<void> {
  const maxAttempts = input.job.opts.attempts ?? 1;
  if (input.job.attemptsMade < maxAttempts) {
    return;
  }

  const execution = await input.prisma.workflowExecution.findFirst({
    where: { normalizedEventId: input.job.data.normalizedEventId }
  });

  if (!execution) {
    logger.error("finalizeExecutionOnTerminalFailure: no execution row found", {
      normalizedEventId: input.job.data.normalizedEventId
    });
    return;
  }

  await input.prisma.workflowExecution.update({
    where: { id: execution.id },
    data: { status: "failed", finishedAt: new Date() }
  });

  await input.prisma.executionLog.create({
    data: {
      workflowExecutionId: execution.id,
      level: "error",
      step: "execution.finalized",
      message: "execution finalized after terminal failure",
      metadata: {
        reason: input.reason,
        attemptCount: input.job.attemptsMade
      }
    }
  });
}
