import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { supabase } from "../data/supabaseClient";
import farmTheme from "../styles/farmTheme";

type DriverLocation = {
  id: string;
  load_id: string;
  carrier_id?: string | null;
  latitude: number;
  longitude: number;
  speed?: number | null;
  heading?: number | null;
  accuracy?: number | null;
  status: string;
  updated_at: string;
};

export default function CustomerOrderTracking() {
  const params = useLocalSearchParams();

  const orderId = Array.isArray(params.orderId)
    ? params.orderId[0]
    : params.orderId || "";

  const loadId = Array.isArray(params.loadId)
    ? params.loadId[0]
    : params.loadId || "";

  const [loading, setLoading] = useState(true);
  const [driverLocation, setDriverLocation] =
    useState<DriverLocation | null>(null);

  useEffect(() => {
    loadDriverLocation();

    if (!loadId) return;

    const channel = supabase
      .channel(`customer-tracking-${loadId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "driver_locations",
          filter: `load_id=eq.${loadId}`,
        },
        (payload) => {
          if (payload.new) {
            setDriverLocation(payload.new as DriverLocation);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadId]);

  async function loadDriverLocation() {
    try {
      setLoading(true);

      if (!loadId) {
        setDriverLocation(null);
        return;
      }

      const { data, error } = await supabase
        .from("driver_locations")
        .select("*")
        .eq("load_id", loadId)
        .maybeSingle();

      if (error) {
        console.log("Driver location error:", error.message);
        return;
      }

      if (data) {
        setDriverLocation({
          ...data,
          latitude: Number(data.latitude),
          longitude: Number(data.longitude),
        });
      }
    } catch (error: any) {
      Alert.alert(
        "Tracking Error",
        error?.message || "Unable to load tracking."
      );
    } finally {
      setLoading(false);
    }
  }

  function friendlyStatus(status?: string) {
    switch (status) {
      case "READY":
        return "Driver Ready";
      case "EN_ROUTE_TO_PICKUP":
        return "Driver En Route to Farm";
      case "ARRIVED_AT_PICKUP":
        return "Driver Arrived at Farm";
      case "PICKED_UP":
        return "Order Picked Up";
      case "EN_ROUTE_TO_DROPOFF":
        return "Out for Delivery";
      case "ARRIVED_AT_DROPOFF":
        return "Driver Arrived";
      case "DELIVERED":
        return "Delivered";
      default:
        return "Waiting for Driver GPS";
    }
  }

  function estimateEta(status?: string) {
    switch (status) {
      case "READY":
        return "Preparing route";
      case "EN_ROUTE_TO_PICKUP":
        return "Pickup in progress";
      case "ARRIVED_AT_PICKUP":
        return "At pickup location";
      case "PICKED_UP":
        return "Delivery starting soon";
      case "EN_ROUTE_TO_DROPOFF":
        return "Estimated 15–35 min";
      case "ARRIVED_AT_DROPOFF":
        return "Arriving now";
      case "DELIVERED":
        return "Completed";
      default:
        return "Waiting for update";
    }
  }

  function statusProgress(status?: string) {
    const steps = [
      "READY",
      "EN_ROUTE_TO_PICKUP",
      "ARRIVED_AT_PICKUP",
      "PICKED_UP",
      "EN_ROUTE_TO_DROPOFF",
      "ARRIVED_AT_DROPOFF",
      "DELIVERED",
    ];

    const index = steps.indexOf(status || "");
    if (index < 0) return 0;

    return Math.round(((index + 1) / steps.length) * 100);
  }

  const progress = statusProgress(driverLocation?.status);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Farm2Home Tracking</Text>
        <Text style={styles.title}>Live Order Tracking</Text>
        <Text style={styles.subtitle}>
          Track your delivery status, driver GPS, and realtime route updates.
        </Text>
      </View>

      <View style={styles.mapPreview}>
        {loading ? (
          <>
            <ActivityIndicator size="large" color={farmTheme.colors.primary} />
            <Text style={styles.mapText}>Loading live GPS...</Text>
          </>
        ) : driverLocation ? (
          <>
            <Text style={styles.mapIcon}>📍</Text>
            <Text style={styles.mapTitle}>Live GPS Connected</Text>

            <Text style={styles.gpsText}>
              {driverLocation.latitude.toFixed(5)},{" "}
              {driverLocation.longitude.toFixed(5)}
            </Text>

            <Text style={styles.mapText}>
              {Platform.OS === "web"
                ? "Web preview active. Native map can display on iOS/Android."
                : "Driver GPS is updating in realtime."}
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.mapIcon}>🗺️</Text>
            <Text style={styles.mapTitle}>Waiting for Driver GPS</Text>
            <Text style={styles.mapText}>
              Live location will appear once the driver starts tracking.
            </Text>
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Delivery Status</Text>

        <Text style={styles.status}>
          {friendlyStatus(driverLocation?.status)}
        </Text>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>

        <Text style={styles.progressText}>{progress}% complete</Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>ETA</Text>
          <Text style={styles.infoValue}>
            {estimateEta(driverLocation?.status)}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Order ID</Text>
          <Text style={styles.infoValue}>{orderId || "Not provided"}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Load ID</Text>
          <Text style={styles.infoValue}>{loadId || "Not provided"}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Last Update</Text>
          <Text style={styles.infoValue}>
            {driverLocation?.updated_at
              ? new Date(driverLocation.updated_at).toLocaleString()
              : "No update yet"}
          </Text>
        </View>

        {driverLocation?.speed !== null &&
          driverLocation?.speed !== undefined && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Speed</Text>
              <Text style={styles.infoValue}>
                {Number(driverLocation.speed).toFixed(1)} m/s
              </Text>
            </View>
          )}

        <TouchableOpacity style={styles.refreshButton} onPress={loadDriverLocation}>
          <Text style={styles.refreshText}>Refresh Tracking</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.chatButton}
          onPress={() =>
            router.push({
              pathname: "/chat/chat-center",
              params: {
                conversationId: loadId
                  ? `load_${loadId}`
                  : `order_${orderId || "support"}`,
                orderId,
                loadId,
              },
            })
          }
        >
          <Text style={styles.chatText}>Message Support</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.push("/customer/orders")}
        >
          <Text style={styles.backText}>Back to Orders</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.timelineCard}>
        <Text style={styles.cardTitle}>Tracking Timeline</Text>

        {[
          ["READY", "Driver Ready"],
          ["EN_ROUTE_TO_PICKUP", "Heading to Farm"],
          ["ARRIVED_AT_PICKUP", "Arrived at Farm"],
          ["PICKED_UP", "Picked Up"],
          ["EN_ROUTE_TO_DROPOFF", "Out for Delivery"],
          ["ARRIVED_AT_DROPOFF", "Arrived"],
          ["DELIVERED", "Delivered"],
        ].map(([key, label]) => {
          const active = key === driverLocation?.status;

          return (
            <View key={key} style={styles.timelineRow}>
              <View
                style={[
                  styles.timelineDot,
                  active && styles.timelineDotActive,
                ]}
              />
              <Text
                style={[
                  styles.timelineText,
                  active && styles.timelineTextActive,
                ]}
              >
                {label}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: farmTheme.colors.background,
  },
  hero: {
    backgroundColor: farmTheme.colors.primary,
    paddingTop: 64,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  eyebrow: {
    color: "#D1FAE5",
    fontWeight: "900",
    marginBottom: 8,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900",
    marginBottom: 10,
  },
  subtitle: {
    color: "#E8F5E9",
    fontWeight: "700",
    lineHeight: 23,
  },
  mapPreview: {
    backgroundColor: "#F0FDF4",
    margin: 18,
    borderRadius: 24,
    padding: 26,
    alignItems: "center",
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    ...farmTheme.shadow,
  },
  mapIcon: {
    fontSize: 54,
    marginBottom: 10,
  },
  mapTitle: {
    color: farmTheme.colors.primary,
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 8,
  },
  mapText: {
    color: farmTheme.colors.mutedText,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 22,
  },
  gpsText: {
    color: farmTheme.colors.text,
    fontWeight: "900",
    marginBottom: 8,
  },
  card: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    ...farmTheme.shadow,
  },
  cardTitle: {
    color: farmTheme.colors.text,
    fontSize: 23,
    fontWeight: "900",
    marginBottom: 12,
  },
  status: {
    color: farmTheme.colors.primary,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 12,
  },
  progressTrack: {
    height: 12,
    backgroundColor: "#E5E7EB",
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressFill: {
    height: "100%",
    backgroundColor: farmTheme.colors.primary,
  },
  progressText: {
    color: farmTheme.colors.mutedText,
    fontWeight: "800",
    marginBottom: 16,
  },
  infoRow: {
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 13,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  infoLabel: {
    color: farmTheme.colors.mutedText,
    fontWeight: "900",
    marginBottom: 4,
  },
  infoValue: {
    color: farmTheme.colors.text,
    fontWeight: "800",
    lineHeight: 21,
  },
  refreshButton: {
    backgroundColor: farmTheme.colors.primary,
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 10,
  },
  refreshText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  chatButton: {
    backgroundColor: "#111827",
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 12,
  },
  chatText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  backButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: farmTheme.colors.primary,
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 12,
  },
  backText: {
    color: farmTheme.colors.primary,
    fontWeight: "900",
  },
  timelineCard: {
    backgroundColor: "#FFFFFF",
    margin: 18,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
  },
  timelineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  timelineDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#CBD5E1",
  },
  timelineDotActive: {
    backgroundColor: farmTheme.colors.primary,
  },
  timelineText: {
    color: farmTheme.colors.mutedText,
    fontWeight: "800",
  },
  timelineTextActive: {
    color: farmTheme.colors.primary,
    fontWeight: "900",
  },
  bottomSpacer: {
    height: 90,
  },
});