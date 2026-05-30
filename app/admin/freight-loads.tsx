// app/admin/freight-loads.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
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

type FreightLoad = {
  id: string;
  title?: string | null;
  commodity?: string | null;
  farmer_name?: string | null;
  pickup_location?: string | null;
  dropoff_location?: string | null;
  pickup_city?: string | null;
  pickup_state?: string | null;
  delivery_city?: string | null;
  delivery_state?: string | null;
  equipment_type?: string | null;
  temperature_required?: string | null;
  status?: string | null;
  driver_id?: string | null;
  carrier_id?: string | null;
  accepted_by?: string | null;
  rate?: number | null;
  amount?: number | null;
  price?: number | null;
  distance_miles?: number | null;
  created_at?: string | null;
};

type DriverLocation = {
  id?: string;
  load_id?: string | null;
  driver_id?: string | null;
  driver_name?: string | null;
  status?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  updated_at?: string | null;
};

export default function AdminFreightLoads() {
  const [loading, setLoading] = useState(true);
  const [loads, setLoads] = useState<FreightLoad[]>([]);
  const [drivers, setDrivers] = useState<DriverLocation[]>([]);
  const [search, setSearch] = useState("");

  useFocusEffect(
    useCallback(() => {
      loadFreightLoads();
    }, [])
  );

  async function loadFreightLoads() {
    try {
      setLoading(true);

      const { data: loadData, error: loadError } = await supabase
        .from("freight_loads")
        .select("*")
        .order("created_at", { ascending: false });

      if (loadError) console.log("Freight loads error:", loadError.message);

      const { data: driverData, error: driverError } = await supabase
        .from("driver_locations")
        .select("*")
        .order("updated_at", { ascending: false });

      if (driverError) console.log("Driver locations error:", driverError.message);

      setLoads(Array.isArray(loadData) ? (loadData as FreightLoad[]) : []);
      setDrivers(Array.isArray(driverData) ? (driverData as DriverLocation[]) : []);
    } catch (error: any) {
      Alert.alert("Freight Loads Error", error?.message || "Unable to load freight loads.");
    } finally {
      setLoading(false);
    }
  }

  const filteredLoads = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return loads;

    return loads.filter((load) =>
      [
        load.id,
        load.title,
        load.commodity,
        load.farmer_name,
        load.pickup_location,
        load.dropoff_location,
        load.pickup_city,
        load.pickup_state,
        load.delivery_city,
        load.delivery_state,
        load.status,
        load.driver_id,
        load.carrier_id,
        load.accepted_by,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [loads, search]);

  const stats = useMemo(() => {
    const open = loads.filter((x) =>
      ["available", "open", "pending", "AVAILABLE", "OPEN", "PENDING"].includes(String(x.status || ""))
    ).length;

    const active = loads.filter((x) =>
      ["accepted", "assigned", "picked_up", "in_transit", "arrived_pickup", "arrived_dropoff", "ACCEPTED", "ASSIGNED", "PICKED_UP", "IN_TRANSIT"].includes(String(x.status || ""))
    ).length;

    const delivered = loads.filter((x) =>
      ["delivered", "DELIVERED"].includes(String(x.status || ""))
    ).length;

    const revenue = loads.reduce(
      (sum, load) => sum + Number(load.rate || load.amount || load.price || 0),
      0
    );

    return {
      total: loads.length,
      open,
      active,
      delivered,
      cancelled: loads.filter((x) =>
        ["cancelled", "canceled", "CANCELLED", "CANCELED"].includes(String(x.status || ""))
      ).length,
      revenue,
      gps: drivers.length,
    };
  }, [loads, drivers]);

  function getLoadDriver(loadId: string) {
    return drivers.find((driver) => String(driver.load_id || "") === String(loadId));
  }

  function formatMoney(value: number) {
    return `$${Number(value || 0).toFixed(2)}`;
  }

  function getRate(load: FreightLoad) {
    return Number(load.rate || load.amount || load.price || 0);
  }

  function getRoute(load: FreightLoad) {
    const pickup =
      load.pickup_location ||
      [load.pickup_city, load.pickup_state].filter(Boolean).join(", ") ||
      "Pickup TBD";

    const dropoff =
      load.dropoff_location ||
      [load.delivery_city, load.delivery_state].filter(Boolean).join(", ") ||
      "Dropoff TBD";

    return `${pickup} → ${dropoff}`;
  }

  function getStatusColor(status?: string | null) {
    const value = String(status || "").toLowerCase();

    if (["available", "open", "pending"].includes(value)) return ui.blue;
    if (["accepted", "assigned"].includes(value)) return ui.primary;
    if (["picked_up", "arrived_pickup"].includes(value)) return ui.orange;
    if (["in_transit", "arrived_dropoff", "delivered"].includes(value)) return ui.green;
    if (["cancelled", "canceled"].includes(value)) return ui.red;

    return "#64748B";
  }

  function renderBadge(status?: string | null) {
    return (
      <View style={[styles.badge, { backgroundColor: getStatusColor(status) }]}>
        <Text style={styles.badgeText}>{status || "UNKNOWN"}</Text>
      </View>
    );
  }

  function formatDate(value?: string | null) {
    if (!value) return "Unknown date";
    try {
      return new Date(value).toLocaleString();
    } catch {
      return "Unknown date";
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <StatusBar barStyle="dark-content" backgroundColor={ui.bg} />
        <ActivityIndicator size="large" color={ui.primary} />
        <Text style={styles.loadingText}>Loading freight loads...</Text>
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
              <Text style={styles.logoSub}>Freight Loads</Text>
            </View>
          </View>

          <NavButton label="Dashboard" icon="grid-outline" route="/admin/dashboard" />
          <NavButton label="Live Ops" icon="navigate-outline" route="/admin/live-operations-center" />
          <NavButton label="Freight Loads" icon="cube-outline" route="/admin/freight-loads" active />
          <NavButton label="Fleet Map" icon="map-outline" route="/admin/fleet-map" />
          <NavButton label="Drivers" icon="car-outline" route="/admin/drivers" />
          <NavButton label="Carriers" icon="business-outline" route="/admin/freight-carriers" />
        </View>

        <View style={styles.main}>
          <View style={styles.topbar}>
            <View>
              <Text style={styles.welcome}>Farm2Home Freight Connect</Text>
              <Text style={styles.pageTitle}>Freight Loads</Text>
              <Text style={styles.pageSub}>
                Monitor open, active, delivered, and cancelled freight loads with driver GPS status.
              </Text>
            </View>

            <TouchableOpacity style={styles.refreshPill} onPress={loadFreightLoads}>
              <Ionicons name="refresh-outline" size={18} color={ui.primary} />
              <Text style={styles.refreshPillText}>Refresh</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.statsGrid}>
              <StatCard label="Total Loads" value={String(stats.total)} icon="cube-outline" accent />
              <StatCard label="Open Loads" value={String(stats.open)} icon="file-tray-outline" />
              <StatCard label="Active Loads" value={String(stats.active)} icon="navigate-outline" accent />
              <StatCard label="Delivered" value={String(stats.delivered)} icon="checkmark-circle-outline" success />
              <StatCard label="Cancelled" value={String(stats.cancelled)} icon="close-circle-outline" danger />
              <StatCard label="Load Revenue" value={formatMoney(stats.revenue)} icon="cash-outline" accent />
              <StatCard label="GPS Signals" value={String(stats.gps)} icon="radio-outline" />
            </View>

            <View style={styles.searchCard}>
              <Ionicons name="search-outline" size={20} color={ui.primary} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search loads, route, status, driver, carrier..."
                placeholderTextColor={ui.muted}
                style={styles.searchInput}
              />
            </View>

            <View style={styles.dataSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Load Directory</Text>
                <Text style={styles.sectionLink}>{filteredLoads.length} records</Text>
              </View>

              <FlatList
                data={filteredLoads}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                contentContainerStyle={{ paddingBottom: 80 }}
                ListEmptyComponent={
                  <EmptyCard
                    title="No freight loads found."
                    text="Loads will appear after farmers or freight users post freight requests."
                  />
                }
                renderItem={({ item }) => {
                  const driver = getLoadDriver(item.id);

                  return (
                    <View style={styles.row}>
                      <View style={styles.avatar}>
                        <Ionicons name="cube-outline" size={22} color={ui.primary} />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={styles.name}>{item.title || "Farm2Home Freight Load"}</Text>
                        <Text style={styles.meta}>Commodity: {item.commodity || "Farm Goods"}</Text>
                        <Text style={styles.meta}>Route: {getRoute(item)}</Text>
                        <Text style={styles.meta}>
                          Equipment: {item.equipment_type || "Not specified"} • Temp:{" "}
                          {item.temperature_required || "Standard"}
                        </Text>
                        <Text style={styles.meta}>
                          Rate: {formatMoney(getRate(item))} • Miles:{" "}
                          {Number(item.distance_miles || 0).toFixed(0)}
                        </Text>
                        <Text style={styles.meta}>
                          Driver: {driver?.driver_name || item.driver_id || item.accepted_by || "Unassigned"}
                        </Text>
                        <Text style={styles.meta}>Created: {formatDate(item.created_at)}</Text>
                      </View>

                      <View style={styles.rightCol}>
                        {renderBadge(item.status)}

                        <TouchableOpacity
                          style={styles.viewButton}
                          onPress={() =>
                            Alert.alert(
                              "Freight Load",
                              `${item.title || "Farm2Home Load"}\n${getRoute(item)}\nRate: ${formatMoney(
                                getRate(item)
                              )}\nStatus: ${item.status || "Unknown"}`
                            )
                          }
                        >
                          <Text style={styles.viewButtonText}>View</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.trackButton}
                          onPress={() => router.push("/admin/fleet-map" as any)}
                        >
                          <Text style={styles.trackButtonText}>Track</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                }}
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
  value: string;
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

function EmptyCard({ title, text }: { title: string; text?: string }) {
  return (
    <View style={styles.emptyCard}>
      <Ionicons name="cube-outline" size={30} color={ui.primary} />
      <Text style={styles.emptyTitle}>{title}</Text>
      {!!text && <Text style={styles.emptyText}>{text}</Text>}
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
  },
  loadingText: { color: ui.muted, marginTop: 10, fontWeight: "800" },
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
  pageSub: { color: ui.muted, marginTop: 4, fontWeight: "700", maxWidth: 720 },
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
  searchCard: {
    backgroundColor: ui.card,
    borderRadius: 18,
    paddingHorizontal: 14,
    height: 52,
    borderWidth: 1,
    borderColor: ui.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  searchInput: { flex: 1, color: ui.text, fontWeight: "800" },
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
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: ui.border,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 18,
    backgroundColor: ui.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { color: ui.text, fontWeight: "900", fontSize: 16 },
  meta: {
    color: ui.muted,
    fontWeight: "700",
    marginTop: 4,
    lineHeight: 18,
    fontSize: 12,
  },
  rightCol: { alignItems: "flex-end", gap: 8 },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: 150,
  },
  badgeText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 10,
    textTransform: "uppercase",
    textAlign: "center",
  },
  viewButton: {
    backgroundColor: ui.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  viewButtonText: { color: ui.primary, fontWeight: "900", fontSize: 12 },
  trackButton: {
    backgroundColor: "#DCFCE7",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  trackButtonText: { color: ui.green, fontWeight: "900", fontSize: 12 },
  emptyCard: {
    borderTopWidth: 1,
    borderTopColor: ui.border,
    padding: 18,
    alignItems: "center",
  },
  emptyTitle: {
    color: ui.text,
    fontWeight: "900",
    fontSize: 17,
    marginTop: 8,
    textAlign: "center",
  },
  emptyText: {
    color: ui.muted,
    fontWeight: "700",
    lineHeight: 21,
    textAlign: "center",
    marginTop: 5,
  },
});