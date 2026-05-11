import { runWorkflowExecution, ExecutorPrisma } from "../workflow-executor";
import { MockJiraAdapter } from "../../integrations/jira/mock-jira-adapter";
import { MockSlackAdapter } from "../../integrations/slack/mock-slack-adapter";

type Recorder = {
  prisma: ExecutorPrisma;
  calls: { table: string; op: string; args: unknown }[];
  state: {
    normalizedEvent: Record<string, any> | null;
    workflowConfig: Record<string, any> | null;
    executions: Record<string, any>[];
    attempts: Record<string, any>[];
    actionResults: Record<string, any>[];
    executionLogs: Record<string, any>[];
  };
};

function makeRecorder(seed: {
  normalizedEvent: Record<string, any> | null;
  workflowConfig: Record<string, any> | null;
}): Recorder {
  const calls: Recorder["calls"] = [];
  const state = {
    normalizedEvent: seed.normalizedEvent,
    workflowConfig: seed.workflowConfig,
    executions: [] as Record<string, any>[],
    attempts: [] as Record<string, any>[],
    actionResults: [] as Record<string, any>[],
    executionLogs: [] as Record<string, any>[]
  };

  let idCounter = 0;
  const nextId = (prefix: string) => `${prefix}-${++idCounter}`;

  const prisma: ExecutorPrisma = {
    normalizedEvent: {
      findUnique: jest.fn(async (args: any) => {
        calls.push({ table: "normalizedEvent", op: "findUnique", args });
        return state.normalizedEvent;
      })
    },
    workflowConfig: {
      findFirst: jest.fn(async (args: any) => {
        calls.push({ table: "workflowConfig", op: "findFirst", args });
        return state.workflowConfig;
      })
    },
    workflowExecution: {
      findFirst: jest.fn(async (args: any) => {
        calls.push({ table: "workflowExecution", op: "findFirst", args });
        return state.executions.find(
          (e) => e.normalizedEventId === args.where?.normalizedEventId
        ) ?? null;
      }),
      create: jest.fn(async (args: any) => {
        calls.push({ table: "workflowExecution", op: "create", args });
        const row = { id: nextId("exec"), ...args.data };
        state.executions.push(row);
        return row;
      }),
      update: jest.fn(async (args: any) => {
        calls.push({ table: "workflowExecution", op: "update", args });
        const row = state.executions.find((e) => e.id === args.where.id)!;
        Object.assign(row, args.data);
        return row;
      })
    },
    workflowAttempt: {
      count: jest.fn(async (args: any) => {
        calls.push({ table: "workflowAttempt", op: "count", args });
        return state.attempts.filter(
          (a) => a.workflowExecutionId === args.where?.workflowExecutionId
        ).length;
      }),
      create: jest.fn(async (args: any) => {
        calls.push({ table: "workflowAttempt", op: "create", args });
        const row = { id: nextId("att"), ...args.data };
        state.attempts.push(row);
        return row;
      }),
      update: jest.fn(async (args: any) => {
        calls.push({ table: "workflowAttempt", op: "update", args });
        const row = state.attempts.find((a) => a.id === args.where.id)!;
        Object.assign(row, args.data);
        return row;
      })
    },
    actionResult: {
      create: jest.fn(async (args: any) => {
        calls.push({ table: "actionResult", op: "create", args });
        const row = { id: nextId("ar"), ...args.data };
        state.actionResults.push(row);
        return row;
      })
    },
    executionLog: {
      create: jest.fn(async (args: any) => {
        calls.push({ table: "executionLog", op: "create", args });
        const row = { id: nextId("log"), ...args.data };
        state.executionLogs.push(row);
        return row;
      })
    }
  };

  return { prisma, calls, state };
}

const baseEvent = {
  id: "norm-1",
  eventType: "PR_OPENED" as const,
  prTitle: "PROJ-123 fix the thing",
  prBranch: "feature/PROJ-123-thing",
  prAuthor: "alice",
  prUrl: "https://example/pr/1",
  mediaLinks: []
};

const baseConfig = {
  id: "cfg-1",
  jiraTransitionOnMerge: null,
  slackEnabled: true,
  enabledEvents: ["PR_OPENED", "PR_MERGED"]
};

