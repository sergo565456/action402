import { config } from "./config.js";
import { ApiError } from "./errors.js";
import { logEvent, recordMetric } from "./observability.js";

const targetWindows = new Map();

function quotaKey(hostname) {
  return String(hostname || "").toLowerCase();
}

export function assertTargetQuota(hostname, quota = config, now = Date.now(), context = {}) {
  if (!quota.targetQuotaEnabled) return;

  const key = quotaKey(hostname);
  if (!key) return;

  const windowMs = quota.targetQuotaWindowMs;
  const maxRequests = quota.targetQuotaMaxRequests;
  const current = targetWindows.get(key);
  const windowExpired = !current || now - current.startedAt >= windowMs;
  const next = windowExpired ? { startedAt: now, count: 0 } : current;

  if (next.count >= maxRequests) {
    recordMetric("targetQuotaExceeded");
    logEvent("warn", "target_quota.exceeded", {
      requestId: context.requestId,
      targetHost: key,
      windowMs,
      maxRequests,
      retryAfterMs: Math.max(0, next.startedAt + windowMs - now)
    });
    throw new ApiError(429, "target_quota_exceeded", "target quota exceeded.", {
      targetHost: key,
      windowMs,
      maxRequests,
      retryAfterMs: Math.max(0, next.startedAt + windowMs - now)
    });
  }

  next.count += 1;
  targetWindows.set(key, next);
}

export function targetQuotaStats(quota = config, now = Date.now()) {
  let activeTargets = 0;
  for (const window of targetWindows.values()) {
    if (now - window.startedAt < quota.targetQuotaWindowMs) {
      activeTargets += 1;
    }
  }

  return {
    enabled: quota.targetQuotaEnabled,
    windowMs: quota.targetQuotaWindowMs,
    maxRequests: quota.targetQuotaMaxRequests,
    activeTargets
  };
}

export function resetTargetQuotasForTests() {
  targetWindows.clear();
}
