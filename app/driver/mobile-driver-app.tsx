import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { router, useFocusEffect } from "expo-router";

import { supabase } from "../data/supabaseClient";
import freightTheme from "../styles/freightTheme";
import ProtectedRoute from "../components/ProtectedRoute";

type DriverLoad = {
  id: string;
  title?: string;
  commodity?: string;
  pickup_city?: string;
  pickup_state?: string;
  delivery_city?: string;
  delivery_state?: string;
  rate?: number;
  status?: string;
  carrier_id?: string | null;
  farmers?: {
    farm_name?: string;
    owner_name?: string;
  };
};

type DriverStats = {
  activeLoads: number;
  completedLoads: number;
  openLoads: number;
  earnings: number;
};

export default function MobileDriverApp() {
  const [loading, setLoading] = useState(false);
  const [carrierId, setCarrierId] = useState("");
  const [carrierName, setCarrierName] = useState("Farm2Home Driver");
  const [loads, setLoads] = useState<DriverLoad[]>([]);
  const [stats, setStats] = useState<DriverStats>({
    activeLoads: 0,
    completedLoads: 0,
    openLoads: 0,
    earnings: 0,
  });

  useFocusEffect(
    React.useCallback(() => {
      loadDriverDashboard();
    }, [])
  );

  async function loadDriverDashboard() {
    try {
      setLoading(true);

      const saved =
        (await AsyncStorage.getItem("currentFreightCarrier")) ||
        (await AsyncStorage.getItem("currentFreight"));

      let localCarrierId = "";
      let localCarrierName = "Farm2Home Driver";

      if (saved) {
        const carrier = JSON.parse(saved);

        localCarrierId = carrier.id || carrier.email || "";
        localCarrierName =
          carrier.companyName ||
          carrier.businessName ||
          carrier.ownerName ||
          carrier.name ||
          "Farm2Home Driver";
      }

      setCarrierId(localCarrierId);
      setCarrierName(localCarrierName);

      const { data: carrierRecord } = await supabase
        .from("freight_carriers")
        .select("*")
        .or(`id.eq.${localCarrierId},email.eq.${localCarrierId}`)
        .maybeSingle();

      const cloudCarrierId = carrierRecord?.id || localCarrierId;

      const { data, error } = await supabase
        .from("freight_loads")
        .select(
          `
          *,
          farmers (
            farm_name,
            owner_name
          )
        `
        )
        .or(`status.eq.OPEN,carrier_id.eq.${cloudCarrierId}`)
        .order("created_at", { ascending: false });

      if (error) {
        console.log("Driver loads error:", error.message);
        setLoads([]);
        return;
      }

      const cleanLoads = (data || []) as DriverLoad[];
      setLoads(cleanLoads);

      const activeStatuses = ["BOOKED", "ACCEPTED", "PICKED_UP", "IN_TRANSIT"];

      setStats({
        activeLoads: cleanLoads.filter((item) =>
          activeStatuses.includes(item.status || "")
        ).length,
        completedLoads: cleanLoads.filter((item) => item.status === "DELIVERED")
          .length,
        openLoads: cleanLoads.filter((item) => item.status === "OPEN").length,
        earnings: cleanLoads
          .filter((item) => item.status === "DELIVERED")
          .reduce((sum, item) => sum + Number(item.rate || 0), 0),
      });
    } catch (error) {
      console.log("Driver dashboard error:", error);
      Alert.alert("Load Error", "Unable to load driver dashboard.");
    } finally {
      setLoading(false);
    }
  }

  async function getCloudCarrierId() {
    const { data } = await supabase
      .from("freight_carriers")
      .select("id")
      .or(`id.eq.${carrierId},email.eq.${carrierId}`)
      .maybeSingle();

    return data?.id || carrierId || null;
  }

  async function requestLocation() {
    const permission = await Location.requestForegroundPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        "Location Permission Needed",
        "Please allow location access for live delivery tracking."
      );
      return null;
    }

    return Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
  }

  async function saveDriverGps(loadId: string, status: string) {
    const location = await requestLocation();

    if (!location) return;

    const cloudCarrierId = await getCloudCarrierId();

    const { data: existing } = await supabase
      .from("driver_locations")
      .select("*")
      .eq("load_id", loadId)
      .maybeSingle();

    const payload = {
      load_id: loadId,
      carrier_id: cloudCarrierId,
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      speed: location.coords.speed || null,
      status,
      updated_at: new Date().toISOString(),
    };

    if (existing?.id) {
      await supabase.from("driver_locations").update(payload).eq("id", existing.id);
    } else {
      await supabase.from("driver_locations").insert(payload);
    }
  }

  async function acceptLoad(loadId: string) {
    try {
      setLoading(true);

      const cloudCarrierId = await getCloudCarrierId();

      const { error } = await supabase
        .from("freight_loads")
        .update({
          carrier_id: cloudCarrierId,
          status: "BOOKED",
        })
        .eq("id", loadId);

      if (error) {
        Alert.alert("Accept Error", error.message);
        return;
      }

      await saveDriverGps(loadId, "READY");

      Alert.alert("Load Accepted", "This load is now assigned to you.");
      await loadDriverDashboard();
    } catch (error: any) {
      Alert.alert("Accept Error", error.message || "Unable to accept load.");
    } finally {
      setLoading(false);
    }
  }

  async function updateLoadStatus(
    loadId: string,
    loadStatus: string,
    gpsStatus: string
  ) {
    try {
      setLoading(true);

      const { error } = await supabase
        .from("freight_loads")
        .update({ status: loadStatus })
        .eq("id", loadId);

      if (error) {
        Alert.alert("Update Error", error.message);
        return;
      }

      await saveDriverGps(loadId, gpsStatus);

      Alert.alert("Status Updated", `Load marked as ${loadStatus}.`);
      await loadDriverDashboard();
    } catch (error: any) {
      Alert.alert("Update Error", error.message || "Unable to update load.");
    } finally {
      setLoading(false);
    }
  }

  function statusColor(status?: string) {
    switch (status) {
      case "OPEN":
        return "#2563EB";
      case "BOOKED":
      case "ACCEPTED":
        return "#7C3AED";
      case "PICKED_UP":
        return "#F59E0B";
      case "IN_TRANSIT":
        return "#0F766E";
      case "DELIVERED":
        return "#10B981";
      case "CANCELLED":
        return "#DC2626";
      default:
        return "#64748B";
    }
  }

  function renderActions(load: DriverLoad) {
    if (load.status === "OPEN") {
      return (
        <TouchableOpacity
          style={styles.acceptButton}
          onPress={() => acceptLoad(load.id)}
        >
          <Text style={styles.actionText}>Accept Load</Text>
        </TouchableOpacity>
      );
    }

    if (load.status === "BOOKED" || load.status === "ACCEPTED") {
      return (
        <View style={styles.actionGrid}>
          <TouchableOpacity
            style={styles.blueButton}
            onPress={() =>
              updateLoadStatus(load.id, "BOOKED", "EN_ROUTE_TO_PICKUP")
            }
          >
            <Text style={styles.actionText}>Start Pickup</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.orangeButton}
            onPress={() =>
              updateLoadStatus(load.id, "BOOKED", "ARRIVED_AT_PICKUP")
            }
          >
            <Text style={styles.actionText}>Arrived Pickup</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.greenButton}
            onPress={() => updateLoadStatus(load.id, "PICKED_UP", "PICKED_UP")}
          >
            <Text style={styles.actionText}>Picked Up</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (load.status === "PICKED_UP") {
      return (
        <View style={styles.actionGrid}>
          <TouchableOpacity
            style={styles.blueButton}
            onPress={() =>
              updateLoadStatus(load.id, "IN_TRANSIT", "EN_ROUTE_TO_DROPOFF")
            }
          >
            <Text style={styles.actionText}>Start Delivery</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.mapButton}
            onPress={() =>
              router.push({
                pathname: "/freight/navigation-assistant",
              })
            }
          >
            <Text style={styles.actionText}>Navigation</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (load.status === "IN_TRANSIT") {
      return (
        <View style={styles.actionGrid}>
          <TouchableOpacity
            style={styles.orangeButton}
            onPress={() =>
              updateLoadStatus(load.id, "IN_TRANSIT", "ARRIVED_AT_DROPOFF")
            }
          >
            <Text style={styles.actionText}>Arrived Dropoff</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.greenButton}
            onPress={() => updateLoadStatus(load.id, "DELIVERED", "DELIVERED")}
          >
            <Text style={styles.actionText}>Delivered</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.proofButton}
            onPress={() =>
              router.push({
                pathname: "/driver/proof-of-delivery",
                params: { loadId: load.id },
              })
            }
          >
            <Text style={styles.actionText}>Proof</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (load.status === "DELIVERED") {
      return (
        <View style={styles.completedBadge}>
          <Text style={styles.completedText}>Completed</Text>
        </View>
      );
    }

    return null;
  }

  return (
    <ProtectedRoute allowedRoles={["driver"]}>
      <View style={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Farm2Home Driver</Text>
          <Text style={styles.title}>Mobile Driver App</Text>
          <Text style={styles.subtitle}>
            Accept loads, update GPS, manage pickups, complete deliveries, and
            track your driver earnings.
          </Text>
        </View>

        <View style={styles.navRow}>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => router.push("/freight/board")}
          >
            <Text style={styles.navText}>Load Board</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navButtonOutline}
            onPress={() => router.push("/freight/navigation-assistant")}
          >
            <Text style={styles.navTextOutline}>Navigation</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={freightTheme.colors.primary} />
            <Text style={styles.loadingText}>Loading driver app...</Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.driverCard}>
              <Text style={styles.driverName}>🚚 {carrierName}</Text>
              <Text style={styles.driverMeta}>
                Manage active Farm2Home loads and delivery workflow.
              </Text>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.openLoads}</Text>
                <Text style={styles.statLabel}>Open</Text>
              </View>

              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.activeLoads}</Text>
                <Text style={styles.statLabel}>Active</Text>
              </View>

              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.completedLoads}</Text>
                <Text style={styles.statLabel}>Done</Text>
              </View>
            </View>

            <View style={styles.earningsCard}>
              <Text style={styles.earningsLabel}>Completed Load Earnings</Text>
              <Text style={styles.earningsValue}>${stats.earnings.toFixed(2)}</Text>
            </View>

            <TouchableOpacity style={styles.refreshButton} onPress={loadDriverDashboard}>
              <Text style={styles.refreshText}>Refresh Loads</Text>
            </TouchableOpacity>

            <Text style={styles.sectionTitle}>Driver Loads</Text>

            <FlatList
              data={loads}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              contentContainerStyle={{ paddingBottom: 100 }}
              ListEmptyComponent={
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>No loads available.</Text>
                  <Text style={styles.emptyText}>
                    Open and assigned loads will appear here.
                  </Text>
                </View>
              }
              renderItem={({ item }) => (
                <View style={styles.loadCard}>
                  <View style={styles.loadHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.loadTitle}>
                        {item.title || "Farm2Home Load"}
                      </Text>
                      <Text style={styles.commodity}>
                        {item.commodity || "Farm Goods"}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: statusColor(item.status) },
                      ]}
                    >
                      <Text style={styles.statusText}>{item.status || "OPEN"}</Text>
                    </View>
                  </View>

                  <View style={styles.routeBox}>
                    <Text style={styles.routeText}>
                      📍 {item.pickup_city || "Pickup"}, {item.pickup_state || ""}
                    </Text>

                    <Text style={styles.arrow}>→</Text>

                    <Text style={styles.routeText}>
                      🏁 {item.delivery_city || "Delivery"},{" "}
                      {item.delivery_state || ""}
                    </Text>
                  </View>

                  <Text style={styles.metaText}>
                    Farm: {item.farmers?.farm_name || "Farm2Home Farmer"}
                  </Text>

                  <Text style={styles.metaText}>
                    Rate: ${Number(item.rate || 0).toFixed(2)}
                  </Text>

                  <View style={styles.loadActions}>{renderActions(item)}</View>

                  <TouchableOpacity
                    style={styles.chatButton}
                    onPress={() =>
                      router.push({
                        pathname: "/chat/chat-center",
                        params: {
                          conversationId: `load_${item.id}`,
                          loadId: item.id,
                        },
                      })
                    }
                  >
                    <Text style={styles.chatText}>Open Load Chat</Text>
                  </TouchableOpacity>
                </View>
              )}
            />
          </ScrollView>
        )}
      </View>
    </ProtectedRoute>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: freightTheme.colors.background,
  },
  hero: {
    backgroundColor: "#111827",
    paddingTop: 62,
    paddingHorizontal: 20,
    paddingBottom: 26,
  },
  eyebrow: {
    color: "#10B981",
    fontWeight: "900",
    marginBottom: 8,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900",
    marginBottom: 10,
  },
  subtitle: {
    color: "#D1D5DB",
    lineHeight: 23,
    fontSize: 15,
  },
  navRow: {
    flexDirection: "row",
    gap: 10,
    padding: 18,
  },
  navButton: {
    flex: 1,
    backgroundColor: freightTheme.colors.primary,
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  navButtonOutline: {
    flex: 1,
    backgroundColor: freightTheme.colors.card,
    borderWidth: 1,
    borderColor: freightTheme.colors.primary,
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  navText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  navTextOutline: {
    color: freightTheme.colors.primary,
    fontWeight: "900",
  },
  loadingCard: {
    backgroundColor: freightTheme.colors.card,
    margin: 18,
    padding: 26,
    borderRadius: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
  },
  loadingText: {
    color: freightTheme.colors.mutedText,
    marginTop: 10,
    fontWeight: "800",
  },
  driverCard: {
    backgroundColor: freightTheme.colors.card,
    marginHorizontal: 18,
    marginBottom: 14,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
  },
  driverName: {
    color: freightTheme.colors.text,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 6,
  },
  driverMeta: {
    color: freightTheme.colors.mutedText,
    fontWeight: "700",
    lineHeight: 22,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: freightTheme.colors.card,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
    borderRadius: 18,
    padding: 14,
    alignItems: "center",
  },
  statValue: {
    color: freightTheme.colors.primary,
    fontSize: 25,
    fontWeight: "900",
  },
  statLabel: {
    color: freightTheme.colors.mutedText,
    fontWeight: "800",
    marginTop: 4,
  },
  earningsCard: {
    backgroundColor: "#064E3B",
    marginHorizontal: 18,
    marginBottom: 14,
    borderRadius: 20,
    padding: 18,
  },
  earningsLabel: {
    color: "#BBF7D0",
    fontWeight: "900",
    marginBottom: 6,
  },
  earningsValue: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "900",
  },
  refreshButton: {
    backgroundColor: "#334155",
    marginHorizontal: 18,
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
    color: freightTheme.colors.text,
    fontSize: 24,
    fontWeight: "900",
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  emptyCard: {
    backgroundColor: freightTheme.colors.card,
    marginHorizontal: 18,
    padding: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
  },
  emptyTitle: {
    color: freightTheme.colors.text,
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 6,
  },
  emptyText: {
    color: freightTheme.colors.mutedText,
    lineHeight: 22,
    fontWeight: "700",
  },
  loadCard: {
    backgroundColor: freightTheme.colors.card,
    marginHorizontal: 18,
    marginBottom: 16,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
  },
  loadHeader: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
    alignItems: "flex-start",
  },
  loadTitle: {
    color: freightTheme.colors.text,
    fontSize: 21,
    fontWeight: "900",
  },
  commodity: {
    color: freightTheme.colors.mutedText,
    fontWeight: "700",
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  statusText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 11,
  },
  routeBox: {
    backgroundColor: freightTheme.colors.surface,
    padding: 14,
    borderRadius: 16,
    marginBottom: 12,
  },
  routeText: {
    color: freightTheme.colors.text,
    fontWeight: "900",
    fontSize: 16,
  },
  arrow: {
    color: freightTheme.colors.primary,
    fontWeight: "900",
    fontSize: 20,
    marginVertical: 4,
  },
  metaText: {
    color: freightTheme.colors.mutedText,
    fontWeight: "700",
    marginBottom: 6,
    lineHeight: 21,
  },
  loadActions: {
    marginTop: 10,
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  acceptButton: {
    backgroundColor: freightTheme.colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  blueButton: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
  },
  orangeButton: {
    backgroundColor: "#F59E0B",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
  },
  greenButton: {
    backgroundColor: "#10B981",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
  },
  mapButton: {
    backgroundColor: "#334155",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
  },
  proofButton: {
    backgroundColor: "#7C3AED",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
  },
  actionText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  completedBadge: {
    backgroundColor: "#10B981",
    padding: 13,
    borderRadius: 14,
    alignItems: "center",
  },
  completedText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  chatButton: {
    backgroundColor: "#111827",
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 12,
  },
  chatText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
});