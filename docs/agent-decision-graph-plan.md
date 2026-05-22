# Action402 Agent Decision Graph Plan

## Goal

Action402 should evolve from "pay, execute, prove" into a relay that also helps buyer agents decide:

- whether the target action is worth paying for;
- whether the payment route, price, and network match buyer policy;
- whether the target and payload are safe enough to execute;
- whether the result can be trusted after execution;
- whether the endpoint deserves future trust based on past receipts and outcomes.

The first version should stay deterministic and cheap. It should not require an LLM key, should not execute paid actions during evaluation, and should never store sensitive raw payloads in public summaries.

## Product Shape

Keep the current paid primitive:

```text
POST /api/execute/webhook
```

Add a free decision layer around it:

```text
POST /api/decide/webhook
GET  /api/decisions/:id
GET  /api/decisions/recent
GET  /decisions
GET  /decision/:id
```

Later, add an optional paid guided execution:

```text
POST /api/execute/guided-webhook
```

The guided endpoint should run the decision graph first, charge only if deterministic policy allows execution, then call the existing webhook executor.

## Core Principle

Do not make the LLM the payment guard.

The first guard must be deterministic:

- price limit;
- network match;
- payment route match;
- target policy;
- method policy;
- timeout and retry bounds;
- target quota;
- secret and private-network safety;
- idempotency requirements.

LLM reasoning can be added later as explanation or routing help, but not as the only safety control.

## State Model

Add a machine-readable state object inspired by multi-agent state graphs:

```json
{
  "id": "dec_...",
  "version": "action402.decision.v1",
  "createdAt": "2026-05-22T00:00:00.000Z",
  "action": "execute.webhook",
  "input": {
    "url": "https://example.com/webhook",
    "method": "POST",
    "idempotencyKeyPresent": true,
    "bodyHash": "sha256:...",
    "headerNames": ["content-type"]
  },
  "buyerPolicy": {
    "maxPriceUsd": "0.009",
    "allowedNetworks": ["eip155:8453"],
    "requireReceipt": true,
    "requirePolicyPass": true,
    "allowUnknownTargets": true
  },
  "roles": {
    "paymentAnalyst": {},
    "policyAnalyst": {},
    "trustAnalyst": {},
    "executionAnalyst": {},
    "riskManager": {}
  },
  "debate": [],
  "decision": {
    "recommendation": "pay_and_execute",
    "confidence": "high",
    "maxPayable": "$0.009",
    "actualPrice": "$0.003",
    "reasons": [],
    "warnings": [],
    "blockingIssues": []
  },
  "links": {
    "execute": "/api/execute/webhook",
    "policyCheck": "/api/policy/check",
    "pricing": "/api/pricing",
    "trust": "/api/trust"
  }
}
```

Public decision summaries must redact:

- target URL;
- request body;
- request headers;
- raw hashes when the caller asks for private mode;
- receipt signature;
- any credential-like value.

## Role Graph

The graph should run as a bounded pipeline, not an open-ended chat.

```text
Input normalizer
  -> Payment Analyst
  -> Policy Analyst
  -> Trust Analyst
  -> Execution Analyst
  -> Risk Manager
  -> Decision record
```

### Payment Analyst

Checks whether payment terms are acceptable before the buyer pays.

Inputs:

- `/api/pricing`
- runtime config: x402 enabled, price, network, payTo
- buyer policy from request

Outputs:

- price match;
- network match;
- payTo presence;
- max price result;
- payment warnings.

### Policy Analyst

Runs the same safety logic as `/api/policy/check`.

Inputs:

- normalized webhook request;
- target allowlist/blocklist;
- method limits;
- timeout/retry bounds;
- private-network checks.

Outputs:

- pass/fail;
- warnings;
- blocking issues;
- suggested safe changes.

### Trust Analyst

Summarizes whether Action402 itself is currently trustworthy enough for this buyer.

Inputs:

- `/api/trust`
- `/api/monitoring/executions`
- `/api/proofs/recent`
- store stats

Outputs:

- trust score;
- recent failure rate;
- proof availability;
- storage durability;
- whether buyer should lower max spend or require manual review.

### Execution Analyst

Checks whether the action is operationally ready.

Inputs:

- idempotency key presence;
- retry settings;
- timeout settings;
- method;
- target host policy result;
- target quota status when available.

Outputs:

- execution readiness;
- duplicate/replay risk;
- retry risk;
- expected proof links.

### Risk Manager

