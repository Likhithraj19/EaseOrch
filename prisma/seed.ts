import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.workflowConfig.upsert({
    where: {
      id: "default-github-pr-workflow"
    },
    update: {
      enabledEvents: ["PR_OPENED", "PR_MERGED"],
      jiraKeySources: ["branch", "title"],
      jiraTransitionOnMerge: null,
      slackEnabled: true,
      mediaExtractionConfig: {
        enabled: true,
        source: "pr_body"
      }
    },
    create: {
      id: "default-github-pr-workflow",
      name: "GitHub PR to Jira and Slack",
      enabledEvents: ["PR_OPENED", "PR_MERGED"],
      jiraKeySources: ["branch", "title"],
      jiraTransitionOnMerge: null,
      slackEnabled: true,
      mediaExtractionConfig: {
        enabled: true,
        source: "pr_body"
      }
    }
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
