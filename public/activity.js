const activitySummary = document.querySelector("#activity-summary");
const activityMetrics = document.querySelector("#activity-metrics");
const recommendationList = document.querySelector("#recommendation-list");
const proofList = document.querySelector("#activity-proof-list");

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
  if (!Number.isFinite(number)) return "n/a";
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

function renderRecommendation(item) {
  return `
    <article class="endpoint">
      <span>${escapeHtml(item.priority || "info")}</span>
      <h3>${escapeHtml(item.id || "recommendation")}</h3>
      <p>${escapeHtml(item.summary || "")}</p>
    </article>
  `;
}

function renderProof(proof) {
  return `
    <article class="proof-card">
      <span>${escapeHtml(proof.status || "proof")}</span>
      <h3>${escapeHtml(proof.jobId)}</h3>
      <dl class="proof-meta">
        <div>
          <dt>method</dt>
          <dd>${escapeHtml(proof.method)}</dd>
        </div>
        <div>
          <dt>attempts</dt>
          <dd>${escapeHtml(proof.attempts)}</dd>
        </div>
        <div>
          <dt>response</dt>
          <dd>${escapeHtml(proof.responseStatus ?? "n/a")}</dd>
        </div>
        <div>
          <dt>receipt</dt>
          <dd>${escapeHtml(shortId(proof.receiptId))}</dd>
        </div>
      </dl>
      <small>Updated ${escapeHtml(formatDate(proof.updatedAt))}. Public proof data is redacted.</small>
      <div class="actions">
        <a class="button secondary" href="${escapeHtml(proof.links?.verifyJob || "#")}">Verify</a>
        <a class="button secondary" href="${escapeHtml(proof.links?.job || "#")}">Job JSON</a>
      </div>
    </article>
  `;
}

async function loadActivity() {
  try {
    const response = await fetch("/api/activity");
    if (!response.ok) throw new Error(`status ${response.status}`);
    const body = await response.json();
    const activity = body.activity || {};
    const recommendations = Array.isArray(body.recommendations) ? body.recommendations : [];
    const proofs = Array.isArray(body.recentProofs) ? body.recentProofs : [];

    activitySummary.textContent =
      body.status === "ready"
        ? "Action402 reports recent verifiable paid execution signals."
        : "Action402 is reachable, but buyer agents should inspect the recommendations before paying.";

    activityMetrics.innerHTML = [
      renderMetric("status", body.status || "unknown", `generated ${formatDate(body.generatedAt)}`),
      renderMetric("recency", activity.recency || "unknown", `${activity.latestProofHoursAgo ?? "n/a"}h since latest proof`),
      renderMetric("recent total", activity.recentTotal ?? 0, "paid executions in the default window"),
      renderMetric("success", formatPercent(activity.recentSuccessRate), "recent paid execution success rate"),
      renderMetric("trust", body.trustScore?.grade || "n/a", `${body.trustScore?.score ?? "n/a"}/${body.trustScore?.maxScore ?? "n/a"}`),
      renderMetric("verified proofs", activity.verifiedProofCount ?? 0, "public redacted examples retained"),
      renderMetric("price", body.x402?.price || "n/a", body.x402?.network || "network unknown"),
      renderMetric("failures", formatPercent(activity.recentFailureRate), "recent failure rate")
    ].join("");

    recommendationList.innerHTML =
      recommendations.length === 0
        ? '<div class="empty-state">No recommendations returned.</div>'
        : recommendations.map(renderRecommendation).join("");

    proofList.innerHTML =
      proofs.length === 0
        ? '<div class="empty-state">No verified public proof examples are currently retained.</div>'
        : proofs.map(renderProof).join("");
  } catch (error) {
    activitySummary.textContent = "Could not load activity data.";
    activityMetrics.innerHTML = renderMetric("status", "error", error.message);
    recommendationList.innerHTML = `<div class="empty-state">Activity feed error: ${escapeHtml(error.message)}</div>`;
    proofList.innerHTML = '<div class="empty-state">Proof feed unavailable.</div>';
  }
}

loadActivity();
