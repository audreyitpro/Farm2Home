// app/freight/year-end-summary.tsx

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
  taxCenter: "/freight/tax-center",
  profitabilityDashboard: "/freight/profitability-dashboard",
  expenseCenter: "/freight/expense-center",
  earnings: "/freight/earnings",
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

function currentYear() {
  return new Date().getFullYear();
}

function getYear(value?: string | null) {
  if (!value) return currentYear();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return currentYear();
  return date.getFullYear();
}

export default function FreightYearEndSummaryScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [carrier, setCarrier] = useState<any>(null);
  const [loads, setLoads] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [fuelReceipts, setFuelReceipts] = useState<any[]>([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState<any[]>([]);
  const [selectedYear, setSelectedYear] = useState(currentYear());

  useFocusEffect(
    useCallback(() => {
      loadSummary();
    }, [])
  );

  const summary = useMemo(() => {
    const completedLoads = loads.filter(
      (load) =>
        ["delivered", "completed"].includes(normalize(load.status)) &&
        getYear(load.delivered_at || load.updated_at || load.created_at) === selectedYear
    );

    const yearExpenses = expenses.filter(
      (item) => getYear(item.expense_date || item.created_at) === selectedYear
    );

    const yearFuel = fuelReceipts.filter((item) => getYear(item.created_at) === selectedYear);
    const yearMaintenance = maintenanceRecords.filter(
      (item) => getYear(item.created_at) === selectedYear
    );

    const revenue = completedLoads.reduce(
      (sum, load) => sum + Number(load.rate || load.freight_total || load.total_due || 0),
      0
    );

    const mileage = completedLoads.reduce(
      (sum, load) => sum + Number(load.distance_miles || load.miles || 0),
      0
    );

    const expenseTotal = yearExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);

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

    const platformFees = revenue * 0.04;
    const deductions = expenseTotal + platformFees;
    const profitBeforeTax = revenue - deductions;
    const estimatedTax = Math.max(0, profitBeforeTax * 0.25);
    const netAfterTax = profitBeforeTax - estimatedTax;
    const margin = revenue > 0 ? (profitBeforeTax / revenue) * 100 : 0;
    const revenuePerMile = mileage > 0 ? revenue / mileage : 0;
    const profitPerMile = mileage > 0 ? profitBeforeTax / mileage : 0;

    const receipts =
      yearExpenses.filter((x) => x.receipt_url).length +
      yearFuel.filter((x) => x.receipt_url).length +
      yearMaintenance.filter((x) => x.receipt_url).length;

    return {
      completedLoads,
      yearExpenses,
      revenue,
      mileage,
      expenseTotal,
      fuelTotal,
      maintenanceTotal,
      insuranceTotal,
      tollsParkingTotal,
      subscriptionsTotal,
      platformFees,
      deductions,
      profitBeforeTax,
      estimatedTax,
      netAfterTax,
      margin,
      revenuePerMile,
      profitPerMile,
      receipts,
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

  async function loadSummary() {
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

      if (error) console.log("Year-end carrier error:", error.message);

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
      Alert.alert("Summary Error", error?.message || "Unable to load year-end summary.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadSummary();
  }

  async function saveSummary() {
    if (!carrier?.id) {
      Alert.alert("Profile Missing", "Please log in again.");
      return;
    }

    try {
      setSaving(true);

      const now = new Date().toISOString();

      const { error } = await supabase.from("freight_year_end_summaries").upsert(
        {
          freight_id: carrier.id,
          carrier_id: carrier.id,
          summary_year: selectedYear,
          gross_revenue: summary.revenue,
          total_expenses: summary.expenseTotal,
          platform_fees: summary.platformFees,
          total_deductions: summary.deductions,
          profit_before_tax: summary.profitBeforeTax,
          estimated_tax: summary.estimatedTax,
          net_after_tax: summary.netAfterTax,
          business_mileage: summary.mileage,
          completed_loads: summary.completedLoads.length,
          receipts_count: summary.receipts,
          profit_margin: summary.margin,
          revenue_per_mile: summary.revenuePerMile,
          profit_per_mile: summary.profitPerMile,
          updated_at: now,
          created_at: now,
        },
        { onConflict: "freight_id,summary_year" }
      );

      if (error) throw error;

      Alert.alert("Saved", `${selectedYear} year-end summary was saved.`);
    } catch (error: any) {
      Alert.alert(
        "Save Error",
        error?.message ||
          "Unable to save year-end summary. Make sure freight_year_end_summaries table exists."
      );
    } finally {
      setSaving(false);
    }
  }

  function renderLoad({ item }: { item: any }) {
    const amount = Number(item.rate || item.freight_total || item.total_due || 0);
    const distance = Number(item.distance_miles || item.miles || 0);

    return (
      <View style={styles.itemCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.itemTitle}>{item.title || item.commodity || "Completed Load"}</Text>
          <Text style={styles.itemSub}>
            {item.pickup_location || "Pickup"} → {item.dropoff_location || "Dropoff"}
          </Text>
          <Text style={styles.itemMeta}>{distance.toFixed(0)} miles</Text>
        </View>

        <Text style={styles.itemAmount}>{money(amount)}</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <ActivityIndicator size="large" color={COLORS.red} />
        <Text style={styles.centerText}>Loading year-end summary...</Text>
      </SafeAreaView>
    );
  }

  const years = [currentYear(), currentYear() - 1, currentYear() - 2];

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
            <Text style={styles.title}>Year-End Summary</Text>
            <Text style={styles.subtitle}>
              Generate annual freight totals for revenue, expenses, mileage, receipts,
              profit, deductions, and estimated taxes.
            </Text>
          </View>

          <TouchableOpacity style={styles.heroIcon} onPress={() => goTo(FREIGHT_ROUTES.taxCenter)}>
            <Ionicons name="calendar-outline" size={34} color="#FFFFFF" />
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
          <Text style={styles.cardTitle}>Select Year</Text>

          <View style={styles.yearRow}>
            {years.map((year) => {
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

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>{selectedYear} Net After Tax Estimate</Text>
          <Text style={styles.summaryValue}>{money(summary.netAfterTax)}</Text>
          <Text style={styles.summarySub}>
            Profit before tax {money(summary.profitBeforeTax)} · Est. tax {money(summary.estimatedTax)}
          </Text>
        </View>

        <View style={styles.statsGrid}>
          <StatCard label="Revenue" value={money(summary.revenue)} icon="cash-outline" />
          <StatCard label="Deductions" value={money(summary.deductions)} icon="receipt-outline" />
          <StatCard label="Profit" value={money(summary.profitBeforeTax)} icon="trending-up-outline" />
          <StatCard label="Mileage" value={`${summary.mileage.toFixed(0)} mi`} icon="speedometer-outline" />
          <StatCard label="Loads" value={String(summary.completedLoads.length)} icon="cube-outline" />
          <StatCard label="Receipts" value={String(summary.receipts)} icon="document-attach-outline" />
        </View>

        <View style={styles.quickGrid}>
          <QuickLink icon="document-text-outline" label="Tax Center" route={FREIGHT_ROUTES.taxCenter} />
          <QuickLink icon="trending-up-outline" label="Profitability" route={FREIGHT_ROUTES.profitabilityDashboard} />
          <QuickLink icon="wallet-outline" label="Expenses" route={FREIGHT_ROUTES.expenseCenter} />
          <QuickLink icon="cash-outline" label="Earnings" route={FREIGHT_ROUTES.earnings} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Annual Breakdown</Text>

          <BreakdownRow label="Gross Revenue" value={money(summary.revenue)} />
          <BreakdownRow label="Fuel" value={money(summary.fuelTotal)} />
          <BreakdownRow label="Maintenance" value={money(summary.maintenanceTotal)} />
          <BreakdownRow label="Insurance" value={money(summary.insuranceTotal)} />
          <BreakdownRow label="Tolls / Parking" value={money(summary.tollsParkingTotal)} />
          <BreakdownRow label="Subscriptions" value={money(summary.subscriptionsTotal)} />
          <BreakdownRow label="Platform Fees" value={money(summary.platformFees)} />
          <BreakdownRow label="Total Deductions" value={money(summary.deductions)} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Performance Summary</Text>

          <BreakdownRow label="Profit Margin" value={`${summary.margin.toFixed(1)}%`} />
          <BreakdownRow label="Revenue Per Mile" value={money(summary.revenuePerMile)} />
          <BreakdownRow label="Profit Per Mile" value={money(summary.profitPerMile)} />
          <BreakdownRow label="Business Mileage" value={`${summary.mileage.toFixed(0)} mi`} />
          <BreakdownRow label="Completed Freight Loads" value={String(summary.completedLoads.length)} />
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Year-End Notice</Text>
          <Text style={styles.noticeText}>
            This summary is for planning and recordkeeping. Review numbers with a tax professional
            before filing business taxes.
          </Text>

          <TouchableOpacity
            style={[styles.syncButton, saving && styles.disabledButton]}
            onPress={saveSummary}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="save-outline" size={18} color="#FFFFFF" />
                <Text style={styles.primaryText}>Save Year-End Summary</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Completed Loads</Text>

        <FlatList
          data={summary.completedLoads.slice(0, 8)}
          keyExtractor={(item, index) => String(item.id || index)}
          scrollEnabled={false}
          renderItem={renderLoad}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Ionicons name="calendar-outline" size={38} color={COLORS.red} />
              <Text style={styles.emptyTitle}>No completed loads for {selectedYear}.</Text>
              <Text style={styles.emptyText}>
                Completed loads will appear here for year-end reporting.
              </Text>
            </View>
          }
        />

        <TouchableOpacity style={styles.primaryButton} onPress={() => goTo(FREIGHT_ROUTES.taxCenter)}>
          <Ionicons name="document-text-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryText}>Open Tax Center</Text>
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
  summaryCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 22,
    marginHorizontal: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryLabel: { color: COLORS.muted, fontWeight: "900", textTransform: "uppercase" },
  summaryValue: { color: COLORS.green, fontSize: 38, fontWeight: "900", marginTop: 6 },
  summarySub: { color: COLORS.text, fontWeight: "800", marginTop: 6 },
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
  itemCard: {
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
  itemTitle: { color: COLORS.text, fontSize: 18, fontWeight: "900" },
  itemSub: { color: COLORS.muted, fontWeight: "700", marginTop: 4 },
  itemMeta: { color: COLORS.text, fontWeight: "700", marginTop: 4 },
  itemAmount: { color: COLORS.red, fontSize: 18, fontWeight: "900" },
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
  disabledButton: { opacity: 0.6 },
  primaryText: { color: "#FFFFFF", fontWeight: "900" },
});