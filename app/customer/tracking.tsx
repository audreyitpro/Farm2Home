// app/customer/tracking.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
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

import { supabase } from "../data/supabaseClient";

/**
 * app/customer/tracking.tsx
 *
 * Full customer tracking screen.
 *
 * Tracks:
 * - Order payment status
 * - Farmer fulfillment status by farm
 * - Driver/delivery status
 * - Pickup/dropoff route timeline
 * - Multi-farmer order sections
 *
 * Working routes:
 * - Back to My Orders
 * - Order Details
 * - Farmer Chat
 * - Driver Chat
 * - Marketplace
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
  product_name?: string;
  productName?: string;
  name?: string;
  quantity?: number;
  price?: number;
  line_total?: number;
  lineTotal?: number;
  status?: string;
  farmer_email?: string;
  farmerEmail?: string;
  driver_id?: string;
  driverId?: string;
  driver_name?: string;
  driverName?: string;
};

type TrackingJob = {
  id?: string;
  order_id?: string;
  orderId?: string;
  farmer_id?: string;
  farmerId?: string;
  driver_id?: string;
  driverId?: string;
  driver_name?: string;
  driverName?: string;
  status?: string;
  pickup_address?: string;
  pickupAddress?: string;
  dropoff_address?: string;
  dropoffAddress?: string;
  current_location?: string;
  currentLocation?: string;
  pickup_time?: string;
  pickupTime?: string;
  delivered_time?: string;
  deliveredTime?: string;
  updated_at?: string;
  updatedAt?: string;
};

type FarmTracking = {
  farmKey: string;
  farmerId: string;
  farmName: string;
  status: string;
  itemCount: number;
  subtotal: number;
  farmerEmail?: string;
  driverId?: string;
  driverName?: string;
  pickupAddress?: string;
  dropoffAddress?: string;
  currentLocation?: string;
  items: OrderItem[];
  job?: TrackingJob;
};

type Order = {
  id: string;
  order_id?: string;
  customer_id?: string;
  customer_email?: string;
  customer_name?: string;
  status?: string;
  payment_status?: string;
  delivery_option?: string;
  delivery_address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  phone?: string;
  delivery_instructions?: string;
  subtotal?: number;
  service_fee?: number;
  delivery_fee?: number;
  freight_handling_fee?: number;
  tip?: number;
  total?: number;
  items?: OrderItem[];
  payout_splits?: any[];
  created_at?: string;
  updated_at?: string;
  stripe_checkout_session_id?: string;
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

function getCustomerId(customer: CustomerSession | null) {
  return clean(customer?.id || customer?.customer_id || customer?.customerId);
}

function getOrderId(order: any) {
  return clean(order?.id || order?.order_id || order?.orderId);
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
  if (
    [
      "driver assigned",
      "driver_assigned",
      "out for delivery",
      "out_for_delivery",
      "in transit",
      "in_transit",
      "picked up",
      "picked_up",
    ].includes(status)
  ) {
    return "blue";
  }

  if (
    [
      "pending",
      "pending payment",
      "pending_payment",
      "farmer preparing",
      "preparing",
      "ready for pickup",
      "ready_for_pickup",
    ].includes(status)
  ) {
    return "amber";
  }

  if (["cancelled", "canceled", "failed", "refunded"].includes(status)) return "danger";

  return "amber";
}

function statusStepIndex(statusValue: any) {
  const status = normalize(statusValue);

  if (["cancelled", "canceled", "failed"].includes(status)) return 0;
  if (["pending", "pending_payment", "pending payment"].includes(status)) return 0;
  if (["paid"].includes(status)) return 1;
  if (["farmer preparing", "preparing", "confirmed"].includes(status)) return 2;
  if (["ready for pickup", "ready_for_pickup"].includes(status)) return 3;
  if (["driver assigned", "driver_assigned"].includes(status)) return 4;
  if (["picked up", "picked_up", "in transit", "in_transit", "out for delivery", "out_for_delivery"].includes(status)) return 5;
  if (["delivered", "complete", "completed"].includes(status)) return 6;

  return 1;
}

function getFarmName(item: any) {
  return clean(item?.farm_name || item?.farmName || item?.farmerName || "Farm2Home Farm");
}

function getFarmerId(item: any) {
  return clean(item?.farmer_id || item?.farmerId);
}

function getProductName(item: any) {
  return clean(item?.product_name || item?.productName || item?.name || "Farm Product");
}

function getQuantity(item: any) {
  const qty = Number(item?.quantity || 0);
  return Number.isFinite(qty) && qty > 0 ? qty : 1;
}

function getLineTotal(item: any) {
  const line = Number(item?.line_total || item?.lineTotal);
  if (Number.isFinite(line) && line > 0) return line;
  return Number(item?.price || 0) * getQuantity(item);
}

function normalizeItem(item: any, orderId = ""): OrderItem {
  return {
    ...item,
    id: clean(item?.id || `${orderId}_${Math.random()}`),
    order_id: clean(item?.order_id || orderId),
    farmer_id: getFarmerId(item),
    farmerId: getFarmerId(item),
    farm_name: getFarmName(item),
    farmName: getFarmName(item),
    product_name: getProductName(item),
    productName: getProductName(item),
    name: getProductName(item),
    quantity: getQuantity(item),
    line_total: getLineTotal(item),
    lineTotal: getLineTotal(item),
    status: clean(item?.status || "Pending"),
    farmer_email: clean(item?.farmer_email || item?.farmerEmail),
    farmerEmail: clean(item?.farmer_email || item?.farmerEmail),
    driver_id: clean(item?.driver_id || item?.driverId),
    driverId: clean(item?.driver_id || item?.driverId),
    driver_name: clean(item?.driver_name || item?.driverName),
    driverName: clean(item?.driver_name || item?.driverName),
  };
}

function buildDeliveryAddress(order: Order | null) {
  if (!order) return "";
  const option = clean(order.delivery_option);
  if (normalize(option) === "pickup") return "Pickup at farm";

  const address = clean(order.delivery_address);
  const city = clean(order.city);
  const state = clean(order.state);
  const zip = clean(order.zip_code);

  return [address, [city, state, zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
}

function groupFarmTracking(order: Order | null, jobs: TrackingJob[]) {
  if (!order) return [];

  const orderId = getOrderId(order);
  const rawItems = Array.isArray(order.items) ? order.items : [];
  const items = rawItems.map((item) => normalizeItem(item, orderId));
  const payoutSplits = Array.isArray(order.payout_splits) ? order.payout_splits : [];

  const groups = new Map<string, FarmTracking>();

  items.forEach((item) => {
    const farmerId = getFarmerId(item);
    const farmName = getFarmName(item);
    const key = farmerId || farmName;

    if (!groups.has(key)) {
      groups.set(key, {
        farmKey: key,
        farmerId,
        farmName,
        status: clean(item.status || order.status || "Pending"),
        itemCount: 0,
        subtotal: 0,
        farmerEmail: clean(item.farmer_email || item.farmerEmail),
        driverId: clean(item.driver_id || item.driverId),
        driverName: clean(item.driver_name || item.driverName),
        items: [],
      });
    }

    const group = groups.get(key)!;
    group.items.push(item);
    group.itemCount += getQuantity(item);
    group.subtotal += getLineTotal(item);

    if (normalize(item.status) && normalize(item.status) !== "pending") {
      group.status = item.status || group.status;
    }
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
        status: clean(split.status || order.status || "Pending"),
        itemCount: Number(split.itemCount || split.item_count || 0),
        subtotal: Number(split.subtotal || split.amount || 0),
        farmerEmail: clean(split.farmerEmail || split.farmer_email),
        driverId: clean(split.driverId || split.driver_id),
        driverName: clean(split.driverName || split.driver_name),
        items: [],
      });
    }
  });

  jobs.forEach((job) => {
    const farmerId = clean(job.farmer_id || job.farmerId);
    const key = farmerId || clean((job as any).farm_name || (job as any).farmName);
    const group = groups.get(key);

    if (group) {
      group.job = job;
      group.status = clean(job.status || group.status);
      group.driverId = clean(job.driver_id || job.driverId || group.driverId);
      group.driverName = clean(job.driver_name || job.driverName || group.driverName);
      group.pickupAddress = clean(job.pickup_address || job.pickupAddress);
      group.dropoffAddress = clean(job.dropoff_address || job.dropoffAddress);
      group.currentLocation = clean(job.current_location || job.currentLocation);
    }
  });

  return Array.from(groups.values());
}

export default function CustomerTracking() {
  const params = useLocalSearchParams();

  const [customer, setCustomer] = useState<CustomerSession | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [jobs, setJobs] = useState<TrackingJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const paramOrderId = clean(params?.orderId || params?.order_id || "");

  useFocusEffect(
    useCallback(() => {
      loadTrackingScreen();
    }, [paramOrderId])
  );

  const selectedOrder = useMemo(() => {
    const finalId = selectedOrderId || paramOrderId;
    if (finalId) return orders.find((order) => getOrderId(order) === finalId) || orders[0] || null;
    return orders[0] || null;
  }, [orders, selectedOrderId, paramOrderId]);

  const farmTracking = useMemo(() => {
    return groupFarmTracking(selectedOrder, jobs);
  }, [selectedOrder, jobs]);

  const mainStatus = clean(selectedOrder?.status || selectedOrder?.payment_status || "Pending");
  const stepIndex = statusStepIndex(mainStatus);
  const deliveryAddress = buildDeliveryAddress(selectedOrder);

  async function loadTrackingScreen() {
    try {
      setLoading(true);
      const activeCustomer = await loadCustomer();
      const loadedOrders = await loadOrders(activeCustomer);

      const firstOrderId =
        paramOrderId ||
        clean(loadedOrders[0]?.id || loadedOrders[0]?.order_id || "");

      setSelectedOrderId(firstOrderId);

      if (firstOrderId) {
        await loadTrackingJobs(firstOrderId);
      }
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    try {
      setRefreshing(true);
      const activeCustomer = customer || (await loadCustomer());
      const loadedOrders = await loadOrders(activeCustomer);
      const finalOrderId = selectedOrderId || paramOrderId || clean(loadedOrders[0]?.id);
      if (finalOrderId) await loadTrackingJobs(finalOrderId);
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

  async function loadOrders(activeCustomer: CustomerSession | null) {
    const customerId = getCustomerId(activeCustomer);
    const customerEmail = normalize(activeCustomer?.email);
    const allOrders: Order[] = [];

    const localOrderRaw =
      (await AsyncStorage.getItem("lastCustomerOrder")) ||
      (await AsyncStorage.getItem("currentCustomerOrder"));

    if (localOrderRaw) {
      try {
        const parsed = JSON.parse(localOrderRaw);
        if (getOrderId(parsed)) allOrders.push(normalizeOrder(parsed));
      } catch {
        // skip
      }
    }

    const orderTables = ["orders", "customer_orders", "farm_orders"];

    for (const table of orderTables) {
      try {
        let query = supabase
          .from(table)
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100);

        if (paramOrderId) {
          query = query.eq("id", paramOrderId);
        } else if (customerId && customerEmail) {
          query = query.or(
            `customer_id.eq.${customerId},customerId.eq.${customerId},customer_email.eq.${customerEmail},customerEmail.eq.${customerEmail}`
          );
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
            const orderId = getOrderId(row);
            const items = await fetchOrderItems(orderId);
            allOrders.push(normalizeOrder({ ...row, items: items.length ? items : row.items }));
          }
        }
      } catch (error) {
        console.log(`${table} tracking load skipped:`, error);
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
    return unique;
  }

  function normalizeOrder(row: any): Order {
    const id = getOrderId(row);
    const items = Array.isArray(row?.items)
      ? row.items.map((item: any) => normalizeItem(item, id))
      : [];
    const payoutSplits = Array.isArray(row?.payout_splits)
      ? row.payout_splits
      : Array.isArray(row?.payoutSplits)
        ? row.payoutSplits
        : [];

    return {
      ...row,
      id,
      order_id: id,
      status: clean(row?.status || row?.payment_status || "Pending"),
      payment_status: clean(row?.payment_status || row?.status || "Pending"),
      delivery_option: clean(row?.delivery_option || row?.deliveryOption),
      delivery_address: clean(row?.delivery_address || row?.deliveryAddress),
      zip_code: clean(row?.zip_code || row?.zipCode),
      subtotal: Number(row?.subtotal || 0),
      service_fee: Number(row?.service_fee || row?.platform_fee || 0),
      delivery_fee: Number(row?.delivery_fee || 0),
      freight_handling_fee: Number(row?.freight_handling_fee || 0),
      tip: Number(row?.tip || 0),
      total: Number(row?.total || 0),
      items,
      payout_splits: payoutSplits,
      created_at: clean(row?.created_at || row?.createdAt),
      updated_at: clean(row?.updated_at || row?.updatedAt),
    };
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

  async function loadTrackingJobs(orderId: string) {
    const allJobs: TrackingJob[] = [];

    const tables = [
      "delivery_jobs",
      "driver_jobs",
      "deliveries",
      "customer_deliveries",
      "tracking",
      "order_tracking",
    ];

    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select("*")
          .or(`order_id.eq.${orderId},orderId.eq.${orderId}`)
          .limit(100);

        if (!error && Array.isArray(data)) {
          allJobs.push(...data);
        }
      } catch {
        // try next
      }
    }

    const unique = Array.from(
      new Map(
        allJobs.map((job: any) => [
          clean(job.id || `${job.order_id || job.orderId}_${job.farmer_id || job.farmerId}_${job.driver_id || job.driverId}`),
          job,
        ])
      ).values()
    );

    setJobs(unique);
  }

  function selectOrder(orderId: string) {
    setSelectedOrderId(orderId);
    loadTrackingJobs(orderId);
  }

  function openOrderDetails() {
    if (!selectedOrder?.id) {
      Alert.alert("No Order", "No order is selected.");
      return;
    }

    router.push({
      pathname: "/customer/order-detail" as any,
      params: { orderId: selectedOrder.id },
    });
  }

  function openFarmerChat(farm?: FarmTracking) {
    if (!selectedOrder?.id) return;

    const selectedFarm = farm || farmTracking[0];

    router.push({
      pathname: "/customer/farmer-chat" as any,
      params: {
        orderId: selectedOrder.id,
        farmerId: selectedFarm?.farmerId || "",
        farmName: selectedFarm?.farmName || "",
        farmerEmail: selectedFarm?.farmerEmail || "",
      },
    });
  }

  function openDriverChat(farm?: FarmTracking) {
    if (!selectedOrder?.id) return;

    const selectedFarm = farm || farmTracking.find((item) => item.driverId) || farmTracking[0];

    router.push({
      pathname: "/customer/driver-chat" as any,
      params: {
        orderId: selectedOrder.id,
        driverId: selectedFarm?.driverId || "",
        driverName: selectedFarm?.driverName || "",
      },
    });
  }

  function renderHeader() {
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
            <Ionicons name="navigate-outline" size={34} color={COLORS.white} />
          </View>

          <Text style={styles.kicker}>Farm2Home Tracking</Text>
          <Text style={styles.heroTitle}>Track Your Order</Text>
          <Text style={styles.heroText}>
            Follow payment, farmer preparation, driver pickup, and delivery status.
          </Text>
        </View>

        {orders.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.orderChips}>
            {orders.map((order) => {
              const active = selectedOrder?.id === order.id;

              return (
                <Pressable
                  key={order.id}
                  style={[styles.orderChip, active && styles.orderChipActive]}
                  onPress={() => selectOrder(order.id)}
                >
                  <Text style={[styles.orderChipText, active && styles.orderChipTextActive]}>
                    #{order.id.slice(-8).toUpperCase()}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {selectedOrder ? (
          <>
            <View style={styles.statusCard}>
              <View style={styles.statusTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.orderNumber}>Order #{selectedOrder.id.slice(-8).toUpperCase()}</Text>
                  <Text style={styles.orderDate}>
                    Ordered {dateTimeLabel(selectedOrder.created_at)}
                  </Text>
                </View>

                <StatusBadge status={mainStatus} tone={getStatusTone(mainStatus) as any} />
              </View>

              <View style={styles.totalRow}>
                <SummaryPill label="Total" value={money(selectedOrder.total)} />
                <SummaryPill label="Farms" value={`${farmTracking.length}`} />
                <SummaryPill label="Delivery" value={clean(selectedOrder.delivery_option || "Delivery")} />
              </View>

              <View style={styles.addressBox}>
                <Ionicons name="location-outline" size={18} color={COLORS.red} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.addressLabel}>Destination</Text>
                  <Text style={styles.addressText}>{deliveryAddress || "Not listed"}</Text>
                </View>
              </View>
            </View>

            <View style={styles.timelineCard}>
              <Text style={styles.sectionTitle}>Delivery Timeline</Text>
              <TimelineStep index={0} current={stepIndex} label="Order Created" icon="receipt-outline" />
              <TimelineStep index={1} current={stepIndex} label="Payment Confirmed" icon="card-outline" />
              <TimelineStep index={2} current={stepIndex} label="Farmer Preparing" icon="leaf-outline" />
              <TimelineStep index={3} current={stepIndex} label="Ready for Pickup" icon="storefront-outline" />
              <TimelineStep index={4} current={stepIndex} label="Driver Assigned" icon="person-outline" />
              <TimelineStep index={5} current={stepIndex} label="Out for Delivery" icon="car-outline" />
              <TimelineStep index={6} current={stepIndex} label="Delivered" icon="checkmark-circle-outline" last />
            </View>

            <View style={styles.quickActions}>
              <ActionButton icon="document-text-outline" label="Details" onPress={openOrderDetails} />
              <ActionButton icon="chatbubbles-outline" label="Farmer Chat" onPress={() => openFarmerChat()} />
              <ActionButton icon="car-outline" label="Driver Chat" onPress={() => openDriverChat()} />
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Farmer Fulfillment</Text>
              <Text style={styles.sectionSubtitle}>
                Each farm has its own preparation and delivery status.
              </Text>
            </View>
          </>
        ) : null}
      </View>
    );
  }

  function renderFarmTracking({ item }: { item: FarmTracking }) {
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
          </View>

          <StatusBadge status={item.status} tone={getStatusTone(item.status) as any} />
        </View>

        <View style={styles.farmInfoGrid}>
          <InfoRow icon="person-outline" label="Driver" value={item.driverName || item.driverId || "Not assigned"} />
          <InfoRow icon="navigate-outline" label="Current Location" value={item.currentLocation || "Waiting for update"} />
          <InfoRow icon="storefront-outline" label="Pickup" value={item.pickupAddress || "Farm pickup location"} />
          <InfoRow icon="location-outline" label="Dropoff" value={item.dropoffAddress || deliveryAddress || "Customer address"} />
        </View>

        {item.items.length > 0 ? (
          <View style={styles.itemsBox}>
            <Text style={styles.itemsTitle}>Items</Text>
            {item.items.slice(0, 5).map((orderItem) => (
              <View key={clean(orderItem.id)} style={styles.itemRow}>
                <Text style={styles.itemName} numberOfLines={1}>
                  {getProductName(orderItem)}
                </Text>
                <Text style={styles.itemQty}>Qty {getQuantity(orderItem)}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.farmButtonRow}>
          <Pressable style={styles.farmButton} onPress={() => openFarmerChat(item)}>
            <Ionicons name="chatbubble-outline" size={16} color={COLORS.red} />
            <Text style={styles.farmButtonText}>Farmer</Text>
          </Pressable>

          <Pressable style={styles.farmButton} onPress={() => openDriverChat(item)}>
            <Ionicons name="car-outline" size={16} color={COLORS.red} />
            <Text style={styles.farmButtonText}>Driver</Text>
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
          <Text style={styles.centerText}>Loading tracking...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />

      <FlatList
        data={farmTracking}
        keyExtractor={(item) => item.farmKey}
        renderItem={renderFarmTracking}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={COLORS.red} />
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="navigate-outline" size={34} color={COLORS.red} />
            </View>
            <Text style={styles.emptyTitle}>No tracking found</Text>
            <Text style={styles.emptyText}>
              Place an order or open an order from My Orders to see tracking.
            </Text>

            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => router.push("/customer/my-orders" as any)}
            >
              <Text style={styles.emptyButtonText}>Open My Orders</Text>
            </TouchableOpacity>
          </View>
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

function TimelineStep({
  index,
  current,
  label,
  icon,
  last,
}: {
  index: number;
  current: number;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  last?: boolean;
}) {
  const complete = current >= index;

  return (
    <View style={styles.timelineRow}>
      <View style={styles.timelineLeft}>
        <View style={[styles.timelineDot, complete && styles.timelineDotComplete]}>
          <Ionicons name={icon} size={15} color={complete ? COLORS.white : COLORS.muted} />
        </View>
        {!last ? <View style={[styles.timelineLine, complete && styles.timelineLineComplete]} /> : null}
      </View>

      <View style={styles.timelineContent}>
        <Text style={[styles.timelineLabel, complete && styles.timelineLabelComplete]}>{label}</Text>
      </View>
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

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={17} color={COLORS.red} />
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
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
  orderChips: { gap: 8, paddingHorizontal: 18, paddingVertical: 14 },
  orderChip: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  orderChipActive: { backgroundColor: COLORS.red, borderColor: COLORS.red },
  orderChipText: { color: COLORS.red, fontWeight: "900" },
  orderChipTextActive: { color: COLORS.white },
  statusCard: {
    backgroundColor: COLORS.card,
    marginHorizontal: 18,
    marginTop: 18,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statusTop: { flexDirection: "row", gap: 10, alignItems: "flex-start", marginBottom: 12 },
  orderNumber: { color: COLORS.text, fontSize: 19, fontWeight: "900" },
  orderDate: { color: COLORS.muted, fontWeight: "700", marginTop: 3 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7 },
  statusBadgeText: { fontWeight: "900", fontSize: 12 },
  totalRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  summaryPill: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 10,
  },
  summaryPillValue: { color: COLORS.red, fontWeight: "900", fontSize: 15 },
  summaryPillLabel: { color: COLORS.muted, fontWeight: "900", fontSize: 11, marginTop: 2 },
  addressBox: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    gap: 9,
  },
  addressLabel: { color: COLORS.muted, fontWeight: "900", fontSize: 11, textTransform: "uppercase" },
  addressText: { color: COLORS.text, fontWeight: "800", marginTop: 3, lineHeight: 20 },
  timelineCard: {
    backgroundColor: COLORS.card,
    marginHorizontal: 18,
    marginTop: 14,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTitle: { color: COLORS.text, fontSize: 22, fontWeight: "900" },
  sectionSubtitle: { color: COLORS.muted, fontWeight: "700", marginTop: 4 },
  timelineRow: { flexDirection: "row", minHeight: 48 },
  timelineLeft: { width: 34, alignItems: "center" },
  timelineDot: {
    width: 30,
    height: 30,
    borderRadius: 12,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  timelineDotComplete: { backgroundColor: COLORS.red },
  timelineLine: { width: 2, flex: 1, backgroundColor: "#E5E7EB" },
  timelineLineComplete: { backgroundColor: COLORS.red },
  timelineContent: { flex: 1, paddingLeft: 8, paddingTop: 5 },
  timelineLabel: { color: COLORS.muted, fontWeight: "800" },
  timelineLabelComplete: { color: COLORS.text, fontWeight: "900" },
  quickActions: {
    flexDirection: Platform.OS === "web" ? "row" : "column",
    gap: 10,
    marginHorizontal: 18,
    marginTop: 14,
  },
  actionButton: {
    flex: 1,
    backgroundColor: "#FEE2E2",
    borderRadius: 16,
    padding: 13,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  actionText: { color: COLORS.red, fontWeight: "900" },
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
  farmInfoGrid: { gap: 8 },
  infoRow: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 15,
    padding: 11,
    flexDirection: "row",
    gap: 9,
  },
  infoLabel: { color: COLORS.muted, fontWeight: "900", fontSize: 11, textTransform: "uppercase" },
  infoValue: { color: COLORS.text, fontWeight: "800", marginTop: 3, lineHeight: 19 },
  itemsBox: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 15,
    padding: 11,
    marginTop: 10,
  },
  itemsTitle: { color: COLORS.text, fontWeight: "900", marginBottom: 8 },
  itemRow: { flexDirection: "row", justifyContent: "space-between", gap: 10, marginBottom: 6 },
  itemName: { color: COLORS.text, fontWeight: "800", flex: 1 },
  itemQty: { color: COLORS.muted, fontWeight: "900" },
  farmButtonRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  farmButton: {
    flex: 1,
    backgroundColor: "#FEE2E2",
    borderRadius: 15,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  farmButtonText: { color: COLORS.red, fontWeight: "900" },
  emptyCard: {
    backgroundColor: COLORS.card,
    marginHorizontal: 18,
    marginTop: 14,
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
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
