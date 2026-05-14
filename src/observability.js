import crypto from "node:crypto";
import { config } from "./config.js";

const LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100
};

const metrics = {
  requests: 0,
  requestClientErrors: 0,
  requestServerErrors: 0,
  executionsStarted: 0,
  executionsSucceeded: 0,
  executionsFailed: 0,
  executionReplays: 0,
  executionRejected: 0,
  targetQuotaExceeded: 0,
  x402PaymentAccepted: 0,
  x402PaymentRequired: 0
};

let sink = (line) => console.log(line);

function configuredLevelValue() {
  return LEVELS[config.logLevel] ?? LEVELS.info;
}

export function shouldLog(level) {
  const value = LEVELS[level] ?? LEVELS.info;
  return value >= configuredLevelValue() && configuredLevelValue() < LEVELS.silent;
}

export function setLogSinkForTests(nextSink) {
  sink = nextSink || ((line) => console.log(line));
}

export function resetObservabilityForTests() {
  for (const key of Object.keys(metrics)) {
    metrics[key] = 0;
  }
}

export function recordMetric(name, amount = 1) {
  if (!Object.hasOwn(metrics, name)) return;
  metrics[name] += amount;
}

export function observabilitySummary() {
  return {
    logLevel: config.logLevel,
    requestLogEnabled: config.requestLogEnabled,
    metrics: { ...metrics }
  };
}

export function logEvent(level, event, fields = {}) {
  if (!shouldLog(level)) return;

  sink(
    JSON.stringify({
      ts: new Date().toISOString(),
      service: "Action402",
      profile: config.profile,
      mode: config.x402Enabled ? "x402" : "demo",
      network: config.x402Network,
      level,
      event,
      ...fields
    })
  );
}

export function requestLogger(req, res, next) {
  const startedAt = Date.now();
  req.requestId = req.headers["x-request-id"] || crypto.randomUUID();
  res.setHeader("x-request-id", req.requestId);

  res.on("finish", () => {
    recordMetric("requests");
    if (res.statusCode >= 400 && res.statusCode < 500) {
      recordMetric("requestClientErrors");
    }
    if (res.statusCode >= 500) {
      recordMetric("requestServerErrors");
    }
    if (config.x402Enabled && req.path === "/api/execute/webhook" && res.statusCode === 402) {
      recordMetric("x402PaymentRequired");
      logEvent("warn", "x402.payment_required", {
        requestId: req.requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Date.now() - startedAt
      });
      return;
    }

    if (!config.requestLogEnabled) return;

    logEvent(res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info", "http.request", {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Date.now() - startedAt
    });
  });

  next();
}
