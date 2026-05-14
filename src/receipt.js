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

export function signReceiptPayload(payload) {
  const signature = crypto
    .createHmac("sha256", config.receiptSecret)
    .update(canonicalJson(payload))
    .digest("base64url");

  return `hmac-sha256:${signature}`;
}

export function verifyReceipt(receipt) {
  if (!receipt || !receipt.payload || !receipt.signature) return false;
  return signReceiptPayload(receipt.payload) === receipt.signature;
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
    payload,
    signature: signReceiptPayload(payload)
  };
}
