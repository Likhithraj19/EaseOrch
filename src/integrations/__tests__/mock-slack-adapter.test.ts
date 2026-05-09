import { MockSlackAdapter } from "../slack/mock-slack-adapter";
import { RetryableError, NonRetryableError } from "../errors";

describe("MockSlackAdapter", () => {
  test("always-success returns deterministic external ids", async () => {
    const slack = new MockSlackAdapter({ mode: "always-success" });
    const r1 = await slack.sendMessage("#general", "hi");
    const r2 = await slack.sendMessage("#general", "hi again");
    expect(r1.externalId).toBe("mock-slack-message-1");
    expect(r2.externalId).toBe("mock-slack-message-2");
  });

  test("always-fail throws RetryableError when retryableFailure is true", async () => {
    const slack = new MockSlackAdapter({ mode: "always-fail", retryableFailure: true });
    await expect(slack.sendMessage("#general", "x")).rejects.toBeInstanceOf(RetryableError);
  });

  test("always-fail throws NonRetryableError when retryableFailure is false", async () => {
    const slack = new MockSlackAdapter({ mode: "always-fail", retryableFailure: false });
    await expect(slack.sendMessage("#general", "x")).rejects.toBeInstanceOf(NonRetryableError);
  });

  test("fail-then-succeed throws on first call, succeeds after", async () => {
    const slack = new MockSlackAdapter({ mode: "fail-then-succeed", retryableFailure: true });
    await expect(slack.sendMessage("#general", "x")).rejects.toBeInstanceOf(RetryableError);
    const ok = await slack.sendMessage("#general", "x");
    expect(ok.externalId).toBe("mock-slack-message-2");
  });
});
