// app/driver/live-location-provider.tsx

import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { API_BASE_URL } from "../config/api";
import { supabase } from "../services/supabaseClient";
import freightTheme from "../styles/freightTheme";

type LoadStatus =
  | "accepted"
  | "arrived_pickup"
  | "picked_up"
  | "in_transit"
  | "arrived_dropoff"
  | "delivered";

function getParamString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

export default function LiveLocationProviderScreen() {
  const params = useLocalSearchParams();

  const routeLoadId = getParamString(params.loadId);
  const routeOrderId = getParamString(params.orderId);
  const proofId = routeLoadId || routeOrderId;

  const watcherRef = useRef<Location.LocationSubscription | null>(null);

  const [driverId, setDriverId] = useState("");
  const [driverName, setDriverName] = useState("Farm2Home Driver");

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
    loadDriver();
    requestPermission();

    return () => {
      stopSharingLocation();
    };
  }, []);

  async function loadDriver() {
    const raw =
      (await AsyncStorage.getItem("currentDriver")) ||
      (await AsyncStorage.getItem("currentUser"));

    if (!raw) return;

    try {
      const driver = JSON.parse(raw);

      setDriverId(driver.id || driver.driverId || driver.email || "");
      setDriverName(
        driver.fullName || driver.name || driver.username || "Farm2Home Driver"
      );
    } catch {
      console.log("Driver parse skipped.");
    }
  }

  async function requestPermission() {
    const { status: permissionStatus } =
      await Location.requestForegroundPermissionsAsync();

    if (permissionStatus !== "granted") {
      Alert.alert(
        "Location Permission Needed",
        "Please allow location access so drivers can share live tracking."
      );
      setPermissionGranted(false);
      return false;
    }

    setPermissionGranted(true);
    return true;
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

    if (!proofId) return;

    const payload = {
      load_id: proofId,
      order_id: proofId,
      driver_id: driverId,
      carrier_id: driverId,
      driver_name: driverName,
      latitude: lat,
      longitude: lng,
      speed: currentSpeed,
      heading: currentHeading,
      status,
      updated_at: now,
    };

    try {
      const { data: existing } = await supabase
        .from("driver_locations")
        .select("*")
        .eq("load_id", proofId)
        .maybeSingle();

      if (existing?.id) {
        const { error } = await supabase
          .from("driver_locations")
          .update(payload)
          .eq("id", existing.id);

        if (error) console.log("LOCATION_UPDATE_ERROR:", error.message);
      } else {
        const { error } = await supabase.from("driver_locations").insert(payload);

        if (error) console.log("LOCATION_INSERT_ERROR:", error.message);
      }
    } catch (error) {
      console.log("LOCATION_SAVE_CRASH:", error);
    }
  }

  async function refreshCurrentLocation() {
    try {
      setLoading(true);

      const allowed = permissionGranted || (await requestPermission());
      if (!allowed) return;

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

      if (!proofId) {
        Alert.alert("Missing Load ID", "This screen needs a loadId or orderId.");
        return;
      }

      const allowed = permissionGranted || (await requestPermission());
      if (!allowed) return;

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      await saveDriverLocation(location);

      if (watcherRef.current) {
        watcherRef.current.remove();
      }

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

  async function updateBackendOrderStatus(nextStatus: LoadStatus) {
    if (!proofId) return;

    try {
      await fetch(`${API_BASE_URL}/orders/${proofId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: nextStatus.toUpperCase(),
          driverId,
        }),
      });
    } catch (error) {
      console.log("Backend order status update skipped:", error);
    }
  }

  async function updateSupabaseOrderStatus(nextStatus: LoadStatus, updates: any) {
    try {
      await supabase
        .from("orders")
        .update({
          ...updates,
          status: nextStatus.toUpperCase(),
          fulfillmentStatus: nextStatus.toUpperCase(),
        })
        .eq("id", proofId);
    } catch (error) {
      console.log("Supabase order status update skipped:", error);
    }
  }

  async function updateLoadStatus(nextStatus: LoadStatus) {
    if (!proofId) {
      Alert.alert("Missing Load ID", "This screen needs a loadId or orderId.");
      return;
    }

    try {
      setLoading(true);

      const now = new Date().toISOString();

      const updates: any = {
        status: nextStatus,
      };

      if (nextStatus === "arrived_pickup") updates.arrived_pickup_at = now;
      if (nextStatus === "picked_up") updates.picked_up_at = now;
      if (nextStatus === "in_transit") updates.in_transit_at = now;
      if (nextStatus === "arrived_dropoff") updates.arrived_dropoff_at = now;
      if (nextStatus === "delivered") updates.delivered_at = now;

      const { error } = await supabase
        .from("freight_loads")
        .update(updates)
        .eq("id", proofId);

      if (error) {
        console.log("Freight load status update skipped:", error.message);
      }

      await updateSupabaseOrderStatus(nextStatus, updates);
      await updateBackendOrderStatus(nextStatus);

      setStatus(nextStatus);

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      await saveDriverLocation(currentLocation);

      Alert.alert("Status Updated", `Load status updated to ${formatStatus(nextStatus)}.`);
    } catch (error) {
      console.log("STATUS_UPDATE_CRASH:", error);
      Alert.alert("Update Error", "Unable to update load status.");
    } finally {
      setLoading(false);
    }
  }

  function formatStatus(value: string) {
    return value
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function statusColor() {
    switch (status) {
      case "accepted":
        return "#7C3AED";
      case "arrived_pickup":
        return "#0EA5E9";
      case "picked_up":
        return "#F59E0B";
      case "in_transit":
        return "#0F766E";
      case "arrived_dropoff":
        return "#2563EB";
      case "delivered":
        return "#10B981";
      default:
        return "#64748B";
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#020617" />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.kicker}>Farm2Home Driver</Text>
              <Text style={styles.title}>Live Location Provider</Text>

              <Text style={styles.subtitle}>
                Share driver location and update delivery milestones in real time.
              </Text>
            </View>

            <View style={[styles.liveBadge, sharing && styles.liveBadgeActive]}>
              <Ionicons
                name={sharing ? "radio" : "radio-outline"}
                size={20}
                color={sharing ? "#BBF7D0" : "#CBD5E1"}
              />
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="person-circle-outline" size={24} color="#10B981" />
            <Text style={styles.cardHeading}>Driver</Text>
          </View>

          <Text style={styles.cardTitle}>Driver Name</Text>
          <Text style={styles.cardValue}>{driverName}</Text>

          <Text style={styles.cardTitle}>Load / Order ID</Text>
          <Text style={styles.cardValue}>{proofId || "No load selected"}</Text>

          <Text style={styles.cardTitle}>Current Status</Text>
          <View style={[styles.statusPill, { backgroundColor: statusColor() }]}>
            <Text style={styles.statusText}>{formatStatus(status)}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="navigate-circle-outline" size={24} color="#10B981" />
            <Text style={styles.cardHeading}>Current Location</Text>
          </View>

          <LocationRow label="Latitude" value={latitude ?? "Not available"} />
          <LocationRow label="Longitude" value={longitude ?? "Not available"} />
          <LocationRow
            label="Speed"
            value={speed !== null ? `${speed.toFixed(1)} m/s` : "Not available"}
          />
          <LocationRow
            label="Heading"
            value={heading !== null ? `${heading.toFixed(1)}°` : "Not available"}
          />
          <LocationRow
            label="Updated"
            value={updatedAt ? new Date(updatedAt).toLocaleString() : "Not yet"}
          />
        </View>

        <View style={styles.buttonGrid}>
          <TouchableOpacity
            style={[styles.primaryButton, sharing && styles.disabledButton]}
            onPress={startSharingLocation}
            disabled={sharing || loading}
          >
            {loading && !sharing ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="radio-outline" size={18} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>
                  {sharing ? "Live Location Active" : "Start Live Location"}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={refreshCurrentLocation}
            disabled={loading}
          >
            <Ionicons name="refresh-outline" size={18} color="#10B981" />
            <Text style={styles.secondaryButtonText}>Refresh Location</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dangerButton}
            onPress={() => {
              stopSharingLocation();
              Alert.alert("Stopped", "Live location sharing has stopped.");
            }}
          >
            <Ionicons name="stop-circle-outline" size={18} color="#FFFFFF" />
            <Text style={styles.dangerButtonText}>Stop Live Location</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Milestones</Text>

          <MilestoneButton
            label="Arrived Pickup"
            icon="location-outline"
            onPress={() => updateLoadStatus("arrived_pickup")}
            disabled={loading}
          />

          <MilestoneButton
            label="Take Pickup Photo"
            icon="camera-outline"
            onPress={() =>
              router.push({
                pathname: "/driver/proof-of-pickup",
                params: { loadId: proofId, orderId: proofId },
              } as any)
            }
            disabled={loading}
          />

          <MilestoneButton
            label="Picked Up"
            icon="cube-outline"
            onPress={() => updateLoadStatus("picked_up")}
            disabled={loading}
          />

          <MilestoneButton
            label="Start Route / In Transit"
            icon="navigate-outline"
            onPress={() => updateLoadStatus("in_transit")}
            disabled={loading}
          />

          <MilestoneButton
            label="Arrived Dropoff"
            icon="flag-outline"
            onPress={() => updateLoadStatus("arrived_dropoff")}
            disabled={loading}
          />

          <MilestoneButton
            label="Take Delivery Photo"
            icon="camera-reverse-outline"
            onPress={() =>
              router.push({
                pathname: "/driver/proof-of-delivery",
                params: { loadId: proofId, orderId: proofId },
              } as any)
            }
            disabled={loading}
          />

          <TouchableOpacity
            style={[styles.completeButton, loading && styles.disabledButton]}
            onPress={() => updateLoadStatus("delivered")}
            disabled={loading}
          >
            <Ionicons name="checkmark-done-circle-outline" size={18} color="#FFFFFF" />
            <Text style={styles.completeButtonText}>Complete Delivery</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.boardButton}
          onPress={() => router.push("/driver/mobile-driver-app" as any)}
        >
          <Text style={styles.boardButtonText}>Back To Driver App</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function LocationRow({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.locationRow}>
      <Text style={styles.locationLabel}>{label}</Text>
      <Text style={styles.locationValue}>{String(value)}</Text>
    </View>
  );
}

function MilestoneButton({
  label,
  icon,
  onPress,
  disabled,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.actionButton, disabled && styles.disabledButton]}
      onPress={onPress}
      disabled={disabled}
    >
      <Ionicons name={icon} size={18} color="#10B981" />
      <Text style={styles.actionButtonText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: freightTheme.colors.background,
  },
  content: {
    paddingBottom: 100,
  },
  hero: {
    backgroundColor: "#020617",
    paddingTop: 22,
    paddingHorizontal: 20,
    paddingBottom: 26,
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  kicker: {
    color: "#10B981",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    color: "#FFFFFF",
    marginTop: 6,
  },
  subtitle: {
    color: "#CBD5E1",
    fontWeight: "700",
    lineHeight: 22,
    marginTop: 8,
  },
  liveBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#334155",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#475569",
  },
  liveBadgeActive: {
    backgroundColor: "#064E3B",
    borderColor: "#10B981",
  },
  card: {
    backgroundColor: freightTheme.colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
    padding: 18,
    marginHorizontal: 18,
    marginTop: 16,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  cardHeading: {
    color: freightTheme.colors.text,
    fontSize: 20,
    fontWeight: "900",
  },
  cardTitle: {
    color: freightTheme.colors.primary,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    marginTop: 8,
  },
  cardValue: {
    color: freightTheme.colors.text,
    fontSize: 15,
    fontWeight: "800",
    marginTop: 4,
    marginBottom: 8,
  },
  statusPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 13,
    marginTop: 6,
  },
  statusText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },
  locationRow: {
    backgroundColor: freightTheme.colors.surface,
    borderRadius: 14,
    padding: 13,
    marginBottom: 9,
  },
  locationLabel: {
    color: freightTheme.colors.primary,
    fontWeight: "900",
    fontSize: 12,
    textTransform: "uppercase",
  },
  locationValue: {
    color: freightTheme.colors.text,
    fontWeight: "800",
    marginTop: 4,
  },
  buttonGrid: {
    marginHorizontal: 18,
    marginTop: 16,
  },
  primaryButton: {
    backgroundColor: freightTheme.colors.primary,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    flexDirection: "row",
    gap: 8,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 15,
  },
  secondaryButton: {
    backgroundColor: freightTheme.colors.card,
    borderWidth: 1,
    borderColor: freightTheme.colors.primary,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    flexDirection: "row",
    gap: 8,
  },
  secondaryButtonText: {
    color: freightTheme.colors.primary,
    fontWeight: "900",
    fontSize: 15,
  },
  dangerButton: {
    backgroundColor: "#991B1B",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
    flexDirection: "row",
    gap: 8,
  },
  dangerButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 15,
  },
  section: {
    marginHorizontal: 18,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: freightTheme.colors.text,
    marginBottom: 12,
  },
  actionButton: {
    backgroundColor: freightTheme.colors.card,
    borderWidth: 1,
    borderColor: freightTheme.colors.primary,
    borderRadius: 14,
    padding: 15,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    flexDirection: "row",
    gap: 8,
  },
  actionButtonText: {
    color: freightTheme.colors.primary,
    fontWeight: "900",
  },
  completeButton: {
    backgroundColor: "#064E3B",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    flexDirection: "row",
    gap: 8,
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
    color: freightTheme.colors.primary,
    fontWeight: "900",
  },
  disabledButton: {
    opacity: 0.65,
  },
});