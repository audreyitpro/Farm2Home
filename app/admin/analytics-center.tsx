// app/admin/analytics-center.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
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

import { supabase } from "../services/supabaseClient";

const ui = {
  bg: "#F4F7FB",
  dark: "#07111F",
  card: "#FFFFFF",
  border: "#E2E8F0",
  text: "#0F172A",
  muted: "#64748B",
  primary: "#2563EB",
  primarySoft: "#EFF6FF",
  green: "#16A34A",
  orange: "#EA580C",
  red: "#DC2626",
  purple: "#7C3AED",
  white: "#FFFFFF",
};

type StatusMetric = { status: string; count: number };
type TopFarm = { farmer_id: string; farm_name: string; revenue: number; orders: number };
type Severity = "High" | "Medium" | "Low";
type Issue = { id: string; title: string; detail: string; severity: Severity };

function clean(value: any) {
  return String(value ?? "").trim();
}

function lower(value: any) {
  return clean(value).toLowerCase();
}

function money(value: any) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function getAmount(row: any) {
  return Number(
    row?.total ||
      row?.order_total ||
      row?.total_amount ||
      row?.amount ||
      row?.price ||
      row?.rate ||
      0
  );
}

async function safeRead<T = any>(table: string, select = "*"): Promise<T[]> {
  try {
    const { data, error } = await supabase.from(table).select(select).limit(2000);
    if (error) {
      console.log(`${table} skipped:`, error.message);
      return [];
    }
    return Array.isArray(data) ? (data as T[]) : [];
  } catch (error) {
    console.log(`${table} failed:`, error);
    return [];
  }
}

