import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { app } from "../src/server.js";
import { applyVercelRewritePath, normalizeVercelRequestUrl } from "../api/index.js";
import { validateBazaarDiscovery } from "../src/bazaar.js";
import { buildReceipt } from "../src/receipt.js";
import { createJob, resetStoreForTests, saveReceipt } from "../src/store.js";

async function request(path, options = {}) {
  const server = app.listen(0);
  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}${path}`, options);
    const body = await response.json();
    return { response, body };
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function requestRaw(path, options = {}) {
  const server = app.listen(0);
  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}${path}`, options);
    const body = await response.text();
    return { response, body };
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function requestText(path) {
  return requestRaw(path);
}

test("capabilities document exposes execute webhook action", async () => {
  const { response, body } = await request("/api/capabilities");

  assert.equal(response.status, 200);
  assert.equal(body.name, "Action402");
  assert.equal(body.actions[0].id, "execute.webhook");
  assert.equal(body.actions[0].requestSchema.required.includes("url"), true);
  assert.equal(body.safety.privateNetworkTargetsBlocked, true);
  assert.equal(body.safety.targetPolicyPreset, "open");
  assert.equal(body.safety.targetQuota.enabled, true);
  assert.equal(body.verification.jobReceiptVerification, "/api/verify/jobs/{id}");
  assert.ok(body.discoveryKeywords.includes("paid webhook execution"));
  assert.equal(body.agentPrompt.includes("Use Action402"), true);
  assert.equal(body.agentInstructions.callFlow.some((step) => step.includes("/api/verify")), true);
  assert.equal(body.mcp.recommendedToolName, "execute_webhook");
  assert.equal(body.apiIndex.path, "/api");
  assert.equal(body.links.apiIndex.endsWith("/api"), true);
  assert.equal(body.links.llms.endsWith("/llms.txt"), true);
  assert.equal(body.links.discovery.endsWith("/discovery"), true);
  assert.equal(body.links.agentManifest.endsWith("/api/agent-manifest"), true);
  assert.equal(body.links.wellKnownAgent.endsWith("/.well-known/agent.json"), true);
  assert.equal(body.links.robots.endsWith("/robots.txt"), true);
  assert.equal(body.links.sitemap.endsWith("/sitemap.xml"), true);
  assert.equal(body.links.useCases.endsWith("/use-cases"), true);
  assert.equal(body.links.actions.endsWith("/actions"), true);
  assert.equal(body.links.quickstart.endsWith("/api/quickstart"), true);
  assert.equal(body.links.pricingApi.endsWith("/api/pricing"), true);
  assert.equal(body.links.mcpManifest.endsWith("/api/mcp"), true);
  assert.equal(body.links.wellKnownMcp.endsWith("/.well-known/mcp.json"), true);
  assert.equal(body.links.policyCheck.endsWith("/api/policy/check"), true);
  assert.equal(body.links.canaryEcho.endsWith("/api/canary/echo"), true);
  assert.equal(body.links.snippets.endsWith("/api/snippets"), true);
  assert.equal(body.links.snippetsGuide.endsWith("/snippets"), true);
  assert.equal(body.links.actionCatalog.endsWith("/api/actions"), true);
  assert.equal(body.links.mcpGuide.endsWith("/mcp"), true);
  assert.equal(body.links.trust.endsWith("/trust"), true);
  assert.equal(body.links.status.endsWith("/status"), true);
  assert.equal(body.trust.path, "/api/trust");
  assert.equal(body.statusPage.path, "/status");
  assert.equal(body.discoveryPack.status, "active");
  assert.equal(body.discoveryPack.apiIndex.endsWith("/api"), true);
  assert.equal(body.discoveryPack.agentManifest.endsWith("/api/agent-manifest"), true);
  assert.ok(body.discoveryPack.wellKnown.some((url) => url.endsWith("/.well-known/agent.json")));
  assert.equal(body.quickstart.path, "/api/quickstart");
  assert.equal(body.pricing.path, "/api/pricing");
  assert.equal(body.pricing.payment.route.endsWith("/api/execute/webhook"), true);
  assert.equal(body.mcpManifest.path, "/api/mcp");
  assert.equal(body.mcpManifest.wellKnownPath, "/.well-known/mcp.json");
  assert.equal(body.policyCheck.path, "/api/policy/check");
  assert.equal(body.policyCheck.paid, false);
  assert.equal(body.canary.path, "/api/canary/echo");
  assert.equal(body.canary.paid, false);
  assert.equal(body.snippets.path, "/api/snippets");
  assert.equal(body.handoff.path, "/api/handoff/browser");
  assert.equal(body.handoff.paid, false);
  assert.equal(body.schedules.previewPath, "/api/schedules/preview");
  assert.equal(body.schedules.status, "preview-only");
  assert.equal(body.secretStorage.status, "not-supported-in-public-mvp");
  assert.equal(body.browserAccess.cors.enabled, true);
  assert.equal(body.browserAccess.cors.allowOrigin, "*");
  assert.equal(body.browserAccess.cors.allowCredentials, false);
  assert.ok(body.browserAccess.cors.requestHeaders.includes("x-payment"));
  assert.ok(body.browserAccess.cors.requestHeaders.includes("payment-signature"));
  assert.ok(body.browserAccess.cors.exposedHeaders.includes("link"));
  assert.ok(body.browserAccess.cors.exposedHeaders.includes("x-action402-agent-entry"));
  assert.ok(body.browserAccess.cors.exposedHeaders.includes("x-payment-response"));
  assert.ok(body.browserAccess.cors.exposedHeaders.includes("x-action402-cache-policy"));
  assert.equal(body.browserAccess.discoveryHeaders.agentEntryHeader, "X-Action402-Agent-Entry");
  assert.ok(body.browserAccess.discoveryHeaders.links.some((link) => link.path === "/api/mcp"));
  assert.ok(body.cachePolicy.stableDiscoveryCacheControl.includes("s-maxage=300"));
  assert.equal(body.cachePolicy.dynamicCacheControl, "no-store");
  assert.equal(body.cachePolicy.responseHeader, "X-Action402-Cache-Policy");
  assert.ok(body.x402.requestPaymentHeaders.includes("X-PAYMENT"));
  assert.ok(body.x402.requestPaymentHeaders.includes("payment-signature"));
  assert.ok(body.x402.settlementResponseHeaders.includes("X-PAYMENT-RESPONSE"));
  assert.equal(body.x402.openApiSecurityScheme, "X402Payment");
  assert.equal(body.actionCatalog.path, "/api/actions");
  assert.equal(body.verification.proofBadge, "/proof/{jobOrReceiptId}");
  assert.equal(body.verification.integrationSnippets, "/api/snippets");
  assert.ok(body.discoveryKeywords.includes("pay per API call"));
  assert.ok(body.discoveryKeywords.includes("Action402 action catalog"));
  assert.ok(body.discoveryKeywords.includes("Discord webhook x402"));
  assert.ok(body.discoveryKeywords.includes("Slack webhook x402"));
  assert.ok(body.useCaseTemplates.length >= 6);
  assert.ok(body.actionTemplates.length >= 9);
  assert.ok(body.actions.some((action) => action.id === "browser.handoff"));
  assert.ok(body.actions.some((action) => action.id === "schedule.preview"));
  assert.ok(body.actions.some((action) => action.id === "canary.echo"));
  assert.ok(body.policyModes.some((mode) => mode.id === "open-public-https"));
  assert.equal(body.scheduledActions.status, "preview-only");
});

