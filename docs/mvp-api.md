# Action402 MVP API

## Product

Action402 is a paid action relay for AI agents. It lets an agent pay through x402, ask the service to execute a webhook/API call, and receive a signed execution receipt.

## Buyer

- AI agent developers that need reliable side-effect execution.
- x402 tool builders that need retries, idempotency, and receipts.
- Companies that want agents to trigger bounded actions without handing them broad API keys.

## Paid endpoint

`POST /api/execute/webhook`

Executes a single outbound HTTP request after x402 payment verification in production mode.

### Request

```json
{
  "url": "https://client.example/webhook",
  "method": "POST",
  "headers": {
    "x-agent-id": "agent-123"
  },
  "body": {
    "event": "invoice.approved",
    "invoiceId": "inv_123"
  },
  "idempotencyKey": "inv_123:approved:v1",
  "retry": {
    "attempts": 3,
    "backoffMs": 500
  },
  "timeoutMs": 8000
}
```

### Response

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

## Public endpoints

`GET /api/jobs/:id`

Returns job status, target origin, attempts, and receipt id.

`GET /api/receipts/:id`

Returns receipt data and `verified: true` if the HMAC signature still matches.

`GET /api/bazaar`

Returns Bazaar-facing metadata, example request, and output schema.

`GET /api/capabilities`

Returns agent-readable service capabilities, safety boundaries, x402 config, and action schemas.

`GET /openapi.json`

Returns the OpenAPI 3.1 contract for integrations.

`GET /health`

Returns runtime health and active x402 network.

## Safety boundaries

- Blocks localhost and private network targets by default.
- Allows HTTPS targets only unless `ALLOW_HTTP_TARGETS=true`.
- Supports `TARGET_ALLOWLIST`, `TARGET_BLOCKLIST`, and `REQUIRE_TARGET_ALLOWLIST=true`.
- Applies a per-client execution rate limit through `RATE_LIMIT_*` settings.
- Persists jobs and receipts to `STORE_FILE` for local durability.
- Supports managed Postgres through `STORE_DRIVER=postgres`, `DATABASE_URL`, and `POSTGRES_SSL`.
- Uses `RECEIPT_KEY_ID` and `RECEIPT_PREVIOUS_SECRETS` for receipt key rotation.
- Cleans up old jobs and receipts through `JOB_RETENTION_MS` and `RECEIPT_RETENTION_MS`.
- Supports target policy presets and per-target quotas through `TARGET_POLICY_PRESET` and `TARGET_QUOTA_*`.
- Emits structured JSON logs and exposes process-local observability counters on `/health`.
- Caps timeout and retry attempts.
- Strips hop-by-hop headers from outbound calls.
- Stores payload/response hashes in receipts instead of raw payloads.

## Pricing hypothesis

Start with exact pricing:

- `$0.003` per execution attempt for MVP.
- Later tiers: higher price for scheduled jobs, long timeouts, callback retries, durable storage, and secret vault usage.
