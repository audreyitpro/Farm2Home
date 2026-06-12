// app/freight/tracking.tsx

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import {
  getTrackingForLoad,
  updateTracking,
  TrackingRecord,
  TrackingStatus,
} from "./data/trackingStore";

const FREIGHT_ROUTES = {
  dashboard: "/freight/dashboard",
  board: "/freight/board",
  myLoads: "/freight/my-loads",
  liveRoute: "/freight/live-route",
  routeDetails: "/freight/route-details",
  loadIssues: "/freight/load-issues",
  routeExceptions: "/freight/route-exceptions",
  support: "/freight/support",
} as const;

const STATUSES: TrackingStatus[] = [
  "Assigned",
  "Driver En Route",
  "Arrived at Pickup",
  "Loaded",
  "In Transit",
  "Arrived at Dropoff",
  "Delivered",
];

const COLORS = {
  bg: "#F4F5F7",
  card: "#FFFFFF",
  surface: "#F9FAFB",
  black: "#050505",
  red: "#D71920",
  redSoft: "#FFF1F2",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  green: "#16A34A",
  amber: "#D97706",
  blue: "#2563EB",
};

function statusColor(status?: string) {
  if (status === "Delivered") return COLORS.green;
  if (status === "In Transit") return COLORS.blue;
  if (status === "Driver En Route" || status === "Arrived at Pickup") return COLORS.amber;
  return COLORS.red;
}

