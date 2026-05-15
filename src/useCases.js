const USE_CASE_TEMPLATES = [
  {
    id: "chatops-webhook-notification",
    title: "ChatOps webhook notification",
    description:
      "Send a paid, verifiable notification to Slack, Discord, Telegram bridge services, or another chat webhook after an agent finishes a task.",
    tags: ["slack-webhook", "discord-webhook", "telegram-alert", "chatops", "agent-notification"],
    searchPhrases: [
      "send paid Slack webhook",
      "agent Discord webhook notification",
      "verifiable ChatOps alert"
    ],
    request: {
      url: "https://hooks.slack.com/services/WORKSPACE/CHANNEL/SECRET",
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: {
        text: "Agent task completed.",
        source: "action402-agent"
      },
      idempotencyKey: "chatops-alert-001",
      retry: {
        attempts: 2,
        backoffMs: 300
      },
      timeoutMs: 10000
    }
  },
  {
    id: "zapier-make-workflow-trigger",
    title: "Zapier or Make workflow trigger",
    description:
      "Let an agent pay once to trigger a no-code automation webhook without sharing long-lived API keys.",
    tags: ["zapier-webhook", "make-webhook", "automation-trigger", "no-code"],
    searchPhrases: [
      "trigger Zapier webhook with x402",
      "paid Make automation webhook",
      "agent no-code workflow trigger"
    ],
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
    }
  },
  {
    id: "github-repository-dispatch",
    title: "GitHub repository dispatch",
    description:
      "Trigger a GitHub Actions workflow through a repository dispatch endpoint and keep a receipt that the request was attempted.",
    tags: ["github-actions", "repository-dispatch", "ci-trigger", "developer-automation"],
    searchPhrases: [
      "paid GitHub Actions dispatch",
      "agent CI workflow trigger",
      "repository dispatch with receipt"
    ],
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
          job: "refresh-index"
        }
      },
      idempotencyKey: "github-dispatch-001",
      retry: {
        attempts: 2,
        backoffMs: 500
      },
      timeoutMs: 10000
    }
  },
  {
    id: "analytics-event-ingest",
    title: "Analytics event ingest",
    description:
      "Send a signed, paid event to Segment, PostHog, internal analytics collectors, or audit pipelines.",
    tags: ["analytics", "event-ingest", "audit-event", "segment", "posthog"],
    searchPhrases: [
      "paid analytics event ingest",
      "agent audit event webhook",
      "verifiable event tracking"
    ],
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
    }
  },
  {
    id: "crm-lead-or-ticket-update",
    title: "CRM lead or ticket update",
    description:
      "Update a CRM, support ticket, or customer success workflow through a public HTTPS webhook with a proof receipt.",
    tags: ["crm", "support-ticket", "hubspot", "salesforce", "customer-success"],
    searchPhrases: [
      "agent CRM webhook update",
      "paid support ticket webhook",
      "verifiable customer workflow action"
    ],
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
    }
  },
  {
    id: "incident-or-ops-alert",
    title: "Incident or ops alert",
    description:
      "Escalate an agent-detected issue to an incident webhook, ops bridge, or alert manager and keep a verifiable execution trail.",
    tags: ["incident-alert", "ops-webhook", "pager-duty", "alertmanager", "reliability"],
    searchPhrases: [
      "paid incident alert webhook",
      "agent ops escalation",
      "verifiable alert manager trigger"
    ],
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
    }
  }
];

const USE_CASE_KEYWORDS = Array.from(
  new Set(
    USE_CASE_TEMPLATES.flatMap((template) => [
      template.title,
      ...template.tags,
      ...template.searchPhrases
    ])
  )
);

function publicUseCaseTemplates() {
  return USE_CASE_TEMPLATES.map((template) => ({
    id: template.id,
    title: template.title,
    description: template.description,
    tags: template.tags,
    searchPhrases: template.searchPhrases,
    exampleRequest: template.request
  }));
}

export { USE_CASE_KEYWORDS, USE_CASE_TEMPLATES, publicUseCaseTemplates };
