import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";

import { API_BASE_URL } from "../config/api";
import { supabase } from "../services/supabaseClient";

const COLORS = {
  primary: "#2E7D32",
  primaryDark: "#14532D",
  secondary: "#F9A825",
  background: "#F8FAF5",
  card: "#FFFFFF",
  text: "#172017",
  muted: "#75806F",
  border: "#E2E8DA",
  softGreen: "#EAF5E6",
  lightGreen: "#F1FAED",
  danger: "#DC2626",
  dark: "#111827",
};

type DriverLocation = {
  id?: string;
  load_id: string;
  driver_id?: string | null;
  carrier_id?: string | null;
  latitude: number;
  longitude: number;
  speed?: number | null;
  heading?: number | null;
  status?: string | null;
  updated_at?: string | null;
};

type CustomerOrder = {
  id: string;
  customerEmail?: string;
  customerName?: string;
  fulfillmentStatus?: string;
  paymentStatus?: string;
  assignedDriverId?: string;
  assignedFreightCarrierId?: string;
  deliveryInfo?: any;
  total?: number;
  createdAt?: string;
  updatedAt?: string;
};

export default function CustomerLiveMap() {
  const params = useLocalSearchParams();
  const orderIdParam = String(params.orderId || params.loadId || "");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [customerEmail, setCustomerEmail] = useState("");
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<CustomerOrder | null>(null);
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(
    null
  );

  useFocusEffect(
    useCallback(() => {
      loadLiveTracking();

      const channel = supabase
        .channel("customer-live-map-driver-location")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "driver_locations",
          },
          () => loadLiveTracking(false)
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }, [orderIdParam])
  );

  async function getCurrentCustomerEmail() {
    const raw =
      (await AsyncStorage.getItem("currentCustomer")) ||
      (await AsyncStorage.getItem("currentUser"));

    if (!raw) return "";

    try {
      const user = JSON.parse(raw);
      return String(user.email || "").trim().toLowerCase();
    } catch {
      return "";
    }
  }

  async function loadLiveTracking(showLoader = true) {
    try {
      if (showLoader) setLoading(true);

      const email = await getCurrentCustomerEmail();
      setCustomerEmail(email);

      const response = await fetch(`${API_BASE_URL}/orders`);
      const data = await response.json();

      const allOrders: CustomerOrder[] =
        response.ok && Array.isArray(data.orders) ? data.orders : [];

      const myOrders = allOrders.filter((order) => {
        if (orderIdParam) return order.id === orderIdParam;

        return (
          String(order.customerEmail || "").toLowerCase() === email ||
          String(order.deliveryInfo?.email || "").toLowerCase() === email
        );
      });

      setOrders(myOrders);

      const active =
        myOrders.find((order) =>
          ["ACCEPTED", "PICKED_UP", "IN_TRANSIT"].includes(
            String(order.fulfillmentStatus || "").toUpperCase()
          )
        ) ||
        myOrders[0] ||
        null;

      setSelectedOrder(active);

      if (active?.id) {
        const { data: locationData, error } = await supabase
          .from("driver_locations")
          .select("*")
          .eq("load_id", active.id)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.log("Customer live map location error:", error.message);
          setDriverLocation(null);
        } else if (locationData) {
          setDriverLocation({
            ...locationData,
            latitude: Number(locationData.latitude || 0),
            longitude: Number(locationData.longitude || 0),
            speed:
              locationData.speed === null || locationData.speed === undefined
                ? null
                : Number(locationData.speed),
            heading:
              locationData.heading === null ||
              locationData.heading === undefined
                ? null
                : Number(locationData.heading),
          });
        } else {
          setDriverLocation(null);
        }
      } else {
        setDriverLocation(null);
      }
    } catch (error) {
      console.log("Customer live map error:", error);
      Alert.alert("Live Map Error", "Unable to load live tracking.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function onRefresh() {
    setRefreshing(true);
    loadLiveTracking(false);
  }

  function friendlyStatus(value?: string | null) {
    return String(value || "waiting").replace(/_/g, " ");
  }

  function getFreshness() {
    if (!driverLocation?.updated_at) return "No GPS update yet";

    const minutes =
      (Date.now() - new Date(driverLocation.updated_at).getTime()) / 1000 / 60;

    if (minutes <= 5) return "Live now";
    if (minutes <= 30) return `${Math.round(minutes)} minutes ago`;
    return `GPS stale · ${Math.round(minutes)} minutes ago`;
  }

  function progressPercent() {
    const status = String(selectedOrder?.fulfillmentStatus || "").toUpperCase();

    if (status === "ACCEPTED") return 25;
    if (status === "PICKED_UP") return 55;
    if (status === "IN_TRANSIT") return 75;
    if (status === "DELIVERED") return 100;

    return driverLocation ? 35 : 10;
  }

  const trackingMessage = useMemo(() => {
    const status = String(selectedOrder?.fulfillmentStatus || "").toUpperCase();

    if (!selectedOrder) return "No active delivery selected.";
    if (!driverLocation) return "Driver GPS will appear after pickup begins.";
    if (status === "DELIVERED") return "Your order has been delivered.";
    if (status === "IN_TRANSIT") return "Your delivery is on the way.";
    if (status === "PICKED_UP") return "Your order has been picked up.";
    if (status === "ACCEPTED") return "A driver accepted your order.";

    return "Waiting for driver assignment.";
  }, [selectedOrder, driverLocation]);

  const progress = progressPercent();

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading live tracking...</Text>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.topBar}>
          <Pressable
            style={({ pressed }) => [styles.backCircle, pressed && styles.pressed]}
            onPress={() => router.push("/customer/orders" as any)}
          >
            <Text style={styles.backCircleText}>‹</Text>
          </Pressable>

          <View style={styles.topTitleBlock}>
            <Text style={styles.title}>Live Map</Text>
            <Text style={styles.subtitle}>Track your Farm2Home delivery</Text>
          </View>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroTextBlock}>
            <Text style={styles.heroBadge}>Customer Tracking</Text>
            <Text style={styles.heroTitle}>
              {selectedOrder
                ? friendlyStatus(selectedOrder.fulfillmentStatus)
                : "No Active Delivery"}
            </Text>
            <Text style={styles.heroText}>{trackingMessage}</Text>
          </View>

          <Text style={styles.heroEmoji}>🚚</Text>
        </View>

        <View style={styles.mapCard}>
          <View style={styles.mapMockHeader}>
            <Text style={styles.mapMockTitle}>Farm2Home Route</Text>
            <Text style={styles.mapMockStatus}>{getFreshness()}</Text>
          </View>

          <View style={styles.mapCanvas}>
            <View style={styles.routeLine} />

            <View style={[styles.routePoint, styles.pickupPoint]}>
              <Text style={styles.routePointText}>🌾</Text>
            </View>

            <View style={[styles.routePoint, styles.driverPoint]}>
              <Text style={styles.driverEmoji}>🚚</Text>
            </View>

            <View style={[styles.routePoint, styles.dropoffPoint]}>
              <Text style={styles.routePointText}>🏠</Text>
            </View>
          </View>

          {driverLocation ? (
            <View style={styles.gpsCard}>
              <Text style={styles.gpsTitle}>Live GPS Connected</Text>
              <Text style={styles.gpsText}>
                {driverLocation.latitude.toFixed(5)},{" "}
                {driverLocation.longitude.toFixed(5)}
              </Text>
              <Text style={styles.gpsSubtext}>
                Speed:{" "}
                {driverLocation.speed !== null &&
                driverLocation.speed !== undefined
                  ? `${Number(driverLocation.speed).toFixed(1)} m/s`
                  : "Not available"}
              </Text>
            </View>
          ) : (
            <View style={styles.gpsCard}>
              <Text style={styles.gpsTitle}>Waiting for Driver GPS</Text>
              <Text style={styles.gpsSubtext}>
                Live GPS appears after pickup begins.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <View>
              <Text style={styles.sectionTitle}>Delivery Progress</Text>
              <Text style={styles.progressSubtext}>{trackingMessage}</Text>
            </View>

            <View style={styles.progressBadge}>
              <Text style={styles.progressBadgeText}>{progress}%</Text>
            </View>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>

          <View style={styles.stepRow}>
            <Text style={styles.stepText}>Accepted</Text>
            <Text style={styles.stepText}>Pickup</Text>
            <Text style={styles.stepText}>Delivery</Text>
          </View>
        </View>

        {selectedOrder ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Current Order</Text>

            <View style={styles.infoTile}>
              <Text style={styles.infoLabel}>Order ID</Text>
              <Text style={styles.infoValue}>#{selectedOrder.id}</Text>
            </View>

            <View style={styles.infoTile}>
              <Text style={styles.infoLabel}>Status</Text>
              <Text style={styles.infoValue}>
                {friendlyStatus(selectedOrder.fulfillmentStatus)}
              </Text>
            </View>

            <View style={styles.infoTile}>
              <Text style={styles.infoLabel}>Payment</Text>
              <Text style={styles.infoValue}>
                {selectedOrder.paymentStatus || "Pending"}
              </Text>
            </View>

            <View style={styles.infoTile}>
              <Text style={styles.infoLabel}>Total</Text>
              <Text style={styles.infoValue}>
                ${Number(selectedOrder.total || 0).toFixed(2)}
              </Text>
            </View>

            <View style={styles.infoTile}>
              <Text style={styles.infoLabel}>Driver</Text>
              <Text style={styles.infoValue}>
                {selectedOrder.assignedDriverId || "Not assigned yet"}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>No Active Order</Text>
            <Text style={styles.infoValue}>
              Customer: {customerEmail || "Not signed in"}
            </Text>
          </View>
        )}

        <View style={styles.actionGrid}>
          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            onPress={() => loadLiveTracking()}
          >
            <Text style={styles.primaryButtonText}>Refresh Tracking</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            onPress={() => router.push("/customer/orders" as any)}
          >
            <Text style={styles.secondaryButtonText}>View My Orders</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            onPress={() => router.push("/customer/marketplace" as any)}
          >
            <Text style={styles.secondaryButtonText}>Back To Marketplace</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 18,
    paddingBottom: 80,
  },
  centered: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 10,
    color: COLORS.muted,
    fontWeight: "900",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
    gap: 12,
  },
  backCircle: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  backCircleText: {
    fontSize: 34,
    color: COLORS.text,
    fontWeight: "900",
    marginTop: -4,
  },
  topTitleBlock: {
    flex: 1,
  },
  title: {
    fontSize: 30,
    fontWeight: "900",
    color: COLORS.text,
  },
  subtitle: {
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 3,
  },
  heroCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 30,
    padding: 20,
    marginBottom: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroTextBlock: {
    flex: 1,
    paddingRight: 12,
  },
  heroBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.18)",
    color: "#FFFFFF",
    fontWeight: "900",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: 10,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 25,
    fontWeight: "900",
    lineHeight: 31,
    textTransform: "capitalize",
  },
  heroText: {
    color: "#EAF7E6",
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 8,
  },
  heroEmoji: {
    fontSize: 56,
  },
  mapCard: {
    backgroundColor: COLORS.card,
    borderRadius: 30,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  mapMockHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    gap: 10,
  },
  mapMockTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900",
  },
  mapMockStatus: {
    color: COLORS.primary,
    fontWeight: "900",
    fontSize: 12,
  },
  mapCanvas: {
    height: 230,
    borderRadius: 26,
    backgroundColor: COLORS.softGreen,
    overflow: "hidden",
    position: "relative",
    marginBottom: 14,
  },
  routeLine: {
    position: "absolute",
    left: 62,
    right: 62,
    top: 112,
    height: 6,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
    opacity: 0.8,
  },
  routePoint: {
    position: "absolute",
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: COLORS.primary,
  },
  pickupPoint: {
    left: 34,
    top: 86,
  },
  driverPoint: {
    left: "47%",
    top: 72,
    backgroundColor: COLORS.secondary,
    borderColor: COLORS.secondary,
  },
  dropoffPoint: {
    right: 34,
    top: 86,
  },
  routePointText: {
    fontSize: 28,
  },
  driverEmoji: {
    fontSize: 31,
  },
  gpsCard: {
    backgroundColor: COLORS.lightGreen,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  gpsTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 16,
  },
  gpsText: {
    color: COLORS.primary,
    fontWeight: "900",
    marginTop: 6,
  },
  gpsSubtext: {
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 5,
  },
  progressCard: {
    backgroundColor: COLORS.card,
    borderRadius: 30,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 21,
    fontWeight: "900",
    marginBottom: 10,
  },
  progressSubtext: {
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 20,
    maxWidth: 240,
  },
  progressBadge: {
    width: 62,
    height: 62,
    borderRadius: 22,
    backgroundColor: COLORS.softGreen,
    justifyContent: "center",
    alignItems: "center",
  },
  progressBadgeText: {
    color: COLORS.primary,
    fontWeight: "900",
    fontSize: 17,
  },
  progressTrack: {
    height: 13,
    backgroundColor: "#E5E7EB",
    borderRadius: 999,
    overflow: "hidden",
    marginTop: 16,
  },
  progressFill: {
    height: "100%",
    backgroundColor: COLORS.primary,
  },
  stepRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  stepText: {
    color: COLORS.muted,
    fontWeight: "800",
    fontSize: 12,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 30,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  infoTile: {
    backgroundColor: COLORS.lightGreen,
    borderRadius: 18,
    padding: 13,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  infoLabel: {
    color: COLORS.muted,
    fontWeight: "900",
    fontSize: 12,
    marginBottom: 4,
  },
  infoValue: {
    color: COLORS.text,
    fontWeight: "800",
    lineHeight: 21,
  },
  actionGrid: {
    gap: 10,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    padding: 16,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  secondaryButton: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 18,
    padding: 16,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: COLORS.primary,
    fontWeight: "900",
  },
  pressed: {
    opacity: 0.75,
  },
});