test("openapi document exposes execute webhook path", async () => {
  const { response, body } = await request("/openapi.json");
  const operations = Object.values(body.paths).flatMap((pathItem) =>
    Object.values(pathItem).filter((operation) => operation && typeof operation === "object" && operation.operationId)
  );
  const operationIds = operations.map((operation) => operation.operationId);

  assert.equal(response.status, 200);
  assert.equal(body.openapi, "3.1.0");
  assert.ok(body.paths["/api"].get);
  assert.equal(body.paths["/api"].get.operationId, "getApiIndex");
  assert.equal(body.paths["/api/pricing"].get.operationId, "getPricing");
  assert.equal(body.paths["/api/mcp"].get.operationId, "getMcpManifest");
  assert.ok(body.paths["/api/execute/webhook"].post);
  assert.equal(body.paths["/api/execute/webhook"].post.operationId, "executeWebhook");
  assert.deepEqual(body.paths["/api/execute/webhook"].post.security, [{ X402Payment: [] }]);
  assert.ok(body.paths["/api/verify/jobs/{id}"].get);
  assert.ok(body.paths["/api/verify/receipts/{id}"].get);
  assert.ok(body.paths["/api/proofs/recent"].get);
  assert.ok(body.paths["/api/monitoring/executions"].get);
  assert.ok(body.paths["/api/trust"].get);
  assert.ok(body.paths["/api/actions"].get);
  assert.ok(body.paths["/api/quickstart"].get);
  assert.ok(body.paths["/api/pricing"].get);
  assert.ok(body.paths["/api/mcp"].get);
  assert.ok(body.paths["/api/agent-manifest"].get);
  assert.ok(body.paths["/.well-known/agent.json"].get);
  assert.ok(body.paths["/.well-known/mcp.json"].get);
  assert.ok(body.paths["/api/policy/check"].post);
  assert.ok(body.paths["/api/canary/echo"].get);
  assert.ok(body.paths["/api/canary/echo"].post);
  assert.ok(body.paths["/api/snippets"].get);
  assert.ok(body.paths["/api/handoff/capabilities"].get);
  assert.ok(body.paths["/api/handoff/browser"].post);
  assert.ok(body.paths["/api/schedules/capabilities"].get);
  assert.ok(body.paths["/api/schedules/preview"].post);
  assert.ok(body.paths["/api/secrets/policy"].get);
  assert.ok(body.paths["/proof/{id}"].get);
  assert.ok(body.paths["/robots.txt"].get);
  assert.ok(body.paths["/sitemap.xml"].get);
  assert.ok(operationIds.includes("checkWebhookPolicy"));
  assert.ok(operationIds.includes("verifyJobReceipt"));
  assert.ok(operationIds.includes("getBazaarMetadata"));
  assert.equal(operationIds.length, new Set(operationIds).size);
  assert.equal(operationIds.length >= 30, true);
  assert.equal(body["x-action402-cors"].enabled, true);
  assert.ok(body["x-action402-cors"].exposedHeaders.includes("payment-response"));
  assert.ok(body["x-action402-cache"].stableDiscoveryCacheControl.includes("s-maxage=300"));
  assert.ok(body["x-action402-discovery-headers"].links.some((link) => link.path === "/openapi.json"));
  assert.equal(body.components.securitySchemes.X402Payment.type, "apiKey");
  assert.equal(body.components.securitySchemes.X402Payment.in, "header");
  assert.equal(body.components.securitySchemes.X402Payment.name, "X-PAYMENT");
  assert.ok(body.components.schemas.WebhookRequest);
  assert.ok(body.components.schemas.VerificationReport);
  assert.ok(body.components.schemas.PublicProofSummary);
  assert.ok(body.components.schemas.MonitoringResponse);
  assert.ok(body.components.schemas.ActionCatalogResponse);
  assert.ok(body.components.schemas.QuickstartResponse);
  assert.ok(body.components.schemas.PricingResponse);
  assert.ok(body.components.schemas.McpManifestResponse);
  assert.ok(body.components.schemas.PolicyCheckResponse);
  assert.ok(body.components.schemas.CanaryEchoResponse);
  assert.ok(body.components.schemas.ApiIndexResponse);
  assert.ok(body.components.schemas.SnippetsResponse);
  assert.ok(body.components.schemas.BrowserHandoffRequest);
  assert.ok(body.components.schemas.BrowserHandoffResponse);
  assert.ok(body.components.schemas.SchedulePreviewRequest);
  assert.ok(body.components.schemas.SchedulePreviewResponse);
  assert.ok(body.components.schemas.SecretStoragePolicy);
  assert.ok(body.components.schemas.AgentManifest);
  assert.ok(body.components.schemas.TrustResponse);
});

