import test from "node:test";
import assert from "node:assert/strict";
import { canonicalJson, signReceiptPayload, verifyReceipt } from "../src/receipt.js";

test("canonicalJson sorts object keys recursively", () => {
  const left = canonicalJson({ b: 1, a: { d: 4, c: 3 } });
  const right = canonicalJson({ a: { c: 3, d: 4 }, b: 1 });
  assert.equal(left, right);
});

test("receipt signature verifies and detects mutation", () => {
  const payload = { status: "succeeded", jobId: "job_1" };
  const receipt = {
    id: "rcpt_1",
    keyId: "default",
    payload,
    signature: signReceiptPayload(payload)
  };

  assert.equal(verifyReceipt(receipt), true);
  receipt.payload.status = "failed";
  assert.equal(verifyReceipt(receipt), false);
});

test("versioned receipt verification can use previous keyed secrets", () => {
  const payload = { status: "succeeded", jobId: "job_legacy" };
  const receipt = {
    id: "rcpt_legacy",
    keyId: "old-key",
    payload,
    signature: signReceiptPayload(payload, "old-secret")
  };

  assert.equal(verifyReceipt(receipt, { "old-key": "old-secret" }), true);
  assert.equal(verifyReceipt(receipt, { "old-key": "wrong-secret" }), false);
  assert.equal(verifyReceipt(receipt, { another: "old-secret" }), false);
});

test("legacy receipts without keyId still verify with active secret", () => {
  const payload = { status: "succeeded", jobId: "job_legacy_no_key" };
  const receipt = {
    id: "rcpt_legacy_no_key",
    payload,
    signature: signReceiptPayload(payload)
  };

  assert.equal(verifyReceipt(receipt), true);
});
