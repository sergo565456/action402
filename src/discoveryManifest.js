import { config } from "./config.js";
import { publicActionTemplates } from "./actionCatalog.js";
import { DISCOVERY_KEYWORDS, SERVICE_TAGS } from "./agentDiscovery.js";
import { publicUseCaseTemplates } from "./useCases.js";

const PUBLIC_PAGES = [
  { path: "/", priority: "1.0", changefreq: "weekly" },
  { path: "/agents", priority: "0.95", changefreq: "weekly" },
  { path: "/discovery", priority: "0.95", changefreq: "weekly" },
  { path: "/pricing", priority: "0.85", changefreq: "weekly" },
  { path: "/onboarding", priority: "0.85", changefreq: "weekly" },
  { path: "/use-cases", priority: "0.85", changefreq: "weekly" },
  { path: "/actions", priority: "0.9", changefreq: "weekly" },
  { path: "/snippets", priority: "0.85", changefreq: "weekly" },
  { path: "/handoff", priority: "0.75", changefreq: "weekly" },
  { path: "/schedules", priority: "0.75", changefreq: "weekly" },
  { path: "/secrets", priority: "0.75", changefreq: "monthly" },
  { path: "/mcp", priority: "0.8", changefreq: "weekly" },
  { path: "/trust", priority: "0.8", changefreq: "daily" },
  { path: "/proofs", priority: "0.75", changefreq: "daily" },
  { path: "/monitoring", priority: "0.65", changefreq: "daily" },
  { path: "/demo.html", priority: "0.55", changefreq: "monthly" },
  { path: "/brand.html", priority: "0.45", changefreq: "monthly" }
];

const MACHINE_SURFACES = [
  "/api",
  "/api/agent-manifest",
  "/.well-known/agent.json",
  "/.well-known/action402.json",
  "/.well-known/x402.json",
  "/api/capabilities",
  "/api/bazaar",
  "/api/actions",
  "/api/quickstart",
  "/api/snippets",
  "/api/policy/check",
  "/api/canary/echo",
  "/api/handoff/capabilities",
  "/api/schedules/capabilities",
  "/api/secrets/policy",
  "/api/trust",
  "/api/proofs/recent",
  "/api/monitoring/executions",
  "/openapi.json",
  "/llms.txt",
  "/robots.txt",
  "/sitemap.xml"
];

function normalizeBaseUrl(baseUrl = config.publicBaseUrl) {
  return String(baseUrl || "").replace(/\/+$/, "");
}

