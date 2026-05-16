import AsyncStorage from "@react-native-async-storage/async-storage";

export type DriverLocationStatus =
  | "AVAILABLE"
  | "READY"
  | "EN_ROUTE_TO_PICKUP"
  | "ARRIVED_AT_PICKUP"
  | "PICKED_UP"
  | "EN_ROUTE_TO_DROPOFF"
  | "ARRIVED_AT_DROPOFF"
  | "DELIVERED"
  | "OFFLINE";

export type DriverLocation = {
  id: string;
  loadId: string;

  carrierId: string;
  carrierName: string;

  latitude: number;
  longitude: number;

  speed?: number;
  heading?: number;
  accuracy?: number;
  etaMinutes?: number;

  city?: string;
  state?: string;

  status: DriverLocationStatus;

  pickupStartedAt?: string;
  arrivedPickupAt?: string;
  pickedUpAt?: string;
  deliveryStartedAt?: string;
  arrivedDropoffAt?: string;
  deliveredAt?: string;

  updatedAt: string;
};

const DRIVER_LOCATIONS_KEY = "farm2homeDriverLocations";

function normalizeDriverLocation(location: any): DriverLocation {
  const now = new Date().toISOString();

  return {
    id: String(location.id || `location_${Date.now()}`),
    loadId: String(location.loadId || location.load_id || ""),

    carrierId: String(location.carrierId || location.carrier_id || ""),
    carrierName: String(
      location.carrierName || location.carrier_name || "Driver"
    ),

    latitude: Number(location.latitude || 0),
    longitude: Number(location.longitude || 0),

    speed:
      location.speed === undefined || location.speed === null
        ? undefined
        : Number(location.speed),

    heading:
      location.heading === undefined || location.heading === null
        ? undefined
        : Number(location.heading),

    accuracy:
      location.accuracy === undefined || location.accuracy === null
        ? undefined
        : Number(location.accuracy),

    etaMinutes:
      location.etaMinutes === undefined || location.etaMinutes === null
        ? undefined
        : Number(location.etaMinutes),

    city: String(location.city || ""),
    state: String(location.state || ""),

    status: location.status || "AVAILABLE",

    pickupStartedAt: String(
      location.pickupStartedAt || location.pickup_started_at || ""
    ),
    arrivedPickupAt: String(
      location.arrivedPickupAt || location.arrived_pickup_at || ""
    ),
    pickedUpAt: String(location.pickedUpAt || location.picked_up_at || ""),
    deliveryStartedAt: String(
      location.deliveryStartedAt || location.delivery_started_at || ""
    ),
    arrivedDropoffAt: String(
      location.arrivedDropoffAt || location.arrived_dropoff_at || ""
    ),
    deliveredAt: String(location.deliveredAt || location.delivered_at || ""),

    updatedAt:
      location.updatedAt ||
      location.updated_at ||
      location.timestamp ||
      now,
  };
}

function safeParseLocations(rawValue: string | null): DriverLocation[] {
  if (!rawValue) return [];

  try {
    const parsed = JSON.parse(rawValue);

    return Array.isArray(parsed)
      ? parsed.map(normalizeDriverLocation)
      : [];
  } catch (error) {
    console.log("Parse driver locations error:", error);
    return [];
  }
}

export async function getDriverLocations(): Promise<DriverLocation[]> {
  try {
    const raw = await AsyncStorage.getItem(DRIVER_LOCATIONS_KEY);
    return safeParseLocations(raw);
  } catch (error) {
    console.log("Error loading driver locations:", error);
    return [];
  }
}

export async function saveDriverLocations(
  locations: DriverLocation[]
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      DRIVER_LOCATIONS_KEY,
      JSON.stringify(locations.map(normalizeDriverLocation))
    );
  } catch (error) {
    console.log("Save driver locations error:", error);
  }
}

export async function getDriverLocationByLoadId(
  loadId: string
): Promise<DriverLocation | null> {
  const locations = await getDriverLocations();

  return locations.find((location) => location.loadId === loadId) || null;
}

