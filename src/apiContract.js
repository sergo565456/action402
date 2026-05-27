import { config } from "./config.js";
import { effectiveTargetPolicy } from "./targetPolicy.js";
import { AGENT_PROMPT, DISCOVERY_KEYWORDS } from "./agentDiscovery.js";
import {
  BROWSER_HANDOFF_PATTERN,
  POLICY_MODES,
  SCHEDULED_ACTION_PATTERN,
  SECRET_STORAGE_PATTERN,
  publicActionTemplates
} from "./actionCatalog.js";
import {
  publicHandoffCapabilities,
  publicScheduleCapabilities,
  publicSecretStoragePolicy
} from "./advancedActions.js";
import { publicCorsPolicy } from "./cors.js";
import { publicCachePolicy } from "./cachePolicy.js";
import { publicPricing } from "./pricing.js";
import { publicMcpManifest } from "./mcpManifest.js";
import { publicDiscoveryHeaderPolicy } from "./discoveryHeaders.js";
import { publicDiscoveryPack } from "./discoveryManifest.js";
import { publicUseCaseTemplates } from "./useCases.js";

const webhookRequestSchema = {
  type: "object",
  additionalProperties: false,
  required: ["url"],
  properties: {
    url: {
      type: "string",
      format: "uri",
      description: "Absolute HTTPS URL to call."
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
      },
      description: "Optional outbound headers. Hop-by-hop and proxy headers are stripped."
    },
    body: {
      description: "JSON body forwarded to the target endpoint."
    },
    idempotencyKey: {
      type: "string",
      minLength: 1,
      maxLength: 160,
      description: "Caller-provided key used to replay the same completed job instead of executing twice."
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
    },
    decisionId: {
      type: "string",
      description: "Optional decision id from /api/decide/webhook. When supplied, execution must match the stored approved decision."
    }
  }
};

const executeWebhookResponseSchema = {
  type: "object",
  required: ["mode", "idempotentReplay", "job", "receipt", "links"],
  properties: {
    mode: { type: "string", enum: ["demo", "x402"] },
    idempotentReplay: { type: "boolean" },
    job: {
      type: "object",
      required: ["id", "status", "attempts"],
      properties: {
        id: { type: "string" },
        status: { type: "string", enum: ["succeeded", "failed"] },
        attempts: { type: "integer" }
      }
    },
    receipt: {
      type: "object",
      properties: {
        id: { type: "string" },
        signature: { type: "string" },
        replay: { type: "boolean" }
      }
    },
    links: {
      type: "object",
      required: ["job", "receipt"],
      properties: {
        job: { type: "string" },
        receipt: { type: "string" }
      }
    }
  }
};

const errorSchema = {
  type: "object",
  required: ["error"],
  properties: {
    error: {
      type: "object",
      required: ["message"],
      properties: {
        code: { type: "string" },
        message: { type: "string" },
        details: {}
      }
    }
  }
};

const decisionRequestSchema = {
  type: "object",
  additionalProperties: true,
  properties: {
    action: webhookRequestSchema,
    buyerPolicy: {
      type: "object",
      properties: {
        maxPriceUsd: { type: ["string", "null"], example: "0.009" },
        allowedNetworks: { type: "array", items: { type: "string" } },
        requireReceipt: { type: "boolean", default: true },
        requirePolicyPass: { type: "boolean", default: true },
        requireIdempotencyKey: { type: "boolean", default: true },
        allowUnknownTargets: { type: "boolean", default: true },
        minTrustScore: { type: "integer", default: 55 }
      }
    },
    mode: { type: "string", enum: ["evaluate_only"], default: "evaluate_only" }
  }
};

const decisionRecordSchema = {
  type: "object",
  required: ["id", "version", "recommendation", "confidence", "publicFieldsOnly", "links"],
  properties: {
    id: { type: "string" },
    version: { type: "string" },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
    action: { type: "string" },
    recommendation: { type: "string", enum: ["pay_and_execute", "do_not_pay", "manual_review", "safe_to_test_free_canary_first"] },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    publicFieldsOnly: { type: "boolean" },
    blockingIssues: { type: "array", items: { type: "string" } },
    warnings: { type: "array", items: { type: "string" } },
    reasons: { type: "array", items: { type: "string" } },
    outcome: { type: ["object", "null"] },
    roleReports: { type: "object" },
    debate: { type: "array", items: { type: "object" } },
    links: { type: "object" }
  }
};

const decisionResponseSchema = {
  type: "object",
  required: ["ok", "decisionId", "recommendation", "confidence", "publicRecord", "links"],
  properties: {
    ok: { type: "boolean" },
    decisionId: { type: "string" },
    recommendation: { type: "string" },
    confidence: { type: "string" },
    blockingIssues: { type: "array", items: { type: "string" } },
    warnings: { type: "array", items: { type: "string" } },
    reasons: { type: "array", items: { type: "string" } },
    roleReports: { type: "object" },
    debate: { type: "array", items: { type: "object" } },
    publicRecord: decisionRecordSchema,
    links: { type: "object" }
  }
};

const verificationReportSchema = {
  type: "object",
  required: ["ok", "receiptId", "jobId", "signatureVerified", "checks"],
  properties: {
    ok: { type: "boolean" },
    jobId: { type: ["string", "null"] },
    receiptId: { type: ["string", "null"] },
    keyId: { type: ["string", "null"] },
    signatureVerified: { type: "boolean" },
    checks: {
      type: "array",
      items: {
        type: "object",
        required: ["name", "ok"],
        properties: {
          name: { type: "string" },
          ok: { type: "boolean" },
          details: {}
        }
      }
    }
  }
};

const publicProofSummarySchema = {
  type: "object",
  required: ["jobId", "receiptId", "status", "method", "attempts", "receiptVerified", "links"],
  properties: {
    jobId: { type: "string" },
    receiptId: { type: ["string", "null"] },
    status: { type: "string", enum: ["running", "succeeded", "failed"] },
    method: { type: "string" },
    attempts: { type: "integer" },
    responseStatus: { type: ["integer", "null"] },
    responseOk: { type: "boolean" },
    receiptVerified: { type: "boolean" },
    errorCategory: { type: ["string", "null"] },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
    publicFieldsOnly: { type: "boolean" },
    links: {
      type: "object",
      properties: {
        job: { type: "string" },
        receipt: { type: ["string", "null"] },
        verifyJob: { type: "string" },
        verifyReceipt: { type: ["string", "null"] }
      }
    }
  }
};

const monitoringResponseSchema = {
  type: "object",
  required: ["ok", "status", "windowMs", "failureRate", "stats", "recentFailures"],
  properties: {
    ok: { type: "boolean" },
    status: { type: "string", enum: ["ok", "attention"] },
    windowMs: { type: "integer" },
    failureRate: { type: "number" },
    stats: {
      type: "object",
      properties: {
        total: { type: "integer" },
        succeeded: { type: "integer" },
        failed: { type: "integer" },
        running: { type: "integer" },
        recentTotal: { type: "integer" },
        recentSucceeded: { type: "integer" },
        recentFailed: { type: "integer" },
        recentRunning: { type: "integer" },
        lastUpdatedAt: { type: ["string", "null"] }
      }
    },
    recentFailures: {
      type: "array",
      items: publicProofSummarySchema
    }
  }
};

