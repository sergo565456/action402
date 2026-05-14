import "dotenv/config";

const DEFAULT_PORT = 4021;
const DEFAULT_TESTNET_NETWORK = "eip155:84532";
const DEFAULT_MAINNET_NETWORK = "eip155:8453";
const DEFAULT_TESTNET_FACILITATOR = "https://x402.org/facilitator";
const DEFAULT_MAINNET_FACILITATOR = "https://api.cdp.coinbase.com/platform/v2/x402";

function boolFromEnv(value, fallback = false) {
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function intFromEnv(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function listFromEnv(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

const facilitatorUrl = process.env.FACILITATOR_URL || DEFAULT_TESTNET_FACILITATOR;
const defaultNetwork = facilitatorUrl.includes("x402.org")
  ? DEFAULT_TESTNET_NETWORK
  : DEFAULT_MAINNET_NETWORK;
const port = intFromEnv(process.env.PORT, DEFAULT_PORT);

export const config = {
  profile: process.env.ACTION402_PROFILE || process.env.NODE_ENV || "local",
  port,
  x402Enabled: boolFromEnv(process.env.X402_ENABLED, false),
  payTo: process.env.PAY_TO || "",
  x402Network: process.env.X402_NETWORK || defaultNetwork,
  x402Price: process.env.X402_PRICE || "$0.003",
  facilitatorUrl,
  cdpApiKeyId: process.env.CDP_API_KEY_ID || "",
  cdpApiKeySecret: process.env.CDP_API_KEY_SECRET || "",
  publicBaseUrl: trimTrailingSlash(process.env.PUBLIC_BASE_URL || `http://localhost:${port}`),
  receiptSecret: process.env.RECEIPT_SECRET || "development-only-receipt-secret",
  storeFile:
    process.env.STORE_FILE || (process.env.NODE_ENV === "test" ? ":memory:" : "data/action402-store.json"),
  maxWebhookTimeoutMs: intFromEnv(process.env.MAX_WEBHOOK_TIMEOUT_MS, 12000),
  maxRetryAttempts: intFromEnv(process.env.MAX_RETRY_ATTEMPTS, 3),
  allowHttpTargets: boolFromEnv(process.env.ALLOW_HTTP_TARGETS, false),
  targetAllowlist: listFromEnv(process.env.TARGET_ALLOWLIST),
  targetBlocklist: listFromEnv(process.env.TARGET_BLOCKLIST),
  requireTargetAllowlist: boolFromEnv(process.env.REQUIRE_TARGET_ALLOWLIST, false),
  rateLimitEnabled: boolFromEnv(process.env.RATE_LIMIT_ENABLED, true),
  rateLimitWindowMs: intFromEnv(process.env.RATE_LIMIT_WINDOW_MS, 60000),
  rateLimitMaxRequests: intFromEnv(process.env.RATE_LIMIT_MAX_REQUESTS, 60)
};

function isLocalUrl(value) {
  try {
    const parsed = new URL(value);
    const hostname = parsed.hostname.toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

function isAbsoluteHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isPlaceholderSecret(value) {
  return (
    !value ||
    value === "development-only-receipt-secret" ||
    value === "change-this-before-production" ||
    value.includes("replace") ||
    value.includes("your-")
  );
}

export function validateStartupConfig(runtimeConfig = config) {
  const errors = [];

  if (runtimeConfig.port < 1 || runtimeConfig.port > 65535) {
    errors.push("PORT must be between 1 and 65535.");
  }

  if (!isAbsoluteHttpUrl(runtimeConfig.publicBaseUrl)) {
    errors.push("PUBLIC_BASE_URL must be an absolute http(s) URL.");
  }

  if (runtimeConfig.rateLimitEnabled) {
    if (runtimeConfig.rateLimitWindowMs < 1000) {
      errors.push("RATE_LIMIT_WINDOW_MS must be at least 1000.");
    }
    if (runtimeConfig.rateLimitMaxRequests < 1) {
      errors.push("RATE_LIMIT_MAX_REQUESTS must be at least 1.");
    }
  }

  if (runtimeConfig.requireTargetAllowlist && runtimeConfig.targetAllowlist.length === 0) {
    errors.push("REQUIRE_TARGET_ALLOWLIST=true requires TARGET_ALLOWLIST to contain at least one hostname.");
  }

  if (!runtimeConfig.x402Enabled) {
    return errors;
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(runtimeConfig.payTo)) {
    errors.push("X402_ENABLED=true requires PAY_TO to be a valid EVM address.");
  }

  if (isPlaceholderSecret(runtimeConfig.receiptSecret) || runtimeConfig.receiptSecret.length < 24) {
    errors.push("X402_ENABLED=true requires RECEIPT_SECRET to be a non-placeholder secret of at least 24 characters.");
  }

  if (runtimeConfig.storeFile === ":memory:") {
    errors.push("X402_ENABLED=true requires durable STORE_FILE storage.");
  }

  if (![DEFAULT_TESTNET_NETWORK, DEFAULT_MAINNET_NETWORK].includes(runtimeConfig.x402Network)) {
    errors.push(`X402_NETWORK must be ${DEFAULT_TESTNET_NETWORK} or ${DEFAULT_MAINNET_NETWORK}.`);
  }

  if (runtimeConfig.profile === "testnet" && runtimeConfig.x402Network !== DEFAULT_TESTNET_NETWORK) {
    errors.push(`ACTION402_PROFILE=testnet requires X402_NETWORK=${DEFAULT_TESTNET_NETWORK}.`);
  }

  if (runtimeConfig.profile === "mainnet" && runtimeConfig.x402Network !== DEFAULT_MAINNET_NETWORK) {
    errors.push(`ACTION402_PROFILE=mainnet requires X402_NETWORK=${DEFAULT_MAINNET_NETWORK}.`);
  }

  if (runtimeConfig.x402Network === DEFAULT_MAINNET_NETWORK && runtimeConfig.facilitatorUrl === DEFAULT_TESTNET_FACILITATOR) {
    errors.push("Base mainnet cannot use the default testnet facilitator.");
  }

  if (runtimeConfig.profile === "mainnet" && isLocalUrl(runtimeConfig.publicBaseUrl)) {
    errors.push("ACTION402_PROFILE=mainnet requires PUBLIC_BASE_URL to be a public non-local URL.");
  }

  if (runtimeConfig.facilitatorUrl === DEFAULT_MAINNET_FACILITATOR) {
    if (!runtimeConfig.cdpApiKeyId || !runtimeConfig.cdpApiKeySecret) {
      errors.push("CDP facilitator requires CDP_API_KEY_ID and CDP_API_KEY_SECRET.");
    }
  }

  return errors;
}

export function assertProductionConfig(runtimeConfig = config) {
  const errors = validateStartupConfig(runtimeConfig);
  if (errors.length > 0) {
    throw new Error(`Invalid Action402 configuration:\n- ${errors.join("\n- ")}`);
  }
}

export function runtimeSummary(runtimeConfig = config) {
  return {
    profile: runtimeConfig.profile,
    port: runtimeConfig.port,
    mode: runtimeConfig.x402Enabled ? "x402" : "demo",
    network: runtimeConfig.x402Network,
    price: runtimeConfig.x402Price,
    publicBaseUrl: runtimeConfig.publicBaseUrl,
    facilitatorUrl: runtimeConfig.facilitatorUrl,
    storeFile: runtimeConfig.storeFile,
    rateLimit: {
      enabled: runtimeConfig.rateLimitEnabled,
      windowMs: runtimeConfig.rateLimitWindowMs,
      maxRequests: runtimeConfig.rateLimitMaxRequests
    },
    targetPolicy: {
      requireTargetAllowlist: runtimeConfig.requireTargetAllowlist,
      allowlistCount: runtimeConfig.targetAllowlist.length,
      blocklistCount: runtimeConfig.targetBlocklist.length
    }
  };
}
