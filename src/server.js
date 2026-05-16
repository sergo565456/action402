import express from "express";
import { config, assertProductionConfig, runtimeSummary } from "./config.js";
import { publicActionCatalog, publicQuickstart } from "./actionCatalog.js";
import {
  createBrowserHandoff,
  createSchedulePreview,
  publicHandoffCapabilities,
  publicScheduleCapabilities,
  publicSecretStoragePolicy
} from "./advancedActions.js";
import { publicBazaarMetadata } from "./bazaar.js";
import { openApiSpec, publicCapabilities } from "./apiContract.js";
import { publicAgentManifest, robotsTxt, sitemapXml } from "./discoveryManifest.js";
import { publicIntegrationSnippets } from "./snippets.js";
import { executeWebhookAction, preflightWebhookAction } from "./webhook.js";
import { executionStats, getJob, getReceipt, initStore, listRecentJobs, storeStats } from "./store.js";
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

assertProductionConfig();
await initStore();
logEvent("info", "service.starting", runtimeSummary());

const app = express();
app.set("trust proxy", true);

function queryParam(req, name) {
  return new URL(req.url || "/", "http://action402.internal").searchParams.get(name);
}

app.use(requestLogger);
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

app.get("/api/bazaar", (req, res) => {
  res.json(publicBazaarMetadata());
});

app.get(["/api/agent-manifest", "/.well-known/agent.json", "/.well-known/action402.json", "/.well-known/x402.json"], (req, res) => {
  res.json(publicAgentManifest({ baseUrl: config.publicBaseUrl }));
});

app.get("/api/capabilities", (req, res) => {
  res.json(publicCapabilities());
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
        getReceipt
      })
    );
  } catch (error) {
    next(error);
  }
});

await maybeInstallX402(app);

app.use(express.json({ limit: "128kb" }));

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

app.use("/api/execute", createRateLimiter());

app.post("/api/execute/webhook", async (req, res) => {
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
    const receiptSummary =
      result.receipt === undefined
        ? { id: result.job.receiptId, replay: true }
        : {
            id: result.receipt.id,
            signature: result.receipt.signature
          };

    res.status(result.job.status === "succeeded" ? 200 : 502).json({
      mode: config.x402Enabled ? "x402" : "demo",
      idempotentReplay: result.idempotentReplay,
      job: {
        id: result.job.id,
        status: result.job.status,
        attempts: result.job.attempts.length
      },
      receipt: receiptSummary,
      links: {
        job: `/api/jobs/${result.job.id}`,
        receipt: `/api/receipts/${result.job.receiptId || receiptSummary.id}`
      }
    });
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
