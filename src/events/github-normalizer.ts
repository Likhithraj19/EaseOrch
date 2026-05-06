import { GitHubPullRequestPayload } from "../github/github-webhook.types";
import { extractMediaLinks } from "./media-link-extractor";
import { NormalizedPullRequestEvent } from "./normalized-event.types";

type NormalizeGitHubWebhookEventInput = {
  providerEventRef: string;
  eventName: string;
  payload: GitHubPullRequestPayload;
};

export function normalizeGitHubWebhookEvent({
  providerEventRef,
  eventName,
  payload
}: NormalizeGitHubWebhookEventInput): NormalizedPullRequestEvent | null {
  if (eventName !== "pull_request" || !payload.pull_request || !payload.repository || !payload.action) {
    return null;
  }

  const isOpened = payload.action === "opened";
  const isMerged = payload.action === "closed" && payload.pull_request.merged === true;

  if (!isOpened && !isMerged) {
    return null;
  }

  return {
    providerEventRef,
    eventType: isOpened ? "PR_OPENED" : "PR_MERGED",
    repoOwner: payload.repository.owner.login,
    repoName: payload.repository.name,
    repoFullName: payload.repository.full_name,
    prNumber: payload.pull_request.number,
    prTitle: payload.pull_request.title,
    prAuthor: payload.pull_request.user.login,
    prBranch: payload.pull_request.head.ref,
    prUrl: payload.pull_request.html_url,
    mergedAt: payload.pull_request.merged_at ? new Date(payload.pull_request.merged_at) : null,
    mediaLinks: extractMediaLinks(payload.pull_request.body)
  };
}
