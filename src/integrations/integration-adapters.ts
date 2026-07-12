import { JiraAdapter } from "./jira/jira-adapter";
import { MockJiraAdapter } from "./jira/mock-jira-adapter";
import { RealJiraAdapter } from "./jira/real-jira-adapter";
import { SlackAdapter } from "./slack/slack-adapter";
import { MockSlackAdapter } from "./slack/mock-slack-adapter";
import { RealSlackAdapter } from "./slack/real-slack-adapter";

export type AdapterMode = "mock" | "real";

export type AdapterCredentials = {
  jira?: { baseUrl?: string; email?: string; apiToken?: string };
  slack?: { botToken?: string };
};

export type CreateAdaptersInput = {
  jiraMode: AdapterMode;
  slackMode: AdapterMode;
  credentials?: AdapterCredentials;
};

export type IntegrationAdapters = {
  jira: JiraAdapter;
  slack: SlackAdapter;
};

export function createAdapters({
  jiraMode,
  slackMode,
  credentials
}: CreateAdaptersInput): IntegrationAdapters {
  return {
    jira:
      jiraMode === "real"
        ? buildRealJira(credentials?.jira)
        : new MockJiraAdapter({ mode: "always-success" }),
    slack:
      slackMode === "real"
        ? buildRealSlack(credentials?.slack)
        : new MockSlackAdapter({ mode: "always-success" })
  };
}

function buildRealJira(cfg?: AdapterCredentials["jira"]): JiraAdapter {
  const missing: string[] = [];
  if (!cfg?.baseUrl) missing.push("JIRA_BASE_URL");
  if (!cfg?.email) missing.push("JIRA_EMAIL");
  if (!cfg?.apiToken) missing.push("JIRA_API_TOKEN");
  if (missing.length > 0) {
    throw new Error(
      `Jira real adapter requires: ${missing.join(", ")}`
    );
  }
  return new RealJiraAdapter({
    baseUrl: cfg!.baseUrl!,
    email: cfg!.email!,
    apiToken: cfg!.apiToken!
  });
}

function buildRealSlack(cfg?: AdapterCredentials["slack"]): SlackAdapter {
  if (!cfg?.botToken) {
    throw new Error("Slack real adapter requires: SLACK_BOT_TOKEN");
  }
  return new RealSlackAdapter({ botToken: cfg.botToken });
}