test("api index gives agents a compact entry map", async () => {
  const { response, body } = await request("/api");

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.service, "Action402");
  assert.equal(body.paid[0].path, "/api/execute/webhook");
  assert.equal(body.paid[0].network, "eip155:84532");
  assert.ok(body.recommendedStart.includes("/api/quickstart"));
  assert.ok(body.recommendedStart.includes("/api/pricing"));
  assert.ok(body.recommendedStart.includes("/api/mcp"));
  assert.ok(body.recommendedStart.includes("/openapi.json"));
  assert.ok(body.free.discovery.includes("/api/capabilities"));
  assert.ok(body.free.discovery.includes("/api/pricing"));
  assert.ok(body.free.discovery.includes("/api/mcp"));
  assert.ok(body.free.preflight.includes("/api/policy/check"));
  assert.ok(body.free.verification.includes("/api/verify/jobs/{id}"));
  assert.equal(body.browserAccess.credentialsRequired, false);
  assert.equal(body.browserAccess.cors.enabled, true);
  assert.ok(body.cachePolicy.stableDiscoveryPaths.includes("/api"));
  assert.ok(body.cachePolicy.noStorePaths.includes("/health"));
  assert.equal(body.discoveryHeaders.agentEntryHeader, "X-Action402-Agent-Entry");
  assert.ok(body.discoveryHeaders.links.some((link) => link.path === "/api/pricing"));
  assert.equal(body.links.openapi.endsWith("/openapi.json"), true);
  assert.equal(body.links.bazaar.endsWith("/api/bazaar"), true);
  assert.equal(body.links.pricing.endsWith("/api/pricing"), true);
  assert.equal(body.links.mcpManifest.endsWith("/api/mcp"), true);

  const wrongMethod = await request("/api", {
    method: "POST"
  });
  assert.equal(wrongMethod.response.status, 405);
  assert.equal(wrongMethod.response.headers.get("allow"), "GET");
  assert.equal(wrongMethod.body.error.code, "method_not_allowed");
});

test("cache policy separates stable discovery from runtime state", async () => {
  const apiIndex = await request("/api");
  assert.ok(apiIndex.response.headers.get("cache-control").includes("s-maxage=300"));
  assert.ok(apiIndex.response.headers.get("x-action402-cache-policy").includes("s-maxage=300"));
  assert.equal(apiIndex.response.headers.get("x-action402-agent-entry"), "/api");
  assert.ok(apiIndex.response.headers.get("link").includes("/api/mcp"));
  assert.ok(apiIndex.response.headers.get("link").includes("/openapi.json"));

  const pricing = await request("/api/pricing");
  assert.ok(pricing.response.headers.get("cache-control").includes("s-maxage=300"));
  assert.ok(pricing.response.headers.get("x-action402-cache-policy").includes("s-maxage=300"));
  assert.equal(pricing.response.headers.get("x-action402-agent-entry"), "/api");

  const mcpManifest = await request("/api/mcp");
  assert.ok(mcpManifest.response.headers.get("cache-control").includes("s-maxage=300"));
  assert.ok(mcpManifest.response.headers.get("x-action402-cache-policy").includes("s-maxage=300"));
  assert.equal(mcpManifest.response.headers.get("x-action402-agent-entry"), "/api");

  const capabilities = await request("/api/capabilities");
  assert.ok(capabilities.response.headers.get("cache-control").includes("s-maxage=300"));
  assert.ok(capabilities.response.headers.get("x-action402-cache-policy").includes("s-maxage=300"));

  const openapi = await request("/openapi.json");
  assert.ok(openapi.response.headers.get("cache-control").includes("s-maxage=300"));
  assert.ok(openapi.response.headers.get("x-action402-cache-policy").includes("s-maxage=300"));

  const llms = await requestText("/llms.txt");
  assert.ok(llms.response.headers.get("cache-control").includes("s-maxage=300"));
  assert.ok(llms.response.headers.get("x-action402-cache-policy").includes("s-maxage=300"));

  const health = await request("/health");
  assert.equal(health.response.headers.get("cache-control"), "no-store");
  assert.equal(health.response.headers.get("x-action402-cache-policy"), "no-store");

  const proofs = await request("/api/proofs/recent");
  assert.equal(proofs.response.headers.get("cache-control"), "no-store");
  assert.equal(proofs.response.headers.get("x-action402-cache-policy"), "no-store");

  const policy = await request("/api/policy/check", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      url: "https://127.0.0.1/internal",
      method: "POST"
    })
  });
  assert.equal(policy.response.headers.get("cache-control"), "no-store");
  assert.equal(policy.response.headers.get("x-action402-cache-policy"), "no-store");

  const unknown = await request("/api/cache-policy-missing-route");
  assert.equal(unknown.response.status, 404);
  assert.equal(unknown.response.headers.get("cache-control"), "no-store");
  assert.equal(unknown.response.headers.get("x-action402-cache-policy"), "no-store");
});

test("machine-readable endpoints support browser agent CORS preflight", async () => {
  const preflight = await requestRaw("/api/execute/webhook", {
    method: "OPTIONS",
    headers: {
      origin: "https://agent.example",
      "access-control-request-method": "POST",
      "access-control-request-headers": "content-type,x-payment,payment-signature"
    }
  });

  assert.equal(preflight.response.status, 204);
  assert.equal(preflight.response.headers.get("access-control-allow-origin"), "*");
  assert.equal(preflight.response.headers.get("access-control-allow-credentials"), null);
  assert.ok(preflight.response.headers.get("access-control-allow-methods").includes("POST"));
  assert.ok(preflight.response.headers.get("access-control-allow-headers").includes("x-payment"));
  assert.ok(preflight.response.headers.get("access-control-allow-headers").includes("payment-signature"));
  assert.ok(preflight.response.headers.get("access-control-expose-headers").includes("x-payment-response"));
  assert.ok(preflight.response.headers.get("access-control-expose-headers").includes("payment-response"));
  assert.ok(preflight.response.headers.get("access-control-expose-headers").includes("x-action402-cache-policy"));
  assert.ok(preflight.response.headers.get("access-control-expose-headers").includes("link"));
  assert.ok(preflight.response.headers.get("access-control-expose-headers").includes("x-action402-agent-entry"));

  const capabilities = await request("/api/capabilities", {
    headers: {
      origin: "https://agent.example"
    }
  });
  assert.equal(capabilities.response.status, 200);
  assert.equal(capabilities.response.headers.get("access-control-allow-origin"), "*");

  const apiIndexPreflight = await requestRaw("/api", {
    method: "OPTIONS",
    headers: {
      origin: "https://agent.example",
      "access-control-request-method": "GET"
    }
  });
  assert.equal(apiIndexPreflight.response.status, 204);
  assert.equal(apiIndexPreflight.response.headers.get("access-control-allow-origin"), "*");
});

test("pricing endpoint gives agents machine-readable payment guardrails", async () => {
  const { response, body } = await request("/api/pricing");

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.service, "Action402");
  assert.equal(body.pricingModel, "pay-per-action");
  assert.equal(body.payment.scheme, "exact");
  assert.equal(body.payment.price.display, "$0.003");
  assert.equal(body.payment.route.endsWith("/api/execute/webhook"), true);
  assert.equal(body.paidActions[0].id, "execute.webhook");
  assert.equal(body.paidActions[0].method, "POST");
  assert.ok(body.freeSurfaces.discovery.includes("/api/pricing"));
  assert.ok(body.freeSurfaces.preflight.includes("/api/policy/check"));
  assert.ok(body.buyerGuardrails.some((item) => item.includes("max spend cap")));
  assert.equal(body.links.humanPricing.endsWith("/pricing"), true);
  assert.equal(body.links.openapi.endsWith("/openapi.json"), true);

  const wrongMethod = await request("/api/pricing", {
    method: "POST"
  });
  assert.equal(wrongMethod.response.status, 405);
  assert.equal(wrongMethod.response.headers.get("allow"), "GET");
  assert.equal(wrongMethod.body.error.code, "method_not_allowed");
});

