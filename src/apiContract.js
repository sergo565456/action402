import { config } from "./config.js";
import { effectiveTargetPolicy } from "./targetPolicy.js";

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

export function publicCapabilities() {
  const targetPolicy = effectiveTargetPolicy(config);

  return {
    name: "Action402",
    version: "0.1.0",
    tagline: "Pay. Execute. Prove.",
    description:
      "Paid webhook and API execution for autonomous agents using x402 payments on Base.",
    publicBaseUrl: config.publicBaseUrl,
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
        method: "POST",
        path: "/api/execute/webhook",
        paid: config.x402Enabled,
        requestSchema: webhookRequestSchema,
        responseSchema: executeWebhookResponseSchema
      }
    ],
    verification: {
      jobLookup: "/api/jobs/{id}",
      receiptLookup: "/api/receipts/{id}",
      jobReceiptVerification: "/api/verify/jobs/{id}",
      receiptVerification: "/api/verify/receipts/{id}",
      receiptSignature: "hmac-sha256",
      activeReceiptKeyId: config.receiptKeyId
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
      bazaar: `${config.publicBaseUrl}/api/bazaar`
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
        Error: errorSchema
      }
    }
  };
}

export { webhookRequestSchema, executeWebhookResponseSchema };
