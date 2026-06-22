// app/customer/my-orders.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { addToCart, clearCart } from "../data/cartStore";
import { supabase } from "../data/supabaseClient";

/**
 * app/customer/my-orders.tsx
 *
 * Full customer order center.
 *
 * Reads from:
 * - orders
 * - customer_orders
 * - farm_orders
 * - order_items
 * - customer_order_items
 * - farm_order_items
 *
 * Supports multi-farmer orders:
 * Each farmer section inside an order shows its own farm subtotal/status/items.
 *
 * Working buttons:
 * - Track Order -> /customer/tracking
 * - View Details -> /customer/order-detail
 * - Contact Farmer -> /customer/farmer-chat
 * - Contact Driver -> /customer/driver-chat
 * - Reorder -> cart then /customer/cart
 * - Marketplace -> /customer/marketplace
 */

const COLORS = {
  bg: "#F4F5F7",
  card: "#FFFFFF",
  surface: "#F9FAFB",
  black: "#050505",
  red: "#D71920",
  redDark: "#9F1117",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  green: "#16A34A",
  greenDark: "#14532D",
  greenSoft: "#DCFCE7",
  amber: "#F59E0B",
  amberSoft: "#FEF3C7",
  blue: "#2563EB",
  blueSoft: "#DBEAFE",
  purple: "#7C3AED",
  purpleSoft: "#EDE9FE",
  danger: "#DC2626",
  dangerSoft: "#FEE2E2",
  white: "#FFFFFF",
};

type CustomerSession = {
  id?: string;
  customerId?: string;
  customer_id?: string;
  email?: string;
  full_name?: string;
  fullName?: string;
  name?: string;
};

type OrderItem = {
  id: string;
  order_id?: string;
  customer_id?: string;
  farmer_id?: string;
  farmerId?: string;
  farm_name?: string;
  farmName?: string;
  product_id?: string;
  productId?: string;
  product_name?: string;
  productName?: string;
  name?: string;
  quantity?: number;
  price?: number;
  unit_price?: number;
  line_total?: number;
  lineTotal?: number;
  status?: string;
  image?: string;
  imageUrl?: string;
  image_url?: string;
  farmer_email?: string;
  farmerEmail?: string;
  driver_id?: string;
  driverId?: string;
  driver_name?: string;
  driverName?: string;
};

type FarmGroup = {
  farmKey: string;
  farmerId: string;
  farmName: string;
  status: string;
  subtotal: number;
  itemCount: number;
  farmerEmail?: string;
  driverId?: string;
  driverName?: string;
  items: OrderItem[];
};

type CustomerOrder = {
  id: string;
  orderId?: string;
  order_id?: string;
  customer_id?: string;
  customerId?: string;
  customer_email?: string;
  customerEmail?: string;
  customer_name?: string;
  customerName?: string;
  status?: string;
  payment_status?: string;
  subtotal?: number;
  service_fee?: number;
  platform_fee?: number;
  delivery_fee?: number;
  freight_handling_fee?: number;
  tip?: number;
  total?: number;
  delivery_option?: string;
  deliveryOption?: string;
  delivery_address?: string;
  deliveryAddress?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  zipCode?: string;
  phone?: string;
  delivery_instructions?: string;
  deliveryInstructions?: string;
  items?: OrderItem[];
  payout_splits?: any[];
  payoutSplits?: any[];
  stripe_checkout_session_id?: string;
  stripe_payment_intent_id?: string;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
  farmGroups?: FarmGroup[];
};

function clean(value: any) {
  return String(value ?? "").trim();
}

function normalize(value: any) {
  return clean(value).toLowerCase();
}

