# Action402 Development Plan

## Product Goal

Action402 is an x402-native action relay. Autonomous agents pay per action, call a protected endpoint, and receive a signed receipt proving the target, status, request hash, response hash, and attempt count.

## MVP Scope

The first useful product is intentionally narrow:

- Paid webhook/API execution through x402.
- Idempotency by caller-provided key.
- Retry and timeout controls.
- Signed receipts.
- Public job and receipt lookup.
- Bazaar-ready metadata.
- Agent-readable API contract.

## Current Endpoints

| Endpoint | Payment | Purpose |
|---|---|---|
| `POST /api/execute/webhook` | x402 in production | Execute one outbound HTTPS action |
| `GET /api/jobs/:id` | free | Inspect job status and attempts |
| `GET /api/receipts/:id` | free | Verify receipt signature |
| `GET /api/bazaar` | free | Bazaar/discovery metadata |
| `GET /api/quickstart` | free | Compact agent buyer flow |
| `GET /api/snippets` | free | Copy-paste buyer and verification snippets |
| `GET /api/actions` | free | Action template catalog |
| `GET /api/trust` | free | Public buyer trust summary |
| `GET /proof/:id` | free | Browser-friendly proof badge |
| `GET /health` | free | Runtime health |

## Next Build Milestones

### Milestone 1: Agent Contract

- [x] Add OpenAPI JSON.
- [x] Add capabilities JSON.
- [x] Make validation errors structured.
- [x] Document request and response shapes.

### Milestone 2: Production Readiness

- [x] Replace in-memory store with durable storage. Local file-backed JSON and managed Postgres are implemented.
- [x] Add admin-safe job retention policy through bounded retention settings and cleanup.
- [x] Add local job/receipt retention cleanup through `JOB_RETENTION_MS` and `RECEIPT_RETENTION_MS`.
- [x] Add per-target and per-origin rate limits. Basic per-client execution rate limit is implemented.
- [x] Add per-target execution quotas through `TARGET_QUOTA_*`.
- [x] Add receipt key versioning.
- [x] Add optional webhook target allowlist. `TARGET_ALLOWLIST`, `TARGET_BLOCKLIST`, `REQUIRE_TARGET_ALLOWLIST`, and `TARGET_POLICY_PRESET` are implemented.
- [x] Add structured logs and `/health` observability counters for requests, x402 payment flow, replays, successes, and failures.

### Milestone 3: Bazaar Launch

- [x] Add env profiles for demo, testnet, and mainnet.
- [x] Add stronger startup validation for x402 production/testnet settings.
- [x] Add x402 smoke script for unpaid `402 Payment Required` checks.
- [x] Add Docker/PaaS deployment path and deployment verification script.
- [x] Add local no-private-key testnet unpaid 402 smoke.
- [x] Deploy with a public `PUBLIC_BASE_URL`.
- [x] Enable `X402_ENABLED=true`.
- [x] Configure CDP facilitator credentials.
- [x] Run one successful paid settlement.
- [x] Verify Bazaar discovery metadata.

### Milestone 4: Expanded Actions

- [ ] Scheduled actions. Current status: design-ready metadata only; not active as a paid endpoint.
- [ ] Browser/action handoff.
- [ ] Secret storage for authenticated targets.
- [x] Policy checks before execution through target policy presets, allowlist/blocklist, and per-target quotas.
- [x] Receipt verification snippets through `/api/snippets` and `/snippets`.

## Development Principles

- Keep the buyer path accountless.
- Keep receipts verifiable without leaking full payloads.
- Reject unsafe targets by default.
- Prefer explicit JSON contracts over prose-only docs.
- Do not broaden into a generic automation platform before the paid action relay works.
