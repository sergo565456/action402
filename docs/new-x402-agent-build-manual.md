# Manual: как создать нового x402-агента в отдельной папке

Дата: 2026-05-15  
Базовый референс: Action402 в `D:\Claude_test`  
Цель документа: дать другому агенту полный, самодостаточный план, чтобы он в новой папке создал другой x402-compatible сервис, не трогая Action402 и не унося секреты.

## Короткая инструкция для владельца

Этот файл можно целиком дать другому агенту. Лучше начинать новый проект не в `D:\Claude_test`, а в отдельной папке, например:

```text
D:\x402-agents\proof402
D:\x402-agents\inbox402
D:\x402-agents\enrich402
D:\x402-agents\risk402
```

Главное правило: каждый новый агент должен иметь свою узкую платную ценность, а не быть копией Action402.

## Copy-paste prompt для другого агента

```text
Ты работаешь в новой отдельной папке. Не трогай D:\Claude_test и проект Action402.

Цель: создать новый x402-compatible сервис/агента, который другие AI-агенты смогут находить, понимать, оплачивать и использовать через HTTP/x402.

Работай по пунктам. На каждом этапе сначала проверяй текущее состояние файлов, потом меняй код. Не предполагай, всегда проверяй.

Нельзя:
- копировать .env, data, приватные ключи, AgentCash wallets, Telegram tokens или Vercel secrets из других проектов;
- коммитить секреты;
- заявлять платный endpoint активным, если он реально не работает;
- делать публичные proof/result страницы с чувствительными payload, headers, tokens, signatures;
- менять проект Action402 в D:\Claude_test.

Нужно:
- создать отдельный проект;
- выбрать узкую нишу;
- сделать один главный paid endpoint;
- добавить бесплатные discovery endpoints;
- добавить agent-friendly публичные страницы;
- добавить x402 demo/testnet/mainnet режимы;
- добавить durable storage для production;
- добавить proof/result модель;
- добавить тесты;
- подготовить Vercel deploy;
- в конце дать URL, команды проверки, список env vars и список оставшихся улучшений.
```

## 1. Сначала выбрать нишу

Перед кодом новый агент обязан ответить на 6 вопросов:

```text
1. Что конкретно делает сервис?
2. Кто платит?
3. За какой результат платят?
4. Почему агенту проще купить этот endpoint, чем делать самому?
5. Что возвращается после оплаты?
6. Как другой агент проверяет результат?
```

Формат описания:

```text
Name:
One-liner:
Paid action:
Buyer:
Value:
Proof/result:
Avoid when:
```

Пример:

```text
Name: Proof402
One-liner: Pay once. Prove forever.
Paid action: POST /api/proof/notarize
Buyer: AI agents that need to prove a result/hash existed at a specific time.
Value: Agent gets a signed timestamped proof without building its own proof infrastructure.
Proof/result: proofId, timestamp, contentHash, signature, verify link, public proof badge.
Avoid when: caller needs legal notarization or private secret storage.
```

## 2. Рекомендованные ниши для следующих агентов

### Вариант 1: Proof402

Лучший следующий агент.

```text
Смысл: paid timestamp/hash notarization для AI-агентов.
Endpoint: POST /api/proof/notarize
Кто платит: research agents, audit agents, workflow agents, trading/risk agents.
Почему ценно: агент может доказать, что результат или hash существовал в момент времени.
Риск: низкий, потому что не надо дергать чужие webhook.
```

MVP input:

```json
{
  "contentHash": "sha256:...",
  "label": "agent result hash",
  "metadata": {
    "agent": "research-bot",
    "taskId": "task_123"
  },
  "idempotencyKey": "proof-task-123"
}
```

MVP output:

```json
{
  "proofId": "proof_...",
  "timestamp": "2026-05-15T00:00:00.000Z",
  "contentHash": "sha256:...",
  "signature": "hmac-sha256:...",
  "links": {
    "proof": "/proof/proof_...",
    "verify": "/api/verify/proofs/proof_..."
  }
}
```

Слоганы:

```text
Proof402 - Pay once. Prove forever.
Proof402 - Timestamped proof for autonomous agents.
Proof402 - Оплатил один раз, доказал навсегда.
```

### Вариант 2: Inbox402

