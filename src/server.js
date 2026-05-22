import express from "express";
import { config, assertProductionConfig, runtimeSummary } from "./config.js";
import { publicApiIndex } from "./apiIndex.js";
import { publicPricing } from "./pricing.js";
import { publicMcpManifest } from "./mcpManifest.js";
import { publicActionCatalog, publicQuickstart } from "./actionCatalog.js";
import {
  createBrowserHandoff,
  createSchedulePreview,
  publicHandoffCapabilities,
  publicScheduleCapabilities,
  publicSecretStoragePolicy
} from "./advancedActions.js";
import { publicBazaarMetadata } from "./bazaar.js";
import { createCanaryEcho } from "./canary.js";
import { openApiSpec, publicCapabilities } from "./apiContract.js";
import { publicAgentManifest, publicDiscoveryPack, robotsTxt, sitemapXml } from "./discoveryManifest.js";
import { decideWebhook, publicDecisionRecord, publicDecisionSummary, renderDecisionResponse } from "./decisionGraph.js";
import { publicIntegrationSnippets } from "./snippets.js";
import { executeWebhookAction, preflightWebhookAction } from "./webhook.js";
import {
  executionStats,
  getDecision,
  getJob,
  getReceipt,
  initStore,
  listRecentDecisions,
  listRecentJobs,
  storeStats
} from "./store.js";
import { verifyReceipt } from "./receipt.js";
import { verifyJobReceipt, verifyStoredReceipt } from "./receiptVerification.js";
import {
  clampPublicLimit,
  normalizeWindowMs,
  publicFailureSummary,
  publicProofSummary,
  redactionPolicy
} from "./publicSummaries.js";
import { buildTrustSummary } from "./trustSummary.js";
import { maybeInstallX402 } from "./x402.js";
import { ApiError, errorBody } from "./errors.js";
import { createRateLimiter } from "./rateLimit.js";
import { logEvent, observabilitySummary, recordMetric, requestLogger } from "./observability.js";
import { targetQuotaStats } from "./targetQuota.js";
import { corsMiddleware } from "./cors.js";
import { cacheControlMiddleware } from "./cachePolicy.js";
import { discoveryHeaderMiddleware } from "./discoveryHeaders.js";

assertProductionConfig();
await initStore();
logEvent("info", "service.starting", runtimeSummary());

const app = express();
app.set("trust proxy", true);

function queryParam(req, name) {
  return new URL(req.url || "/", "http://action402.internal").searchParams.get(name);
}

function requestPath(req) {
  return new URL(req.originalUrl || req.url || "/", "http://action402.internal").pathname;
}

function methodNotAllowed(allowedMethods) {
  const allow = allowedMethods.join(", ");

  return (req, res) => {
    res
      .set("Allow", allow)
      .status(405)
      .json(
        errorBody(
          new ApiError(405, "method_not_allowed", "Method not allowed", {
            method: req.method,
            path: requestPath(req),
            allowedMethods,
            openapi: "/openapi.json",
            capabilities: "/api/capabilities",
            quickstart: "/api/quickstart"
          })
        )
      );
  };
}

app.use(requestLogger);
app.use(corsMiddleware);
app.use(cacheControlMiddleware);
app.use(discoveryHeaderMiddleware);
app.use(express.static("public", { extensions: ["html"] }));

app.get("/health", async (req, res, next) => {
  try {
    res.json({
      ok: true,
      service: "Action402",
      profile: config.profile,
      x402Enabled: config.x402Enabled,
      network: config.x402Network,
      price: config.x402Price,
      publicBaseUrl: config.publicBaseUrl,
      store: await storeStats(),
      observability: observabilitySummary(),
      targetQuota: targetQuotaStats(),
      rateLimit: {
        enabled: config.rateLimitEnabled,
        windowMs: config.rateLimitWindowMs,
        maxRequests: config.rateLimitMaxRequests
      }
    });
  } catch (error) {
    next(error);
  }
});

app.get(["/api", "/api/"], (req, res) => {
  res.json(publicApiIndex());
});

app.get("/api/discovery", (req, res) => {
  res.json(publicDiscoveryPack({ baseUrl: config.publicBaseUrl }));
});

