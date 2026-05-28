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

import { API_BASE_URL } from "../config/api";
import { supabase } from "../data/supabaseClient";
import freightTheme from "../styles/freightTheme";

type DriverLoad = any;

type DriverStats = {
  activeLoads: number;
  completedLoads: number;
  openLoads: number;
  earnings: number;
};

export default function MobileDriverApp() {
  const [loading, setLoading] = useState(false);
  const [driverId, setDriverId] = useState("");
  const [driverName, setDriverName] = useState("Farm2Home Driver");
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

  async function getCurrentDriver() {
    const raw =
      (await AsyncStorage.getItem("currentDriver")) ||
      (await AsyncStorage.getItem("currentUser"));

    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw);

      if (parsed?.role && parsed.role !== "driver") return null;

      const driver = {
        ...parsed,
        id: parsed.id || parsed.driverId || parsed.email || `driver_${Date.now()}`,
        driverId: parsed.driverId || parsed.id || parsed.email || `driver_${Date.now()}`,
        role: "driver",
        accountActive: parsed.accountActive !== false,
        membershipStatus: parsed.membershipStatus || "Active",
        subscriptionStatus: parsed.subscriptionStatus || "active",
      };

      await AsyncStorage.setItem("currentDriver", JSON.stringify(driver));
      await AsyncStorage.setItem("currentUser", JSON.stringify(driver));
      await AsyncStorage.setItem("userRole", "driver");
      await AsyncStorage.setItem("currentUserRole", "driver");

      return driver;
    } catch {
      return null;
    }
  }

  async function loadDriverDashboard() {
    try {
      setLoading(true);

      const currentDriver = await getCurrentDriver();

      if (!currentDriver) {
        Alert.alert("Driver Login Required", "Please login as a driver.");
        router.replace("/driver/login" as any);
        return;
      }

      const localDriverId =
        currentDriver.id || currentDriver.driverId || currentDriver.email || "";

      const localDriverName =
        currentDriver.fullName ||
        currentDriver.name ||
        currentDriver.driverName ||
        currentDriver.username ||
        "Farm2Home Driver";

      setDriverId(localDriverId);
      setDriverName(localDriverName);

      let backendOrders: DriverLoad[] = [];

      try {
        const response = await fetch(`${API_BASE_URL}/orders`);
        const data = await response.json();

        if (response.ok && Array.isArray(data.orders)) {
          backendOrders = data.orders.filter((order: any) => {
            const status = String(
              order.fulfillmentStatus || order.status || "NEW"
            ).toUpperCase();

            const assignedToMe =
              order.assignedDriverId === localDriverId ||
              order.driverId === localDriverId;

            const openForDriver =
              !order.assignedDriverId &&
              !order.driverId &&
              !order.assignedFreightCarrierId &&
              ["NEW", "OPEN", "AVAILABLE"].includes(status);

            return assignedToMe || openForDriver;
          });
        }
      } catch (error) {
        console.log("Backend orders skipped:", error);
      }

      const mappedBackendOrders: DriverLoad[] = backendOrders.map((order: any) => ({
        ...order,
        status: order.fulfillmentStatus || order.status || "OPEN",
        title: order.title || "Farm2Home Delivery Order",
        commodity: order.commodity || "Farm2Home Groceries",
        pickup_city:
          order.pickup_city ||
          order.pickupCity ||
          order.deliveryInfo?.pickupCity ||
          order.deliveryInfo?.farmCity ||
          order.pickupAddress ||
          "Pickup",
        pickup_state:
          order.pickup_state ||
          order.pickupState ||
          order.deliveryInfo?.pickupState ||
          "",
        delivery_city:
          order.delivery_city ||
          order.deliveryCity ||
          order.deliveryInfo?.city ||
          order.deliveryInfo?.deliveryCity ||
          order.dropoffAddress ||
          order.deliveryInfo?.address ||
          "Delivery",
        delivery_state:
          order.delivery_state ||
          order.deliveryState ||
          order.deliveryInfo?.state ||
          "",
        rate: Number(order.deliveryFee || order.rate || order.tip || 0),
      }));

      const allLoads = mappedBackendOrders;

      setLoads(allLoads);

      const activeStatuses = ["ACCEPTED", "BOOKED", "PICKED_UP", "IN_TRANSIT"];

      setStats({
        activeLoads: allLoads.filter((item) =>
          activeStatuses.includes(
            String(item.status || item.fulfillmentStatus || "").toUpperCase()
          )
        ).length,
        completedLoads: allLoads.filter(
          (item) =>
            String(item.status || item.fulfillmentStatus || "").toUpperCase() ===
            "DELIVERED"
        ).length,
        openLoads: allLoads.filter((item) =>
          ["OPEN", "NEW", "AVAILABLE"].includes(
            String(item.status || item.fulfillmentStatus || "").toUpperCase()
          )
        ).length,
        earnings: allLoads
          .filter(
            (item) =>
              String(item.status || item.fulfillmentStatus || "").toUpperCase() ===
              "DELIVERED"
          )
          .reduce((sum, item) => sum + Number(item.rate || item.total || 0), 0),
      });
    } catch (error) {
      console.log("Driver dashboard error:", error);
      Alert.alert("Load Error", "Unable to load driver dashboard.");
    } finally {
      setLoading(false);
    }
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
    try {
      const location = await requestLocation();

      if (!location) return;

      const payload = {
        load_id: loadId,
        driver_id: driverId,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        speed: location.coords.speed || null,
        status,
        updated_at: new Date().toISOString(),
      };

      const { data: existing } = await supabase
        .from("driver_locations")
        .select("*")
        .eq("load_id", loadId)
        .maybeSingle();

      if (existing?.id) {
        await supabase.from("driver_locations").update(payload).eq("id", existing.id);
      } else {
        await supabase.from("driver_locations").insert(payload);
      }
    } catch (error) {
      console.log("Save driver GPS skipped:", error);
    }
  }

  async function acceptLoad(load: DriverLoad) {
    try {
      setLoading(true);

      const currentDriver = await getCurrentDriver();

      const activeDriverId =
        currentDriver?.id || currentDriver?.driverId || driverId || "";

      const acceptedBy =
        currentDriver?.fullName ||
        currentDriver?.name ||
        currentDriver?.username ||
        "Farm2Home Driver";

      if (!activeDriverId) {
        Alert.alert("Driver Missing", "Please log in again.");
        return;
      }

      const response = await fetch(`${API_BASE_URL}/orders/${load.id}/accept`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driverId: activeDriverId,
          acceptedBy,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        Alert.alert("Accept Error", data.error || "Unable to accept order.");
        return;
      }

      await saveDriverGps(load.id, "READY");

      Alert.alert("Accepted", "This delivery is now assigned to you.");
      await loadDriverDashboard();
    } catch (error: any) {
      Alert.alert("Accept Error", error.message || "Unable to accept load.");
    } finally {
      setLoading(false);
    }
  }

  async function updateLoadStatus(
    load: DriverLoad,
    loadStatus: string,
    gpsStatus: string
  ) {
    try {
      setLoading(true);

      const response = await fetch(`${API_BASE_URL}/orders/${load.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: loadStatus,
          driverId,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        Alert.alert("Update Error", data.error || "Unable to update order.");
        return;
      }

      await saveDriverGps(load.id, gpsStatus);

      Alert.alert("Status Updated", `Delivery marked as ${loadStatus}.`);
      await loadDriverDashboard();
    } catch (error: any) {
      Alert.alert("Update Error", error.message || "Unable to update load.");
    } finally {
      setLoading(false);
    }
  }

  function normalizeStatus(load: DriverLoad) {
    return String(load.status || load.fulfillmentStatus || "OPEN").toUpperCase();
  }

  function statusColor(status?: string) {
    switch (String(status || "").toUpperCase()) {
      case "OPEN":
      case "NEW":
      case "AVAILABLE":
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
    const status = normalizeStatus(load);

    if (["OPEN", "NEW", "AVAILABLE"].includes(status)) {
      return (
        <TouchableOpacity style={styles.acceptButton} onPress={() => acceptLoad(load)}>
          <Text style={styles.actionText}>Accept Delivery</Text>
        </TouchableOpacity>
      );
    }

    if (status === "BOOKED" || status === "ACCEPTED") {
      return (
        <View style={styles.actionGrid}>
          <TouchableOpacity
            style={styles.blueButton}
            onPress={() =>
              updateLoadStatus(load, "ACCEPTED", "EN_ROUTE_TO_PICKUP")
            }
          >
            <Text style={styles.actionText}>Start Pickup</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.orangeButton}
            onPress={() =>
              updateLoadStatus(load, "ACCEPTED", "ARRIVED_AT_PICKUP")
            }
          >
            <Text style={styles.actionText}>Arrived Pickup</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.greenButton}
            onPress={() => updateLoadStatus(load, "PICKED_UP", "PICKED_UP")}
          >
            <Text style={styles.actionText}>Picked Up</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (status === "PICKED_UP") {
      return (
        <View style={styles.actionGrid}>
          <TouchableOpacity
            style={styles.blueButton}
            onPress={() =>
              updateLoadStatus(load, "IN_TRANSIT", "EN_ROUTE_TO_DROPOFF")
            }
          >
            <Text style={styles.actionText}>Start Delivery</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.mapButton}
            onPress={() =>
              router.push({
                pathname: "/driver/navigation-assistant",
                params: { loadId: load.id },
              } as any)
            }
          >
            <Text style={styles.actionText}>Navigation</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (status === "IN_TRANSIT") {
      return (
        <View style={styles.actionGrid}>
          <TouchableOpacity
            style={styles.orangeButton}
            onPress={() =>
              updateLoadStatus(load, "IN_TRANSIT", "ARRIVED_AT_DROPOFF")
            }
          >
            <Text style={styles.actionText}>Arrived Dropoff</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.greenButton}
            onPress={() => updateLoadStatus(load, "DELIVERED", "DELIVERED")}
          >
            <Text style={styles.actionText}>Delivered</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.proofButton}
            onPress={() =>
              router.push({
                pathname: "/driver/proof-of-delivery",
                params: { loadId: load.id },
              } as any)
            }
          >
            <Text style={styles.actionText}>Proof</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (status === "DELIVERED") {
      return (
        <View style={styles.completedBadge}>
          <Text style={styles.completedText}>Completed</Text>
        </View>
      );
    }

    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Farm2Home Driver</Text>
        <Text style={styles.title}>Mobile Driver App</Text>
        <Text style={styles.subtitle}>
          Accept orders, update GPS, manage pickups, complete deliveries, and
          track your driver earnings.
        </Text>
      </View>

      <View style={styles.navRow}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => router.push("/driver/board" as any)}
        >
          <Text style={styles.navText}>Driver Board</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButtonOutline}
          onPress={() => router.push("/driver/profile" as any)}
        >
          <Text style={styles.navTextOutline}>Profile</Text>
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
            <Text style={styles.driverName}>🚚 {driverName}</Text>
            <Text style={styles.driverMeta}>
              Manage active Farm2Home orders and delivery workflow.
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
            <Text style={styles.earningsLabel}>Completed Delivery Earnings</Text>
            <Text style={styles.earningsValue}>${stats.earnings.toFixed(2)}</Text>
          </View>

          <TouchableOpacity style={styles.refreshButton} onPress={loadDriverDashboard}>
            <Text style={styles.refreshText}>Refresh Deliveries</Text>
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>Available & Assigned Deliveries</Text>

          <FlatList
            data={loads}
            keyExtractor={(item) => String(item.id)}
            scrollEnabled={false}
            contentContainerStyle={{ paddingBottom: 100 }}
            ListEmptyComponent={
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No deliveries available.</Text>
                <Text style={styles.emptyText}>
                  Tap Driver Board to select available deliveries in your area.
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const status = normalizeStatus(item);

              return (
                <View style={styles.loadCard}>
                  <View style={styles.loadHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.loadTitle}>
                        {item.title || "Farm2Home Delivery"}
                      </Text>
                      <Text style={styles.commodity}>
                        {item.commodity || "Farm Goods"}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: statusColor(status) },
                      ]}
                    >
                      <Text style={styles.statusText}>{status}</Text>
                    </View>
                  </View>

                  <View style={styles.routeBox}>
                    <Text style={styles.routeText}>
                      📍 {item.pickup_city || item.pickupAddress || "Pickup"}{" "}
                      {item.pickup_state || ""}
                    </Text>

                    <Text style={styles.arrow}>→</Text>

                    <Text style={styles.routeText}>
                      🏁{" "}
                      {item.delivery_city ||
                        item.dropoffAddress ||
                        item.deliveryInfo?.address ||
                        "Delivery"}{" "}
                      {item.delivery_state || ""}
                    </Text>
                  </View>

                  <Text style={styles.metaText}>
                    Rate: ${Number(item.rate || item.deliveryFee || 0).toFixed(2)}
                  </Text>

                  <View style={styles.loadActions}>{renderActions(item)}</View>
                </View>
              );
            }}
          />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: freightTheme.colors.background },
  hero: {
    backgroundColor: "#111827",
    paddingTop: 62,
    paddingHorizontal: 20,
    paddingBottom: 26,
  },
  eyebrow: { color: "#10B981", fontWeight: "900", marginBottom: 8 },
  title: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900",
    marginBottom: 10,
  },
  subtitle: { color: "#D1D5DB", lineHeight: 23, fontSize: 15 },
  navRow: { flexDirection: "row", gap: 10, padding: 18 },
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
  navText: { color: "#FFFFFF", fontWeight: "900" },
  navTextOutline: { color: freightTheme.colors.primary, fontWeight: "900" },
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
  earningsLabel: { color: "#BBF7D0", fontWeight: "900", marginBottom: 6 },
  earningsValue: { color: "#FFFFFF", fontSize: 30, fontWeight: "900" },
  refreshButton: {
    backgroundColor: "#334155",
    marginHorizontal: 18,
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 18,
  },
  refreshText: { color: "#FFFFFF", fontWeight: "900" },
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
  statusText: { color: "#FFFFFF", fontWeight: "900", fontSize: 11 },
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
  loadActions: { marginTop: 10 },
  actionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
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
  actionText: { color: "#FFFFFF", fontWeight: "900" },
  completedBadge: {
    backgroundColor: "#10B981",
    padding: 13,
    borderRadius: 14,
    alignItems: "center",
  },
  completedText: { color: "#FFFFFF", fontWeight: "900" },
});