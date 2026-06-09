// app/farmer/orders.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
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

function money(value: any) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function normalize(value: any) {
  return String(value || "").trim().toLowerCase();
}

function isFreightItem(item: any) {
  const name = normalize(item.name || item.productName);
  const category = normalize(item.category);

  return (
    name.includes("livestock") ||
    name.includes("cattle") ||
    name.includes("cow") ||
    name.includes("goat") ||
    name.includes("pig") ||
    name.includes("sheep") ||
    name.includes("horse") ||
    name.includes("bale") ||
    name.includes("hay") ||
    category.includes("livestock") ||
    category.includes("hay")
  );
}

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

      const saved =
        (await AsyncStorage.getItem("currentFarmer")) ||
        (await AsyncStorage.getItem("currentUser"));

      if (!saved) {
        router.replace("/farmer/login" as any);
        return;
      }

      const farmer = JSON.parse(saved);
      const allowed = await checkFarmerAccess(farmer);

      if (!allowed) return;

      const currentFarmName =
        farmer.farmName ||
        farmer.farm_name ||
        farmer.businessName ||
        farmer.business_name ||
        farmer.name ||
        "";

      const currentFarmerId = farmer.id || farmer.farmerId || "";

      setFarmName(currentFarmName);
      setFarmerId(currentFarmerId);
      setFarmerEmail(farmer.email || "");

      setLoading(true);

      const cloudOrders = await loadSupabaseOrders(currentFarmName, currentFarmerId);

      if (cloudOrders.length > 0) {
        setOrders(cloudOrders);
        return;
      }

      const farmerOrders = await getOrdersForFarmer(currentFarmName);
      setOrders(farmerOrders);
    } catch (error) {
      console.log("Farmer orders load error:", error);
      setOrders([]);
    } finally {
      setLoading(false);
      setAccessChecking(false);
    }
  }

  async function loadSupabaseOrders(currentFarmName: string, currentFarmerId: string) {
    let query = supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.log("Supabase farmer orders error:", error.message);
      return [];
    }

    const mapped = (data || []).map((order: any) => {
      const rawItems = Array.isArray(order.items)
        ? order.items
        : Array.isArray(order.order_items)
        ? order.order_items
        : [];

      return {
        id: String(order.id),
        customerEmail: order.customer_email || "",
        customerName: order.customer_name || "",
        items: rawItems.map((item: any) => ({
          id: String(item.id || item.product_id || item.productId || ""),
          productId: item.product_id || item.productId || item.id || "",
          name: item.name || item.product_name || item.productName || "Farm Product",
          price: Number(item.price || 0),
          quantity: Number(item.quantity || 0),
          farmName: item.farmName || item.farm_name || currentFarmName,
          farmerId: item.farmerId || item.farmer_id || order.farmer_id || "",
          category: item.category || "",
        })),
        subtotal: Number(order.subtotal || 0),
        deliveryFee: Number(order.delivery_fee || 0),
        tip: Number(order.tip || 0),
        total: Number(order.total || 0),
        deliveryInfo: {
          deliveryAddress:
            order.delivery_info?.deliveryAddress ||
            order.delivery_info?.delivery_address ||
            order.delivery_address ||
            "",
          city: order.delivery_info?.city || order.city || "",
          state: order.delivery_info?.state || order.state || "",
          zipCode:
            order.delivery_info?.zipCode ||
            order.delivery_info?.zip_code ||
            order.zip_code ||
            "",
          phone: order.delivery_info?.phone || order.phone || "",
          deliveryInstructions:
            order.delivery_info?.deliveryInstructions ||
            order.delivery_info?.delivery_instructions ||
            order.delivery_instructions ||
            "",
          deliveryOption:
            order.delivery_info?.deliveryOption ||
            order.delivery_option ||
            "Delivery",
        },
        status: order.status || "PAID",
        paymentStatus: order.payment_status || "PAID",
        createdAt: order.created_at,
        updatedAt: order.updated_at || order.created_at,
      } as Farm2HomeOrder;
    });

    return mapped.filter((order) => {
      const items = order.items || [];

      return items.some((item: any) => {
        const itemFarm = normalize(item.farmName);
        const itemFarmerId = String(item.farmerId || item.farmer_id || "");

        return (
          itemFarmerId === currentFarmerId ||
          itemFarm === normalize(currentFarmName)
        );
      });
    });
  }

  function getFarmerItems(order: Farm2HomeOrder) {
    return (order.items || []).filter((item: any) => {
      const itemFarm = normalize(item.farmName);
      const itemFarmerId = String(item.farmerId || item.farmer_id || "");

      return itemFarmerId === farmerId || itemFarm === normalize(farmName);
    });
  }

  async function changeStatus(orderId: string, status: OrderStatus) {
    try {
      const allowed = await checkFarmerAccess();
      if (!allowed) return;

      await supabase
        .from("orders")
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      await updateOrderStatus(orderId, status);
      await loadOrders();

      Alert.alert("Order Updated", `Order marked as ${status}.`);
    } catch (error) {
      console.log("Update farmer order status error:", error);
      Alert.alert("Update Error", "Unable to update order status.");
    }
  }

  async function postToDriverBoard(order: Farm2HomeOrder) {
    try {
      const items = getFarmerItems(order);
      const subtotal = items.reduce(
        (sum: number, item: any) =>
          sum + Number(item.price || 0) * Number(item.quantity || 0),
        0
      );

      const payload = {
        order_id: order.id,
        farmer_id: farmerId,
        farm_name: farmName,
        customer_name: order.customerName || order.customerEmail || "Customer",
        customer_phone: order.deliveryInfo?.phone || "",
        pickup_address: "Farm pickup location",
        dropoff_address: `${order.deliveryInfo?.deliveryAddress || ""}, ${
          order.deliveryInfo?.city || ""
        }, ${order.deliveryInfo?.state || ""} ${order.deliveryInfo?.zipCode || ""}`,
        delivery_fee: Number(order.deliveryFee || subtotal * 0.08 || 8),
        payout_amount: Number(order.deliveryFee || subtotal * 0.08 || 8),
        miles: 0,
        status: "available",
        source: "farmer_orders",
        items,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("delivery_orders").insert(payload);

      if (error) throw error;

      await changeStatus(order.id, "DRIVER_ASSIGNED");
      Alert.alert("Posted", "Order posted to the Farm2Driver board.");
    } catch (error: any) {
      Alert.alert("Post Error", error?.message || "Unable to post to driver board.");
    }
  }

  async function createFreightLoad(order: Farm2HomeOrder) {
    try {
      const items = getFarmerItems(order);
      const freightItems = items.filter(isFreightItem);

      if (freightItems.length === 0) {
        Alert.alert("No Freight Items", "This order does not contain hay or livestock.");
        return;
      }

      const productTotal = freightItems.reduce(
        (sum: number, item: any) =>
          sum + Number(item.price || 0) * Number(item.quantity || 0),
        0
      );

      const payload = {
        order_id: order.id,
        farmer_id: farmerId,
        farm_name: farmName,
        customer_name: order.customerName || order.customerEmail || "Customer",
        pickup_address: "Farm pickup location",
        dropoff_address: `${order.deliveryInfo?.deliveryAddress || ""}, ${
          order.deliveryInfo?.city || ""
        }, ${order.deliveryInfo?.state || ""} ${order.deliveryInfo?.zipCode || ""}`,
        load_type: "Farm freight",
        products: freightItems,
        product_total: productTotal,
        cost_per_mile: 2.25,
        freight_total: Number((productTotal + 25).toFixed(2)),
        total_due: Number((productTotal + 25).toFixed(2)),
        status: "available",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("freight_loads").insert(payload);

      if (error) throw error;

      Alert.alert("Freight Load Created", "Hay/livestock load was posted to freight.");
    } catch (error: any) {
      Alert.alert("Freight Error", error?.message || "Unable to create freight load.");
    }
  }

  function openCustomerChat(order: Farm2HomeOrder) {
    router.push({
      pathname: "/chat/chat-center",
      params: {
        conversationId: `order_${order.id}`,
        orderId: order.id,
        role: "farmer",
      },
    } as any);
  }

  function openDriverChat(order: Farm2HomeOrder) {
    router.push({
      pathname: "/farmer/driver-chat",
      params: {
        orderId: order.id,
        farmerId,
      },
    } as any);
  }

  function openCustomerDriverChat(order: Farm2HomeOrder) {
    router.push({
      pathname: "/farmer/customer-driver-chat",
      params: {
        orderId: order.id,
        farmerId,
      },
    } as any);
  }

  function openTracking(order: Farm2HomeOrder) {
    router.push({
      pathname: "/customer/order-tracking",
      params: { orderId: order.id },
    } as any);
  }

  function getStatusColor(status: string) {
    switch (String(status || "").toUpperCase()) {
      case "PAID":
      case "PENDING_PAYMENT":
        return COLORS.blue;
      case "ACCEPTED":
        return COLORS.primary;
      case "PREPARING":
        return COLORS.orange;
      case "READY_FOR_PICKUP":
      case "READY":
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
    switch (String(status || "").toUpperCase()) {
      case "PENDING_PAYMENT":
        return "PENDING PAYMENT";
      case "READY_FOR_PICKUP":
        return "READY";
      case "IN_TRANSIT":
        return "OUT FOR DELIVERY";
      default:
        return String(status || "NEW").replace(/_/g, " ");
    }
  }

  function getOrderDate(order: Farm2HomeOrder) {
    const dateValue = (order as any).createdAt || (order as any).created_at || "";
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
          (itemSum: number, product: any) =>
            itemSum + Number(product.price || 0) * Number(product.quantity || 0),
          0
        )
      );
    }, 0);

    return { total: orders.length, active, revenue };
  }, [orders, farmName, farmerId]);

  function renderStatusButtons(order: Farm2HomeOrder) {
    return (
      <View style={styles.statusActions}>
        <StatusButton label="Accept" color={COLORS.primary} onPress={() => changeStatus(order.id, "ACCEPTED")} />
        <StatusButton label="Preparing" color={COLORS.orange} onPress={() => changeStatus(order.id, "PREPARING")} />
        <StatusButton label="Ready" color={COLORS.purple} onPress={() => changeStatus(order.id, "READY_FOR_PICKUP")} />

        {order.deliveryInfo?.deliveryOption === "Delivery" ? (
          <>
            <StatusButton label="Post Driver Board" color={COLORS.blue} onPress={() => postToDriverBoard(order)} />
            <StatusButton label="Out for Delivery" color={COLORS.teal} onPress={() => changeStatus(order.id, "IN_TRANSIT")} />
            <StatusButton label="Delivered" color={COLORS.primaryDark} onPress={() => changeStatus(order.id, "DELIVERED")} />
          </>
        ) : (
          <StatusButton label="Picked Up" color={COLORS.teal} onPress={() => changeStatus(order.id, "PICKED_UP")} />
        )}

        <StatusButton label="Cancel" color={COLORS.danger} onPress={() => changeStatus(order.id, "CANCELLED")} />
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
                style={({ pressed }) => [styles.backCircle, pressed && styles.pressed]}
                onPress={() => router.replace("/farmer/dashboard" as any)}
              >
                <Text style={styles.backCircleText}>‹</Text>
              </Pressable>

              <View style={styles.topTitleBlock}>
                <Text style={styles.title}>Farmer Orders</Text>
                <Text style={styles.subtitle}>{farmName || "Farm Operations"}</Text>
              </View>
            </View>

            <View style={styles.heroCard}>
              <Text style={styles.heroBadge}>Order Operations</Text>
              <Text style={styles.heroTitle}>Manage customer fulfillment</Text>
              <Text style={styles.heroText}>
                Accept orders, prepare products, assign delivery, post driver jobs, create freight loads, and message customers or drivers.
              </Text>
            </View>

            <View style={styles.statsGrid}>
              <StatCard label="Total Orders" value={String(summary.total)} />
              <StatCard label="Active" value={String(summary.active)} />
              <StatCard label="Farm Revenue" value={money(summary.revenue)} />
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
              <Text style={styles.emptyInitial}>0</Text>
              <Text style={styles.emptyTitle}>No paid orders yet</Text>
              <Text style={styles.emptyText}>
                Orders for {farmName || "your farm"} will appear here after customer checkout.
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const farmerItems = getFarmerItems(item);
          const farmerSubtotal = farmerItems.reduce(
            (sum: number, product: any) =>
              sum + Number(product.price || 0) * Number(product.quantity || 0),
            0
          );
          const freightRequired = farmerItems.some(isFreightItem);

          return (
            <View style={styles.orderCard}>
              <View style={styles.cardHeader}>
                <View style={styles.orderInitialBox}>
                  <Text style={styles.orderInitial}>{item.id.slice(-1).toUpperCase()}</Text>
                </View>

                <View style={styles.orderHeaderText}>
                  <Text style={styles.orderId}>Order #{item.id.slice(-8)}</Text>
                  <Text style={styles.dateText}>{getOrderDate(item)}</Text>
                </View>

                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
                  <Text style={styles.statusText}>{getFriendlyStatus(item.status)}</Text>
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

              <Text style={styles.sectionLabel}>Farm Items</Text>

              {farmerItems.length === 0 ? (
                <Text style={styles.noItemsText}>
                  No items from this farm were found on this order.
                </Text>
              ) : (
                farmerItems.map((product: any, index: number) => (
                  <View key={`${product.id}-${index}`} style={styles.productRow}>
                    <View style={styles.productInitialBox}>
                      <Text style={styles.productInitial}>
                        {String(product.name || "P").slice(0, 1).toUpperCase()}
                      </Text>
                    </View>

                    <View style={styles.productInfo}>
                      <Text style={styles.productName}>{product.name}</Text>
                      <Text style={styles.productMeta}>
                        Qty {product.quantity} · {money(product.price)} each
                      </Text>
                    </View>

                    <Text style={styles.productTotal}>
                      {money(Number(product.price || 0) * Number(product.quantity || 0))}
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
                    Address: {item.deliveryInfo?.deliveryAddress}, {item.deliveryInfo?.city},{" "}
                    {item.deliveryInfo?.state} {item.deliveryInfo?.zipCode}
                  </Text>
                ) : (
                  <Text style={styles.infoText}>Customer will pick up from farm.</Text>
                )}

                {!!item.deliveryInfo?.deliveryInstructions && (
                  <Text style={styles.infoText}>
                    Instructions: {item.deliveryInfo.deliveryInstructions}
                  </Text>
                )}

                {freightRequired && (
                  <Text style={styles.freightText}>
                    Freight required: hay or livestock detected.
                  </Text>
                )}
              </View>

              <View style={styles.totalBox}>
                <Text style={styles.totalLabel}>Farm Subtotal</Text>
                <Text style={styles.total}>{money(farmerSubtotal)}</Text>
              </View>

              <View style={styles.routeGrid}>
                <RouteButton label="Customer Chat" onPress={() => openCustomerChat(item)} />
                <RouteButton label="Driver Chat" onPress={() => openDriverChat(item)} />
                <RouteButton label="Monitor Chat" onPress={() => openCustomerDriverChat(item)} />
                <RouteButton label="Tracking" onPress={() => openTracking(item)} />
              </View>

              {freightRequired && (
                <Pressable
                  style={({ pressed }) => [styles.freightButton, pressed && styles.pressed]}
                  onPress={() => createFreightLoad(item)}
                >
                  <Text style={styles.freightButtonText}>Create Freight Load</Text>
                </Pressable>
              )}

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

function RouteButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.routeButton, pressed && styles.pressed]} onPress={onPress}>
      <Text style={styles.routeButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },
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
  listContent: { padding: 18, paddingBottom: 120 },
  topBar: { flexDirection: "row", alignItems: "center", marginBottom: 18, gap: 12 },
  backCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.card,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  backCircleText: {
    fontSize: 32,
    color: COLORS.text,
    fontWeight: "900",
    marginTop: -4,
  },
  topTitleBlock: { flex: 1 },
  title: { fontSize: 30, fontWeight: "900", color: COLORS.text },
  subtitle: { color: COLORS.muted, fontWeight: "700", marginTop: 3 },
  heroCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
  },
  heroBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.18)",
    color: "#FFFFFF",
    fontWeight: "900",
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: 10,
    fontSize: 12,
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
  statsGrid: { flexDirection: "row", gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statValue: { color: COLORS.primary, fontSize: 17, fontWeight: "900" },
  statLabel: {
    color: COLORS.muted,
    fontWeight: "800",
    fontSize: 11,
    marginTop: 3,
  },
  loadingCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  emptyBox: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    alignItems: "center",
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyInitial: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: COLORS.softGreen,
    color: COLORS.primary,
    textAlign: "center",
    textAlignVertical: "center",
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 10,
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
    borderRadius: 18,
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
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  orderInitialBox: {
    width: 52,
    height: 52,
    borderRadius: 15,
    backgroundColor: COLORS.primaryDark,
    justifyContent: "center",
    alignItems: "center",
  },
  orderInitial: { color: "#FFFFFF", fontWeight: "900", fontSize: 22 },
  orderHeaderText: { flex: 1 },
  orderId: { fontSize: 18, fontWeight: "900", color: COLORS.text },
  dateText: { color: COLORS.muted, marginTop: 4, fontWeight: "700", fontSize: 12 },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  statusText: { color: "#FFFFFF", fontWeight: "900", fontSize: 11 },
  customerCard: {
    backgroundColor: COLORS.lightGreen,
    padding: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
  },
  customerTitle: { color: COLORS.primary, fontWeight: "900", fontSize: 13, marginBottom: 5 },
  customerText: { color: COLORS.text, fontWeight: "800", marginBottom: 4 },
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
    borderRadius: 14,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  productInitialBox: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: COLORS.card,
    justifyContent: "center",
    alignItems: "center",
  },
  productInitial: { color: COLORS.primaryDark, fontSize: 18, fontWeight: "900" },
  productInfo: { flex: 1 },
  productName: { fontWeight: "900", color: COLORS.text, marginBottom: 4 },
  productMeta: { color: COLORS.muted, fontWeight: "700", fontSize: 12 },
  productTotal: { color: COLORS.primary, fontWeight: "900" },
  noItemsText: { color: COLORS.muted, fontWeight: "700", marginBottom: 10 },
  infoBox: {
    backgroundColor: "#FFF7ED",
    padding: 14,
    borderRadius: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#FED7AA",
  },
  infoTitle: { color: "#9A3412", fontWeight: "900", fontSize: 16, marginBottom: 7 },
  infoText: { color: "#7C2D12", marginBottom: 4, lineHeight: 20, fontWeight: "700" },
  freightText: { color: COLORS.danger, fontWeight: "900", marginTop: 6 },
  totalBox: {
    marginTop: 14,
    marginBottom: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 12,
  },
  totalLabel: { color: COLORS.muted, fontWeight: "800", marginBottom: 4 },
  total: { fontSize: 23, fontWeight: "900", color: COLORS.primary },
  routeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  routeButton: {
    backgroundColor: COLORS.lightGreen,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  routeButtonText: { color: COLORS.primary, fontWeight: "900", fontSize: 12 },
  freightButton: {
    backgroundColor: COLORS.dark,
    padding: 13,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 10,
  },
  freightButtonText: { color: "#FFFFFF", fontWeight: "900" },
  statusActions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statusButton: { paddingHorizontal: 13, paddingVertical: 11, borderRadius: 12 },
  actionText: { color: "#FFFFFF", fontWeight: "900", fontSize: 12 },
  backButton: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 18,
    backgroundColor: COLORS.dark,
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  backText: { color: "#FFFFFF", fontWeight: "900" },
  pressed: { opacity: 0.75 },
});