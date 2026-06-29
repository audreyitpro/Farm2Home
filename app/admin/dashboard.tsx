// app/admin/dashboard.tsx

import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../services/supabaseClient";

const ui = {
  bg: "#F4F7FB",
  dark: "#07111F",
  card: "#FFFFFF",
  text: "#0F172A",
  muted: "#64748B",
  border: "#E2E8F0",
  blue: "#2563EB",
  green: "#16A34A",
  orange: "#EA580C",
  red: "#DC2626",
  purple: "#7C3AED",
  white: "#FFFFFF",
};

type IssueSeverity = "High" | "Medium" | "Low";

type Issue = {
  id: string;
  title: string;
  detail: string;
  area: string;
  severity: IssueSeverity;
};

function money(value: any) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function clean(value: any) {
  return String(value ?? "").trim();
}

function lower(value: any) {
  return clean(value).toLowerCase();
}

function sumRows(rows: any[], keys: string[]) {
  return rows.reduce((sum, row) => {
    const key = keys.find((item) => row?.[item] !== undefined);
    return sum + Number(key ? row[key] || 0 : 0);
  }, 0);
}

async function safeRead(table: string, limit = 1000) {
  try {
    const { data, error } = await supabase.from(table).select("*").limit(limit);
    if (error) {
      console.log(`${table} skipped:`, error.message);
      return [];
    }
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.log(`${table} failed:`, error);
    return [];
  }
}

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [admin, setAdmin] = useState<any>(null);

  const [admins, setAdmins] = useState<any[]>([]);
  const [farmers, setFarmers] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [freightUsers, setFreightUsers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [bundles, setBundles] = useState<any[]>([]);
  const [deliveryOrders, setDeliveryOrders] = useState<any[]>([]);
  const [freightLoads, setFreightLoads] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);

  useEffect(() => {
    initialize();
  }, []);

  async function initialize() {
    try {
      setLoading(true);

      const raw = await AsyncStorage.getItem("currentAdmin");

      if (!raw) {
        router.replace("/admin/login" as any);
        return;
      }

      const session = JSON.parse(raw);

      if (session.role !== "admin" || session.isActive === false) {
        router.replace("/admin/login" as any);
        return;
      }

      setAdmin(session);
      await loadDashboard();
    } catch (error: any) {
      Alert.alert("Admin Error", error?.message || "Unable to load dashboard.");
      router.replace("/admin/login" as any);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function loadDashboard() {
    const [
      adminRows,
      farmerRows,
      customerRows,
      driverRows,
      freightRows,
      orderRows,
      productRows,
      bundleRows,
      deliveryRows,
      loadRows,
      payoutRows,
    ] = await Promise.all([
      safeRead("admins"),
      safeRead("farmers"),
      safeRead("customers"),
      safeRead("drivers"),
      safeRead("freight_users"),
      safeRead("orders"),
      safeRead("products"),
      safeRead("farm_bundles"),
      safeRead("delivery_orders"),
      safeRead("freight_loads"),
      safeRead("farmer_payouts"),
    ]);

    setAdmins(adminRows);
    setFarmers(farmerRows);
    setCustomers(customerRows);
    setDrivers(driverRows);
    setFreightUsers(freightRows);
    setOrders(orderRows);
    setProducts(productRows);
    setBundles(bundleRows);
    setDeliveryOrders(deliveryRows);
    setFreightLoads(loadRows);
    setPayouts(payoutRows);
  }

  async function refreshDashboard() {
    setRefreshing(true);
    await loadDashboard();
    setRefreshing(false);
  }

  async function logout() {
    await AsyncStorage.multiRemove([
      "currentAdmin",
      "currentUser",
      "userRole",
      "currentUserRole",
    ]);

    router.replace("/admin/login" as any);
  }

  const grossSales = useMemo(
    () => sumRows(orders, ["total", "order_total", "amount", "subtotal"]),
    [orders]
  );

  const grossPayouts = useMemo(
    () => sumRows(payouts, ["gross_amount", "amount"]),
    [payouts]
  );

  const platformFees = useMemo(
    () => sumRows(payouts, ["platform_fee", "fee"]),
    [payouts]
  );

  const issues = useMemo<Issue[]>(() => {
    const list: Issue[] = [];

    farmers.forEach((farmer) => {
      const name =
        farmer.farm_name ||
        farmer.business_name ||
        farmer.full_name ||
        farmer.email ||
        "Farmer";

      const stripe =
        farmer.stripe_account_id ||
        farmer.farmer_stripe_account_id ||
        farmer.farmer_account;

      if (!stripe) {
        list.push({
          id: `farmer-stripe-${farmer.id}`,
          title: "Farmer missing Stripe Connect",
          detail: `${name} cannot receive payouts until Stripe is connected.`,
          area: "Payouts",
          severity: "High",
        });
      }

      if (farmer.is_active === false || farmer.account_active === false) {
        list.push({
          id: `farmer-inactive-${farmer.id}`,
          title: "Inactive farmer profile",
          detail: `${name} is inactive and may not be able to sell.`,
          area: "Profiles",
          severity: "Medium",
        });
      }
    });

    products.forEach((product) => {
      const qty = Number(product.quantity || product.stock || product.inventory || 0);

      if (qty <= 0 && product.marketplace_visible !== false) {
        list.push({
          id: `product-stock-${product.id}`,
          title: "Out of stock product still visible",
          detail: `${product.name || "Product"} has no inventory.`,
          area: "Marketplace",
          severity: "Medium",
        });
      }

      if (!product.farmer_id) {
        list.push({
          id: `product-farmer-${product.id}`,
          title: "Product missing farmer link",
          detail: `${product.name || "Product"} does not have farmer_id.`,
          area: "Marketplace",
          severity: "High",
        });
      }
    });

    deliveryOrders.forEach((delivery) => {
      const status = lower(delivery.status || "open");
      const assigned = delivery.driver_id || delivery.assigned_driver_id;

      if (!assigned && ["new", "pending", "paid", "open", "available"].includes(status)) {
        list.push({
          id: `delivery-driver-${delivery.id}`,
          title: "Delivery missing driver",
          detail: `Delivery ${String(delivery.id).slice(-8)} has no assigned driver.`,
          area: "Delivery",
          severity: "High",
        });
      }
    });

    freightLoads.forEach((load) => {
      const status = lower(load.status);

      if (status === "available" || status === "open") {
        list.push({
          id: `freight-open-${load.id}`,
          title: "Open freight load",
          detail: `${load.title || "Freight load"} is still available.`,
          area: "Freight",
          severity: "Low",
        });
      }
    });

    admins.forEach((item) => {
      if (item.is_active === false) {
        list.push({
          id: `admin-disabled-${item.id}`,
          title: "Disabled admin account",
          detail: `${item.email || item.username} is disabled.`,
          area: "Admin",
          severity: "Low",
        });
      }
    });

    return list;
  }, [farmers, products, deliveryOrders, freightLoads, admins]);

  const totals = useMemo(() => {
    return {
      profiles:
        admins.length +
        farmers.length +
        customers.length +
        drivers.length +
        freightUsers.length,
      admins: admins.length,
      farmers: farmers.length,
      customers: customers.length,
      drivers: drivers.length,
      freight: freightUsers.length,
      orders: orders.length,
      products: products.length,
      bundles: bundles.length,
      deliveries: deliveryOrders.length,
      loads: freightLoads.length,
      issues: issues.length,
    };
  }, [
    admins,
    farmers,
    customers,
    drivers,
    freightUsers,
    orders,
    products,
    bundles,
    deliveryOrders,
    freightLoads,
    issues,
  ]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={ui.blue} />
          <Text style={styles.centerText}>Loading admin dashboard...</Text>
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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refreshDashboard} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>Farm2Home Admin</Text>
            <Text style={styles.title}>Operations Dashboard</Text>
            <Text style={styles.subtitle}>
              Monitor all profiles, marketplace activity, gross sales, payouts,
              delivery, freight, and possible issues.
            </Text>

            <Text style={styles.adminLine}>
              Logged in: {admin?.fullName || "Admin"} · {admin?.email}
            </Text>
          </View>

          <TouchableOpacity style={styles.logoutButton} onPress={logout}>
            <Ionicons name="log-out-outline" size={18} color={ui.white} />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.moneyCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.moneyLabel}>Gross Marketplace Sales</Text>
            <Text style={styles.moneyValue}>{money(grossSales)}</Text>
            <Text style={styles.moneySub}>
              Orders: {totals.orders} · Payout Gross: {money(grossPayouts)} · Platform Fees:{" "}
              {money(platformFees)}
            </Text>
          </View>

          <View style={styles.moneyIcon}>
            <Ionicons name="analytics-outline" size={32} color={ui.white} />
          </View>
        </View>

        <View style={styles.grid}>
          <Metric title="All Profiles" value={totals.profiles} icon="people-outline" color={ui.blue} />
          <Metric title="Admins" value={totals.admins} icon="shield-checkmark-outline" color={ui.purple} />
          <Metric title="Farmers" value={totals.farmers} icon="leaf-outline" color={ui.green} />
          <Metric title="Customers" value={totals.customers} icon="person-outline" color={ui.purple} />
          <Metric title="Drivers" value={totals.drivers} icon="car-outline" color={ui.orange} />
          <Metric title="Freight Users" value={totals.freight} icon="trail-sign-outline" color={ui.blue} />
          <Metric title="Products" value={totals.products} icon="basket-outline" color={ui.green} />
          <Metric title="Bundles" value={totals.bundles} icon="cube-outline" color={ui.purple} />
          <Metric title="Issues" value={totals.issues} icon="warning-outline" color={ui.red} />
        </View>

        <Section title="Possible Issues" subtitle="Items that need admin attention." />

        {issues.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>✅</Text>
            <Text style={styles.emptyTitle}>No major issues detected</Text>
            <Text style={styles.emptyText}>
              Profiles, products, delivery, freight, and admin records look clean.
            </Text>
          </View>
        ) : (
          issues.slice(0, 25).map((issue) => <IssueCard key={issue.id} issue={issue} />)
        )}

        <Section title="Profile Overview" subtitle="Review all active account groups." />

        <View style={styles.profileGrid}>
          <ProfileGroup title="Admins" rows={admins} nameKey="full_name" />
          <ProfileGroup title="Farmers" rows={farmers} nameKey="farm_name" />
          <ProfileGroup title="Customers" rows={customers} nameKey="full_name" />
          <ProfileGroup title="Drivers" rows={drivers} nameKey="full_name" />
          <ProfileGroup title="Freight" rows={freightUsers} nameKey="company_name" />
        </View>

        <Section title="Admin Actions" subtitle="Jump into core operations." />

        <View style={styles.actions}>
          <Action label="Farmers" icon="leaf-outline" route="/admin/farmers" />
          <Action label="Orders" icon="receipt-outline" route="/admin/orders" />
          <Action label="Compliance" icon="shield-checkmark-outline" route="/admin/compliance" />
          <Action label="Payouts" icon="wallet-outline" route="/admin/payouts" />
          <Action label="Freight" icon="trail-sign-outline" route="/admin/freight" />
          <Action label="Drivers" icon="car-outline" route="/admin/drivers" />
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
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricTitle}>{title}</Text>
    </View>
  );
}

