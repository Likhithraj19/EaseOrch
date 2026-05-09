import { createAdapters } from "../integration-adapters";
import { MockJiraAdapter } from "../jira/mock-jira-adapter";
import { MockSlackAdapter } from "../slack/mock-slack-adapter";

describe("createAdapters", () => {
  test("returns mock adapters when both modes are mock", () => {
    const adapters = createAdapters({ jiraMode: "mock", slackMode: "mock" });
    expect(adapters.jira).toBeInstanceOf(MockJiraAdapter);
    expect(adapters.slack).toBeInstanceOf(MockSlackAdapter);
  });

  test("throws when jiraMode is real", () => {
    expect(() =>
      createAdapters({ jiraMode: "real", slackMode: "mock" })
    ).toThrow(/Real Jira adapter is not implemented/);
  });

  test("throws when slackMode is real", () => {
    expect(() =>
      createAdapters({ jiraMode: "mock", slackMode: "real" })
    ).toThrow(/Real Slack adapter is not implemented/);
  });
});