const actionTemplateSchema = {
  type: "object",
  required: ["id", "status", "category", "title", "description", "paidRoute", "exampleRequest"],
  properties: {
    id: { type: "string" },
    status: { type: "string" },
    category: { type: "string" },
    title: { type: "string" },
    description: { type: "string" },
    tags: {
      type: "array",
      items: { type: "string" }
    },
    searchPhrases: {
      type: "array",
      items: { type: "string" }
    },
    actionId: { type: "string" },
    paidRoute: { type: "string" },
    exampleRequest: webhookRequestSchema,
    buyerValue: { type: "string" },
    targetOwnerValue: { type: "string" },
    verification: {
      type: "array",
      items: { type: "string" }
    }
  }
};

const actionCatalogResponseSchema = {
  type: "object",
  required: [
    "ok",
    "service",
    "activePrimitive",
    "categories",
    "templates",
    "policyModes",
    "scheduledActions",
    "browserHandoff",
    "secretStorage"
  ],
  properties: {
    ok: { type: "boolean" },
    service: { type: "string" },
    activePrimitive: { type: "object" },
    categories: {
      type: "array",
      items: { type: "string" }
    },
    templates: {
      type: "array",
      items: actionTemplateSchema
    },
    policyModes: {
      type: "array",
      items: { type: "object" }
    },
    scheduledActions: { type: "object" },
    browserHandoff: { type: "object" },
    secretStorage: { type: "object" },
    snippets: {
      type: "array",
      items: { type: "object" }
    },
    discoveryKeywords: {
      type: "array",
      items: { type: "string" }
    },
    links: { type: "object" }
  }
};

const quickstartResponseSchema = {
  type: "object",
  required: ["ok", "service", "purpose", "payment", "minimalRequest", "callFlow", "verify"],
  properties: {
    ok: { type: "boolean" },
    service: { type: "string" },
    purpose: { type: "string" },
    recommendedUse: { type: "string" },
    payment: { type: "object" },
    minimalRequest: webhookRequestSchema,
    callFlow: {
      type: "array",
      items: { type: "string" }
    },
    decisionRules: { type: "object" },
    limits: { type: "object" },
    snippets: {
      type: "array",
      items: { type: "object" }
    },
    verify: { type: "object" },
    nextDiscoverySteps: {
      type: "array",
      items: { type: "string" }
    }
  }
};

const pricingResponseSchema = {
  type: "object",
  required: ["ok", "service", "pricingModel", "payment", "paidActions", "freeSurfaces", "buyerGuardrails"],
  properties: {
    ok: { type: "boolean" },
    service: { type: "string" },
    version: { type: "string" },
    generatedAt: { type: "string" },
    pricingModel: { type: "string" },
    summary: { type: "string" },
    payment: { type: "object" },
    paidActions: {
      type: "array",
      items: { type: "object" }
    },
    freeSurfaces: { type: "object" },
    buyerGuardrails: {
      type: "array",
      items: { type: "string" }
    },
    limits: { type: "object" },
    links: { type: "object" }
  }
};

const mcpManifestResponseSchema = {
  type: "object",
  required: ["ok", "service", "version", "status", "recommendedToolName", "tools", "buyerFlow", "links"],
  properties: {
    ok: { type: "boolean" },
    service: { type: "string" },
    version: { type: "string" },
    generatedAt: { type: "string" },
    status: { type: "string" },
    description: { type: "string" },
    recommendedToolName: { type: "string" },
    resourceAliases: {
      type: "array",
      items: { type: "string" }
    },
    discoveryQueries: {
      type: "array",
      items: { type: "string" }
    },
    mcpServer: { type: "object" },
    tools: {
      type: "array",
      items: { type: "object" }
    },
    buyerFlow: {
      type: "array",
      items: { type: "string" }
    },
    guardrails: {
      type: "array",
      items: { type: "string" }
    },
    links: { type: "object" }
  }
};

const snippetsResponseSchema = {
  type: "object",
  required: ["ok", "service", "purpose", "payment", "groups", "links"],
  properties: {
    ok: { type: "boolean" },
    service: { type: "string" },
    purpose: { type: "string" },
    payment: { type: "object" },
    groups: {
      type: "array",
      items: {
        type: "object",
        required: ["id", "title", "snippets"],
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          snippets: {
            type: "array",
            items: {
              type: "object",
              required: ["id", "title", "language", "code"],
              properties: {
                id: { type: "string" },
                title: { type: "string" },
                language: { type: "string" },
                code: { type: "string" }
              }
            }
          }
        }
      }
    },
    links: { type: "object" }
  }
};

const policyCheckResponseSchema = {
  type: "object",
  required: ["ok", "allowed", "action"],
  properties: {
    ok: { type: "boolean" },
    allowed: { type: "boolean" },
    action: { type: "object" },
    target: { type: "object" },
    normalized: { type: "object" },
    policy: { type: "object" },
    warnings: {
      type: "array",
      items: { type: "string" }
    },
    error: {
      type: "object",
      properties: {
        code: { type: "string" },
        message: { type: "string" },
        details: {}
      }
    },
    next: { type: "object" }
  }
};

const browserHandoffRequestSchema = {
  type: "object",
  additionalProperties: true,
  required: ["targetUrl", "actions"],
  properties: {
    targetUrl: {
      type: "string",
      format: "uri",
      description: "Absolute public HTTPS URL for the browser-capable agent to open."
    },
    actions: {
      type: "array",
      minItems: 1,
      maxItems: 12,
      items: {
        type: "object",
        required: ["type"],
        properties: {
          type: {
            type: "string",
            enum: [
              "instruction",
              "navigate",
              "click",
              "type",
              "select",
              "submit",
              "wait_for_text",
              "screenshot",
              "extract",
              "verify"
            ]
          },
          selector: { type: "string" },
          text: { type: "string" },
          value: { type: "string" },
          description: { type: "string" },
          timeoutMs: { type: "integer", minimum: 1000, maximum: config.maxWebhookTimeoutMs }
        }
      }
    },
    returnUrl: {
      type: "string",
      format: "uri",
      description: "Optional public HTTPS callback or result URL for the external browser agent."
    },
    idempotencyKey: {
      type: "string",
      maxLength: 160
    }
  }
};

const browserHandoffResponseSchema = {
  type: "object",
  required: ["ok", "service", "handoff", "policy", "warnings", "next"],
  properties: {
    ok: { type: "boolean" },
    service: { type: "string" },
    handoff: {
      type: "object",
      required: ["id", "status", "executionModel", "paid", "notExecutedByAction402", "target", "actions"],
      properties: {
        id: { type: "string" },
        status: { type: "string" },
        executionModel: { type: "string" },
        paid: { type: "boolean" },
        notExecutedByAction402: { type: "boolean" },
        target: { type: "object" },
        actions: { type: "array" }
      }
    },
    policy: { type: "object" },
    warnings: { type: "array", items: { type: "string" } },
    next: { type: "object" }
  }
};

const schedulePreviewRequestSchema = {
  type: "object",
  additionalProperties: true,
  required: ["webhook", "schedule"],
  properties: {
    webhook: webhookRequestSchema,
    schedule: {
      type: "object",
      required: ["type"],
      properties: {
        type: { type: "string", enum: ["once", "daily"] },
        runAt: {
          type: "string",
          format: "date-time",
          description: "Required for once schedules."
        },
        timeOfDay: {
          type: "string",
          pattern: "^\\d{2}:\\d{2}$",
          description: "Required for daily schedules, UTC by default."
        },
        timezone: { type: "string" }
      }
    }
  }
};

