const proofIdEl = document.querySelector("#proof-id");
const proofSignatureEl = document.querySelector("#proof-signature");
const proofResultEl = document.querySelector("#proof-result");
const proofSourceEl = document.querySelector("#proof-source");
const proofHeading = document.querySelector("#proof-heading");
const proofSummary = document.querySelector("#proof-summary");
const proofChecks = document.querySelector("#proof-checks");
const verifyJsonLink = document.querySelector("#verify-json-link");
const machinePath = document.querySelector("#machine-path");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function proofIdFromPath() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  return decodeURIComponent(parts[1] || "");
}

async function fetchJson(path) {
  const response = await fetch(path);
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { error: { message: text || "invalid JSON" } };
  }
  return { response, body };
}

function candidatePaths(id) {
  const encoded = encodeURIComponent(id);
  const jobPath = `/api/verify/jobs/${encoded}`;
  const receiptPath = `/api/verify/receipts/${encoded}`;
  return id.startsWith("rcpt_") ? [receiptPath, jobPath] : [jobPath, receiptPath];
}

function renderCheck(check) {
  return `
    <article class="proof-card">
      <span class="status-pill${check.ok ? "" : " warn"}">${check.ok ? "pass" : "attention"}</span>
      <h3>${escapeHtml(check.name)}</h3>
      <small>${escapeHtml(JSON.stringify(check.details ?? {}, null, 2))}</small>
    </article>
  `;
}

async function loadProof() {
  const id = proofIdFromPath();
  proofIdEl.textContent = id || "missing";

  if (!id) {
    proofHeading.textContent = "No proof id provided.";
    proofSummary.textContent = "Use /proof/{jobId} or /proof/{receiptId}.";
    proofResultEl.textContent = "missing id";
    proofChecks.innerHTML = '<div class="empty-state">No id was found in the URL.</div>';
    return;
  }

  let lastError = "not found";

  for (const path of candidatePaths(id)) {
    const { response, body } = await fetchJson(path);
    if (!response.ok) {
      lastError = body.error?.message || `status ${response.status}`;
      continue;
    }

    const ok = body.ok === true;
    const checks = Array.isArray(body.checks) ? body.checks : [];
    verifyJsonLink.href = path;
    machinePath.textContent = path;
    proofSourceEl.textContent = path;
    proofSignatureEl.textContent = body.signatureVerified ? "verified" : "not verified";
    proofResultEl.textContent = ok ? "verified" : "attention";
    proofHeading.textContent = ok ? "Proof verified." : "Proof needs attention.";
    proofSummary.textContent = `Job ${body.jobId || "n/a"}, receipt ${body.receiptId || "n/a"}, key ${body.keyId || "n/a"}.`;
    proofChecks.innerHTML =
      checks.length === 0
        ? '<div class="empty-state">No detailed checks returned.</div>'
        : checks.map(renderCheck).join("");
    return;
  }

  verifyJsonLink.href = candidatePaths(id)[0];
  machinePath.textContent = candidatePaths(id)[0];
  proofSignatureEl.textContent = "not found";
  proofResultEl.textContent = "not found";
  proofHeading.textContent = "Proof not found.";
  proofSummary.textContent = lastError;
  proofChecks.innerHTML = `<div class="empty-state">Could not verify ${escapeHtml(id)}: ${escapeHtml(lastError)}</div>`;
}

loadProof();
