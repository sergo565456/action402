import { verifyReceipt } from "./receipt.js";

function check(name, ok, details) {
  return {
    name,
    ok: Boolean(ok),
    ...(details === undefined ? {} : { details })
  };
}

function isSha256Hex(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
}

function receiptBaseReport(receipt) {
  const payload = receipt?.payload || {};
  const signatureVerified = verifyReceipt(receipt);
  const checks = [
    check("receipt is present", Boolean(receipt)),
    check("receipt signature verifies", signatureVerified, {
      keyId: receipt?.keyId || null
    }),
    check("receipt payload version is supported", payload.version === "action402.receipt.v1", {
      version: payload.version || null
    }),
    check("receipt payload has job id", typeof payload.jobId === "string" && payload.jobId.length > 0, {
      jobId: payload.jobId || null
    }),
    check("receipt request hash is sha256", isSha256Hex(payload.requestHash)),
    check("receipt response hash is sha256", isSha256Hex(payload.responseHash))
  ];

  return {
    ok: checks.every((item) => item.ok),
    receiptId: receipt?.id || null,
    jobId: payload.jobId || null,
    keyId: receipt?.keyId || null,
    signatureVerified,
    checks
  };
}

export function verifyStoredReceipt(receipt) {
  return receiptBaseReport(receipt);
}

export function verifyJobReceipt({ job, receipt }) {
  const base = receiptBaseReport(receipt);
  const payload = receipt?.payload || {};
  const payloadTarget = payload.target || {};
  const jobAttemptCount = Array.isArray(job?.attempts) ? job.attempts.length : null;
  const consistencyChecks = [
    check("job is present", Boolean(job)),
    check("receipt links to job", payload.jobId === job?.id, {
      receiptJobId: payload.jobId || null,
      jobId: job?.id || null
    }),
    check("job links to receipt", job?.receiptId === receipt?.id, {
      jobReceiptId: job?.receiptId || null,
      receiptId: receipt?.id || null
    }),
    check("receipt status matches job", payload.status === job?.status, {
      receiptStatus: payload.status || null,
      jobStatus: job?.status || null
    }),
    check("receipt target matches job", payloadTarget.url === job?.target, {
      receiptTarget: payloadTarget.url || null,
      jobTarget: job?.target || null
    }),
    check("receipt method matches job", payloadTarget.method === job?.method, {
      receiptMethod: payloadTarget.method || null,
      jobMethod: job?.method || null
    }),
    check("receipt attempt count matches job", payload.attempts === jobAttemptCount, {
      receiptAttempts: payload.attempts ?? null,
      jobAttempts: jobAttemptCount
    }),
    check("receipt decision id matches job when present", (payload.decisionId || null) === (job?.decisionId || null), {
      receiptDecisionId: payload.decisionId || null,
      jobDecisionId: job?.decisionId || null
    }),
    check("receipt decision hash matches job when present", (payload.decisionHash || null) === (job?.decisionHash || null), {
      receiptDecisionHashPresent: Boolean(payload.decisionHash),
      jobDecisionHashPresent: Boolean(job?.decisionHash)
    })
  ];
  const checks = [...base.checks, ...consistencyChecks];

  return {
    ok: checks.every((item) => item.ok),
    jobId: job?.id || payload.jobId || null,
    receiptId: receipt?.id || null,
    decisionId: payload.decisionId || job?.decisionId || null,
    decisionHashPresent: Boolean(payload.decisionHash || job?.decisionHash),
    keyId: receipt?.keyId || null,
    signatureVerified: base.signatureVerified,
    checks
  };
}
