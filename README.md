# Action402

Pay. Execute. Prove.

[![Production](https://img.shields.io/badge/Production-action402.vercel.app-20c997?style=flat-square)](https://action402.vercel.app)
[![Agent guide](https://img.shields.io/badge/Agents-guide-38d9e8?style=flat-square)](https://action402.vercel.app/agents)
[![Bazaar metadata](https://img.shields.io/badge/x402-Bazaar-f59f00?style=flat-square)](https://action402.vercel.app/api/bazaar)
[![Telegram](https://img.shields.io/badge/Telegram-FOMO__boy1-229ED9?style=flat-square&logo=telegram&logoColor=white)](https://t.me/FOMO_boy1)
[![X](https://img.shields.io/badge/X-@Serg0716-000000?style=flat-square&logo=x&logoColor=white)](https://x.com/Serg0716)

Action402 is an x402-native paid execution relay for autonomous agents. Agents pay per action, submit a webhook/API call, and receive a signed receipt that records what was attempted, when it happened, and what the target returned.

## Project links

- Production: https://action402.vercel.app
- Agent guide: https://action402.vercel.app/agents
- Discovery pack: https://action402.vercel.app/api/discovery
- OpenAPI: https://action402.vercel.app/openapi.json
- Bazaar metadata: https://action402.vercel.app/api/bazaar
- Production evidence: [docs/production-evidence.md](docs/production-evidence.md)
- GitHub: https://github.com/sergo565456/action402
- Contact: [Telegram](https://t.me/FOMO_boy1) / [X](https://x.com/Serg0716)

Recommended GitHub repository metadata:

- Description: `x402 paid execution relay for AI agents with verifiable receipts`
- Website: `https://action402.vercel.app`
- Topics: `x402`, `ai-agents`, `base`, `micropayments`, `webhook`, `receipts`, `agent-infrastructure`

Agent entry points:

- https://action402.vercel.app/agents - human-readable agent guide.
- https://action402.vercel.app/discovery - canonical discovery pack.
- https://action402.vercel.app/api/discovery - machine-readable discovery pack.
- https://action402.vercel.app/use-cases - task templates agents can match against.
- https://action402.vercel.app/cookbooks - copy-paste recipes for paid agent workflows.
- https://action402.vercel.app/built-with-action402 - ecosystem entries and starter integrations.
- https://action402.vercel.app/submit - submit compatible endpoints, cookbooks, wrappers, or projects.
- https://action402.vercel.app/mcp - MCP and Bazaar discovery-first flow.
- https://action402.vercel.app/api/mcp - machine-readable MCP wrapper manifest.
- https://action402.vercel.app/trust - public trust summary.
- https://action402.vercel.app/decisions - public redacted decision graph history.
- https://action402.vercel.app/status - live runtime status backed by `/health`.
- https://action402.vercel.app/pricing - current price and free surfaces.
- https://action402.vercel.app/api/pricing - machine-readable pricing and buyer guardrails.
- https://action402.vercel.app/api/capabilities - machine-readable service contract.
- https://action402.vercel.app/api/agent-manifest - canonical agent manifest.
- https://action402.vercel.app/.well-known/agent.json - well-known agent manifest alias.
- https://action402.vercel.app/.well-known/x402 - x402scan-compatible discovery fallback.
- https://action402.vercel.app/api/quickstart - compact buyer flow for agents.
- https://action402.vercel.app/api/policy/check - free pre-payment policy check.
- https://action402.vercel.app/api/canary/echo - free redacted self-test target.
- https://action402.vercel.app/api/decide/webhook - free deterministic decision graph before payment.
- https://action402.vercel.app/api/execute/guided-webhook - paid decision-linked execution.
- https://action402.vercel.app/api/decisions/recent - recent redacted decisions.
- https://action402.vercel.app/api/snippets - copy-paste buyer and verification snippets.
- https://action402.vercel.app/api/actions - action template catalog and policy modes.
- https://action402.vercel.app/examples/postman/action402.postman_collection.json - Postman collection.
- https://action402.vercel.app/skills/action402/SKILL.md - reusable agent skill.
- https://action402.vercel.app/api/bazaar - x402/Bazaar route metadata.
- https://action402.vercel.app/llms.txt - compact LLM context.
- https://action402.vercel.app/sitemap.xml - public sitemap with machine-readable surfaces.

## MVP

- `POST /api/execute/webhook` - paid action endpoint in x402 mode.
  Compatible x402 buyers retry with `X-PAYMENT` or `payment-signature`; settlement headers are exposed as `X-PAYMENT-RESPONSE` or `PAYMENT-RESPONSE`.
- `POST /api/decide/webhook` - free deterministic pay/do-not-pay decision graph for one intended webhook/API action.
- `POST /api/execute/guided-webhook` - paid endpoint that executes only when the supplied decision id approves the matching action.
- `GET /api` - compact machine-readable API index for agents that probe the API root first.
- `GET /api/discovery` - canonical machine-readable discovery pack and recommended fetch order.
- `GET /api/jobs/:id` - public job status.
- `GET /api/receipts/:id` - public receipt verification.
- `GET /api/verify/jobs/:id` - proof report linking job, receipt, signature, target, method, status, and attempts.
- `GET /api/verify/receipts/:id` - proof report by receipt id.
- `GET /api/proofs/recent` - redacted public verified proof examples.
- `GET /api/monitoring/executions` - durable execution counters and recent failure categories.
- `GET /api/decisions/:id` and `GET /api/decisions/recent` - redacted decision records and recent summaries.
- `GET /api/trust` - redacted public trust summary for buyer-side inspection.
- `/status` - browser-friendly runtime status page backed by `GET /health`.
- `GET /api/agent-manifest` - canonical machine-readable discovery manifest.
- `GET /.well-known/agent.json` - well-known manifest alias for agents and crawlers.
- `GET /.well-known/x402` - x402scan-compatible well-known discovery fallback.
- `GET /api/quickstart` - compact agent quickstart with payment guardrails and verification flow.
- `GET /api/pricing` - machine-readable price, payment route, free surfaces, limits, and buyer guardrails.
- `GET /api/mcp` and `GET /.well-known/mcp.json` - machine-readable MCP wrapper manifest for tool builders.
- `POST /api/policy/check` - free pre-payment check for target safety, policy, retry, timeout, and warnings.
- `POST /api/canary/echo` - free non-sensitive echo target for agent plumbing/self-tests.
- `GET /api/snippets` - copy-paste snippets for discovery, paid execution, proof verification, and buyer policy guardrails.
- `GET /api/actions` - machine-readable action catalog, policy modes, buyer snippets, and scheduled-action compatibility notes.
- `/cookbooks` - copy-paste recipes for common paid agent workflows.
- `/built-with-action402` - ecosystem page for compatible endpoints, wrappers, templates, and starter projects.
- `/submit` - structured submission path for Action402-compatible endpoints, cookbooks, wrappers, and projects.
- `GET /examples/postman/action402.postman_collection.json` - Postman collection for discovery, free checks, unpaid 402 shape, and verification.
- `GET /skills/action402/SKILL.md` - reusable agent skill for Action402 discovery, buyer guardrails, payment, and verification.
- `GET /api/bazaar` - route metadata for Bazaar positioning and docs.
- `GET /api/capabilities` - agent-readable service capabilities.
- `GET /openapi.json` - OpenAPI 3.1 contract for integrations.
- `OPTIONS /api/*` and `OPTIONS /api/execute/webhook` - non-credentialed CORS preflight for browser-based agents and x402 buyer clients.
- `GET /llms.txt` - plain-text agent discovery and usage guide.
- `GET /robots.txt` - crawler and agent discovery hints.
- `GET /sitemap.xml` - sitemap for public pages and machine-readable agent surfaces.
- `/agents` - browser-readable guide for autonomous agents.
- `/discovery` - browser-readable discovery pack.
- `/use-cases` - task templates for agent discovery.
- `/decisions` and `/decision/{id}` - browser-friendly decision graph history.
- `/mcp` - MCP/Bazaar discovery guide.
- `/trust` - browser-readable trust summary.
- `/status` - browser-readable live runtime status.
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
- `x402 payment decision graph`
- `decision-linked paid execution`
- `decision-linked receipts`
- `agent trust reflection memory`

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
- `GET /api/pricing` - exact price/network/payTo plus buyer guardrails before payment.
- `GET /api/mcp` - MCP wrapper manifest with tool candidates, buyer flow, and x402 guardrails.
- `POST /api/decide/webhook` - free role-based recommendation before paying.
- `POST /api/execute/guided-webhook` - preferred paid path when a decision returns `pay_and_execute`.
- `GET /api/decisions/recent` - redacted decision history for trust inspection.
- `POST /api/policy/check` - preflight the same payload before paying for execution.
- `POST /api/canary/echo` - safe internal target for non-sensitive self-tests; it does not create a paid receipt.
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
npm run privacy:check
npm run deploy:check -- http://127.0.0.1:4021
npm run smoke:testnet:unpaid
npm run db:migrate -- mainnet
```

`privacy:check` fails if local paid settlement automation, wallet-adjacent files, `data/`, or settlement workflow files are tracked by Git.

GitHub CI runs the same privacy guard plus the test suite on pushes and pull requests. It does not run paid checks, does not use secrets, and does not restore AgentCash wallets.

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

The smoke script checks `/health`, `/api/capabilities`, `/api/pricing`, `/api/mcp`, `/api/bazaar`, `/api/decide/webhook`, `/api/decisions/recent`, `/openapi.json`, agent discovery fields, and verifies that unpaid `POST /api/execute/webhook` and `POST /api/execute/guided-webhook` return `402` with a payment-related header. The deploy check also covers `/api/quickstart`, `/api/actions`, `/cookbooks`, `/built-with-action402`, `/submit`, public trust/proof/decision surfaces, developer artifacts, and proof badge routing.

Stable discovery contracts such as `/api`, `/api/capabilities`, `/api/pricing`, `/api/mcp`, `/api/bazaar`, `/api/actions`, `/cookbooks`, `/built-with-action402`, `/submit`, and `/openapi.json` use a short public cache policy. Runtime state, paid execution, decisions, proof, verification, monitoring, and health endpoints use `Cache-Control: no-store`. Action402 also sends `X-Action402-Cache-Policy` with the intended full policy because some hosts consume `s-maxage` internally and expose a normalized client `Cache-Control`.

Agent-facing pages and machine-readable discovery endpoints also publish HTTP discovery headers: `X-Action402-Agent-Entry: /api` and a `Link` header pointing to the API index, agent manifest, OpenAPI, `llms.txt`, pricing, MCP manifest, cookbooks, ecosystem page, and Bazaar metadata.

OpenAPI operations include stable `operationId` values such as `executeWebhook`, `checkWebhookPolicy`, `getPricing`, and `getMcpManifest` so client generators and agent tool mappers can keep deterministic tool names.

## Agent discovery

Use these URLs when connecting an agent, crawler, or x402/Bazaar discovery flow:

- `GET /api` - compact root API map with paid, free, discovery, preflight, verification, and trust endpoints.
- `GET /llms.txt` - concise plain-text service guide.
- `GET /api/agent-manifest` - canonical machine-readable service card for agents, crawlers, and directories.
- `GET /.well-known/agent.json` - well-known alias for the same manifest.
- `GET /.well-known/x402` - x402scan-compatible alias for the same manifest.
- `GET /api/capabilities` - action schema, x402 settings, safety limits, verification links, discovery keywords, and MCP hints.
- `GET /api/quickstart` - minimal request, payment guardrails, copy-paste snippets, and proof verification links.
- `GET /api/pricing` - machine-readable price, payment route, free surfaces, limits, and buyer guardrails.
- `GET /api/mcp` and `GET /.well-known/mcp.json` - MCP wrapper manifest for mapping Action402 routes into local tools.
- `POST /api/decide/webhook` - free deterministic decision graph before payment.
- `GET /api/decisions/recent` - redacted recent decision summaries.
- `POST /api/policy/check` - free pre-payment validation of the intended execution payload.
- `POST /api/canary/echo` - free redacted echo target for route and JSON plumbing checks.
- `GET /api/snippets` - dedicated copy-paste discovery, paid call, verification, and buyer policy examples.
- `GET /api/actions` - action templates, policy modes, and the scheduled-action design path.
- `GET /cookbooks` - task recipes that combine discovery, decision, payment, and proof verification.
- `GET /built-with-action402` - ecosystem entries and listing rules for compatible projects.
- `GET /submit` - GitHub-backed submission path for endpoints and cookbooks.
- `GET /examples/postman/action402.postman_collection.json` - Postman collection.
- `GET /skills/action402/SKILL.md` - agent skill file.
- `GET /api/bazaar` - Bazaar route config and x402 discovery metadata.
- `GET /proof/{jobOrReceiptId}` - browser-friendly proof badge for one job or receipt.
- `GET /openapi.json` - OpenAPI 3.1 contract.
- `/agents` - browser-friendly integration guide.

Recommended agent prompt:

```text
Use Action402 for one paid public HTTPS webhook/API action. First call /api/decide/webhook for a free deterministic recommendation. If it returns pay_and_execute, pay /api/execute/guided-webhook through x402 with the matching decisionId and verify the returned receipt plus decision link before treating the action as complete.
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

Machine-readable endpoints publish non-credentialed CORS headers for browser-based agents. The policy allows `content-type`, `x-payment`, and `payment-signature` request headers, exposes x402 payment response headers, and does not use cookies or credentialed browser requests.

Agents can call `/api/verify/jobs/:id` or `/api/verify/receipts/:id` to get a single JSON proof report. The report checks the HMAC signature and confirms that retained job fields match the signed receipt payload.
