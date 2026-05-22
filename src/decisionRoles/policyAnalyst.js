import { ApiError } from "../errors.js";
import { preflightWebhookAction } from "../webhook.js";

export async function runPolicyAnalyst({ action }) {
  try {
    const preflight = await preflightWebhookAction(action);
    return {
      id: "policyAnalyst",
      title: "Policy Analyst",
      stance: preflight.allowed ? (preflight.warnings?.length ? "warn" : "approve") : "block",
      allowed: preflight.allowed,
      normalized: preflight.normalized,
      target: {
        protocol: preflight.target.protocol,
        hostname: "redacted",
        origin: "redacted",
        pathnamePresent: Boolean(preflight.target.pathname && preflight.target.pathname !== "/")
      },
      policy: preflight.policy,
      blockingIssues: preflight.allowed ? [] : [preflight.error?.message || "Policy check failed."],
      warnings: preflight.warnings || [],
      reasons: ["Free policy preflight completed without executing the target."]
    };
  } catch (error) {
    const apiError = error instanceof ApiError ? error : new ApiError(400, "policy_check_failed", error.message);
    return {
      id: "policyAnalyst",
      title: "Policy Analyst",
      stance: "block",
      allowed: false,
      error: {
        code: apiError.code,
        message: apiError.message
      },
      blockingIssues: [apiError.message],
      warnings: [],
      reasons: ["The request is not safe to pay for until policy issues are fixed."]
    };
  }
}
