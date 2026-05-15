import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

const allowedProfiles = new Set(["demo", "testnet", "mainnet"]);
const profile = process.argv[2] || process.env.ACTION402_PROFILE || "";

if (profile) {
  if (!allowedProfiles.has(profile)) {
    console.error(`Unknown profile "${profile}". Use one of: ${Array.from(allowedProfiles).join(", ")}.`);
    process.exit(1);
  }

  const envFile = path.resolve(process.cwd(), `.env.${profile}`);
  const exampleFile = path.resolve(process.cwd(), `.env.${profile}.example`);
  if (fs.existsSync(envFile)) {
    dotenv.config({ path: envFile });
    process.env.ACTION402_PROFILE = profile;
  } else if (fs.existsSync(exampleFile)) {
    dotenv.config({ path: exampleFile });
    process.env.ACTION402_PROFILE = profile;
  } else {
    console.error(`Missing .env.${profile}. Create it from .env.${profile}.example before migrating.`);
    process.exit(1);
  }
}

const { config, validateStartupConfig } = await import("../src/config.js");

const storageErrors = validateStartupConfig({
  ...config,
  x402Enabled: false,
  facilitatorUrl: "https://x402.org/facilitator",
  cdpApiKeyId: "",
  cdpApiKeySecret: ""
}).filter((error) => !error.includes("PUBLIC_BASE_URL"));

if (storageErrors.length > 0) {
  throw new Error(`Invalid Action402 storage configuration:\n- ${storageErrors.join("\n- ")}`);
}

const { closeStore, initStore, storeStats } = await import("../src/store.js");

await initStore();

const stats = await storeStats();
console.log(
  JSON.stringify(
    {
      ok: true,
      profile: process.env.ACTION402_PROFILE || config.profile,
      store: stats
    },
    null,
    2
  )
);

await closeStore();
