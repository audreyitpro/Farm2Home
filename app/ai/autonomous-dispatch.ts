import { supabase } from "../data/supabaseClient";
import {
  autoAssignBestCarrier,
  DispatchMatch,
  getSmartDispatchMatches,
} from "./smart-dispatch";

export type DispatchPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type AutonomousDispatchDecision = {
  loadId: string;
  loadTitle: string;
  priority: DispatchPriority;
  recommendedCarrierId?: string;
  recommendedCarrierName?: string;
  score: number;
  shouldAutoAssign: boolean;
  reason: string;
};

export type AutonomousDispatchSummary = {
  generatedAt: string;
  totalOpenLoads: number;
  autoAssignableLoads: number;
  manualReviewLoads: number;
  criticalLoads: number;
  decisions: AutonomousDispatchDecision[];
};

function normalize(text?: string) {
  return String(text || "").toLowerCase();
}

function getLoadPriority(match: DispatchMatch): DispatchPriority {
  const text = normalize(`${match.load.title || ""} ${match.load.commodity || ""}`);
  const rate = Number(match.load.rate || 0);

  if (
    text.includes("cold") ||
    text.includes("refrigerated") ||
    text.includes("fish") ||
    text.includes("meat") ||
    text.includes("dairy") ||
    text.includes("eggs") ||
    text.includes("medical") ||
    text.includes("urgent")
  ) {
    return "CRITICAL";
  }

  if (
    text.includes("livestock") ||
    text.includes("cattle") ||
    text.includes("poultry")
  ) {
    return "HIGH";
  }

  if (rate >= 750) {
    return "HIGH";
  }

  if (rate >= 400) {
    return "MEDIUM";
  }

  return "LOW";
}

function getAutoAssignThreshold(priority: DispatchPriority) {
  switch (priority) {
    case "CRITICAL":
      return 70;

    case "HIGH":
      return 65;

    case "MEDIUM":
      return 60;

    case "LOW":
      return 55;

    default:
      return 60;
  }
}

function buildDecisionReason(match: DispatchMatch, priority: DispatchPriority) {
  const threshold = getAutoAssignThreshold(priority);
  const autoReady = match.score >= threshold;

  const reasonParts = [
    `Priority: ${priority}`,
    `Match score: ${match.score}`,
    `Auto-assign threshold: ${threshold}`,
    `AI reason: ${match.reason}`,
  ];

  reasonParts.push(
    autoReady
      ? "Recommended for automatic assignment."
      : "Recommended for manual dispatch review."
  );

  return reasonParts.join(" | ");
}

export async function getAutonomousDispatchDecisions(): Promise<AutonomousDispatchSummary> {
  const matches = await getSmartDispatchMatches();

  const bestByLoad: Record<string, DispatchMatch> = {};

  matches.forEach((match) => {
    const existing = bestByLoad[match.load.id];

    if (!existing || match.score > existing.score) {
      bestByLoad[match.load.id] = match;
    }
  });

  const decisions: AutonomousDispatchDecision[] = Object.values(bestByLoad).map(
    (match) => {
      const priority = getLoadPriority(match);
      const threshold = getAutoAssignThreshold(priority);
      const shouldAutoAssign = match.score >= threshold;

      return {
        loadId: match.load.id,
        loadTitle: match.load.title || match.load.commodity || "Farm2Home Load",
        priority,
        recommendedCarrierId: match.carrier.id,
        recommendedCarrierName: match.carrier.companyName,
        score: match.score,
        shouldAutoAssign,
        reason: buildDecisionReason(match, priority),
      };
    }
  );

  const priorityRank: Record<DispatchPriority, number> = {
    CRITICAL: 4,
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1,
  };

  const sortedDecisions = decisions.sort((a, b) => {
    const rankDiff = priorityRank[b.priority] - priorityRank[a.priority];

    if (rankDiff !== 0) {
      return rankDiff;
    }

    return b.score - a.score;
  });

  return {
    generatedAt: new Date().toISOString(),
    totalOpenLoads: sortedDecisions.length,
    autoAssignableLoads: sortedDecisions.filter((item) => item.shouldAutoAssign)
      .length,
    manualReviewLoads: sortedDecisions.filter((item) => !item.shouldAutoAssign)
      .length,
    criticalLoads: sortedDecisions.filter((item) => item.priority === "CRITICAL")
      .length,
    decisions: sortedDecisions,
  };
}

export async function runAutonomousDispatch(options?: {
  dryRun?: boolean;
  onlyCritical?: boolean;
}) {
  const summary = await getAutonomousDispatchDecisions();

  const targetDecisions = summary.decisions.filter((decision) => {
    if (!decision.shouldAutoAssign) {
      return false;
    }

    if (options?.onlyCritical && decision.priority !== "CRITICAL") {
      return false;
    }

    return true;
  });

  const results: Array<{
    loadId: string;
    loadTitle: string;
    assigned: boolean;
    reason: string;
    carrierName?: string;
  }> = [];

  for (const decision of targetDecisions) {
    if (options?.dryRun) {
      results.push({
        loadId: decision.loadId,
        loadTitle: decision.loadTitle,
        assigned: false,
        reason: "Dry run only. No carrier assigned.",
        carrierName: decision.recommendedCarrierName,
      });

      continue;
    }

    const result = await autoAssignBestCarrier(decision.loadId);

    results.push({
      loadId: decision.loadId,
      loadTitle: decision.loadTitle,
      assigned: result.assigned,
      reason: result.reason,
      carrierName: result.match?.carrier.companyName,
    });
  }

  await saveDispatchRunLog({
    dryRun: Boolean(options?.dryRun),
    onlyCritical: Boolean(options?.onlyCritical),
    summary,
    results,
  });

  return {
    generatedAt: new Date().toISOString(),
    dryRun: Boolean(options?.dryRun),
    onlyCritical: Boolean(options?.onlyCritical),
    attemptedAssignments: targetDecisions.length,
    successfulAssignments: results.filter((item) => item.assigned).length,
    summary,
    results,
  };
}

async function saveDispatchRunLog(params: {
  dryRun: boolean;
  onlyCritical: boolean;
  summary: AutonomousDispatchSummary;
  results: any[];
}) {
  try {
    await supabase.from("autonomous_dispatch_logs").insert({
      dry_run: params.dryRun,
      only_critical: params.onlyCritical,
      total_open_loads: params.summary.totalOpenLoads,
      auto_assignable_loads: params.summary.autoAssignableLoads,
      manual_review_loads: params.summary.manualReviewLoads,
      critical_loads: params.summary.criticalLoads,
      successful_assignments: params.results.filter((item) => item.assigned)
        .length,
      results: params.results,
      summary: params.summary,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.log("Save autonomous dispatch log error:", error);
  }
}

export async function getDispatchRiskAlerts() {
  const summary = await getAutonomousDispatchDecisions();

  return summary.decisions
    .filter(
      (decision) =>
        decision.priority === "CRITICAL" ||
        !decision.shouldAutoAssign ||
        decision.score < 60
    )
    .map((decision) => ({
      loadId: decision.loadId,
      loadTitle: decision.loadTitle,
      priority: decision.priority,
      score: decision.score,
      alert:
        decision.priority === "CRITICAL"
          ? "Critical load needs dispatch attention."
          : decision.score < 60
          ? "Low AI match score."
          : "Manual review recommended.",
      reason: decision.reason,
    }));
}

export async function getAutonomousDispatchHistory() {
  try {
    const { data, error } = await supabase
      .from("autonomous_dispatch_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    console.log("Autonomous dispatch history unavailable:", error);
    return [];
  }
}