export default function AdminAnalyticsCenter() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");

  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [farmers, setFarmers] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [freightUsers, setFreightUsers] = useState<any[]>([]);
  const [loads, setLoads] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [applicationPayments, setApplicationPayments] = useState<any[]>([]);
  const [verifications, setVerifications] = useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
      initialize();
    }, [])
  );

  async function initialize() {
    const raw = await AsyncStorage.getItem("currentAdmin");

    if (!raw) {
      router.replace("/admin/login" as any);
      return;
    }

    try {
      const admin = JSON.parse(raw);

      if (admin.role !== "admin" || admin.isActive === false) {
        router.replace("/admin/login" as any);
        return;
      }

      setAdminEmail(admin.email || "");
      await loadAnalytics();
    } catch {
      router.replace("/admin/login" as any);
    }
  }

  async function loadAnalytics() {
    try {
      setLoading(true);

      const [
        orderRows,
        productRows,
        farmerRows,
        customerRows,
        driverRows,
        freightRows,
        loadRows,
        payoutRows,
        appPaymentRows,
        verificationRows,
      ] = await Promise.all([
        safeRead("orders"),
        safeRead("products"),
        safeRead("farmers"),
        safeRead("customers"),
        safeRead("drivers"),
        safeRead("freight_users"),
        safeRead("freight_loads"),
        safeRead("farmer_payouts"),
        safeRead("farmer_application_payments"),
        safeRead("verification_records"),
      ]);

      setOrders(orderRows);
      setProducts(productRows);
      setFarmers(farmerRows);
      setCustomers(customerRows);
      setDrivers(driverRows);
      setFreightUsers(freightRows);
      setLoads(loadRows);
      setPayouts(payoutRows);
      setApplicationPayments(appPaymentRows);
      setVerifications(verificationRows);
    } catch (error: any) {
      Alert.alert("Analytics Error", error?.message || "Unable to load analytics.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadAnalytics();
  }

  function buildStatusCounts(rows: any[]): StatusMetric[] {
    const counts: Record<string, number> = {};

    rows.forEach((row) => {
      const status = clean(row.status || "UNKNOWN").toUpperCase();
      counts[status] = (counts[status] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);
  }

  function buildTopFarms(orderRows: any[]): TopFarm[] {
    const map: Record<string, TopFarm> = {};

    orderRows.forEach((order) => {
      const id = clean(order.farmer_id || order.farm_id || "unknown");
      const name =
        clean(order.farm_name || order.farmer_name || order.farmers?.farm_name) ||
        "Unknown Farm";

      if (!map[id]) {
        map[id] = { farmer_id: id, farm_name: name, revenue: 0, orders: 0 };
      }

      map[id].revenue += getAmount(order);
      map[id].orders += 1;
    });

    return Object.values(map)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }

  const orderStatuses = useMemo(() => buildStatusCounts(orders), [orders]);
  const loadStatuses = useMemo(() => buildStatusCounts(loads), [loads]);
  const topFarms = useMemo(() => buildTopFarms(orders), [orders]);

  const stats = useMemo(() => {
    const marketplaceRevenue = orders.reduce((sum, row) => sum + getAmount(row), 0);
    const freightRevenue = loads.reduce((sum, row) => sum + getAmount(row), 0);

    const platformFees = payouts.reduce(
      (sum, row) => sum + Number(row.platform_fee || row.fee || 0),
      0
    );

    const applicationRevenue = applicationPayments
      .filter((row) =>
        ["paid", "succeeded", "complete", "completed"].includes(lower(row.status))
      )
      .reduce((sum, row) => {
        if (Number(row.amount || 0) > 0) return sum + Number(row.amount);
        if (Number(row.amount_cents || 0) > 0) return sum + Number(row.amount_cents) / 100;
        return sum + 29.99;
      }, 0);

    const activeOrders = orders.filter((row) =>
      ["paid", "accepted", "preparing", "ready_for_pickup", "picked_up", "in_transit"].includes(
        lower(row.status)
      )
    ).length;

    const deliveredOrders = orders.filter((row) => lower(row.status) === "delivered").length;

    const cancelledOrders = orders.filter((row) =>
      ["cancelled", "canceled", "refunded"].includes(lower(row.status))
    ).length;

    const openLoads = loads.filter((row) =>
      ["open", "available", "pending"].includes(lower(row.status))
    ).length;

    const bookedLoads = loads.filter((row) =>
      ["booked", "accepted", "assigned", "picked_up", "in_transit"].includes(lower(row.status))
    ).length;

    const deliveredLoads = loads.filter((row) => lower(row.status) === "delivered").length;

    const lowStock = products.filter(
      (row) => Number(row.quantity || row.stock || row.inventory || 0) <= 5
    ).length;

    const pendingVerifications = verifications.filter((row) =>
      ["pending", "pending_verification", "documents_submitted", "pending_admin_review"].includes(
        lower(row.status)
      )
    ).length;

    return {
      marketplaceRevenue,
      freightRevenue,
      platformFees,
      applicationRevenue,
      totalGross: marketplaceRevenue + freightRevenue + applicationRevenue,
      totalOrders: orders.length,
      avgOrder: orders.length ? marketplaceRevenue / orders.length : 0,
      activeOrders,
      deliveredOrders,
      cancelledOrders,
      totalLoads: loads.length,
      openLoads,
      bookedLoads,
      deliveredLoads,
      farmers: farmers.length,
      customers: customers.length,
      drivers: drivers.length,
      freightUsers: freightUsers.length,
      products: products.length,
      lowStock,
      pendingVerifications,
    };
  }, [orders, loads, payouts, applicationPayments, products, verifications, farmers, customers, drivers, freightUsers]);

  const issues = useMemo<Issue[]>(() => {
    const list: Issue[] = [];

    farmers.forEach((farmer) => {
      const stripe =
        farmer.stripe_account_id || farmer.farmer_stripe_account_id || farmer.farmer_account;

      if (!stripe) {
        list.push({
          id: `stripe-${farmer.id}`,
          title: "Farmer missing Stripe Connect",
          detail: `${farmer.farm_name || farmer.business_name || farmer.email || "Farmer"} cannot receive payouts.`,
          severity: "High",
        });
      }
    });

    products.forEach((product) => {
      const qty = Number(product.quantity || product.stock || product.inventory || 0);

      if (qty <= 0 && product.marketplace_visible !== false) {
        list.push({
          id: `stock-${product.id}`,
          title: "Visible product out of stock",
          detail: `${product.name || "Product"} has no inventory but may still be visible.`,
          severity: "Medium",
        });
      }
    });

    if (stats.openLoads > 0) {
      list.push({
        id: "open-loads",
        title: "Open freight loads need carrier attention",
        detail: `${stats.openLoads} freight load(s) are still open or available.`,
        severity: "Low",
      });
    }

    if (stats.pendingVerifications > 0) {
      list.push({
        id: "pending-verifications",
        title: "Pending verification reviews",
        detail: `${stats.pendingVerifications} verification record(s) need admin review.`,
        severity: "High",
      });
    }

    return list;
  }, [farmers, products, stats.openLoads, stats.pendingVerifications]);

  async function logoutAdmin() {
    await AsyncStorage.multiRemove(["currentAdmin", "currentUser", "userRole", "currentUserRole"]);
    router.replace("/admin/login" as any);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor={ui.dark} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={ui.primary} />
          <Text style={styles.centerText}>Loading analytics center...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={ui.dark} />

      <ScrollView
        style={styles.page}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>Farm2Home Admin</Text>
            <Text style={styles.title}>Analytics Center</Text>
            <Text style={styles.subtitle}>
              Analyze gross revenue, farmer growth, customer demand, marketplace health,
              freight activity, payouts, and operational issues.
            </Text>
            <Text style={styles.adminLine}>Logged in: {adminEmail || "Admin"}</Text>
          </View>

          <TouchableOpacity style={styles.logoutButton} onPress={logoutAdmin}>
            <Ionicons name="log-out-outline" size={18} color={ui.white} />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.grossCard}>
          <Text style={styles.grossLabel}>Total Gross Platform Revenue</Text>
          <Text style={styles.grossValue}>{money(stats.totalGross)}</Text>
          <Text style={styles.grossSub}>
            Marketplace {money(stats.marketplaceRevenue)} · Freight{" "}
            {money(stats.freightRevenue)} · Applications {money(stats.applicationRevenue)}
          </Text>
        </View>

        <View style={styles.grid}>
          <Metric title="Marketplace Revenue" value={money(stats.marketplaceRevenue)} icon="basket-outline" color={ui.green} />
          <Metric title="Freight Revenue" value={money(stats.freightRevenue)} icon="trail-sign-outline" color={ui.primary} />
          <Metric title="Application Revenue" value={money(stats.applicationRevenue)} icon="card-outline" color={ui.purple} />
          <Metric title="Platform Fees" value={money(stats.platformFees)} icon="pricetag-outline" color={ui.orange} />
          <Metric title="Total Orders" value={stats.totalOrders} icon="receipt-outline" color={ui.primary} />
          <Metric title="Avg Order" value={money(stats.avgOrder)} icon="analytics-outline" color={ui.green} />
          <Metric title="Active Orders" value={stats.activeOrders} icon="time-outline" color={ui.orange} />
          <Metric title="Delivered Orders" value={stats.deliveredOrders} icon="checkmark-done-outline" color={ui.green} />
          <Metric title="Cancelled" value={stats.cancelledOrders} icon="close-circle-outline" color={ui.red} />
          <Metric title="Open Loads" value={stats.openLoads} icon="cube-outline" color={ui.orange} />
          <Metric title="Booked Loads" value={stats.bookedLoads} icon="navigate-outline" color={ui.primary} />
          <Metric title="Delivered Loads" value={stats.deliveredLoads} icon="flag-outline" color={ui.green} />
          <Metric title="Farmers" value={stats.farmers} icon="leaf-outline" color={ui.green} />
          <Metric title="Customers" value={stats.customers} icon="person-outline" color={ui.purple} />
          <Metric title="Drivers" value={stats.drivers} icon="car-outline" color={ui.orange} />
          <Metric title="Freight Users" value={stats.freightUsers} icon="business-outline" color={ui.primary} />
          <Metric title="Products" value={stats.products} icon="storefront-outline" color={ui.green} />
          <Metric title="Low Stock" value={stats.lowStock} icon="warning-outline" color={ui.red} />
        </View>

        <Section title="Issues to Review" subtitle="AI-style operational flags for admin attention." />

        {issues.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>✅</Text>
            <Text style={styles.emptyTitle}>No major issues detected</Text>
            <Text style={styles.emptyText}>Marketplace, payments, verification, and freight look stable.</Text>
          </View>
        ) : (
          issues.map((issue) => <IssueCard key={issue.id} issue={issue} />)
        )}

        <Section title="Order Status Breakdown" subtitle="Customer order movement by status." />
        <StatusBars rows={orderStatuses} />

        <Section title="Freight Load Breakdown" subtitle="Freight activity by status." />
        <StatusBars rows={loadStatuses} />

        <Section title="Top Farms by Revenue" subtitle="Best performing farmer stores." />

        <FlatList
          data={topFarms}
          keyExtractor={(item) => item.farmer_id}
          scrollEnabled={false}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No farm revenue yet</Text>
              <Text style={styles.emptyText}>
                Top farms will appear after customer orders are created.
              </Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <View style={styles.farmRow}>
              <View style={styles.rankCircle}>
                <Text style={styles.rankText}>{index + 1}</Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.farmName}>{item.farm_name}</Text>
                <Text style={styles.farmMeta}>{item.orders} order(s)</Text>
              </View>

              <Text style={styles.farmRevenue}>{money(item.revenue)}</Text>
            </View>
          )}
        />

        <View style={styles.aiCard}>
          <View style={styles.aiHeader}>
            <View style={styles.aiIcon}>
              <Ionicons name="sparkles-outline" size={22} color={ui.primary} />
            </View>
            <Text style={styles.aiTitle}>Growth Snapshot</Text>
          </View>

          <Text style={styles.aiText}>
            Estimated 30-day marketplace run-rate:{" "}
            <Text style={styles.aiStrong}>{money(stats.marketplaceRevenue * 4)}</Text>
          </Text>
          <Text style={styles.aiText}>
            Estimated 30-day freight run-rate:{" "}
            <Text style={styles.aiStrong}>{money(stats.freightRevenue * 4)}</Text>
          </Text>
          <Text style={styles.aiText}>
            Recommended focus: approve pending farmers, fix payout gaps, restock low
            inventory, and convert open freight loads into booked carrier jobs.
          </Text>
        </View>

        <View style={styles.actions}>
          <AdminNav label="Dashboard" icon="grid-outline" route="/admin/dashboard" />
          <AdminNav label="Application Payments" icon="card-outline" route="/admin/application-payments" />
          <AdminNav label="Verification" icon="shield-checkmark-outline" route="/admin/verification-records" />
          <AdminNav label="Farmers" icon="leaf-outline" route="/admin/farmers" />
          <AdminNav label="Drivers" icon="car-outline" route="/admin/drivers" />
          <AdminNav label="Freight" icon="trail-sign-outline" route="/admin/freight" />
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionSub}>{subtitle}</Text>
    </View>
  );
}

