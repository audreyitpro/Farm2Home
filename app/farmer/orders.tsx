import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
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

import { supabase } from "../data/supabaseClient";
import { enforceSubscriptionAccess } from "../services/lockoutGuard";
import farmTheme from "../styles/farmTheme";

export default function FarmerOrders() {
  const [orders, setOrders] = useState<Farm2HomeOrder[]>([]);
  const [farmName, setFarmName] = useState("");
  const [farmerId, setFarmerId] = useState("");
  const [farmerEmail, setFarmerEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [accessChecking, setAccessChecking] = useState(true);
  const [accessAllowed, setAccessAllowed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadOrders();
    }, [])
  );

  async function checkFarmerAccess(farmer?: any) {
    const saved = farmer ? null : await AsyncStorage.getItem("currentFarmer");
    const currentFarmer = farmer || (saved ? JSON.parse(saved) : null);

    const access = await enforceSubscriptionAccess({
      role: "farmer",
      userId: currentFarmer?.id || farmerId || "",
      email: currentFarmer?.email || farmerEmail || "",
      redirectTo: "/subscription/subscription-locked",
    });

    setAccessAllowed(access.allowed);
    return access.allowed;
  }

  async function loadOrders() {
    try {
      setAccessChecking(true);

      const saved = await AsyncStorage.getItem("currentFarmer");

      if (!saved) {
        router.replace("/farmer/login");
        return;
      }

      const farmer = JSON.parse(saved);

      const allowed = await checkFarmerAccess(farmer);

      if (!allowed) {
        setLoading(false);
        return;
      }

      const currentFarmName = farmer.farmName || "";

      setFarmName(currentFarmName);
      setFarmerId(farmer.id || "");
      setFarmerEmail(farmer.email || "");

      setLoading(true);

      const cloudOrders = await loadSupabaseOrders(
        currentFarmName,
        farmer.id || ""
      );

      if (cloudOrders.length > 0) {
        setOrders(cloudOrders);
        return;
      }

      const farmerOrders = await getOrdersForFarmer(currentFarmName);
      setOrders(farmerOrders);
    } catch (error) {
      console.log("Farmer orders load error:", error);

      try {
        const saved = await AsyncStorage.getItem("currentFarmer");
        const farmer = saved ? JSON.parse(saved) : null;
        const currentFarmName = farmer?.farmName || "";
        const farmerOrders = await getOrdersForFarmer(currentFarmName);
        setOrders(farmerOrders);
      } catch (fallbackError) {
        console.log("Farmer orders fallback error:", fallbackError);
        setOrders([]);
      }
    } finally {
      setLoading(false);
      setAccessChecking(false);
    }
  }

  async function loadSupabaseOrders(
    currentFarmName: string,
    currentFarmerId: string
  ) {
    let resolvedFarmerId = currentFarmerId;

    if (!resolvedFarmerId && currentFarmName) {
      const { data: farmerRecord, error: farmerError } = await supabase
        .from("farmers")
        .select("id")
        .eq("farm_name", currentFarmName)
        .maybeSingle();

      if (farmerError) {
        console.log("Supabase farmer lookup error:", farmerError.message);
      }

      resolvedFarmerId = farmerRecord?.id || "";
    }

    if (!resolvedFarmerId && !currentFarmName) {
      return [];
    }

    let query = supabase
      .from("orders")
      .select(
        `
        *,
        customers (
          full_name,
          email,
          phone
        ),
        order_items (
          id,
          product_id,
          product_name,
          farm_name,
          quantity,
          price
        )
      `
      )
      .order("created_at", { ascending: false });

    if (resolvedFarmerId) {
      query = query.eq("farmer_id", resolvedFarmerId);
    }

    const { data, error } = await query;

    if (error) {
      console.log("Supabase farmer orders error:", error.message);
      return [];
    }

    const mappedOrders = (data || []).map((order: any) => ({
      id: order.id,
      customerEmail: order.customers?.email || order.customer_email || "",
      customerName: order.customers?.full_name || order.customer_name || "",
      items: (order.order_items || []).map((item: any) => ({
        id: item.product_id || item.id,
        name: item.product_name,
        price: Number(item.price || 0),
        quantity: Number(item.quantity || 0),
        farmName: item.farm_name || currentFarmName,
      })),
      subtotal: Number(order.subtotal || 0),
      deliveryFee: Number(order.delivery_fee || 0),
      tip: Number(order.tip || 0),
      total: Number(order.total || 0),
      deliveryInfo: {
        deliveryAddress: order.delivery_address || "",
        city: order.city || "",
        state: order.state || "",
        zipCode: order.zip_code || "",
        phone: order.customers?.phone || order.phone || "",
        deliveryInstructions: order.delivery_instructions || "",
        deliveryOption: order.delivery_option || "Delivery",
      },
      status: order.status || "PAID",
      createdAt: order.created_at,
      updatedAt: order.updated_at || order.created_at,
    })) as Farm2HomeOrder[];

    if (!currentFarmName) {
      return mappedOrders;
    }

    return mappedOrders.filter((order) =>
      order.items.some(
        (item) => item.farmName?.toLowerCase() === currentFarmName.toLowerCase()
      )
    );
  }

  async function changeStatus(orderId: string, status: OrderStatus) {
    try {
      const allowed = await checkFarmerAccess();

      if (!allowed) return;

      const { error } = await supabase
        .from("orders")
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      if (error) {
        console.log("Supabase order status update error:", error.message);
      }

      await updateOrderStatus(orderId, status);
      await loadOrders();

      Alert.alert("Order Updated", `Order marked as ${status}.`);
    } catch (error) {
      console.log("Update farmer order status error:", error);
      Alert.alert("Update Error", "Unable to update order status.");
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
      case "PENDING_PAYMENT":
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
      case "PENDING_PAYMENT":
        return "PENDING PAYMENT";
      case "READY_FOR_PICKUP":
        return "READY";
      case "IN_TRANSIT":
        return "OUT FOR DELIVERY";
      default:
        return status;
    }
  }

  function getOrderDate(order: Farm2HomeOrder) {
    const dateValue =
      (order as any).createdAt ||
      (order as any).created_at ||
      (order as any).createDate ||
      "";

    if (!dateValue) {
      return "Date unavailable";
    }

    return new Date(dateValue).toLocaleString();
  }

  function renderStatusButtons(order: Farm2HomeOrder) {
    return (
      <View style={styles.statusActions}>
        <TouchableOpacity
          style={styles.acceptButton}
          onPress={() => changeStatus(order.id, "ACCEPTED")}
        >
          <Text style={styles.actionText}>Accept</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.prepareButton}
          onPress={() => changeStatus(order.id, "PREPARING")}
        >
          <Text style={styles.actionText}>Preparing</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.readyButton}
          onPress={() => changeStatus(order.id, "READY_FOR_PICKUP")}
        >
          <Text style={styles.actionText}>Ready</Text>
        </TouchableOpacity>

        {order.deliveryInfo?.deliveryOption === "Delivery" ? (
          <>
            <TouchableOpacity
              style={styles.deliveryButton}
              onPress={() => changeStatus(order.id, "IN_TRANSIT")}
            >
              <Text style={styles.actionText}>Out for Delivery</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.doneButton}
              onPress={() => changeStatus(order.id, "DELIVERED")}
            >
              <Text style={styles.actionText}>Delivered</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={styles.doneButton}
            onPress={() => changeStatus(order.id, "PICKED_UP")}
          >
            <Text style={styles.actionText}>Picked Up</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => changeStatus(order.id, "CANCELLED")}
        >
          <Text style={styles.actionText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (accessChecking) {
    return (
      <View style={styles.lockContainer}>
        <ActivityIndicator size="large" color={farmTheme.colors.primary} />
        <Text style={styles.lockText}>Checking farmer subscription access...</Text>
      </View>
    );
  }

  if (!accessAllowed) {
    return (
      <View style={styles.lockContainer}>
        <Text style={styles.lockTitle}>Subscription Required</Text>
        <Text style={styles.lockText}>Redirecting to subscription page...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Farmer Orders</Text>

      <Text style={styles.subtitle}>
        {farmName || "Your Farm"} · Manage paid customer orders, fulfillment,
        pickup, and delivery status.
      </Text>

      {loading ? (
        <View style={styles.emptyBox}>
          <ActivityIndicator size="large" color={farmTheme.colors.primary} />
          <Text style={styles.emptyText}>Loading farmer orders...</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>📦</Text>
              <Text style={styles.emptyTitle}>No paid orders yet.</Text>
              <Text style={styles.emptyText}>
                Orders for {farmName || "your farm"} will appear here after
                customer checkout.
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
              <View style={styles.orderCard}>
                <View style={styles.headerRow}>
                  <View>
                    <Text style={styles.orderId}>Order #{item.id.slice(-6)}</Text>

                    <Text style={styles.dateText}>{getOrderDate(item)}</Text>
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: getStatusColor(item.status) },
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

                <Text style={styles.customer}>
                  Phone: {item.deliveryInfo?.phone || "Not provided"}
                </Text>

                <Text style={styles.sectionLabel}>Your Farm Items</Text>

                {farmerItems.length === 0 ? (
                  <Text style={styles.noItemsText}>
                    No items from this farm were found on this order.
                  </Text>
                ) : (
                  farmerItems.map((product, index) => (
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
                  ))
                )}

                <View style={styles.infoBox}>
                  <Text style={styles.infoTitle}>
                    {item.deliveryInfo?.deliveryOption === "Delivery"
                      ? "Delivery Order"
                      : "Pickup Order"}
                  </Text>

                  <Text style={styles.infoText}>
                    Method: {item.deliveryInfo?.deliveryOption || "Pickup"}
                  </Text>

                  {item.deliveryInfo?.deliveryOption === "Delivery" ? (
                    <Text style={styles.infoText}>
                      Address: {item.deliveryInfo?.deliveryAddress},{" "}
                      {item.deliveryInfo?.city}, {item.deliveryInfo?.state}{" "}
                      {item.deliveryInfo?.zipCode}
                    </Text>
                  ) : (
                    <Text style={styles.infoText}>
                      Customer will pickup from farm.
                    </Text>
                  )}

                  {!!item.deliveryInfo?.deliveryInstructions && (
                    <Text style={styles.infoText}>
                      Instructions: {item.deliveryInfo.deliveryInstructions}
                    </Text>
                  )}
                </View>

                <View style={styles.totalBox}>
                  <Text style={styles.totalLabel}>Your Farm Subtotal</Text>
                  <Text style={styles.total}>${farmerSubtotal.toFixed(2)}</Text>
                </View>

                {renderStatusButtons(item)}
              </View>
            );
          }}
        />
      )}

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
  lockContainer: {
    flex: 1,
    backgroundColor: farmTheme.colors.background,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  lockTitle: {
    color: "#991B1B",
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center",
  },
  lockText: {
    marginTop: 14,
    color: farmTheme.colors.mutedText,
    fontWeight: "800",
    textAlign: "center",
  },
  container: {
    flex: 1,
    backgroundColor: farmTheme.colors.background,
    padding: 18,
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    color: farmTheme.colors.primary,
    marginBottom: 6,
  },
  subtitle: {
    color: farmTheme.colors.mutedText,
    marginBottom: 18,
    lineHeight: 22,
    fontWeight: "700",
  },
  emptyBox: {
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
    fontSize: 16,
    textAlign: "center",
    lineHeight: 23,
    marginTop: 10,
  },
  orderCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 16,
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
    marginBottom: 12,
  },
  orderId: {
    fontSize: 19,
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
    color: farmTheme.colors.text,
    fontWeight: "700",
    marginBottom: 5,
  },
  sectionLabel: {
    fontSize: 17,
    fontWeight: "900",
    color: farmTheme.colors.text,
    marginTop: 12,
    marginBottom: 8,
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
  noItemsText: {
    color: farmTheme.colors.mutedText,
    fontWeight: "700",
    marginBottom: 10,
  },
  infoBox: {
    backgroundColor: "#FFF7ED",
    padding: 14,
    borderRadius: 18,
    marginTop: 12,
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
  totalBox: {
    marginTop: 14,
    marginBottom: 12,
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
  statusActions: {
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
  doneButton: {
    backgroundColor: "#00897B",
    padding: 10,
    borderRadius: 12,
  },
  cancelButton: {
    backgroundColor: "#C62828",
    padding: 10,
    borderRadius: 12,
  },
  actionText: {
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