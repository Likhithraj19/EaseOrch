import { createAdapters } from "../integration-adapters";
import { MockJiraAdapter } from "../jira/mock-jira-adapter";
import { MockSlackAdapter } from "../slack/mock-slack-adapter";
import { RealJiraAdapter } from "../jira/real-jira-adapter";
import { RealSlackAdapter } from "../slack/real-slack-adapter";

const jiraCreds = {
  baseUrl: "https://acme.atlassian.net",
  email: "u@acme.com",
  apiToken: "tok"
};
const slackCreds = { botToken: "xoxb-1" };

describe("createAdapters", () => {
  test("returns mock adapters when both modes are mock", () => {
    const adapters = createAdapters({ jiraMode: "mock", slackMode: "mock" });
    expect(adapters.jira).toBeInstanceOf(MockJiraAdapter);
    expect(adapters.slack).toBeInstanceOf(MockSlackAdapter);
  });

  test("builds real adapters when modes are real and creds present", () => {
    const adapters = createAdapters({
      jiraMode: "real",
      slackMode: "real",
      credentials: { jira: jiraCreds, slack: slackCreds }
    });
    expect(adapters.jira).toBeInstanceOf(RealJiraAdapter);
    expect(adapters.slack).toBeInstanceOf(RealSlackAdapter);
  });

  test("supports mixed mode: Jira real, Slack mock", () => {
    const adapters = createAdapters({
      jiraMode: "real",
      slackMode: "mock",
      credentials: { jira: jiraCreds }
    });
    expect(adapters.jira).toBeInstanceOf(RealJiraAdapter);
    expect(adapters.slack).toBeInstanceOf(MockSlackAdapter);
  });

  test("throws listing missing Jira creds when jiraMode is real without config", () => {
    expect(() => createAdapters({ jiraMode: "real", slackMode: "mock" })).toThrow(
      /JIRA_BASE_URL/
    );
  });

  test("throws listing missing Slack creds when slackMode is real without config", () => {
    expect(() =>
      createAdapters({ jiraMode: "mock", slackMode: "real" })
    ).toThrow(/SLACK_BOT_TOKEN/);
  });
});
