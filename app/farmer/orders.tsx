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
};

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
        router.replace("/farmer/login" as any);
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
        return COLORS.blue;
      case "ACCEPTED":
        return COLORS.primary;
      case "PREPARING":
        return COLORS.orange;
      case "READY_FOR_PICKUP":
        return COLORS.purple;
      case "DRIVER_ASSIGNED":
        return "#0284C7";
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

    if (!dateValue) return "Date unavailable";

    return new Date(dateValue).toLocaleString();
  }

  const summary = useMemo(() => {
    const active = orders.filter(
      (order) =>
        !["DELIVERED", "CANCELLED", "REFUNDED"].includes(
          String(order.status || "").toUpperCase()
        )
    ).length;

    const revenue = orders.reduce((sum, order) => {
      const farmerItems = getFarmerItems(order);
      return (
        sum +
        farmerItems.reduce(
          (itemSum, product) =>
            itemSum + Number(product.price || 0) * Number(product.quantity || 0),
          0
        )
      );
    }, 0);

    return {
      total: orders.length,
      active,
      revenue,
    };
  }, [orders, farmName]);

  function renderStatusButtons(order: Farm2HomeOrder) {
    return (
      <View style={styles.statusActions}>
        <StatusButton
          label="Accept"
          color={COLORS.primary}
          onPress={() => changeStatus(order.id, "ACCEPTED")}
        />

        <StatusButton
          label="Preparing"
          color={COLORS.orange}
          onPress={() => changeStatus(order.id, "PREPARING")}
        />

        <StatusButton
          label="Ready"
          color={COLORS.purple}
          onPress={() => changeStatus(order.id, "READY_FOR_PICKUP")}
        />

        {order.deliveryInfo?.deliveryOption === "Delivery" ? (
          <>
            <StatusButton
              label="Out for Delivery"
              color={COLORS.blue}
              onPress={() => changeStatus(order.id, "IN_TRANSIT")}
            />

            <StatusButton
              label="Delivered"
              color={COLORS.teal}
              onPress={() => changeStatus(order.id, "DELIVERED")}
            />
          </>
        ) : (
          <StatusButton
            label="Picked Up"
            color={COLORS.teal}
            onPress={() => changeStatus(order.id, "PICKED_UP")}
          />
        )}

        <StatusButton
          label="Cancel"
          color={COLORS.danger}
          onPress={() => changeStatus(order.id, "CANCELLED")}
        />
      </View>
    );
  }

  if (accessChecking) {
    return (
      <View style={styles.lockContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
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
                <Text style={styles.title}>Farmer Orders</Text>
                <Text style={styles.subtitle}>
                  {farmName || "Your Farm"} fulfillment dashboard
                </Text>
              </View>
            </View>

            <View style={styles.heroCard}>
              <View style={styles.heroTextBlock}>
                <Text style={styles.heroBadge}>Order Operations</Text>
                <Text style={styles.heroTitle}>Manage customer orders</Text>
                <Text style={styles.heroText}>
                  Accept, prepare, mark ready, route delivery, and complete
                  Farm2Home orders.
                </Text>
              </View>

              <Text style={styles.heroEmoji}>📦</Text>
            </View>

            <View style={styles.statsGrid}>
              <StatCard label="Total Orders" value={String(summary.total)} />
              <StatCard label="Active" value={String(summary.active)} />
              <StatCard label="Farm Revenue" value={`$${summary.revenue.toFixed(2)}`} />
            </View>

            {loading && (
              <View style={styles.loadingCard}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={styles.emptyText}>Loading farmer orders...</Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>📦</Text>
              <Text style={styles.emptyTitle}>No paid orders yet</Text>
              <Text style={styles.emptyText}>
                Orders for {farmName || "your farm"} will appear here after
                customer checkout.
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
            <View style={styles.orderCard}>
              <View style={styles.cardHeader}>
                <View style={styles.orderIconBox}>
                  <Text style={styles.orderIcon}>🧺</Text>
                </View>

                <View style={styles.orderHeaderText}>
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

              <View style={styles.customerCard}>
                <Text style={styles.customerTitle}>Customer</Text>
                <Text style={styles.customerText}>
                  {item.customerName || item.customerEmail || "Customer"}
                </Text>
                <Text style={styles.customerText}>
                  Phone: {item.deliveryInfo?.phone || "Not provided"}
                </Text>
              </View>

              <Text style={styles.sectionLabel}>Your Farm Items</Text>

              {farmerItems.length === 0 ? (
                <Text style={styles.noItemsText}>
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

function StatusButton({
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
        styles.statusButton,
        { backgroundColor: color },
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  lockContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  lockTitle: {
    color: COLORS.danger,
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center",
  },
  lockText: {
    marginTop: 14,
    color: COLORS.muted,
    fontWeight: "900",
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
    fontSize: 19,
    fontWeight: "900",
  },
  statLabel: {
    color: COLORS.muted,
    fontWeight: "800",
    fontSize: 11,
    marginTop: 3,
  },
  loadingCard: {
    backgroundColor: COLORS.card,
    borderRadius: 28,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  emptyBox: {
    backgroundColor: COLORS.card,
    borderRadius: 28,
    alignItems: "center",
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
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
    fontSize: 15,
    textAlign: "center",
    lineHeight: 23,
    marginTop: 10,
    fontWeight: "700",
  },
  orderCard: {
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
  sectionLabel: {
    fontSize: 17,
    fontWeight: "900",
    color: COLORS.text,
    marginTop: 4,
    marginBottom: 8,
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
  noItemsText: {
    color: COLORS.muted,
    fontWeight: "700",
    marginBottom: 10,
  },
  infoBox: {
    backgroundColor: "#FFF7ED",
    padding: 14,
    borderRadius: 22,
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
  statusActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statusButton: {
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 14,
  },
  actionText: {
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