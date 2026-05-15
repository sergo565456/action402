import { app } from "../src/server.js";

const rewritePathParam = "__action402_path";

export function applyVercelRewritePath(req) {
  const url = new URL(req.url, "http://action402.internal");
  const rewritePath = url.searchParams.get(rewritePathParam);
  if (!rewritePath) return;

  url.searchParams.delete(rewritePathParam);
  const internalPath = rewritePath.replace(/^\/api\//, "");
  if (url.searchParams.get("path") === internalPath) {
    url.searchParams.delete("path");
  }
  const query = url.searchParams.toString();
  req.url = `${rewritePath}${query ? `?${query}` : ""}`;
}

export default function handler(req, res) {
  applyVercelRewritePath(req);
  return app(req, res);
}
