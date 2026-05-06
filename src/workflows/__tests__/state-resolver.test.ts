import { resolveExecutionStatus } from "../state-resolver";

describe("resolveExecutionStatus", () => {
  test("returns succeeded when all enabled actions succeeded", () => {
    expect(
      resolveExecutionStatus([
        { actionType: "JIRA_COMMENT", status: "succeeded", required: false },
        { actionType: "SLACK_NOTIFY", status: "succeeded", required: true }
      ])
    ).toBe("succeeded");
  });

  test("returns completed_with_warning when Jira is skipped but Slack succeeded", () => {
    expect(
      resolveExecutionStatus([
        { actionType: "JIRA_COMMENT", status: "skipped", required: false },
        { actionType: "SLACK_NOTIFY", status: "succeeded", required: true }
      ])
    ).toBe("completed_with_warning");
  });

  test("returns completed_with_warning when Jira failed but Slack succeeded", () => {
    expect(
      resolveExecutionStatus([
        { actionType: "JIRA_COMMENT", status: "failed", required: false },
        { actionType: "SLACK_NOTIFY", status: "succeeded", required: true }
      ])
    ).toBe("completed_with_warning");
  });

  test("returns failed when all actions failed", () => {
    expect(
      resolveExecutionStatus([
        { actionType: "JIRA_COMMENT", status: "failed", required: false },
        { actionType: "SLACK_NOTIFY", status: "failed", required: true }
      ])
    ).toBe("failed");
  });

  test("returns failed when a required action failed", () => {
    expect(
      resolveExecutionStatus([
        { actionType: "JIRA_COMMENT", status: "succeeded", required: false },
        { actionType: "SLACK_NOTIFY", status: "failed", required: true }
      ])
    ).toBe("failed");
  });
});
