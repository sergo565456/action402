export function runExecutionAnalyst({ action, policyReport, buyerPolicy }) {
  const blockingIssues = [];
  const warnings = [];
  const reasons = [];
  const idempotencyKeyPresent = Boolean(action?.idempotencyKey);

  if (buyerPolicy.requireIdempotencyKey !== false && !idempotencyKeyPresent) {
    warnings.push("No idempotencyKey supplied; buyer should use one for paid retries and agent restarts.");
  }

  if (policyReport?.normalized?.retry?.attempts > 1) {
    reasons.push(`Retry policy allows ${policyReport.normalized.retry.attempts} attempt(s).`);
  }

  if (!policyReport?.allowed) {
    blockingIssues.push("Execution is not ready because policy preflight did not pass.");
  }

  return {
    id: "executionAnalyst",
    title: "Execution Analyst",
    stance: blockingIssues.length > 0 ? "block" : warnings.length > 0 ? "warn" : "approve",
    idempotencyKeyPresent,
    retry: policyReport?.normalized?.retry || null,
    timeoutMs: policyReport?.normalized?.timeoutMs || null,
    forwardedHeaderCount: policyReport?.normalized?.forwardedHeaderCount ?? null,
    bodyPresent: policyReport?.normalized?.bodyPresent ?? action?.body !== undefined,
    blockingIssues,
    warnings,
    reasons: reasons.length ? reasons : ["Execution shape is bounded and ready for the paid endpoint."]
  };
}
