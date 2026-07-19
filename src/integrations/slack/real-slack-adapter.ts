import { SlackAdapter, SlackExternalResult } from "./slack-adapter";
import { RetryableError, NonRetryableError } from "../errors";
import { classifyHttpError } from "../http-error";

export type RealSlackConfig = {
  botToken: string;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 10_000;
const SLACK_POST_MESSAGE_URL = "https://slack.com/api/chat.postMessage";
const RETRYABLE_SLACK_ERRORS = new Set(["ratelimited", "rate_limited"]);

export class RealSlackAdapter implements SlackAdapter {
  private readonly authHeader: string;
  private readonly timeoutMs: number;

  constructor(config: RealSlackConfig) {
    this.authHeader = `Bearer ${config.botToken}`;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async sendMessage(
    channel: string,
    message: string
  ): Promise<SlackExternalResult> {
    let res: Response;
    try {
      res = await fetch(SLACK_POST_MESSAGE_URL, {
        method: "POST",
        headers: {
          Authorization: this.authHeader,
          "Content-Type": "application/json; charset=utf-8"
        },
        body: JSON.stringify({ channel, text: message }),
        signal: AbortSignal.timeout(this.timeoutMs)
      });
    } catch (err) {
      throw new RetryableError("Slack request failed", err);
    }

    // Transport-level failure (rare for Slack, but honor it).
    if (!res.ok) {
      throw classifyHttpError(
        res.status,
        "Slack chat.postMessage",
        await res.text()
      );
    }

    // Slack returns HTTP 200 even on logical failure: { ok: false, error }.
    const json = (await res.json()) as {
      ok: boolean;
      ts?: string;
      error?: string;
    };
    if (!json.ok) {
      const error = json.error ?? "unknown_error";
      if (RETRYABLE_SLACK_ERRORS.has(error)) {
        throw new RetryableError(`Slack chat.postMessage failed: ${error}`);
      }
      throw new NonRetryableError(`Slack chat.postMessage failed: ${error}`);
    }

    return { externalId: json.ts ?? "" };
  }
}
