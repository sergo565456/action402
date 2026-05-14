import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";

const host = "127.0.0.1";
const port = Number(process.env.SMOKE_PORT || (await findOpenPort()));
const baseUrl = `http://${host}:${port}`;
const storeFile = path.resolve(process.cwd(), "data/action402-testnet-unpaid-smoke-store.json");
const checks = [];

function record(name, ok, details = "") {
  checks.push({ name, ok, details });
}

function findOpenPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

async function waitForHealth(timeoutMs = 15000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return response.json();
    } catch {
      // Server not ready yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`server did not become healthy at ${baseUrl}`);
}

function paymentHeaders(headers) {
  return Array.from(headers.entries()).filter(([name]) => {
    const lower = name.toLowerCase();
    return lower.includes("payment") || lower === "www-authenticate";
  });
}

async function fetchJson(pathname) {
  const response = await fetch(`${baseUrl}${pathname}`);
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { response, body };
}

async function checkJsonEndpoint(pathname) {
  try {
    const { response, body } = await fetchJson(pathname);
    record(`${pathname} returns JSON`, response.status === 200 && body && typeof body === "object", `status=${response.status}`);
    return body;
  } catch (error) {
    record(`${pathname} returns JSON`, false, error.message);
    return undefined;
  }
}

async function runSmoke() {
  const health = await checkJsonEndpoint("/health");
  const capabilities = await checkJsonEndpoint("/api/capabilities");
  await checkJsonEndpoint("/api/bazaar");
  await checkJsonEndpoint("/openapi.json");

  record("x402 is enabled", health?.x402Enabled === true, `x402Enabled=${health?.x402Enabled}`);
  record("testnet network is Base Sepolia", health?.network === "eip155:84532", `network=${health?.network}`);
  record("execute.webhook is marked paid", capabilities?.actions?.[0]?.paid === true);

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
          event: "action402.testnet-unpaid-smoke"
        },
        idempotencyKey: `testnet-unpaid-smoke-${Date.now()}`
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
}

await fs.mkdir(path.dirname(storeFile), { recursive: true });
await fs.rm(storeFile, { force: true });

const child = spawn(process.execPath, ["src/server.js"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    ACTION402_PROFILE: "testnet-smoke",
    PORT: String(port),
    HOST: host,
    PUBLIC_BASE_URL: baseUrl,
    X402_ENABLED: "true",
    PAY_TO: "0x1111111111111111111111111111111111111111",
    RECEIPT_KEY_ID: "testnet-smoke-v1",
    RECEIPT_SECRET: "local-testnet-unpaid-smoke-receipt-secret",
    RECEIPT_PREVIOUS_SECRETS: "",
    X402_NETWORK: "eip155:84532",
    X402_PRICE: "$0.001",
    FACILITATOR_URL: "https://x402.org/facilitator",
    STORE_DRIVER: "json",
    STORE_FILE: storeFile,
    TARGET_POLICY_PRESET: "open",
    TARGET_ALLOWLIST: "",
    TARGET_BLOCKLIST: "",
    REQUIRE_TARGET_ALLOWLIST: "false",
    TARGET_QUOTA_ENABLED: "true",
    TARGET_QUOTA_WINDOW_MS: "60000",
    TARGET_QUOTA_MAX_REQUESTS: "20",
    LOG_LEVEL: "silent",
    REQUEST_LOG_ENABLED: "false"
  },
  stdio: ["ignore", "pipe", "pipe"]
});

let stderr = "";
child.stderr.on("data", (chunk) => {
  stderr += chunk.toString();
});

try {
  await waitForHealth();
  console.log(`Action402 testnet unpaid smoke: ${baseUrl}`);
  await runSmoke();
} finally {
  child.kill("SIGTERM");
}

const failed = checks.filter((check) => !check.ok);
for (const check of checks) {
  const prefix = check.ok ? "PASS" : "FAIL";
  console.log(`${prefix} ${check.name}${check.details ? ` (${check.details})` : ""}`);
}

if (failed.length > 0) {
  if (stderr) console.error(stderr.trim());
  console.error(`testnet unpaid smoke failed: ${failed.length}/${checks.length} checks failed.`);
  process.exit(1);
}

console.log(`testnet unpaid smoke passed: ${checks.length}/${checks.length} checks passed.`);
