import { config } from "./config.js";
import { ApiError } from "./errors.js";
import { createId } from "./receipt.js";
import { preflightWebhookAction, validateTarget } from "./webhook.js";

const HANDOFF_ACTION_TYPES = new Set([
  "instruction",
  "navigate",
  "click",
  "type",
  "select",
  "submit",
  "wait_for_text",
  "screenshot",
  "extract",
  "verify"
]);

const SCHEDULE_TYPES = new Set(["once", "daily"]);
const MAX_HANDOFF_ACTIONS = 12;

function assertObject(value, code, message) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError(400, code, message);
  }
}

function optionalString(value, maxLength, fieldName) {
  if (value === undefined || value === null || value === "") return undefined;
  const normalized = String(value);
  if (normalized.length > maxLength) {
    throw new ApiError(400, "invalid_field", `${fieldName} must be ${maxLength} characters or fewer.`);
  }
  return normalized;
}

function normalizeHandoffActions(actions) {
  if (!Array.isArray(actions) || actions.length === 0) {
    throw new ApiError(400, "invalid_handoff_actions", "actions must be a non-empty array.");
  }

  if (actions.length > MAX_HANDOFF_ACTIONS) {
    throw new ApiError(400, "invalid_handoff_actions", `actions must contain ${MAX_HANDOFF_ACTIONS} items or fewer.`);
  }

  return actions.map((action, index) => {
    assertObject(action, "invalid_handoff_action", "each handoff action must be an object.");

    const type = String(action.type || "instruction").toLowerCase();
    if (!HANDOFF_ACTION_TYPES.has(type)) {
      throw new ApiError(400, "invalid_handoff_action_type", `unsupported action type: ${type}.`);
    }

    const timeoutMs =
      action.timeoutMs === undefined
        ? undefined
        : Math.max(1000, Math.min(Number(action.timeoutMs), config.maxWebhookTimeoutMs));

    return {
      step: index + 1,
      type,
      selector: optionalString(action.selector, 500, "selector"),
      text: optionalString(action.text, 2000, "text"),
      value: optionalString(action.value, 2000, "value"),
      description: optionalString(action.description, 2000, "description"),
      ...(timeoutMs === undefined ? {} : { timeoutMs })
    };
  });
}

function normalizeWebhookInput(input) {
  if (input.webhook !== undefined) {
    assertObject(input.webhook, "invalid_webhook", "webhook must be an object.");
    return input.webhook;
  }

  return {
    url: input.url,
    method: input.method,
    headers: input.headers,
    body: input.body,
    idempotencyKey: input.idempotencyKey,
    retry: input.retry,
    timeoutMs: input.timeoutMs
  };
}

function normalizeSchedule(input) {
  assertObject(input, "invalid_schedule", "schedule must be an object.");

  const type = String(input.type || "once").toLowerCase();
  if (!SCHEDULE_TYPES.has(type)) {
    throw new ApiError(400, "invalid_schedule_type", "schedule.type must be one of once, daily.");
  }

  const warnings = [];

  if (type === "once") {
    const runAt = optionalString(input.runAt, 80, "schedule.runAt");
    if (!runAt) {
      throw new ApiError(400, "invalid_schedule", "schedule.runAt is required for once schedules.");
    }

    const timestamp = Date.parse(runAt);
    if (!Number.isFinite(timestamp)) {
      throw new ApiError(400, "invalid_schedule", "schedule.runAt must be a valid ISO timestamp.");
    }

    if (timestamp <= Date.now()) {
      warnings.push("schedule.runAt is in the past; future paid scheduling would reject or normalize it.");
    }

    return {
      schedule: {
        type,
        runAt: new Date(timestamp).toISOString(),
        timezone: "UTC"
      },
      warnings
    };
  }

  const timeOfDay = optionalString(input.timeOfDay, 5, "schedule.timeOfDay");
  if (!timeOfDay || !/^\d{2}:\d{2}$/.test(timeOfDay)) {
    throw new ApiError(400, "invalid_schedule", "schedule.timeOfDay must use HH:MM for daily schedules.");
  }

  const [hour, minute] = timeOfDay.split(":").map(Number);
  if (hour > 23 || minute > 59) {
    throw new ApiError(400, "invalid_schedule", "schedule.timeOfDay must be a valid 24-hour time.");
  }

  return {
    schedule: {
      type,
      timeOfDay,
      timezone: optionalString(input.timezone, 80, "schedule.timezone") || "UTC"
    },
    warnings
  };
}

export function publicHandoffCapabilities({ baseUrl = config.publicBaseUrl } = {}) {
  return {
    status: "active-handoff-only",
    method: "POST",
    path: "/api/handoff/browser",
    paid: false,
    description:
      "Create a browser-agent handoff package for an external browser-capable agent. Action402 does not execute browser steps itself.",
    executionModel: "handoff-only",
    supportedActionTypes: Array.from(HANDOFF_ACTION_TYPES).sort(),
    maxActions: MAX_HANDOFF_ACTIONS,
    persistence: "not stored in the public MVP",
    links: {
      page: `${baseUrl}/handoff`,
      endpoint: `${baseUrl}/api/handoff/browser`,
      policyCheck: `${baseUrl}/api/policy/check`,
      snippets: `${baseUrl}/api/snippets`
    }
  };
}

