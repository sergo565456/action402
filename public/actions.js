const actionsSummary = document.querySelector("#actions-summary");
const actionsGrid = document.querySelector("#actions-grid");
const policyList = document.querySelector("#policy-list");
const scheduleNote = document.querySelector("#schedule-note");
const scheduleShape = document.querySelector("#schedule-shape");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderTags(tags) {
  return `
    <div class="tag-list">
      ${(tags || []).slice(0, 5).map((tag) => `<code>${escapeHtml(tag)}</code>`).join("")}
    </div>
  `;
}

function renderTemplate(template) {
  return `
    <article class="template-card">
      <span>${escapeHtml(template.category)} / ${escapeHtml(template.status)}</span>
      <h3>${escapeHtml(template.title)}</h3>
      <p>${escapeHtml(template.description)}</p>
      ${renderTags(template.tags)}
      <pre><code>${escapeHtml(JSON.stringify(template.exampleRequest, null, 2))}</code></pre>
    </article>
  `;
}

function renderPolicy(mode) {
  return `
    <article class="endpoint">
      <span>${escapeHtml(mode.status)}</span>
      <h3>${escapeHtml(mode.title)}</h3>
      <p>${escapeHtml(mode.description)} Best for: ${escapeHtml(mode.bestFor)}</p>
    </article>
  `;
}

async function loadActions() {
  try {
    const response = await fetch("/api/actions");
    if (!response.ok) throw new Error(`status ${response.status}`);
    const body = await response.json();
    const templates = Array.isArray(body.templates) ? body.templates : [];
    const policies = Array.isArray(body.policyModes) ? body.policyModes : [];
    const scheduled = body.scheduledActions || {};

    actionsSummary.textContent = `${templates.length} action template${templates.length === 1 ? "" : "s"} available across ${(body.categories || []).length} categories. The paid primitive remains ${body.activePrimitive?.method || "POST"} ${body.activePrimitive?.path || "/api/execute/webhook"}.`;
    actionsGrid.innerHTML =
      templates.length === 0
        ? '<div class="empty-state">No action templates returned.</div>'
        : templates.map(renderTemplate).join("");
    policyList.innerHTML =
      policies.length === 0
        ? '<div class="empty-state">No policy modes returned.</div>'
        : policies.map(renderPolicy).join("");
    scheduleNote.textContent = `${scheduled.title || "Scheduled actions"}: ${scheduled.availability || "status unknown"} ${scheduled.whyNotImmediate || ""}`;
    scheduleShape.textContent = JSON.stringify(scheduled.futureShape || {}, null, 2);
  } catch (error) {
    actionsSummary.textContent = "Could not load action catalog.";
    actionsGrid.innerHTML = `<div class="empty-state">Catalog error: ${escapeHtml(error.message)}</div>`;
    policyList.innerHTML = `<div class="empty-state">Policy mode error: ${escapeHtml(error.message)}</div>`;
    scheduleNote.textContent = "Could not load scheduled-action compatibility note.";
    scheduleShape.textContent = error.message;
  }
}

loadActions();
