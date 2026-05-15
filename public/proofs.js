const proofList = document.querySelector("#proof-list");
const proofSummary = document.querySelector("#proof-feed-summary");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function shortId(value) {
  if (!value) return "n/a";
  return value.length > 18 ? `${value.slice(0, 10)}...${value.slice(-6)}` : value;
}

function formatDate(value) {
  if (!value) return "n/a";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function renderProof(proof) {
  const verifyLink = proof.links?.verifyJob || proof.links?.verifyReceipt || "#";
  return `
    <article class="proof-card">
      <span>${escapeHtml(proof.status)} proof</span>
      <h3>${escapeHtml(proof.jobId)}</h3>
      <span class="status-pill${proof.receiptVerified ? "" : " warn"}">
        ${proof.receiptVerified ? "receipt verified" : "receipt not verified"}
      </span>
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
      <small>Updated ${escapeHtml(formatDate(proof.updatedAt))}. Sensitive target, payload, hash, and signature fields are redacted.</small>
      <div class="actions">
        <a class="button secondary" href="${escapeHtml(verifyLink)}">Verify</a>
        <a class="button secondary" href="${escapeHtml(proof.links?.job || "#")}">Job JSON</a>
      </div>
    </article>
  `;
}

async function loadProofs() {
  try {
    const response = await fetch("/api/proofs/recent?limit=8");
    if (!response.ok) throw new Error(`status ${response.status}`);
    const body = await response.json();
    const proofs = Array.isArray(body.proofs) ? body.proofs : [];

    proofSummary.textContent =
      proofs.length === 0
        ? "No public verified proof examples are retained yet. Run a paid execution and refresh this page."
        : `${proofs.length} verified proof example${proofs.length === 1 ? "" : "s"} loaded.`;

    proofList.innerHTML =
      proofs.length === 0
        ? '<div class="empty-state">No verified proof examples are available yet.</div>'
        : proofs.map(renderProof).join("");
  } catch (error) {
    proofSummary.textContent = "Could not load public proof examples.";
    proofList.innerHTML = `<div class="empty-state">Proof feed error: ${escapeHtml(error.message)}</div>`;
  }
}

loadProofs();
