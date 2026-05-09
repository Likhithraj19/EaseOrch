export type JiraExternalResult = {
  externalId: string;
};

export interface JiraAdapter {
  addComment(issueKey: string, body: string): Promise<JiraExternalResult>;
  transitionIssue(issueKey: string, transitionName: string): Promise<JiraExternalResult>;
}
