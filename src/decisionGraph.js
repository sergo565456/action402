import { buildTrustSummary } from "./trustSummary.js";
import { createDecision, executionStats, getReceipt, listRecentDecisions, listRecentJobs, storeStats } from "./store.js";
import {
  actionHashForWebhook,
  createDecisionRecord,
  normalizeDecisionEnvelope,
  publicDecisionRecord,
  publicDecisionSummary
} from "./decisionState.js";
import { runPaymentAnalyst } from "./decisionRoles/paymentAnalyst.js";
import { runPolicyAnalyst } from "./decisionRoles/policyAnalyst.js";
import { runTrustAnalyst } from "./decisionRoles/trustAnalyst.js";
import { runExecutionAnalyst } from "./decisionRoles/executionAnalyst.js";
import { runRiskManager } from "./decisionRoles/riskManager.js";

function debateFromReports(roleReports, decision) {
  return [
    roleReports.paymentAnalyst,
    roleReports.policyAnalyst,
    roleReports.trustAnalyst,
    roleReports.executionAnalyst,
    {
      id: "riskManager",
      title: "Risk Manager",
      stance: decision.recommendation === "do_not_pay" ? "block" : decision.recommendation === "manual_review" ? "warn" : "approve",
      reasons: decision.reasons,
      warnings: decision.warnings,
      blockingIssues: decision.blockingIssues
    }
  ].map((report) => ({
    speaker: report.id,
    title: report.title,
    stance: report.stance,
    reason: report.blockingIssues?.[0] || report.warnings?.[0] || report.reasons?.[0] || "No comment."
  }));
}

function defaultTrustDependencies() {
  return {
    buildTrustSummary,
    executionStats,
    storeStats,
    listRecentJobs,
    listRecentDecisions,
    getReceipt
  };
}

export async function decideWebhook(input = {}, options = {}) {
  const { action, buyerPolicy, mode } = normalizeDecisionEnvelope(input);
  const trustDependencies = options.trustDependencies || defaultTrustDependencies();

  const paymentAnalyst = runPaymentAnalyst({ buyerPolicy });
  const policyAnalyst = await runPolicyAnalyst({ action, buyerPolicy });
  const trustAnalyst = await runTrustAnalyst({ buyerPolicy, trustDependencies });
  const executionAnalyst = runExecutionAnalyst({ action, policyReport: policyAnalyst, buyerPolicy });

  const roleReports = {
    paymentAnalyst,
    policyAnalyst,
    trustAnalyst,
    executionAnalyst
  };
  const decision = runRiskManager({ roleReports });
  const debate = debateFromReports(roleReports, decision);
  const record = createDecisionRecord({
    action,
    buyerPolicy,
    roleReports,
    debate,
    decision,
    trustSnapshot: {
      score: trustAnalyst.score,
      grade: trustAnalyst.grade,
      status: trustAnalyst.status,
      recentFailureRate: trustAnalyst.recentFailureRate,
      recentVerifiedProofs: trustAnalyst.recentVerifiedProofs
    }
  });

  const saved = options.persist === false ? record : await createDecision(record);
  return {
    ...saved,
    mode
  };
}

export function decisionMatchesAction(decision, action) {
  return decision?.actionHash === actionHashForWebhook(action);
}

export function renderDecisionResponse(decision) {
  return {
    ok: true,
    decisionId: decision.id,
    recommendation: decision.decision.recommendation,
    confidence: decision.decision.confidence,
    blockingIssues: decision.decision.blockingIssues,
    warnings: decision.decision.warnings,
    reasons: decision.decision.reasons,
    roleReports: decision.roleReports,
    debate: decision.debate,
    publicRecord: publicDecisionRecord(decision),
    links: {
      decision: `/api/decisions/${decision.id}`,
      decisionPage: `/decision/${decision.id}`,
      recentDecisions: "/api/decisions/recent",
      execute: "/api/execute/webhook",
      guidedExecute: "/api/execute/guided-webhook",
      policyCheck: "/api/policy/check",
      pricing: "/api/pricing",
      trust: "/api/trust"
    }
  };
}

export { publicDecisionRecord, publicDecisionSummary };
