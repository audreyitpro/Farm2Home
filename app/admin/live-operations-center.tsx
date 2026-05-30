// app/admin/live-operations-center.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
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
  teal: "#14B8A6",
};

type LoadStatus =
  | "available"
  | "accepted"
  | "arrived_pickup"
  | "picked_up"
  | "in_transit"
  | "arrived_dropoff"
  | "delivered"
  | "cancelled";

type FreightLoad = {
  id: string;
  title?: string | null;
  farmer_name?: string | null;
  pickup_location?: string | null;
  dropoff_location?: string | null;
  equipment_type?: string | null;
  temperature_required?: string | null;
  rate?: number | null;
  distance_miles?: number | null;
  commodity?: string | null;
  status?: LoadStatus | string | null;
  driver_id?: string | null;
  created_at?: string | null;
};

type DriverLocationRow = {
  id?: string;
  load_id: string;
  latitude: number;
  longitude: number;
  speed?: number | null;
  heading?: number | null;
  updated_at?: string | null;
  status?: string | null;
};

type AlertItem = {
  id: string;
  title: string;
  message: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
};

const ACTIVE_STATUSES = [
  "accepted",
  "arrived_pickup",
  "picked_up",
  "in_transit",
  "arrived_dropoff",
];

export default function LiveOperationsCenter() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loads, setLoads] = useState<FreightLoad[]>([]);
  const [drivers, setDrivers] = useState<DriverLocationRow[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadLiveOperations();

      const channel = supabase
        .channel("farm2home-live-operations")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "freight_loads" },
          () => loadLiveOperations()
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "driver_locations" },
          () => loadLiveOperations()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }, [])
  );

  async function loadLiveOperations() {
    try {
      setLoading(true);

      const { data: loadData, error: loadError } = await supabase
        .from("freight_loads")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (loadError) {
        console.log("LIVE_OPS_LOAD_ERROR:", loadError.message);
        Alert.alert("Load Error", loadError.message);
        return;
      }

      const { data: driverData, error: driverError } = await supabase
        .from("driver_locations")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(100);

      if (driverError) {
        console.log("LIVE_OPS_DRIVER_ERROR:", driverError.message);
      }

      const cleanLoads = Array.isArray(loadData) ? (loadData as FreightLoad[]) : [];

      const cleanDrivers = Array.isArray(driverData)
        ? (driverData as any[]).map((item) => ({
            ...item,
            latitude: Number(item.latitude || 0),
            longitude: Number(item.longitude || 0),
          }))
        : [];

      setLoads(cleanLoads);
      setDrivers(cleanDrivers);
      setAlerts(buildAlerts(cleanLoads, cleanDrivers));
    } catch (error: any) {
      console.log("LIVE_OPS_CRASH:", error);
      Alert.alert(
        "Operations Error",
        error?.message || "Unable to load live operations."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function buildAlerts(
    loadRows: FreightLoad[],
    driverRows: DriverLocationRow[]
  ): AlertItem[] {
    const results: AlertItem[] = [];

    driverRows.forEach((driver) => {
      if (!driver.updated_at) return;

      const minutes =
        (Date.now() - new Date(driver.updated_at).getTime()) / 1000 / 60;

      if (minutes > 45 && driver.status !== "delivered") {
        results.push({
          id: `stale_${driver.load_id}`,
          title: "Driver GPS Stale",
          message: `Load #${driver.load_id.slice(-6)} has not updated GPS in ${Math.round(
            minutes
          )} minutes.`,
          severity: "HIGH",
        });
      }
    });

    loadRows
      .filter((load) => {
        const text = `${load.title || ""} ${load.commodity || ""} ${
          load.temperature_required || ""
        }`.toLowerCase();

        return (
          load.status === "available" &&
          (text.includes("cold") ||
            text.includes("refrigerated") ||
            text.includes("fresh") ||
            text.includes("meat") ||
            text.includes("dairy") ||
            text.includes("eggs"))
        );
      })
      .forEach((load) => {
        results.push({
          id: `cold_${load.id}`,
          title: "Cold-Chain Load Available",
          message: `${load.title || "Cold-chain load"} is still waiting for a driver.`,
          severity: "CRITICAL",
        });
      });

    loadRows
      .filter((load) => ACTIVE_STATUSES.includes(String(load.status || "")))
      .forEach((load) => {
        if (!load.created_at) return;

        const hours =
          (Date.now() - new Date(load.created_at).getTime()) / 1000 / 60 / 60;

        if (hours > 24 && load.status !== "delivered") {
          results.push({
            id: `old_active_${load.id}`,
            title: "Long Active Load",
            message: `Load #${load.id.slice(-6)} has been active for ${Math.round(
              hours
            )} hours.`,
            severity: "MEDIUM",
          });
        }
      });

    return results;
  }

  const activeLoads = useMemo(
    () => loads.filter((item) => ACTIVE_STATUSES.includes(String(item.status || ""))),
    [loads]
  );

  const availableLoads = useMemo(
    () => loads.filter((item) => item.status === "available"),
    [loads]
  );

  const deliveredLoads = useMemo(
    () => loads.filter((item) => item.status === "delivered"),
    [loads]
  );

  const activeDrivers = useMemo(
    () =>
      drivers.filter((item) =>
        ACTIVE_STATUSES.includes(String(item.status || ""))
      ),
    [drivers]
  );

  const liveRevenue = useMemo(
    () => deliveredLoads.reduce((sum, item) => sum + Number(item.rate || 0), 0),
    [deliveredLoads]
  );

  const openFreightValue = useMemo(
    () => availableLoads.reduce((sum, item) => sum + Number(item.rate || 0), 0),
    [availableLoads]
  );

  const activeFreightValue = useMemo(
    () => activeLoads.reduce((sum, item) => sum + Number(item.rate || 0), 0),
    [activeLoads]
  );

  function onRefresh() {
    setRefreshing(true);
    loadLiveOperations();
  }

  function formatMoney(value: number) {
    return `$${Number(value || 0).toFixed(2)}`;
  }

  function getStatusColor(status?: string | null) {
    switch (status) {
      case "available":
        return ui.blue;
      case "accepted":
        return ui.primary;
      case "arrived_pickup":
        return ui.teal;
      case "picked_up":
        return ui.orange;
      case "in_transit":
        return ui.green;
      case "arrived_dropoff":
        return "#EA580C";
      case "delivered":
        return ui.green;
      case "cancelled":
        return ui.red;
      default:
        return "#64748B";
    }
  }

  function getAlertColor(severity: string) {
    switch (severity) {
      case "CRITICAL":
        return ui.red;
      case "HIGH":
        return ui.orange;
      case "MEDIUM":
        return ui.blue;
      default:
        return "#64748B";
    }
  }

  function statusLabel(status?: string | null) {
    return String(status || "unknown").replace(/_/g, " ");
  }

  function getDriverFreshness(driver: DriverLocationRow) {
    if (!driver.updated_at) return "No timestamp";

    const minutes =
      (Date.now() - new Date(driver.updated_at).getTime()) / 1000 / 60;

    if (minutes <= 5) return "Live";
    if (minutes <= 30) return `${Math.round(minutes)} min ago`;
    return `Stale: ${Math.round(minutes)} min`;
  }

  function renderBadge(status?: string | null) {
    return (
      <View style={[styles.badge, { backgroundColor: getStatusColor(status) }]}>
        <Text style={styles.badgeText}>{statusLabel(status)}</Text>
      </View>
    );
  }

  function renderLoadCard(item: FreightLoad) {
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() =>
          router.push({
            pathname: "/driver/live-location-provider" as any,
            params: { loadId: item.id },
          })
        }
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardIcon}>
            <Ionicons name="cube-outline" size={20} color={ui.primary} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{item.title || "Farm2Home Load"}</Text>
            <Text style={styles.cardSub}>
              {item.pickup_location || "Pickup"} →{" "}
              {item.dropoff_location || "Dropoff"}
            </Text>
          </View>

          {renderBadge(item.status)}
        </View>

        <View style={styles.metaBox}>
          <Text style={styles.metaText}>
            Farmer: {item.farmer_name || "Farm2Home Farmer"}
          </Text>
          <Text style={styles.metaText}>
            Commodity: {item.commodity || "Farm Goods"}
          </Text>
          <Text style={styles.metaText}>
            Equipment: {item.equipment_type || "Not specified"}
          </Text>
          <Text style={styles.metaText}>
            Rate: {formatMoney(Number(item.rate || 0))} · Miles:{" "}
            {Number(item.distance_miles || 0).toFixed(0)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <StatusBar barStyle="dark-content" backgroundColor={ui.bg} />
        <ActivityIndicator size="large" color={ui.primary} />
        <Text style={styles.loadingText}>Loading live operations...</Text>
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
              <Text style={styles.logoSub}>Live Operations</Text>
            </View>
          </View>

          <NavButton label="Dashboard" icon="grid-outline" route="/admin/dashboard" />
          <NavButton label="Control Tower" icon="radio-outline" route="/admin/control-tower" />
          <NavButton label="Live Ops" icon="navigate-outline" route="/admin/live-operations-center" active />
          <NavButton label="Analytics" icon="analytics-outline" route="/admin/analytics-center" />
          <NavButton label="Freight Board" icon="list-outline" route="/freight/board" />
          <NavButton label="Driver Earnings" icon="cash-outline" route="/driver/earnings" />
        </View>

        <View style={styles.main}>
          <View style={styles.topbar}>
            <View>
              <Text style={styles.welcome}>Realtime dispatch monitoring</Text>
              <Text style={styles.pageTitle}>Live Operations Center</Text>
              <Text style={styles.pageSub}>
                Freight movement, driver GPS, alerts, delivery milestones, and revenue.
              </Text>
            </View>

            <TouchableOpacity style={styles.refreshPill} onPress={loadLiveOperations}>
              <Ionicons name="refresh-outline" size={18} color={ui.primary} />
              <Text style={styles.refreshPillText}>Refresh</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          >
            <View style={styles.operationsHero}>
              <View style={styles.operationsIcon}>
                <Ionicons name="radio-outline" size={28} color="#FFFFFF" />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.operationsTitle}>Realtime Freight Operations</Text>
                <Text style={styles.operationsText}>
                  Live freight loads, driver GPS, delivery milestones, and cold-chain
                  alerts are streaming from Supabase.
                </Text>
              </View>
            </View>

            <View style={styles.statsGrid}>
              <StatCard label="Available Loads" value={String(availableLoads.length)} icon="file-tray-outline" />
              <StatCard label="Active Loads" value={String(activeLoads.length)} icon="cube-outline" />
              <StatCard label="Delivered Loads" value={String(deliveredLoads.length)} icon="checkmark-done-outline" success />
              <StatCard label="GPS Signals" value={String(drivers.length)} icon="navigate-outline" />
              <StatCard label="Active Drivers" value={String(activeDrivers.length)} icon="car-outline" success />
              <StatCard label="Alerts" value={String(alerts.length)} icon="warning-outline" danger={alerts.length > 0} />
              <StatCard label="Delivered Revenue" value={formatMoney(liveRevenue)} icon="cash-outline" accent />
              <StatCard label="Open Freight Value" value={formatMoney(openFreightValue)} icon="wallet-outline" accent />
              <StatCard label="Active Freight Value" value={formatMoney(activeFreightValue)} icon="trail-sign-outline" accent />
            </View>

            <View style={styles.dashboardGrid}>
              <View style={styles.chartCard}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Operations Snapshot</Text>
                  <Text style={styles.sectionLink}>Live</Text>
                </View>

                <View style={styles.flowRow}>
                  <FlowMetric label="Available" value={availableLoads.length} color={ui.blue} />
                  <FlowMetric label="Active" value={activeLoads.length} color={ui.primary} />
                  <FlowMetric label="GPS" value={drivers.length} color={ui.green} />
                  <FlowMetric label="Alerts" value={alerts.length} color={alerts.length > 0 ? ui.red : ui.muted} />
                </View>
              </View>

              <View style={styles.chartCard}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Quick Actions</Text>
                  <Text style={styles.sectionLink}>Admin</Text>
                </View>

                <View style={styles.quickGrid}>
                  <QuickAction label="Control Tower" icon="radio-outline" route="/admin/control-tower" />
                  <QuickAction label="Analytics" icon="analytics-outline" route="/admin/analytics-center" />
                  <QuickAction label="Freight Board" icon="list-outline" route="/freight/board" />
                  <QuickAction label="Route AI" icon="map-outline" route="/ai/route-optimization-center" />
                </View>
              </View>
            </View>

            <DataSection title="Realtime GPS Fleet">
              {drivers.length === 0 ? (
                <EmptyCard
                  title="No driver GPS yet."
                  text="Driver locations will appear after drivers start live tracking."
                />
              ) : (
                drivers.slice(0, 10).map((driver) => (
                  <View key={`${driver.load_id}_${driver.updated_at}`} style={styles.gpsRow}>
                    <View style={styles.cardHeader}>
                      <View style={styles.cardIcon}>
                        <Ionicons name="navigate-outline" size={20} color={ui.primary} />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={styles.cardTitle}>Driver GPS</Text>
                        <Text style={styles.cardSub}>Load #{driver.load_id?.slice(-6)}</Text>
                      </View>

                      {renderBadge(driver.status)}
                    </View>

                    <Text style={styles.metaText}>
                      GPS: {driver.latitude.toFixed(5)}, {driver.longitude.toFixed(5)}
                    </Text>
                    <Text style={styles.metaText}>
                      Speed:{" "}
                      {driver.speed !== null && driver.speed !== undefined
                        ? `${Number(driver.speed).toFixed(1)} m/s`
                        : "Not available"}
                    </Text>
                    <Text style={styles.freshnessText}>
                      Signal: {getDriverFreshness(driver)}
                    </Text>
                  </View>
                ))
              )}
            </DataSection>

            <DataSection title="Operations Alerts">
              {alerts.length === 0 ? (
                <EmptyCard
                  title="No active alerts."
                  text="Cold-chain load, stale GPS, and aging active-load alerts will appear here."
                />
              ) : (
                alerts.map((item) => (
                  <View key={item.id} style={styles.alertRow}>
                    <View style={styles.alertIcon}>
                      <Ionicons name="warning-outline" size={18} color="#FFFFFF" />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.alertTitle}>{item.title}</Text>
                      <Text style={styles.alertMessage}>{item.message}</Text>
                    </View>

                    <View
                      style={[
                        styles.alertBadge,
                        { backgroundColor: getAlertColor(item.severity) },
                      ]}
                    >
                      <Text style={styles.alertBadgeText}>{item.severity}</Text>
                    </View>
                  </View>
                ))
              )}
            </DataSection>

            <DataSection title="Active Freight Loads">
              <FlatList
                data={activeLoads}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                ListEmptyComponent={
                  <EmptyCard
                    title="No active loads."
                    text="Accepted, pickup, transit, and dropoff loads will appear here."
                  />
                }
                renderItem={({ item }) => renderLoadCard(item)}
              />
            </DataSection>

            <DataSection title="Available Freight Loads">
              <FlatList
                data={availableLoads}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                ListEmptyComponent={<EmptyCard title="No available loads." />}
                renderItem={({ item }) => renderLoadCard(item)}
              />
            </DataSection>

            <DataSection title="Delivered Loads">
              <FlatList
                data={deliveredLoads.slice(0, 20)}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                contentContainerStyle={{ paddingBottom: 80 }}
                ListEmptyComponent={<EmptyCard title="No delivered loads yet." />}
                renderItem={({ item }) => renderLoadCard(item)}
              />
            </DataSection>
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

function FlowMetric({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <View style={styles.flowMetric}>
      <View style={[styles.flowDot, { backgroundColor: color }]} />
      <Text style={styles.flowValue}>{value}</Text>
      <Text style={styles.flowLabel}>{label}</Text>
    </View>
  );
}

function QuickAction({
  label,
  icon,
  route,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
}) {
  return (
    <TouchableOpacity style={styles.quickAction} onPress={() => router.push(route as any)}>
      <Ionicons name={icon} size={18} color={ui.primary} />
      <Text style={styles.quickText}>{label}</Text>
    </TouchableOpacity>
  );
}

function DataSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.dataSection}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionLink}>View all</Text>
      </View>
      {children}
    </View>
  );
}

