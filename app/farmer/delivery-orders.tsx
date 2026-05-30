import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
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
  blue: "#1565C0",
  purple: "#6A1B9A",
  orange: "#EF6C00",
  teal: "#00897B",
  sky: "#0284C7",
};

export default function FarmerDeliveryOrders() {
  const [orders, setOrders] = useState<Farm2HomeOrder[]>([]);
  const [farmName, setFarmName] = useState("");
  const [farmerId, setFarmerId] = useState("");
  const [farmerEmail, setFarmerEmail] = useState("");

  const [loading, setLoading] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
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
      userId: currentFarmer?.id || "",
      email: currentFarmer?.email || "",
      redirectTo: "/subscription/subscription-locked",
    });

    setAccessAllowed(access.allowed);

    return access.allowed;
  }

  async function loadOrders() {
    try {
      setCheckingAccess(true);

      const saved = await AsyncStorage.getItem("currentFarmer");

      if (!saved) {
        router.replace("/farmer/login" as any);
        return;
      }

      const farmer = JSON.parse(saved);
      const allowed = await checkFarmerAccess(farmer);

      if (!allowed) return;

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

      const activeOrders = farmerOrders.filter(
        (order) =>
          order.deliveryInfo?.deliveryOption === "Delivery" ||
          order.deliveryInfo?.deliveryOption === "Pickup"
      );

      setOrders(activeOrders);
    } catch (error) {
      console.log("Load farmer delivery orders error:", error);
      Alert.alert("Load Error", "Unable to load delivery orders.");
    } finally {
      setLoading(false);
      setCheckingAccess(false);
    }
  }

  async function loadSupabaseOrders(
    currentFarmName: string,
    currentFarmerId: string
  ) {
    const { data, error } = await supabase
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
      .eq("farmer_id", currentFarmerId)
      .order("created_at", { ascending: false });

    if (error) {
      console.log("Delivery order load error:", error.message);
      return [];
    }

    const mappedOrders = (data || []).map((order: any) => ({
      id: order.id,
      customerEmail: order.customers?.email || "",
      customerName: order.customers?.full_name || "",
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
        phone: order.customers?.phone || "",
        deliveryInstructions: order.delivery_instructions || "",
        deliveryOption: order.delivery_option || "Delivery",
      },
      status: order.status || "PAID",
      createdAt: order.created_at,
      updatedAt: order.updated_at || order.created_at,
    })) as Farm2HomeOrder[];

    return mappedOrders.filter(
      (order) =>
        order.deliveryInfo?.deliveryOption === "Delivery" ||
        order.deliveryInfo?.deliveryOption === "Pickup"
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
        console.log("Supabase update error:", error.message);
      }

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
        return COLORS.blue;
      case "ACCEPTED":
        return COLORS.primary;
      case "PREPARING":
        return COLORS.orange;
      case "READY_FOR_PICKUP":
        return COLORS.purple;
      case "DRIVER_ASSIGNED":
        return COLORS.sky;
      case "PICKED_UP":
      case "IN_TRANSIT":
        return "#0F766E";
      case "DELIVERED":
        return COLORS.teal;
      case "CANCELLED":
      case "REFUNDED":
        return COLORS.danger;
      default:
        return COLORS.muted;
    }
  }

  function getFriendlyStatus(status: string) {
    switch (status) {
      case "READY_FOR_PICKUP":
        return "READY";
      case "IN_TRANSIT":
        return "OUT FOR DELIVERY";
      case "DRIVER_ASSIGNED":
        return "DRIVER ASSIGNED";
      default:
        return status;
    }
  }

  const summary = useMemo(() => {
    const deliveryCount = orders.filter(
      (order) => order.deliveryInfo?.deliveryOption === "Delivery"
    ).length;

    const pickupCount = orders.filter(
      (order) => order.deliveryInfo?.deliveryOption === "Pickup"
    ).length;

    const activeCount = orders.filter(
      (order) =>
        !["DELIVERED", "CANCELLED", "REFUNDED"].includes(
          String(order.status || "").toUpperCase()
        )
    ).length;

    return { deliveryCount, pickupCount, activeCount };
  }, [orders]);

  function renderButtons(order: Farm2HomeOrder) {
    return (
      <View style={styles.buttonGrid}>
        <ActionButton
          label="Accept"
          color={COLORS.primary}
          onPress={() => changeStatus(order.id, "ACCEPTED")}
        />

        <ActionButton
          label="Preparing"
          color={COLORS.orange}
          onPress={() => changeStatus(order.id, "PREPARING")}
        />

        <ActionButton
          label="Ready"
          color={COLORS.purple}
          onPress={() => changeStatus(order.id, "READY_FOR_PICKUP")}
        />

        {order.deliveryInfo?.deliveryOption === "Delivery" ? (
          <>
            <ActionButton
              label="Assign Driver"
              color={COLORS.sky}
              onPress={() => changeStatus(order.id, "DRIVER_ASSIGNED")}
            />

            <ActionButton
              label="Out for Delivery"
              color={COLORS.blue}
              onPress={() => changeStatus(order.id, "IN_TRANSIT")}
            />

            <ActionButton
              label="Delivered"
              color={COLORS.teal}
              onPress={() => changeStatus(order.id, "DELIVERED")}
            />
          </>
        ) : (
          <ActionButton
            label="Picked Up"
            color={COLORS.teal}
            onPress={() => changeStatus(order.id, "PICKED_UP")}
          />
        )}

        <ActionButton
          label="Cancel"
          color={COLORS.danger}
          onPress={() => changeStatus(order.id, "CANCELLED")}
        />
      </View>
    );
  }

  if (checkingAccess) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>
          Checking farmer subscription access...
        </Text>
      </View>
    );
  }

  if (!accessAllowed) {
    return (
      <View style={styles.centered}>
        <Text style={styles.lockedTitle}>Subscription Required</Text>
        <Text style={styles.loadingText}>Redirecting to subscription page...</Text>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            <View style={styles.topBar}>
              <Pressable
                style={({ pressed }) => [
                  styles.backCircle,
                  pressed && styles.pressed,
                ]}
                onPress={() => router.replace("/farmer/dashboard" as any)}
              >
                <Text style={styles.backCircleText}>‹</Text>
              </Pressable>

              <View style={styles.topTitleBlock}>
                <Text style={styles.title}>Delivery Management</Text>
                <Text style={styles.subtitle}>
                  {farmName || "Your Farm"} pickup and delivery orders
                </Text>
              </View>
            </View>

            <View style={styles.heroCard}>
              <View style={styles.heroTextBlock}>
                <Text style={styles.heroBadge}>Fulfillment Center</Text>
                <Text style={styles.heroTitle}>Manage pickup and delivery</Text>
                <Text style={styles.heroText}>
                  Prepare orders, assign drivers, track delivery progress, and
                  complete customer fulfillment.
                </Text>
              </View>

              <Text style={styles.heroEmoji}>🚚</Text>
            </View>

            <View style={styles.statsGrid}>
              <StatCard label="Active" value={String(summary.activeCount)} />
              <StatCard label="Delivery" value={String(summary.deliveryCount)} />
              <StatCard label="Pickup" value={String(summary.pickupCount)} />
            </View>

            {loading && (
              <View style={styles.emptyCard}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.emptyText}>Loading delivery orders...</Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>🚚</Text>
              <Text style={styles.emptyTitle}>No active orders found</Text>
              <Text style={styles.emptyText}>
                Pickup and delivery orders for {farmName || "your farm"} will
                appear here.
              </Text>
            </View>
          ) : null
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
              <View style={styles.cardHeader}>
                <View style={styles.orderIconBox}>
                  <Text style={styles.orderIcon}>
                    {item.deliveryInfo?.deliveryOption === "Delivery" ? "🚚" : "🧺"}
                  </Text>
                </View>

                <View style={styles.orderHeaderText}>
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
                    { backgroundColor: getStatusColor(item.status) },
                  ]}
                >
                  <Text style={styles.statusText}>
                    {getFriendlyStatus(item.status)}
                  </Text>
                </View>
              </View>

              <View style={styles.customerCard}>
                <Text style={styles.customerTitle}>Customer</Text>

                <Text style={styles.customerText}>
                  {item.customerName || item.customerEmail || "Customer"}
                </Text>

                <Text style={styles.customerText}>
                  Phone: {item.deliveryInfo?.phone || "Not provided"}
                </Text>
              </View>

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

              {farmerItems.length === 0 ? (
                <Text style={styles.emptyLineText}>
                  No items from this farm were found on this order.
                </Text>
              ) : (
                farmerItems.map((product, index) => (
                  <View key={`${product.id}-${index}`} style={styles.productRow}>
                    <View style={styles.productIcon}>
                      <Text style={styles.productIconText}>🥬</Text>
                    </View>

                    <View style={styles.productInfo}>
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

              <View style={styles.totalBox}>
                <Text style={styles.totalLabel}>Your Farm Subtotal</Text>
                <Text style={styles.total}>${farmerSubtotal.toFixed(2)}</Text>
              </View>

              {renderButtons(item)}
            </View>
          );
        }}
      />

      <Pressable
        style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        onPress={() => router.replace("/farmer/dashboard" as any)}
      >
        <Text style={styles.backText}>Back to Farmer Dashboard</Text>
      </Pressable>
    </View>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ActionButton({
  label,
  color,
  onPress,
}: {
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.actionButton,
        { backgroundColor: color },
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centered: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  lockedTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: COLORS.danger,
    marginBottom: 12,
    textAlign: "center",
  },
  loadingText: {
    color: COLORS.muted,
    fontWeight: "900",
    marginTop: 12,
    textAlign: "center",
  },
  listContent: {
    padding: 18,
    paddingBottom: 120,
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
    borderRadius: 32,
    padding: 20,
    marginBottom: 16,
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
  statsGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statValue: {
    color: COLORS.primary,
    fontSize: 21,
    fontWeight: "900",
  },
  statLabel: {
    color: COLORS.muted,
    fontWeight: "800",
    fontSize: 11,
    marginTop: 3,
  },
  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 28,
    alignItems: "center",
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  emptyIcon: {
    fontSize: 42,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: COLORS.text,
    marginBottom: 6,
    textAlign: "center",
  },
  emptyText: {
    color: COLORS.muted,
    textAlign: "center",
    lineHeight: 23,
    fontWeight: "700",
    marginTop: 8,
  },
  card: {
    backgroundColor: COLORS.card,
    padding: 16,
    borderRadius: 30,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  orderIconBox: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: COLORS.softGreen,
    justifyContent: "center",
    alignItems: "center",
  },
  orderIcon: {
    fontSize: 27,
  },
  orderHeaderText: {
    flex: 1,
  },
  orderId: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.text,
  },
  dateText: {
    color: COLORS.muted,
    marginTop: 4,
    fontWeight: "700",
    fontSize: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  statusText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 11,
  },
  customerCard: {
    backgroundColor: COLORS.lightGreen,
    padding: 13,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
  },
  customerTitle: {
    color: COLORS.primary,
    fontWeight: "900",
    fontSize: 13,
    marginBottom: 5,
  },
  customerText: {
    color: COLORS.text,
    fontWeight: "800",
    marginBottom: 4,
  },
  infoBox: {
    backgroundColor: "#FFF7ED",
    padding: 14,
    borderRadius: 22,
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
    color: COLORS.text,
  },
  productRow: {
    backgroundColor: COLORS.lightGreen,
    padding: 12,
    borderRadius: 20,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  productIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: COLORS.card,
    justifyContent: "center",
    alignItems: "center",
  },
  productIconText: {
    fontSize: 22,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontWeight: "900",
    color: COLORS.text,
    marginBottom: 4,
  },
  productMeta: {
    color: COLORS.muted,
    fontWeight: "700",
    fontSize: 12,
  },
  productTotal: {
    color: COLORS.primary,
    fontWeight: "900",
  },
  emptyLineText: {
    color: COLORS.muted,
    fontWeight: "700",
    marginBottom: 10,
  },
  totalBox: {
    marginTop: 14,
    marginBottom: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 12,
  },
  totalLabel: {
    color: COLORS.muted,
    fontWeight: "800",
    marginBottom: 4,
  },
  total: {
    fontSize: 23,
    fontWeight: "900",
    color: COLORS.primary,
  },
  buttonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 14,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 12,
  },
  backButton: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 18,
    backgroundColor: COLORS.dark,
    padding: 16,
    borderRadius: 20,
    alignItems: "center",
  },
  backText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  pressed: {
    opacity: 0.75,
  },
});