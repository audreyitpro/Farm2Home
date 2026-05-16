import React, { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";

import {
  Farm2HomeOrder,
  getOrdersForFarmer,
  updateOrderStatus,
  OrderStatus,
} from "../data/orderStore";

import farmTheme from "../styles/farmTheme";

export default function FarmerDeliveryOrders() {
  const [orders, setOrders] = useState<Farm2HomeOrder[]>([]);
  const [farmName, setFarmName] = useState("");

  useFocusEffect(
    useCallback(() => {
      loadOrders();
    }, [])
  );

  async function loadOrders() {
    try {
      const saved = await AsyncStorage.getItem("currentFarmer");

      if (!saved) {
        router.replace("/farmer/login");
        return;
      }

      const farmer = JSON.parse(saved);
      const currentFarmName = farmer.farmName || "";

      setFarmName(currentFarmName);

      const farmerOrders = await getOrdersForFarmer(currentFarmName);

      const activeOrders = farmerOrders.filter(
        (order) =>
          order.deliveryInfo?.deliveryOption === "Delivery" ||
          order.deliveryInfo?.deliveryOption === "Pickup"
      );

      setOrders(activeOrders);
    } catch (error) {
      console.log("Load farmer delivery orders error:", error);
      Alert.alert("Load Error", "Unable to load delivery orders.");
    }
  }

  async function changeStatus(orderId: string, status: OrderStatus) {
    try {
      await updateOrderStatus(orderId, status);

      Alert.alert("Order Updated", `Order marked as ${status}`);

      await loadOrders();
    } catch (error: any) {
      Alert.alert("Update Error", error?.message || "Unable to update order.");
    }
  }

  function getFarmerItems(order: Farm2HomeOrder) {
    return (order.items || []).filter(
      (item) => item.farmName?.toLowerCase() === farmName.toLowerCase()
    );
  }

  function getStatusColor(status: string) {
    switch (status) {
      case "PAID":
        return "#1565C0";
      case "ACCEPTED":
        return "#2F7D32";
      case "PREPARING":
        return "#EF6C00";
      case "READY_FOR_PICKUP":
        return "#6A1B9A";
      case "DRIVER_ASSIGNED":
        return "#0284C7";
      case "PICKED_UP":
      case "IN_TRANSIT":
        return "#0F766E";
      case "DELIVERED":
        return "#00897B";
      case "CANCELLED":
      case "REFUNDED":
        return "#C62828";
      default:
        return "#666666";
    }
  }

  function getFriendlyStatus(status: string) {
    switch (status) {
      case "READY_FOR_PICKUP":
        return "READY";
      case "IN_TRANSIT":
        return "OUT FOR DELIVERY";
      default:
        return status;
    }
  }

  function renderButtons(order: Farm2HomeOrder) {
    return (
      <View style={styles.buttonGrid}>
        <TouchableOpacity
          style={styles.acceptButton}
          onPress={() => changeStatus(order.id, "ACCEPTED")}
        >
          <Text style={styles.buttonText}>Accept</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.prepareButton}
          onPress={() => changeStatus(order.id, "PREPARING")}
        >
          <Text style={styles.buttonText}>Preparing</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.readyButton}
          onPress={() => changeStatus(order.id, "READY_FOR_PICKUP")}
        >
          <Text style={styles.buttonText}>Ready</Text>
        </TouchableOpacity>

        {order.deliveryInfo?.deliveryOption === "Delivery" ? (
          <>
            <TouchableOpacity
              style={styles.deliveryButton}
              onPress={() => changeStatus(order.id, "IN_TRANSIT")}
            >
              <Text style={styles.buttonText}>Out for Delivery</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.completeButton}
              onPress={() => changeStatus(order.id, "DELIVERED")}
            >
              <Text style={styles.buttonText}>Delivered</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={styles.completeButton}
            onPress={() => changeStatus(order.id, "PICKED_UP")}
          >
            <Text style={styles.buttonText}>Picked Up</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => changeStatus(order.id, "CANCELLED")}
        >
          <Text style={styles.buttonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Delivery Management</Text>

      <Text style={styles.subtitle}>
        {farmName || "Your Farm"} · Manage customer pickup and delivery orders.
      </Text>

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: 120,
        }}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🚚</Text>

            <Text style={styles.emptyTitle}>No active orders found.</Text>

            <Text style={styles.emptyText}>
              Pickup and delivery orders for {farmName || "your farm"} will
              appear here.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const farmerItems = getFarmerItems(item);

          const farmerSubtotal = farmerItems.reduce(
            (sum, product) =>
              sum + Number(product.price) * Number(product.quantity),
            0
          );

          return (
            <View style={styles.card}>
              <View style={styles.headerRow}>
                <View>
                  <Text style={styles.orderId}>Order #{item.id.slice(-6)}</Text>

                  <Text style={styles.dateText}>
                    {item.createdAt
                      ? new Date(item.createdAt).toLocaleString()
                      : "Date unavailable"}
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
                    {getFriendlyStatus(item.status)}
                  </Text>
                </View>
              </View>

              <Text style={styles.customer}>
                Customer: {item.customerName || item.customerEmail}
              </Text>

              <Text style={styles.meta}>Phone: {item.deliveryInfo?.phone}</Text>

              <View style={styles.infoBox}>
                <Text style={styles.infoTitle}>
                  {item.deliveryInfo?.deliveryOption === "Delivery"
                    ? "Delivery Order"
                    : "Pickup Order"}
                </Text>

                <Text style={styles.infoText}>
                  Method: {item.deliveryInfo?.deliveryOption}
                </Text>

                {item.deliveryInfo?.deliveryOption === "Delivery" ? (
                  <>
                    <Text style={styles.infoText}>
                      Address: {item.deliveryInfo?.deliveryAddress}
                    </Text>

                    <Text style={styles.infoText}>
                      {item.deliveryInfo?.city}, {item.deliveryInfo?.state}{" "}
                      {item.deliveryInfo?.zipCode}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.infoText}>Customer pickup order</Text>
                )}

                {!!item.deliveryInfo?.deliveryInstructions && (
                  <Text style={styles.infoText}>
                    Instructions: {item.deliveryInfo.deliveryInstructions}
                  </Text>
                )}
              </View>

              <Text style={styles.sectionTitle}>Your Farm Items</Text>

              {farmerItems.map((product, index) => (
                <View key={`${product.id}-${index}`} style={styles.productRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.productName}>{product.name}</Text>

                    <Text style={styles.productMeta}>
                      Qty {product.quantity} · $
                      {Number(product.price).toFixed(2)} each
                    </Text>
                  </View>

                  <Text style={styles.productTotal}>
                    $
                    {(
                      Number(product.price) * Number(product.quantity)
                    ).toFixed(2)}
                  </Text>
                </View>
              ))}

              <View style={styles.totalBox}>
                <Text style={styles.totalLabel}>Your Farm Subtotal</Text>

                <Text style={styles.total}>${farmerSubtotal.toFixed(2)}</Text>
              </View>

              {renderButtons(item)}
            </View>
          );
        }}
      />

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.replace("/farmer/dashboard")}
      >
        <Text style={styles.backText}>Back to Farmer Dashboard</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: farmTheme.colors.background,
    padding: 18,
  },

  title: {
    fontSize: 32,
    fontWeight: "900",
    color: farmTheme.colors.primary,
    marginBottom: 8,
  },

  subtitle: {
    color: farmTheme.colors.mutedText,
    marginBottom: 18,
    lineHeight: 22,
    fontWeight: "700",
  },

  emptyCard: {
    ...farmTheme.cards.default,
    alignItems: "center",
    padding: 24,
  },

  emptyIcon: {
    fontSize: 42,
    marginBottom: 8,
  },

  emptyTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: farmTheme.colors.text,
    marginBottom: 6,
  },

  emptyText: {
    color: farmTheme.colors.mutedText,
    textAlign: "center",
    lineHeight: 23,
  },

  card: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    ...farmTheme.shadow,
  },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 10,
  },

  orderId: {
    fontSize: 20,
    fontWeight: "900",
    color: farmTheme.colors.text,
  },

  dateText: {
    color: farmTheme.colors.mutedText,
    marginTop: 6,
  },

  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },

  statusText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 12,
  },

  customer: {
    fontWeight: "900",
    color: farmTheme.colors.text,
    marginBottom: 5,
  },

  meta: {
    color: farmTheme.colors.mutedText,
    marginBottom: 8,
    fontWeight: "700",
  },

  infoBox: {
    backgroundColor: "#FFF7ED",
    padding: 14,
    borderRadius: 18,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#FED7AA",
  },

  infoTitle: {
    color: "#9A3412",
    fontWeight: "900",
    fontSize: 16,
    marginBottom: 7,
  },

  infoText: {
    color: "#7C2D12",
    marginBottom: 4,
    lineHeight: 20,
    fontWeight: "700",
  },

  sectionTitle: {
    marginTop: 14,
    marginBottom: 8,
    fontWeight: "900",
    fontSize: 17,
    color: farmTheme.colors.text,
  },

  productRow: {
    backgroundColor: farmTheme.colors.primaryLight,
    padding: 12,
    borderRadius: 14,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },

  productName: {
    fontWeight: "900",
    color: farmTheme.colors.text,
    marginBottom: 4,
  },

  productMeta: {
    color: farmTheme.colors.mutedText,
    fontWeight: "700",
  },

  productTotal: {
    color: farmTheme.colors.primary,
    fontWeight: "900",
  },

  totalBox: {
    marginTop: 14,
    marginBottom: 14,
    borderTopWidth: 1,
    borderTopColor: farmTheme.colors.border,
    paddingTop: 12,
  },

  totalLabel: {
    color: farmTheme.colors.mutedText,
    fontWeight: "800",
    marginBottom: 4,
  },

  total: {
    fontSize: 22,
    fontWeight: "900",
    color: farmTheme.colors.primary,
  },

  buttonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  acceptButton: {
    backgroundColor: "#2F7D32",
    padding: 10,
    borderRadius: 12,
  },

  prepareButton: {
    backgroundColor: "#EF6C00",
    padding: 10,
    borderRadius: 12,
  },

  readyButton: {
    backgroundColor: "#6A1B9A",
    padding: 10,
    borderRadius: 12,
  },

  deliveryButton: {
    backgroundColor: "#1565C0",
    padding: 10,
    borderRadius: 12,
  },

  completeButton: {
    backgroundColor: "#00897B",
    padding: 10,
    borderRadius: 12,
  },

  cancelButton: {
    backgroundColor: "#C62828",
    padding: 10,
    borderRadius: 12,
  },

  buttonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  backButton: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 18,
    backgroundColor: farmTheme.colors.text,
    padding: 16,
    borderRadius: 18,
    alignItems: "center",
  },

  backText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
});