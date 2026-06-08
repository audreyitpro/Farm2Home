// app/driver/live-location-provider.tsx

import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
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

function normalize(value: any) {
  return String(value || "").trim().toLowerCase();
}

function getParamString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

function formatStatus(value: string) {
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function LiveLocationProviderScreen() {
  const params = useLocalSearchParams();

  const loadId = getParamString(params.loadId);
  const orderId = getParamString(params.orderId);
  const deliveryJobId = getParamString(params.deliveryJobId);
  const deliveryOrderId = getParamString(params.deliveryOrderId);
  const autoTracking = getParamString(params.autoTracking);

  const proofId = deliveryJobId || deliveryOrderId || loadId || orderId;

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
  const [updatedAt, setUpdatedAt] = useState("");

  useEffect(() => {
    initialize();

    return () => {
      stopSharingLocation();
    };
  }, []);

  async function initialize() {
    await loadDriver();
    await requestPermission();

    if (autoTracking === "true") {
      setTimeout(() => {
        startSharingLocation();
      }, 500);
    }
  }

  async function getStoredDriver() {
    const raw =
      (await AsyncStorage.getItem("currentDriver")) ||
      (await AsyncStorage.getItem("farm2homeCurrentDriver")) ||
      (await AsyncStorage.getItem("farm2homeDriverSession")) ||
      (await AsyncStorage.getItem("currentUser"));

    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async function loadDriver() {
    try {
      const stored = await getStoredDriver();

      const { data: authData } = await supabase.auth.getUser();
      const authUser = authData?.user;

      const authUserId =
        authUser?.id ||
        stored?.authUserId ||
        stored?.id ||
        stored?.driverId ||
        "";

      const authEmail = normalize(authUser?.email || stored?.email || "");

      let dbDriver: any = null;
      let profile: any = null;

      if (authUserId) {
        const result = await supabase
          .from("drivers")
          .select("*")
          .eq("id", authUserId)
          .maybeSingle();

        if (!result.error && result.data) dbDriver = result.data;
      }

      if (!dbDriver && authEmail) {
        const result = await supabase
          .from("drivers")
          .select("*")
          .eq("email", authEmail)
          .maybeSingle();

        if (!result.error && result.data) dbDriver = result.data;
      }

      if (authUserId) {
        const result = await supabase
          .from("profiles")
          .select("*")
          .eq("auth_user_id", authUserId)
          .eq("role", "driver")
          .maybeSingle();

        if (!result.error && result.data) profile = result.data;
      }

      if (!profile && authEmail) {
        const result = await supabase
          .from("profiles")
          .select("*")
          .eq("email", authEmail)
          .eq("role", "driver")
          .maybeSingle();

        if (!result.error && result.data) profile = result.data;
      }

      const stableDriverId =
        dbDriver?.id ||
        stored?.id ||
        stored?.driverId ||
        authUserId ||
        profile?.auth_user_id ||
        "";

      if (!stableDriverId) {
        Alert.alert("Driver Login Required", "Please login as a driver.");
        router.replace("/driver/login" as any);
        return;
      }

      const stableDriverName =
        dbDriver?.full_name ||
        dbDriver?.name ||
        profile?.full_name ||
        stored?.fullName ||
        stored?.name ||
        stored?.username ||
        "Farm2Home Driver";

      const sessionDriver = {
        ...(stored || {}),
        ...(dbDriver || {}),
        id: stableDriverId,
        driverId: stableDriverId,
        authUserId: dbDriver?.auth_user_id || profile?.auth_user_id || authUserId,
        profileId: dbDriver?.profile_id || stored?.profileId || profile?.id || "",
        role: "driver",
        fullName: stableDriverName,
        name: stableDriverName,
        email: normalize(dbDriver?.email || profile?.email || stored?.email || authEmail),
        username: dbDriver?.username || profile?.username || stored?.username || "",
        accountActive:
          dbDriver?.account_active ??
          profile?.account_active ??
          stored?.accountActive ??
          true,
        membershipStatus:
          dbDriver?.membership_status || stored?.membershipStatus || "Active",
        subscriptionStatus:
          dbDriver?.subscription_status || stored?.subscriptionStatus || "active",
        updatedAt: new Date().toISOString(),
      };

      await AsyncStorage.setItem("currentDriver", JSON.stringify(sessionDriver));
      await AsyncStorage.setItem("currentUser", JSON.stringify(sessionDriver));
      await AsyncStorage.setItem("farm2homeCurrentDriver", JSON.stringify(sessionDriver));
      await AsyncStorage.setItem("farm2homeDriverSession", JSON.stringify(sessionDriver));
      await AsyncStorage.setItem("userRole", "driver");
      await AsyncStorage.setItem("currentUserRole", "driver");

      setDriverId(stableDriverId);
      setDriverName(stableDriverName);
    } catch (error) {
      console.log("LIVE_LOCATION_DRIVER_LOAD_ERROR:", error);
      Alert.alert("Driver Error", "Unable to load driver session.");
      router.replace("/driver/login" as any);
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

  async function upsertDriverLocation(location: Location.LocationObject) {
    const activeDriverId = driverId;

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
      load_id: loadId || proofId,
      order_id: orderId || proofId,
      delivery_order_id: deliveryJobId || deliveryOrderId || proofId,
      driver_id: activeDriverId,
      carrier_id: activeDriverId,
      driver_name: driverName,
      latitude: lat,
      longitude: lng,
      speed: currentSpeed,
      heading: currentHeading,
      status,
      updated_at: now,
    };

    try {
      let existing: any = null;

      if (deliveryJobId || deliveryOrderId) {
        const result = await supabase
          .from("driver_locations")
          .select("*")
          .eq("delivery_order_id", deliveryJobId || deliveryOrderId)
          .maybeSingle();

        existing = result.data;
      }

      if (!existing && loadId) {
        const result = await supabase
          .from("driver_locations")
          .select("*")
          .eq("load_id", loadId)
          .maybeSingle();

        existing = result.data;
      }

      if (!existing && activeDriverId) {
        const result = await supabase
          .from("driver_locations")
          .select("*")
          .eq("driver_id", activeDriverId)
          .maybeSingle();

        existing = result.data;
      }

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

      if (!driverId) await loadDriver();

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      await upsertDriverLocation(location);

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
        Alert.alert("Missing Delivery ID", "This screen needs a loadId, orderId, or deliveryOrderId.");
        return;
      }

      if (!driverId) {
        await loadDriver();
      }

      const allowed = permissionGranted || (await requestPermission());
      if (!allowed) return;

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      await upsertDriverLocation(location);

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
          await upsertDriverLocation(newLocation);
        }
      );

      setSharing(true);

      Alert.alert("Live Location Started", "Driver live location sharing is now active.");
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: nextStatus.toUpperCase(),
          driverId,
        }),
      });
    } catch (error) {
      console.log("Backend order status update skipped:", error);
    }
  }

  function buildStatusPayload(nextStatus: LoadStatus, now: string) {
    const payload: any = {
      status: nextStatus,
      driver_id: driverId,
      assigned_driver_id: driverId,
      driver_name: driverName,
      updated_at: now,
    };

    if (nextStatus === "arrived_pickup") payload.arrived_pickup_at = now;
    if (nextStatus === "picked_up") payload.picked_up_at = now;
    if (nextStatus === "in_transit") payload.in_transit_at = now;
    if (nextStatus === "arrived_dropoff") payload.arrived_dropoff_at = now;
    if (nextStatus === "delivered") payload.delivered_at = now;

    return payload;
  }

  async function updateDeliveryOrderStatus(nextStatus: LoadStatus, payload: any) {
    const targetId = deliveryJobId || deliveryOrderId || loadId;

    if (!targetId) return;

    const { error } = await supabase
      .from("delivery_orders")
      .update(payload)
      .eq("id", targetId);

    if (error) console.log("Delivery order status update skipped:", error.message);
  }

  async function updateFreightLoadStatus(nextStatus: LoadStatus, payload: any) {
    if (!loadId) return;

    const { error } = await supabase
      .from("freight_loads")
      .update(payload)
      .eq("id", loadId);

    if (error) console.log("Freight load status update skipped:", error.message);
  }

  async function updateOrderStatus(nextStatus: LoadStatus, payload: any) {
    const targetOrderId = orderId || proofId;

    if (!targetOrderId) return;

    const { error } = await supabase
      .from("orders")
      .update({
        ...payload,
        status: nextStatus.toUpperCase(),
        fulfillmentStatus: nextStatus.toUpperCase(),
        assignedDriverId: driverId,
        driverId,
      })
      .eq("id", targetOrderId);

    if (error) console.log("Order status update skipped:", error.message);
  }

  async function updateLoadStatus(nextStatus: LoadStatus) {
    if (!proofId) {
      Alert.alert("Missing Delivery ID", "This screen needs a loadId, orderId, or deliveryOrderId.");
      return;
    }

    try {
      setLoading(true);

      if (!driverId) await loadDriver();

      const now = new Date().toISOString();
      const payload = buildStatusPayload(nextStatus, now);

      await updateDeliveryOrderStatus(nextStatus, payload);
      await updateFreightLoadStatus(nextStatus, payload);
      await updateOrderStatus(nextStatus, payload);
      await updateBackendOrderStatus(nextStatus);

      setStatus(nextStatus);

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      await upsertDriverLocation(currentLocation);

      Alert.alert("Status Updated", `Delivery status updated to ${formatStatus(nextStatus)}.`);
    } catch (error) {
      console.log("STATUS_UPDATE_CRASH:", error);
      Alert.alert("Update Error", "Unable to update delivery status.");
    } finally {
      setLoading(false);
    }
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

  function openMap() {
    if (!latitude || !longitude) {
      Alert.alert("No Location", "Refresh or start live location first.");
      return;
    }

    const url =
      Platform.OS === "ios"
        ? `http://maps.apple.com/?ll=${latitude},${longitude}`
        : `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;

    Linking.openURL(url);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#020617" />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.kicker}>Driver Operations</Text>
              <Text style={styles.title}>Live Location</Text>
              <Text style={styles.subtitle}>
                Share location and update delivery milestones in real time.
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
          <Text style={styles.cardHeading}>Driver</Text>
          <InfoRow label="Driver Name" value={driverName} />
          <InfoRow label="Delivery ID" value={proofId || "No delivery selected"} />

          <Text style={styles.cardTitle}>Current Status</Text>
          <View style={[styles.statusPill, { backgroundColor: statusColor() }]}>
            <Text style={styles.statusText}>{formatStatus(status)}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardHeading}>Current Location</Text>

          <InfoRow label="Latitude" value={latitude ?? "Not available"} />
          <InfoRow label="Longitude" value={longitude ?? "Not available"} />
          <InfoRow
            label="Speed"
            value={speed !== null ? `${speed.toFixed(1)} m/s` : "Not available"}
          />
          <InfoRow
            label="Heading"
            value={heading !== null ? `${heading.toFixed(1)}°` : "Not available"}
          />
          <InfoRow
            label="Updated"
            value={updatedAt ? new Date(updatedAt).toLocaleString() : "Not yet"}
          />

          <TouchableOpacity style={styles.mapButton} onPress={openMap}>
            <Text style={styles.mapButtonText}>Open Map</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.buttonGroup}>
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
            <Text style={styles.secondaryButtonText}>Refresh Location</Text>
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
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Milestones</Text>

          <MilestoneButton
            label="Arrived Pickup"
            onPress={() => updateLoadStatus("arrived_pickup")}
            disabled={loading}
          />

          <MilestoneButton
            label="Proof of Pickup"
            onPress={() =>
              router.push({
                pathname: "/driver/proof-of-pickup",
                params: {
                  loadId: loadId || proofId,
                  orderId: orderId || proofId,
                  deliveryOrderId: deliveryJobId || deliveryOrderId || proofId,
                },
              } as any)
            }
            disabled={loading}
          />

          <MilestoneButton
            label="Picked Up"
            onPress={() => updateLoadStatus("picked_up")}
            disabled={loading}
          />

          <MilestoneButton
            label="In Transit"
            onPress={() => updateLoadStatus("in_transit")}
            disabled={loading}
          />

          <MilestoneButton
            label="Arrived Dropoff"
            onPress={() => updateLoadStatus("arrived_dropoff")}
            disabled={loading}
          />

          <MilestoneButton
            label="Proof of Delivery"
            onPress={() =>
              router.push({
                pathname: "/driver/proof-of-delivery",
                params: {
                  loadId: loadId || proofId,
                  orderId: orderId || proofId,
                  deliveryOrderId: deliveryJobId || deliveryOrderId || proofId,
                },
              } as any)
            }
            disabled={loading}
          />

          <TouchableOpacity
            style={[styles.completeButton, loading && styles.disabledButton]}
            onPress={() => updateLoadStatus("delivered")}
            disabled={loading}
          >
            <Text style={styles.completeButtonText}>Complete Delivery</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.push("/driver/my-deliveries" as any)}
        >
          <Text style={styles.backButtonText}>Back to My Deliveries</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{String(value)}</Text>
    </View>
  );
}

function MilestoneButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.actionButton, disabled && styles.disabledButton]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.actionButtonText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: freightTheme.colors.background },
  content: { paddingBottom: 100 },
  header: {
    backgroundColor: "#020617",
    paddingTop: 22,
    paddingHorizontal: 20,
    paddingBottom: 26,
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
  },
  headerTop: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
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
    width: 48,
    height: 48,
    borderRadius: 16,
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
    borderRadius: 16,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
    padding: 16,
    marginHorizontal: 18,
    marginTop: 14,
  },
  cardHeading: {
    color: freightTheme.colors.text,
    fontSize: 19,
    fontWeight: "900",
    marginBottom: 10,
  },
  cardTitle: {
    color: freightTheme.colors.primary,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    marginTop: 8,
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
  infoRow: {
    backgroundColor: freightTheme.colors.surface,
    borderRadius: 13,
    padding: 13,
    marginBottom: 9,
  },
  infoLabel: {
    color: freightTheme.colors.primary,
    fontWeight: "900",
    fontSize: 11,
    textTransform: "uppercase",
  },
  infoValue: {
    color: freightTheme.colors.text,
    fontWeight: "800",
    marginTop: 4,
  },
  mapButton: {
    backgroundColor: "#111827",
    borderRadius: 13,
    padding: 13,
    alignItems: "center",
    marginTop: 4,
  },
  mapButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  buttonGroup: {
    marginHorizontal: 18,
    marginTop: 14,
  },
  primaryButton: {
    backgroundColor: freightTheme.colors.primary,
    borderRadius: 13,
    padding: 15,
    alignItems: "center",
    marginBottom: 9,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  secondaryButton: {
    backgroundColor: freightTheme.colors.card,
    borderWidth: 1,
    borderColor: freightTheme.colors.primary,
    borderRadius: 13,
    padding: 15,
    alignItems: "center",
    marginBottom: 9,
  },
  secondaryButtonText: {
    color: freightTheme.colors.primary,
    fontWeight: "900",
  },
  dangerButton: {
    backgroundColor: "#991B1B",
    borderRadius: 13,
    padding: 15,
    alignItems: "center",
    marginBottom: 12,
  },
  dangerButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  section: {
    marginHorizontal: 18,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: freightTheme.colors.text,
    marginBottom: 11,
  },
  actionButton: {
    backgroundColor: freightTheme.colors.card,
    borderWidth: 1,
    borderColor: freightTheme.colors.primary,
    borderRadius: 13,
    padding: 14,
    alignItems: "center",
    marginBottom: 9,
  },
  actionButtonText: {
    color: freightTheme.colors.primary,
    fontWeight: "900",
  },
  completeButton: {
    backgroundColor: "#064E3B",
    borderRadius: 13,
    padding: 15,
    alignItems: "center",
    marginTop: 4,
  },
  completeButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  backButton: {
    marginTop: 18,
    alignItems: "center",
  },
  backButtonText: {
    color: freightTheme.colors.primary,
    fontWeight: "900",
  },
  disabledButton: {
    opacity: 0.65,
  },
});