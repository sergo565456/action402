import { createId, sha256Json } from "./receipt.js";

export const DECISION_VERSION = "action402.decision.v1";

const DEFAULT_BUYER_POLICY = {
  maxPriceUsd: null,
  allowedNetworks: [],
  requireReceipt: true,
  requirePolicyPass: true,
  requireIdempotencyKey: true,
  allowUnknownTargets: true,
  manualReviewAboveRisk: "medium",
  minTrustScore: 55
};

function scalarHeaderNames(headers = {}) {
  if (!headers || typeof headers !== "object" || Array.isArray(headers)) return [];
  return Object.keys(headers)
    .map((key) => key.toLowerCase())
    .sort();
}

export function parseUsdAmount(value) {
  if (value === null || value === undefined || value === "") return null;
  const normalized = String(value).trim().replace(/^\$/, "");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeDecisionEnvelope(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {
      action: {},
      buyerPolicy: { ...DEFAULT_BUYER_POLICY },
      mode: "evaluate_only"
    };
  }

  const action = input.action && typeof input.action === "object" && !Array.isArray(input.action)
    ? input.action
    : input;
  const buyerPolicy =
    input.buyerPolicy && typeof input.buyerPolicy === "object" && !Array.isArray(input.buyerPolicy)
      ? input.buyerPolicy
      : {};

  return {
    action,
    buyerPolicy: {
      ...DEFAULT_BUYER_POLICY,
      ...buyerPolicy,
      allowedNetworks: Array.isArray(buyerPolicy.allowedNetworks)
        ? buyerPolicy.allowedNetworks.map(String)
        : DEFAULT_BUYER_POLICY.allowedNetworks
    },
    mode: input.mode || "evaluate_only"
  };
}

export function actionHashForWebhook(action = {}) {
  const method = String(action.method || "POST").toUpperCase();
  return sha256Json({
    url: action.url || "",
    method,
    headers: action.headers || {},
    body: action.body ?? null,
    retry: action.retry || null,
    timeoutMs: action.timeoutMs || null,
    idempotencyKey: action.idempotencyKey || ""
  });
}

export function redactedActionInput(action = {}) {
  const method = String(action.method || "POST").toUpperCase();
  const parsed = (() => {
    try {
      return new URL(action.url);
    } catch {
      return null;
    }
  })();

  return {
    method,
    targetKnown: Boolean(parsed),
    targetProtocol: parsed ? parsed.protocol.replace(":", "") : null,
    targetOriginRedacted: parsed ? `${parsed.protocol}//${parsed.hostname}` : null,
    targetPathPresent: parsed ? Boolean(parsed.pathname && parsed.pathname !== "/") : false,
    idempotencyKeyPresent: Boolean(action.idempotencyKey),
    retryPresent: Boolean(action.retry),
    timeoutMsPresent: action.timeoutMs !== undefined,
    bodyPresent: action.body !== undefined,
    bodyHash: action.body === undefined ? null : `sha256:${sha256Json(action.body)}`,
    headerNames: scalarHeaderNames(action.headers)
  };
}

export function createDecisionRecord({ action, buyerPolicy, roleReports, debate, decision, trustSnapshot }) {
  const now = new Date().toISOString();
  const actionHash = actionHashForWebhook(action);
  const input = redactedActionInput(action);
  const record = {
    id: createId("dec"),
    version: DECISION_VERSION,
    createdAt: now,
    updatedAt: now,
    action: "execute.webhook",
    actionHash,
    input,
    buyerPolicy: {
      maxPriceUsd: buyerPolicy.maxPriceUsd,
      allowedNetworks: buyerPolicy.allowedNetworks,
      requireReceipt: buyerPolicy.requireReceipt,
      requirePolicyPass: buyerPolicy.requirePolicyPass,
      requireIdempotencyKey: buyerPolicy.requireIdempotencyKey,
      allowUnknownTargets: buyerPolicy.allowUnknownTargets,
      manualReviewAboveRisk: buyerPolicy.manualReviewAboveRisk,
      minTrustScore: buyerPolicy.minTrustScore
    },
    roleReports,
    debate,
    decision,
    trustSnapshot,
    outcome: {
      status: "pending_execution",
      linkedJobId: null,
      linkedReceiptId: null,
      receiptVerified: null,
      responseStatus: null,
      attempts: null,
      failureCategory: null,
      outcomeClass: null,
      recommendationMatchedOutcome: null,
      updatedAt: null
    },
    links: {
      execute: "/api/execute/webhook",
      guidedExecute: "/api/execute/guided-webhook",
      policyCheck: "/api/policy/check",
      pricing: "/api/pricing",
      trust: "/api/trust",
      recentProofs: "/api/proofs/recent"
    }
  };
  return {
    ...record,
    decisionHash: sha256Json({
      version: record.version,
      action: record.action,
      actionHash: record.actionHash,
      buyerPolicy: record.buyerPolicy,
      decision: record.decision,
      createdAt: record.createdAt
    })
  };
}

export function publicDecisionRecord(decision, { includeDetails = true } = {}) {
  if (!decision) return null;
  const base = {
    id: decision.id,
    version: decision.version,
    createdAt: decision.createdAt,
    updatedAt: decision.updatedAt,
    action: decision.action,
    recommendation: decision.decision?.recommendation || "manual_review",
    confidence: decision.decision?.confidence || "low",
    publicFieldsOnly: true,
    input: {
      ...decision.input,
      targetOriginRedacted: decision.input?.targetOriginRedacted ? "redacted" : null,
      bodyHash: decision.input?.bodyHash ? "redacted" : null
    },
    blockingIssues: decision.decision?.blockingIssues || [],
    warnings: decision.decision?.warnings || [],
    reasons: decision.decision?.reasons || [],
    outcome: decision.outcome || null,
    links: {
      self: `/api/decisions/${decision.id}`,
      page: `/decision/${decision.id}`,
      recent: "/api/decisions/recent",
      execute: "/api/execute/webhook",
      guidedExecute: "/api/execute/guided-webhook"
    },
    redaction:
      "Public decision records omit target URL, request body, request headers, raw hashes, receipt signatures, and credential-like values."
  };

  if (!includeDetails) return base;

  return {
    ...base,
    buyerPolicy: decision.buyerPolicy,
    roleReports: decision.roleReports,
    debate: decision.debate,
    trustSnapshot: decision.trustSnapshot
  };
}

export function publicDecisionSummary(decision) {
  return publicDecisionRecord(decision, { includeDetails: false });
}
