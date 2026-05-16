import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";

import { supabase } from "../services/supabaseClient";

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
  pickup_date?: string | null;
  pickup_time?: string | null;
  dropoff_date?: string | null;
  dropoff_time?: string | null;
  equipment_type?: string | null;
  weight_lbs?: number | null;
  temperature_required?: string | null;
  rate?: number | null;
  distance_miles?: number | null;
  commodity?: string | null;
  notes?: string | null;
  status?: LoadStatus | string | null;
  driver_id?: string | null;
  created_at?: string | null;
  accepted_at?: string | null;
  arrived_pickup_at?: string | null;
  picked_up_at?: string | null;
  arrived_dropoff_at?: string | null;
  delivered_at?: string | null;
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
    } catch (error) {
      console.log("LIVE_OPS_CRASH:", error);
      Alert.alert("Operations Error", "Unable to load live operations.");
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
        return "#2563EB";
      case "accepted":
        return "#7C3AED";
      case "arrived_pickup":
        return "#0891B2";
      case "picked_up":
        return "#F59E0B";
      case "in_transit":
        return "#0F766E";
      case "arrived_dropoff":
        return "#EA580C";
      case "delivered":
        return "#10B981";
      case "cancelled":
        return "#DC2626";
      default:
        return "#64748B";
    }
  }

  function getAlertColor(severity: string) {
    switch (severity) {
      case "CRITICAL":
        return "#DC2626";
      case "HIGH":
        return "#F59E0B";
      case "MEDIUM":
        return "#2563EB";
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

  function renderStat(label: string, value: string | number, accent = false) {
    return (
      <View style={[styles.statCard, accent && styles.statCardAccent]}>
        <Text style={[styles.statValue, accent && styles.statValueAccent]}>
          {value}
        </Text>
        <Text style={[styles.statLabel, accent && styles.statLabelAccent]}>
          {label}
        </Text>
      </View>
    );
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
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{item.title || "Farm2Home Load"}</Text>
            <Text style={styles.cardSub}>
              {item.pickup_location || "Pickup"} →{" "}
              {item.dropoff_location || "Dropoff"}
            </Text>
          </View>

          {renderBadge(item.status)}
        </View>

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
          Rate: {formatMoney(Number(item.rate || 0))} • Miles:{" "}
          {Number(item.distance_miles || 0).toFixed(0)}
        </Text>
      </TouchableOpacity>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={styles.loadingText}>Loading live operations...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.mapWrap}>
        <Text style={styles.mapIcon}>📡</Text>
        <Text style={styles.mapTitle}>Realtime Freight Operations</Text>
        <Text style={styles.mapText}>
          Live freight loads, driver GPS, delivery milestones, alerts, and
          revenue are streaming from Supabase.
        </Text>

        <View style={styles.mapStatsRow}>
          <View style={styles.mapStat}>
            <Text style={styles.mapStatValue}>{availableLoads.length}</Text>
            <Text style={styles.mapStatLabel}>Available</Text>
          </View>

          <View style={styles.mapStat}>
            <Text style={styles.mapStatValue}>{activeLoads.length}</Text>
            <Text style={styles.mapStatLabel}>Active</Text>
          </View>

          <View style={styles.mapStat}>
            <Text style={styles.mapStatValue}>{drivers.length}</Text>
            <Text style={styles.mapStatLabel}>GPS</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.panel}
        contentContainerStyle={styles.panelInner}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text style={styles.eyebrow}>Farm2Home Admin</Text>
        <Text style={styles.title}>Live Operations Center</Text>
        <Text style={styles.subtitle}>
          Dispatch view for freight movement, driver status, GPS signal,
          delivery timeline, alerts, and revenue.
        </Text>

        <View style={styles.navRow}>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => router.push("/freight/board" as any)}
          >
            <Text style={styles.navText}>Freight Board</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navButtonOutline}
            onPress={() => router.push("/driver/earnings" as any)}
          >
            <Text style={styles.navTextOutline}>Earnings</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsGrid}>
          {renderStat("Available Loads", availableLoads.length)}
          {renderStat("Active Loads", activeLoads.length)}
          {renderStat("Delivered Loads", deliveredLoads.length)}
          {renderStat("Driver GPS Signals", drivers.length)}
          {renderStat("Alerts", alerts.length, alerts.length > 0)}
          {renderStat("Delivered Revenue", formatMoney(liveRevenue), true)}
          {renderStat("Open Freight Value", formatMoney(openFreightValue), true)}
          {renderStat("Active Freight Value", formatMoney(activeFreightValue), true)}
        </View>

        <TouchableOpacity style={styles.refreshButton} onPress={loadLiveOperations}>
          <Text style={styles.refreshText}>Refresh Live Center</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Realtime GPS Fleet</Text>

        {drivers.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No driver GPS yet.</Text>
            <Text style={styles.emptyText}>
              Driver locations will appear after drivers start live tracking.
            </Text>
          </View>
        ) : (
          drivers.slice(0, 10).map((driver) => (
            <View key={`${driver.load_id}_${driver.updated_at}`} style={styles.gpsCard}>
              <View style={styles.cardHeader}>
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

              <Text style={styles.metaText}>
                Updated:{" "}
                {driver.updated_at
                  ? new Date(driver.updated_at).toLocaleString()
                  : "Not available"}
              </Text>

              <Text style={styles.freshnessText}>
                Signal: {getDriverFreshness(driver)}
              </Text>
            </View>
          ))
        )}

        <Text style={styles.sectionTitle}>Operations Alerts</Text>

        {alerts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No active alerts.</Text>
            <Text style={styles.emptyText}>
              Cold-chain load, stale GPS, and aging active-load alerts will
              appear here.
            </Text>
          </View>
        ) : (
          alerts.map((item) => (
            <View key={item.id} style={styles.alertCard}>
              <View style={styles.alertHeader}>
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
            </View>
          ))
        )}

        <Text style={styles.sectionTitle}>Active Freight Loads</Text>

        <FlatList
          data={activeLoads}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No active loads.</Text>
              <Text style={styles.emptyText}>
                Accepted, pickup, transit, and dropoff loads will appear here.
              </Text>
            </View>
          }
          renderItem={({ item }) => renderLoadCard(item)}
        />

        <Text style={styles.sectionTitle}>Available Freight Loads</Text>

        <FlatList
          data={availableLoads}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No available loads.</Text>
            </View>
          }
          renderItem={({ item }) => renderLoadCard(item)}
        />

        <Text style={styles.sectionTitle}>Delivered Loads</Text>

        <FlatList
          data={deliveredLoads.slice(0, 20)}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          contentContainerStyle={{ paddingBottom: 90 }}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No delivered loads yet.</Text>
            </View>
          }
          renderItem={({ item }) => renderLoadCard(item)}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: "#6B7280",
    marginTop: 10,
    fontWeight: "800",
  },
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  mapWrap: {
    height: "34%",
    backgroundColor: "#DDEFE4",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  mapIcon: {
    fontSize: 54,
    marginBottom: 10,
  },
  mapTitle: {
    color: "#111827",
    fontSize: 27,
    fontWeight: "900",
    marginBottom: 8,
    textAlign: "center",
  },
  mapText: {
    color: "#374151",
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 23,
    maxWidth: 520,
  },
  mapStatsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 18,
  },
  mapStat: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  mapStatValue: {
    color: "#111827",
    fontSize: 22,
    fontWeight: "900",
  },
  mapStatLabel: {
    color: "#6B7280",
    fontWeight: "800",
    marginTop: 3,
  },
  panel: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -28,
  },
  panelInner: {
    padding: 18,
    paddingBottom: 80,
  },
  eyebrow: {
    color: "#10B981",
    fontWeight: "900",
    marginBottom: 6,
  },
  title: {
    color: "#111827",
    fontSize: 31,
    fontWeight: "900",
    marginBottom: 8,
  },
  subtitle: {
    color: "#6B7280",
    fontWeight: "700",
    lineHeight: 22,
    marginBottom: 14,
  },
  navRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  navButton: {
    flex: 1,
    backgroundColor: "#10B981",
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  navButtonOutline: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#10B981",
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  navText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  navTextOutline: {
    color: "#10B981",
    fontWeight: "900",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 14,
  },
  statCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  statCardAccent: {
    backgroundColor: "#064E3B",
    borderColor: "#064E3B",
  },
  statValue: {
    color: "#111827",
    fontSize: 24,
    fontWeight: "900",
  },
  statValueAccent: {
    color: "#FFFFFF",
  },
  statLabel: {
    color: "#6B7280",
    fontWeight: "800",
    marginTop: 4,
  },
  statLabelAccent: {
    color: "#BBF7D0",
  },
  refreshButton: {
    backgroundColor: "#111827",
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 18,
  },
  refreshText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  sectionTitle: {
    color: "#111827",
    fontSize: 23,
    fontWeight: "900",
    marginBottom: 12,
    marginTop: 4,
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    padding: 18,
    borderRadius: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  emptyTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 6,
  },
  emptyText: {
    color: "#6B7280",
    fontWeight: "700",
    lineHeight: 21,
  },
  gpsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 15,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "#10B981",
  },
  alertCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  alertHeader: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  alertTitle: {
    color: "#111827",
    fontSize: 17,
    fontWeight: "900",
    marginBottom: 5,
  },
  alertMessage: {
    color: "#374151",
    fontWeight: "700",
    lineHeight: 20,
  },
  alertBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  alertBadgeText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 10,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cardHeader: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    marginBottom: 8,
  },
  cardTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "900",
  },
  cardSub: {
    color: "#6B7280",
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
  metaText: {
    color: "#374151",
    fontWeight: "700",
    lineHeight: 20,
    marginBottom: 4,
  },
  freshnessText: {
    color: "#10B981",
    fontWeight: "900",
    marginTop: 6,
  },
});