```text
Смысл: paid inbox/task dropbox для связи агент-агент.
Endpoint: POST /api/inbox/messages
Кто платит: агенты, которым нужно доставить задание, предложение, отчет или уведомление другому агенту.
Что возвращается: messageId, delivery status, signed receipt, public status link.
```

Хорошо дополняет Action402: Action402 выполняет действие, Inbox402 принимает платные сообщения.

### Вариант 3: Enrich402

```text
Смысл: paid enrichment для domain/company/email/social.
Endpoint: POST /api/enrich/domain
Кто платит: sales agents, research agents, recruiting agents.
Что возвращается: structured enrichment result with confidence score and sources.
```

Риск выше: нужны источники данных, rate limits, цена источников, redaction, freshness.

### Вариант 4: Risk402

```text
Смысл: paid wallet/domain/link risk check.
Endpoint: POST /api/risk/check
Кто платит: trading agents, treasury agents, security agents.
Что возвращается: riskScore, categories, reasons, sources, proof link.
```

Риск: качество данных и ответственность за false positive/false negative.

### Вариант 5: Research402

```text
Смысл: paid compact research with citations.
Endpoint: POST /api/research/brief
Кто платит: agents that need a short sourced answer.
Что возвращается: answer, citations, confidence, timestamp, proof.
```

Риск: нужен веб-поиск, цитирование, freshness, anti-hallucination checks.

### Вариант 6: Notify402

```text
Смысл: paid notification relay: Telegram, Discord, Slack, email.
Endpoint: POST /api/notify/send
Кто платит: agents that need a paid operator/user notification.
Что возвращается: delivery status, provider status, proof link.
```

Риск: надо хранить provider secrets безопасно или требовать target-side webhook.

## 3. Рекомендация по порядку

Я бы делал так:

```text
1. Proof402
2. Inbox402
3. Notify402
4. Risk402
5. Enrich402
6. Research402
```

Почему Proof402 первым:

```text
- не конфликтует с Action402;
- легко объяснить другим агентам;
- мало внешних зависимостей;
- хорошо подходит для proof/result страниц;
- ниже security risk;
- можно быстро довести до production;
- может стать инфраструктурным кирпичом для остальных агентов.
```

## 4. Структура новой папки

Минимальная структура:

```text
agent-name/
  package.json
  README.md
  .gitignore
  vercel.json
  api/
    index.js
  src/
    server.js
    config.js
    x402.js
    store.js
    receipt.js
    apiContract.js
    bazaar.js
    actionCatalog.js
    trustSummary.js
    errors.js
    rateLimit.js
  public/
    index.html
    agents.html
    pricing.html
    demo.html
    actions.html
    trust.html
    proofs.html
    llms.txt
  scripts/
    deploy-check.js
    x402-smoke.js
    start-profile.js
  test/
    api-contract.test.js
    receipt.test.js
    store.test.js
```

Не обязательно копировать все один в один, но эти части должны быть покрыты.

## 5. Обязательные endpoints

### Бесплатные endpoints

```text
GET /health
GET /openapi.json
GET /api/capabilities
GET /api/bazaar
GET /api/quickstart
GET /api/actions
GET /api/trust
GET /llms.txt
```

Назначение:

```text
/health - runtime status, x402 status, storage status.
/openapi.json - API contract.
/api/capabilities - главный machine-readable contract.
/api/bazaar - Bazaar/x402 discovery metadata.
/api/quickstart - самый короткий путь для агента.
/api/actions - каталог action/result templates.
/api/trust - public trust signals.
/llms.txt - plain-text guidance для LLM/agent crawlers.
```

### Платный endpoint

У MVP должен быть один главный paid endpoint.

Примеры:

```text
Proof402:    POST /api/proof/notarize
Inbox402:    POST /api/inbox/messages
Notify402:   POST /api/notify/send
Risk402:     POST /api/risk/check
Enrich402:   POST /api/enrich/domain
Research402: POST /api/research/brief
```

Требования:

```text
- JSON input;
- строгая schema;
- понятный JSON output;
- idempotencyKey;
- bounded timeout;
- bounded retries, если есть outbound call;
- x402 protection в production;
- demo mode без реальной оплаты;
- result/proof/receipt links.
```

### Verification endpoints

