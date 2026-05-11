import { runWorkflowActions } from "./workflow-engine";
import {
  WorkflowActionHandler,
  WorkflowActionResult,
  WorkflowActionType
} from "./action.types";
import { extractJiraIssueKey } from "../events/jira-key-extractor";
import { JiraAdapter } from "../integrations/jira/jira-adapter";
import { SlackAdapter } from "../integrations/slack/slack-adapter";
import { RetryableError, NonRetryableError } from "../integrations/errors";

type AnyArgs = { [key: string]: any };

export type ExecutorPrisma = {
  normalizedEvent: {
    findUnique: (args: AnyArgs) => Promise<any>;
  };
  workflowConfig: {
    findFirst: (args: AnyArgs) => Promise<any>;
  };
  workflowExecution: {
    findFirst: (args: AnyArgs) => Promise<any>;
    create: (args: AnyArgs) => Promise<any>;
    update: (args: AnyArgs) => Promise<any>;
  };
  workflowAttempt: {
    count: (args: AnyArgs) => Promise<number>;
    create: (args: AnyArgs) => Promise<any>;
    update: (args: AnyArgs) => Promise<any>;
  };
  actionResult: {
    create: (args: AnyArgs) => Promise<any>;
  };
  executionLog: {
    create: (args: AnyArgs) => Promise<any>;
  };
};

export type ExecutorAdapters = {
  jira: JiraAdapter;
  slack: SlackAdapter;
};

export type RunExecutionInput = {
  prisma: ExecutorPrisma;
  normalizedEventId: string;
  adapters: ExecutorAdapters;
};

export type RunExecutionResult = {
  executionId: string;
  status: string;
};

export async function runWorkflowExecution(input: RunExecutionInput): Promise<RunExecutionResult> {
  const event = await input.prisma.normalizedEvent.findUnique({
    where: { id: input.normalizedEventId }
  });

  if (!event) {
    throw new NonRetryableError(`NormalizedEvent ${input.normalizedEventId} not found`);
  }

  const config = await input.prisma.workflowConfig.findFirst({
    where: {}
  });

  if (!config) {
    const exec = await input.prisma.workflowExecution.create({
      data: {
        workflowConfigId: "unknown",
        normalizedEventId: input.normalizedEventId,
        status: "skipped_no_matching_workflow",
        startedAt: new Date(),
        finishedAt: new Date()
      }
    });
    return { executionId: exec.id, status: "skipped_no_matching_workflow" };
  }

  const existing = await input.prisma.workflowExecution.findFirst({
    where: { normalizedEventId: input.normalizedEventId }
  });

  const execution =
    existing ??
    (await input.prisma.workflowExecution.create({
      data: {
        workflowConfigId: config.id,
        normalizedEventId: input.normalizedEventId,
        status: "running",
        startedAt: new Date()
      }
    }));

  const priorAttempts = await input.prisma.workflowAttempt.count({
    where: { workflowExecutionId: execution.id }
  });

  const attempt = await input.prisma.workflowAttempt.create({
    data: {
      workflowExecutionId: execution.id,
      attemptNumber: priorAttempts + 1,
      status: "running",
      startedAt: new Date()
    }
  });

  const jiraIssueKey = extractJiraIssueKey({
    branchName: event.prBranch,
    title: event.prTitle
  });

  const handlers = buildHandlers({
    prisma: input.prisma,
    attemptId: attempt.id,
    event,
    config,
    jiraIssueKey,
    adapters: input.adapters
  });

  try {
    const engineResult = await runWorkflowActions({
      event: { eventType: event.eventType, jiraIssueKey },
      config: {
        jiraTransitionOnMerge: config.jiraTransitionOnMerge,
        slackEnabled: Boolean(config.slackEnabled)
      },
      handlers
    });

    for (const r of engineResult.actionResults) {
      if (r.status === "skipped") {
        await input.prisma.actionResult.create({
          data: {
            workflowAttemptId: attempt.id,
            actionType: r.actionType as WorkflowActionType,
            status: "skipped"
          }
        });
      }
    }

    for (const r of engineResult.actionResults) {
      await input.prisma.executionLog.create({
        data: {
          workflowExecutionId: execution.id,
          level: r.status === "failed" ? "error" : "info",
          step: String(r.actionType),
          message: `action ${r.status}`,
          metadata: {
            attemptNumber: priorAttempts + 1,
            externalId: r.externalId ?? null,
            errorMessage: r.errorMessage ?? null
          }
        }
      });
    }

    const attemptStatus =
      engineResult.status === "failed" ? "failed" : "succeeded";

    await input.prisma.workflowAttempt.update({
      where: { id: attempt.id },
      data: {
        status: attemptStatus,
        finishedAt: new Date()
      }
    });

    await input.prisma.workflowExecution.update({
      where: { id: execution.id },
      data: {
        status: engineResult.status,
        finishedAt: new Date()
      }
    });

    return { executionId: execution.id, status: engineResult.status };
  } catch (err) {
    if (err instanceof RetryableError) {
      await input.prisma.executionLog.create({
        data: {
          workflowExecutionId: execution.id,
          level: "warn",
          step: "execution.retryable_failure",
          message: err.message,
          metadata: { attemptNumber: priorAttempts + 1 }
        }
      });

      await input.prisma.workflowAttempt.update({
        where: { id: attempt.id },
        data: {
          status: "failed",
          errorSummary: err.message,
          finishedAt: new Date()
        }
      });

      throw err;
    }

    const message = err instanceof Error ? err.message : "unknown error";

    await input.prisma.executionLog.create({
      data: {
        workflowExecutionId: execution.id,
        level: "error",
        step: "execution.unexpected_failure",
        message,
        metadata: { attemptNumber: priorAttempts + 1 }
      }
    });

    await input.prisma.workflowAttempt.update({
      where: { id: attempt.id },
      data: {
        status: "failed",
        errorSummary: message,
        finishedAt: new Date()
      }
    });

    await input.prisma.workflowExecution.update({
      where: { id: execution.id },
      data: {
        status: "failed",
        finishedAt: new Date()
      }
    });

    throw err;
  }
}

