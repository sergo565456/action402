# Action402 Production Evidence

Last refreshed: 2026-05-27.

This file records public, non-secret evidence for Action402 production readiness.

## Production Audit

- Production URL: `https://action402.vercel.app`
- Runtime profile: `mainnet`
- x402 enabled: `true`
- Network: `eip155:8453`
- Price: `$0.003`
- Storage: durable Postgres
- Trust score: `100/100`, grade `A`
- Public proof examples: `9`
- 24h recent failures: `0`

## Latest Public Proof

- Job: `job_68eca51ca90de40902f496c4`
- Receipt: `rcpt_5636160940876e545da4ed08`
- Status: `succeeded`
- Response status: `200`
- Receipt verified: `true`
- Updated at: `2026-05-27T04:48:06.197Z`
- Verify job: `https://action402.vercel.app/api/verify/jobs/job_68eca51ca90de40902f496c4`
- Verify receipt: `https://action402.vercel.app/api/verify/receipts/rcpt_5636160940876e545da4ed08`

Latest known on-chain smoke transaction:

- `0xef2d4f21bdd077516f881ee5af5bb7ac392091d5071cf5f1a13f49921717c5db`

## Bazaar Evidence

- CDP resource: `https://action402.vercel.app/api/execute/webhook`
- PayTo: `0x75113dcF8Ce34f0338440D40270e420f8C1762b8`
- Merchant lookup: `1` active Action402 resource
- `Action402` 10-result Bazaar search: returns Action402
- 30-day calls: `14`
- 30-day unique payers: `8`
- Last called: `2026-05-27T04:48:07.266Z`
- Bazaar metadata: `https://action402.vercel.app/api/bazaar`

## x402scan Readiness

Action402 publishes both x402scan discovery signals:

- OpenAPI canonical signal: `https://action402.vercel.app/openapi.json`
- x402 well-known fallback: `https://action402.vercel.app/.well-known/x402`

Public x402scan search/indexing can lag crawler refreshes. Treat the OpenAPI and
well-known fallback URLs as the current canonical evidence until x402scan exposes
a dedicated public Action402 listing page.

## Verification Commands

```powershell
npm run deploy:check -- https://action402.vercel.app --expect-x402
npm run smoke:x402 -- https://action402.vercel.app
npm test
npm run privacy:check
```

Latest local verification results:

- `deploy:check`: `288/288`
- `smoke:x402`: `103/103`
- `npm test`: `65/65`
- `privacy:check`: passed
