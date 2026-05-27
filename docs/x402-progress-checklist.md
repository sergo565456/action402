# Action402 x402 Progress Checklist

Use this file as the active execution list for getting from local demo MVP to a real x402/Bazaar-ready service.

## Current Status

- [x] Local demo server works.
- [x] Demo webhook execution works.
- [x] Signed receipts verify.
- [x] Agent-readable job/receipt proof report exists.
- [x] Durable local JSON storage works.
- [x] Managed Postgres storage support is implemented through `STORE_DRIVER=postgres`.
- [x] Rate limit exists for execution endpoint.
- [x] Target allowlist/blocklist policy exists.
- [x] Target policy presets exist.
- [x] Per-target quotas exist.
- [x] Structured execution observability exists.
- [x] Agent-readable `/api/capabilities` exists.
- [x] Canonical agent manifest `/api/agent-manifest` exists.
- [x] Well-known agent manifest `/.well-known/agent.json` exists.
- [x] x402scan-compatible manifest `/.well-known/x402` exists.
- [x] Agent-readable `/api/quickstart` exists.
- [x] Free pre-payment policy check `/api/policy/check` exists.
- [x] Free redacted canary target `/api/canary/echo` exists.
- [x] Copy-paste integration snippets `/api/snippets` exist.
- [x] Action catalog `/api/actions` exists.
- [x] Decision graph `/api/decide/webhook` exists.
- [x] Guided paid execution `/api/execute/guided-webhook` exists.
- [x] Redacted decision history `/api/decisions/recent` and `/decisions` exists.
- [x] OpenAPI `/openapi.json` exists.
- [x] Bazaar metadata `/api/bazaar` exists.
- [x] Agent guide `/agents` exists.
- [x] Discovery pack page `/discovery` exists.
- [x] LLM/agent context `/llms.txt` exists.
- [x] `robots.txt` and `sitemap.xml` discovery hints exist.
- [x] Demo console `/demo.html` exists.
- [x] Snippets page `/snippets` exists.
- [x] Proof badge route `/proof/{jobOrReceiptId}` exists.

## Phase 1: x402 Configuration Profiles

- [x] Add `.env.demo.example`.
- [x] Add `.env.testnet.example`.
- [x] Add `.env.mainnet.example`.
- [x] Add npm scripts for explicit modes if useful:
  - `npm run dev:demo`
  - `npm run dev:testnet`
  - `npm run dev:mainnet`
- [x] Document which variables are user-owned:
  - `PAY_TO`
  - `CDP_API_KEY_ID`
  - `CDP_API_KEY_SECRET`
  - `PUBLIC_BASE_URL`
  - final `X402_PRICE`

## Phase 2: Startup Validation

- [x] Validate `PAY_TO` format when `X402_ENABLED=true`.
- [x] Validate `RECEIPT_SECRET` is not default.
- [x] Validate `PUBLIC_BASE_URL` is absolute and not localhost for production/mainnet.
- [x] Validate Base network/facilitator pairing:
  - Base mainnet: `eip155:8453`
  - Base Sepolia/testnet: `eip155:84532`
- [x] Validate durable storage is enabled when `X402_ENABLED=true`.
- [x] Validate Postgres requires `DATABASE_URL`.
- [x] Emit clear startup messages with mode, network, price, public URL, and storage.

## Phase 3: x402 Smoke Script

- [x] Add `scripts/x402-smoke.js`.
- [x] Add `scripts/readiness-check.js` for profile readiness without printing secrets.
- [x] Add `scripts/testnet-unpaid-smoke.js` for no-private-key unpaid 402 checks.
- [x] Add deploy check script for static and JSON endpoint verification.
- [x] Check `/health`.
- [x] Check `/api/capabilities`.
- [x] Check `/api/bazaar`.
- [x] Check `/openapi.json`.
- [x] Check `/agents`.
- [x] Check `/llms.txt`.
- [x] Check verification paths are published.
- [x] Check agent prompt, discovery keywords, and MCP hints are published.
- [x] Check unpaid `POST /api/execute/webhook` returns `402`.
- [x] Check `PAYMENT-REQUIRED` or equivalent x402 payment header exists.
- [x] Print a concise pass/fail summary.

## Phase 4: Deployment Checklist

