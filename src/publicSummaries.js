import { verifyReceipt } from "./receipt.js";

const DEFAULT_WINDOW_MS = 24 * 60 * 60 * 1000;
const REDACTED_FIELDS = [
  "targetUrl",
  "requestHeaders",
  "requestBody",
  "responseHeaders",
  "responseBody",
  "requestHash",
  "responseHash",
  "receiptSignature"
];

export function clampPublicLimit(limit, fallback = 10, max = 50) {
  const parsed = Number.parseInt(limit, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(parsed, max));
}

export function normalizeWindowMs(value, fallback = DEFAULT_WINDOW_MS) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(60 * 1000, Math.min(parsed, 30 * DEFAULT_WINDOW_MS));
}

function absoluteLink(baseUrl, path) {
  return `${String(baseUrl || "").replace(/\/+$/, "")}${path}`;
}

function latestAttempt(job) {
  const attempts = Array.isArray(job?.attempts) ? job.attempts : [];
  return attempts.length > 0 ? attempts[attempts.length - 1] : {};
}

function responseStatus(job, receipt) {
  return receipt?.payload?.responseStatus ?? latestAttempt(job).status ?? null;
}

function responseOk(job, receipt) {
  return receipt?.payload?.responseOk ?? latestAttempt(job).ok ?? false;
}

function errorCategory(job, receipt) {
  if (job?.status !== "failed") return null;

  const attempt = latestAttempt(job);
  const status = responseStatus(job, receipt);
  const errorText = `${job.error || ""} ${attempt.error || ""}`.toLowerCase();

  if (errorText.includes("timeout") || errorText.includes("abort")) return "timeout";
  if (status === 599) return "network_error";
  if (status === 429) return "target_rate_limited";
  if (status >= 500) return "target_server_error";
  if (status >= 400) return "target_client_error";
  return "execution_failed";
}

export function redactionPolicy() {
  return {
    summary:
      "Public proof examples intentionally omit target URL, headers, bodies, hashes, and signatures. Use verification endpoints for full proof checks.",
    redactedFields: REDACTED_FIELDS
  };
}

export function publicProofSummary({ job, receipt, baseUrl }) {
  const receiptId = job?.receiptId || receipt?.id || null;
  const verified = receipt ? verifyReceipt(receipt) : false;

  return {
    jobId: job.id,
    receiptId,
    status: job.status,
    method: job.method,
    attempts: Array.isArray(job.attempts) ? job.attempts.length : 0,
    responseStatus: responseStatus(job, receipt),
    responseOk: responseOk(job, receipt),
    receiptVerified: verified,
    errorCategory: errorCategory(job, receipt),
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    publicFieldsOnly: true,
    links: {
      job: absoluteLink(baseUrl, `/api/jobs/${job.id}`),
      receipt: receiptId ? absoluteLink(baseUrl, `/api/receipts/${receiptId}`) : null,
      verifyJob: absoluteLink(baseUrl, `/api/verify/jobs/${job.id}`),
      verifyReceipt: receiptId ? absoluteLink(baseUrl, `/api/verify/receipts/${receiptId}`) : null
    }
  };
}

export function publicFailureSummary({ job, receipt, baseUrl }) {
  const summary = publicProofSummary({ job, receipt, baseUrl });
  return {
    jobId: summary.jobId,
    receiptId: summary.receiptId,
    status: summary.status,
    method: summary.method,
    attempts: summary.attempts,
    responseStatus: summary.responseStatus,
    errorCategory: summary.errorCategory,
    receiptVerified: summary.receiptVerified,
    updatedAt: summary.updatedAt,
    links: summary.links
  };
}
