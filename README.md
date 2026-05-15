# Action402

Pay. Execute. Prove.

Action402 is a small x402-native execution relay for autonomous agents. Agents pay per action, submit a webhook/API call, and receive a signed receipt that records what was attempted, when it happened, and what the target returned.

Production: https://action402.vercel.app

Agent entry points:

- https://action402.vercel.app/agents - human-readable agent guide.
- https://action402.vercel.app/use-cases - task templates agents can match against.
- https://action402.vercel.app/mcp - MCP and Bazaar discovery-first flow.
- https://action402.vercel.app/trust - public trust summary.
- https://action402.vercel.app/pricing - current price and free surfaces.
- https://action402.vercel.app/api/capabilities - machine-readable service contract.
- https://action402.vercel.app/api/quickstart - compact buyer flow for agents.
- https://action402.vercel.app/api/policy/check - free pre-payment policy check.
- https://action402.vercel.app/api/snippets - copy-paste buyer and verification snippets.
- https://action402.vercel.app/api/actions - action template catalog and policy modes.
- https://action402.vercel.app/api/bazaar - x402/Bazaar route metadata.
- https://action402.vercel.app/llms.txt - compact LLM context.

## MVP

- `POST /api/execute/webhook` - paid action endpoint in x402 mode.
- `GET /api/jobs/:id` - public job status.
- `GET /api/receipts/:id` - public receipt verification.
- `GET /api/verify/jobs/:id` - proof report linking job, receipt, signature, target, method, status, and attempts.
- `GET /api/verify/receipts/:id` - proof report by receipt id.
- `GET /api/proofs/recent` - redacted public verified proof examples.
- `GET /api/monitoring/executions` - durable execution counters and recent failure categories.
- `GET /api/trust` - redacted public trust summary for buyer-side inspection.
- `GET /api/quickstart` - compact agent quickstart with payment guardrails and verification flow.
- `POST /api/policy/check` - free pre-payment check for target safety, policy, retry, timeout, and warnings.
- `GET /api/snippets` - copy-paste snippets for discovery, paid execution, proof verification, and buyer policy guardrails.
- `GET /api/actions` - machine-readable action catalog, policy modes, buyer snippets, and scheduled-action compatibility notes.
- `GET /api/bazaar` - route metadata for Bazaar positioning and docs.
- `GET /api/capabilities` - agent-readable service capabilities.
- `GET /openapi.json` - OpenAPI 3.1 contract for integrations.
- `GET /llms.txt` - plain-text agent discovery and usage guide.
- `/agents` - browser-readable guide for autonomous agents.
- `/use-cases` - task templates for agent discovery.
- `/mcp` - MCP/Bazaar discovery guide.
- `/trust` - browser-readable trust summary.
- Landing page served from `/`.
- Demo console served from `/demo.html`.

## What agents should use it for

Action402 is best when an agent needs one bounded public HTTPS side effect and wants to pay per execution instead of creating an account or holding a long-lived API key for Action402 itself.

Good-fit templates:

- ChatOps notifications through Slack, Discord, Telegram bridge services, or internal webhooks.
- Zapier or Make webhook triggers for no-code workflows.
- GitHub repository dispatch or other developer automation triggers.
- Analytics, audit, or evidence event ingest.
- CRM lead, support ticket, or customer workflow updates.
- Incident, reliability, or ops alert escalation.

Search phrases intentionally present in capabilities, Bazaar metadata, and `llms.txt`:

- `paid webhook execution`
- `agent action relay`
- `pay per API call`
- `HTTP action with receipt`
- `x402 webhook receipt`
- `Slack webhook x402`
- `Zapier webhook x402`
- `GitHub Actions dispatch x402`
- `agent-safe webhook execution`

## MCP and Bazaar discovery

Discovery-first agents should not hard-code a hidden route. The intended flow is:

```text
search_resources query="paid webhook execution"
inspect Action402 price, network, schema, tags, and examples
proxy_tool_call with the returned x402 resource
read links.job or links.receipt
verify /api/verify/jobs/{id} or /api/verify/receipts/{id}
```

Useful public surfaces for discovery clients:

- `GET /api/capabilities` - canonical agent-readable contract, use-case templates, safety limits, and MCP hints.
- `GET /api/quickstart` - shortest safe call flow for agents.
- `POST /api/policy/check` - preflight the same payload before paying for execution.
- `GET /api/snippets` - copy-paste snippets for discovery, paid execution, proof verification, and buyer policy guardrails.
- `GET /api/actions` - ready action templates for ChatOps, no-code automation, GitHub dispatch, ops alerts, analytics, and CRM updates.
- `GET /api/bazaar` - x402/Bazaar route config, price, payTo, tags, examples, and quality signals.
- `GET /api/trust` - current public trust signals with sensitive execution data redacted.
- `GET /api/proofs/recent` - verified proof examples without target URLs, bodies, hashes, or signatures.

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

