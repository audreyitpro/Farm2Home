// app/freight/report-export.tsx

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
  yearEndSummary: "/freight/year-end-summary",
  taxCenter: "/freight/tax-center",
  profitabilityDashboard: "/freight/profitability-dashboard",
  expenseCenter: "/freight/expense-center",
  earnings: "/freight/earnings",
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

export default function FreightReportExportScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [carrier, setCarrier] = useState<any>(null);
  const [loads, setLoads] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [fuelReceipts, setFuelReceipts] = useState<any[]>([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState<any[]>([]);
  const [selectedYear, setSelectedYear] = useState(currentYear());

  useFocusEffect(
    useCallback(() => {
      loadReportData();
    }, [])
  );

  const report = useMemo(() => {
    const yearLoads = loads.filter(
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

    const revenue = yearLoads.reduce(
      (sum, load) => sum + Number(load.rate || load.freight_total || load.total_due || 0),
      0
    );

    const mileage = yearLoads.reduce(
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

    const platformFees = revenue * 0.04;
    const deductions = expenseTotal + platformFees;
    const profit = revenue - deductions;
    const estimatedTax = Math.max(0, profit * 0.25);
    const receipts =
      yearExpenses.filter((x) => x.receipt_url).length +
      yearFuel.filter((x) => x.receipt_url).length +
      yearMaintenance.filter((x) => x.receipt_url).length;

    return {
      yearLoads,
      yearExpenses,
      yearFuel,
      yearMaintenance,
      revenue,
      mileage,
      expenseTotal,
      fuelTotal,
      maintenanceTotal,
      platformFees,
      deductions,
      profit,
      estimatedTax,
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

  async function loadReportData() {
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

      if (error) console.log("Report export carrier error:", error.message);

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
      Alert.alert("Report Error", error?.message || "Unable to load export report data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadReportData();
  }

  async function exportReport(reportType: string) {
    if (!carrier?.id) {
      Alert.alert("Profile Missing", "Please log in again.");
      return;
    }

    try {
      setExporting(true);

      const now = new Date().toISOString();

      const payload = {
        freight_id: carrier.id,
        carrier_id: carrier.id,
        report_type: reportType,
        report_year: selectedYear,
        gross_revenue: report.revenue,
        total_expenses: report.expenseTotal,
        fuel_total: report.fuelTotal,
        maintenance_total: report.maintenanceTotal,
        platform_fees: report.platformFees,
        deductions: report.deductions,
        profit: report.profit,
        estimated_tax: report.estimatedTax,
        mileage: report.mileage,
        completed_loads: report.yearLoads.length,
        expense_records: report.yearExpenses.length,
        receipt_count: report.receipts,
        status: "generated",
        generated_at: now,
        created_at: now,
        updated_at: now,
      };

      const { error } = await supabase.from("freight_report_exports").insert(payload);

      if (error) throw error;

      Alert.alert("Report Generated", `${reportType} report for ${selectedYear} was saved.`);
    } catch (error: any) {
      Alert.alert(
        "Export Error",
        error?.message ||
          "Unable to save report export. Make sure freight_report_exports table exists."
      );
    } finally {
      setExporting(false);
    }
  }

  function renderReportOption({ item }: { item: any }) {
    return (
      <TouchableOpacity
        style={styles.reportCard}
        onPress={() => exportReport(item.title)}
        disabled={exporting}
      >
        <View style={styles.reportIcon}>
          <Ionicons name={item.icon} size={24} color="#FFFFFF" />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.reportTitle}>{item.title}</Text>
          <Text style={styles.reportText}>{item.description}</Text>
        </View>

        <Ionicons name="download-outline" size={22} color={COLORS.red} />
      </TouchableOpacity>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <ActivityIndicator size="large" color={COLORS.red} />
        <Text style={styles.centerText}>Loading report export...</Text>
      </SafeAreaView>
    );
  }

  const years = [currentYear(), currentYear() - 1, currentYear() - 2];

  const reportOptions = [
    {
      title: "Year-End Summary",
      description: "Revenue, expenses, mileage, profit, deductions, and estimated tax.",
      icon: "calendar-outline" as keyof typeof Ionicons.glyphMap,
    },
    {
      title: "Tax Records",
      description: "Taxable profit, deductible expenses, receipts, and mileage totals.",
      icon: "document-text-outline" as keyof typeof Ionicons.glyphMap,
    },
    {
      title: "Expense Report",
      description: "Fuel, maintenance, insurance, tolls, parking, subscriptions, and repairs.",
      icon: "wallet-outline" as keyof typeof Ionicons.glyphMap,
    },
    {
      title: "Fuel Report",
      description: "Fuel receipts, gallons, fuel cost, and route fuel totals.",
      icon: "flame-outline" as keyof typeof Ionicons.glyphMap,
    },
    {
      title: "Maintenance Report",
      description: "Vehicle service, repair records, maintenance receipts, and cost totals.",
      icon: "construct-outline" as keyof typeof Ionicons.glyphMap,
    },
    {
      title: "Profitability Report",
      description: "Gross revenue, true expenses, net profit, margin, and profit per mile.",
      icon: "trending-up-outline" as keyof typeof Ionicons.glyphMap,
    },
  ];

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
            <Text style={styles.title}>Report Export</Text>
            <Text style={styles.subtitle}>
              Export yearly summaries, tax records, receipts, expenses, fuel, maintenance,
              and profitability reports for business records.
            </Text>
          </View>

          <TouchableOpacity style={styles.heroIcon} onPress={() => goTo(FREIGHT_ROUTES.taxCenter)}>
            <Ionicons name="download-outline" size={34} color="#FFFFFF" />
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
          <Text style={styles.cardTitle}>Report Year</Text>

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

        <View style={styles.statsGrid}>
          <StatCard label="Revenue" value={money(report.revenue)} icon="cash-outline" />
          <StatCard label="Expenses" value={money(report.expenseTotal)} icon="wallet-outline" />
          <StatCard label="Profit" value={money(report.profit)} icon="trending-up-outline" />
          <StatCard label="Mileage" value={`${report.mileage.toFixed(0)} mi`} icon="speedometer-outline" />
          <StatCard label="Loads" value={String(report.yearLoads.length)} icon="cube-outline" />
          <StatCard label="Receipts" value={String(report.receipts)} icon="document-attach-outline" />
        </View>

        <View style={styles.quickGrid}>
          <QuickLink icon="calendar-outline" label="Year-End" route={FREIGHT_ROUTES.yearEndSummary} />
          <QuickLink icon="document-text-outline" label="Tax Center" route={FREIGHT_ROUTES.taxCenter} />
          <QuickLink icon="trending-up-outline" label="Profitability" route={FREIGHT_ROUTES.profitabilityDashboard} />
          <QuickLink icon="wallet-outline" label="Expenses" route={FREIGHT_ROUTES.expenseCenter} />
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Export Notice</Text>
          <Text style={styles.noticeText}>
            This screen saves report export records in Supabase. PDF/CSV file generation can be
            connected later through backend export endpoints.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Available Reports</Text>

        <FlatList
          data={reportOptions}
          keyExtractor={(item) => item.title}
          scrollEnabled={false}
          renderItem={renderReportOption}
        />

        <TouchableOpacity style={styles.primaryButton} onPress={() => exportReport("Complete Business Report")}>
          {exporting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="download-outline" size={18} color="#FFFFFF" />
              <Text style={styles.primaryText}>Export Complete Business Report</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.darkButton} onPress={() => goTo(FREIGHT_ROUTES.managementCenter)}>
          <Ionicons name="apps-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryText}>Management Center</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
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
  notice: {
    backgroundColor: COLORS.black,
    marginHorizontal: 18,
    marginBottom: 16,
    borderRadius: 22,
    padding: 18,
  },
  noticeTitle: { color: "#FFFFFF", fontSize: 21, fontWeight: "900", marginBottom: 7 },
  noticeText: { color: "#D1D5DB", fontWeight: "700", lineHeight: 22 },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 23,
    fontWeight: "900",
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  reportCard: {
    backgroundColor: COLORS.card,
    marginHorizontal: 18,
    marginBottom: 14,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  reportIcon: {
    width: 48,
    height: 48,
    borderRadius: 18,
    backgroundColor: COLORS.red,
    alignItems: "center",
    justifyContent: "center",
  },
  reportTitle: { color: COLORS.text, fontSize: 18, fontWeight: "900" },
  reportText: { color: COLORS.muted, fontWeight: "700", lineHeight: 20, marginTop: 4 },
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