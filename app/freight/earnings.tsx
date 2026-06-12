// app/freight/earnings.tsx

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
  board: "/freight/board",
  myLoads: "/freight/my-loads",
  liveLoads: "/freight/live-loads",
  profile: "/freight/profile",
  settings: "/freight/settings",
  connectBank: "/freight/connect-bank",
  analytics: "/freight/analytics",
  support: "/freight/support",
  login: "/freight/login",
  register: "/freight/register",
} as const;

type FreightRoute = (typeof FREIGHT_ROUTES)[keyof typeof FREIGHT_ROUTES];

type FreightLoad = any;

type EarningsStats = {
  totalEarnings: number;
  weeklyEarnings: number;
  monthlyEarnings: number;
  completedLoads: number;
  activeLoads: number;
  pendingPayouts: number;
  activePayouts: number;
  totalMiles: number;
  averageRate: number;
};

const ACTIVE_STATUSES = [
  "accepted",
  "arrived_pickup",
  "picked_up",
  "in_transit",
  "arrived_dropoff",
];

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
  purple: "#7C3AED",
};

function normalize(value: any) {
  return String(value || "").trim().toLowerCase();
}

function goTo(route: FreightRoute) {
  router.push(route as any);
}

export default function FreightEarningsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [carrier, setCarrier] = useState<any>(null);
  const [loads, setLoads] = useState<FreightLoad[]>([]);

  const [stats, setStats] = useState<EarningsStats>({
    totalEarnings: 0,
    weeklyEarnings: 0,
    monthlyEarnings: 0,
    completedLoads: 0,
    activeLoads: 0,
    pendingPayouts: 0,
    activePayouts: 0,
    totalMiles: 0,
    averageRate: 0,
  });

  useFocusEffect(
    useCallback(() => {
      loadEarnings();
    }, [])
  );

  const completedLoads = useMemo(
    () =>
      loads.filter((item) =>
        ["delivered", "completed"].includes(normalize(item.status))
      ),
    [loads]
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
      stripeAccountId:
        nextCarrier.stripeAccountId || nextCarrier.stripe_account_id || "",
      stripe_account_id:
        nextCarrier.stripe_account_id || nextCarrier.stripeAccountId || "",
      payoutsEnabled:
        nextCarrier.payoutsEnabled ?? nextCarrier.payouts_enabled ?? false,
      chargesEnabled:
        nextCarrier.chargesEnabled ?? nextCarrier.charges_enabled ?? false,
      onboardingComplete:
        nextCarrier.onboardingComplete ??
        nextCarrier.stripe_onboarding_complete ??
        false,
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

  async function loadEarnings() {
    try {
      setLoading(true);

      const stored = await getStoredCarrier();
      const { data: authData } = await supabase.auth.getUser();
      const authUser = authData?.user;

      const email = normalize(stored?.email || authUser?.email || "");

      if (!email) {
        router.replace(FREIGHT_ROUTES.login as any);
        return;
      }

      const { data: dbCarrier, error: carrierError } = await supabase
        .from("freight_users")
        .select("*")
        .eq("email", email)
        .maybeSingle();

      if (carrierError) {
        console.log("Freight earnings profile error:", carrierError.message);
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
        email: normalize(dbCarrier.email || email),
        role: "freight",
        companyName:
          dbCarrier.company_name ||
          dbCarrier.business_name ||
          stored?.companyName ||
          stored?.businessName ||
          stored?.contactName ||
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
        payoutsEnabled:
          dbCarrier.payouts_enabled ??
          dbCarrier.stripe_payouts_enabled ??
          stored?.payoutsEnabled ??
          false,
        chargesEnabled:
          dbCarrier.charges_enabled ??
          dbCarrier.stripe_charges_enabled ??
          stored?.chargesEnabled ??
          false,
        onboardingComplete:
          dbCarrier.stripe_onboarding_complete ??
          stored?.onboardingComplete ??
          false,
      };

      await persistCarrier(mergedCarrier);

      const carrierId = mergedCarrier.id;

      const { data, error } = await supabase
        .from("freight_loads")
        .select("*")
        .or(`carrier_id.eq.${carrierId},driver_id.eq.${carrierId},accepted_by.eq.${carrierId}`)
        .order("created_at", { ascending: false });

      if (error) {
        console.log("Freight earnings error:", error.message);
        setLoads([]);
        calculateStats([]);
        return;
      }

      const cloudLoads = Array.isArray(data) ? data : [];
      setLoads(cloudLoads);
      calculateStats(cloudLoads);
    } catch (error) {
      console.log("Freight earnings load crash:", error);
      Alert.alert("Earnings Error", "Unable to load freight earnings.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function calculateStats(items: FreightLoad[]) {
    const completed = items.filter((item) =>
      ["delivered", "completed"].includes(normalize(item.status))
    );

    const active = items.filter((item) =>
      ACTIVE_STATUSES.includes(normalize(item.status))
    );

    const now = new Date();

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);

    const totalEarnings = completed.reduce((sum, item) => sum + getRate(item), 0);

    const weeklyEarnings = completed
      .filter((item) => {
        const dateValue = item.delivered_at || item.updated_at || item.created_at;
        return dateValue ? new Date(dateValue) >= sevenDaysAgo : false;
      })
      .reduce((sum, item) => sum + getRate(item), 0);

    const monthlyEarnings = completed
      .filter((item) => {
        const dateValue = item.delivered_at || item.updated_at || item.created_at;
        return dateValue ? new Date(dateValue) >= thirtyDaysAgo : false;
      })
      .reduce((sum, item) => sum + getRate(item), 0);

    const totalMiles = completed.reduce((sum, item) => sum + getMiles(item), 0);

    const pendingPayouts = completed
      .filter((item) => normalize(item.payout_status || item.settlement_status) !== "paid")
      .reduce((sum, item) => sum + getRate(item), 0);

    const activePayouts = active.reduce((sum, item) => sum + getRate(item), 0);

    setStats({
      totalEarnings,
      weeklyEarnings,
      monthlyEarnings,
      completedLoads: completed.length,
      activeLoads: active.length,
      pendingPayouts,
      activePayouts,
      totalMiles,
      averageRate: completed.length > 0 ? totalEarnings / completed.length : 0,
    });
  }

  function onRefresh() {
    setRefreshing(true);
    loadEarnings();
  }

  function getRate(item: FreightLoad) {
    return Number(
      item.rate ||
        item.freight_total ||
        item.total_due ||
        item.payoutAmount ||
        item.payout_amount ||
        item.total ||
        0
    );
  }

  function getMiles(item: FreightLoad) {
    return Number(item.distance_miles || item.miles || item.estimated_miles || 0);
  }

  function formatMoney(value: number) {
    return `$${Number(value || 0).toFixed(2)}`;
  }

  function formatDate(value?: string | null) {
    if (!value) return "Pending";

    try {
      return new Date(value).toLocaleDateString();
    } catch {
      return "Pending";
    }
  }

  function statusLabel(status?: string) {
    return String(status || "unknown")
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function carrierName() {
    return (
      carrier?.companyName ||
      carrier?.businessName ||
      carrier?.ownerName ||
      carrier?.fullName ||
      carrier?.email ||
      "Freight Connect Carrier"
    );
  }

  function payoutStatus(item: FreightLoad) {
    return item.payout_status || item.settlement_status || "Pending";
  }

  function stripeStatusText() {
    if (carrier?.payoutsEnabled && carrier?.chargesEnabled && carrier?.onboardingComplete) {
      return "Payout Ready";
    }

    if (carrier?.stripeAccountId || carrier?.stripe_account_id) {
      return "Setup Incomplete";
    }

    return "Not Connected";
  }

  function stripeStatusColor() {
    if (carrier?.payoutsEnabled && carrier?.chargesEnabled && carrier?.onboardingComplete) {
      return COLORS.green;
    }

    if (carrier?.stripeAccountId || carrier?.stripe_account_id) {
      return COLORS.amber;
    }

    return COLORS.red;
  }

  function renderLoad({ item }: { item: FreightLoad }) {
    const paid = normalize(payoutStatus(item)) === "paid";

    return (
      <View style={styles.loadCard}>
        <View style={styles.loadHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.loadTitle}>{item.title || "Farm2Home Freight Load"}</Text>
            <Text style={styles.loadDate}>
              Delivered: {formatDate(item.delivered_at || item.updated_at)}
            </Text>
          </View>

          <View style={[styles.statusBadge, paid ? styles.paidBadge : styles.pendingBadge]}>
            <Text style={styles.statusText}>{payoutStatus(item)}</Text>
          </View>
        </View>

        <View style={styles.routeBox}>
          <View style={styles.routeStop}>
            <Ionicons name="radio-button-on" size={18} color={COLORS.red} />
            <Text style={styles.routeText}>
              {item.pickup_location || item.pickupLocation || "Pickup location"}
            </Text>
          </View>

          <View style={styles.routeLine} />

          <View style={styles.routeStop}>
            <Ionicons name="location" size={18} color={COLORS.red} />
            <Text style={styles.routeText}>
              {item.dropoff_location || item.dropoffLocation || "Dropoff location"}
            </Text>
          </View>
        </View>

        <View style={styles.metaGrid}>
          <View style={styles.metaBox}>
            <Text style={styles.metaLabel}>Payout</Text>
            <Text style={styles.metaValue}>{formatMoney(getRate(item))}</Text>
          </View>

          <View style={styles.metaBox}>
            <Text style={styles.metaLabel}>Miles</Text>
            <Text style={styles.metaValue}>{getMiles(item).toFixed(0)}</Text>
          </View>
        </View>

        <Text style={styles.detailText}>
          Status: {statusLabel(item.status)} · Farmer:{" "}
          {item.farmer_name || item.farmerName || "Farm2Home Farmer"}
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <View style={styles.loadingScreen}>
          <ActivityIndicator size="large" color={COLORS.red} />
          <Text style={styles.loadingText}>Loading freight earnings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />

      <View style={styles.container}>
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>Farm2Home Freight Connect</Text>
              <Text style={styles.title}>Freight Earnings</Text>
              <Text style={styles.subtitle}>
                Track carrier payouts, completed loads, route revenue, and settlement status.
              </Text>
            </View>

            <TouchableOpacity style={styles.heroIcon} onPress={() => goTo(FREIGHT_ROUTES.dashboard)}>
              <Ionicons name="cash-outline" size={34} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.navRow}>
          <TouchableOpacity style={styles.navButton} onPress={() => goTo(FREIGHT_ROUTES.dashboard)}>
            <Ionicons name="grid-outline" size={18} color="#FFFFFF" />
            <Text style={styles.navText}>Dashboard</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.navButtonOutline} onPress={() => goTo(FREIGHT_ROUTES.board)}>
            <Ionicons name="list-outline" size={18} color={COLORS.red} />
            <Text style={styles.navTextOutline}>Board</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <View style={styles.carrierCard}>
            <Text style={styles.carrierName}>🚛 {carrierName()}</Text>
            <Text style={styles.carrierMeta}>
              Earnings are calculated from delivered freight loads assigned to this carrier.
            </Text>

            <View style={[styles.stripePill, { backgroundColor: stripeStatusColor() }]}>
              <Text style={styles.stripePillText}>Stripe Connect: {stripeStatusText()}</Text>
            </View>
          </View>

          <View style={styles.statsGrid}>
            <StatCard label="Total Earnings" value={formatMoney(stats.totalEarnings)} icon="cash-outline" accent />
            <StatCard label="This Week" value={formatMoney(stats.weeklyEarnings)} icon="calendar-outline" accent />
            <StatCard label="This Month" value={formatMoney(stats.monthlyEarnings)} icon="trending-up-outline" />
            <StatCard label="Pending Payouts" value={formatMoney(stats.pendingPayouts)} icon="time-outline" />
            <StatCard label="Active Value" value={formatMoney(stats.activePayouts)} icon="navigate-outline" />
            <StatCard label="Completed Loads" value={String(stats.completedLoads)} icon="checkmark-done-outline" />
            <StatCard label="Active Loads" value={String(stats.activeLoads)} icon="navigate-outline" />
            <StatCard label="Total Miles" value={stats.totalMiles.toFixed(0)} icon="speedometer-outline" />
            <StatCard label="Avg Load Pay" value={formatMoney(stats.averageRate)} icon="analytics-outline" />
          </View>

          <View style={styles.settlementCard}>
            <View style={styles.settlementHeader}>
              <Ionicons name="receipt-outline" size={24} color="#FFFFFF" />
              <Text style={styles.settlementTitle}>Settlement Summary</Text>
            </View>

            <Text style={styles.settlementText}>
              Completed freight revenue: {formatMoney(stats.totalEarnings)}
            </Text>
            <Text style={styles.settlementText}>
              Active route value: {formatMoney(stats.activePayouts)}
            </Text>
            <Text style={styles.settlementText}>
              Pending payout estimate: {formatMoney(stats.pendingPayouts)}
            </Text>
            <Text style={styles.settlementText}>Completed loads: {stats.completedLoads}</Text>
            <Text style={styles.settlementNote}>
              Final payout timing depends on proof of delivery, admin review, Stripe processing,
              and dispute checks.
            </Text>
          </View>

          <View style={styles.actionGrid}>
            <TouchableOpacity style={styles.actionButton} onPress={() => goTo(FREIGHT_ROUTES.connectBank)}>
              <Ionicons name="business-outline" size={18} color="#FFFFFF" />
              <Text style={styles.actionText}>Connect Bank</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButtonOutline} onPress={loadEarnings}>
              <Ionicons name="refresh-outline" size={18} color={COLORS.red} />
              <Text style={styles.actionTextOutline}>Refresh</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.quickGrid}>
            <QuickLink icon="analytics-outline" label="Analytics" route={FREIGHT_ROUTES.analytics} />
            <QuickLink icon="briefcase-outline" label="My Loads" route={FREIGHT_ROUTES.myLoads} />
            <QuickLink icon="pulse-outline" label="Live Loads" route={FREIGHT_ROUTES.liveLoads} />
            <QuickLink icon="settings-outline" label="Settings" route={FREIGHT_ROUTES.settings} />
          </View>

          <Text style={styles.sectionTitle}>Completed Load Payments</Text>

          <FlatList
            data={completedLoads}
            keyExtractor={(item, index) => String(item.id || index)}
            scrollEnabled={false}
            contentContainerStyle={{ paddingBottom: 110 }}
            ListEmptyComponent={
              <View style={styles.emptyCard}>
                <Ionicons name="receipt-outline" size={38} color={COLORS.red} />
                <Text style={styles.emptyTitle}>No completed load payments yet.</Text>
                <Text style={styles.emptyText}>
                  Completed freight deliveries will appear here after delivery confirmation.
                </Text>
              </View>
            }
            renderItem={renderLoad}
          />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function StatCard({
  label,
  value,
  icon,
  accent = false,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent?: boolean;
}) {
  return (
    <View style={[styles.statCard, accent && styles.statCardAccent]}>
      <Ionicons name={icon} size={22} color={accent ? "#FFFFFF" : COLORS.red} />
      <Text style={[styles.statValue, accent && styles.statValueAccent]}>{value}</Text>
      <Text style={[styles.statLabel, accent && styles.statLabelAccent]}>{label}</Text>
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
      <Text style={styles.quickLinkText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  loadingScreen: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: COLORS.muted,
    marginTop: 10,
    fontWeight: "800",
  },
  container: { flex: 1, backgroundColor: COLORS.bg },
  hero: {
    backgroundColor: COLORS.black,
    paddingTop: 22,
    paddingHorizontal: 20,
    paddingBottom: 26,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
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
  },
  title: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900",
    marginBottom: 10,
  },
  subtitle: {
    color: "#D1D5DB",
    lineHeight: 23,
    fontSize: 15,
    fontWeight: "700",
  },
  navRow: {
    flexDirection: "row",
    gap: 10,
    padding: 18,
  },
  navButton: {
    flex: 1,
    backgroundColor: COLORS.red,
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  navButtonOutline: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.red,
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  navText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  navTextOutline: {
    color: COLORS.red,
    fontWeight: "900",
  },
  carrierCard: {
    backgroundColor: COLORS.card,
    marginHorizontal: 18,
    marginBottom: 14,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  carrierName: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 6,
  },
  carrierMeta: {
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 22,
  },
  stripePill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 12,
  },
  stripePillText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 12,
  },
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
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 14,
  },
  statCardAccent: {
    backgroundColor: COLORS.red,
    borderColor: COLORS.red,
  },
  statValue: {
    color: COLORS.red,
    fontSize: 22,
    fontWeight: "900",
    marginTop: 8,
  },
  statValueAccent: {
    color: "#FFFFFF",
  },
  statLabel: {
    color: COLORS.muted,
    fontWeight: "800",
    marginTop: 4,
  },
  statLabelAccent: {
    color: "#FFE4E6",
  },
  settlementCard: {
    backgroundColor: COLORS.black,
    marginHorizontal: 18,
    marginBottom: 16,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#374151",
  },
  settlementHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  settlementTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
  },
  settlementText: {
    color: "#FCA5A5",
    fontWeight: "800",
    marginBottom: 6,
    lineHeight: 22,
  },
  settlementNote: {
    color: "#D1D5DB",
    lineHeight: 22,
    marginTop: 8,
    fontWeight: "700",
  },
  actionGrid: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  actionButton: {
    flex: 1,
    backgroundColor: COLORS.red,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  actionButtonOutline: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.red,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  actionText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  actionTextOutline: {
    color: COLORS.red,
    fontWeight: "900",
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 18,
    marginBottom: 18,
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
  quickLinkText: {
    color: COLORS.text,
    fontWeight: "900",
    textAlign: "center",
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: "900",
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  loadCard: {
    backgroundColor: COLORS.card,
    marginHorizontal: 18,
    marginBottom: 16,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  loadHeader: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    marginBottom: 12,
  },
  loadTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "900",
  },
  loadDate: {
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  paidBadge: {
    backgroundColor: COLORS.green,
  },
  pendingBadge: {
    backgroundColor: COLORS.amber,
  },
  statusText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 11,
    textTransform: "capitalize",
  },
  routeBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  routeStop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  routeLine: {
    width: 2,
    height: 22,
    backgroundColor: COLORS.border,
    marginLeft: 8,
    marginVertical: 8,
  },
  routeText: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 15,
    flex: 1,
    lineHeight: 21,
  },
  metaGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  metaBox: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  metaLabel: {
    color: COLORS.muted,
    fontWeight: "900",
    marginBottom: 4,
  },
  metaValue: {
    color: COLORS.red,
    fontSize: 22,
    fontWeight: "900",
  },
  detailText: {
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 21,
  },
  emptyCard: {
    backgroundColor: COLORS.card,
    marginHorizontal: 18,
    marginBottom: 16,
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "900",
    marginTop: 10,
    marginBottom: 6,
  },
  emptyText: {
    color: COLORS.muted,
    lineHeight: 22,
    fontWeight: "700",
    textAlign: "center",
  },
});