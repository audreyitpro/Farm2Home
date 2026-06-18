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
  settlements: "/freight/settlements",
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

function getCarrierId(carrier: any) {
  return (
    carrier?.id ||
    carrier?.freightId ||
    carrier?.freight_id ||
    carrier?.profile_id ||
    carrier?.auth_user_id ||
    ""
  );
}

function getAccountId(carrier: any) {
  return carrier?.accountId || carrier?.account_id || "";
}

function getStripeAccountId(carrier: any) {
  return carrier?.stripeAccountId || carrier?.stripe_account_id || "";
}

function boolValue(...values: any[]) {
  return values.some((value) => value === true || value === "true" || value === 1);
}

function goTo(route: FreightRoute) {
  router.push(route as any);
}

function money(value: number) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function formatDate(value?: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleDateString();
}

function getLoadAmount(load: any) {
  return Number(
    load?.payout_amount ||
      load?.carrier_payout ||
      load?.freight_payout ||
      load?.driver_payout ||
      load?.rate ||
      load?.freight_total ||
      load?.total_due ||
      load?.delivery_fee ||
      0
  );
}

function isCompletedLoad(load: any) {
  return ["delivered", "completed", "complete"].includes(normalize(load?.status));
}

function isPaidLoad(load: any) {
  return ["paid", "settled", "complete", "completed"].includes(
    normalize(load?.payout_status || load?.settlement_status || load?.payment_status)
  );
}

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