function money(value: any) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function dateLabel(value: any) {
  const raw = clean(value);
  if (!raw) return "Not listed";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function timeLabel(value: any) {
  const raw = clean(value);
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getCustomerId(customer: CustomerSession | null) {
  return clean(customer?.id || customer?.customer_id || customer?.customerId);
}

function getCustomerName(customer: CustomerSession | null) {
  return clean(customer?.full_name || customer?.fullName || customer?.name || "Customer");
}

function getOrderId(order: any) {
  return clean(order?.id || order?.order_id || order?.orderId);
}

function getOrderStatus(order: any) {
  return clean(order?.status || order?.payment_status || "Pending");
}

function getStatusTone(statusValue: any) {
  const status = normalize(statusValue);

  if (["paid", "complete", "completed", "delivered"].includes(status)) return "green";
  if (["out_for_delivery", "out for delivery", "driver_assigned", "driver assigned", "in_transit", "in transit"].includes(status)) return "blue";
  if (["pending", "pending_payment", "pending payment", "farmer preparing", "preparing", "ready for pickup"].includes(status)) return "amber";
  if (["cancelled", "canceled", "failed", "refunded"].includes(status)) return "danger";

  return "amber";
}

function prettyStatus(value: any) {
  const status = clean(value || "Pending").replace(/_/g, " ");
  return status
    .split(" ")
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function getProductName(item: any) {
  return clean(item?.product_name || item?.productName || item?.name || "Farm Product");
}

function getFarmName(item: any) {
  return clean(item?.farm_name || item?.farmName || item?.farmerName || "Farm2Home Farm");
}

function getFarmerId(item: any) {
  return clean(item?.farmer_id || item?.farmerId);
}

function getProductId(item: any) {
  return clean(item?.product_id || item?.productId || item?.id);
}

function getItemImage(item: any) {
  return clean(item?.image || item?.imageUrl || item?.image_url);
}

function getQuantity(item: any) {
  const qty = Number(item?.quantity || 0);
  return Number.isFinite(qty) && qty > 0 ? qty : 1;
}

function getPrice(item: any) {
  const price = Number(item?.price || item?.unit_price || 0);
  return Number.isFinite(price) ? price : 0;
}

function getLineTotal(item: any) {
  const line = Number(item?.line_total || item?.lineTotal);
  if (Number.isFinite(line) && line > 0) return line;
  return getPrice(item) * getQuantity(item);
}

function normalizeItem(item: any, orderId = ""): OrderItem {
  const id = clean(item?.id || `${orderId}_${getProductId(item)}_${Math.random()}`);

  return {
    ...item,
    id,
    order_id: clean(item?.order_id || item?.orderId || orderId),
    farmer_id: getFarmerId(item),
    farmerId: getFarmerId(item),
    farm_name: getFarmName(item),
    farmName: getFarmName(item),
    product_id: getProductId(item),
    productId: getProductId(item),
    product_name: getProductName(item),
    productName: getProductName(item),
    name: getProductName(item),
    quantity: getQuantity(item),
    price: getPrice(item),
    line_total: getLineTotal(item),
    lineTotal: getLineTotal(item),
    status: clean(item?.status || "Pending"),
    image: getItemImage(item),
    imageUrl: getItemImage(item),
    image_url: getItemImage(item),
    farmer_email: clean(item?.farmer_email || item?.farmerEmail),
    farmerEmail: clean(item?.farmer_email || item?.farmerEmail),
    driver_id: clean(item?.driver_id || item?.driverId),
    driverId: clean(item?.driver_id || item?.driverId),
    driver_name: clean(item?.driver_name || item?.driverName),
    driverName: clean(item?.driver_name || item?.driverName),
  };
}

function groupItemsByFarm(items: OrderItem[], payoutSplits: any[] = []): FarmGroup[] {
  const groups = new Map<string, FarmGroup>();

  items.forEach((rawItem) => {
    const item = normalizeItem(rawItem, rawItem.order_id);
    const farmerId = getFarmerId(item);
    const farmName = getFarmName(item);
    const key = farmerId || farmName;

    if (!groups.has(key)) {
      groups.set(key, {
        farmKey: key,
        farmerId,
        farmName,
        status: clean(item.status || "Pending"),
        subtotal: 0,
        itemCount: 0,
        farmerEmail: clean(item.farmer_email || item.farmerEmail),
        driverId: clean(item.driver_id || item.driverId),
        driverName: clean(item.driver_name || item.driverName),
        items: [],
      });
    }

    const group = groups.get(key)!;
    group.items.push(item);
    group.subtotal += getLineTotal(item);
    group.itemCount += getQuantity(item);

    if (normalize(item.status) && normalize(item.status) !== "pending") {
      group.status = item.status || group.status;
    }

    if (!group.farmerEmail) group.farmerEmail = clean(item.farmer_email || item.farmerEmail);
    if (!group.driverId) group.driverId = clean(item.driver_id || item.driverId);
    if (!group.driverName) group.driverName = clean(item.driver_name || item.driverName);
  });

  payoutSplits.forEach((split) => {
    const farmerId = clean(split.farmerId || split.farmer_id);
    const farmName = clean(split.farmName || split.farm_name || "Farm2Home Farm");
    const key = farmerId || farmName;

    if (!groups.has(key)) {
      groups.set(key, {
        farmKey: key,
        farmerId,
        farmName,
        status: clean(split.status || "Pending"),
        subtotal: Number(split.subtotal || split.amount || 0),
        itemCount: Number(split.itemCount || split.item_count || 0),
        farmerEmail: clean(split.farmerEmail || split.farmer_email),
        driverId: clean(split.driverId || split.driver_id),
        driverName: clean(split.driverName || split.driver_name),
        items: [],
      });
    }
  });

  return Array.from(groups.values()).map((group) => ({
    ...group,
    subtotal: Number(group.subtotal.toFixed(2)),
  }));
}

function normalizeOrder(row: any, extraItems: OrderItem[] = []): CustomerOrder {
  const id = getOrderId(row);
  const rawItems = Array.isArray(row?.items) ? row.items : [];
  const items = [...rawItems, ...extraItems].map((item) => normalizeItem(item, id));
  const payoutSplits = Array.isArray(row?.payout_splits)
    ? row.payout_splits
    : Array.isArray(row?.payoutSplits)
      ? row.payoutSplits
      : [];

  const farmGroups = groupItemsByFarm(items, payoutSplits);

  return {
    ...row,
    id,
    orderId: id,
    order_id: id,
    customer_id: clean(row?.customer_id || row?.customerId),
    customerId: clean(row?.customer_id || row?.customerId),
    customer_email: clean(row?.customer_email || row?.customerEmail),
    customerEmail: clean(row?.customer_email || row?.customerEmail),
    customer_name: clean(row?.customer_name || row?.customerName),
    customerName: clean(row?.customer_name || row?.customerName),
    status: getOrderStatus(row),
    subtotal: Number(row?.subtotal || 0),
    service_fee: Number(row?.service_fee || row?.platform_fee || 0),
    platform_fee: Number(row?.platform_fee || row?.service_fee || 0),
    delivery_fee: Number(row?.delivery_fee || 0),
    freight_handling_fee: Number(row?.freight_handling_fee || 0),
    tip: Number(row?.tip || 0),
    total: Number(row?.total || 0),
    delivery_option: clean(row?.delivery_option || row?.deliveryOption),
    deliveryOption: clean(row?.delivery_option || row?.deliveryOption),
    delivery_address: clean(row?.delivery_address || row?.deliveryAddress),
    deliveryAddress: clean(row?.delivery_address || row?.deliveryAddress),
    items,
    payout_splits: payoutSplits,
    payoutSplits,
    created_at: clean(row?.created_at || row?.createdAt),
    createdAt: clean(row?.created_at || row?.createdAt),
    updated_at: clean(row?.updated_at || row?.updatedAt),
    updatedAt: clean(row?.updated_at || row?.updatedAt),
    farmGroups,
  };
}

export default function CustomerMyOrders() {
  const [customer, setCustomer] = useState<CustomerSession | null>(null);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadScreen();
    }, [])
  );

  const metrics = useMemo(() => {
    const totalOrders = orders.length;
    const pendingOrders = orders.filter((order) => {
      const status = normalize(order.status);
      return ["pending", "pending_payment", "pending payment", "paid", "farmer preparing", "preparing"].includes(status);
    }).length;

    const activeDeliveries = orders.filter((order) => {
      const status = normalize(order.status);
      return ["driver assigned", "driver_assigned", "out for delivery", "out_for_delivery", "in transit", "in_transit"].includes(status);
    }).length;

    const lifetimeSpend = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);

    return { totalOrders, pendingOrders, activeDeliveries, lifetimeSpend };
  }, [orders]);

  async function loadScreen() {
    try {
      setLoading(true);
      const loadedCustomer = await loadCustomer();
      await loadOrders(loadedCustomer);
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    try {
      setRefreshing(true);
      const loadedCustomer = customer || (await loadCustomer());
      await loadOrders(loadedCustomer);
    } finally {
      setRefreshing(false);
    }
  }

  async function loadCustomer() {
    const stored =
      (await AsyncStorage.getItem("currentCustomer")) ||
      (await AsyncStorage.getItem("farm2homeCurrentCustomer")) ||
      (await AsyncStorage.getItem("currentUser"));

    let localCustomer: CustomerSession | null = null;

    if (stored) {
      try {
        localCustomer = JSON.parse(stored);
        setCustomer(localCustomer);
      } catch {
        localCustomer = null;
      }
    }

    const { data: authData } = await supabase.auth.getUser();
    const authId = clean(authData?.user?.id || "");
    const authEmail = clean(authData?.user?.email || localCustomer?.email || "");

    if (!authId && !authEmail) return localCustomer;

    const dbCustomer = await fetchCustomer(authId, authEmail);

    if (dbCustomer) {
      const session = {
        ...dbCustomer,
        customerId: dbCustomer.id,
        accountId: dbCustomer.account_id,
      };

      setCustomer(session);

      await AsyncStorage.multiSet([
        ["currentCustomer", JSON.stringify(session)],
        ["farm2homeCurrentCustomer", JSON.stringify(session)],
        ["currentUser", JSON.stringify({ ...session, role: "customer" })],
      ]);

      return session;
    }

    return localCustomer;
  }

  async function fetchCustomer(id?: string, email?: string) {
    const lookupId = clean(id);
    const lookupEmail = normalize(email);

    if (lookupId) {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .or(`id.eq.${lookupId},auth_user_id.eq.${lookupId},profile_id.eq.${lookupId}`)
        .limit(1);

      if (!error && Array.isArray(data) && data[0]) return data[0];
    }

    if (lookupEmail) {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("email", lookupEmail)
        .limit(1);

      if (!error && Array.isArray(data) && data[0]) return data[0];
    }

    return null;
  }

  async function loadOrders(activeCustomer: CustomerSession | null) {
    const customerId = getCustomerId(activeCustomer);
    const customerEmail = normalize(activeCustomer?.email);

    const allOrders: CustomerOrder[] = [];

    const localOrderRaw =
      (await AsyncStorage.getItem("lastCustomerOrder")) ||
      (await AsyncStorage.getItem("currentCustomerOrder"));

    if (localOrderRaw) {
      try {
        const localOrder = normalizeOrder(JSON.parse(localOrderRaw));
        if (localOrder.id) allOrders.push(localOrder);
      } catch {
        // skip
      }
    }

    const orderTables = ["orders", "customer_orders", "farm_orders"];

    for (const table of orderTables) {
      try {
        let query = supabase.from(table).select("*").order("created_at", { ascending: false }).limit(100);

        if (customerId && customerEmail) {
          query = query.or(`customer_id.eq.${customerId},customerId.eq.${customerId},customer_email.eq.${customerEmail},customerEmail.eq.${customerEmail}`);
        } else if (customerId) {
          query = query.or(`customer_id.eq.${customerId},customerId.eq.${customerId}`);
        } else if (customerEmail) {
          query = query.or(`customer_email.eq.${customerEmail},customerEmail.eq.${customerEmail}`);
        } else {
          continue;
        }

        const { data, error } = await query;

        if (!error && Array.isArray(data)) {
          for (const row of data) {
            const id = getOrderId(row);
            const items = await fetchOrderItems(id);
            allOrders.push(normalizeOrder(row, items));
          }
        }
      } catch (error) {
        console.log(`${table} load skipped:`, error);
      }
    }

    const unique = Array.from(
      new Map(allOrders.filter((order) => order.id).map((order) => [order.id, order])).values()
    ).sort((a, b) => {
      const ad = new Date(a.created_at || a.createdAt || 0).getTime();
      const bd = new Date(b.created_at || b.createdAt || 0).getTime();
      return bd - ad;
    });

    setOrders(unique);
  }

  async function fetchOrderItems(orderId: string) {
    if (!orderId) return [];

    const itemTables = ["order_items", "customer_order_items", "farm_order_items"];

    for (const table of itemTables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select("*")
          .eq("order_id", orderId)
          .limit(200);

        if (!error && Array.isArray(data) && data.length > 0) {
          return data.map((item) => normalizeItem(item, orderId));
        }
      } catch {
        // try next
      }
    }

    return [];
  }

  function viewDetails(order: CustomerOrder) {
    router.push({
      pathname: "/customer/order-detail" as any,
      params: { orderId: order.id },
    });
  }

  function trackOrder(order: CustomerOrder) {
    router.push({
      pathname: "/customer/tracking" as any,
      params: { orderId: order.id },
    });
  }

  function contactFarmer(order: CustomerOrder, farm?: FarmGroup) {
    const firstFarm = farm || order.farmGroups?.[0];

    router.push({
      pathname: "/customer/farmer-chat" as any,
      params: {
        orderId: order.id,
        farmerId: firstFarm?.farmerId || "",
        farmName: firstFarm?.farmName || "",
        farmerEmail: firstFarm?.farmerEmail || "",
      },
    });
  }

  function contactDriver(order: CustomerOrder, farm?: FarmGroup) {
    const firstFarm = farm || order.farmGroups?.find((group) => group.driverId) || order.farmGroups?.[0];

    router.push({
      pathname: "/customer/driver-chat" as any,
      params: {
        orderId: order.id,
        driverId: firstFarm?.driverId || "",
        driverName: firstFarm?.driverName || "",
      },
    });
  }

  async function reorder(order: CustomerOrder) {
    const items = order.items || [];

    if (!items.length) {
      Alert.alert("Reorder Unavailable", "This order does not have saved order items.");
      return;
    }

    Alert.alert("Reorder", "Clear your cart and add these items again?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reorder",
        onPress: async () => {
          try {
            await clearCart();

            for (const item of items) {
              await addToCart({
                id: `${getFarmerId(item)}_${getProductId(item)}`,
                cartItemId: `${getFarmerId(item)}_${getProductId(item)}`,
                productId: getProductId(item),
                product_id: getProductId(item),
                name: getProductName(item),
                productName: getProductName(item),
                product_name: getProductName(item),
                price: getPrice(item),
                quantity: getQuantity(item),
                image: getItemImage(item),
                imageUrl: getItemImage(item),
                image_url: getItemImage(item),
                farmName: getFarmName(item),
                farm_name: getFarmName(item),
                farmerName: getFarmName(item),
                farmerId: getFarmerId(item),
                farmer_id: getFarmerId(item),
                unit: clean((item as any).unit || "each"),
                category: clean((item as any).category || ""),
              } as any);
            }

            router.push("/customer/cart" as any);
          } catch (error: any) {
            Alert.alert("Reorder Error", error?.message || "Unable to reorder.");
          }
        },
      },
    ]);
  }

  function downloadReceipt(order: CustomerOrder) {
    Alert.alert(
      "Receipt",
      "Receipt export screen is not built yet. The order details screen will show the full receipt information.",
      [{ text: "View Details", onPress: () => viewDetails(order) }, { text: "Close", style: "cancel" }]
    );
  }

  function renderHeader() {
    return (
      <View>
        <View style={styles.hero}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.push("/customer/dashboard" as any)}
            activeOpacity={0.9}
          >
            <Ionicons name="arrow-back-outline" size={18} color={COLORS.white} />
            <Text style={styles.backButtonText}>Dashboard</Text>
          </TouchableOpacity>

          <View style={styles.heroIcon}>
            <Ionicons name="receipt-outline" size={34} color={COLORS.white} />
          </View>

          <Text style={styles.kicker}>Farm2Home Orders</Text>
          <Text style={styles.heroTitle}>My Orders</Text>
          <Text style={styles.heroText}>
            Track farm purchases, multi-farmer fulfillment, driver delivery, and receipts.
          </Text>
        </View>

        <View style={styles.metricsRow}>
          <MetricCard icon="receipt-outline" label="Total Orders" value={`${metrics.totalOrders}`} tone="red" />
          <MetricCard icon="time-outline" label="Pending" value={`${metrics.pendingOrders}`} tone="amber" />
          <MetricCard icon="navigate-outline" label="Deliveries" value={`${metrics.activeDeliveries}`} tone="blue" />
          <MetricCard icon="cash-outline" label="Spent" value={money(metrics.lifetimeSpend)} tone="green" />
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Recent Orders</Text>
            <Text style={styles.sectionSubtitle}>
              {orders.length} order{orders.length === 1 ? "" : "s"} found for {getCustomerName(customer)}
            </Text>
          </View>

          <TouchableOpacity style={styles.marketButton} onPress={() => router.push("/customer/marketplace" as any)}>
            <Ionicons name="storefront-outline" size={16} color={COLORS.red} />
            <Text style={styles.marketButtonText}>Shop</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  function renderOrder({ item }: { item: CustomerOrder }) {
    const tone = getStatusTone(item.status);
    const groups = item.farmGroups || [];

    return (
      <View style={styles.orderCard}>
        <View style={styles.orderHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.orderNumber}>Order #{item.id.slice(-8).toUpperCase()}</Text>
            <Text style={styles.orderDate}>
              {dateLabel(item.created_at || item.createdAt)} {timeLabel(item.created_at || item.createdAt)}
            </Text>
          </View>

          <StatusBadge status={item.status || "Pending"} tone={tone as any} />
        </View>

        <View style={styles.orderSummaryRow}>
          <SummaryPill label="Total" value={money(item.total)} />
          <SummaryPill label="Farms" value={`${groups.length}`} />
          <SummaryPill label="Items" value={`${groups.reduce((sum, group) => sum + group.itemCount, 0)}`} />
        </View>

        <View style={styles.farmGroupBox}>
          <Text style={styles.farmGroupTitle}>Farmer Fulfillment</Text>

          {groups.length === 0 ? (
            <Text style={styles.noItemsText}>No farmer item details saved for this order.</Text>
          ) : (
            groups.map((group) => (
              <View key={group.farmKey} style={styles.farmRow}>
                <View style={styles.farmAvatar}>
                  <Text style={styles.farmAvatarText}>{group.farmName.slice(0, 1).toUpperCase()}</Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.farmName}>{group.farmName}</Text>
                  <Text style={styles.farmMeta}>
                    {group.itemCount} item{group.itemCount === 1 ? "" : "s"} · {money(group.subtotal)}
                  </Text>
                  <Text style={styles.farmStatusText}>Status: {prettyStatus(group.status || item.status)}</Text>
                </View>

                <View style={styles.farmActions}>
                  <Pressable style={styles.smallIconButton} onPress={() => contactFarmer(item, group)}>
                    <Ionicons name="chatbubble-outline" size={15} color={COLORS.red} />
                  </Pressable>

                  <Pressable style={styles.smallIconButton} onPress={() => contactDriver(item, group)}>
                    <Ionicons name="car-outline" size={15} color={COLORS.red} />
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </View>

        {item.items && item.items.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.itemsRow}>
            {item.items.slice(0, 10).map((orderItem) => {
              const image = getItemImage(orderItem);

              return (
                <View key={orderItem.id} style={styles.productChip}>
                  {image ? (
                    <Image source={{ uri: image }} style={styles.productImage} />
                  ) : (
                    <View style={styles.productPlaceholder}>
                      <Text style={styles.productPlaceholderText}>
                        {getProductName(orderItem).slice(0, 1).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.productChipText} numberOfLines={1}>
                    {getProductName(orderItem)}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        ) : null}

        <View style={styles.actionGrid}>
          <ActionButton icon="eye-outline" label="Details" onPress={() => viewDetails(item)} />
          <ActionButton icon="navigate-outline" label="Track" onPress={() => trackOrder(item)} />
          <ActionButton icon="chatbubbles-outline" label="Farmer" onPress={() => contactFarmer(item)} />
          <ActionButton icon="car-outline" label="Driver" onPress={() => contactDriver(item)} />
          <ActionButton icon="download-outline" label="Receipt" onPress={() => downloadReceipt(item)} />
          <ActionButton icon="repeat-outline" label="Reorder" onPress={() => reorder(item)} />
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.red} size="large" />
          <Text style={styles.centerText}>Loading your orders...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        renderItem={renderOrder}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={COLORS.red} />
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="receipt-outline" size={34} color={COLORS.red} />
            </View>
            <Text style={styles.emptyTitle}>No orders yet</Text>
            <Text style={styles.emptyText}>
              Your completed Farm2Home purchases will appear here after checkout.
            </Text>
            <TouchableOpacity style={styles.emptyButton} onPress={() => router.push("/customer/marketplace" as any)}>
              <Text style={styles.emptyButtonText}>Shop Marketplace</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function MetricCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  tone: "red" | "amber" | "blue" | "green";
}) {
  const config = {
    red: { bg: "#FEE2E2", color: COLORS.red },
    amber: { bg: COLORS.amberSoft, color: "#92400E" },
    blue: { bg: COLORS.blueSoft, color: COLORS.blue },
    green: { bg: COLORS.greenSoft, color: COLORS.green },
  }[tone];

  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricIcon, { backgroundColor: config.bg }]}>
        <Ionicons name={icon} size={20} color={config.color} />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function StatusBadge({ status, tone }: { status: string; tone: "green" | "amber" | "blue" | "danger" }) {
  const config = {
    green: { bg: COLORS.greenSoft, color: COLORS.greenDark },
    amber: { bg: COLORS.amberSoft, color: "#92400E" },
    blue: { bg: COLORS.blueSoft, color: COLORS.blue },
    danger: { bg: COLORS.dangerSoft, color: COLORS.danger },
  }[tone];

  return (
    <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
      <Text style={[styles.statusBadgeText, { color: config.color }]}>
        {prettyStatus(status)}
      </Text>
    </View>
  );
}

function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryPill}>
      <Text style={styles.summaryPillValue}>{value}</Text>
      <Text style={styles.summaryPillLabel}>{label}</Text>
    </View>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]} onPress={onPress}>
      <Ionicons name={icon} size={17} color={COLORS.red} />
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  centerText: { color: COLORS.muted, fontWeight: "800" },
  listContent: { paddingBottom: 70 },
  hero: {
    backgroundColor: COLORS.black,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
  },
  backButton: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.red,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    marginBottom: 18,
  },
  backButtonText: { color: COLORS.white, fontWeight: "900" },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 24,
    backgroundColor: COLORS.red,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  kicker: {
    color: "#FCA5A5",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  heroTitle: { color: COLORS.white, fontSize: 34, fontWeight: "900", marginTop: 6 },
  heroText: { color: "#CBD5E1", fontWeight: "700", lineHeight: 22, marginTop: 8 },
  metricsRow: {
    flexDirection: Platform.OS === "web" ? "row" : "column",
    gap: 10,
    paddingHorizontal: 18,
    marginTop: 18,
  },
  metricCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    padding: 14,
  },
  metricIcon: {
    width: 38,
    height: 38,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  metricValue: { color: COLORS.text, fontSize: 22, fontWeight: "900" },
  metricLabel: { color: COLORS.muted, fontSize: 12, fontWeight: "900", marginTop: 2 },
  sectionHeader: {
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionTitle: { color: COLORS.text, fontSize: 22, fontWeight: "900" },
  sectionSubtitle: { color: COLORS.muted, fontWeight: "700", marginTop: 4 },
  marketButton: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  marketButtonText: { color: COLORS.red, fontWeight: "900" },
  orderCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 24,
    padding: 16,
    marginHorizontal: 18,
    marginBottom: 14,
  },
  orderHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 12 },
  orderNumber: { color: COLORS.text, fontSize: 18, fontWeight: "900" },
  orderDate: { color: COLORS.muted, fontWeight: "700", marginTop: 3 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7 },
  statusBadgeText: { fontWeight: "900", fontSize: 12 },
  orderSummaryRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  summaryPill: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 10,
  },
  summaryPillValue: { color: COLORS.red, fontWeight: "900", fontSize: 16 },
  summaryPillLabel: { color: COLORS.muted, fontWeight: "900", fontSize: 11, marginTop: 2 },
  farmGroupBox: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 12,
    marginBottom: 12,
  },
  farmGroupTitle: { color: COLORS.text, fontWeight: "900", marginBottom: 10 },
  noItemsText: { color: COLORS.muted, fontWeight: "700", lineHeight: 20 },
  farmRow: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  farmAvatar: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: COLORS.black,
    alignItems: "center",
    justifyContent: "center",
  },
  farmAvatarText: { color: COLORS.white, fontWeight: "900", fontSize: 18 },
  farmName: { color: COLORS.text, fontWeight: "900" },
  farmMeta: { color: COLORS.muted, fontWeight: "700", marginTop: 2, fontSize: 12 },
  farmStatusText: { color: COLORS.red, fontWeight: "900", marginTop: 3, fontSize: 12 },
  farmActions: { flexDirection: "row", gap: 6 },
  smallIconButton: {
    backgroundColor: "#FEE2E2",
    borderRadius: 999,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  itemsRow: { gap: 8, paddingBottom: 12 },
  productChip: {
    width: 110,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 15,
    padding: 8,
  },
  productImage: { width: "100%", height: 58, borderRadius: 12, backgroundColor: COLORS.greenSoft },
  productPlaceholder: {
    width: "100%",
    height: 58,
    borderRadius: 12,
    backgroundColor: COLORS.greenSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  productPlaceholderText: { color: COLORS.greenDark, fontWeight: "900", fontSize: 22 },
  productChipText: { color: COLORS.text, fontWeight: "900", fontSize: 12, marginTop: 6 },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  actionButton: {
    flexGrow: 1,
    flexBasis: Platform.OS === "web" ? "30%" : "31%",
    backgroundColor: "#FEE2E2",
    borderRadius: 15,
    paddingHorizontal: 10,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  actionText: { color: COLORS.red, fontWeight: "900", fontSize: 12 },
  pressed: { opacity: 0.72 },
  emptyCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 24,
    padding: 24,
    marginHorizontal: 18,
    marginTop: 14,
    alignItems: "center",
  },
  emptyIcon: {
    width: 68,
    height: 68,
    borderRadius: 24,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: { color: COLORS.text, fontSize: 22, fontWeight: "900", textAlign: "center" },
  emptyText: { color: COLORS.muted, fontWeight: "700", textAlign: "center", lineHeight: 22, marginTop: 8 },
  emptyButton: {
    backgroundColor: COLORS.red,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 13,
    marginTop: 18,
  },
  emptyButtonText: { color: COLORS.white, fontWeight: "900" },
});
