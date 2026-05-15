const metricGrid = document.querySelector("#metric-grid");
const monitoringSummary = document.querySelector("#monitoring-summary");
const failureList = document.querySelector("#failure-list");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0%";
  return `${(number * 100).toFixed(1)}%`;
}

function formatDate(value) {
  if (!value) return "n/a";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function shortId(value) {
  if (!value) return "n/a";
  return value.length > 18 ? `${value.slice(0, 10)}...${value.slice(-6)}` : value;
}

function renderMetric(label, value, note) {
  return `
    <article class="metric-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(note)}</small>
    </article>
  `;
}

function renderFailure(failure) {
  return `
    <article class="proof-card">
      <span>${escapeHtml(failure.errorCategory || "failed")}</span>
      <h3>${escapeHtml(failure.jobId)}</h3>
      <dl class="proof-meta">
        <div>
          <dt>method</dt>
          <dd>${escapeHtml(failure.method)}</dd>
        </div>
        <div>
          <dt>attempts</dt>
          <dd>${escapeHtml(failure.attempts)}</dd>
        </div>
        <div>
          <dt>response</dt>
          <dd>${escapeHtml(failure.responseStatus ?? "n/a")}</dd>
        </div>
        <div>
          <dt>receipt</dt>
          <dd>${escapeHtml(shortId(failure.receiptId))}</dd>
        </div>
      </dl>
      <small>Updated ${escapeHtml(formatDate(failure.updatedAt))}. Details are redacted for public monitoring.</small>
      <div class="actions">
        <a class="button secondary" href="${escapeHtml(failure.links?.verifyJob || "#")}">Verify</a>
        <a class="button secondary" href="${escapeHtml(failure.links?.job || "#")}">Job JSON</a>
      </div>
    </article>
  `;
}

async function loadMonitoring() {
  try {
    const response = await fetch("/api/monitoring/executions");
    if (!response.ok) throw new Error(`status ${response.status}`);
    const body = await response.json();
    const stats = body.stats || {};
    const failures = Array.isArray(body.recentFailures) ? body.recentFailures : [];

    monitoringSummary.textContent =
      body.status === "ok"
        ? "No recent durable execution failures are reported for the default monitoring window."
        : `${failures.length} recent failure summar${failures.length === 1 ? "y" : "ies"} available for review.`;

    metricGrid.innerHTML = [
      renderMetric("status", body.status || "unknown", `generated ${formatDate(body.generatedAt)}`),
      renderMetric("recent total", stats.recentTotal ?? 0, "executions in the default window"),
      renderMetric("recent failed", stats.recentFailed ?? 0, "redacted failure summaries below"),
      renderMetric("failure rate", formatPercent(body.failureRate), "recent failed divided by recent total")
    ].join("");

    failureList.innerHTML =
      failures.length === 0
        ? '<div class="empty-state">No recent failures are retained for the default window.</div>'
        : failures.map(renderFailure).join("");
  } catch (error) {
    monitoringSummary.textContent = "Could not load execution monitoring data.";
    metricGrid.innerHTML = renderMetric("status", "error", error.message);
    failureList.innerHTML = `<div class="empty-state">Monitoring feed error: ${escapeHtml(error.message)}</div>`;
  }
}

loadMonitoring();
