import { config } from "./config.js";

function normalizeBaseUrl(baseUrl = config.publicBaseUrl) {
  return String(baseUrl || "").replace(/\/+$/, "");
}

function absoluteUrl(path, baseUrl = config.publicBaseUrl) {
  return `${normalizeBaseUrl(baseUrl)}${path}`;
}

function networkName(network) {
  if (network === "eip155:8453") return "Base mainnet";
  if (network === "eip155:84532") return "Base Sepolia";
  return network;
}

function parseDisplayPrice(value) {
  const display = String(value || "").trim();
  const amount = Number.parseFloat(display.replace(/[^0-9.]/g, ""));

  return {
    display,
    amount: Number.isFinite(amount) ? amount : null,
    currency: display.startsWith("$") ? "USD" : "unknown"
  };
}

export function publicPricing({ baseUrl = config.publicBaseUrl } = {}) {
  const price = parseDisplayPrice(config.x402Price);

  return {
    ok: true,
    service: "Action402",
    version: "action402.pricing.v1",
    generatedAt: new Date().toISOString(),
    pricingModel: "pay-per-action",
    summary:
      "Agents pay only for POST /api/execute/webhook or POST /api/execute/guided-webhook. Discovery, decision graph, preflight, canary echo, snippets, proof verification, trust, and monitoring surfaces are free.",
    payment: {
      required: config.x402Enabled,
      protocol: "x402",
      scheme: "exact",
      network: config.x402Network,
      networkName: networkName(config.x402Network),
      price,
      route: absoluteUrl("/api/execute/webhook", baseUrl),
      payTo: config.payTo || null,
      facilitatorUrl: config.facilitatorUrl
    },
    paidActions: [
      {
        id: "execute.webhook",
        method: "POST",
        path: "/api/execute/webhook",
        price: price.display,
        unit: "one bounded public HTTPS request attempt with retries and a signed receipt",
        chargeTiming:
          "In x402 mode, payment is required before Action402 attempts the target call.",
        failurePolicy:
          "If the downstream target fails after accepted payment, Action402 returns a failed job plus a signed receipt/proof for the attempt.",
        idempotency:
          "Send idempotencyKey so repeated buyer retries can reuse the retained job instead of intentionally creating duplicate target effects."
      },
      {
        id: "execute.guided_webhook",
        method: "POST",
        path: "/api/execute/guided-webhook",
        price: price.display,
        unit: "one decision-linked public HTTPS request attempt with retries and a signed receipt",
        chargeTiming:
          "Buyer agents should first call free POST /api/decide/webhook, then pay this route only when the decision recommendation is pay_and_execute.",
        failurePolicy:
          "If the downstream target fails after accepted payment, Action402 still links the paid job, receipt, and decision outcome for later trust reflection.",
        idempotency:
          "The execution body must match the approved decision id so buyer retries cannot silently change the target action."
      }
    ],
    freeSurfaces: {
      discovery: [
        "/api",
        "/api/pricing",
        "/api/capabilities",
        "/api/actions",
        "/cookbooks",
        "/built-with-action402",
        "/submit",
        "/api/quickstart",
        "/api/bazaar",
        "/api/agent-manifest",
        "/.well-known/agent.json",
        "/openapi.json",
        "/llms.txt"
      ],
      preflight: ["/api/decide/webhook", "/api/policy/check", "/api/canary/echo"],
      decision: ["/api/decide/webhook", "/api/decisions/{id}", "/api/decisions/recent", "/decisions", "/decision/{id}"],
      verification: [
        "/api/jobs/{id}",
        "/api/receipts/{id}",
        "/api/verify/jobs/{id}",
        "/api/verify/receipts/{id}",
        "/api/proofs/recent",
        "/proof/{jobOrReceiptId}"
      ],
      trustAndMonitoring: ["/status", "/health", "/api/trust", "/api/monitoring/executions"]
    },
    buyerGuardrails: [
      "Read /api/pricing and reject unexpected price, network, route, or payTo before paying.",
      "POST the intended payload to /api/decide/webhook and prefer guided execution when it returns pay_and_execute.",
      "POST the intended payload to /api/policy/check before payment.",
      "Use a buyer-side max spend cap that is above the listed price and below the caller's budget.",
      "Always pass idempotencyKey for retryable buyer flows.",
      "Verify /api/verify/jobs/{id} or /api/verify/receipts/{id} before marking the task complete."
    ],
    limits: {
      allowedMethods: ["POST", "PUT", "PATCH", "DELETE"],
      privateNetworkTargetsBlocked: true,
      maxRetryAttempts: config.maxRetryAttempts,
      maxWebhookTimeoutMs: config.maxWebhookTimeoutMs,
      rateLimit: {
        enabled: config.rateLimitEnabled,
        windowMs: config.rateLimitWindowMs,
        maxRequests: config.rateLimitMaxRequests
      },
      targetQuota: {
        enabled: config.targetQuotaEnabled,
        windowMs: config.targetQuotaWindowMs,
        maxRequests: config.targetQuotaMaxRequests
      }
    },
    links: {
      self: absoluteUrl("/api/pricing", baseUrl),
      humanPricing: absoluteUrl("/pricing", baseUrl),
      executeWebhook: absoluteUrl("/api/execute/webhook", baseUrl),
      guidedWebhook: absoluteUrl("/api/execute/guided-webhook", baseUrl),
      decideWebhook: absoluteUrl("/api/decide/webhook", baseUrl),
      recentDecisions: absoluteUrl("/api/decisions/recent", baseUrl),
      decisionsPage: absoluteUrl("/decisions", baseUrl),
      policyCheck: absoluteUrl("/api/policy/check", baseUrl),
      quickstart: absoluteUrl("/api/quickstart", baseUrl),
      capabilities: absoluteUrl("/api/capabilities", baseUrl),
      bazaar: absoluteUrl("/api/bazaar", baseUrl),
      snippets: absoluteUrl("/api/snippets", baseUrl),
      status: absoluteUrl("/status", baseUrl),
      health: absoluteUrl("/health", baseUrl),
      trust: absoluteUrl("/api/trust", baseUrl),
      openapi: absoluteUrl("/openapi.json", baseUrl)
    }
  };
}
