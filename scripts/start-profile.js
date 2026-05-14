import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

const allowedProfiles = new Set(["demo", "testnet", "mainnet"]);
const profile = process.argv[2] || "demo";

if (!allowedProfiles.has(profile)) {
  console.error(`Unknown profile "${profile}". Use one of: ${Array.from(allowedProfiles).join(", ")}.`);
  process.exit(1);
}

const envFile = path.resolve(process.cwd(), `.env.${profile}`);
const exampleFile = path.resolve(process.cwd(), `.env.${profile}.example`);

if (fs.existsSync(envFile)) {
  dotenv.config({ path: envFile });
  console.log(`Loaded ${path.basename(envFile)}`);
} else if (profile === "demo" && fs.existsSync(exampleFile)) {
  dotenv.config({ path: exampleFile });
  console.log(`Loaded ${path.basename(exampleFile)}. Create .env.demo to override local demo settings.`);
} else {
  console.error(`Missing .env.${profile}. Create it from .env.${profile}.example before starting this profile.`);
  process.exit(1);
}

process.env.ACTION402_PROFILE = profile;

await import("../src/server.js");