describe("runWorkflowExecution", () => {
  test("happy path: PR opened with Jira key creates execution, attempt, action results, logs, finalizes succeeded", async () => {
    const { prisma, state } = makeRecorder({
      normalizedEvent: baseEvent,
      workflowConfig: baseConfig
    });

    const result = await runWorkflowExecution({
      prisma,
      normalizedEventId: "norm-1",
      adapters: {
        jira: new MockJiraAdapter({ mode: "always-success" }),
        slack: new MockSlackAdapter({ mode: "always-success" })
      }
    });

    expect(result.status).toBe("succeeded");
    expect(state.executions).toHaveLength(1);
    expect(state.executions[0].status).toBe("succeeded");
    expect(state.executions[0].finishedAt).toBeInstanceOf(Date);
    expect(state.attempts).toHaveLength(1);
    expect(state.attempts[0].attemptNumber).toBe(1);
    expect(state.attempts[0].status).toBe("succeeded");

    const types = state.actionResults.map((r) => r.actionType).sort();
    expect(types).toEqual(["JIRA_COMMENT", "SLACK_NOTIFY"]);
    expect(state.actionResults.every((r) => r.status === "succeeded")).toBe(true);
    expect(state.actionResults.every((r) => typeof r.externalId === "string")).toBe(true);

    expect(state.executionLogs.length).toBeGreaterThanOrEqual(2);
  });

  test("non-retryable Jira failure still runs Slack and finalizes completed_with_warning", async () => {
    const { prisma, state } = makeRecorder({
      normalizedEvent: baseEvent,
      workflowConfig: baseConfig
    });

    const result = await runWorkflowExecution({
      prisma,
      normalizedEventId: "norm-1",
      adapters: {
        jira: new MockJiraAdapter({ mode: "always-fail", retryableFailure: false }),
        slack: new MockSlackAdapter({ mode: "always-success" })
      }
    });

    expect(result.status).toBe("completed_with_warning");
    expect(state.executions[0].status).toBe("completed_with_warning");

    const jira = state.actionResults.find((r) => r.actionType === "JIRA_COMMENT");
    const slack = state.actionResults.find((r) => r.actionType === "SLACK_NOTIFY");
    expect(jira?.status).toBe("failed");
    expect(slack?.status).toBe("succeeded");
  });

  test("retryable Jira failure throws, attempt failed, execution stays running", async () => {
    const { prisma, state } = makeRecorder({
      normalizedEvent: baseEvent,
      workflowConfig: baseConfig
    });

    const promise = runWorkflowExecution({
      prisma,
      normalizedEventId: "norm-1",
      adapters: {
        jira: new MockJiraAdapter({ mode: "always-fail", retryableFailure: true }),
        slack: new MockSlackAdapter({ mode: "always-success" })
      }
    });

    await expect(promise).rejects.toMatchObject({ name: "RetryableError" });

    expect(state.executions[0].status).toBe("running");
    expect(state.executions[0].finishedAt).toBeUndefined();
    expect(state.attempts[0].status).toBe("failed");
    expect(state.attempts[0].errorSummary).toMatch(/MockJiraAdapter/);
    expect(
      state.actionResults.find((r) => r.actionType === "JIRA_COMMENT")?.status
    ).toBe("failed");
  });

  test("two runs on same normalizedEventId share one execution; attempt numbers increment", async () => {
    const { prisma, state } = makeRecorder({
      normalizedEvent: baseEvent,
      workflowConfig: baseConfig
    });

    const jira = new MockJiraAdapter({ mode: "fail-then-succeed", retryableFailure: true });
    const slack = new MockSlackAdapter({ mode: "always-success" });

    await expect(
      runWorkflowExecution({ prisma, normalizedEventId: "norm-1", adapters: { jira, slack } })
    ).rejects.toMatchObject({ name: "RetryableError" });

    const second = await runWorkflowExecution({
      prisma,
      normalizedEventId: "norm-1",
      adapters: { jira, slack }
    });

    expect(state.executions).toHaveLength(1);
    expect(state.attempts).toHaveLength(2);
    expect(state.attempts.map((a) => a.attemptNumber)).toEqual([1, 2]);
    expect(state.attempts[0].status).toBe("failed");
    expect(state.attempts[1].status).toBe("succeeded");
    expect(second.status).toBe("succeeded");
    expect(state.executions[0].status).toBe("succeeded");
  });

  test("missing Jira key writes skipped ActionResult and still runs Slack", async () => {
    const { prisma, state } = makeRecorder({
      normalizedEvent: {
        ...baseEvent,
        prTitle: "no key here",
        prBranch: "feature/just-a-branch"
      },
      workflowConfig: baseConfig
    });

    const result = await runWorkflowExecution({
      prisma,
      normalizedEventId: "norm-1",
      adapters: {
        jira: new MockJiraAdapter({ mode: "always-success" }),
        slack: new MockSlackAdapter({ mode: "always-success" })
      }
    });

    expect(result.status).toBe("completed_with_warning");
    const jira = state.actionResults.find((r) => r.actionType === "JIRA_COMMENT");
    const slack = state.actionResults.find((r) => r.actionType === "SLACK_NOTIFY");
    expect(jira?.status).toBe("skipped");
    expect(slack?.status).toBe("succeeded");
  });

  test("missing normalized event throws NonRetryableError", async () => {
    const { prisma } = makeRecorder({
      normalizedEvent: null,
      workflowConfig: baseConfig
    });

    await expect(
      runWorkflowExecution({
        prisma,
        normalizedEventId: "missing",
        adapters: {
          jira: new MockJiraAdapter({ mode: "always-success" }),
          slack: new MockSlackAdapter({ mode: "always-success" })
        }
      })
    ).rejects.toMatchObject({ name: "NonRetryableError" });
  });
});
