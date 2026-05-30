// app/admin/fleet-map.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
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

type DriverLocation = {
  id?: string;
  load_id: string;
  driver_id?: string | null;
  carrier_id?: string | null;
  driver_name?: string | null;
  latitude: number;
  longitude: number;
  speed?: number | null;
  heading?: number | null;
  accuracy?: number | null;
  status?: string | null;
  updated_at?: string | null;
};

const ACTIVE_STATUSES = [
  "accepted",
  "arrived_pickup",
  "picked_up",
  "in_transit",
  "arrived_dropoff",
  "ACCEPTED",
  "PICKED_UP",
  "IN_TRANSIT",
];

export default function AdminFleetMap() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [drivers, setDrivers] = useState<DriverLocation[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<DriverLocation | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadFleetMap();

      const channel = supabase
        .channel("admin-fleet-map-realtime")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "driver_locations" },
          () => loadFleetMap(false)
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }, [])
  );

  async function loadFleetMap(showLoader = true) {
    try {
      if (showLoader) setLoading(true);

      const { data, error } = await supabase
        .from("driver_locations")
        .select("*")
        .order("updated_at", { ascending: false });

      if (error) {
        Alert.alert("Fleet Error", error.message);
        return;
      }

      const cleanDrivers = Array.isArray(data)
        ? (data as any[]).map((item) => ({
            ...item,
            latitude: Number(item.latitude || 0),
            longitude: Number(item.longitude || 0),
            speed:
              item.speed === null || item.speed === undefined
                ? null
                : Number(item.speed),
            heading:
              item.heading === null || item.heading === undefined
                ? null
                : Number(item.heading),
            accuracy:
              item.accuracy === null || item.accuracy === undefined
                ? null
                : Number(item.accuracy),
          }))
        : [];

      setDrivers(cleanDrivers);

      if (!selectedDriver && cleanDrivers.length > 0) {
        setSelectedDriver(cleanDrivers[0]);
      }
    } catch (error) {
      console.log("FLEET_MAP_ERROR:", error);
      Alert.alert("Fleet Error", "Unable to load fleet map.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function onRefresh() {
    setRefreshing(true);
    loadFleetMap(false);
  }

  function statusColor(status?: string | null) {
    switch (String(status || "").toLowerCase()) {
      case "available":
      case "new":
      case "open":
        return ui.blue;
      case "accepted":
      case "booked":
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
      case "canceled":
        return ui.red;
      default:
        return "#64748B";
    }
  }

  function friendlyStatus(status?: string | null) {
    return String(status || "unknown").replace(/_/g, " ");
  }

  function getFreshness(driver: DriverLocation) {
    if (!driver.updated_at) return "No update";

    const minutes =
      (Date.now() - new Date(driver.updated_at).getTime()) / 1000 / 60;

    if (minutes <= 5) return "Live";
    if (minutes <= 30) return `${Math.round(minutes)} min ago`;
    return `Stale · ${Math.round(minutes)} min`;
  }

  const activeDrivers = useMemo(
    () => drivers.filter((item) => ACTIVE_STATUSES.includes(String(item.status || ""))),
    [drivers]
  );

  const deliveredDrivers = useMemo(
    () =>
      drivers.filter(
        (item) => String(item.status || "").toLowerCase() === "delivered"
      ),
    [drivers]
  );

  const staleDrivers = useMemo(
    () =>
      drivers.filter((driver) => {
        if (
          !driver.updated_at ||
          String(driver.status || "").toLowerCase() === "delivered"
        ) {
          return false;
        }

        const minutes =
          (Date.now() - new Date(driver.updated_at).getTime()) / 1000 / 60;

        return minutes > 45;
      }),
    [drivers]
  );

  const mapCenter = useMemo(() => {
    if (selectedDriver) {
      return {
        latitude: selectedDriver.latitude,
        longitude: selectedDriver.longitude,
      };
    }

    if (drivers.length > 0) {
      return {
        latitude: drivers[0].latitude,
        longitude: drivers[0].longitude,
      };
    }

    return {
      latitude: 42.3314,
      longitude: -83.0458,
    };
  }, [selectedDriver, drivers]);

  function renderWebSafeMap() {
    return (
      <View style={styles.mapCard}>
        {loading && drivers.length === 0 ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={ui.primary} />
            <Text style={styles.loadingText}>Loading fleet map...</Text>
          </View>
        ) : (
          <>
            <View style={styles.mapHeader}>
              <View style={styles.mapIconBox}>
                <Ionicons name="map-outline" size={30} color="#FFFFFF" />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.mapTitle}>
                  {Platform.OS === "web"
                    ? "Fleet GPS Preview"
                    : "Native Fleet Map Ready"}
                </Text>
                <Text style={styles.mapSubtitle}>
                  {Platform.OS === "web"
                    ? "Expo Web shows a safe GPS preview. Native iOS/Android can show live map markers."
                    : "Live GPS data is ready for native map rendering."}
                </Text>
              </View>
            </View>

            <View style={styles.centerBox}>
              <Ionicons name="locate-outline" size={18} color={ui.primary} />
              <Text style={styles.centerText}>
                Center: {mapCenter.latitude.toFixed(5)},{" "}
                {mapCenter.longitude.toFixed(5)}
              </Text>
            </View>

            <View style={styles.mapStatsRow}>
              <MapStat label="GPS" value={drivers.length} color={ui.primary} />
              <MapStat label="Active" value={activeDrivers.length} color={ui.green} />
              <MapStat label="Delivered" value={deliveredDrivers.length} color={ui.blue} />
              <MapStat label="Stale" value={staleDrivers.length} color={ui.red} />
            </View>
          </>
        )}
      </View>
    );
  }

  if (loading && drivers.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" backgroundColor={ui.bg} />
        <View style={styles.loadingContainer}>{renderWebSafeMap()}</View>
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
              <Text style={styles.logoSub}>Fleet Map</Text>
            </View>
          </View>

          <NavButton label="Dashboard" icon="grid-outline" route="/admin/dashboard" />
          <NavButton label="Live Ops" icon="navigate-outline" route="/admin/live-operations-center" />
          <NavButton label="Fleet Map" icon="map-outline" route="/admin/fleet-map" active />
          <NavButton label="Drivers" icon="car-outline" route="/admin/drivers" />
          <NavButton label="Freight Board" icon="list-outline" route="/freight/board" />
          <NavButton label="Analytics" icon="analytics-outline" route="/admin/analytics-center" />
        </View>

        <View style={styles.main}>
          <View style={styles.topbar}>
            <View>
              <Text style={styles.welcome}>Farm2Home Live Dispatch</Text>
              <Text style={styles.pageTitle}>Fleet Command Center</Text>
              <Text style={styles.pageSub}>
                Monitor driver GPS, active routes, delivery movement, signal freshness, and dispatch operations.
              </Text>
            </View>

            <TouchableOpacity style={styles.refreshPill} onPress={() => loadFleetMap()}>
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
            {renderWebSafeMap()}

            <View style={styles.quickGrid}>
              <QuickAction label="Live Ops" icon="radio-outline" route="/admin/live-operations-center" />
              <QuickAction label="Freight Board" icon="list-outline" route="/freight/board" />
              <QuickAction label="Drivers" icon="car-outline" route="/admin/drivers" />
              <QuickAction label="Route AI" icon="map-outline" route="/ai/route-optimization-center" />
            </View>

            {selectedDriver ? (
              <View style={styles.selectedCard}>
                <View style={styles.selectedHeader}>
                  <View style={styles.selectedIcon}>
                    <Ionicons name="navigate-outline" size={22} color={ui.primary} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.selectedTitle}>Selected Driver GPS</Text>
                    <Text style={styles.selectedSub}>
                      Signal: {getFreshness(selectedDriver)}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: statusColor(selectedDriver.status) },
                    ]}
                  >
                    <Text style={styles.statusText}>
                      {friendlyStatus(selectedDriver.status)}
                    </Text>
                  </View>
                </View>

                <InfoLine
                  label="Driver"
                  value={selectedDriver.driver_name || selectedDriver.driver_id || "Unknown"}
                />
                <InfoLine label="Load" value={`#${selectedDriver.load_id?.slice(-6)}`} />
                <InfoLine
                  label="GPS"
                  value={`${selectedDriver.latitude.toFixed(5)}, ${selectedDriver.longitude.toFixed(5)}`}
                />
                <InfoLine
                  label="Speed"
                  value={
                    selectedDriver.speed !== null && selectedDriver.speed !== undefined
                      ? `${selectedDriver.speed.toFixed(1)} m/s`
                      : "Not available"
                  }
                />
                <InfoLine
                  label="Heading"
                  value={
                    selectedDriver.heading !== null && selectedDriver.heading !== undefined
                      ? `${selectedDriver.heading.toFixed(0)}°`
                      : "Not available"
                  }
                />
                <InfoLine
                  label="Updated"
                  value={
                    selectedDriver.updated_at
                      ? new Date(selectedDriver.updated_at).toLocaleString()
                      : "Not available"
                  }
                />

                <View style={styles.selectedActions}>
                  <TouchableOpacity
                    style={styles.chatButton}
                    onPress={() =>
                      router.push({
                        pathname: "/chat/chat-center" as any,
                        params: {
                          conversationId: `load_${selectedDriver.load_id}`,
                          loadId: selectedDriver.load_id,
                        },
                      })
                    }
                  >
                    <Ionicons name="chatbubbles-outline" size={17} color="#FFFFFF" />
                    <Text style={styles.chatText}>Driver Chat</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.trackButton}
                    onPress={() =>
                      router.push({
                        pathname: "/driver/live-location-provider" as any,
                        params: { loadId: selectedDriver.load_id },
                      })
                    }
                  >
                    <Ionicons name="locate-outline" size={17} color="#FFFFFF" />
                    <Text style={styles.trackText}>Open Tracking</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <EmptyCard
                title="No selected driver."
                text="Start live tracking from a driver load to see GPS here."
              />
            )}

            <View style={styles.dataSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Live Driver Activity</Text>
                <Text style={styles.sectionLink}>{drivers.length} GPS records</Text>
              </View>

              <FlatList
                data={drivers}
                keyExtractor={(item, index) =>
                  item.id || `${item.load_id}_${item.updated_at}_${index}`
                }
                scrollEnabled={false}
                contentContainerStyle={{ paddingBottom: 80 }}
                ListEmptyComponent={
                  <EmptyCard
                    title="No live drivers yet."
                    text="Driver GPS will appear after drivers start live tracking."
                  />
                }
                renderItem={({ item }) => {
                  const active =
                    selectedDriver?.load_id === item.load_id &&
                    selectedDriver?.updated_at === item.updated_at;

                  const stale = staleDrivers.some(
                    (driver) =>
                      driver.load_id === item.load_id &&
                      driver.updated_at === item.updated_at
                  );

                  return (
                    <TouchableOpacity
                      style={[styles.driverCard, active && styles.driverCardActive]}
                      onPress={() => setSelectedDriver(item)}
                    >
                      <View style={styles.driverHeader}>
                        <View style={styles.driverIcon}>
                          <Ionicons name="car-outline" size={20} color={ui.primary} />
                        </View>

                        <View style={{ flex: 1 }}>
                          <Text style={styles.driverName}>
                            {item.driver_name || "Driver GPS"}
                          </Text>
                          <Text style={styles.driverSub}>
                            Load #{item.load_id?.slice(-6)}
                          </Text>
                        </View>

                        <View
                          style={[
                            styles.smallStatus,
                            { backgroundColor: statusColor(item.status) },
                          ]}
                        >
                          <Text style={styles.smallStatusText}>
                            {friendlyStatus(item.status)}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.driverMeta}>
                        GPS: {item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}
                      </Text>

                      <Text style={styles.driverMeta}>
                        Updated:{" "}
                        {item.updated_at
                          ? new Date(item.updated_at).toLocaleString()
                          : "Not available"}
                      </Text>

                      <Text style={[styles.freshnessText, stale && styles.staleText]}>
                        Signal: {getFreshness(item)}
                      </Text>
                    </TouchableOpacity>
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

function MapStat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <View style={styles.mapStat}>
      <View style={[styles.mapStatDot, { backgroundColor: color }]} />
      <Text style={styles.mapStatValue}>{value}</Text>
      <Text style={styles.mapStatLabel}>{label}</Text>
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

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoLine}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function EmptyCard({ title, text }: { title: string; text?: string }) {
  return (
    <View style={styles.emptyCard}>
      <Ionicons name="map-outline" size={30} color={ui.primary} />
      <Text style={styles.emptyTitle}>{title}</Text>
      {!!text && <Text style={styles.emptyText}>{text}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: ui.bg },
  loadingContainer: {
    flex: 1,
    backgroundColor: ui.bg,
    padding: 16,
    justifyContent: "center",
  },
  loadingBox: { alignItems: "center", justifyContent: "center" },
  loadingText: { color: ui.muted, fontWeight: "800", marginTop: 10 },
  shell: { flex: 1, backgroundColor: ui.bg },
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
  pageSub: { color: ui.muted, marginTop: 4, fontWeight: "700", maxWidth: 760 },
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
  mapCard: {
    backgroundColor: ui.primary,
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
  },
  mapHeader: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  mapIconBox: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  mapTitle: { color: "#FFFFFF", fontSize: 24, fontWeight: "900" },
  mapSubtitle: {
    color: "#EDE9FE",
    fontWeight: "700",
    marginTop: 6,
    lineHeight: 21,
  },
  centerBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    marginTop: 14,
  },
  centerText: { color: ui.text, fontWeight: "900" },
  mapStatsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 14,
  },
  mapStat: {
    flex: 1,
    minWidth: "22%",
    backgroundColor: "#FFFFFF",
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
  },
  mapStatDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
    marginBottom: 8,
  },
  mapStatValue: { color: ui.text, fontSize: 22, fontWeight: "900" },
  mapStatLabel: { color: ui.muted, fontWeight: "800", marginTop: 2, fontSize: 12 },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 14,
  },
  quickAction: {
    width: "48%",
    backgroundColor: ui.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: ui.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  quickText: { color: ui.text, fontWeight: "900", fontSize: 13 },
  selectedCard: {
    backgroundColor: ui.card,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: ui.border,
    marginBottom: 14,
  },
  selectedHeader: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    marginBottom: 12,
  },
  selectedIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: ui.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedTitle: { color: ui.text, fontSize: 21, fontWeight: "900", marginBottom: 4 },
  selectedSub: { color: ui.green, fontWeight: "900" },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  statusText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 12,
    textTransform: "capitalize",
  },
  infoLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: ui.border,
  },
  infoLabel: { color: ui.muted, fontWeight: "800", flex: 0.35 },
  infoValue: { color: ui.text, fontWeight: "800", flex: 0.65, textAlign: "right" },
  selectedActions: { flexDirection: "row", gap: 10, marginTop: 14 },
  chatButton: {
    flex: 1,
    backgroundColor: ui.primary,
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  chatText: { color: "#FFFFFF", fontWeight: "900" },
  trackButton: {
    flex: 1,
    backgroundColor: ui.text,
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  trackText: { color: "#FFFFFF", fontWeight: "900" },
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
  emptyCard: {
    backgroundColor: ui.card,
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: ui.border,
    marginBottom: 14,
    alignItems: "center",
  },
  emptyTitle: {
    color: ui.text,
    fontWeight: "900",
    fontSize: 18,
    marginTop: 8,
    marginBottom: 6,
  },
  emptyText: { color: ui.muted, fontWeight: "700", lineHeight: 21, textAlign: "center" },
  driverCard: {
    backgroundColor: ui.soft,
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: ui.border,
    marginBottom: 12,
  },
  driverCardActive: { borderColor: ui.primary, borderWidth: 2 },
  driverHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 8,
  },
  driverIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: ui.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  driverName: { color: ui.text, fontSize: 17, fontWeight: "900" },
  driverSub: { color: ui.muted, fontWeight: "700", marginTop: 4 },
  smallStatus: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  smallStatusText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 10,
    textTransform: "capitalize",
  },
  driverMeta: { color: ui.text, fontWeight: "700", marginBottom: 4 },
  freshnessText: { color: ui.green, fontWeight: "900", marginTop: 5 },
  staleText: { color: ui.red },
});