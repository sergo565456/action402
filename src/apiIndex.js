import { config } from "./config.js";
import { publicCorsPolicy } from "./cors.js";
import { publicCachePolicy } from "./cachePolicy.js";

function absoluteUrl(path) {
  const baseUrl = String(config.publicBaseUrl || "").replace(/\/+$/, "");
  return `${baseUrl}${path}`;
}

export function publicApiIndex() {
  return {
    ok: true,
    service: "Action402",
    version: "0.1.0",
    purpose:
      "Agent-readable API index for Action402 paid x402 webhook/API execution, discovery, policy checks, and receipt verification.",
    recommendedStart: [
      "/api/quickstart",
      "/api/pricing",
      "/api/mcp",
      "/api/capabilities",
      "/api/actions",
      "/api/bazaar",
      "/openapi.json",
      "/llms.txt"
    ],
    paid: [
      {
        id: "execute.webhook",
        method: "POST",
        path: "/api/execute/webhook",
        paid: config.x402Enabled,
        price: config.x402Price,
        network: config.x402Network,
        description: "Execute one bounded public HTTPS request and return job plus signed receipt links."
      }
    ],
    free: {
      discovery: [
        "/api",
        "/api/agent-manifest",
        "/.well-known/agent.json",
        "/.well-known/mcp.json",
        "/api/capabilities",
        "/api/pricing",
        "/api/mcp",
        "/api/actions",
        "/api/quickstart",
        "/api/bazaar",
        "/openapi.json",
        "/llms.txt",
        "/robots.txt",
        "/sitemap.xml"
      ],
      preflight: ["/api/policy/check", "/api/canary/echo"],
      verification: [
        "/api/jobs/{id}",
        "/api/receipts/{id}",
        "/api/verify/jobs/{id}",
        "/api/verify/receipts/{id}",
        "/api/proofs/recent",
        "/proof/{jobOrReceiptId}"
      ],
      advancedSurfaces: [
        "/api/handoff/capabilities",
        "/api/handoff/browser",
        "/api/schedules/capabilities",
        "/api/schedules/preview",
        "/api/secrets/policy"
      ],
      trustAndMonitoring: ["/api/trust", "/api/monitoring/executions"]
    },
    browserAccess: {
      cors: publicCorsPolicy(),
      credentialsRequired: false
    },
    cachePolicy: publicCachePolicy(),
    links: {
      self: absoluteUrl("/api"),
      executeWebhook: absoluteUrl("/api/execute/webhook"),
      capabilities: absoluteUrl("/api/capabilities"),
      pricing: absoluteUrl("/api/pricing"),
      mcpManifest: absoluteUrl("/api/mcp"),
      wellKnownMcp: absoluteUrl("/.well-known/mcp.json"),
      agentManifest: absoluteUrl("/api/agent-manifest"),
      wellKnownAgent: absoluteUrl("/.well-known/agent.json"),
      quickstart: absoluteUrl("/api/quickstart"),
      actionCatalog: absoluteUrl("/api/actions"),
      bazaar: absoluteUrl("/api/bazaar"),
      openapi: absoluteUrl("/openapi.json"),
      llms: absoluteUrl("/llms.txt"),
      policyCheck: absoluteUrl("/api/policy/check"),
      canaryEcho: absoluteUrl("/api/canary/echo"),
      snippets: absoluteUrl("/api/snippets"),
      trust: absoluteUrl("/api/trust"),
      monitoring: absoluteUrl("/api/monitoring/executions")
    }
  };
}