function EmptyCard({ title, text }: { title: string; text?: string }) {
  return (
    <View style={styles.emptyCard}>
      <Ionicons name="file-tray-outline" size={30} color={ui.primary} />
      <Text style={styles.emptyTitle}>{title}</Text>
      {!!text && <Text style={styles.emptyText}>{text}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: ui.bg,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: ui.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: ui.muted,
    marginTop: 10,
    fontWeight: "800",
  },
  shell: {
    flex: 1,
    backgroundColor: ui.bg,
  },
  sidebar: {
    backgroundColor: ui.card,
    borderBottomWidth: 1,
    borderBottomColor: ui.border,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 12,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  logoMark: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: ui.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 13,
  },
  logoTitle: {
    color: ui.text,
    fontWeight: "900",
    fontSize: 18,
  },
  logoSub: {
    color: ui.muted,
    fontWeight: "700",
    fontSize: 12,
  },
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
  navButtonActive: {
    backgroundColor: ui.primary,
  },
  navText: {
    color: ui.muted,
    fontWeight: "900",
    fontSize: 13,
  },
  navTextActive: {
    color: "#FFFFFF",
  },
  main: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
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
  welcome: {
    color: ui.muted,
    fontWeight: "800",
    marginBottom: 4,
  },
  pageTitle: {
    color: ui.text,
    fontSize: 26,
    fontWeight: "900",
  },
  pageSub: {
    color: ui.muted,
    marginTop: 4,
    fontWeight: "700",
    maxWidth: 720,
  },
  refreshPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: ui.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  refreshPillText: {
    color: ui.primary,
    fontWeight: "900",
  },
  operationsHero: {
    backgroundColor: ui.primary,
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  operationsIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  operationsTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
  },
  operationsText: {
    color: "#EDE9FE",
    marginTop: 6,
    lineHeight: 21,
    fontWeight: "700",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 14,
  },
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
  statValue: {
    color: ui.text,
    fontSize: 22,
    fontWeight: "900",
  },
  statLabel: {
    color: ui.muted,
    fontWeight: "800",
    marginTop: 4,
  },
  dashboardGrid: {
    gap: 12,
    marginBottom: 14,
  },
  chartCard: {
    backgroundColor: ui.card,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: ui.border,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    color: ui.text,
    fontSize: 19,
    fontWeight: "900",
  },
  sectionLink: {
    color: ui.primary,
    fontWeight: "900",
    fontSize: 12,
  },
  flowRow: {
    flexDirection: "row",
    gap: 10,
  },
  flowMetric: {
    flex: 1,
    backgroundColor: ui.soft,
    borderRadius: 16,
    padding: 12,
  },
  flowDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
    marginBottom: 8,
  },
  flowValue: {
    color: ui.text,
    fontSize: 20,
    fontWeight: "900",
  },
  flowLabel: {
    color: ui.muted,
    fontWeight: "800",
    marginTop: 2,
    fontSize: 12,
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  quickAction: {
    width: "48%",
    backgroundColor: ui.soft,
    borderRadius: 15,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  quickText: {
    color: ui.text,
    fontWeight: "900",
    fontSize: 12,
  },
  dataSection: {
    backgroundColor: ui.card,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: ui.border,
    marginBottom: 14,
  },
  gpsRow: {
    borderTopWidth: 1,
    borderTopColor: ui.border,
    paddingVertical: 12,
  },
  alertRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: ui.border,
    paddingVertical: 12,
  },
  alertIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: ui.orange,
    alignItems: "center",
    justifyContent: "center",
  },
  alertTitle: {
    color: ui.text,
    fontWeight: "900",
    fontSize: 15,
  },
  alertMessage: {
    color: ui.muted,
    marginTop: 4,
    lineHeight: 18,
    fontWeight: "700",
  },
  alertBadge: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  alertBadgeText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 9,
  },
  card: {
    backgroundColor: ui.soft,
    borderRadius: 18,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: ui.border,
  },
  cardHeader: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    marginBottom: 10,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: ui.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    color: ui.text,
    fontSize: 17,
    fontWeight: "900",
  },
  cardSub: {
    color: ui.muted,
    fontWeight: "700",
    marginTop: 4,
    lineHeight: 20,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 10,
    textTransform: "capitalize",
  },
  metaBox: {
    backgroundColor: ui.card,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: ui.border,
  },
  metaText: {
    color: ui.text,
    fontWeight: "700",
    lineHeight: 20,
    marginBottom: 4,
  },
  freshnessText: {
    color: ui.green,
    fontWeight: "900",
    marginTop: 6,
  },
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