export async function upsertDriverLocation(
  location: DriverLocation
): Promise<DriverLocation> {
  const locations = await getDriverLocations();

  const updatedLocation = normalizeDriverLocation({
    ...location,
    updatedAt: new Date().toISOString(),
  });

  const existingIndex = locations.findIndex(
    (item) => item.loadId === updatedLocation.loadId
  );

  if (existingIndex >= 0) {
    locations[existingIndex] = {
      ...locations[existingIndex],
      ...updatedLocation,
    };
  } else {
    locations.unshift(updatedLocation);
  }

  await saveDriverLocations(locations);

  return updatedLocation;
}

export async function updateDriverCoordinates(params: {
  loadId: string;
  carrierId: string;
  carrierName: string;
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  accuracy?: number;
  etaMinutes?: number;
  city?: string;
  state?: string;
}): Promise<DriverLocation> {
  const existing = await getDriverLocationByLoadId(params.loadId);

  const location: DriverLocation = {
    id: existing?.id || `location_${Date.now()}`,
    loadId: params.loadId,
    carrierId: params.carrierId,
    carrierName: params.carrierName,

    latitude: Number(params.latitude),
    longitude: Number(params.longitude),

    speed: params.speed,
    heading: params.heading,
    accuracy: params.accuracy,
    etaMinutes: params.etaMinutes,

    city: params.city,
    state: params.state,

    status: existing?.status || "AVAILABLE",

    pickupStartedAt: existing?.pickupStartedAt || "",
    arrivedPickupAt: existing?.arrivedPickupAt || "",
    pickedUpAt: existing?.pickedUpAt || "",
    deliveryStartedAt: existing?.deliveryStartedAt || "",
    arrivedDropoffAt: existing?.arrivedDropoffAt || "",
    deliveredAt: existing?.deliveredAt || "",

    updatedAt: new Date().toISOString(),
  };

  return upsertDriverLocation(location);
}

export async function updateDriverLocationStatus(
  loadId: string,
  status: DriverLocationStatus
): Promise<DriverLocation | null> {
  const existing = await getDriverLocationByLoadId(loadId);

  if (!existing) {
    return null;
  }

  const now = new Date().toISOString();

  const timestampUpdates: Partial<DriverLocation> = {};

  if (status === "EN_ROUTE_TO_PICKUP") {
    timestampUpdates.pickupStartedAt = existing.pickupStartedAt || now;
  }

  if (status === "ARRIVED_AT_PICKUP") {
    timestampUpdates.arrivedPickupAt = existing.arrivedPickupAt || now;
  }

  if (status === "PICKED_UP") {
    timestampUpdates.pickedUpAt = existing.pickedUpAt || now;
  }

  if (status === "EN_ROUTE_TO_DROPOFF") {
    timestampUpdates.deliveryStartedAt = existing.deliveryStartedAt || now;
  }

  if (status === "ARRIVED_AT_DROPOFF") {
    timestampUpdates.arrivedDropoffAt = existing.arrivedDropoffAt || now;
  }

  if (status === "DELIVERED") {
    timestampUpdates.deliveredAt = existing.deliveredAt || now;
  }

  const updated: DriverLocation = {
    ...existing,
    ...timestampUpdates,
    status,
    updatedAt: now,
  };

  return upsertDriverLocation(updated);
}

export async function getCarrierLocations(
  carrierId: string
): Promise<DriverLocation[]> {
  const locations = await getDriverLocations();

  return locations.filter((location) => location.carrierId === carrierId);
}

export async function removeDriverLocation(loadId: string): Promise<void> {
  const locations = await getDriverLocations();

  const updatedLocations = locations.filter(
    (location) => location.loadId !== loadId
  );

  await saveDriverLocations(updatedLocations);
}

export function calculateDistanceMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
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

export function estimateEtaMinutes(
  distanceMiles: number,
  averageMph = 35
): number {
  if (!distanceMiles || distanceMiles <= 0) {
    return 0;
  }

  return Math.ceil((distanceMiles / averageMph) * 60);
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

export const insertDriverLocation = upsertDriverLocation;
export const updateCoordinates = updateDriverCoordinates;
export const updateLocationStatus = updateDriverLocationStatus;