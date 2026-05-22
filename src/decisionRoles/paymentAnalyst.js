import { config } from "../config.js";
import { parseUsdAmount } from "../decisionState.js";

export function runPaymentAnalyst({ buyerPolicy }) {
  const price = parseUsdAmount(config.x402Price);
  const maxPrice = parseUsdAmount(buyerPolicy.maxPriceUsd);
  const allowedNetworks = Array.isArray(buyerPolicy.allowedNetworks) ? buyerPolicy.allowedNetworks : [];
  const blockingIssues = [];
  const warnings = [];
  const reasons = [];

  if (!config.x402Enabled) {
    warnings.push("x402 is disabled in this runtime; local execution may be demo-mode only.");
  }

  if (!config.payTo && config.x402Enabled) {
    blockingIssues.push("Payment recipient is not configured.");
  }

  if (price === null) {
    blockingIssues.push(`Configured price ${config.x402Price} is not parseable.`);
  } else if (maxPrice !== null && price > maxPrice) {
    blockingIssues.push(`Configured price ${config.x402Price} is above buyer max ${buyerPolicy.maxPriceUsd}.`);
  } else {
    reasons.push(
      maxPrice === null
        ? `Configured price is ${config.x402Price}; buyer did not set a max price.`
        : `Configured price ${config.x402Price} is within buyer max ${buyerPolicy.maxPriceUsd}.`
    );
  }

  if (allowedNetworks.length > 0 && !allowedNetworks.includes(config.x402Network)) {
    blockingIssues.push(`Network ${config.x402Network} is not in buyer allowedNetworks.`);
  } else {
    reasons.push(`Payment network is ${config.x402Network}.`);
  }

  return {
    id: "paymentAnalyst",
    title: "Payment Analyst",
    stance: blockingIssues.length > 0 ? "block" : warnings.length > 0 ? "warn" : "approve",
    price: config.x402Price,
    network: config.x402Network,
    payToConfigured: Boolean(config.payTo),
    maxPriceUsd: buyerPolicy.maxPriceUsd,
    blockingIssues,
    warnings,
    reasons
  };
}
