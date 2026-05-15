import { config } from "./config.js";
import { executeWebhookRouteConfig } from "./bazaar.js";
import { logEvent } from "./observability.js";

export async function maybeInstallX402(app) {
  if (!config.x402Enabled) {
    logEvent("debug", "x402.disabled");
    return false;
  }

  const { paymentMiddleware, x402ResourceServer } = await import("@x402/express");
  const { ExactEvmScheme } = await import("@x402/evm/exact/server");
  const { HTTPFacilitatorClient } = await import("@x402/core/server");
  const { bazaarResourceServerExtension } = await import("@x402/extensions/bazaar");

  const facilitatorClient = await createFacilitatorClient(HTTPFacilitatorClient);
  const server = new x402ResourceServer(facilitatorClient)
    .register(config.x402Network, new ExactEvmScheme())
    .registerExtension(bazaarResourceServerExtension);

  app.use(paymentMiddleware(executeWebhookRouteConfig(), server));
  logEvent("info", "x402.middleware_installed", {
    network: config.x402Network,
    price: config.x402Price,
    facilitatorHost: new URL(config.facilitatorUrl).host
  });
  return true;
}

async function createFacilitatorClient(HTTPFacilitatorClient) {
  if (config.facilitatorUrl.includes("api.cdp.coinbase.com")) {
    try {
      const coinbase = await import("@coinbase/x402");
      if (coinbase.facilitator) {
        return new HTTPFacilitatorClient(coinbase.facilitator);
      }
    } catch {
      // Fall back to raw URL. CDP production auth may still require @coinbase/x402.
    }
  }

  return new HTTPFacilitatorClient({ url: config.facilitatorUrl });
}
