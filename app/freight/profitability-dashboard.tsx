// app/freight/profitability-dashboard.tsx

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

import { supabase } from "../data/supabaseClient";

const FREIGHT_ROUTES = {
  managementCenter: "/freight/freight-management-center",
  earnings: "/freight/earnings",
  expenseCenter: "/freight/expense-center",
  fuelTracker: "/freight/fuel-tracker",
  maintenanceTracker: "/freight/maintenance-tracker",
  settlements: "/freight/settlements",
  rateOptimizer: "/freight/rate-optimizer",
  costCalculator: "/freight/cost-calculator",
  payoutCenter: "/freight/payout-center",
  login: "/freight/login",
  register: "/freight/register",
} as const;

const COLORS = {
  bg: "#F4F5F7",
  card: "#FFFFFF",
  surface: "#F9FAFB",
  black: "#050505",
  red: "#D71920",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  green: "#16A34A",
  amber: "#D97706",
  blue: "#2563EB",
};

function normalize(value: any) {
  return String(value || "").trim().toLowerCase();
}

function money(value: any) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function goTo(route: string) {
  router.push(route as any);
}

export default function FreightProfitabilityDashboardScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [carrier, setCarrier] = useState<any>(null);
  const [loads, setLoads] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [fuelReceipts, setFuelReceipts] = useState<any[]>([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadProfitability();
    }, [])
  );

  const metrics = useMemo(() => {
    const completedLoads = loads.filter((load) =>
      ["delivered", "completed"].includes(normalize(load.status))
    );

    const activeLoads = loads.filter((load) =>
      ["accepted", "arrived_pickup", "picked_up", "in_transit", "arrived_dropoff"].includes(
        normalize(load.status)
      )
    );

    const grossRevenue = completedLoads.reduce(
      (sum, load) => sum + Number(load.rate || load.freight_total || load.total_due || 0),
      0
    );

    const pendingRevenue = activeLoads.reduce(
      (sum, load) => sum + Number(load.rate || load.freight_total || load.total_due || 0),
      0
    );

    const expenseTotal = expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const fuelTotal =
      fuelReceipts.reduce((sum, item) => sum + Number(item.total_amount || 0), 0) ||
      expenses
        .filter((item) => normalize(item.expense_type) === "fuel")
        .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const maintenanceTotal =
      maintenanceRecords.reduce((sum, item) => sum + Number(item.service_cost || 0), 0) ||
      expenses
        .filter((item) => normalize(item.expense_type) === "maintenance")
        .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const insuranceTotal = expenses
      .filter((item) => normalize(item.expense_type) === "insurance")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const tollsParkingTotal = expenses
      .filter((item) => ["tolls", "parking"].includes(normalize(item.expense_type)))
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const platformFees = grossRevenue * 0.04;
    const trueExpenses = expenseTotal + platformFees;
    const netProfit = grossRevenue - trueExpenses;
    const margin = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0;

    const totalMiles = completedLoads.reduce(
      (sum, load) => sum + Number(load.distance_miles || load.miles || 0),
      0
    );

    const revenuePerMile = totalMiles > 0 ? grossRevenue / totalMiles : 0;
    const costPerMile = totalMiles > 0 ? trueExpenses / totalMiles : 0;
    const profitPerMile = totalMiles > 0 ? netProfit / totalMiles : 0;

    return {
      completedCount: completedLoads.length,
      activeCount: activeLoads.length,
      grossRevenue,
      pendingRevenue,
      expenseTotal,
      fuelTotal,
      maintenanceTotal,
      insuranceTotal,
      tollsParkingTotal,
      platformFees,
      trueExpenses,
      netProfit,
      margin,
      totalMiles,
      revenuePerMile,
      costPerMile,
      profitPerMile,
    };
  }, [loads, expenses, fuelReceipts, maintenanceRecords]);

  async function getStoredCarrier() {
    const raw =
      (await AsyncStorage.getItem("currentFreightCarrier")) ||
      (await AsyncStorage.getItem("currentFreight")) ||
      (await AsyncStorage.getItem("currentFreightUser")) ||
      (await AsyncStorage.getItem("currentUser"));

    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async function persistCarrier(nextCarrier: any) {
    const normalizedCarrier = {
      ...nextCarrier,
      id: nextCarrier.id || nextCarrier.freightId,
      freightId: nextCarrier.freightId || nextCarrier.id,
      role: "freight",
      email: normalize(nextCarrier.email),
      companyName:
        nextCarrier.companyName ||
        nextCarrier.businessName ||
        nextCarrier.company_name ||
        nextCarrier.business_name ||
        "Freight Connect Carrier",
    };

    await AsyncStorage.setItem("currentFreight", JSON.stringify(normalizedCarrier));
    await AsyncStorage.setItem("currentFreightCarrier", JSON.stringify(normalizedCarrier));
    await AsyncStorage.setItem("currentFreightUser", JSON.stringify(normalizedCarrier));
    await AsyncStorage.setItem("currentUser", JSON.stringify(normalizedCarrier));
    await AsyncStorage.setItem("userRole", "freight");
    await AsyncStorage.setItem("currentUserRole", "freight");

    setCarrier(normalizedCarrier);
    return normalizedCarrier;
  }

  async function loadProfitability() {
    try {
      setLoading(true);

      const stored = await getStoredCarrier();
      const { data: authData } = await supabase.auth.getUser();
      const email = normalize(stored?.email || authData?.user?.email || "");

      if (!email) {
        router.replace(FREIGHT_ROUTES.login as any);
        return;
      }

      const { data: dbCarrier, error } = await supabase
        .from("freight_users")
        .select("*")
        .eq("email", email)
        .maybeSingle();

      if (error) console.log("Profitability carrier error:", error.message);

      if (!dbCarrier) {
        Alert.alert("Freight Profile Missing", "Please complete freight registration first.");
        router.replace(FREIGHT_ROUTES.register as any);
        return;
      }

      const mergedCarrier = await persistCarrier({
        ...(stored || {}),
        ...(dbCarrier || {}),
        id: dbCarrier.id,
        freightId: dbCarrier.id,
        email: normalize(dbCarrier.email || email),
        companyName:
          dbCarrier.company_name ||
          dbCarrier.business_name ||
          stored?.companyName ||
          stored?.businessName ||
          "Freight Connect Carrier",
      });

      const { data: loadData } = await supabase
        .from("freight_loads")
        .select("*")
        .or(
          `carrier_id.eq.${mergedCarrier.id},driver_id.eq.${mergedCarrier.id},accepted_by.eq.${mergedCarrier.id}`
        )
        .order("updated_at", { ascending: false });

      setLoads(Array.isArray(loadData) ? loadData : []);

      const { data: expenseData } = await supabase
        .from("freight_expenses")
        .select("*")
        .eq("freight_id", mergedCarrier.id)
        .order("expense_date", { ascending: false });

      setExpenses(Array.isArray(expenseData) ? expenseData : []);

      const { data: fuelData } = await supabase
        .from("freight_fuel_receipts")
        .select("*")
        .eq("freight_id", mergedCarrier.id)
        .order("created_at", { ascending: false });

      setFuelReceipts(Array.isArray(fuelData) ? fuelData : []);

      const { data: maintenanceData } = await supabase
        .from("freight_maintenance_records")
        .select("*")
        .eq("freight_id", mergedCarrier.id)
        .order("created_at", { ascending: false });

      setMaintenanceRecords(Array.isArray(maintenanceData) ? maintenanceData : []);
    } catch (error: any) {
      Alert.alert("Profitability Error", error?.message || "Unable to load profitability dashboard.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadProfitability();
  }

  function profitColor() {
    if (metrics.netProfit > 0 && metrics.margin >= 20) return COLORS.green;
    if (metrics.netProfit > 0) return COLORS.amber;
    return COLORS.red;
  }

  function renderLoad({ item }: { item: any }) {
    const amount = Number(item.rate || item.freight_total || item.total_due || 0);
    const miles = Number(item.distance_miles || item.miles || 0);
    const rpm = miles > 0 ? amount / miles : 0;

    return (
      <View style={styles.loadCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.loadTitle}>{item.title || item.commodity || "Freight Load"}</Text>
          <Text style={styles.loadRoute}>
            {item.pickup_location || "Pickup"} → {item.dropoff_location || "Dropoff"}
          </Text>
          <Text style={styles.loadMeta}>
            {String(item.status || "load").replace(/_/g, " ")} · {miles.toFixed(0)} miles · {money(rpm)}/mi
          </Text>
        </View>

        <Text style={styles.loadAmount}>{money(amount)}</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <ActivityIndicator size="large" color={COLORS.red} />
        <Text style={styles.centerText}>Loading profitability dashboard...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>Farm2Home Freight Connect</Text>
            <Text style={styles.title}>Profitability Dashboard</Text>
            <Text style={styles.subtitle}>
              True freight profit combining earnings, expenses, fuel, maintenance, settlements, and rate data.
            </Text>
          </View>

          <TouchableOpacity style={styles.heroIcon} onPress={() => goTo(FREIGHT_ROUTES.rateOptimizer)}>
            <Ionicons name="trending-up-outline" size={34} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.profitCard}>
          <Text style={styles.profitLabel}>Net Profit</Text>
          <Text style={[styles.profitValue, { color: profitColor() }]}>{money(metrics.netProfit)}</Text>
          <Text style={styles.profitSub}>
            Margin {metrics.margin.toFixed(1)}% · Profit/Mile {money(metrics.profitPerMile)}
          </Text>
        </View>

        <View style={styles.statsGrid}>
          <StatCard label="Gross Revenue" value={money(metrics.grossRevenue)} icon="cash-outline" />
          <StatCard label="Expenses" value={money(metrics.trueExpenses)} icon="receipt-outline" />
          <StatCard label="Pending Revenue" value={money(metrics.pendingRevenue)} icon="time-outline" />
          <StatCard label="Completed Loads" value={String(metrics.completedCount)} icon="checkmark-circle-outline" />
          <StatCard label="Revenue/Mile" value={money(metrics.revenuePerMile)} icon="speedometer-outline" />
          <StatCard label="Cost/Mile" value={money(metrics.costPerMile)} icon="analytics-outline" />
        </View>

        <View style={styles.quickGrid}>
          <QuickLink icon="cash-outline" label="Earnings" route={FREIGHT_ROUTES.earnings} />
          <QuickLink icon="wallet-outline" label="Expenses" route={FREIGHT_ROUTES.expenseCenter} />
          <QuickLink icon="flame-outline" label="Fuel" route={FREIGHT_ROUTES.fuelTracker} />
          <QuickLink icon="construct-outline" label="Maintenance" route={FREIGHT_ROUTES.maintenanceTracker} />
          <QuickLink icon="receipt-outline" label="Settlements" route={FREIGHT_ROUTES.settlements} />
          <QuickLink icon="analytics-outline" label="Optimizer" route={FREIGHT_ROUTES.rateOptimizer} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Expense Breakdown</Text>
          <BreakdownRow label="Fuel" value={money(metrics.fuelTotal)} />
          <BreakdownRow label="Maintenance" value={money(metrics.maintenanceTotal)} />
          <BreakdownRow label="Insurance" value={money(metrics.insuranceTotal)} />
          <BreakdownRow label="Tolls / Parking" value={money(metrics.tollsParkingTotal)} />
          <BreakdownRow label="Platform Fees" value={money(metrics.platformFees)} />
          <BreakdownRow label="All Expenses" value={money(metrics.trueExpenses)} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Profit Health</Text>

          <HealthRow
            label="Margin"
            value={`${metrics.margin.toFixed(1)}%`}
            good={metrics.margin >= 20}
          />
          <HealthRow
            label="Profit Per Mile"
            value={money(metrics.profitPerMile)}
            good={metrics.profitPerMile >= 0.75}
          />
          <HealthRow
            label="Revenue Per Mile"
            value={money(metrics.revenuePerMile)}
            good={metrics.revenuePerMile >= 2}
          />
          <HealthRow
            label="Cost Per Mile"
            value={money(metrics.costPerMile)}
            good={metrics.costPerMile <= 1.5}
          />
        </View>

        <Text style={styles.sectionTitle}>Recent Freight Loads</Text>

        <FlatList
          data={loads.slice(0, 8)}
          keyExtractor={(item, index) => String(item.id || index)}
          scrollEnabled={false}
          renderItem={renderLoad}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Ionicons name="trending-up-outline" size={38} color={COLORS.red} />
              <Text style={styles.emptyTitle}>No freight loads yet.</Text>
              <Text style={styles.emptyText}>
                Completed and active loads will appear here for profit tracking.
              </Text>
            </View>
          }
        />

        <TouchableOpacity style={styles.primaryButton} onPress={() => goTo(FREIGHT_ROUTES.expenseCenter)}>
          <Ionicons name="wallet-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryText}>Open Expense Center</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.darkButton} onPress={() => goTo(FREIGHT_ROUTES.managementCenter)}>
          <Ionicons name="apps-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryText}>Management Center</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function BreakdownRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.breakdownRow}>
      <Text style={styles.breakdownLabel}>{label}</Text>
      <Text style={styles.breakdownValue}>{value}</Text>
    </View>
  );
}

function HealthRow({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <View style={styles.healthRow}>
      <Ionicons
        name={good ? "checkmark-circle-outline" : "alert-circle-outline"}
        size={20}
        color={good ? COLORS.green : COLORS.amber}
      />
      <Text style={styles.healthLabel}>{label}</Text>
      <Text style={[styles.healthValue, { color: good ? COLORS.green : COLORS.amber }]}>
        {value}
      </Text>
    </View>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={22} color={COLORS.red} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function QuickLink({
  icon,
  label,
  route,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  route: string;
}) {
  return (
    <TouchableOpacity style={styles.quickLink} onPress={() => goTo(route)}>
      <Ionicons name={icon} size={22} color={COLORS.red} />
      <Text style={styles.quickText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingBottom: 90 },
  center: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  centerText: { color: COLORS.muted, marginTop: 12, fontWeight: "800" },
  hero: {
    backgroundColor: COLORS.black,
    paddingTop: 30,
    paddingHorizontal: 20,
    paddingBottom: 30,
    flexDirection: "row",
    gap: 14,
  },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 24,
    backgroundColor: COLORS.red,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: {
    color: "#FCA5A5",
    fontWeight: "900",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontSize: 12,
  },
  title: { color: "#FFFFFF", fontSize: 32, fontWeight: "900", marginBottom: 10 },
  subtitle: { color: "#D1D5DB", lineHeight: 22, fontWeight: "700" },
  profitCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 22,
    marginHorizontal: 18,
    marginTop: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  profitLabel: { color: COLORS.muted, fontWeight: "900", textTransform: "uppercase" },
  profitValue: { fontSize: 42, fontWeight: "900", marginTop: 6 },
  profitSub: { color: COLORS.text, fontWeight: "800", marginTop: 6 },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  statCard: {
    width: "48%",
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statValue: { color: COLORS.text, fontSize: 20, fontWeight: "900", marginTop: 7 },
  statLabel: { color: COLORS.muted, fontWeight: "800", marginTop: 4 },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  quickLink: {
    width: "48%",
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    gap: 8,
  },
  quickText: { color: COLORS.text, fontWeight: "900", textAlign: "center" },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 18,
    marginHorizontal: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTitle: { color: COLORS.text, fontSize: 21, fontWeight: "900", marginBottom: 12 },
  breakdownRow: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 13,
    marginBottom: 9,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  breakdownLabel: { color: COLORS.muted, fontWeight: "900", flex: 1 },
  breakdownValue: { color: COLORS.text, fontWeight: "900" },
  healthRow: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 13,
    marginBottom: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  healthLabel: { color: COLORS.text, fontWeight: "900", flex: 1 },
  healthValue: { fontWeight: "900" },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 23,
    fontWeight: "900",
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  loadCard: {
    backgroundColor: COLORS.card,
    marginHorizontal: 18,
    marginBottom: 14,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    gap: 12,
  },
  loadTitle: { color: COLORS.text, fontSize: 18, fontWeight: "900" },
  loadRoute: { color: COLORS.muted, fontWeight: "700", marginTop: 4 },
  loadMeta: { color: COLORS.text, fontWeight: "700", marginTop: 4 },
  loadAmount: { color: COLORS.red, fontSize: 18, fontWeight: "900" },
  emptyCard: {
    backgroundColor: COLORS.card,
    marginHorizontal: 18,
    borderRadius: 22,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyTitle: { color: COLORS.text, fontSize: 20, fontWeight: "900", marginTop: 10 },
  emptyText: {
    color: COLORS.muted,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 22,
  },
  primaryButton: {
    backgroundColor: COLORS.red,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 18,
    marginTop: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  darkButton: {
    backgroundColor: COLORS.black,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 18,
    marginTop: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryText: { color: "#FFFFFF", fontWeight: "900" },
});