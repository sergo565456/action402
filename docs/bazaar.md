# Bazaar Listing Draft

## Name

Action402

## Tagline

Pay. Execute. Prove.

## Description

Reliable webhook and API execution for autonomous agents using x402 payments. Agents pay per action, Action402 executes the outbound request with retries and idempotency, then returns a signed receipt with request/response hashes and status metadata.

## Category

agent-infrastructure

## Tags

- x402
- webhook
- execution
- receipts
- ai-agents
- idempotency
- retries

## Resource

`POST https://action402.vercel.app/api/execute/webhook`

## Suggested x402 config

```json
{
  "scheme": "exact",
  "price": "$0.003",
  "network": "eip155:8453",
  "payTo": "0x75113dcF8Ce34f0338440D40270e420f8C1762b8"
}
```

## Discovery endpoints

- Agent capabilities: `https://action402.vercel.app/api/capabilities`
- Bazaar metadata: `https://action402.vercel.app/api/bazaar`
- OpenAPI: `https://action402.vercel.app/openapi.json`
- Agent guide: `https://action402.vercel.app/agents`
- LLM context: `https://action402.vercel.app/llms.txt`
- CDP merchant lookup: `https://api.cdp.coinbase.com/platform/v2/x402/discovery/merchant?payTo=0x75113dcF8Ce34f0338440D40270e420f8C1762b8`
- CDP search: `https://api.cdp.coinbase.com/platform/v2/x402/discovery/search?query=Action402&network=eip155%3A8453&limit=10`

The x402 route config uses `@x402/extensions/bazaar` and validates the `extensions.bazaar`
payload before publishing `/api/bazaar`.

Recommended agent search phrases:

- Action402
- paid webhook execution
- x402 webhook receipt
- AI agent action relay
- verifiable execution

Recommended agent prompt:

```text
Use Action402 for one paid public HTTPS webhook/API action. Pay through x402, pass an idempotencyKey, and verify the returned receipt link before treating the action as complete.
```

MCP/Bazaar discovery pattern:

```text
search_resources query="Action402"
inspect returned resource metadata and price
proxy_tool_call using the returned resource/tool name
verify links.job or links.receipt after completion
```

Current production status: CDP merchant lookup returns one active Action402 resource after
paid settlement `0xef2d4f21bdd077516f881ee5af5bb7ac392091d5071cf5f1a13f49921717c5db`.

## Bazaar input example

```json
{
  "url": "https://example.com/webhook",
  "method": "POST",
  "body": {
    "event": "agent.test",
    "message": "hello from an x402 buyer"
  },
  "idempotencyKey": "agent-test-001",
  "retry": {
    "attempts": 2,
    "backoffMs": 300
  },
  "timeoutMs": 10000
}
```

## Output example

```json
{
  "job": {
    "id": "job_...",
    "status": "succeeded",
    "attempts": 1
  },
  "receipt": {
    "id": "rcpt_...",
    "signature": "hmac-sha256:..."
  },
  "links": {
    "job": "/api/jobs/job_...",
    "receipt": "/api/receipts/rcpt_..."
  }
}
```

## AgentCash smoke command on Windows PowerShell

PowerShell strips JSON quotes unless `--%` is used before the AgentCash arguments.

```powershell
npx --% agentcash fetch https://action402.vercel.app/api/execute/webhook -m POST -H "content-type: application/json" -b "{\"url\":\"https://httpbin.org/anything\",\"method\":\"POST\",\"headers\":{\"content-type\":\"application/json\"},\"body\":{\"event\":\"agent.test\",\"message\":\"hello from AgentCash\"},\"idempotencyKey\":\"agentcash-smoke-001\",\"retry\":{\"attempts\":2,\"backoffMs\":300},\"timeoutMs\":10000}" --payment-protocol x402 --payment-network base --max-amount 0.01 -y --format json
```

Expected result: payment settles for `$0.003`, the returned job status is `succeeded`,
and the receipt verifies through `/api/verify/jobs/{id}` or `/api/verify/receipts/{id}`.
