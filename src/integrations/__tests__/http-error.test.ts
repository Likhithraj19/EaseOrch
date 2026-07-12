import { classifyHttpError } from "../http-error";
import { RetryableError, NonRetryableError } from "../errors";

describe("classifyHttpError", () => {
  it.each([408, 429, 500, 502, 503, 504])(
    "maps %i to RetryableError",
    (status) => {
      expect(classifyHttpError(status, "ctx")).toBeInstanceOf(RetryableError);
    }
  );

  it.each([400, 401, 403, 404, 405, 422])(
    "maps %i to NonRetryableError",
    (status) => {
      expect(classifyHttpError(status, "ctx")).toBeInstanceOf(NonRetryableError);
    }
  );

  it("includes context, status, and body in the message", () => {
    const err = classifyHttpError(404, "Jira addComment PROJ-1", "issue missing");
    expect(err.message).toContain("Jira addComment PROJ-1");
    expect(err.message).toContain("404");
    expect(err.message).toContain("issue missing");
  });
});
