type LogLevel = "info" | "warn" | "error";

type LogMetadata = Record<string, unknown>;

const SENSITIVE_KEYS = ["authorization", "token", "secret", "password", "apiKey", "api_key"];

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
        key,
        SENSITIVE_KEYS.some((sensitiveKey) => key.toLowerCase().includes(sensitiveKey.toLowerCase()))
          ? "[REDACTED]"
          : redactValue(nestedValue)
      ])
    );
  }

  return value;
}

function writeLog(level: LogLevel, message: string, metadata: LogMetadata = {}): void {
  const entry = {
    level,
    message,
    metadata: redactValue(metadata),
    timestamp: new Date().toISOString()
  };

  const output = JSON.stringify(entry);

  if (level === "error") {
    console.error(output);
    return;
  }

  if (level === "warn") {
    console.warn(output);
    return;
  }

  console.info(output);
}

export const logger = {
  info: (message: string, metadata?: LogMetadata) => writeLog("info", message, metadata),
  warn: (message: string, metadata?: LogMetadata) => writeLog("warn", message, metadata),
  error: (message: string, metadata?: LogMetadata) => writeLog("error", message, metadata)
};
