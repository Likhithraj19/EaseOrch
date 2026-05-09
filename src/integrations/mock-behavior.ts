import { NonRetryableError, RetryableError } from "./errors";

export type MockBehaviorMode = "always-success" | "always-fail" | "fail-then-succeed";

export type MockBehaviorConfig = {
  mode: MockBehaviorMode;
  retryableFailure?: boolean;
};

export function throwIfConfiguredToFail(
  config: MockBehaviorConfig,
  callIndex: number,
  source: string
): void {
  if (config.mode === "always-success") {
    return;
  }
  const shouldThrow =
    config.mode === "always-fail" ||
    (config.mode === "fail-then-succeed" && callIndex === 1);
  if (!shouldThrow) {
    return;
  }
  const message = `${source} simulated failure (${config.mode})`;
  throw config.retryableFailure
    ? new RetryableError(message)
    : new NonRetryableError(message);
}
