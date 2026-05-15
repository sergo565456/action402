const ACTION_TEMPLATES = [
  {
    id: "chatops.slack_message",
    status: "ready",
    category: "chatops",
    title: "Slack webhook message",
    description:
      "Send a paid, verifiable Slack incoming-webhook message after an agent completes a task or detects a condition.",
    tags: ["slack", "chatops", "agent-notification", "webhook"],
    searchPhrases: ["Slack webhook x402", "paid Slack notification", "agent ChatOps receipt"],
    request: {
      url: "https://hooks.slack.com/services/WORKSPACE/CHANNEL/SECRET",
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: {
        text: "Action402 proof-backed agent notification."
      },
      idempotencyKey: "slack-message-001",
      retry: {
        attempts: 2,
        backoffMs: 300
      },
      timeoutMs: 10000
    },
    buyerValue:
      "The buyer pays only when an agent needs to send a real message, then gets a receipt proving the relay attempted it.",
    targetOwnerValue:
      "The Slack-side owner keeps the webhook secret inside the target workflow and does not need to expose a new account system.",
    verification: ["Verify the returned job link.", "Store the receipt id with the Slack thread or task record."]
  },
  {
    id: "chatops.discord_message",
    status: "ready",
    category: "chatops",
    title: "Discord webhook message",
    description:
      "Post a paid status update into a Discord channel through a public webhook and keep a receipt for the action.",
    tags: ["discord", "chatops", "community", "webhook"],
    searchPhrases: ["Discord webhook x402", "paid Discord agent message", "verifiable community alert"],
    request: {
      url: "https://discord.com/api/webhooks/WEBHOOK_ID/WEBHOOK_TOKEN",
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: {
        content: "Action402 agent event completed."
      },
      idempotencyKey: "discord-message-001",
      retry: {
        attempts: 2,
        backoffMs: 300
      },
      timeoutMs: 10000
    },
    buyerValue: "Useful for agents that need to notify communities or operator channels without a custom integration.",
    targetOwnerValue: "Discord webhook permissions remain managed by the channel owner.",
    verification: ["Verify the returned receipt.", "Use idempotencyKey to avoid duplicate channel messages."]
  },
  {
    id: "chatops.telegram_send_message",
    status: "ready",
    category: "chatops",
    title: "Telegram bot sendMessage",
    description:
      "Call Telegram Bot API sendMessage through a paid relay when an agent needs a simple operator notification.",
    tags: ["telegram", "bot-api", "operator-alert", "webhook"],
    searchPhrases: ["Telegram bot x402", "paid Telegram alert", "agent operator notification"],
    request: {
      url: "https://api.telegram.org/botBOT_TOKEN/sendMessage",
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: {
        chat_id: "CHAT_ID",
        text: "Action402 agent alert."
      },
      idempotencyKey: "telegram-message-001",
      retry: {
        attempts: 2,
        backoffMs: 300
      },
      timeoutMs: 10000
    },
    buyerValue: "Good for low-friction paid status pings from autonomous workers.",
    targetOwnerValue: "The bot owner can rotate Bot API tokens independently from Action402.",
    verification: ["Verify the job receipt before marking the alert delivered."]
  },
  {
    id: "automation.zapier_catch_hook",
    status: "ready",
    category: "automation",
    title: "Zapier catch hook",
    description:
      "Trigger a Zapier workflow from an agent with a per-action x402 payment and a receipt for the trigger attempt.",
    tags: ["zapier", "automation", "no-code", "workflow"],
    searchPhrases: ["Zapier webhook x402", "paid Zapier trigger", "agent no-code automation"],
    request: {
      url: "https://hooks.zapier.com/hooks/catch/ACCOUNT/HOOK",
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: {
        event: "agent.workflow.triggered",
        recordId: "rec_123"
      },
      idempotencyKey: "zapier-trigger-001",
      retry: {
        attempts: 2,
        backoffMs: 500
      },
      timeoutMs: 10000
    },
    buyerValue: "Agents can activate no-code workflows without creating a SaaS account with the workflow owner.",
    targetOwnerValue: "The workflow owner keeps the Zapier catch hook as the only integration surface.",
    verification: ["Save receipt id into the Zapier task payload when possible."]
  },
  {
    id: "automation.make_webhook",
    status: "ready",
    category: "automation",
    title: "Make custom webhook",
    description:
      "Trigger a Make scenario through a paid public webhook and expose proof links back to the buying agent.",
    tags: ["make", "automation", "scenario", "workflow"],
    searchPhrases: ["Make webhook x402", "paid Make scenario", "agent workflow trigger"],
    request: {
      url: "https://hook.us1.make.com/SCENARIO_WEBHOOK_ID",
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: {
        event: "agent.scenario.triggered"
      },
      idempotencyKey: "make-scenario-001",
      retry: {
        attempts: 2,
        backoffMs: 500
      },
      timeoutMs: 10000
    },
    buyerValue: "A buyer can pay for one automation trigger instead of handling Make auth directly.",
    targetOwnerValue: "Make scenario routing and permissions stay under the scenario owner's control.",
    verification: ["Verify the receipt and reconcile it with the Make scenario run."]
  },
  {
    id: "dev.github_repository_dispatch",
    status: "ready",
    category: "developer-tools",
    title: "GitHub repository dispatch",
    description:
      "Let an agent pay to trigger a GitHub repository_dispatch event and keep a receipt for the CI/action handoff.",
    tags: ["github", "repository-dispatch", "ci", "developer-automation"],
    searchPhrases: ["GitHub Actions dispatch x402", "paid CI trigger", "repository dispatch receipt"],
    request: {
      url: "https://api.github.com/repos/OWNER/REPO/dispatches",
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer TARGET_SIDE_TOKEN"
      },
      body: {
        event_type: "agent.action402",
        client_payload: {
          task: "refresh-index"
        }
      },
      idempotencyKey: "github-dispatch-001",
      retry: {
        attempts: 2,
        backoffMs: 500
      },
      timeoutMs: 10000
    },
    buyerValue: "Useful when an agent needs to hand work to a repo workflow and prove the trigger was sent.",
    targetOwnerValue: "Repo token scope remains a target-side policy decision.",
    verification: ["Verify the receipt.", "Match idempotencyKey to client_payload when auditing."]
  },
  {
    id: "ops.incident_alert",
    status: "ready",
    category: "ops",
    title: "Incident or ops alert",
    description:
      "Escalate an agent-detected problem to an incident webhook, alert bridge, or on-call automation.",
    tags: ["incident", "ops", "alertmanager", "pagerduty", "reliability"],
    searchPhrases: ["paid incident alert webhook", "agent ops escalation", "verifiable alert trigger"],
    request: {
      url: "https://alerts.example.com/incidents",
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: {
        event: "agent.incident.detected",
        severity: "warning",
        summary: "Agent found a failing downstream check."
      },
      idempotencyKey: "incident-alert-001",
      retry: {
        attempts: 3,
        backoffMs: 750
      },
      timeoutMs: 12000
    },
    buyerValue: "Agents can pay for escalation only when a concrete incident action is needed.",
    targetOwnerValue: "Ops teams can require public webhook policy and use receipts for audit trails.",
    verification: ["Verify the job report.", "Use failure categories from monitoring for triage."]
  },
  {
    id: "data.analytics_event",
    status: "ready",
    category: "data",
    title: "Analytics or audit event",
    description:
      "Send a paid event into an analytics, audit, or data ingestion endpoint with request and response hashes in the receipt.",
    tags: ["analytics", "audit", "event-ingest", "posthog", "segment"],
    searchPhrases: ["paid analytics event ingest", "agent audit event", "verifiable event tracking"],
    request: {
      url: "https://analytics.example.com/events",
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: {
        event: "agent.action.executed",
        properties: {
          action: "webhook",
          billable: true
        }
      },
      idempotencyKey: "analytics-event-001",
      retry: {
        attempts: 2,
        backoffMs: 300
      },
      timeoutMs: 10000
    },
    buyerValue: "The agent can leave a paid audit trail without direct access to the analytics account.",
    targetOwnerValue: "Data owners can validate paid ingestion volume with Action402 receipts.",
    verification: ["Verify response status and receipt signature.", "Do not put sensitive raw payload in public proof pages."]
  },
  {
    id: "crm.ticket_or_lead_update",
    status: "ready",
    category: "business-workflows",
    title: "CRM, lead, or ticket update",
    description:
      "Update a CRM, support ticket, or customer workflow through a public HTTPS webhook with proof of execution.",
    tags: ["crm", "support", "hubspot", "salesforce", "ticketing"],
    searchPhrases: ["agent CRM webhook update", "paid support ticket webhook", "verifiable CRM action"],
    request: {
      url: "https://crm.example.com/webhooks/action402",
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: {
        event: "agent.crm.update",
        leadId: "lead_123",
        status: "ready_for_review"
      },
      idempotencyKey: "crm-update-001",
      retry: {
        attempts: 2,
        backoffMs: 500
      },
      timeoutMs: 10000
    },
    buyerValue: "Agents can pay for a single business workflow update without permanent credentials.",
    targetOwnerValue: "The business system can keep webhook auth and validation on its side.",
    verification: ["Verify the receipt.", "Persist job id in the CRM note or activity log."]
  }
];

