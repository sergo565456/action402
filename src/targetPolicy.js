import { config } from "./config.js";
import { ApiError } from "./errors.js";

const STRICT_BLOCKLIST = [
  "metadata",
  "metadata.google.internal",
  "instance-data",
  "169.254.169.254"
];

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

export function effectiveTargetPolicy(policy = config) {
  const preset = policy.targetPolicyPreset || "open";
  const targetBlocklist = [
    ...new Set([
      ...(policy.targetBlocklist || []),
      ...(preset === "strict" ? STRICT_BLOCKLIST : [])
    ])
  ];
  const requireTargetAllowlist =
    Boolean(policy.requireTargetAllowlist) || preset === "allowlist" || preset === "strict";

  return {
    ...policy,
    targetPolicyPreset: preset,
    targetAllowlist: policy.targetAllowlist || [],
    targetBlocklist,
    requireTargetAllowlist
  };
}

export function assertTargetPolicy(hostname, policy = config) {
  const effectivePolicy = effectiveTargetPolicy(policy);

  if (matchesAny(effectivePolicy.targetBlocklist || [], hostname)) {
    throw new ApiError(400, "target_blocked", "target hostname is blocked by policy.");
  }

  if (effectivePolicy.requireTargetAllowlist && !matchesAny(effectivePolicy.targetAllowlist || [], hostname)) {
    throw new ApiError(400, "target_not_allowed", "target hostname is not in TARGET_ALLOWLIST.");
  }
}
