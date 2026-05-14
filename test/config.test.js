import test from "node:test";
import assert from "node:assert/strict";
import { validateStartupConfig } from "../src/config.js";

const baseConfig = {
  profile: "demo",
  port: 4021,
  x402Enabled: false,
  payTo: "",
  x402Network: "eip155:84532",
  x402Price: "$0.003",
  facilitatorUrl: "https://x402.org/facilitator",
  cdpApiKeyId: "",
  cdpApiKeySecret: "",
  publicBaseUrl: "http://localhost:4021",
  receiptKeyId: "default",
  receiptSecret: "development-only-receipt-secret",
  receiptPreviousSecrets: {},
  storeDriver: "memory",
  storeFile: ":memory:",
  databaseUrl: "",
  postgresSsl: false,
  jobRetentionMs: 7 * 24 * 60 * 60 * 1000,
  receiptRetentionMs: 30 * 24 * 60 * 60 * 1000,
  rateLimitEnabled: true,
  rateLimitWindowMs: 60000,
  rateLimitMaxRequests: 60,
  logLevel: "info",
  requestLogEnabled: true,
  requireTargetAllowlist: false,
  targetAllowlist: [],
  targetBlocklist: []
};

test("demo startup config accepts local defaults", () => {
  assert.deepEqual(validateStartupConfig(baseConfig), []);
});

test("x402 startup config requires wallet, real secret, and durable storage", () => {
  const errors = validateStartupConfig({
    ...baseConfig,
    profile: "testnet",
    x402Enabled: true
  });

  assert.match(errors.join("\n"), /PAY_TO/);
  assert.match(errors.join("\n"), /RECEIPT_SECRET/);
  assert.match(errors.join("\n"), /durable storage/);
});

test("postgres store requires DATABASE_URL", () => {
  const errors = validateStartupConfig({
    ...baseConfig,
    storeDriver: "postgres"
  });

  assert.match(errors.join("\n"), /DATABASE_URL/);
});

test("postgres store rejects placeholder DATABASE_URL", () => {
  const errors = validateStartupConfig({
    ...baseConfig,
    storeDriver: "postgres",
    databaseUrl: "postgres://user:password@host:5432/action402"
  });

  assert.match(errors.join("\n"), /not a placeholder/);
});

test("startup config rejects invalid log level", () => {
  const errors = validateStartupConfig({
    ...baseConfig,
    logLevel: "verbose"
  });

  assert.match(errors.join("\n"), /LOG_LEVEL/);
});

test("x402 startup config accepts postgres durable storage", () => {
  const errors = validateStartupConfig({
    ...baseConfig,
    profile: "testnet",
    x402Enabled: true,
    payTo: "0x1111111111111111111111111111111111111111",
    receiptSecret: "this-is-a-valid-test-secret-value",
    storeDriver: "postgres",
    databaseUrl: "postgres://user:pass@localhost:5432/action402"
  });

  assert.deepEqual(errors, []);
});

test("mainnet startup config rejects localhost public URL", () => {
  const errors = validateStartupConfig({
    ...baseConfig,
    profile: "mainnet",
    x402Enabled: true,
    payTo: "0x1111111111111111111111111111111111111111",
    x402Network: "eip155:8453",
    facilitatorUrl: "https://api.cdp.coinbase.com/platform/v2/x402",
    cdpApiKeyId: "key-id",
    cdpApiKeySecret: "key-secret",
    receiptSecret: "this-is-a-valid-test-secret-value",
    storeDriver: "json",
    storeFile: "data/test-store.json"
  });

  assert.match(errors.join("\n"), /PUBLIC_BASE_URL/);
});

test("CDP facilitator requires CDP credentials", () => {
  const errors = validateStartupConfig({
    ...baseConfig,
    profile: "mainnet",
    x402Enabled: true,
    payTo: "0x1111111111111111111111111111111111111111",
    x402Network: "eip155:8453",
    facilitatorUrl: "https://api.cdp.coinbase.com/platform/v2/x402",
    publicBaseUrl: "https://action402.example",
    receiptSecret: "this-is-a-valid-test-secret-value",
    storeDriver: "json",
    storeFile: "data/test-store.json"
  });

  assert.match(errors.join("\n"), /CDP_API_KEY_ID/);
});
