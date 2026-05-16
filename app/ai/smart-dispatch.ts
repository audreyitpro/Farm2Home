import { supabase } from "../data/supabaseClient";

export type DispatchCarrier = {
  id: string;
  companyName: string;
  contactName?: string;
  email?: string;
  phone?: string;
  currentCity?: string;
  currentState?: string;
  approved?: boolean;
  refrigerated?: boolean;
  livestock?: boolean;
};

export type DispatchLoad = {
  id: string;
  title?: string;
  commodity?: string;
  pickupCity: string;
  pickupState: string;
  deliveryCity: string;
  deliveryState: string;
  rate: number;
  status: string;
  requiresRefrigerated?: boolean;
  requiresLivestock?: boolean;
};

export type DispatchMatch = {
  carrier: DispatchCarrier;
  load: DispatchLoad;
  score: number;
  reason: string;
  estimatedMiles: number;
  estimatedEtaMinutes: number;
};

const CITY_COORDINATES: Record<string, { latitude: number; longitude: number }> =
  {
    "detroit,mi": { latitude: 42.3314, longitude: -83.0458 },
    "sterling heights,mi": { latitude: 42.5803, longitude: -83.0302 },
    "ann arbor,mi": { latitude: 42.2808, longitude: -83.743 },
    "lansing,mi": { latitude: 42.7325, longitude: -84.5555 },
    "grand rapids,mi": { latitude: 42.9634, longitude: -85.6681 },
    "flint,mi": { latitude: 43.0125, longitude: -83.6875 },
    "toledo,oh": { latitude: 41.6528, longitude: -83.5379 },
    "cleveland,oh": { latitude: 41.4993, longitude: -81.6944 },
    "columbus,oh": { latitude: 39.9612, longitude: -82.9988 },
    "chicago,il": { latitude: 41.8781, longitude: -87.6298 },
  };

function normalizeCityState(city?: string, state?: string) {
  return `${city || ""},${state || ""}`.toLowerCase().trim();
}

function normalizeText(value?: string) {
  return String(value || "").toLowerCase();
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function calculateDistanceMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const earthRadiusMiles = 3958.8;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusMiles * c;
}

export function estimateEtaMinutes(distanceMiles: number, averageMph = 42) {
  if (!distanceMiles || distanceMiles <= 0) return 0;

  return Math.ceil((distanceMiles / averageMph) * 60);
}

function estimateDistanceBetweenCities(
  cityA?: string,
  stateA?: string,
  cityB?: string,
  stateB?: string
) {
  const keyA = normalizeCityState(cityA, stateA);
  const keyB = normalizeCityState(cityB, stateB);

  const coordA = CITY_COORDINATES[keyA];
  const coordB = CITY_COORDINATES[keyB];

  if (!coordA || !coordB) return 75;

  return calculateDistanceMiles(
    coordA.latitude,
    coordA.longitude,
    coordB.latitude,
    coordB.longitude
  );
}

function commodityRequiresRefrigeration(commodity?: string) {
  const text = normalizeText(commodity);

  return (
    text.includes("refrigerated") ||
    text.includes("cold") ||
    text.includes("fish") ||
    text.includes("seafood") ||
    text.includes("dairy") ||
    text.includes("meat") ||
    text.includes("poultry") ||
    text.includes("eggs")
  );
}

function commodityRequiresLivestock(commodity?: string) {
  const text = normalizeText(commodity);

  return (
    text.includes("livestock") ||
    text.includes("cattle") ||
    text.includes("goat") ||
    text.includes("sheep") ||
    text.includes("lamb") ||
    text.includes("pigs") ||
    text.includes("hogs")
  );
}

export function scoreCarrierForLoad(
  carrier: DispatchCarrier,
  load: DispatchLoad
): DispatchMatch {
  let score = 50;
  const reasons: string[] = [];

  const distanceToPickup = estimateDistanceBetweenCities(
    carrier.currentCity || load.pickupCity,
    carrier.currentState || load.pickupState,
    load.pickupCity,
    load.pickupState
  );

  const routeDistance = estimateDistanceBetweenCities(
    load.pickupCity,
    load.pickupState,
    load.deliveryCity,
    load.deliveryState
  );

  if (carrier.approved) {
    score += 15;
    reasons.push("approved carrier");
  }

  if (distanceToPickup <= 25) {
    score += 25;
    reasons.push("very close to pickup");
  } else if (distanceToPickup <= 75) {
    score += 15;
    reasons.push("near pickup");
  } else if (distanceToPickup <= 150) {
    score += 5;
    reasons.push("reasonable pickup distance");
  } else {
    score -= 15;
    reasons.push("far from pickup");
  }

  const needsReefer =
    load.requiresRefrigerated || commodityRequiresRefrigeration(load.commodity);

  const needsLivestock =
    load.requiresLivestock || commodityRequiresLivestock(load.commodity);

  if (needsReefer && carrier.refrigerated) {
    score += 20;
    reasons.push("refrigerated capable");
  }

  if (needsReefer && !carrier.refrigerated) {
    score -= 35;
    reasons.push("missing refrigerated capability");
  }

  if (needsLivestock && carrier.livestock) {
    score += 20;
    reasons.push("livestock capable");
  }

  if (needsLivestock && !carrier.livestock) {
    score -= 35;
    reasons.push("missing livestock capability");
  }

  if (Number(load.rate || 0) >= 500) {
    score += 8;
    reasons.push("high-value load");
  }

  if (routeDistance <= 100) {
    score += 8;
    reasons.push("short regional route");
  }

  score = Math.max(0, Math.min(100, score));

  return {
    carrier,
    load,
    score,
    reason: reasons.join(", ") || "standard match",
    estimatedMiles: Math.round(distanceToPickup + routeDistance),
    estimatedEtaMinutes: estimateEtaMinutes(distanceToPickup + routeDistance),
  };
}