app.get("/api/bazaar", (req, res) => {
  res.json(publicBazaarMetadata());
});

app.get(["/api/agent-manifest", "/.well-known/agent.json", "/.well-known/action402.json", "/.well-known/x402.json"], (req, res) => {
  res.json(publicAgentManifest({ baseUrl: config.publicBaseUrl }));
});

app.get(["/api/mcp", "/.well-known/mcp.json"], (req, res) => {
  res.json(publicMcpManifest({ baseUrl: config.publicBaseUrl }));
});

app.get("/api/capabilities", (req, res) => {
  res.json(publicCapabilities());
});

app.get("/api/pricing", (req, res) => {
  res.json(publicPricing());
});

app.get("/api/actions", (req, res) => {
  res.json(
    publicActionCatalog({
      baseUrl: config.publicBaseUrl,
      price: config.x402Price,
      x402Enabled: config.x402Enabled,
      network: config.x402Network,
      targetPolicyPreset: config.targetPolicyPreset
    })
  );
});

app.get("/api/quickstart", (req, res) => {
  res.json(
    publicQuickstart({
      baseUrl: config.publicBaseUrl,
      price: config.x402Price,
      x402Enabled: config.x402Enabled,
      network: config.x402Network,
      maxRetryAttempts: config.maxRetryAttempts,
      maxWebhookTimeoutMs: config.maxWebhookTimeoutMs
    })
  );
});

app.get("/api/snippets", (req, res) => {
  res.json(
    publicIntegrationSnippets({
      baseUrl: config.publicBaseUrl,
      price: config.x402Price,
      x402Enabled: config.x402Enabled,
      network: config.x402Network
    })
  );
});

app.get("/api/handoff/capabilities", (req, res) => {
  res.json(publicHandoffCapabilities({ baseUrl: config.publicBaseUrl }));
});

app.get("/api/schedules/capabilities", (req, res) => {
  res.json(publicScheduleCapabilities({ baseUrl: config.publicBaseUrl }));
});

app.get("/api/secrets/policy", (req, res) => {
  res.json(publicSecretStoragePolicy({ baseUrl: config.publicBaseUrl }));
});

app.get("/openapi.json", (req, res) => {
  res.json(openApiSpec());
});

app.get("/robots.txt", (req, res) => {
  res.type("text/plain").send(robotsTxt({ baseUrl: config.publicBaseUrl }));
});

app.get("/sitemap.xml", (req, res) => {
  res.type("application/xml").send(sitemapXml({ baseUrl: config.publicBaseUrl }));
});

app.get("/proof/:id", (req, res) => {
  res.sendFile("proof.html", { root: "public" });
});

