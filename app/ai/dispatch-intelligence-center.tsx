// app/ai/dispatch-intelligence-center.tsx

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../services/supabaseClient";

const ui = {
  bg: "#F5F7FB",
  card: "#FFFFFF",
  border: "#E5E7EB",
  text: "#111827",
  muted: "#6B7280",
  soft: "#F9FAFB",
  primary: "#7C3AED",
  primarySoft: "#EDE9FE",
  green: "#10B981",
  blue: "#2563EB",
  orange: "#F59E0B",
  red: "#EF4444",
};

type LoadStatus =
  | "OPEN"
  | "PENDING"
  | "ASSIGNED"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "CANCELLED"
  | "URGENT"
  | "available"
  | "accepted"
  | "assigned"
  | "arrived_pickup"
  | "picked_up"
  | "in_transit"
  | "delivered"
  | "cancelled";

type FreightLoad = {
  id?: string | number;
  load_id?: string | number;
  freight_load_id?: string | number;
  title?: string;
  loadTitle?: string;
  pickup_city?: string;
  pickup_state?: string;
  pickupCity?: string;
  pickupState?: string;
  delivery_city?: string;
  delivery_state?: string;
  dropoff_city?: string;
  dropoff_state?: string;
  deliveryCity?: string;
  deliveryState?: string;
  pickup_location?: string;
  dropoff_location?: string;
  pickup_date?: string;
  delivery_date?: string;
  status?: LoadStatus | string;
  amount?: number;
  rate?: number;
  price?: number;
  miles?: number;
  distance_miles?: number;
  weight?: number;
  commodity?: string;
  equipment_type?: string;
  equipmentType?: string;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | string;
  driver_id?: string | number | null;
  accepted_by?: string | null;
  driver_name?: string | null;
  carrier_name?: string | null;
  farmer_id?: string | number | null;
  created_at?: string;
  updated_at?: string;
};

type DispatchRecommendation = {
  id: string;
  load: FreightLoad;
  score: number;
  reason: string;
  risk: "Low" | "Medium" | "High";
  action: "Assign Driver" | "Review Load" | "Alert Admin" | "Monitor";
};

function getLoadId(load?: FreightLoad | null): string {
  if (!load) return "";
  return String(load.id ?? load.load_id ?? load.freight_load_id ?? "");
}

function getLoadTitle(load: FreightLoad): string {
  return load.title || load.loadTitle || `Load ${getLoadId(load) || "Unknown"}`;
}

function getPickup(load: FreightLoad): string {
  if (load.pickup_location) return load.pickup_location;
  const city = load.pickup_city || load.pickupCity || "Pickup";
  const state = load.pickup_state || load.pickupState || "";
  return state ? `${city}, ${state}` : city;
}

function getDelivery(load: FreightLoad): string {
  if (load.dropoff_location) return load.dropoff_location;
  const city = load.delivery_city || load.dropoff_city || load.deliveryCity || "Delivery";
  const state = load.delivery_state || load.dropoff_state || load.deliveryState || "";
  return state ? `${city}, ${state}` : city;
}

function getRate(load: FreightLoad): number {
  return Number(load.amount ?? load.rate ?? load.price ?? 0);
}

function getMiles(load: FreightLoad): number {
  return Number(load.miles ?? load.distance_miles ?? 0);
}

