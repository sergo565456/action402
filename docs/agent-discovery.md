# Action402 Agent Discovery

Use this as the canonical checklist for making Action402 easier for autonomous agents to find, understand, pay for, call, and verify.

## 1. x402 and Bazaar Readiness

- Production paid route: `POST https://action402.vercel.app/api/execute/webhook`.
- x402 mode should return `402 Payment Required` with payment headers for unpaid calls.
- Run `npm run deploy:check -- https://action402.vercel.app --expect-x402`.
- Run `npm run smoke:x402 -- https://action402.vercel.app`.
- Confirm `/api/bazaar` reports `discovery.bazaarExtensionValid: true`.
- Confirm CDP/Bazaar discovery can find the resource after a paid settlement.

## 2. Discovery Keywords

Use these phrases consistently in pages, JSON metadata, posts, and docs:

- Action402
- paid webhook execution
- AI agent action relay
- x402 paid API
- Base USDC agent payments
- 402 Payment Required API
- signed execution receipts
- verifiable webhook relay
- idempotent agent tool calls
- agent-safe side effects
- request response hash proof

## 3. Machine-Readable Entry Points

- `/llms.txt` for plain text agent context.
- `/api/capabilities` for action, safety, payment, verification, and MCP hints.
- `/api/bazaar` for x402/Bazaar route config and discovery extension payload.
- `/openapi.json` for OpenAPI 3.1 schema.
- `/health` for runtime and x402 status.

## 4. Human-Readable Agent Guide

The `/agents` page should answer:

- When should an agent use Action402?
- What is the paid route?
- How does the x402 payment loop work?
- What proof is returned?
- Which endpoint verifies the result?
- Which use cases are out of scope?

## 5. Copy-Paste Agent Prompt

```text
Use Action402 for one paid public HTTPS webhook/API action. Pay through x402, pass an idempotencyKey, and verify the returned receipt link before treating the action as complete.
```

## 6. MCP / Bazaar Discovery Pattern

Prefer discovery over hard-coded tool names:

```text
search_resources query="Action402"
inspect returned resource metadata and price
proxy_tool_call using the returned resource/tool name
verify links.job or links.receipt after completion
```

If building a dedicated MCP wrapper later, use `execute_webhook` as the stable local tool name and keep the input schema aligned with `/openapi.json`.