test("MCP manifest gives wrapper builders honest tool metadata", async () => {
  const { response, body } = await request("/api/mcp");

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.service, "Action402");
  assert.equal(body.status, "manifest-only");
  assert.equal(body.recommendedToolName, "execute_webhook");
  assert.equal(body.mcpServer.hostedByAction402, false);
  assert.ok(body.discoveryQueries.includes("Action402 MCP manifest"));
  assert.ok(body.tools.some((tool) => tool.name === "execute_webhook" && tool.route.path === "/api/execute/webhook"));
  assert.ok(body.tools.some((tool) => tool.name === "check_webhook_policy" && tool.paid === false));
  assert.ok(body.buyerFlow.some((step) => step.includes("/api/pricing")));
  assert.ok(body.guardrails.some((step) => step.includes("private keys")));
  assert.equal(body.links.wellKnown.endsWith("/.well-known/mcp.json"), true);

  const wellKnown = await request("/.well-known/mcp.json");
  assert.equal(wellKnown.response.status, 200);
  assert.equal(wellKnown.body.version, body.version);

  const wrongMethod = await request("/api/mcp", {
    method: "POST"
  });
  assert.equal(wrongMethod.response.status, 405);
  assert.equal(wrongMethod.response.headers.get("allow"), "GET");
  assert.equal(wrongMethod.body.error.code, "method_not_allowed");
});

test("action catalog exposes ready templates and safe future scheduling", async () => {
  const { response, body } = await request("/api/actions");

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.activePrimitive.id, "execute.webhook");
  assert.equal(body.activePrimitive.path, "/api/execute/webhook");
  assert.ok(body.categories.includes("chatops"));
  assert.ok(body.templates.length >= 9);
  assert.ok(body.templates.some((template) => template.id === "chatops.slack_message"));
  assert.ok(body.templates.some((template) => template.id === "dev.github_repository_dispatch"));
  assert.ok(body.discoveryKeywords.includes("Discord webhook x402"));
  assert.ok(body.policyModes.some((mode) => mode.id === "blocklist-quota"));
  assert.equal(body.scheduledActions.status, "preview-only");
  assert.equal(body.scheduledActions.previewEndpoint.path, "/api/schedules/preview");
  assert.equal(body.scheduledActions.futureShape.path, "/api/schedules/webhook");
  assert.equal(body.browserHandoff.endpoint.path, "/api/handoff/browser");
  assert.equal(body.secretStorage.endpoint.path, "/api/secrets/policy");
  assert.equal(body.links.quickstart.endsWith("/api/quickstart"), true);
  assert.equal(body.links.handoffCapabilities.endsWith("/api/handoff/capabilities"), true);
  assert.equal(body.links.scheduleCapabilities.endsWith("/api/schedules/capabilities"), true);
  assert.equal(body.links.secretPolicy.endsWith("/api/secrets/policy"), true);
});

test("quickstart endpoint gives compact agent call flow", async () => {
  const { response, body } = await request("/api/quickstart");

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.payment.route.endsWith("/api/execute/webhook"), true);
  assert.equal(body.minimalRequest.url, "https://httpbin.org/anything");
  assert.equal(body.minimalRequest.idempotencyKey, "agent-quickstart-001");
  assert.ok(body.callFlow.some((step) => step.includes("402")));
  assert.ok(body.decisionRules.useWhen.some((step) => step.includes("public HTTPS")));
  assert.equal(body.verify.proofBadge.endsWith("/proof/{jobOrReceiptId}"), true);
  assert.ok(body.nextDiscoverySteps.some((step) => step.endsWith("/api/actions")));
  assert.ok(body.nextDiscoverySteps.some((step) => step.endsWith("/api/pricing")));
  assert.ok(body.nextDiscoverySteps.some((step) => step.endsWith("/api/handoff/capabilities")));
  assert.ok(body.nextDiscoverySteps.some((step) => step.endsWith("/api/schedules/capabilities")));
  assert.ok(body.nextDiscoverySteps.some((step) => step.endsWith("/api/secrets/policy")));
  assert.ok(body.nextDiscoverySteps.some((step) => step.endsWith("/api/policy/check")));
});

test("policy check rejects unsafe payload before payment without executing", async () => {
  const { response, body } = await request("/api/policy/check", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      url: "https://127.0.0.1/internal",
      method: "POST",
      idempotencyKey: "policy-check-private"
    })
  });

  assert.equal(response.status, 200);
  assert.equal(body.ok, false);
  assert.equal(body.allowed, false);
  assert.equal(body.error.code, "unsafe_target");
  assert.equal(body.action.path, "/api/execute/webhook");
  assert.equal(body.next.snippets, "/api/snippets");
});

test("canary echo returns only non-sensitive whitelisted fields", async () => {
  const metadata = await request("/api/canary/echo");
  assert.equal(metadata.response.status, 200);
  assert.equal(metadata.body.ok, true);
  assert.equal(metadata.body.paid, false);
  assert.deepEqual(metadata.body.acceptedFields, {});

  const { response, body } = await request("/api/canary/echo", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      event: "action402.canary",
      scenario: "api-contract",
      runId: "canary-test-001",
      source: "test",
      generatedAt: "2026-05-16T00:00:00.000Z",
      token: "must-not-echo",
      nested: {
        secret: "must-not-echo"
      }
    })
  });

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.endpoint, "/api/canary/echo");
  assert.equal(body.paid, false);
  assert.equal(body.acceptedFields.event, "action402.canary");
  assert.equal(body.acceptedFields.scenario, "api-contract");
  assert.equal(body.acceptedFields.runId, "canary-test-001");
  assert.equal(body.acceptedFields.token, undefined);
  assert.equal(body.acceptedFields.nested, undefined);
  assert.equal(body.redactionPolicy.onlyWhitelistedFieldsEchoed, true);
  assert.equal(body.next.paidExecution, "/api/execute/webhook");
  assert.equal(JSON.stringify(body).includes("must-not-echo"), false);
});

