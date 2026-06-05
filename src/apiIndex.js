import { config } from "./config.js";
import { publicCorsPolicy } from "./cors.js";
import { publicCachePolicy } from "./cachePolicy.js";
import { publicDiscoveryHeaderPolicy } from "./discoveryHeaders.js";

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
      "/api/discovery",
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
      },
      {
        id: "execute.guided_webhook",
        method: "POST",
        path: "/api/execute/guided-webhook",
        paid: config.x402Enabled,
        price: config.x402Price,
        network: config.x402Network,
        description: "Execute one approved decision-linked public HTTPS request and return job plus signed receipt links."
      }
    ],
    free: {
      discovery: [
        "/api",
        "/api/discovery",
        "/api/agent-manifest",
        "/.well-known/agent.json",
        "/.well-known/x402",
        "/.well-known/x402.json",
        "/.well-known/mcp.json",
        "/api/capabilities",
        "/api/pricing",
      "/api/mcp",
      "/api/actions",
      "/cookbooks",
      "/built-with-action402",
      "/submit",
      "/examples/postman/action402.postman_collection.json",
      "/skills/action402/SKILL.md",
      "/api/quickstart",
        "/api/bazaar",
        "/openapi.json",
        "/llms.txt",
        "/robots.txt",
        "/sitemap.xml"
      ],
      preflight: ["/api/policy/check", "/api/canary/echo"],
      decision: ["/api/decide/webhook", "/api/decisions/{id}", "/api/decisions/recent", "/decision/{id}", "/decisions"],
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
      trustAndMonitoring: ["/status", "/health", "/api/trust", "/api/monitoring/executions"]
    },
    browserAccess: {
      cors: publicCorsPolicy(),
      credentialsRequired: false
    },
    cachePolicy: publicCachePolicy(),
    discoveryHeaders: publicDiscoveryHeaderPolicy(),
    links: {
      self: absoluteUrl("/api"),
      discovery: absoluteUrl("/api/discovery"),
      executeWebhook: absoluteUrl("/api/execute/webhook"),
      guidedWebhook: absoluteUrl("/api/execute/guided-webhook"),
      decideWebhook: absoluteUrl("/api/decide/webhook"),
      recentDecisions: absoluteUrl("/api/decisions/recent"),
      capabilities: absoluteUrl("/api/capabilities"),
      pricing: absoluteUrl("/api/pricing"),
      mcpManifest: absoluteUrl("/api/mcp"),
      wellKnownMcp: absoluteUrl("/.well-known/mcp.json"),
      agentManifest: absoluteUrl("/api/agent-manifest"),
      wellKnownAgent: absoluteUrl("/.well-known/agent.json"),
      wellKnownX402: absoluteUrl("/.well-known/x402"),
      wellKnownX402Json: absoluteUrl("/.well-known/x402.json"),
      quickstart: absoluteUrl("/api/quickstart"),
      actionCatalog: absoluteUrl("/api/actions"),
      cookbooks: absoluteUrl("/cookbooks"),
      builtWith: absoluteUrl("/built-with-action402"),
      submit: absoluteUrl("/submit"),
      postmanCollection: absoluteUrl("/examples/postman/action402.postman_collection.json"),
      agentSkill: absoluteUrl("/skills/action402/SKILL.md"),
      bazaar: absoluteUrl("/api/bazaar"),
      openapi: absoluteUrl("/openapi.json"),
      llms: absoluteUrl("/llms.txt"),
      policyCheck: absoluteUrl("/api/policy/check"),
      canaryEcho: absoluteUrl("/api/canary/echo"),
      snippets: absoluteUrl("/api/snippets"),
      status: absoluteUrl("/status"),
      health: absoluteUrl("/health"),
      trust: absoluteUrl("/api/trust"),
      monitoring: absoluteUrl("/api/monitoring/executions")
    }
  };
}
