import crypto from "node:crypto";
import { config } from "./config.js";

export function createId(prefix) {
  return `${prefix}_${crypto.randomBytes(12).toString("hex")}`;
}

export function sha256Json(value) {
  return crypto.createHash("sha256").update(canonicalJson(value)).digest("hex");
}

export function canonicalJson(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }

  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}

function receiptSecretsByKeyId() {
  return {
    ...config.receiptPreviousSecrets,
    [config.receiptKeyId]: config.receiptSecret
  };
}

export function signReceiptPayload(payload, secret = config.receiptSecret) {
  const signature = crypto
    .createHmac("sha256", secret)
    .update(canonicalJson(payload))
    .digest("base64url");

  return `hmac-sha256:${signature}`;
}

export function verifyReceipt(receipt, secretsByKeyId = receiptSecretsByKeyId()) {
  if (!receipt || !receipt.payload || !receipt.signature) return false;

  if (!receipt.keyId) {
    return signReceiptPayload(receipt.payload) === receipt.signature;
  }

  const secret = secretsByKeyId[receipt.keyId];
  if (!secret) return false;

  return signReceiptPayload(receipt.payload, secret) === receipt.signature;
}

export function buildReceipt({ job, requestHash, responseHash, target, response }) {
  const payload = {
    version: "action402.receipt.v1",
    jobId: job.id,
    target,
    status: job.status,
    attempts: job.attempts.length,
    requestHash,
    responseHash,
    responseStatus: response.status,
    responseOk: response.ok,
    idempotencyKey: job.idempotencyKey || null,
    createdAt: new Date().toISOString()
  };

  return {
    id: createId("rcpt"),
    keyId: config.receiptKeyId,
    payload,
    signature: signReceiptPayload(payload)
  };
}
