// app/freight/payout-center.tsx
// Payout center for Stripe Connect readiness + completed/pending freight payouts.

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
  dashboard: "/freight/dashboard",
  managementCenter: "/freight/freight-management-center",
  connectBank: "/freight/connect-bank",
  earnings: "/freight/earnings",
  analytics: "/freight/analytics",
  deliveryHistory: "/freight/delivery-history",
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
};

function normalize(value: any) {
  return String(value || "").trim().toLowerCase();
}

function goTo(route: FreightRoute) {
  router.push(route as any);
}

function money(value: number) {
  return `$${Number(value || 0).toFixed(2)}`;
}

export default function FreightPayoutCenterScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [carrier, setCarrier] = useState<any>(null);
  const [loads, setLoads] = useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadPayoutCenter();
    }, [])
  );

  const stats = useMemo(() => {
    const completed = loads.filter((x) =>
      ["delivered", "completed"].includes(normalize(x.status))
    );

    const paid = completed.filter((x) =>
      ["paid", "settled"].includes(normalize(x.payout_status || x.settlement_status))
    );

    const pending = completed.filter(
      (x) => !["paid", "settled"].includes(normalize(x.payout_status || x.settlement_status))
    );

    return {
      completedCount: completed.length,
      paidCount: paid.length,
      pendingCount: pending.length,
      paidValue: paid.reduce((sum, x) => sum + Number(x.rate || x.freight_total || x.total_due || 0), 0),
      pendingValue: pending.reduce((sum, x) => sum + Number(x.rate || x.freight_total || x.total_due || 0), 0),
      totalValue: completed.reduce((sum, x) => sum + Number(x.rate || x.freight_total || x.total_due || 0), 0),
    };
  }, [loads]);

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

  async function loadPayoutCenter() {
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

      if (carrierError) console.log("Payout center carrier error:", carrierError.message);

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
        role: "freight",
        companyName:
          dbCarrier.company_name ||
          dbCarrier.business_name ||
          stored?.companyName ||
          stored?.businessName ||
          "Freight Connect Carrier",
        stripeAccountId:
          dbCarrier.stripe_account_id || stored?.stripeAccountId || stored?.stripe_account_id || "",
        stripe_account_id:
          dbCarrier.stripe_account_id || stored?.stripe_account_id || stored?.stripeAccountId || "",
        payoutsEnabled:
          dbCarrier.payouts_enabled ?? dbCarrier.stripe_payouts_enabled ?? stored?.payoutsEnabled ?? false,
        chargesEnabled:
          dbCarrier.charges_enabled ?? dbCarrier.stripe_charges_enabled ?? stored?.chargesEnabled ?? false,
        onboardingComplete:
          dbCarrier.stripe_onboarding_complete ?? stored?.onboardingComplete ?? false,
      });

      const { data, error } = await supabase
        .from("freight_loads")
        .select("*")
        .or(`carrier_id.eq.${mergedCarrier.id},driver_id.eq.${mergedCarrier.id},accepted_by.eq.${mergedCarrier.id}`)
        .in("status", ["delivered", "completed"])
        .order("delivered_at", { ascending: false });

      if (error) {
        console.log("Payout center loads error:", error.message);
        setLoads([]);
      } else {
        setLoads(Array.isArray(data) ? data : []);
      }
    } catch (error: any) {
      Alert.alert("Payout Error", error?.message || "Unable to load payout center.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadPayoutCenter();
  }

  function stripeReady() {
    return Boolean(
      (carrier?.stripeAccountId || carrier?.stripe_account_id) &&
        (carrier?.payoutsEnabled || carrier?.payouts_enabled) &&
        (carrier?.chargesEnabled || carrier?.charges_enabled) &&
        (carrier?.onboardingComplete || carrier?.stripe_onboarding_complete)
    );
  }

  function stripeStatusText() {
    if (stripeReady()) return "Payout Ready";
    if (carrier?.stripeAccountId || carrier?.stripe_account_id) return "Onboarding Incomplete";
    return "Bank Not Connected";
  }

  function stripeStatusColor() {
    if (stripeReady()) return COLORS.green;
    if (carrier?.stripeAccountId || carrier?.stripe_account_id) return COLORS.amber;
    return COLORS.red;
  }

  function payoutStatus(load: any) {
    return load.payout_status || load.settlement_status || "pending";
  }

  function renderLoad({ item }: { item: any }) {
    const amount = Number(item.rate || item.freight_total || item.total_due || 0);
    const paid = ["paid", "settled"].includes(normalize(payoutStatus(item)));

    return (
      <View style={styles.loadCard}>
        <View style={styles.loadTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.loadTitle}>{item.title || item.commodity || "Completed Freight Load"}</Text>
            <Text style={styles.loadSub}>
              {item.pickup_location || "Pickup"} → {item.dropoff_location || "Dropoff"}
            </Text>
          </View>

          <View style={[styles.badge, { backgroundColor: paid ? COLORS.green : COLORS.amber }]}>
            <Text style={styles.badgeText}>{payoutStatus(item)}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Payout Amount</Text>
          <Text style={styles.infoValue}>{money(amount)}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Delivered</Text>
          <Text style={styles.infoValue}>
            {item.delivered_at ? new Date(item.delivered_at).toLocaleDateString() : "Not recorded"}
          </Text>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <ActivityIndicator size="large" color={COLORS.red} />
        <Text style={styles.centerText}>Loading payout center...</Text>
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
            <Text style={styles.title}>Payout Center</Text>
            <Text style={styles.subtitle}>
              Review Stripe Connect readiness, completed load payouts, pending settlements, and payout history.
            </Text>
          </View>

          <TouchableOpacity style={styles.heroIcon} onPress={() => goTo(FREIGHT_ROUTES.connectBank)}>
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

            <View style={[styles.stripePill, { backgroundColor: stripeStatusColor() }]}>
              <Text style={styles.stripePillText}>Stripe Connect: {stripeStatusText()}</Text>
            </View>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <StatCard label="Total Earned" value={money(stats.totalValue)} icon="cash-outline" />
          <StatCard label="Paid" value={money(stats.paidValue)} icon="checkmark-circle-outline" />
          <StatCard label="Pending" value={money(stats.pendingValue)} icon="time-outline" />
          <StatCard label="Completed Loads" value={String(stats.completedCount)} icon="cube-outline" />
        </View>

        <View style={styles.quickGrid}>
          <QuickLink icon="business-outline" label="Connect Bank" route={FREIGHT_ROUTES.connectBank} />
          <QuickLink icon="cash-outline" label="Earnings" route={FREIGHT_ROUTES.earnings} />
          <QuickLink icon="analytics-outline" label="Analytics" route={FREIGHT_ROUTES.analytics} />
          <QuickLink icon="time-outline" label="History" route={FREIGHT_ROUTES.deliveryHistory} />
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Payout Requirements</Text>
          <Text style={styles.noticeText}>
            Payouts require completed Stripe Connect onboarding, completed proof of delivery,
            no unresolved disputes, and successful payment settlement.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Completed Load Payouts</Text>

        <FlatList
          data={loads}
          keyExtractor={(item, index) => String(item.id || index)}
          scrollEnabled={false}
          renderItem={renderLoad}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Ionicons name="wallet-outline" size={38} color={COLORS.red} />
              <Text style={styles.emptyTitle}>No completed payouts yet.</Text>
              <Text style={styles.emptyText}>
                Delivered freight loads will appear here once completed.
              </Text>
            </View>
          }
        />

        <TouchableOpacity style={styles.primaryButton} onPress={() => goTo(FREIGHT_ROUTES.connectBank)}>
          <Ionicons name="business-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryText}>Open Connect Bank</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.darkButton} onPress={() => goTo(FREIGHT_ROUTES.managementCenter)}>
          <Ionicons name="apps-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryText}>Back to Management Center</Text>
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
  stripePill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 9,
  },
  stripePillText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
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
  loadCard: {
    backgroundColor: COLORS.card,
    marginHorizontal: 18,
    marginBottom: 14,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  loadTop: { flexDirection: "row", gap: 12, alignItems: "flex-start", marginBottom: 12 },
  loadTitle: { color: COLORS.text, fontSize: 18, fontWeight: "900" },
  loadSub: { color: COLORS.muted, fontWeight: "700", marginTop: 4 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  badgeText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900", textTransform: "capitalize" },
  infoRow: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 13,
    marginTop: 8,
    flexDirection: "row",
    gap: 10,
  },
  infoLabel: { flex: 1, color: COLORS.muted, fontWeight: "900" },
  infoValue: { color: COLORS.red, fontWeight: "900" },
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