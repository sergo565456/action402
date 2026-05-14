const host = "127.0.0.1";
const port = process.env.PORT || "4021";
const timeoutMs = Number(process.env.HEALTHCHECK_TIMEOUT_MS || 3000);

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), timeoutMs);

try {
  const response = await fetch(`http://${host}:${port}/health`, {
    signal: controller.signal
  });
  const body = await response.json();

  if (!response.ok || body?.ok !== true) {
    console.error(`healthcheck failed: status=${response.status}`);
    process.exit(1);
  }
} catch (error) {
  console.error(`healthcheck failed: ${error.message}`);
  process.exit(1);
} finally {
  clearTimeout(timeout);
}
