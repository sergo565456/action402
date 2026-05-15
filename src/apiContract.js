import { config } from "./config.js";
import { effectiveTargetPolicy } from "./targetPolicy.js";
import { AGENT_PROMPT, DISCOVERY_KEYWORDS } from "./agentDiscovery.js";
import { POLICY_MODES, SCHEDULED_ACTION_PATTERN, publicActionTemplates } from "./actionCatalog.js";
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
  required: ["ok", "service", "activePrimitive", "categories", "templates", "policyModes", "scheduledActions"],
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
    useCaseTemplates: publicUseCaseTemplates(),
    actionCatalog: {
      path: "/api/actions",
      description:
        "Machine-readable action template catalog for agent task matching, policy mode selection, and buyer snippets.",
      templateCount: publicActionTemplates().length,
      categories: Array.from(new Set(publicActionTemplates().map((template) => template.category))).sort()
    },
    quickstart: {
      path: "/api/quickstart",
      description: "Compact agent quickstart with payment guardrails, minimal request, snippets, and verification flow."
    },
    snippets: {
      path: "/api/snippets",
      description:
        "Copy-paste snippets for discovery, paid execution, proof verification, and buyer-side payment guardrails."
    },
    policyCheck: {
      method: "POST",
      path: "/api/policy/check",
      paid: false,
      description:
        "Free preflight check for method, target safety, policy, retry, timeout, and buyer warnings before paying for execution."
    },
    x402: {
      enabled: config.x402Enabled,
      scheme: "exact",
      network: config.x402Network,
      price: config.x402Price,
      facilitatorUrl: config.facilitatorUrl
    },
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
      }
    ],
    actionTemplates: publicActionTemplates(),
    policyModes: POLICY_MODES,
    scheduledActions: SCHEDULED_ACTION_PATTERN,
    agentInstructions: {
      oneLine: AGENT_PROMPT,
      callFlow: [
        "Read /api/quickstart, /api/actions, /api/capabilities, or /openapi.json.",
        "Optionally POST the same payload to /api/policy/check before paying.",
        "Use /api/snippets for copy-paste buyer and proof verification examples.",
        "Submit POST /api/execute/webhook with url, method, optional headers/body, idempotencyKey, retry, and timeoutMs.",
        "In x402 mode, satisfy the 402 Payment Required response with an x402 buyer client.",
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
        "Slack webhook x402",
        "Discord webhook x402",
        "Telegram bot x402",
        "Zapier webhook x402",
        "Make webhook x402",
        "GitHub Actions dispatch x402"
      ],
      bazaarFlow: [
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
      openapi: `${config.publicBaseUrl}/openapi.json`,
      quickstart: `${config.publicBaseUrl}/api/quickstart`,
      snippets: `${config.publicBaseUrl}/api/snippets`,
      snippetsGuide: `${config.publicBaseUrl}/snippets`,
      policyCheck: `${config.publicBaseUrl}/api/policy/check`,
      actionCatalog: `${config.publicBaseUrl}/api/actions`,
      actions: `${config.publicBaseUrl}/actions`,
      bazaar: `${config.publicBaseUrl}/api/bazaar`,
      agentsGuide: `${config.publicBaseUrl}/agents`,
      pricing: `${config.publicBaseUrl}/pricing`,
      onboarding: `${config.publicBaseUrl}/onboarding`,
      useCases: `${config.publicBaseUrl}/use-cases`,
      mcpGuide: `${config.publicBaseUrl}/mcp`,
      trust: `${config.publicBaseUrl}/trust`,
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
    paths: {
      "/api/execute/webhook": {
        post: {
          summary: "Execute one paid webhook/API action",
          description:
            "Protected by x402 when X402_ENABLED=true. Executes one outbound HTTPS request and returns a signed receipt.",
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
      "/api/jobs/{id}": {
        get: {
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
      "/api/policy/check": {
        post: {
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
      "/api/capabilities": {
        get: {
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
          summary: "Fetch Bazaar metadata",
          responses: {
            "200": {
              description: "Bazaar metadata"
            }
          }
        }
      },
      "/proof/{id}": {
        get: {
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
      schemas: {
        WebhookRequest: webhookRequestSchema,
        ExecuteWebhookResponse: executeWebhookResponseSchema,
        VerificationReport: verificationReportSchema,
        PublicProofSummary: publicProofSummarySchema,
        MonitoringResponse: monitoringResponseSchema,
        ActionTemplate: actionTemplateSchema,
        ActionCatalogResponse: actionCatalogResponseSchema,
        QuickstartResponse: quickstartResponseSchema,
        SnippetsResponse: snippetsResponseSchema,
        PolicyCheckResponse: policyCheckResponseSchema,
        TrustResponse: trustResponseSchema,
        Error: errorSchema
      }
    }
  };
}

export { webhookRequestSchema, executeWebhookResponseSchema };
