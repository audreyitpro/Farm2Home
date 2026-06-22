// app/freight/tracking.tsx

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
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
  liveLoads: "/freight/live-loads",
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
  bg: "#F7F7FB",
  card: "#FFFFFF",
  panel: "#F8FAFC",
  text: "#0F172A",
  muted: "#64748B",
  border: "#E5E7EB",
  primary: "#6D5DFB",
  primarySoft: "#EEF2FF",
  green: "#10B981",
  amber: "#F59E0B",
  red: "#EF4444",
  blue: "#2563EB",
  navy: "#020617",
  slate: "#64748B",
  white: "#FFFFFF",
};

function statusColor(status?: string) {
  if (status === "Delivered") return COLORS.green;
  if (status === "In Transit") return COLORS.blue;
  if (status === "Driver En Route" || status === "Arrived at Pickup") return COLORS.amber;
  if (status === "Loaded" || status === "Arrived at Dropoff") return COLORS.primary;
  return COLORS.red;
}

function goTo(route: string) {
  router.push(route as any);
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

  function openWithLoad(route: string) {
    router.push({
      pathname: route as any,
      params: loadId ? { loadId } : {},
    });
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.centerText}>Loading freight tracking...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.shell}>
          <View style={styles.sidebar}>
            <View style={styles.brandRow}>
              <View style={styles.brandIcon}>
                <Ionicons name="trail-sign-outline" size={28} color={COLORS.white} />
              </View>
              <View>
                <Text style={styles.brandTitle}>Farm2Home</Text>
                <Text style={styles.brandSubtitle}>Tracking</Text>
              </View>
            </View>

            <View style={styles.sideDivider} />
            <SidebarLink icon="grid-outline" title="Dashboard" route={FREIGHT_ROUTES.dashboard} />
            <SidebarLink icon="search-outline" title="Load Board" route={FREIGHT_ROUTES.board} />
            <SidebarLink icon="briefcase-outline" title="My Loads" route={FREIGHT_ROUTES.myLoads} />
            <SidebarLink icon="pulse-outline" title="Live Loads" route={FREIGHT_ROUTES.liveLoads} />
            <SidebarLink icon="navigate-outline" title="Live Route" route={FREIGHT_ROUTES.liveRoute} />

            <View style={styles.sideNote}>
              <Text style={styles.sideNoteLabel}>Load ID</Text>
              <Text style={styles.sideNoteValue}>{loadId || "Not provided"}</Text>
            </View>
          </View>

          <View style={styles.main}>
            <View style={styles.topPanel}>
              <View style={{ flex: 1 }}>
                <Text style={styles.eyebrow}>Fina Admin Live Tracking</Text>
                <Text style={styles.pageTitle}>Freight Tracking</Text>
                <Text style={styles.pageSubtitle}>
                  Track current freight movement, update carrier status, and review route progress.
                </Text>
              </View>

              <TouchableOpacity style={styles.topIconButton} onPress={goToLiveRoute} activeOpacity={0.85}>
                <Ionicons name="navigate-outline" size={23} color={COLORS.primary} />
              </TouchableOpacity>
            </View>

            {!tracking ? (
              <>
                <View style={styles.emptyCard}>
                  <Ionicons name="trail-sign-outline" size={42} color={COLORS.primary} />
                  <Text style={styles.emptyTitle}>No active tracking found</Text>
                  <Text style={styles.emptyText}>
                    No carrier tracking record is assigned to this load yet. Accept or assign a freight load first, then return to tracking.
                  </Text>

                  <TouchableOpacity style={styles.primaryButton} onPress={() => goTo(FREIGHT_ROUTES.board)} activeOpacity={0.85}>
                    <Ionicons name="list-outline" size={18} color={COLORS.white} />
                    <Text style={styles.primaryText}>Open Load Board</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.secondaryButton} onPress={() => goTo(FREIGHT_ROUTES.myLoads)} activeOpacity={0.85}>
                    <Ionicons name="briefcase-outline" size={18} color={COLORS.primary} />
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
                <View style={styles.metricGrid}>
                  <MetricCard label="Progress" value={`${progressPercent}%`} icon="analytics-outline" />
                  <MetricCard label="Status" value={tracking.status} icon="flag-outline" />
                  <MetricCard label="Load" value={loadId ? `#${String(loadId).slice(-6)}` : "Missing"} icon="cube-outline" />
                  <MetricCard label="Updated" value={tracking.lastUpdated || "Pending"} icon="time-outline" />
                </View>

                <View style={styles.trackingCard}>
                  <View style={styles.trackingTop}>
                    <View style={styles.avatar}>
                      <Ionicons name="business-outline" size={28} color={COLORS.white} />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.carrierName}>{tracking.carrierCompany || "Freight Carrier"}</Text>
                      <Text style={styles.carrierEmail}>{tracking.carrierEmail || "Carrier email not provided"}</Text>
                    </View>
                  </View>

                  <View style={[styles.statusPill, { backgroundColor: statusColor(tracking.status) }]}>
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
                  <QuickLink icon="alert-circle-outline" label="Report Issue" onPress={() => openWithLoad(FREIGHT_ROUTES.loadIssues)} />
                  <QuickLink icon="warning-outline" label="Exception" onPress={() => openWithLoad(FREIGHT_ROUTES.routeExceptions)} />
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
                            <ActivityIndicator size="small" color={COLORS.white} />
                          ) : (
                            <Ionicons
                              name={completed || active ? "checkmark" : "ellipse-outline"}
                              size={18}
                              color={completed || active ? COLORS.white : COLORS.primary}
                            />
                          )}
                        </View>

                        <Text style={[styles.statusButtonText, active && styles.statusButtonTextActive]}>
                          {status}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TouchableOpacity style={styles.darkButton} onPress={goToLiveRoute} activeOpacity={0.85}>
                  <Ionicons name="navigate-outline" size={18} color={COLORS.white} />
                  <Text style={styles.primaryText}>Open Full Live Route</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SidebarLink({
  icon,
  title,
  route,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  route: string;
}) {
  return (
    <TouchableOpacity style={styles.sidebarLink} onPress={() => goTo(route)}>
      <Ionicons name={icon} size={18} color="#A5B4FC" />
      <Text style={styles.sidebarLinkText}>{title}</Text>
    </TouchableOpacity>
  );
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.metricCard}>
      <View style={styles.metricIcon}>
        <Ionicons name={icon} size={21} color={COLORS.primary} />
      </View>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue} numberOfLines={1}>{value}</Text>
    </View>
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
        <Ionicons name={icon} size={20} color={COLORS.white} />
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
    <TouchableOpacity style={styles.quickLink} onPress={onPress || (() => route && goTo(route))} activeOpacity={0.85}>
      <View style={styles.quickIcon}>
        <Ionicons name={icon} size={22} color={COLORS.primary} />
      </View>
      <Text style={styles.quickText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  content: { flexGrow: 1, paddingBottom: 40 },
  center: { flex: 1, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center", padding: 24 },
  centerText: { color: COLORS.muted, marginTop: 12, fontWeight: "800" },
  shell: { flex: 1, flexDirection: Platform.OS === "web" ? "row" : "column" },
  sidebar: {
    backgroundColor: COLORS.navy,
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 22,
    width: Platform.OS === "web" ? 310 : "100%",
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  brandIcon: {
    width: 54,
    height: 54,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  brandTitle: { color: COLORS.white, fontSize: 21, fontWeight: "900" },
  brandSubtitle: { color: "#A5B4FC", fontWeight: "800", marginTop: 2 },
  sideDivider: { height: 1, backgroundColor: "#1E293B", marginVertical: 22 },
  sidebarLink: {
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 14,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    marginBottom: 8,
  },
  sidebarLinkText: { color: "#CBD5E1", fontWeight: "900" },
  sideNote: {
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "#1E293B",
    borderRadius: 18,
    padding: 14,
    marginTop: 12,
  },
  sideNoteLabel: { color: "#A5B4FC", fontWeight: "900", textTransform: "uppercase", fontSize: 11 },
  sideNoteValue: { color: COLORS.white, fontWeight: "900", marginTop: 6 },
  main: { flex: 1, padding: 18 },
  topPanel: {
    backgroundColor: COLORS.white,
    borderRadius: 26,
    padding: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    gap: 14,
    alignItems: "flex-start",
    marginBottom: 14,
  },
  eyebrow: { color: COLORS.primary, fontWeight: "900", fontSize: 12, letterSpacing: 1, textTransform: "uppercase" },
  pageTitle: { color: COLORS.text, fontSize: 34, fontWeight: "900", marginTop: 6 },
  pageSubtitle: { color: COLORS.muted, fontWeight: "700", lineHeight: 22, marginTop: 7, maxWidth: 760 },
  topIconButton: {
    width: 50,
    height: 50,
    borderRadius: 18,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCard: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  emptyTitle: { color: COLORS.text, fontSize: 22, fontWeight: "900", marginTop: 10 },
  emptyText: { color: COLORS.muted, fontWeight: "700", textAlign: "center", marginTop: 8, lineHeight: 22 },
  metricGrid: { flexDirection: Platform.OS === "web" ? "row" : "column", gap: 12, marginBottom: 14 },
  metricCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 22,
    padding: 16,
  },
  metricIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  metricLabel: { color: COLORS.muted, fontWeight: "900", fontSize: 11, textTransform: "uppercase" },
  metricValue: { color: COLORS.text, fontWeight: "900", fontSize: 18, marginTop: 5 },
  trackingCard: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  trackingTop: { flexDirection: "row", gap: 14, alignItems: "center" },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  carrierName: { color: COLORS.text, fontSize: 19, fontWeight: "900" },
  carrierEmail: { color: COLORS.muted, fontWeight: "700", marginTop: 4 },
  statusPill: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, marginTop: 16 },
  statusPillText: { color: COLORS.white, fontSize: 12, fontWeight: "900" },
  progressBox: { marginTop: 18 },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  progressLabel: { color: COLORS.muted, fontWeight: "900" },
  progressValue: { color: COLORS.primary, fontWeight: "900" },
  progressTrack: { height: 10, backgroundColor: "#E5E7EB", borderRadius: 999, overflow: "hidden" },
  progressFill: { height: 10, backgroundColor: COLORS.primary, borderRadius: 999 },
  infoBox: {
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 13,
    marginTop: 16,
  },
  infoRow: { flexDirection: "row", gap: 10, justifyContent: "space-between", marginBottom: 8 },
  infoLabel: { flex: 1, color: COLORS.muted, fontWeight: "900" },
  infoValue: { flex: 1, color: COLORS.text, fontWeight: "900", textAlign: "right" },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
  quickLink: {
    width: Platform.OS === "web" ? "23.5%" : "48%",
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 102,
    justifyContent: "space-between",
  },
  quickIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  quickText: { color: COLORS.text, fontWeight: "900" },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionHeader: { flexDirection: "row", gap: 10, alignItems: "flex-start", marginBottom: 14 },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: { color: COLORS.text, fontSize: 21, fontWeight: "900" },
  sectionSubtitle: { color: COLORS.muted, fontWeight: "700", lineHeight: 20, marginTop: 3 },
  statusButton: {
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 13,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  statusButtonActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft },
  statusButtonCompleted: { borderColor: COLORS.green },
  statusIcon: {
    width: 34,
    height: 34,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  statusIconActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  statusIconCompleted: { backgroundColor: COLORS.green, borderColor: COLORS.green },
  statusButtonText: { color: COLORS.text, fontWeight: "900", flex: 1 },
  statusButtonTextActive: { color: COLORS.primary },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    padding: 15,
    marginTop: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    width: "100%",
  },
  primaryText: { color: COLORS.white, fontWeight: "900" },
  secondaryButton: {
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    borderRadius: 16,
    padding: 15,
    marginTop: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    width: "100%",
  },
  secondaryText: { color: COLORS.primary, fontWeight: "900" },
  darkButton: {
    backgroundColor: COLORS.navy,
    borderRadius: 16,
    padding: 16,
    marginTop: 4,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
});
