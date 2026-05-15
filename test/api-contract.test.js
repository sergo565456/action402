import test from "node:test";
import assert from "node:assert/strict";
import { app } from "../src/server.js";
import { applyVercelRewritePath } from "../api/index.js";
import { validateBazaarDiscovery } from "../src/bazaar.js";
import { buildReceipt } from "../src/receipt.js";
import { createJob, resetStoreForTests, saveReceipt } from "../src/store.js";

async function request(path, options = {}) {
  const server = app.listen(0);
  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}${path}`, options);
    const body = await response.json();
    return { response, body };
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function requestText(path) {
  const server = app.listen(0);
  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}${path}`);
    const body = await response.text();
    return { response, body };
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

test("capabilities document exposes execute webhook action", async () => {
  const { response, body } = await request("/api/capabilities");

  assert.equal(response.status, 200);
  assert.equal(body.name, "Action402");
  assert.equal(body.actions[0].id, "execute.webhook");
  assert.equal(body.actions[0].requestSchema.required.includes("url"), true);
  assert.equal(body.safety.privateNetworkTargetsBlocked, true);
  assert.equal(body.safety.targetPolicyPreset, "open");
  assert.equal(body.safety.targetQuota.enabled, true);
  assert.equal(body.verification.jobReceiptVerification, "/api/verify/jobs/{id}");
  assert.ok(body.discoveryKeywords.includes("paid webhook execution"));
  assert.equal(body.agentPrompt.includes("Use Action402"), true);
  assert.equal(body.agentInstructions.callFlow.some((step) => step.includes("/api/verify")), true);
  assert.equal(body.mcp.recommendedToolName, "execute_webhook");
  assert.equal(body.links.llms.endsWith("/llms.txt"), true);
});

test("openapi document exposes execute webhook path", async () => {
  const { response, body } = await request("/openapi.json");

  assert.equal(response.status, 200);
  assert.equal(body.openapi, "3.1.0");
  assert.ok(body.paths["/api/execute/webhook"].post);
  assert.ok(body.paths["/api/verify/jobs/{id}"].get);
  assert.ok(body.paths["/api/verify/receipts/{id}"].get);
  assert.ok(body.components.schemas.WebhookRequest);
  assert.ok(body.components.schemas.VerificationReport);
});

test("bazaar metadata exposes valid discovery extension", async () => {
  const { response, body } = await request("/api/bazaar");
  const route = body.routeConfig["POST /api/execute/webhook"];

  assert.equal(response.status, 200);
  assert.equal(body.discovery.bazaarExtensionValid, true);
  assert.equal(validateBazaarDiscovery().valid, true);
  assert.equal(route.serviceName, "Action402");
  assert.equal(route.tags.includes("x402"), true);
  assert.equal(route.tags.includes("paid-webhook"), true);
  assert.ok(body.discoveryKeywords.includes("x402 paid API"));
  assert.equal(body.agentPrompt.includes("paid public HTTPS"), true);
  assert.equal(body.discovery.searchQueries.includes("Action402"), true);
  assert.equal(body.mcp.recommendedToolName, "execute_webhook");
  assert.equal(body.links.llms.endsWith("/llms.txt"), true);
  assert.equal(route.extensions.bazaar.info.input.method, "POST");
  assert.equal(route.extensions.bazaar.info.input.bodyType, "json");
  assert.equal(route.extensions.bazaar.info.input.body.url, "https://httpbin.org/anything");
  assert.equal(route.extensions.bazaar.info.output.type, "json");
  assert.ok(route.extensions.bazaar.schema.properties.input);
});

test("llms.txt exposes agent discovery guidance", async () => {
  const { response, body } = await requestText("/llms.txt");

  assert.equal(response.status, 200);
  assert.equal(body.includes("Action402"), true);
  assert.equal(body.includes("paid webhook execution"), true);
  assert.equal(body.includes("/api/capabilities"), true);
  assert.equal(body.includes("MCP/Bazaar guidance"), true);
});

test("vercel rewrite strips internal catch-all path query", () => {
  const req = {
    url: "/api/index?__action402_path=/api/execute/webhook&path=execute%2Fwebhook&trace=1"
  };

  applyVercelRewritePath(req);

  assert.equal(req.url, "/api/execute/webhook?trace=1");
});

test("verification endpoint returns consistency report for stored job receipt", async () => {
  await resetStoreForTests();

  const job = {
    id: "job_api_verify_1",
    type: "webhook",
    status: "succeeded",
    target: "https://example.com/webhook",
    method: "POST",
    idempotencyKey: "api-verify-key-1",
    attempts: [
      {
        attempt: 1,
        startedAt: "2026-05-14T00:00:00.000Z",
        completedAt: "2026-05-14T00:00:01.000Z",
        status: 200,
        ok: true
      }
    ],
    receiptId: null,
    createdAt: "2026-05-14T00:00:00.000Z",
    updatedAt: "2026-05-14T00:00:01.000Z"
  };
  const receipt = buildReceipt({
    job,
    requestHash: "a".repeat(64),
    responseHash: "b".repeat(64),
    target: {
      url: job.target,
      method: job.method
    },
    response: {
      ok: true,
      status: 200
    }
  });
  await createJob({ ...job, receiptId: receipt.id });
  await saveReceipt(receipt);

  const { response, body } = await request(`/api/verify/jobs/${job.id}`);

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.jobId, job.id);
  assert.equal(body.receiptId, receipt.id);
  assert.equal(body.signatureVerified, true);
  assert.equal(body.checks.every((item) => item.ok), true);
});

test("webhook execution rejects private network targets with structured error", async () => {
  const { response, body } = await request("/api/execute/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      url: "https://127.0.0.1/internal",
      method: "POST"
    })
  });

  assert.equal(response.status, 400);
  assert.equal(body.error.code, "unsafe_target");
});

test("webhook execution rejects invalid methods with structured error", async () => {
  const { response, body } = await request("/api/execute/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      url: "https://example.com/webhook",
      method: "GET"
    })
  });

  assert.equal(response.status, 400);
  assert.equal(body.error.code, "invalid_method");
});
