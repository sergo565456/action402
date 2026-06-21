import { config } from "./config.js";
import { verifyReceipt } from "./receipt.js";
import { publicFailureSummary, publicProofSummary, redactionPolicy } from "./publicSummaries.js";

const ACTIVITY_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_PUBLIC_PROOFS = 6;
const MAX_PUBLIC_FAILURES = 6;
const MAX_ACTIVITY_HISTORY_DAYS = 30;

function absoluteLink(path) {
  return `${String(config.publicBaseUrl || "").replace(/\/+$/, "")}${path}`;
}

function hoursSince(value) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, Math.round(((Date.now() - timestamp) / (60 * 60 * 1000)) * 10) / 10);
}

function scoreRecency(hours) {
  if (hours === null) return "no_recent_proof";
  if (hours <= 24) return "fresh";
  if (hours <= 72) return "warm";
  return "stale";
}

function compactStats(stats) {
  const recentSuccessRate = stats.recentTotal > 0 ? stats.recentSucceeded / stats.recentTotal : null;
  const lifetimeSuccessRate = stats.total > 0 ? stats.succeeded / stats.total : null;

  return {
    total: stats.total,
    succeeded: stats.succeeded,
    failed: stats.failed,
    recentWindowMs: ACTIVITY_WINDOW_MS,
    recentTotal: stats.recentTotal,
    recentSucceeded: stats.recentSucceeded,
    recentFailed: stats.recentFailed,
    recentSuccessRate,
    lifetimeSuccessRate,
    lastUpdatedAt: stats.lastUpdatedAt || null
  };
}

function failureBreakdown(failures) {
  const counts = new Map();
  for (const failure of failures) {
    const key = failure.errorCategory || "execution_failed";
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([category, count]) => ({ category, count }));
}

function clampHistoryDays(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 7;
  return Math.max(1, Math.min(MAX_ACTIVITY_HISTORY_DAYS, Math.floor(number)));
}

