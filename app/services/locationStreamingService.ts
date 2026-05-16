import * as Location from "expo-location";
import { supabase } from "./supabaseClient";

export type DriverGpsStatus =
  | "READY"
  | "EN_ROUTE_TO_PICKUP"
  | "ARRIVED_AT_PICKUP"
  | "PICKED_UP"
  | "EN_ROUTE_TO_DROPOFF"
  | "ARRIVED_AT_DROPOFF"
  | "DELIVERED";

export async function requestDriverLocationPermission() {
  const foreground = await Location.requestForegroundPermissionsAsync();

  if (!foreground.granted) {
    return {
      granted: false,
      error: "Foreground location permission denied.",
    };
  }

  return {
    granted: true,
  };
}

export async function getCurrentDriverLocation() {
  const permission = await requestDriverLocationPermission();

  if (!permission.granted) {
    throw new Error(permission.error || "Location permission denied.");
  }

  return Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });
}

export async function upsertDriverLocation({
  loadId,
  carrierId,
  status,
}: {
  loadId: string;
  carrierId?: string | null;
  status: DriverGpsStatus | string;
}) {
  const location = await getCurrentDriverLocation();

  const payload = {
    load_id: loadId,
    carrier_id: carrierId || null,
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    speed: location.coords.speed || null,
    heading: location.coords.heading || null,
    accuracy: location.coords.accuracy || null,
    status,
    updated_at: new Date().toISOString(),
  };

  const { data: existing } = await supabase
    .from("driver_locations")
    .select("id")
    .eq("load_id", loadId)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase
      .from("driver_locations")
      .update(payload)
      .eq("id", existing.id);

    if (error) throw error;
  } else {
    const { error } = await supabase.from("driver_locations").insert(payload);

    if (error) throw error;
  }

  return payload;
}

export function subscribeToDriverLocation({
  loadId,
  onUpdate,
}: {
  loadId: string;
  onUpdate: (location: any) => void;
}) {
  const channel = supabase
    .channel(`driver-location-${loadId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "driver_locations",
        filter: `load_id=eq.${loadId}`,
      },
      (payload) => {
        onUpdate(payload.new);
      }
    )
    .subscribe();

  return channel;
}

export async function getDriverLocation(loadId: string) {
  const { data, error } = await supabase
    .from("driver_locations")
    .select("*")
    .eq("load_id", loadId)
    .maybeSingle();

  if (error) throw error;

  return data;
}

export async function stopDriverTracking(loadId: string) {
  const { error } = await supabase
    .from("driver_locations")
    .update({
      status: "DELIVERED",
      updated_at: new Date().toISOString(),
    })
    .eq("load_id", loadId);

  if (error) throw error;
}