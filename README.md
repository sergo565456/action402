# Action402

Pay. Execute. Prove.

Action402 is a small x402-native execution relay for autonomous agents. Agents pay per action, submit a webhook/API call, and receive a signed receipt that records what was attempted, when it happened, and what the target returned.

## MVP

- `POST /api/execute/webhook` - paid action endpoint in x402 mode.
- `GET /api/jobs/:id` - public job status.
- `GET /api/receipts/:id` - public receipt verification.
- `GET /api/bazaar` - route metadata for Bazaar positioning and docs.
- `GET /api/capabilities` - agent-readable service capabilities.
- `GET /openapi.json` - OpenAPI 3.1 contract for integrations.
- Landing page served from `/`.
- Demo console served from `/demo.html`.

## Run locally

```bash
npm install
cp .env.example .env
npm run dev
```

Profile-based local runs:

```bash
npm run dev:demo
npm run dev:testnet
npm run dev:mainnet
```

`dev:demo` can run from `.env.demo.example`. For `testnet` and `mainnet`, create `.env.testnet` or `.env.mainnet` from the matching example file and fill the user-owned values first.

By default `X402_ENABLED=false`, so the action endpoint runs in demo mode. For Bazaar/mainnet, set:

```bash
X402_ENABLED=true
PAY_TO=0xYourReceivingWallet
X402_NETWORK=eip155:8453
X402_PRICE=$0.003
FACILITATOR_URL=https://api.cdp.coinbase.com/platform/v2/x402
```

Coinbase docs currently recommend the CDP facilitator for production and note that Bazaar discovery depends on useful route metadata plus a valid x402-enabled `402 Payment Required` response.

## Example call

```bash
curl -s http://localhost:4021/api/execute/webhook \
  -H "content-type: application/json" \
  -d '{
    "url": "https://example.com/webhook",
    "method": "POST",
    "body": { "event": "agent.test", "ok": true },
    "idempotencyKey": "demo-1",
    "retry": { "attempts": 2, "backoffMs": 300 }
  }'
```

In x402 mode, call the endpoint with a compatible x402 buyer client so the payment signature is attached on retry.

## x402 smoke check

After starting an x402-enabled server, run:

```bash
npm run smoke:x402 -- http://127.0.0.1:4021
```

The smoke script checks `/health`, `/api/capabilities`, `/api/bazaar`, `/openapi.json`, and verifies that an unpaid `POST /api/execute/webhook` returns `402` with a payment-related header.

User-owned values before testnet/mainnet:

- `PAY_TO`
- `RECEIPT_SECRET`
- `PUBLIC_BASE_URL`
- `CDP_API_KEY_ID` and `CDP_API_KEY_SECRET` for the CDP facilitator
- final `X402_PRICE`

## Production notes

The local MVP persists jobs and receipts to `STORE_FILE` as a small JSON store. This is enough for local testing and a low-traffic demo, but real customer traffic should move to Postgres, SQLite/D1, Redis, or a managed queue.

Use `TARGET_ALLOWLIST`, `TARGET_BLOCKLIST`, and `REQUIRE_TARGET_ALLOWLIST=true` to constrain where agents can send outbound actions. The service still blocks localhost and private network targets by default.

Use `RATE_LIMIT_*` settings to protect the paid execution endpoint from repeated calls by the same client. Keep `RECEIPT_SECRET` stable and private. When rotating receipt secrets, set a new `RECEIPT_KEY_ID` and keep old keys in `RECEIPT_PREVIOUS_SECRETS` as comma-separated `keyId:secret` entries.
