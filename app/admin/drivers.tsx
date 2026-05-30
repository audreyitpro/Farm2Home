// app/admin/drivers.tsx

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

type DriverLocationRow = {
  id?: string;
  driver_id?: string | null;
  load_id?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status?: string | null;
  updated_at?: string | null;
};

type DriverSubscriptionRow = {
  id: string;
  driver_id?: string | null;
  status?: string | null;
  plan_type?: string | null;
  created_at?: string | null;
};

type DeliveryJobRow = {
  id: string;
  driver_id?: string | null;
  load_id?: string | null;
  status?: string | null;
  payout_amount?: number | null;
  created_at?: string | null;
};

type FreightLoadRow = {
  id: string;
  title?: string | null;
  driver_id?: string | null;
  accepted_by?: string | null;
  driver_name?: string | null;
  status?: string | null;
  rate?: number | null;
};

type DriverCard = {
  id: string;
  name: string;
  status: string;
  subscriptionStatus: string;
  activeJobs: number;
  completedJobs: number;
  earnings: number;
  lastGps: string;
  currentLoadId?: string | null;
};

export default function AdminDrivers() {
  const [loading, setLoading] = useState(true);
  const [drivers, setDrivers] = useState<DriverCard[]>([]);
  const [search, setSearch] = useState("");

  useFocusEffect(
    useCallback(() => {
      loadDrivers();
    }, [])
  );

  async function loadDrivers() {
    try {
      setLoading(true);

      const { data: locationData } = await supabase
        .from("driver_locations")
        .select("*")
        .order("updated_at", { ascending: false });

      const { data: subscriptionData } = await supabase
        .from("driver_subscriptions")
        .select("*");

      const { data: deliveryData } = await supabase
        .from("delivery_jobs")
        .select("*");

      const { data: loadData } = await supabase
        .from("freight_loads")
        .select("id, title, driver_id, accepted_by, driver_name, status, rate");

      const locations = Array.isArray(locationData)
        ? (locationData as DriverLocationRow[])
        : [];

      const subscriptions = Array.isArray(subscriptionData)
        ? (subscriptionData as DriverSubscriptionRow[])
        : [];

      const deliveries = Array.isArray(deliveryData)
        ? (deliveryData as DeliveryJobRow[])
        : [];

      const loads = Array.isArray(loadData) ? (loadData as FreightLoadRow[]) : [];

      const driverIds = new Set<string>();

      locations.forEach((x) => {
        if (x.driver_id) driverIds.add(String(x.driver_id));
      });

      subscriptions.forEach((x) => {
        if (x.driver_id) driverIds.add(String(x.driver_id));
      });

      deliveries.forEach((x) => {
        if (x.driver_id) driverIds.add(String(x.driver_id));
      });

      loads.forEach((x) => {
        if (x.driver_id) driverIds.add(String(x.driver_id));
        if (x.accepted_by) driverIds.add(String(x.accepted_by));
      });

      const mapped: DriverCard[] = Array.from(driverIds).map((driverId) => {
        const location = locations.find(
          (x) => String(x.driver_id || "") === driverId
        );

        const subscription = subscriptions.find(
          (x) => String(x.driver_id || "") === driverId
        );

        const driverJobs = deliveries.filter(
          (x) => String(x.driver_id || "") === driverId
        );

        const driverLoads = loads.filter(
          (x) =>
            String(x.driver_id || "") === driverId ||
            String(x.accepted_by || "") === driverId
        );

        const activeJobs = driverJobs.filter((job) =>
          ["accepted", "picked_up", "in_transit", "assigned"].includes(
            String(job.status || "").toLowerCase()
          )
        ).length;

        const completedJobs = driverJobs.filter((job) =>
          ["completed", "delivered"].includes(String(job.status || "").toLowerCase())
        ).length;

        const earnings =
          driverJobs.reduce(
            (sum, job) => sum + Number(job.payout_amount || 0),
            0
          ) ||
          driverLoads.reduce((sum, load) => sum + Number(load.rate || 0), 0);

        const currentLoad =
          driverLoads.find((load) =>
            ["accepted", "picked_up", "in_transit", "assigned"].includes(
              String(load.status || "").toLowerCase()
            )
          ) || driverLoads[0];

        return {
          id: driverId,
          name:
            currentLoad?.driver_name ||
            location?.driver_id ||
            subscription?.driver_id ||
            `Driver ${driverId.slice(-6)}`,
          status: location?.status || currentLoad?.status || "unknown",
          subscriptionStatus: subscription?.status || "none",
          activeJobs,
          completedJobs,
          earnings,
          lastGps: location?.updated_at || "",
          currentLoadId: currentLoad?.id || location?.load_id || null,
        };
      });

      setDrivers(mapped);
    } catch (error: any) {
      Alert.alert("Drivers Error", error?.message || "Unable to load drivers.");
    } finally {
      setLoading(false);
    }
  }

  const filteredDrivers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return drivers;

    return drivers.filter((driver) =>
      [
        driver.id,
        driver.name,
        driver.status,
        driver.subscriptionStatus,
        driver.currentLoadId,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [drivers, search]);

  const stats = useMemo(() => {
    const active = drivers.filter((driver) =>
      ["accepted", "picked_up", "in_transit", "assigned", "online"].includes(
        String(driver.status || "").toLowerCase()
      )
    ).length;

    const subscribed = drivers.filter((driver) =>
      ["active", "paid", "trialing"].includes(
        String(driver.subscriptionStatus || "").toLowerCase()
      )
    ).length;

    const earnings = drivers.reduce((sum, driver) => sum + driver.earnings, 0);

    return {
      total: drivers.length,
      active,
      subscribed,
      activeJobs: drivers.reduce((sum, driver) => sum + driver.activeJobs, 0),
      completedJobs: drivers.reduce(
        (sum, driver) => sum + driver.completedJobs,
        0
      ),
      earnings,
    };
  }, [drivers]);

  function formatMoney(value: number) {
    return `$${Number(value || 0).toFixed(2)}`;
  }

  function getStatusColor(status?: string | null) {
    const value = String(status || "").toLowerCase();

    if (["active", "online", "accepted", "picked_up", "in_transit"].includes(value)) {
      return ui.green;
    }

    if (["assigned", "pending"].includes(value)) return ui.orange;

    if (["offline", "cancelled", "canceled", "blocked"].includes(value)) {
      return ui.red;
    }

    return ui.blue;
  }

  function renderBadge(status?: string | null) {
    return (
      <View style={[styles.badge, { backgroundColor: getStatusColor(status) }]}>
        <Text style={styles.badgeText}>{status || "UNKNOWN"}</Text>
      </View>
    );
  }

  function formatGpsDate(value?: string | null) {
    if (!value) return "No GPS yet";
    try {
      return new Date(value).toLocaleString();
    } catch {
      return "No GPS yet";
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <StatusBar barStyle="dark-content" backgroundColor={ui.bg} />
        <ActivityIndicator size="large" color={ui.primary} />
        <Text style={styles.loadingText}>Loading drivers...</Text>
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
              <Text style={styles.logoSub}>Driver Management</Text>
            </View>
          </View>

          <NavButton label="Dashboard" icon="grid-outline" route="/admin/dashboard" />
          <NavButton label="Control Tower" icon="radio-outline" route="/admin/control-tower" />
          <NavButton label="Drivers" icon="car-outline" route="/admin/drivers" active />
          <NavButton label="Live Ops" icon="navigate-outline" route="/admin/live-operations-center" />
          <NavButton label="Analytics" icon="analytics-outline" route="/admin/analytics-center" />
          <NavButton label="Orders" icon="receipt-outline" route="/admin/orders" />
        </View>

        <View style={styles.main}>
          <View style={styles.topbar}>
            <View>
              <Text style={styles.welcome}>Farm2Home Admin</Text>
              <Text style={styles.pageTitle}>Drivers</Text>
              <Text style={styles.pageSub}>
                Monitor driver subscriptions, GPS signals, active jobs, and earnings.
              </Text>
            </View>

            <TouchableOpacity style={styles.refreshPill} onPress={loadDrivers}>
              <Ionicons name="refresh-outline" size={18} color={ui.primary} />
              <Text style={styles.refreshPillText}>Refresh</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.statsGrid}>
              <StatCard label="Total Drivers" value={String(stats.total)} icon="car-outline" accent />
              <StatCard label="Active Drivers" value={String(stats.active)} icon="navigate-outline" success />
              <StatCard label="Subscribed" value={String(stats.subscribed)} icon="card-outline" />
              <StatCard label="Active Jobs" value={String(stats.activeJobs)} icon="cube-outline" />
              <StatCard label="Completed Jobs" value={String(stats.completedJobs)} icon="checkmark-done-outline" success />
              <StatCard label="Driver Earnings" value={formatMoney(stats.earnings)} icon="cash-outline" accent />
            </View>

            <View style={styles.searchCard}>
              <Ionicons name="search-outline" size={20} color={ui.primary} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search driver, status, subscription, load ID..."
                placeholderTextColor={ui.muted}
                style={styles.searchInput}
              />
            </View>

            <View style={styles.dataSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Driver Directory</Text>
                <Text style={styles.sectionLink}>{filteredDrivers.length} records</Text>
              </View>

              <FlatList
                data={filteredDrivers}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                contentContainerStyle={{ paddingBottom: 80 }}
                ListEmptyComponent={
                  <EmptyCard
                    title="No drivers found."
                    text="Drivers will appear once they subscribe, accept loads, or start GPS tracking."
                  />
                }
                renderItem={({ item }) => (
                  <View style={styles.row}>
                    <View style={styles.avatar}>
                      <Ionicons name="car-outline" size={22} color={ui.primary} />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{item.name}</Text>
                      <Text style={styles.meta}>Driver ID: {item.id}</Text>
                      <Text style={styles.meta}>
                        Current Load: {item.currentLoadId || "None"}
                      </Text>
                      <Text style={styles.meta}>
                        Active Jobs: {item.activeJobs} • Completed:{" "}
                        {item.completedJobs}
                      </Text>
                      <Text style={styles.meta}>
                        Earnings: {formatMoney(item.earnings)}
                      </Text>
                      <Text style={styles.meta}>
                        Last GPS: {formatGpsDate(item.lastGps)}
                      </Text>
                    </View>

                    <View style={styles.rightCol}>
                      {renderBadge(item.status)}
                      {renderBadge(item.subscriptionStatus)}
                      <TouchableOpacity
                        style={styles.viewButton}
                        onPress={() =>
                          router.push("/admin/live-operations-center" as any)
                        }
                      >
                        <Text style={styles.viewButtonText}>Track</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
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
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent?: boolean;
  success?: boolean;
}) {
  const color = success ? ui.green : accent ? ui.primary : ui.blue;

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
      <Ionicons name="car-outline" size={30} color={ui.primary} />
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
    maxWidth: 130,
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