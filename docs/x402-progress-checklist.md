# Action402 x402 Progress Checklist

Use this file as the active execution list for getting from local demo MVP to a real x402/Bazaar-ready service.

## Current Status

- [x] Local demo server works.
- [x] Demo webhook execution works.
- [x] Signed receipts verify.
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
- [x] Check `/health`.
- [x] Check `/api/capabilities`.
- [x] Check `/api/bazaar`.
- [x] Check `/openapi.json`.
- [x] Check unpaid `POST /api/execute/webhook` returns `402`.
- [x] Check `PAYMENT-REQUIRED` or equivalent x402 payment header exists.
- [x] Print a concise pass/fail summary.

## Phase 4: Deployment Checklist

- [ ] Choose hosting target.
- [ ] Set `PUBLIC_BASE_URL`.
- [ ] Set production env vars.
- [ ] Set managed Postgres `DATABASE_URL`.
- [ ] Run `npm run db:migrate`.
- [ ] Confirm static pages load:
  - `/`
  - `/demo.html`
  - `/brand.html`
- [ ] Confirm JSON endpoints load:
  - `/health`
  - `/api/capabilities`
  - `/api/bazaar`
  - `/openapi.json`
- [ ] Confirm unpaid protected action returns `402`.

## Phase 5: First Paid Settlement

- [ ] Prepare buyer wallet/client.
- [ ] Fund buyer with required testnet/mainnet USDC.
- [ ] Run paid x402 request against `POST /api/execute/webhook`.
- [ ] Confirm job succeeded.
- [ ] Confirm receipt verifies.
- [ ] Confirm settlement through facilitator/CDP.
- [ ] Confirm Bazaar discovery path.

## Phase 6: Post-Smoke Hardening

- [x] Add receipt key versioning.
- [x] Add job retention/cleanup.
- [x] Move durable storage from JSON file to production storage.
- [x] Add observability/logging for settlements and failed executions.
- [x] Add per-target quotas.
- [x] Add target policy presets for customers.
