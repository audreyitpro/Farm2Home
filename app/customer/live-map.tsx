import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";

import { API_BASE_URL } from "../config/api";
import { supabase } from "../services/supabaseClient";

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

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1F7A3F" />
        <Text style={styles.loadingText}>Loading live tracking...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text style={styles.kicker}>Farm2Home Customer</Text>
      <Text style={styles.title}>Live Delivery Map</Text>
      <Text style={styles.subtitle}>
        Track your Farm2Home delivery, driver GPS, and order progress.
      </Text>

      <View style={styles.mapBox}>
        <Text style={styles.mapIcon}>🗺️</Text>
        <Text style={styles.mapTitle}>Live GPS Tracking</Text>
        <Text style={styles.mapSubtitle}>{trackingMessage}</Text>

        {driverLocation ? (
          <>
            <Text style={styles.gpsText}>
              Driver GPS: {driverLocation.latitude.toFixed(5)},{" "}
              {driverLocation.longitude.toFixed(5)}
            </Text>
            <Text style={styles.gpsText}>Signal: {getFreshness()}</Text>
          </>
        ) : (
          <Text style={styles.gpsText}>No driver GPS yet.</Text>
        )}
      </View>

      {selectedOrder ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Current Order</Text>
          <Text style={styles.metaText}>Order: #{selectedOrder.id}</Text>
          <Text style={styles.metaText}>
            Status: {friendlyStatus(selectedOrder.fulfillmentStatus)}
          </Text>
          <Text style={styles.metaText}>
            Payment: {selectedOrder.paymentStatus || "Pending"}
          </Text>
          <Text style={styles.metaText}>
            Total: ${Number(selectedOrder.total || 0).toFixed(2)}
          </Text>
          <Text style={styles.metaText}>
            Driver: {selectedOrder.assignedDriverId || "Not assigned yet"}
          </Text>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>No Active Order</Text>
          <Text style={styles.metaText}>
            Customer: {customerEmail || "Not signed in"}
          </Text>
        </View>
      )}

      <TouchableOpacity style={styles.primaryButton} onPress={() => loadLiveTracking()}>
        <Text style={styles.primaryButtonText}>Refresh Tracking</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => router.push("/customer/orders" as any)}
      >
        <Text style={styles.secondaryButtonText}>View My Orders</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => router.push("/customer/marketplace" as any)}
      >
        <Text style={styles.secondaryButtonText}>Back To Marketplace</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F7F2" },
  content: { padding: 20, paddingBottom: 80 },
  centered: {
    flex: 1,
    backgroundColor: "#F7F7F2",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: { marginTop: 10, color: "#374151", fontWeight: "800" },
  kicker: {
    color: "#1F7A3F",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    color: "#064E3B",
    marginTop: 6,
  },
  subtitle: {
    color: "#4B5563",
    fontWeight: "700",
    lineHeight: 22,
    marginTop: 8,
    marginBottom: 18,
  },
  mapBox: {
    backgroundColor: "#DDEFE4",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#B7DFB9",
  },
  mapIcon: { fontSize: 58, marginBottom: 12 },
  mapTitle: {
    fontSize: 25,
    fontWeight: "900",
    color: "#111827",
    textAlign: "center",
  },
  mapSubtitle: {
    color: "#374151",
    fontWeight: "700",
    lineHeight: 22,
    textAlign: "center",
    marginTop: 8,
  },
  gpsText: {
    color: "#064E3B",
    fontWeight: "900",
    marginTop: 8,
    textAlign: "center",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#111827",
    marginBottom: 8,
  },
  metaText: {
    color: "#374151",
    fontWeight: "700",
    marginBottom: 6,
    lineHeight: 21,
  },
  primaryButton: {
    backgroundColor: "#1F7A3F",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    marginBottom: 10,
  },
  primaryButtonText: { color: "#FFFFFF", fontWeight: "900" },
  secondaryButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#1F7A3F",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    marginBottom: 10,
  },
  secondaryButtonText: { color: "#1F7A3F", fontWeight: "900" },
});