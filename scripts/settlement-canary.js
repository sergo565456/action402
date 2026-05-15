import { spawn } from "node:child_process";
import crypto from "node:crypto";

const DEFAULT_BASE_URL = "https://action402.vercel.app";
const DEFAULT_MAX_AMOUNT = "0.01";
const DEFAULT_NETWORK = "base";

function argValue(name, fallback = "") {
  const prefix = `${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);

  const index = process.argv.indexOf(name);
  if (index !== -1 && process.argv[index + 1]) return process.argv[index + 1];
  return fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function makeRunId() {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  return `canary-${stamp}-${crypto.randomBytes(4).toString("hex")}`;
}

function parseJsonFromOutput(output) {
  const trimmed = output.trim();
  if (!trimmed) return undefined;

  try {
    return JSON.parse(trimmed);
  } catch {
    // agentcash may print progress lines before JSON. Try parsing from the last JSON-looking line.
  }

  const lines = trimmed.split(/\r?\n/).reverse();
  for (const line of lines) {
    const candidate = line.trim();
    if (!candidate.startsWith("{") && !candidate.startsWith("[")) continue;
    try {
      return JSON.parse(candidate);
    } catch {
      // Continue scanning.
    }
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
    } catch {
      return undefined;
    }
  }

  return undefined;
}

function findJobId(value, seen = new Set()) {
  if (!value || typeof value !== "object") return "";
  if (seen.has(value)) return "";
  seen.add(value);

  if (value.job && typeof value.job === "object" && typeof value.job.id === "string") {
    return value.job.id;
  }
  if (typeof value.jobId === "string" && value.jobId.startsWith("job_")) {
    return value.jobId;
  }

  for (const item of Object.values(value)) {
    const found = findJobId(item, seen);
    if (found) return found;
  }

  return "";
}

function fetchJson(url, options) {
  return fetch(url, options).then(async (response) => {
    const text = await response.text();
    let body;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    return { response, body, text };
  });
}

function runCommand(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      shell: process.platform === "win32",
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

function fail(message, details = {}) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: message,
        ...details
      },
      null,
      2
    )
  );
  process.exit(1);
}

const baseUrl = trimTrailingSlash(
  argValue("--base-url", process.env.ACTION402_CANARY_BASE_URL || DEFAULT_BASE_URL)
);
const targetUrl = argValue(
  "--target-url",
  process.env.ACTION402_CANARY_TARGET_URL || `${baseUrl}/api/canary/echo`
);
const maxAmount = argValue("--max-amount", process.env.ACTION402_CANARY_MAX_AMOUNT || DEFAULT_MAX_AMOUNT);
const paymentNetwork = argValue("--payment-network", process.env.ACTION402_CANARY_NETWORK || DEFAULT_NETWORK);
const scenario = argValue("--scenario", process.env.ACTION402_CANARY_SCENARIO || "settlement-canary");
const runId = argValue("--run-id", process.env.GITHUB_RUN_ID ? `gh-${process.env.GITHUB_RUN_ID}` : makeRunId());
const idempotencyKey = `${scenario}-${runId}`.slice(0, 160);
const dryRun = hasFlag("--dry-run");

const payload = {
  url: targetUrl,
  method: "POST",
  headers: {
    "content-type": "application/json"
  },
  body: {
    event: "action402.settlement_canary",
    scenario,
    runId,
    source: process.env.GITHUB_ACTIONS === "true" ? "github-actions" : "local",
    generatedAt: new Date().toISOString()
  },
  idempotencyKey,
  retry: {
    attempts: 2,
    backoffMs: 300
  },
  timeoutMs: 10000
};

const agentcashArgs = [
  "--yes",
  "agentcash",
  "fetch",
  `${baseUrl}/api/execute/webhook`,
  "-m",
  "POST",
  "-H",
  "content-type: application/json",
  "-b",
  JSON.stringify(payload),
  "--payment-protocol",
  "x402",
  "--payment-network",
  paymentNetwork,
  "--max-amount",
  maxAmount,
  "-y",
  "--format",
  "json"
];

if (dryRun) {
  console.log(
    JSON.stringify(
      {
        ok: true,
        dryRun: true,
        baseUrl,
        targetUrl,
        maxAmount,
        paymentNetwork,
        scenario,
        runId,
        idempotencyKey,
        command: "npx",
        args: agentcashArgs,
        payload
      },
      null,
      2
    )
  );
  process.exit(0);
}

const health = await fetchJson(`${baseUrl}/health`);
if (!health.response.ok || health.body?.x402Enabled !== true) {
  fail("base URL is not a healthy x402-enabled Action402 deployment", {
    baseUrl,
    status: health.response.status,
    x402Enabled: health.body?.x402Enabled ?? null
  });
}

const canaryTarget = await fetchJson(targetUrl, {
  method: "POST",
  headers: {
    "content-type": "application/json"
  },
  body: JSON.stringify(payload.body)
});
if (!canaryTarget.response.ok || canaryTarget.body?.ok !== true) {
  fail("canary target did not return ok=true before paid settlement", {
    targetUrl,
    status: canaryTarget.response.status,
    body: canaryTarget.body
  });
}

const paid = await runCommand("npx", agentcashArgs);
if (paid.code !== 0) {
  fail("agentcash paid request failed", {
    exitCode: paid.code,
    stdoutTail: paid.stdout.slice(-2000),
    stderrTail: paid.stderr.slice(-2000)
  });
}

const paidBody = parseJsonFromOutput(paid.stdout);
const jobId = findJobId(paidBody);
if (!jobId) {
  fail("could not find Action402 job id in agentcash JSON output", {
    stdoutTail: paid.stdout.slice(-2000)
  });
}

const verification = await fetchJson(`${baseUrl}/api/verify/jobs/${encodeURIComponent(jobId)}`);
if (!verification.response.ok || verification.body?.ok !== true || verification.body?.signatureVerified !== true) {
  fail("paid settlement receipt did not verify", {
    jobId,
    status: verification.response.status,
    verification: verification.body
  });
}

console.log(
  JSON.stringify(
    {
      ok: true,
      baseUrl,
      targetUrl,
      scenario,
      runId,
      idempotencyKey,
      jobId,
      receiptId: verification.body.receiptId,
      signatureVerified: verification.body.signatureVerified,
      verifyUrl: `${baseUrl}/api/verify/jobs/${encodeURIComponent(jobId)}`
    },
    null,
    2
  )
);
