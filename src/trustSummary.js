import { config } from "./config.js";
import { verifyReceipt } from "./receipt.js";

const TRUST_WINDOW_MS = 24 * 60 * 60 * 1000;

function scoreGrade(score) {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  return "D";
}

function trustScoreSummary(score) {
  if (score >= 85) return "Strong public buyer signals for autonomous agents.";
  if (score >= 70) return "Usable public buyer signals with a few areas to inspect.";
  if (score >= 55) return "Partial trust surface; agents should inspect details before paying.";
  return "Early trust surface; use only with strict buyer guardrails.";
}

function buildTrustScore({ stats, store, proofStats }) {
  const recentFailureRate = stats.recentTotal > 0 ? stats.recentFailed / stats.recentTotal : 0;
  const executionScore =
    stats.recentTotal === 0 ? 10 : recentFailureRate === 0 ? 20 : Math.max(0, Math.round(20 * (1 - recentFailureRate)));
  const proofScore = proofStats.recentVerifiedProofs > 0 ? 15 : 5;

  const components = [
    {
      id: "x402",
      title: "x402 payment readiness",
      score: config.x402Enabled ? 20 : 8,
      maxScore: 20,
      details: config.x402Enabled ? "x402 is enabled." : "x402 is disabled in this runtime."
    },
    {
      id: "storage",
      title: "Durable storage",
      score: store.durable ? 20 : 8,
      maxScore: 20,
      details: store.durable ? "Jobs and receipts use durable storage." : "This runtime uses volatile storage."
    },
    {
      id: "execution",
      title: "Recent execution health",
      score: executionScore,
      maxScore: 20,
      details:
        stats.recentTotal === 0
          ? "No recent execution volume in the scoring window."
          : `${stats.recentFailed} failed of ${stats.recentTotal} recent executions.`
    },
    {
      id: "proofs",
      title: "Verified proof examples",
      score: proofScore,
      maxScore: 15,
      details:
        proofStats.recentVerifiedProofs > 0
          ? `${proofStats.recentVerifiedProofs} verified public proof example(s).`
          : "No retained verified public proof examples yet."
    },
    {
      id: "agent_surfaces",
      title: "Agent discovery surfaces",
      score: 15,
      maxScore: 15,
      details: "Capabilities, Bazaar metadata, quickstart, action catalog, llms.txt, and OpenAPI are public."
    },
    {
      id: "safety",
      title: "Bounded execution safety",
      score: 10,
      maxScore: 10,
      details: "Private network targets are blocked, methods are limited, retries are bounded, and summaries are redacted."
    }
  ];

  const score = components.reduce((total, component) => total + component.score, 0);

  return {
    score,
    maxScore: components.reduce((total, component) => total + component.maxScore, 0),
    grade: scoreGrade(score),
    summary: trustScoreSummary(score),
    components
  };
}

async function recentVerifiedProofStats({ jobs, getReceipt }) {
  let recentVerifiedProofs = 0;
  let latestVerifiedProofAt = null;

  for (const job of jobs) {
    if (!job.receiptId) continue;
    const receipt = await getReceipt(job.receiptId);
    if (!receipt || !verifyReceipt(receipt)) continue;
    recentVerifiedProofs += 1;

    const updatedAt = Date.parse(job.updatedAt || job.createdAt || "");
    const latestAt = Date.parse(latestVerifiedProofAt || "");
    if (Number.isFinite(updatedAt) && (!Number.isFinite(latestAt) || updatedAt > latestAt)) {
      latestVerifiedProofAt = new Date(updatedAt).toISOString();
    }
  }

  return { recentVerifiedProofs, latestVerifiedProofAt };
}

export async function buildTrustSummary({ executionStats, storeStats, listRecentJobs, getReceipt }) {
  const [stats, store, recentJobs] = await Promise.all([
    executionStats({ windowMs: TRUST_WINDOW_MS }),
    storeStats(),
    listRecentJobs(50)
  ]);
  const proofStats = await recentVerifiedProofStats({ jobs: recentJobs, getReceipt });
  const recentFailureRate = stats.recentTotal > 0 ? stats.recentFailed / stats.recentTotal : 0;
  const trustScore = buildTrustScore({ stats, store, proofStats });

  return {
    ok: true,
    service: "Action402",
    generatedAt: new Date().toISOString(),
    status: stats.recentFailed === 0 ? "ok" : "attention",
    trustScore,
    x402: {
      enabled: config.x402Enabled,
      scheme: "exact",
      network: config.x402Network,
      price: config.x402Price
    },
    storage: {
      driver: store.driver,
      durable: store.durable,
      jobs: store.jobs,
      receipts: store.receipts,
      retention: store.retention
    },
    execution: {
      windowMs: TRUST_WINDOW_MS,
      recentFailureRate,
      stats
    },
    proofExamples: proofStats,
    publicSurfaces: {
      capabilities: `${config.publicBaseUrl}/api/capabilities`,
      quickstart: `${config.publicBaseUrl}/api/quickstart`,
      actionCatalog: `${config.publicBaseUrl}/api/actions`,
      bazaar: `${config.publicBaseUrl}/api/bazaar`,
      openapi: `${config.publicBaseUrl}/openapi.json`,
      llms: `${config.publicBaseUrl}/llms.txt`,
      actions: `${config.publicBaseUrl}/actions`,
      useCases: `${config.publicBaseUrl}/use-cases`,
      mcp: `${config.publicBaseUrl}/mcp`,
      proofs: `${config.publicBaseUrl}/proofs`,
      proofBadge: `${config.publicBaseUrl}/proof/{jobOrReceiptId}`,
      monitoring: `${config.publicBaseUrl}/monitoring`
    },
    trustSignals: [
      "x402 exact payments on Base",
      "public capabilities and OpenAPI contracts",
      "public action catalog and quickstart endpoints",
      "official Bazaar discovery extension metadata",
      "public proof verification endpoints",
      "public proof badge pages",
      "redacted public proof examples",
      "durable execution counters",
      "idempotency and bounded retries",
      "private network targets blocked",
      "policy modes documented for open and restricted deployments"
    ],
    redaction:
      "Public trust summaries never include target URLs, request headers, request bodies, response bodies, hashes, or receipt signatures."
  };
}
