-- CreateEnum
CREATE TYPE "NormalizedEventType" AS ENUM ('PR_OPENED', 'PR_MERGED');

-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('pending', 'running', 'succeeded', 'completed_with_warning', 'failed', 'skipped_duplicate', 'skipped_no_matching_workflow');

-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('running', 'succeeded', 'failed');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('JIRA_COMMENT', 'JIRA_TRANSITION', 'SLACK_NOTIFY');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('succeeded', 'failed', 'skipped');

-- CreateEnum
CREATE TYPE "LogLevel" AS ENUM ('info', 'warn', 'error');

-- CreateTable
CREATE TABLE "WorkflowConfig" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabledEvents" JSONB NOT NULL,
    "jiraKeySources" JSONB NOT NULL,
    "jiraTransitionOnMerge" TEXT,
    "slackEnabled" BOOLEAN NOT NULL DEFAULT true,
    "mediaExtractionConfig" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "eventAction" TEXT,
    "rawPayload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NormalizedEvent" (
    "id" TEXT NOT NULL,
    "webhookEventId" TEXT NOT NULL,
    "providerEventRef" TEXT NOT NULL,
    "eventType" "NormalizedEventType" NOT NULL,
    "repoOwner" TEXT NOT NULL,
    "repoName" TEXT NOT NULL,
    "repoFullName" TEXT NOT NULL,
    "prNumber" INTEGER NOT NULL,
    "prTitle" TEXT NOT NULL,
    "prAuthor" TEXT NOT NULL,
    "prBranch" TEXT NOT NULL,
    "prUrl" TEXT NOT NULL,
    "mergedAt" TIMESTAMP(3),
    "mediaLinks" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NormalizedEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowExecution" (
    "id" TEXT NOT NULL,
    "workflowConfigId" TEXT NOT NULL,
    "normalizedEventId" TEXT NOT NULL,
    "status" "ExecutionStatus" NOT NULL DEFAULT 'pending',
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowAttempt" (
    "id" TEXT NOT NULL,
    "workflowExecutionId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "status" "AttemptStatus" NOT NULL,
    "errorSummary" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionResult" (
    "id" TEXT NOT NULL,
    "workflowAttemptId" TEXT NOT NULL,
    "actionType" "ActionType" NOT NULL,
    "status" "ActionStatus" NOT NULL,
    "externalId" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecutionLog" (
    "id" TEXT NOT NULL,
    "workflowExecutionId" TEXT NOT NULL,
    "level" "LogLevel" NOT NULL,
    "step" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExecutionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_provider_deliveryId_key" ON "WebhookEvent"("provider", "deliveryId");

-- CreateIndex
CREATE INDEX "NormalizedEvent_eventType_idx" ON "NormalizedEvent"("eventType");

-- CreateIndex
CREATE INDEX "NormalizedEvent_repoOwner_repoName_prNumber_idx" ON "NormalizedEvent"("repoOwner", "repoName", "prNumber");

-- CreateIndex
CREATE INDEX "WorkflowExecution_status_idx" ON "WorkflowExecution"("status");

-- CreateIndex
CREATE INDEX "WorkflowExecution_normalizedEventId_idx" ON "WorkflowExecution"("normalizedEventId");

-- AddForeignKey
ALTER TABLE "NormalizedEvent" ADD CONSTRAINT "NormalizedEvent_webhookEventId_fkey" FOREIGN KEY ("webhookEventId") REFERENCES "WebhookEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowExecution" ADD CONSTRAINT "WorkflowExecution_workflowConfigId_fkey" FOREIGN KEY ("workflowConfigId") REFERENCES "WorkflowConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowExecution" ADD CONSTRAINT "WorkflowExecution_normalizedEventId_fkey" FOREIGN KEY ("normalizedEventId") REFERENCES "NormalizedEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowAttempt" ADD CONSTRAINT "WorkflowAttempt_workflowExecutionId_fkey" FOREIGN KEY ("workflowExecutionId") REFERENCES "WorkflowExecution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionResult" ADD CONSTRAINT "ActionResult_workflowAttemptId_fkey" FOREIGN KEY ("workflowAttemptId") REFERENCES "WorkflowAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionLog" ADD CONSTRAINT "ExecutionLog_workflowExecutionId_fkey" FOREIGN KEY ("workflowExecutionId") REFERENCES "WorkflowExecution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
