import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

const allowedProfiles = new Set(["demo", "testnet", "mainnet"]);
const profile = process.argv[2] || "demo";

if (!allowedProfiles.has(profile)) {
  console.error(`Unknown profile "${profile}". Use one of: ${Array.from(allowedProfiles).join(", ")}.`);
  process.exit(1);
}

function loadProfileEnv() {
  const envFile = path.resolve(process.cwd(), `.env.${profile}`);
  const exampleFile = path.resolve(process.cwd(), `.env.${profile}.example`);

  if (fs.existsSync(envFile)) {
    dotenv.config({ path: envFile });
    return path.basename(envFile);
  }

  if (fs.existsSync(exampleFile)) {
    dotenv.config({ path: exampleFile });
    return path.basename(exampleFile);
  }

  return "";
}

function valueStatus(value, placeholderPatterns = []) {
  if (!value) return "missing";
  if (placeholderPatterns.some((pattern) => String(value).includes(pattern))) return "placeholder";
  return "set";
}

function secretStatus(value) {
  if (!value) return "missing";
  if (
    value === "development-only-receipt-secret" ||
    value === "change-this-before-production" ||
    value.includes("replace") ||
    value.includes("your-")
  ) {
    return "placeholder";
  }
  return "set";
}

function listStatus(values, placeholderPatterns = []) {
  if (!values || values.length === 0) return "missing";
  if (values.some((value) => placeholderPatterns.some((pattern) => String(value).includes(pattern)))) {
    return "placeholder";
  }
  return "set";
}

function field(name, status, required, note = "") {
  return { name, status, required, note };
}

const loadedEnv = loadProfileEnv();
process.env.ACTION402_PROFILE = profile;

const { config, validateStartupConfig } = await import("../src/config.js");

const userFields = [
  field("PAY_TO", valueStatus(config.payTo, ["Your", "your"]), config.x402Enabled, "Receiving wallet address. Public address, not a private key."),
  field("RECEIPT_SECRET", secretStatus(config.receiptSecret), config.x402Enabled, "Random app secret used for receipt HMAC signatures."),
  field("PUBLIC_BASE_URL", valueStatus(config.publicBaseUrl, ["your-action402-domain.example"]), profile === "mainnet", "Public deployed URL for x402/Bazaar discovery."),
  field("DATABASE_URL", valueStatus(config.databaseUrl, ["user:password@host", "your-"]), config.storeDriver === "postgres", "Managed Postgres connection string."),
  field("CDP_API_KEY_ID", valueStatus(config.cdpApiKeyId), config.facilitatorUrl.includes("api.cdp.coinbase.com"), "CDP facilitator credential for mainnet."),
  field("CDP_API_KEY_SECRET", valueStatus(config.cdpApiKeySecret), config.facilitatorUrl.includes("api.cdp.coinbase.com"), "CDP facilitator secret. Do not commit it."),
  field("TARGET_ALLOWLIST", listStatus(config.targetAllowlist, ["your-", ".example"]), ["allowlist", "strict"].includes(config.targetPolicyPreset), "Allowed outbound target hostnames for allowlist/strict policy."),
  field("X402_PRICE", valueStatus(config.x402Price), config.x402Enabled, "Exact action price exposed to agents and x402 clients.")
];

const errors = validateStartupConfig(config);
const requiredMissing = userFields.filter((item) => item.required && item.status !== "set");

const report = {
  ok: errors.length === 0 && requiredMissing.length === 0,
  profile,
  loadedEnv,
  mode: config.x402Enabled ? "x402" : "demo",
  publicBaseUrl: config.publicBaseUrl,
  storeDriver: config.storeDriver,
  targetPolicyPreset: config.targetPolicyPreset,
  targetQuota: {
    enabled: config.targetQuotaEnabled,
    windowMs: config.targetQuotaWindowMs,
    maxRequests: config.targetQuotaMaxRequests
  },
  userFields,
  startupErrors: errors
};

console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
