import { env } from "./config/env";
import { logger } from "./shared/logger";

export function startWorker(): void {
  logger.info("EaseOrch worker starting", {
    redisUrl: env.REDIS_URL,
    mode: {
      jira: env.JIRA_ADAPTER_MODE,
      slack: env.SLACK_ADAPTER_MODE
    }
  });
}

if (require.main === module) {
  startWorker();
}
