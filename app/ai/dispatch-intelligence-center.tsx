// app/ai/dispatch-intelligence-center.tsx

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../services/supabaseClient";

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

  const city =
    load.delivery_city || load.dropoff_city || load.deliveryCity || "Delivery";
  const state =
    load.delivery_state || load.dropoff_state || load.deliveryState || "";

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

  if (
    !assignedDriver &&
    ["OPEN", "PENDING", "URGENT", "AVAILABLE"].includes(status)
  ) {
    score += 12;
    action = "Assign Driver";
    reason =
      "No driver is assigned. Recommend matching this load to an available driver.";
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
    reason =
      "Load appears to be missing a rate or price. Review before dispatch.";
  }

  if (miles > 150 && !assignedDriver) {
    score += 6;
    risk = risk === "High" ? "High" : "Medium";
    action = action === "Alert Admin" ? action : "Assign Driver";
    reason =
      "Long-distance open load should be assigned quickly to protect ETA.";
  }

  if (["DELIVERED", "CANCELLED"].includes(status)) {
    score = 40;
    risk = "Low";
    action = "Monitor";
    reason =
      status === "DELIVERED"
        ? "Load is already delivered."
        : "Load was cancelled. Review only if needed.";
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
      console.log("Dispatch fetch error:", error);
      Alert.alert(
        "Dispatch Load Error",
        error?.message || "Unable to load freight dispatch data."
      );
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
      ["OPEN", "PENDING", "URGENT", "AVAILABLE"].includes(
        normalizeStatus(x.status)
      )
    ).length;

    const assigned = loads.filter((x) =>
      [
        "ASSIGNED",
        "ACCEPTED",
        "ARRIVED_PICKUP",
        "PICKED_UP",
        "IN_TRANSIT",
      ].includes(normalizeStatus(x.status))
    ).length;

    const delivered = loads.filter(
      (x) => normalizeStatus(x.status) === "DELIVERED"
    ).length;

    const critical = loads.filter((x) => {
      const status = normalizeStatus(x.status);
      const priority = String(x.priority || "").toUpperCase();
      return status === "URGENT" || priority === "CRITICAL";
    }).length;

    return { open, assigned, delivered, critical };
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
      console.log("notifyAdminAlert error:", error);
      Alert.alert(
        "Alert Failed",
        error?.message ||
          "Unable to send admin dispatch alert. Make sure the admin_alerts table exists."
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
            ? {
                ...item,
                status: nextStatus,
                updated_at: new Date().toISOString(),
              }
            : item
        )
      );

      Alert.alert("Load Updated", `Load status changed to ${nextStatus}.`);
    } catch (error: any) {
      Alert.alert("Update Failed", error?.message || "Could not update load.");
    }
  }

  function renderRecommendation({ item }: { item: DispatchRecommendation }) {
    const load = item.load;
    const loadId = getLoadId(load);
    const status = normalizeStatus(load.status);
    const isSending = sendingAlertId === loadId;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{getLoadTitle(load)}</Text>
            <Text style={styles.cardSub}>
              #{loadId || "NO-ID"} • {status.replace("_", " ")}
            </Text>
          </View>

          <View
            style={[
              styles.scoreBadge,
              item.risk === "High" && styles.scoreHigh,
              item.risk === "Medium" && styles.scoreMedium,
            ]}
          >
            <Text style={styles.scoreText}>{item.score}</Text>
          </View>
        </View>

        <View style={styles.routeBox}>
          <View style={styles.routeItem}>
            <Ionicons name="location" size={18} color="#4ade80" />
            <Text style={styles.routeText}>{getPickup(load)}</Text>
          </View>

          <Ionicons name="arrow-down" size={18} color="#94a3b8" />

          <View style={styles.routeItem}>
            <Ionicons name="flag" size={18} color="#38bdf8" />
            <Text style={styles.routeText}>{getDelivery(load)}</Text>
          </View>
        </View>

        <View style={styles.infoGrid}>
          <View style={styles.infoPill}>
            <Text style={styles.infoLabel}>Rate</Text>
            <Text style={styles.infoValue}>{money(getRate(load))}</Text>
          </View>

          <View style={styles.infoPill}>
            <Text style={styles.infoLabel}>Miles</Text>
            <Text style={styles.infoValue}>{getMiles(load).toFixed(0)}</Text>
          </View>

          <View style={styles.infoPill}>
            <Text style={styles.infoLabel}>Risk</Text>
            <Text style={styles.infoValue}>{item.risk}</Text>
          </View>
        </View>

        <View style={styles.aiBox}>
          <Ionicons name="sparkles" size={18} color="#facc15" />
          <Text style={styles.aiText}>{item.reason}</Text>
        </View>

        <View style={styles.actionRow}>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => updateLoadStatus(load, "ASSIGNED")}
          >
            <Ionicons name="checkmark-circle" size={17} color="#e2e8f0" />
            <Text style={styles.secondaryButtonText}>Mark Assigned</Text>
          </Pressable>

          <Pressable
            style={styles.alertButton}
            onPress={() => notifyAdminAlert(item)}
            disabled={isSending}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#111827" />
            ) : (
              <>
                <Ionicons name="warning" size={17} color="#111827" />
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
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4ade80" />
          <Text style={styles.loadingText}>Loading dispatch intelligence...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#e2e8f0" />
        </Pressable>

        <View>
          <Text style={styles.headerTitle}>Dispatch Intelligence</Text>
          <Text style={styles.headerSub}>AI freight load monitoring</Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.statsRow}
      >
        <StatCard label="Open Loads" value={stats.open} icon="cube" />
        <StatCard label="Assigned" value={stats.assigned} icon="car" />
        <StatCard
          label="Delivered"
          value={stats.delivered}
          icon="checkmark-done"
        />
        <StatCard label="Critical" value={stats.critical} icon="warning" />
      </ScrollView>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color="#94a3b8" />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search load, city, state, equipment..."
          placeholderTextColor="#64748b"
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {[
          "ALL",
          "OPEN",
          "PENDING",
          "URGENT",
          "AVAILABLE",
          "ASSIGNED",
          "ACCEPTED",
          "IN_TRANSIT",
          "DELIVERED",
        ].map((status) => (
          <Pressable
            key={status}
            style={[
              styles.filterChip,
              statusFilter === status && styles.filterChipActive,
            ]}
            onPress={() => setStatusFilter(status)}
          >
            <Text
              style={[
                styles.filterText,
                statusFilter === status && styles.filterTextActive,
              ]}
            >
              {status.replace("_", " ")}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <FlatList
        data={recommendations}
        keyExtractor={(item) => item.id}
        renderItem={renderRecommendation}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchLoads();
            }}
            tintColor="#4ade80"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="analytics" size={42} color="#64748b" />
            <Text style={styles.emptyTitle}>No loads found</Text>
            <Text style={styles.emptyText}>
              Dispatch intelligence will appear when freight loads are available.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={21} color="#4ade80" />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#020617",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: {
    color: "#cbd5e1",
    marginTop: 12,
    fontSize: 15,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: Platform.OS === "android" ? 18 : 8,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  headerTitle: {
    color: "#f8fafc",
    fontSize: 22,
    fontWeight: "900",
  },
  headerSub: {
    color: "#94a3b8",
    fontSize: 13,
    marginTop: 2,
  },
  statsRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  statCard: {
    width: 132,
    padding: 14,
    borderRadius: 20,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  statValue: {
    color: "#f8fafc",
    fontSize: 25,
    fontWeight: "900",
    marginTop: 10,
  },
  statLabel: {
    color: "#94a3b8",
    fontSize: 12,
    marginTop: 3,
  },
  searchWrap: {
    marginHorizontal: 16,
    marginBottom: 10,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: "#f8fafc",
    fontSize: 14,
  },
  filterRow: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  filterChipActive: {
    backgroundColor: "#4ade80",
    borderColor: "#4ade80",
  },
  filterText: {
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: "800",
  },
  filterTextActive: {
    color: "#052e16",
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: "#0f172a",
    borderRadius: 24,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  cardTitle: {
    color: "#f8fafc",
    fontSize: 17,
    fontWeight: "900",
  },
  cardSub: {
    color: "#94a3b8",
    fontSize: 12,
    marginTop: 4,
  },
  scoreBadge: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#14532d",
    alignItems: "center",
    justifyContent: "center",
  },
  scoreHigh: {
    backgroundColor: "#7f1d1d",
  },
  scoreMedium: {
    backgroundColor: "#78350f",
  },
  scoreText: {
    color: "#f8fafc",
    fontSize: 16,
    fontWeight: "900",
  },
  routeBox: {
    marginTop: 14,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#1e293b",
    gap: 8,
  },
  routeItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  routeText: {
    color: "#e2e8f0",
    fontSize: 14,
    fontWeight: "700",
  },
  infoGrid: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  infoPill: {
    flex: 1,
    backgroundColor: "#111827",
    borderRadius: 16,
    padding: 11,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  infoLabel: {
    color: "#94a3b8",
    fontSize: 11,
  },
  infoValue: {
    color: "#f8fafc",
    fontWeight: "900",
    marginTop: 3,
  },
  aiBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    marginTop: 12,
    padding: 13,
    borderRadius: 18,
    backgroundColor: "#172554",
    borderWidth: 1,
    borderColor: "#1d4ed8",
  },
  aiText: {
    flex: 1,
    color: "#dbeafe",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  secondaryButton: {
    flex: 1,
    height: 44,
    borderRadius: 15,
    backgroundColor: "#1e293b",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  secondaryButtonText: {
    color: "#e2e8f0",
    fontWeight: "900",
    fontSize: 13,
  },
  alertButton: {
    flex: 1,
    height: 44,
    borderRadius: 15,
    backgroundColor: "#facc15",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  alertButtonText: {
    color: "#111827",
    fontWeight: "900",
    fontSize: 13,
  },
  emptyBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 70,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 12,
  },
  emptyText: {
    color: "#94a3b8",
    textAlign: "center",
    marginTop: 7,
    lineHeight: 20,
  },
});