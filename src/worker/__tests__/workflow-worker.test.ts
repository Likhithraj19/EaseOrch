import { processWorkflowJob, finalizeExecutionOnTerminalFailure } from "../workflow-worker";
import { RetryableError, NonRetryableError } from "../../integrations/errors";

describe("processWorkflowJob", () => {
  test("calls executor with job's normalizedEventId and resolves on success", async () => {
    const executor = jest.fn(async () => ({ executionId: "exec-1", status: "succeeded" }));

    const result = await processWorkflowJob(
      { data: { normalizedEventId: "norm-1" } },
      { executor }
    );

    expect(executor).toHaveBeenCalledWith({ normalizedEventId: "norm-1" });
    expect(result).toEqual({ executionId: "exec-1", status: "succeeded" });
  });

  test("re-throws RetryableError so BullMQ retries", async () => {
    const executor = jest.fn(async () => {
      throw new RetryableError("transient");
    });

    await expect(
      processWorkflowJob({ data: { normalizedEventId: "x" } }, { executor })
    ).rejects.toBeInstanceOf(RetryableError);
  });

  test("swallows NonRetryableError and resolves with failed status (no BullMQ retry)", async () => {
    const executor = jest.fn(async () => {
      throw new NonRetryableError("invalid");
    });

    const result = await processWorkflowJob(
      { data: { normalizedEventId: "x" } },
      { executor }
    );

    expect(result.status).toBe("failed");
  });

  test("unknown error is wrapped as NonRetryableError-equivalent (no retry)", async () => {
    const executor = jest.fn(async () => {
      throw new Error("boom");
    });

    const result = await processWorkflowJob(
      { data: { normalizedEventId: "x" } },
      { executor }
    );

    expect(result.status).toBe("failed");
  });
});

describe("finalizeExecutionOnTerminalFailure", () => {
  test("when attemptsMade >= attempts, finalizes the execution row to failed", async () => {
    const updateExec = jest.fn(async () => undefined);
    const createLog = jest.fn(async () => undefined);

    const prisma = {
      workflowExecution: {
        findFirst: jest.fn(async () => ({ id: "exec-1" })),
        update: updateExec
      },
      executionLog: {
        create: createLog
      }
    } as any;

    await finalizeExecutionOnTerminalFailure({
      prisma,
      job: { data: { normalizedEventId: "norm-1" }, attemptsMade: 3, opts: { attempts: 3 } },
      reason: "retries_exhausted"
    });

    expect(updateExec).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "exec-1" },
        data: expect.objectContaining({ status: "failed" })
      })
    );
    expect(createLog).toHaveBeenCalled();
  });

  test("when attemptsMade < attempts, does nothing (BullMQ will retry)", async () => {
    const updateExec = jest.fn();
    const prisma = {
      workflowExecution: { findFirst: jest.fn(), update: updateExec },
      executionLog: { create: jest.fn() }
    } as any;

    await finalizeExecutionOnTerminalFailure({
      prisma,
      job: { data: { normalizedEventId: "norm-1" }, attemptsMade: 1, opts: { attempts: 3 } },
      reason: "retryable"
    });

    expect(updateExec).not.toHaveBeenCalled();
  });
});
