const trustSummary = document.querySelector("#trust-summary");
const trustMetrics = document.querySelector("#trust-metrics");
const trustSignals = document.querySelector("#trust-signals");

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

function renderMetric(label, value, note) {
  return `
    <article class="metric-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(note)}</small>
    </article>
  `;
}

function renderSignal(signal) {
  return `
    <article class="endpoint">
      <span>signal</span>
      <h3>${escapeHtml(signal)}</h3>
      <p>Published in the public trust summary for buyer-side inspection.</p>
    </article>
  `;
}

async function loadTrust() {
  try {
    const response = await fetch("/api/trust");
    if (!response.ok) throw new Error(`status ${response.status}`);
    const body = await response.json();
    const execution = body.execution || {};
    const stats = execution.stats || {};
    const proofs = body.proofExamples || {};
    const storage = body.storage || {};
    const score = body.trustScore || {};

    trustSummary.textContent =
      body.status === "ok"
        ? "The public trust summary reports no recent durable execution failures in the default window."
        : "The public trust summary reports recent execution failures; inspect monitoring before paying.";

    trustMetrics.innerHTML = [
      renderMetric("status", body.status || "unknown", `generated ${formatDate(body.generatedAt)}`),
      renderMetric("trust score", `${score.score ?? "n/a"}/${score.maxScore ?? 100}`, score.summary || "public buyer score"),
      renderMetric("price", body.x402?.price || "n/a", body.x402?.network || "unknown network"),
      renderMetric("recent failure", formatPercent(execution.recentFailureRate), "default 24 hour window"),
      renderMetric("verified proofs", proofs.recentVerifiedProofs ?? 0, `latest ${formatDate(proofs.latestVerifiedProofAt)}`),
      renderMetric("storage", storage.durable ? "durable" : "volatile", storage.driver || "unknown"),
      renderMetric("receipts", storage.receipts ?? 0, "retained receipt count")
    ].join("");

    trustSignals.innerHTML = Array.isArray(body.trustSignals)
      ? body.trustSignals.map(renderSignal).join("")
      : '<div class="empty-state">No trust signals returned.</div>';
  } catch (error) {
    trustSummary.textContent = "Could not load public trust data.";
    trustMetrics.innerHTML = renderMetric("status", "error", error.message);
    trustSignals.innerHTML = `<div class="empty-state">Trust feed error: ${escapeHtml(error.message)}</div>`;
  }
}

loadTrust();