async function saveFreightSession(carrier: any) {
  await AsyncStorage.setItem("currentFreight", JSON.stringify(carrier));
  await AsyncStorage.setItem("currentFreightCarrier", JSON.stringify(carrier));
  await AsyncStorage.setItem("currentFreightUser", JSON.stringify(carrier));
  await AsyncStorage.setItem("currentUser", JSON.stringify(carrier));
  await AsyncStorage.setItem("userRole", "freight");
  await AsyncStorage.setItem("currentUserRole", "freight");
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
    const completed = loads.filter(isCompletedLoad);
    const paid = completed.filter(isPaidLoad);
    const pending = completed.filter((load) => !isPaidLoad(load));

    return {
      completedCount: completed.length,
      paidCount: paid.length,
      pendingCount: pending.length,
      paidValue: paid.reduce((sum, load) => sum + getLoadAmount(load), 0),
      pendingValue: pending.reduce((sum, load) => sum + getLoadAmount(load), 0),
      totalValue: completed.reduce((sum, load) => sum + getLoadAmount(load), 0),
    };
  }, [loads]);

  async function persistCarrier(nextCarrier: any) {
    const realId = getCarrierId(nextCarrier);

    const normalizedCarrier = {
      ...nextCarrier,
      id: realId,
      freightId: realId,
      freight_id: nextCarrier.freight_id || realId,
      profile_id: nextCarrier.profile_id || realId,
      auth_user_id: nextCarrier.auth_user_id || realId,
      role: "freight",
      email: normalize(nextCarrier.email),
      accountId: nextCarrier.accountId || nextCarrier.account_id || "",
      account_id: nextCarrier.account_id || nextCarrier.accountId || "",
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
      stripeAccountId: getStripeAccountId(nextCarrier),
      stripe_account_id: getStripeAccountId(nextCarrier),
      stripeConnectStatus:
        nextCarrier.stripeConnectStatus ||
        nextCarrier.stripe_connect_status ||
        (getStripeAccountId(nextCarrier) ? "created" : "not_started"),
      stripe_connect_status:
        nextCarrier.stripe_connect_status ||
        nextCarrier.stripeConnectStatus ||
        (getStripeAccountId(nextCarrier) ? "created" : "not_started"),
      payoutsEnabled: boolValue(
        nextCarrier.payoutsEnabled,
        nextCarrier.payouts_enabled,
        nextCarrier.stripe_payouts_enabled
      ),
      payouts_enabled: boolValue(
        nextCarrier.payouts_enabled,
        nextCarrier.payoutsEnabled,
        nextCarrier.stripe_payouts_enabled
      ),
      stripe_payouts_enabled: boolValue(
        nextCarrier.stripe_payouts_enabled,
        nextCarrier.payouts_enabled,
        nextCarrier.payoutsEnabled
      ),
      chargesEnabled: boolValue(
        nextCarrier.chargesEnabled,
        nextCarrier.charges_enabled,
        nextCarrier.stripe_charges_enabled
      ),
      charges_enabled: boolValue(
        nextCarrier.charges_enabled,
        nextCarrier.chargesEnabled,
        nextCarrier.stripe_charges_enabled
      ),
      stripe_charges_enabled: boolValue(
        nextCarrier.stripe_charges_enabled,
        nextCarrier.charges_enabled,
        nextCarrier.chargesEnabled
      ),
      onboardingComplete: boolValue(
        nextCarrier.onboardingComplete,
        nextCarrier.stripe_onboarding_complete
      ),
      stripe_onboarding_complete: boolValue(
        nextCarrier.stripe_onboarding_complete,
        nextCarrier.onboardingComplete
      ),
    };

    await saveFreightSession(normalizedCarrier);
    setCarrier(normalizedCarrier);
    return normalizedCarrier;
  }

  async function findFreightCarrier(stored: any, authUser: any) {
    const storedId = getCarrierId(stored);
    const authId = authUser?.id || "";
    const email = normalize(stored?.email || authUser?.email || "");

    let query = supabase.from("freight_users").select("*");

    if (storedId || authId || email) {
      const filters = [
        storedId ? `id.eq.${storedId}` : "",
        storedId ? `freight_id.eq.${storedId}` : "",
        storedId ? `profile_id.eq.${storedId}` : "",
        storedId ? `auth_user_id.eq.${storedId}` : "",
        authId ? `id.eq.${authId}` : "",
        authId ? `freight_id.eq.${authId}` : "",
        authId ? `profile_id.eq.${authId}` : "",
        authId ? `auth_user_id.eq.${authId}` : "",
        email ? `email.eq.${email}` : "",
      ]
        .filter(Boolean)
        .join(",");

      query = query.or(filters);
    }

    const { data, error } = await query.limit(1);

    if (error) throw error;

    return Array.isArray(data) && data.length > 0 ? data[0] : null;
  }

  async function loadFreightLoads(mergedCarrier: any) {
    const carrierId = getCarrierId(mergedCarrier);
    const accountId = getAccountId(mergedCarrier);
    const email = normalize(mergedCarrier?.email);

    if (!carrierId && !accountId && !email) {
      setLoads([]);
      return;
    }

    const filters = [
      carrierId ? `carrier_id.eq.${carrierId}` : "",
      carrierId ? `freight_id.eq.${carrierId}` : "",
      carrierId ? `driver_id.eq.${carrierId}` : "",
      carrierId ? `accepted_by.eq.${carrierId}` : "",
      carrierId ? `assigned_to.eq.${carrierId}` : "",
      accountId ? `account_id.eq.${accountId}` : "",
      email ? `carrier_email.eq.${email}` : "",
      email ? `freight_email.eq.${email}` : "",
    ]
      .filter(Boolean)
      .join(",");

    try {
      const { data, error } = await supabase
        .from("freight_loads")
        .select("*")
        .or(filters)
        .in("status", ["delivered", "completed", "complete"])
        .order("delivered_at", { ascending: false });

      if (error) throw error;
      setLoads(Array.isArray(data) ? data : []);
    } catch (firstError: any) {
      console.log("Payout center freight_loads primary query error:", firstError?.message);

      try {
        const { data, error } = await supabase
          .from("freight_loads")
          .select("*")
          .or(filters)
          .order("updated_at", { ascending: false });

        if (error) throw error;

        const completedOnly = Array.isArray(data) ? data.filter(isCompletedLoad) : [];
        setLoads(completedOnly);
      } catch (fallbackError: any) {
        console.log("Payout center freight_loads fallback query error:", fallbackError?.message);
        setLoads([]);
      }
    }
  }

  async function loadPayoutCenter() {
    try {
      setLoading(true);

      const stored = await getStoredCarrier();
      const { data: authData } = await supabase.auth.getUser();
      const authUser = authData?.user;

      const email = normalize(stored?.email || authUser?.email || "");

      if (!email && !authUser?.id && !getCarrierId(stored)) {
        router.replace(FREIGHT_ROUTES.login as any);
        return;
      }

      const dbCarrier = await findFreightCarrier(stored, authUser);

      if (!dbCarrier) {
        Alert.alert(
          "Freight Profile Missing",
          "Please complete freight registration before opening the payout center."
        );
        router.replace(FREIGHT_ROUTES.register as any);
        return;
      }

      const mergedCarrier = await persistCarrier({
        ...(stored || {}),
        ...(dbCarrier || {}),
        id: dbCarrier.id || getCarrierId(stored) || authUser?.id,
        freightId: dbCarrier.freight_id || dbCarrier.id || getCarrierId(stored) || authUser?.id,
        freight_id: dbCarrier.freight_id || dbCarrier.id || getCarrierId(stored) || authUser?.id,
        profile_id: dbCarrier.profile_id || dbCarrier.id || authUser?.id,
        auth_user_id: dbCarrier.auth_user_id || authUser?.id || dbCarrier.id,
        email: normalize(dbCarrier.email || email),
        role: "freight",
        accountId: dbCarrier.account_id || stored?.accountId || stored?.account_id || "",
        account_id: dbCarrier.account_id || stored?.account_id || stored?.accountId || "",
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
        stripeAccountId:
          dbCarrier.stripe_account_id ||
          stored?.stripeAccountId ||
          stored?.stripe_account_id ||
          "",
        stripe_account_id:
          dbCarrier.stripe_account_id ||
          stored?.stripe_account_id ||
          stored?.stripeAccountId ||
          "",
        stripeConnectStatus:
          dbCarrier.stripe_connect_status ||
          stored?.stripeConnectStatus ||
          stored?.stripe_connect_status ||
          "not_started",
        stripe_connect_status:
          dbCarrier.stripe_connect_status ||
          stored?.stripe_connect_status ||
          stored?.stripeConnectStatus ||
          "not_started",
        payoutsEnabled:
          dbCarrier.payouts_enabled ??
          dbCarrier.stripe_payouts_enabled ??
          stored?.payoutsEnabled ??
          stored?.payouts_enabled ??
          false,
        payouts_enabled:
          dbCarrier.payouts_enabled ??
          dbCarrier.stripe_payouts_enabled ??
          stored?.payouts_enabled ??
          stored?.payoutsEnabled ??
          false,
        stripe_payouts_enabled:
          dbCarrier.stripe_payouts_enabled ??
          dbCarrier.payouts_enabled ??
          stored?.stripe_payouts_enabled ??
          stored?.payouts_enabled ??
          false,
        chargesEnabled:
          dbCarrier.charges_enabled ??
          dbCarrier.stripe_charges_enabled ??
          stored?.chargesEnabled ??
          stored?.charges_enabled ??
          false,
        charges_enabled:
          dbCarrier.charges_enabled ??
          dbCarrier.stripe_charges_enabled ??
          stored?.charges_enabled ??
          stored?.chargesEnabled ??
          false,
        stripe_charges_enabled:
          dbCarrier.stripe_charges_enabled ??
          dbCarrier.charges_enabled ??
          stored?.stripe_charges_enabled ??
          stored?.charges_enabled ??
          false,
        onboardingComplete:
          dbCarrier.stripe_onboarding_complete ??
          stored?.onboardingComplete ??
          stored?.stripe_onboarding_complete ??
          false,
        stripe_onboarding_complete:
          dbCarrier.stripe_onboarding_complete ??
          stored?.stripe_onboarding_complete ??
          stored?.onboardingComplete ??
          false,
      });

      await loadFreightLoads(mergedCarrier);
    } catch (error: any) {
      console.log("Payout center load error:", error);
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
      getStripeAccountId(carrier) &&
        boolValue(carrier?.payoutsEnabled, carrier?.payouts_enabled, carrier?.stripe_payouts_enabled) &&
        boolValue(carrier?.chargesEnabled, carrier?.charges_enabled, carrier?.stripe_charges_enabled) &&
        boolValue(carrier?.onboardingComplete, carrier?.stripe_onboarding_complete)
    );
  }

  function stripeStatusText() {
    if (stripeReady()) return "Payout Ready";
    if (getStripeAccountId(carrier)) return "Onboarding Incomplete";
    return "Bank Not Connected";
  }

  function stripeStatusColor() {
    if (stripeReady()) return COLORS.green;
    if (getStripeAccountId(carrier)) return COLORS.amber;
    return COLORS.red;
  }

  function payoutStatus(load: any) {
    return load?.payout_status || load?.settlement_status || load?.payment_status || "pending";
  }

  function renderLoad({ item }: { item: any }) {
    const amount = getLoadAmount(item);
    const paid = isPaidLoad(item);

    return (
      <View style={styles.loadCard}>
        <View style={styles.loadTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.loadTitle}>
              {item.title || item.commodity || item.load_name || "Completed Freight Load"}
            </Text>
            <Text style={styles.loadSub}>
              {item.pickup_location || item.pickup_address || "Pickup"} →{" "}
              {item.dropoff_location || item.delivery_location || item.dropoff_address || "Dropoff"}
            </Text>
          </View>

          <View style={[styles.badge, { backgroundColor: paid ? COLORS.green : COLORS.amber }]}>
            <Text style={styles.badgeText}>
              {String(payoutStatus(item)).replace(/_/g, " ")}
            </Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Payout Amount</Text>
          <Text style={styles.infoValue}>{money(amount)}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Delivered</Text>
          <Text style={styles.infoValue}>
            {formatDate(item.delivered_at || item.completed_at || item.updated_at)}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Payout Reference</Text>
          <Text style={styles.infoValue}>
            {item.stripe_payout_id || item.payout_id || item.transfer_id || "Pending"}
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

          <TouchableOpacity
            style={styles.heroIcon}
            onPress={() => goTo(FREIGHT_ROUTES.connectBank)}
            activeOpacity={0.85}
          >
            <Ionicons name="wallet-outline" size={34} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.carrierCard}>
          <View style={styles.avatar}>
            <Ionicons name="business-outline" size={28} color="#FFFFFF" />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.carrierName}>
              {carrier?.companyName || carrier?.businessName || "Freight Connect Carrier"}
            </Text>
            <Text style={styles.carrierEmail}>{carrier?.email || "Carrier workspace"}</Text>

            <View style={[styles.stripePill, { backgroundColor: stripeStatusColor() }]}>
              <Text style={styles.stripePillText}>Stripe Connect: {stripeStatusText()}</Text>
            </View>

            <Text style={styles.smallMeta}>
              Stripe Account: {getStripeAccountId(carrier) || "Not connected"}
            </Text>
          </View>
        </View>

        {!stripeReady() ? (
          <View style={styles.warningCard}>
            <View style={styles.warningTop}>
              <Ionicons name="alert-circle-outline" size={24} color={COLORS.amber} />
              <Text style={styles.warningTitle}>Connect Bank Required</Text>
            </View>
            <Text style={styles.warningText}>
              Payouts will stay pending until Stripe Express onboarding is complete and Stripe marks charges and payouts as enabled.
            </Text>
            <TouchableOpacity
              style={styles.warningButton}
              onPress={() => goTo(FREIGHT_ROUTES.connectBank)}
              activeOpacity={0.85}
            >
              <Ionicons name="open-outline" size={18} color="#FFFFFF" />
              <Text style={styles.warningButtonText}>Open Connect Bank / Payouts</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.statsGrid}>
          <StatCard label="Total Earned" value={money(stats.totalValue)} icon="cash-outline" />
          <StatCard label="Paid" value={money(stats.paidValue)} icon="checkmark-circle-outline" />
          <StatCard label="Pending" value={money(stats.pendingValue)} icon="time-outline" />
          <StatCard label="Completed Loads" value={String(stats.completedCount)} icon="cube-outline" />
        </View>

        <View style={styles.quickGrid}>
          <QuickLink icon="business-outline" label="Connect Bank" route={FREIGHT_ROUTES.connectBank} />
          <QuickLink icon="cash-outline" label="Earnings" route={FREIGHT_ROUTES.earnings} />
          <QuickLink icon="receipt-outline" label="Settlements" route={FREIGHT_ROUTES.settlements} />
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
          keyExtractor={(item, index) => String(item.id || item.load_id || index)}
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

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => goTo(FREIGHT_ROUTES.connectBank)}
          activeOpacity={0.85}
        >
          <Ionicons name="business-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryText}>Open Connect Bank / Payouts</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.darkButton}
          onPress={() => goTo(FREIGHT_ROUTES.managementCenter)}
          activeOpacity={0.85}
        >
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
    <TouchableOpacity style={styles.quickLink} onPress={() => goTo(route)} activeOpacity={0.85}>
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
  smallMeta: {
    color: COLORS.muted,
    fontWeight: "800",
    marginTop: 8,
    fontSize: 12,
  },
  stripePill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 9,
  },
  stripePillText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  warningCard: {
    backgroundColor: "#FFFBEB",
    marginHorizontal: 18,
    marginBottom: 14,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: "#FCD34D",
  },
  warningTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  warningTitle: { color: COLORS.text, fontSize: 19, fontWeight: "900" },
  warningText: { color: "#92400E", fontWeight: "700", lineHeight: 21 },
  warningButton: {
    backgroundColor: COLORS.red,
    borderRadius: 15,
    padding: 14,
    marginTop: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  warningButtonText: { color: "#FFFFFF", fontWeight: "900" },
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
  infoValue: { color: COLORS.red, fontWeight: "900", flex: 1, textAlign: "right" },
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
