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
    payload,
    signature: signReceiptPayload(payload)
  };

  assert.equal(verifyReceipt(receipt), true);
  receipt.payload.status = "failed";
  assert.equal(verifyReceipt(receipt), false);
});
