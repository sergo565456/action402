# Action402 settlement canary

The settlement canary performs a real paid x402 call against:

`POST https://action402.vercel.app/api/execute/webhook`

The paid action targets the free internal canary endpoint:

`POST https://action402.vercel.app/api/canary/echo`

This creates a real CDP-settled x402 payment, then verifies the returned Action402 receipt through `/api/verify/jobs/{id}`. The target endpoint only echoes selected non-sensitive canary fields.

## Why this exists

CDP Bazaar catalogs and ranks services from successful settlements, not from metadata alone. A low-frequency canary helps keep:

- settlement path health visible;
- Bazaar recency fresh;
- public proof examples updated;
- buyer-side confidence higher before real external users arrive.

## Local dry run

Dry run prints the payload and command without paying:

```bash
npm run settlement:canary -- --dry-run
```

## Local paid run

The local run uses the AgentCash wallet on the machine running the command:

```bash
npm run settlement:canary
```

Optional overrides:

```bash
npm run settlement:canary -- --base-url https://action402.vercel.app
npm run settlement:canary -- --target-url https://action402.vercel.app/api/canary/echo
npm run settlement:canary -- --max-amount 0.01
npm run settlement:canary -- --scenario settlement-canary
```

Defaults:

- base URL: `https://action402.vercel.app`
- target URL: `https://action402.vercel.app/api/canary/echo`
- max amount: `0.01`
- payment network: `base`
- retry: 2 attempts
- timeout: 10 seconds

## GitHub Actions cron

The workflow is scheduled only. It has no manual trigger by request.

Cron:

```yaml
17 3 */3 * *
```

That is roughly once every three days at 03:17 UTC. At the current Action402 price of `$0.003`, this is about ten paid calls per month, before any wallet/tool overhead.

## Required GitHub secret

Create a small, dedicated AgentCash hot wallet for the canary. Do not use a personal main wallet. Fund it lightly, for example `0.5 USDC`.

Add this GitHub repository secret:

`AGENTCASH_WALLET_JSON_B64`

PowerShell:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("$env:USERPROFILE\.agentcash\wallet.json"))
```

Bash:

```bash
base64 -w0 ~/.agentcash/wallet.json
```

The GitHub workflow restores that value to `~/.agentcash/wallet.json` on the runner and then runs:

```bash
npm run settlement:canary
```

## Failure behavior

The script exits non-zero if:

- production `/health` is not healthy;
- `x402Enabled` is not `true`;
- `/api/canary/echo` does not respond before payment;
- `agentcash fetch` fails;
- the paid response does not contain an Action402 job id;
- `/api/verify/jobs/{id}` does not return `ok=true` and `signatureVerified=true`.

## Pausing the canary

To pause without editing code:

- disable the GitHub Actions workflow; or
- remove/rename `AGENTCASH_WALLET_JSON_B64`.

The workflow checks for the secret before it attempts a paid call.

## Later: real buyer reach

The canary mainly helps settlement health and recency. Buyer reach improves only when multiple real buyers use the service through CDP. After the canary is stable, ask several external wallets/agents to run one real paid Action402 call and save their proof links.
