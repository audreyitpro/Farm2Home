// app/admin/driver-jobs.tsx

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

type DriverJob = {
  id: string;
  driver_id?: string | null;
  driver_name?: string | null;
  load_id?: string | null;
  order_id?: string | null;
  status?: string | null;
  payout_amount?: number | null;
  amount?: number | null;
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

type FreightLoad = {
  id: string;
  title?: string | null;
  commodity?: string | null;
  pickup_location?: string | null;
  dropoff_location?: string | null;
  status?: string | null;
  rate?: number | null;
};

export default function AdminDriverJobs() {
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<DriverJob[]>([]);
  const [locations, setLocations] = useState<DriverLocation[]>([]);
  const [loads, setLoads] = useState<FreightLoad[]>([]);
  const [search, setSearch] = useState("");

  useFocusEffect(
    useCallback(() => {
      loadDriverJobs();
    }, [])
  );

  async function loadDriverJobs() {
    try {
      setLoading(true);

      const { data: jobData } = await supabase
        .from("delivery_jobs")
        .select("*")
        .order("created_at", { ascending: false });

      const { data: locationData } = await supabase
        .from("driver_locations")
        .select("*")
        .order("updated_at", { ascending: false });

      const { data: loadData } = await supabase
        .from("freight_loads")
        .select("*")
        .order("created_at", { ascending: false });

      setJobs(Array.isArray(jobData) ? (jobData as DriverJob[]) : []);
      setLocations(Array.isArray(locationData) ? (locationData as DriverLocation[]) : []);
      setLoads(Array.isArray(loadData) ? (loadData as FreightLoad[]) : []);
    } catch (error: any) {
      Alert.alert("Driver Jobs Error", error?.message || "Unable to load driver jobs.");
    } finally {
      setLoading(false);
    }
  }

  const filteredJobs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return jobs;

    return jobs.filter((job) =>
      [
        job.id,
        job.driver_id,
        job.driver_name,
        job.load_id,
        job.order_id,
        job.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [jobs, search]);

  const stats = useMemo(() => {
    const active = jobs.filter((job) =>
      ["accepted", "assigned", "picked_up", "in_transit"].includes(
        String(job.status || "").toLowerCase()
      )
    ).length;

    const completed = jobs.filter((job) =>
      ["completed", "delivered"].includes(String(job.status || "").toLowerCase())
    ).length;

    const pending = jobs.filter((job) =>
      ["pending", "open", "available"].includes(String(job.status || "").toLowerCase())
    ).length;

    const cancelled = jobs.filter((job) =>
      ["cancelled", "canceled", "failed"].includes(String(job.status || "").toLowerCase())
    ).length;

    const earnings = jobs.reduce(
      (sum, job) => sum + Number(job.payout_amount || job.amount || 0),
      0
    );

    return {
      total: jobs.length,
      active,
      completed,
      pending,
      cancelled,
      earnings,
      gps: locations.length,
    };
  }, [jobs, locations]);

  function getJobLocation(job: DriverJob) {
    return locations.find(
      (x) =>
        String(x.load_id || "") === String(job.load_id || "") ||
        String(x.driver_id || "") === String(job.driver_id || "")
    );
  }

  function getJobLoad(job: DriverJob) {
    return loads.find((x) => String(x.id) === String(job.load_id || ""));
  }

  function formatMoney(value: number) {
    return `$${Number(value || 0).toFixed(2)}`;
  }

  function formatDate(value?: string | null) {
    if (!value) return "Unknown date";
    try {
      return new Date(value).toLocaleString();
    } catch {
      return "Unknown date";
    }
  }

  function getStatusColor(status?: string | null) {
    const value = String(status || "").toLowerCase();

    if (["completed", "delivered"].includes(value)) return ui.green;
    if (["accepted", "assigned", "picked_up", "in_transit"].includes(value)) return ui.primary;
    if (["pending", "open", "available"].includes(value)) return ui.orange;
    if (["cancelled", "canceled", "failed"].includes(value)) return ui.red;

    return ui.blue;
  }

  function renderBadge(status?: string | null) {
    return (
      <View style={[styles.badge, { backgroundColor: getStatusColor(status) }]}>
        <Text style={styles.badgeText}>{status || "UNKNOWN"}</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <StatusBar barStyle="dark-content" backgroundColor={ui.bg} />
        <ActivityIndicator size="large" color={ui.primary} />
        <Text style={styles.loadingText}>Loading driver jobs...</Text>
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
              <Text style={styles.logoSub}>Driver Jobs</Text>
            </View>
          </View>

          <NavButton label="Dashboard" icon="grid-outline" route="/admin/dashboard" />
          <NavButton label="Drivers" icon="car-outline" route="/admin/drivers" />
          <NavButton label="Driver Jobs" icon="briefcase-outline" route="/admin/driver-jobs" active />
          <NavButton label="Fleet Map" icon="map-outline" route="/admin/fleet-map" />
          <NavButton label="Freight Loads" icon="cube-outline" route="/admin/freight-loads" />
          <NavButton label="Payouts" icon="cash-outline" route="/admin/payouts" />
        </View>

        <View style={styles.main}>
          <View style={styles.topbar}>
            <View>
              <Text style={styles.welcome}>Farm2Home Driver Operations</Text>
              <Text style={styles.pageTitle}>Driver Jobs</Text>
              <Text style={styles.pageSub}>
                Manage driver job assignments, delivery progress, GPS activity, and driver earnings.
              </Text>
            </View>

            <TouchableOpacity style={styles.refreshPill} onPress={loadDriverJobs}>
              <Ionicons name="refresh-outline" size={18} color={ui.primary} />
              <Text style={styles.refreshPillText}>Refresh</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.statsGrid}>
              <StatCard label="Total Jobs" value={String(stats.total)} icon="briefcase-outline" accent />
              <StatCard label="Pending" value={String(stats.pending)} icon="time-outline" warning />
              <StatCard label="Active" value={String(stats.active)} icon="navigate-outline" accent />
              <StatCard label="Completed" value={String(stats.completed)} icon="checkmark-circle-outline" success />
              <StatCard label="Cancelled" value={String(stats.cancelled)} icon="close-circle-outline" danger />
              <StatCard label="Driver Earnings" value={formatMoney(stats.earnings)} icon="cash-outline" accent />
              <StatCard label="GPS Signals" value={String(stats.gps)} icon="radio-outline" />
            </View>

            <View style={styles.searchCard}>
              <Ionicons name="search-outline" size={20} color={ui.primary} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search driver jobs, load ID, order ID, status..."
                placeholderTextColor={ui.muted}
                style={styles.searchInput}
              />
            </View>

            <View style={styles.dataSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Driver Job Directory</Text>
                <Text style={styles.sectionLink}>{filteredJobs.length} records</Text>
              </View>

              <FlatList
                data={filteredJobs}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                contentContainerStyle={{ paddingBottom: 80 }}
                ListEmptyComponent={
                  <EmptyCard
                    title="No driver jobs found."
                    text="Driver jobs will appear after drivers accept delivery or freight work."
                  />
                }
                renderItem={({ item }) => {
                  const location = getJobLocation(item);
                  const load = getJobLoad(item);
                  const payout = Number(item.payout_amount || item.amount || load?.rate || 0);

                  return (
                    <View style={styles.row}>
                      <View style={styles.avatar}>
                        <Ionicons name="briefcase-outline" size={22} color={ui.primary} />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={styles.name}>
                          {item.driver_name || location?.driver_name || `Driver Job #${item.id.slice(-6)}`}
                        </Text>

                        <Text style={styles.meta}>
                          Load: {item.load_id || "Not linked"} • Order: {item.order_id || "N/A"}
                        </Text>

                        <Text style={styles.meta}>
                          Load Title: {load?.title || load?.commodity || "Freight / Delivery Job"}
                        </Text>

                        <Text style={styles.meta}>
                          Payout: {formatMoney(payout)}
                        </Text>

                        <Text style={styles.meta}>
                          GPS:{" "}
                          {location?.latitude && location?.longitude
                            ? `${Number(location.latitude).toFixed(5)}, ${Number(location.longitude).toFixed(5)}`
                            : "No GPS yet"}
                        </Text>

                        <Text style={styles.meta}>Created: {formatDate(item.created_at)}</Text>
                      </View>

                      <View style={styles.rightCol}>
                        {renderBadge(item.status)}

                        <TouchableOpacity
                          style={styles.viewButton}
                          onPress={() =>
                            Alert.alert(
                              "Driver Job",
                              `Driver: ${
                                item.driver_name || location?.driver_name || item.driver_id || "Unknown"
                              }\nLoad: ${item.load_id || "N/A"}\nStatus: ${
                                item.status || "Unknown"
                              }\nPayout: ${formatMoney(payout)}`
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
  warning = false,
  danger = false,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent?: boolean;
  success?: boolean;
  warning?: boolean;
  danger?: boolean;
}) {
  const color = danger
    ? ui.red
    : warning
    ? ui.orange
    : success
    ? ui.green
    : accent
    ? ui.primary
    : ui.blue;

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
      <Ionicons name="briefcase-outline" size={30} color={ui.primary} />
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