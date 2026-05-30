// app/admin/revenue.tsx

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

const CUSTOMER_MONTHLY = 4.99;
const DRIVER_MONTHLY = 4.99;
const FARMER_MONTHLY = 14.99;
const FARMER_APPLICATION_FEE = 29.99;
const FREIGHT_MONTHLY = 29.99;
const SERVICE_FEE_RATE = 0.04;

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

type RevenueItem = {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  amount: number;
  platformRevenue: number;
  status: string;
  created_at?: string | null;
};

export default function AdminRevenue() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<RevenueItem[]>([]);
  const [search, setSearch] = useState("");

  useFocusEffect(
    useCallback(() => {
      loadRevenue();
    }, [])
  );

  async function loadRevenue() {
    try {
      setLoading(true);

      const { data: orders } = await supabase.from("orders").select("*");
      const { data: marketplacePayouts } = await supabase.from("marketplace_payouts").select("*");
      const { data: farmerPayouts } = await supabase.from("farmer_payouts").select("*");
      const { data: freightLoads } = await supabase.from("freight_loads").select("*");
      const { data: customerSubs } = await supabase.from("customer_subscriptions").select("*");
      const { data: farmerSubs } = await supabase.from("farmer_subscriptions").select("*");
      const { data: driverSubs } = await supabase.from("driver_subscriptions").select("*");
      const { data: freightSubs } = await supabase.from("freight_subscriptions").select("*");
      const { data: applicationFees } = await supabase
        .from("farmer_application_payments")
        .select("*");

      const revenueItems: RevenueItem[] = [];

      (Array.isArray(orders) ? orders : []).forEach((order: any) => {
        const total = Number(order.total || order.total_amount || order.amount || 0);
        revenueItems.push({
          id: `order_${order.id}`,
          type: "Marketplace Order",
          title: `Order #${String(order.id || "").slice(-6)}`,
          subtitle: order.status || "Marketplace order",
          amount: total,
          platformRevenue: total * SERVICE_FEE_RATE,
          status: order.status || "UNKNOWN",
          created_at: order.created_at,
        });
      });

      (Array.isArray(applicationFees) ? applicationFees : []).forEach((fee: any) => {
        const amount =
          Number(fee.amount || 0) > 0
            ? Number(fee.amount)
            : Number(fee.amount_cents || 0) / 100 || FARMER_APPLICATION_FEE;

        revenueItems.push({
          id: `application_fee_${fee.id}`,
          type: "Farmer Application Fee",
          title: fee.business_name || fee.farm_name || "Farmer Application Fee",
          subtitle: fee.status || "Application payment",
          amount,
          platformRevenue: amount,
          status: fee.status || "UNKNOWN",
          created_at: fee.created_at,
        });
      });

      (Array.isArray(freightLoads) ? freightLoads : []).forEach((load: any) => {
        const amount = Number(load.rate || load.amount || load.price || 0);
        revenueItems.push({
          id: `freight_${load.id}`,
          type: "Freight Load",
          title: load.title || `Freight load #${String(load.id || "").slice(-6)}`,
          subtitle: load.status || "Freight revenue",
          amount,
          platformRevenue: amount,
          status: load.status || "UNKNOWN",
          created_at: load.created_at,
        });
      });

      [
        { rows: customerSubs, type: "Customer Subscription", defaultAmount: CUSTOMER_MONTHLY },
        { rows: farmerSubs, type: "Farmer Subscription", defaultAmount: FARMER_MONTHLY },
        { rows: driverSubs, type: "Driver Subscription", defaultAmount: DRIVER_MONTHLY },
        { rows: freightSubs, type: "Freight Subscription", defaultAmount: FREIGHT_MONTHLY },
      ].forEach((group) => {
        (Array.isArray(group.rows) ? group.rows : []).forEach((sub: any) => {
          const amount = Number(sub.monthly_amount || sub.amount || sub.price || group.defaultAmount);

          revenueItems.push({
            id: `${group.type}_${sub.id}`,
            type: group.type,
            title: sub.plan_type || group.type,
            subtitle: sub.status || "Subscription",
            amount,
            platformRevenue: isActiveStatus(sub.status) ? amount : 0,
            status: sub.status || "UNKNOWN",
            created_at: sub.created_at,
          });
        });
      });

      (Array.isArray(marketplacePayouts) ? marketplacePayouts : []).forEach((payout: any) => {
        const amount = Number(
          payout.amount ||
            payout.amount_dollars ||
            Number(payout.amount_cents || 0) / 100 ||
            0
        );

        revenueItems.push({
          id: `marketplace_payout_${payout.id}`,
          type: "Marketplace Payout",
          title: `Marketplace payout #${String(payout.id || "").slice(-6)}`,
          subtitle: payout.farmer_id ? `Farmer ${payout.farmer_id}` : "Marketplace payout",
          amount,
          platformRevenue: 0,
          status: payout.status || "PAYOUT",
          created_at: payout.created_at,
        });
      });

      (Array.isArray(farmerPayouts) ? farmerPayouts : []).forEach((payout: any) => {
        const amount = Number(
          payout.amount ||
            payout.amount_dollars ||
            Number(payout.amount_cents || 0) / 100 ||
            0
        );

        revenueItems.push({
          id: `farmer_payout_${payout.id}`,
          type: "Farmer Payout",
          title: `Farmer payout #${String(payout.id || "").slice(-6)}`,
          subtitle: payout.farmer_id ? `Farmer ${payout.farmer_id}` : "Farmer payout",
          amount,
          platformRevenue: 0,
          status: payout.status || "PAYOUT",
          created_at: payout.created_at,
        });
      });

      revenueItems.sort((a, b) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bTime - aTime;
      });

      setItems(revenueItems);
    } catch (error: any) {
      Alert.alert("Revenue Error", error?.message || "Unable to load revenue.");
    } finally {
      setLoading(false);
    }
  }

  function isActiveStatus(status?: string | null) {
    return ["active", "paid", "trialing", "complete", "completed", "succeeded"].includes(
      String(status || "").toLowerCase()
    );
  }

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;

    return items.filter((item) =>
      [item.id, item.type, item.title, item.subtitle, item.status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [items, search]);

  const stats = useMemo(() => {
    const marketplaceGross = items
      .filter((item) => item.type === "Marketplace Order")
      .reduce((sum, item) => sum + item.amount, 0);

    const marketplaceServiceFees = items
      .filter((item) => item.type === "Marketplace Order")
      .reduce((sum, item) => sum + item.platformRevenue, 0);

    const freightRevenue = items
      .filter((item) => item.type === "Freight Load")
      .reduce((sum, item) => sum + item.amount, 0);

    const applicationFees = items
      .filter((item) => item.type === "Farmer Application Fee")
      .filter((item) => isActiveStatus(item.status))
      .reduce((sum, item) => sum + item.amount, 0);

    const customerMemberships = items
      .filter((item) => item.type === "Customer Subscription")
      .filter((item) => isActiveStatus(item.status))
      .reduce((sum, item) => sum + item.amount, 0);

    const driverMemberships = items
      .filter((item) => item.type === "Driver Subscription")
      .filter((item) => isActiveStatus(item.status))
      .reduce((sum, item) => sum + item.amount, 0);

    const farmerMemberships = items
      .filter((item) => item.type === "Farmer Subscription")
      .filter((item) => isActiveStatus(item.status))
      .reduce((sum, item) => sum + item.amount, 0);

    const freightMemberships = items
      .filter((item) => item.type === "Freight Subscription")
      .filter((item) => isActiveStatus(item.status))
      .reduce((sum, item) => sum + item.amount, 0);

    const payouts = items
      .filter((item) => item.type.includes("Payout"))
      .reduce((sum, item) => sum + item.amount, 0);

    const membershipRevenue =
      customerMemberships + driverMemberships + farmerMemberships + freightMemberships;

    const totalPlatformRevenue =
      membershipRevenue + applicationFees + marketplaceServiceFees + freightRevenue;

    return {
      marketplaceGross,
      marketplaceServiceFees,
      freightRevenue,
      applicationFees,
      customerMemberships,
      driverMemberships,
      farmerMemberships,
      freightMemberships,
      membershipRevenue,
      payouts,
      totalPlatformRevenue,
      netAfterPayouts: totalPlatformRevenue - payouts,
      transactions: items.length,
    };
  }, [items]);

  function formatMoney(value: number) {
    return `$${Number(value || 0).toFixed(2)}`;
  }

  function getTypeColor(type: string) {
    if (type.includes("Application")) return ui.orange;
    if (type.includes("Subscription")) return ui.primary;
    if (type.includes("Payout")) return ui.red;
    if (type.includes("Freight")) return ui.blue;
    if (type.includes("Marketplace")) return ui.green;
    return ui.blue;
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
        <Text style={styles.loadingText}>Loading revenue...</Text>
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
              <Text style={styles.logoSub}>Revenue Center</Text>
            </View>
          </View>

          <NavButton label="Dashboard" icon="grid-outline" route="/admin/dashboard" />
          <NavButton label="Control Tower" icon="radio-outline" route="/admin/control-tower" />
          <NavButton label="Revenue" icon="cash-outline" route="/admin/revenue" active />
          <NavButton label="Payouts" icon="arrow-redo-outline" route="/admin/payouts" />
          <NavButton label="Subscriptions" icon="card-outline" route="/admin/subscriptions" />
          <NavButton label="Application Fees" icon="receipt-outline" route="/admin/application-payments" />
          <NavButton label="Analytics" icon="analytics-outline" route="/admin/analytics-center" />
        </View>

        <View style={styles.main}>
          <View style={styles.topbar}>
            <View>
              <Text style={styles.welcome}>Farm2Home Admin Finance</Text>
              <Text style={styles.pageTitle}>Revenue Center</Text>
              <Text style={styles.pageSub}>
                Track memberships, farmer application fees, 4% service fees, freight revenue, payouts, and platform revenue.
              </Text>
            </View>

            <TouchableOpacity style={styles.refreshPill} onPress={loadRevenue}>
              <Ionicons name="refresh-outline" size={18} color={ui.primary} />
              <Text style={styles.refreshPillText}>Refresh</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.statsGrid}>
              <StatCard label="Total Platform Revenue" value={formatMoney(stats.totalPlatformRevenue)} icon="cash-outline" accent />
              <StatCard label="Net After Payouts" value={formatMoney(stats.netAfterPayouts)} icon="wallet-outline" success />
              <StatCard label="Marketplace Gross" value={formatMoney(stats.marketplaceGross)} icon="basket-outline" />
              <StatCard label="4% Service Fees" value={formatMoney(stats.marketplaceServiceFees)} icon="pricetag-outline" success />
              <StatCard label="Freight Revenue" value={formatMoney(stats.freightRevenue)} icon="trail-sign-outline" />
              <StatCard label="Application Fees" value={formatMoney(stats.applicationFees)} icon="receipt-outline" warning />
              <StatCard label="Membership Revenue" value={formatMoney(stats.membershipRevenue)} icon="card-outline" accent />
              <StatCard label="Payouts" value={formatMoney(stats.payouts)} icon="arrow-redo-outline" danger />
            </View>

            <View style={styles.breakdownCard}>
              <Text style={styles.breakdownTitle}>Membership Breakdown</Text>

              <BreakdownRow label="Customer memberships" value={stats.customerMemberships} note="$4.99 monthly" />
              <BreakdownRow label="Driver memberships" value={stats.driverMemberships} note="$4.99 monthly" />
              <BreakdownRow label="Farmer memberships" value={stats.farmerMemberships} note="$14.99 monthly" />
              <BreakdownRow label="Freight memberships" value={stats.freightMemberships} note="$29.99 monthly" />
            </View>

            <View style={styles.searchCard}>
              <Ionicons name="search-outline" size={20} color={ui.primary} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search revenue type, title, status..."
                placeholderTextColor={ui.muted}
                style={styles.searchInput}
              />
            </View>

            <View style={styles.dataSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Revenue Ledger</Text>
                <Text style={styles.sectionLink}>{filteredItems.length} records</Text>
              </View>

              <FlatList
                data={filteredItems}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                contentContainerStyle={{ paddingBottom: 80 }}
                ListEmptyComponent={
                  <EmptyCard
                    title="No revenue records found."
                    text="Orders, subscriptions, application fees, freight loads, and payouts will appear here."
                  />
                }
                renderItem={({ item }) => {
                  const color = getTypeColor(item.type);

                  return (
                    <View style={styles.row}>
                      <View style={[styles.avatar, { backgroundColor: `${color}18` }]}>
                        <Ionicons name="cash-outline" size={22} color={color} />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={styles.name}>{item.title}</Text>
                        <Text style={styles.meta}>Type: {item.type}</Text>
                        <Text style={styles.meta}>Status: {item.status}</Text>
                        <Text style={styles.meta}>
                          Platform Revenue: {formatMoney(item.platformRevenue)}
                        </Text>
                        <Text style={styles.meta}>Created: {formatDate(item.created_at)}</Text>
                      </View>

                      <View style={styles.rightCol}>
                        <View style={[styles.badge, { backgroundColor: color }]}>
                          <Text style={styles.badgeText}>{item.type}</Text>
                        </View>
                        <Text style={styles.amount}>{formatMoney(item.amount)}</Text>
                      </View>
                    </View>
                  );
                }}
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

function BreakdownRow({
  label,
  value,
  note,
}: {
  label: string;
  value: number;
  note: string;
}) {
  return (
    <View style={styles.breakdownRow}>
      <View>
        <Text style={styles.breakdownLabel}>{label}</Text>
        <Text style={styles.breakdownNote}>{note}</Text>
      </View>
      <Text style={styles.breakdownValue}>${Number(value || 0).toFixed(2)}</Text>
    </View>
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
  warning = false,
  danger = false,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent?: boolean;
  success?: boolean;
  warning?: boolean;
  danger?: boolean;
}) {
  const color = danger
    ? ui.red
    : warning
    ? ui.orange
    : success
    ? ui.green
    : accent
    ? ui.primary
    : ui.blue;

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
      <Ionicons name="cash-outline" size={30} color={ui.primary} />
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
  pageSub: { color: ui.muted, marginTop: 4, fontWeight: "700", maxWidth: 780 },
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
  statValue: { color: ui.text, fontSize: 21, fontWeight: "900" },
  statLabel: { color: ui.muted, fontWeight: "800", marginTop: 4 },
  breakdownCard: {
    backgroundColor: ui.card,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: ui.border,
    marginBottom: 14,
  },
  breakdownTitle: {
    color: ui.text,
    fontSize: 19,
    fontWeight: "900",
    marginBottom: 10,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: ui.border,
  },
  breakdownLabel: { color: ui.text, fontWeight: "900" },
  breakdownNote: { color: ui.muted, fontWeight: "700", marginTop: 3, fontSize: 12 },
  breakdownValue: { color: ui.primary, fontWeight: "900", fontSize: 16 },
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
    maxWidth: 160,
  },
  badgeText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 9,
    textTransform: "uppercase",
    textAlign: "center",
  },
  amount: {
    color: ui.text,
    fontSize: 16,
    fontWeight: "900",
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