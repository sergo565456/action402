const [baseUrlArg, idArg, ...flags] = process.argv.slice(2);

function usage() {
  console.error("Usage: npm run verify:receipt -- <base-url> <job_...|rcpt_...> [--job|--receipt]");
}

function normalizeBaseUrl(value) {
  return String(value || "").replace(/\/+$/, "");
}

function verificationPath(id) {
  if (flags.includes("--job")) return `/api/verify/jobs/${encodeURIComponent(id)}`;
  if (flags.includes("--receipt")) return `/api/verify/receipts/${encodeURIComponent(id)}`;
  if (id.startsWith("job_")) return `/api/verify/jobs/${encodeURIComponent(id)}`;
  if (id.startsWith("rcpt_")) return `/api/verify/receipts/${encodeURIComponent(id)}`;
  throw new Error("id must start with job_ or rcpt_, or pass --job/--receipt");
}

async function fetchReport(baseUrl, id) {
  const path = verificationPath(id);
  const response = await fetch(`${baseUrl}${path}`);
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  return { response, body, path };
}

async function main() {
  if (!baseUrlArg || !idArg) {
    usage();
    process.exit(2);
  }

  const baseUrl = normalizeBaseUrl(baseUrlArg);
  const { response, body, path } = await fetchReport(baseUrl, idArg);

  console.log(`Action402 receipt verification: ${baseUrl}${path}`);
  if (response.status !== 200) {
    console.error(`FAIL HTTP ${response.status}`);
    console.error(JSON.stringify(body, null, 2));
    process.exit(1);
  }

  for (const item of body.checks || []) {
    const prefix = item.ok ? "PASS" : "FAIL";
    const details = item.details ? ` ${JSON.stringify(item.details)}` : "";
    console.log(`${prefix} ${item.name}${details}`);
  }

  console.log(
    `${body.ok ? "PASS" : "FAIL"} verification report job=${body.jobId || "none"} receipt=${
      body.receiptId || "none"
    } signatureVerified=${body.signatureVerified}`
  );

  if (!body.ok) {
    process.exit(1);
  }
}

await main();