function money(value: number): string {
  return `$${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function normalizeStatus(status?: string): string {
  return String(status || "OPEN").toUpperCase();
}

function hasAssignedDriver(load: FreightLoad): boolean {
  return Boolean(load.driver_id || load.accepted_by || load.driver_name);
}

function buildRecommendation(load: FreightLoad): DispatchRecommendation {
  const status = normalizeStatus(load.status);
  const priority = String(load.priority || "MEDIUM").toUpperCase();
  const assignedDriver = hasAssignedDriver(load);
  const rate = getRate(load);
  const miles = getMiles(load);

  let score = 70;
  let risk: DispatchRecommendation["risk"] = "Low";
  let action: DispatchRecommendation["action"] = "Monitor";
  let reason = "Load is stable and ready for dispatch monitoring.";

  if (!assignedDriver && ["OPEN", "PENDING", "URGENT", "AVAILABLE"].includes(status)) {
    score += 12;
    action = "Assign Driver";
    reason = "No driver is assigned. Recommend matching this load to an available driver.";
  }

  if (priority === "HIGH" || priority === "CRITICAL" || status === "URGENT") {
    score += 10;
    risk = priority === "CRITICAL" || status === "URGENT" ? "High" : "Medium";
    action = risk === "High" ? "Alert Admin" : action;
    reason =
      risk === "High"
        ? "Critical-priority load needs admin visibility immediately."
        : "High-priority load should be watched closely.";
  }

  if (rate <= 0) {
    score -= 15;
    risk = "High";
    action = "Review Load";
    reason = "Load appears to be missing a rate or price. Review before dispatch.";
  }

  if (miles > 150 && !assignedDriver) {
    score += 6;
    risk = risk === "High" ? "High" : "Medium";
    action = action === "Alert Admin" ? action : "Assign Driver";
    reason = "Long-distance open load should be assigned quickly to protect ETA.";
  }

  if (["DELIVERED", "CANCELLED"].includes(status)) {
    score = 40;
    risk = "Low";
    action = "Monitor";
    reason = status === "DELIVERED" ? "Load is already delivered." : "Load was cancelled. Review only if needed.";
  }

  return {
    id: `rec-${getLoadId(load) || Math.random().toString(36).slice(2)}`,
    load,
    score: Math.max(0, Math.min(100, score)),
    reason,
    risk,
    action,
  };
}

export default function DispatchIntelligenceCenter() {
  const router = useRouter();

  const [loads, setLoads] = useState<FreightLoad[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [sendingAlertId, setSendingAlertId] = useState<string | null>(null);

  const fetchLoads = useCallback(async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("freight_loads")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setLoads(Array.isArray(data) ? data : []);
    } catch (error: any) {
      Alert.alert("Dispatch Load Error", error?.message || "Unable to load freight dispatch data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLoads();
  }, [fetchLoads]);

  const recommendations = useMemo(() => {
    const q = search.trim().toLowerCase();

    return loads
      .filter((load) => {
        const status = normalizeStatus(load.status);
        if (statusFilter !== "ALL" && status !== statusFilter) return false;
        if (!q) return true;

        const haystack = [
          getLoadId(load),
          getLoadTitle(load),
          getPickup(load),
          getDelivery(load),
          load.commodity,
          load.equipment_type,
          load.equipmentType,
          load.status,
          load.priority,
          load.driver_name,
          load.accepted_by,
          load.carrier_name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(q);
      })
      .map(buildRecommendation)
      .sort((a, b) => b.score - a.score);
  }, [loads, search, statusFilter]);

  const stats = useMemo(() => {
    const open = loads.filter((x) =>
      ["OPEN", "PENDING", "URGENT", "AVAILABLE"].includes(normalizeStatus(x.status))
    ).length;

    const assigned = loads.filter((x) =>
      ["ASSIGNED", "ACCEPTED", "ARRIVED_PICKUP", "PICKED_UP", "IN_TRANSIT"].includes(normalizeStatus(x.status))
    ).length;

    const delivered = loads.filter((x) => normalizeStatus(x.status) === "DELIVERED").length;

    const critical = loads.filter((x) => {
      const status = normalizeStatus(x.status);
      const priority = String(x.priority || "").toUpperCase();
      return status === "URGENT" || priority === "CRITICAL";
    }).length;

    return { open, assigned, delivered, critical, total: loads.length };
  }, [loads]);

  async function notifyAdminAlert(item: DispatchRecommendation) {
    const load = item.load;
    const loadId = getLoadId(load);

    if (!loadId) {
      Alert.alert("Missing Load ID", "This load does not have a valid ID.");
      return;
    }

    try {
      setSendingAlertId(loadId);

      const payload = {
        alert_type: "DISPATCH_INTELLIGENCE_ALERT",
        load_id: loadId,
        title: getLoadTitle(load),
        message: item.reason,
        risk_level: item.risk,
        score: item.score,
        status: "OPEN",
        metadata: {
          loadId,
          pickup: getPickup(load),
          delivery: getDelivery(load),
          rate: getRate(load),
          miles: getMiles(load),
          loadStatus: load.status,
          priority: load.priority,
          driverId: load.driver_id,
          driverName: load.driver_name,
          acceptedBy: load.accepted_by,
          createdAt: new Date().toISOString(),
        },
      };

      const { error } = await supabase.from("admin_alerts").insert(payload);
      if (error) throw error;

      Alert.alert("Admin Alert Sent", "Dispatch alert has been sent to admin.");
    } catch (error: any) {
      Alert.alert(
        "Alert Failed",
        error?.message || "Unable to send admin dispatch alert. Make sure the admin_alerts table exists."
      );
    } finally {
      setSendingAlertId(null);
    }
  }

  async function updateLoadStatus(load: FreightLoad, nextStatus: LoadStatus) {
    const loadId = getLoadId(load);

    if (!loadId) {
      Alert.alert("Missing Load ID", "This load cannot be updated.");
      return;
    }

    try {
      const { error } = await supabase
        .from("freight_loads")
        .update({
          status: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", loadId);

      if (error) throw error;

      setLoads((prev) =>
        prev.map((item) =>
          getLoadId(item) === loadId
            ? { ...item, status: nextStatus, updated_at: new Date().toISOString() }
            : item
        )
      );

      Alert.alert("Load Updated", `Load status changed to ${nextStatus}.`);
    } catch (error: any) {
      Alert.alert("Update Failed", error?.message || "Could not update load.");
    }
  }

  function getRiskColor(risk: DispatchRecommendation["risk"]) {
    if (risk === "High") return ui.red;
    if (risk === "Medium") return ui.orange;
    return ui.green;
  }

  function renderRecommendation({ item }: { item: DispatchRecommendation }) {
    const load = item.load;
    const loadId = getLoadId(load);
    const status = normalizeStatus(load.status);
    const isSending = sendingAlertId === loadId;
    const riskColor = getRiskColor(item.risk);

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.loadIcon}>
            <Ionicons name="cube-outline" size={22} color={ui.primary} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{getLoadTitle(load)}</Text>
            <Text style={styles.cardSub}>
              #{loadId || "NO-ID"} • {status.replace("_", " ")}
            </Text>
          </View>

          <View style={[styles.scoreBadge, { backgroundColor: `${riskColor}18` }]}>
            <Text style={[styles.scoreText, { color: riskColor }]}>{item.score}</Text>
          </View>
        </View>

        <View style={styles.routeBox}>
          <View style={styles.routeItem}>
            <Ionicons name="location-outline" size={18} color={ui.green} />
            <Text style={styles.routeText}>{getPickup(load)}</Text>
          </View>

          <Ionicons name="arrow-down-outline" size={18} color={ui.muted} />

          <View style={styles.routeItem}>
            <Ionicons name="flag-outline" size={18} color={ui.blue} />
            <Text style={styles.routeText}>{getDelivery(load)}</Text>
          </View>
        </View>

        <View style={styles.infoGrid}>
          <InfoPill label="Rate" value={money(getRate(load))} />
          <InfoPill label="Miles" value={getMiles(load).toFixed(0)} />
          <InfoPill label="Risk" value={item.risk} />
        </View>

        <View style={styles.aiBox}>
          <Ionicons name="sparkles-outline" size={18} color={ui.primary} />
          <Text style={styles.aiText}>{item.reason}</Text>
        </View>

        <View style={styles.actionRow}>
          <Pressable style={styles.secondaryButton} onPress={() => updateLoadStatus(load, "ASSIGNED")}>
            <Ionicons name="checkmark-circle-outline" size={17} color={ui.primary} />
            <Text style={styles.secondaryButtonText}>Mark Assigned</Text>
          </Pressable>

          <Pressable style={styles.alertButton} onPress={() => notifyAdminAlert(item)} disabled={isSending}>
            {isSending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="warning-outline" size={17} color="#FFFFFF" />
                <Text style={styles.alertButtonText}>Alert Admin</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <StatusBar barStyle="dark-content" backgroundColor={ui.bg} />
        <ActivityIndicator size="large" color={ui.primary} />
        <Text style={styles.loadingText}>Loading dispatch intelligence...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={ui.bg} />

      <View style={styles.shell}>
        <View style={styles.sidebar}>
          <View style={styles.logoRow}>
            <View style={styles.logoMark}>
              <Text style={styles.logoText}>F2H</Text>
            </View>

            <View>
              <Text style={styles.logoTitle}>Farm2Home</Text>
              <Text style={styles.logoSub}>Dispatch AI</Text>
            </View>
          </View>

          <NavButton label="Dashboard" icon="grid-outline" route="/admin/dashboard" />
          <NavButton label="Control Tower" icon="radio-outline" route="/admin/control-tower" />
          <NavButton label="Live Ops" icon="navigate-outline" route="/admin/live-operations-center" />
          <NavButton label="Fleet Map" icon="map-outline" route="/admin/fleet-map" />
          <NavButton label="Freight Loads" icon="cube-outline" route="/admin/freight-loads" />
          <NavButton label="Analytics" icon="analytics-outline" route="/admin/analytics-center" />
        </View>

        <View style={styles.main}>
          <View style={styles.topbar}>
            <View>
              <Text style={styles.welcome}>Farm2Home AI Operations</Text>
              <Text style={styles.pageTitle}>Dispatch Intelligence</Text>
              <Text style={styles.pageSub}>
                AI freight load monitoring, driver assignment recommendations, risk scoring, and admin alerts.
              </Text>
            </View>

            <TouchableOpacity style={styles.refreshPill} onPress={fetchLoads}>
              <Ionicons name="refresh-outline" size={18} color={ui.primary} />
              <Text style={styles.refreshPillText}>Refresh</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.statsGrid}>
              <StatCard label="Total Loads" value={stats.total} icon="cube-outline" accent />
              <StatCard label="Open Loads" value={stats.open} icon="file-tray-outline" />
              <StatCard label="Assigned" value={stats.assigned} icon="car-outline" />
              <StatCard label="Delivered" value={stats.delivered} icon="checkmark-done-outline" success />
              <StatCard label="Critical" value={stats.critical} icon="warning-outline" danger />
            </View>

            <View style={styles.searchWrap}>
              <Ionicons name="search-outline" size={18} color={ui.primary} />
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="Search load, city, state, equipment..."
                placeholderTextColor={ui.muted}
              />
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              {["ALL", "OPEN", "PENDING", "URGENT", "AVAILABLE", "ASSIGNED", "ACCEPTED", "IN_TRANSIT", "DELIVERED"].map(
                (status) => (
                  <Pressable
                    key={status}
                    style={[styles.filterChip, statusFilter === status && styles.filterChipActive]}
                    onPress={() => setStatusFilter(status)}
                  >
                    <Text style={[styles.filterText, statusFilter === status && styles.filterTextActive]}>
                      {status.replace("_", " ")}
                    </Text>
                  </Pressable>
                )
              )}
            </ScrollView>

            <View style={styles.dataSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>AI Recommendations</Text>
                <Text style={styles.sectionLink}>{recommendations.length} records</Text>
              </View>

              <FlatList
                data={recommendations}
                keyExtractor={(item) => item.id}
                renderItem={renderRecommendation}
                scrollEnabled={false}
                contentContainerStyle={{ paddingBottom: 80 }}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={() => {
                      setRefreshing(true);
                      fetchLoads();
                    }}
                  />
                }
                ListEmptyComponent={
                  <View style={styles.emptyBox}>
                    <Ionicons name="analytics-outline" size={42} color={ui.primary} />
                    <Text style={styles.emptyTitle}>No loads found</Text>
                    <Text style={styles.emptyText}>
                      Dispatch intelligence will appear when freight loads are available.
                    </Text>
                  </View>
                }
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

function NavButton({
  label,
  icon,
  route,
  active = false,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  active?: boolean;
}) {
  const router = useRouter();

  return (
    <TouchableOpacity
      style={[styles.navButton, active && styles.navButtonActive]}
      onPress={() => router.push(route as any)}
    >
      <Ionicons name={icon} size={18} color={active ? "#FFFFFF" : ui.muted} />
      <Text style={[styles.navText, active && styles.navTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function StatCard({
  label,
  value,
  icon,
  accent = false,
  success = false,
  danger = false,
}: {
  label: string;
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
  accent?: boolean;
  success?: boolean;
  danger?: boolean;
}) {
  const color = danger ? ui.red : success ? ui.green : accent ? ui.primary : ui.blue;

  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>

      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoPill}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: ui.bg },
  loadingScreen: {
    flex: 1,
    backgroundColor: ui.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: { color: ui.muted, marginTop: 12, fontSize: 15, fontWeight: "800" },
  shell: { flex: 1, backgroundColor: ui.bg },
  sidebar: {
    backgroundColor: ui.card,
    borderBottomWidth: 1,
    borderBottomColor: ui.border,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 12,
  },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  logoMark: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: ui.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: { color: "#FFFFFF", fontWeight: "900", fontSize: 13 },
  logoTitle: { color: ui.text, fontWeight: "900", fontSize: 18 },
  logoSub: { color: ui.muted, fontWeight: "700", fontSize: 12 },
  navButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: ui.soft,
  },
  navButtonActive: { backgroundColor: ui.primary },
  navText: { color: ui.muted, fontWeight: "900", fontSize: 13 },
  navTextActive: { color: "#FFFFFF" },
  main: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  topbar: {
    backgroundColor: ui.card,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: ui.border,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  welcome: { color: ui.muted, fontWeight: "800", marginBottom: 4 },
  pageTitle: { color: ui.text, fontSize: 26, fontWeight: "900" },
  pageSub: { color: ui.muted, marginTop: 4, fontWeight: "700", maxWidth: 780 },
  refreshPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: ui.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  refreshPillText: { color: ui.primary, fontWeight: "900" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 14 },
  statCard: {
    width: "48%",
    backgroundColor: ui.card,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: ui.border,
  },
  statIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  statValue: { color: ui.text, fontSize: 22, fontWeight: "900" },
  statLabel: { color: ui.muted, fontWeight: "800", marginTop: 4 },
  searchWrap: {
    backgroundColor: ui.card,
    borderRadius: 18,
    paddingHorizontal: 14,
    height: 52,
    borderWidth: 1,
    borderColor: ui.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  searchInput: { flex: 1, color: ui.text, fontSize: 14, fontWeight: "800" },
  filterRow: { gap: 8, paddingBottom: 14 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: ui.card,
    borderWidth: 1,
    borderColor: ui.border,
  },
  filterChipActive: { backgroundColor: ui.primary, borderColor: ui.primary },
  filterText: { color: ui.primary, fontSize: 12, fontWeight: "900" },
  filterTextActive: { color: "#FFFFFF" },
  dataSection: {
    backgroundColor: ui.card,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: ui.border,
    marginBottom: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: { color: ui.text, fontSize: 19, fontWeight: "900" },
  sectionLink: { color: ui.primary, fontWeight: "900", fontSize: 12 },
  card: {
    backgroundColor: ui.soft,
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: ui.border,
  },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  loadIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: ui.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { color: ui.text, fontSize: 17, fontWeight: "900" },
  cardSub: { color: ui.muted, fontSize: 12, marginTop: 4, fontWeight: "700" },
  scoreBadge: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreText: { fontSize: 16, fontWeight: "900" },
  routeBox: {
    marginTop: 14,
    padding: 14,
    borderRadius: 18,
    backgroundColor: ui.card,
    borderWidth: 1,
    borderColor: ui.border,
    gap: 8,
  },
  routeItem: { flexDirection: "row", alignItems: "center", gap: 9 },
  routeText: { color: ui.text, fontSize: 14, fontWeight: "700" },
  infoGrid: { flexDirection: "row", gap: 8, marginTop: 12 },
  infoPill: {
    flex: 1,
    backgroundColor: ui.card,
    borderRadius: 16,
    padding: 11,
    borderWidth: 1,
    borderColor: ui.border,
  },
  infoLabel: { color: ui.muted, fontSize: 11, fontWeight: "800" },
  infoValue: { color: ui.text, fontWeight: "900", marginTop: 3 },
  aiBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    marginTop: 12,
    padding: 13,
    borderRadius: 18,
    backgroundColor: ui.primarySoft,
    borderWidth: 1,
    borderColor: "#DDD6FE",
  },
  aiText: { flex: 1, color: ui.text, fontSize: 13, lineHeight: 19, fontWeight: "700" },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  secondaryButton: {
    flex: 1,
    height: 44,
    borderRadius: 15,
    backgroundColor: ui.card,
    borderWidth: 1,
    borderColor: ui.border,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  secondaryButtonText: { color: ui.primary, fontWeight: "900", fontSize: 13 },
  alertButton: {
    flex: 1,
    height: 44,
    borderRadius: 15,
    backgroundColor: ui.orange,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  alertButtonText: { color: "#FFFFFF", fontWeight: "900", fontSize: 13 },
  emptyBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 70,
    paddingHorizontal: 24,
  },
  emptyTitle: { color: ui.text, fontSize: 18, fontWeight: "900", marginTop: 12 },
  emptyText: { color: ui.muted, textAlign: "center", marginTop: 7, lineHeight: 20 },
});