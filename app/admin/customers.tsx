// app/admin/customers.tsx

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

type CustomerRow = {
  id: string;
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type OrderRow = {
  id: string;
  customer_id?: string | null;
  total?: number | null;
  status?: string | null;
  created_at?: string | null;
};

type SubscriptionRow = {
  id: string;
  customer_id?: string | null;
  status?: string | null;
  plan_type?: string | null;
  created_at?: string | null;
};

type CustomerCard = CustomerRow & {
  orderCount: number;
  revenue: number;
  subscriptionStatus: string;
};

export default function AdminCustomers() {
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<CustomerCard[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [search, setSearch] = useState("");

  useFocusEffect(
    useCallback(() => {
      loadCustomers();
    }, [])
  );

  async function loadCustomers() {
    try {
      setLoading(true);

      const { data: customerData, error: customerError } = await supabase
        .from("customers")
        .select("*")
        .order("created_at", { ascending: false });

      if (customerError) {
        console.log("Customers error:", customerError.message);
      }

      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select("id, customer_id, total, status, created_at");

      if (orderError) {
        console.log("Customer orders error:", orderError.message);
      }

      const { data: subscriptionData, error: subscriptionError } = await supabase
        .from("customer_subscriptions")
        .select("*");

      if (subscriptionError) {
        console.log("Customer subscriptions error:", subscriptionError.message);
      }

      const cleanCustomers = Array.isArray(customerData)
        ? (customerData as CustomerRow[])
        : [];

      const cleanOrders = Array.isArray(orderData)
        ? (orderData as OrderRow[])
        : [];

      const cleanSubscriptions = Array.isArray(subscriptionData)
        ? (subscriptionData as SubscriptionRow[])
        : [];

      setOrders(cleanOrders);
      setSubscriptions(cleanSubscriptions);

      const mappedCustomers: CustomerCard[] = cleanCustomers.map((customer) => {
        const customerOrders = cleanOrders.filter(
          (order) => String(order.customer_id || "") === String(customer.id)
        );

        const subscription = cleanSubscriptions.find(
          (item) => String(item.customer_id || "") === String(customer.id)
        );

        return {
          ...customer,
          orderCount: customerOrders.length,
          revenue: customerOrders.reduce(
            (sum, order) => sum + Number(order.total || 0),
            0
          ),
          subscriptionStatus: subscription?.status || "none",
        };
      });

      setCustomers(mappedCustomers);
    } catch (error: any) {
      console.log("Admin customers load error:", error);
      Alert.alert(
        "Customers Error",
        error?.message || "Unable to load customers."
      );
    } finally {
      setLoading(false);
    }
  }

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return customers;

    return customers.filter((customer) =>
      [
        customer.full_name,
        customer.name,
        customer.email,
        customer.phone,
        customer.status,
        customer.subscriptionStatus,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [customers, search]);

  const stats = useMemo(() => {
    const totalRevenue = customers.reduce(
      (sum, customer) => sum + customer.revenue,
      0
    );

    const activeCustomers = customers.filter((customer) =>
      ["active", "ACTIVE", "approved", "APPROVED"].includes(
        String(customer.status || "")
      )
    ).length;

    const subscribed = customers.filter((customer) =>
      ["active", "ACTIVE", "paid", "PAID", "trialing", "TRIALING"].includes(
        String(customer.subscriptionStatus || "")
      )
    ).length;

    return {
      totalCustomers: customers.length,
      activeCustomers,
      subscribed,
      totalOrders: orders.length,
      totalRevenue,
    };
  }, [customers, orders]);

  function formatMoney(value: number) {
    return `$${Number(value || 0).toFixed(2)}`;
  }

  function getStatusColor(status?: string | null) {
    const value = String(status || "").toLowerCase();

    if (["active", "approved", "paid", "trialing"].includes(value)) {
      return ui.green;
    }

    if (["pending", "review", "new"].includes(value)) {
      return ui.orange;
    }

    if (["blocked", "cancelled", "canceled", "inactive"].includes(value)) {
      return ui.red;
    }

    return ui.blue;
  }

  function renderBadge(status?: string | null) {
    return (
      <View style={[styles.badge, { backgroundColor: getStatusColor(status) }]}>
        <Text style={styles.badgeText}>{status || "NEW"}</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <StatusBar barStyle="dark-content" backgroundColor={ui.bg} />
        <ActivityIndicator size="large" color={ui.primary} />
        <Text style={styles.loadingText}>Loading customers...</Text>
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
              <Text style={styles.logoSub}>Customer CRM</Text>
            </View>
          </View>

          <NavButton label="Dashboard" icon="grid-outline" route="/admin/dashboard" />
          <NavButton label="Control Tower" icon="radio-outline" route="/admin/control-tower" />
          <NavButton label="Customers" icon="people-outline" route="/admin/customers" active />
          <NavButton label="Orders" icon="receipt-outline" route="/admin/orders" />
          <NavButton label="Analytics" icon="analytics-outline" route="/admin/analytics-center" />
          <NavButton label="Documents" icon="document-text-outline" route="/admin/documents" />
        </View>

        <View style={styles.main}>
          <View style={styles.topbar}>
            <View>
              <Text style={styles.welcome}>Farm2Home Admin CRM</Text>
              <Text style={styles.pageTitle}>Customers</Text>
              <Text style={styles.pageSub}>
                Manage customer accounts, subscriptions, order activity, and revenue.
              </Text>
            </View>

            <TouchableOpacity style={styles.refreshPill} onPress={loadCustomers}>
              <Ionicons name="refresh-outline" size={18} color={ui.primary} />
              <Text style={styles.refreshPillText}>Refresh</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.statsGrid}>
              <StatCard
                label="Total Customers"
                value={String(stats.totalCustomers)}
                icon="people-outline"
                accent
              />
              <StatCard
                label="Active Customers"
                value={String(stats.activeCustomers)}
                icon="person-circle-outline"
                success
              />
              <StatCard
                label="Subscribed"
                value={String(stats.subscribed)}
                icon="card-outline"
              />
              <StatCard
                label="Total Orders"
                value={String(stats.totalOrders)}
                icon="receipt-outline"
              />
              <StatCard
                label="Customer Revenue"
                value={formatMoney(stats.totalRevenue)}
                icon="cash-outline"
                accent
              />
            </View>

            <View style={styles.searchCard}>
              <Ionicons name="search-outline" size={20} color={ui.primary} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search customer name, email, phone, status..."
                placeholderTextColor={ui.muted}
                style={styles.searchInput}
              />
            </View>

            <View style={styles.dataSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Customer Directory</Text>
                <Text style={styles.sectionLink}>
                  {filteredCustomers.length} records
                </Text>
              </View>

              <FlatList
                data={filteredCustomers}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                contentContainerStyle={{ paddingBottom: 80 }}
                ListEmptyComponent={
                  <EmptyCard
                    title="No customers found."
                    text="Customers will appear here after account registration."
                  />
                }
                renderItem={({ item }) => (
                  <View style={styles.customerRow}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {(item.full_name || item.name || item.email || "C")
                          .slice(0, 1)
                          .toUpperCase()}
                      </Text>
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.customerName}>
                        {item.full_name || item.name || "Customer"}
                      </Text>

                      <Text style={styles.customerMeta}>
                        {item.email || "No email"} • {item.phone || "No phone"}
                      </Text>

                      <Text style={styles.customerMeta}>
                        Orders: {item.orderCount} • Revenue:{" "}
                        {formatMoney(item.revenue)}
                      </Text>

                      <Text style={styles.customerMeta}>
                        Subscription: {item.subscriptionStatus}
                      </Text>
                    </View>

                    <View style={styles.rightCol}>
                      {renderBadge(item.status || item.subscriptionStatus)}
                      <TouchableOpacity
                        style={styles.viewButton}
                        onPress={() =>
                          Alert.alert(
                            "Customer Details",
                            `${item.full_name || item.name || "Customer"}\n${
                              item.email || ""
                            }\nOrders: ${item.orderCount}\nRevenue: ${formatMoney(
                              item.revenue
                            )}`
                          )
                        }
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
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent?: boolean;
  success?: boolean;
}) {
  const color = success ? ui.green : accent ? ui.primary : ui.blue;

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
      <Ionicons name="people-outline" size={30} color={ui.primary} />
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
  customerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: ui.border,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 18,
    backgroundColor: ui.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: ui.primary,
    fontWeight: "900",
    fontSize: 18,
  },
  customerName: {
    color: ui.text,
    fontWeight: "900",
    fontSize: 16,
  },
  customerMeta: {
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
  },
  badgeText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 10,
    textTransform: "uppercase",
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