const POLICY_MODES = [
  {
    id: "open-public-https",
    status: "active",
    title: "Open public HTTPS relay",
    description:
      "Any public HTTPS target can be called, while localhost and private network targets remain blocked.",
    bestFor: "Bazaar-first discovery where unknown agents need broad utility."
  },
  {
    id: "blocklist-quota",
    status: "active",
    title: "Blocklist plus target quota",
    description:
      "Keep broad access, block known bad target hosts, and throttle repeat traffic to the same target.",
    bestFor: "Public MVP operation without losing the universal webhook value proposition."
  },
  {
    id: "allowlist",
    status: "supported",
    title: "Allowlist-only mode",
    description:
      "Restrict execution to approved target hosts. This is safer for private partner deployments but weaker for open Bazaar utility.",
    bestFor: "Dedicated customers or partner integrations."
  }
];

const SCHEDULED_ACTION_PATTERN = {
  id: "scheduled.webhook",
  status: "design-ready",
  category: "scheduling",
  title: "Scheduled paid webhook action",
  description:
    "A durable scheduler pattern for agents that want to pay for delayed or recurring webhook execution.",
  availability:
    "Not active as a paid endpoint yet. The current production endpoint executes one immediate bounded action.",
  whyNotImmediate:
    "Scheduling needs durable queue semantics and replay-safe payment policy. Exposing it before that would confuse agents and weaken proof quality.",
  compatiblePath: [
    "Keep POST /api/execute/webhook as the immediate execution primitive.",
    "Add a durable schedule store and worker.",
    "Charge once per executed run, not once per schedule definition.",
    "Return schedule id plus per-run job and receipt links."
  ],
  futureShape: {
    method: "POST",
    path: "/api/schedules/webhook",
    paid: true,
    request: {
      url: "https://example.com/webhook",
      method: "POST",
      body: {
        event: "agent.scheduled"
      },
      schedule: {
        type: "once",
        runAt: "2026-05-16T12:00:00.000Z"
      },
      idempotencyKey: "scheduled-webhook-001"
    }
  }
};

