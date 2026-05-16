import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";

import { supabase } from "../services/supabaseClient";

type DriverLocation = {
  id?: string;
  load_id: string;
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
];

export default function AdminFleetMap() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [drivers, setDrivers] = useState<DriverLocation[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<DriverLocation | null>(
    null
  );

  useFocusEffect(
    useCallback(() => {
      loadFleetMap();

      const channel = supabase
        .channel("admin-fleet-map-realtime")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "driver_locations",
          },
          () => loadFleetMap()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }, [])
  );

  async function loadFleetMap() {
    try {
      setLoading(true);

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

      if (
        selectedDriver &&
        !cleanDrivers.find(
          (item) =>
            item.load_id === selectedDriver.load_id &&
            item.updated_at === selectedDriver.updated_at
        )
      ) {
        setSelectedDriver(cleanDrivers[0] || null);
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
    loadFleetMap();
  }

  function statusColor(status?: string | null) {
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
        return "#14B8A6";
      case "delivered":
        return "#10B981";
      case "cancelled":
        return "#DC2626";
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
    () =>
      drivers.filter((item) =>
        ACTIVE_STATUSES.includes(String(item.status || ""))
      ),
    [drivers]
  );

  const deliveredDrivers = useMemo(
    () => drivers.filter((item) => item.status === "delivered"),
    [drivers]
  );

  const staleDrivers = useMemo(
    () =>
      drivers.filter((driver) => {
        if (!driver.updated_at || driver.status === "delivered") return false;

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
      <View style={styles.mapFallback}>
        {loading && drivers.length === 0 ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#10B981" />
            <Text style={styles.loadingText}>Loading fleet map...</Text>
          </View>
        ) : (
          <>
            <Text style={styles.mapIcon}>🗺️</Text>

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

            <Text style={styles.centerText}>
              Center: {mapCenter.latitude.toFixed(5)},{" "}
              {mapCenter.longitude.toFixed(5)}
            </Text>

            <View style={styles.mapStatsRow}>
              <View style={styles.mapStat}>
                <Text style={styles.mapStatValue}>{drivers.length}</Text>
                <Text style={styles.mapStatLabel}>GPS</Text>
              </View>

              <View style={styles.mapStat}>
                <Text style={styles.mapStatValue}>{activeDrivers.length}</Text>
                <Text style={styles.mapStatLabel}>Active</Text>
              </View>

              <View style={styles.mapStat}>
                <Text style={styles.mapStatValue}>{deliveredDrivers.length}</Text>
                <Text style={styles.mapStatLabel}>Delivered</Text>
              </View>

              <View style={styles.mapStat}>
                <Text style={styles.mapStatValue}>{staleDrivers.length}</Text>
                <Text style={styles.mapStatLabel}>Stale</Text>
              </View>
            </View>
          </>
        )}
      </View>
    );
  }

  if (loading && drivers.length === 0) {
    return (
      <View style={styles.container}>
        {renderWebSafeMap()}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderWebSafeMap()}

      <ScrollView
        style={styles.panel}
        contentContainerStyle={styles.panelInner}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text style={styles.eyebrow}>Farm2Home Admin</Text>

        <Text style={styles.title}>Fleet Command Center</Text>

        <Text style={styles.subtitle}>
          Monitor driver GPS, active routes, delivery movement, signal
          freshness, and dispatch operations.
        </Text>

        <View style={styles.navRow}>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => router.push("/admin/live-operations-center" as any)}
          >
            <Text style={styles.navText}>Live Ops</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navButtonOutline}
            onPress={() => router.push("/freight/board" as any)}
          >
            <Text style={styles.navTextOutline}>Freight Board</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.refreshButton} onPress={loadFleetMap}>
          <Text style={styles.refreshText}>Refresh Fleet GPS</Text>
        </TouchableOpacity>

        {selectedDriver ? (
          <View style={styles.selectedCard}>
            <View style={styles.selectedHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.selectedTitle}>Selected Driver GPS</Text>

                <Text style={styles.selectedSub}>
                  Signal: {getFreshness(selectedDriver)}
                </Text>
              </View>

              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: statusColor(selectedDriver.status),
                  },
                ]}
              >
                <Text style={styles.statusText}>
                  {friendlyStatus(selectedDriver.status)}
                </Text>
              </View>
            </View>

            <Text style={styles.metaText}>
              Load: #{selectedDriver.load_id?.slice(-6)}
            </Text>

            <Text style={styles.metaText}>
              GPS: {selectedDriver.latitude.toFixed(5)},{" "}
              {selectedDriver.longitude.toFixed(5)}
            </Text>

            <Text style={styles.metaText}>
              Speed:{" "}
              {selectedDriver.speed !== null &&
              selectedDriver.speed !== undefined
                ? `${selectedDriver.speed.toFixed(1)} m/s`
                : "Not available"}
            </Text>

            <Text style={styles.metaText}>
              Heading:{" "}
              {selectedDriver.heading !== null &&
              selectedDriver.heading !== undefined
                ? `${selectedDriver.heading.toFixed(0)}°`
                : "Not available"}
            </Text>

            <Text style={styles.metaText}>
              Updated:{" "}
              {selectedDriver.updated_at
                ? new Date(selectedDriver.updated_at).toLocaleString()
                : "Not available"}
            </Text>

            <View style={styles.selectedActions}>
              <TouchableOpacity
                style={styles.chatButton}
                onPress={() =>
                  Alert.alert(
                    "Driver Chat",
                    "Chat screen can be connected after chat-center is ready."
                  )
                }
              >
                <Text style={styles.chatText}>Driver Chat</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.trackButton}
                onPress={() =>
                  router.push({
                    pathname: "/driver/live-location-provider" as any,
                    params: {
                      loadId: selectedDriver.load_id,
                    },
                  })
                }
              >
                <Text style={styles.trackText}>Open Tracking</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No selected driver.</Text>
            <Text style={styles.emptyText}>
              Start live tracking from a driver load to see GPS here.
            </Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Live Driver Activity</Text>

        <FlatList
          data={drivers}
          keyExtractor={(item, index) =>
            item.id || `${item.load_id}_${item.updated_at}_${index}`
          }
          scrollEnabled={false}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No live drivers yet.</Text>

              <Text style={styles.emptyText}>
                Driver GPS will appear after drivers start live tracking.
              </Text>
            </View>
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
                  <View style={{ flex: 1 }}>
                    <Text style={styles.driverName}>Driver GPS</Text>

                    <Text style={styles.driverSub}>
                      Load #{item.load_id?.slice(-6)}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.smallStatus,
                      {
                        backgroundColor: statusColor(item.status),
                      },
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

                <Text
                  style={[
                    styles.freshnessText,
                    stale && styles.staleText,
                  ]}
                >
                  Signal: {getFreshness(item)}
                </Text>
              </TouchableOpacity>
            );
          }}
        />

        <View style={{ height: 70 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  mapFallback: {
    height: "38%",
    backgroundColor: "#DDEFE4",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  mapIcon: {
    fontSize: 58,
    marginBottom: 12,
  },
  mapTitle: {
    color: "#111827",
    fontSize: 28,
    fontWeight: "900",
    marginBottom: 10,
    textAlign: "center",
  },
  mapSubtitle: {
    color: "#374151",
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 23,
    maxWidth: 520,
  },
  centerText: {
    color: "#064E3B",
    fontWeight: "900",
    marginTop: 10,
  },
  mapStatsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 18,
    justifyContent: "center",
  },
  mapStat: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 18,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    minWidth: 76,
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
    fontSize: 12,
  },
  loadingBox: {
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: "#374151",
    fontWeight: "800",
    marginTop: 10,
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
    marginBottom: 5,
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
    marginBottom: 12,
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
  refreshButton: {
    backgroundColor: "#111827",
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 14,
  },
  refreshText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  selectedCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 18,
  },
  selectedHeader: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    marginBottom: 12,
  },
  selectedTitle: {
    color: "#111827",
    fontSize: 21,
    fontWeight: "900",
    marginBottom: 4,
  },
  selectedSub: {
    color: "#10B981",
    fontWeight: "900",
  },
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
  metaText: {
    color: "#374151",
    fontWeight: "700",
    marginBottom: 6,
    lineHeight: 21,
  },
  selectedActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  chatButton: {
    flex: 1,
    backgroundColor: "#10B981",
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  chatText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  trackButton: {
    flex: 1,
    backgroundColor: "#111827",
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  trackText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  sectionTitle: {
    color: "#111827",
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 12,
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  emptyTitle: {
    color: "#111827",
    fontWeight: "900",
    fontSize: 18,
    marginBottom: 6,
  },
  emptyText: {
    color: "#6B7280",
    fontWeight: "700",
    lineHeight: 21,
  },
  driverCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 12,
  },
  driverCardActive: {
    borderColor: "#10B981",
    borderWidth: 2,
  },
  driverHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 8,
  },
  driverName: {
    color: "#111827",
    fontSize: 17,
    fontWeight: "900",
  },
  driverSub: {
    color: "#6B7280",
    fontWeight: "700",
    marginTop: 4,
  },
  smallStatus: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  smallStatusText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 10,
    textTransform: "capitalize",
  },
  driverMeta: {
    color: "#374151",
    fontWeight: "700",
    marginBottom: 4,
  },
  freshnessText: {
    color: "#10B981",
    fontWeight: "900",
    marginTop: 5,
  },
  staleText: {
    color: "#DC2626",
  },
});