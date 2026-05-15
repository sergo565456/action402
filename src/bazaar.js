import { config } from "./config.js";
import { executeWebhookResponseSchema } from "./apiContract.js";
import { declareDiscoveryExtension, validateDiscoveryExtension } from "@x402/extensions/bazaar";

const SERVICE_TAGS = [
  "x402",
  "webhook",
  "execution",
  "receipts",
  "ai-agents",
  "idempotency",
  "retries"
];

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
        "Paid webhook/API execution for autonomous agents. Executes one outbound HTTPS action with retries and idempotency, then returns a signed receipt with request and response hashes.",
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
      "Paid webhook and API execution for autonomous agents using x402 payments on Base.",
    category: "agent-infrastructure",
    tags: SERVICE_TAGS,
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
      bazaarExtensionValid: validation.valid,
      bazaarExtensionErrors: validation.errors || [],
      inputExample: EXAMPLE_REQUEST,
      outputExample: EXAMPLE_RESPONSE,
      verification: {
        job: "/api/verify/jobs/{id}",
        receipt: "/api/verify/receipts/{id}"
      }
    },
    routeConfig
  };
}

export function validateBazaarDiscovery() {
  const route = executeWebhookRouteConfig()["POST /api/execute/webhook"];
  return validateDiscoveryExtension(route.extensions.bazaar);
}

export { EXAMPLE_REQUEST as bazaarExampleRequest, EXAMPLE_RESPONSE as bazaarExampleResponse, SERVICE_TAGS };
