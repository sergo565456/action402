import test from "node:test";
import assert from "node:assert/strict";
import { createRateLimiter } from "../src/rateLimit.js";

function createMockResponse() {
  return {
    headers: {},
    statusCode: 200,
    body: undefined,
    set(name, value) {
      this.headers[name] = value;
      return this;
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

function runMiddleware(middleware, req) {
  const res = createMockResponse();
  let nextCalled = false;
  middleware(req, res, () => {
    nextCalled = true;
  });
  return { res, nextCalled };
}

test("rate limiter blocks requests above the configured window limit", () => {
  let now = 1000;
  const middleware = createRateLimiter({
    enabled: true,
    windowMs: 1000,
    maxRequests: 2,
    keyGenerator: () => "agent-1",
    now: () => now
  });

  assert.equal(runMiddleware(middleware, {}).nextCalled, true);
  assert.equal(runMiddleware(middleware, {}).nextCalled, true);

  const limited = runMiddleware(middleware, {});
  assert.equal(limited.nextCalled, false);
  assert.equal(limited.res.statusCode, 429);
  assert.equal(limited.res.body.error.code, "rate_limited");
  assert.equal(limited.res.headers["Retry-After"], "1");

  now = 2200;
  const afterReset = runMiddleware(middleware, {});
  assert.equal(afterReset.nextCalled, true);
  assert.equal(afterReset.res.statusCode, 200);
});
