const baseUrl = normalizeBaseUrl(process.argv[2] || process.env.SMOKE_BASE_URL || "http://127.0.0.1:4021");
const checks = [];

function normalizeBaseUrl(value) {
  return String(value).replace(/\/+$/, "");
}

function record(name, ok, details = "") {
  checks.push({ name, ok, details });
}

async function fetchJson(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { response, body };
}

async function checkJsonEndpoint(path) {
  try {
    const { response, body } = await fetchJson(path);
    const ok = response.status === 200 && body && typeof body === "object";
    record(`${path} returns JSON`, ok, ok ? "" : `status=${response.status}`);
    return body;
  } catch (error) {
    record(`${path} returns JSON`, false, error.message);
    return undefined;
  }
}

async function checkPolicyEndpoint() {
  try {
    const { response, body } = await fetchJson("/api/policy/check", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        url: "https://127.0.0.1/internal",
        method: "POST",
        idempotencyKey: "x402-smoke-policy"
      })
    });
    record(
      "/api/policy/check returns structured result",
      response.status === 200 && body?.allowed === false && body?.error?.code === "unsafe_target",
      `status=${response.status}`
    );
    return body;
  } catch (error) {
    record("/api/policy/check returns structured result", false, error.message);
    return undefined;
  }
}

function paymentHeaders(headers) {
  return Array.from(headers.entries()).filter(([name]) => {
    const lower = name.toLowerCase();
    return lower.includes("payment") || lower === "www-authenticate";
  });
}

function headerIncludes(headers, name, expectedValue) {
  return (headers.get(name) || "")
    .toLowerCase()
    .split(",")
    .map((value) => value.trim())
    .includes(expectedValue.toLowerCase());
}

function hasShortDiscoveryCache(headers) {
  const cacheControl = headers.get("cache-control") || "";
  const policyHeader = headers.get("x-action402-cache-policy") || "";
  const clientCacheIsPublic = headerIncludes(headers, "cache-control", "public");
  const clientCacheIsShort = headerIncludes(headers, "cache-control", "max-age=60");
  const fullPolicyIsVisible =
    cacheControl.toLowerCase().includes("s-maxage=300") || policyHeader.toLowerCase().includes("s-maxage=300");
  return clientCacheIsPublic && clientCacheIsShort && fullPolicyIsVisible;
}

function hasNoStoreCache(headers) {
  return headers.get("cache-control") === "no-store" && headers.get("x-action402-cache-policy") === "no-store";
}

function hasDiscoveryHeaders(headers) {
  const link = headers.get("link") || "";
  return (
    headers.get("x-action402-agent-entry") === "/api" &&
    link.includes("/api/agent-manifest") &&
    link.includes("/openapi.json") &&
    link.includes("/api/pricing") &&
    link.includes("/api/mcp") &&
    link.includes("/api/bazaar")
  );
}

async function checkCachePolicy() {
  try {
    const stable = await fetchJson("/api");
    record("API index is short-cacheable", hasShortDiscoveryCache(stable.response.headers));
    record("API index exposes discovery headers", hasDiscoveryHeaders(stable.response.headers));

    const runtime = await fetchJson("/health");
    record("Runtime health is no-store", hasNoStoreCache(runtime.response.headers));
  } catch (error) {
    record("Cache policy is checkable", false, error.message);
  }
}

