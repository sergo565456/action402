import pg from "pg";

const { Pool } = pg;

function asJson(value) {
  return typeof value === "string" ? JSON.parse(value) : value;
}

function nullable(value) {
  return value ? String(value) : null;
}

function timestampOrNow(value) {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? new Date(parsed) : new Date();
}

function receiptCreatedAt(receipt) {
  return receipt?.payload?.createdAt || receipt?.createdAt || "";
}

function clampLimit(limit, fallback = 20, max = 100) {
  const parsed = Number.parseInt(limit, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(parsed, max));
}

function statNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function createPostgresStore(config) {
  const pool = new Pool({
    connectionString: config.databaseUrl,
    ssl: config.postgresSsl ? { rejectUnauthorized: false } : undefined
  });
  let lastCleanupAt = null;

  async function migrate() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS action402_jobs (
        id TEXT PRIMARY KEY,
        idempotency_key TEXT UNIQUE,
        receipt_id TEXT,
        updated_at TIMESTAMPTZ NOT NULL,
        body JSONB NOT NULL
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS action402_jobs_updated_at_idx
      ON action402_jobs (updated_at);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS action402_jobs_receipt_id_idx
      ON action402_jobs (receipt_id);
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS action402_receipts (
        id TEXT PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL,
        body JSONB NOT NULL
      );
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS action402_receipts_created_at_idx
      ON action402_receipts (created_at);
    `);
  }

  async function pruneExpired(now = Date.now()) {
    const client = await pool.connect();
    let removedJobs = 0;
    let removedReceipts = 0;

    try {
      await client.query("BEGIN");

      if (config.jobRetentionMs > 0) {
        const cutoff = new Date(now - config.jobRetentionMs);
        const result = await client.query(
          "DELETE FROM action402_jobs WHERE updated_at < $1 RETURNING id;",
          [cutoff]
        );
        removedJobs = result.rowCount;
      }

      if (config.receiptRetentionMs > 0) {
        const cutoff = new Date(now - config.receiptRetentionMs);
        const result = await client.query(
          `DELETE FROM action402_receipts AS receipt
           WHERE receipt.created_at < $1
           AND NOT EXISTS (
             SELECT 1 FROM action402_jobs AS job WHERE job.receipt_id = receipt.id
           )
           RETURNING id;`,
          [cutoff]
        );
        removedReceipts = result.rowCount;
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    if (removedJobs > 0 || removedReceipts > 0) {
      lastCleanupAt = new Date(now).toISOString();
    }

    return { removedJobs, removedReceipts };
  }

  return {
    async init() {
      await migrate();
      await pruneExpired(Date.now());
    },

    async pruneExpired(now = Date.now()) {
      return pruneExpired(now);
    },

    async createJob(job) {
      await pruneExpired(Date.now());
      await pool.query(
        `INSERT INTO action402_jobs (id, idempotency_key, receipt_id, updated_at, body)
         VALUES ($1, $2, $3, $4, $5::jsonb);`,
        [
          job.id,
          nullable(job.idempotencyKey),
          nullable(job.receiptId),
          timestampOrNow(job.updatedAt || job.createdAt),
          JSON.stringify(job)
        ]
      );
      return job;
    },

    async updateJob(id, patch) {
      await pruneExpired(Date.now());
      const current = await this.getJob(id);
      if (!current) return undefined;

      const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
      await pool.query(
        `UPDATE action402_jobs
         SET idempotency_key = $2, receipt_id = $3, updated_at = $4, body = $5::jsonb
         WHERE id = $1;`,
        [
          id,
          nullable(next.idempotencyKey),
          nullable(next.receiptId),
          timestampOrNow(next.updatedAt),
          JSON.stringify(next)
        ]
      );
      return next;
    },

    async getJob(id) {
      const result = await pool.query("SELECT body FROM action402_jobs WHERE id = $1;", [id]);
      return result.rows[0] ? asJson(result.rows[0].body) : undefined;
    },

    async getJobByIdempotencyKey(key) {
      if (!key) return undefined;
      const result = await pool.query(
        "SELECT body FROM action402_jobs WHERE idempotency_key = $1;",
        [key]
      );
      return result.rows[0] ? asJson(result.rows[0].body) : undefined;
    },

    async saveReceipt(receipt) {
      await pruneExpired(Date.now());
      await pool.query(
        `INSERT INTO action402_receipts (id, created_at, body)
         VALUES ($1, $2, $3::jsonb)
         ON CONFLICT (id)
         DO UPDATE SET created_at = EXCLUDED.created_at, body = EXCLUDED.body;`,
        [receipt.id, timestampOrNow(receiptCreatedAt(receipt)), JSON.stringify(receipt)]
      );
      return receipt;
    },

    async getReceipt(id) {
      const result = await pool.query("SELECT body FROM action402_receipts WHERE id = $1;", [id]);
      return result.rows[0] ? asJson(result.rows[0].body) : undefined;
    },

    async listRecentJobs(limit = 20) {
      await pruneExpired(Date.now());
      const result = await pool.query(
        "SELECT body FROM action402_jobs ORDER BY updated_at DESC LIMIT $1;",
        [clampLimit(limit)]
      );
      return result.rows.map((row) => asJson(row.body));
    },

    async executionStats(options = {}) {
      await pruneExpired(Date.now());
      const now = Number.isFinite(options.now) ? options.now : Date.now();
      const parsedWindowMs = Number.parseInt(options.windowMs || 24 * 60 * 60 * 1000, 10);
      const windowMs = Number.isFinite(parsedWindowMs) ? Math.max(1000, parsedWindowMs) : 24 * 60 * 60 * 1000;
      const cutoff = new Date(now - windowMs);
      const result = await pool.query(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE body->>'status' = 'succeeded')::int AS succeeded,
           COUNT(*) FILTER (WHERE body->>'status' = 'failed')::int AS failed,
           COUNT(*) FILTER (WHERE body->>'status' = 'running')::int AS running,
           COUNT(*) FILTER (WHERE updated_at >= $1)::int AS recent_total,
           COUNT(*) FILTER (WHERE updated_at >= $1 AND body->>'status' = 'succeeded')::int AS recent_succeeded,
           COUNT(*) FILTER (WHERE updated_at >= $1 AND body->>'status' = 'failed')::int AS recent_failed,
           COUNT(*) FILTER (WHERE updated_at >= $1 AND body->>'status' = 'running')::int AS recent_running,
           MAX(updated_at) AS last_updated_at
         FROM action402_jobs;`,
        [cutoff]
      );
      const row = result.rows[0] || {};

      return {
        total: statNumber(row.total),
        succeeded: statNumber(row.succeeded),
        failed: statNumber(row.failed),
        running: statNumber(row.running),
        recentWindowMs: windowMs,
        recentTotal: statNumber(row.recent_total),
        recentSucceeded: statNumber(row.recent_succeeded),
        recentFailed: statNumber(row.recent_failed),
        recentRunning: statNumber(row.recent_running),
        lastUpdatedAt: row.last_updated_at ? new Date(row.last_updated_at).toISOString() : null
      };
    },

    async resetForTests() {
      await pool.query("TRUNCATE action402_jobs, action402_receipts;");
      lastCleanupAt = null;
    },

    async stats() {
      const [jobCount, receiptCount] = await Promise.all([
        pool.query("SELECT COUNT(*)::int AS count FROM action402_jobs;"),
        pool.query("SELECT COUNT(*)::int AS count FROM action402_receipts;")
      ]);

      return {
        driver: "postgres",
        durable: true,
        databaseConfigured: Boolean(config.databaseUrl),
        postgresSsl: config.postgresSsl,
        jobs: jobCount.rows[0]?.count || 0,
        receipts: receiptCount.rows[0]?.count || 0,
        lastCleanupAt,
        retention: {
          jobRetentionMs: config.jobRetentionMs,
          receiptRetentionMs: config.receiptRetentionMs
        }
      };
    },

    async close() {
      await pool.end();
    }
  };
}
