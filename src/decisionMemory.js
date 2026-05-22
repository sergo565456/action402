import { verifyReceipt } from "./receipt.js";

function failureCategory(job) {
  const error = String(job?.error || "").toLowerCase();
  const status = job?.attempts?.at?.(-1)?.status;
  if (status >= 500) return "target_server_error";
  if (status >= 400) return "target_client_error";
  if (error.includes("timeout")) return "timeout";
  if (error) return "target_error";
  return null;
}

export function decisionOutcomePatch({ job, receipt }) {
  const receiptVerified = receipt ? verifyReceipt(receipt) : null;
  const responseStatus = job?.attempts?.at?.(-1)?.status ?? null;
  const outcomeClass =
    job?.status === "succeeded"
      ? "pay_and_execute"
      : job?.status === "failed"
        ? "manual_review"
        : null;
  const recommendationMatchedOutcome = outcomeClass === "pay_and_execute";

  return {
    outcome: {
      status: job?.status || "unknown",
      linkedJobId: job?.id || null,
      linkedReceiptId: job?.receiptId || receipt?.id || null,
      receiptVerified,
      responseStatus,
      attempts: Array.isArray(job?.attempts) ? job.attempts.length : null,
      failureCategory: failureCategory(job),
      outcomeClass,
      recommendationMatchedOutcome,
      updatedAt: new Date().toISOString()
    }
  };
}