Минимум:

```text
GET /api/jobs/{id}
GET /api/verify/jobs/{id}
GET /proof/{id}
```

Если сервис работает не через jobs, а через proofs/results:

```text
GET /api/proofs/{id}
GET /api/verify/proofs/{id}
GET /proof/{id}
```

## 6. Что должно быть в /api/capabilities

Обязательно:

```json
{
  "name": "AgentName",
  "version": "0.1.0",
  "tagline": "...",
  "description": "...",
  "shortDescription": "...",
  "publicBaseUrl": "https://...",
  "discoveryKeywords": [],
  "agentPrompt": "...",
  "x402": {
    "enabled": true,
    "scheme": "exact",
    "network": "eip155:8453",
    "price": "$0.003"
  },
  "actions": [],
  "actionCatalog": {
    "path": "/api/actions"
  },
  "quickstart": {
    "path": "/api/quickstart"
  },
  "verification": {},
  "safety": {},
  "links": {}
}
```

Особенно важно:

```text
agentPrompt - готовая инструкция другому агенту.
discoveryKeywords - фразы для Bazaar/MCP поиска.
actions - реальные активные paid actions.
avoidWhen - когда сервис использовать нельзя.
safety - ограничения и лимиты.
links - все публичные страницы и JSON endpoints.
```

## 7. Что должно быть в /api/bazaar

Обязательно:

```text
name
tagline
description
category
tags
discoveryKeywords
agentPrompt
resource
x402Enabled
payment.scheme
payment.price
payment.network
payment.payTo
discovery.searchQueries
discovery.qualitySignals
inputExample
outputExample
routeConfig
links
```

Quality signals должны быть честными. Нельзя писать:

```text
"Scheduled execution is available"
```

если scheduled execution реально не реализован.

Правильнее:

```text
"Scheduled-action preview is marked preview-only, not falsely advertised as durable paid scheduling"
```

## 8. Что должно быть в /api/quickstart

Цель: другой агент за 10 секунд понимает, как вызвать сервис.

Структура:

```json
{
  "ok": true,
  "service": "AgentName",
  "purpose": "...",
  "recommendedUse": "...",
  "payment": {
    "required": true,
    "scheme": "exact",
    "network": "eip155:8453",
    "price": "$0.003",
    "route": "https://.../api/..."
  },
  "minimalRequest": {},
  "callFlow": [],
  "decisionRules": {
    "useWhen": [],
    "avoidWhen": []
  },
  "limits": {},
  "snippets": [],
  "verify": {},
  "nextDiscoverySteps": []
}
```

## 9. Что должно быть в /api/actions

Цель: другой агент выбирает use case/task template.

Структура:

```json
{
  "ok": true,
  "service": "AgentName",
  "activePrimitive": {
    "id": "...",
    "method": "POST",
    "path": "/api/...",
    "paid": true,
    "price": "$0.003"
  },
  "categories": [],
  "templates": [],
  "policyModes": [],
  "snippets": [],
  "discoveryKeywords": [],
  "links": {}
}
```

Каждый template:

```json
{
  "id": "...",
  "status": "ready",
  "category": "...",
  "title": "...",
  "description": "...",
  "tags": [],
  "searchPhrases": [],
  "paidRoute": "/api/...",
  "exampleRequest": {},
  "buyerValue": "...",
  "verification": []
}
```

## 10. x402 режимы и env vars

Нужно иметь 3 профиля:

```text
demo - локальная разработка без реальной оплаты;
testnet - smoke на Base Sepolia;
mainnet - production на Base mainnet.
```

Обычно нужны:

```text
NODE_ENV=production
PUBLIC_BASE_URL=https://your-domain.vercel.app
X402_ENABLED=true
X402_NETWORK=eip155:8453
X402_PRICE=$0.003
PAY_TO=0x...
DATABASE_URL=postgres://...
RECEIPT_SECRET=...
CDP_API_KEY_ID=...
CDP_API_KEY_SECRET=...
```

Правила:

```text
- .env не коммитить;
- .env.demo.example можно коммитить;
- реальные secrets только локально или в Vercel env;
- PAY_TO может быть обычный receiving wallet, приватник от него сервису не нужен;
- AgentCash wallets, Telegram tokens, canary scripts - только local/data, не GitHub.
```

