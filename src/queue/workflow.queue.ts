import { ConnectionOptions, Queue } from "bullmq";

export const WORKFLOW_QUEUE_NAME = "workflow-events";
export const PROCESS_NORMALIZED_EVENT_JOB = "process-normalized-event";

export type WorkflowJobPayload = {
  normalizedEventId: string;
};

type CreateWorkflowQueueOptions = {
  connection: ConnectionOptions;
};

export function createWorkflowQueue({ connection }: CreateWorkflowQueueOptions) {
  const queue = new Queue<WorkflowJobPayload>(WORKFLOW_QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 30000
      },
      removeOnComplete: 100,
      removeOnFail: false
    }
  });

  return {
    enqueueNormalizedEvent(job: WorkflowJobPayload) {
      return queue.add(PROCESS_NORMALIZED_EVENT_JOB, job, {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 30000
        },
        removeOnComplete: 100,
        removeOnFail: false
      });
    }
  };
}