test("unknown API routes return structured JSON for agents", async () => {
  const { response, body } = await request("/api/unknown-agent-route");

  assert.equal(response.status, 404);
  assert.equal(body.error.code, "api_route_not_found");
  assert.equal(body.error.details.method, "GET");
  assert.equal(body.error.details.path, "/api/unknown-agent-route");
  assert.equal(body.error.details.openapi, "/openapi.json");
  assert.equal(body.error.details.capabilities, "/api/capabilities");
  assert.equal(body.error.details.quickstart, "/api/quickstart");
});

test("known API routes return structured method errors", async () => {
  const execute = await request("/api/execute/webhook");
  assert.equal(execute.response.status, 405);
  assert.equal(execute.response.headers.get("allow"), "POST");
  assert.equal(execute.body.error.code, "method_not_allowed");
  assert.equal(execute.body.error.details.path, "/api/execute/webhook");
  assert.deepEqual(execute.body.error.details.allowedMethods, ["POST"]);

  const policy = await request("/api/policy/check");
  assert.equal(policy.response.status, 405);
  assert.equal(policy.response.headers.get("allow"), "POST");
  assert.equal(policy.body.error.code, "method_not_allowed");

  const canary = await request("/api/canary/echo", {
    method: "PUT"
  });
  assert.equal(canary.response.status, 405);
  assert.equal(canary.response.headers.get("allow"), "GET, POST");
  assert.deepEqual(canary.body.error.details.allowedMethods, ["GET", "POST"]);
});

test("snippets endpoint exposes buyer and verification examples", async () => {
  const { response, body } = await request("/api/snippets");

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.payment.route.endsWith("/api/execute/webhook"), true);
  assert.ok(body.groups.length >= 4);
  assert.ok(body.groups.some((group) => group.id === "discovery"));
  assert.ok(body.groups.some((group) => group.id === "paid-call"));
  assert.ok(body.groups.some((group) => group.id === "advanced-surfaces"));
  assert.ok(body.groups.some((group) => group.snippets.some((snippet) => snippet.id === "preflight-policy-check")));
  assert.ok(body.groups.some((group) => group.snippets.some((snippet) => snippet.code.includes("/api/pricing"))));
  const verification = body.groups.find((group) => group.id === "verification");
  assert.ok(verification);
  assert.ok(verification.snippets.some((snippet) => snippet.id === "verify-job-javascript"));
  assert.equal(body.links.proofBadge.endsWith("/proof/{jobOrReceiptId}"), true);
  assert.equal(body.links.pricing.endsWith("/api/pricing"), true);
  assert.equal(body.links.policyCheck.endsWith("/api/policy/check"), true);
  assert.equal(body.links.handoff.endsWith("/api/handoff/capabilities"), true);
  assert.equal(body.links.schedulePreview.endsWith("/api/schedules/preview"), true);
  assert.equal(body.links.secretPolicy.endsWith("/api/secrets/policy"), true);
});

test("agent discovery pack exposes well-known manifests, robots, and sitemap", async () => {
  const manifest = await request("/api/agent-manifest");
  assert.equal(manifest.response.status, 200);
  assert.equal(manifest.body.schemaVersion, "action402.agent-manifest.v1");
  assert.equal(manifest.body.name, "Action402");
  assert.ok(manifest.body.protocols.includes("x402"));
  assert.ok(manifest.body.paidActions.some((action) => action.path === "/api/execute/webhook"));
  assert.ok(manifest.body.freeAgentSurfaces.some((surface) => surface.path === "/api"));
  assert.ok(manifest.body.freeAgentSurfaces.some((surface) => surface.path === "/api/capabilities"));
  assert.ok(manifest.body.freeAgentSurfaces.some((surface) => surface.path === "/api/pricing"));
  assert.ok(manifest.body.freeAgentSurfaces.some((surface) => surface.path === "/api/mcp"));
  assert.ok(manifest.body.freeAgentSurfaces.some((surface) => surface.path === "/.well-known/mcp.json"));
  assert.ok(manifest.body.freeAgentSurfaces.some((surface) => surface.path === "/api/canary/echo"));
  assert.ok(manifest.body.browserPages.some((page) => page.path === "/status"));
  assert.ok(manifest.body.links.wellKnownAgent.endsWith("/.well-known/agent.json"));

  const wellKnownAgent = await request("/.well-known/agent.json");
  assert.equal(wellKnownAgent.response.status, 200);
  assert.equal(wellKnownAgent.body.schemaVersion, manifest.body.schemaVersion);
  assert.equal(wellKnownAgent.body.links.apiManifest.endsWith("/api/agent-manifest"), true);

  const wellKnownAction402 = await request("/.well-known/action402.json");
  assert.equal(wellKnownAction402.response.status, 200);
  assert.equal(wellKnownAction402.body.name, "Action402");

  const wellKnownX402 = await request("/.well-known/x402.json");
  assert.equal(wellKnownX402.response.status, 200);
  assert.equal(wellKnownX402.body.paidActions[0].payment.scheme, "exact");

  const wellKnownMcp = await request("/.well-known/mcp.json");
  assert.equal(wellKnownMcp.response.status, 200);
  assert.equal(wellKnownMcp.body.recommendedToolName, "execute_webhook");

  const robots = await requestText("/robots.txt");
  assert.equal(robots.response.status, 200);
  assert.equal(robots.body.includes("Allow: /api"), true);
  assert.equal(robots.body.includes("Allow: /status"), true);
  assert.equal(robots.body.includes("Allow: /api/agent-manifest"), true);
  assert.equal(robots.body.includes("Allow: /api/pricing"), true);
  assert.equal(robots.body.includes("Allow: /api/mcp"), true);
  assert.equal(robots.body.includes("Allow: /.well-known/mcp.json"), true);
  assert.equal(robots.body.includes("Sitemap:"), true);

  const sitemap = await requestText("/sitemap.xml");
  assert.equal(sitemap.response.status, 200);
  assert.equal(sitemap.body.includes("<urlset"), true);
  assert.equal(sitemap.body.includes("/api</loc>"), true);
  assert.equal(sitemap.body.includes("/discovery"), true);
  assert.equal(sitemap.body.includes("/status"), true);
  assert.equal(sitemap.body.includes("/api/pricing"), true);
  assert.equal(sitemap.body.includes("/api/mcp"), true);
  assert.equal(sitemap.body.includes("/.well-known/mcp.json"), true);
  assert.equal(sitemap.body.includes("/api/agent-manifest"), true);
  assert.equal(sitemap.body.includes("/api/canary/echo"), true);
});

