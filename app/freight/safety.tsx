// app/freight/safety.tsx

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
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../data/supabaseClient";

const FREIGHT_ROUTES = {
  dashboard: "/freight/dashboard",
  managementCenter: "/freight/freight-management-center",
  compliance: "/freight/compliance",
  legal: "/freight/legal",
  equipment: "/freight/equipment",
  insurance: "/freight/insurance",
  documents: "/freight/documents",
  support: "/freight/support",
  help: "/freight/help",
  login: "/freight/login",
  register: "/freight/register",
} as const;

type FreightRoute = (typeof FREIGHT_ROUTES)[keyof typeof FREIGHT_ROUTES];

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

function goTo(route: FreightRoute) {
  router.push(route as any);
}

export default function FreightSafetyScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [carrier, setCarrier] = useState<any>(null);

  const [vehicleConditionConfirmed, setVehicleConditionConfirmed] = useState(false);
  const [loadSecurementConfirmed, setLoadSecurementConfirmed] = useState(false);
  const [coldChainConfirmed, setColdChainConfirmed] = useState(false);
  const [livestockSafetyConfirmed, setLivestockSafetyConfirmed] = useState(false);
  const [routeSafetyConfirmed, setRouteSafetyConfirmed] = useState(false);
  const [incidentReportingConfirmed, setIncidentReportingConfirmed] = useState(false);
  const [foodHandlingConfirmed, setFoodHandlingConfirmed] = useState(false);
  const [safetyTermsConfirmed, setSafetyTermsConfirmed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadSafety();
    }, [])
  );

  const complete = useMemo(() => {
    return (
      vehicleConditionConfirmed &&
      loadSecurementConfirmed &&
      coldChainConfirmed &&
      livestockSafetyConfirmed &&
      routeSafetyConfirmed &&
      incidentReportingConfirmed &&
      foodHandlingConfirmed &&
      safetyTermsConfirmed
    );
  }, [
    vehicleConditionConfirmed,
    loadSecurementConfirmed,
    coldChainConfirmed,
    livestockSafetyConfirmed,
    routeSafetyConfirmed,
    incidentReportingConfirmed,
    foodHandlingConfirmed,
    safetyTermsConfirmed,
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
      businessName:
        nextCarrier.businessName ||
        nextCarrier.companyName ||
        nextCarrier.business_name ||
        nextCarrier.company_name ||
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

  async function loadSafety() {
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

      if (error) console.log("Freight safety profile error:", error.message);

      if (!dbCarrier) {
        Alert.alert(
          "Freight Profile Missing",
          "No freight profile was found. Please complete freight registration first."
        );
        router.replace(FREIGHT_ROUTES.register as any);
        return;
      }

      const mergedCarrier = {
        ...(stored || {}),
        ...(dbCarrier || {}),
        id: dbCarrier.id,
        freightId: dbCarrier.id,
        role: "freight",
        email: normalize(dbCarrier.email || email),
        companyName:
          dbCarrier.company_name ||
          dbCarrier.business_name ||
          stored?.companyName ||
          stored?.businessName ||
          "Freight Connect Carrier",
        businessName:
          dbCarrier.business_name ||
          dbCarrier.company_name ||
          stored?.businessName ||
          stored?.companyName ||
          "Freight Connect Carrier",
      };

      await persistCarrier(mergedCarrier);

      setVehicleConditionConfirmed(Boolean(dbCarrier.vehicle_condition_confirmed));
      setLoadSecurementConfirmed(Boolean(dbCarrier.load_securement_confirmed));
      setColdChainConfirmed(Boolean(dbCarrier.cold_chain_safety_confirmed));
      setLivestockSafetyConfirmed(Boolean(dbCarrier.livestock_safety_confirmed));
      setRouteSafetyConfirmed(Boolean(dbCarrier.route_safety_confirmed));
      setIncidentReportingConfirmed(Boolean(dbCarrier.incident_reporting_confirmed));
      setFoodHandlingConfirmed(Boolean(dbCarrier.food_handling_confirmed));
      setSafetyTermsConfirmed(Boolean(dbCarrier.safety_confirmed));
    } catch (error: any) {
      Alert.alert("Safety Error", error?.message || "Unable to load freight safety.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadSafety();
  }

  async function saveSafety() {
    if (!carrier?.id) {
      Alert.alert("Profile Missing", "Please log in again.");
      router.replace(FREIGHT_ROUTES.login as any);
      return;
    }

    if (!complete) {
      Alert.alert(
        "Safety Confirmation Required",
        "Please review and confirm all freight safety requirements."
      );
      return;
    }

    try {
      setSaving(true);

      const now = new Date().toISOString();

      const payload = {
        vehicle_condition_confirmed: vehicleConditionConfirmed,
        load_securement_confirmed: loadSecurementConfirmed,
        cold_chain_safety_confirmed: coldChainConfirmed,
        livestock_safety_confirmed: livestockSafetyConfirmed,
        route_safety_confirmed: routeSafetyConfirmed,
        incident_reporting_confirmed: incidentReportingConfirmed,
        food_handling_confirmed: foodHandlingConfirmed,
        safety_confirmed: safetyTermsConfirmed,
        safety_status: "complete",
        safety_confirmed_at: now,
        updated_at: now,
      };

      const { error } = await supabase
        .from("freight_users")
        .update(payload)
        .eq("id", carrier.id);

      if (error) throw error;

      await persistCarrier({
        ...carrier,
        ...payload,
      });

      Alert.alert("Saved", "Freight safety requirements have been saved.", [
        {
          text: "Compliance",
          onPress: () => router.replace(FREIGHT_ROUTES.compliance as any),
        },
      ]);
    } catch (error: any) {
      Alert.alert("Save Error", error?.message || "Unable to save freight safety.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <ActivityIndicator size="large" color={COLORS.red} />
        <Text style={styles.centerText}>Loading freight safety...</Text>
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
            <Text style={styles.title}>Safety</Text>
            <Text style={styles.subtitle}>
              Confirm route safety, vehicle readiness, cold-chain handling, livestock safety,
              food handling, and incident reporting responsibilities.
            </Text>
          </View>

          <TouchableOpacity style={styles.heroIcon} onPress={() => goTo(FREIGHT_ROUTES.compliance)}>
            <Ionicons name="shield-checkmark-outline" size={34} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.carrierCard}>
          <View style={styles.avatar}>
            <Ionicons name="business-outline" size={28} color="#FFFFFF" />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.carrierName}>{carrier?.companyName || "Freight Connect Carrier"}</Text>
            <Text style={styles.carrierEmail}>{carrier?.email || "Carrier workspace"}</Text>

            <View style={[styles.statusPill, { backgroundColor: complete ? COLORS.green : COLORS.amber }]}>
              <Text style={styles.statusPillText}>
                {complete ? "Safety Complete" : "Action Required"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.quickGrid}>
          <QuickLink icon="shield-checkmark-outline" label="Compliance" route={FREIGHT_ROUTES.compliance} />
          <QuickLink icon="document-text-outline" label="Legal" route={FREIGHT_ROUTES.legal} />
          <QuickLink icon="car-outline" label="Equipment" route={FREIGHT_ROUTES.equipment} />
          <QuickLink icon="headset-outline" label="Support" route={FREIGHT_ROUTES.support} />
        </View>

        <SafetySection
          icon="car-outline"
          title="Vehicle & Load Readiness"
          subtitle="Confirm safe vehicle condition and load securement."
        >
          <SwitchRow
            label="Vehicle is clean, roadworthy, maintained, and safe for freight movement."
            value={vehicleConditionConfirmed}
            onChange={setVehicleConditionConfirmed}
          />

          <SwitchRow
            label="I understand load securement, weight limits, and safe loading requirements."
            value={loadSecurementConfirmed}
            onChange={setLoadSecurementConfirmed}
          />
        </SafetySection>

        <SafetySection
          icon="snow-outline"
          title="Cold-Chain & Fresh Food Safety"
          subtitle="Confirm safe handling for produce, refrigerated, and fresh food freight."
        >
          <SwitchRow
            label="I understand cold-chain loads must remain within the required temperature range."
            value={coldChainConfirmed}
            onChange={setColdChainConfirmed}
          />

          <SwitchRow
            label="I understand produce and food freight must be handled cleanly and safely."
            value={foodHandlingConfirmed}
            onChange={setFoodHandlingConfirmed}
          />
        </SafetySection>

        <SafetySection
          icon="paw-outline"
          title="Livestock & Farm Bulk Safety"
          subtitle="Confirm livestock and bulk farm load requirements."
        >
          <SwitchRow
            label="I will only accept livestock or farm bulk loads when properly equipped and legally able."
            value={livestockSafetyConfirmed}
            onChange={setLivestockSafetyConfirmed}
          />
        </SafetySection>

        <SafetySection
          icon="navigate-outline"
          title="Route Safety"
          subtitle="Confirm route planning, delays, and incident handling."
        >
          <SwitchRow
            label="I will follow safe routes, communicate delays, and avoid unsafe delivery conditions."
            value={routeSafetyConfirmed}
            onChange={setRouteSafetyConfirmed}
          />

          <SwitchRow
            label="I will report accidents, damaged goods, rejected loads, shortages, or safety issues immediately."
            value={incidentReportingConfirmed}
            onChange={setIncidentReportingConfirmed}
          />
        </SafetySection>

        <View style={styles.acceptCard}>
          <Text style={styles.acceptTitle}>Final Safety Confirmation</Text>
          <Text style={styles.acceptText}>
            Confirm you understand and accept Farm2Home freight safety responsibilities.
          </Text>

          <SwitchRow
            label="I accept and agree to follow all freight safety requirements."
            value={safetyTermsConfirmed}
            onChange={setSafetyTermsConfirmed}
            dark
          />

          <TouchableOpacity
            style={[styles.primaryButton, (!complete || saving) && styles.disabledButton]}
            onPress={saveSafety}
            disabled={!complete || saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="save-outline" size={18} color="#FFFFFF" />
                <Text style={styles.primaryText}>Save Safety Confirmation</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.darkButton} onPress={() => goTo(FREIGHT_ROUTES.compliance)}>
          <Ionicons name="shield-checkmark-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryText}>Back to Compliance</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function SafetySection({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}>
          <Ionicons name={icon} size={20} color="#FFFFFF" />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionSubtitle}>{subtitle}</Text>
        </View>
      </View>

      {children}
    </View>
  );
}

function SwitchRow({
  label,
  value,
  onChange,
  dark = false,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  dark?: boolean;
}) {
  return (
    <View style={[styles.switchRow, dark && styles.switchRowDark]}>
      <Text style={[styles.switchText, dark && styles.switchTextDark]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: "#CBD5E1", true: "#FCA5A5" }}
        thumbColor={value ? COLORS.red : "#FFFFFF"}
      />
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
  route: FreightRoute;
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
    alignItems: "center",
    gap: 14,
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
  sectionHeader: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    marginBottom: 14,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: COLORS.black,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: { color: COLORS.text, fontSize: 21, fontWeight: "900" },
  sectionSubtitle: {
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 3,
  },
  switchRow: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 13,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  switchRowDark: {
    backgroundColor: "#111827",
    borderColor: "#374151",
  },
  switchText: { color: COLORS.text, fontWeight: "900", flex: 1, lineHeight: 20 },
  switchTextDark: { color: "#FFFFFF" },
  acceptCard: {
    backgroundColor: COLORS.black,
    borderRadius: 22,
    padding: 18,
    marginHorizontal: 18,
    marginBottom: 16,
  },
  acceptTitle: { color: "#FFFFFF", fontSize: 23, fontWeight: "900", marginBottom: 8 },
  acceptText: { color: "#D1D5DB", fontWeight: "700", lineHeight: 22, marginBottom: 12 },
  primaryButton: {
    backgroundColor: COLORS.red,
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  disabledButton: { opacity: 0.6 },
  primaryText: { color: "#FFFFFF", fontWeight: "900" },
  darkButton: {
    backgroundColor: COLORS.black,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 18,
    marginTop: 4,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
});