const listEl = document.querySelector("#decision-list");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function badgeClass(recommendation) {
  return recommendation === "pay_and_execute" ? "" : " warn";
}

function renderDecision(decision) {
  const outcome = decision.outcome?.status || "pending_execution";
  return `
    <article class="proof-card">
      <span class="status-pill${badgeClass(decision.recommendation)}">${escapeHtml(decision.recommendation)}</span>
      <h3>${escapeHtml(decision.id)}</h3>
      <p>${escapeHtml((decision.reasons || [])[0] || "Decision graph completed.")}</p>
      <small>confidence=${escapeHtml(decision.confidence)} · outcome=${escapeHtml(outcome)}</small>
      <p><a href="/decision/${encodeURIComponent(decision.id)}">Open decision record</a></p>
    </article>
  `;
}

async function loadDecisions() {
  const response = await fetch("/api/decisions/recent?limit=10");
  const body = await response.json();
  const decisions = Array.isArray(body.decisions) ? body.decisions : [];
  listEl.innerHTML =
    decisions.length === 0
      ? '<div class="empty-state">No public decision records yet. Call POST /api/decide/webhook to create one.</div>'
      : decisions.map(renderDecision).join("");
}

loadDecisions().catch((error) => {
  listEl.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
});