- [x] Choose hosting target: Vercel first.
- [x] Add Vercel Function entrypoint and route rewrites.
- [x] Add Dockerfile and container healthcheck.
- [x] Add deployment guide in `docs/deployment.md`.
- [x] Set `PUBLIC_BASE_URL`.
- [x] Set production env vars.
- [x] Set managed Postgres `DATABASE_URL`.
- [x] Run `npm run db:migrate`.
- [x] Confirm static pages load:
  - `/`
  - `/demo.html`
  - `/brand.html`
- [x] Confirm JSON endpoints load:
  - `/health`
  - `/api/capabilities`
  - `/api/bazaar`
  - `/openapi.json`
- [x] Confirm unpaid protected action returns `402`.
- [x] Confirm `402 Payment-Required` uses canonical HTTPS resource URL.

## Phase 5: First Paid Settlement

- [x] Prepare buyer wallet/client.
- [x] Fund buyer with required testnet/mainnet USDC.
- [x] Run paid x402 request against `POST /api/execute/webhook`.
- [x] Confirm job succeeded.
- [x] Confirm receipt verifies.
- [x] Confirm settlement through facilitator/CDP.
- [x] Confirm Bazaar discovery path.
- [x] Confirm CDP merchant lookup returns Action402 resource.
- [x] Confirm CDP search for `Action402` returns Action402 resource.
- [x] Confirm production deploy check passes for action catalog, snippets, proof badge, trust, and monitoring surfaces.

Latest production proof:

- Production URL: `https://action402.vercel.app`
- CDP resource: `https://action402.vercel.app/api/execute/webhook`
- PayTo: `0x75113dcF8Ce34f0338440D40270e420f8C1762b8`
- Price: `$0.003`
- Latest verified proof job: `job_68eca51ca90de40902f496c4`
- Latest verified proof receipt: `rcpt_5636160940876e545da4ed08`
- Latest verified proof time: `2026-05-27T04:48:06.197Z`
- Latest known on-chain smoke tx: `0xef2d4f21bdd077516f881ee5af5bb7ac392091d5071cf5f1a13f49921717c5db`
- CDP/Bazaar merchant lookup: `1` active resource, `14` 30-day calls, `8` unique payers, last called `2026-05-27T04:48:07.266Z`.
- Production audit: `/api/trust` reports `100/100` grade `A`, with `9` verified public proof examples and `0` recent failures in the 24h window.
- Production checks: `deploy:check` `288/288`, `smoke:x402` `103/103`, local tests `65/65`, privacy check passed on 2026-05-27.

## Phase 6: Post-Smoke Hardening

- [x] Add receipt key versioning.
- [x] Add job retention/cleanup.
- [x] Move durable storage from JSON file to production storage.
- [x] Add observability/logging for settlements and failed executions.
- [x] Add per-target quotas.
- [x] Add target policy presets for customers.
- [x] Add pre-payment policy check for agents.
- [x] Add public action catalog and quickstart surfaces.
- [x] Add proof badge pages for job/receipt ids.
- [x] Add public trust score summary.
- [x] Add copy-paste integration snippets for buyer and verification flows.

## Phase 7: Discovery Growth

- [x] Add `/api/agent-manifest` for agent directories and crawlers.
- [x] Add `/.well-known/agent.json`, `/.well-known/action402.json`, `/.well-known/x402`, and `/.well-known/x402.json`.
- [x] Add `/discovery` as the browser-readable discovery pack.
- [x] Add `/robots.txt` and `/sitemap.xml`.
- [x] Add discovery pack checks to deploy and x402 smoke scripts.

## Phase 8: Agent Decision Graph

- [x] Add free deterministic decision endpoint `POST /api/decide/webhook`.
- [x] Persist decision records in JSON and Postgres stores.
- [x] Redact public decision records and recent summaries.
- [x] Add browser pages `/decisions` and `/decision/{id}`.
- [x] Add paid guided route `POST /api/execute/guided-webhook`.
- [x] Link guided paid jobs, receipts, proof reports, and decision records.
- [x] Feed linked decision outcomes into trust/reflection summaries.
- [x] Publish decision graph surfaces through capabilities, API index, Bazaar metadata, OpenAPI, sitemap, `llms.txt`, snippets, and deploy checks.
