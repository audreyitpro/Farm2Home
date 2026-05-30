// app/admin/orders.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../services/supabaseClient";

const ui = {
  bg: "#F5F7FB",
  card: "#FFFFFF",
  border: "#E5E7EB",
  text: "#111827",
  muted: "#6B7280",
  soft: "#F9FAFB",
  primary: "#7C3AED",
  primarySoft: "#EDE9FE",
  green: "#10B981",
  blue: "#2563EB",
  orange: "#F59E0B",
  red: "#EF4444",
};

type OrderRow = {
  id: string;
  customer_id?: string | null;
  farmer_id?: string | null;
  status?: string | null;
  total?: number | null;
  total_amount?: number | null;
  amount?: number | null;
  delivery_method?: string | null;
  delivery_address?: string | null;
  created_at?: string | null;
  customers?: {
    full_name?: string | null;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  farmers?: {
    farm_name?: string | null;
    owner_name?: string | null;
  } | null;
};

type OrderItemRow = {
  id: string;
  order_id?: string | null;
  product_name?: string | null;
  name?: string | null;
  quantity?: number | null;
  price?: number | null;
  total?: number | null;
};

type AdminOrder = OrderRow & {
  itemCount: number;
  orderTotal: number;
};

export default function AdminOrders() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItemRow[]>([]);
  const [search, setSearch] = useState("");

  useFocusEffect(
    useCallback(() => {
      loadOrders();
    }, [])
  );

  async function loadOrders() {
    try {
      setLoading(true);

      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select(
          `
          *,
          customers (
            full_name,
            name,
            email,
            phone
          ),
          farmers (
            farm_name,
            owner_name
          )
        `
        )
        .order("created_at", { ascending: false })
        .limit(150);

      if (orderError) {
        console.log("Admin orders error:", orderError.message);
      }

      const { data: itemData, error: itemError } = await supabase
        .from("order_items")
        .select("*");

      if (itemError) {
        console.log("Admin order items error:", itemError.message);
      }

      const cleanOrders = Array.isArray(orderData) ? (orderData as OrderRow[]) : [];
      const cleanItems = Array.isArray(itemData) ? (itemData as OrderItemRow[]) : [];

      setOrderItems(cleanItems);

      const mapped: AdminOrder[] = cleanOrders.map((order) => {
        const items = cleanItems.filter(
          (item) => String(item.order_id || "") === String(order.id)
        );

        const orderTotal = Number(
          order.total || order.total_amount || order.amount || 0
        );

        return {
          ...order,
          itemCount: items.length,
          orderTotal,
        };
      });

      setOrders(mapped);
    } catch (error: any) {
      console.log("Admin orders load crash:", error);
      Alert.alert("Orders Error", error?.message || "Unable to load orders.");
    } finally {
      setLoading(false);
    }
  }

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return orders;

    return orders.filter((order) =>
      [
        order.id,
        order.status,
        order.delivery_method,
        order.delivery_address,
        order.customers?.full_name,
        order.customers?.name,
        order.customers?.email,
        order.customers?.phone,
        order.farmers?.farm_name,
        order.farmers?.owner_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [orders, search]);

  const stats = useMemo(() => {
    const revenue = orders.reduce((sum, order) => sum + order.orderTotal, 0);

    const activeOrders = orders.filter((order) =>
      [
        "PAID",
        "ACCEPTED",
        "PREPARING",
        "READY_FOR_PICKUP",
        "PICKED_UP",
        "IN_TRANSIT",
        "PENDING_PAYMENT",
        "paid",
        "accepted",
        "preparing",
        "ready_for_pickup",
        "picked_up",
        "in_transit",
        "pending_payment",
      ].includes(String(order.status || ""))
    ).length;

    const delivered = orders.filter((order) =>
      ["DELIVERED", "delivered"].includes(String(order.status || ""))
    ).length;

    const cancelled = orders.filter((order) =>
      ["CANCELLED", "REFUNDED", "cancelled", "refunded"].includes(
        String(order.status || "")
      )
    ).length;

    return {
      totalOrders: orders.length,
      activeOrders,
      delivered,
      cancelled,
      revenue,
      avgOrder: orders.length > 0 ? revenue / orders.length : 0,
    };
  }, [orders]);

  function formatMoney(value: number) {
    return `$${Number(value || 0).toFixed(2)}`;
  }

  function getStatusColor(status?: string | null) {
    const value = String(status || "").toLowerCase();

    if (["delivered", "paid", "accepted"].includes(value)) return ui.green;
    if (["preparing", "ready_for_pickup", "picked_up"].includes(value)) {
      return ui.orange;
    }
    if (["in_transit"].includes(value)) return ui.blue;
    if (["cancelled", "canceled", "refunded"].includes(value)) return ui.red;
    if (["pending_payment", "pending"].includes(value)) return ui.primary;

    return "#64748B";
  }

  function renderBadge(status?: string | null) {
    return (
      <View style={[styles.badge, { backgroundColor: getStatusColor(status) }]}>
        <Text style={styles.badgeText}>{status || "UNKNOWN"}</Text>
      </View>
    );
  }

  function orderDate(value?: string | null) {
    if (!value) return "Unknown date";

    try {
      return new Date(value).toLocaleString();
    } catch {
      return "Unknown date";
    }
  }

  function openOrderDetails(order: AdminOrder) {
    const items = orderItems.filter(
      (item) => String(item.order_id || "") === String(order.id)
    );

    const itemSummary =
      items.length > 0
        ? items
            .slice(0, 6)
            .map(
              (item) =>
                `${item.quantity || 1}x ${
                  item.product_name || item.name || "Item"
                }`
            )
            .join("\n")
        : "No item details found.";

    Alert.alert(
      `Order #${order.id.slice(-6)}`,
      `Customer: ${
        order.customers?.full_name ||
        order.customers?.name ||
        order.customers?.email ||
        "Customer"
      }\nFarm: ${order.farmers?.farm_name || "Not assigned"}\nStatus: ${
        order.status || "Unknown"
      }\nTotal: ${formatMoney(order.orderTotal)}\n\nItems:\n${itemSummary}`
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <StatusBar barStyle="dark-content" backgroundColor={ui.bg} />
        <ActivityIndicator size="large" color={ui.primary} />
        <Text style={styles.loadingText}>Loading orders...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={ui.bg} />

      <View style={styles.shell}>
        <View style={styles.sidebar}>
          <View style={styles.logoRow}>
            <View style={styles.logoMark}>
              <Text style={styles.logoText}>F2H</Text>
            </View>

            <View>
              <Text style={styles.logoTitle}>Farm2Home</Text>
              <Text style={styles.logoSub}>Order Management</Text>
            </View>
          </View>

          <NavButton label="Dashboard" icon="grid-outline" route="/admin/dashboard" />
          <NavButton label="Control Tower" icon="radio-outline" route="/admin/control-tower" />
          <NavButton label="Customers" icon="people-outline" route="/admin/customers" />
          <NavButton label="Orders" icon="receipt-outline" route="/admin/orders" active />
          <NavButton label="Analytics" icon="analytics-outline" route="/admin/analytics-center" />
          <NavButton label="Live Ops" icon="navigate-outline" route="/admin/live-operations-center" />
        </View>

        <View style={styles.main}>
          <View style={styles.topbar}>
            <View>
              <Text style={styles.welcome}>Farm2Home Admin</Text>
              <Text style={styles.pageTitle}>Orders</Text>
              <Text style={styles.pageSub}>
                Review customer orders, farm fulfillment, delivery status, and revenue.
              </Text>
            </View>

            <TouchableOpacity style={styles.refreshPill} onPress={loadOrders}>
              <Ionicons name="refresh-outline" size={18} color={ui.primary} />
              <Text style={styles.refreshPillText}>Refresh</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.statsGrid}>
              <StatCard label="Total Orders" value={String(stats.totalOrders)} icon="receipt-outline" accent />
              <StatCard label="Active Orders" value={String(stats.activeOrders)} icon="time-outline" />
              <StatCard label="Delivered" value={String(stats.delivered)} icon="checkmark-done-outline" success />
              <StatCard label="Cancelled" value={String(stats.cancelled)} icon="close-circle-outline" danger />
              <StatCard label="Revenue" value={formatMoney(stats.revenue)} icon="cash-outline" accent />
              <StatCard label="Avg Order" value={formatMoney(stats.avgOrder)} icon="analytics-outline" />
            </View>

            <View style={styles.searchCard}>
              <Ionicons name="search-outline" size={20} color={ui.primary} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search order ID, customer, farm, status..."
                placeholderTextColor={ui.muted}
                style={styles.searchInput}
              />
            </View>

            <View style={styles.dataSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Order Directory</Text>
                <Text style={styles.sectionLink}>
                  {filteredOrders.length} records
                </Text>
              </View>

              <FlatList
                data={filteredOrders}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                contentContainerStyle={{ paddingBottom: 80 }}
                ListEmptyComponent={
                  <EmptyCard
                    title="No orders found."
                    text="Customer orders will appear here after checkout."
                  />
                }
                renderItem={({ item }) => (
                  <View style={styles.orderRow}>
                    <View style={styles.orderIcon}>
                      <Ionicons name="receipt-outline" size={20} color={ui.primary} />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.orderTitle}>Order #{item.id.slice(-6)}</Text>

                      <Text style={styles.orderMeta}>
                        Customer:{" "}
                        {item.customers?.full_name ||
                          item.customers?.name ||
                          item.customers?.email ||
                          "Customer"}
                      </Text>

                      <Text style={styles.orderMeta}>
                        Farm: {item.farmers?.farm_name || "Not assigned"}
                      </Text>

                      <Text style={styles.orderMeta}>
                        Items: {item.itemCount} • Total:{" "}
                        {formatMoney(item.orderTotal)}
                      </Text>

                      <Text style={styles.orderMeta}>
                        Created: {orderDate(item.created_at)}
                      </Text>
                    </View>

                    <View style={styles.rightCol}>
                      {renderBadge(item.status)}

                      <TouchableOpacity
                        style={styles.viewButton}
                        onPress={() => openOrderDetails(item)}
                      >
                        <Text style={styles.viewButtonText}>View</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

function NavButton({
  label,
  icon,
  route,
  active = false,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  active?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.navButton, active && styles.navButtonActive]}
      onPress={() => router.push(route as any)}
    >
      <Ionicons name={icon} size={18} color={active ? "#FFFFFF" : ui.muted} />
      <Text style={[styles.navText, active && styles.navTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function StatCard({
  label,
  value,
  icon,
  accent = false,
  success = false,
  danger = false,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent?: boolean;
  success?: boolean;
  danger?: boolean;
}) {
  const color = danger ? ui.red : success ? ui.green : accent ? ui.primary : ui.blue;

  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>

      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function EmptyCard({ title, text }: { title: string; text?: string }) {
  return (
    <View style={styles.emptyCard}>
      <Ionicons name="receipt-outline" size={30} color={ui.primary} />
      <Text style={styles.emptyTitle}>{title}</Text>
      {!!text && <Text style={styles.emptyText}>{text}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: ui.bg,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: ui.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: ui.muted,
    marginTop: 10,
    fontWeight: "800",
  },
  shell: {
    flex: 1,
    backgroundColor: ui.bg,
  },
  sidebar: {
    backgroundColor: ui.card,
    borderBottomWidth: 1,
    borderBottomColor: ui.border,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 12,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  logoMark: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: ui.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 13,
  },
  logoTitle: {
    color: ui.text,
    fontWeight: "900",
    fontSize: 18,
  },
  logoSub: {
    color: ui.muted,
    fontWeight: "700",
    fontSize: 12,
  },
  navButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: ui.soft,
  },
  navButtonActive: {
    backgroundColor: ui.primary,
  },
  navText: {
    color: ui.muted,
    fontWeight: "900",
    fontSize: 13,
  },
  navTextActive: {
    color: "#FFFFFF",
  },
  main: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  topbar: {
    backgroundColor: ui.card,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: ui.border,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  welcome: {
    color: ui.muted,
    fontWeight: "800",
    marginBottom: 4,
  },
  pageTitle: {
    color: ui.text,
    fontSize: 26,
    fontWeight: "900",
  },
  pageSub: {
    color: ui.muted,
    marginTop: 4,
    fontWeight: "700",
    maxWidth: 720,
  },
  refreshPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: ui.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  refreshPillText: {
    color: ui.primary,
    fontWeight: "900",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 14,
  },
  statCard: {
    width: "48%",
    backgroundColor: ui.card,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: ui.border,
  },
  statIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  statValue: {
    color: ui.text,
    fontSize: 22,
    fontWeight: "900",
  },
  statLabel: {
    color: ui.muted,
    fontWeight: "800",
    marginTop: 4,
  },
  searchCard: {
    backgroundColor: ui.card,
    borderRadius: 18,
    paddingHorizontal: 14,
    height: 52,
    borderWidth: 1,
    borderColor: ui.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    color: ui.text,
    fontWeight: "800",
  },
  dataSection: {
    backgroundColor: ui.card,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: ui.border,
    marginBottom: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    color: ui.text,
    fontSize: 19,
    fontWeight: "900",
  },
  sectionLink: {
    color: ui.primary,
    fontWeight: "900",
    fontSize: 12,
  },
  orderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: ui.border,
  },
  orderIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: ui.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  orderTitle: {
    color: ui.text,
    fontWeight: "900",
    fontSize: 16,
  },
  orderMeta: {
    color: ui.muted,
    fontWeight: "700",
    marginTop: 4,
    lineHeight: 18,
    fontSize: 12,
  },
  rightCol: {
    alignItems: "flex-end",
    gap: 8,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: 130,
  },
  badgeText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 10,
    textTransform: "uppercase",
    textAlign: "center",
  },
  viewButton: {
    backgroundColor: ui.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  viewButtonText: {
    color: ui.primary,
    fontWeight: "900",
    fontSize: 12,
  },
  emptyCard: {
    borderTopWidth: 1,
    borderTopColor: ui.border,
    padding: 18,
    alignItems: "center",
  },
  emptyTitle: {
    color: ui.text,
    fontWeight: "900",
    fontSize: 17,
    marginTop: 8,
    textAlign: "center",
  },
  emptyText: {
    color: ui.muted,
    fontWeight: "700",
    lineHeight: 21,
    textAlign: "center",
    marginTop: 5,
  },
});