Final deterministic reducer.

Inputs:

- all role outputs;
- buyer policy;
- blocking issues.

Outputs:

- `pay_and_execute`;
- `do_not_pay`;
- `manual_review`;
- `safe_to_test_free_canary_first`.

The risk manager should never approve execution if any deterministic blocking issue exists.

## Bounded Debate

Do not implement a free-form multi-agent debate first.

Start with a bounded "argument ledger":

```json
[
  {
    "speaker": "paymentAnalyst",
    "stance": "approve",
    "reason": "Price $0.003 is below buyer max $0.009 and network is Base mainnet."
  },
  {
    "speaker": "policyAnalyst",
    "stance": "warn",
    "reason": "Target is public HTTPS but not on a buyer allowlist."
  },
  {
    "speaker": "riskManager",
    "stance": "approve",
    "reason": "No blocking issues; receipt verification is required."
  }
]
```

This gives agents the benefit of explainability without the cost and risk of looping LLM agents.

Later optional LLM layer:

- summarize the ledger in natural language;
- map vague user goals to one of the action templates;
- suggest safer target/payload shape;
- never override deterministic blockers.

## Structured Outputs

Every new endpoint must have strict JSON shapes.

Recommended enums:

```text
recommendation:
- pay_and_execute
- do_not_pay
- manual_review
- safe_to_test_free_canary_first

confidence:
- high
- medium
- low

issue.severity:
- blocking
- warning
- info

role.stance:
- approve
- warn
- block
- observe
```

## Persistence

Decision records should use the existing store layer.

Add a new collection/table:

```text
action402_decisions
```

Minimal fields:

- `id`
- `action`
- `recommendation`
- `confidence`
- `input_hash`
- `target_origin`
- `redacted_summary`
- `decision_json`
- `created_at`
- `linked_job_id`
- `linked_receipt_id`

Retention should be configurable:

```text
DECISION_RETENTION_MS=2592000000
```

The public recent decisions endpoint should expose only redacted summaries.

## API Design

### `POST /api/decide/webhook`

Free pre-payment endpoint.

Request:

```json
{
  "action": {
    "url": "https://example.com/webhook",
    "method": "POST",
    "body": { "event": "agent.test" },
    "idempotencyKey": "buyer-task-001",
    "retry": { "attempts": 2, "backoffMs": 300 },
    "timeoutMs": 10000
  },
  "buyerPolicy": {
    "maxPriceUsd": "0.009",
    "allowedNetworks": ["eip155:8453"],
    "requireReceipt": true,
    "allowUnknownTargets": true,
    "manualReviewAboveRisk": "medium"
  },
  "mode": "evaluate_only"
}
```

Response:

```json
{
  "ok": true,
  "decisionId": "dec_...",
  "recommendation": "pay_and_execute",
  "confidence": "high",
  "blockingIssues": [],
  "warnings": [],
  "roleReports": {},
  "debate": [],
  "links": {
    "decision": "/api/decisions/dec_...",
    "execute": "/api/execute/webhook",
    "policyCheck": "/api/policy/check",
    "pricing": "/api/pricing",
    "trust": "/api/trust"
  }
}
```

### `GET /api/decisions/:id`

Returns the full redacted decision record.

### `GET /api/decisions/recent`

Returns recent public decision summaries.

### `POST /api/execute/guided-webhook`

Later phase. Runs decision first, then executes through the existing paid path only if allowed.

This endpoint should not bypass x402. It should still rely on the same payment middleware and receipt model as `/api/execute/webhook`.

## Reflection Memory

After a paid job completes, update the linked decision with actual outcome:

- job status;
- receipt verification status;
- response status;
- attempt count;
- elapsed time;
- failure category;
- whether the earlier recommendation matched the actual outcome.

Add simple endpoint-level memory:

```json
{
  "targetOrigin": "https://example.com",
  "recentExecutions": 12,
  "successRate": 0.92,
  "medianAttempts": 1,
  "lastFailureCategory": null,
  "lastVerifiedReceiptAt": "..."
}
```

Use this in the Trust Analyst later, but keep raw target URLs private in public summaries.

## Files To Add

```text
src/decisionGraph.js
src/decisionState.js
src/decisionRoles/paymentAnalyst.js
src/decisionRoles/policyAnalyst.js
src/decisionRoles/trustAnalyst.js
src/decisionRoles/executionAnalyst.js
src/decisionRoles/riskManager.js
src/decisionMemory.js
public/decisions.html
public/decision.js
test/decision-graph.test.js
test/decision-api.test.js
```