test("advanced agent surfaces expose handoff, schedule preview, and secret policy", async () => {
  const handoffCapabilities = await request("/api/handoff/capabilities");
  assert.equal(handoffCapabilities.response.status, 200);
  assert.equal(handoffCapabilities.body.status, "active-handoff-only");
  assert.equal(handoffCapabilities.body.path, "/api/handoff/browser");

  const handoff = await request("/api/handoff/browser", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      targetUrl: "https://1.1.1.1/",
      actions: [
        {
          type: "navigate",
          description: "Open the target page."
        },
        {
          type: "verify",
          text: "Confirm the expected visible state."
        }
      ],
      idempotencyKey: "handoff-test-001"
    })
  });
  assert.equal(handoff.response.status, 200);
  assert.equal(handoff.body.ok, true);
  assert.equal(handoff.body.handoff.executionModel, "browser-handoff-only");
  assert.equal(handoff.body.handoff.notExecutedByAction402, true);
  assert.equal(handoff.body.handoff.actions.length, 2);

  const scheduleCapabilities = await request("/api/schedules/capabilities");
  assert.equal(scheduleCapabilities.response.status, 200);
  assert.equal(scheduleCapabilities.body.status, "preview-only");
  assert.equal(scheduleCapabilities.body.previewPath, "/api/schedules/preview");

  const schedule = await request("/api/schedules/preview", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      webhook: {
        url: "https://1.1.1.1/webhook",
        method: "POST",
        body: {
          event: "agent.schedule-preview"
        },
        idempotencyKey: "schedule-preview-test-001"
      },
      schedule: {
        type: "daily",
        timeOfDay: "09:30",
        timezone: "UTC"
      }
    })
  });
  assert.equal(schedule.response.status, 200);
  assert.equal(schedule.body.ok, true);
  assert.equal(schedule.body.status, "preview-only");
  assert.equal(schedule.body.willExecute, false);
  assert.equal(schedule.body.preview.schedule.type, "daily");

  const secretPolicy = await request("/api/secrets/policy");
  assert.equal(secretPolicy.response.status, 200);
  assert.equal(secretPolicy.body.status, "not-supported-in-public-mvp");
  assert.equal(secretPolicy.body.activeStorageEndpoint, false);
  assert.ok(secretPolicy.body.neverSend.includes("wallet private keys"));
});

test("bazaar metadata exposes valid discovery extension", async () => {
  const { response, body } = await request("/api/bazaar");
  const route = body.routeConfig["POST /api/execute/webhook"];

  assert.equal(response.status, 200);
  assert.equal(body.discovery.bazaarExtensionValid, true);
  assert.equal(validateBazaarDiscovery().valid, true);
  assert.equal(route.serviceName, "Action402");
  assert.equal(route.tags.includes("x402"), true);
  assert.equal(route.tags.includes("paid-webhook"), true);
  assert.ok(body.discoveryKeywords.includes("x402 paid API"));
  assert.equal(body.agentPrompt.includes("paid public HTTPS"), true);
  assert.equal(body.discovery.searchQueries.includes("Action402"), true);
  assert.equal(body.mcp.recommendedToolName, "execute_webhook");
  assert.equal(body.links.llms.endsWith("/llms.txt"), true);
  assert.equal(body.links.discovery.endsWith("/discovery"), true);
  assert.equal(body.links.agentManifest.endsWith("/api/agent-manifest"), true);
  assert.equal(body.links.wellKnownAgent.endsWith("/.well-known/agent.json"), true);
  assert.equal(body.links.robots.endsWith("/robots.txt"), true);
  assert.equal(body.links.sitemap.endsWith("/sitemap.xml"), true);
  assert.equal(body.links.useCases.endsWith("/use-cases"), true);
  assert.equal(body.links.actions.endsWith("/actions"), true);
  assert.equal(body.links.quickstart.endsWith("/api/quickstart"), true);
  assert.equal(body.links.pricingApi.endsWith("/api/pricing"), true);
  assert.equal(body.links.mcpManifest.endsWith("/api/mcp"), true);
  assert.equal(body.links.policyCheck.endsWith("/api/policy/check"), true);
  assert.equal(body.links.canaryEcho.endsWith("/api/canary/echo"), true);
  assert.equal(body.links.snippets.endsWith("/api/snippets"), true);
  assert.equal(body.links.handoffEndpoint.endsWith("/api/handoff/browser"), true);
  assert.equal(body.links.schedulePreview.endsWith("/api/schedules/preview"), true);
  assert.equal(body.links.secretPolicy.endsWith("/api/secrets/policy"), true);
  assert.equal(body.links.actionCatalog.endsWith("/api/actions"), true);
  assert.equal(body.links.mcpGuide.endsWith("/mcp"), true);
  assert.ok(body.useCaseTemplates.length >= 6);
  assert.ok(body.actionCatalog.templateCount >= 9);
  assert.equal(body.quickstart.path, "/api/quickstart");
  assert.equal(body.pricing.path, "/api/pricing");
  assert.equal(body.mcp.manifest, "/api/mcp");
  assert.equal(body.policyCheck.path, "/api/policy/check");
  assert.equal(body.canary.path, "/api/canary/echo");
  assert.equal(body.handoff.path, "/api/handoff/browser");
  assert.equal(body.schedules.path, "/api/schedules/preview");
  assert.equal(body.secretStorage.path, "/api/secrets/policy");
  assert.equal(body.snippets.path, "/api/snippets");
  assert.equal(route.extensions.bazaar.info.input.method, "POST");
  assert.equal(route.extensions.bazaar.info.input.bodyType, "json");
  assert.equal(route.extensions.bazaar.info.input.body.url, "https://httpbin.org/anything");
  assert.equal(route.extensions.bazaar.info.output.type, "json");
  assert.ok(route.extensions.bazaar.schema.properties.input);
});