export default function FreightTracking() {
  const params = useLocalSearchParams();

  const loadId = Array.isArray(params.loadId)
    ? params.loadId[0]
    : String(params.loadId || "");

  const [tracking, setTracking] = useState<TrackingRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState("");

  const currentIndex = useMemo(() => {
    if (!tracking?.status) return 0;
    return Math.max(STATUSES.findIndex((item) => item === tracking.status), 0);
  }, [tracking]);

  const progressPercent = useMemo(() => {
    if (!tracking?.status) return 0;
    return Math.round((currentIndex / (STATUSES.length - 1)) * 100);
  }, [currentIndex, tracking]);

  const loadTracking = useCallback(async () => {
    try {
      setLoading(true);

      if (!loadId) {
        setTracking(null);
        return;
      }

      const trackingData = await getTrackingForLoad(String(loadId));
      setTracking(trackingData);
    } catch (error: any) {
      Alert.alert("Tracking Error", error?.message || "Unable to load tracking.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadId]);

  useEffect(() => {
    loadTracking();
  }, [loadTracking]);

  async function onRefresh() {
    setRefreshing(true);
    await loadTracking();
  }

  async function setStatus(status: TrackingStatus) {
    if (!loadId) {
      Alert.alert("Missing Load", "No load ID was provided for tracking.");
      return;
    }

    try {
      setUpdating(status);

      await updateTracking(String(loadId), status);

      Alert.alert("Tracking Updated", `Status changed to ${status}`);

      await loadTracking();
    } catch (error: any) {
      Alert.alert("Update Error", error?.message || "Unable to update tracking.");
    } finally {
      setUpdating("");
    }
  }

  function goToLiveRoute() {
    router.push({
      pathname: FREIGHT_ROUTES.liveRoute as any,
      params: loadId ? { loadId } : {},
    });
  }

  function goToRouteDetails() {
    if (!loadId) {
      router.push(FREIGHT_ROUTES.myLoads as any);
      return;
    }

    router.push({
      pathname: FREIGHT_ROUTES.routeDetails as any,
      params: { loadId },
    });
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <ActivityIndicator size="large" color={COLORS.red} />
        <Text style={styles.centerText}>Loading freight tracking...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>Farm2Home Freight Connect</Text>
            <Text style={styles.title}>Freight Tracking</Text>
            <Text style={styles.subtitle}>
              Track current freight movement, update carrier status, and review route progress.
            </Text>
          </View>

          <TouchableOpacity style={styles.heroIcon} onPress={goToLiveRoute} activeOpacity={0.85}>
            <Ionicons name="navigate-outline" size={34} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {!tracking ? (
          <>
            <View style={styles.emptyCard}>
              <Ionicons name="trail-sign-outline" size={42} color={COLORS.red} />
              <Text style={styles.emptyTitle}>No active tracking found</Text>
              <Text style={styles.emptyText}>
                No carrier tracking record is assigned to this load yet. Accept or assign a freight
                load first, then return to tracking.
              </Text>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => router.push(FREIGHT_ROUTES.board as any)}
                activeOpacity={0.85}
              >
                <Ionicons name="list-outline" size={18} color="#FFFFFF" />
                <Text style={styles.primaryText}>Open Load Board</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => router.push(FREIGHT_ROUTES.myLoads as any)}
                activeOpacity={0.85}
              >
                <Ionicons name="briefcase-outline" size={18} color={COLORS.red} />
                <Text style={styles.secondaryText}>Open My Loads</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.quickGrid}>
              <QuickLink icon="grid-outline" label="Dashboard" route={FREIGHT_ROUTES.dashboard} />
              <QuickLink icon="briefcase-outline" label="My Loads" route={FREIGHT_ROUTES.myLoads} />
              <QuickLink icon="pulse-outline" label="Live Route" onPress={goToLiveRoute} />
              <QuickLink icon="headset-outline" label="Support" route={FREIGHT_ROUTES.support} />
            </View>
          </>
        ) : (
          <>
            <View style={styles.trackingCard}>
              <View style={styles.trackingTop}>
                <View style={styles.avatar}>
                  <Ionicons name="business-outline" size={28} color="#FFFFFF" />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.carrierName}>
                    {tracking.carrierCompany || "Freight Carrier"}
                  </Text>
                  <Text style={styles.carrierEmail}>
                    {tracking.carrierEmail || "Carrier email not provided"}
                  </Text>
                </View>
              </View>

              <View
                style={[
                  styles.statusPill,
                  { backgroundColor: statusColor(tracking.status) },
                ]}
              >
                <Text style={styles.statusPillText}>{tracking.status}</Text>
              </View>

              <View style={styles.progressBox}>
                <View style={styles.progressHeader}>
                  <Text style={styles.progressLabel}>Route Progress</Text>
                  <Text style={styles.progressValue}>{progressPercent}%</Text>
                </View>

                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
                </View>
              </View>

              <View style={styles.infoBox}>
                <InfoRow label="Load ID" value={loadId || "Not provided"} />
                <InfoRow label="Current Status" value={tracking.status} />
                <InfoRow label="Last Updated" value={tracking.lastUpdated || "Not recorded"} />
              </View>
            </View>

            <View style={styles.quickGrid}>
              <QuickLink icon="map-outline" label="Live Route" onPress={goToLiveRoute} />
              <QuickLink icon="trail-sign-outline" label="Route Details" onPress={goToRouteDetails} />
              <QuickLink
                icon="alert-circle-outline"
                label="Report Issue"
                onPress={() =>
                  router.push({
                    pathname: FREIGHT_ROUTES.loadIssues as any,
                    params: { loadId },
                  })
                }
              />
              <QuickLink
                icon="warning-outline"
                label="Exception"
                onPress={() =>
                  router.push({
                    pathname: FREIGHT_ROUTES.routeExceptions as any,
                    params: { loadId },
                  })
                }
              />
            </View>

            <View style={styles.card}>
              <SectionHeader
                icon="checkmark-circle-outline"
                title="Update Tracking Status"
                subtitle="Select the current freight movement status."
              />

              {STATUSES.map((status, index) => {
                const active = tracking.status === status;
                const completed = index < currentIndex;

                return (
                  <TouchableOpacity
                    key={status}
                    style={[
                      styles.statusButton,
                      active && styles.statusButtonActive,
                      completed && styles.statusButtonCompleted,
                    ]}
                    onPress={() => setStatus(status)}
                    activeOpacity={0.85}
                    disabled={Boolean(updating)}
                  >
                    <View
                      style={[
                        styles.statusIcon,
                        active && styles.statusIconActive,
                        completed && styles.statusIconCompleted,
                      ]}
                    >
                      {updating === status ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Ionicons
                          name={completed || active ? "checkmark" : "ellipse-outline"}
                          size={18}
                          color={completed || active ? "#FFFFFF" : COLORS.red}
                        />
                      )}
                    </View>

                    <Text
                      style={[
                        styles.statusButtonText,
                        active && styles.statusButtonTextActive,
                      ]}
                    >
                      {status}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity style={styles.darkButton} onPress={goToLiveRoute} activeOpacity={0.85}>
              <Ionicons name="navigate-outline" size={18} color="#FFFFFF" />
              <Text style={styles.primaryText}>Open Full Live Route</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIcon}>
        <Ionicons name={icon} size={20} color="#FFFFFF" />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

function QuickLink({
  icon,
  label,
  route,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  route?: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.quickLink}
      onPress={onPress || (() => route && router.push(route as any))}
      activeOpacity={0.85}
    >
      <Ionicons name={icon} size={22} color={COLORS.red} />
      <Text style={styles.quickText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  content: {
    paddingBottom: 90,
  },
  center: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  centerText: {
    color: COLORS.muted,
    marginTop: 12,
    fontWeight: "800",
  },
  hero: {
    backgroundColor: COLORS.black,
    paddingTop: 30,
    paddingHorizontal: 20,
    paddingBottom: 30,
    flexDirection: "row",
    gap: 14,
    alignItems: "flex-start",
  },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 24,
    backgroundColor: COLORS.red,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: {
    color: "#FCA5A5",
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
    fontSize: 12,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "900",
    marginTop: 6,
  },
  subtitle: {
    color: "#D1D5DB",
    marginTop: 8,
    lineHeight: 22,
    fontWeight: "700",
  },
  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    marginHorizontal: 18,
    marginTop: 16,
    marginBottom: 16,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "900",
    marginTop: 10,
  },
  emptyText: {
    color: COLORS.muted,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 22,
  },
  trackingCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 18,
    marginHorizontal: 18,
    marginTop: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  trackingTop: {
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: COLORS.red,
    alignItems: "center",
    justifyContent: "center",
  },
  carrierName: {
    color: COLORS.text,
    fontSize: 19,
    fontWeight: "900",
  },
  carrierEmail: {
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 4,
  },
  statusPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 16,
  },
  statusPillText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },
  progressBox: {
    marginTop: 18,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  progressLabel: {
    color: COLORS.muted,
    fontWeight: "900",
  },
  progressValue: {
    color: COLORS.red,
    fontWeight: "900",
  },
  progressTrack: {
    height: 10,
    backgroundColor: "#E5E7EB",
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: 10,
    backgroundColor: COLORS.red,
    borderRadius: 999,
  },
  infoBox: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 13,
    marginTop: 16,
  },
  infoRow: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
    marginBottom: 8,
  },
  infoLabel: {
    flex: 1,
    color: COLORS.muted,
    fontWeight: "900",
  },
  infoValue: {
    flex: 1,
    color: COLORS.text,
    fontWeight: "900",
    textAlign: "right",
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 18,
    marginBottom: 16,
  },
  quickLink: {
    width: "48%",
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    gap: 8,
  },
  quickText: {
    color: COLORS.text,
    fontWeight: "900",
    textAlign: "center",
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 18,
    marginHorizontal: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionHeader: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    marginBottom: 14,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: COLORS.black,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 21,
    fontWeight: "900",
  },
  sectionSubtitle: {
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 3,
  },
  statusButton: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 13,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  statusButtonActive: {
    borderColor: COLORS.red,
    backgroundColor: COLORS.redSoft,
  },
  statusButtonCompleted: {
    borderColor: COLORS.green,
  },
  statusIcon: {
    width: 34,
    height: 34,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: COLORS.red,
    alignItems: "center",
    justifyContent: "center",
  },
  statusIconActive: {
    backgroundColor: COLORS.red,
    borderColor: COLORS.red,
  },
  statusIconCompleted: {
    backgroundColor: COLORS.green,
    borderColor: COLORS.green,
  },
  statusButtonText: {
    color: COLORS.text,
    fontWeight: "900",
    flex: 1,
  },
  statusButtonTextActive: {
    color: COLORS.red,
  },
  primaryButton: {
    backgroundColor: COLORS.red,
    borderRadius: 16,
    padding: 15,
    marginTop: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    width: "100%",
  },
  primaryText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  secondaryButton: {
    backgroundColor: COLORS.redSoft,
    borderWidth: 1,
    borderColor: COLORS.red,
    borderRadius: 16,
    padding: 15,
    marginTop: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    width: "100%",
  },
  secondaryText: {
    color: COLORS.red,
    fontWeight: "900",
  },
  darkButton: {
    backgroundColor: COLORS.black,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 18,
    marginTop: 4,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
});