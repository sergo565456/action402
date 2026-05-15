import { config } from "./config.js";
import { publicActionTemplates } from "./actionCatalog.js";
import { executeWebhookResponseSchema } from "./apiContract.js";
import { AGENT_PROMPT, DISCOVERY_KEYWORDS, SERVICE_TAGS } from "./agentDiscovery.js";
import { publicUseCaseTemplates } from "./useCases.js";
import { declareDiscoveryExtension, validateDiscoveryExtension } from "@x402/extensions/bazaar";

const EXAMPLE_REQUEST = {
  url: "https://httpbin.org/anything",
  method: "POST",
  headers: {
    "content-type": "application/json"
  },
  body: {
    event: "agent.test",
    message: "hello from an x402 buyer"
  },
  idempotencyKey: "agent-test-001",
  retry: {
    attempts: 2,
    backoffMs: 300
  },
  timeoutMs: 10000
};

const EXAMPLE_RESPONSE = {
  mode: "x402",
  idempotentReplay: false,
  job: {
    id: "job_...",
    status: "succeeded",
    attempts: 1
  },
  receipt: {
    id: "rcpt_...",
    signature: "hmac-sha256:..."
  },
  links: {
    job: "/api/jobs/job_...",
    receipt: "/api/receipts/rcpt_..."
  }
};

const DISCOVERY_REQUEST_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["url"],
  properties: {
    url: {
      type: "string",
      description: "Absolute public HTTPS URL to call."
    },
    method: {
      type: "string",
      enum: ["POST", "PUT", "PATCH", "DELETE"],
      default: "POST"
    },
    headers: {
      type: "object",
      additionalProperties: {
        type: ["string", "number", "boolean"]
      }
    },
    body: {
      description: "JSON body forwarded to the target endpoint."
    },
    idempotencyKey: {
      type: "string",
      minLength: 1,
      maxLength: 160
    },
    retry: {
      type: "object",
      additionalProperties: false,
      properties: {
        attempts: {
          type: "integer",
          minimum: 1,
          maximum: config.maxRetryAttempts,
          default: 1
        },
        backoffMs: {
          type: "integer",
          minimum: 0,
          maximum: 5000,
          default: 250
        }
      }
    },
    timeoutMs: {
      type: "integer",
      minimum: 1000,
      maximum: config.maxWebhookTimeoutMs,
      default: config.maxWebhookTimeoutMs
    }
  }
};

function discoveryExtension() {
  return declareDiscoveryExtension({
    method: "POST",
    bodyType: "json",
    input: EXAMPLE_REQUEST,
    inputSchema: DISCOVERY_REQUEST_SCHEMA,
    output: {
      example: EXAMPLE_RESPONSE,
      schema: executeWebhookResponseSchema
    }
  });
}

export function executeWebhookRouteConfig() {
  const extensions = discoveryExtension();

  return {
    "POST /api/execute/webhook": {
      accepts: [
        {
          scheme: "exact",
          price: config.x402Price,
          network: config.x402Network,
          payTo: config.payTo || "0xYourReceivingWallet"
        }
      ],
      description:
        "Paid webhook/API execution for autonomous agents. Executes one public HTTPS action after x402 payment, applies retries and idempotency, then returns a signed receipt with request hash, response hash, target, status, and attempt count.",
      mimeType: "application/json",
      serviceName: "Action402",
      tags: SERVICE_TAGS,
      iconUrl: `${config.publicBaseUrl}/logo-action402.svg`,
      extensions
    }
  };
}

