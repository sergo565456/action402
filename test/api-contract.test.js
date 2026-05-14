import test from "node:test";
import assert from "node:assert/strict";
import { app } from "../src/server.js";

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

test("capabilities document exposes execute webhook action", async () => {
  const { response, body } = await request("/api/capabilities");

  assert.equal(response.status, 200);
  assert.equal(body.name, "Action402");
  assert.equal(body.actions[0].id, "execute.webhook");
  assert.equal(body.actions[0].requestSchema.required.includes("url"), true);
  assert.equal(body.safety.privateNetworkTargetsBlocked, true);
});

test("openapi document exposes execute webhook path", async () => {
  const { response, body } = await request("/openapi.json");

  assert.equal(response.status, 200);
  assert.equal(body.openapi, "3.1.0");
  assert.ok(body.paths["/api/execute/webhook"].post);
  assert.ok(body.components.schemas.WebhookRequest);
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