function uniqueSorted(values) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function publicActionTemplates() {
  return ACTION_TEMPLATES.map((template) => ({
    id: template.id,
    status: template.status,
    category: template.category,
    title: template.title,
    description: template.description,
    tags: template.tags,
    searchPhrases: template.searchPhrases,
    actionId: "execute.webhook",
    paidRoute: "/api/execute/webhook",
    exampleRequest: template.request,
    buyerValue: template.buyerValue,
    targetOwnerValue: template.targetOwnerValue,
    verification: template.verification
  }));
}

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

function buyerSnippets({ baseUrl, price, network }) {
  const endpoint = `${baseUrl}/api/execute/webhook`;
  const body =
    '{"url":"https://httpbin.org/anything","method":"POST","body":{"event":"agent.quickstart"},"idempotencyKey":"agent-quickstart-001","timeoutMs":10000}';
  const networkFlag = agentCashNetworkFlag(network);
  const networkName = paymentNetworkName(network);

  return [
    {
      id: "agentcash-cli",
      title: "AgentCash CLI",
      language: "powershell",
      description: "Fastest local paid smoke test for an agent-controlled wallet.",
      code: `npx --% agentcash fetch ${endpoint} -m POST -H "content-type: application/json" -b "${body.replaceAll('"', '\\"')}" --payment-protocol x402 --payment-network ${networkFlag} --max-amount 0.01 -y --format json`
    },
    {
      id: "plain-discovery",
      title: "Discovery first",
      language: "bash",
      description: "Use Bazaar/CDP discovery before hard-coding the endpoint.",
      code: `npx awal@latest x402 bazaar search "Action402" -k 5 --json\nnpx awal@latest x402 details ${endpoint} --json`
    },
    {
      id: "verify-after-call",
      title: "Verify after call",
      language: "bash",
      description: "Treat the action as complete only after verifying the returned job or receipt.",
      code: `curl ${baseUrl}/api/verify/jobs/job_...\ncurl ${baseUrl}/api/verify/receipts/rcpt_...`
    },
    {
      id: "price-guardrail",
      title: "Buyer budget guardrail",
      language: "text",
      description: "Agents should reject unexpected payment requirements before retrying with payment.",
      code: `Expected price: ${price}\nExpected route: POST /api/execute/webhook\nExpected network: ${networkName}`
    }
  ];
}

