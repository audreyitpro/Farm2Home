// app/freight/tax-center.tsx

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
  profitabilityDashboard: "/freight/profitability-dashboard",
  expenseCenter: "/freight/expense-center",
  fuelTracker: "/freight/fuel-tracker",
  maintenanceTracker: "/freight/maintenance-tracker",
  earnings: "/freight/earnings",
  payoutCenter: "/freight/payout-center",
  support: "/freight/support",
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

function currentTaxYear() {
  return new Date().getFullYear();
}

function yearOf(value?: string | null) {
  if (!value) return currentTaxYear();
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return currentTaxYear();
  return d.getFullYear();
}

function formatDate(value?: string | null) {
  if (!value) return "Not recorded";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString();
}

export default function FreightTaxCenterScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [carrier, setCarrier] = useState<any>(null);
  const [loads, setLoads] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [fuelReceipts, setFuelReceipts] = useState<any[]>([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState<any[]>([]);
  const [selectedYear, setSelectedYear] = useState(currentTaxYear());

  useFocusEffect(
    useCallback(() => {
      loadTaxCenter();
    }, [])
  );

  const taxData = useMemo(() => {
    const completedLoads = loads.filter(
      (load) =>
        ["delivered", "completed"].includes(normalize(load.status)) &&
        yearOf(load.delivered_at || load.updated_at || load.created_at) === selectedYear
    );

    const yearExpenses = expenses.filter(
      (item) => yearOf(item.expense_date || item.created_at) === selectedYear
    );

    const yearFuel = fuelReceipts.filter((item) => yearOf(item.created_at) === selectedYear);

    const yearMaintenance = maintenanceRecords.filter(
      (item) => yearOf(item.created_at) === selectedYear
    );

    const revenue = completedLoads.reduce(
      (sum, load) => sum + Number(load.rate || load.freight_total || load.total_due || 0),
      0
    );

    const mileage = completedLoads.reduce(
      (sum, load) => sum + Number(load.distance_miles || load.miles || 0),
      0
    );

    const directExpenses = yearExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const fuelTotal =
      yearFuel.reduce((sum, item) => sum + Number(item.total_amount || 0), 0) ||
      yearExpenses
        .filter((item) => normalize(item.expense_type) === "fuel")
        .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const maintenanceTotal =
      yearMaintenance.reduce((sum, item) => sum + Number(item.service_cost || 0), 0) ||
      yearExpenses
        .filter((item) => normalize(item.expense_type) === "maintenance")
        .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const insuranceTotal = yearExpenses
      .filter((item) => normalize(item.expense_type) === "insurance")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const tollsParkingTotal = yearExpenses
      .filter((item) => ["tolls", "parking"].includes(normalize(item.expense_type)))
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const subscriptionsTotal = yearExpenses
      .filter((item) => normalize(item.expense_type) === "subscription")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const receiptsCount =
      yearExpenses.filter((x) => x.receipt_url).length +
      yearFuel.filter((x) => x.receipt_url).length +
      yearMaintenance.filter((x) => x.receipt_url).length;

    const platformFees = revenue * 0.04;
    const deductions = directExpenses + platformFees;
    const taxableProfit = Math.max(0, revenue - deductions);
    const estimatedTax = taxableProfit * 0.25;
    const netAfterTax = taxableProfit - estimatedTax;

    return {
      completedLoads: completedLoads.length,
      revenue,
      mileage,
      directExpenses,
      fuelTotal,
      maintenanceTotal,
      insuranceTotal,
      tollsParkingTotal,
      subscriptionsTotal,
      platformFees,
      deductions,
      taxableProfit,
      estimatedTax,
      netAfterTax,
      receiptsCount,
    };
  }, [loads, expenses, fuelReceipts, maintenanceRecords, selectedYear]);

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

  async function loadTaxCenter() {
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

      if (error) console.log("Tax center carrier error:", error.message);

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
      Alert.alert("Tax Center Error", error?.message || "Unable to load tax center.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadTaxCenter();
  }

  async function saveYearSummary() {
    if (!carrier?.id) {
      Alert.alert("Profile Missing", "Please log in again.");
      return;
    }

    try {
      const now = new Date().toISOString();

      const { error } = await supabase.from("freight_tax_summaries").upsert(
        {
          freight_id: carrier.id,
          carrier_id: carrier.id,
          tax_year: selectedYear,
          gross_revenue: taxData.revenue,
          deductible_expenses: taxData.deductions,
          business_mileage: taxData.mileage,
          taxable_profit: taxData.taxableProfit,
          estimated_tax: taxData.estimatedTax,
          net_after_tax: taxData.netAfterTax,
          receipts_count: taxData.receiptsCount,
          completed_loads: taxData.completedLoads,
          updated_at: now,
        },
        { onConflict: "freight_id,tax_year" }
      );

      if (error) throw error;

      Alert.alert("Saved", `${selectedYear} tax summary was saved.`);
    } catch (error: any) {
      Alert.alert(
        "Save Error",
        error?.message || "Unable to save tax summary. Make sure freight_tax_summaries table exists."
      );
    }
  }

  function renderExpense({ item }: { item: any }) {
    return (
      <View style={styles.expenseCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.expenseTitle}>{item.expense_type || "Expense"}</Text>
          <Text style={styles.expenseSub}>
            {item.vendor || "No vendor"} · {formatDate(item.expense_date || item.created_at)}
          </Text>
        </View>

        <Text style={styles.expenseAmount}>{money(item.amount)}</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <ActivityIndicator size="large" color={COLORS.red} />
        <Text style={styles.centerText}>Loading tax center...</Text>
      </SafeAreaView>
    );
  }

  const yearOptions = [currentTaxYear(), currentTaxYear() - 1, currentTaxYear() - 2];

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
            <Text style={styles.title}>Tax Center</Text>
            <Text style={styles.subtitle}>
              Track deductible expenses, revenue, mileage, receipts, estimated taxes, and yearly freight summaries.
            </Text>
          </View>

          <TouchableOpacity style={styles.heroIcon} onPress={() => goTo(FREIGHT_ROUTES.expenseCenter)}>
            <Ionicons name="document-text-outline" size={34} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.carrierCard}>
          <View style={styles.avatar}>
            <Ionicons name="business-outline" size={28} color="#FFFFFF" />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.carrierName}>{carrier?.companyName || "Freight Connect Carrier"}</Text>
            <Text style={styles.carrierEmail}>{carrier?.email || "Carrier workspace"}</Text>
          </View>
        </View>

        <View style={styles.yearCard}>
          <Text style={styles.cardTitle}>Tax Year</Text>

          <View style={styles.yearRow}>
            {yearOptions.map((year) => {
              const active = selectedYear === year;

              return (
                <TouchableOpacity
                  key={year}
                  style={[styles.yearButton, active && styles.yearButtonActive]}
                  onPress={() => setSelectedYear(year)}
                >
                  <Text style={[styles.yearText, active && styles.yearTextActive]}>{year}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.statsGrid}>
          <StatCard label="Revenue" value={money(taxData.revenue)} icon="cash-outline" />
          <StatCard label="Deductions" value={money(taxData.deductions)} icon="receipt-outline" />
          <StatCard label="Taxable Profit" value={money(taxData.taxableProfit)} icon="trending-up-outline" />
          <StatCard label="Est. Tax" value={money(taxData.estimatedTax)} icon="calculator-outline" />
          <StatCard label="Mileage" value={`${taxData.mileage.toFixed(0)} mi`} icon="speedometer-outline" />
          <StatCard label="Receipts" value={String(taxData.receiptsCount)} icon="document-attach-outline" />
        </View>

        <View style={styles.quickGrid}>
          <QuickLink icon="wallet-outline" label="Expenses" route={FREIGHT_ROUTES.expenseCenter} />
          <QuickLink icon="flame-outline" label="Fuel" route={FREIGHT_ROUTES.fuelTracker} />
          <QuickLink icon="construct-outline" label="Maintenance" route={FREIGHT_ROUTES.maintenanceTracker} />
          <QuickLink icon="cash-outline" label="Earnings" route={FREIGHT_ROUTES.earnings} />
          <QuickLink icon="trending-up-outline" label="Profitability" route={FREIGHT_ROUTES.profitabilityDashboard} />
          <QuickLink icon="business-outline" label="Payouts" route={FREIGHT_ROUTES.payoutCenter} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Deduction Breakdown</Text>

          <BreakdownRow label="Fuel" value={money(taxData.fuelTotal)} />
          <BreakdownRow label="Maintenance" value={money(taxData.maintenanceTotal)} />
          <BreakdownRow label="Insurance" value={money(taxData.insuranceTotal)} />
          <BreakdownRow label="Tolls / Parking" value={money(taxData.tollsParkingTotal)} />
          <BreakdownRow label="Subscriptions" value={money(taxData.subscriptionsTotal)} />
          <BreakdownRow label="Farm2Home Platform Fees" value={money(taxData.platformFees)} />
          <BreakdownRow label="Total Deductions" value={money(taxData.deductions)} />
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Tax Estimate</Text>
          <Text style={styles.noticeText}>
            This is a planning estimate only. Confirm deductions, mileage, receipts, and tax rules
            with a qualified tax professional before filing.
          </Text>

          <TouchableOpacity style={styles.syncButton} onPress={saveYearSummary}>
            <Ionicons name="save-outline" size={18} color="#FFFFFF" />
            <Text style={styles.primaryText}>Save Year Summary</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Year Summary</Text>

          <BreakdownRow label="Completed Loads" value={String(taxData.completedLoads)} />
          <BreakdownRow label="Gross Revenue" value={money(taxData.revenue)} />
          <BreakdownRow label="Deductible Expenses" value={money(taxData.deductions)} />
          <BreakdownRow label="Taxable Profit" value={money(taxData.taxableProfit)} />
          <BreakdownRow label="Estimated Tax Reserve 25%" value={money(taxData.estimatedTax)} />
          <BreakdownRow label="Estimated Net After Tax" value={money(taxData.netAfterTax)} />
        </View>

        <Text style={styles.sectionTitle}>Recent Deductible Expenses</Text>

        <FlatList
          data={expenses
            .filter((item) => yearOf(item.expense_date || item.created_at) === selectedYear)
            .slice(0, 8)}
          keyExtractor={(item, index) => String(item.id || index)}
          scrollEnabled={false}
          renderItem={renderExpense}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Ionicons name="receipt-outline" size={38} color={COLORS.red} />
              <Text style={styles.emptyTitle}>No expenses for {selectedYear}.</Text>
              <Text style={styles.emptyText}>
                Add deductible business expenses in Expense Center.
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
  carrierCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 16,
    marginHorizontal: 18,
    marginTop: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: COLORS.red,
    alignItems: "center",
    justifyContent: "center",
  },
  carrierName: { color: COLORS.text, fontSize: 19, fontWeight: "900" },
  carrierEmail: { color: COLORS.muted, fontWeight: "700", marginTop: 4 },
  yearCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 18,
    marginHorizontal: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTitle: { color: COLORS.text, fontSize: 21, fontWeight: "900", marginBottom: 12 },
  yearRow: { flexDirection: "row", gap: 8 },
  yearButton: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 13,
    alignItems: "center",
  },
  yearButtonActive: {
    backgroundColor: COLORS.red,
    borderColor: COLORS.red,
  },
  yearText: { color: COLORS.text, fontWeight: "900" },
  yearTextActive: { color: "#FFFFFF" },
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
  notice: {
    backgroundColor: COLORS.black,
    marginHorizontal: 18,
    marginBottom: 16,
    borderRadius: 22,
    padding: 18,
  },
  noticeTitle: { color: "#FFFFFF", fontSize: 21, fontWeight: "900", marginBottom: 7 },
  noticeText: { color: "#D1D5DB", fontWeight: "700", lineHeight: 22 },
  syncButton: {
    backgroundColor: COLORS.red,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 23,
    fontWeight: "900",
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  expenseCard: {
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
  expenseTitle: { color: COLORS.text, fontSize: 18, fontWeight: "900" },
  expenseSub: { color: COLORS.muted, fontWeight: "700", marginTop: 4 },
  expenseAmount: { color: COLORS.red, fontSize: 18, fontWeight: "900" },
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