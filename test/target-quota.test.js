import test from "node:test";
import assert from "node:assert/strict";
import { assertTargetQuota, resetTargetQuotasForTests, targetQuotaStats } from "../src/targetQuota.js";

const quota = {
  targetQuotaEnabled: true,
  targetQuotaWindowMs: 1000,
  targetQuotaMaxRequests: 2
};

test("target quota blocks requests above per-target limit", () => {
  resetTargetQuotasForTests();

  assert.doesNotThrow(() => assertTargetQuota("api.example.com", quota, 1000));
  assert.doesNotThrow(() => assertTargetQuota("api.example.com", quota, 1001));
  assert.throws(() => assertTargetQuota("api.example.com", quota, 1002), /target quota exceeded/);
});

test("target quota windows are isolated by hostname and reset by time", () => {
  resetTargetQuotasForTests();

  assert.doesNotThrow(() => assertTargetQuota("api.example.com", quota, 1000));
  assert.doesNotThrow(() => assertTargetQuota("other.example.com", quota, 1001));
  assert.doesNotThrow(() => assertTargetQuota("api.example.com", quota, 1002));
  assert.throws(() => assertTargetQuota("api.example.com", quota, 1003), /target quota exceeded/);
  assert.doesNotThrow(() => assertTargetQuota("api.example.com", quota, 2001));
});

test("target quota can be disabled and exposes active target count", () => {
  resetTargetQuotasForTests();

  assert.doesNotThrow(() =>
    assertTargetQuota("api.example.com", { ...quota, targetQuotaEnabled: false }, 1000)
  );
  assert.equal(targetQuotaStats(quota, 1000).activeTargets, 0);
});
