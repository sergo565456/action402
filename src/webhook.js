import dns from "node:dns/promises";
import net from "node:net";
import { config } from "./config.js";
import { createId, sha256Json, buildReceipt } from "./receipt.js";
import { createJob, getJobByIdempotencyKey, saveReceipt, updateJob } from "./store.js";
import { ApiError } from "./errors.js";
import { assertTargetPolicy } from "./targetPolicy.js";
import { assertTargetQuota } from "./targetQuota.js";
import { logEvent, recordMetric } from "./observability.js";

const ALLOWED_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const BLOCKED_HEADER_NAMES = new Set([
  "host",
  "connection",
  "content-length",
  "transfer-encoding",
  "upgrade",
  "proxy-authorization",
  "proxy-authenticate"
]);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeRetry(input) {
  if (input !== undefined && (input === null || typeof input !== "object" || Array.isArray(input))) {
    throw new ApiError(400, "invalid_retry", "retry must be an object.");
  }

  const attempts = Math.max(
    1,
    Math.min(Number(input?.attempts || 1), config.maxRetryAttempts)
  );
  const backoffMs = Math.max(0, Math.min(Number(input?.backoffMs || 250), 5000));
  return { attempts, backoffMs };
}

function normalizeHeaders(headers = {}) {
  if (headers === null || typeof headers !== "object" || Array.isArray(headers)) {
    throw new ApiError(400, "invalid_headers", "headers must be an object.");
  }

  return Object.fromEntries(
    Object.entries(headers)
      .filter(([key]) => !BLOCKED_HEADER_NAMES.has(key.toLowerCase()))
      .map(([key, value]) => [key, String(value)])
  );
}

function privateIpReason(ip) {
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    if (parts[0] === 10) return "private IPv4 range 10.0.0.0/8";
    if (parts[0] === 127) return "loopback IPv4 range";
    if (parts[0] === 169 && parts[1] === 254) return "link-local IPv4 range";
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return "private IPv4 range 172.16.0.0/12";
    if (parts[0] === 192 && parts[1] === 168) return "private IPv4 range 192.168.0.0/16";
    if (parts[0] === 0) return "unspecified IPv4 range";
  }

  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === "::1") return "loopback IPv6 address";
    if (lower.startsWith("fe80:")) return "link-local IPv6 range";
    if (lower.startsWith("fc") || lower.startsWith("fd")) return "unique-local IPv6 range";
  }

  return "";
}

export async function validateTarget(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new ApiError(400, "invalid_url", "url must be an absolute URL.");
  }

  if (parsed.protocol !== "https:" && !(config.allowHttpTargets && parsed.protocol === "http:")) {
    throw new ApiError(400, "unsafe_target", "target must use https unless ALLOW_HTTP_TARGETS=true.");
  }

  const hostname = parsed.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new ApiError(400, "unsafe_target", "localhost targets are blocked.");
  }

  const directReason = privateIpReason(hostname);
  if (directReason) {
    throw new ApiError(400, "unsafe_target", `target resolves to blocked address: ${directReason}.`);
  }

  assertTargetPolicy(hostname);

  const addresses = await dns.lookup(hostname, { all: true });
  for (const address of addresses) {
    const reason = privateIpReason(address.address);
    if (reason) {
      throw new ApiError(400, "unsafe_target", `target resolves to blocked address: ${reason}.`);
    }
  }

  return parsed;
}

async function callWebhook({ url, method, headers, body, timeoutMs }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method,
      headers: {
        "content-type": "application/json",
        ...headers
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal
    });

    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") || ""
      },
      bodyPreview: text.slice(0, 2048)
    };
  } finally {
    clearTimeout(timeout);
  }
}

function shouldRetry(result) {
  if (!result) return true;
  return result.status === 408 || result.status === 429 || result.status >= 500;
}

