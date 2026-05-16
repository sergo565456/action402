const CORS_PATH_PREFIXES = [
  "/api",
  "/api/",
  "/.well-known/",
  "/health",
  "/openapi.json",
  "/llms.txt",
  "/robots.txt",
  "/sitemap.xml"
];

const CORS_ALLOW_METHODS = ["GET", "HEAD", "POST", "OPTIONS"];
const CORS_ALLOW_HEADERS = [
  "content-type",
  "authorization",
  "x-request-id",
  "x-payment",
  "payment-signature",
  "payment",
  "payment-authorization"
];
const CORS_EXPOSE_HEADERS = [
  "x-request-id",
  "x-payment-response",
  "payment-response",
  "payment-required",
  "www-authenticate",
  "allow"
];
const CORS_MAX_AGE_SECONDS = 600;

function pathFromRequest(req) {
  return new URL(req.originalUrl || req.url || "/", "http://action402.internal").pathname;
}

function shouldApplyCors(path) {
  return CORS_PATH_PREFIXES.some((prefix) => (prefix.endsWith("/") ? path.startsWith(prefix) : path === prefix));
}

function setCorsHeaders(res) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", CORS_ALLOW_METHODS.join(", "));
  res.set("Access-Control-Allow-Headers", CORS_ALLOW_HEADERS.join(", "));
  res.set("Access-Control-Expose-Headers", CORS_EXPOSE_HEADERS.join(", "));
  res.set("Access-Control-Max-Age", String(CORS_MAX_AGE_SECONDS));
}

export function publicCorsPolicy() {
  return {
    enabled: true,
    allowOrigin: "*",
    allowCredentials: false,
    preflightStatus: 204,
    maxAgeSeconds: CORS_MAX_AGE_SECONDS,
    methods: CORS_ALLOW_METHODS,
    requestHeaders: CORS_ALLOW_HEADERS,
    exposedHeaders: CORS_EXPOSE_HEADERS,
    appliesToPathPrefixes: CORS_PATH_PREFIXES
  };
}

export function corsMiddleware(req, res, next) {
  if (!shouldApplyCors(pathFromRequest(req))) {
    next();
    return;
  }

  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  next();
}
