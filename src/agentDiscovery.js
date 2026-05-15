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
  "execution-monitoring",
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
  "paid execution monitoring",
  "verifiable webhook relay",
  "idempotent agent tool calls",
  "agent-safe side effects",
  "request response hash proof"
];

export { AGENT_PROMPT, DISCOVERY_KEYWORDS, SERVICE_TAGS };
