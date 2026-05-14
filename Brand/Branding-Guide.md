# Action402 Brand Guide

Version: v0.1

## Brand Core

Action402 is paid execution infrastructure for autonomous agents.

The brand should feel precise, agent-native, and verifiable. It is not a generic AI automation brand. It is a small trust layer: pay for an action, execute the action, return proof.

Primary line:

```text
Pay. Execute. Prove.
```

Short positioning:

```text
Paid webhook and API execution for autonomous agents using x402.
```

## Logo

Primary mark: `A4 Relay`

The mark combines `A` for Action and `4` from 402. The green `4` becomes a route arrow, which makes the symbol read as execution, relay, and paid movement.

Asset:

```text
public/logo-action402.svg
```

Usage rules:

- Keep clearspace around the mark equal to the height of the arrow stem.
- Use the cream A and mint 4 on dark, ink, or warm off-white backgrounds.
- Use the mark without wordmark in favicon, small header, sticker, and avatar contexts.
- Do not rotate the mark.
- Do not recolor the mark into purple, blue-only, or rainbow variants.
- Do not place the mark inside a circle unless the platform requires a circular avatar crop.

## Color System

| Token | Hex | Use |
|---|---:|---|
| Relay Black | `#0C0F0C` | Primary background, terminal, header |
| Receipt Cream | `#F6F1E6` | Text, logo A, high-contrast surfaces |
| Execution Mint | `#20C997` | Primary CTA, success, paid execution |
| Agent Cyan | `#38D9E8` | Agent nodes, links, secondary highlights |
| Settlement Amber | `#F59F00` | Pending settlement, pricing, counters |
| Failure Red | `#FF6B6B` | Failed jobs, rejected payments, destructive states |
| Panel Solid | `#121714` | Product panels and dark cards |
| Paper | `#F4EFE4` | Light documentation sections |

Rule of thumb:

- Dark backgrounds carry the brand.
- Mint is the main action color.
- Cyan and amber are signals, not decoration.
- Red is only for actual error/failure states.

## Typography

Recommended primary family:

```text
Geist Sans
Fallback: Inter, ui-sans-serif, system-ui
```

Recommended mono family:

```text
Geist Mono
Fallback: IBM Plex Mono, ui-monospace, SFMono-Regular, Menlo, Consolas
```

Usage:

- Use sans for navigation, docs, landing copy, buttons, and product UI.
- Use mono for endpoints, hashes, signatures, config, job IDs, and receipt previews.
- Keep letter spacing at `0`.
- Avoid tiny all-caps paragraphs. All-caps is only for short labels such as `MVP API`.

Suggested scale:

| Role | Size | Line height |
|---|---:|---:|
| Hero | `72-112px` | `0.92-0.98` |
| Section heading | `42-64px` | `1.00` |
| Card heading | `20-28px` | `1.15` |
| Body | `16-20px` | `1.45-1.60` |
| Code | `13-16px` | `1.60-1.70` |

## Voice

Voice principles:

- Short.
- Exact.
- Proof-first.
- Developer-native.

Say:

- Paid execution for autonomous agents.
- Every action returns a signed receipt.
- Charge per webhook, not per seat.
- Built for x402 discovery.

Avoid:

- Magical agent automation platform.
- Trust us, it worked.
- The future of payments for everything.
- Fully autonomous AI workflow revolution.

## UI Style

Use:

- Dark surfaces with clear contrast.
- 8px radius or less.
- Terminal/code previews where proof matters.
- Dense but readable technical sections.
- Real endpoint names and JSON examples.

Avoid:

- Big generic SaaS gradients.
- Floating nested cards.
- Purple-heavy AI aesthetics.
- Decorative blobs or abstract AI swirls.
- Marketing copy that hides the actual endpoint.

## Merch Direction

Merch should look like infrastructure culture, not conference clutter.

Recommended first merch:

1. Black tee
   - Front: small `A4 Relay` mark.
   - Back: `Pay. Execute. Prove.`

2. Builder hoodie
   - Chest: compact A4 mark.
   - Sleeve: `exact payment / signed receipt`.

3. Sticker pack
   - Sticker 1: A4 mark.
   - Sticker 2: `402`.
   - Sticker 3: `POST /api/execute/webhook`.

4. Low-profile cap
   - Embroidered A4 only.
   - No slogan.

5. Developer notebook
   - Front cover: A4 mark.
   - Inside cover: receipt schema excerpt.

Merch colors:

- Black base: `#0C0F0C`
- Cream print: `#F6F1E6`
- Mint accent: `#20C997`
- Cyan/amber only for small detail prints.

## File Map

Visual brand page:

```text
public/brand.html
public/brand.css
```

Logo:

```text
public/logo-action402.svg
```

Brand tokens:

```text
docs/brand-tokens.json
```
