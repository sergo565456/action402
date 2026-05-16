const CANARY_FIELDS = ["event", "scenario", "runId", "source", "generatedAt"];

function safeScalar(value) {
  if (typeof value === "string") return value.slice(0, 200);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "boolean") return value;
  return undefined;
}

function safeCanaryFields(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return {};

  return Object.fromEntries(
    CANARY_FIELDS.map((field) => [field, safeScalar(body[field])]).filter(([, value]) => value !== undefined)
  );
}

export function createCanaryEcho(body = {}, { requestId = "" } = {}) {
  return {
    ok: true,
    service: "Action402",
    endpoint: "/api/canary/echo",
    paid: false,
    purpose:
      "Free non-sensitive echo target for Action402 self-tests and local settlement-canary target checks.",
    receivedAt: new Date().toISOString(),
    requestId: requestId || null,
    acceptedFields: safeCanaryFields(body),
    redactionPolicy: {
      onlyWhitelistedFieldsEchoed: true,
      ignoredPayloadFields: true,
      echoedFields: CANARY_FIELDS,
      neverEchoes: ["headers", "authorization", "tokens", "private keys", "raw request body"]
    },
    next: {
      paidExecution: "/api/execute/webhook",
      verifyJob: "/api/verify/jobs/{id}",
      recentProofs: "/api/proofs/recent"
    }
  };
}
