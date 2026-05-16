// app/services/locationTrackingService.ts

import * as Location from "expo-location";
import { supabase } from "./supabaseClient";

export async function requestLocationPermissions() {
  const foreground = await Location.requestForegroundPermissionsAsync();

  if (foreground.status !== "granted") {
    throw new Error("Foreground location permission denied.");
  }

  return true;
}

export async function getCurrentLocation() {
  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });

  return location.coords;
}

export async function watchDriverLocation(
  callback: (coords: Location.LocationObjectCoords) => void
) {
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
  latitude,
  longitude,
}: {
  driverId: string;
  latitude: number;
  longitude: number;
}) {
  const result = await supabase
    .from("driver_locations")
    .upsert({
      driver_id: driverId,
      latitude,
      longitude,
      updated_at: new Date().toISOString(),
    });

  if (result.error) {
    throw result.error;
  }

  return true;
}