export async function executeWebhookAction(input, context = {}) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new ApiError(400, "invalid_request", "request body must be a JSON object.");
  }

  const method = String(input.method || "POST").toUpperCase();
  if (!ALLOWED_METHODS.has(method)) {
    throw new ApiError(400, "invalid_method", "method must be one of POST, PUT, PATCH, DELETE.");
  }

  const target = await validateTarget(input.url);
  const retry = normalizeRetry(input.retry);
  const timeoutMs = Math.max(
    1000,
    Math.min(Number(input.timeoutMs || config.maxWebhookTimeoutMs), config.maxWebhookTimeoutMs)
  );
  const idempotencyKey = input.idempotencyKey ? String(input.idempotencyKey) : "";
  if (idempotencyKey.length > 160) {
    throw new ApiError(400, "invalid_idempotency_key", "idempotencyKey must be 160 characters or fewer.");
  }

  const existing = idempotencyKey ? await getJobByIdempotencyKey(idempotencyKey) : undefined;

  if (existing) {
    recordMetric("executionReplays");
    logEvent("info", "execution.replay", {
      requestId: context.requestId,
      jobId: existing.id,
      receiptId: existing.receiptId || null,
      status: existing.status
    });
    return { job: existing, receipt: existing.receiptId ? undefined : null, idempotentReplay: true };
  }

  assertTargetQuota(target.hostname, config, Date.now(), context);

  const job = await createJob({
    id: createId("job"),
    type: "webhook",
    status: "running",
    target: `${target.protocol}//${target.host}${target.pathname}`,
    method,
    idempotencyKey,
    attempts: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  recordMetric("executionsStarted");
  logEvent("info", "execution.started", {
    requestId: context.requestId,
    jobId: job.id,
    targetHost: target.host,
    targetPath: target.pathname,
    method,
    maxAttempts: retry.attempts,
    timeoutMs
  });

  const outboundHeaders = normalizeHeaders(input.headers);
  const requestHash = sha256Json({
    url: target.toString(),
    method,
    headers: outboundHeaders,
    body: input.body ?? null
  });

  let lastResult;
  let lastError;

  for (let attempt = 1; attempt <= retry.attempts; attempt += 1) {
    const startedAt = new Date().toISOString();
    try {
      lastResult = await callWebhook({
        url: target.toString(),
        method,
        headers: outboundHeaders,
        body: input.body,
        timeoutMs
      });
      job.attempts.push({
        attempt,
        startedAt,
        completedAt: new Date().toISOString(),
        status: lastResult.status,
        ok: lastResult.ok
      });

      if (lastResult.ok || !shouldRetry(lastResult)) {
        break;
      }
    } catch (error) {
      lastError = error;
      job.attempts.push({
        attempt,
        startedAt,
        completedAt: new Date().toISOString(),
        error: error.name === "AbortError" ? "timeout" : error.message
      });
    }

    if (attempt < retry.attempts) {
      await sleep(retry.backoffMs * attempt);
    }
  }

  const finalResponse = lastResult || {
    ok: false,
    status: 599,
    error: lastError?.message || "request failed"
  };

  const status = finalResponse.ok ? "succeeded" : "failed";
  recordMetric(finalResponse.ok ? "executionsSucceeded" : "executionsFailed");
  const responseHash = sha256Json(finalResponse);
  const updatedJob = await updateJob(job.id, {
    status,
    error: finalResponse.ok ? undefined : finalResponse.error || `target returned ${finalResponse.status}`,
    attempts: job.attempts
  });

  const receipt = await saveReceipt(
    buildReceipt({
      job: updatedJob,
      requestHash,
      responseHash,
      target: {
        url: `${target.protocol}//${target.host}${target.pathname}`,
        method
      },
      response: finalResponse
    })
  );

  const finalJob = await updateJob(job.id, {
    receiptId: receipt.id
  });

  logEvent(finalResponse.ok ? "info" : "warn", finalResponse.ok ? "execution.succeeded" : "execution.failed", {
    requestId: context.requestId,
    jobId: finalJob.id,
    receiptId: receipt.id,
    targetHost: target.host,
    targetPath: target.pathname,
    method,
    attempts: finalJob.attempts.length,
    targetStatus: finalResponse.status,
    error: finalResponse.ok ? undefined : finalJob.error
  });

  return { job: finalJob, receipt, idempotentReplay: false };
}

export async function preflightWebhookAction(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw new ApiError(400, "invalid_request", "request body must be a JSON object.");
  }

  const method = String(input.method || "POST").toUpperCase();
  if (!ALLOWED_METHODS.has(method)) {
    throw new ApiError(400, "invalid_method", "method must be one of POST, PUT, PATCH, DELETE.");
  }

  const target = await validateTarget(input.url);
  const retry = normalizeRetry(input.retry);
  const timeoutMs = Math.max(
    1000,
    Math.min(Number(input.timeoutMs || config.maxWebhookTimeoutMs), config.maxWebhookTimeoutMs)
  );
  const idempotencyKey = input.idempotencyKey ? String(input.idempotencyKey) : "";
  if (idempotencyKey.length > 160) {
    throw new ApiError(400, "invalid_idempotency_key", "idempotencyKey must be 160 characters or fewer.");
  }

  const outboundHeaders = normalizeHeaders(input.headers);

  return {
    ok: true,
    allowed: true,
    action: {
      id: "execute.webhook",
      method,
      path: "/api/execute/webhook",
      paid: config.x402Enabled,
      price: config.x402Price,
      network: config.x402Network
    },
    target: {
      protocol: target.protocol.replace(":", ""),
      hostname: target.hostname,
      origin: target.origin,
      pathname: target.pathname || "/",
      privateNetworkBlocked: true
    },
    normalized: {
      method,
      retry,
      timeoutMs,
      idempotencyKeyPresent: Boolean(idempotencyKey),
      forwardedHeaderCount: Object.keys(outboundHeaders).length,
      bodyPresent: input.body !== undefined
    },
    policy: {
      targetPolicyPreset: config.targetPolicyPreset,
      requireTargetAllowlist: config.requireTargetAllowlist,
      targetQuotaEnabled: config.targetQuotaEnabled,
      targetQuotaWindowMs: config.targetQuotaWindowMs,
      targetQuotaMaxRequests: config.targetQuotaMaxRequests,
      rateLimitEnabled: config.rateLimitEnabled,
      rateLimitWindowMs: config.rateLimitWindowMs,
      rateLimitMaxRequests: config.rateLimitMaxRequests
    },
    warnings: [
      ...(idempotencyKey ? [] : ["Send idempotencyKey for paid execution retries and agent restarts."]),
      ...(input.headers && Object.keys(input.headers).some((key) => BLOCKED_HEADER_NAMES.has(key.toLowerCase()))
        ? ["Hop-by-hop or proxy headers will be stripped before forwarding."]
        : [])
    ],
    next: {
      paidExecution: "/api/execute/webhook",
      quickstart: "/api/quickstart",
      snippets: "/api/snippets"
    }
  };
}
