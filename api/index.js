import { app } from "../src/server.js";

const rewritePathParam = "__action402_path";
const internalOrigin = "http://action402.internal";

function clearParsedUrlCache(req) {
  delete req._parsedUrl;
  delete req._parsedOriginalUrl;
}

function relativeRequestUrl(rawUrl) {
  const parsed = new URL(rawUrl || "/", internalOrigin);
  return `${parsed.pathname}${parsed.search}`;
}

export function normalizeVercelRequestUrl(req) {
  if (typeof req.url !== "string") {
    req.url = "/";
    clearParsedUrlCache(req);
    return;
  }

  const normalizedUrl = relativeRequestUrl(req.url);
  if (normalizedUrl === req.url) return;

  req.url = normalizedUrl;
  clearParsedUrlCache(req);
}

export function applyVercelRewritePath(req) {
  normalizeVercelRequestUrl(req);

  const url = new URL(req.url, internalOrigin);
  const rewritePath = url.searchParams.get(rewritePathParam);
  if (!rewritePath) return;

  url.searchParams.delete(rewritePathParam);
  const internalPath = rewritePath.replace(/^\/api\//, "");
  if (url.searchParams.get("path") === internalPath) {
    url.searchParams.delete("path");
  }
  const query = url.searchParams.toString();
  req.url = `${rewritePath}${query ? `?${query}` : ""}`;
  clearParsedUrlCache(req);
}

export default function handler(req, res) {
  applyVercelRewritePath(req);
  return app(req, res);
}
