// app/freight/performance-scorecard.tsx

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

import { supabase } from "../data/supabaseClient";

const FREIGHT_ROUTES = {
  dashboard: "/freight/dashboard",
  managementCenter: "/freight/freight-management-center",
  dispatchCenter: "/freight/dispatch-center",
  operationsCalendar: "/freight/operations-calendar",
  settlements: "/freight/settlements",
  disputes: "/freight/disputes",
  compliance: "/freight/compliance",
  safety: "/freight/safety",
  connectBank: "/freight/connect-bank",
  analytics: "/freight/analytics",
  support: "/freight/support",
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
  purple: "#7C3AED",
};

function normalize(value: any) {
  return String(value || "").trim().toLowerCase();
}

function goTo(route: FreightRoute) {
  router.push(route as any);
}

function pct(value: number) {
  return `${Math.round(value)}%`;
}

function money(value: any) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function isDelivered(load: any) {
  return ["delivered", "completed"].includes(normalize(load.status));
}

function isActive(load: any) {
  return ["accepted", "arrived_pickup", "picked_up", "in_transit", "arrived_dropoff"].includes(
    normalize(load.status)
  );
}

function hasException(load: any) {
  return Boolean(load.route_exception_status || load.route_exception_type);
}

function hasDispute(load: any) {
  return Boolean(load.dispute_status || load.dispute_reason);
}

export default function FreightPerformanceScorecardScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [carrier, setCarrier] = useState<any>(null);
  const [loads, setLoads] = useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadScorecard();
    }, [])
  );

  const scorecard = useMemo(() => {
    const completed = loads.filter(isDelivered);
    const active = loads.filter(isActive);
    const exceptions = loads.filter(hasException);
    const disputes = loads.filter(hasDispute);

    const onTimeCompleted = completed.filter((load) => {
      if (load.delivered_late === true) return false;
      if (load.route_exception_status || load.route_exception_type) return false;
      return true;
    });

    const payoutReady = Boolean(
      (carrier?.stripeAccountId || carrier?.stripe_account_id) &&
        (carrier?.payoutsEnabled || carrier?.payouts_enabled) &&
        (carrier?.chargesEnabled || carrier?.charges_enabled) &&
        (carrier?.onboardingComplete || carrier?.stripe_onboarding_complete)
    );

    const complianceReady = Boolean(
      carrier?.legalAccepted ||
        carrier?.legal_accepted ||
        carrier?.freightTermsAccepted ||
        carrier?.freight_terms_accepted
    );

    const safetyReady = Boolean(carrier?.safety_confirmed || carrier?.safetyConfirmed);

    const onTimeRate = completed.length ? (onTimeCompleted.length / completed.length) * 100 : 100;
    const disputeRate = completed.length ? (disputes.length / completed.length) * 100 : 0;
    const exceptionRate = loads.length ? (exceptions.length / loads.length) * 100 : 0;

    let score = 100;
    score -= Math.min(30, exceptionRate * 0.5);
    score -= Math.min(30, disputeRate * 1.5);
    if (!payoutReady) score -= 10;
    if (!complianceReady) score -= 10;
    if (!safetyReady) score -= 10;

    return {
      completed: completed.length,
      active: active.length,
      exceptions: exceptions.length,
      disputes: disputes.length,
      onTimeRate,
      exceptionRate,
      disputeRate,
      payoutReady,
      complianceReady,
      safetyReady,
      earnings: completed.reduce(
        (sum, load) => sum + Number(load.rate || load.freight_total || load.total_due || 0),
        0
      ),
      score: Math.max(0, Math.round(score)),
    };
  }, [loads, carrier]);

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
      stripeAccountId: nextCarrier.stripeAccountId || nextCarrier.stripe_account_id || "",
      stripe_account_id: nextCarrier.stripe_account_id || nextCarrier.stripeAccountId || "",
      payoutsEnabled: nextCarrier.payoutsEnabled ?? nextCarrier.payouts_enabled ?? false,
      chargesEnabled: nextCarrier.chargesEnabled ?? nextCarrier.charges_enabled ?? false,
      onboardingComplete:
        nextCarrier.onboardingComplete ?? nextCarrier.stripe_onboarding_complete ?? false,
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

  async function loadScorecard() {
    try {
      setLoading(true);

      const stored = await getStoredCarrier();
      const { data: authData } = await supabase.auth.getUser();
      const email = normalize(stored?.email || authData?.user?.email || "");

      if (!email) {
        router.replace(FREIGHT_ROUTES.login as any);
        return;
      }

      const { data: dbCarrier, error: carrierError } = await supabase
        .from("freight_users")
        .select("*")
        .eq("email", email)
        .maybeSingle();

      if (carrierError) console.log("Scorecard carrier error:", carrierError.message);

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
        role: "freight",
        email: normalize(dbCarrier.email || email),
        companyName:
          dbCarrier.company_name ||
          dbCarrier.business_name ||
          stored?.companyName ||
          stored?.businessName ||
          "Freight Connect Carrier",
      });

      const { data, error } = await supabase
        .from("freight_loads")
        .select("*")
        .or(
          `carrier_id.eq.${mergedCarrier.id},driver_id.eq.${mergedCarrier.id},accepted_by.eq.${mergedCarrier.id}`
        )
        .order("updated_at", { ascending: false });

      if (error) {
        console.log("Scorecard loads error:", error.message);
        setLoads([]);
      } else {
        setLoads(Array.isArray(data) ? data : []);
      }
    } catch (error: any) {
      Alert.alert("Scorecard Error", error?.message || "Unable to load performance scorecard.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadScorecard();
  }

  function scoreColor() {
    if (scorecard.score >= 85) return COLORS.green;
    if (scorecard.score >= 70) return COLORS.amber;
    return COLORS.red;
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <ActivityIndicator size="large" color={COLORS.red} />
        <Text style={styles.centerText}>Loading performance scorecard...</Text>
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
            <Text style={styles.title}>Performance Scorecard</Text>
            <Text style={styles.subtitle}>
              Track completed loads, on-time rate, route exceptions, disputes, payout readiness,
              safety, compliance, and carrier performance.
            </Text>
          </View>

          <TouchableOpacity style={styles.heroIcon} onPress={() => goTo(FREIGHT_ROUTES.analytics)}>
            <Ionicons name="speedometer-outline" size={34} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.scoreCard}>
          <View style={[styles.scoreCircle, { backgroundColor: scoreColor() }]}>
            <Text style={styles.scoreValue}>{scorecard.score}</Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.carrierName}>{carrier?.companyName || "Freight Connect Carrier"}</Text>
            <Text style={styles.carrierEmail}>{carrier?.email || "Carrier workspace"}</Text>
            <Text style={styles.scoreText}>
              {scorecard.score >= 85
                ? "Strong carrier performance"
                : scorecard.score >= 70
                ? "Good performance with improvement areas"
                : "Action required to improve score"}
            </Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <StatCard label="Completed" value={String(scorecard.completed)} icon="checkmark-done-outline" />
          <StatCard label="Active" value={String(scorecard.active)} icon="navigate-outline" />
          <StatCard label="On-Time Rate" value={pct(scorecard.onTimeRate)} icon="time-outline" />
          <StatCard label="Exceptions" value={String(scorecard.exceptions)} icon="warning-outline" />
          <StatCard label="Disputes" value={String(scorecard.disputes)} icon="alert-circle-outline" />
          <StatCard label="Earnings" value={money(scorecard.earnings)} icon="cash-outline" />
        </View>

        <View style={styles.quickGrid}>
          <QuickLink icon="navigate-circle-outline" label="Dispatch" route={FREIGHT_ROUTES.dispatchCenter} />
          <QuickLink icon="calendar-outline" label="Calendar" route={FREIGHT_ROUTES.operationsCalendar} />
          <QuickLink icon="receipt-outline" label="Settlements" route={FREIGHT_ROUTES.settlements} />
          <QuickLink icon="shield-checkmark-outline" label="Compliance" route={FREIGHT_ROUTES.compliance} />
        </View>

        <View style={styles.card}>
          <SectionHeader icon="shield-checkmark-outline" title="Readiness Checklist" />

          <ReadinessRow
            label="Stripe payout ready"
            complete={scorecard.payoutReady}
            route={FREIGHT_ROUTES.connectBank}
          />
          <ReadinessRow
            label="Compliance / legal accepted"
            complete={scorecard.complianceReady}
            route={FREIGHT_ROUTES.compliance}
          />
          <ReadinessRow
            label="Safety confirmed"
            complete={scorecard.safetyReady}
            route={FREIGHT_ROUTES.safety}
          />
        </View>

        <View style={styles.card}>
          <SectionHeader icon="analytics-outline" title="Performance Insights" />

          <Insight
            label="On-time rate"
            value={pct(scorecard.onTimeRate)}
            good={scorecard.onTimeRate >= 85}
          />
          <Insight
            label="Exception rate"
            value={pct(scorecard.exceptionRate)}
            good={scorecard.exceptionRate <= 10}
          />
          <Insight
            label="Dispute rate"
            value={pct(scorecard.disputeRate)}
            good={scorecard.disputeRate <= 5}
          />
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={() => goTo(FREIGHT_ROUTES.dispatchCenter)}>
          <Ionicons name="navigate-circle-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryText}>Open Dispatch Center</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.darkButton} onPress={() => goTo(FREIGHT_ROUTES.managementCenter)}>
          <Ionicons name="apps-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryText}>Management Center</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeader({ icon, title }: { icon: keyof typeof Ionicons.glyphMap; title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIcon}>
        <Ionicons name={icon} size={20} color="#FFFFFF" />
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function ReadinessRow({
  label,
  complete,
  route,
}: {
  label: string;
  complete: boolean;
  route: FreightRoute;
}) {
  return (
    <TouchableOpacity style={styles.readinessRow} onPress={() => goTo(route)}>
      <Ionicons
        name={complete ? "checkmark-circle" : "alert-circle-outline"}
        size={20}
        color={complete ? COLORS.green : COLORS.amber}
      />
      <Text style={styles.readinessText}>{label}</Text>
      <Text style={[styles.readinessStatus, { color: complete ? COLORS.green : COLORS.amber }]}>
        {complete ? "Complete" : "Needed"}
      </Text>
    </TouchableOpacity>
  );
}

function Insight({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <View style={styles.insightRow}>
      <Text style={styles.insightLabel}>{label}</Text>
      <Text style={[styles.insightValue, { color: good ? COLORS.green : COLORS.amber }]}>
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
  scoreCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 18,
    marginHorizontal: 18,
    marginTop: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
  },
  scoreCircle: {
    width: 72,
    height: 72,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreValue: { color: "#FFFFFF", fontSize: 28, fontWeight: "900" },
  carrierName: { color: COLORS.text, fontSize: 19, fontWeight: "900" },
  carrierEmail: { color: COLORS.muted, fontWeight: "700", marginTop: 4 },
  scoreText: { color: COLORS.red, fontWeight: "900", marginTop: 6 },
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
  sectionTitle: { color: COLORS.text, fontSize: 21, fontWeight: "900" },
  readinessRow: {
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
  readinessText: { color: COLORS.text, fontWeight: "900", flex: 1 },
  readinessStatus: { fontWeight: "900" },
  insightRow: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 13,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  insightLabel: { color: COLORS.text, fontWeight: "900" },
  insightValue: { fontWeight: "900" },
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