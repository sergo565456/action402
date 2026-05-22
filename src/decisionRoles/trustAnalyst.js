export async function runTrustAnalyst({ buyerPolicy, trustDependencies }) {
  const trust = await trustDependencies.buildTrustSummary(trustDependencies);
  const minTrustScore = Number.parseInt(buyerPolicy.minTrustScore ?? 55, 10);
  const score = trust.trustScore?.score ?? 0;
  const maxScore = trust.trustScore?.maxScore ?? 100;
  const normalizedScore = maxScore > 0 ? Math.round((score / maxScore) * 100) : score;
  const blockingIssues = [];
  const warnings = [];

  if (normalizedScore < minTrustScore) {
    warnings.push(`Trust score ${normalizedScore} is below buyer threshold ${minTrustScore}.`);
  }

  if (trust.execution?.recentFailureRate > 0.25) {
    warnings.push(`Recent failure rate is ${(trust.execution.recentFailureRate * 100).toFixed(1)}%.`);
  }

  return {
    id: "trustAnalyst",
    title: "Trust Analyst",
    stance: warnings.length > 0 ? "warn" : "approve",
    score: normalizedScore,
    grade: trust.trustScore?.grade || null,
    status: trust.status,
    recentFailureRate: trust.execution?.recentFailureRate ?? 0,
    recentVerifiedProofs: trust.proofExamples?.recentVerifiedProofs ?? 0,
    durableStorage: trust.storage?.durable === true,
    blockingIssues,
    warnings,
    reasons: [trust.trustScore?.summary || "Trust summary inspected."]
  };
}