## 11. Storage

Для demo можно:

```text
JSON file
memory
```

Для production нужно:

```text
Postgres / Neon / Supabase / Vercel Postgres
```

Хранить:

```text
jobs
results/proofs
receipts
timestamps
status
hashes
verification metadata
```

Не публиковать:

```text
raw request body
raw response body
private headers
tokens
wallet secrets
receipt secret
full signatures in broad public feeds
```

## 12. Proof/result модель

Каждый paid call должен возвращать:

```json
{
  "mode": "x402",
  "idempotentReplay": false,
  "job": {
    "id": "job_...",
    "status": "succeeded"
  },
  "result": {},
  "receipt": {
    "id": "rcpt_..."
  },
  "links": {
    "job": "/api/jobs/job_...",
    "verify": "/api/verify/jobs/job_...",
    "proof": "/proof/job_..."
  }
}
```

Для Proof402 можно без `job`, но тогда нужен `proofId`:

```json
{
  "proof": {
    "id": "proof_...",
    "verified": true
  },
  "links": {
    "proof": "/proof/proof_...",
    "verify": "/api/verify/proofs/proof_..."
  }
}
```

## 13. Security boundaries

Обязательно:

```text
rate limit
target quota, если есть outbound calls
payload size limit
timeout
max retry attempts
idempotency
structured JSON errors
private network blocking for outbound HTTP
HTTPS-only targets in production
redaction for public pages
no secret logging
```

Ошибки должны быть понятные:

```json
{
  "error": {
    "code": "invalid_input",
    "message": "contentHash is required",
    "details": {}
  }
}
```

## 14. Публичные страницы

Минимум:

```text
/                landing
/agents          how agents use it
/pricing         price and free surfaces
/demo            demo console
/actions         action/result catalog
/trust           trust summary
/proofs          recent public proofs/results
/proof/{id}      one proof/result badge
```

Страницы должны не просто красиво выглядеть, а помогать агентам:

```text
- clearly state paid route;
- show price;
- show JSON examples;
- link to /api/quickstart;
- link to /api/actions;
- link to /api/bazaar;
- link to /openapi.json;
- explain verification.
```

## 15. llms.txt

`/llms.txt` должен быть максимально прямой:

```text
What this service does
When to use
When not to use
Paid endpoint
Free endpoints
Price
Verification flow
Discovery queries
Copy-paste command
Production URL
```

Он нужен не людям, а агентам и LLM context loaders.

## 16. Тесты

Минимум:

```text
capabilities document exposes paid action
openapi exposes paid path
bazaar metadata exposes valid route config
quickstart endpoint returns minimal request
actions endpoint returns templates
llms.txt contains discovery guidance
public pages load
proof badge page loads
invalid input rejected
idempotency works
receipt/proof signature verifies
unpaid paid endpoint returns 402 in x402 mode
```

Команды:

```text
npm test
npm run dev:demo
npm run deploy:check -- http://127.0.0.1:PORT
npm run deploy:check -- https://production-url --expect-x402
npm run smoke:x402 -- https://production-url
```

## 17. Deploy на Vercel

До deploy проверить:

```text
git status --short
npm test
npm run deploy:check -- http://127.0.0.1:PORT
```

В Vercel env vars задать:

```text
PUBLIC_BASE_URL
X402_ENABLED
X402_NETWORK
X402_PRICE
PAY_TO
DATABASE_URL
RECEIPT_SECRET
CDP_API_KEY_ID
CDP_API_KEY_SECRET
```

После deploy:

```text
npm run deploy:check -- https://production-url --expect-x402
npm run smoke:x402 -- https://production-url
```

Проверить вручную:

```text
https://production-url/
https://production-url/agents
https://production-url/actions
https://production-url/api/quickstart
https://production-url/api/actions
https://production-url/api/bazaar
https://production-url/openapi.json
```

## 18. GitHub правила

Коммитить:

```text
src
public
scripts
test
docs
README.md
package.json
vercel.json
.env.example
```

Не коммитить:

```text
.env
.env.local
.env.mainnet
data
wallets
telegram tokens
private keys
canary payment automation
Vercel secrets
CDP secrets
AgentCash account files
```

## 19. Что не должно конфликтовать с Action402

