const DISCOVERY_HEADER_PATHS = [
  "/",
  "/agents",
  "/discovery",
  "/pricing",
  "/mcp",
  "/actions",
  "/snippets",
  "/decisions",
  "/api",
  "/api/",
  "/api/discovery",
  "/api/agent-manifest",
  "/.well-known/agent.json",
  "/.well-known/mcp.json",
  "/api/capabilities",
  "/api/pricing",
  "/api/mcp",
  "/api/actions",
  "/api/quickstart",
  "/api/snippets",
  "/api/decisions/recent",
  "/api/bazaar",
  "/openapi.json",
  "/llms.txt"
];

const DISCOVERY_LINKS = [
  {
    path: "/api",
    rel: "index",
    type: "application/json",
    title: "Action402 API index"
  },
  {
    path: "/api/discovery",
    rel: "service-meta",
    type: "application/json",
    title: "Action402 discovery pack"
  },
  {
    path: "/api/agent-manifest",
    rel: "service-meta",
    type: "application/json",
    title: "Action402 agent manifest"
  },
  {
    path: "/openapi.json",
    rel: "service-desc",
    type: "application/vnd.oai.openapi+json",
    title: "Action402 OpenAPI"
  },
  {
    path: "/llms.txt",
    rel: "alternate",
    type: "text/plain",
    title: "Action402 LLM context"
  },
  {
    path: "/api/pricing",
    rel: "payment",
    type: "application/json",
    title: "Action402 pricing"
  },
  {
    path: "/api/decide/webhook",
    rel: "preflight",
    type: "application/json",
    title: "Action402 decision graph"
  },
  {
    path: "/api/mcp",
    rel: "tool-manifest",
    type: "application/json",
    title: "Action402 MCP wrapper manifest"
  },
  {
    path: "/api/bazaar",
    rel: "service-meta",
    type: "application/json",
    title: "Action402 Bazaar metadata"
  }
];

function requestPath(req) {
  return new URL(req.originalUrl || req.url || "/", "http://action402.internal").pathname;
}

function formatLink({ path, rel, type, title }) {
  return `<${path}>; rel="${rel}"; type="${type}"; title="${title}"`;
}

function shouldApplyDiscoveryHeaders(path, method) {
  return ["GET", "HEAD"].includes(method) && DISCOVERY_HEADER_PATHS.includes(path);
}

export function publicDiscoveryHeaderPolicy() {
  return {
    enabled: true,
    agentEntryHeader: "X-Action402-Agent-Entry",
    linkHeader: "Link",
    appliesToPaths: DISCOVERY_HEADER_PATHS,
    links: DISCOVERY_LINKS
  };
}

export function discoveryHeaderMiddleware(req, res, next) {
  if (shouldApplyDiscoveryHeaders(requestPath(req), req.method)) {
    res.set("X-Action402-Agent-Entry", "/api");
    res.set("Link", DISCOVERY_LINKS.map(formatLink).join(", "));
  }

  next();
}
