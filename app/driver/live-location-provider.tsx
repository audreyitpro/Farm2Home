import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Location from "expo-location";
import { router, useLocalSearchParams } from "expo-router";

import { supabase } from "../services/supabaseClient";

type LoadStatus =
  | "available"
  | "accepted"
  | "arrived_pickup"
  | "picked_up"
  | "in_transit"
  | "arrived_dropoff"
  | "delivered";

export default function LiveLocationProviderScreen() {
  const params = useLocalSearchParams();
  const loadId = String(params.loadId || "");

  const watcherRef = useRef<Location.LocationSubscription | null>(null);

  const [permissionGranted, setPermissionGranted] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<LoadStatus>("accepted");

  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [speed, setSpeed] = useState<number | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string>("");

  useEffect(() => {
    requestPermission();

    return () => {
      stopSharingLocation();
    };
  }, []);

  async function requestPermission() {
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== "granted") {
      Alert.alert(
        "Location Permission Needed",
        "Please allow location access so drivers can share live tracking."
      );
      setPermissionGranted(false);
      return;
    }

    setPermissionGranted(true);
  }

  async function saveDriverLocation(location: Location.LocationObject) {
    const lat = location.coords.latitude;
    const lng = location.coords.longitude;
    const currentSpeed = location.coords.speed || 0;
    const currentHeading = location.coords.heading || 0;
    const now = new Date().toISOString();

    setLatitude(lat);
    setLongitude(lng);
    setSpeed(currentSpeed);
    setHeading(currentHeading);
    setUpdatedAt(now);

    if (!loadId) return;

    const { error } = await supabase.from("driver_locations").upsert({
      load_id: loadId,
      latitude: lat,
      longitude: lng,
      speed: currentSpeed,
      heading: currentHeading,
      updated_at: now,
    });

    if (error) {
      console.log("LOCATION_SAVE_ERROR:", error.message);
    }
  }

  async function refreshCurrentLocation() {
    try {
      setLoading(true);

      if (!permissionGranted) {
        await requestPermission();
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      await saveDriverLocation(location);

      Alert.alert("Location Updated", "Current driver location has been refreshed.");
    } catch (error) {
      console.log("REFRESH_LOCATION_ERROR:", error);
      Alert.alert("Location Error", "Unable to get current location.");
    } finally {
      setLoading(false);
    }
  }

  async function startSharingLocation() {
    try {
      setLoading(true);

      if (!permissionGranted) {
        await requestPermission();
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      await saveDriverLocation(location);

      watcherRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 10000,
          distanceInterval: 25,
        },
        async (newLocation) => {
          await saveDriverLocation(newLocation);
        }
      );

      setSharing(true);

      Alert.alert(
        "Live Location Started",
        "Driver live location sharing is now active."
      );
    } catch (error) {
      console.log("START_LOCATION_ERROR:", error);
      Alert.alert("Location Error", "Unable to start live location sharing.");
    } finally {
      setLoading(false);
    }
  }

  function stopSharingLocation() {
    if (watcherRef.current) {
      watcherRef.current.remove();
      watcherRef.current = null;
    }

    setSharing(false);
  }

  async function updateLoadStatus(nextStatus: LoadStatus) {
    if (!loadId) {
      Alert.alert("Missing Load ID", "This screen needs a loadId.");
      return;
    }

    try {
      setLoading(true);

      const now = new Date().toISOString();

      const updates: any = {
        status: nextStatus,
      };

      if (nextStatus === "arrived_pickup") {
        updates.arrived_pickup_at = now;
      }

      if (nextStatus === "picked_up") {
        updates.picked_up_at = now;
      }

      if (nextStatus === "in_transit") {
        updates.picked_up_at = now;
      }

      if (nextStatus === "arrived_dropoff") {
        updates.arrived_dropoff_at = now;
      }

      if (nextStatus === "delivered") {
        updates.delivered_at = now;
      }

      const { error } = await supabase
        .from("freight_loads")
        .update(updates)
        .eq("id", loadId);

      if (error) {
        console.log("STATUS_UPDATE_ERROR:", error.message);
        Alert.alert("Update Error", error.message);
        return;
      }

      setStatus(nextStatus);

      Alert.alert("Status Updated", `Load status updated to ${nextStatus}.`);
    } catch (error) {
      console.log("STATUS_UPDATE_CRASH:", error);
      Alert.alert("Update Error", "Unable to update load status.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>Farm2Home Driver</Text>
        <Text style={styles.title}>Live Location Provider</Text>

        <Text style={styles.subtitle}>
          Share driver location and update freight delivery milestones.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Load ID</Text>
          <Text style={styles.cardValue}>{loadId || "No load selected"}</Text>

          <Text style={styles.cardTitle}>Current Status</Text>
          <Text style={styles.statusText}>{status.replace(/_/g, " ")}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Current Location</Text>

          <Text style={styles.locationText}>
            Latitude: {latitude ?? "Not available"}
          </Text>

          <Text style={styles.locationText}>
            Longitude: {longitude ?? "Not available"}
          </Text>

          <Text style={styles.locationText}>
            Speed: {speed !== null ? `${speed.toFixed(1)} m/s` : "Not available"}
          </Text>

          <Text style={styles.locationText}>
            Heading: {heading !== null ? `${heading.toFixed(1)}°` : "Not available"}
          </Text>

          <Text style={styles.locationText}>
            Updated: {updatedAt ? new Date(updatedAt).toLocaleString() : "Not yet"}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, sharing && styles.disabledButton]}
          onPress={startSharingLocation}
          disabled={sharing || loading}
        >
          {loading && !sharing ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryButtonText}>
              {sharing ? "Live Location Active" : "Start Live Location"}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={refreshCurrentLocation}
          disabled={loading}
        >
          <Text style={styles.secondaryButtonText}>Refresh Current Location</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.dangerButton}
          onPress={() => {
            stopSharingLocation();
            Alert.alert("Stopped", "Live location sharing has stopped.");
          }}
        >
          <Text style={styles.dangerButtonText}>Stop Live Location</Text>
        </TouchableOpacity>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Milestones</Text>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => updateLoadStatus("arrived_pickup")}
            disabled={loading}
          >
            <Text style={styles.actionButtonText}>Arrived Pickup</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push({
              pathname: "/driver/proof-of-pickup",
              params: { loadId },
            })}
          >
            <Text style={styles.actionButtonText}>Take Pickup Photo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => updateLoadStatus("picked_up")}
            disabled={loading}
          >
            <Text style={styles.actionButtonText}>Picked Up</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => updateLoadStatus("in_transit")}
            disabled={loading}
          >
            <Text style={styles.actionButtonText}>Start Route / In Transit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => updateLoadStatus("arrived_dropoff")}
            disabled={loading}
          >
            <Text style={styles.actionButtonText}>Arrived Dropoff</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push({
              pathname: "/driver/proof-of-delivery",
              params: { loadId },
            })}
          >
            <Text style={styles.actionButtonText}>Take Delivery Photo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.completeButton}
            onPress={() => updateLoadStatus("delivered")}
            disabled={loading}
          >
            <Text style={styles.completeButtonText}>Complete Delivery</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.boardButton}
          onPress={() => router.push("/freight/board" as any)}
        >
          <Text style={styles.boardButtonText}>Back To Freight Board</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F7F2",
  },
  content: {
    padding: 20,
    paddingBottom: 80,
  },
  kicker: {
    color: "#1F7A3F",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    color: "#064E3B",
    marginTop: 6,
  },
  subtitle: {
    color: "#4B5563",
    fontWeight: "700",
    lineHeight: 22,
    marginTop: 8,
    marginBottom: 18,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    padding: 16,
    marginBottom: 14,
  },
  cardTitle: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    marginTop: 6,
  },
  cardValue: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "800",
    marginTop: 4,
    marginBottom: 8,
  },
  statusText: {
    color: "#1F7A3F",
    fontSize: 18,
    fontWeight: "900",
    textTransform: "capitalize",
    marginTop: 4,
  },
  locationText: {
    color: "#111827",
    fontWeight: "700",
    marginTop: 6,
  },
  primaryButton: {
    backgroundColor: "#1F7A3F",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    marginBottom: 10,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 15,
  },
  secondaryButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#1F7A3F",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    marginBottom: 10,
  },
  secondaryButtonText: {
    color: "#1F7A3F",
    fontWeight: "900",
    fontSize: 15,
  },
  dangerButton: {
    backgroundColor: "#991B1B",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    marginBottom: 18,
  },
  dangerButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 15,
  },
  section: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#064E3B",
    marginBottom: 12,
  },
  actionButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#2F7D32",
    borderRadius: 14,
    padding: 15,
    alignItems: "center",
    marginBottom: 10,
  },
  actionButtonText: {
    color: "#2F7D32",
    fontWeight: "900",
  },
  completeButton: {
    backgroundColor: "#064E3B",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    marginTop: 4,
  },
  completeButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  boardButton: {
    marginTop: 18,
    alignItems: "center",
  },
  boardButtonText: {
    color: "#1F7A3F",
    fontWeight: "900",
  },
  disabledButton: {
    opacity: 0.65,
  },
});