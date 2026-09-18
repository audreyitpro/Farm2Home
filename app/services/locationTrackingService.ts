// app/services/locationTrackingService.ts

import * as Location from "expo-location";
import { supabase } from "./supabaseClient";

/**
 * Payload used when saving a driver's current location.
 */
export type DriverLocationPayload = {
  driverId: string;
  loadId?: string;
  latitude: number;
  longitude: number;
  heading?: number | null;
  speed?: number | null;
  accuracy?: number | null;
};

/**
 * Request foreground location permission.
 *
 * Farm2Home currently uses foreground location for:
 * - Driver live location
 * - Freight live routes
 * - Navigation assistance
 * - Current-location lookups
 *
 * Background location permission is intentionally NOT requested.
 */
export async function requestLocationPermissions(): Promise<boolean> {
  const foreground = await Location.requestForegroundPermissionsAsync();

  if (foreground.status !== "granted") {
    throw new Error("Foreground location permission denied.");
  }

  return true;
}

/**
 * Get the user's current location.
 */
export async function getCurrentLocation(): Promise<Location.LocationObjectCoords> {
  await requestLocationPermissions();

  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });

  return location.coords;
}

/**
 * Watch the driver's location while the Farm2Home tracking
 * feature is actively running.
 *
 * This is foreground location tracking only.
 */
export async function watchDriverLocation(
  callback: (coords: Location.LocationObjectCoords) => void
): Promise<Location.LocationSubscription> {
  await requestLocationPermissions();

  const subscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      distanceInterval: 10,
      timeInterval: 5000,
    },
    (location) => {
      callback(location.coords);
    }
  );

  return subscription;
}

/**
 * Save or update a driver's latest location in Supabase.
 */
export async function updateDriverLocation({
  driverId,
  loadId,
  latitude,
  longitude,
  heading = null,
  speed = null,
  accuracy = null,
}: DriverLocationPayload): Promise<boolean> {
  if (!driverId || !driverId.trim()) {
    throw new Error("Missing driverId.");
  }

  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    throw new Error("Invalid latitude or longitude.");
  }

  if (latitude < -90 || latitude > 90) {
    throw new Error("Latitude must be between -90 and 90.");
  }

  if (longitude < -180 || longitude > 180) {
    throw new Error("Longitude must be between -180 and 180.");
  }

  const payload: Record<string, unknown> = {
    driver_id: driverId.trim(),
    latitude,
    longitude,
    heading,
    speed,
    accuracy,
    updated_at: new Date().toISOString(),
  };

  if (loadId?.trim()) {
    payload.load_id = loadId.trim();
  }

  const { error } = await supabase
    .from("driver_locations")
    .upsert(payload, {
      onConflict: loadId?.trim()
        ? "driver_id,load_id"
        : "driver_id",
    });

  if (error) {
    throw error;
  }

  return true;
}

/**
 * Retrieve the driver's most recently stored location.
 */
export async function getDriverLocation(driverId: string) {
  if (!driverId || !driverId.trim()) {
    throw new Error("Missing driverId.");
  }

  const { data, error } = await supabase
    .from("driver_locations")
    .select("*")
    .eq("driver_id", driverId.trim())
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Stop an active foreground location watcher.
 */
export async function stopLocationWatcher(
  subscription?: Location.LocationSubscription | null
): Promise<void> {
  if (!subscription) {
    return;
  }

  subscription.remove();
}