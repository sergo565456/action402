import { config } from "./config.js";

export function executeWebhookRouteConfig() {
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
      extensions: {
        bazaar: {
          discoverable: true,
          category: "agent-infrastructure",
          tags: ["x402", "webhook", "execution", "receipts", "ai-agents", "idempotency", "retries"],
          info: {
            input: {
              type: "http",
              method: "POST",
              bodyType: "json",
              body: {
                url: "https://example.com/webhook",
                method: "POST",
                body: {
                  event: "agent.test",
                  message: "hello from an x402 buyer"
                },
                idempotencyKey: "agent-test-001",
                retry: {
                  attempts: 2,
                  backoffMs: 300
                }
              }
            },
            output: {
              type: "json",
              example: {
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
              }
            }
          }
        }
      }
    }
  };
}

export function publicBazaarMetadata() {
  return {
    name: "Action402",
    tagline: "Pay. Execute. Prove.",
    resource: `${config.publicBaseUrl}/api/execute/webhook`,
    x402Enabled: config.x402Enabled,
    routeConfig: executeWebhookRouteConfig()
  };
}
