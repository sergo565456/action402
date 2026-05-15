import { app } from "../src/server.js";

const rewritePathParam = "__action402_path";

function applyVercelRewritePath(req) {
  const url = new URL(req.url, "http://action402.internal");
  const rewritePath = url.searchParams.get(rewritePathParam);
  if (!rewritePath) return;

  url.searchParams.delete(rewritePathParam);
  const query = url.searchParams.toString();
  req.url = `${rewritePath}${query ? `?${query}` : ""}`;
}

export default function handler(req, res) {
  applyVercelRewritePath(req);
  return app(req, res);
}
