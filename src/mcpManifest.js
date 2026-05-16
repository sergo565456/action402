import { config } from "./config.js";
import { DISCOVERY_KEYWORDS } from "./agentDiscovery.js";

function normalizeBaseUrl(baseUrl = config.publicBaseUrl) {
  return String(baseUrl || "").replace(/\/+$/, "");
}

function absoluteUrl(path, baseUrl = config.publicBaseUrl) {
  return `${normalizeBaseUrl(baseUrl)}${path}`;
}

const webhookInputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["url"],
  properties: {
    url: {
      type: "string",
      format: "uri",
      description: "Absolute public HTTPS URL to call."
    },
    method: {
      type: "string",
      enum: ["POST", "PUT", "PATCH", "DELETE"],
      default: "POST"
    },
    headers: {
      type: "object",
      description: "Optional outbound target headers. Hop-by-hop and proxy headers are stripped."
    },
    body: {
      description: "JSON body forwarded to the target endpoint."
    },
    idempotencyKey: {
      type: "string",
      maxLength: 160
    },
    retry: {
      type: "object",
      properties: {
        attempts: {
          type: "integer",
          minimum: 1,
          maximum: config.maxRetryAttempts
        },
        backoffMs: {
          type: "integer",
          minimum: 0,
          maximum: 5000
        }
      }
    },
    timeoutMs: {
      type: "integer",
      minimum: 1000,
      maximum: config.maxWebhookTimeoutMs
    }
  }
};

function toolRoute(path, baseUrl) {
  return {
    path,
    url: absoluteUrl(path, baseUrl)
  };
}

export function publicMcpManifest({ baseUrl = config.publicBaseUrl } = {}) {
  const executeRoute = toolRoute("/api/execute/webhook", baseUrl);

  return {
    ok: true,
    service: "Action402",
    version: "action402.mcp-manifest.v1",
    generatedAt: new Date().toISOString(),
    status: "manifest-only",
    description:
      "Machine-readable MCP discovery manifest for agents that want to map Action402 HTTP/x402 routes into local MCP tools. Action402 publishes this manifest but does not host a stateful MCP server.",
    recommendedToolName: "execute_webhook",
    resourceAliases: ["Action402 execute webhook", "paid webhook execution", "x402 action relay"],
    discoveryQueries: [
      "Action402",
      "paid webhook execution",
      "x402 webhook receipt",
      "agent action relay",
      "pay per API call",
      "Action402 pricing API",
      "Action402 MCP manifest",
      ...DISCOVERY_KEYWORDS
    ],
    mcpServer: {
      hostedByAction402: false,
      recommendedWrapperName: "action402-mcp",
      transportModel: "HTTP API routes plus x402 payment handling",
      note:
        "Use this manifest to build or configure an MCP wrapper. For paid execution, the wrapper must support x402 402-response handling or call through an x402-capable buyer client."
    },
    tools: [
      {
        name: "execute_webhook",
        title: "Execute paid webhook",
        description:
          "Pay through x402, execute one bounded public HTTPS request, and return job plus signed receipt links.",
        route: executeRoute,
        method: "POST",
        paid: config.x402Enabled,
        x402: {
          required: config.x402Enabled,
          scheme: "exact",
          price: config.x402Price,
          network: config.x402Network,
          payTo: config.payTo || null
        },
        inputSchema: webhookInputSchema,
        output:
          "JSON with mode, idempotentReplay, job id/status/attempt count, receipt id/signature, and links.job/links.receipt.",
        verifyAfter: ["/api/verify/jobs/{id}", "/api/verify/receipts/{id}", "/proof/{jobOrReceiptId}"]
      },
      {
        name: "check_webhook_policy",
        title: "Preflight webhook policy",
        description:
          "Free check for target safety, method, policy, retry, timeout, and warnings before paying.",
        route: toolRoute("/api/policy/check", baseUrl),
        method: "POST",
        paid: false,
        inputSchema: webhookInputSchema
      },
      {
        name: "get_pricing",
        title: "Get pricing guardrails",
        description: "Fetch current price, network, payTo, free surfaces, and buyer guardrails.",
        route: toolRoute("/api/pricing", baseUrl),
        method: "GET",
        paid: false
      },
      {
        name: "get_capabilities",
        title: "Get capabilities",
        description: "Fetch the full Action402 service contract, safety limits, discovery hints, and schemas.",
        route: toolRoute("/api/capabilities", baseUrl),
        method: "GET",
        paid: false
      },
      {
        name: "canary_echo",
        title: "Canary echo",
        description: "Free redacted echo target for non-sensitive route and JSON plumbing checks.",
        route: toolRoute("/api/canary/echo", baseUrl),
        method: "POST",
        paid: false
      },
      {
        name: "verify_job_receipt",
        title: "Verify job receipt",
        description: "Verify signed receipt consistency for a returned job id.",
        route: toolRoute("/api/verify/jobs/{id}", baseUrl),
        method: "GET",
        paid: false
      }
    ],
    buyerFlow: [
      "Fetch /api/mcp or /.well-known/mcp.json.",
      "Create local MCP tools from the listed route/method/inputSchema pairs.",
      "Fetch /api/pricing and reject unexpected price, network, payTo, or route.",
      "POST the intended payload to /api/policy/check before paying.",
      "Call execute_webhook through an x402-capable buyer client.",
      "Verify links.job or links.receipt before marking the task complete."
    ],
    guardrails: [
      "Do not send wallet private keys or long-lived target secrets to Action402.",
      "Use idempotencyKey for buyer retries.",
      "Use /api/canary/echo only for non-sensitive self-tests; it does not create a paid receipt.",
      "Reject localhost, private-network, and non-HTTPS targets before payment.",
      "Treat schedule and browser endpoints as preview/handoff surfaces, not paid execution."
    ],
    links: {
      self: absoluteUrl("/api/mcp", baseUrl),
      wellKnown: absoluteUrl("/.well-known/mcp.json", baseUrl),
      mcpGuide: absoluteUrl("/mcp", baseUrl),
      apiIndex: absoluteUrl("/api", baseUrl),
      pricing: absoluteUrl("/api/pricing", baseUrl),
      capabilities: absoluteUrl("/api/capabilities", baseUrl),
      quickstart: absoluteUrl("/api/quickstart", baseUrl),
      bazaar: absoluteUrl("/api/bazaar", baseUrl),
      openapi: absoluteUrl("/openapi.json", baseUrl),
      snippets: absoluteUrl("/api/snippets", baseUrl),
      executeWebhook: executeRoute.url
    }
  };
}
