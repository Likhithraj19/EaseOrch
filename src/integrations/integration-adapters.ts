import { JiraAdapter } from "./jira/jira-adapter";
import { MockJiraAdapter } from "./jira/mock-jira-adapter";
import { SlackAdapter } from "./slack/slack-adapter";
import { MockSlackAdapter } from "./slack/mock-slack-adapter";

export type AdapterMode = "mock" | "real";

export type CreateAdaptersInput = {
  jiraMode: AdapterMode;
  slackMode: AdapterMode;
};

export type IntegrationAdapters = {
  jira: JiraAdapter;
  slack: SlackAdapter;
};

export function createAdapters({ jiraMode, slackMode }: CreateAdaptersInput): IntegrationAdapters {
  if (jiraMode === "real") {
    throw new Error("Real Jira adapter is not implemented yet");
  }
  if (slackMode === "real") {
    throw new Error("Real Slack adapter is not implemented yet");
  }
  return {
    jira: new MockJiraAdapter({ mode: "always-success" }),
    slack: new MockSlackAdapter({ mode: "always-success" })
  };
}
