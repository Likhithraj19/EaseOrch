import { runWorkflowActions } from "../workflow-engine";
import { WorkflowActionHandler, WorkflowActionType } from "../action.types";

function createHandler(actionType: WorkflowActionType, calls: string[]): WorkflowActionHandler {
  return {
    actionType,
    run: jest.fn(async () => {
      calls.push(actionType);
      return {
        actionType,
        status: "succeeded" as const,
        required: actionType === "SLACK_NOTIFY"
      };
    })
  };
}

describe("runWorkflowActions", () => {
  test("runs PR opened actions in order", async () => {
    const calls: string[] = [];

    const result = await runWorkflowActions({
      event: {
        eventType: "PR_OPENED",
        jiraIssueKey: "PROJ-123"
      },
      config: {
        jiraTransitionOnMerge: null,
        slackEnabled: true
      },
      handlers: {
        JIRA_COMMENT: createHandler("JIRA_COMMENT", calls),
        JIRA_TRANSITION: createHandler("JIRA_TRANSITION", calls),
        SLACK_NOTIFY: createHandler("SLACK_NOTIFY", calls)
      }
    });

    expect(calls).toEqual(["JIRA_COMMENT", "SLACK_NOTIFY"]);
    expect(result.status).toBe("succeeded");
  });

  test("runs PR merged actions in order with configured transition", async () => {
    const calls: string[] = [];

    const result = await runWorkflowActions({
      event: {
        eventType: "PR_MERGED",
        jiraIssueKey: "PROJ-123"
      },
      config: {
        jiraTransitionOnMerge: "QA",
        slackEnabled: true
      },
      handlers: {
        JIRA_COMMENT: createHandler("JIRA_COMMENT", calls),
        JIRA_TRANSITION: createHandler("JIRA_TRANSITION", calls),
        SLACK_NOTIFY: createHandler("SLACK_NOTIFY", calls)
      }
    });

    expect(calls).toEqual(["JIRA_COMMENT", "JIRA_TRANSITION", "SLACK_NOTIFY"]);
    expect(result.status).toBe("succeeded");
  });

  test("skips Jira actions when no Jira key exists but still notifies Slack", async () => {
    const calls: string[] = [];

    const result = await runWorkflowActions({
      event: {
        eventType: "PR_MERGED",
        jiraIssueKey: null
      },
      config: {
        jiraTransitionOnMerge: "QA",
        slackEnabled: true
      },
      handlers: {
        JIRA_COMMENT: createHandler("JIRA_COMMENT", calls),
        JIRA_TRANSITION: createHandler("JIRA_TRANSITION", calls),
        SLACK_NOTIFY: createHandler("SLACK_NOTIFY", calls)
      }
    });

    expect(calls).toEqual(["SLACK_NOTIFY"]);
    expect(result.status).toBe("completed_with_warning");
    expect(result.actionResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ actionType: "JIRA_COMMENT", status: "skipped" }),
        expect.objectContaining({ actionType: "JIRA_TRANSITION", status: "skipped" })
      ])
    );
  });
});
