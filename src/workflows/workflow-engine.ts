import {
  WorkflowActionHandler,
  WorkflowActionResult,
  WorkflowActionType,
  WorkflowExecutionStatus
} from "./action.types";
import { resolveExecutionStatus } from "./state-resolver";

type WorkflowEventInput = {
  eventType: "PR_OPENED" | "PR_MERGED";
  jiraIssueKey: string | null;
};

type WorkflowConfigInput = {
  jiraTransitionOnMerge: string | null;
  slackEnabled: boolean;
};

type WorkflowHandlers = Record<WorkflowActionType, WorkflowActionHandler>;

type RunWorkflowActionsInput = {
  event: WorkflowEventInput;
  config: WorkflowConfigInput;
  handlers: WorkflowHandlers;
};

type RunWorkflowActionsResult = {
  status: WorkflowExecutionStatus;
  actionResults: WorkflowActionResult[];
};

function skippedAction(actionType: WorkflowActionType): WorkflowActionResult {
  return {
    actionType,
    status: "skipped",
    required: false
  };
}

function buildActionOrder({ event, config }: Pick<RunWorkflowActionsInput, "event" | "config">): WorkflowActionType[] {
  const actions: WorkflowActionType[] = [];

  if (event.jiraIssueKey) {
    actions.push("JIRA_COMMENT");

    if (event.eventType === "PR_MERGED" && config.jiraTransitionOnMerge) {
      actions.push("JIRA_TRANSITION");
    }
  }

  if (config.slackEnabled) {
    actions.push("SLACK_NOTIFY");
  }

  return actions;
}

function skippedJiraActions({ event, config }: Pick<RunWorkflowActionsInput, "event" | "config">): WorkflowActionResult[] {
  if (event.jiraIssueKey) {
    return [];
  }

  const skipped = [skippedAction("JIRA_COMMENT")];

  if (event.eventType === "PR_MERGED" && config.jiraTransitionOnMerge) {
    skipped.push(skippedAction("JIRA_TRANSITION"));
  }

  return skipped;
}

export async function runWorkflowActions({
  event,
  config,
  handlers
}: RunWorkflowActionsInput): Promise<RunWorkflowActionsResult> {
  const actionResults: WorkflowActionResult[] = [...skippedJiraActions({ event, config })];
  const actionOrder = buildActionOrder({ event, config });

  for (const actionType of actionOrder) {
    actionResults.push(await handlers[actionType].run());
  }

  return {
    status: resolveExecutionStatus(actionResults),
    actionResults
  };
}
