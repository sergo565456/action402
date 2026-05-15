import { config } from "./config.js";
import { verifyReceipt } from "./receipt.js";

const TRUST_WINDOW_MS = 24 * 60 * 60 * 1000;

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

  return {
    ok: true,
    service: "Action402",
    generatedAt: new Date().toISOString(),
    status: stats.recentFailed === 0 ? "ok" : "attention",
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
      bazaar: `${config.publicBaseUrl}/api/bazaar`,
      openapi: `${config.publicBaseUrl}/openapi.json`,
      llms: `${config.publicBaseUrl}/llms.txt`,
      useCases: `${config.publicBaseUrl}/use-cases`,
      mcp: `${config.publicBaseUrl}/mcp`,
      proofs: `${config.publicBaseUrl}/proofs`,
      monitoring: `${config.publicBaseUrl}/monitoring`
    },
    trustSignals: [
      "x402 exact payments on Base",
      "public capabilities and OpenAPI contracts",
      "official Bazaar discovery extension metadata",
      "public proof verification endpoints",
      "redacted public proof examples",
      "durable execution counters",
      "idempotency and bounded retries",
      "private network targets blocked"
    ],
    redaction:
      "Public trust summaries never include target URLs, request headers, request bodies, response bodies, hashes, or receipt signatures."
  };
}
