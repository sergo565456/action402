const title = document.querySelector("#status-title");
const fields = new Map(
  Array.from(document.querySelectorAll("[data-status-field]")).map((node) => [
    node.getAttribute("data-status-field"),
    node
  ])
);

function setField(name, value) {
  const node = fields.get(name);
  if (!node) return;
  node.textContent = value === undefined || value === null || value === "" ? "unknown" : String(value);
}

function storeLabel(store) {
  if (!store || typeof store !== "object") return "unknown";
  const driver = store.driver || "unknown";
  return store.durable === true ? `${driver} durable` : `${driver} non-durable`;
}

async function loadStatus() {
  try {
    const response = await fetch("/health", {
      headers: {
        accept: "application/json"
      },
      cache: "no-store"
    });
    const body = await response.json();

    if (!response.ok || body?.ok !== true) {
      throw new Error(`health status ${response.status}`);
    }

    const mode = body.x402Enabled ? "x402" : body.profile || "demo";
    if (title) title.textContent = `Action402 is healthy in ${mode} mode.`;
    setField("status", body.ok ? "ok" : "attention");
    setField("mode", mode);
    setField("network", body.network);
    setField("store", storeLabel(body.store));
  } catch (error) {
    if (title) title.textContent = "Action402 status needs attention.";
    setField("status", "attention");
    setField("mode", "unknown");
    setField("network", "unknown");
    setField("store", error.message);
  }
}

await loadStatus();
