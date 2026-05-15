import fs from "node:fs";
import path from "node:path";

function timestampMs(value) {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function receiptCreatedAt(receipt) {
  return receipt?.payload?.createdAt || receipt?.createdAt || "";
}

function clampLimit(limit, fallback = 20, max = 100) {
  const parsed = Number.parseInt(limit, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(parsed, max));
}

function jobUpdatedAtMs(job) {
  return timestampMs(job?.updatedAt || job?.createdAt);
}

export function createJsonStore(config) {
  const jobs = new Map();
  const receipts = new Map();
  const idempotencyIndex = new Map();
  const useMemory = config.storeDriver === "memory" || config.storeFile === ":memory:";
  let lastCleanupAt = null;

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
    if (useMemory) return;

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
    if (useMemory) return;

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

  async function pruneExpired(now = Date.now(), options = {}) {
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

  return {
    async init() {
      loadStore();
      await pruneExpired(Date.now(), { persist: true });
    },

    async pruneExpired(now = Date.now(), options = {}) {
      return pruneExpired(now, options);
    },

    async createJob(job) {
      await pruneExpired(Date.now(), { persist: false });
      jobs.set(job.id, job);
      if (job.idempotencyKey) {
        idempotencyIndex.set(job.idempotencyKey, job.id);
      }
      persistStore();
      return job;
    },

    async updateJob(id, patch) {
      await pruneExpired(Date.now(), { persist: false });
      const current = jobs.get(id);
      if (!current) return undefined;
      const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
      jobs.set(id, next);
      if (next.idempotencyKey) {
        idempotencyIndex.set(next.idempotencyKey, next.id);
      }
      persistStore();
      return next;
    },

    async getJob(id) {
      return jobs.get(id);
    },

    async getJobByIdempotencyKey(key) {
      const id = idempotencyIndex.get(key);
      return id ? jobs.get(id) : undefined;
    },

    async saveReceipt(receipt) {
      await pruneExpired(Date.now(), { persist: false });
      receipts.set(receipt.id, receipt);
      persistStore();
      return receipt;
    },

    async getReceipt(id) {
      return receipts.get(id);
    },

    async listRecentJobs(limit = 20) {
      await pruneExpired(Date.now(), { persist: false });
      return Array.from(jobs.values())
        .sort((a, b) => jobUpdatedAtMs(b) - jobUpdatedAtMs(a))
        .slice(0, clampLimit(limit));
    },

    async executionStats(options = {}) {
      await pruneExpired(Date.now(), { persist: false });
      const now = Number.isFinite(options.now) ? options.now : Date.now();
      const parsedWindowMs = Number.parseInt(options.windowMs || 24 * 60 * 60 * 1000, 10);
      const windowMs = Number.isFinite(parsedWindowMs) ? Math.max(1000, parsedWindowMs) : 24 * 60 * 60 * 1000;
      const cutoff = now - windowMs;
      const stats = {
        total: 0,
        succeeded: 0,
        failed: 0,
        running: 0,
        recentWindowMs: windowMs,
        recentTotal: 0,
        recentSucceeded: 0,
        recentFailed: 0,
        recentRunning: 0,
        lastUpdatedAt: null
      };

      for (const job of jobs.values()) {
        const status = job.status || "unknown";
        const updatedAt = jobUpdatedAtMs(job);
        stats.total += 1;
        if (status === "succeeded") stats.succeeded += 1;
        if (status === "failed") stats.failed += 1;
        if (status === "running") stats.running += 1;

        if (updatedAt >= cutoff) {
          stats.recentTotal += 1;
          if (status === "succeeded") stats.recentSucceeded += 1;
          if (status === "failed") stats.recentFailed += 1;
          if (status === "running") stats.recentRunning += 1;
        }

        if (updatedAt > timestampMs(stats.lastUpdatedAt)) {
          stats.lastUpdatedAt = new Date(updatedAt).toISOString();
        }
      }

      return stats;
    },

    async resetForTests() {
      jobs.clear();
      receipts.clear();
      idempotencyIndex.clear();
      lastCleanupAt = null;
      persistStore();
    },

    async stats() {
      return {
        driver: useMemory ? "memory" : "json",
        durable: !useMemory,
        storeFile: useMemory ? ":memory:" : resolvedStoreFile(),
        jobs: jobs.size,
        receipts: receipts.size,
        lastCleanupAt,
        retention: {
          jobRetentionMs: config.jobRetentionMs,
          receiptRetentionMs: config.receiptRetentionMs
        }
      };
    },

    async close() {}
  };
}