Check which profile values are still missing without printing secrets:

```bash
npm run readiness -- demo
npm run readiness -- testnet
npm run readiness -- mainnet
```

Deployment path:

```bash
npm run deploy:check -- http://127.0.0.1:4021
npm run smoke:testnet:unpaid
npm run db:migrate -- mainnet
```

See `docs/deployment.md` for the Vercel deployment flow.

After creating a demo job, verify its proof report:

```bash
npm run verify:receipt -- http://127.0.0.1:4021 job_...
npm run verify:receipt -- http://127.0.0.1:4021 rcpt_...
```

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
curl -s http://127.0.0.1:4021/api/execute/webhook \
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

The smoke script checks `/health`, `/api/capabilities`, `/api/bazaar`, `/openapi.json`, agent discovery fields, and verifies that an unpaid `POST /api/execute/webhook` returns `402` with a payment-related header. The deploy check also covers `/api/quickstart`, `/api/actions`, public trust/proof surfaces, and proof badge routing.

## Agent discovery

Use these URLs when connecting an agent, crawler, or x402/Bazaar discovery flow:

- `GET /llms.txt` - concise plain-text service guide.
- `GET /api/capabilities` - action schema, x402 settings, safety limits, verification links, discovery keywords, and MCP hints.
- `GET /api/quickstart` - minimal request, payment guardrails, copy-paste snippets, and proof verification links.
- `POST /api/policy/check` - free pre-payment validation of the intended execution payload.
- `GET /api/snippets` - dedicated copy-paste discovery, paid call, verification, and buyer policy examples.
- `GET /api/actions` - action templates, policy modes, and the scheduled-action design path.
- `GET /api/bazaar` - Bazaar route config and x402 discovery metadata.
- `GET /proof/{jobOrReceiptId}` - browser-friendly proof badge for one job or receipt.
- `GET /openapi.json` - OpenAPI 3.1 contract.
- `/agents` - browser-friendly integration guide.

Recommended agent prompt:

```text
Use Action402 for one paid public HTTPS webhook/API action. Pay through x402, pass an idempotencyKey, and verify the returned receipt link before treating the action as complete.
```

User-owned values before testnet/mainnet:

- `PAY_TO`
- `RECEIPT_SECRET`
- `PUBLIC_BASE_URL` when not using Vercel system URLs
- `DATABASE_URL` when `STORE_DRIVER=postgres`
- `CDP_API_KEY_ID` and `CDP_API_KEY_SECRET` for the CDP facilitator
- final `X402_PRICE`

## Production notes

Local profiles bind to `HOST=127.0.0.1` so Windows/Chrome does not depend on `localhost` resolution. Open `http://127.0.0.1:4021/` for local checks. Production profiles should use `HOST=0.0.0.0` behind a real public `PUBLIC_BASE_URL`.

The local MVP can persist jobs and receipts to `STORE_FILE` as a small JSON store. For production or managed hosting, set `STORE_DRIVER=postgres`, `DATABASE_URL`, and usually `POSTGRES_SSL=true`. On startup, Action402 creates the `action402_jobs` and `action402_receipts` tables automatically. You can also run `npm run db:migrate -- mainnet` to validate the production profile connection and create tables before starting the server.

The mainnet MVP uses `TARGET_POLICY_PRESET=open` so agents can call arbitrary public HTTPS webhooks. The service still blocks localhost and private network targets by default.

Use `TARGET_ALLOWLIST`, `TARGET_BLOCKLIST`, and `REQUIRE_TARGET_ALLOWLIST=true` later if a customer-specific deployment needs constrained outbound targets.

Use `TARGET_POLICY_PRESET=open|allowlist|strict` to choose a target policy mode. `allowlist` and `strict` require `TARGET_ALLOWLIST`; `strict` also adds metadata hostnames to the blocklist.

Use `TARGET_QUOTA_*` settings to cap executions per target hostname in a rolling local window. This protects the relay from hammering one downstream API even when global rate limits allow more traffic.

Use `RATE_LIMIT_*` settings to protect the paid execution endpoint from repeated calls by the same client. Keep `RECEIPT_SECRET` stable and private. When rotating receipt secrets, set a new `RECEIPT_KEY_ID` and keep old keys in `RECEIPT_PREVIOUS_SECRETS` as comma-separated `keyId:secret` entries.

Use `LOG_LEVEL` and `REQUEST_LOG_ENABLED` to control structured JSON logs. `/health` exposes process-local observability counters for requests, x402 payment-required responses, accepted paid executions, execution replays, successes, failures, and rejected execution requests.

Agents can call `/api/verify/jobs/:id` or `/api/verify/receipts/:id` to get a single JSON proof report. The report checks the HMAC signature and confirms that retained job fields match the signed receipt payload.
