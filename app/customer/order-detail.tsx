// app/customer/order-detail.tsx

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
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { addToCart, clearCart } from "../data/cartStore";
import { supabase } from "../data/supabaseClient";

/**
 * app/customer/order-detail.tsx
 *
 * Full customer order detail / receipt screen.
 *
 * Includes:
 * - Full order receipt
 * - Multi-farmer sections
 * - Product line items
 * - Payment summary
 * - Delivery / pickup information
 * - Stripe session/payment references
 * - Track Order
 * - Farmer Chat
 * - Driver Chat
 * - Reorder
 * - Back to My Orders
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
  id?: string;
  order_id?: string;
  farmer_id?: string;
  farmerId?: string;
  farm_name?: string;
  farmName?: string;
  farmerName?: string;
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
  unit?: string;
  category?: string;
  farmer_email?: string;
  farmerEmail?: string;
  driver_id?: string;
  driverId?: string;
  driver_name?: string;
  driverName?: string;
  farmer_stripe_account_id?: string;
  stripe_account_id?: string;
};

type FarmGroup = {
  farmKey: string;
  farmerId: string;
  farmName: string;
  farmerEmail?: string;
  driverId?: string;
  driverName?: string;
  status: string;
  subtotal: number;
  itemCount: number;
  stripeAccountId?: string;
  items: OrderItem[];
};

type Order = {
  id: string;
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

function dateTimeLabel(value: any) {
  const raw = clean(value);
  if (!raw) return "Not listed";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function shortId(value: any) {
  const id = clean(value);
  if (!id) return "Not listed";
  if (id.length <= 14) return id;
  return `${id.slice(0, 8)}...${id.slice(-6)}`;
}

function getCustomerId(customer: CustomerSession | null) {
  return clean(customer?.id || customer?.customer_id || customer?.customerId);
}

function getOrderId(order: any) {
  return clean(order?.id || order?.order_id || order?.orderId);
}

function prettyStatus(value: any) {
  const status = clean(value || "Pending").replace(/_/g, " ");
  return status
    .split(" ")
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function getStatusTone(statusValue: any) {
  const status = normalize(statusValue);

  if (["paid", "complete", "completed", "delivered"].includes(status)) return "green";
  if (["driver assigned", "driver_assigned", "out for delivery", "out_for_delivery", "in transit", "in_transit"].includes(status)) return "blue";
  if (["pending", "pending payment", "pending_payment", "farmer preparing", "preparing", "ready for pickup", "ready_for_pickup"].includes(status)) return "amber";
  if (["cancelled", "canceled", "failed", "refunded"].includes(status)) return "danger";

  return "amber";
}

function getProductName(item: any) {
  return clean(item?.product_name || item?.productName || item?.name || "Farm Product");
}

function getProductId(item: any) {
  return clean(item?.product_id || item?.productId || item?.id);
}

function getFarmName(item: any) {
  return clean(item?.farm_name || item?.farmName || item?.farmerName || "Farm2Home Farm");
}

function getFarmerId(item: any) {
  return clean(item?.farmer_id || item?.farmerId);
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

function getStripeAccount(item: any) {
  return clean(item?.farmer_stripe_account_id || item?.stripe_account_id || item?.farmerStripeAccountId || item?.stripeAccountId);
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
    farmerName: getFarmName(item),
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
    unit: clean(item?.unit || "each"),
    category: clean(item?.category || ""),
    farmer_email: clean(item?.farmer_email || item?.farmerEmail),
    farmerEmail: clean(item?.farmer_email || item?.farmerEmail),
    driver_id: clean(item?.driver_id || item?.driverId),
    driverId: clean(item?.driver_id || item?.driverId),
    driver_name: clean(item?.driver_name || item?.driverName),
    driverName: clean(item?.driver_name || item?.driverName),
    farmer_stripe_account_id: getStripeAccount(item),
    stripe_account_id: getStripeAccount(item),
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
        farmerEmail: clean(item.farmer_email || item.farmerEmail),
        driverId: clean(item.driver_id || item.driverId),
        driverName: clean(item.driver_name || item.driverName),
        status: clean(item.status || "Pending"),
        subtotal: 0,
        itemCount: 0,
        stripeAccountId: getStripeAccount(item),
        items: [],
      });
    }

    const group = groups.get(key)!;
    group.items.push(item);
    group.subtotal += getLineTotal(item);
    group.itemCount += getQuantity(item);

    if (normalize(item.status) && normalize(item.status) !== "pending") group.status = item.status || group.status;
    if (!group.farmerEmail) group.farmerEmail = clean(item.farmer_email || item.farmerEmail);
    if (!group.driverId) group.driverId = clean(item.driver_id || item.driverId);
    if (!group.driverName) group.driverName = clean(item.driver_name || item.driverName);
    if (!group.stripeAccountId) group.stripeAccountId = getStripeAccount(item);
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
        farmerEmail: clean(split.farmerEmail || split.farmer_email),
        driverId: clean(split.driverId || split.driver_id),
        driverName: clean(split.driverName || split.driver_name),
        status: clean(split.status || "Pending"),
        subtotal: Number(split.subtotal || split.amount || 0),
        itemCount: Number(split.itemCount || split.item_count || 0),
        stripeAccountId: clean(split.stripeAccountId || split.stripe_account_id || split.farmerStripeAccountId || split.farmer_stripe_account_id),
        items: [],
      });
    }
  });

  return Array.from(groups.values()).map((group) => ({
    ...group,
    subtotal: Number(group.subtotal.toFixed(2)),
  }));
}

function normalizeOrder(row: any, extraItems: OrderItem[] = []): Order {
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
    order_id: id,
    customer_id: clean(row?.customer_id || row?.customerId),
    customerId: clean(row?.customer_id || row?.customerId),
    customer_email: clean(row?.customer_email || row?.customerEmail),
    customerEmail: clean(row?.customer_email || row?.customerEmail),
    customer_name: clean(row?.customer_name || row?.customerName),
    customerName: clean(row?.customer_name || row?.customerName),
    status: clean(row?.status || row?.payment_status || "Pending"),
    payment_status: clean(row?.payment_status || row?.status || "Pending"),
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
    zip_code: clean(row?.zip_code || row?.zipCode),
    zipCode: clean(row?.zip_code || row?.zipCode),
    delivery_instructions: clean(row?.delivery_instructions || row?.deliveryInstructions),
    deliveryInstructions: clean(row?.delivery_instructions || row?.deliveryInstructions),
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

function buildDeliveryAddress(order: Order | null) {
  if (!order) return "";
  const option = clean(order.delivery_option || order.deliveryOption);
  if (normalize(option) === "pickup") return "Pickup at farm";

  const address = clean(order.delivery_address || order.deliveryAddress);
  const city = clean(order.city);
  const state = clean(order.state);
  const zip = clean(order.zip_code || order.zipCode);

  return [address, [city, state, zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
}

export default function CustomerOrderDetail() {
  const params = useLocalSearchParams();

  const [customer, setCustomer] = useState<CustomerSession | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const orderId = useMemo(
    () => clean(params?.orderId || params?.order_id || params?.id),
    [params]
  );

  const farmGroups = order?.farmGroups || [];
  const deliveryAddress = buildDeliveryAddress(order);

  useFocusEffect(
    useCallback(() => {
      loadScreen();
    }, [orderId])
  );

  async function loadScreen() {
    try {
      setLoading(true);
      const activeCustomer = await loadCustomer();
      await loadOrder(activeCustomer);
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    try {
      setRefreshing(true);
      const activeCustomer = customer || (await loadCustomer());
      await loadOrder(activeCustomer);
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
    const authEmail = normalize(authData?.user?.email || localCustomer?.email || "");

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

  async function loadOrder(activeCustomer: CustomerSession | null) {
    const localOrder = await loadLocalOrder();
    const idToFind = orderId || getOrderId(localOrder);
    const customerId = getCustomerId(activeCustomer);
    const customerEmail = normalize(activeCustomer?.email);

    let foundOrder: Order | null = null;

    if (localOrder && (!idToFind || getOrderId(localOrder) === idToFind)) {
      foundOrder = normalizeOrder(localOrder);
    }

    const orderTables = ["orders", "customer_orders", "farm_orders"];

    for (const table of orderTables) {
      try {
        let query = supabase.from(table).select("*").limit(1);

        if (idToFind) {
          query = query.eq("id", idToFind);
        } else if (customerId && customerEmail) {
          query = query
            .or(`customer_id.eq.${customerId},customerId.eq.${customerId},customer_email.eq.${customerEmail},customerEmail.eq.${customerEmail}`)
            .order("created_at", { ascending: false });
        } else if (customerId) {
          query = query
            .or(`customer_id.eq.${customerId},customerId.eq.${customerId}`)
            .order("created_at", { ascending: false });
        } else if (customerEmail) {
          query = query
            .or(`customer_email.eq.${customerEmail},customerEmail.eq.${customerEmail}`)
            .order("created_at", { ascending: false });
        } else {
          continue;
        }

        const { data, error } = await query;

        if (!error && Array.isArray(data) && data[0]) {
          const orderRow = data[0];
          const items = await fetchOrderItems(getOrderId(orderRow));
          foundOrder = normalizeOrder(orderRow, items);
          break;
        }
      } catch (error) {
        console.log(`${table} order detail load skipped:`, error);
      }
    }

    if (!foundOrder) {
      setOrder(null);
      return;
    }

    setOrder(foundOrder);

    await AsyncStorage.multiSet([
      ["currentCustomerOrder", JSON.stringify(foundOrder)],
      ["lastCustomerOrder", JSON.stringify(foundOrder)],
    ]);
  }

  async function loadLocalOrder() {
    const saved =
      (await AsyncStorage.getItem("currentCustomerOrder")) ||
      (await AsyncStorage.getItem("lastCustomerOrder")) ||
      (await AsyncStorage.getItem("pendingCustomerOrder"));

    if (!saved) return null;

    try {
      return JSON.parse(saved);
    } catch {
      return null;
    }
  }

  async function fetchOrderItems(id: string) {
    if (!id) return [];

    const itemTables = ["order_items", "customer_order_items", "farm_order_items"];

    for (const table of itemTables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select("*")
          .eq("order_id", id)
          .limit(250);

        if (!error && Array.isArray(data) && data.length > 0) {
          return data.map((item) => normalizeItem(item, id));
        }
      } catch {
        // try next
      }
    }

    return [];
  }

  function openTracking() {
    if (!order?.id) return;
    router.push({
      pathname: "/customer/tracking" as any,
      params: { orderId: order.id },
    });
  }

  function openFarmerChat(farm?: FarmGroup) {
    if (!order?.id) return;
    const selectedFarm = farm || farmGroups[0];

    router.push({
      pathname: "/customer/farmer-chat" as any,
      params: {
        orderId: order.id,
        farmerId: selectedFarm?.farmerId || "",
        farmName: selectedFarm?.farmName || "",
        farmerEmail: selectedFarm?.farmerEmail || "",
      },
    });
  }

  function openDriverChat(farm?: FarmGroup) {
    if (!order?.id) return;
    const selectedFarm = farm || farmGroups.find((group) => group.driverId) || farmGroups[0];

    router.push({
      pathname: "/customer/driver-chat" as any,
      params: {
        orderId: order.id,
        driverId: selectedFarm?.driverId || "",
        driverName: selectedFarm?.driverName || "",
      },
    });
  }

  async function reorder() {
    if (!order?.items?.length) {
      Alert.alert("Reorder Unavailable", "This order does not have saved items.");
      return;
    }

    Alert.alert("Reorder", "Clear your cart and add these items again?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reorder",
        onPress: async () => {
          try {
            await clearCart();

            for (const item of order.items || []) {
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
                farmerStripeAccountId: getStripeAccount(item),
                stripeAccountId: getStripeAccount(item),
                farmer_stripe_account_id: getStripeAccount(item),
                stripe_account_id: getStripeAccount(item),
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

  function downloadReceipt() {
    Alert.alert(
      "Receipt",
      "This screen is your receipt. PDF export can be added after the order workflow is complete."
    );
  }

  function renderHeader() {
    if (!order) return null;

    return (
      <View>
        <View style={styles.hero}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.push("/customer/my-orders" as any)}
            activeOpacity={0.9}
          >
            <Ionicons name="arrow-back-outline" size={18} color={COLORS.white} />
            <Text style={styles.backButtonText}>My Orders</Text>
          </TouchableOpacity>

          <View style={styles.heroIcon}>
            <Ionicons name="document-text-outline" size={34} color={COLORS.white} />
          </View>

          <Text style={styles.kicker}>Farm2Home Receipt</Text>
          <Text style={styles.heroTitle}>Order Details</Text>
          <Text style={styles.heroText}>
            Full receipt, farm sections, delivery details, and payment summary.
          </Text>
        </View>

        <View style={styles.orderCard}>
          <View style={styles.orderHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.orderNumber}>Order #{order.id.slice(-8).toUpperCase()}</Text>
              <Text style={styles.orderDate}>Placed {dateTimeLabel(order.created_at || order.createdAt)}</Text>
            </View>

            <StatusBadge status={order.status || "Pending"} tone={getStatusTone(order.status) as any} />
          </View>

          <View style={styles.summaryGrid}>
            <SummaryPill label="Total" value={money(order.total)} />
            <SummaryPill label="Farms" value={`${farmGroups.length}`} />
            <SummaryPill label="Items" value={`${(order.items || []).reduce((sum, item) => sum + getQuantity(item), 0)}`} />
          </View>
        </View>

        <View style={styles.quickActions}>
          <ActionButton icon="navigate-outline" label="Track" onPress={openTracking} />
          <ActionButton icon="chatbubbles-outline" label="Farmer" onPress={() => openFarmerChat()} />
          <ActionButton icon="car-outline" label="Driver" onPress={() => openDriverChat()} />
          <ActionButton icon="repeat-outline" label="Reorder" onPress={reorder} />
          <ActionButton icon="download-outline" label="Receipt" onPress={downloadReceipt} />
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Delivery / Pickup</Text>

          <DetailRow label="Order Type" value={clean(order.delivery_option || order.deliveryOption || "Delivery")} />
          <DetailRow label="Address" value={deliveryAddress || "Not listed"} />
          <DetailRow label="Phone" value={clean(order.phone) || "Not listed"} />
          <DetailRow label="Instructions" value={clean(order.delivery_instructions || order.deliveryInstructions) || "None"} />
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Payment Summary</Text>

          <PaymentLine label="Subtotal" value={order.subtotal} />
          <PaymentLine label="Farm2Home Service Fee" value={order.service_fee || order.platform_fee} />
          <PaymentLine label="Delivery Fee" value={order.delivery_fee} />
          <PaymentLine label="Freight Handling" value={order.freight_handling_fee} />
          <PaymentLine label="Tip" value={order.tip} />

          <View style={styles.divider} />

          <View style={styles.totalLine}>
            <Text style={styles.totalLabel}>Total Paid</Text>
            <Text style={styles.totalValue}>{money(order.total)}</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Stripe References</Text>

          <DetailRow label="Checkout Session" value={shortId(order.stripe_checkout_session_id)} />
          <DetailRow label="Payment Intent" value={shortId(order.stripe_payment_intent_id)} />
          <DetailRow label="Payment Status" value={prettyStatus(order.payment_status || order.status)} />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Farm Sections</Text>
          <Text style={styles.sectionSubtitle}>
            Each farmer keeps their own item group and payout reference.
          </Text>
        </View>
      </View>
    );
  }

  function renderFarm({ item }: { item: FarmGroup }) {
    return (
      <View style={styles.farmCard}>
        <View style={styles.farmHeader}>
          <View style={styles.farmAvatar}>
            <Text style={styles.farmAvatarText}>{item.farmName.slice(0, 1).toUpperCase()}</Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.farmName}>{item.farmName}</Text>
            <Text style={styles.farmMeta}>
              {item.itemCount} item{item.itemCount === 1 ? "" : "s"} · {money(item.subtotal)}
            </Text>
            <Text style={styles.farmStatus}>Status: {prettyStatus(item.status)}</Text>
          </View>

          <StatusBadge status={item.status} tone={getStatusTone(item.status) as any} />
        </View>

        <View style={styles.payoutBox}>
          <Ionicons name="card-outline" size={17} color={COLORS.red} />
          <View style={{ flex: 1 }}>
            <Text style={styles.payoutLabel}>Farmer payout account</Text>
            <Text style={styles.payoutValue}>{shortId(item.stripeAccountId)}</Text>
          </View>
        </View>

        {item.items.length > 0 ? (
          <View style={styles.itemsBox}>
            {item.items.map((orderItem) => {
              const image = getItemImage(orderItem);

              return (
                <View key={clean(orderItem.id)} style={styles.itemRow}>
                  {image ? (
                    <Image source={{ uri: image }} style={styles.productImage} />
                  ) : (
                    <View style={styles.productPlaceholder}>
                      <Text style={styles.productPlaceholderText}>
                        {getProductName(orderItem).slice(0, 1).toUpperCase()}
                      </Text>
                    </View>
                  )}

                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName} numberOfLines={2}>{getProductName(orderItem)}</Text>
                    <Text style={styles.itemMeta}>
                      Qty {getQuantity(orderItem)} · {money(getPrice(orderItem))}
                      {orderItem.unit ? ` / ${orderItem.unit}` : " each"}
                    </Text>
                    <Text style={styles.itemStatus}>Status: {prettyStatus(orderItem.status)}</Text>
                  </View>

                  <Text style={styles.itemTotal}>{money(getLineTotal(orderItem))}</Text>
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={styles.noItemsText}>No saved line items for this farm section.</Text>
        )}

        <View style={styles.farmActions}>
          <Pressable style={styles.farmActionButton} onPress={() => openFarmerChat(item)}>
            <Ionicons name="chatbubble-outline" size={16} color={COLORS.red} />
            <Text style={styles.farmActionText}>Farmer Chat</Text>
          </Pressable>

          <Pressable style={styles.farmActionButton} onPress={() => openDriverChat(item)}>
            <Ionicons name="car-outline" size={16} color={COLORS.red} />
            <Text style={styles.farmActionText}>Driver Chat</Text>
          </Pressable>
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
          <Text style={styles.centerText}>Loading order details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <View style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <Ionicons name="document-text-outline" size={34} color={COLORS.red} />
          </View>
          <Text style={styles.emptyTitle}>Order not found</Text>
          <Text style={styles.emptyText}>
            The order details could not be found. Open My Orders and select an order.
          </Text>

          <TouchableOpacity style={styles.emptyButton} onPress={() => router.replace("/customer/my-orders" as any)}>
            <Text style={styles.emptyButtonText}>Open My Orders</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />

      <FlatList
        data={farmGroups}
        keyExtractor={(item) => item.farmKey}
        renderItem={renderFarm}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={COLORS.red} />
        }
      />
    </SafeAreaView>
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
      <Ionicons name={icon} size={18} color={COLORS.red} />
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function PaymentLine({ label, value }: { label: string; value: any }) {
  const numeric = Number(value || 0);

  return (
    <View style={styles.paymentLine}>
      <Text style={styles.paymentLabel}>{label}</Text>
      <Text style={styles.paymentValue}>{money(numeric)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
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
    alignItems: "center",
    gap: 6,
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
  orderCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 24,
    padding: 16,
    marginHorizontal: 18,
    marginTop: 18,
  },
  orderHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 14 },
  orderNumber: { color: COLORS.text, fontSize: 20, fontWeight: "900" },
  orderDate: { color: COLORS.muted, fontWeight: "700", marginTop: 4 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7 },
  statusBadgeText: { fontWeight: "900", fontSize: 12 },
  summaryGrid: { flexDirection: "row", gap: 8 },
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
  quickActions: {
    flexDirection: Platform.OS === "web" ? "row" : "column",
    flexWrap: "wrap",
    gap: 9,
    marginHorizontal: 18,
    marginTop: 14,
  },
  actionButton: {
    flexGrow: 1,
    flexBasis: Platform.OS === "web" ? "18%" : "auto",
    backgroundColor: "#FEE2E2",
    borderRadius: 16,
    padding: 13,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  actionText: { color: COLORS.red, fontWeight: "900" },
  infoCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 24,
    padding: 16,
    marginHorizontal: 18,
    marginTop: 14,
  },
  sectionTitle: { color: COLORS.text, fontSize: 22, fontWeight: "900" },
  sectionSubtitle: { color: COLORS.muted, fontWeight: "700", marginTop: 4 },
  detailRow: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingVertical: 12,
  },
  detailLabel: {
    color: COLORS.muted,
    fontWeight: "900",
    fontSize: 11,
    textTransform: "uppercase",
  },
  detailValue: {
    color: COLORS.text,
    fontWeight: "800",
    lineHeight: 20,
    marginTop: 4,
  },
  paymentLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingVertical: 11,
    gap: 12,
  },
  paymentLabel: { color: COLORS.muted, fontWeight: "800", flex: 1 },
  paymentValue: { color: COLORS.text, fontWeight: "900" },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 8 },
  totalLine: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  totalLabel: { color: COLORS.text, fontWeight: "900", fontSize: 18 },
  totalValue: { color: COLORS.red, fontWeight: "900", fontSize: 22 },
  sectionHeader: { marginHorizontal: 18, marginTop: 18, marginBottom: 10 },
  farmCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 24,
    padding: 16,
    marginHorizontal: 18,
    marginBottom: 14,
  },
  farmHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  farmAvatar: {
    width: 48,
    height: 48,
    borderRadius: 18,
    backgroundColor: COLORS.black,
    alignItems: "center",
    justifyContent: "center",
  },
  farmAvatarText: { color: COLORS.white, fontWeight: "900", fontSize: 20 },
  farmName: { color: COLORS.text, fontWeight: "900", fontSize: 17 },
  farmMeta: { color: COLORS.muted, fontWeight: "700", marginTop: 3 },
  farmStatus: { color: COLORS.red, fontWeight: "900", marginTop: 3, fontSize: 12 },
  payoutBox: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 15,
    padding: 11,
    flexDirection: "row",
    gap: 9,
    marginBottom: 10,
  },
  payoutLabel: { color: COLORS.muted, fontWeight: "900", fontSize: 11, textTransform: "uppercase" },
  payoutValue: { color: COLORS.text, fontWeight: "800", marginTop: 3 },
  itemsBox: { gap: 9 },
  itemRow: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  productImage: { width: 54, height: 54, borderRadius: 15, backgroundColor: COLORS.greenSoft },
  productPlaceholder: {
    width: 54,
    height: 54,
    borderRadius: 15,
    backgroundColor: COLORS.greenSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  productPlaceholderText: { color: COLORS.greenDark, fontWeight: "900", fontSize: 21 },
  itemName: { color: COLORS.text, fontWeight: "900" },
  itemMeta: { color: COLORS.muted, fontWeight: "700", marginTop: 3, fontSize: 12 },
  itemStatus: { color: COLORS.red, fontWeight: "800", marginTop: 4, fontSize: 12 },
  itemTotal: { color: COLORS.red, fontWeight: "900" },
  noItemsText: { color: COLORS.muted, fontWeight: "700", lineHeight: 20 },
  farmActions: { flexDirection: "row", gap: 10, marginTop: 12 },
  farmActionButton: {
    flex: 1,
    backgroundColor: "#FEE2E2",
    borderRadius: 15,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  farmActionText: { color: COLORS.red, fontWeight: "900" },
  emptyCard: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
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
  pressed: { opacity: 0.72 },
});
