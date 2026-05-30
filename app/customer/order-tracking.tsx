import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { supabase } from "../data/supabaseClient";
import farmTheme from "../styles/farmTheme";

const COLORS = {
  primary: "#2E7D32",
  primaryDark: "#14532D",
  secondary: "#F9A825",
  background: "#F8FAF5",
  card: "#FFFFFF",
  text: "#172017",
  muted: "#75806F",
  border: "#E2E8DA",
  softGreen: "#EAF5E6",
  lightGreen: "#F1FAED",
  danger: "#DC2626",
  dark: "#111827",
};

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

const TRACKING_STEPS = [
  ["READY", "Driver Ready", "Order is waiting for driver dispatch."],
  ["EN_ROUTE_TO_PICKUP", "Heading to Farm", "Driver is going to the farm."],
  ["ARRIVED_AT_PICKUP", "Arrived at Farm", "Driver arrived for pickup."],
  ["PICKED_UP", "Picked Up", "Your order has been picked up."],
  ["EN_ROUTE_TO_DROPOFF", "Out for Delivery", "Driver is heading to you."],
  ["ARRIVED_AT_DROPOFF", "Arrived", "Driver has arrived nearby."],
  ["DELIVERED", "Delivered", "Order delivery is complete."],
];

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
            const nextLocation = payload.new as DriverLocation;

            setDriverLocation({
              ...nextLocation,
              latitude: Number(nextLocation.latitude),
              longitude: Number(nextLocation.longitude),
            });
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
    const steps = TRACKING_STEPS.map(([key]) => key);
    const index = steps.indexOf(status || "");
    if (index < 0) return 0;

    return Math.round(((index + 1) / steps.length) * 100);
  }

  function stepCompleted(stepKey: string) {
    const currentIndex = TRACKING_STEPS.findIndex(
      ([key]) => key === driverLocation?.status
    );
    const stepIndex = TRACKING_STEPS.findIndex(([key]) => key === stepKey);

    return currentIndex >= 0 && stepIndex <= currentIndex;
  }

  const progress = statusProgress(driverLocation?.status);

  return (
    <View style={styles.page}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.topBar}>
          <Pressable
            style={({ pressed }) => [
              styles.backCircle,
              pressed && styles.pressed,
            ]}
            onPress={() => router.push("/customer/orders" as any)}
          >
            <Text style={styles.backCircleText}>‹</Text>
          </Pressable>

          <View style={styles.topTitleBlock}>
            <Text style={styles.title}>Order Tracking</Text>
            <Text style={styles.subtitle}>
              Live delivery updates from Farm2Home
            </Text>
          </View>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroTextBlock}>
            <Text style={styles.heroBadge}>Live GPS</Text>
            <Text style={styles.heroTitle}>
              {friendlyStatus(driverLocation?.status)}
            </Text>
            <Text style={styles.heroText}>
              ETA: {estimateEta(driverLocation?.status)}
            </Text>
          </View>

          <Text style={styles.heroEmoji}>🚚</Text>
        </View>

        <View style={styles.mapCard}>
          {loading ? (
            <>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.mapTitle}>Loading live GPS...</Text>
              <Text style={styles.mapText}>
                Checking for the latest driver location.
              </Text>
            </>
          ) : driverLocation ? (
            <>
              <View style={styles.mapPin}>
                <Text style={styles.mapPinText}>📍</Text>
              </View>

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
              <View style={styles.mapPin}>
                <Text style={styles.mapPinText}>🗺️</Text>
              </View>

              <Text style={styles.mapTitle}>Waiting for Driver GPS</Text>

              <Text style={styles.mapText}>
                Live location will appear once the driver starts tracking.
              </Text>
            </>
          )}
        </View>

        <View style={styles.statusCard}>
          <Text style={styles.cardTitle}>Delivery Status</Text>

          <View style={styles.statusHeader}>
            <View>
              <Text style={styles.statusLabel}>Current Status</Text>
              <Text style={styles.statusText}>
                {friendlyStatus(driverLocation?.status)}
              </Text>
            </View>

            <View style={styles.progressBadge}>
              <Text style={styles.progressBadgeText}>{progress}%</Text>
            </View>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>

          <View style={styles.infoGrid}>
            <View style={styles.infoTile}>
              <Text style={styles.infoLabel}>ETA</Text>
              <Text style={styles.infoValue}>
                {estimateEta(driverLocation?.status)}
              </Text>
            </View>

            <View style={styles.infoTile}>
              <Text style={styles.infoLabel}>Last Update</Text>
              <Text style={styles.infoValue}>
                {driverLocation?.updated_at
                  ? new Date(driverLocation.updated_at).toLocaleString()
                  : "No update yet"}
              </Text>
            </View>

            <View style={styles.infoTile}>
              <Text style={styles.infoLabel}>Order ID</Text>
              <Text style={styles.infoValue}>
                {orderId || "Not provided"}
              </Text>
            </View>

            <View style={styles.infoTile}>
              <Text style={styles.infoLabel}>Load ID</Text>
              <Text style={styles.infoValue}>
                {loadId || "Not provided"}
              </Text>
            </View>

            {driverLocation?.speed !== null &&
              driverLocation?.speed !== undefined && (
                <View style={styles.infoTile}>
                  <Text style={styles.infoLabel}>Speed</Text>
                  <Text style={styles.infoValue}>
                    {Number(driverLocation.speed).toFixed(1)} m/s
                  </Text>
                </View>
              )}
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.refreshButton,
              pressed && styles.pressed,
            ]}
            onPress={loadDriverLocation}
          >
            <Text style={styles.refreshText}>Refresh Tracking</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.chatButton,
              pressed && styles.pressed,
            ]}
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
              } as any)
            }
          >
            <Text style={styles.chatText}>Message Support</Text>
          </Pressable>
        </View>

        <View style={styles.timelineCard}>
          <Text style={styles.cardTitle}>Tracking Timeline</Text>

          {TRACKING_STEPS.map(([key, label, description], index) => {
            const active = key === driverLocation?.status;
            const completed = stepCompleted(key);

            return (
              <View key={key} style={styles.timelineRow}>
                <View style={styles.timelineLeft}>
                  <View
                    style={[
                      styles.timelineDot,
                      completed && styles.timelineDotCompleted,
                      active && styles.timelineDotActive,
                    ]}
                  >
                    <Text style={styles.timelineDotText}>
                      {completed ? "✓" : index + 1}
                    </Text>
                  </View>

                  {index < TRACKING_STEPS.length - 1 && (
                    <View
                      style={[
                        styles.timelineLine,
                        completed && styles.timelineLineCompleted,
                      ]}
                    />
                  )}
                </View>

                <View style={styles.timelineContent}>
                  <Text
                    style={[
                      styles.timelineText,
                      completed && styles.timelineTextCompleted,
                      active && styles.timelineTextActive,
                    ]}
                  >
                    {label}
                  </Text>

                  <Text style={styles.timelineDescription}>
                    {description}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.backOrdersButton,
            pressed && styles.pressed,
          ]}
          onPress={() => router.push("/customer/orders" as any)}
        >
          <Text style={styles.backOrdersText}>Back to Orders</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: COLORS.background || farmTheme.colors.background,
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 44,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
    gap: 12,
  },
  backCircle: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  backCircleText: {
    fontSize: 34,
    color: COLORS.text,
    fontWeight: "900",
    marginTop: -4,
  },
  topTitleBlock: {
    flex: 1,
  },
  title: {
    fontSize: 30,
    fontWeight: "900",
    color: COLORS.text,
  },
  subtitle: {
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 3,
  },
  heroCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 30,
    padding: 20,
    marginBottom: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  heroTextBlock: {
    flex: 1,
    paddingRight: 12,
  },
  heroBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.18)",
    color: "#FFFFFF",
    fontWeight: "900",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: 10,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 25,
    fontWeight: "900",
    lineHeight: 31,
  },
  heroText: {
    color: "#EAF7E6",
    fontWeight: "800",
    lineHeight: 20,
    marginTop: 8,
  },
  heroEmoji: {
    fontSize: 56,
  },
  mapCard: {
    backgroundColor: COLORS.card,
    borderRadius: 30,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
    ...farmTheme.shadow,
  },
  mapPin: {
    width: 78,
    height: 78,
    borderRadius: 28,
    backgroundColor: COLORS.softGreen,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  mapPinText: {
    fontSize: 42,
  },
  mapTitle: {
    color: COLORS.text,
    fontSize: 23,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 10,
    marginBottom: 8,
  },
  mapText: {
    color: COLORS.muted,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 22,
  },
  gpsText: {
    color: COLORS.primary,
    fontWeight: "900",
    marginBottom: 8,
    fontSize: 15,
  },
  statusCard: {
    backgroundColor: COLORS.card,
    borderRadius: 30,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
    ...farmTheme.shadow,
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 23,
    fontWeight: "900",
    marginBottom: 14,
  },
  statusHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
  },
  statusLabel: {
    color: COLORS.muted,
    fontWeight: "900",
    marginBottom: 4,
  },
  statusText: {
    color: COLORS.primary,
    fontSize: 21,
    fontWeight: "900",
    flexShrink: 1,
  },
  progressBadge: {
    backgroundColor: COLORS.softGreen,
    minWidth: 62,
    height: 62,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  progressBadgeText: {
    color: COLORS.primary,
    fontSize: 18,
    fontWeight: "900",
  },
  progressTrack: {
    height: 13,
    backgroundColor: "#E5E7EB",
    borderRadius: 999,
    overflow: "hidden",
    marginTop: 18,
    marginBottom: 16,
  },
  progressFill: {
    height: "100%",
    backgroundColor: COLORS.primary,
  },
  infoGrid: {
    gap: 10,
  },
  infoTile: {
    backgroundColor: COLORS.lightGreen,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  infoLabel: {
    color: COLORS.muted,
    fontWeight: "900",
    marginBottom: 5,
    fontSize: 12,
  },
  infoValue: {
    color: COLORS.text,
    fontWeight: "800",
    lineHeight: 21,
  },
  refreshButton: {
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 18,
    alignItems: "center",
    marginTop: 14,
  },
  refreshText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  chatButton: {
    backgroundColor: COLORS.dark,
    padding: 16,
    borderRadius: 18,
    alignItems: "center",
    marginTop: 12,
  },
  chatText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  timelineCard: {
    backgroundColor: COLORS.card,
    borderRadius: 30,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
    ...farmTheme.shadow,
  },
  timelineRow: {
    flexDirection: "row",
    minHeight: 72,
  },
  timelineLeft: {
    width: 42,
    alignItems: "center",
  },
  timelineDot: {
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },
  timelineDotCompleted: {
    backgroundColor: COLORS.primary,
  },
  timelineDotActive: {
    backgroundColor: COLORS.secondary,
  },
  timelineDotText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 12,
  },
  timelineLine: {
    width: 3,
    flex: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 5,
    borderRadius: 999,
  },
  timelineLineCompleted: {
    backgroundColor: COLORS.primary,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 14,
  },
  timelineText: {
    color: COLORS.muted,
    fontWeight: "900",
    fontSize: 16,
  },
  timelineTextCompleted: {
    color: COLORS.text,
  },
  timelineTextActive: {
    color: COLORS.primary,
  },
  timelineDescription: {
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 4,
    lineHeight: 20,
    fontSize: 13,
  },
  backOrdersButton: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.primary,
    padding: 16,
    borderRadius: 18,
    alignItems: "center",
  },
  backOrdersText: {
    color: COLORS.primary,
    fontWeight: "900",
  },
  pressed: {
    opacity: 0.75,
  },
});