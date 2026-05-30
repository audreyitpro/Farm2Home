// app/driver/mobile-driver-app-production.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
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
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

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

type DriverProfile = {
  id: string;
  driverId: string;
  email?: string;
  fullName?: string;
  name?: string;
  driverName?: string;
  username?: string;
  role: "driver";
  accountActive: boolean;
  membershipStatus: string;
  subscriptionStatus: string;
};

const ACTIVE_STATUSES = [
  "ACCEPTED",
  "BOOKED",
  "READY",
  "EN_ROUTE_TO_PICKUP",
  "ARRIVED_AT_PICKUP",
  "PICKED_UP",
  "IN_TRANSIT",
  "EN_ROUTE_TO_DROPOFF",
  "ARRIVED_AT_DROPOFF",
];

const OPEN_STATUSES = ["OPEN", "NEW", "AVAILABLE"];

export default function MobileDriverAppProduction() {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
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
    useCallback(() => {
      loadDriverDashboard();
    }, [])
  );

  const activeDriverLoads = useMemo(() => {
    return loads.filter((load) => ACTIVE_STATUSES.includes(normalizeStatus(load)));
  }, [loads]);

  async function getCurrentDriver(): Promise<DriverProfile | null> {
    const raw =
      (await AsyncStorage.getItem("currentDriver")) ||
      (await AsyncStorage.getItem("currentUser"));

    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw);

      if (parsed?.role && parsed.role !== "driver") return null;

      const stableId =
        parsed.id ||
        parsed.driverId ||
        parsed.email ||
        parsed.username ||
        `driver_${Date.now()}`;

      const driver: DriverProfile = {
        ...parsed,
        id: stableId,
        driverId: parsed.driverId || stableId,
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
              OPEN_STATUSES.includes(status);

            return assignedToMe || openForDriver;
          });
        }
      } catch (error) {
        console.log("Backend orders skipped:", error);
      }

      const mappedBackendOrders: DriverLoad[] = backendOrders.map((order: any) => ({
        ...order,
        id: order.id || order.orderId || order.loadId,
        status: order.fulfillmentStatus || order.status || "OPEN",
        title: order.title || order.orderTitle || "Farm2Home Delivery Order",
        commodity: order.commodity || order.itemsSummary || "Farm2Home Groceries",
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
        pickupAddress:
          order.pickupAddress ||
          order.deliveryInfo?.pickupAddress ||
          order.deliveryInfo?.farmAddress ||
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
        dropoffAddress:
          order.dropoffAddress ||
          order.deliveryInfo?.address ||
          order.deliveryInfo?.deliveryAddress ||
          "",
        rate: Number(order.deliveryFee || order.rate || order.tip || 0),
        customerName:
          order.customerName ||
          order.customer?.name ||
          order.deliveryInfo?.name ||
          "Farm2Home Customer",
        customerPhone:
          order.customerPhone ||
          order.customer?.phone ||
          order.deliveryInfo?.phone ||
          "",
        notes:
          order.notes ||
          order.deliveryNotes ||
          order.deliveryInfo?.notes ||
          order.specialInstructions ||
          "",
      }));

      setLoads(mappedBackendOrders);

      setStats({
        activeLoads: mappedBackendOrders.filter((item) =>
          ACTIVE_STATUSES.includes(normalizeStatus(item))
        ).length,
        completedLoads: mappedBackendOrders.filter(
          (item) => normalizeStatus(item) === "DELIVERED"
        ).length,
        openLoads: mappedBackendOrders.filter((item) =>
          OPEN_STATUSES.includes(normalizeStatus(item))
        ).length,
        earnings: mappedBackendOrders
          .filter((item) => normalizeStatus(item) === "DELIVERED")
          .reduce((sum, item) => sum + Number(item.rate || item.total || 0), 0),
      });
    } catch (error) {
      console.log("Driver dashboard error:", error);
      Alert.alert("Load Error", "Unable to load driver dashboard.");
    } finally {
      setLoading(false);
    }
  }

  async function refreshDashboard() {
    setRefreshing(true);
    await loadDriverDashboard();
    setRefreshing(false);
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

      Alert.alert("Status Updated", `Delivery marked as ${formatStatus(loadStatus)}.`);
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
      case "READY":
        return "#7C3AED";
      case "EN_ROUTE_TO_PICKUP":
      case "ARRIVED_AT_PICKUP":
        return "#0EA5E9";
      case "PICKED_UP":
        return "#F59E0B";
      case "IN_TRANSIT":
      case "EN_ROUTE_TO_DROPOFF":
      case "ARRIVED_AT_DROPOFF":
        return "#0F766E";
      case "DELIVERED":
        return "#10B981";
      case "CANCELLED":
        return "#DC2626";
      default:
        return "#64748B";
    }
  }

  function formatStatus(status?: string) {
    return String(status || "OPEN")
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function openMap(address?: string) {
    if (!address) {
      Alert.alert("Address Missing", "No address is available for this stop.");
      return;
    }

    const encoded = encodeURIComponent(address);
    const url =
      Platform.OS === "ios"
        ? `http://maps.apple.com/?q=${encoded}`
        : `https://www.google.com/maps/search/?api=1&query=${encoded}`;

    Linking.openURL(url).catch(() => {
      Alert.alert("Map Error", "Unable to open maps on this device.");
    });
  }

  function callCustomer(phone?: string) {
    if (!phone) {
      Alert.alert("Phone Missing", "No customer phone number is available.");
      return;
    }

    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert("Call Error", "Unable to call from this device.");
    });
  }

  function renderActions(load: DriverLoad) {
    const status = normalizeStatus(load);

    if (OPEN_STATUSES.includes(status)) {
      return (
        <TouchableOpacity
          style={styles.acceptButton}
          onPress={() => acceptLoad(load)}
          disabled={loading}
        >
          <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
          <Text style={styles.actionText}>Accept Delivery</Text>
        </TouchableOpacity>
      );
    }

    if (status === "BOOKED" || status === "ACCEPTED" || status === "READY") {
      return (
        <View style={styles.actionGrid}>
          <TouchableOpacity
            style={styles.blueButton}
            onPress={() =>
              updateLoadStatus(load, "ACCEPTED", "EN_ROUTE_TO_PICKUP")
            }
            disabled={loading}
          >
            <Text style={styles.actionText}>Start Pickup</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.orangeButton}
            onPress={() =>
              updateLoadStatus(load, "ACCEPTED", "ARRIVED_AT_PICKUP")
            }
            disabled={loading}
          >
            <Text style={styles.actionText}>Arrived Pickup</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.greenButton}
            onPress={() => {
              router.push({
                pathname: "/driver/proof-of-pickup",
                params: { loadId: load.id, orderId: load.id },
              } as any);
            }}
            disabled={loading}
          >
            <Text style={styles.actionText}>Proof Pickup</Text>
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
            disabled={loading}
          >
            <Text style={styles.actionText}>Start Delivery</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.mapButton}
            onPress={() =>
              router.push({
                pathname: "/driver/navigation-assistant",
                params: { loadId: load.id, orderId: load.id },
              } as any)
            }
            disabled={loading}
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
            disabled={loading}
          >
            <Text style={styles.actionText}>Arrived Dropoff</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.proofButton}
            onPress={() =>
              router.push({
                pathname: "/driver/proof-of-delivery",
                params: { loadId: load.id, orderId: load.id },
              } as any)
            }
            disabled={loading}
          >
            <Text style={styles.actionText}>Proof Delivery</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (status === "DELIVERED") {
      return (
        <View style={styles.completedBadge}>
          <Ionicons name="checkmark-done-circle" size={18} color="#FFFFFF" />
          <Text style={styles.completedText}>Completed</Text>
        </View>
      );
    }

    return null;
  }

  function renderLoadCard({ item }: { item: DriverLoad }) {
    const status = normalizeStatus(item);
    const pickupText = `${item.pickup_city || item.pickupAddress || "Pickup"} ${
      item.pickup_state || ""
    }`.trim();
    const deliveryText = `${
      item.delivery_city ||
      item.dropoffAddress ||
      item.deliveryInfo?.address ||
      "Delivery"
    } ${item.delivery_state || ""}`.trim();

    return (
      <View style={styles.loadCard}>
        <View style={styles.loadHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.loadTitle}>
              {item.title || "Farm2Home Delivery"}
            </Text>
            <Text style={styles.commodity}>{item.commodity || "Farm Goods"}</Text>
          </View>

          <View
            style={[
              styles.statusBadge,
              { backgroundColor: statusColor(status) },
            ]}
          >
            <Text style={styles.statusText}>{formatStatus(status)}</Text>
          </View>
        </View>

        <View style={styles.routeBox}>
          <TouchableOpacity
            style={styles.routeStop}
            onPress={() => openMap(item.pickupAddress || pickupText)}
          >
            <Ionicons name="radio-button-on" size={18} color="#10B981" />
            <View style={{ flex: 1 }}>
              <Text style={styles.routeLabel}>Pickup</Text>
              <Text style={styles.routeText}>{pickupText}</Text>
              {!!item.pickupAddress && (
                <Text style={styles.routeSubText}>{item.pickupAddress}</Text>
              )}
            </View>
            <Ionicons name="open-outline" size={17} color="#94A3B8" />
          </TouchableOpacity>

          <View style={styles.routeLine} />

          <TouchableOpacity
            style={styles.routeStop}
            onPress={() => openMap(item.dropoffAddress || deliveryText)}
          >
            <Ionicons name="location" size={18} color="#10B981" />
            <View style={{ flex: 1 }}>
              <Text style={styles.routeLabel}>Dropoff</Text>
              <Text style={styles.routeText}>{deliveryText}</Text>
              {!!item.dropoffAddress && (
                <Text style={styles.routeSubText}>{item.dropoffAddress}</Text>
              )}
            </View>
            <Ionicons name="open-outline" size={17} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        <View style={styles.metaGrid}>
          <View style={styles.metaPill}>
            <Ionicons name="cash-outline" size={15} color="#10B981" />
            <Text style={styles.metaText}>
              ${Number(item.rate || item.deliveryFee || 0).toFixed(2)}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.metaPill}
            onPress={() => callCustomer(item.customerPhone)}
          >
            <Ionicons name="call-outline" size={15} color="#10B981" />
            <Text style={styles.metaText}>Customer</Text>
          </TouchableOpacity>

          <View style={styles.metaPill}>
            <Ionicons name="cube-outline" size={15} color="#10B981" />
            <Text style={styles.metaText}>{formatStatus(status)}</Text>
          </View>
        </View>

        {!!item.notes && (
          <View style={styles.notesBox}>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text style={styles.notesText}>{item.notes}</Text>
          </View>
        )}

        <View style={styles.loadActions}>{renderActions(item)}</View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#020617" />

      <View style={styles.container}>
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>Farm2Home Driver</Text>
              <Text style={styles.title}>Mobile Driver App</Text>
              <Text style={styles.subtitle}>
                Accept orders, update GPS, manage pickups, complete deliveries,
                and track your driver earnings.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.profileCircle}
              onPress={() => router.push("/driver/profile" as any)}
            >
              <Ionicons name="person-circle-outline" size={34} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.navRow}>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => router.push("/driver/board" as any)}
          >
            <Ionicons name="list-outline" size={18} color="#FFFFFF" />
            <Text style={styles.navText}>Driver Board</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navButtonOutline}
            onPress={() => router.push("/driver/profile" as any)}
          >
            <Ionicons
              name="person-outline"
              size={18}
              color={freightTheme.colors.primary}
            />
            <Text style={styles.navTextOutline}>Profile</Text>
          </TouchableOpacity>
        </View>

        {loading && loads.length === 0 ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={freightTheme.colors.primary} />
            <Text style={styles.loadingText}>Loading driver app...</Text>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={refreshDashboard} />
            }
          >
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
              <View>
                <Text style={styles.earningsLabel}>Completed Delivery Earnings</Text>
                <Text style={styles.earningsValue}>
                  ${stats.earnings.toFixed(2)}
                </Text>
              </View>
              <Ionicons name="wallet-outline" size={34} color="#BBF7D0" />
            </View>

            {activeDriverLoads.length > 0 && (
              <View style={styles.activeNotice}>
                <Ionicons name="navigate-circle-outline" size={20} color="#10B981" />
                <Text style={styles.activeNoticeText}>
                  You have {activeDriverLoads.length} active delivery workflow
                  {activeDriverLoads.length > 1 ? "s" : ""}.
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.refreshButton}
              onPress={loadDriverDashboard}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="refresh-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.refreshText}>Refresh Deliveries</Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.sectionTitle}>Available & Assigned Deliveries</Text>

            <FlatList
              data={loads}
              keyExtractor={(item, index) => String(item.id || index)}
              scrollEnabled={false}
              contentContainerStyle={{ paddingBottom: 110 }}
              ListEmptyComponent={
                <View style={styles.emptyCard}>
                  <Ionicons name="leaf-outline" size={34} color="#10B981" />
                  <Text style={styles.emptyTitle}>No deliveries available.</Text>
                  <Text style={styles.emptyText}>
                    Tap Driver Board to select available deliveries in your area.
                  </Text>
                  <TouchableOpacity
                    style={styles.emptyButton}
                    onPress={() => router.push("/driver/board" as any)}
                  >
                    <Text style={styles.emptyButtonText}>Open Driver Board</Text>
                  </TouchableOpacity>
                </View>
              }
              renderItem={renderLoadCard}
            />
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: freightTheme.colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: freightTheme.colors.background,
  },
  hero: {
    backgroundColor: "#020617",
    paddingTop: 18,
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  profileCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#064E3B",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#10B981",
  },
  eyebrow: {
    color: "#10B981",
    fontWeight: "900",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
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
    fontWeight: "600",
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
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  navButtonOutline: {
    flex: 1,
    backgroundColor: freightTheme.colors.card,
    borderWidth: 1,
    borderColor: freightTheme.colors.primary,
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  activeNotice: {
    backgroundColor: "#052E2B",
    marginHorizontal: 18,
    marginBottom: 14,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#0F766E",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  activeNoticeText: {
    color: "#CCFBF1",
    fontWeight: "800",
    flex: 1,
    lineHeight: 20,
  },
  refreshButton: {
    backgroundColor: "#334155",
    marginHorizontal: 18,
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
    flexDirection: "row",
    gap: 8,
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
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
    alignItems: "center",
  },
  emptyTitle: {
    color: freightTheme.colors.text,
    fontSize: 20,
    fontWeight: "900",
    marginTop: 10,
    marginBottom: 6,
  },
  emptyText: {
    color: freightTheme.colors.mutedText,
    lineHeight: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  emptyButton: {
    backgroundColor: freightTheme.colors.primary,
    marginTop: 16,
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 14,
  },
  emptyButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
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
    maxWidth: 150,
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
  routeStop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  routeLine: {
    width: 2,
    height: 24,
    backgroundColor: freightTheme.colors.border,
    marginLeft: 8,
    marginVertical: 8,
  },
  routeLabel: {
    color: freightTheme.colors.primary,
    fontWeight: "900",
    fontSize: 12,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  routeText: {
    color: freightTheme.colors.text,
    fontWeight: "900",
    fontSize: 16,
  },
  routeSubText: {
    color: freightTheme.colors.mutedText,
    marginTop: 2,
    fontWeight: "600",
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  metaPill: {
    backgroundColor: freightTheme.colors.surface,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    color: freightTheme.colors.mutedText,
    fontWeight: "800",
    lineHeight: 21,
  },
  notesBox: {
    backgroundColor: "#0F172A",
    borderRadius: 14,
    padding: 13,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#1E293B",
  },
  notesLabel: {
    color: freightTheme.colors.primary,
    fontWeight: "900",
    marginBottom: 5,
  },
  notesText: {
    color: "#E5E7EB",
    fontWeight: "700",
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
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
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
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  completedText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
});