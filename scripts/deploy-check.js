const baseUrl = normalizeBaseUrl(process.argv[2] || process.env.DEPLOY_BASE_URL || "http://127.0.0.1:4021");
const expectX402 = process.argv.includes("--expect-x402") || process.env.EXPECT_X402 === "true";
const checks = [];

function normalizeBaseUrl(value) {
  return String(value || "").replace(/\/+$/, "");
}

function record(name, ok, details = "") {
  checks.push({ name, ok, details });
}

async function fetchText(path) {
  const response = await fetch(`${baseUrl}${path}`);
  const text = await response.text();
  return { response, text };
}

async function fetchJson(path) {
  const { response, text } = await fetchText(path);
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

async function checkJson(path) {
  try {
    const { response, body } = await fetchJson(path);
    record(`${path} returns JSON`, response.status === 200 && body && typeof body === "object", `status=${response.status}`);
    return body;
  } catch (error) {
    record(`${path} returns JSON`, false, error.message);
    return undefined;
  }
}

async function main() {
  console.log(`Action402 deploy check: ${baseUrl}`);

  await checkStatic("/", "Action402");
  await checkStatic("/demo.html", "Action402 Demo Console");
  await checkStatic("/brand.html", "Action402 Brand");
  await checkStatic("/agents", "Pay for one action");
  await checkStatic("/llms.txt", "paid webhook execution");

  const health = await checkJson("/health");
  const capabilities = await checkJson("/api/capabilities");
  const bazaar = await checkJson("/api/bazaar");
  await checkJson("/openapi.json");

  if (health) {
    record("health ok", health.ok === true, `ok=${health.ok}`);
    if (expectX402) {
      record("x402 enabled", health.x402Enabled === true, `x402Enabled=${health.x402Enabled}`);
    }
  }

  if (capabilities) {
    record("capabilities expose execute.webhook", capabilities.actions?.[0]?.id === "execute.webhook");
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
    if (expectX402) {
      record("capabilities mark action paid", capabilities.actions?.[0]?.paid === true);
    }
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
    if (expectX402) {
      record("bazaar payment points to Base mainnet", bazaar.payment?.network === "eip155:8453");
      record("bazaar payment has payTo", /^0x[a-fA-F0-9]{40}$/.test(bazaar.payment?.payTo || ""));
    }
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
