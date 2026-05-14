import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";

const jobs = new Map();
const receipts = new Map();
const idempotencyIndex = new Map();

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

loadStore();

export function createJob(job) {
  jobs.set(job.id, job);
  if (job.idempotencyKey) {
    idempotencyIndex.set(job.idempotencyKey, job.id);
  }
  persistStore();
  return job;
}

export function updateJob(id, patch) {
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
    receipts: receipts.size
  };
}
