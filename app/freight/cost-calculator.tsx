// app/freight/cost-calculator.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../data/supabaseClient";

const FREIGHT_ROUTES = {
  managementCenter: "/freight/freight-management-center",
  board: "/freight/board",
  rateOptimizer: "/freight/rate-optimizer",
  loadRecommendations: "/freight/load-recommendations",
  aiLoadMatching: "/freight/ai-load-matching",
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

function money(value: number) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function goTo(route: string) {
  router.push(route as any);
}

export default function FreightCostCalculatorScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [carrier, setCarrier] = useState<any>(null);

  const [loadRate, setLoadRate] = useState("850");
  const [loadedMiles, setLoadedMiles] = useState("220");
  const [deadheadMiles, setDeadheadMiles] = useState("25");
  const [fuelPrice, setFuelPrice] = useState("3.75");
  const [mpg, setMpg] = useState("14");
  const [maintenancePerMile, setMaintenancePerMile] = useState("0.18");
  const [insurancePerMile, setInsurancePerMile] = useState("0.08");
  const [tollsParking, setTollsParking] = useState("0");
  const [driverPay, setDriverPay] = useState("0");
  const [platformFeePercent, setPlatformFeePercent] = useState("4");
  const [includeDeadhead, setIncludeDeadhead] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadCarrier();
    }, [])
  );

  const calc = useMemo(() => {
    const rate = Number(loadRate) || 0;
    const loaded = Number(loadedMiles) || 0;
    const deadhead = includeDeadhead ? Number(deadheadMiles) || 0 : 0;
    const totalMiles = loaded + deadhead;

    const fuel = Number(fuelPrice) || 0;
    const milesPerGallon = Number(mpg) || 1;

    const maintenance = Number(maintenancePerMile) || 0;
    const insurance = Number(insurancePerMile) || 0;
    const tolls = Number(tollsParking) || 0;
    const labor = Number(driverPay) || 0;
    const platformPercent = Number(platformFeePercent) || 0;

    const fuelCost = totalMiles > 0 ? (totalMiles / milesPerGallon) * fuel : 0;
    const maintenanceCost = totalMiles * maintenance;
    const insuranceCost = totalMiles * insurance;
    const platformFee = rate * (platformPercent / 100);
    const totalCost = fuelCost + maintenanceCost + insuranceCost + tolls + labor + platformFee;
    const profit = rate - totalCost;
    const rpmLoaded = loaded > 0 ? rate / loaded : 0;
    const rpmAllIn = totalMiles > 0 ? rate / totalMiles : 0;
    const costPerMile = totalMiles > 0 ? totalCost / totalMiles : 0;
    const profitPerMile = totalMiles > 0 ? profit / totalMiles : 0;
    const margin = rate > 0 ? (profit / rate) * 100 : 0;

    let decision = "Review";
    let color = COLORS.amber;

    if (profit > 150 && profitPerMile >= 0.75 && margin >= 20) {
      decision = "Profitable";
      color = COLORS.green;
    } else if (profit < 50 || profitPerMile < 0.25 || margin < 8) {
      decision = "Low Profit";
      color = COLORS.red;
    }

    return {
      rate,
      loaded,
      deadhead,
      totalMiles,
      fuelCost,
      maintenanceCost,
      insuranceCost,
      platformFee,
      tolls,
      labor,
      totalCost,
      profit,
      rpmLoaded,
      rpmAllIn,
      costPerMile,
      profitPerMile,
      margin,
      decision,
      color,
    };
  }, [
    loadRate,
    loadedMiles,
    deadheadMiles,
    fuelPrice,
    mpg,
    maintenancePerMile,
    insurancePerMile,
    tollsParking,
    driverPay,
    platformFeePercent,
    includeDeadhead,
  ]);

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

  async function loadCarrier() {
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

      if (error) console.log("Cost calculator carrier error:", error.message);

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

      if (dbCarrier.default_mpg) setMpg(String(dbCarrier.default_mpg));
      if (dbCarrier.default_fuel_price) setFuelPrice(String(dbCarrier.default_fuel_price));
      if (dbCarrier.maintenance_per_mile) setMaintenancePerMile(String(dbCarrier.maintenance_per_mile));
      if (dbCarrier.insurance_per_mile) setInsurancePerMile(String(dbCarrier.insurance_per_mile));
    } catch (error: any) {
      Alert.alert("Calculator Error", error?.message || "Unable to load cost calculator.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadCarrier();
  }

  async function saveDefaults() {
    if (!carrier?.id) {
      Alert.alert("Profile Missing", "Please log in again.");
      return;
    }

    try {
      const { error } = await supabase
        .from("freight_users")
        .update({
          default_mpg: Number(mpg) || null,
          default_fuel_price: Number(fuelPrice) || null,
          maintenance_per_mile: Number(maintenancePerMile) || null,
          insurance_per_mile: Number(insurancePerMile) || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", carrier.id);

      if (error) throw error;

      Alert.alert("Saved", "Default cost settings were saved.");
    } catch (error: any) {
      Alert.alert("Save Error", error?.message || "Unable to save cost defaults.");
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <ActivityIndicator size="large" color={COLORS.red} />
        <Text style={styles.centerText}>Loading cost calculator...</Text>
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
            <Text style={styles.title}>Cost Calculator</Text>
            <Text style={styles.subtitle}>
              Estimate fuel cost, operating cost, rate per mile, profit, and margin before accepting a load.
            </Text>
          </View>

          <TouchableOpacity style={styles.heroIcon} onPress={() => goTo(FREIGHT_ROUTES.rateOptimizer)}>
            <Ionicons name="calculator-outline" size={34} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.carrierCard}>
          <View style={styles.avatar}>
            <Ionicons name="business-outline" size={28} color="#FFFFFF" />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.carrierName}>{carrier?.companyName || "Freight Connect Carrier"}</Text>
            <Text style={styles.carrierEmail}>{carrier?.email || "Carrier workspace"}</Text>

            <View style={[styles.statusPill, { backgroundColor: calc.color }]}>
              <Text style={styles.statusPillText}>{calc.decision}</Text>
            </View>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <StatCard label="Revenue" value={money(calc.rate)} icon="cash-outline" />
          <StatCard label="Total Cost" value={money(calc.totalCost)} icon="receipt-outline" />
          <StatCard label="Profit" value={money(calc.profit)} icon="trending-up-outline" />
          <StatCard label="Margin" value={`${calc.margin.toFixed(1)}%`} icon="pie-chart-outline" />
          <StatCard label="Rate/Mile" value={money(calc.rpmAllIn)} icon="speedometer-outline" />
          <StatCard label="Profit/Mile" value={money(calc.profitPerMile)} icon="analytics-outline" />
        </View>

        <View style={styles.quickGrid}>
          <QuickLink icon="analytics-outline" label="Rate Optimizer" route={FREIGHT_ROUTES.rateOptimizer} />
          <QuickLink icon="thumbs-up-outline" label="Recommendations" route={FREIGHT_ROUTES.loadRecommendations} />
          <QuickLink icon="sparkles-outline" label="AI Matching" route={FREIGHT_ROUTES.aiLoadMatching} />
          <QuickLink icon="list-outline" label="Load Board" route={FREIGHT_ROUTES.board} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Load Details</Text>

          <Input label="Load Rate" value={loadRate} onChangeText={setLoadRate} />
          <Input label="Loaded Miles" value={loadedMiles} onChangeText={setLoadedMiles} />
          <Input label="Deadhead Miles" value={deadheadMiles} onChangeText={setDeadheadMiles} />

          <View style={styles.switchRow}>
            <Text style={styles.switchText}>Include deadhead miles in cost</Text>
            <Switch
              value={includeDeadhead}
              onValueChange={setIncludeDeadhead}
              trackColor={{ false: "#CBD5E1", true: "#FCA5A5" }}
              thumbColor={includeDeadhead ? COLORS.red : "#FFFFFF"}
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Operating Costs</Text>

          <Input label="Fuel Price / Gallon" value={fuelPrice} onChangeText={setFuelPrice} />
          <Input label="Miles Per Gallon" value={mpg} onChangeText={setMpg} />
          <Input label="Maintenance Cost / Mile" value={maintenancePerMile} onChangeText={setMaintenancePerMile} />
          <Input label="Insurance Cost / Mile" value={insurancePerMile} onChangeText={setInsurancePerMile} />
          <Input label="Tolls / Parking / Misc" value={tollsParking} onChangeText={setTollsParking} />
          <Input label="Driver Pay / Labor" value={driverPay} onChangeText={setDriverPay} />
          <Input label="Farm2Home Platform Fee %" value={platformFeePercent} onChangeText={setPlatformFeePercent} />

          <TouchableOpacity style={styles.outlineButton} onPress={saveDefaults}>
            <Ionicons name="save-outline" size={18} color={COLORS.red} />
            <Text style={styles.outlineText}>Save Default Cost Settings</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Cost Breakdown</Text>

          <BreakdownRow label="Fuel Cost" value={money(calc.fuelCost)} />
          <BreakdownRow label="Maintenance Cost" value={money(calc.maintenanceCost)} />
          <BreakdownRow label="Insurance Cost" value={money(calc.insuranceCost)} />
          <BreakdownRow label="Platform Fee" value={money(calc.platformFee)} />
          <BreakdownRow label="Tolls / Parking / Misc" value={money(calc.tolls)} />
          <BreakdownRow label="Driver Pay / Labor" value={money(calc.labor)} />
          <BreakdownRow label="Total Miles" value={`${calc.totalMiles.toFixed(0)} mi`} />
          <BreakdownRow label="Cost Per Mile" value={money(calc.costPerMile)} />
        </View>

        <View style={[styles.decisionCard, { borderColor: calc.color }]}>
          <Text style={[styles.decisionTitle, { color: calc.color }]}>
            {calc.decision}
          </Text>
          <Text style={styles.decisionText}>
            {calc.decision === "Profitable"
              ? "This load appears profitable based on your current cost settings."
              : calc.decision === "Low Profit"
              ? "This load may not generate enough profit after estimated operating costs."
              : "Review this load carefully before accepting."}
          </Text>
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={() => goTo(FREIGHT_ROUTES.rateOptimizer)}>
          <Ionicons name="analytics-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryText}>Open Rate Optimizer</Text>
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
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        keyboardType="numeric"
        placeholder="0.00"
        placeholderTextColor="#94A3B8"
      />
    </>
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
  statusPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 9,
  },
  statusPillText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
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
  switchRow: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 13,
    marginTop: 4,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  switchText: { color: COLORS.text, fontWeight: "900", flex: 1, lineHeight: 20 },
  outlineButton: {
    backgroundColor: "#FFF1F2",
    borderWidth: 1,
    borderColor: COLORS.red,
    borderRadius: 14,
    padding: 14,
    marginTop: 6,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  outlineText: { color: COLORS.red, fontWeight: "900" },
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
  decisionCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 18,
    marginHorizontal: 18,
    marginBottom: 16,
    borderWidth: 2,
  },
  decisionTitle: { fontSize: 24, fontWeight: "900", marginBottom: 8 },
  decisionText: { color: COLORS.text, fontWeight: "700", lineHeight: 22 },
  primaryButton: {
    backgroundColor: COLORS.red,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 18,
    marginTop: 4,
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