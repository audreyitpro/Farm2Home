// app/freight/legal.tsx

import React, { useCallback, useState } from "react";
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
  board: "/freight/board",
  myLoads: "/freight/my-loads",
  liveLoads: "/freight/live-loads",
  deliveryHistory: "/freight/delivery-history",
  earnings: "/freight/earnings",
  connectBank: "/freight/connect-bank",
  profile: "/freight/profile",
  settings: "/freight/settings",
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
  redDark: "#9F1117",
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

export default function FreightLegalScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [saving, setSaving] = useState(false);
  const [carrier, setCarrier] = useState<any>(null);

  const [termsAccepted, setTermsAccepted] = useState(false);
  const [safetyAccepted, setSafetyAccepted] = useState(false);
  const [payoutAccepted, setPayoutAccepted] = useState(false);
  const [disputeAccepted, setDisputeAccepted] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadLegalStatus();
    }, [])
  );

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
      legalAccepted:
        nextCarrier.legalAccepted ?? nextCarrier.legal_accepted ?? false,
      freightTermsAccepted:
        nextCarrier.freightTermsAccepted ?? nextCarrier.freight_terms_accepted ?? false,
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

  async function loadLegalStatus() {
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

      if (error) {
        console.log("Freight legal profile error:", error.message);
      }

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
        legalAccepted: dbCarrier.legal_accepted ?? stored?.legalAccepted ?? false,
        freightTermsAccepted:
          dbCarrier.freight_terms_accepted ?? stored?.freightTermsAccepted ?? false,
      };

      await persistCarrier(mergedCarrier);

      const accepted = Boolean(
        dbCarrier.freight_terms_accepted ||
          dbCarrier.legal_accepted ||
          stored?.freightTermsAccepted ||
          stored?.legalAccepted
      );

      setTermsAccepted(Boolean(dbCarrier.freight_terms_accepted ?? accepted));
      setSafetyAccepted(Boolean(dbCarrier.freight_safety_accepted ?? accepted));
      setPayoutAccepted(Boolean(dbCarrier.freight_payout_terms_accepted ?? accepted));
      setDisputeAccepted(Boolean(dbCarrier.freight_dispute_terms_accepted ?? accepted));
    } catch (error: any) {
      console.log("Freight legal load error:", error);
      Alert.alert("Legal Error", error?.message || "Unable to load freight legal terms.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadLegalStatus();
  }

  async function saveAcceptance() {
    if (!carrier?.id) {
      Alert.alert("Profile Missing", "Please log in again.");
      router.replace(FREIGHT_ROUTES.login as any);
      return;
    }

    if (!termsAccepted || !safetyAccepted || !payoutAccepted || !disputeAccepted) {
      Alert.alert(
        "Acceptance Required",
        "Please review and accept all freight legal, safety, payout, and dispute terms."
      );
      return;
    }

    try {
      setSaving(true);

      const now = new Date().toISOString();

      const payload = {
        legal_accepted: true,
        freight_terms_accepted: true,
        freight_safety_accepted: true,
        freight_payout_terms_accepted: true,
        freight_dispute_terms_accepted: true,
        legal_accepted_at: now,
        freight_terms_accepted_at: now,
        updated_at: now,
      };

      const { error } = await supabase
        .from("freight_users")
        .update(payload)
        .eq("id", carrier.id);

      if (error) throw error;

      const nextCarrier = {
        ...carrier,
        legalAccepted: true,
        legal_accepted: true,
        freightTermsAccepted: true,
        freight_terms_accepted: true,
        legalAcceptedAt: now,
      };

      await persistCarrier(nextCarrier);

      Alert.alert("Accepted", "Freight legal and safety terms have been saved.", [
        {
          text: "Continue",
          onPress: () => router.replace(FREIGHT_ROUTES.managementCenter as any),
        },
      ]);
    } catch (error: any) {
      Alert.alert("Save Error", error?.message || "Unable to save legal acceptance.");
    } finally {
      setSaving(false);
    }
  }

  function allAccepted() {
    return termsAccepted && safetyAccepted && payoutAccepted && disputeAccepted;
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <ActivityIndicator size="large" color={COLORS.red} />
        <Text style={styles.centerText}>Loading freight legal terms...</Text>
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
            <Text style={styles.title}>Legal & Safety</Text>
            <Text style={styles.subtitle}>
              Review freight delivery terms, carrier responsibilities, payout rules, safety
              requirements, and dispute handling.
            </Text>
          </View>

          <TouchableOpacity style={styles.heroIcon} onPress={() => goTo(FREIGHT_ROUTES.managementCenter)}>
            <Ionicons name="shield-checkmark-outline" size={34} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.carrierCard}>
          <View style={styles.avatar}>
            <Ionicons name="business-outline" size={28} color="#FFFFFF" />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.carrierName}>
              {carrier?.companyName || "Freight Connect Carrier"}
            </Text>
            <Text style={styles.carrierEmail}>{carrier?.email || "Carrier workspace"}</Text>
          </View>
        </View>

        <View style={styles.quickGrid}>
          <QuickLink icon="apps-outline" label="Management" route={FREIGHT_ROUTES.managementCenter} />
          <QuickLink icon="grid-outline" label="Dashboard" route={FREIGHT_ROUTES.dashboard} />
          <QuickLink icon="headset-outline" label="Support" route={FREIGHT_ROUTES.support} />
          <QuickLink icon="help-circle-outline" label="Help" route={FREIGHT_ROUTES.help} />
        </View>

        <LegalSection
          icon="document-text-outline"
          title="Freight Carrier Terms"
          items={[
            "Carrier agrees to provide accurate business, vehicle, insurance, and payout information.",
            "Carrier must only accept loads that match available equipment, service area, and legal capability.",
            "Carrier is responsible for timely pickup, safe handling, communication, and delivery confirmation.",
            "Farm2Home may restrict access for fraud, unsafe behavior, repeated cancellations, or unresolved disputes.",
          ]}
        />

        <LegalSection
          icon="snow-outline"
          title="Cold-Chain & Fresh Food Safety"
          items={[
            "Cold-chain loads must remain within required temperature range when refrigeration is required.",
            "Carrier must report unsafe, spoiled, damaged, leaking, contaminated, or rejected products immediately.",
            "Food handling must follow reasonable cleanliness, separation, and safe transport practices.",
            "Temperature verification should be recorded when requested by Farm2Home, the farm, or receiver.",
          ]}
        />

        <LegalSection
          icon="paw-outline"
          title="Livestock & Farm Bulk Transport"
          items={[
            "Carrier must only accept livestock or bulk farm loads when equipped and legally able to transport them.",
            "Carrier is responsible for confirming loading requirements, weight, route constraints, and safety notes.",
            "Unsafe animal handling, overloading, or unapproved equipment may result in account restriction.",
            "Carrier must follow applicable local, state, and federal transport requirements.",
          ]}
        />

        <LegalSection
          icon="cash-outline"
          title="Payout Rules"
          items={[
            "Payouts require completed delivery workflow and valid proof of delivery.",
            "Stripe Connect onboarding must be complete before payouts can be sent.",
            "Final settlement may be delayed by proof review, customer/farm disputes, failed payment, or compliance checks.",
            "Farm2Home may withhold or reverse payout for fraud, non-delivery, duplicate claims, or unresolved damage disputes.",
          ]}
        />

        <LegalSection
          icon="alert-circle-outline"
          title="Disputes, Damage, and Cancellations"
          items={[
            "Carrier must notify Farm2Home support of route delays, rejected loads, damage, shortages, or safety incidents.",
            "Proof photos, notes, signatures, timestamps, and GPS data may be used to resolve disputes.",
            "Repeated late pickups, no-shows, cancellations, or incomplete proof may impact carrier access.",
            "Emergency safety issues should be handled immediately with local authorities when appropriate.",
          ]}
        />

        <View style={styles.acceptCard}>
          <Text style={styles.acceptTitle}>Acceptance Required</Text>
          <Text style={styles.acceptText}>
            Confirm that you reviewed and accept all freight legal, safety, payout, and dispute terms.
          </Text>

          <AcceptRow
            label="I accept Freight Carrier Terms"
            value={termsAccepted}
            onChange={setTermsAccepted}
          />

          <AcceptRow
            label="I accept Safety and Handling Requirements"
            value={safetyAccepted}
            onChange={setSafetyAccepted}
          />

          <AcceptRow
            label="I accept Payout and Settlement Rules"
            value={payoutAccepted}
            onChange={setPayoutAccepted}
          />

          <AcceptRow
            label="I accept Dispute and Cancellation Rules"
            value={disputeAccepted}
            onChange={setDisputeAccepted}
          />

          <TouchableOpacity
            style={[
              styles.primaryButton,
              (!allAccepted() || saving) && styles.disabledButton,
            ]}
            onPress={saveAcceptance}
            disabled={!allAccepted() || saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="shield-checkmark-outline" size={18} color="#FFFFFF" />
                <Text style={styles.primaryText}>Accept & Continue</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.darkButton} onPress={() => goTo(FREIGHT_ROUTES.managementCenter)}>
          <Ionicons name="apps-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryText}>Back to Management Center</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function LegalSection({
  icon,
  title,
  items,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  items: string[];
}) {
  return (
    <View style={styles.card}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}>
          <Ionicons name={icon} size={20} color="#FFFFFF" />
        </View>

        <Text style={styles.sectionTitle}>{title}</Text>
      </View>

      {items.map((item, index) => (
        <View key={`${title}-${index}`} style={styles.legalItem}>
          <View style={styles.legalNumber}>
            <Text style={styles.legalNumberText}>{index + 1}</Text>
          </View>
          <Text style={styles.legalText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function AcceptRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.acceptRow}>
      <Text style={styles.acceptLabel}>{label}</Text>
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
    alignItems: "center",
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
  sectionTitle: { color: COLORS.text, fontSize: 21, fontWeight: "900", flex: 1 },
  legalItem: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 13,
    marginBottom: 10,
    flexDirection: "row",
    gap: 10,
  },
  legalNumber: {
    width: 26,
    height: 26,
    borderRadius: 999,
    backgroundColor: COLORS.red,
    alignItems: "center",
    justifyContent: "center",
  },
  legalNumberText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  legalText: { color: COLORS.text, fontWeight: "800", flex: 1, lineHeight: 20 },
  acceptCard: {
    backgroundColor: COLORS.black,
    borderRadius: 22,
    padding: 18,
    marginHorizontal: 18,
    marginBottom: 16,
  },
  acceptTitle: { color: "#FFFFFF", fontSize: 23, fontWeight: "900", marginBottom: 8 },
  acceptText: { color: "#D1D5DB", fontWeight: "700", lineHeight: 22, marginBottom: 12 },
  acceptRow: {
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#374151",
    borderRadius: 14,
    padding: 13,
    marginBottom: 10,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  acceptLabel: { color: "#FFFFFF", fontWeight: "900", flex: 1, lineHeight: 20 },
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
  disabledButton: { opacity: 0.55 },
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