const schedulePreviewResponseSchema = {
  type: "object",
  required: ["ok", "allowed", "status", "paid", "willExecute"],
  properties: {
    ok: { type: "boolean" },
    allowed: { type: "boolean" },
    status: { type: "string" },
    paid: { type: "boolean" },
    willExecute: { type: "boolean" },
    preview: { type: "object" },
    paymentPolicy: { type: "object" },
    warnings: { type: "array", items: { type: "string" } },
    error: { type: "object" },
    next: { type: "object" }
  }
};

const secretStoragePolicySchema = {
  type: "object",
  required: ["status", "activeStorageEndpoint", "safeAlternatives", "neverSend"],
  properties: {
    status: { type: "string" },
    activeStorageEndpoint: { type: "boolean" },
    paid: { type: "boolean" },
    description: { type: "string" },
    why: { type: "string" },
    safeAlternatives: { type: "array", items: { type: "string" } },
    neverSend: { type: "array", items: { type: "string" } },
    futureShape: { type: "object" },
    links: { type: "object" }
  }
};

const canaryEchoResponseSchema = {
  type: "object",
  required: ["ok", "service", "endpoint", "paid", "acceptedFields", "redactionPolicy", "next"],
  properties: {
    ok: { type: "boolean" },
    service: { type: "string" },
    endpoint: { type: "string" },
    paid: { type: "boolean" },
    purpose: { type: "string" },
    receivedAt: { type: "string" },
    requestId: { type: ["string", "null"] },
    acceptedFields: {
      type: "object",
      additionalProperties: {
        type: ["string", "number", "boolean"]
      }
    },
    redactionPolicy: { type: "object" },
    next: { type: "object" }
  }
};

const apiIndexResponseSchema = {
  type: "object",
  required: ["ok", "service", "recommendedStart", "paid", "free", "links"],
  properties: {
    ok: { type: "boolean" },
    service: { type: "string" },
    version: { type: "string" },
    purpose: { type: "string" },
    recommendedStart: {
      type: "array",
      items: { type: "string" }
    },
    paid: {
      type: "array",
      items: { type: "object" }
    },
    free: { type: "object" },
    browserAccess: { type: "object" },
    links: { type: "object" }
  }
};

const discoveryPackSchema = {
  type: "object",
  required: ["service", "schemaVersion", "status", "recommendedFetchOrder", "agentManifest", "apiIndex"],
  properties: {
    service: { type: "string" },
    schemaVersion: { type: "string" },
    status: { type: "string" },
    description: { type: "string" },
    recommendedFetchOrder: {
      type: "array",
      items: { type: "string" }
    },
    agentManifest: { type: "string" },
    wellKnown: {
      type: "array",
      items: { type: "string" }
    },
    textContext: { type: "string" },
    openapi: { type: "string" },
    bazaar: { type: "string" },
    pricing: { type: "string" },
    mcpManifest: { type: "string" },
    robots: { type: "string" },
    sitemap: { type: "string" },
    discoveryPage: { type: "string" },
    discoveryApi: { type: "string" },
    apiIndex: { type: "string" },
    links: { type: "object" }
  }
};

const agentManifestSchema = {
  type: "object",
  required: ["schemaVersion", "name", "canonicalBaseUrl", "paidActions", "freeAgentSurfaces", "links"],
  properties: {
    schemaVersion: { type: "string" },
    name: { type: "string" },
    tagline: { type: "string" },
    status: { type: "string" },
    category: { type: "string" },
    description: { type: "string" },
    canonicalBaseUrl: { type: "string" },
    icon: { type: "string" },
    audience: { type: "array", items: { type: "string" } },
    protocols: { type: "array", items: { type: "string" } },
    tags: { type: "array", items: { type: "string" } },
    discoveryKeywords: { type: "array", items: { type: "string" } },
    buyerPrompt: { type: "string" },
    paidActions: { type: "array", items: { type: "object" } },
    freeAgentSurfaces: { type: "array", items: { type: "object" } },
    browserPages: { type: "array", items: { type: "object" } },
    actionTemplateSummary: { type: "object" },
    useCaseSummary: { type: "object" },
    safety: { type: "object" },
    verification: { type: "object" },
    trust: { type: "object" },
    links: { type: "object" }
  }
};

const trustResponseSchema = {
  type: "object",
  required: [
    "ok",
    "status",
    "trustScore",
    "x402",
    "storage",
    "execution",
    "proofExamples",
    "trustSignals"
  ],
  properties: {
    ok: { type: "boolean" },
    status: { type: "string", enum: ["ok", "attention"] },
    trustScore: {
      type: "object",
      required: ["score", "maxScore", "grade", "summary"],
      properties: {
        score: { type: "integer" },
        maxScore: { type: "integer" },
        grade: { type: "string" },
        summary: { type: "string" },
        components: {
          type: "array",
          items: { type: "object" }
        }
      }
    },
    x402: {
      type: "object",
      properties: {
        enabled: { type: "boolean" },
        scheme: { type: "string" },
        network: { type: "string" },
        price: { type: "string" }
      }
    },
    storage: {
      type: "object",
      properties: {
        driver: { type: "string" },
        durable: { type: "boolean" },
        jobs: { type: "integer" },
        receipts: { type: "integer" }
      }
    },
    execution: {
      type: "object",
      properties: {
        windowMs: { type: "integer" },
        recentFailureRate: { type: "number" },
        stats: { type: "object" }
      }
    },
    proofExamples: {
      type: "object",
      properties: {
        recentVerifiedProofs: { type: "integer" },
        latestVerifiedProofAt: { type: ["string", "null"] }
      }
    },
    trustSignals: {
      type: "array",
      items: { type: "string" }
    }
  }
};

