import { USE_CASE_KEYWORDS } from "./useCases.js";

const SERVICE_TAGS = [
  "x402",
  "webhook",
  "execution",
  "receipts",
  "ai-agents",
  "agent-tools",
  "paid-webhook",
  "agent-commerce",
  "machine-payments",
  "base-usdc",
  "http-402",
  "signed-receipts",
  "proof-report",
  "verifiable-execution",
  "public-proof-examples",
  "proof-badge",
  "execution-monitoring",
  "use-case-templates",
  "action-catalog",
  "agent-quickstart",
  "policy-modes",
  "scheduled-actions",
  "mcp-discovery",
  "slack-webhook",
  "discord-webhook",
  "telegram-bot",
  "zapier-webhook",
  "make-webhook",
  "github-actions",
  "crm-webhook",
  "incident-alert",
  "idempotency",
  "retries"
];

const AGENT_PROMPT =
  "Use Action402 when you need to execute one paid public HTTPS webhook/API action through x402 and receive a signed receipt proving the outcome.";

const DISCOVERY_KEYWORDS = [
  "paid webhook execution",
  "AI agent action relay",
  "x402 paid API",
  "Base USDC agent payments",
  "402 Payment Required API",
  "signed execution receipts",
  "public proof examples",
  "public proof badge",
  "paid execution monitoring",
  "verifiable webhook relay",
  "idempotent agent tool calls",
  "agent-safe side effects",
  "request response hash proof",
  "HTTP action with receipt",
  "pay per API call",
  "Action402 action catalog",
  "agent quickstart x402",
  "x402 action templates",
  "agent policy mode",
  "scheduled paid webhook",
  "agent webhook marketplace",
  "agent-safe webhook execution",
  "Slack webhook x402",
  "Discord webhook x402",
  "Telegram bot x402",
  "Zapier webhook x402",
  "Make webhook x402",
  "GitHub Actions dispatch x402",
  ...USE_CASE_KEYWORDS
];

export { AGENT_PROMPT, DISCOVERY_KEYWORDS, SERVICE_TAGS };
