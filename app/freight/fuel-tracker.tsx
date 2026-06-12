// app/freight/fuel-tracker.tsx

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
import * as DocumentPicker from "expo-document-picker";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../data/supabaseClient";

const FREIGHT_ROUTES = {
  managementCenter: "/freight/freight-management-center",
  costCalculator: "/freight/cost-calculator",
  rateOptimizer: "/freight/rate-optimizer",
  myLoads: "/freight/my-loads",
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

export default function FreightFuelTrackerScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [carrier, setCarrier] = useState<any>(null);

  const [fuelPrice, setFuelPrice] = useState("3.75");
  const [mpg, setMpg] = useState("14");
  const [routeMiles, setRouteMiles] = useState("250");
  const [deadheadMiles, setDeadheadMiles] = useState("25");
  const [gallonsPurchased, setGallonsPurchased] = useState("");
  const [receiptAmount, setReceiptAmount] = useState("");
  const [stationName, setStationName] = useState("");
  const [receiptUri, setReceiptUri] = useState("");
  const [includeDeadhead, setIncludeDeadhead] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadCarrier();
    }, [])
  );

  const calc = useMemo(() => {
    const price = Number(fuelPrice) || 0;
    const milesPerGallon = Number(mpg) || 1;
    const loaded = Number(routeMiles) || 0;
    const deadhead = includeDeadhead ? Number(deadheadMiles) || 0 : 0;
    const totalMiles = loaded + deadhead;

    const estimatedGallons = totalMiles / milesPerGallon;
    const estimatedFuelCost = estimatedGallons * price;
    const fuelCostPerMile = totalMiles > 0 ? estimatedFuelCost / totalMiles : 0;

    const actualGallons = Number(gallonsPurchased) || 0;
    const actualReceipt = Number(receiptAmount) || 0;
    const actualPricePerGallon = actualGallons > 0 ? actualReceipt / actualGallons : 0;

    return {
      totalMiles,
      estimatedGallons,
      estimatedFuelCost,
      fuelCostPerMile,
      actualPricePerGallon,
    };
  }, [fuelPrice, mpg, routeMiles, deadheadMiles, gallonsPurchased, receiptAmount, includeDeadhead]);

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

      if (error) console.log("Fuel tracker carrier error:", error.message);

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

      if (dbCarrier.default_fuel_price) setFuelPrice(String(dbCarrier.default_fuel_price));
      if (dbCarrier.default_mpg) setMpg(String(dbCarrier.default_mpg));
      if (dbCarrier.default_deadhead_miles) setDeadheadMiles(String(dbCarrier.default_deadhead_miles));
    } catch (error: any) {
      Alert.alert("Fuel Tracker Error", error?.message || "Unable to load fuel tracker.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadCarrier();
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
      Alert.alert("Receipt Added", result.assets[0].name || "Fuel receipt was selected.");
    } catch (error: any) {
      Alert.alert("Upload Error", error?.message || "Unable to select fuel receipt.");
    } finally {
      setUploading(false);
    }
  }

  async function saveFuelSettings() {
    if (!carrier?.id) {
      Alert.alert("Profile Missing", "Please log in again.");
      return;
    }

    try {
      setSaving(true);

      const now = new Date().toISOString();

      const payload = {
        default_fuel_price: Number(fuelPrice) || null,
        default_mpg: Number(mpg) || null,
        default_deadhead_miles: Number(deadheadMiles) || null,
        fuel_cost_per_mile: calc.fuelCostPerMile,
        fuel_settings_updated_at: now,
        updated_at: now,
      };

      const { error } = await supabase.from("freight_users").update(payload).eq("id", carrier.id);

      if (error) throw error;

      await persistCarrier({ ...carrier, ...payload });

      Alert.alert("Saved", "Fuel settings were saved for rate calculations.");
    } catch (error: any) {
      Alert.alert("Save Error", error?.message || "Unable to save fuel settings.");
    } finally {
      setSaving(false);
    }
  }

  async function saveFuelReceipt() {
    if (!carrier?.id) {
      Alert.alert("Profile Missing", "Please log in again.");
      return;
    }

    if (!receiptAmount.trim() && !gallonsPurchased.trim() && !receiptUri) {
      Alert.alert("Fuel Receipt Missing", "Enter receipt details or upload a receipt.");
      return;
    }

    try {
      setSaving(true);

      const now = new Date().toISOString();

      const { error } = await supabase.from("freight_fuel_receipts").insert({
        freight_id: carrier.id,
        carrier_id: carrier.id,
        station_name: stationName.trim() || null,
        gallons: Number(gallonsPurchased) || null,
        total_amount: Number(receiptAmount) || null,
        price_per_gallon: calc.actualPricePerGallon || Number(fuelPrice) || null,
        receipt_url: receiptUri || null,
        created_at: now,
        updated_at: now,
      });

      if (error) throw error;

      setStationName("");
      setGallonsPurchased("");
      setReceiptAmount("");
      setReceiptUri("");

      Alert.alert("Saved", "Fuel receipt was saved.");
    } catch (error: any) {
      Alert.alert(
        "Receipt Save Error",
        error?.message ||
          "Unable to save fuel receipt. Make sure the freight_fuel_receipts table exists."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <ActivityIndicator size="large" color={COLORS.red} />
        <Text style={styles.centerText}>Loading fuel tracker...</Text>
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
            <Text style={styles.title}>Fuel Tracker</Text>
            <Text style={styles.subtitle}>
              Track fuel price, MPG, receipts, fuel cost per mile, and route fuel estimates.
            </Text>
          </View>

          <TouchableOpacity style={styles.heroIcon} onPress={() => goTo(FREIGHT_ROUTES.costCalculator)}>
            <Ionicons name="flame-outline" size={34} color="#FFFFFF" />
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
          <StatCard label="Fuel Cost" value={money(calc.estimatedFuelCost)} icon="flame-outline" />
          <StatCard label="Gallons" value={calc.estimatedGallons.toFixed(1)} icon="water-outline" />
          <StatCard label="Fuel / Mile" value={money(calc.fuelCostPerMile)} icon="speedometer-outline" />
          <StatCard label="Total Miles" value={`${calc.totalMiles.toFixed(0)} mi`} icon="map-outline" />
        </View>

        <View style={styles.quickGrid}>
          <QuickLink icon="calculator-outline" label="Cost Calculator" route={FREIGHT_ROUTES.costCalculator} />
          <QuickLink icon="analytics-outline" label="Rate Optimizer" route={FREIGHT_ROUTES.rateOptimizer} />
          <QuickLink icon="briefcase-outline" label="My Loads" route={FREIGHT_ROUTES.myLoads} />
          <QuickLink icon="headset-outline" label="Support" route={FREIGHT_ROUTES.support} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Fuel Defaults</Text>

          <Input label="Fuel Price / Gallon" value={fuelPrice} onChangeText={setFuelPrice} />
          <Input label="Vehicle MPG" value={mpg} onChangeText={setMpg} />
          <Input label="Route Miles" value={routeMiles} onChangeText={setRouteMiles} />
          <Input label="Deadhead Miles" value={deadheadMiles} onChangeText={setDeadheadMiles} />

          <View style={styles.switchRow}>
            <Text style={styles.switchText}>Include deadhead miles</Text>
            <Switch
              value={includeDeadhead}
              onValueChange={setIncludeDeadhead}
              trackColor={{ false: "#CBD5E1", true: "#FCA5A5" }}
              thumbColor={includeDeadhead ? COLORS.red : "#FFFFFF"}
            />
          </View>

          <TouchableOpacity
            style={[styles.primaryButtonInner, saving && styles.disabledButton]}
            onPress={saveFuelSettings}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="save-outline" size={18} color="#FFFFFF" />
                <Text style={styles.primaryText}>Save Fuel Settings</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Fuel Receipt</Text>

          <Input label="Station Name" value={stationName} onChangeText={setStationName} numeric={false} />
          <Input label="Gallons Purchased" value={gallonsPurchased} onChangeText={setGallonsPurchased} />
          <Input label="Receipt Amount" value={receiptAmount} onChangeText={setReceiptAmount} />

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
                <Text style={styles.outlineText}>Upload Fuel Receipt</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryButtonInner, saving && styles.disabledButton]}
            onPress={saveFuelReceipt}
            disabled={saving}
          >
            <Ionicons name="receipt-outline" size={18} color="#FFFFFF" />
            <Text style={styles.primaryText}>Save Fuel Receipt</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Fuel Estimate</Text>

          <BreakdownRow label="Total Miles" value={`${calc.totalMiles.toFixed(0)} mi`} />
          <BreakdownRow label="Estimated Gallons" value={calc.estimatedGallons.toFixed(2)} />
          <BreakdownRow label="Estimated Fuel Cost" value={money(calc.estimatedFuelCost)} />
          <BreakdownRow label="Fuel Cost Per Mile" value={money(calc.fuelCostPerMile)} />
          <BreakdownRow
            label="Actual Receipt Price / Gallon"
            value={calc.actualPricePerGallon ? money(calc.actualPricePerGallon) : "Not entered"}
          />
        </View>

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
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  numeric?: boolean;
}) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        keyboardType={numeric ? "numeric" : "default"}
        placeholder={numeric ? "0.00" : label}
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
  disabledButton: { opacity: 0.6 },
  primaryText: { color: "#FFFFFF", fontWeight: "900" },
});