export function publicCapabilities() {
  const targetPolicy = effectiveTargetPolicy(config);
  const handoffCapabilities = publicHandoffCapabilities({ baseUrl: config.publicBaseUrl });
  const scheduleCapabilities = publicScheduleCapabilities({ baseUrl: config.publicBaseUrl });
  const secretStoragePolicy = publicSecretStoragePolicy({ baseUrl: config.publicBaseUrl });
  const discoveryPack = publicDiscoveryPack({ baseUrl: config.publicBaseUrl });
  const pricing = publicPricing({ baseUrl: config.publicBaseUrl });
  const mcpManifest = publicMcpManifest({ baseUrl: config.publicBaseUrl });

  return {
    name: "Action402",
    version: "0.1.0",
    tagline: "Pay. Execute. Prove.",
    description:
      "x402-native paid webhook and API execution for autonomous agents. Agents pay per action, Action402 executes one public HTTPS request with retries and idempotency, then returns a signed proof receipt.",
    shortDescription: "Pay for one public HTTPS action, execute it, and verify the signed receipt.",
    discoveryKeywords: DISCOVERY_KEYWORDS,
    agentPrompt: AGENT_PROMPT,
    publicBaseUrl: config.publicBaseUrl,
    apiIndex: {
      path: "/api",
      description: "Compact machine-readable API index for agents that probe the API root first."
    },
    useCaseTemplates: publicUseCaseTemplates(),
    actionCatalog: {
      path: "/api/actions",
      description:
        "Machine-readable action template catalog for agent task matching, policy mode selection, and buyer snippets.",
      templateCount: publicActionTemplates().length,
      categories: Array.from(new Set(publicActionTemplates().map((template) => template.category))).sort()
    },
    discoveryPack,
    quickstart: {
      path: "/api/quickstart",
      description: "Compact agent quickstart with payment guardrails, minimal request, snippets, and verification flow."
    },
    pricing: {
      path: "/api/pricing",
      description:
        "Machine-readable price, payment route, free surfaces, limits, and buyer guardrails for budget-aware agents.",
      payment: pricing.payment,
      paidActions: pricing.paidActions
    },
    mcpManifest: {
      path: "/api/mcp",
      wellKnownPath: "/.well-known/mcp.json",
      description:
        "Machine-readable MCP wrapper manifest with tool candidates, buyer flow, and x402 guardrails.",
      recommendedToolName: mcpManifest.recommendedToolName,
      status: mcpManifest.status
    },
    snippets: {
      path: "/api/snippets",
      description:
        "Copy-paste snippets for discovery, paid execution, proof verification, and buyer-side payment guardrails."
    },
    decisionGraph: {
      method: "POST",
      path: "/api/decide/webhook",
      recentPath: "/api/decisions/recent",
      paid: false,
      llmEnabled: config.decisionLlmEnabled,
      description:
        "Free deterministic pre-payment decision graph for buyer agents. It checks payment terms, target policy, trust signals, execution readiness, and returns a structured recommendation without executing the target."
    },
    policyCheck: {
      method: "POST",
      path: "/api/policy/check",
      paid: false,
      description:
        "Free preflight check for method, target safety, policy, retry, timeout, and buyer warnings before paying for execution."
    },
    canary: {
      method: "POST",
      path: "/api/canary/echo",
      paid: false,
      description:
        "Free non-sensitive echo target for agents and local canary scripts to verify Action402 request plumbing without calling an external service."
    },
    handoff: handoffCapabilities,
    schedules: scheduleCapabilities,
    secretStorage: secretStoragePolicy,
    x402: {
      enabled: config.x402Enabled,
      scheme: "exact",
      network: config.x402Network,
      price: config.x402Price,
      facilitatorUrl: config.facilitatorUrl,
      requestPaymentHeaders: ["X-PAYMENT", "payment-signature"],
      settlementResponseHeaders: ["X-PAYMENT-RESPONSE", "PAYMENT-RESPONSE"],
      openApiSecurityScheme: "X402Payment"
    },
    browserAccess: {
      cors: publicCorsPolicy(),
      discoveryHeaders: publicDiscoveryHeaderPolicy(),
      description:
        "Machine-readable endpoints support non-credentialed CORS and OPTIONS preflight so browser-based agents can inspect contracts, 402 payment requirements, and payment response headers."
    },
    cachePolicy: publicCachePolicy(),
    actions: [
      {
        id: "execute.webhook",
        aliases: ["execute_webhook", "paid_webhook", "x402_webhook_relay"],
        description:
          "Execute one outbound public HTTPS webhook/API call after x402 payment and return job, receipt, and verification links.",
        method: "POST",
        path: "/api/execute/webhook",
        paid: config.x402Enabled,
        price: config.x402Price,
        useWhen: [
          "An agent needs to trigger a bounded side effect through a public HTTPS webhook/API.",
          "The caller wants to pay per action instead of creating an account or long-lived API key.",
          "The caller needs a signed receipt with request hash, response hash, status, and attempt count."
        ],
        avoidWhen: [
          "The target is localhost, a private network address, or a non-HTTP workflow.",
          "The agent needs long-running orchestration instead of one bounded HTTP action.",
          "The payload must be stored verbatim in the receipt; Action402 stores hashes for proof."
        ],
        requestSchema: webhookRequestSchema,
        responseSchema: executeWebhookResponseSchema
      },
      {
        id: "decide.webhook",
        aliases: ["decide_webhook", "payment_decision_graph", "pre_payment_decision"],
        description:
          "Evaluate whether a buyer agent should pay for one webhook/API execution. This route is free, deterministic, and non-executing.",
        method: "POST",
        path: "/api/decide/webhook",
        paid: false,
        useWhen: [
          "An agent wants a structured pay/do-not-pay recommendation before spending x402 funds.",
          "The buyer needs payment, policy, trust, and execution readiness checks in one response.",
          "The caller wants a decision id to link to a later paid receipt."
        ],
        avoidWhen: [
          "The caller expects the target webhook to execute.",
          "The caller wants an LLM to override deterministic buyer policy."
        ],
        requestSchema: decisionRequestSchema,
        responseSchema: decisionResponseSchema
      },
      {
        id: "execute.guided_webhook",
        aliases: ["guided_webhook", "decision_linked_execution"],
        description:
          "Execute a webhook through the paid route with an approved decision id linked to the job and receipt.",
        method: "POST",
        path: "/api/execute/guided-webhook",
        paid: config.x402Enabled,
        price: config.x402Price,
        useWhen: [
          "An agent already called /api/decide/webhook and wants the execution receipt linked to that decision.",
          "The buyer wants proof that payment followed a deterministic decision graph."
        ],
        avoidWhen: [
          "The decision recommendation is manual_review or do_not_pay.",
          "The action differs from the stored decision."
        ],
        requestSchema: decisionRequestSchema,
        responseSchema: executeWebhookResponseSchema
      },
      {
        id: "canary.echo",
        aliases: ["canary_echo", "self_test_target", "safe_echo_target"],
        description:
          "Return a redacted echo of whitelisted canary fields. Useful as a safe target URL for self-tests before running paid execution.",
        method: "POST",
        path: "/api/canary/echo",
        paid: false,
        useWhen: [
          "An agent wants to verify Action402 routing and JSON handling without paying.",
          "A local settlement canary needs a safe public target endpoint."
        ],
        avoidWhen: [
          "The caller expects a paid execution receipt from this endpoint.",
          "The payload contains secrets or arbitrary data that should be echoed back."
        ],
        responseSchema: canaryEchoResponseSchema
      },
      {
        id: "browser.handoff",
        aliases: ["browser_handoff", "action_handoff", "external_browser_agent_handoff"],
        description:
          "Create a free handoff package for an external browser-capable agent. Action402 does not execute these browser steps.",
        method: "POST",
        path: "/api/handoff/browser",
        paid: false,
        status: BROWSER_HANDOFF_PATTERN.status,
        useWhen: [
          "An agent needs to hand a browser task to another agent that already controls a browser.",
          "The workflow needs structured browser instructions but not Action402 paid browser execution."
        ],
        avoidWhen: [
          "The caller expects Action402 to click, type, or verify screenshots itself.",
          "The browser task requires secret storage inside public Action402."
        ],
        requestSchema: browserHandoffRequestSchema,
        responseSchema: browserHandoffResponseSchema
      },
      {
        id: "schedule.preview",
        aliases: ["schedule_preview", "scheduled_webhook_preview"],
        description:
          "Validate a schedule definition and webhook target policy without charging, storing, waking up, or executing.",
        method: "POST",
        path: "/api/schedules/preview",
        paid: false,
        status: SCHEDULED_ACTION_PATTERN.status,
        useWhen: [
          "An agent wants to check if a scheduled webhook definition is compatible with future Action402 scheduling.",
          "The caller needs target policy feedback before building a scheduler around paid execution."
        ],
        avoidWhen: [
          "The caller expects the schedule to persist or execute later.",
          "The caller expects a paid execution receipt from the preview."
        ],
        requestSchema: schedulePreviewRequestSchema,
        responseSchema: schedulePreviewResponseSchema
      }
    ],
    actionTemplates: publicActionTemplates(),
    policyModes: POLICY_MODES,
    scheduledActions: SCHEDULED_ACTION_PATTERN,
    browserHandoff: BROWSER_HANDOFF_PATTERN,
    secretStoragePolicy: SECRET_STORAGE_PATTERN,
    agentInstructions: {
      oneLine: AGENT_PROMPT,
      callFlow: [
        "Read /api/quickstart, /api/pricing, /api/actions, /api/capabilities, or /openapi.json.",
        "Read /api/agent-manifest, /.well-known/agent.json, or /.well-known/x402 for the canonical machine-readable discovery pack.",
        "Read /api/mcp or /.well-known/mcp.json when building a local MCP wrapper.",
        "Optionally POST the same payload to /api/policy/check before paying.",
        "POST /api/decide/webhook when the buyer needs a structured pay/do-not-pay decision before paying.",
        "Use /api/canary/echo only as a free non-sensitive target check; it does not create a paid receipt.",
        "Use /api/handoff/browser only when a separate browser-capable agent will execute the browser steps.",
        "Use /api/schedules/preview only to validate future schedule shape; it will not execute or charge.",
        "Read /api/secrets/policy before sending target-side authorization headers.",
        "Use /api/snippets for copy-paste buyer and proof verification examples.",
        "Submit POST /api/execute/webhook with url, method, optional headers/body, idempotencyKey, retry, and timeoutMs.",
        "In x402 mode, compare the 402 Payment Required response with /api/pricing, then satisfy it with an x402 buyer client.",
        "Read links.job or links.receipt from the response.",
        "Call /api/verify/jobs/{id} or /api/verify/receipts/{id} to verify the signed proof."
      ],
      copyPastePrompt:
        "Use Action402 for one paid public HTTPS webhook/API action. Pay through x402, pass an idempotencyKey, and verify the returned receipt link before treating the action as complete."
    },
    verification: {
      jobLookup: "/api/jobs/{id}",
      receiptLookup: "/api/receipts/{id}",
      jobReceiptVerification: "/api/verify/jobs/{id}",
      receiptVerification: "/api/verify/receipts/{id}",
      recentProofExamples: "/api/proofs/recent",
      decisionGraph: "/api/decide/webhook",
      recentDecisions: "/api/decisions/recent",
      proofBadge: "/proof/{jobOrReceiptId}",
      integrationSnippets: "/api/snippets",
      receiptSignature: "hmac-sha256",
      activeReceiptKeyId: config.receiptKeyId
    },
    publicProofs: {
      path: "/api/proofs/recent",
      description:
        "Latest verified proof examples with target URL, headers, bodies, hashes, and signatures redacted for public review.",
      redactedFields: [
        "targetUrl",
        "requestHeaders",
        "requestBody",
        "responseHeaders",
        "responseBody",
        "requestHash",
        "responseHash",
        "receiptSignature"
      ]
    },
    monitoring: {
      path: "/api/monitoring/executions",
      description:
        "Durable execution counters and recent failed executions, redacted for public agent/operator checks.",
      defaultWindowMs: 24 * 60 * 60 * 1000
    },
    trust: {
      path: "/api/trust",
      description:
        "Public trust summary combining x402 settings, storage durability, execution counters, proof example counts, and redaction policy."
    },
    statusPage: {
      path: "/status",
      rawHealthPath: "/health",
      description:
        "Browser-friendly runtime status page backed by the raw /health endpoint for operators and human reviewers."
    },
    mcp: {
      recommendedToolName: "execute_webhook",
      discoveryQueries: [
        "Action402",
        "paid webhook execution",
        "x402 webhook receipt",
        "agent action relay",
        "Action402 action catalog",
        "agent quickstart x402",
        "pay per API call",
        "Action402 agent manifest",
        "well-known agent.json",
        "x402 agent discovery manifest",
        "browser action handoff",
        "schedule preview x402",
        "secret storage policy",
        "Slack webhook x402",
        "Discord webhook x402",
        "Telegram bot x402",
        "Zapier webhook x402",
        "Make webhook x402",
        "GitHub Actions dispatch x402"
      ],
      bazaarFlow: [
        "fetch /.well-known/x402, /.well-known/agent.json, or /api/agent-manifest",
        "search_resources query=Action402",
        "inspect the returned resource metadata and price",
        "proxy_tool_call using the discovered resource/tool name",
        "verify links.job or links.receipt after completion"
      ],
      notes:
        "If an MCP client supports x402/Bazaar discovery, prefer the returned resource metadata over hard-coded tool names."
    },
    safety: {
      allowedMethods: ["POST", "PUT", "PATCH", "DELETE"],
      httpsTargetsOnly: !config.allowHttpTargets,
      privateNetworkTargetsBlocked: true,
      maxWebhookTimeoutMs: config.maxWebhookTimeoutMs,
      maxRetryAttempts: config.maxRetryAttempts,
      targetPolicyPreset: config.targetPolicyPreset,
      targetAllowlist: targetPolicy.targetAllowlist,
      targetBlocklist: targetPolicy.targetBlocklist,
      requireTargetAllowlist: targetPolicy.requireTargetAllowlist,
      rateLimit: {
        enabled: config.rateLimitEnabled,
        windowMs: config.rateLimitWindowMs,
        maxRequests: config.rateLimitMaxRequests
      },
      targetQuota: {
        enabled: config.targetQuotaEnabled,
        windowMs: config.targetQuotaWindowMs,
        maxRequests: config.targetQuotaMaxRequests
      },
      retention: {
        jobRetentionMs: config.jobRetentionMs,
        receiptRetentionMs: config.receiptRetentionMs
      },
      storage: {
        driver: config.storeDriver,
        durable: config.storeDriver !== "memory"
      },
      observability: {
        structuredJsonLogs: true,
        requestLogEnabled: config.requestLogEnabled,
        logLevel: config.logLevel
      }
    },
    links: {
      apiIndex: `${config.publicBaseUrl}/api`,
      openapi: `${config.publicBaseUrl}/openapi.json`,
      quickstart: `${config.publicBaseUrl}/api/quickstart`,
      pricingApi: `${config.publicBaseUrl}/api/pricing`,
      discoveryApi: `${config.publicBaseUrl}/api/discovery`,
      mcpManifest: `${config.publicBaseUrl}/api/mcp`,
      wellKnownMcp: `${config.publicBaseUrl}/.well-known/mcp.json`,
      discovery: `${config.publicBaseUrl}/discovery`,
      agentManifest: `${config.publicBaseUrl}/api/agent-manifest`,
      wellKnownAgent: `${config.publicBaseUrl}/.well-known/agent.json`,
      wellKnownAction402: `${config.publicBaseUrl}/.well-known/action402.json`,
      wellKnownX402Bare: `${config.publicBaseUrl}/.well-known/x402`,
      wellKnownX402: `${config.publicBaseUrl}/.well-known/x402.json`,
      robots: `${config.publicBaseUrl}/robots.txt`,
      sitemap: `${config.publicBaseUrl}/sitemap.xml`,
      snippets: `${config.publicBaseUrl}/api/snippets`,
      snippetsGuide: `${config.publicBaseUrl}/snippets`,
      decideWebhook: `${config.publicBaseUrl}/api/decide/webhook`,
      guidedWebhook: `${config.publicBaseUrl}/api/execute/guided-webhook`,
      recentDecisions: `${config.publicBaseUrl}/api/decisions/recent`,
      decisionsPage: `${config.publicBaseUrl}/decisions`,
      policyCheck: `${config.publicBaseUrl}/api/policy/check`,
      canaryEcho: `${config.publicBaseUrl}/api/canary/echo`,
      handoff: `${config.publicBaseUrl}/handoff`,
      handoffCapabilities: `${config.publicBaseUrl}/api/handoff/capabilities`,
      schedules: `${config.publicBaseUrl}/schedules`,
      scheduleCapabilities: `${config.publicBaseUrl}/api/schedules/capabilities`,
      schedulePreview: `${config.publicBaseUrl}/api/schedules/preview`,
      secrets: `${config.publicBaseUrl}/secrets`,
      secretPolicy: `${config.publicBaseUrl}/api/secrets/policy`,
      actionCatalog: `${config.publicBaseUrl}/api/actions`,
      actions: `${config.publicBaseUrl}/actions`,
      bazaar: `${config.publicBaseUrl}/api/bazaar`,
      agentsGuide: `${config.publicBaseUrl}/agents`,
      pricing: `${config.publicBaseUrl}/pricing`,
      onboarding: `${config.publicBaseUrl}/onboarding`,
      useCases: `${config.publicBaseUrl}/use-cases`,
      mcpGuide: `${config.publicBaseUrl}/mcp`,
      trust: `${config.publicBaseUrl}/trust`,
      status: `${config.publicBaseUrl}/status`,
      proofs: `${config.publicBaseUrl}/proofs`,
      proofBadge: `${config.publicBaseUrl}/proof/{jobOrReceiptId}`,
      monitoring: `${config.publicBaseUrl}/monitoring`,
      llms: `${config.publicBaseUrl}/llms.txt`
    }
  };
}

