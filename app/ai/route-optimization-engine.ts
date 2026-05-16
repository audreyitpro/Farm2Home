// app/ai/route-optimization-engine.ts

export type RouteStopType = "pickup" | "dropoff" | "return" | "fuel";

export type FreightLoadStatus =
  | "open"
  | "posted"
  | "accepted"
  | "assigned"
  | "in_progress"
  | "picked_up"
  | "delivered"
  | "completed"
  | "cancelled";

export type FreightLoadForRouting = {
  id: string;
  pickup_location?: string | null;
  dropoff_location?: string | null;
  pickup_address?: string | null;
  dropoff_address?: string | null;
  distance_miles?: number | string | null;
  rate?: number | string | null;
  status?: FreightLoadStatus | string | null;
  pickup_time?: string | null;
  delivery_time?: string | null;
  temperature_controlled?: boolean | null;
  cold_chain_required?: boolean | null;
  livestock_required?: boolean | null;
};

export type RouteStop = {
  id: string;
  loadId?: string;
  type: RouteStopType;
  title: string;
  address?: string;
  city?: string;
  state?: string;
  fullLocation?: string;
  latitude?: number;
  longitude?: number;
  priority?: number;
  timeWindowStart?: string;
  timeWindowEnd?: string;
  coldChainRequired?: boolean;
  livestockRequired?: boolean;
  rate?: number;
  distanceMiles?: number;
};

export type OptimizedRouteStop = RouteStop & {
  sequence: number;
  estimatedArrivalMinutes: number;
  estimatedDistanceMiles: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  reason: string;
};

export type RouteOptimizationResult = {
  totalMiles: number;
  totalMinutes: number;
  fuelCostEstimate: number;
  revenueEstimate: number;
  revenuePerMile: number;
  coldChainRisk: "LOW" | "MEDIUM" | "HIGH";
  routeRisk: "LOW" | "MEDIUM" | "HIGH";
  stops: OptimizedRouteStop[];
  summary: string;
};

const DEFAULT_MPG = 18;
const DEFAULT_DIESEL_PRICE = 4.15;
const DEFAULT_AVERAGE_SPEED_MPH = 48;

const CITY_COORDINATES: Record<string, { latitude: number; longitude: number }> =
  {
    "detroit,mi": { latitude: 42.3314, longitude: -83.0458 },
    "sterling heights,mi": { latitude: 42.5803, longitude: -83.0302 },
    "ann arbor,mi": { latitude: 42.2808, longitude: -83.743 },
    "lansing,mi": { latitude: 42.7325, longitude: -84.5555 },
    "grand rapids,mi": { latitude: 42.9634, longitude: -85.6681 },
    "flint,mi": { latitude: 43.0125, longitude: -83.6875 },
    "pontiac,mi": { latitude: 42.6389, longitude: -83.291 },
    "royal oak,mi": { latitude: 42.4895, longitude: -83.1446 },
    "southfield,mi": { latitude: 42.4734, longitude: -83.2219 },
    "troy,mi": { latitude: 42.6064, longitude: -83.1498 },
    "warren,mi": { latitude: 42.5145, longitude: -83.0147 },
    "toledo,oh": { latitude: 41.6528, longitude: -83.5379 },
    "cleveland,oh": { latitude: 41.4993, longitude: -81.6944 },
    "columbus,oh": { latitude: 39.9612, longitude: -82.9988 },
    "chicago,il": { latitude: 41.8781, longitude: -87.6298 },
    "indianapolis,in": { latitude: 39.7684, longitude: -86.1581 },
  };

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string") {
    const cleaned = value.replace(/[$,]/g, "").trim();
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed)) return parsed;
  }

  return fallback;
}

function normalizeLocationKey(value?: string | null): string {
  if (!value) return "";

  return value
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\./g, "")
    .replace(/,\s+/g, ",")
    .trim();
}

function parseLocation(location?: string | null): {
  city?: string;
  state?: string;
  fullLocation?: string;
  latitude?: number;
  longitude?: number;
} {
  if (!location || !location.trim()) {
    return {};
  }

  const fullLocation = location.trim();

  const parts = fullLocation
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  let city = "";
  let state = "";

  if (parts.length >= 2) {
    city = parts[0];
    state = parts[1].split(" ")[0];
  } else {
    city = fullLocation;
  }

  const key = normalizeLocationKey(
    state ? `${city},${state}` : fullLocation
  );

  const coords = CITY_COORDINATES[key];

  return {
    city: city || undefined,
    state: state || undefined,
    fullLocation,
    latitude: coords?.latitude,
    longitude: coords?.longitude,
  };
}

