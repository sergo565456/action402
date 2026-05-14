# Action402 Deployment Path

## Chosen Target

Use a Docker-capable Node hosting target first: Render, Railway, Fly.io, a VPS, or any PaaS that can run a long-lived Node container.

This keeps the Express/x402 middleware path unchanged and avoids rewriting the service into platform-specific serverless handlers before the paid relay is proven.

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
- `TARGET_ALLOWLIST` when using `allowlist` or `strict`

Mainnet/CDP also needs:

- `CDP_API_KEY_ID`
- `CDP_API_KEY_SECRET`

Check readiness without printing secrets:

```bash
npm run readiness -- testnet
npm run readiness -- mainnet
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
