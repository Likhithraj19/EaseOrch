import { extractJiraIssueKey } from "../jira-key-extractor";

describe("extractJiraIssueKey", () => {
  test("finds the key from the branch name", () => {
    expect(
      extractJiraIssueKey({
        branchName: "feature/PROJ-123-add-login",
        title: "[PROJ-999] Different ticket"
      })
    ).toBe("PROJ-123");
  });

  test("falls back to the PR title", () => {
    expect(
      extractJiraIssueKey({
        branchName: "feature/add-login",
        title: "[PROJ-456] Add login"
      })
    ).toBe("PROJ-456");
  });

  test("uses the first key when multiple keys exist", () => {
    expect(
      extractJiraIssueKey({
        branchName: "feature/PROJ-111-PROJ-222",
        title: "[PROJ-333] Add login"
      })
    ).toBe("PROJ-111");
  });

  test("returns null when no key exists", () => {
    expect(
      extractJiraIssueKey({
        branchName: "feature/add-login",
        title: "Add login"
      })
    ).toBeNull();
  });
});
