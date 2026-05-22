const idEl = document.querySelector("#decision-id");
const recommendationEl = document.querySelector("#decision-recommendation");
const confidenceEl = document.querySelector("#decision-confidence");
const outcomeEl = document.querySelector("#decision-outcome");
const headingEl = document.querySelector("#decision-heading");
const summaryEl = document.querySelector("#decision-summary");
const rolesEl = document.querySelector("#decision-roles");
const jsonLink = document.querySelector("#decision-json-link");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function decisionIdFromPath() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  return decodeURIComponent(parts[1] || "");
}

function renderRole(report) {
  const reason = report.reason || report.reasons?.[0] || report.warnings?.[0] || report.blockingIssues?.[0] || "No role details.";
  return `
    <article class="proof-card">
      <span class="status-pill${report.stance === "approve" ? "" : " warn"}">${escapeHtml(report.stance)}</span>
      <h3>${escapeHtml(report.title || report.speaker || report.id)}</h3>
      <p>${escapeHtml(reason)}</p>
    </article>
  `;
}

async function loadDecision() {
  const id = decisionIdFromPath();
  idEl.textContent = id || "missing";

  if (!id) {
    headingEl.textContent = "No decision id provided.";
    summaryEl.textContent = "Use /decision/{decisionId}.";
    rolesEl.innerHTML = '<div class="empty-state">No id was found in the URL.</div>';
    return;
  }

  const path = `/api/decisions/${encodeURIComponent(id)}`;
  jsonLink.href = path;
  const response = await fetch(path);
  const body = await response.json();
  if (!response.ok) {
    headingEl.textContent = "Decision not found.";
    summaryEl.textContent = body.error?.message || `status ${response.status}`;
    rolesEl.innerHTML = '<div class="empty-state">Decision record is unavailable.</div>';
    return;
  }

  const decision = body.decision || {};
  recommendationEl.textContent = decision.recommendation || "unknown";
  confidenceEl.textContent = decision.confidence || "unknown";
  outcomeEl.textContent = decision.outcome?.status || "pending_execution";
  headingEl.textContent = `Decision: ${decision.recommendation || "unknown"}.`;
  summaryEl.textContent = (decision.reasons || [])[0] || decision.redaction || "Decision graph completed.";
  const roles = Array.isArray(decision.debate) ? decision.debate : [];
  rolesEl.innerHTML =
    roles.length === 0
      ? '<div class="empty-state">No role ledger returned.</div>'
      : roles.map(renderRole).join("");
}

loadDecision().catch((error) => {
  headingEl.textContent = "Could not load decision.";
  summaryEl.textContent = error.message;
});