function utcDateKey(value) {
  const date = value ? new Date(value) : new Date();
  if (!Number.isFinite(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function emptyHistoryBucket(date) {
  return {
    date,
    total: 0,
    succeeded: 0,
    failed: 0,
    running: 0,
    verifiedProofs: 0,
    successRate: null,
    latestVerifiedProofAt: null,
    failureCategories: []
  };
}

function incrementCategory(bucket, category) {
  const existing = bucket.failureCategories.find((item) => item.category === category);
  if (existing) {
    existing.count += 1;
    return;
  }
  bucket.failureCategories.push({ category, count: 1 });
}

function activityStatus({ stats, verifiedProofs, latestVerifiedProofAt }) {
  const latestProofHoursAgo = hoursSince(latestVerifiedProofAt);
  const recency = scoreRecency(latestProofHoursAgo);
  const recentFailureRate = stats.recentTotal > 0 ? stats.recentFailed / stats.recentTotal : 0;

  let status = "ready";
  if (recentFailureRate > 0.2 || recency === "stale" || recency === "no_recent_proof") status = "attention";
  if (stats.total === 0 || verifiedProofs.length === 0) status = "warming_up";

  return {
    status,
    recency,
    latestProofHoursAgo,
    recentFailureRate
  };
}

function recommendations({ stats, trust, failures, latestProofHoursAgo }) {
  const items = [];

  if (stats.recentTotal === 0) {
    items.push({
      id: "refresh_execution_volume",
      priority: "high",
      summary:
        "Run a small paid canary or real buyer call so marketplace crawlers and buyer agents see fresh execution volume."
    });
  }

  if (failures.length > 0) {
    items.push({
      id: "inspect_target_errors",
      priority: "medium",
      summary:
        "Recent failures are categorized without payload leakage. Most Action402 failures are downstream target errors, so buyers should verify target readiness before paying."
    });
  }

  if (latestProofHoursAgo !== null && latestProofHoursAgo > 72) {
    items.push({
      id: "refresh_public_proofs",
      priority: "medium",
      summary:
        "Latest verified proof is older than 72 hours. Fresh proofs improve buyer confidence and Bazaar-style discovery ranking."
    });
  }

  if (trust?.trustScore?.score < trust?.trustScore?.maxScore) {
    const weakest = Array.isArray(trust.trustScore.components)
      ? [...trust.trustScore.components].sort((a, b) => a.score / a.maxScore - b.score / b.maxScore)[0]
      : null;
    if (weakest) {
      items.push({
        id: "improve_lowest_trust_component",
        priority: "medium",
        summary: `Lowest trust component is ${weakest.title}: ${weakest.details}`
      });
    }
  }

  if (items.length === 0) {
    items.push({
      id: "keep_current_cadence",
      priority: "low",
      summary:
        "Activity, proof, payment, and monitoring signals are healthy. Keep the paid canary cadence and verify receipts after new deploys."
    });
  }

  return items;
}

export async function buildActivityHistory({ listRecentJobs, getReceipt, days = 7 }) {
  const historyDays = clampHistoryDays(days);
  const now = new Date();
  const buckets = new Map();

  for (let offset = 0; offset < historyDays; offset += 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - offset));
    const key = date.toISOString().slice(0, 10);
    buckets.set(key, emptyHistoryBucket(key));
  }

  const jobs = await listRecentJobs(100);
  let latestVerifiedProofAt = null;

  for (const job of jobs) {
    const key = utcDateKey(job.updatedAt || job.createdAt);
    if (!key || !buckets.has(key)) continue;

    const bucket = buckets.get(key);
    bucket.total += 1;
    if (job.status === "succeeded") bucket.succeeded += 1;
    else if (job.status === "failed") bucket.failed += 1;
    else bucket.running += 1;

    const receipt = job.receiptId ? await getReceipt(job.receiptId) : undefined;
    if (receipt && verifyReceipt(receipt)) {
      bucket.verifiedProofs += 1;
      const proofAt = receipt.updatedAt || receipt.createdAt || job.updatedAt || job.createdAt;
      const parsedProofAt = Date.parse(proofAt || "");
      const bucketLatestAt = Date.parse(bucket.latestVerifiedProofAt || "");
      const globalLatestAt = Date.parse(latestVerifiedProofAt || "");
      if (Number.isFinite(parsedProofAt) && (!Number.isFinite(bucketLatestAt) || parsedProofAt > bucketLatestAt)) {
        bucket.latestVerifiedProofAt = new Date(parsedProofAt).toISOString();
      }
      if (Number.isFinite(parsedProofAt) && (!Number.isFinite(globalLatestAt) || parsedProofAt > globalLatestAt)) {
        latestVerifiedProofAt = new Date(parsedProofAt).toISOString();
      }
    }

    if (job.status === "failed") {
      const failure = publicFailureSummary({ job, receipt, baseUrl: config.publicBaseUrl });
      incrementCategory(bucket, failure.errorCategory || "execution_failed");
    }
  }

  const orderedBuckets = Array.from(buckets.values())
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((bucket) => ({
      ...bucket,
      successRate: bucket.total > 0 ? bucket.succeeded / bucket.total : null,
      failureCategories: bucket.failureCategories.sort((a, b) => b.count - a.count || a.category.localeCompare(b.category))
    }));

  const totals = orderedBuckets.reduce(
    (acc, bucket) => {
      acc.total += bucket.total;
      acc.succeeded += bucket.succeeded;
      acc.failed += bucket.failed;
      acc.running += bucket.running;
      acc.verifiedProofs += bucket.verifiedProofs;
      return acc;
    },
    { total: 0, succeeded: 0, failed: 0, running: 0, verifiedProofs: 0 }
  );

  return {
    ok: true,
    service: "Action402",
    generatedAt: new Date().toISOString(),
    days: historyDays,
    window: {
      from: orderedBuckets.at(-1)?.date || null,
      to: orderedBuckets[0]?.date || null
    },
    summary:
      "Redacted public activity history for buyer agents. Buckets expose daily execution volume, success/failure counts, verified proof counts, and failure categories without target URLs or payload data.",
    totals: {
      ...totals,
      successRate: totals.total > 0 ? totals.succeeded / totals.total : null,
      latestVerifiedProofAt,
      latestProofHoursAgo: hoursSince(latestVerifiedProofAt),
      recency: scoreRecency(hoursSince(latestVerifiedProofAt))
    },
    buckets: orderedBuckets,
    redactionPolicy: {
      ...redactionPolicy(),
      aggregateOnly: true,
      omittedFields: [
        "targetUrl",
        "headers",
        "body",
        "bodyHash",
        "requestHash",
        "responseHash",
        "idempotencyKey",
        "receiptSignature"
      ]
    },
    links: {
      self: absoluteLink("/api/activity/history"),
      activity: absoluteLink("/api/activity"),
      page: absoluteLink("/activity"),
      trust: absoluteLink("/api/trust"),
      monitoring: absoluteLink("/api/monitoring/executions"),
      proofs: absoluteLink("/api/proofs/recent"),
      capabilities: absoluteLink("/api/capabilities")
    }
  };
}

export async function buildActivityReport({ executionStats, listRecentJobs, getReceipt, buildTrustSummary }) {
  const [stats, jobs, trust] = await Promise.all([
    executionStats({ windowMs: ACTIVITY_WINDOW_MS }),
    listRecentJobs(40),
    buildTrustSummary()
  ]);

  const verifiedProofs = [];
  const failures = [];
  let latestVerifiedProofAt = null;

  for (const job of jobs) {
    const receipt = job.receiptId ? await getReceipt(job.receiptId) : undefined;
    if (job.status === "failed" && failures.length < MAX_PUBLIC_FAILURES) {
      failures.push(publicFailureSummary({ job, receipt, baseUrl: config.publicBaseUrl }));
    }
    if (verifiedProofs.length >= MAX_PUBLIC_PROOFS) continue;
    if (!receipt || !verifyReceipt(receipt)) continue;
    const proof = publicProofSummary({ job, receipt, baseUrl: config.publicBaseUrl });
    verifiedProofs.push(proof);
    const proofAt = Date.parse(proof.updatedAt || proof.createdAt || "");
    const latestAt = Date.parse(latestVerifiedProofAt || "");
    if (Number.isFinite(proofAt) && (!Number.isFinite(latestAt) || proofAt > latestAt)) {
      latestVerifiedProofAt = new Date(proofAt).toISOString();
    }
  }

  const posture = activityStatus({ stats, verifiedProofs, latestVerifiedProofAt });

  return {
    ok: posture.status !== "warming_up",
    service: "Action402",
    generatedAt: new Date().toISOString(),
    status: posture.status,
    summary:
      "Agent-facing activity report for buyers and directories. It combines x402 readiness, recent paid execution volume, verified proof freshness, and redacted failure categories.",
    x402: {
      enabled: config.x402Enabled,
      scheme: "exact",
      network: config.x402Network,
      price: config.x402Price,
      paidRoutes: ["/api/execute/webhook", "/api/execute/guided-webhook"]
    },
    activity: {
      ...compactStats(stats),
      latestVerifiedProofAt,
      latestProofHoursAgo: posture.latestProofHoursAgo,
      recency: posture.recency,
      verifiedProofCount: verifiedProofs.length,
      recentFailureRate: posture.recentFailureRate
    },
    trustScore: trust.trustScore,
    failureBreakdown: failureBreakdown(failures),
    recentProofs: verifiedProofs,
    recentFailures: failures,
    recommendations: recommendations({
      stats,
      trust,
      failures,
      latestProofHoursAgo: posture.latestProofHoursAgo
    }),
    buyerGuidance: [
      "Read /api/pricing and compare price/network before payment.",
      "Call /api/decide/webhook for a free structured buy-or-wait decision.",
      "Use an idempotencyKey for every paid execution.",
      "Verify /api/verify/jobs/{id} or /api/verify/receipts/{id} before treating the action as complete.",
      "Do not put secrets or sensitive payloads in public test calls."
    ],
    ecosystemFit: [
      "x402 services are discovered through machine-readable manifests, Bazaar metadata, OpenAPI, llms.txt, and well-known routes.",
      "Buyer agents increasingly need proof freshness, spend guardrails, target policy checks, and PII-safe public metadata.",
      "Action402 is seller-side infrastructure: it gives Coinbase/AgentCash/CDP-style buyer agents a paid action they can inspect, buy, execute, and verify."
    ],
    redactionPolicy: redactionPolicy(),
    links: {
      self: absoluteLink("/api/activity"),
      page: absoluteLink("/activity"),
      pricing: absoluteLink("/api/pricing"),
      decide: absoluteLink("/api/decide/webhook"),
      execute: absoluteLink("/api/execute/webhook"),
      guidedExecute: absoluteLink("/api/execute/guided-webhook"),
      trust: absoluteLink("/api/trust"),
      history: absoluteLink("/api/activity/history"),
      monitoring: absoluteLink("/api/monitoring/executions"),
      proofs: absoluteLink("/api/proofs/recent"),
      bazaar: absoluteLink("/api/bazaar"),
      capabilities: absoluteLink("/api/capabilities"),
      openapi: absoluteLink("/openapi.json"),
      llms: absoluteLink("/llms.txt")
    }
  };
}
