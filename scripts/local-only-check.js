import { execFileSync } from "node:child_process";

const forbiddenTrackedPatterns = [
  {
    pattern: /^data\//,
    reason: "data/ is reserved for local stores, local canary automation, logs, and wallet-adjacent files."
  },
  {
    pattern: /^\.github\/workflows\/.*(?:settlement|canary).*\.ya?ml$/i,
    reason: "paid settlement automation must remain local-only, not GitHub Actions."
  },
  {
    pattern: /^docs\/.*settlement-canary.*\.md$/i,
    reason: "paid settlement canary docs should not be published with the repo."
  },
  {
    pattern: /^scripts\/.*settlement-canary.*\.js$/i,
    reason: "paid settlement canary runner should remain local-only."
  },
  {
    pattern: /^scripts\/.*local-settlement.*\.js$/i,
    reason: "local paid settlement runner should remain local-only."
  },
  {
    pattern: /(?:^|\/)\.agentcash(?:\/|$)/i,
    reason: "AgentCash wallet material must never be tracked."
  },
  {
    pattern: /(?:^|\/)wallet.*\.json$/i,
    reason: "wallet JSON files must never be tracked."
  }
];

function gitLsFiles() {
  return execFileSync("git", ["ls-files", "-z"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  })
    .split("\0")
    .filter(Boolean)
    .map((path) => path.replaceAll("\\", "/"));
}

const trackedFiles = gitLsFiles();
const violations = [];

for (const file of trackedFiles) {
  for (const rule of forbiddenTrackedPatterns) {
    if (rule.pattern.test(file)) {
      violations.push({ file, reason: rule.reason });
    }
  }
}

if (violations.length > 0) {
  console.error("Local-only privacy check failed. Remove these tracked files before pushing:");
  for (const violation of violations) {
    console.error(`- ${violation.file}: ${violation.reason}`);
  }
  process.exit(1);
}

console.log(`Local-only privacy check passed: ${trackedFiles.length} tracked files inspected.`);
