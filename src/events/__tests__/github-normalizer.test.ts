import { normalizeGitHubWebhookEvent } from "../github-normalizer";
import { GitHubPullRequestPayload } from "../../github/github-webhook.types";

function createPullRequestPayload(
  overrides: Partial<GitHubPullRequestPayload> = {}
): GitHubPullRequestPayload {
  return {
    action: "opened",
    pull_request: {
      number: 42,
      title: "[PROJ-123] Add login flow",
      html_url: "https://github.com/acme/easeorch/pull/42",
      merged: false,
      merged_at: null,
      body: "Preview: https://github.com/user-attachments/assets/demo.mp4",
      head: {
        ref: "feature/PROJ-123-add-login"
      },
      user: {
        login: "likhithraj"
      }
    },
    repository: {
      name: "easeorch",
      full_name: "acme/easeorch",
      owner: {
        login: "acme"
      }
    },
    ...overrides
  };
}

describe("normalizeGitHubWebhookEvent", () => {
  test("normalizes pull_request.opened to PR_OPENED", () => {
    expect(
      normalizeGitHubWebhookEvent({
        providerEventRef: "delivery-1",
        eventName: "pull_request",
        payload: createPullRequestPayload()
      })
    ).toEqual(
      expect.objectContaining({
        eventType: "PR_OPENED",
        providerEventRef: "delivery-1",
        repoOwner: "acme",
        repoName: "easeorch",
        repoFullName: "acme/easeorch",
        prNumber: 42,
        prTitle: "[PROJ-123] Add login flow",
        prAuthor: "likhithraj",
        prBranch: "feature/PROJ-123-add-login",
        prUrl: "https://github.com/acme/easeorch/pull/42",
        mergedAt: null,
        mediaLinks: ["https://github.com/user-attachments/assets/demo.mp4"]
      })
    );
  });

  test("normalizes pull_request.closed with merged true to PR_MERGED", () => {
    const mergedAt = "2026-05-06T08:00:00.000Z";

    const result = normalizeGitHubWebhookEvent({
      providerEventRef: "delivery-2",
      eventName: "pull_request",
      payload: createPullRequestPayload({
        action: "closed",
        pull_request: {
          ...createPullRequestPayload().pull_request!,
          merged: true,
          merged_at: mergedAt
        }
      })
    });

    expect(result).toEqual(
      expect.objectContaining({
        eventType: "PR_MERGED",
        mergedAt: new Date(mergedAt)
      })
    );
  });

  test("ignores pull_request.closed when not merged", () => {
    expect(
      normalizeGitHubWebhookEvent({
        providerEventRef: "delivery-3",
        eventName: "pull_request",
        payload: createPullRequestPayload({
          action: "closed",
          pull_request: {
            ...createPullRequestPayload().pull_request!,
            merged: false,
            merged_at: null
          }
        })
      })
    ).toBeNull();
  });

  test("ignores unsupported events", () => {
    expect(
      normalizeGitHubWebhookEvent({
        providerEventRef: "delivery-4",
        eventName: "issues",
        payload: createPullRequestPayload()
      })
    ).toBeNull();
  });
});
