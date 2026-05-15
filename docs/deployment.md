# Action402 Deployment Path

## Chosen Target

Use Vercel first for the public MVP.

The app exposes the Express API through `api/index.js` as a Vercel Function, while `public/` is served as static frontend assets.

## Local Demo Check

```bash
npm install
npm test
npm run dev:demo
npm run deploy:check -- http://127.0.0.1:4021
```

Open:

- `http://127.0.0.1:4021/`
- `http://127.0.0.1:4021/demo`
- `http://127.0.0.1:4021/health`

## Local Testnet Unpaid 402 Check

This check does not pay anything and does not need a private key.

```bash
npm run smoke:testnet:unpaid
```

It starts a temporary testnet x402 server with a smoke-only receiving address, checks public JSON/static endpoints, then verifies that an unpaid execution returns `402 Payment Required` with payment headers.

For manual inspection, `.env.testnet` is prepared locally and gitignored. It uses port `4022` and a smoke-only `PAY_TO`; replace `PAY_TO` before any real paid test.

```bash
npm run dev:testnet
npm run smoke:x402 -- http://127.0.0.1:4022
```

## Vercel Deployment

The Vercel entrypoint is `api/index.js`; route rewrites live in `vercel.json`.

Set these Production environment variables in Vercel Project Settings:

- `ACTION402_PROFILE=mainnet`
- `X402_ENABLED=true`
- `PAY_TO`
- `RECEIPT_KEY_ID=mainnet-v1`
- `RECEIPT_SECRET`
- `CDP_API_KEY_ID`
- `CDP_API_KEY_SECRET`
- `X402_NETWORK=eip155:8453`
- `X402_PRICE=$0.003`
- `FACILITATOR_URL=https://api.cdp.coinbase.com/platform/v2/x402`
- `STORE_DRIVER=postgres`
- `DATABASE_URL`
- `POSTGRES_SSL=true`
- `TARGET_POLICY_PRESET=open`
- `TARGET_ALLOWLIST=` blank
- `REQUIRE_TARGET_ALLOWLIST=false`
- `TARGET_QUOTA_ENABLED=true`
- `TARGET_QUOTA_WINDOW_MS=60000`
- `TARGET_QUOTA_MAX_REQUESTS=20`
- `RATE_LIMIT_ENABLED=true`
- `RATE_LIMIT_WINDOW_MS=60000`
- `RATE_LIMIT_MAX_REQUESTS=60`
- `LOG_LEVEL=info`
- `REQUEST_LOG_ENABLED=true`

Do not set `PUBLIC_BASE_URL` to the placeholder value. On Vercel, Action402 can derive it from `VERCEL_PROJECT_PRODUCTION_URL`. Set `PUBLIC_BASE_URL` only after adding a custom production domain, or if you want to force a specific canonical URL.

Deploy:

```bash
npm test
npm run db:migrate -- mainnet
vercel --prod
```

## Docker Build

```bash
docker build -t action402 .
docker run --rm --env-file .env.demo -p 4021:4021 action402
```

For hosted deployments, set `HOST=0.0.0.0` and let the platform inject `PORT` if required.

## Production/Testnet Environment

Required for a real x402 testnet or mainnet deployment:

- `X402_ENABLED=true`
- `PAY_TO`
- `RECEIPT_KEY_ID`
- `RECEIPT_SECRET`
- `PUBLIC_BASE_URL`
- `STORE_DRIVER=postgres`
- `DATABASE_URL`
- `POSTGRES_SSL=true` for most managed Postgres providers
- `X402_NETWORK`
- `X402_PRICE`
- `FACILITATOR_URL`
- `TARGET_POLICY_PRESET`
- `TARGET_ALLOWLIST` only when using `allowlist` or `strict`

Mainnet/CDP also needs:

- `CDP_API_KEY_ID`
- `CDP_API_KEY_SECRET`

Check readiness without printing secrets:

```bash
npm run readiness -- testnet
npm run readiness -- mainnet
npm run db:migrate -- mainnet
```

## Deploy Verification

After deployment:

```bash
npm run deploy:check -- https://your-action402-domain.example --expect-x402
npm run smoke:x402 -- https://your-action402-domain.example
```

Expected result before paid buyer setup:

- static pages load;
- JSON endpoints load;
- `/health` reports `x402Enabled: true`;
- unpaid `POST /api/execute/webhook` returns `402`;
- at least one x402 payment header is present.

## First Paid Settlement

Do this only after unpaid smoke passes:

1. Replace smoke-only `PAY_TO` with your receiving wallet.
2. Use a buyer wallet/client with funded Base Sepolia or Base mainnet USDC.
3. Run a paid x402 request against `POST /api/execute/webhook`.
4. Confirm job succeeded.
5. Confirm receipt verifies with `npm run verify:receipt -- https://your-action402-domain.example job_...`.
6. Confirm facilitator/CDP settlement.
