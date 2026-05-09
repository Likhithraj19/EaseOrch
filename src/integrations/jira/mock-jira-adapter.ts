import { MockBehaviorConfig, throwIfConfiguredToFail } from "../mock-behavior";
import { JiraAdapter, JiraExternalResult } from "./jira-adapter";

export type MockJiraConfig = MockBehaviorConfig;

export class MockJiraAdapter implements JiraAdapter {
  private commentCalls = 0;
  private transitionCalls = 0;

  constructor(private readonly config: MockJiraConfig) {}

  async addComment(_issueKey: string, _body: string): Promise<JiraExternalResult> {
    this.commentCalls += 1;
    throwIfConfiguredToFail(this.config, this.commentCalls, "MockJiraAdapter");
    return { externalId: `mock-jira-comment-${this.commentCalls}` };
  }

  async transitionIssue(_issueKey: string, _transitionName: string): Promise<JiraExternalResult> {
    this.transitionCalls += 1;
    throwIfConfiguredToFail(this.config, this.transitionCalls, "MockJiraAdapter");
    return { externalId: `mock-jira-transition-${this.transitionCalls}` };
  }
}
