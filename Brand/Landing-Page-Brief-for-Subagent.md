# Landing Page Brief for Subagent

Build a polished landing page for Action402 using the brand package in this folder.

## Product

Action402 is paid execution infrastructure for autonomous AI agents. Agents pay with x402, submit a webhook/API execution request, and receive a signed receipt proving what happened.

## Primary Audience

- AI agent builders
- x402 endpoint sellers
- agent marketplace / Bazaar explorers
- developers who need pay-per-action infrastructure

## Primary Message

```text
Pay. Execute. Prove.
```

Supporting copy:

```text
Reliable webhook and API execution for autonomous AI agents using x402 payments on Base.
```

## Required Brand Assets

- Logo: `assets/logo-action402.svg`
- Brand guide: `Branding-Guide.md`
- Tokens: `brand-tokens.json`
- Visual reference: `assets/brand-board-preview.png`

## Visual Direction

Use the `A4 Relay` logo direction.

The page should feel like developer infrastructure:

- dark charcoal background
- cream typography
- mint primary action color
- cyan/amber/red only as functional signals
- clean terminal/code previews
- no generic AI gradients
- no purple-heavy palette
- no decorative blobs

## Suggested Page Structure

1. Hero
   - Logo in header
   - H1: `Pay. Execute. Prove.`
   - Supporting copy explaining paid webhook/API execution for agents
   - CTA: `View API`
   - Secondary CTA: `Bazaar Metadata`
   - Visual: terminal receipt preview or execution relay visual

2. Product Strip
   - `Built for agents`
   - `Paid per action`
   - `Receipts by default`

3. How It Works
   - Agent pays
   - Action402 executes
   - Receipt proves

4. MVP API
   - `POST /api/execute/webhook`
   - `GET /api/jobs/:id`
   - `GET /api/receipts/:id`
   - Include compact JSON examples

5. Bazaar / x402
   - Explain that the endpoint exposes x402 route metadata
   - Link to `/api/bazaar`

6. Use Cases
   - Paid webhooks
   - Agent-triggered SaaS actions
   - Verifiable API execution
   - Usage-gated tools for autonomous agents

7. Footer
   - Action402
   - Slogan
   - Links to API and Bazaar JSON

## Copy Guidelines

Say:

- Paid execution for autonomous agents.
- Every action returns a signed receipt.
- Charge per webhook, not per seat.
- Built for x402 discovery.

Avoid:

- Magical AI automation.
- Trustless everything.
- Generic web3 hype.
- Claims that are broader than the MVP.

## Implementation Notes

Use the existing project if available:

- current landing page: `../public/index.html`
- current CSS: `../public/styles.css`
- current logo: `../public/logo-action402.svg`

Keep the page responsive. Text must not overlap on mobile. Cards should use `8px` radius or less.
