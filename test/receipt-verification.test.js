import test from "node:test";
import assert from "node:assert/strict";
import { buildReceipt } from "../src/receipt.js";
import { verifyJobReceipt, verifyStoredReceipt } from "../src/receiptVerification.js";

function sampleJob() {
  return {
    id: "job_verify_1",
    type: "webhook",
    status: "succeeded",
    target: "https://example.com/webhook",
    method: "POST",
    idempotencyKey: "verify-key-1",
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
}

function sampleReceipt(job) {
  return buildReceipt({
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
}

test("verifyJobReceipt accepts matching job and signed receipt", () => {
  const job = sampleJob();
  const receipt = sampleReceipt(job);
  job.receiptId = receipt.id;

  const report = verifyJobReceipt({ job, receipt });

  assert.equal(report.ok, true);
  assert.equal(report.jobId, job.id);
  assert.equal(report.receiptId, receipt.id);
  assert.equal(report.signatureVerified, true);
  assert.equal(report.checks.every((item) => item.ok), true);
});

test("verifyJobReceipt reports tampered receipt payload", () => {
  const job = sampleJob();
  const receipt = sampleReceipt(job);
  job.receiptId = receipt.id;
  receipt.payload.status = "failed";

  const report = verifyJobReceipt({ job, receipt });

  assert.equal(report.ok, false);
  assert.equal(report.signatureVerified, false);
  assert.equal(report.checks.some((item) => item.name === "receipt status matches job" && item.ok === false), true);
});

test("verifyStoredReceipt works when linked job is no longer retained", () => {
  const job = sampleJob();
  const receipt = sampleReceipt(job);

  const report = verifyStoredReceipt(receipt);

  assert.equal(report.ok, true);
  assert.equal(report.jobId, job.id);
  assert.equal(report.signatureVerified, true);
});