function publicActionCatalog({ baseUrl, price, x402Enabled, network, targetPolicyPreset }) {
  const templates = publicActionTemplates();
  const categories = uniqueSorted(templates.map((template) => template.category));
  const discoveryKeywords = uniqueSorted(
    templates.flatMap((template) => [template.title, template.category, ...template.tags, ...template.searchPhrases])
  );

  return {
    ok: true,
    service: "Action402",
    generatedAt: new Date().toISOString(),
    description:
      "Machine-readable catalog of paid action patterns that can be executed through the Action402 webhook relay.",
    activePrimitive: {
      id: "execute.webhook",
      method: "POST",
      path: "/api/execute/webhook",
      paid: x402Enabled,
      price,
      network,
      targetPolicyPreset,
      executionModel: "immediate one-shot public HTTPS action",
      proofModel: "signed receipt plus job/receipt verification endpoints"
    },
    categories,
    templates,
    policyModes: POLICY_MODES,
    scheduledActions: SCHEDULED_ACTION_PATTERN,
    snippets: buyerSnippets({ baseUrl, price, network }),
    discoveryKeywords,
    links: {
      quickstart: `${baseUrl}/api/quickstart`,
      capabilities: `${baseUrl}/api/capabilities`,
      bazaar: `${baseUrl}/api/bazaar`,
      openapi: `${baseUrl}/openapi.json`,
      actionsPage: `${baseUrl}/actions`,
      agentsGuide: `${baseUrl}/agents`,
      trust: `${baseUrl}/api/trust`,
      recentProofs: `${baseUrl}/api/proofs/recent`
    }
  };
}

function publicQuickstart({ baseUrl, price, x402Enabled, network, maxRetryAttempts, maxWebhookTimeoutMs }) {
  const endpoint = `${baseUrl}/api/execute/webhook`;

  return {
    ok: true,
    service: "Action402",
    generatedAt: new Date().toISOString(),
    purpose:
      "Execute one paid public HTTPS webhook/API action for an autonomous agent, then verify the signed proof receipt.",
    recommendedUse:
      "Use Action402 when you need one bounded side effect, not a multi-step workflow or private-network call.",
    payment: {
      required: x402Enabled,
      scheme: "exact",
      network,
      price,
      route: endpoint
    },
    minimalRequest: {
      url: "https://httpbin.org/anything",
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: {
        event: "agent.quickstart"
      },
      idempotencyKey: "agent-quickstart-001",
      retry: {
        attempts: Math.min(2, maxRetryAttempts),
        backoffMs: 300
      },
      timeoutMs: Math.min(10000, maxWebhookTimeoutMs)
    },
    callFlow: [
      "Read /api/quickstart, /api/actions, or /api/capabilities.",
      "Prepare POST /api/execute/webhook with url, method, body, idempotencyKey, retry, and timeoutMs.",
      "Optionally POST the same JSON to /api/policy/check to catch rejected targets before paying.",
      "If the first response is 402, verify price/network/payTo against buyer policy.",
      "Pay through an x402 buyer client and retry with the payment header.",
      "Read links.job or links.receipt from the response.",
      "Verify /api/verify/jobs/{id} or /api/verify/receipts/{id}.",
      "Store the receipt id with the caller's task record."
    ],
    decisionRules: {
      useWhen: [
        "The agent needs a public HTTPS side effect.",
        "The caller wants pay-per-action instead of an account.",
        "The caller needs proof of execution attempt and outcome."
      ],
      avoidWhen: [
        "The target is localhost, private network, or non-HTTP.",
        "The job needs multi-step orchestration.",
        "The caller cannot tolerate the configured price.",
        "The target webhook cannot safely receive duplicate attempts without idempotency."
      ]
    },
    limits: {
      allowedMethods: ["POST", "PUT", "PATCH", "DELETE"],
      maxRetryAttempts,
      maxWebhookTimeoutMs,
      privateNetworkTargetsBlocked: true
    },
    snippets: buyerSnippets({ baseUrl, price, network }),
    verify: {
      job: `${baseUrl}/api/verify/jobs/{id}`,
      receipt: `${baseUrl}/api/verify/receipts/{id}`,
      publicProofs: `${baseUrl}/api/proofs/recent`,
      proofBadge: `${baseUrl}/proof/{jobOrReceiptId}`
    },
    nextDiscoverySteps: [
      `${baseUrl}/api/actions`,
      `${baseUrl}/api/policy/check`,
      `${baseUrl}/api/capabilities`,
      `${baseUrl}/api/bazaar`,
      `${baseUrl}/openapi.json`,
      `${baseUrl}/llms.txt`
    ]
  };
}

export {
  ACTION_TEMPLATES,
  POLICY_MODES,
  SCHEDULED_ACTION_PATTERN,
  publicActionCatalog,
  publicActionTemplates,
  publicQuickstart
};
