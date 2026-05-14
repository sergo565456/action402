import { config } from "./config.js";
import { ApiError } from "./errors.js";

export function domainMatches(pattern, hostname) {
  const normalizedPattern = String(pattern || "").toLowerCase();
  const normalizedHostname = String(hostname || "").toLowerCase();

  if (!normalizedPattern || !normalizedHostname) return false;
  if (normalizedPattern === normalizedHostname) return true;

  if (normalizedPattern.startsWith("*.")) {
    const suffix = normalizedPattern.slice(1);
    return normalizedHostname.endsWith(suffix) && normalizedHostname.length > suffix.length;
  }

  return false;
}

function matchesAny(patterns, hostname) {
  return patterns.some((pattern) => domainMatches(pattern, hostname));
}

export function assertTargetPolicy(hostname, policy = config) {
  if (matchesAny(policy.targetBlocklist || [], hostname)) {
    throw new ApiError(400, "target_blocked", "target hostname is blocked by policy.");
  }

  if (policy.requireTargetAllowlist && !matchesAny(policy.targetAllowlist || [], hostname)) {
    throw new ApiError(400, "target_not_allowed", "target hostname is not in TARGET_ALLOWLIST.");
  }
}
