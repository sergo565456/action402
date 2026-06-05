const baseUrl = normalizeBaseUrl(process.argv[2] || process.env.DEPLOY_BASE_URL || "http://127.0.0.1:4021");
const expectX402 = process.argv.includes("--expect-x402") || process.env.EXPECT_X402 === "true";
const checks = [];

function normalizeBaseUrl(value) {
  return String(value || "").replace(/\/+$/, "");
}

function record(name, ok, details = "") {
  checks.push({ name, ok, details });
}

function headerIncludes(response, name, expectedValue) {
  return (response?.headers.get(name) || "")
    .toLowerCase()
    .split(",")
    .map((value) => value.trim())
    .includes(expectedValue.toLowerCase());
}

function hasShortDiscoveryCache(response) {
  const cacheControl = response?.headers.get("cache-control") || "";
  const policyHeader = response?.headers.get("x-action402-cache-policy") || "";
  const clientCacheIsPublic = headerIncludes(response, "cache-control", "public");
  const clientCacheIsShort = headerIncludes(response, "cache-control", "max-age=60");
  const fullPolicyIsVisible =
    cacheControl.toLowerCase().includes("s-maxage=300") || policyHeader.toLowerCase().includes("s-maxage=300");
  return clientCacheIsPublic && clientCacheIsShort && fullPolicyIsVisible;
}

function hasNoStoreCache(response) {
  return (
    response?.headers.get("cache-control") === "no-store" &&
    response?.headers.get("x-action402-cache-policy") === "no-store"
  );
}

function hasDiscoveryHeaders(response) {
  const link = response?.headers.get("link") || "";
  return (
    response?.headers.get("x-action402-agent-entry") === "/api" &&
    link.includes("/api/agent-manifest") &&
    link.includes("/openapi.json") &&
    link.includes("/api/pricing") &&
    link.includes("/api/mcp") &&
    link.includes("/cookbooks") &&
    link.includes("/api/bazaar")
  );
}

async function fetchText(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  return { response, text };
}

async function fetchJson(path, options = {}) {
  const { response, text } = await fetchText(path, options);
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = undefined;
  }
  return { response, body, text };
}

async function checkStatic(path, expectedText) {
  try {
    const { response, text } = await fetchText(path);
    record(`${path} loads`, response.status === 200 && text.includes(expectedText), `status=${response.status}`);
  } catch (error) {
    record(`${path} loads`, false, error.message);
  }
}

async function checkJson(path, options = {}) {
  try {
    const { response, body } = await fetchJson(path, options);
    record(`${path} returns JSON`, response.status === 200 && body && typeof body === "object", `status=${response.status}`);
    return body;
  } catch (error) {
    record(`${path} returns JSON`, false, error.message);
    return undefined;
  }
}

async function checkJsonStatus(path, expectedStatus, options = {}) {
  try {
    const { response, body } = await fetchJson(path, options);
    record(
      `${path} returns JSON status ${expectedStatus}`,
      response.status === expectedStatus && body && typeof body === "object",
      `status=${response.status}`
    );
    return { response, body };
  } catch (error) {
    record(`${path} returns JSON status ${expectedStatus}`, false, error.message);
    return { response: undefined, body: undefined };
  }
}

async function checkCorsPreflight() {
  try {
    const { response } = await fetchText("/api/execute/webhook", {
      method: "OPTIONS",
      headers: {
        origin: "https://agent.example",
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type,x-payment,payment-signature"
      }
    });

    record("execute route supports CORS preflight", response.status === 204, `status=${response.status}`);
    record("CORS allows browser agents", response.headers.get("access-control-allow-origin") === "*");
    record("CORS remains non-credentialed", response.headers.get("access-control-allow-credentials") === null);
    record("CORS allows x402 payment header", headerIncludes(response, "access-control-allow-headers", "x-payment"));
    record(
      "CORS allows payment-signature header",
      headerIncludes(response, "access-control-allow-headers", "payment-signature")
    );
    record(
      "CORS exposes x402 settlement header",
      headerIncludes(response, "access-control-expose-headers", "x-payment-response")
    );
    record(
      "CORS exposes cache policy header",
      headerIncludes(response, "access-control-expose-headers", "x-action402-cache-policy")
    );
    record("CORS exposes discovery Link header", headerIncludes(response, "access-control-expose-headers", "link"));
    record(
      "CORS exposes agent entry header",
      headerIncludes(response, "access-control-expose-headers", "x-action402-agent-entry")
    );
  } catch (error) {
    record("execute route supports CORS preflight", false, error.message);
  }
}