function haversineMiles(a: RouteStop, b: RouteStop): number {
  if (
    typeof a.latitude !== "number" ||
    typeof a.longitude !== "number" ||
    typeof b.latitude !== "number" ||
    typeof b.longitude !== "number"
  ) {
    return 0;
  }

  const radiusMiles = 3958.8;

  const toRad = (degrees: number) => (degrees * Math.PI) / 180;

  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);

  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const calc =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  return radiusMiles * 2 * Math.atan2(Math.sqrt(calc), Math.sqrt(1 - calc));
}

function getStopRisk(stop: RouteStop): {
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  reason: string;
} {
  if (stop.coldChainRequired && !stop.timeWindowStart) {
    return {
      riskLevel: "HIGH",
      reason: "Cold-chain load has no pickup or delivery time window.",
    };
  }

  if (stop.livestockRequired) {
    return {
      riskLevel: "MEDIUM",
      reason: "Livestock load requires tighter handling and timing.",
    };
  }

  if (!stop.latitude || !stop.longitude) {
    return {
      riskLevel: "MEDIUM",
      reason: "Location could not be matched to coordinates.",
    };
  }

  return {
    riskLevel: "LOW",
    reason: "Stop has usable location data and no major handling risk.",
  };
}

function calculateOverallRisk(
  stops: OptimizedRouteStop[]
): "LOW" | "MEDIUM" | "HIGH" {
  if (stops.some((stop) => stop.riskLevel === "HIGH")) return "HIGH";
  if (stops.some((stop) => stop.riskLevel === "MEDIUM")) return "MEDIUM";
  return "LOW";
}

function calculateColdChainRisk(
  stops: OptimizedRouteStop[]
): "LOW" | "MEDIUM" | "HIGH" {
  const coldStops = stops.filter((stop) => stop.coldChainRequired);

  if (coldStops.length === 0) return "LOW";

  if (coldStops.some((stop) => stop.riskLevel === "HIGH")) return "HIGH";

  if (coldStops.length >= 4) return "MEDIUM";

  return "LOW";
}

function buildStopsFromLoad(load: FreightLoadForRouting): RouteStop[] {
  const pickup = parseLocation(load.pickup_location);
  const dropoff = parseLocation(load.dropoff_location);

  const distanceMiles = toNumber(load.distance_miles, 0);
  const rate = toNumber(load.rate, 0);

  const coldChainRequired =
    Boolean(load.cold_chain_required) ||
    Boolean(load.temperature_controlled);

  const livestockRequired = Boolean(load.livestock_required);

  const pickupStop: RouteStop = {
    id: `${load.id}-pickup`,
    loadId: load.id,
    type: "pickup",
    title: "Pickup",
    address: load.pickup_address || undefined,
    city: pickup.city,
    state: pickup.state,
    fullLocation: pickup.fullLocation,
    latitude: pickup.latitude,
    longitude: pickup.longitude,
    priority: 1,
    timeWindowStart: load.pickup_time || undefined,
    coldChainRequired,
    livestockRequired,
    rate,
    distanceMiles,
  };

  const dropoffStop: RouteStop = {
    id: `${load.id}-dropoff`,
    loadId: load.id,
    type: "dropoff",
    title: "Dropoff",
    address: load.dropoff_address || undefined,
    city: dropoff.city,
    state: dropoff.state,
    fullLocation: dropoff.fullLocation,
    latitude: dropoff.latitude,
    longitude: dropoff.longitude,
    priority: 2,
    timeWindowEnd: load.delivery_time || undefined,
    coldChainRequired,
    livestockRequired,
    rate,
    distanceMiles,
  };

  return [pickupStop, dropoffStop];
}

export function buildRouteStopsFromFreightLoads(
  loads: FreightLoadForRouting[]
): RouteStop[] {
  const activeStatuses = new Set([
    "open",
    "posted",
    "accepted",
    "assigned",
    "in_progress",
    "picked_up",
  ]);

  return loads
    .filter((load) => {
      const status = String(load.status || "open").toLowerCase();
      return activeStatuses.has(status);
    })
    .flatMap(buildStopsFromLoad);
}

