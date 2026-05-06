import { WorkflowActionResult, WorkflowExecutionStatus } from "./action.types";

export function resolveExecutionStatus(actionResults: WorkflowActionResult[]): WorkflowExecutionStatus {
  const succeededCount = actionResults.filter((result) => result.status === "succeeded").length;
  const hasFailedOrSkipped = actionResults.some((result) => result.status === "failed" || result.status === "skipped");
  const hasRequiredFailure = actionResults.some((result) => result.required && result.status === "failed");

  if (hasRequiredFailure || succeededCount === 0) {
    return "failed";
  }

  if (hasFailedOrSkipped) {
    return "completed_with_warning";
  }

  return "succeeded";
}
