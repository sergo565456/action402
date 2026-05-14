import test from "node:test";
import assert from "node:assert/strict";
import { config } from "../src/config.js";
import {
  createJob,
  getJob,
  getJobByIdempotencyKey,
  getReceipt,
  pruneExpired,
  resetStoreForTests,
  saveReceipt,
  storeStats
} from "../src/store.js";

test("store prunes expired jobs and receipts", async () => {
  await resetStoreForTests();

  const now = Date.now();
  const veryOld = new Date(
    now - Math.max(config.jobRetentionMs, config.receiptRetentionMs) - 1000
  ).toISOString();

  await createJob({
    id: "job_old",
    type: "webhook",
    status: "succeeded",
    target: "https://example.com/webhook",
    method: "POST",
    idempotencyKey: "old-key",
    attempts: [],
    receiptId: "rcpt_old",
    createdAt: veryOld,
    updatedAt: veryOld
  });
  await saveReceipt({
    id: "rcpt_old",
    keyId: "default",
    payload: {
      createdAt: veryOld
    },
    signature: "hmac-sha256:test"
  });

  const result = await pruneExpired(now, { persist: false });

  assert.equal(result.removedReceipts, 1);
  assert.equal(await getJob("job_old"), undefined);
  assert.equal(await getJobByIdempotencyKey("old-key"), undefined);
  assert.equal(await getReceipt("rcpt_old"), undefined);
});

test("store keeps receipt linked to retained job", async () => {
  await resetStoreForTests();

  const now = Date.now();
  const oldReceipt = new Date(now - config.receiptRetentionMs - 1000).toISOString();
  const current = new Date(now).toISOString();

  await createJob({
    id: "job_current",
    type: "webhook",
    status: "succeeded",
    target: "https://example.com/webhook",
    method: "POST",
    idempotencyKey: "current-key",
    attempts: [],
    receiptId: "rcpt_linked",
    createdAt: current,
    updatedAt: current
  });
  await saveReceipt({
    id: "rcpt_linked",
    keyId: "default",
    payload: {
      createdAt: oldReceipt
    },
    signature: "hmac-sha256:test"
  });

  const result = await pruneExpired(now, { persist: false });

  assert.equal(result.removedJobs, 0);
  assert.equal(result.removedReceipts, 0);
  assert.equal((await getReceipt("rcpt_linked")).id, "rcpt_linked");
  assert.equal((await storeStats()).jobs, 1);
  assert.equal((await storeStats()).receipts, 1);
});
