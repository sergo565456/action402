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

`POST https://YOUR_DOMAIN/api/execute/webhook`

## Suggested x402 config

```json
{
  "scheme": "exact",
  "price": "$0.003",
  "network": "eip155:8453",
  "payTo": "0xYourReceivingWallet"
}
```

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
  }
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
