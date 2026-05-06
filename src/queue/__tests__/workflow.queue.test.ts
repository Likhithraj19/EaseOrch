const addMock = jest.fn();

jest.mock("bullmq", () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: addMock
  }))
}));

import { Queue } from "bullmq";
import { createWorkflowQueue } from "../workflow.queue";

describe("createWorkflowQueue", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("enqueues jobs with normalizedEventId only", async () => {
    const queue = createWorkflowQueue({
      connection: {
        host: "localhost",
        port: 6379
      }
    });

    await queue.enqueueNormalizedEvent({
      normalizedEventId: "normalized-1"
    });

    expect(addMock).toHaveBeenCalledWith(
      "process-normalized-event",
      {
        normalizedEventId: "normalized-1"
      },
      expect.objectContaining({
        attempts: 3,
        removeOnComplete: 100,
        removeOnFail: false
      })
    );
  });

  test("configures exponential retry backoff", async () => {
    createWorkflowQueue({
      connection: {
        host: "localhost",
        port: 6379
      }
    });

    expect(Queue).toHaveBeenCalledWith(
      "workflow-events",
      expect.objectContaining({
        defaultJobOptions: expect.objectContaining({
          backoff: expect.objectContaining({
            type: "exponential",
            delay: 30000
          })
        })
      })
    );
  });
});