export async function getOpenSupabaseLoads(): Promise<DispatchLoad[]> {
  const { data, error } = await supabase
    .from("freight_loads")
    .select("*")
    .in("status", ["OPEN", "POSTED"])
    .order("created_at", { ascending: false });

  if (error) {
    console.log("Smart dispatch load fetch error:", error.message);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    title: row.title,
    commodity: row.commodity,
    pickupCity: row.pickup_city || "",
    pickupState: row.pickup_state || "",
    deliveryCity: row.delivery_city || "",
    deliveryState: row.delivery_state || "",
    rate: Number(row.rate || 0),
    status: row.status || "OPEN",
    requiresRefrigerated:
      Boolean(row.temperature_controlled) ||
      commodityRequiresRefrigeration(row.commodity),
    requiresLivestock: commodityRequiresLivestock(row.commodity),
  }));
}

export async function getApprovedSupabaseCarriers(): Promise<
  DispatchCarrier[]
> {
  const { data, error } = await supabase
    .from("freight_carriers")
    .select("*")
    .eq("approved", true)
    .order("created_at", { ascending: false });

  if (error) {
    console.log("Smart dispatch carrier fetch error:", error.message);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    companyName: row.company_name || "Freight Carrier",
    contactName: row.contact_name || "",
    email: row.email || "",
    phone: row.phone || "",
    currentCity: row.city || "Detroit",
    currentState: row.state || "MI",
    approved: row.approved,
    refrigerated:
      Boolean(row.refrigerated) ||
      Boolean(row.refrigerated_equipment) ||
      normalizeText(row.insurance_provider).includes("reefer") ||
      normalizeText(row.company_name).includes("cold"),
    livestock:
      Boolean(row.livestock) ||
      Boolean(row.livestock_equipment) ||
      normalizeText(row.company_name).includes("livestock"),
  }));
}

export async function getSmartDispatchMatches(): Promise<DispatchMatch[]> {
  const loads = await getOpenSupabaseLoads();
  const carriers = await getApprovedSupabaseCarriers();

  const matches: DispatchMatch[] = [];

  loads.forEach((load) => {
    carriers.forEach((carrier) => {
      matches.push(scoreCarrierForLoad(carrier, load));
    });
  });

  return matches.sort((a, b) => b.score - a.score);
}

export async function getBestCarrierForLoad(loadId: string) {
  const matches = await getSmartDispatchMatches();

  return matches.find((match) => match.load.id === loadId) || null;
}

export async function autoAssignBestCarrier(loadId: string) {
  const bestMatch = await getBestCarrierForLoad(loadId);

  if (!bestMatch || bestMatch.score < 50) {
    return {
      assigned: false,
      reason: "No strong carrier match found.",
      match: bestMatch,
    };
  }

  const { error } = await supabase
    .from("freight_loads")
    .update({
      carrier_id: bestMatch.carrier.id,
      assigned_carrier_id: bestMatch.carrier.id,
      status: "BOOKED",
      ai_dispatch_score: bestMatch.score,
      ai_dispatch_reason: bestMatch.reason,
      ai_dispatch_estimated_miles: bestMatch.estimatedMiles,
      ai_dispatch_eta_minutes: bestMatch.estimatedEtaMinutes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", loadId);

  if (error) {
    return {
      assigned: false,
      reason: error.message,
      match: bestMatch,
    };
  }

  return {
    assigned: true,
    reason: "Best carrier assigned successfully.",
    match: bestMatch,
  };
}

export async function recommendDispatchPlan() {
  const matches = await getSmartDispatchMatches();

  const seenLoads = new Set<string>();
  const seenCarriers = new Set<string>();
  const plan: DispatchMatch[] = [];

  for (const match of matches) {
    if (seenLoads.has(match.load.id)) {
      continue;
    }

    if (seenCarriers.has(match.carrier.id)) {
      continue;
    }

    plan.push(match);
    seenLoads.add(match.load.id);
    seenCarriers.add(match.carrier.id);
  }

  return plan;
}