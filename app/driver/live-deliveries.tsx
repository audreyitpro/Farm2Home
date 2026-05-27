import React, { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";

import {
  Farm2HomeOrder,
  getDeliveryOrders,
  markOrderDelivered,
  markOrderInTransit,
  markOrderPickedUp,
} from "../data/orderStore";
import farmTheme from "../styles/farmTheme";

export default function DriverLiveDeliveries() {
  const [orders, setOrders] = useState<Farm2HomeOrder[]>([]);
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadDeliveries();
    }, [])
  );

  async function loadDeliveries() {
    try {
      setLoading(true);
      const data = await getDeliveryOrders();
      setOrders(Array.isArray(data) ? data : []);
    } catch (error) {
      console.log("Load deliveries error:", error);
      Alert.alert("Error", "Unable to load deliveries.");
    } finally {
      setLoading(false);
    }
  }

  async function updateToPickedUp(orderId: string) {
    await markOrderPickedUp(orderId);
    await loadDeliveries();
  }

  async function updateToInTransit(orderId: string) {
    await markOrderInTransit(orderId);
    await loadDeliveries();
  }

  async function updateToDelivered(orderId: string) {
    await markOrderDelivered(orderId);
    await loadDeliveries();
  }

  function renderOrder({ item }: { item: Farm2HomeOrder }) {
    const deliveryInfo: any = item.deliveryInfo || {};

    return (
      <View style={styles.card}>
        <Text style={styles.orderId}>Order: {item.id}</Text>
        <Text style={styles.status}>Status: {item.status || "NEW"}</Text>

        <Text style={styles.label}>Customer</Text>
        <Text style={styles.value}>
          {item.customerName || item.customerEmail || "Customer"}
        </Text>

        <Text style={styles.label}>Delivery Address</Text>
        <Text style={styles.value}>
          {deliveryInfo.deliveryAddress ||
            deliveryInfo.address ||
            deliveryInfo.street ||
            "Address not available"}
          {"\n"}
          {deliveryInfo.city || ""} {deliveryInfo.state || ""}{" "}
          {deliveryInfo.zipCode || deliveryInfo.zip || ""}
        </Text>

        <Text style={styles.label}>Instructions</Text>
        <Text style={styles.value}>
          {deliveryInfo.deliveryInstructions ||
            deliveryInfo.instructions ||
            "No instructions"}
        </Text>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => updateToPickedUp(item.id)}
          >
            <Text style={styles.actionText}>Picked Up</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => updateToInTransit(item.id)}
          >
            <Text style={styles.actionText}>In Transit</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.deliveredButton}
          onPress={() => updateToDelivered(item.id)}
        >
          <Text style={styles.deliveredText}>Mark Delivered</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Live Deliveries</Text>

      <Text style={styles.subtitle}>
        View active customer deliveries and update order status.
      </Text>

      <TouchableOpacity style={styles.refreshButton} onPress={loadDeliveries}>
        <Text style={styles.refreshText}>
          {loading ? "Refreshing..." : "Refresh Deliveries"}
        </Text>
      </TouchableOpacity>

      <FlatList
        data={orders}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderOrder}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No active deliveries</Text>
            <Text style={styles.emptyText}>
              Delivery orders will appear here after customers check out.
            </Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.push("/driver/mobile-driver-app" as any)}
      >
        <Text style={styles.backText}>Back to Driver App</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: farmTheme.colors.background,
    padding: 18,
    paddingTop: 54,
  },
  title: {
    color: farmTheme.colors.primary,
    fontSize: 32,
    fontWeight: "900",
    marginBottom: 8,
  },
  subtitle: {
    color: farmTheme.colors.mutedText,
    fontWeight: "700",
    lineHeight: 22,
    marginBottom: 14,
  },
  refreshButton: {
    backgroundColor: farmTheme.colors.primary,
    padding: 15,
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 14,
  },
  refreshText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  listContent: {
    paddingBottom: 100,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    ...farmTheme.shadow,
  },
  orderId: {
    color: farmTheme.colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  status: {
    color: farmTheme.colors.primary,
    fontWeight: "900",
    marginTop: 4,
    marginBottom: 8,
  },
  label: {
    color: farmTheme.colors.mutedText,
    fontWeight: "900",
    marginTop: 10,
  },
  value: {
    color: farmTheme.colors.text,
    fontWeight: "700",
    lineHeight: 21,
    marginTop: 3,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  actionButton: {
    flex: 1,
    backgroundColor: "#111827",
    padding: 13,
    borderRadius: 14,
    alignItems: "center",
  },
  actionText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  deliveredButton: {
    backgroundColor: farmTheme.colors.primary,
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 10,
  },
  deliveredText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
  },
  emptyTitle: {
    color: farmTheme.colors.text,
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 6,
  },
  emptyText: {
    color: farmTheme.colors.mutedText,
    fontWeight: "700",
    lineHeight: 22,
  },
  backButton: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: farmTheme.colors.primary,
    padding: 15,
    borderRadius: 16,
    alignItems: "center",
  },
  backText: {
    color: farmTheme.colors.primary,
    fontWeight: "900",
  },
});