function IssueCard({ issue }: { issue: Issue }) {
  const color =
    issue.severity === "High"
      ? ui.red
      : issue.severity === "Medium"
      ? ui.orange
      : ui.blue;

  return (
    <View style={styles.issueCard}>
      <View style={[styles.issueIcon, { backgroundColor: `${color}18` }]}>
        <Ionicons name="warning-outline" size={20} color={color} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.issueTitle}>{issue.title}</Text>
        <Text style={styles.issueDetail}>{issue.detail}</Text>
        <Text style={styles.issueArea}>{issue.area}</Text>
      </View>

      <Text style={[styles.severity, { color }]}>{issue.severity}</Text>
    </View>
  );
}

function ProfileGroup({
  title,
  rows,
  nameKey,
}: {
  title: string;
  rows: any[];
  nameKey: string;
}) {
  return (
    <View style={styles.profileCard}>
      <Text style={styles.profileTitle}>{title}</Text>
      <Text style={styles.profileCount}>{rows.length}</Text>

      {rows.slice(0, 5).map((row, index) => (
        <View key={row.id || index} style={styles.profileRow}>
          <Text style={styles.profileName}>
            {row[nameKey] || row.full_name || row.email || row.username || "Profile"}
          </Text>
          <Text style={styles.profileMeta}>
            {row.email || row.username || row.role || "No email"}
          </Text>
        </View>
      ))}
    </View>
  );
}

