const STABLE_DISCOVERY_CACHE_CONTROL = "public, max-age=60, s-maxage=300, stale-while-revalidate=600";
const NO_STORE_CACHE_CONTROL = "no-store";

const STABLE_DISCOVERY_PATHS = [
  "/api",
  "/api/",
  "/api/agent-manifest",
  "/.well-known/agent.json",
  "/.well-known/action402.json",
  "/.well-known/x402.json",
  "/api/capabilities",
  "/api/actions",
  "/api/quickstart",
  "/api/snippets",
  "/api/bazaar",
  "/api/handoff/capabilities",
  "/api/schedules/capabilities",
  "/api/secrets/policy",
  "/openapi.json",
  "/llms.txt",
  "/robots.txt",
  "/sitemap.xml"
];

const NO_STORE_EXACT_PATHS = [
  "/health",
  "/api/execute/webhook",
  "/api/canary/echo",
  "/api/proofs/recent",
  "/api/monitoring/executions",
  "/api/trust",
  "/api/policy/check",
  "/api/handoff/browser",
  "/api/schedules/preview"
];

const NO_STORE_PREFIXES = [
  "/api/",
  "/.well-known/",
  "/api/jobs/",
  "/api/receipts/",
  "/api/verify/",
  "/proof/"
];

function requestPath(req) {
  return new URL(req.originalUrl || req.url || "/", "http://action402.internal").pathname;
}

function cacheControlFor(path, method) {
  if (!["GET", "HEAD"].includes(method)) return NO_STORE_CACHE_CONTROL;
  if (STABLE_DISCOVERY_PATHS.includes(path)) return STABLE_DISCOVERY_CACHE_CONTROL;
  if (NO_STORE_EXACT_PATHS.includes(path)) return NO_STORE_CACHE_CONTROL;
  if (NO_STORE_PREFIXES.some((prefix) => path.startsWith(prefix))) return NO_STORE_CACHE_CONTROL;
  return undefined;
}

export function publicCachePolicy() {
  return {
    stableDiscoveryCacheControl: STABLE_DISCOVERY_CACHE_CONTROL,
    dynamicCacheControl: NO_STORE_CACHE_CONTROL,
    stableDiscoveryPaths: STABLE_DISCOVERY_PATHS,
    noStorePaths: NO_STORE_EXACT_PATHS,
    noStorePathPrefixes: NO_STORE_PREFIXES,
    notes:
      "Stable discovery contracts are short-cacheable for crawlers and agent clients. Runtime health, execution, verification, monitoring, and proof data are no-store."
  };
}

export function cacheControlMiddleware(req, res, next) {
  const cacheControl = cacheControlFor(requestPath(req), req.method);
  if (cacheControl) {
    res.set("Cache-Control", cacheControl);
  }
  next();
}
