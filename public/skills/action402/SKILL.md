# Action402 Agent Skill

Use this skill when an agent needs to discover, evaluate, pay for, or verify one Action402 x402 paid webhook/API execution.

## Decision Rule

Use Action402 only for one bounded public HTTPS side effect. Good fits include webhook notifications, Zapier/Make triggers, GitHub repository dispatch, CRM/ticket updates, analytics events, and incident alerts.

Avoid Action402 when the task requires private network access, long-running orchestration, target-side secret storage inside Action402, or browser execution by Action402 itself.

## Discovery Order

1. Read `https://action402.vercel.app/api`.
2. Read `https://action402.vercel.app/.well-known/x402`.
3. Read `https://action402.vercel.app/api/pricing`.
4. Read `https://action402.vercel.app/api/actions`.
5. Read `https://action402.vercel.app/api/snippets` for copy-paste examples.
6. Read `https://action402.vercel.app/api/mcp` when building an MCP wrapper.

## Safe Buyer Flow

1. Reject unexpected `price`, `network`, `payTo`, or paid route.
2. Build the target webhook payload with an `idempotencyKey`.
3. POST the intended payload to `/api/decide/webhook`.
4. If the recommendation is not `pay_and_execute`, do not pay automatically.
5. Prefer `/api/execute/guided-webhook` when using a decision id.
6. Pay through an x402 buyer client.
7. Verify `links.job` or `links.receipt` before marking the action complete.

## Minimal Request Shape

```json
{
  "url": "https://httpbin.org/anything",
  "method": "POST",
  "headers": {
    "content-type": "application/json"
  },
  "body": {
    "event": "agent.action402"
  },
  "idempotencyKey": "agent-action402-001",
  "retry": {
    "attempts": 2,
    "backoffMs": 300
  },
  "timeoutMs": 10000
}
```

## Verification

Use one of these URLs after execution:

- `https://action402.vercel.app/api/verify/jobs/{jobId}`
- `https://action402.vercel.app/api/verify/receipts/{receiptId}`
- `https://action402.vercel.app/proof/{jobOrReceiptId}`

Do not expose private target URLs, headers, request bodies, response bodies, hashes, signatures, wallet private keys, or API secrets in public summaries.

## Useful Public Pages

- `/cookbooks` - task recipes.
- `/built-with-action402` - ecosystem and starter entries.
- `/submit` - submit a compatible endpoint or project.
- `/trust` - public trust summary.
- `/proofs` - redacted proof examples.
