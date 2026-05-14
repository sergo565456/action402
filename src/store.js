import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";

const jobs = new Map();
const receipts = new Map();
const idempotencyIndex = new Map();
let lastCleanupAt = null;

function useMemoryStore() {
  return config.storeFile === ":memory:";
}

function resolvedStoreFile() {
  return path.resolve(process.cwd(), config.storeFile);
}

function rebuildIndexes() {
  idempotencyIndex.clear();
  for (const job of jobs.values()) {
    if (job.idempotencyKey) {
      idempotencyIndex.set(job.idempotencyKey, job.id);
    }
  }
}

function loadStore() {
  if (useMemoryStore()) return;

  const file = resolvedStoreFile();
  if (!fs.existsSync(file)) return;

  const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  for (const job of parsed.jobs || []) {
    jobs.set(job.id, job);
  }
  for (const receipt of parsed.receipts || []) {
    receipts.set(receipt.id, receipt);
  }
  rebuildIndexes();
}

function persistStore() {
  if (useMemoryStore()) return;

  const file = resolvedStoreFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });

  const payload = {
    version: 1,
    updatedAt: new Date().toISOString(),
    jobs: Array.from(jobs.values()),
    receipts: Array.from(receipts.values())
  };
  const tempFile = `${file}.tmp`;
  fs.writeFileSync(tempFile, `${JSON.stringify(payload, null, 2)}\n`);
  fs.renameSync(tempFile, file);
}

function timestampMs(value) {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function receiptCreatedAt(receipt) {
  return receipt?.payload?.createdAt || receipt?.createdAt || "";
}

export function pruneExpired(now = Date.now(), options = {}) {
  const persist = options.persist ?? true;
  let removedJobs = 0;
  let removedReceipts = 0;

  if (config.jobRetentionMs > 0) {
    for (const job of jobs.values()) {
      const updatedAt = timestampMs(job.updatedAt || job.createdAt);
      if (updatedAt > 0 && now - updatedAt > config.jobRetentionMs) {
        jobs.delete(job.id);
        removedJobs += 1;
      }
    }
  }

  const retainedReceiptIds = new Set(
    Array.from(jobs.values())
      .map((job) => job.receiptId)
      .filter(Boolean)
  );

  if (config.receiptRetentionMs > 0) {
    for (const receipt of receipts.values()) {
      const createdAt = timestampMs(receiptCreatedAt(receipt));
      const linkedToRetainedJob = retainedReceiptIds.has(receipt.id);
      if (!linkedToRetainedJob && createdAt > 0 && now - createdAt > config.receiptRetentionMs) {
        receipts.delete(receipt.id);
        removedReceipts += 1;
      }
    }
  }

  if (removedJobs > 0 || removedReceipts > 0) {
    rebuildIndexes();
    lastCleanupAt = new Date(now).toISOString();
    if (persist) persistStore();
  }

  return { removedJobs, removedReceipts };
}

loadStore();
pruneExpired(Date.now(), { persist: true });

export function createJob(job) {
  pruneExpired(Date.now(), { persist: false });
  jobs.set(job.id, job);
  if (job.idempotencyKey) {
    idempotencyIndex.set(job.idempotencyKey, job.id);
  }
  persistStore();
  return job;
}

export function updateJob(id, patch) {
  pruneExpired(Date.now(), { persist: false });
  const current = jobs.get(id);
  if (!current) return undefined;
  const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
  jobs.set(id, next);
  if (next.idempotencyKey) {
    idempotencyIndex.set(next.idempotencyKey, next.id);
  }
  persistStore();
  return next;
}

export function getJob(id) {
  return jobs.get(id);
}

export function getJobByIdempotencyKey(key) {
  const id = idempotencyIndex.get(key);
  return id ? jobs.get(id) : undefined;
}

export function saveReceipt(receipt) {
  pruneExpired(Date.now(), { persist: false });
  receipts.set(receipt.id, receipt);
  persistStore();
  return receipt;
}

export function getReceipt(id) {
  return receipts.get(id);
}

export function resetStoreForTests() {
  jobs.clear();
  receipts.clear();
  idempotencyIndex.clear();
  persistStore();
}

export function storeStats() {
  return {
    durable: !useMemoryStore(),
    storeFile: useMemoryStore() ? ":memory:" : resolvedStoreFile(),
    jobs: jobs.size,
    receipts: receipts.size,
    lastCleanupAt,
    retention: {
      jobRetentionMs: config.jobRetentionMs,
      receiptRetentionMs: config.receiptRetentionMs
    }
  };
}
