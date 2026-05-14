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
| `GET /health` | free | Runtime health |

## Next Build Milestones

### Milestone 1: Agent Contract

- [x] Add OpenAPI JSON.
- [x] Add capabilities JSON.
- [x] Make validation errors structured.
- [x] Document request and response shapes.

### Milestone 2: Production Readiness

- [x] Replace in-memory store with durable storage. Local file-backed JSON and managed Postgres are implemented.
- [ ] Add admin-safe job retention policy.
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
- [ ] Deploy with a public `PUBLIC_BASE_URL`.
- [ ] Enable `X402_ENABLED=true`.
- [ ] Configure CDP facilitator credentials.
- [ ] Run one successful paid settlement.
- [ ] Verify Bazaar discovery metadata.

### Milestone 4: Expanded Actions

- [ ] Scheduled actions.
- [ ] Browser/action handoff.
- [ ] Secret storage for authenticated targets.
- [ ] Policy checks before execution.
- [ ] Receipt verification SDK/snippets.

## Development Principles

- Keep the buyer path accountless.
- Keep receipts verifiable without leaking full payloads.
- Reject unsafe targets by default.
- Prefer explicit JSON contracts over prose-only docs.
- Do not broaden into a generic automation platform before the paid action relay works.
