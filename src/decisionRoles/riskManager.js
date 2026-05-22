function flatten(reports, key) {
  return Object.values(reports).flatMap((report) => report?.[key] || []);
}

export function runRiskManager({ roleReports }) {
  const blockingIssues = flatten(roleReports, "blockingIssues");
  const warnings = flatten(roleReports, "warnings");
  const reasons = flatten(roleReports, "reasons");
  const hasWarnOnly = blockingIssues.length === 0 && warnings.length > 0;
  const recommendation =
    blockingIssues.length > 0 ? "do_not_pay" : hasWarnOnly ? "manual_review" : "pay_and_execute";
  const confidence = blockingIssues.length > 0 ? "high" : warnings.length > 0 ? "medium" : "high";

  return {
    recommendation,
    confidence,
    maxPayable: roleReports.paymentAnalyst?.maxPriceUsd || null,
    actualPrice: roleReports.paymentAnalyst?.price || null,
    blockingIssues,
    warnings,
    reasons: [
      ...reasons,
      recommendation === "pay_and_execute"
        ? "No deterministic blocking issue was found."
        : recommendation === "manual_review"
          ? "No hard blocker was found, but warnings require buyer review before payment."
          : "At least one deterministic blocker prevents safe payment."
    ]
  };
}