function absoluteUrl(path, baseUrl = config.publicBaseUrl) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  return `${normalizedBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

function xmlEscape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function discoveryLinks(baseUrl) {
  return {
    homepage: absoluteUrl("/", baseUrl),
    discoveryPage: absoluteUrl("/discovery", baseUrl),
    apiIndex: absoluteUrl("/api", baseUrl),
    apiManifest: absoluteUrl("/api/agent-manifest", baseUrl),
    wellKnownAgent: absoluteUrl("/.well-known/agent.json", baseUrl),
    wellKnownAction402: absoluteUrl("/.well-known/action402.json", baseUrl),
    wellKnownX402: absoluteUrl("/.well-known/x402.json", baseUrl),
    llms: absoluteUrl("/llms.txt", baseUrl),
    openapi: absoluteUrl("/openapi.json", baseUrl),
    bazaar: absoluteUrl("/api/bazaar", baseUrl),
    capabilities: absoluteUrl("/api/capabilities", baseUrl),
    actions: absoluteUrl("/api/actions", baseUrl),
    quickstart: absoluteUrl("/api/quickstart", baseUrl),
    snippets: absoluteUrl("/api/snippets", baseUrl),
    canaryEcho: absoluteUrl("/api/canary/echo", baseUrl),
    trust: absoluteUrl("/api/trust", baseUrl),
    robots: absoluteUrl("/robots.txt", baseUrl),
    sitemap: absoluteUrl("/sitemap.xml", baseUrl)
  };
}

export function publicDiscoveryPack({ baseUrl = config.publicBaseUrl } = {}) {
  const links = discoveryLinks(baseUrl);

  return {
    status: "active",
    description:
      "Canonical discovery pack for agents, crawlers, Bazaar/MCP clients, and directories that need to inspect Action402 before paying.",
    agentManifest: links.apiManifest,
    wellKnown: [links.wellKnownAgent, links.wellKnownAction402, links.wellKnownX402],
    textContext: links.llms,
    openapi: links.openapi,
    bazaar: links.bazaar,
    robots: links.robots,
    sitemap: links.sitemap,
    discoveryPage: links.discoveryPage,
    apiIndex: links.apiIndex
  };
}

export function publicAgentManifest({ baseUrl = config.publicBaseUrl } = {}) {
  const links = discoveryLinks(baseUrl);
  const actionTemplates = publicActionTemplates();
  const useCases = publicUseCaseTemplates();

  return {
    schemaVersion: "action402.agent-manifest.v1",
    name: "Action402",
    tagline: "Pay. Execute. Prove.",
    status: "production",
    category: "agent-infrastructure",
    description:
      "x402-native paid webhook and API execution for autonomous agents. Pay per public HTTPS action and verify the signed receipt.",
    canonicalBaseUrl: normalizeBaseUrl(baseUrl),
    icon: absoluteUrl("/logo-action402.svg", baseUrl),
    audience: ["autonomous agents", "MCP clients", "x402 buyers", "workflow agents", "agent marketplaces"],
    protocols: ["x402", "HTTP 402", "Bazaar discovery extension", "OpenAPI 3.1", "llms.txt", "well-known agent manifest"],
    tags: SERVICE_TAGS,
    discoveryKeywords: DISCOVERY_KEYWORDS,
    buyerPrompt:
      "Use Action402 for one paid public HTTPS webhook/API action. Preflight the target, pay only if price/network/route match policy, then verify the returned receipt.",
    paidActions: [
      {
        id: "execute.webhook",
        method: "POST",
        path: "/api/execute/webhook",
        url: absoluteUrl("/api/execute/webhook", baseUrl),
        payment: {
          required: config.x402Enabled,
          scheme: "exact",
          network: config.x402Network,
          price: config.x402Price,
          payTo: config.payTo || null
        },
        executionModel: "immediate one-shot public HTTPS action",
        proofModel: "signed receipt with request hash, response hash, target, status, and attempts"
      }
    ],
    freeAgentSurfaces: MACHINE_SURFACES.map((path) => ({
      path,
      url: absoluteUrl(path, baseUrl)
    })),
    browserPages: PUBLIC_PAGES.map((page) => ({
      path: page.path,
      url: absoluteUrl(page.path, baseUrl),
      priority: page.priority
    })),
    actionTemplateSummary: {
      count: actionTemplates.length,
      categories: Array.from(new Set(actionTemplates.map((template) => template.category))).sort(),
      examples: actionTemplates.slice(0, 6).map((template) => ({
        id: template.id,
        title: template.title,
        category: template.category,
        paidRoute: template.paidRoute
      }))
    },
    useCaseSummary: {
      count: useCases.length,
      examples: useCases.slice(0, 6).map((useCase) => ({
        id: useCase.id,
        title: useCase.title,
        category: useCase.category
      }))
    },
    safety: {
      httpsTargetsOnly: !config.allowHttpTargets,
      privateNetworkTargetsBlocked: true,
      allowedMethods: ["POST", "PUT", "PATCH", "DELETE"],
      preflightPolicyCheck: absoluteUrl("/api/policy/check", baseUrl),
      secretStorage: "not-supported-in-public-mvp",
      scheduleExecution: "preview-only",
      browserExecution: "handoff-only"
    },
    verification: {
      job: absoluteUrl("/api/verify/jobs/{id}", baseUrl),
      receipt: absoluteUrl("/api/verify/receipts/{id}", baseUrl),
      proofBadge: absoluteUrl("/proof/{jobOrReceiptId}", baseUrl),
      recentProofs: absoluteUrl("/api/proofs/recent", baseUrl)
    },
    trust: {
      summary: absoluteUrl("/api/trust", baseUrl),
      monitoring: absoluteUrl("/api/monitoring/executions", baseUrl),
      publicProofs: absoluteUrl("/proofs", baseUrl)
    },
    links
  };
}

export function robotsTxt({ baseUrl = config.publicBaseUrl } = {}) {
  const links = discoveryLinks(baseUrl);
  return [
    "User-agent: *",
    "Allow: /",
    "Allow: /api",
    "Allow: /llms.txt",
    "Allow: /api/agent-manifest",
    "Allow: /.well-known/agent.json",
    "Allow: /.well-known/action402.json",
    "Allow: /.well-known/x402.json",
    "Allow: /api/capabilities",
    "Allow: /api/bazaar",
    "Allow: /openapi.json",
    `Sitemap: ${links.sitemap}`,
    "",
    "# Agent entry points:",
    `# ${links.apiIndex}`,
    `# ${links.apiManifest}`,
    `# ${links.llms}`,
    `# ${links.bazaar}`,
    ""
  ].join("\n");
}

export function sitemapXml({ baseUrl = config.publicBaseUrl } = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    ...PUBLIC_PAGES,
    ...MACHINE_SURFACES.map((path) => ({
      path,
      priority: path === "/api/agent-manifest" ? "0.9" : "0.55",
      changefreq: path.includes("monitoring") || path.includes("proofs") || path.includes("trust") ? "daily" : "weekly"
    }))
  ];

  const entries = urls
    .map((item) => {
      return [
        "  <url>",
        `    <loc>${xmlEscape(absoluteUrl(item.path, baseUrl))}</loc>`,
        `    <lastmod>${today}</lastmod>`,
        `    <changefreq>${item.changefreq}</changefreq>`,
        `    <priority>${item.priority}</priority>`,
        "  </url>"
      ].join("\n");
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    entries,
    "</urlset>",
    ""
  ].join("\n");
}

export { MACHINE_SURFACES, PUBLIC_PAGES };
