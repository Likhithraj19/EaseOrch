import { PrismaClient } from "@prisma/client";
import { env } from "./config/env";
import { createApp } from "./http/create-app";
import { logger } from "./shared/logger";

if (require.main === module) {
  const prisma = new PrismaClient();
  const app = createApp({
    prisma,
    env,
    queue: {
      enqueueNormalizedEvent: async (job) => {
        logger.info("Normalized event queued", job);
      }
    }
  });

  app.listen(env.PORT, () => {
    logger.info("EaseOrch API listening", { port: env.PORT });
  });
}