app.get("/api/proofs/recent", async (req, res, next) => {
  try {
    const limit = clampPublicLimit(queryParam(req, "limit"), 10, 50);
    const jobs = await listRecentJobs(limit * 2);
    const proofs = [];

    for (const job of jobs) {
      if (proofs.length >= limit) break;
      if (!job.receiptId) continue;

      const receipt = await getReceipt(job.receiptId);
      if (!receipt || !verifyReceipt(receipt)) continue;
      proofs.push(publicProofSummary({ job, receipt, baseUrl: config.publicBaseUrl }));
    }

    res.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      service: "Action402",
      limit,
      redactionPolicy: redactionPolicy(),
      proofs
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/monitoring/executions", async (req, res, next) => {
  try {
    const windowMs = normalizeWindowMs(queryParam(req, "windowMs"));
    const stats = await executionStats({ windowMs });
    const jobs = await listRecentJobs(30);
    const recentFailures = [];

    for (const job of jobs) {
      if (job.status !== "failed") continue;
      const receipt = job.receiptId ? await getReceipt(job.receiptId) : undefined;
      recentFailures.push(publicFailureSummary({ job, receipt, baseUrl: config.publicBaseUrl }));
      if (recentFailures.length >= 10) break;
    }

    const failureRate = stats.recentTotal > 0 ? stats.recentFailed / stats.recentTotal : 0;

    res.json({
      ok: stats.recentFailed === 0,
      status: stats.recentFailed === 0 ? "ok" : "attention",
      generatedAt: new Date().toISOString(),
      service: "Action402",
      windowMs,
      failureRate,
      stats,
      recentFailures,
      redactionPolicy: redactionPolicy(),
      processMetrics: observabilitySummary(),
      targetQuota: targetQuotaStats()
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/trust", async (req, res, next) => {
  try {
    res.json(
      await buildTrustSummary({
        executionStats,
        storeStats,
        listRecentJobs,
        listRecentDecisions,
        getReceipt
      })
    );
  } catch (error) {
    next(error);
  }
});

app.use("/api/execute/webhook", (req, res, next) => {
  if (req.method === "POST") {
    next();
    return;
  }

  methodNotAllowed(["POST"])(req, res);
});

app.use("/api/execute/guided-webhook", (req, res, next) => {
  if (req.method === "POST") {
    next();
    return;
  }

  methodNotAllowed(["POST"])(req, res);
});

await maybeInstallX402(app);

app.use(express.json({ limit: "128kb" }));

app.post("/api/decide/webhook", async (req, res, next) => {
  try {
    const decision = await decideWebhook(req.body || {});
    res.json(renderDecisionResponse(decision));
  } catch (error) {
    next(error);
  }
});

app.post("/api/policy/check", async (req, res, next) => {
  try {
    res.json(await preflightWebhookAction(req.body || {}));
  } catch (error) {
    if (error instanceof ApiError) {
      res.json({
        ok: false,
        allowed: false,
        action: {
          id: "execute.webhook",
          method: "POST",
          path: "/api/execute/webhook",
          paid: config.x402Enabled,
          price: config.x402Price,
          network: config.x402Network
        },
        error: {
          code: error.code,
          message: error.message,
          ...(error.details === undefined ? {} : { details: error.details })
        },
        next: {
          quickstart: "/api/quickstart",
          snippets: "/api/snippets",
          capabilities: "/api/capabilities"
        }
      });
      return;
    }

    next(error);
  }
});

app.post("/api/canary/echo", (req, res) => {
  res.json(createCanaryEcho(req.body || {}, { requestId: req.requestId }));
});

app.get("/api/canary/echo", (req, res) => {
  res.json(createCanaryEcho({}, { requestId: req.requestId }));
});

app.post("/api/handoff/browser", async (req, res, next) => {
  try {
    res.json(await createBrowserHandoff(req.body || {}));
  } catch (error) {
    next(error);
  }
});

app.post("/api/schedules/preview", async (req, res, next) => {
  try {
    res.json(await createSchedulePreview(req.body || {}));
  } catch (error) {
    if (error instanceof ApiError) {
      res.json({
        ok: false,
        allowed: false,
        status: "preview-only",
        paid: false,
        willExecute: false,
        error: {
          code: error.code,
          message: error.message,
          ...(error.details === undefined ? {} : { details: error.details })
        },
        next: {
          immediatePaidExecution: "/api/execute/webhook",
          schedulesPage: "/schedules",
          quickstart: "/api/quickstart",
          capabilities: "/api/capabilities"
        }
      });
      return;
    }

    next(error);
  }
});

function actionFromGuidedBody(body = {}) {
  return body.action && typeof body.action === "object" && !Array.isArray(body.action) ? body.action : body;
}

function executionResponse(result, extra = {}) {
  const receiptSummary =
    result.receipt === undefined
      ? { id: result.job.receiptId, replay: true }
      : {
          id: result.receipt.id,
          signature: result.receipt.signature
        };

  return {
    mode: config.x402Enabled ? "x402" : "demo",
    idempotentReplay: result.idempotentReplay,
    job: {
      id: result.job.id,
      status: result.job.status,
      attempts: result.job.attempts.length,
      ...(result.job.decisionId ? { decisionId: result.job.decisionId } : {})
    },
    receipt: receiptSummary,
    links: {
      job: `/api/jobs/${result.job.id}`,
      receipt: `/api/receipts/${result.job.receiptId || receiptSummary.id}`,
      ...(result.job.decisionId ? { decision: `/api/decisions/${result.job.decisionId}` } : {})
    },
    ...extra
  };
}

app.post("/api/execute/webhook", createRateLimiter(), async (req, res) => {
  try {
    if (config.x402Enabled) {
      recordMetric("x402PaymentAccepted");
      logEvent("info", "x402.payment_accepted_for_execution", {
        requestId: req.requestId,
        price: config.x402Price,
        network: config.x402Network
      });
    }

    const result = await executeWebhookAction(req.body || {}, { requestId: req.requestId });
    res.status(result.job.status === "succeeded" ? 200 : 502).json(executionResponse(result));
  } catch (error) {
    const status = error.status || 400;
    recordMetric("executionRejected");
    logEvent(status >= 500 ? "error" : "warn", "execution.rejected", {
      requestId: req.requestId,
      status,
      code: error.code,
      message: error.message
    });
    res.status(status).json(errorBody(error));
  }
});

app.post("/api/execute/guided-webhook", createRateLimiter(), async (req, res) => {
  try {
    if (config.x402Enabled) {
      recordMetric("x402PaymentAccepted");
      logEvent("info", "x402.payment_accepted_for_guided_execution", {
        requestId: req.requestId,
        price: config.x402Price,
        network: config.x402Network
      });
    }

    const body = req.body || {};
    const action = actionFromGuidedBody(body);
    const decision = body.decisionId ? await getDecision(String(body.decisionId)) : await decideWebhook(body);

    if (!decision) {
      res.status(409).json(errorBody(new ApiError(409, "decision_not_found", "decisionId does not match a stored decision.")));
      return;
    }

    if (decision.decision?.recommendation !== "pay_and_execute") {
      res.status(409).json({
        ok: false,
        error: {
          code: "decision_not_approved",
          message: "Guided execution was not approved by the decision graph."
        },
        decision: publicDecisionRecord(decision)
      });
      return;
    }

    const result = await executeWebhookAction(
      {
        ...action,
        decisionId: decision.id
      },
      { requestId: req.requestId }
    );

    res.status(result.job.status === "succeeded" ? 200 : 502).json(
      executionResponse(result, {
        decision: {
          id: decision.id,
          recommendation: decision.decision.recommendation,
          confidence: decision.decision.confidence,
          links: {
            decision: `/api/decisions/${decision.id}`,
            page: `/decision/${decision.id}`
          }
        }
      })
    );
  } catch (error) {
    const status = error.status || 400;
    recordMetric("executionRejected");
    logEvent(status >= 500 ? "error" : "warn", "guided_execution.rejected", {
      requestId: req.requestId,
      status,
      code: error.code,
      message: error.message
    });
    res.status(status).json(errorBody(error));
  }
});

app.get("/api/decisions/recent", async (req, res, next) => {
  try {
    const limit = clampPublicLimit(queryParam(req, "limit"), 10, 50);
    const decisions = await listRecentDecisions(limit);
    res.json({
      ok: true,
      service: "Action402",
      generatedAt: new Date().toISOString(),
      limit,
      redactionPolicy: {
        redactedFields: ["targetUrl", "headers", "body", "bodyHash", "actionHash", "receiptSignature"]
      },
      decisions: decisions.map(publicDecisionSummary)
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/decisions/:id", async (req, res, next) => {
  try {
    const decision = await getDecision(req.params.id);
    if (!decision) {
      res.status(404).json(errorBody(new ApiError(404, "decision_not_found", "decision not found")));
      return;
    }

    res.json({
      ok: true,
      service: "Action402",
      decision: publicDecisionRecord(decision)
    });
  } catch (error) {
    next(error);
  }
});

app.get("/decision/:id", (req, res) => {
  res.sendFile("decision.html", { root: "public" });
});

app.get("/api/jobs/:id", async (req, res, next) => {
  try {
    const job = await getJob(req.params.id);
    if (!job) {
      res.status(404).json(errorBody(new ApiError(404, "job_not_found", "job not found")));
      return;
    }

    res.json({
      id: job.id,
      type: job.type,
      status: job.status,
      target: job.target,
      method: job.method,
      decisionId: job.decisionId || null,
      attempts: job.attempts,
      receiptId: job.receiptId,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/receipts/:id", async (req, res, next) => {
  try {
    const receipt = await getReceipt(req.params.id);
    if (!receipt) {
      res.status(404).json(errorBody(new ApiError(404, "receipt_not_found", "receipt not found")));
      return;
    }

    res.json({
      ...receipt,
      verified: verifyReceipt(receipt)
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/verify/jobs/:id", async (req, res, next) => {
  try {
    const job = await getJob(req.params.id);
    if (!job) {
      res.status(404).json(errorBody(new ApiError(404, "job_not_found", "job not found")));
      return;
    }

    if (!job.receiptId) {
      res.status(409).json(errorBody(new ApiError(409, "receipt_not_ready", "job has no receipt yet")));
      return;
    }

    const receipt = await getReceipt(job.receiptId);
    if (!receipt) {
      res.status(404).json(errorBody(new ApiError(404, "receipt_not_found", "receipt not found")));
      return;
    }

    res.json(verifyJobReceipt({ job, receipt }));
  } catch (error) {
    next(error);
  }
});

app.get("/api/verify/receipts/:id", async (req, res, next) => {
  try {
    const receipt = await getReceipt(req.params.id);
    if (!receipt) {
      res.status(404).json(errorBody(new ApiError(404, "receipt_not_found", "receipt not found")));
      return;
    }

    const jobId = receipt.payload?.jobId;
    const job = jobId ? await getJob(jobId) : undefined;
    res.json(job ? verifyJobReceipt({ job, receipt }) : verifyStoredReceipt(receipt));
  } catch (error) {
    next(error);
  }
});

app.all(
  [
    "/api",
    "/api/",
    "/api/discovery",
    "/api/bazaar",
    "/api/agent-manifest",
    "/api/mcp",
    "/api/capabilities",
    "/api/pricing",
    "/api/actions",
    "/api/quickstart",
    "/api/snippets",
    "/api/handoff/capabilities",
    "/api/schedules/capabilities",
    "/api/secrets/policy",
    "/api/decisions/recent",
    "/api/proofs/recent",
    "/api/monitoring/executions",
    "/api/trust",
    "/api/jobs/:id",
    "/api/receipts/:id",
    "/api/verify/jobs/:id",
    "/api/verify/receipts/:id",
    "/api/decisions/:id"
  ],
  methodNotAllowed(["GET"])
);

app.all("/api/canary/echo", methodNotAllowed(["GET", "POST"]));

app.all(["/api/policy/check", "/api/decide/webhook", "/api/handoff/browser", "/api/schedules/preview"], methodNotAllowed(["POST"]));

app.use("/api", (req, res) => {
  res.status(404).json(
    errorBody(
      new ApiError(404, "api_route_not_found", "API route not found", {
        method: req.method,
        path: requestPath(req),
        openapi: "/openapi.json",
        capabilities: "/api/capabilities",
        quickstart: "/api/quickstart"
      })
    )
  );
});

app.use((error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const status = error.status || (error.type === "entity.parse.failed" ? 400 : 500);
  const apiError =
    error.type === "entity.parse.failed"
      ? new ApiError(400, "invalid_json", "request body must be valid JSON")
      : error;

  res.status(status).json(errorBody(apiError));
});

if (process.env.NODE_ENV !== "test" && process.env.VERCEL !== "1") {
  const server = app.listen(config.port, config.host, () => {
    const summary = runtimeSummary();
    console.log(`Action402 listening on http://${summary.host}:${summary.port}`);
    console.log(`profile: ${summary.profile}`);
    console.log(`mode: ${summary.mode}`);
    console.log(`network: ${summary.network}`);
    console.log(`price: ${summary.price}`);
    console.log(`public URL: ${summary.publicBaseUrl}`);
    console.log(`store: ${summary.storeDriver}`);
    console.log(
      `rate limit: ${summary.rateLimit.enabled ? `${summary.rateLimit.maxRequests}/${summary.rateLimit.windowMs}ms` : "off"}`
    );
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(`Port ${config.port} is already in use. Stop the old Action402 process or set PORT to another value.`);
      process.exit(1);
    }

    throw error;
  });
}

export { app };