type BuildHandlersInput = {
  prisma: ExecutorPrisma;
  attemptId: string;
  event: { prTitle: string; prAuthor: string; prUrl: string; mediaLinks: unknown };
  config: { jiraTransitionOnMerge: string | null };
  jiraIssueKey: string | null;
  adapters: ExecutorAdapters;
};

function buildHandlers(input: BuildHandlersInput): Record<WorkflowActionType, WorkflowActionHandler> {
  return {
    JIRA_COMMENT: makeHandler({
      ...input,
      actionType: "JIRA_COMMENT",
      required: false,
      run: async () => {
        const body = renderJiraCommentBody(input.event);
        return input.adapters.jira.addComment(input.jiraIssueKey ?? "", body);
      }
    }),
    JIRA_TRANSITION: makeHandler({
      ...input,
      actionType: "JIRA_TRANSITION",
      required: false,
      run: async () => {
        const transition = input.config.jiraTransitionOnMerge ?? "";
        return input.adapters.jira.transitionIssue(input.jiraIssueKey ?? "", transition);
      }
    }),
    SLACK_NOTIFY: makeHandler({
      ...input,
      actionType: "SLACK_NOTIFY",
      required: true,
      run: async () => {
        const message = renderSlackMessage(input.event);
        return input.adapters.slack.sendMessage("#default", message);
      }
    })
  };
}

type MakeHandlerInput = BuildHandlersInput & {
  actionType: WorkflowActionType;
  required: boolean;
  run: () => Promise<{ externalId: string }>;
};

function makeHandler(input: MakeHandlerInput): WorkflowActionHandler {
  return {
    actionType: input.actionType,
    run: async (): Promise<WorkflowActionResult> => {
      try {
        const out = await input.run();
        await input.prisma.actionResult.create({
          data: {
            workflowAttemptId: input.attemptId,
            actionType: input.actionType,
            status: "succeeded",
            externalId: out.externalId
          }
        });
        return {
          actionType: input.actionType,
          status: "succeeded",
          required: input.required,
          externalId: out.externalId
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : "unknown error";
        await input.prisma.actionResult.create({
          data: {
            workflowAttemptId: input.attemptId,
            actionType: input.actionType,
            status: "failed",
            errorMessage: message
          }
        });

        if (err instanceof RetryableError) {
          throw err;
        }

        return {
          actionType: input.actionType,
          status: "failed",
          required: input.required,
          errorMessage: message
        };
      }
    }
  };
}

function renderJiraCommentBody(event: BuildHandlersInput["event"]): string {
  return [
    `PR by ${event.prAuthor}`,
    event.prTitle,
    event.prUrl,
    Array.isArray(event.mediaLinks) && event.mediaLinks.length > 0
      ? `Media: ${(event.mediaLinks as string[]).join(", ")}`
      : null
  ]
    .filter(Boolean)
    .join("\n");
}

function renderSlackMessage(event: BuildHandlersInput["event"]): string {
  return `${event.prAuthor}: ${event.prTitle} ${event.prUrl}`;
}