export function publicScheduleCapabilities({ baseUrl = config.publicBaseUrl } = {}) {
  return {
    status: "preview-only",
    activePaidEndpoint: false,
    previewMethod: "POST",
    previewPath: "/api/schedules/preview",
    futurePaidPath: "/api/schedules/webhook",
    paid: false,
    description:
      "Validate a future schedule definition and target policy without charging or executing. Durable paid scheduling is intentionally not active yet.",
    supportedScheduleTypes: Array.from(SCHEDULE_TYPES).sort(),
    chargeModel:
      "Future paid scheduling should charge each executed run through /api/execute/webhook semantics, not charge schedule definitions.",
    links: {
      page: `${baseUrl}/schedules`,
      preview: `${baseUrl}/api/schedules/preview`,
      immediateExecution: `${baseUrl}/api/execute/webhook`,
      quickstart: `${baseUrl}/api/quickstart`
    }
  };
}

export function publicSecretStoragePolicy({ baseUrl = config.publicBaseUrl } = {}) {
  return {
    status: "not-supported-in-public-mvp",
    activeStorageEndpoint: false,
    paid: false,
    description:
      "Action402 public MVP does not store target-side secrets. Agents should use target-owned webhooks, short-lived per-request headers, or partner deployments.",
    why:
      "Universal paid execution is accountless. Storing long-lived third-party credentials would require authentication, ownership checks, encryption lifecycle, rotation, and abuse controls.",
    safeAlternatives: [
      "Use target-owned webhook URLs where the secret stays on the target side.",
      "Send short-lived target authorization headers only inside the paid request when the caller owns them.",
      "Use /api/policy/check before payment to validate target safety without revealing long-lived credentials.",
      "For private partner use, deploy a dedicated allowlisted Action402 instance with a managed secret vault."
    ],
    neverSend: [
      "wallet private keys",
      "seed phrases",
      "long-lived admin tokens",
      "database URLs",
      "unscoped production credentials"
    ],
    futureShape: {
      method: "POST",
      path: "/api/secrets",
      status: "requires account/auth design before activation"
    },
    links: {
      page: `${baseUrl}/secrets`,
      policy: `${baseUrl}/api/secrets/policy`,
      policyCheck: `${baseUrl}/api/policy/check`,
      onboarding: `${baseUrl}/onboarding`
    }
  };
}

export async function createBrowserHandoff(input) {
  assertObject(input, "invalid_request", "request body must be a JSON object.");

  const targetUrl = input.targetUrl || input.url;
  const target = await validateTarget(targetUrl);
  const actions = normalizeHandoffActions(input.actions);
  const returnUrl = input.returnUrl ? await validateTarget(input.returnUrl) : undefined;
  const idempotencyKey = optionalString(input.idempotencyKey, 160, "idempotencyKey");
  const createdAt = new Date();

  return {
    ok: true,
    service: "Action402",
    generatedAt: createdAt.toISOString(),
    handoff: {
      id: createId("handoff"),
      status: "ready_for_external_browser_agent",
      executionModel: "browser-handoff-only",
      paid: false,
      notExecutedByAction402: true,
      persistence: "not stored",
      createdAt: createdAt.toISOString(),
      expiresAt: new Date(createdAt.getTime() + 60 * 60 * 1000).toISOString(),
      target: {
        url: target.toString(),
        origin: target.origin,
        hostname: target.hostname,
        pathname: target.pathname || "/"
      },
      actions,
      returnUrl: returnUrl?.toString() || null,
      idempotencyKey: idempotencyKey || null
    },
    policy: {
      privateNetworkTargetsBlocked: true,
      targetPolicyPreset: config.targetPolicyPreset,
      handoffDoesNotBypassPaidExecution: true
    },
    warnings: [
      "Action402 created a handoff package only; another browser-capable agent must execute the browser steps.",
      "Use /api/execute/webhook for paid machine-to-machine side effects that need a signed execution receipt."
    ],
    next: {
      paidExecution: "/api/execute/webhook",
      policyCheck: "/api/policy/check",
      capabilities: "/api/capabilities",
      snippets: "/api/snippets"
    }
  };
}

export async function createSchedulePreview(input) {
  assertObject(input, "invalid_request", "request body must be a JSON object.");

  const webhook = normalizeWebhookInput(input);
  const preflight = await preflightWebhookAction(webhook);
  const { schedule, warnings } = normalizeSchedule(input.schedule || {});
  const createdAt = new Date().toISOString();

  return {
    ok: true,
    allowed: true,
    service: "Action402",
    generatedAt: createdAt,
    status: "preview-only",
    paid: false,
    willExecute: false,
    preview: {
      id: createId("schedule_preview"),
      createdAt,
      schedule,
      webhook: preflight.normalized,
      target: preflight.target
    },
    paymentPolicy: {
      previewCharged: false,
      futurePaidSchedulingActive: false,
      recommendedChargeModel:
        "Charge each due run only when it executes through the paid /api/execute/webhook primitive."
    },
    warnings: [
      ...warnings,
      "This endpoint validates a schedule shape only. It does not persist, wake up, execute, or charge."
    ],
    next: {
      immediatePaidExecution: "/api/execute/webhook",
      schedulesPage: "/schedules",
      quickstart: "/api/quickstart",
      capabilities: "/api/capabilities"
    }
  };
}
