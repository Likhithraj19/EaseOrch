import { MockJiraAdapter } from "../jira/mock-jira-adapter";
import { RetryableError, NonRetryableError } from "../errors";

describe("MockJiraAdapter", () => {
  test("always-success returns deterministic external ids", async () => {
    const jira = new MockJiraAdapter({ mode: "always-success" });
    const c1 = await jira.addComment("PROJ-1", "hello");
    const c2 = await jira.addComment("PROJ-1", "hello again");
    const t1 = await jira.transitionIssue("PROJ-1", "QA");
    expect(c1.externalId).toBe("mock-jira-comment-1");
    expect(c2.externalId).toBe("mock-jira-comment-2");
    expect(t1.externalId).toBe("mock-jira-transition-1");
  });

  test("always-fail throws RetryableError when retryableFailure is true", async () => {
    const jira = new MockJiraAdapter({ mode: "always-fail", retryableFailure: true });
    await expect(jira.addComment("PROJ-1", "x")).rejects.toBeInstanceOf(RetryableError);
    await expect(jira.transitionIssue("PROJ-1", "QA")).rejects.toBeInstanceOf(RetryableError);
  });

  test("always-fail throws NonRetryableError when retryableFailure is false", async () => {
    const jira = new MockJiraAdapter({ mode: "always-fail", retryableFailure: false });
    await expect(jira.addComment("PROJ-1", "x")).rejects.toBeInstanceOf(NonRetryableError);
  });

  test("fail-then-succeed throws on first call, succeeds afterwards", async () => {
    const jira = new MockJiraAdapter({ mode: "fail-then-succeed", retryableFailure: true });
    await expect(jira.addComment("PROJ-1", "x")).rejects.toBeInstanceOf(RetryableError);
    const ok = await jira.addComment("PROJ-1", "x");
    expect(ok.externalId).toBe("mock-jira-comment-2");
  });
});
