// app/farmer/delivery-operations.tsx

import React, { useCallback, useMemo, useState } from "react";
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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { supabase } from "../data/supabaseClient";

const COLORS = {
  bg: "#F6F8F2",
  card: "#FFFFFF",
  text: "#172017",
  muted: "#64748B",
  border: "#E3E8DD",
  primary: "#2E7D32",
  primaryDark: "#14532D",
  blue: "#2563EB",
  dark: "#111827",
  greenSoft: "#DCFCE7",
  blueSoft: "#DBEAFE",
  redSoft: "#FEE2E2",
};

type DeliveryOrder = {
  id: string;
  order_id?: string;
  farmer_id?: string;
  customer_id?: string;
  driver_id?: string;

  driver_name?: string;
  customer_name?: string;

  pickup_address?: string;
  dropoff_address?: string;

  miles?: number;
  delivery_fee?: number;

  status?: string;
  source?: string;

  created_at?: string;
};

type FreightLoad = {
  id: string;
  product_name?: string;
  load_type?: string;
  miles?: number;
  total_due?: number;
  status?: string;
};

export default function FarmerDeliveryOperationsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [farmerId, setFarmerId] = useState("");

  const [deliveries, setDeliveries] = useState<DeliveryOrder[]>([]);
  const [freightLoads, setFreightLoads] = useState<FreightLoad[]>([]);

  useFocusEffect(
    useCallback(() => {
      initialize();
    }, [])
  );

  const stats = useMemo(() => {
    return {
      deliveries: deliveries.length,
      freight: freightLoads.length,
      active: deliveries.filter(
        (d) =>
          d.status !== "completed" &&
          d.status !== "delivered" &&
          d.status !== "cancelled"
      ).length,
      revenue:
        deliveries.reduce(
          (sum, d) => sum + Number(d.delivery_fee || 0),
          0
        ) +
        freightLoads.reduce(
          (sum, f) => sum + Number(f.total_due || 0),
          0
        ),
    };
  }, [deliveries, freightLoads]);

  async function initialize() {
    try {
      setLoading(true);

      const raw =
        (await AsyncStorage.getItem("currentFarmer")) ||
        (await AsyncStorage.getItem("currentUser"));

      if (!raw) {
        router.replace("/farmer/login" as any);
        return;
      }

      const farmer = JSON.parse(raw);

      const id = farmer.id || farmer.farmerId;

      if (!id) {
        router.replace("/farmer/login" as any);
        return;
      }

      setFarmerId(id);

      await loadOperations(id);
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  }

  async function loadOperations(id: string) {
    try {
      setRefreshing(true);

      const { data: deliveryRows } = await supabase
        .from("delivery_orders")
        .select("*")
        .eq("farmer_id", id)
        .order("created_at", { ascending: false });

      const { data: freightRows } = await supabase
        .from("freight_loads")
        .select("*")
        .eq("farmer_id", id)
        .order("created_at", { ascending: false });

      setDeliveries(deliveryRows || []);
      setFreightLoads(freightRows || []);
    } catch (error: any) {
      Alert.alert(
        "Operations Error",
        error?.message || "Unable to load delivery operations."
      );
    } finally {
      setRefreshing(false);
    }
  }

  async function refreshData() {
    await loadOperations(farmerId);
  }

  function getStatusColor(status?: string) {
    switch (status) {
      case "completed":
      case "delivered":
        return COLORS.greenSoft;

      case "cancelled":
        return COLORS.redSoft;

      default:
        return COLORS.blueSoft;
    }
  }

  function openDriverChat(delivery: DeliveryOrder) {
    router.push({
      pathname: "/farmer/driver-chat",
      params: {
        orderId: delivery.order_id || "",
        driverId: delivery.driver_id || "",
      },
    } as any);
  }

  function openTracking(delivery: DeliveryOrder) {
    router.push({
      pathname: "/customer/order-tracking",
      params: {
        orderId: delivery.order_id || "",
      },
    } as any);
  }

  function assignDriver(delivery: DeliveryOrder) {
    router.push({
      pathname: "/farmer/assigned-drivers",
      params: {
        deliveryId: delivery.id,
      },
    } as any);
  }

  function renderDelivery({ item }: { item: DeliveryOrder }) {
    return (
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>
              Order #{String(item.order_id || item.id).slice(-6)}
            </Text>

            <Text style={styles.smallText}>
              Driver: {item.driver_name || "Unassigned"}
            </Text>
          </View>

          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: getStatusColor(item.status),
              },
            ]}
          >
            <Text style={styles.statusText}>
              {item.status || "available"}
            </Text>
          </View>
        </View>

        <Text style={styles.label}>Pickup</Text>
        <Text style={styles.value}>
          {item.pickup_address || "Not available"}
        </Text>

        <Text style={styles.label}>Dropoff</Text>
        <Text style={styles.value}>
          {item.dropoff_address || "Not available"}
        </Text>

        <View style={styles.metaRow}>
          <View style={styles.metaCard}>
            <Text style={styles.metaLabel}>Miles</Text>
            <Text style={styles.metaValue}>
              {Number(item.miles || 0).toFixed(1)}
            </Text>
          </View>

          <View style={styles.metaCard}>
            <Text style={styles.metaLabel}>Delivery Fee</Text>
            <Text style={styles.metaValue}>
              ${Number(item.delivery_fee || 0).toFixed(2)}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => assignDriver(item)}
        >
          <Text style={styles.actionButtonText}>
            Assign Driver
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => openDriverChat(item)}
        >
          <Text style={styles.secondaryButtonText}>
            Driver Chat
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.darkButton}
          onPress={() => openTracking(item)}
        >
          <Text style={styles.darkButtonText}>
            Live Tracking
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderFreight({ item }: { item: FreightLoad }) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>
          {item.product_name || "Freight Load"}
        </Text>

        <Text style={styles.smallText}>
          {item.load_type || "Farm Freight"}
        </Text>

        <View style={styles.metaRow}>
          <View style={styles.metaCard}>
            <Text style={styles.metaLabel}>Miles</Text>
            <Text style={styles.metaValue}>
              {Number(item.miles || 0).toFixed(1)}
            </Text>
          </View>

          <View style={styles.metaCard}>
            <Text style={styles.metaLabel}>Total</Text>
            <Text style={styles.metaValue}>
              ${Number(item.total_due || 0).toFixed(2)}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() =>
            router.push("/freight/board" as any)
          }
        >
          <Text style={styles.actionButtonText}>
            Open Freight Board
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
        />
        <Text style={styles.loadingText}>
          Loading delivery operations...
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={deliveries}
      keyExtractor={(item) => item.id}
      renderItem={renderDelivery}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refreshData}
        />
      }
      contentContainerStyle={styles.content}
      ListHeaderComponent={
        <>
          <View style={styles.header}>
            <Text style={styles.title}>
              Delivery Operations
            </Text>

            <Text style={styles.subtitle}>
              Manage deliveries, drivers, freight loads,
              tracking and communications.
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>
                {stats.deliveries}
              </Text>
              <Text style={styles.summaryLabel}>
                Deliveries
              </Text>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>
                {stats.freight}
              </Text>
              <Text style={styles.summaryLabel}>
                Freight
              </Text>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>
                ${stats.revenue.toFixed(0)}
              </Text>
              <Text style={styles.summaryLabel}>
                Revenue
              </Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>
            Freight Loads
          </Text>

          {freightLoads.map((load) => (
            <View key={load.id}>
              {renderFreight({ item: load })}
            </View>
          ))}

          <Text style={styles.sectionTitle}>
            Delivery Orders
          </Text>
        </>
      }
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.bg,
  },

  loadingText: {
    marginTop: 12,
    color: COLORS.primary,
    fontWeight: "800",
  },

  content: {
    padding: 16,
    paddingBottom: 100,
    backgroundColor: COLORS.bg,
  },

  header: {
    marginBottom: 16,
  },

  title: {
    fontSize: 28,
    fontWeight: "900",
    color: COLORS.text,
  },

  subtitle: {
    marginTop: 8,
    color: COLORS.muted,
    lineHeight: 20,
    fontWeight: "700",
  },

  summaryRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 18,
  },

  summaryCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  summaryValue: {
    fontSize: 20,
    fontWeight: "900",
    color: COLORS.primary,
  },

  summaryLabel: {
    marginTop: 4,
    color: COLORS.muted,
    fontWeight: "800",
    fontSize: 12,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.text,
    marginBottom: 10,
    marginTop: 10,
  },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  cardTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.text,
  },

  smallText: {
    color: COLORS.muted,
    marginTop: 4,
    fontWeight: "700",
  },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },

  statusText: {
    fontWeight: "900",
    fontSize: 11,
  },

  label: {
    marginTop: 10,
    marginBottom: 3,
    color: COLORS.muted,
    fontWeight: "900",
  },

  value: {
    color: COLORS.text,
    fontWeight: "700",
  },

  metaRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },

  metaCard: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    padding: 10,
  },

  metaLabel: {
    color: COLORS.muted,
    fontWeight: "900",
  },

  metaValue: {
    marginTop: 3,
    fontSize: 16,
    fontWeight: "900",
    color: COLORS.text,
  },

  actionButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 12,
  },

  actionButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  secondaryButton: {
    backgroundColor: COLORS.blue,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },

  secondaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  darkButton: {
    backgroundColor: COLORS.dark,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },

  darkButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
});