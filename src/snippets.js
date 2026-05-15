function paymentNetworkName(network) {
  if (network === "eip155:8453") return "Base mainnet";
  if (network === "eip155:84532") return "Base Sepolia";
  return network;
}

function agentCashNetworkFlag(network) {
  if (network === "eip155:8453") return "base";
  if (network === "eip155:84532") return "base-sepolia";
  return network;
}

function publicIntegrationSnippets({ baseUrl, price, network, x402Enabled }) {
  const endpoint = `${baseUrl}/api/execute/webhook`;
  const networkFlag = agentCashNetworkFlag(network);
  const networkName = paymentNetworkName(network);
  const powershellBody =
    '{\\"url\\":\\"https://httpbin.org/anything\\",\\"method\\":\\"POST\\",\\"body\\":{\\"event\\":\\"agent.snippet\\"},\\"idempotencyKey\\":\\"agent-snippet-001\\",\\"timeoutMs\\":10000}';

  return {
    ok: true,
    service: "Action402",
    generatedAt: new Date().toISOString(),
    purpose:
      "Copy-paste integration snippets for agents buying one Action402 execution and verifying the returned proof.",
    payment: {
      required: x402Enabled,
      route: endpoint,
      price,
      network,
      networkName,
      scheme: "exact"
    },
    groups: [
      {
        id: "discovery",
        title: "Discovery",
        description: "Find and inspect Action402 before hard-coding the paid route.",
        snippets: [
          {
            id: "cdp-bazaar-search",
            title: "CDP Bazaar search",
            language: "bash",
            code: `npx awal@latest x402 bazaar search "Action402" -k 5 --json\nnpx awal@latest x402 details ${endpoint} --json`
          },
          {
            id: "metadata-fetch",
            title: "Direct metadata fetch",
            language: "bash",
            code: `curl ${baseUrl}/api/quickstart\ncurl ${baseUrl}/api/actions\ncurl ${baseUrl}/api/bazaar`
          }
        ]
      },
      {
        id: "paid-call",
        title: "Paid execution",
        description: "Preflight the payload, then buy one bounded public HTTPS action through x402.",
        snippets: [
          {
            id: "preflight-policy-check",
            title: "Free preflight policy check",
            language: "bash",
            code: `curl ${baseUrl}/api/policy/check \\\n  -H "content-type: application/json" \\\n  -d '{"url":"https://httpbin.org/anything","method":"POST","body":{"event":"agent.preflight"},"idempotencyKey":"preflight-001","timeoutMs":10000}'`
          },
          {
            id: "agentcash-powershell",
            title: "AgentCash from Windows PowerShell",
            language: "powershell",
            code: `npx --% agentcash fetch ${endpoint} -m POST -H "content-type: application/json" -b "${powershellBody}" --payment-protocol x402 --payment-network ${networkFlag} --max-amount 0.01 -y --format json`
          },
          {
            id: "unpaid-402-check",
            title: "Unpaid 402 check",
            language: "bash",
            code: `curl -i ${endpoint} \\\n  -H "content-type: application/json" \\\n  -d '{"url":"https://httpbin.org/anything","method":"POST","body":{"event":"agent.unpaid-check"},"idempotencyKey":"unpaid-check-001"}'`
          }
        ]
      },
      {
        id: "verification",
        title: "Verification",
        description: "Treat the paid action as complete only after proof verification passes.",
        snippets: [
          {
            id: "verify-job-javascript",
            title: "Verify a returned job in JavaScript",
            language: "javascript",
            code: `const result = await paidResponse.json();\nconst verifyResponse = await fetch(\`${baseUrl}/api/verify/jobs/\${result.job.id}\`);\nconst report = await verifyResponse.json();\nif (!report.ok || !report.signatureVerified || report.checks.some((check) => !check.ok)) {\n  throw new Error("Action402 proof verification failed");\n}\nconsole.log(report);`
          },
          {
            id: "verify-job-curl",
            title: "Verify job with curl",
            language: "bash",
            code: `curl ${baseUrl}/api/verify/jobs/job_...\ncurl ${baseUrl}/proof/job_...`
          },
          {
            id: "verify-receipt-curl",
            title: "Verify receipt with curl",
            language: "bash",
            code: `curl ${baseUrl}/api/verify/receipts/rcpt_...\ncurl ${baseUrl}/api/receipts/rcpt_...`
          }
        ]
      },
      {
        id: "advanced-surfaces",
        title: "Advanced agent surfaces",
        description:
          "Use these free endpoints for handoff, schedule design, and secret-handling decisions before building around paid execution.",
        snippets: [
          {
            id: "browser-handoff",
            title: "Create browser handoff package",
            language: "bash",
            code: `curl ${baseUrl}/api/handoff/browser \\\n  -H "content-type: application/json" \\\n  -d '{"targetUrl":"https://example.com","actions":[{"type":"navigate","description":"Open target page"},{"type":"verify","text":"Check visible success state"}],"idempotencyKey":"handoff-001"}'`
          },
          {
            id: "schedule-preview",
            title: "Preview future schedule",
            language: "bash",
            code: `curl ${baseUrl}/api/schedules/preview \\\n  -H "content-type: application/json" \\\n  -d '{"webhook":{"url":"https://httpbin.org/anything","method":"POST","body":{"event":"agent.scheduled-preview"},"idempotencyKey":"schedule-preview-001"},"schedule":{"type":"daily","timeOfDay":"09:30","timezone":"UTC"}}'`
          },
          {
            id: "secret-policy",
            title: "Read secret policy",
            language: "bash",
            code: `curl ${baseUrl}/api/secrets/policy`
          }
        ]
      },
      {
        id: "buyer-policy",
        title: "Buyer policy",
        description: "Guardrails agents should check before spending.",
        snippets: [
          {
            id: "payment-guardrail",
            title: "Expected payment requirement",
            language: "text",
            code: `Expected service: Action402\nExpected route: POST /api/execute/webhook\nExpected price: ${price}\nExpected network: ${networkName}\nReject payment if price, network, or resource URL does not match buyer policy.`
          },
          {
            id: "completion-rule",
            title: "Completion rule",
            language: "text",
            code: "Mark the action complete only when the paid response is success/accepted and the verification report returns ok=true with signatureVerified=true."
          }
        ]
      }
    ],
    links: {
      quickstart: `${baseUrl}/api/quickstart`,
      policyCheck: `${baseUrl}/api/policy/check`,
      handoff: `${baseUrl}/api/handoff/capabilities`,
      schedulePreview: `${baseUrl}/api/schedules/preview`,
      secretPolicy: `${baseUrl}/api/secrets/policy`,
      actions: `${baseUrl}/api/actions`,
      capabilities: `${baseUrl}/api/capabilities`,
      bazaar: `${baseUrl}/api/bazaar`,
      openapi: `${baseUrl}/openapi.json`,
      snippetsPage: `${baseUrl}/snippets`,
      proofBadge: `${baseUrl}/proof/{jobOrReceiptId}`
    }
  };
}

export { publicIntegrationSnippets };
