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
- [x] OpenAPI `/openapi.json` exists.
- [x] Bazaar metadata `/api/bazaar` exists.
- [x] Agent guide `/agents` exists.
- [x] LLM/agent context `/llms.txt` exists.
- [x] Demo console `/demo.html` exists.

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

Latest production proof:

- Production URL: `https://action402.vercel.app`
- CDP resource: `https://action402.vercel.app/api/execute/webhook`
- PayTo: `0x75113dcF8Ce34f0338440D40270e420f8C1762b8`
- Price: `$0.003`
- Paid smoke job: `job_d1616d16c77a12083a74f7e6`
- Paid smoke receipt: `rcpt_a8a7c40e3a2f344b1b4f6326`
- Paid smoke tx: `0xef2d4f21bdd077516f881ee5af5bb7ac392091d5071cf5f1a13f49921717c5db`

## Phase 6: Post-Smoke Hardening

- [x] Add receipt key versioning.
- [x] Add job retention/cleanup.
- [x] Move durable storage from JSON file to production storage.
- [x] Add observability/logging for settlements and failed executions.
- [x] Add per-target quotas.
- [x] Add target policy presets for customers.