async function checkCachePolicy() {
  try {
    const stablePaths = [
      "/api",
      "/api/discovery",
      "/api/capabilities",
      "/api/pricing",
      "/api/mcp",
      "/api/bazaar",
      "/cookbooks",
      "/built-with-action402",
      "/submit",
      "/openapi.json"
    ];
    for (const path of stablePaths) {
      const { response } = await fetchText(path);
      record(`${path} uses short discovery cache`, hasShortDiscoveryCache(response));
      record(`${path} exposes discovery headers`, hasDiscoveryHeaders(response));
    }

    const noStorePaths = ["/health", "/api/proofs/recent", "/api/decisions/recent", "/api/monitoring/executions"];
    for (const path of noStorePaths) {
      const { response } = await fetchText(path);
      record(`${path} uses no-store cache`, hasNoStoreCache(response));
    }
  } catch (error) {
    record("cache policy is published", false, error.message);
  }
}

async function main() {
  console.log(`Action402 deploy check: ${baseUrl}`);

  await checkStatic("/", "Action402");
  await checkStatic("/demo.html", "Action402 Demo Console");
  await checkStatic("/brand.html", "Action402 Brand");
  await checkStatic("/agents", "Pay for one action");
  await checkStatic("/discovery", "Discovery pack");
  await checkStatic("/pricing", "Usage and pricing");
  await checkStatic("/onboarding", "Agent onboarding");
  await checkStatic("/use-cases", "Use-case templates");
  await checkStatic("/cookbooks", "Action402 cookbooks");
  await checkStatic("/built-with-action402", "Built with Action402");
  await checkStatic("/submit", "Submit your work");
  await checkStatic("/actions", "Action catalog");
  await checkStatic("/snippets", "Integration snippets");
  await checkStatic("/decisions", "Decision graph");
  await checkStatic("/decision/dec_deploy_check_missing", "Decision record");
  await checkStatic("/handoff", "Browser handoff");
  await checkStatic("/schedules", "Schedule preview");
  await checkStatic("/secrets", "Secret storage policy");
  await checkStatic("/mcp", "Discovery-first instructions");
  await checkStatic("/trust", "Trust summary");
  await checkStatic("/status", "Runtime checks");
  await checkStatic("/proofs", "Verified proof examples");
  await checkStatic("/proof/job_deploy_check_missing", "Proof badge");
  await checkStatic("/monitoring", "Execution monitoring");
  await checkStatic("/llms.txt", "paid webhook execution");
  await checkStatic("/examples/postman/action402.postman_collection.json", "Action402 x402 Agent Flow");
  await checkStatic("/skills/action402/SKILL.md", "Action402 Agent Skill");
  await checkStatic("/robots.txt", "Sitemap:");
  await checkStatic("/sitemap.xml", "<urlset");

  const health = await checkJson("/health");
  const apiIndex = await checkJson("/api");
  const discovery = await checkJson("/api/discovery");
  const agentManifest = await checkJson("/api/agent-manifest");
  const wellKnownAgent = await checkJson("/.well-known/agent.json");
  const wellKnownAction402 = await checkJson("/.well-known/action402.json");
  const wellKnownX402Bare = await checkJson("/.well-known/x402");
  const wellKnownX402 = await checkJson("/.well-known/x402.json");
  const wellKnownMcp = await checkJson("/.well-known/mcp.json");
  const capabilities = await checkJson("/api/capabilities");
  const pricing = await checkJson("/api/pricing");
  const mcpManifest = await checkJson("/api/mcp");
  const actions = await checkJson("/api/actions");
  const quickstart = await checkJson("/api/quickstart");
  const policyCheck = await checkJson("/api/policy/check", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      url: "https://127.0.0.1/internal",
      method: "POST",
      idempotencyKey: "deploy-check-policy"
    })
  });
  const canaryMetadata = await checkJson("/api/canary/echo");
  const canaryEcho = await checkJson("/api/canary/echo", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      event: "deploy.canary",
      scenario: "deploy-check",
      runId: "deploy-check-001",
      source: "deploy-check",
      secret: "must-not-echo"
    })
  });
  const handoffCapabilities = await checkJson("/api/handoff/capabilities");
  const handoff = await checkJson("/api/handoff/browser", {
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
        }
      ],
      idempotencyKey: "deploy-check-handoff"
    })
  });
  const scheduleCapabilities = await checkJson("/api/schedules/capabilities");
  const schedulePreview = await checkJson("/api/schedules/preview", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      webhook: {
        url: "https://1.1.1.1/webhook",
        method: "POST",
        body: {
          event: "deploy.schedule-preview"
        },
        idempotencyKey: "deploy-check-schedule-preview"
      },
      schedule: {
        type: "daily",
        timeOfDay: "09:30",
        timezone: "UTC"
      }
    })
  });
  const secretPolicy = await checkJson("/api/secrets/policy");
  const snippets = await checkJson("/api/snippets");
  const decision = await checkJson("/api/decide/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      action: {
        url: "https://127.0.0.1/internal",
        method: "POST",
        idempotencyKey: "deploy-check-decision"
      },
      buyerPolicy: {
        maxPriceUsd: "0.01",
        requireReceipt: true,
        requirePolicyPass: true,
        requireIdempotencyKey: true
      }
    })
  });
  const recentDecisions = await checkJson("/api/decisions/recent");
  const bazaar = await checkJson("/api/bazaar");
  const proofs = await checkJson("/api/proofs/recent");
  const monitoring = await checkJson("/api/monitoring/executions");
  const trust = await checkJson("/api/trust");
  const apiNotFound = await checkJsonStatus("/api/deploy-check-missing-route", 404);
  const executeWrongMethod = await checkJsonStatus("/api/execute/webhook", 405);
  const guidedWrongMethod = await checkJsonStatus("/api/execute/guided-webhook", 405);
  const canaryWrongMethod = await checkJsonStatus("/api/canary/echo", 405, {
    method: "PUT"
  });
  const openapi = await checkJson("/openapi.json");
  await checkCorsPreflight();
  await checkCachePolicy();

  if (health) {
    record("health ok", health.ok === true, `ok=${health.ok}`);
    if (expectX402) {
      record("x402 enabled", health.x402Enabled === true, `x402Enabled=${health.x402Enabled}`);
    }
  }

  if (apiIndex) {
    record("api index exposes service", apiIndex.service === "Action402");
    record("api index exposes paid action", apiIndex.paid?.some((action) => action.path === "/api/execute/webhook"));
    record("api index exposes guided paid action", apiIndex.paid?.some((action) => action.path === "/api/execute/guided-webhook"));
    record("api index exposes decision graph", apiIndex.free?.decision?.includes("/api/decide/webhook"));
    record("api index recommends discovery pack", apiIndex.recommendedStart?.includes("/api/discovery"));
    record("api index exposes pricing", apiIndex.recommendedStart?.includes("/api/pricing"));
    record("api index exposes MCP manifest", apiIndex.recommendedStart?.includes("/api/mcp"));
    record("api index exposes cookbooks", apiIndex.free?.discovery?.includes("/cookbooks"));
    record("api index exposes ecosystem page", apiIndex.free?.discovery?.includes("/built-with-action402"));
    record("api index exposes agent skill", typeof apiIndex.links?.agentSkill === "string");
    record("api index exposes free discovery", apiIndex.free?.discovery?.includes("/api/capabilities"));
    record("api index exposes verification", apiIndex.free?.verification?.includes("/api/verify/jobs/{id}"));
    record("api index exposes status page", apiIndex.free?.trustAndMonitoring?.includes("/status"));
    record("api index exposes health endpoint", apiIndex.free?.trustAndMonitoring?.includes("/health"));
  }

  if (discovery) {
    record("discovery pack has schema", discovery.schemaVersion === "action402.discovery.v1");
    record("discovery pack exposes fetch order", discovery.recommendedFetchOrder?.some((url) => url.endsWith("/api/discovery")));
    record("discovery pack exposes agent manifest", discovery.agentManifest?.endsWith("/api/agent-manifest"));
    record("discovery pack exposes pricing", discovery.pricing?.endsWith("/api/pricing"));
    record("discovery pack exposes OpenAPI", discovery.openapi?.endsWith("/openapi.json"));
    record("discovery pack exposes Bazaar metadata", discovery.bazaar?.endsWith("/api/bazaar"));
    record("discovery pack exposes cookbooks", discovery.links?.cookbooks?.endsWith("/cookbooks"));
    record("discovery pack exposes ecosystem", discovery.links?.builtWith?.endsWith("/built-with-action402"));
  }

  if (capabilities) {
    record("capabilities expose execute.webhook", capabilities.actions?.[0]?.id === "execute.webhook");
    record("capabilities expose api index", capabilities.apiIndex?.path === "/api");
    record("capabilities expose discovery API", capabilities.discoveryPack?.discoveryApi?.endsWith("/api/discovery"));
    record("capabilities expose discovery pack", capabilities.discoveryPack?.agentManifest?.endsWith("/api/agent-manifest"));
    record("capabilities expose well-known manifest", capabilities.links?.wellKnownAgent?.endsWith("/.well-known/agent.json"));
    record(
      "capabilities expose agent prompt",
      typeof capabilities.agentPrompt === "string" && capabilities.agentPrompt.includes("Action402")
    );
    record(
      "capabilities expose discovery keywords",
      Array.isArray(capabilities.discoveryKeywords) &&
        capabilities.discoveryKeywords.includes("paid webhook execution")
    );
    record("capabilities expose MCP hints", capabilities.mcp?.recommendedToolName === "execute_webhook");
    record(
      "capabilities expose proof report",
      capabilities.verification?.jobReceiptVerification === "/api/verify/jobs/{id}"
    );
    record("capabilities expose public proofs", capabilities.publicProofs?.path === "/api/proofs/recent");
    record(
      "capabilities expose execution monitoring",
      capabilities.monitoring?.path === "/api/monitoring/executions"
    );
    record("capabilities expose pricing link", typeof capabilities.links?.pricing === "string");
    record(
      "capabilities expose use-case templates",
      Array.isArray(capabilities.useCaseTemplates) && capabilities.useCaseTemplates.length >= 6
    );
    record(
      "capabilities expose action templates",
      Array.isArray(capabilities.actionTemplates) && capabilities.actionTemplates.length >= 9
    );
    record("capabilities expose quickstart", capabilities.quickstart?.path === "/api/quickstart");
    record("capabilities expose pricing", capabilities.pricing?.path === "/api/pricing");
    record("capabilities expose MCP manifest", capabilities.mcpManifest?.path === "/api/mcp");
    record("capabilities expose policy check", capabilities.policyCheck?.path === "/api/policy/check");
    record("capabilities expose canary echo", capabilities.canary?.path === "/api/canary/echo");
    record("capabilities expose snippets", capabilities.snippets?.path === "/api/snippets");
    record("capabilities expose decision graph", capabilities.decisionGraph?.path === "/api/decide/webhook");
    record(
      "capabilities expose guided execution",
      capabilities.actions?.some((action) => action.id === "execute.guided_webhook")
    );
    record("capabilities expose browser handoff", capabilities.handoff?.path === "/api/handoff/browser");
    record("capabilities expose schedule preview", capabilities.schedules?.previewPath === "/api/schedules/preview");
    record("capabilities expose secret policy", capabilities.secretStorage?.status === "not-supported-in-public-mvp");
    record("capabilities expose browser CORS policy", capabilities.browserAccess?.cors?.enabled === true);
    record("capabilities expose discovery header policy", capabilities.browserAccess?.discoveryHeaders?.enabled === true);
    record("capabilities expose cache policy", capabilities.cachePolicy?.dynamicCacheControl === "no-store");
    record("capabilities expose x402 payment headers", capabilities.x402?.requestPaymentHeaders?.includes("X-PAYMENT"));
    record("capabilities expose action catalog", capabilities.actionCatalog?.path === "/api/actions");
    record("capabilities expose ecosystem pack", capabilities.ecosystem?.cookbooks === "/cookbooks");
    record("capabilities expose proof badge", capabilities.verification?.proofBadge === "/proof/{jobOrReceiptId}");
    record("capabilities expose MCP guide link", typeof capabilities.links?.mcpGuide === "string");
    record("capabilities expose trust summary", capabilities.trust?.path === "/api/trust");
    record("capabilities expose status page", capabilities.statusPage?.path === "/status");
    if (expectX402) {
      record("capabilities mark action paid", capabilities.actions?.[0]?.paid === true);
    }
  }

  if (agentManifest) {
    record("agent manifest has schema", agentManifest.schemaVersion === "action402.agent-manifest.v1");
    record("agent manifest exposes paid action", agentManifest.paidActions?.some((action) => action.path === "/api/execute/webhook"));
    record(
      "agent manifest exposes guided paid action",
      agentManifest.paidActions?.some((action) => action.path === "/api/execute/guided-webhook")
    );
    record(
      "agent manifest exposes decision graph",
      agentManifest.freeAgentSurfaces?.some((surface) => surface.path === "/api/decide/webhook")
    );
    record("agent manifest exposes API index", agentManifest.freeAgentSurfaces?.some((surface) => surface.path === "/api"));
    record("agent manifest exposes pricing", agentManifest.freeAgentSurfaces?.some((surface) => surface.path === "/api/pricing"));
    record("agent manifest exposes MCP manifest", agentManifest.freeAgentSurfaces?.some((surface) => surface.path === "/api/mcp"));
    record("agent manifest exposes free surfaces", agentManifest.freeAgentSurfaces?.some((surface) => surface.path === "/api/capabilities"));
    record("agent manifest exposes status page", agentManifest.browserPages?.some((page) => page.path === "/status"));
    record("agent manifest exposes cookbooks page", agentManifest.browserPages?.some((page) => page.path === "/cookbooks"));
    record("agent manifest exposes ecosystem artifacts", typeof agentManifest.ecosystem?.agentSkill === "string");
  }

  if (openapi) {
    const operations = Object.values(openapi.paths || {}).flatMap((pathItem) =>
      Object.values(pathItem || {}).filter((operation) => operation && typeof operation === "object" && operation.operationId)
    );
    const operationIds = operations.map((operation) => operation.operationId);

    record("openapi exposes API index", Boolean(openapi.paths?.["/api"]?.get));
    record("openapi exposes discovery pack", Boolean(openapi.paths?.["/api/discovery"]?.get));
    record("openapi exposes pricing", Boolean(openapi.paths?.["/api/pricing"]?.get));
    record("openapi exposes MCP manifest", Boolean(openapi.paths?.["/api/mcp"]?.get));
    record("openapi exposes x402 well-known fallback", Boolean(openapi.paths?.["/.well-known/x402"]?.get));
    record("openapi exposes well-known MCP manifest", Boolean(openapi.paths?.["/.well-known/mcp.json"]?.get));
    record("openapi exposes stable execute operationId", openapi.paths?.["/api/execute/webhook"]?.post?.operationId === "executeWebhook");
    record("openapi exposes decision graph", openapi.paths?.["/api/decide/webhook"]?.post?.operationId === "decideWebhook");
    record(
      "openapi exposes guided execution",
      openapi.paths?.["/api/execute/guided-webhook"]?.post?.operationId === "executeGuidedWebhook"
    );
    record("openapi exposes decision records", Boolean(openapi.paths?.["/api/decisions/{id}"]?.get));
    record("openapi exposes stable discovery operationId", openapi.paths?.["/api/discovery"]?.get?.operationId === "getDiscoveryPack");
    record("openapi exposes stable pricing operationId", openapi.paths?.["/api/pricing"]?.get?.operationId === "getPricing");
    record("openapi operationIds are unique", operationIds.length >= 30 && operationIds.length === new Set(operationIds).size);
    record("openapi exposes cache policy", openapi["x-action402-cache"]?.dynamicCacheControl === "no-store");
    record("openapi exposes discovery header policy", openapi["x-action402-discovery-headers"]?.enabled === true);
    record("openapi exposes x402 security scheme", openapi.components?.securitySchemes?.X402Payment?.name === "X-PAYMENT");
    record(
      "openapi marks paid route x402 protected",
      openapi.paths?.["/api/execute/webhook"]?.post?.security?.some((item) => Array.isArray(item.X402Payment))
    );
  }

  if (wellKnownAgent) {
    record("well-known agent manifest loads", wellKnownAgent.schemaVersion === "action402.agent-manifest.v1");
  }

  if (wellKnownAction402) {
    record("well-known action402 manifest loads", wellKnownAction402.name === "Action402");
  }

  if (wellKnownX402Bare) {
    record("well-known x402 fallback loads", wellKnownX402Bare.paidActions?.[0]?.payment?.scheme === "exact");
  }

  if (wellKnownX402) {
    record("well-known x402 manifest exposes exact payment", wellKnownX402.paidActions?.[0]?.payment?.scheme === "exact");
  }

  if (wellKnownMcp) {
    record("well-known MCP manifest loads", wellKnownMcp.recommendedToolName === "execute_webhook");
    record("well-known MCP manifest is honest", wellKnownMcp.status === "manifest-only");
  }

  if (actions) {
    record("actions endpoint exposes active primitive", actions.activePrimitive?.id === "execute.webhook");
    record("actions endpoint exposes guided primitive", actions.guidedPrimitive?.path === "/api/execute/guided-webhook");
    record("actions endpoint exposes templates", Array.isArray(actions.templates) && actions.templates.length >= 9);
    record(
      "actions endpoint exposes policy modes",
      Array.isArray(actions.policyModes) && actions.policyModes.some((mode) => mode.id === "open-public-https")
    );
    record("actions endpoint marks schedules honestly", actions.scheduledActions?.status === "preview-only");
    record("actions endpoint exposes handoff pattern", actions.browserHandoff?.endpoint?.path === "/api/handoff/browser");
    record("actions endpoint exposes secret policy", actions.secretStorage?.endpoint?.path === "/api/secrets/policy");
    record("actions endpoint exposes snippets", Array.isArray(actions.snippets) && actions.snippets.length >= 3);
  }

  if (quickstart) {
    record("quickstart endpoint exposes payment route", quickstart.payment?.route?.endsWith("/api/execute/webhook"));
    record("quickstart endpoint exposes decision flow", quickstart.callFlow?.some((step) => step.includes("/api/decide/webhook")));
    record("quickstart endpoint exposes minimal request", quickstart.minimalRequest?.url === "https://httpbin.org/anything");
    record("quickstart endpoint exposes proof badge", quickstart.verify?.proofBadge?.endsWith("/proof/{jobOrReceiptId}"));
    record("quickstart endpoint exposes call flow", Array.isArray(quickstart.callFlow) && quickstart.callFlow.length >= 5);
  }

  if (pricing) {
    record("pricing endpoint exposes paid route", pricing.payment?.route?.endsWith("/api/execute/webhook"));
    record("pricing endpoint exposes guided paid route", pricing.paidActions?.some((action) => action.path === "/api/execute/guided-webhook"));
    record("pricing endpoint exposes free decision graph", pricing.freeSurfaces?.decision?.includes("/api/decide/webhook"));
    record("pricing endpoint exposes exact price", pricing.payment?.price?.display === health?.price);
    record("pricing endpoint exposes free surfaces", pricing.freeSurfaces?.discovery?.includes("/api/capabilities"));
    record("pricing endpoint exposes status surface", pricing.freeSurfaces?.trustAndMonitoring?.includes("/status"));
    record("pricing endpoint exposes buyer guardrails", pricing.buyerGuardrails?.some((item) => item.includes("/api/policy/check")));
  }

  if (mcpManifest) {
    record("MCP manifest exposes recommended tool", mcpManifest.recommendedToolName === "execute_webhook");
    record("MCP manifest marks hosted server honestly", mcpManifest.mcpServer?.hostedByAction402 === false);
    record("MCP manifest exposes paid tool", mcpManifest.tools?.some((tool) => tool.name === "execute_webhook" && tool.paid === true));
    record("MCP manifest exposes pricing guardrail", mcpManifest.buyerFlow?.some((step) => step.includes("/api/pricing")));
    record("MCP manifest exposes well-known link", mcpManifest.links?.wellKnown?.endsWith("/.well-known/mcp.json"));
  }

  if (policyCheck) {
    record("policy check endpoint returns structured result", policyCheck.allowed === false && policyCheck.ok === false);
    record("policy check rejects private targets", policyCheck.error?.code === "unsafe_target");
    record("policy check points to paid action", policyCheck.action?.path === "/api/execute/webhook");
  }

  if (canaryEcho) {
    record("canary echo GET returns ok", canaryMetadata?.ok === true && canaryMetadata?.paid === false);
    record("canary echo returns ok", canaryEcho.ok === true && canaryEcho.endpoint === "/api/canary/echo");
    record("canary echo is free", canaryEcho.paid === false);
    record("canary echo keeps secrets redacted", canaryEcho.acceptedFields?.secret === undefined);
  }

  if (handoffCapabilities) {
    record("handoff capabilities mark handoff-only", handoffCapabilities.status === "active-handoff-only");
    record("handoff capabilities expose endpoint", handoffCapabilities.path === "/api/handoff/browser");
  }

  if (handoff) {
    record("handoff endpoint returns package", handoff.ok === true && handoff.handoff?.executionModel === "browser-handoff-only");
    record("handoff endpoint does not claim execution", handoff.handoff?.notExecutedByAction402 === true);
  }

  if (scheduleCapabilities) {
    record("schedule capabilities mark preview-only", scheduleCapabilities.status === "preview-only");
    record("schedule capabilities expose preview endpoint", scheduleCapabilities.previewPath === "/api/schedules/preview");
  }

  if (schedulePreview) {
    record("schedule preview endpoint returns preview", schedulePreview.ok === true && schedulePreview.status === "preview-only");
    record("schedule preview endpoint does not execute", schedulePreview.willExecute === false);
  }

  if (secretPolicy) {
    record("secret policy endpoint is explicit", secretPolicy.status === "not-supported-in-public-mvp");
    record("secret policy endpoint blocks private keys", secretPolicy.neverSend?.includes("wallet private keys"));
  }

  if (snippets) {
    record("snippets endpoint exposes payment route", snippets.payment?.route?.endsWith("/api/execute/webhook"));
    record("snippets endpoint exposes groups", Array.isArray(snippets.groups) && snippets.groups.length >= 4);
    record("snippets endpoint exposes advanced surfaces", snippets.groups?.some((group) => group.id === "advanced-surfaces"));
    record("snippets endpoint exposes decision-first flow", snippets.groups?.some((group) => group.id === "decision-first"));
    record(
      "snippets endpoint exposes verification examples",
      snippets.groups?.some((group) => group.id === "verification" && Array.isArray(group.snippets) && group.snippets.length >= 2)
    );
    record("snippets endpoint exposes proof badge link", snippets.links?.proofBadge?.endsWith("/proof/{jobOrReceiptId}"));
    record("snippets endpoint exposes decision link", snippets.links?.decisionGraph?.endsWith("/api/decide/webhook"));
  }

  if (decision) {
    record("decision endpoint returns structured recommendation", typeof decision.recommendation === "string");
    record("decision endpoint blocks unsafe target", decision.recommendation === "do_not_pay");
    record("decision endpoint redacts public record", decision.publicRecord?.publicFieldsOnly === true);
    record("decision endpoint links record", decision.links?.decision?.includes("/api/decisions/"));
  }

  if (recentDecisions) {
    record("recent decisions endpoint returns array", Array.isArray(recentDecisions.decisions));
    record("recent decisions endpoint publishes redaction policy", Array.isArray(recentDecisions.redactionPolicy?.redactedFields));
  }

  if (bazaar) {
    const route = bazaar.routeConfig?.["POST /api/execute/webhook"];
    record("bazaar route exists", Boolean(route));
    record("bazaar discovery extension is valid", bazaar.discovery?.bazaarExtensionValid === true);
    record("bazaar extension has POST method", route?.extensions?.bazaar?.info?.input?.method === "POST");
    record("bazaar extension has JSON body schema", route?.extensions?.bazaar?.info?.input?.bodyType === "json");
    record("bazaar metadata has service tags", Array.isArray(route?.tags) && route.tags.includes("x402"));
    record(
      "bazaar metadata has agent discovery keywords",
      Array.isArray(bazaar.discoveryKeywords) && bazaar.discoveryKeywords.includes("x402 paid API")
    );
    record(
      "bazaar metadata has quality signals",
      Array.isArray(bazaar.discovery?.qualitySignals) && bazaar.discovery.qualitySignals.length >= 4
    );
    record("bazaar metadata has proof link", typeof bazaar.links?.proofs === "string");
    record("bazaar metadata has discovery link", typeof bazaar.links?.discovery === "string");
    record("bazaar metadata has agent manifest link", typeof bazaar.links?.agentManifest === "string");
    record("bazaar metadata has well-known link", typeof bazaar.links?.wellKnownAgent === "string");
    record("bazaar metadata has x402 well-known fallback link", typeof bazaar.links?.wellKnownX402Bare === "string");
    record("bazaar metadata has sitemap link", typeof bazaar.links?.sitemap === "string");
    record("bazaar metadata has action catalog link", typeof bazaar.links?.actionCatalog === "string");
    record("bazaar metadata has quickstart link", typeof bazaar.links?.quickstart === "string");
    record("bazaar metadata has pricing API link", typeof bazaar.links?.pricingApi === "string");
    record("bazaar metadata has MCP manifest link", typeof bazaar.links?.mcpManifest === "string");
    record("bazaar metadata has policy check link", typeof bazaar.links?.policyCheck === "string");
    record("bazaar metadata has snippets link", typeof bazaar.links?.snippets === "string");
    record("bazaar metadata has decision graph link", typeof bazaar.links?.decisionGraph === "string");
    record("bazaar metadata has guided execution link", typeof bazaar.links?.guidedExecution === "string");
    record("bazaar metadata has handoff link", typeof bazaar.links?.handoffEndpoint === "string");
    record("bazaar metadata has canary link", typeof bazaar.links?.canaryEcho === "string");
    record("bazaar metadata has schedule preview link", typeof bazaar.links?.schedulePreview === "string");
    record("bazaar metadata has secret policy link", typeof bazaar.links?.secretPolicy === "string");
    record("bazaar metadata has proof badge link", typeof bazaar.links?.proofBadge === "string");
    record("bazaar metadata has monitoring link", typeof bazaar.links?.monitoring === "string");
    record("bazaar metadata has status link", typeof bazaar.links?.status === "string");
    record("bazaar metadata has use-case link", typeof bazaar.links?.useCases === "string");
    record("bazaar metadata has cookbook link", typeof bazaar.links?.cookbooks === "string");
    record("bazaar metadata has ecosystem link", typeof bazaar.links?.builtWith === "string");
    record("bazaar metadata has submission link", typeof bazaar.links?.submit === "string");
    record("bazaar metadata has Postman collection", typeof bazaar.links?.postmanCollection === "string");
    record("bazaar metadata has agent skill", typeof bazaar.links?.agentSkill === "string");
    record(
      "bazaar metadata has use-case templates",
      Array.isArray(bazaar.useCaseTemplates) && bazaar.useCaseTemplates.length >= 6
    );
    record(
      "bazaar metadata has action templates",
      typeof bazaar.actionCatalog?.templateCount === "number" && bazaar.actionCatalog.templateCount >= 9
    );
    if (expectX402) {
      record("bazaar payment points to Base mainnet", bazaar.payment?.network === "eip155:8453");
      record("bazaar payment has payTo", /^0x[a-fA-F0-9]{40}$/.test(bazaar.payment?.payTo || ""));
    }
  }

  if (proofs) {
    const firstProof = Array.isArray(proofs.proofs) ? proofs.proofs[0] : undefined;
    record("proofs endpoint exposes redaction policy", Array.isArray(proofs.redactionPolicy?.redactedFields));
    record("proofs endpoint returns an array", Array.isArray(proofs.proofs));
    if (firstProof) {
      record("proof summaries omit target URL", firstProof.target === undefined && firstProof.targetUrl === undefined);
      record("proof summaries omit hashes", firstProof.requestHash === undefined && firstProof.responseHash === undefined);
      record("proof summaries include verify link", typeof firstProof.links?.verifyJob === "string");
    }
  }

  if (monitoring) {
    record("monitoring endpoint exposes status", ["ok", "attention"].includes(monitoring.status));
    record("monitoring endpoint exposes durable stats", typeof monitoring.stats?.total === "number");
    record("monitoring endpoint exposes recent failures array", Array.isArray(monitoring.recentFailures));
  }

  if (trust) {
    record("trust endpoint exposes status", ["ok", "attention"].includes(trust.status));
    record("trust endpoint exposes x402 settings", trust.x402?.scheme === "exact");
    record("trust endpoint exposes public surfaces", typeof trust.publicSurfaces?.useCases === "string");
    record("trust endpoint exposes score", typeof trust.trustScore?.score === "number");
    record("trust endpoint exposes agent manifest surface", typeof trust.publicSurfaces?.agentManifest === "string");
    record("trust endpoint exposes well-known surface", typeof trust.publicSurfaces?.wellKnownAgent === "string");
    record("trust endpoint exposes x402 well-known fallback", typeof trust.publicSurfaces?.wellKnownX402 === "string");
    record("trust endpoint exposes action catalog surface", typeof trust.publicSurfaces?.actionCatalog === "string");
    record("trust endpoint exposes cookbooks surface", typeof trust.publicSurfaces?.cookbooks === "string");
    record("trust endpoint exposes ecosystem surface", typeof trust.publicSurfaces?.builtWith === "string");
    record("trust endpoint exposes policy check surface", typeof trust.publicSurfaces?.policyCheck === "string");
    record("trust endpoint exposes canary surface", typeof trust.publicSurfaces?.canaryEcho === "string");
    record("trust endpoint exposes snippets surface", typeof trust.publicSurfaces?.snippets === "string");
    record("trust endpoint exposes decision surface", typeof trust.publicSurfaces?.decisionGraph === "string");
    record("trust endpoint exposes recent decisions surface", typeof trust.publicSurfaces?.recentDecisions === "string");
    record("trust endpoint exposes handoff surface", typeof trust.publicSurfaces?.handoffCapabilities === "string");
    record("trust endpoint exposes schedule preview surface", typeof trust.publicSurfaces?.schedulePreview === "string");
    record("trust endpoint exposes secret policy surface", typeof trust.publicSurfaces?.secretPolicy === "string");
    record("trust endpoint exposes trust signals", Array.isArray(trust.trustSignals) && trust.trustSignals.length >= 6);
    record("trust endpoint exposes status surface", typeof trust.publicSurfaces?.status === "string");
  }

  if (apiNotFound.body) {
    record("unknown API route returns structured code", apiNotFound.body.error?.code === "api_route_not_found");
    record("unknown API route links OpenAPI", apiNotFound.body.error?.details?.openapi === "/openapi.json");
  }

  if (executeWrongMethod.body) {
    record("execute route wrong method returns 405 code", executeWrongMethod.body.error?.code === "method_not_allowed");
    record("execute route exposes Allow POST", executeWrongMethod.response?.headers.get("allow") === "POST");
  }

  if (guidedWrongMethod.body) {
    record("guided route wrong method returns 405 code", guidedWrongMethod.body.error?.code === "method_not_allowed");
    record("guided route exposes Allow POST", guidedWrongMethod.response?.headers.get("allow") === "POST");
  }

  if (canaryWrongMethod.body) {
    record("canary route wrong method returns 405 code", canaryWrongMethod.body.error?.code === "method_not_allowed");
    record("canary route exposes Allow GET POST", canaryWrongMethod.response?.headers.get("allow") === "GET, POST");
  }

  const failed = checks.filter((check) => !check.ok);
  for (const check of checks) {
    const prefix = check.ok ? "PASS" : "FAIL";
    console.log(`${prefix} ${check.name}${check.details ? ` (${check.details})` : ""}`);
  }

  if (failed.length > 0) {
    console.error(`deploy check failed: ${failed.length}/${checks.length} checks failed.`);
    process.exit(1);
  }

  console.log(`deploy check passed: ${checks.length}/${checks.length} checks passed.`);
}

await main();
