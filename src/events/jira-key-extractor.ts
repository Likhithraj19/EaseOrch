type ExtractJiraIssueKeyInput = {
  branchName: string;
  title: string;
};

const DEFAULT_JIRA_KEY_PATTERN = /[A-Z]+-\d+/g;

function firstJiraKey(value: string): string | null {
  const match = value.match(DEFAULT_JIRA_KEY_PATTERN);
  return match?.[0] ?? null;
}

export function extractJiraIssueKey({ branchName, title }: ExtractJiraIssueKeyInput): string | null {
  return firstJiraKey(branchName) ?? firstJiraKey(title);
}
