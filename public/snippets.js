const snippetsSummary = document.querySelector("#snippets-summary");
const snippetsList = document.querySelector("#snippets-list");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderSnippet(snippet) {
  return `
    <article class="template-card">
      <span>${escapeHtml(snippet.language)}</span>
      <h3>${escapeHtml(snippet.title)}</h3>
      <pre><code>${escapeHtml(snippet.code)}</code></pre>
    </article>
  `;
}

function renderGroup(group) {
  return `
    <article class="endpoint">
      <span>${escapeHtml(group.id)}</span>
      <h3>${escapeHtml(group.title)}</h3>
      <p>${escapeHtml(group.description)}</p>
    </article>
    <div class="template-grid">
      ${(group.snippets || []).map(renderSnippet).join("")}
    </div>
  `;
}

async function loadSnippets() {
  try {
    const response = await fetch("/api/snippets");
    if (!response.ok) throw new Error(`status ${response.status}`);
    const body = await response.json();
    const groups = Array.isArray(body.groups) ? body.groups : [];
    const snippetCount = groups.reduce((total, group) => total + (group.snippets || []).length, 0);

    snippetsSummary.textContent = `${snippetCount} snippet${snippetCount === 1 ? "" : "s"} available across ${groups.length} integration group${groups.length === 1 ? "" : "s"}. Expected payment: ${body.payment?.price || "n/a"} on ${body.payment?.networkName || body.payment?.network || "unknown network"}.`;
    snippetsList.innerHTML =
      groups.length === 0
        ? '<div class="empty-state">No snippets returned.</div>'
        : groups.map(renderGroup).join("");
  } catch (error) {
    snippetsSummary.textContent = "Could not load integration snippets.";
    snippetsList.innerHTML = `<div class="empty-state">Snippet feed error: ${escapeHtml(error.message)}</div>`;
  }
}

loadSnippets();