test("llms.txt exposes agent discovery guidance", async () => {
  const { response, body } = await requestText("/llms.txt");

  assert.equal(response.status, 200);
  assert.equal(body.includes("Action402"), true);
  assert.equal(body.includes("paid webhook execution"), true);
  assert.equal(body.includes("/api - compact machine-readable API index"), true);
  assert.equal(body.includes("/api/capabilities"), true);
  assert.equal(body.includes("/discovery"), true);
  assert.equal(body.includes("/api/agent-manifest"), true);
  assert.equal(body.includes("/.well-known/agent.json"), true);
  assert.equal(body.includes("/robots.txt"), true);
  assert.equal(body.includes("/sitemap.xml"), true);
  assert.equal(body.includes("/pricing"), true);
  assert.equal(body.includes("/use-cases"), true);
  assert.equal(body.includes("/actions"), true);
  assert.equal(body.includes("/api/actions"), true);
  assert.equal(body.includes("/api/quickstart"), true);
  assert.equal(body.includes("/api/pricing"), true);
  assert.equal(body.includes("/api/mcp"), true);
  assert.equal(body.includes("/.well-known/mcp.json"), true);
  assert.equal(body.includes("/api/policy/check"), true);
  assert.equal(body.includes("/api/canary/echo"), true);
  assert.equal(body.includes("/api/snippets"), true);
  assert.equal(body.includes("/snippets"), true);
  assert.equal(body.includes("/handoff"), true);
  assert.equal(body.includes("/schedules"), true);
  assert.equal(body.includes("/secrets"), true);
  assert.equal(body.includes("/api/handoff/browser"), true);
  assert.equal(body.includes("/api/schedules/preview"), true);
  assert.equal(body.includes("/api/secrets/policy"), true);
  assert.equal(body.includes("/mcp"), true);
  assert.equal(body.includes("/api/trust"), true);
  assert.equal(body.includes("/status"), true);
  assert.equal(body.includes("/proof/{jobOrReceiptId}"), true);
  assert.equal(body.includes("pay per API call"), true);
  assert.equal(body.includes("Action402 action catalog"), true);
  assert.equal(body.includes("/api/proofs/recent"), true);
  assert.equal(body.includes("/api/monitoring/executions"), true);
  assert.equal(body.includes("MCP/Bazaar guidance"), true);
});

test("public product pages load", async () => {
  const pages = [
    ["/pricing", "Usage and pricing"],
    ["/discovery", "Discovery pack"],
    ["/onboarding", "Agent onboarding"],
    ["/use-cases", "Use-case templates"],
    ["/actions", "Action catalog"],
    ["/snippets", "Integration snippets"],
    ["/handoff", "Browser handoff"],
    ["/schedules", "Schedule preview"],
    ["/secrets", "Secret storage policy"],
    ["/mcp", "Discovery-first instructions"],
    ["/trust", "Trust summary"],
    ["/status", "Runtime checks"],
    ["/proofs", "Verified proof examples"],
    ["/proof/job_test_missing", "Proof badge"],
    ["/monitoring", "Execution monitoring"]
  ];

  for (const [path, expectedText] of pages) {
    const { response, body } = await requestText(path);
    assert.equal(response.status, 200);
    assert.equal(body.includes(expectedText), true);
  }
});

test("vercel rewrites expose extensionless product pages", () => {
  const vercelConfig = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
  const rewrites = new Map(vercelConfig.rewrites.map((rewrite) => [rewrite.source, rewrite.destination]));

  assert.equal(rewrites.get("/handoff"), "/handoff.html");
  assert.equal(rewrites.get("/status"), "/status.html");
  assert.equal(rewrites.get("/discovery"), "/discovery.html");
  assert.equal(rewrites.get("/schedules"), "/schedules.html");
  assert.equal(rewrites.get("/secrets"), "/secrets.html");
  assert.equal(rewrites.get("/robots.txt"), "/api/index?__action402_path=/robots.txt");
  assert.equal(rewrites.get("/sitemap.xml"), "/api/index?__action402_path=/sitemap.xml");
  assert.equal(rewrites.get("/.well-known/:path*"), "/api/index?__action402_path=/.well-known/:path*");
});

test("vercel rewrite strips internal catch-all path query", () => {
  const req = {
    url: "/api/index?__action402_path=/api/execute/webhook&path=execute%2Fwebhook&trace=1"
  };

  applyVercelRewritePath(req);

  assert.equal(req.url, "/api/execute/webhook?trace=1");
});

test("vercel request normalization converts absolute URLs before express routing", () => {
  const req = {
    url: "https://action402.vercel.app/api/proofs/recent?limit=5",
    _parsedUrl: { stale: true },
    _parsedOriginalUrl: { stale: true }
  };

  normalizeVercelRequestUrl(req);

  assert.equal(req.url, "/api/proofs/recent?limit=5");
  assert.equal(req._parsedUrl, undefined);
  assert.equal(req._parsedOriginalUrl, undefined);
});

test("vercel rewrite handles absolute URLs without leaving a legacy parser input", () => {
  const req = {
    url: "https://action402.vercel.app/api/index?__action402_path=/api/execute/webhook&path=execute%2Fwebhook&trace=1"
  };

  applyVercelRewritePath(req);

  assert.equal(req.url, "/api/execute/webhook?trace=1");
});

test("verification endpoint returns consistency report for stored job receipt", async () => {
  await resetStoreForTests();

  const job = {
    id: "job_api_verify_1",
    type: "webhook",
    status: "succeeded",
    target: "https://example.com/webhook",
    method: "POST",
    idempotencyKey: "api-verify-key-1",
    attempts: [
      {
        attempt: 1,
        startedAt: "2026-05-14T00:00:00.000Z",
        completedAt: "2026-05-14T00:00:01.000Z",
        status: 200,
        ok: true
      }
    ],
    receiptId: null,
    createdAt: "2026-05-14T00:00:00.000Z",
    updatedAt: "2026-05-14T00:00:01.000Z"
  };
  const receipt = buildReceipt({
    job,
    requestHash: "a".repeat(64),
    responseHash: "b".repeat(64),
    target: {
      url: job.target,
      method: job.method
    },
    response: {
      ok: true,
      status: 200
    }
  });
  await createJob({ ...job, receiptId: receipt.id });
  await saveReceipt(receipt);

  const { response, body } = await request(`/api/verify/jobs/${job.id}`);

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.jobId, job.id);
  assert.equal(body.receiptId, receipt.id);
  assert.equal(body.signatureVerified, true);
  assert.equal(body.checks.every((item) => item.ok), true);
});

test("recent proofs endpoint returns redacted verified examples", async () => {
  await resetStoreForTests();

  const job = {
    id: "job_public_proof_1",
    type: "webhook",
    status: "succeeded",
    target: "https://sensitive.example.com/private-webhook",
    method: "POST",
    idempotencyKey: "public-proof-key-1",
    attempts: [
      {
        attempt: 1,
        startedAt: "2026-05-14T00:00:00.000Z",
        completedAt: "2026-05-14T00:00:01.000Z",
        status: 200,
        ok: true
      }
    ],
    receiptId: null,
    createdAt: "2026-05-14T00:00:00.000Z",
    updatedAt: "2026-05-14T00:00:01.000Z"
  };
  const receipt = buildReceipt({
    job,
    requestHash: "a".repeat(64),
    responseHash: "b".repeat(64),
    target: {
      url: job.target,
      method: job.method
    },
    response: {
      ok: true,
      status: 200
    }
  });
  await createJob({ ...job, receiptId: receipt.id });
  await saveReceipt(receipt);

  const { response, body } = await request("/api/proofs/recent?limit=5");

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.proofs.length, 1);
  assert.equal(body.redactionPolicy.redactedFields.includes("targetUrl"), true);
  assert.equal(body.proofs[0].receiptVerified, true);
  assert.equal(body.proofs[0].target, undefined);
  assert.equal(body.proofs[0].targetUrl, undefined);
  assert.equal(body.proofs[0].requestHash, undefined);
  assert.equal(body.proofs[0].responseHash, undefined);
  assert.equal(body.proofs[0].signature, undefined);
  assert.equal(body.proofs[0].links.verifyJob.endsWith(`/api/verify/jobs/${job.id}`), true);
});

