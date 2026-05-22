import test from "node:test";
import assert from "node:assert/strict";
import { app } from "../src/server.js";
import { resetStoreForTests } from "../src/store.js";

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

const privateTargetPayload = {
  action: {
    url: "http://127.0.0.1/internal-webhook",
    method: "POST",
    body: {
      secret: "do-not-leak"
    },
    idempotencyKey: "decision-private-target-1"
  },
  buyerPolicy: {
    maxPriceUsd: "0.009",
    allowedNetworks: ["eip155:84532", "eip155:8453"],
    minTrustScore: 0
  }
};

test("decision endpoint rejects unsafe targets without exposing payload", async () => {
  await resetStoreForTests();

  const { response, body } = await request("/api/decide/webhook", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(privateTargetPayload)
  });

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.recommendation, "do_not_pay");
  assert.equal(body.publicRecord.input.targetOriginRedacted, "redacted");
  assert.equal(body.publicRecord.input.bodyHash, "redacted");
  assert.equal(JSON.stringify(body).includes("do-not-leak"), false);
  assert.ok(body.blockingIssues.some((issue) => issue.includes("localhost") || issue.includes("https")));
});

test("decision records are retrievable and recent summaries stay redacted", async () => {
  await resetStoreForTests();

  const created = await request("/api/decide/webhook", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(privateTargetPayload)
  });
  const decisionId = created.body.decisionId;

  const detail = await request(`/api/decisions/${decisionId}`);
  assert.equal(detail.response.status, 200);
  assert.equal(detail.body.decision.id, decisionId);
  assert.equal(detail.body.decision.roleReports.policyAnalyst.stance, "block");
  assert.equal(JSON.stringify(detail.body).includes("do-not-leak"), false);

  const recent = await request("/api/decisions/recent?limit=5");
  assert.equal(recent.response.status, 200);
  assert.equal(recent.body.decisions.length, 1);
  assert.equal(recent.body.decisions[0].id, decisionId);
  assert.equal(recent.body.decisions[0].input.targetOriginRedacted, "redacted");
});

test("guided execution does not execute when decision is not approved", async () => {
  await resetStoreForTests();

  const { response, body } = await request("/api/execute/guided-webhook", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(privateTargetPayload)
  });

  assert.equal(response.status, 409);
  assert.equal(body.ok, false);
  assert.equal(body.error.code, "decision_not_approved");
  assert.equal(body.decision.recommendation, "do_not_pay");
}
);
