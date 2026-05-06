import { PrismaClient } from "@prisma/client";
import { env } from "./config/env";
import { createApp } from "./http/create-app";
import { createRedisConnection } from "./queue/redis";
import { createWorkflowQueue } from "./queue/workflow.queue";
import { logger } from "./shared/logger";

if (require.main === module) {
  const prisma = new PrismaClient();
  const queue = createWorkflowQueue({
    connection: createRedisConnection(env.REDIS_URL)
  });
  const app = createApp({
    prisma,
    env,
    queue
  });

  app.listen(env.PORT, () => {
    logger.info("EaseOrch API listening", { port: env.PORT });
  });
}
