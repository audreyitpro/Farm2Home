// app/freight/expense-center.tsx

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
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../data/supabaseClient";

const FREIGHT_ROUTES = {
  managementCenter: "/freight/freight-management-center",
  costCalculator: "/freight/cost-calculator",
  rateOptimizer: "/freight/rate-optimizer",
  fuelTracker: "/freight/fuel-tracker",
  maintenanceTracker: "/freight/maintenance-tracker",
  earnings: "/freight/earnings",
  support: "/freight/support",
  login: "/freight/login",
  register: "/freight/register",
} as const;

const EXPENSE_TYPES = [
  "Fuel",
  "Maintenance",
  "Insurance",
  "Tolls",
  "Parking",
  "Subscription",
  "Repairs",
  "Supplies",
  "Permits",
  "Other",
];

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

function formatDate(value?: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString();
}

export default function FreightExpenseCenterScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [carrier, setCarrier] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);

  const [expenseType, setExpenseType] = useState("Fuel");
  const [amount, setAmount] = useState("");
  const [vendor, setVendor] = useState("");
  const [expenseDate, setExpenseDate] = useState("");
  const [notes, setNotes] = useState("");
  const [receiptUri, setReceiptUri] = useState("");

  useFocusEffect(
    useCallback(() => {
      loadExpenses();
    }, [])
  );

  const stats = useMemo(() => {
    const total = expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const fuel = expenses
      .filter((item) => normalize(item.expense_type) === "fuel")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const maintenance = expenses
      .filter((item) => normalize(item.expense_type) === "maintenance")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const insurance = expenses
      .filter((item) => normalize(item.expense_type) === "insurance")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    return {
      count: expenses.length,
      total,
      fuel,
      maintenance,
      insurance,
      other: total - fuel - maintenance - insurance,
    };
  }, [expenses]);

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
  }

  async function loadExpenses() {
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

      if (error) console.log("Expense center carrier error:", error.message);

      if (!dbCarrier) {
        Alert.alert("Freight Profile Missing", "Please complete freight registration first.");
        router.replace(FREIGHT_ROUTES.register as any);
        return;
      }

      await persistCarrier({
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

      const { data, error: expenseError } = await supabase
        .from("freight_expenses")
        .select("*")
        .eq("freight_id", dbCarrier.id)
        .order("expense_date", { ascending: false });

      if (expenseError) {
        console.log("Expense records error:", expenseError.message);
        setExpenses([]);
      } else {
        setExpenses(Array.isArray(data) ? data : []);
      }
    } catch (error: any) {
      Alert.alert("Expense Error", error?.message || "Unable to load expense center.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadExpenses();
  }

  async function uploadReceipt() {
    try {
      setUploading(true);

      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets?.[0]) return;

      setReceiptUri(result.assets[0].uri);
      Alert.alert("Receipt Added", result.assets[0].name || "Expense receipt selected.");
    } catch (error: any) {
      Alert.alert("Upload Error", error?.message || "Unable to select receipt.");
    } finally {
      setUploading(false);
    }
  }

  async function saveExpense() {
    if (!carrier?.id) {
      Alert.alert("Profile Missing", "Please log in again.");
      return;
    }

    if (!amount.trim()) {
      Alert.alert("Amount Required", "Enter the expense amount.");
      return;
    }

    try {
      setSaving(true);

      const now = new Date().toISOString();

      const { error } = await supabase.from("freight_expenses").insert({
        freight_id: carrier.id,
        carrier_id: carrier.id,
        expense_type: expenseType,
        amount: Number(amount) || 0,
        vendor: vendor.trim() || null,
        expense_date: expenseDate.trim() || now,
        notes: notes.trim() || null,
        receipt_url: receiptUri || null,
        created_at: now,
        updated_at: now,
      });

      if (error) throw error;

      setAmount("");
      setVendor("");
      setExpenseDate("");
      setNotes("");
      setReceiptUri("");

      Alert.alert("Saved", "Expense was added.");
      await loadExpenses();
    } catch (error: any) {
      Alert.alert(
        "Save Error",
        error?.message || "Unable to save expense. Make sure the freight_expenses table exists."
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveExpenseTotalsToProfile() {
    if (!carrier?.id) {
      Alert.alert("Profile Missing", "Please log in again.");
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase
        .from("freight_users")
        .update({
          expense_total_lifetime: stats.total,
          expense_fuel_total: stats.fuel,
          expense_maintenance_total: stats.maintenance,
          expense_insurance_total: stats.insurance,
          expense_other_total: stats.other,
          expenses_updated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", carrier.id);

      if (error) throw error;

      Alert.alert("Synced", "Expense totals were saved to your freight profile.");
    } catch (error: any) {
      Alert.alert("Sync Error", error?.message || "Unable to sync expense totals.");
    } finally {
      setSaving(false);
    }
  }

  function renderExpense({ item }: { item: any }) {
    return (
      <View style={styles.expenseCard}>
        <View style={styles.expenseTop}>
          <View style={styles.expenseIcon}>
            <Ionicons name="receipt-outline" size={20} color="#FFFFFF" />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.expenseTitle}>{item.expense_type || "Expense"}</Text>
            <Text style={styles.expenseSub}>
              {item.vendor || "No vendor"} · {formatDate(item.expense_date || item.created_at)}
            </Text>
          </View>

          <Text style={styles.expenseAmount}>{money(item.amount)}</Text>
        </View>

        {!!item.notes && <Text style={styles.expenseNotes}>{item.notes}</Text>}

        {!!item.receipt_url && (
          <View style={styles.receiptLine}>
            <Ionicons name="document-text-outline" size={18} color={COLORS.green} />
            <Text style={styles.receiptLineText}>Receipt attached</Text>
          </View>
        )}
      </View>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <ActivityIndicator size="large" color={COLORS.red} />
        <Text style={styles.centerText}>Loading expense center...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>Farm2Home Freight Connect</Text>
            <Text style={styles.title}>Expense Center</Text>
            <Text style={styles.subtitle}>
              Track fuel, maintenance, insurance, tolls, parking, subscriptions, repairs,
              and business expenses for rate and profit calculations.
            </Text>
          </View>

          <TouchableOpacity style={styles.heroIcon} onPress={() => goTo(FREIGHT_ROUTES.costCalculator)}>
            <Ionicons name="wallet-outline" size={34} color="#FFFFFF" />
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

        <View style={styles.statsGrid}>
          <StatCard label="Total Expenses" value={money(stats.total)} icon="wallet-outline" />
          <StatCard label="Fuel" value={money(stats.fuel)} icon="flame-outline" />
          <StatCard label="Maintenance" value={money(stats.maintenance)} icon="construct-outline" />
          <StatCard label="Insurance" value={money(stats.insurance)} icon="shield-checkmark-outline" />
          <StatCard label="Other" value={money(stats.other)} icon="receipt-outline" />
          <StatCard label="Records" value={String(stats.count)} icon="list-outline" />
        </View>

        <View style={styles.quickGrid}>
          <QuickLink icon="flame-outline" label="Fuel Tracker" route={FREIGHT_ROUTES.fuelTracker} />
          <QuickLink icon="construct-outline" label="Maintenance" route={FREIGHT_ROUTES.maintenanceTracker} />
          <QuickLink icon="calculator-outline" label="Calculator" route={FREIGHT_ROUTES.costCalculator} />
          <QuickLink icon="analytics-outline" label="Optimizer" route={FREIGHT_ROUTES.rateOptimizer} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Add Expense</Text>

          <Text style={styles.label}>Expense Type</Text>
          <View style={styles.optionGrid}>
            {EXPENSE_TYPES.map((type) => {
              const active = expenseType === type;

              return (
                <TouchableOpacity
                  key={type}
                  style={[styles.optionButton, active && styles.optionButtonActive]}
                  onPress={() => setExpenseType(type)}
                >
                  <Text style={[styles.optionText, active && styles.optionTextActive]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Input label="Amount" value={amount} onChangeText={setAmount} />
          <Input label="Vendor" value={vendor} onChangeText={setVendor} numeric={false} />
          <Input
            label="Expense Date"
            value={expenseDate}
            onChangeText={setExpenseDate}
            numeric={false}
            placeholder="YYYY-MM-DD"
          />
          <Input
            label="Notes"
            value={notes}
            onChangeText={setNotes}
            numeric={false}
            multiline
            placeholder="Optional notes"
          />

          <View style={styles.receiptBox}>
            <Ionicons
              name={receiptUri ? "document-text-outline" : "document-outline"}
              size={22}
              color={receiptUri ? COLORS.green : COLORS.amber}
            />
            <Text style={styles.receiptText}>
              {receiptUri ? "Receipt selected" : "No receipt selected"}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.outlineButton, uploading && styles.disabledButton]}
            onPress={uploadReceipt}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator color={COLORS.red} />
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={18} color={COLORS.red} />
                <Text style={styles.outlineText}>Upload Receipt</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryButtonInner, saving && styles.disabledButton]}
            onPress={saveExpense}
            disabled={saving}
          >
            <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
            <Text style={styles.primaryText}>Add Expense</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Profit Calculation</Text>
          <Text style={styles.noticeText}>
            Sync totals to your freight profile so future cost calculators, rate optimizer,
            and profitability screens can use updated business expense data.
          </Text>

          <TouchableOpacity
            style={[styles.syncButton, saving && styles.disabledButton]}
            onPress={saveExpenseTotalsToProfile}
            disabled={saving}
          >
            <Ionicons name="sync-outline" size={18} color="#FFFFFF" />
            <Text style={styles.primaryText}>Sync Expense Totals</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Expense History</Text>

        <FlatList
          data={expenses}
          keyExtractor={(item, index) => String(item.id || index)}
          scrollEnabled={false}
          renderItem={renderExpense}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Ionicons name="wallet-outline" size={38} color={COLORS.red} />
              <Text style={styles.emptyTitle}>No expenses yet.</Text>
              <Text style={styles.emptyText}>
                Add fuel, maintenance, tolls, insurance, repairs, and business expenses here.
              </Text>
            </View>
          }
        />

        <TouchableOpacity style={styles.primaryButton} onPress={() => goTo(FREIGHT_ROUTES.costCalculator)}>
          <Ionicons name="calculator-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryText}>Open Cost Calculator</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.darkButton} onPress={() => goTo(FREIGHT_ROUTES.managementCenter)}>
          <Ionicons name="apps-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryText}>Management Center</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Input({
  label,
  value,
  onChangeText,
  numeric = true,
  placeholder = "0.00",
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  numeric?: boolean;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.textArea]}
        value={value}
        onChangeText={onChangeText}
        keyboardType={numeric ? "numeric" : "default"}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
      />
    </>
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
    alignItems: "flex-start",
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
  statValue: { color: COLORS.text, fontSize: 22, fontWeight: "900", marginTop: 7 },
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
  optionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  optionButton: {
    width: "48%",
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  optionButtonActive: {
    backgroundColor: COLORS.red,
    borderColor: COLORS.red,
  },
  optionText: { color: COLORS.text, fontWeight: "900", textAlign: "center" },
  optionTextActive: { color: "#FFFFFF" },
  label: { color: COLORS.text, fontWeight: "900", marginBottom: 7, marginTop: 8 },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 14,
    color: COLORS.text,
    fontWeight: "700",
    marginBottom: 12,
  },
  textArea: { minHeight: 90 },
  receiptBox: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 13,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  receiptText: { color: COLORS.text, fontWeight: "900" },
  outlineButton: {
    backgroundColor: "#FFF1F2",
    borderWidth: 1,
    borderColor: COLORS.red,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  outlineText: { color: COLORS.red, fontWeight: "900" },
  primaryButtonInner: {
    backgroundColor: COLORS.red,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
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
  },
  expenseTop: { flexDirection: "row", gap: 12, alignItems: "center" },
  expenseIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: COLORS.red,
    alignItems: "center",
    justifyContent: "center",
  },
  expenseTitle: { color: COLORS.text, fontSize: 18, fontWeight: "900" },
  expenseSub: { color: COLORS.muted, fontWeight: "700", marginTop: 4 },
  expenseAmount: { color: COLORS.red, fontSize: 18, fontWeight: "900" },
  expenseNotes: { color: COLORS.text, fontWeight: "700", lineHeight: 20, marginTop: 10 },
  receiptLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  receiptLineText: { color: COLORS.green, fontWeight: "900" },
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