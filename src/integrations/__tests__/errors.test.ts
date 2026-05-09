import { RetryableError, NonRetryableError } from "../errors";

describe("integration errors", () => {
  test("RetryableError carries message and cause", () => {
    const cause = new Error("upstream");
    const err = new RetryableError("network failure", cause);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(RetryableError);
    expect(err.message).toBe("network failure");
    expect(err.cause).toBe(cause);
    expect(err.name).toBe("RetryableError");
  });

  test("NonRetryableError carries message and cause", () => {
    const err = new NonRetryableError("bad request");
    expect(err).toBeInstanceOf(NonRetryableError);
    expect(err).not.toBeInstanceOf(RetryableError);
    expect(err.message).toBe("bad request");
    expect(err.name).toBe("NonRetryableError");
  });
});