export function publicBazaarMetadata() {
  const routeConfig = executeWebhookRouteConfig();
  const route = routeConfig["POST /api/execute/webhook"];
  const validation = validateDiscoveryExtension(route.extensions.bazaar);

  return {
    name: "Action402",
    tagline: "Pay. Execute. Prove.",
    description:
      "x402-native paid webhook and API execution for autonomous agents. Agents pay per action, Action402 executes one public HTTPS request with retries and idempotency, then returns a signed proof receipt.",
    category: "agent-infrastructure",
    tags: SERVICE_TAGS,
    discoveryKeywords: DISCOVERY_KEYWORDS,
    agentPrompt: AGENT_PROMPT,
    resource: `${config.publicBaseUrl}/api/execute/webhook`,
    x402Enabled: config.x402Enabled,
    payment: {
      scheme: "exact",
      price: config.x402Price,
      network: config.x402Network,
      payTo: config.payTo || null
    },
    discovery: {
      cdpSearchUrl: "https://api.cdp.coinbase.com/platform/v2/x402/discovery/search",
      cdpMerchantUrl:
        config.payTo === ""
          ? null
          : `https://api.cdp.coinbase.com/platform/v2/x402/discovery/merchant?payTo=${config.payTo}`,
      searchQueries: [
        "Action402",
        "paid webhook execution",
        "x402 webhook receipt",
        "AI agent action relay",
        "verifiable execution",
        "pay per API call",
        "Action402 action catalog",
        "agent quickstart x402",
        "Action402 integration snippets",
        "x402 verification snippets",
        "x402 action templates",
        "public proof badge",
        "Slack webhook x402",
        "Discord webhook x402",
        "Telegram bot x402",
        "Zapier webhook x402",
        "Make webhook x402",
        "GitHub Actions dispatch x402",
        "agent-safe webhook execution",
        "scheduled paid webhook"
      ],
      qualitySignals: [
        "Valid @x402/extensions/bazaar discovery extension",
        "Unpaid execution route returns 402 Payment Required when x402 is enabled",
        "OpenAPI 3.1 contract is available",
        "Agent-readable capabilities document is available",
        "Machine-readable action catalog is available",
        "Compact quickstart endpoint is available",
        "Copy-paste integration snippets are available",
        "Free preflight policy check is available before payment",
        "Public job and receipt verification endpoints are available",
        "Public proof badge pages are available for job and receipt ids",
        "Public redacted proof examples are available",
        "Public execution monitoring summary is available",
        "Use-case templates are published for agent task matching",
        "Policy modes are described for open, blocklist/quota, and allowlist operation",
        "Scheduled-action capability is marked design-ready, not falsely advertised as active",
        "MCP guide is published for discovery-first clients",
        "Public trust summary is available",
        "Receipts sign request and response hashes instead of exposing raw payloads"
      ],
      bazaarExtensionValid: validation.valid,
      bazaarExtensionErrors: validation.errors || [],
      inputExample: EXAMPLE_REQUEST,
      outputExample: EXAMPLE_RESPONSE,
      verification: {
        job: "/api/verify/jobs/{id}",
        receipt: "/api/verify/receipts/{id}",
        recentProofs: "/api/proofs/recent"
      },
      monitoring: {
        executions: "/api/monitoring/executions"
      }
    },
    useCaseTemplates: publicUseCaseTemplates(),
    actionCatalog: {
      path: "/api/actions",
      templateCount: publicActionTemplates().length,
      categories: Array.from(new Set(publicActionTemplates().map((template) => template.category))).sort(),
      topTemplates: publicActionTemplates()
        .slice(0, 5)
        .map((template) => ({
          id: template.id,
          title: template.title,
          category: template.category,
          paidRoute: template.paidRoute
        }))
    },
    quickstart: {
      path: "/api/quickstart",
      description:
        "Compact buyer flow for agents: minimal request, payment guardrails, snippets, and proof verification links."
    },
    snippets: {
      path: "/api/snippets",
      description:
        "Copy-paste snippets for discovery, paid execution, proof verification, and buyer policy guardrails."
    },
    policyCheck: {
      method: "POST",
      path: "/api/policy/check",
      paid: false,
      description:
        "Free preflight check for request shape, target safety, policy, retry, timeout, and warnings before paying."
    },
    mcp: {
      recommendedToolName: "execute_webhook",
      discoveryHint:
        "Search Bazaar/x402 MCP discovery for Action402 or paid webhook execution, then call the returned tool/resource with the JSON input example.",
      buyerFlow: [
        "search_resources query=Action402",
        "select the Action402 execute webhook resource",
        "proxy_tool_call with x402 payment handling",
        "verify the returned job or receipt link"
      ]
    },
    links: {
      agentsGuide: `${config.publicBaseUrl}/agents`,
      pricing: `${config.publicBaseUrl}/pricing`,
      onboarding: `${config.publicBaseUrl}/onboarding`,
      useCases: `${config.publicBaseUrl}/use-cases`,
      actions: `${config.publicBaseUrl}/actions`,
      snippetsGuide: `${config.publicBaseUrl}/snippets`,
      mcpGuide: `${config.publicBaseUrl}/mcp`,
      trust: `${config.publicBaseUrl}/trust`,
      proofs: `${config.publicBaseUrl}/proofs`,
      proofBadge: `${config.publicBaseUrl}/proof/{jobOrReceiptId}`,
      monitoring: `${config.publicBaseUrl}/monitoring`,
      llms: `${config.publicBaseUrl}/llms.txt`,
      quickstart: `${config.publicBaseUrl}/api/quickstart`,
      snippets: `${config.publicBaseUrl}/api/snippets`,
      policyCheck: `${config.publicBaseUrl}/api/policy/check`,
      actionCatalog: `${config.publicBaseUrl}/api/actions`,
      capabilities: `${config.publicBaseUrl}/api/capabilities`,
      openapi: `${config.publicBaseUrl}/openapi.json`,
      bazaar: `${config.publicBaseUrl}/api/bazaar`
    },
    routeConfig
  };
}

export function validateBazaarDiscovery() {
  const route = executeWebhookRouteConfig()["POST /api/execute/webhook"];
  return validateDiscoveryExtension(route.extensions.bazaar);
}

export {
  EXAMPLE_REQUEST as bazaarExampleRequest,
  EXAMPLE_RESPONSE as bazaarExampleResponse,
  SERVICE_TAGS
};