export function openApiSpec() {
  return {
    openapi: "3.1.0",
    info: {
      title: "Action402 API",
      version: "0.1.0",
      description:
        "Paid webhook and API execution for autonomous agents using x402 payments on Base."
    },
    servers: [
      {
        url: config.publicBaseUrl
      }
    ],
    "x-action402-cors": publicCorsPolicy(),
    "x-action402-cache": publicCachePolicy(),
    "x-action402-discovery-headers": publicDiscoveryHeaderPolicy(),
    paths: {
      "/api": {
        get: {
          operationId: "getApiIndex",
          summary: "Fetch compact API index",
          description:
            "Returns a compact machine-readable map of paid action, free discovery, preflight, verification, trust, and browser-access endpoints for agents that start at the API root.",
          responses: {
            "200": {
              description: "Agent-readable API index",
              content: {
                "application/json": {
                  schema: apiIndexResponseSchema
                }
              }
            }
          }
        }
      },
      "/api/discovery": {
        get: {
          operationId: "getDiscoveryPack",
          summary: "Fetch machine-readable discovery pack",
          description:
            "Returns canonical discovery links and recommended fetch order for agents, crawlers, Bazaar/MCP clients, and directories inspecting Action402 before payment.",
          responses: {
            "200": {
              description: "Action402 discovery pack",
              content: {
                "application/json": {
                  schema: discoveryPackSchema
                }
              }
            }
          }
        }
      },
      "/api/pricing": {
        get: {
          operationId: "getPricing",
          summary: "Fetch machine-readable pricing",
          description:
            "Returns the current paid route, exact x402 price/network/payTo, free surfaces, limits, and buyer guardrails so agents can enforce spend policy before paying.",
          responses: {
            "200": {
              description: "Agent-readable pricing and buyer guardrails",
              content: {
                "application/json": {
                  schema: pricingResponseSchema
                }
              }
            }
          }
        }
      },
      "/api/mcp": {
        get: {
          operationId: "getMcpManifest",
          summary: "Fetch MCP wrapper manifest",
          description:
            "Returns a machine-readable manifest for agents or developers mapping Action402 HTTP/x402 routes into local MCP tools. This is a manifest, not a hosted MCP server.",
          responses: {
            "200": {
              description: "MCP wrapper manifest",
              content: {
                "application/json": {
                  schema: mcpManifestResponseSchema
                }
              }
            }
          }
        }
      },
      "/api/execute/webhook": {
        post: {
          operationId: "executeWebhook",
          summary: "Execute one paid webhook/API action",
          description:
            "Protected by x402 when X402_ENABLED=true. Executes one outbound HTTPS request and returns a signed receipt.",
          security: [
            {
              X402Payment: []
            }
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: webhookRequestSchema,
                examples: {
                  basic: {
                    value: {
                      url: "https://example.com/webhook",
                      method: "POST",
                      body: {
                        event: "agent.test",
                        ok: true
                      },
                      idempotencyKey: "agent-test-001",
                      retry: {
                        attempts: 2,
                        backoffMs: 300
                      }
                    }
                  }
                }
              }
            }
          },
          responses: {
            "200": {
              description: "Execution succeeded",
              content: {
                "application/json": {
                  schema: executeWebhookResponseSchema
                }
              }
            },
            "400": {
              description: "Invalid request",
              content: {
                "application/json": {
                  schema: errorSchema
                }
              }
            },
            "402": {
              description: "Payment required by x402 middleware"
            },
            "429": {
              description: "Rate limited",
              content: {
                "application/json": {
                  schema: errorSchema
                }
              }
            },
            "502": {
              description: "Target execution failed",
              content: {
                "application/json": {
                  schema: executeWebhookResponseSchema
                }
              }
            }
          }
        }
      },
      "/api/decide/webhook": {
        post: {
          operationId: "decideWebhook",
          summary: "Evaluate one webhook/API action before payment",
          description:
            "Free deterministic decision graph for buyer agents. It checks payment terms, policy, trust, and execution readiness without executing the target or charging.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: decisionRequestSchema
              }
            }
          },
          responses: {
            "200": {
              description: "Structured pre-payment decision",
              content: {
                "application/json": {
                  schema: decisionResponseSchema
                }
              }
            }
          }
        }
      },
      "/api/execute/guided-webhook": {
        post: {
          operationId: "executeGuidedWebhook",
          summary: "Execute one decision-linked paid webhook/API action",
          description:
            "Protected by x402 when X402_ENABLED=true. Requires or creates a deterministic decision record, then links the approved decision to the paid job and receipt.",
          security: [
            {
              X402Payment: []
            }
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: decisionRequestSchema
              }
            }
          },
          responses: {
            "200": {
              description: "Guided execution succeeded",
              content: {
                "application/json": {
                  schema: executeWebhookResponseSchema
                }
              }
            },
            "402": {
              description: "Payment required by x402 middleware"
            },
            "409": {
              description: "Decision rejected or does not match the action",
              content: {
                "application/json": {
                  schema: errorSchema
                }
              }
            },
            "502": {
              description: "Target execution failed",
              content: {
                "application/json": {
                  schema: executeWebhookResponseSchema
                }
              }
            }
          }
        }
      },
      "/api/decisions/recent": {
        get: {
          operationId: "listRecentDecisions",
          summary: "Fetch recent public decision summaries",
          description:
            "Returns recent redacted decision summaries without target URLs, request headers, request bodies, raw hashes, or receipt signatures.",
          parameters: [
            {
              name: "limit",
              in: "query",
              required: false,
              schema: { type: "integer", minimum: 1, maximum: 50, default: 10 }
            }
          ],
          responses: {
            "200": {
              description: "Recent public decision summaries",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["ok", "decisions"],
                    properties: {
                      ok: { type: "boolean" },
                      redactionPolicy: { type: "object" },
                      decisions: {
                        type: "array",
                        items: decisionRecordSchema
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/api/decisions/{id}": {
        get: {
          operationId: "getDecision",
          summary: "Fetch a redacted decision record",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" }
            }
          ],
          responses: {
            "200": {
              description: "Redacted decision record",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["ok", "decision"],
                    properties: {
                      ok: { type: "boolean" },
                      decision: decisionRecordSchema
                    }
                  }
                }
              }
            },
            "404": {
              description: "Decision not found",
              content: {
                "application/json": {
                  schema: errorSchema
                }
              }
            }
          }
        }
      },
      "/api/jobs/{id}": {
        get: {
          operationId: "getJob",
          summary: "Fetch job status",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" }
            }
          ],
          responses: {
            "200": { description: "Job found" },
            "404": {
              description: "Job not found",
              content: {
                "application/json": {
                  schema: errorSchema
                }
              }
            }
          }
        }
      },
      "/api/receipts/{id}": {
        get: {
          operationId: "getReceipt",
          summary: "Fetch and verify receipt",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" }
            }
          ],
          responses: {
            "200": { description: "Receipt found" },
            "404": {
              description: "Receipt not found",
              content: {
                "application/json": {
                  schema: errorSchema
                }
              }
            }
          }
        }
      },
      "/api/verify/jobs/{id}": {
        get: {
          operationId: "verifyJobReceipt",
          summary: "Verify job and receipt consistency",
          description:
            "Returns an agent-readable proof report covering receipt signature validity plus consistency between the stored job and its linked receipt.",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" }
            }
          ],
          responses: {
            "200": {
              description: "Verification report",
              content: {
                "application/json": {
                  schema: verificationReportSchema
                }
              }
            },
            "404": {
              description: "Job or receipt not found",
              content: {
                "application/json": {
                  schema: errorSchema
                }
              }
            },
            "409": {
              description: "Job exists but no receipt is linked yet",
              content: {
                "application/json": {
                  schema: errorSchema
                }
              }
            }
          }
        }
      },
      "/api/verify/receipts/{id}": {
        get: {
          operationId: "verifyReceipt",
          summary: "Verify receipt proof report",
          description:
            "Returns receipt signature checks and, when the linked job is still retained, full job/receipt consistency checks.",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" }
            }
          ],
          responses: {
            "200": {
              description: "Verification report",
              content: {
                "application/json": {
                  schema: verificationReportSchema
                }
              }
            },
            "404": {
              description: "Receipt not found",
              content: {
                "application/json": {
                  schema: errorSchema
                }
              }
            }
          }
        }
      },
      "/api/proofs/recent": {
        get: {
          operationId: "listRecentProofs",
          summary: "Fetch recent public verified proof examples",
          description:
            "Returns recent verified proof summaries with sensitive target, header, body, hash, and signature details redacted.",
          parameters: [
            {
              name: "limit",
              in: "query",
              required: false,
              schema: { type: "integer", minimum: 1, maximum: 50, default: 10 }
            }
          ],
          responses: {
            "200": {
              description: "Recent public proof summaries",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["ok", "redactionPolicy", "proofs"],
                    properties: {
                      ok: { type: "boolean" },
                      redactionPolicy: { type: "object" },
                      proofs: {
                        type: "array",
                        items: publicProofSummarySchema
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/api/monitoring/executions": {
        get: {
          operationId: "getExecutionMonitoring",
          summary: "Fetch execution monitoring summary",
          description:
            "Returns durable execution counters, recent failure summaries, and process-level request metrics.",
          parameters: [
            {
              name: "windowMs",
              in: "query",
              required: false,
              schema: { type: "integer", minimum: 60000, default: 86400000 }
            }
          ],
          responses: {
            "200": {
              description: "Execution monitoring summary",
              content: {
                "application/json": {
                  schema: monitoringResponseSchema
                }
              }
            }
          }
        }
      },
      "/api/trust": {
        get: {
          operationId: "getTrustSummary",
          summary: "Fetch public trust summary",
          description:
            "Returns redacted public trust signals for agents evaluating whether to use the paid execution route.",
          responses: {
            "200": {
              description: "Trust summary",
              content: {
                "application/json": {
                  schema: trustResponseSchema
                }
              }
            }
          }
        }
      },
      "/api/actions": {
        get: {
          operationId: "getActionCatalog",
          summary: "Fetch machine-readable action catalog",
          description:
            "Returns ready action templates, policy modes, buyer snippets, discovery keywords, and the safe scheduled-action design pattern.",
          responses: {
            "200": {
              description: "Action catalog",
              content: {
                "application/json": {
                  schema: actionCatalogResponseSchema
                }
              }
            }
          }
        }
      },
      "/api/quickstart": {
        get: {
          operationId: "getQuickstart",
          summary: "Fetch compact agent quickstart",
          description:
            "Returns the shortest integration flow for agents: payment guardrails, minimal request, snippets, and proof verification links.",
          responses: {
            "200": {
              description: "Agent quickstart",
              content: {
                "application/json": {
                  schema: quickstartResponseSchema
                }
              }
            }
          }
        }
      },
      "/api/snippets": {
        get: {
          operationId: "getSnippets",
          summary: "Fetch integration snippets",
          description:
            "Returns copy-paste snippets for discovery, paid execution, proof verification, and buyer policy guardrails.",
          responses: {
            "200": {
              description: "Integration snippets",
              content: {
                "application/json": {
                  schema: snippetsResponseSchema
                }
              }
            }
          }
        }
      },
      "/api/agent-manifest": {
        get: {
          operationId: "getAgentManifest",
          summary: "Fetch canonical agent discovery manifest",
          description:
            "Returns the machine-readable discovery pack for agents, crawlers, Bazaar/MCP clients, and directories.",
          responses: {
            "200": {
              description: "Agent discovery manifest",
              content: {
                "application/json": {
                  schema: agentManifestSchema
                }
              }
            }
          }
        }
      },
      "/.well-known/agent.json": {
        get: {
          operationId: "getWellKnownAgentManifest",
          summary: "Fetch well-known agent manifest",
          description:
            "Well-known alias for the canonical Action402 agent discovery manifest.",
          responses: {
            "200": {
              description: "Agent discovery manifest",
              content: {
                "application/json": {
                  schema: agentManifestSchema
                }
              }
            }
          }
        }
      },
      "/.well-known/action402.json": {
        get: {
          operationId: "getWellKnownAction402Manifest",
          summary: "Fetch Action402 well-known manifest",
          description:
            "Action402-specific well-known alias for the canonical Action402 agent discovery manifest.",
          responses: {
            "200": {
              description: "Agent discovery manifest",
              content: {
                "application/json": {
                  schema: agentManifestSchema
                }
              }
            }
          }
        }
      },
      "/.well-known/x402": {
        get: {
          operationId: "getWellKnownX402Manifest",
          summary: "Fetch x402 well-known manifest",
          description:
            "x402scan-compatible well-known fallback alias for the canonical Action402 agent discovery manifest.",
          responses: {
            "200": {
              description: "Agent discovery manifest",
              content: {
                "application/json": {
                  schema: agentManifestSchema
                }
              }
            }
          }
        }
      },
      "/.well-known/x402.json": {
        get: {
          operationId: "getWellKnownX402JsonManifest",
          summary: "Fetch x402 JSON well-known manifest",
          description:
            "x402-specific JSON well-known alias for the canonical Action402 agent discovery manifest.",
          responses: {
            "200": {
              description: "Agent discovery manifest",
              content: {
                "application/json": {
                  schema: agentManifestSchema
                }
              }
            }
          }
        }
      },
      "/.well-known/mcp.json": {
        get: {
          operationId: "getWellKnownMcpManifest",
          summary: "Fetch well-known MCP wrapper manifest",
          description:
            "Well-known alias for the Action402 MCP wrapper manifest. This is a manifest, not a hosted MCP server.",
          responses: {
            "200": {
              description: "MCP wrapper manifest",
              content: {
                "application/json": {
                  schema: mcpManifestResponseSchema
                }
              }
            }
          }
        }
      },
      "/api/policy/check": {
        post: {
          operationId: "checkWebhookPolicy",
          summary: "Preflight check a webhook execution request",
          description:
            "Free pre-payment check for request shape, method, target safety, target policy, retry, timeout, and buyer warnings. It does not execute the target and does not consume target quota.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: webhookRequestSchema
              }
            }
          },
          responses: {
            "200": {
              description: "Policy check result. Validation failures are returned as allowed=false JSON.",
              content: {
                "application/json": {
                  schema: policyCheckResponseSchema
                }
              }
            },
            "400": {
              description: "Invalid JSON body",
              content: {
                "application/json": {
                  schema: errorSchema
                }
              }
            }
          }
        }
      },
      "/api/canary/echo": {
        get: {
          operationId: "getCanaryEcho",
          summary: "Fetch canary echo metadata",
          description:
            "Free non-sensitive self-test target metadata. GET returns the same redacted response shape with no accepted payload fields.",
          responses: {
            "200": {
              description: "Redacted canary echo",
              content: {
                "application/json": {
                  schema: canaryEchoResponseSchema
                }
              }
            }
          }
        },
        post: {
          operationId: "postCanaryEcho",
          summary: "Echo whitelisted canary fields",
          description:
            "Free non-sensitive self-test target. It echoes only whitelisted scalar canary fields and does not create a paid execution receipt.",
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  additionalProperties: true,
                  properties: {
                    event: { type: "string" },
                    scenario: { type: "string" },
                    runId: { type: "string" },
                    source: { type: "string" },
                    generatedAt: { type: "string" }
                  }
                }
              }
            }
          },
          responses: {
            "200": {
              description: "Redacted canary echo",
              content: {
                "application/json": {
                  schema: canaryEchoResponseSchema
                }
              }
            }
          }
        }
      },
      "/api/handoff/capabilities": {
        get: {
          operationId: "getHandoffCapabilities",
          summary: "Fetch browser handoff capabilities",
          description:
            "Returns the free browser/action handoff contract. The public MVP creates handoff packages only and does not execute browser automation.",
          responses: {
            "200": {
              description: "Browser handoff capabilities"
            }
          }
        }
      },
      "/api/handoff/browser": {
        post: {
          operationId: "createBrowserHandoff",
          summary: "Create a browser/action handoff package",
          description:
            "Creates a structured package for an external browser-capable agent. This route is free and does not execute browser steps.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: browserHandoffRequestSchema
              }
            }
          },
          responses: {
            "200": {
              description: "Browser handoff package",
              content: {
                "application/json": {
                  schema: browserHandoffResponseSchema
                }
              }
            },
            "400": {
              description: "Invalid handoff request",
              content: {
                "application/json": {
                  schema: errorSchema
                }
              }
            }
          }
        }
      },
      "/api/schedules/capabilities": {
        get: {
          operationId: "getScheduleCapabilities",
          summary: "Fetch schedule preview capabilities",
          description:
            "Returns schedule preview capability metadata. Durable paid scheduling is intentionally not active yet.",
          responses: {
            "200": {
              description: "Schedule preview capabilities"
            }
          }
        }
      },
      "/api/schedules/preview": {
        post: {
          operationId: "previewSchedule",
          summary: "Preview a future scheduled webhook",
          description:
            "Validates schedule shape and webhook target policy without charging, storing, waking up, or executing.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: schedulePreviewRequestSchema
              }
            }
          },
          responses: {
            "200": {
              description: "Schedule preview result. Validation failures are returned as allowed=false JSON.",
              content: {
                "application/json": {
                  schema: schedulePreviewResponseSchema
                }
              }
            },
            "400": {
              description: "Invalid JSON body",
              content: {
                "application/json": {
                  schema: errorSchema
                }
              }
            }
          }
        }
      },
      "/api/secrets/policy": {
        get: {
          operationId: "getSecretPolicy",
          summary: "Fetch public secret storage policy",
          description:
            "Explains why the public MVP does not store target-side secrets and lists safe alternatives for authenticated targets.",
          responses: {
            "200": {
              description: "Secret storage policy",
              content: {
                "application/json": {
                  schema: secretStoragePolicySchema
                }
              }
            }
          }
        }
      },
      "/api/capabilities": {
        get: {
          operationId: "getCapabilities",
          summary: "Fetch agent-readable service capabilities",
          responses: {
            "200": {
              description: "Capabilities document"
            }
          }
        }
      },
      "/api/bazaar": {
        get: {
          operationId: "getBazaarMetadata",
          summary: "Fetch Bazaar metadata",
          responses: {
            "200": {
              description: "Bazaar metadata"
            }
          }
        }
      },
      "/robots.txt": {
        get: {
          operationId: "getRobotsTxt",
          summary: "Fetch robots.txt with agent discovery hints",
          responses: {
            "200": {
              description: "Robots file"
            }
          }
        }
      },
      "/sitemap.xml": {
        get: {
          operationId: "getSitemapXml",
          summary: "Fetch sitemap including agent-facing surfaces",
          responses: {
            "200": {
              description: "Sitemap XML"
            }
          }
        }
      },
      "/proof/{id}": {
        get: {
          operationId: "renderProofBadge",
          summary: "Render public proof badge page",
          description:
            "Browser-friendly proof page for a job id or receipt id. The page fetches the verification API client-side.",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" }
            }
          ],
          responses: {
            "200": {
              description: "HTML proof badge page"
            }
          }
        }
      },
      "/health": {
        get: {
          operationId: "getHealth",
          summary: "Health check",
          responses: {
            "200": {
              description: "Service is running"
            }
          }
        }
      }
    },
    components: {
      securitySchemes: {
        X402Payment: {
          type: "apiKey",
          in: "header",
          name: "X-PAYMENT",
          description:
            "x402 payment payload for paid execution. Make the first request without this header to receive the 402 payment requirements, then retry with X-PAYMENT or payment-signature through a compatible x402 buyer client."
        }
      },
      schemas: {
        WebhookRequest: webhookRequestSchema,
        ExecuteWebhookResponse: executeWebhookResponseSchema,
        DecisionRequest: decisionRequestSchema,
        DecisionResponse: decisionResponseSchema,
        DecisionRecord: decisionRecordSchema,
        VerificationReport: verificationReportSchema,
        PublicProofSummary: publicProofSummarySchema,
        MonitoringResponse: monitoringResponseSchema,
        ActionTemplate: actionTemplateSchema,
        ActionCatalogResponse: actionCatalogResponseSchema,
        QuickstartResponse: quickstartResponseSchema,
        PricingResponse: pricingResponseSchema,
        McpManifestResponse: mcpManifestResponseSchema,
        SnippetsResponse: snippetsResponseSchema,
        PolicyCheckResponse: policyCheckResponseSchema,
        BrowserHandoffRequest: browserHandoffRequestSchema,
        BrowserHandoffResponse: browserHandoffResponseSchema,
        SchedulePreviewRequest: schedulePreviewRequestSchema,
        SchedulePreviewResponse: schedulePreviewResponseSchema,
        SecretStoragePolicy: secretStoragePolicySchema,
        CanaryEchoResponse: canaryEchoResponseSchema,
        ApiIndexResponse: apiIndexResponseSchema,
        DiscoveryPack: discoveryPackSchema,
        AgentManifest: agentManifestSchema,
        TrustResponse: trustResponseSchema,
        Error: errorSchema
      }
    }
  };
}

export { webhookRequestSchema, executeWebhookResponseSchema };
