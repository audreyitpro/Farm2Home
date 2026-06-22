// app/customer/notifications.tsx

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
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../data/supabaseClient";

/**
 * app/customer/notifications.tsx
 *
 * Customer notification center.
 *
 * Shows alerts for:
 * - Order paid
 * - Farmer preparing
 * - Ready for pickup
 * - Driver assigned
 * - Out for delivery
 * - Delivered
 * - Farmer message
 * - Driver message
 * - Subscription/membership
 * - Refunds/cancellations
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

type CustomerNotification = {
  id: string;
  customer_id?: string;
  customerId?: string;
  order_id?: string;
  orderId?: string;
  title: string;
  body: string;
  type: string;
  status?: string;
  source?: string;
  route?: string;
  read?: boolean;
  is_read?: boolean;
  created_at: string;
  updated_at?: string;
  metadata?: any;
};

const FILTERS = ["All", "Orders", "Messages", "Delivery", "Membership", "Unread"];

function clean(value: any) {
  return String(value ?? "").trim();
}

function normalize(value: any) {
  return clean(value).toLowerCase();
}

function nowIso() {
  return new Date().toISOString();
}

function getCustomerId(customer: CustomerSession | null) {
  return clean(customer?.id || customer?.customer_id || customer?.customerId);
}

function getCustomerName(customer: CustomerSession | null) {
  return clean(customer?.full_name || customer?.fullName || customer?.name || "Customer");
}

function dateTimeLabel(value: any) {
  const raw = clean(value);
  if (!raw) return "Not listed";

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getOrderId(row: any) {
  return clean(row?.id || row?.order_id || row?.orderId);
}

function prettyStatus(value: any) {
  const status = clean(value || "Pending").replace(/_/g, " ");

  return status
    .split(" ")
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function isRead(item: CustomerNotification) {
  return Boolean(item.read || item.is_read);
}

function notificationTone(type: string, status?: string) {
  const value = normalize(`${type} ${status}`);

  if (
    value.includes("delivered") ||
    value.includes("paid") ||
    value.includes("complete")
  ) {
    return "green";
  }

  if (
    value.includes("driver") ||
    value.includes("delivery") ||
    value.includes("tracking") ||
    value.includes("out for delivery")
  ) {
    return "blue";
  }

  if (value.includes("message") || value.includes("chat")) {
    return "purple";
  }

  if (
    value.includes("refund") ||
    value.includes("cancel") ||
    value.includes("failed")
  ) {
    return "danger";
  }

  if (value.includes("membership") || value.includes("subscription")) {
    return "amber";
  }

  return "amber";
}

function iconForType(type: string, status?: string): keyof typeof Ionicons.glyphMap {
  const value = normalize(`${type} ${status}`);

  if (value.includes("farmer message")) return "leaf-outline";
  if (value.includes("driver message")) return "car-outline";
  if (value.includes("message") || value.includes("chat")) return "chatbubbles-outline";
  if (
    value.includes("driver") ||
    value.includes("delivery") ||
    value.includes("out for delivery")
  ) {
    return "navigate-outline";
  }

  if (value.includes("pickup")) return "storefront-outline";
  if (value.includes("paid") || value.includes("payment")) return "card-outline";
  if (value.includes("delivered") || value.includes("complete")) {
    return "checkmark-circle-outline";
  }

  if (value.includes("membership") || value.includes("subscription")) {
    return "shield-checkmark-outline";
  }

  if (
    value.includes("refund") ||
    value.includes("cancel") ||
    value.includes("failed")
  ) {
    return "warning-outline";
  }

  return "notifications-outline";
}

function normalizeNotification(row: any): CustomerNotification {
  const id = clean(row.id || `notif_${Date.now()}_${Math.random()}`);

  return {
    ...row,
    id,
    customer_id: clean(row.customer_id || row.customerId),
    customerId: clean(row.customer_id || row.customerId),
    order_id: clean(row.order_id || row.orderId),
    orderId: clean(row.order_id || row.orderId),
    title: clean(row.title || row.subject || "Farm2Home Update"),
    body: clean(row.body || row.message || row.description || ""),
    type: clean(row.type || row.notification_type || row.category || "general"),
    status: clean(row.status || ""),
    source: clean(row.source || ""),
    route: clean(row.route || ""),
    read: Boolean(row.read || row.is_read),
    is_read: Boolean(row.read || row.is_read),
    created_at: clean(row.created_at || row.createdAt || nowIso()),
    updated_at: clean(row.updated_at || row.updatedAt || row.created_at || nowIso()),
    metadata: row.metadata || {},
  };
}

function orderToNotification(order: any): CustomerNotification {
  const orderId = getOrderId(order);
  const status = clean(order.status || order.payment_status || "Pending");
  const deliveryOption = clean(order.delivery_option || order.deliveryOption || "Delivery");

  let title = "Order Update";
  let body = `Order #${orderId.slice(-8).toUpperCase()} status is ${prettyStatus(status)}.`;

  const s = normalize(status);

  if (s.includes("paid")) {
    title = "Order Paid";
    body = "Your payment is complete. Farmers can begin preparing your order.";
  } else if (s.includes("preparing")) {
    title = "Farmer Preparing";
    body = "One or more farmers are preparing your Farm2Home order.";
  } else if (s.includes("ready")) {
    title = "Ready For Pickup";
    body =
      deliveryOption === "Pickup"
        ? "Your order is ready for farm pickup."
        : "Your order is ready for driver pickup.";
  } else if (s.includes("driver")) {
    title = "Driver Assigned";
    body = "A driver has been assigned to your delivery.";
  } else if (s.includes("out") || s.includes("transit")) {
    title = "Out For Delivery";
    body = "Your Farm2Home delivery is on the way.";
  } else if (s.includes("delivered")) {
    title = "Delivered";
    body = "Your order was delivered. Thank you for supporting local farms.";
  } else if (s.includes("cancel")) {
    title = "Order Cancelled";
    body = "Your Farm2Home order was cancelled.";
  }

  return {
    id: `order_${orderId}_${clean(order.updated_at || order.updatedAt || order.created_at || order.createdAt)}`,
    customer_id: clean(order.customer_id || order.customerId),
    order_id: orderId,
    title,
    body,
    type: "order",
    status,
    source: "orders",
    route: "/customer/order-detail",
    read: false,
    is_read: false,
    created_at: clean(order.updated_at || order.updatedAt || order.created_at || order.createdAt || nowIso()),
    metadata: order,
  };
}

function messageToNotification(row: any, source: "farmer" | "driver"): CustomerNotification {
  const orderId = clean(row.order_id || row.orderId);
  const senderName = clean(
    row.sender_name ||
      row.senderName ||
      (source === "farmer"
        ? row.farm_name || row.farmName
        : row.driver_name || row.driverName)
  );

  return {
    id: `msg_${source}_${clean(row.id || `${orderId}_${row.created_at}`)}`,
    customer_id: clean(row.customer_id || row.customerId),
    order_id: orderId,
    title: source === "farmer" ? "Farmer Message" : "Driver Message",
    body: `${senderName || (source === "farmer" ? "Farmer" : "Driver")}: ${clean(
      row.message || "New message"
    )}`,
    type: source === "farmer" ? "farmer_message" : "driver_message",
    status: "unread",
    source: `${source}_chat`,
    route: source === "farmer" ? "/customer/farmer-chat" : "/customer/driver-chat",
    read: Boolean(row.read_by_customer),
    is_read: Boolean(row.read_by_customer),
    created_at: clean(row.created_at || row.createdAt || nowIso()),
    metadata: row,
  };
}

export default function CustomerNotifications() {
  const [customer, setCustomer] = useState<CustomerSession | null>(null);
  const [notifications, setNotifications] = useState<CustomerNotification[]>([]);
  const [selectedFilter, setSelectedFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadScreen();
    }, [])
  );

  const unreadCount = useMemo(
    () => notifications.filter((item) => !isRead(item)).length,
    [notifications]
  );

  const filteredNotifications = useMemo(() => {
    if (selectedFilter === "All") return notifications;
    if (selectedFilter === "Unread") return notifications.filter((item) => !isRead(item));

    const key = normalize(selectedFilter);

    return notifications.filter((item) => {
      const type = normalize(item.type);
      const title = normalize(item.title);

      if (key === "orders") return type.includes("order") || title.includes("order");
      if (key === "messages") return type.includes("message") || title.includes("message");
      if (key === "delivery") {
        return (
          type.includes("driver") ||
          type.includes("delivery") ||
          title.includes("delivery") ||
          title.includes("driver")
        );
      }

      if (key === "membership") {
        return (
          type.includes("membership") ||
          type.includes("subscription") ||
          title.includes("membership") ||
          title.includes("subscription")
        );
      }

      return true;
    });
  }, [notifications, selectedFilter]);

  async function loadScreen() {
    try {
      setLoading(true);
      const activeCustomer = await loadCustomer();
      await loadNotifications(activeCustomer);
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    try {
      setRefreshing(true);
      const activeCustomer = customer || (await loadCustomer());
      await loadNotifications(activeCustomer);
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

  async function loadNotifications(activeCustomer: CustomerSession | null) {
    const customerId = getCustomerId(activeCustomer);
    const customerEmail = normalize(activeCustomer?.email);
    const all: CustomerNotification[] = [];

    const storedReadRaw = await AsyncStorage.getItem("customerReadNotifications");
    const readIds = new Set<string>();

    if (storedReadRaw) {
      try {
        const parsed = JSON.parse(storedReadRaw);
        if (Array.isArray(parsed)) parsed.forEach((id) => readIds.add(clean(id)));
      } catch {
        // Ignore invalid local read cache.
      }
    }

    all.push(...(await fetchExplicitNotifications(customerId, customerEmail)));
    all.push(...(await fetchOrderNotifications(customerId, customerEmail)));
    all.push(...(await fetchMessageNotifications(customerId, "farmer")));
    all.push(...(await fetchMessageNotifications(customerId, "driver")));
    all.push(...(await buildMembershipNotifications(activeCustomer)));

    const unique = Array.from(
      new Map(
        all.map((item) => {
          const normalized = normalizeNotification(item);

          if (readIds.has(normalized.id)) {
            normalized.read = true;
            normalized.is_read = true;
          }

          return [normalized.id, normalized];
        })
      ).values()
    ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    setNotifications(unique);
  }

  async function fetchExplicitNotifications(customerId: string, customerEmail: string) {
    const tables = ["customer_notifications", "notifications", "order_notifications"];
    const found: CustomerNotification[] = [];

    for (const table of tables) {
      try {
        let query = supabase
          .from(table)
          .select("*")
          .order("created_at", { ascending: false })
          .limit(150);

        if (customerId && customerEmail) {
          query = query.or(
            `customer_id.eq.${customerId},customerId.eq.${customerId},email.eq.${customerEmail},customer_email.eq.${customerEmail}`
          );
        } else if (customerId) {
          query = query.or(`customer_id.eq.${customerId},customerId.eq.${customerId}`);
        } else if (customerEmail) {
          query = query.or(`email.eq.${customerEmail},customer_email.eq.${customerEmail}`);
        } else {
          continue;
        }

        const { data, error } = await query;

        if (!error && Array.isArray(data)) {
          found.push(...data.map(normalizeNotification));
        }
      } catch {
        // Try next table.
      }
    }

    return found;
  }

  async function fetchOrderNotifications(customerId: string, customerEmail: string) {
    const tables = ["orders", "customer_orders", "farm_orders"];
    const found: CustomerNotification[] = [];

    for (const table of tables) {
      try {
        let query = supabase
          .from(table)
          .select("*")
          .order("updated_at", { ascending: false })
          .limit(100);

        if (customerId && customerEmail) {
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
          found.push(...data.map(orderToNotification));
        }
      } catch {
        // Try next table.
      }
    }

    return found;
  }

  async function fetchMessageNotifications(customerId: string, source: "farmer" | "driver") {
    if (!customerId) return [];

    const tables =
      source === "farmer"
        ? ["customer_farmer_messages", "farm_messages", "messages", "chat_messages"]
        : [
            "customer_driver_messages",
            "driver_messages",
            "delivery_messages",
            "messages",
            "chat_messages",
          ];

    const found: CustomerNotification[] = [];

    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select("*")
          .eq("customer_id", customerId)
          .eq("receiver_role", "customer")
          .order("created_at", { ascending: false })
          .limit(50);

        if (!error && Array.isArray(data)) {
          found.push(...data.map((row) => messageToNotification(row, source)));
          break;
        }
      } catch {
        // Try next table.
      }
    }

    return found;
  }

  async function buildMembershipNotifications(activeCustomer: CustomerSession | null) {
    const customerId = getCustomerId(activeCustomer);
    const customerEmail = normalize(activeCustomer?.email);
    const found: CustomerNotification[] = [];

    if (!customerId && !customerEmail) return found;

    try {
      let query = supabase
        .from("customer_subscriptions")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1);

      if (customerId && customerEmail) {
        query = query.or(`customer_id.eq.${customerId},customer_email.eq.${customerEmail}`);
      } else if (customerId) {
        query = query.eq("customer_id", customerId);
      } else {
        query = query.eq("customer_email", customerEmail);
      }

      const { data, error } = await query;

      if (!error && Array.isArray(data) && data[0]) {
        const sub = data[0];
        const status = clean(sub.subscription_status || "pending_payment");

        found.push({
          id: `membership_${clean(sub.id || customerId)}_${clean(
            sub.updated_at || sub.created_at || ""
          )}`,
          customer_id: customerId,
          title: status === "active" ? "Membership Active" : "Membership Update",
          body:
            status === "active"
              ? "Your customer membership is active."
              : `Your customer membership status is ${prettyStatus(status)}.`,
          type: "membership",
          status,
          source: "customer_subscriptions",
          route: "/customer/subscription",
          read: false,
          is_read: false,
          created_at: clean(sub.updated_at || sub.created_at || nowIso()),
          metadata: sub,
        });
      }
    } catch {
      // Table may not exist.
    }

    return found;
  }

  async function saveReadIds(nextIds: string[]) {
    await AsyncStorage.setItem("customerReadNotifications", JSON.stringify(nextIds));
  }

  async function markOneRead(item: CustomerNotification) {
    const next = notifications.map((notif) =>
      notif.id === item.id ? { ...notif, read: true, is_read: true } : notif
    );

    setNotifications(next);
    await saveReadIds(next.filter((notif) => isRead(notif)).map((notif) => notif.id));

    const tables = ["customer_notifications", "notifications", "order_notifications"];

    for (const table of tables) {
      try {
        await supabase
          .from(table)
          .update({
            read: true,
            is_read: true,
            updated_at: nowIso(),
          })
          .eq("id", item.id);
      } catch {
        // Skip missing table/columns.
      }
    }
  }

  async function markAllRead() {
    const next = notifications.map((item) => ({
      ...item,
      read: true,
      is_read: true,
    }));

    setNotifications(next);
    await saveReadIds(next.map((item) => item.id));

    const customerId = getCustomerId(customer);

    for (const table of ["customer_notifications", "notifications", "order_notifications"]) {
      try {
        await supabase
          .from(table)
          .update({
            read: true,
            is_read: true,
            updated_at: nowIso(),
          })
          .eq("customer_id", customerId);
      } catch {
        // Skip missing table/columns.
      }
    }
  }

  async function clearLocalRead() {
    Alert.alert("Reset Read Status", "This clears local read status for notifications.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reset",
        style: "destructive",
        onPress: async () => {
          await AsyncStorage.removeItem("customerReadNotifications");
          await refresh();
        },
      },
    ]);
  }

  async function openNotification(item: CustomerNotification) {
    await markOneRead(item);

    const orderId = clean(
      item.order_id ||
        item.orderId ||
        item.metadata?.order_id ||
        item.metadata?.orderId ||
        item.metadata?.id
    );

    const type = normalize(item.type);

    if (type.includes("farmer_message")) {
      router.push({
        pathname: "/customer/farmer-chat" as any,
        params: {
          orderId,
          farmerId: clean(item.metadata?.farmer_id || item.metadata?.farmerId),
          farmName: clean(item.metadata?.farm_name || item.metadata?.farmName),
        },
      });
      return;
    }

    if (type.includes("driver_message")) {
      router.push({
        pathname: "/customer/driver-chat" as any,
        params: {
          orderId,
          driverId: clean(item.metadata?.driver_id || item.metadata?.driverId),
          driverName: clean(item.metadata?.driver_name || item.metadata?.driverName),
        },
      });
      return;
    }

    if (
      type.includes("delivery") ||
      normalize(item.title).includes("driver") ||
      normalize(item.title).includes("delivery")
    ) {
      router.push({
        pathname: "/customer/tracking" as any,
        params: { orderId },
      });
      return;
    }

    if (type.includes("membership") || type.includes("subscription")) {
      router.push("/customer/subscription" as any);
      return;
    }

    if (orderId) {
      router.push({
        pathname: "/customer/order-detail" as any,
        params: { orderId },
      });
      return;
    }

    router.push("/customer/my-orders" as any);
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
            <Ionicons name="notifications-outline" size={34} color={COLORS.white} />
          </View>

          <Text style={styles.kicker}>Farm2Home Alerts</Text>
          <Text style={styles.heroTitle}>Notifications</Text>
          <Text style={styles.heroText}>
            Order updates, delivery alerts, farmer messages, driver messages, and membership notices.
          </Text>
        </View>

        <View style={styles.metricsRow}>
          <MetricCard
            icon="notifications-outline"
            label="Total"
            value={`${notifications.length}`}
            tone="red"
          />
          <MetricCard
            icon="mail-unread-outline"
            label="Unread"
            value={`${unreadCount}`}
            tone="amber"
          />
          <MetricCard
            icon="receipt-outline"
            label="Orders"
            value={`${notifications.filter((n) => normalize(n.type).includes("order")).length}`}
            tone="blue"
          />
          <MetricCard
            icon="chatbubbles-outline"
            label="Messages"
            value={`${notifications.filter((n) => normalize(n.type).includes("message")).length}`}
            tone="green"
          />
        </View>

        <View style={styles.controls}>
          <TouchableOpacity style={styles.controlButton} onPress={markAllRead} activeOpacity={0.9}>
            <Ionicons name="checkmark-done-outline" size={17} color={COLORS.red} />
            <Text style={styles.controlText}>Mark All Read</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.controlButton} onPress={clearLocalRead} activeOpacity={0.9}>
            <Ionicons name="refresh-outline" size={17} color={COLORS.red} />
            <Text style={styles.controlText}>Reset</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTERS.map((filter) => {
            const active = selectedFilter === filter;

            return (
              <Pressable
                key={filter}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setSelectedFilter(filter)}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>
                  {filter}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{selectedFilter} Alerts</Text>
          <Text style={styles.sectionSubtitle}>
            {filteredNotifications.length} alert
            {filteredNotifications.length === 1 ? "" : "s"} for {getCustomerName(customer)}
          </Text>
        </View>
      </View>
    );
  }

  function renderNotification({ item }: { item: CustomerNotification }) {
    const tone = notificationTone(item.type, item.status);
    const config = {
      green: { bg: COLORS.greenSoft, color: COLORS.greenDark },
      amber: { bg: COLORS.amberSoft, color: "#92400E" },
      blue: { bg: COLORS.blueSoft, color: COLORS.blue },
      purple: { bg: COLORS.purpleSoft, color: COLORS.purple },
      danger: { bg: COLORS.dangerSoft, color: COLORS.danger },
    }[tone];

    const unread = !isRead(item);

    return (
      <Pressable
        style={({ pressed }) => [
          styles.notificationCard,
          unread && styles.unreadCard,
          pressed && styles.pressed,
        ]}
        onPress={() => openNotification(item)}
      >
        <View style={[styles.notificationIcon, { backgroundColor: config.bg }]}>
          <Ionicons name={iconForType(item.type, item.status)} size={22} color={config.color} />
        </View>

        <View style={{ flex: 1 }}>
          <View style={styles.notificationTitleRow}>
            <Text style={styles.notificationTitle} numberOfLines={1}>
              {item.title}
            </Text>
            {unread ? <View style={styles.unreadDot} /> : null}
          </View>

          <Text style={styles.notificationBody} numberOfLines={2}>
            {item.body || prettyStatus(item.status)}
          </Text>

          <View style={styles.notificationMetaRow}>
            <Text style={styles.notificationMeta}>{dateTimeLabel(item.created_at)}</Text>

            {item.order_id ? (
              <>
                <Text style={styles.notificationMeta}>•</Text>
                <Text style={styles.notificationMeta}>
                  Order #{item.order_id.slice(-8).toUpperCase()}
                </Text>
              </>
            ) : null}
          </View>
        </View>

        <Ionicons name="chevron-forward-outline" size={18} color={COLORS.muted} />
      </Pressable>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.red} size="large" />
          <Text style={styles.centerText}>Loading notifications...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />

      <FlatList
        data={filteredNotifications}
        keyExtractor={(item) => item.id}
        renderItem={renderNotification}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={COLORS.red} />
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="notifications-off-outline" size={34} color={COLORS.red} />
            </View>

            <Text style={styles.emptyTitle}>No notifications</Text>
            <Text style={styles.emptyText}>
              Farm2Home order, delivery, message, and membership alerts will appear here.
            </Text>

            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => router.push("/customer/marketplace" as any)}
            >
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

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  centerText: {
    color: COLORS.muted,
    fontWeight: "800",
  },
  listContent: {
    paddingBottom: 70,
  },
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
  backButtonText: {
    color: COLORS.white,
    fontWeight: "900",
  },
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
  heroTitle: {
    color: COLORS.white,
    fontSize: 34,
    fontWeight: "900",
    marginTop: 6,
  },
  heroText: {
    color: "#CBD5E1",
    fontWeight: "700",
    lineHeight: 22,
    marginTop: 8,
  },
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
  metricValue: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "900",
  },
  metricLabel: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "900",
    marginTop: 2,
  },
  controls: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 18,
    marginTop: 14,
  },
  controlButton: {
    flex: 1,
    backgroundColor: "#FEE2E2",
    borderRadius: 16,
    padding: 13,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  controlText: {
    color: COLORS.red,
    fontWeight: "900",
  },
  filterRow: {
    gap: 8,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 6,
  },
  filterChip: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  filterChipActive: {
    backgroundColor: COLORS.red,
    borderColor: COLORS.red,
  },
  filterText: {
    color: COLORS.red,
    fontWeight: "900",
  },
  filterTextActive: {
    color: COLORS.white,
  },
  sectionHeader: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 10,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "900",
  },
  sectionSubtitle: {
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 4,
  },
  notificationCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 22,
    padding: 14,
    marginHorizontal: 18,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  unreadCard: {
    borderColor: "#FCA5A5",
    backgroundColor: "#FFFBFB",
  },
  notificationIcon: {
    width: 48,
    height: 48,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  notificationTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  notificationTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 16,
    flex: 1,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: COLORS.red,
  },
  notificationBody: {
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 4,
  },
  notificationMetaRow: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    marginTop: 7,
    flexWrap: "wrap",
  },
  notificationMeta: {
    color: COLORS.redDark,
    fontWeight: "900",
    fontSize: 11,
  },
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
  emptyTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
  },
  emptyText: {
    color: COLORS.muted,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 22,
    marginTop: 8,
  },
  emptyButton: {
    backgroundColor: COLORS.red,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 13,
    marginTop: 18,
  },
  emptyButtonText: {
    color: COLORS.white,
    fontWeight: "900",
  },
  pressed: {
    opacity: 0.72,
  },
});