## Files To Update

```text
src/server.js
src/apiContract.js
src/apiIndex.js
src/agentDiscovery.js
src/discoveryManifest.js
src/bazaar.js
src/actionCatalog.js
src/snippets.js
src/trustSummary.js
src/stores/jsonStore.js
src/stores/postgresStore.js
README.md
docs/development-plan.md
docs/x402-progress-checklist.md
public/index.html
public/agents.html
public/llms.txt
vercel.json
```

## Implementation Phases

### Phase 1: Free deterministic decision endpoint

Deliver:

- `POST /api/decide/webhook`
- in-memory/json store support for decision records
- `GET /api/decisions/:id`
- OpenAPI schemas
- tests

Acceptance:

- safe request returns `pay_and_execute`;
- private-network target returns `do_not_pay`;
- price above buyer max returns `do_not_pay`;
- missing idempotency key returns warning or manual review, not silent approval;
- public response redacts target-sensitive data.

### Phase 2: Public decision surfaces

Deliver:

- `/decisions`
- `/decision/:id`
- `/api/decisions/recent`
- links from `/agents`, `/trust`, `/api`, `/api/capabilities`, `/llms.txt`

Acceptance:

- deploy check validates all pages and endpoints;
- public summaries do not leak target URL, body, headers, hashes, or signatures;
- discovery docs explain that decision endpoints are free and non-executing.

### Phase 3: Decision-linked execution

Deliver:

- optional `decisionId` accepted by `/api/execute/webhook`;
- job stores `decisionId`;
- receipt payload includes `decisionId` and `decisionHash`;
- verification report shows whether job matches the stored decision.

Acceptance:

- execution with matching decision links job, receipt, and decision;
- execution with stale/mismatched decision returns structured error or warning;
- idempotent replay keeps the same decision linkage.

### Phase 4: Reflection memory

Deliver:

- outcome updater after execution;
- decision record gets linked job/receipt/status;
- trust summary includes decision quality signals;
- recent decisions include outcome status when available.

Acceptance:

- successful job updates linked decision;
- failed job updates linked decision;
- public trust summary shows decision count and matched outcomes;
- no sensitive data appears in public summaries.

### Phase 5: Optional LLM explanation layer

Deliver only after deterministic graph is stable:

- `DECISION_LLM_ENABLED=false` by default;
- optional natural-language explanation field;
- optional action-template matching;
- strict timeout and fallback to deterministic output.

Acceptance:

- service works without LLM keys;
- LLM output never overrides deterministic blocking issues;
- tests cover LLM disabled mode and fallback behavior.

### Phase 6: Guided paid endpoint

Deliver last:

- `POST /api/execute/guided-webhook`
- run decision first;
- require `recommendation=pay_and_execute`;
- then run same x402 paid execution path.

Acceptance:

- unpaid guided request still returns x402 `402 Payment Required`;
- rejected decision does not execute target;
- successful guided execution returns job, receipt, decision, and proof links.

## Test Plan

Add focused tests before production deployment:

- decision graph role outputs;
- buyer max price parsing;
- network mismatch;
- policy rejection;
- trust degradation when recent failure rate is high;
- public redaction;
- OpenAPI route/schema coverage;
- `/api/capabilities`, `/api/bazaar`, `/api`, `/llms.txt` discovery mentions;
- deploy check and x402 smoke additions.

## Deployment Plan

1. Build Phase 1 locally in demo mode.
2. Run `npm test`.
3. Run `npm run privacy:check`.
4. Run local `npm run deploy:check -- http://127.0.0.1:4021`.
5. Commit and push.
6. Deploy with `npx vercel --prod --yes`.
7. Run:

```bash
npm run deploy:check -- https://action402.vercel.app --expect-x402
npm run smoke:x402 -- https://action402.vercel.app
```

## Risks

- Too much agent debate can make a simple relay feel slow and vague.
- LLM-based approvals can create unsafe payment behavior.
- Public decision examples can accidentally leak target context if redaction is not strict.
- Guided execution can confuse buyers if it is not clearly separate from free evaluation.

## Recommended First Build

Start with Phase 1 only:

```text
POST /api/decide/webhook
GET /api/decisions/:id
```

No LLM. No guided execution. No paid changes yet.

This gives agents a useful pre-payment reasoning surface immediately and keeps the current production paid endpoint stable.