Action402:

```text
paid action relay
executes webhooks/API calls
proofs execution attempts
```

Новые агенты должны дополнять:

```text
Proof402 - proves hashes/results
Inbox402 - accepts paid messages/tasks
Notify402 - sends paid notifications
Risk402 - checks risk
Enrich402 - enriches entities
Research402 - produces sourced brief
```

Не надо делать второй Action402 без новой ценности.

## 20. Definition of Done

Новый агент считается готовым для MVP, если:

```text
1. Есть отдельная папка проекта.
2. Есть один понятный paid endpoint.
3. Есть /api/capabilities.
4. Есть /api/bazaar.
5. Есть /api/quickstart.
6. Есть /api/actions.
7. Есть /llms.txt.
8. Есть /openapi.json.
9. Есть proof/result verification.
10. Есть публичная proof/result badge page.
11. Есть demo mode.
12. Есть mainnet x402 config path.
13. Есть tests.
14. npm test проходит.
15. deploy-check проходит локально.
16. production deploy-check проходит.
17. unpaid paid endpoint returns 402.
18. Секреты не попали в GitHub.
19. README объясняет как запустить и проверить.
20. В финальном ответе есть URL и список следующих улучшений.
```

## 21. Самопроверка перед финальным ответом

Перед тем как сказать владельцу "готово", агент должен проверить:

```text
git status --short
npm test
npm run deploy:check -- http://127.0.0.1:PORT
npm run deploy:check -- https://production-url --expect-x402
npm run smoke:x402 -- https://production-url
```

И ответить:

```text
Что создано:
Что платное:
Что бесплатное:
Где production URL:
Как локально запустить:
Как проверить x402:
Какие env vars нужны от владельца:
Какие риски остались:
Что улучшить дальше:
```

## 22. Мои дополнительные рекомендации

1. Делать сервисы маленькими и понятными.

Хороший агент продает один понятный результат. Если endpoint сложно объяснить за одну строку, ниша слишком широкая.

2. Сначала делать trust/discovery, потом усложнять product logic.

Для agent marketplace важно не только "работает", но и "другой агент понял, что это, сколько стоит и как проверить".

3. Не притворяться production там, где есть roadmap.

Если scheduled actions, browser handoff, secret storage или policy marketplace еще не готовы, помечать их как:

```text
planned
design-ready
preview
not active as paid endpoint
```

4. Делать proof badge у каждого агента.

Это сильный стандарт:

```text
/proof/{id}
```

Другой агент может ссылаться на proof page в своем отчете.

5. Сделать общий starter-template.

Следующий технический шаг после Proof402:

```text
D:\x402-starter
```

Туда вынести общий каркас:

```text
server
config
x402 middleware
receipt/proof signing
store
capabilities
bazaar
quickstart
actions catalog
trust
deploy-check
x402-smoke
```

Тогда новые агенты будут создаваться в 3-5 раз быстрее.

6. Все автоматические платежи держать локально.

Платные canary checks, AgentCash wallets, Telegram уведомления и daily activity scripts должны жить только в local `data/` и не попадать в GitHub.

## 23. Рекомендуемый следующий проект: Proof402

Если владелец не выбрал другую нишу, начинай с Proof402.

Короткое ТЗ:

```text
Создать Proof402 - x402-paid proof/timestamp service for autonomous agents.

Paid endpoint:
POST /api/proof/notarize

Input:
- contentHash
- label
- optional metadata
- idempotencyKey

Output:
- proofId
- timestamp
- contentHash
- metadataHash
- signature
- links.proof
- links.verify

Free endpoints:
- GET /health
- GET /api/capabilities
- GET /api/bazaar
- GET /api/quickstart
- GET /api/actions
- GET /api/trust
- GET /openapi.json
- GET /llms.txt
- GET /proof/{id}
- GET /api/verify/proofs/{id}

Production:
- x402 exact payment on Base mainnet
- durable Postgres storage
- public proof pages with redacted metadata where needed
```

Почему это хороший следующий шаг:

```text
- дополняет Action402;
- низкий риск;
- легко тестировать;
- понятно другим агентам;
- можно использовать как trust layer для будущих агентов;
- хорошо смотрится в Bazaar как инфраструктурный primitive.
```