test("execution monitoring endpoint returns durable counters and redacted failures", async () => {
  await resetStoreForTests();

  const job = {
    id: "job_monitoring_failed_1",
    type: "webhook",
    status: "failed",
    target: "https://sensitive.example.com/failing-webhook",
    method: "POST",
    idempotencyKey: "monitoring-key-1",
    attempts: [
      {
        attempt: 1,
        startedAt: "2026-05-14T00:00:00.000Z",
        completedAt: "2026-05-14T00:00:01.000Z",
        status: 502,
        ok: false
      }
    ],
    error: "target returned 502",
    receiptId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const receipt = buildReceipt({
    job,
    requestHash: "c".repeat(64),
    responseHash: "d".repeat(64),
    target: {
      url: job.target,
      method: job.method
    },
    response: {
      ok: false,
      status: 502
    }
  });
  await createJob({ ...job, receiptId: receipt.id });
  await saveReceipt(receipt);

  const { response, body } = await request("/api/monitoring/executions?windowMs=86400000");

  assert.equal(response.status, 200);
  assert.equal(body.status, "attention");
  assert.equal(body.stats.total, 1);
  assert.equal(body.stats.failed, 1);
  assert.equal(body.stats.recentFailed, 1);
  assert.equal(body.recentFailures.length, 1);
  assert.equal(body.recentFailures[0].errorCategory, "target_server_error");
  assert.equal(body.recentFailures[0].target, undefined);
  assert.equal(body.recentFailures[0].requestHash, undefined);
  assert.equal(body.redactionPolicy.redactedFields.includes("responseBody"), true);
});

test("trust endpoint returns redacted public buyer signals", async () => {
  await resetStoreForTests();

  const job = {
    id: "job_trust_1",
    type: "webhook",
    status: "succeeded",
    target: "https://sensitive.example.com/trust-webhook",
    method: "POST",
    idempotencyKey: "trust-key-1",
    attempts: [
      {
        attempt: 1,
        startedAt: "2026-05-14T00:00:00.000Z",
        completedAt: "2026-05-14T00:00:01.000Z",
        status: 200,
        ok: true
      }
    ],
    receiptId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const receipt = buildReceipt({
    job,
    requestHash: "e".repeat(64),
    responseHash: "f".repeat(64),
    target: {
      url: job.target,
      method: job.method
    },
    response: {
      ok: true,
      status: 200
    }
  });
  await createJob({ ...job, receiptId: receipt.id });
  await saveReceipt(receipt);

  const { response, body } = await request("/api/trust");

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.x402.scheme, "exact");
  assert.equal(body.execution.stats.total, 1);
  assert.equal(body.proofExamples.recentVerifiedProofs, 1);
  assert.equal(typeof body.trustScore.score, "number");
  assert.ok(body.trustScore.components.some((component) => component.id === "agent_surfaces"));
  assert.equal(body.publicSurfaces.agentManifest.endsWith("/api/agent-manifest"), true);
  assert.equal(body.publicSurfaces.wellKnownAgent.endsWith("/.well-known/agent.json"), true);
  assert.equal(body.publicSurfaces.quickstart.endsWith("/api/quickstart"), true);
  assert.equal(body.publicSurfaces.policyCheck.endsWith("/api/policy/check"), true);
  assert.equal(body.publicSurfaces.canaryEcho.endsWith("/api/canary/echo"), true);
  assert.equal(body.publicSurfaces.snippets.endsWith("/api/snippets"), true);
  assert.equal(body.publicSurfaces.actionCatalog.endsWith("/api/actions"), true);
  assert.equal(body.publicSurfaces.handoffCapabilities.endsWith("/api/handoff/capabilities"), true);
  assert.equal(body.publicSurfaces.schedulePreview.endsWith("/api/schedules/preview"), true);
  assert.equal(body.publicSurfaces.secretPolicy.endsWith("/api/secrets/policy"), true);
  assert.equal(body.publicSurfaces.proofBadge.endsWith("/proof/{jobOrReceiptId}"), true);
  assert.equal(body.publicSurfaces.useCases.endsWith("/use-cases"), true);
  assert.equal(body.publicSurfaces.mcp.endsWith("/mcp"), true);
  assert.equal(body.publicSurfaces.status.endsWith("/status"), true);
  assert.equal(body.trustSignals.includes("public action catalog and quickstart endpoints"), true);
  assert.equal(body.trustSignals.includes("canonical agent manifest and well-known discovery aliases"), true);
  assert.equal(body.trustSignals.includes("robots.txt and sitemap.xml expose agent entry points"), true);
  assert.equal(body.trustSignals.includes("free preflight policy check before payment"), true);
  assert.equal(body.trustSignals.includes("free redacted canary echo target for self-tests"), true);
  assert.equal(body.trustSignals.includes("copy-paste integration snippets for buyers and verifiers"), true);
  assert.equal(body.trustSignals.includes("redacted public proof examples"), true);
  assert.equal(body.trustSignals.includes("browser/action handoff package endpoint is public"), true);
  assert.equal(body.trustSignals.includes("schedule preview endpoint is public and non-executing"), true);
  assert.equal(body.trustSignals.includes("secret storage policy is explicit for authenticated targets"), true);
  assert.equal(JSON.stringify(body).includes("sensitive.example.com"), false);
});

test("webhook execution rejects private network targets with structured error", async () => {
  const { response, body } = await request("/api/execute/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      url: "https://127.0.0.1/internal",
      method: "POST"
    })
  });

  assert.equal(response.status, 400);
  assert.equal(body.error.code, "unsafe_target");
});

test("webhook execution rejects invalid methods with structured error", async () => {
  const { response, body } = await request("/api/execute/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      url: "https://example.com/webhook",
      method: "GET"
    })
  });

  assert.equal(response.status, 400);
  assert.equal(body.error.code, "invalid_method");
});