function Action({
  label,
  icon,
  route,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
}) {
  return (
    <TouchableOpacity
      style={styles.action}
      onPress={() => router.push(route as any)}
      activeOpacity={0.85}
    >
      <Ionicons name={icon} size={20} color={ui.blue} />
      <Text style={styles.actionText}>{label}</Text>
      <Ionicons name="chevron-forward-outline" size={18} color={ui.muted} />
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
    justifyContent: "space-between",
    gap: 12,
  },
  kicker: {
    color: "#93C5FD",
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  title: { color: ui.white, fontSize: 33, fontWeight: "900", marginTop: 6 },
  subtitle: {
    color: "#CBD5E1",
    fontWeight: "700",
    lineHeight: 22,
    marginTop: 8,
    maxWidth: 780,
  },
  adminLine: { color: "#BFDBFE", fontWeight: "800", marginTop: 12 },
  logoutButton: {
    backgroundColor: ui.blue,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    alignSelf: "flex-start",
  },
  logoutText: { color: ui.white, fontWeight: "900" },

  moneyCard: {
    backgroundColor: ui.blue,
    borderRadius: 26,
    padding: 22,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  moneyLabel: { color: "#DBEAFE", fontWeight: "900" },
  moneyValue: { color: ui.white, fontSize: 42, fontWeight: "900", marginTop: 5 },
  moneySub: { color: "#DBEAFE", fontWeight: "700", marginTop: 6 },
  moneyIcon: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },

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
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  metricValue: { color: ui.text, fontSize: 25, fontWeight: "900" },
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
  },
  issueIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  issueTitle: { color: ui.text, fontWeight: "900", fontSize: 16 },
  issueDetail: { color: ui.muted, fontWeight: "700", lineHeight: 20, marginTop: 3 },
  issueArea: { color: ui.blue, fontWeight: "900", marginTop: 6, fontSize: 12 },
  severity: { fontWeight: "900", fontSize: 12 },

  emptyCard: {
    backgroundColor: ui.card,
    borderRadius: 22,
    padding: 22,
    borderWidth: 1,
    borderColor: ui.border,
    alignItems: "center",
  },
  emptyEmoji: { fontSize: 38 },
  emptyTitle: { color: ui.text, fontWeight: "900", fontSize: 18, marginTop: 8 },
  emptyText: {
    color: ui.muted,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 6,
  },

  profileGrid: { gap: 12 },
  profileCard: {
    backgroundColor: ui.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: ui.border,
    padding: 16,
  },
  profileTitle: { color: ui.muted, fontWeight: "900" },
  profileCount: {
    color: ui.text,
    fontSize: 28,
    fontWeight: "900",
    marginVertical: 5,
  },
  profileRow: {
    backgroundColor: ui.bg,
    borderRadius: 14,
    padding: 10,
    marginTop: 8,
  },
  profileName: { color: ui.text, fontWeight: "900" },
  profileMeta: { color: ui.muted, fontWeight: "700", marginTop: 3 },

  actions: { gap: 10 },
  action: {
    backgroundColor: ui.card,
    borderWidth: 1,
    borderColor: ui.border,
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  actionText: { flex: 1, color: ui.text, fontWeight: "900" },
});