async function main() {
  console.log(`Action402 x402 smoke: ${baseUrl}`);

  const health = await checkJsonEndpoint("/health");
  const apiIndex = await checkJsonEndpoint("/api");
  const discovery = await checkJsonEndpoint("/api/discovery");
  const agentManifest = await checkJsonEndpoint("/api/agent-manifest");
  const wellKnownAgent = await checkJsonEndpoint("/.well-known/agent.json");
  const capabilities = await checkJsonEndpoint("/api/capabilities");
  const pricing = await checkJsonEndpoint("/api/pricing");
  const mcpManifest = await checkJsonEndpoint("/api/mcp");
  const wellKnownMcp = await checkJsonEndpoint("/.well-known/mcp.json");
  const actions = await checkJsonEndpoint("/api/actions");
  const quickstart = await checkJsonEndpoint("/api/quickstart");
  await checkPolicyEndpoint();
  const canaryEcho = await fetchJson("/api/canary/echo", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      event: "x402.smoke.canary",
      scenario: "x402-smoke",
      runId: "x402-smoke-001",
      source: "x402-smoke",
      secret: "must-not-echo"
    })
  }).then(({ response, body }) => {
    record(
      "/api/canary/echo returns redacted JSON",
      response.status === 200 && body?.ok === true && body?.acceptedFields?.secret === undefined,
      `status=${response.status}`
    );
    return body;
  }).catch((error) => {
    record("/api/canary/echo returns redacted JSON", false, error.message);
    return undefined;
  });
  const handoffCapabilities = await checkJsonEndpoint("/api/handoff/capabilities");
  const scheduleCapabilities = await checkJsonEndpoint("/api/schedules/capabilities");
  const secretPolicy = await checkJsonEndpoint("/api/secrets/policy");
  const snippets = await checkJsonEndpoint("/api/snippets");
  const bazaar = await checkJsonEndpoint("/api/bazaar");
  const openapi = await checkJsonEndpoint("/openapi.json");
  await checkCachePolicy();

  if (health) {
    record("x402 is enabled", health.x402Enabled === true, `x402Enabled=${health.x402Enabled}`);
  }

  if (apiIndex) {
    record("API index is published", apiIndex.service === "Action402");
    record("API index points to paid action", apiIndex.paid?.some((action) => action.path === "/api/execute/webhook"));
    record("API index points to discovery", apiIndex.recommendedStart?.includes("/api/discovery"));
    record("API index points to pricing", apiIndex.recommendedStart?.includes("/api/pricing"));
    record("API index points to MCP manifest", apiIndex.recommendedStart?.includes("/api/mcp"));
    record("API index points to status", apiIndex.free?.trustAndMonitoring?.includes("/status"));
  }

  if (discovery) {
    record("Discovery pack is published", discovery.schemaVersion === "action402.discovery.v1");
    record("Discovery pack points to agent manifest", discovery.agentManifest?.endsWith("/api/agent-manifest"));
    record("Discovery pack points to pricing", discovery.pricing?.endsWith("/api/pricing"));
    record("Discovery pack points to Bazaar metadata", discovery.bazaar?.endsWith("/api/bazaar"));
  }

  if (agentManifest) {
    record("Agent manifest is published", agentManifest.schemaVersion === "action402.agent-manifest.v1");
    record("Agent manifest exposes paid action", agentManifest.paidActions?.some((action) => action.path === "/api/execute/webhook"));
    record("Agent manifest exposes status page", agentManifest.browserPages?.some((page) => page.path === "/status"));
  }

  if (wellKnownAgent) {
    record("Well-known agent manifest is published", wellKnownAgent.schemaVersion === "action402.agent-manifest.v1");
  }

  if (capabilities) {
    record(
      "agent discovery prompt is published",
      typeof capabilities.agentPrompt === "string" && capabilities.agentPrompt.includes("Action402")
    );
    record(
      "MCP discovery hint is published",
      capabilities.mcp?.recommendedToolName === "execute_webhook"
    );
    record("Browser CORS policy is published", capabilities.browserAccess?.cors?.enabled === true);
    record("Discovery header policy is published", capabilities.browserAccess?.discoveryHeaders?.enabled === true);
    record("Cache policy is published", capabilities.cachePolicy?.dynamicCacheControl === "no-store");
    record("x402 payment headers are published", capabilities.x402?.requestPaymentHeaders?.includes("X-PAYMENT"));
    record("Pricing surface is published", capabilities.pricing?.path === "/api/pricing");
    record("MCP manifest surface is published", capabilities.mcpManifest?.path === "/api/mcp");
    record("Status page surface is published", capabilities.statusPage?.path === "/status");
  }

  if (pricing) {
    record("Pricing endpoint is published", pricing.payment?.route?.endsWith("/api/execute/webhook"));
    record("Pricing endpoint matches health price", pricing.payment?.price?.display === health?.price);
    record("Pricing endpoint exposes status surface", pricing.freeSurfaces?.trustAndMonitoring?.includes("/status"));
    record("Pricing endpoint exposes buyer guardrails", pricing.buyerGuardrails?.some((item) => item.includes("/api/policy/check")));
  }

  if (mcpManifest) {
    record("MCP manifest is published", mcpManifest.recommendedToolName === "execute_webhook");
    record("MCP manifest is honest about hosting", mcpManifest.mcpServer?.hostedByAction402 === false);
    record("MCP manifest exposes paid tool", mcpManifest.tools?.some((tool) => tool.name === "execute_webhook"));
  }

  if (wellKnownMcp) {
    record("Well-known MCP manifest is published", wellKnownMcp.recommendedToolName === "execute_webhook");
  }

  if (openapi) {
    const operations = Object.values(openapi.paths || {}).flatMap((pathItem) =>
      Object.values(pathItem || {}).filter((operation) => operation && typeof operation === "object" && operation.operationId)
    );
    const operationIds = operations.map((operation) => operation.operationId);

    record("OpenAPI API index path is published", Boolean(openapi.paths?.["/api"]?.get));
    record("OpenAPI discovery path is published", Boolean(openapi.paths?.["/api/discovery"]?.get));
    record("OpenAPI pricing path is published", Boolean(openapi.paths?.["/api/pricing"]?.get));
    record("OpenAPI MCP manifest path is published", Boolean(openapi.paths?.["/api/mcp"]?.get));
    record("OpenAPI execute operationId is stable", openapi.paths?.["/api/execute/webhook"]?.post?.operationId === "executeWebhook");
    record("OpenAPI operationIds are unique", operationIds.length >= 30 && operationIds.length === new Set(operationIds).size);
    record("OpenAPI cache policy is published", openapi["x-action402-cache"]?.dynamicCacheControl === "no-store");
    record("OpenAPI discovery header policy is published", openapi["x-action402-discovery-headers"]?.enabled === true);
    record("OpenAPI x402 security scheme is published", openapi.components?.securitySchemes?.X402Payment?.name === "X-PAYMENT");
    record(
      "OpenAPI paid route is marked x402 protected",
      openapi.paths?.["/api/execute/webhook"]?.post?.security?.some((item) => Array.isArray(item.X402Payment))
    );
  }

  if (actions) {
    record("Action catalog is published", Array.isArray(actions.templates) && actions.templates.length >= 9);
    record("Policy modes are published", Array.isArray(actions.policyModes) && actions.policyModes.length >= 3);
  }

  if (quickstart) {
    record("Quickstart route is published", quickstart.payment?.route?.endsWith("/api/execute/webhook"));
    record("Quickstart proof badge is published", quickstart.verify?.proofBadge?.endsWith("/proof/{jobOrReceiptId}"));
  }

  if (canaryEcho) {
    record("Canary echo is free", canaryEcho.paid === false);
  }

  if (handoffCapabilities) {
    record("Browser handoff is published", handoffCapabilities.status === "active-handoff-only");
  }

  if (scheduleCapabilities) {
    record("Schedule preview is published", scheduleCapabilities.status === "preview-only");
  }

  if (secretPolicy) {
    record("Secret policy is published", secretPolicy.status === "not-supported-in-public-mvp");
  }

  if (snippets) {
    record("Integration snippets are published", Array.isArray(snippets.groups) && snippets.groups.length >= 4);
    record("Verification snippets are published", snippets.groups?.some((group) => group.id === "verification"));
  }

  if (bazaar) {
    record("Bazaar extension is valid", bazaar.discovery?.bazaarExtensionValid === true);
    record(
      "Bazaar discovery keywords are published",
      Array.isArray(bazaar.discoveryKeywords) && bazaar.discoveryKeywords.includes("paid webhook execution")
    );
  }

  try {
    const response = await fetch(`${baseUrl}/api/execute/webhook`, {
      method: "OPTIONS",
      headers: {
        origin: "https://agent.example",
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type,x-payment,payment-signature"
      }
    });
    record("browser agent preflight returns 204", response.status === 204, `status=${response.status}`);
    record("browser agent preflight allows x-payment", headerIncludes(response.headers, "access-control-allow-headers", "x-payment"));
    record(
      "browser agent preflight exposes cache policy",
      headerIncludes(response.headers, "access-control-expose-headers", "x-action402-cache-policy")
    );
    record("browser agent preflight exposes Link", headerIncludes(response.headers, "access-control-expose-headers", "link"));
  } catch (error) {
    record("browser agent preflight returns 204", false, error.message);
    record("browser agent preflight allows x-payment", false, error.message);
    record("browser agent preflight exposes cache policy", false, error.message);
    record("browser agent preflight exposes Link", false, error.message);
  }

  try {
    const response = await fetch(`${baseUrl}/api/execute/webhook`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://agent.example"
      },
      body: JSON.stringify({
        url: "https://example.com/webhook",
        method: "POST",
        body: {
          event: "action402.unpaid-smoke"
        },
        idempotencyKey: `x402-smoke-${Date.now()}`
      })
    });
    const headers = paymentHeaders(response.headers);
    const body = await response.text();

    record("unpaid execution returns 402", response.status === 402, `status=${response.status}`);
    record(
      "x402 payment header is present",
      headers.length > 0,
      headers.length > 0 ? headers.map(([name]) => name).join(", ") : body.slice(0, 160)
    );
    record("402 is readable by browser agents", response.headers.get("access-control-allow-origin") === "*");
  } catch (error) {
    record("unpaid execution returns 402", false, error.message);
    record("x402 payment header is present", false, error.message);
    record("402 is readable by browser agents", false, error.message);
  }

  const failed = checks.filter((check) => !check.ok);
  for (const check of checks) {
    const prefix = check.ok ? "PASS" : "FAIL";
    console.log(`${prefix} ${check.name}${check.details ? ` (${check.details})` : ""}`);
  }

  if (failed.length > 0) {
    console.error(`x402 smoke failed: ${failed.length}/${checks.length} checks failed.`);
    process.exit(1);
  }

  console.log(`x402 smoke passed: ${checks.length}/${checks.length} checks passed.`);
}

await main();
