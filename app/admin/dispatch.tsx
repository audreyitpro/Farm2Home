import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";

import ProtectedRoute from "../components/ProtectedRoute";
import { supabase } from "../data/supabaseClient";

type Driver = {
  id: string;
  name: string;
  vehicle: string;
  region: string;
  status: string;
};

type DispatchOrder = {
  id: string;
  customer_name?: string;
  customer_email?: string;
  status?: string;
  total?: number;
  created_at?: string;
  delivery_info?: {
    deliveryOption?: string;
    deliveryAddress?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    phone?: string;
  };
};

const fallbackDrivers: Driver[] = [
  {
    id: "driver001",
    name: "ASO Freight Driver 1",
    vehicle: "Cargo Van",
    region: "Detroit Metro",
    status: "READY",
  },
  {
    id: "driver002",
    name: "ASO Freight Driver 2",
    vehicle: "SUV",
    region: "Sterling Heights",
    status: "READY",
  },
  {
    id: "driver003",
    name: "ASO Freight Driver 3",
    vehicle: "Refrigerated Van",
    region: "Macomb County",
    status: "READY",
  },
];

export default function DispatchDashboard() {
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<DispatchOrder[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>(fallbackDrivers);

  useFocusEffect(
    useCallback(() => {
      loadDispatchData();
    }, [])
  );

  async function loadDispatchData() {
    try {
      setLoading(true);

      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });

      if (ordersError) {
        throw ordersError;
      }

      const { data: driversData, error: driversError } = await supabase
        .from("driver_locations")
        .select("*");

      if (driversError) {
        console.log("Driver locations unavailable:", driversError);
      }

      const deliveryOrders =
        ordersData?.filter((order: any) => {
          const deliveryInfo = order.delivery_info || order.deliveryInfo || {};

          const deliveryOption = String(
            deliveryInfo.deliveryOption ||
              deliveryInfo.delivery_option ||
              order.delivery_option ||
              ""
          ).toLowerCase();

          const status = String(order.status || "").toUpperCase();

          return (
            deliveryOption === "delivery" &&
            !["COMPLETED", "DELIVERED", "CANCELED", "CANCELLED"].includes(
              status
            )
          );
        }) || [];

      const activeDrivers =
        driversData && driversData.length > 0
          ? driversData.map((driver: any) => ({
              id: String(driver.id || driver.driver_id || cryptoRandomId()),
              name:
                driver.driver_name ||
                driver.name ||
                driver.email ||
                "ASO Freight Driver",
              vehicle: driver.vehicle_type || driver.vehicle || "Vehicle",
              region: driver.region || driver.current_region || "Available",
              status: String(driver.status || "READY").toUpperCase(),
            }))
          : fallbackDrivers;

      setOrders(deliveryOrders);
      setDrivers(activeDrivers);
    } catch (error) {
      console.log("Dispatch dashboard error:", error);
      Alert.alert("Dispatch Error", "Unable to load dispatch orders.");
    } finally {
      setLoading(false);
    }
  }

  async function assignDriver(orderId: string, driver: Driver) {
    try {
      setLoading(true);

      const { error } = await supabase
        .from("orders")
        .update({
          status: "PREPARING",
          assigned_driver_id: driver.id,
          assigned_driver_name: driver.name,
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      if (error) {
        throw error;
      }

      Alert.alert(
        "Driver Assigned",
        `${driver.name} assigned to order #${orderId.slice(-6)}`
      );

      await loadDispatchData();
    } catch (error) {
      console.log("Assign driver error:", error);
      Alert.alert("Assign Driver Error", "Unable to assign driver.");
    } finally {
      setLoading(false);
    }
  }

  function getDeliveryInfo(order: any) {
    return order.delivery_info || order.deliveryInfo || {};
  }

  function cryptoRandomId() {
    return `driver-${Math.random().toString(36).slice(2, 10)}`;
  }

  function formatDate(value?: string) {
    if (!value) return "No date";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "No date";
    }

    return date.toLocaleDateString();
  }

  function statusColor(status?: string) {
    const value = String(status || "").toUpperCase();

    if (["PREPARING", "ASSIGNED"].includes(value)) return "#2563EB";
    if (["PENDING", "PAID"].includes(value)) return "#F59E0B";
    if (["PICKED_UP", "IN_TRANSIT", "EN_ROUTE"].includes(value)) return "#7C3AED";

    return "#10B981";
  }

  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>ASO Freight</Text>
          <Text style={styles.title}>Dispatch</Text>
          <Text style={styles.subtitle}>
            Assign delivery drivers, manage active orders, and coordinate
            Farm2Home logistics.
          </Text>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.primaryAction}
            onPress={() => router.push("/admin/dashboard")}
          >
            <Text style={styles.primaryActionText}>Admin Dashboard</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryAction}
            onPress={() => router.push("/admin/fleet-map")}
          >
            <Text style={styles.secondaryActionText}>Fleet Map</Text>
          </TouchableOpacity>
        </View>

        {loading && orders.length === 0 ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color="#2F7D32" />
            <Text style={styles.loadingText}>Loading dispatch center...</Text>
          </View>
        ) : (
          <FlatList
            data={orders}
            keyExtractor={(item, index) => item.id || String(index)}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={loading} onRefresh={loadDispatchData} />
            }
            ListHeaderComponent={
              <View style={styles.summaryRow}>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryValue}>{orders.length}</Text>
                  <Text style={styles.summaryLabel}>Delivery Orders</Text>
                </View>

                <View style={styles.summaryCard}>
                  <Text style={styles.summaryValue}>{drivers.length}</Text>
                  <Text style={styles.summaryLabel}>Drivers</Text>
                </View>
              </View>
            }
            ListEmptyComponent={
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No delivery orders</Text>
                <Text style={styles.emptyText}>
                  Delivery orders will appear here after customers choose
                  delivery at checkout.
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const delivery = getDeliveryInfo(item);

              return (
                <View style={styles.orderCard}>
                  <View style={styles.orderTop}>
                    <View>
                      <Text style={styles.orderId}>
                        Order #{item.id?.slice(-6) || "N/A"}
                      </Text>

                      <Text style={styles.customer}>
                        {item.customer_name || item.customer_email || "Customer"}
                      </Text>

                      <Text style={styles.dateText}>
                        {formatDate(item.created_at)}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: statusColor(item.status) },
                      ]}
                    >
                      <Text style={styles.statusText}>
                        {item.status || "NEW"}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.addressBox}>
                    <Text style={styles.addressTitle}>Delivery Address</Text>

                    <Text style={styles.addressText}>
                      {delivery.deliveryAddress ||
                        delivery.delivery_address ||
                        "No address provided"}
                    </Text>

                    <Text style={styles.addressText}>
                      {delivery.city || "City"}, {delivery.state || "State"}{" "}
                      {delivery.zipCode || delivery.zip_code || ""}
                    </Text>

                    <Text style={styles.phoneText}>
                      Phone: {delivery.phone || "N/A"}
                    </Text>
                  </View>

                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Order Total</Text>
                    <Text style={styles.totalValue}>
                      ${Number(item.total || 0).toFixed(2)}
                    </Text>
                  </View>

                  <Text style={styles.sectionTitle}>Available Drivers</Text>

                  {drivers.map((driver) => (
                    <TouchableOpacity
                      key={driver.id}
                      style={styles.driverButton}
                      onPress={() => assignDriver(item.id, driver)}
                    >
                      <View>
                        <Text style={styles.driverName}>{driver.name}</Text>
                        <Text style={styles.driverMeta}>
                          {driver.vehicle} · {driver.region}
                        </Text>
                      </View>

                      <Text style={styles.driverStatus}>{driver.status}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              );
            }}
          />
        )}
      </View>
    </ProtectedRoute>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F7F2",
  },

  header: {
    backgroundColor: "#111827",
    paddingTop: 64,
    paddingBottom: 28,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },

  eyebrow: {
    color: "#BBF7D0",
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 8,
  },

  title: {
    color: "#FFFFFF",
    fontSize: 36,
    fontWeight: "900",
    marginBottom: 10,
  },

  subtitle: {
    color: "#D1D5DB",
    lineHeight: 22,
    fontWeight: "600",
  },

  actionRow: {
    flexDirection: "row",
    gap: 10,
    padding: 16,
    paddingBottom: 6,
  },

  primaryAction: {
    flex: 1,
    backgroundColor: "#2F7D32",
    padding: 14,
    borderRadius: 16,
    alignItems: "center",
  },

  primaryActionText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  secondaryAction: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    padding: 14,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2F7D32",
  },

  secondaryActionText: {
    color: "#2F7D32",
    fontWeight: "900",
  },

  loadingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    margin: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  loadingText: {
    marginTop: 10,
    color: "#555",
    fontWeight: "700",
  },

  listContent: {
    padding: 16,
    paddingTop: 8,
    paddingBottom: 90,
  },

  summaryRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },

  summaryCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  summaryValue: {
    color: "#2F7D32",
    fontSize: 28,
    fontWeight: "900",
  },

  summaryLabel: {
    color: "#6B7280",
    fontWeight: "700",
    marginTop: 4,
  },

  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  emptyTitle: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 8,
  },

  emptyText: {
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 22,
  },

  orderCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  orderTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 14,
  },

  orderId: {
    color: "#111827",
    fontSize: 19,
    fontWeight: "900",
  },

  customer: {
    color: "#374151",
    marginTop: 4,
    fontWeight: "800",
  },

  dateText: {
    color: "#6B7280",
    marginTop: 4,
    fontWeight: "600",
  },

  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: "flex-start",
  },

  statusText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
  },

  addressBox: {
    backgroundColor: "#F3F4F6",
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },

  addressTitle: {
    color: "#111827",
    fontWeight: "900",
    marginBottom: 6,
  },

  addressText: {
    color: "#4B5563",
    fontWeight: "700",
    marginBottom: 3,
  },

  phoneText: {
    color: "#111827",
    fontWeight: "900",
    marginTop: 6,
  },

  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  totalLabel: {
    color: "#6B7280",
    fontWeight: "800",
  },

  totalValue: {
    color: "#2F7D32",
    fontSize: 20,
    fontWeight: "900",
  },

  sectionTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 10,
  },

  driverButton: {
    backgroundColor: "#E8F5E9",
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#2F7D32",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "center",
  },

  driverName: {
    color: "#2F7D32",
    fontWeight: "900",
  },

  driverMeta: {
    color: "#4B5563",
    marginTop: 3,
    fontWeight: "600",
  },

  driverStatus: {
    color: "#111827",
    fontSize: 11,
    fontWeight: "900",
  },
});