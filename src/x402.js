import { config } from "./config.js";
import { executeWebhookRouteConfig } from "./bazaar.js";

export async function maybeInstallX402(app) {
  if (!config.x402Enabled) return false;

  const { paymentMiddleware, x402ResourceServer } = await import("@x402/express");
  const { ExactEvmScheme } = await import("@x402/evm/exact/server");
  const { HTTPFacilitatorClient } = await import("@x402/core/server");

  const facilitatorClient = await createFacilitatorClient(HTTPFacilitatorClient);
  const server = new x402ResourceServer(facilitatorClient).register(
    config.x402Network,
    new ExactEvmScheme()
  );

  app.use(paymentMiddleware(executeWebhookRouteConfig(), server));
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