function Metric({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}) {
  return (
    <View style={styles.metric}>
      <View style={[styles.metricIcon, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricTitle}>{title}</Text>
    </View>
  );
}

function IssueCard({ issue }: { issue: Issue }) {
  const color =
    issue.severity === "High" ? ui.red : issue.severity === "Medium" ? ui.orange : ui.primary;

  return (
    <View style={styles.issueCard}>
      <View style={[styles.issueIcon, { backgroundColor: `${color}18` }]}>
        <Ionicons name="warning-outline" size={20} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.issueTitle}>{issue.title}</Text>
        <Text style={styles.issueDetail}>{issue.detail}</Text>
      </View>
      <Text style={[styles.issueSeverity, { color }]}>{issue.severity}</Text>
    </View>
  );
}

function StatusBars({ rows }: { rows: StatusMetric[] }) {
  const max = Math.max(1, ...rows.map((row) => row.count));

  if (rows.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>No status data</Text>
      </View>
    );
  }

  return (
    <View style={styles.statusCard}>
      {rows.map((row) => {
        const widthPercent = Math.max(12, (row.count / max) * 100);

        return (
          <View key={row.status} style={styles.barRow}>
            <View style={styles.barTop}>
              <Text style={styles.barLabel}>{row.status}</Text>
              <Text style={styles.barCount}>{row.count}</Text>
            </View>

            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  { width: `${widthPercent}%` as `${number}%` },
                ]}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

function AdminNav({
  label,
  icon,
  route,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
}) {
  return (
    <TouchableOpacity style={styles.navButton} onPress={() => router.push(route as any)}>
      <Ionicons name={icon} size={18} color={ui.primary} />
      <Text style={styles.navText}>{label}</Text>
      <Ionicons name="chevron-forward-outline" size={17} color={ui.muted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: ui.dark },
  page: { flex: 1, backgroundColor: ui.bg },
  content: { padding: 16, paddingBottom: 90 },
  center: {
    flex: 1,
    backgroundColor: ui.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  centerText: { marginTop: 10, color: ui.muted, fontWeight: "800" },

  hero: {
    backgroundColor: ui.dark,
    borderRadius: 28,
    padding: 22,
    marginBottom: 14,
    flexDirection: "row",
    gap: 12,
  },
  kicker: {
    color: "#93C5FD",
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  title: { color: ui.white, fontSize: 33, fontWeight: "900", marginTop: 6 },
  subtitle: { color: "#CBD5E1", fontWeight: "700", lineHeight: 22, marginTop: 8 },
  adminLine: { color: "#BFDBFE", fontWeight: "800", marginTop: 12 },
  logoutButton: {
    backgroundColor: ui.primary,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    alignSelf: "flex-start",
  },
  logoutText: { color: ui.white, fontWeight: "900" },

  grossCard: {
    backgroundColor: ui.primary,
    borderRadius: 26,
    padding: 22,
    marginBottom: 14,
  },
  grossLabel: { color: "#DBEAFE", fontWeight: "900" },
  grossValue: { color: ui.white, fontSize: 42, fontWeight: "900", marginTop: 5 },
  grossSub: { color: "#DBEAFE", fontWeight: "700", marginTop: 6, lineHeight: 21 },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metric: {
    flexGrow: 1,
    width: "47%",
    backgroundColor: ui.card,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: ui.border,
  },
  metricIcon: {
    width: 40,
    height: 40,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  metricValue: { color: ui.text, fontSize: 22, fontWeight: "900" },
  metricTitle: { color: ui.muted, fontWeight: "800", marginTop: 4 },

  section: { marginTop: 22, marginBottom: 12 },
  sectionTitle: { color: ui.text, fontSize: 23, fontWeight: "900" },
  sectionSub: { color: ui.muted, fontWeight: "700", marginTop: 4 },

  issueCard: {
    backgroundColor: ui.card,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: ui.border,
    marginBottom: 10,
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  issueIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  issueTitle: { color: ui.text, fontWeight: "900", fontSize: 16 },
  issueDetail: { color: ui.muted, fontWeight: "700", marginTop: 4, lineHeight: 20 },
  issueSeverity: { fontWeight: "900", fontSize: 12 },

  emptyCard: {
    backgroundColor: ui.card,
    borderRadius: 22,
    padding: 22,
    borderWidth: 1,
    borderColor: ui.border,
    alignItems: "center",
  },
  emptyEmoji: { fontSize: 38 },
  emptyTitle: { color: ui.text, fontWeight: "900", fontSize: 18 },
  emptyText: { color: ui.muted, fontWeight: "700", textAlign: "center", marginTop: 6 },

  statusCard: {
    backgroundColor: ui.card,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: ui.border,
  },
  barRow: { marginBottom: 14 },
  barTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  barLabel: { color: ui.text, fontWeight: "900" },
  barCount: { color: ui.muted, fontWeight: "900" },
  barTrack: {
    height: 12,
    backgroundColor: ui.primarySoft,
    borderRadius: 999,
    overflow: "hidden",
  },
  barFill: { height: "100%", backgroundColor: ui.primary, borderRadius: 999 },

  farmRow: {
    backgroundColor: ui.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: ui.border,
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rankCircle: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: ui.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: { color: ui.primary, fontWeight: "900", fontSize: 16 },
  farmName: { color: ui.text, fontWeight: "900", fontSize: 16 },
  farmMeta: { color: ui.muted, fontWeight: "700", marginTop: 3 },
  farmRevenue: { color: ui.primary, fontWeight: "900", fontSize: 16 },

  aiCard: {
    backgroundColor: ui.card,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: ui.border,
    marginTop: 14,
  },
  aiHeader: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 12 },
  aiIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: ui.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  aiTitle: { color: ui.text, fontSize: 21, fontWeight: "900" },
  aiText: { color: ui.muted, lineHeight: 23, fontWeight: "700", marginBottom: 8 },
  aiStrong: { color: ui.primary, fontWeight: "900" },

  actions: { gap: 10, marginTop: 18 },
  navButton: {
    backgroundColor: ui.card,
    borderWidth: 1,
    borderColor: ui.border,
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  navText: { flex: 1, color: ui.text, fontWeight: "900" },
});