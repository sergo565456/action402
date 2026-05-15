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

async function main() {
  console.log(`Action402 x402 smoke: ${baseUrl}`);

  const health = await checkJsonEndpoint("/health");
  const capabilities = await checkJsonEndpoint("/api/capabilities");
  const actions = await checkJsonEndpoint("/api/actions");
  const quickstart = await checkJsonEndpoint("/api/quickstart");
  await checkPolicyEndpoint();
  const handoffCapabilities = await checkJsonEndpoint("/api/handoff/capabilities");
  const scheduleCapabilities = await checkJsonEndpoint("/api/schedules/capabilities");
  const secretPolicy = await checkJsonEndpoint("/api/secrets/policy");
  const snippets = await checkJsonEndpoint("/api/snippets");
  const bazaar = await checkJsonEndpoint("/api/bazaar");
  await checkJsonEndpoint("/openapi.json");

  if (health) {
    record("x402 is enabled", health.x402Enabled === true, `x402Enabled=${health.x402Enabled}`);
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
  }

  if (actions) {
    record("Action catalog is published", Array.isArray(actions.templates) && actions.templates.length >= 9);
    record("Policy modes are published", Array.isArray(actions.policyModes) && actions.policyModes.length >= 3);
  }

  if (quickstart) {
    record("Quickstart route is published", quickstart.payment?.route?.endsWith("/api/execute/webhook"));
    record("Quickstart proof badge is published", quickstart.verify?.proofBadge?.endsWith("/proof/{jobOrReceiptId}"));
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
      method: "POST",
      headers: {
        "content-type": "application/json"
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
  } catch (error) {
    record("unpaid execution returns 402", false, error.message);
    record("x402 payment header is present", false, error.message);
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