export function optimizeRouteStops(
  stops: RouteStop[]
): RouteOptimizationResult {
  const orderedStops = [...stops].sort((a, b) => {
    const priorityA = a.priority ?? 99;
    const priorityB = b.priority ?? 99;

    if (priorityA !== priorityB) return priorityA - priorityB;

    if (a.type === "pickup" && b.type === "dropoff") return -1;
    if (a.type === "dropoff" && b.type === "pickup") return 1;

    return a.title.localeCompare(b.title);
  });

  let totalMiles = 0;
  let totalMinutes = 0;

  const optimizedStops: OptimizedRouteStop[] = orderedStops.map(
    (stop, index) => {
      let estimatedDistanceMiles = 0;

      if (index > 0) {
        const previousStop = orderedStops[index - 1];
        const geoDistance = haversineMiles(previousStop, stop);

        estimatedDistanceMiles =
          geoDistance > 0
            ? geoDistance
            : toNumber(stop.distanceMiles, 0) / 2;
      }

      totalMiles += estimatedDistanceMiles;

      const travelMinutes =
        estimatedDistanceMiles > 0
          ? Math.round(
              (estimatedDistanceMiles / DEFAULT_AVERAGE_SPEED_MPH) * 60
            )
          : 15;

      totalMinutes += travelMinutes;

      const risk = getStopRisk(stop);

      return {
        ...stop,
        sequence: index + 1,
        estimatedArrivalMinutes: totalMinutes,
        estimatedDistanceMiles: Number(estimatedDistanceMiles.toFixed(1)),
        riskLevel: risk.riskLevel,
        reason: risk.reason,
      };
    }
  );

  const revenueEstimate = optimizedStops.reduce((sum, stop) => {
    if (stop.type !== "pickup") return sum;

    return sum + toNumber(stop.rate, 0);
  }, 0);

  const fallbackMiles = optimizedStops.reduce((sum, stop) => {
    if (stop.type !== "pickup") return sum;
    return sum + toNumber(stop.distanceMiles, 0);
  }, 0);

  const finalTotalMiles = totalMiles > 0 ? totalMiles : fallbackMiles;

  const fuelCostEstimate =
    finalTotalMiles > 0
      ? (finalTotalMiles / DEFAULT_MPG) * DEFAULT_DIESEL_PRICE
      : 0;

  const revenuePerMile =
    finalTotalMiles > 0 ? revenueEstimate / finalTotalMiles : 0;

  const routeRisk = calculateOverallRisk(optimizedStops);
  const coldChainRisk = calculateColdChainRisk(optimizedStops);

  const summary =
    optimizedStops.length === 0
      ? "No active freight loads are available for route optimization."
      : `Optimized ${optimizedStops.length} stops across ${finalTotalMiles.toFixed(
          1
        )} miles with an estimated revenue of $${revenueEstimate.toFixed(
          2
        )}.`;

  return {
    totalMiles: Number(finalTotalMiles.toFixed(1)),
    totalMinutes,
    fuelCostEstimate: Number(fuelCostEstimate.toFixed(2)),
    revenueEstimate: Number(revenueEstimate.toFixed(2)),
    revenuePerMile: Number(revenuePerMile.toFixed(2)),
    coldChainRisk,
    routeRisk,
    stops: optimizedStops,
    summary,
  };
}

export function optimizeFreightLoads(
  loads: FreightLoadForRouting[]
): RouteOptimizationResult {
  const stops = buildRouteStopsFromFreightLoads(loads);
  return optimizeRouteStops(stops);
}

export function formatRouteMinutes(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "0 min";

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) return `${remainingMinutes} min`;

  return `${hours} hr ${remainingMinutes} min`;
}

export function getRouteOptimizationHealth(result: RouteOptimizationResult): {
  label: string;
  message: string;
} {
  if (result.stops.length === 0) {
    return {
      label: "No Route",
      message: "There are no active loads to optimize right now.",
    };
  }

  if (result.routeRisk === "HIGH") {
    return {
      label: "High Risk",
      message:
        "Review cold-chain timing, missing coordinates, or special handling requirements before dispatch.",
    };
  }

  if (result.revenuePerMile < 1.5) {
    return {
      label: "Low Margin",
      message:
        "This route may not generate enough revenue per mile. Review rate and distance.",
    };
  }

  return {
    label: "Optimized",
    message: "Route looks healthy for dispatch.",
  };
}