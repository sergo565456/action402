const elements = {
  mode: document.querySelector("#mode-value"),
  network: document.querySelector("#network-value"),
  store: document.querySelector("#store-value"),
  rate: document.querySelector("#rate-value"),
  resultTitle: document.querySelector("#result-title"),
  resultOutput: document.querySelector("#result-output"),
  lastJob: document.querySelector("#last-job"),
  lastReceipt: document.querySelector("#last-receipt"),
  lastVerified: document.querySelector("#last-verified"),
  refreshButton: document.querySelector("#refresh-button"),
  executeButton: document.querySelector("#execute-button"),
  safetyButton: document.querySelector("#safety-button")
};

function pretty(value) {
  return JSON.stringify(value, null, 2);
}

function setOutput(title, value) {
  elements.resultTitle.textContent = title;
  elements.resultOutput.textContent = typeof value === "string" ? value : pretty(value);
}

function setBusy(isBusy) {
  elements.refreshButton.disabled = isBusy;
  elements.executeButton.disabled = isBusy;
  elements.safetyButton.disabled = isBusy;
}

async function fetchJson(path, options) {
  const response = await fetch(path, options);
  const text = await response.text();
  let body;

  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }

  return body;
}

async function refreshState() {
  setBusy(true);
  try {
    const [health, capabilities] = await Promise.all([
      fetchJson("/health"),
      fetchJson("/api/capabilities")
    ]);

    elements.mode.textContent = health.x402Enabled ? "x402" : "demo";
    elements.network.textContent = health.network;
    elements.store.textContent = health.store?.durable
      ? `${health.store.jobs} jobs / ${health.store.receipts} receipts`
      : "memory";
    elements.rate.textContent = health.rateLimit?.enabled
      ? `${health.rateLimit.maxRequests}/${Math.round(health.rateLimit.windowMs / 1000)}s`
      : "off";

    setOutput("Service state", {
      health,
      action: capabilities.actions?.[0],
      safety: capabilities.safety
    });
  } catch (error) {
    setOutput("Refresh failed", error.body || error.message);
  } finally {
    setBusy(false);
  }
}

async function runDemoWebhook() {
  setBusy(true);
  try {
    const request = {
      url: "https://httpbin.org/anything",
      method: "POST",
      body: {
        event: "action402.demo",
        source: "demo-page",
        createdAt: new Date().toISOString()
      },
      idempotencyKey: `demo-page-${Date.now()}`,
      retry: {
        attempts: 2,
        backoffMs: 300
      }
    };

    const execution = await fetchJson("/api/execute/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(request)
    });

    const [job, receipt] = await Promise.all([
      fetchJson(execution.links.job),
      fetchJson(execution.links.receipt)
    ]);
    const verification = await fetchJson(`/api/verify/jobs/${job.id}`);

    elements.lastJob.textContent = job.id;
    elements.lastReceipt.textContent = receipt.id;
    elements.lastVerified.textContent = verification.ok ? "ok" : "failed";

    setOutput("Webhook executed", {
      request,
      execution,
      job,
      receipt,
      verification
    });

    await refreshSummaryOnly();
  } catch (error) {
    setOutput("Execution failed", error.body || error.message);
  } finally {
    setBusy(false);
  }
}

async function refreshSummaryOnly() {
  const health = await fetchJson("/health");
  elements.mode.textContent = health.x402Enabled ? "x402" : "demo";
  elements.network.textContent = health.network;
  elements.store.textContent = health.store?.durable
    ? `${health.store.jobs} jobs / ${health.store.receipts} receipts`
    : "memory";
  elements.rate.textContent = health.rateLimit?.enabled
    ? `${health.rateLimit.maxRequests}/${Math.round(health.rateLimit.windowMs / 1000)}s`
    : "off";
}

async function runSafetyCheck() {
  setBusy(true);
  try {
    await fetchJson("/api/execute/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        url: "https://127.0.0.1/internal",
        method: "POST"
      })
    });

    setOutput("Safety check", "Unexpected success");
  } catch (error) {
    setOutput("Safety check blocked", {
      status: error.status,
      body: error.body
    });
  } finally {
    setBusy(false);
  }
}

elements.refreshButton.addEventListener("click", refreshState);
elements.executeButton.addEventListener("click", runDemoWebhook);
elements.safetyButton.addEventListener("click", runSafetyCheck);

refreshState();
