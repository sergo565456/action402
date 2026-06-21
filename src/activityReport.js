import { config } from "./config.js";
import { verifyReceipt } from "./receipt.js";
import { publicFailureSummary, publicProofSummary, redactionPolicy } from "./publicSummaries.js";

const ACTIVITY_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_PUBLIC_PROOFS = 6;
const MAX_PUBLIC_FAILURES = 6;

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
      monitoring: absoluteLink("/api/monitoring/executions"),
      proofs: absoluteLink("/api/proofs/recent"),
      bazaar: absoluteLink("/api/bazaar"),
      capabilities: absoluteLink("/api/capabilities"),
      openapi: absoluteLink("/openapi.json"),
      llms: absoluteLink("/llms.txt")
    }
  };
}
