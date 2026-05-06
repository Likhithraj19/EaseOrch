export type NormalizedPullRequestEventType = "PR_OPENED" | "PR_MERGED";

export type NormalizedPullRequestEvent = {
  providerEventRef: string;
  eventType: NormalizedPullRequestEventType;
  repoOwner: string;
  repoName: string;
  repoFullName: string;
  prNumber: number;
  prTitle: string;
  prAuthor: string;
  prBranch: string;
  prUrl: string;
  mergedAt: Date | null;
  mediaLinks: string[];
};
