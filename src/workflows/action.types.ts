export type WorkflowActionType = "JIRA_COMMENT" | "JIRA_TRANSITION" | "SLACK_NOTIFY";

export type WorkflowActionStatus = "succeeded" | "failed" | "skipped";

export type WorkflowExecutionStatus = "succeeded" | "completed_with_warning" | "failed";

export type WorkflowActionResult = {
  actionType: WorkflowActionType | string;
  status: WorkflowActionStatus;
  required: boolean;
  externalId?: string;
  errorMessage?: string;
};

export type WorkflowActionHandler = {
  actionType: WorkflowActionType | string;
  run: () => Promise<WorkflowActionResult>;
};
