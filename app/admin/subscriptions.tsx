// app/admin/subscriptions.tsx

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

type SubscriptionType = "Customer" | "Farmer" | "Driver" | "Freight";

type SubscriptionRow = {
  id: string;
  user_id?: string | null;
  customer_id?: string | null;
  farmer_id?: string | null;
  driver_id?: string | null;
  freight_id?: string | null;
  freight_user_id?: string | null;
  status?: string | null;
  plan_type?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  amount?: number | null;
  price?: number | null;
  monthly_amount?: number | null;
  created_at?: string | null;
};

type SubscriptionCard = SubscriptionRow & {
  type: SubscriptionType;
  accountId: string;
  displayPlan: string;
  monthlyValue: number;
};

export default function AdminSubscriptions() {
  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState<SubscriptionCard[]>([]);
  const [search, setSearch] = useState("");

  useFocusEffect(
    useCallback(() => {
      loadSubscriptions();
    }, [])
  );

  async function loadSubscriptions() {
    try {
      setLoading(true);

      const { data: customerSubs } = await supabase
        .from("customer_subscriptions")
        .select("*");

      const { data: farmerSubs } = await supabase
        .from("farmer_subscriptions")
        .select("*");

      const { data: driverSubs } = await supabase
        .from("driver_subscriptions")
        .select("*");

      const { data: freightSubs } = await supabase
        .from("freight_subscriptions")
        .select("*");

      const mapped: SubscriptionCard[] = [
        ...mapSubscriptions(customerSubs, "Customer"),
        ...mapSubscriptions(farmerSubs, "Farmer"),
        ...mapSubscriptions(driverSubs, "Driver"),
        ...mapSubscriptions(freightSubs, "Freight"),
      ].sort((a, b) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bTime - aTime;
      });

      setSubscriptions(mapped);
    } catch (error: any) {
      Alert.alert(
        "Subscriptions Error",
        error?.message || "Unable to load subscriptions."
      );
    } finally {
      setLoading(false);
    }
  }

  function mapSubscriptions(
    rows: any[] | null,
    type: SubscriptionType
  ): SubscriptionCard[] {
    const cleanRows = Array.isArray(rows) ? rows : [];

    return cleanRows.map((item: SubscriptionRow) => {
      const accountId = String(
        item.customer_id ||
          item.farmer_id ||
          item.driver_id ||
          item.freight_id ||
          item.freight_user_id ||
          item.user_id ||
          "unknown"
      );

      return {
        ...item,
        type,
        accountId,
        displayPlan: item.plan_type || `${type} Membership`,
        monthlyValue: getMonthlyValue(item, type),
      };
    });
  }

  function getMonthlyValue(item: SubscriptionRow, type: SubscriptionType) {
    const existing = Number(item.monthly_amount || item.amount || item.price || 0);
    if (existing > 0) return existing;

    if (type === "Customer") return 4.99;
    if (type === "Farmer") return 14.99;
    if (type === "Driver") return 4.99;
    if (type === "Freight") return 29.99;

    return 0;
  }

  const filteredSubscriptions = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return subscriptions;

    return subscriptions.filter((item) =>
      [
        item.id,
        item.type,
        item.accountId,
        item.status,
        item.displayPlan,
        item.stripe_customer_id,
        item.stripe_subscription_id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [subscriptions, search]);

  const stats = useMemo(() => {
    const active = subscriptions.filter((item) =>
      ["active", "paid", "trialing", "ACTIVE", "PAID", "TRIALING"].includes(
        String(item.status || "")
      )
    );

    const cancelled = subscriptions.filter((item) =>
      ["cancelled", "canceled", "inactive", "CANCELLED", "CANCELED"].includes(
        String(item.status || "")
      )
    );

    const monthlyRevenue = active.reduce(
      (sum, item) => sum + item.monthlyValue,
      0
    );

    return {
      total: subscriptions.length,
      active: active.length,
      cancelled: cancelled.length,
      customer: subscriptions.filter((x) => x.type === "Customer").length,
      farmer: subscriptions.filter((x) => x.type === "Farmer").length,
      driver: subscriptions.filter((x) => x.type === "Driver").length,
      freight: subscriptions.filter((x) => x.type === "Freight").length,
      monthlyRevenue,
    };
  }, [subscriptions]);

  function formatMoney(value: number) {
    return `$${Number(value || 0).toFixed(2)}`;
  }

  function getStatusColor(status?: string | null) {
    const value = String(status || "").toLowerCase();

    if (["active", "paid", "trialing"].includes(value)) return ui.green;
    if (["pending", "incomplete", "past_due"].includes(value)) return ui.orange;
    if (["cancelled", "canceled", "inactive", "failed"].includes(value)) {
      return ui.red;
    }

    return ui.blue;
  }

  function getTypeColor(type: SubscriptionType) {
    if (type === "Customer") return ui.blue;
    if (type === "Farmer") return ui.green;
    if (type === "Driver") return ui.orange;
    return ui.primary;
  }

  function renderBadge(label?: string | null, color?: string) {
    return (
      <View style={[styles.badge, { backgroundColor: color || getStatusColor(label) }]}>
        <Text style={styles.badgeText}>{label || "UNKNOWN"}</Text>
      </View>
    );
  }

  function formatDate(value?: string | null) {
    if (!value) return "Unknown date";

    try {
      return new Date(value).toLocaleString();
    } catch {
      return "Unknown date";
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <StatusBar barStyle="dark-content" backgroundColor={ui.bg} />
        <ActivityIndicator size="large" color={ui.primary} />
        <Text style={styles.loadingText}>Loading subscriptions...</Text>
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
              <Text style={styles.logoSub}>Subscriptions</Text>
            </View>
          </View>

          <NavButton label="Dashboard" icon="grid-outline" route="/admin/dashboard" />
          <NavButton label="Control Tower" icon="radio-outline" route="/admin/control-tower" />
          <NavButton label="Customers" icon="people-outline" route="/admin/customers" />
          <NavButton label="Farmers" icon="leaf-outline" route="/admin/farmers" />
          <NavButton label="Drivers" icon="car-outline" route="/admin/drivers" />
          <NavButton label="Subscriptions" icon="card-outline" route="/admin/subscriptions" active />
          <NavButton label="Analytics" icon="analytics-outline" route="/admin/analytics-center" />
        </View>

        <View style={styles.main}>
          <View style={styles.topbar}>
            <View>
              <Text style={styles.welcome}>Farm2Home Admin</Text>
              <Text style={styles.pageTitle}>Subscriptions</Text>
              <Text style={styles.pageSub}>
                Manage customer, farmer, driver, and freight memberships.
              </Text>
            </View>

            <TouchableOpacity style={styles.refreshPill} onPress={loadSubscriptions}>
              <Ionicons name="refresh-outline" size={18} color={ui.primary} />
              <Text style={styles.refreshPillText}>Refresh</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.statsGrid}>
              <StatCard label="Total Subs" value={String(stats.total)} icon="card-outline" accent />
              <StatCard label="Active" value={String(stats.active)} icon="checkmark-circle-outline" success />
              <StatCard label="Cancelled" value={String(stats.cancelled)} icon="close-circle-outline" danger />
              <StatCard label="Monthly Revenue" value={formatMoney(stats.monthlyRevenue)} icon="cash-outline" accent />
              <StatCard label="Customers" value={String(stats.customer)} icon="people-outline" />
              <StatCard label="Farmers" value={String(stats.farmer)} icon="leaf-outline" success />
              <StatCard label="Drivers" value={String(stats.driver)} icon="car-outline" />
              <StatCard label="Freight" value={String(stats.freight)} icon="business-outline" />
            </View>

            <View style={styles.searchCard}>
              <Ionicons name="search-outline" size={20} color={ui.primary} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search subscription ID, account, type, status..."
                placeholderTextColor={ui.muted}
                style={styles.searchInput}
              />
            </View>

            <View style={styles.dataSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Subscription Directory</Text>
                <Text style={styles.sectionLink}>
                  {filteredSubscriptions.length} records
                </Text>
              </View>

              <FlatList
                data={filteredSubscriptions}
                keyExtractor={(item) => `${item.type}_${item.id}`}
                scrollEnabled={false}
                contentContainerStyle={{ paddingBottom: 80 }}
                ListEmptyComponent={
                  <EmptyCard
                    title="No subscriptions found."
                    text="Memberships will appear here after Stripe subscriptions are created."
                  />
                }
                renderItem={({ item }) => (
                  <View style={styles.row}>
                    <View
                      style={[
                        styles.avatar,
                        { backgroundColor: `${getTypeColor(item.type)}18` },
                      ]}
                    >
                      <Ionicons
                        name={
                          item.type === "Customer"
                            ? "people-outline"
                            : item.type === "Farmer"
                            ? "leaf-outline"
                            : item.type === "Driver"
                            ? "car-outline"
                            : "business-outline"
                        }
                        size={22}
                        color={getTypeColor(item.type)}
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{item.displayPlan}</Text>
                      <Text style={styles.meta}>Type: {item.type}</Text>
                      <Text style={styles.meta}>Account ID: {item.accountId}</Text>
                      <Text style={styles.meta}>
                        Monthly Value: {formatMoney(item.monthlyValue)}
                      </Text>
                      <Text style={styles.meta}>
                        Created: {formatDate(item.created_at)}
                      </Text>
                      {!!item.stripe_subscription_id && (
                        <Text style={styles.meta}>
                          Stripe Sub: {item.stripe_subscription_id}
                        </Text>
                      )}
                    </View>

                    <View style={styles.rightCol}>
                      {renderBadge(item.type, getTypeColor(item.type))}
                      {renderBadge(item.status)}
                      <TouchableOpacity
                        style={styles.viewButton}
                        onPress={() =>
                          Alert.alert(
                            "Subscription Details",
                            `Type: ${item.type}\nPlan: ${
                              item.displayPlan
                            }\nStatus: ${item.status || "Unknown"}\nValue: ${formatMoney(
                              item.monthlyValue
                            )}\nAccount: ${item.accountId}`
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
      <Ionicons name="card-outline" size={30} color={ui.primary} />
      <Text style={styles.emptyTitle}>{title}</Text>
      {!!text && <Text style={styles.emptyText}>{text}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: ui.bg },
  loadingScreen: {
    flex: 1,
    backgroundColor: ui.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: { color: ui.muted, marginTop: 10, fontWeight: "800" },
  shell: { flex: 1, backgroundColor: ui.bg },
  sidebar: {
    backgroundColor: ui.card,
    borderBottomWidth: 1,
    borderBottomColor: ui.border,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 12,
  },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  logoMark: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: ui.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: { color: "#FFFFFF", fontWeight: "900", fontSize: 13 },
  logoTitle: { color: ui.text, fontWeight: "900", fontSize: 18 },
  logoSub: { color: ui.muted, fontWeight: "700", fontSize: 12 },
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
  navButtonActive: { backgroundColor: ui.primary },
  navText: { color: ui.muted, fontWeight: "900", fontSize: 13 },
  navTextActive: { color: "#FFFFFF" },
  main: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
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
  welcome: { color: ui.muted, fontWeight: "800", marginBottom: 4 },
  pageTitle: { color: ui.text, fontSize: 26, fontWeight: "900" },
  pageSub: { color: ui.muted, marginTop: 4, fontWeight: "700", maxWidth: 720 },
  refreshPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: ui.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  refreshPillText: { color: ui.primary, fontWeight: "900" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 14 },
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
  statValue: { color: ui.text, fontSize: 22, fontWeight: "900" },
  statLabel: { color: ui.muted, fontWeight: "800", marginTop: 4 },
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
  searchInput: { flex: 1, color: ui.text, fontWeight: "800" },
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
  sectionTitle: { color: ui.text, fontSize: 19, fontWeight: "900" },
  sectionLink: { color: ui.primary, fontWeight: "900", fontSize: 12 },
  row: {
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
    alignItems: "center",
    justifyContent: "center",
  },
  name: { color: ui.text, fontWeight: "900", fontSize: 16 },
  meta: {
    color: ui.muted,
    fontWeight: "700",
    marginTop: 4,
    lineHeight: 18,
    fontSize: 12,
  },
  rightCol: { alignItems: "flex-end", gap: 8 },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: 150,
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
  viewButtonText: { color: ui.primary, fontWeight: "900", fontSize: 12 },
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