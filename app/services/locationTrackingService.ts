// app/services/locationTrackingService.ts

import * as Location from "expo-location";
import { Platform } from "react-native";
import { supabase } from "./supabaseClient";

export type DriverLocationPayload = {
  driverId: string;
  loadId?: string;
  latitude: number;
  longitude: number;
  heading?: number | null;
  speed?: number | null;
  accuracy?: number | null;
};

export async function requestLocationPermissions() {
  const foreground = await Location.requestForegroundPermissionsAsync();

  if (foreground.status !== "granted") {
    throw new Error("Foreground location permission denied.");
  }

  if (Platform.OS !== "web") {
    const background = await Location.requestBackgroundPermissionsAsync();

    if (background.status !== "granted") {
      console.log("Background location permission not granted.");
    }
  }

  return true;
}

export async function getCurrentLocation() {
  await requestLocationPermissions();

  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });

  return location.coords;
}

export async function watchDriverLocation(
  callback: (coords: Location.LocationObjectCoords) => void
) {
  await requestLocationPermissions();

  return await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      distanceInterval: 10,
      timeInterval: 5000,
    },
    (location) => {
      callback(location.coords);
    }
  );
}

export async function updateDriverLocation({
  driverId,
  loadId,
  latitude,
  longitude,
  heading = null,
  speed = null,
  accuracy = null,
}: DriverLocationPayload) {
  if (!driverId) {
    throw new Error("Missing driverId.");
  }

  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    Number.isNaN(latitude) ||
    Number.isNaN(longitude)
  ) {
    throw new Error("Invalid latitude or longitude.");
  }

  const payload: Record<string, any> = {
    driver_id: driverId,
    latitude,
    longitude,
    heading,
    speed,
    accuracy,
    updated_at: new Date().toISOString(),
  };

  if (loadId) {
    payload.load_id = loadId;
  }

  const result = await supabase
    .from("driver_locations")
    .upsert(payload, {
      onConflict: loadId ? "driver_id,load_id" : "driver_id",
    });

  if (result.error) {
    throw result.error;
  }

  return true;
}

export async function getDriverLocation(driverId: string) {
  if (!driverId) {
    throw new Error("Missing driverId.");
  }

  const { data, error } = await supabase
    .from("driver_locations")
    .select("*")
    .eq("driver_id", driverId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function stopLocationWatcher(subscription?: Location.LocationSubscription | null) {
  if (subscription) {
    subscription.remove();
  }
}