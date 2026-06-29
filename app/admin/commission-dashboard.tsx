// app/admin/commission-dashboard.tsx

import React, { useCallback, useMemo, useState } from "react";
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
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../services/supabaseClient";

type Period = "Today" | "This Week" | "This Month" | "This Year";

type CommissionLine = {
  id: string;
  source: string;
  grossSales: number;
  commissionRate: number;
  commission: number;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
};

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
  purple: "#7C3AED",
  red: "#DC2626",
  white: "#FFFFFF",
};

const periods: Period[] = ["Today", "This Week", "This Month", "This Year"];

function clean(value: any) {
  return String(value ?? "").trim();
}

function lower(value: any) {
  return clean(value).toLowerCase();
}

function money(value: any) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function rowAmount(row: any) {
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

function inPeriod(dateValue: any, period: Period) {
  const date = new Date(dateValue || "");
  const now = new Date();

  if (Number.isNaN(date.getTime())) return true;

  if (period === "Today") {
    return date.toDateString() === now.toDateString();
  }

  if (period === "This Week") {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
    return date >= start;
  }

  if (period === "This Month") {
    return date >= new Date(now.getFullYear(), now.getMonth(), 1);
  }

  return date >= new Date(now.getFullYear(), 0, 1);
}

async function safeRead(table: string) {
  try {
    const { data, error } = await supabase.from(table).select("*").limit(2000);

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

export default function CommissionDashboard() {
  const [period, setPeriod] = useState<Period>("This Month");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [adminEmail, setAdminEmail] = useState("");
  const [orders, setOrders] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [farmerPlans, setFarmerPlans] = useState<any[]>([]);
  const [freightLoads, setFreightLoads] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);

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
      await loadDashboard();
    } catch {
      router.replace("/admin/login" as any);
    }
  }

  async function loadDashboard() {
    try {
      setLoading(true);

      const [
        orderRows,
        subscriptionRows,
        farmerPlanRows,
        freightRows,
        payoutRows,
      ] = await Promise.all([
        safeRead("orders"),
        safeRead("customer_subscriptions"),
        safeRead("farmer_subscriptions"),
        safeRead("freight_loads"),
        safeRead("farmer_payouts"),
      ]);

      setOrders(orderRows);
      setSubscriptions(subscriptionRows);
      setFarmerPlans(farmerPlanRows);
      setFreightLoads(freightRows);
      setPayouts(payoutRows);
    } catch (error: any) {
      Alert.alert("Commission Error", error?.message || "Unable to load commission data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadDashboard();
  }

  const lines = useMemo<CommissionLine[]>(() => {
    const filteredOrders = orders.filter((row) =>
      inPeriod(row.created_at || row.updated_at, period)
    );

    const filteredSubscriptions = subscriptions.filter((row) =>
      inPeriod(row.created_at || row.updated_at, period)
    );

    const filteredFarmerPlans = farmerPlans.filter((row) =>
      inPeriod(row.created_at || row.updated_at, period)
    );

    const filteredFreight = freightLoads.filter((row) =>
      inPeriod(row.created_at || row.updated_at, period)
    );

    const marketplaceGross = filteredOrders.reduce((sum, row) => sum + rowAmount(row), 0);
    const subscriptionGross = filteredSubscriptions.reduce(
      (sum, row) => sum + rowAmount(row),
      0
    );
    const farmerPlanGross = filteredFarmerPlans.reduce(
      (sum, row) => sum + rowAmount(row),
      0
    );
    const freightGross = filteredFreight.reduce((sum, row) => sum + rowAmount(row), 0);

    return [
      {
        id: "marketplace",
        source: "Marketplace Orders",
        grossSales: marketplaceGross,
        commissionRate: 0.12,
        commission: marketplaceGross * 0.12,
        icon: "basket-outline",
        color: ui.green,
      },
      {
        id: "subscriptions",
        source: "Customer Subscriptions",
        grossSales: subscriptionGross,
        commissionRate: 0.18,
        commission: subscriptionGross * 0.18,
        icon: "repeat-outline",
        color: ui.purple,
      },
      {
        id: "farmer-plans",
        source: "Farmer Plans",
        grossSales: farmerPlanGross,
        commissionRate: 1,
        commission: farmerPlanGross,
        icon: "leaf-outline",
        color: ui.orange,
      },
      {
        id: "freight",
        source: "Freight Loads",
        grossSales: freightGross,
        commissionRate: 0.08,
        commission: freightGross * 0.08,
        icon: "trail-sign-outline",
        color: ui.primary,
      },
    ];
  }, [orders, subscriptions, farmerPlans, freightLoads, period]);

  const totals = useMemo(() => {
    const totalGross = lines.reduce((sum, line) => sum + line.grossSales, 0);
    const totalCommission = lines.reduce((sum, line) => sum + line.commission, 0);
    const payoutGross = payouts
      .filter((row) => inPeriod(row.created_at || row.updated_at, period))
      .reduce((sum, row) => sum + Number(row.gross_amount || row.amount || 0), 0);
    const platformFees = payouts
      .filter((row) => inPeriod(row.created_at || row.updated_at, period))
      .reduce((sum, row) => sum + Number(row.platform_fee || row.fee || 0), 0);

    return {
      totalGross,
      totalCommission,
      payoutGross,
      platformFees,
      netAfterPayoutFees: totalCommission + platformFees,
    };
  }, [lines, payouts, period]);

  const topLine = useMemo(() => {
    return [...lines].sort((a, b) => b.commission - a.commission)[0];
  }, [lines]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor={ui.dark} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={ui.primary} />
          <Text style={styles.centerText}>Loading commission dashboard...</Text>
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
            <Text style={styles.kicker}>Farm2Home Admin Revenue</Text>
            <Text style={styles.title}>Commission Dashboard</Text>
            <Text style={styles.subtitle}>
              Monitor platform commission from marketplace orders, subscriptions,
              farmer plans, freight loads, and payout fees.
            </Text>
            <Text style={styles.adminLine}>Logged in: {adminEmail || "Admin"}</Text>
          </View>

          <TouchableOpacity style={styles.refreshButton} onPress={loadDashboard}>
            <Ionicons name="refresh-outline" size={18} color={ui.white} />
            <Text style={styles.refreshText}>Refresh</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.periodCard}>
          <Text style={styles.periodTitle}>Time Period</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {periods.map((item) => (
              <TouchableOpacity
                key={item}
                style={[styles.chip, period === item && styles.chipActive]}
                onPress={() => setPeriod(item)}
              >
                <Text style={[styles.chipText, period === item && styles.chipTextActive]}>
                  {item}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.grossCard}>
          <Text style={styles.grossLabel}>{period} Platform Commission</Text>
          <Text style={styles.grossValue}>{money(totals.totalCommission)}</Text>
          <Text style={styles.grossSub}>
            Gross volume {money(totals.totalGross)} · Payout fees{" "}
            {money(totals.platformFees)}
          </Text>
        </View>

        <View style={styles.grid}>
          <Metric title="Gross Volume" value={money(totals.totalGross)} icon="analytics-outline" color={ui.primary} />
          <Metric title="Commission" value={money(totals.totalCommission)} icon="cash-outline" color={ui.green} />
          <Metric title="Payout Gross" value={money(totals.payoutGross)} icon="wallet-outline" color={ui.purple} />
          <Metric title="Platform Fees" value={money(totals.platformFees)} icon="pricetag-outline" color={ui.orange} />
        </View>

        <View style={styles.aiCard}>
          <View style={styles.aiHeader}>
            <View style={styles.aiIcon}>
              <Ionicons name="sparkles-outline" size={22} color={ui.primary} />
            </View>
            <Text style={styles.aiTitle}>Commission Intelligence</Text>
          </View>

          <Text style={styles.aiText}>
            Top revenue stream:{" "}
            <Text style={styles.aiStrong}>{topLine?.source || "No activity yet"}</Text>.
          </Text>
          <Text style={styles.aiText}>
            Estimated 30-day commission run-rate:{" "}
            <Text style={styles.aiStrong}>{money(totals.totalCommission * 4)}</Text>.
          </Text>
          <Text style={styles.aiText}>
            Focus on customer subscriptions and freight conversion to improve recurring
            platform revenue.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Revenue Streams</Text>

        {lines.map((line) => (
          <View key={line.id} style={styles.lineCard}>
            <View style={[styles.lineIcon, { backgroundColor: `${line.color}18` }]}>
              <Ionicons name={line.icon} size={22} color={line.color} />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.lineSource}>{line.source}</Text>
              <Text style={styles.lineMeta}>Gross sales: {money(line.grossSales)}</Text>
              <Text style={styles.lineMeta}>
                Commission rate: {(line.commissionRate * 100).toFixed(0)}%
              </Text>

              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${
                        totals.totalCommission > 0
                          ? Math.max(8, (line.commission / totals.totalCommission) * 100)
                          : 8
                      }%`,
                      backgroundColor: line.color,
                    },
                  ]}
                />
              </View>
            </View>

            <View style={styles.lineRight}>
              <Text style={styles.lineCommission}>{money(line.commission)}</Text>
              <Text style={styles.lineSmall}>commission</Text>
            </View>
          </View>
        ))}

        <View style={styles.actions}>
          <AdminNav label="Dashboard" icon="grid-outline" route="/admin/dashboard" />
          <AdminNav label="Analytics Center" icon="analytics-outline" route="/admin/analytics-center" />
          <AdminNav label="Application Payments" icon="card-outline" route="/admin/application-payments" />
          <AdminNav label="Payouts" icon="wallet-outline" route="/admin/payouts" />
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: string;
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
  subtitle: {
    color: "#CBD5E1",
    fontWeight: "700",
    lineHeight: 22,
    marginTop: 8,
  },
  adminLine: { color: "#BFDBFE", fontWeight: "800", marginTop: 12 },
  refreshButton: {
    backgroundColor: ui.primary,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    alignSelf: "flex-start",
  },
  refreshText: { color: ui.white, fontWeight: "900" },

  periodCard: {
    backgroundColor: ui.card,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: ui.border,
    marginBottom: 14,
  },
  periodTitle: {
    color: ui.text,
    fontWeight: "900",
    fontSize: 18,
    marginBottom: 12,
  },
  chip: {
    backgroundColor: ui.white,
    borderWidth: 1,
    borderColor: ui.border,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 999,
    marginRight: 10,
  },
  chipActive: { backgroundColor: ui.primary, borderColor: ui.primary },
  chipText: { color: ui.text, fontWeight: "900" },
  chipTextActive: { color: ui.white },

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
  metricValue: { color: ui.text, fontSize: 21, fontWeight: "900" },
  metricTitle: { color: ui.muted, fontWeight: "800", marginTop: 4 },

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

  sectionTitle: {
    color: ui.text,
    fontSize: 23,
    fontWeight: "900",
    marginTop: 22,
    marginBottom: 12,
  },

  lineCard: {
    backgroundColor: ui.card,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: ui.border,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  lineIcon: {
    width: 48,
    height: 48,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  lineSource: { color: ui.text, fontSize: 17, fontWeight: "900" },
  lineMeta: { color: ui.muted, fontWeight: "700", marginTop: 4 },
  progressTrack: {
    height: 9,
    backgroundColor: ui.primarySoft,
    borderRadius: 999,
    overflow: "hidden",
    marginTop: 10,
  },
  progressFill: { height: "100%", borderRadius: 999 },
  lineRight: { alignItems: "flex-end", maxWidth: 130 },
  lineCommission: { color: ui.primary, fontSize: 20, fontWeight: "900" },
  lineSmall: { color: ui.muted, fontWeight: "800", fontSize: 11, marginTop: 3 },

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