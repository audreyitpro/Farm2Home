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
 * Fina-style customer order center.
 * Fixes the 400 error by using only snake_case Supabase columns:
 * customer_id and customer_email.
 */

const COLORS = {
  bg: "#F6F7FB",
  card: "#FFFFFF",
  surface: "#F8FAFC",
  primary: "#635BFF",
  primarySoft: "#EEF2FF",
  accent: "#10B981",
  accentSoft: "#D1FAE5",
  warning: "#F59E0B",
  warningSoft: "#FEF3C7",
  danger: "#EF4444",
  dangerSoft: "#FEE2E2",
  blue: "#2563EB",
  blueSoft: "#DBEAFE",
  text: "#101828",
  muted: "#667085",
  border: "#E5E7EB",
  white: "#FFFFFF",
  navy: "#020617",
};

type CustomerSession = {
  id?: string;
  customerId?: string;
  customer_id?: string;
  email?: string;
  customer_email?: string;
  full_name?: string;
  fullName?: string;
  name?: string;
  account_id?: string;
};

type OrderItem = {
  id: string;
  order_id?: string;
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
  total?: number;
  status?: string;
  image?: string;
  imageUrl?: string;
  image_url?: string;
  photo_url?: string;
  farmer_email?: string;
  farmerEmail?: string;
  driver_id?: string;
  driverId?: string;
  driver_name?: string;
  driverName?: string;
  unit?: string;
  category?: string;
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
  customer_email?: string;
  customer_name?: string;
  status?: string;
  order_status?: string;
  fulfillment_status?: string;
  payment_status?: string;
  subtotal?: number;
  service_fee?: number;
  platform_fee?: number;
  delivery_fee?: number;
  freight_handling_fee?: number;
  tip?: number;
  total?: number;
  items?: OrderItem[];
  payout_splits?: any[];
  stripe_checkout_session_id?: string;
  stripe_payment_intent_id?: string;
  created_at?: string;
  updated_at?: string;
  farmGroups?: FarmGroup[];
  source_table?: string;
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

function getCustomerEmail(customer: CustomerSession | null) {
  return normalize(customer?.email || customer?.customer_email);
}

function getCustomerName(customer: CustomerSession | null) {
  return clean(customer?.full_name || customer?.fullName || customer?.name || "Customer");
}

function getOrderId(order: any) {
  return clean(order?.id || order?.order_id || order?.orderId);
}

function getOrderStatus(order: any) {
  return clean(
    order?.order_status ||
      order?.fulfillment_status ||
      order?.status ||
      order?.payment_status ||
      "Pending"
  );
}

function getStatusTone(statusValue: any) {
  const status = normalize(statusValue);

  if (["paid", "complete", "completed", "delivered"].includes(status)) return "green";
  if (
    [
      "out_for_delivery",
      "out for delivery",
      "driver_assigned",
      "driver assigned",
      "in_transit",
      "in transit",
    ].includes(status)
  ) {
    return "blue";
  }
  if (
    [
      "pending",
      "pending_payment",
      "pending payment",
      "farmer preparing",
      "preparing",
      "ready for pickup",
      "paid",
    ].includes(status)
  ) {
    return "amber";
  }
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
  return clean(item?.farm_name || item?.farmName || item?.farmer_name || item?.farmerName || "Farm2Home Farm");
}

function getFarmerId(item: any) {
  return clean(item?.farmer_id || item?.farmerId);
}

function getProductId(item: any) {
  return clean(item?.product_id || item?.productId || item?.id);
}

function getItemImage(item: any) {
  return clean(item?.image || item?.imageUrl || item?.image_url || item?.photo_url);
}

function getQuantity(item: any) {
  const qty = Number(item?.quantity || item?.qty || 0);
  return Number.isFinite(qty) && qty > 0 ? qty : 1;
}

function getPrice(item: any) {
  const price = Number(item?.price || item?.unit_price || 0);
  return Number.isFinite(price) ? price : 0;
}

function getLineTotal(item: any) {
  const line = Number(item?.line_total || item?.lineTotal || item?.total);
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
    status: clean(item?.status || item?.order_status || "Pending"),
    image: getItemImage(item),
    imageUrl: getItemImage(item),
    image_url: getItemImage(item),
    farmer_email: clean(item?.farmer_email || item?.farmerEmail),
    farmerEmail: clean(item?.farmer_email || item?.farmerEmail),
    driver_id: clean(item?.driver_id || item?.driverId),
    driverId: clean(item?.driver_id || item?.driverId),
    driver_name: clean(item?.driver_name || item?.driverName),
    driverName: clean(item?.driver_name || item?.driverName),
    unit: clean(item?.unit || "each"),
    category: clean(item?.category || ""),
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
    const farmName = clean(split.farmName || split.farm_name || split.farmer_name || "Farm2Home Farm");
    const key = farmerId || farmName;

    if (!groups.has(key)) {
      groups.set(key, {
        farmKey: key,
        farmerId,
        farmName,
        status: clean(split.status || "Pending"),
        subtotal: Number(split.subtotal || split.amount || split.farmer_payout || 0),
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

function normalizeOrder(row: any, extraItems: OrderItem[] = [], sourceTable = ""): CustomerOrder {
  const id = getOrderId(row);
  const rawItems = Array.isArray(row?.items) ? row.items : [];
  const items = [...rawItems, ...extraItems].map((item) => normalizeItem(item, id));
  const payoutSplits = Array.isArray(row?.payout_splits) ? row.payout_splits : [];

  return {
    ...row,
    id,
    orderId: id,
    order_id: id,
    source_table: sourceTable,
    customer_id: clean(row?.customer_id || row?.customerId),
    customer_email: normalize(row?.customer_email || row?.customerEmail),
    customer_name: clean(row?.customer_name || row?.customerName),
    status: getOrderStatus(row),
    subtotal: Number(row?.subtotal || 0),
    service_fee: Number(row?.service_fee || row?.platform_fee || 0),
    platform_fee: Number(row?.platform_fee || row?.service_fee || 0),
    delivery_fee: Number(row?.delivery_fee || 0),
    freight_handling_fee: Number(row?.freight_handling_fee || 0),
    tip: Number(row?.tip || 0),
    total: Number(row?.total || row?.subtotal || 0),
    items,
    payout_splits: payoutSplits,
    created_at: clean(row?.created_at || row?.createdAt),
    updated_at: clean(row?.updated_at || row?.updatedAt),
    farmGroups: groupItemsByFarm(items, payoutSplits),
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
    const authEmail = normalize(authData?.user?.email || localCustomer?.email || localCustomer?.customer_email || "");

    if (!authId && !authEmail) return localCustomer;

    const dbCustomer = await fetchCustomer(authId, authEmail);

    if (dbCustomer) {
      const session = {
        ...dbCustomer,
        customerId: dbCustomer.id,
        customer_id: dbCustomer.id,
        accountId: dbCustomer.account_id,
        email: normalize(dbCustomer.email || dbCustomer.customer_email || authEmail),
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
        .or(`id.eq.${lookupId},auth_user_id.eq.${lookupId},profile_id.eq.${lookupId},customer_id.eq.${lookupId}`)
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

  async function fetchRowsForCustomer(table: string, customerId: string, customerEmail: string) {
    try {
      let query = supabase
        .from(table)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      // IMPORTANT:
      // Only use snake_case columns that exist in Supabase.
      // Do not use customerId/customerEmail in .or().
      if (customerId && customerEmail) {
        query = query.or(`customer_id.eq.${customerId},customer_email.eq.${customerEmail}`);
      } else if (customerId) {
        query = query.eq("customer_id", customerId);
      } else if (customerEmail) {
        query = query.eq("customer_email", customerEmail);
      } else {
        return [];
      }

      const { data, error } = await query;

      if (error) {
        console.log(`${table} load skipped:`, error.message);
        return [];
      }

      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.log(`${table} load exception:`, error);
      return [];
    }
  }

  async function loadOrders(activeCustomer: CustomerSession | null) {
    const customerId = getCustomerId(activeCustomer);
    const customerEmail = getCustomerEmail(activeCustomer);

    const allOrders: CustomerOrder[] = [];

    const localOrderRaw =
      (await AsyncStorage.getItem("lastCustomerOrder")) ||
      (await AsyncStorage.getItem("currentCustomerOrder"));

    if (localOrderRaw) {
      try {
        const localOrder = normalizeOrder(JSON.parse(localOrderRaw), [], "local");
        if (localOrder.id) allOrders.push(localOrder);
      } catch {
        // skip
      }
    }

    const orderTables = ["orders", "customer_orders", "farm_orders"];

    for (const table of orderTables) {
      const rows = await fetchRowsForCustomer(table, customerId, customerEmail);

      for (const row of rows) {
        const id = getOrderId(row);
        const items = await fetchOrderItems(id);
        allOrders.push(normalizeOrder(row, items, table));
      }
    }

    const unique = Array.from(
      new Map(allOrders.filter((order) => order.id).map((order) => [order.id, order])).values()
    ).sort((a, b) => {
      const ad = new Date(a.created_at || 0).getTime();
      const bd = new Date(b.created_at || 0).getTime();
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
        // try next table
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
      pathname: "/customer/order-tracking" as any,
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
                unit: clean(item.unit || "each"),
                category: clean(item.category || ""),
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
      <View style={styles.headerWrap}>
        <View style={styles.topPanel}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>Farm2Home Orders</Text>
            <Text style={styles.pageTitle}>My Orders</Text>
            <Text style={styles.pageSubtitle}>
              Track farm purchases, multi-farmer fulfillment, driver delivery, and receipts.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.shopTopButton}
            onPress={() => router.push("/customer/marketplace" as any)}
            activeOpacity={0.9}
          >
            <Ionicons name="storefront-outline" size={18} color={COLORS.primary} />
            <Text style={styles.shopTopButtonText}>Shop</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.metricsRow}>
          <MetricCard icon="receipt-outline" label="Total Orders" value={`${metrics.totalOrders}`} tone="primary" />
          <MetricCard icon="time-outline" label="Pending" value={`${metrics.pendingOrders}`} tone="amber" />
          <MetricCard icon="navigate-outline" label="Deliveries" value={`${metrics.activeDeliveries}`} tone="blue" />
          <MetricCard icon="cash-outline" label="Spent" value={money(metrics.lifetimeSpend)} tone="green" />
        </View>

        <View style={styles.quickActions}>
          <QuickAction icon="storefront-outline" title="Marketplace" onPress={() => router.push("/customer/marketplace" as any)} />
          <QuickAction icon="cart-outline" title="Cart" onPress={() => router.push("/customer/cart" as any)} />
          <QuickAction icon="heart-outline" title="Favorites" onPress={() => router.push("/customer/favorites" as any)} />
          <QuickAction icon="chatbubbles-outline" title="Messages" onPress={() => router.push("/customer/farmer-chat" as any)} />
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Recent Orders</Text>
            <Text style={styles.sectionSubtitle}>
              {orders.length} order{orders.length === 1 ? "" : "s"} found for {getCustomerName(customer)}
            </Text>
          </View>

          <TouchableOpacity style={styles.refreshButton} onPress={refresh} disabled={refreshing}>
            {refreshing ? (
              <ActivityIndicator color={COLORS.primary} />
            ) : (
              <>
                <Ionicons name="refresh-outline" size={16} color={COLORS.primary} />
                <Text style={styles.refreshButtonText}>Refresh</Text>
              </>
            )}
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
          <View style={styles.orderIcon}>
            <Ionicons name="receipt-outline" size={20} color={COLORS.primary} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.orderNumber}>Order #{item.id.slice(-8).toUpperCase()}</Text>
            <Text style={styles.orderDate}>
              {dateLabel(item.created_at)} {timeLabel(item.created_at)}
            </Text>
            {!!item.source_table && <Text style={styles.sourceText}>Source: {item.source_table}</Text>}
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
                    <Ionicons name="chatbubble-outline" size={15} color={COLORS.primary} />
                  </Pressable>

                  <Pressable style={styles.smallIconButton} onPress={() => contactDriver(item, group)}>
                    <Ionicons name="car-outline" size={15} color={COLORS.primary} />
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
        <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} size="large" />
          <Text style={styles.centerText}>Loading your orders...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        renderItem={renderOrder}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={COLORS.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="receipt-outline" size={34} color={COLORS.primary} />
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
  tone: "primary" | "amber" | "blue" | "green";
}) {
  const config = {
    primary: { bg: COLORS.primarySoft, color: COLORS.primary },
    amber: { bg: COLORS.warningSoft, color: "#92400E" },
    blue: { bg: COLORS.blueSoft, color: COLORS.blue },
    green: { bg: COLORS.accentSoft, color: COLORS.accent },
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

function QuickAction({
  icon,
  title,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.quickAction} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.quickIcon}>
        <Ionicons name={icon} size={19} color={COLORS.primary} />
      </View>
      <Text style={styles.quickText}>{title}</Text>
    </TouchableOpacity>
  );
}

function StatusBadge({ status, tone }: { status: string; tone: "green" | "amber" | "blue" | "danger" }) {
  const config = {
    green: { bg: COLORS.accentSoft, color: "#047857" },
    amber: { bg: COLORS.warningSoft, color: "#92400E" },
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
      <Ionicons name={icon} size={17} color={COLORS.primary} />
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  centerText: { color: COLORS.muted, fontWeight: "800" },
  listContent: { paddingBottom: 70 },
  headerWrap: { padding: 16 },
  topPanel: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 22,
    padding: 18,
    flexDirection: Platform.OS === "web" ? "row" : "column",
    gap: 12,
    alignItems: Platform.OS === "web" ? "center" : "stretch",
  },
  eyebrow: {
    color: COLORS.primary,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontSize: 12,
    fontWeight: "900",
  },
  pageTitle: {
    color: COLORS.text,
    fontSize: 30,
    fontWeight: "900",
    marginTop: 4,
  },
  pageSubtitle: {
    color: COLORS.muted,
    lineHeight: 20,
    fontWeight: "700",
    marginTop: 4,
  },
  shopTopButton: {
    backgroundColor: COLORS.primarySoft,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  shopTopButtonText: {
    color: COLORS.primary,
    fontWeight: "900",
  },
  metricsRow: {
    flexDirection: Platform.OS === "web" ? "row" : "column",
    gap: 12,
    marginTop: 14,
  },
  metricCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
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
  quickActions: {
    flexDirection: Platform.OS === "web" ? "row" : "column",
    gap: 10,
    marginTop: 14,
  },
  quickAction: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  quickIcon: {
    width: 34,
    height: 34,
    borderRadius: 13,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  quickText: { color: COLORS.text, fontWeight: "900" },
  sectionHeader: {
    paddingTop: 20,
    paddingBottom: 2,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionTitle: { color: COLORS.text, fontSize: 22, fontWeight: "900" },
  sectionSubtitle: { color: COLORS.muted, fontWeight: "700", marginTop: 4 },
  refreshButton: {
    backgroundColor: COLORS.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  refreshButtonText: { color: COLORS.primary, fontWeight: "900" },
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
  orderIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  orderNumber: { color: COLORS.text, fontSize: 18, fontWeight: "900" },
  orderDate: { color: COLORS.muted, fontWeight: "700", marginTop: 3 },
  sourceText: { color: COLORS.primary, fontWeight: "900", marginTop: 3, fontSize: 11 },
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
  summaryPillValue: { color: COLORS.primary, fontWeight: "900", fontSize: 16 },
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
    backgroundColor: COLORS.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  farmAvatarText: { color: COLORS.white, fontWeight: "900", fontSize: 18 },
  farmName: { color: COLORS.text, fontWeight: "900" },
  farmMeta: { color: COLORS.muted, fontWeight: "700", marginTop: 2, fontSize: 12 },
  farmStatusText: { color: COLORS.primary, fontWeight: "900", marginTop: 3, fontSize: 12 },
  farmActions: { flexDirection: "row", gap: 6 },
  smallIconButton: {
    backgroundColor: COLORS.primarySoft,
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
  productImage: { width: "100%", height: 58, borderRadius: 12, backgroundColor: COLORS.accentSoft },
  productPlaceholder: {
    width: "100%",
    height: 58,
    borderRadius: 12,
    backgroundColor: COLORS.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  productPlaceholderText: { color: "#047857", fontWeight: "900", fontSize: 22 },
  productChipText: { color: COLORS.text, fontWeight: "900", fontSize: 12, marginTop: 6 },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  actionButton: {
    flexGrow: 1,
    flexBasis: Platform.OS === "web" ? "30%" : "31%",
    backgroundColor: COLORS.primarySoft,
    borderRadius: 15,
    paddingHorizontal: 10,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  actionText: { color: COLORS.primary, fontWeight: "900", fontSize: 12 },
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
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: { color: COLORS.text, fontSize: 22, fontWeight: "900", textAlign: "center" },
  emptyText: { color: COLORS.muted, fontWeight: "700", textAlign: "center", lineHeight: 22, marginTop: 8 },
  emptyButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 13,
    marginTop: 18,
  },
  emptyButtonText: { color: COLORS.white, fontWeight: "900" },
});
