import { RetryableError, NonRetryableError } from "./errors";

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

/**
 * Maps an HTTP status to the right error class for the retry machinery.
 * Retryable: transient/server errors (408, 429, 5xx). Everything else terminal.
 * Transport/network errors are wrapped as RetryableError by the adapters directly.
 */
export function classifyHttpError(
  status: number,
  context: string,
  bodyText?: string
): RetryableError | NonRetryableError {
  const detail = bodyText
    ? `${context} (HTTP ${status}): ${bodyText}`
    : `${context} (HTTP ${status})`;
  return RETRYABLE_STATUS.has(status)
    ? new RetryableError(detail)
    : new NonRetryableError(detail);
}
