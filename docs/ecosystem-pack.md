# Action402 Ecosystem Pack

This pack turns Action402 from a single paid endpoint into a discoverable builder surface.

## Public Pages

- `/cookbooks` - copy-paste recipes for common paid agent actions.
- `/built-with-action402` - seed ecosystem entries and listing rules.
- `/submit` - submission path for endpoints, projects, cookbooks, and wrappers.

## Developer Artifacts

- `public/examples/postman/action402.postman_collection.json` - Postman collection for discovery, free checks, unpaid 402 shape, and verification. Public URL: `/examples/postman/action402.postman_collection.json`.
- `public/skills/action402/SKILL.md` - reusable agent skill for Codex, Claude Code, Cursor, and other file-based agent tools. Public URL: `/skills/action402/SKILL.md`.
- `.github/ISSUE_TEMPLATE/action402-endpoint.yml` - structured GitHub issue form for ecosystem submissions.

## Product Rule

Every ecosystem entry should help a buyer agent answer four questions before spending:

1. What exact side effect will happen?
2. What are the price, network, route, and payTo?
3. What free preflight or decision result is available?
4. How can the paid result be verified after execution?

## What Not To List

- Private endpoints.
- Payloads containing secrets.
- Long-running workflows that cannot be represented as one bounded public HTTPS action.
- Claims of TEE, E2EE, secret storage, scheduling, or browser execution unless those features are actually active.
