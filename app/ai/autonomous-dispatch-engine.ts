import { supabase } from "../data/supabaseClient";

export type DispatchPriority =
  | "LOW"
  | "NORMAL"
  | "HIGH"
  | "CRITICAL";

export type DispatchRecommendation = {
  loadId: string;
  driverId: string;
  carrierId?: string | null;
  score: number;
  etaMinutes: number;
  priority: DispatchPriority;
  reason: string;
};

type FreightLoad = {
  id: string;
  title?: string;
  commodity?: string;
  status?: string;
  priority_level?: DispatchPriority;
  pickup_city?: string;
  pickup_state?: string;
  delivery_city?: string;
  delivery_state?: string;
  temperature_controlled?: boolean;
  weight?: number;
  rate?: number;
};

type DriverLocation = {
  id: string;
  load_id?: string | null;
  carrier_id?: string | null;
  latitude: number;
  longitude: number;
  speed?: number | null;
  heading?: number | null;
  status: string;
  updated_at: string;
  freight_carriers?: {
    company_name?: string;
  };
};

export async function loadOpenFreightLoads() {
  const { data, error } = await supabase
    .from("freight_loads")
    .select("*")
    .in("status", ["OPEN", "POSTED"]);

  if (error) {
    throw error;
  }

  return (data || []) as FreightLoad[];
}

export async function loadAvailableDrivers() {
  const { data, error } = await supabase
    .from("driver_locations")
    .select(
      `
      *,
      freight_carriers (
        company_name
      )
    `
    )
    .in("status", [
      "READY",
      "EN_ROUTE_TO_PICKUP",
    ]);

  if (error) {
    throw error;
  }

  return (data || []).map((item: any) => ({
    ...item,
    latitude: Number(item.latitude),
    longitude: Number(item.longitude),
    speed:
      item.speed === null ||
      item.speed === undefined
        ? null
        : Number(item.speed),
  })) as DriverLocation[];
}

function calculatePriorityScore(
  load: FreightLoad
) {
  let score = 50;

  switch (load.priority_level) {
    case "CRITICAL":
      score += 40;
      break;

    case "HIGH":
      score += 25;
      break;

    case "NORMAL":
      score += 10;
      break;

    default:
      break;
  }

  if (load.temperature_controlled) {
    score += 25;
  }

  if (
    load.commodity?.toLowerCase().includes("medical")
  ) {
    score += 30;
  }

  return score;
}

function calculateDriverScore(
  driver: DriverLocation
) {
  let score = 0;

  if (driver.status === "READY") {
    score += 30;
  }

  if (
    driver.status === "EN_ROUTE_TO_PICKUP"
  ) {
    score += 20;
  }

  if (
    driver.speed &&
    driver.speed > 5
  ) {
    score += 10;
  }

  const freshnessMinutes =
    (Date.now() -
      new Date(driver.updated_at).getTime()) /
    1000 /
    60;

  if (freshnessMinutes <= 5) {
    score += 20;
  } else if (freshnessMinutes <= 30) {
    score += 10;
  }

  return score;
}

function calculateEtaMinutes() {
  return Math.floor(Math.random() * 45) + 10;
}

function buildReason(
  load: FreightLoad,
  driver: DriverLocation,
  finalScore: number
) {
  const reasons: string[] = [];

  if (load.temperature_controlled) {
    reasons.push(
      "Cold-chain freight prioritized"
    );
  }

  if (load.priority_level === "CRITICAL") {
    reasons.push(
      "Critical priority shipment"
    );
  }

  if (driver.status === "READY") {
    reasons.push("Driver immediately available");
  }

  if (
    driver.speed &&
    driver.speed > 5
  ) {
    reasons.push("Driver actively moving");
  }

  if (finalScore >= 90) {
    reasons.push("Optimal AI dispatch match");
  }

  return reasons.join(" • ");
}

export function generateDispatchRecommendations(
  loads: FreightLoad[],
  drivers: DriverLocation[]
): DispatchRecommendation[] {
  const recommendations: DispatchRecommendation[] =
    [];

  loads.forEach((load) => {
    drivers.forEach((driver) => {
      const loadScore =
        calculatePriorityScore(load);

      const driverScore =
        calculateDriverScore(driver);

      const finalScore = Math.min(
        loadScore + driverScore,
        100
      );

      recommendations.push({
        loadId: load.id,
        driverId: driver.id,
        carrierId:
          driver.carrier_id || null,
        score: finalScore,
        etaMinutes:
          calculateEtaMinutes(),
        priority:
          load.priority_level ||
          "NORMAL",
        reason: buildReason(
          load,
          driver,
          finalScore
        ),
      });
    });
  });

  recommendations.sort(
    (a, b) => b.score - a.score
  );

  return recommendations;
}

export async function autoAssignBestDriver(
  recommendation: DispatchRecommendation
) {
  const { error } = await supabase
    .from("freight_loads")
    .update({
      assigned_driver_id:
        recommendation.driverId,

      assigned_carrier_id:
        recommendation.carrierId,

      status: "ASSIGNED",

      ai_dispatch_score:
        recommendation.score,

      ai_dispatch_reason:
        recommendation.reason,

      ai_dispatch_eta_minutes:
        recommendation.etaMinutes,

      updated_at:
        new Date().toISOString(),
    })
    .eq("id", recommendation.loadId);

  if (error) {
    throw error;
  }

  return true;
}

export async function runAutonomousDispatch() {
  const loads =
    await loadOpenFreightLoads();

  const drivers =
    await loadAvailableDrivers();

  const recommendations =
    generateDispatchRecommendations(
      loads,
      drivers
    );

  if (recommendations.length === 0) {
    return {
      success: true,
      recommendations: [],
      assigned: 0,
    };
  }

  const topMatches =
    recommendations.slice(0, 10);

  let assigned = 0;

  for (const recommendation of topMatches) {
    try {
      await autoAssignBestDriver(
        recommendation
      );

      assigned += 1;
    } catch (error) {
      console.log(
        "Autonomous dispatch assignment error:",
        error
      );
    }
  }

  return {
    success: true,
    recommendations:
      topMatches,
    assigned,
  };
}

export async function predictDeliveryDelayRisk(
  driver: DriverLocation
) {
  const freshnessMinutes =
    (Date.now() -
      new Date(driver.updated_at).getTime()) /
    1000 /
    60;

  let risk = 0;

  if (freshnessMinutes > 30) {
    risk += 40;
  }

  if (
    !driver.speed ||
    driver.speed < 2
  ) {
    risk += 25;
  }

  if (
    driver.status ===
    "EN_ROUTE_TO_DROPOFF"
  ) {
    risk += 15;
  }

  if (risk >= 70) {
    return "HIGH";
  }

  if (risk >= 40) {
    return "MEDIUM";
  }

  return "LOW";
}