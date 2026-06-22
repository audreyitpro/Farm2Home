// app/freight/earnings.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
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

  board: "/freight/board",
  myLoads: "/freight/my-loads",
  liveLoads: "/freight/live-loads",
  liveRoute: "/freight/live-route",
  routeDetails: "/freight/route-details",

  // FIX ADDED
  earnings: "/freight/earnings",

  connectBank: "/freight/connect-bank",
  settlements: "/freight/settlements",
  payoutCenter: "/freight/payout-center",
  analytics: "/freight/analytics",

  profile: "/freight/profile",
  settings: "/freight/settings",
  support: "/freight/support",
  help: "/freight/help",

  login: "/freight/login",
  register: "/freight/register",
} as const;

type FreightRoute = (typeof FREIGHT_ROUTES)[keyof typeof FREIGHT_ROUTES];
type FreightLoad = Record<string, any>;

const ACTIVE_STATUSES = [
  "assigned",
  "accepted",
  "booked",
  "arrived_pickup",
  "picked_up",
  "in_transit",
  "arrived_dropoff",
  "delayed",
];

const COMPLETE_STATUSES = ["delivered", "completed"];

const COLORS = {
  bg: "#F7F7FB",
  card: "#FFFFFF",
  panel: "#F8FAFC",
  text: "#0F172A",
  muted: "#64748B",
  border: "#E5E7EB",
  primary: "#6D5DFB",
  primarySoft: "#EEF2FF",
  green: "#10B981",
  greenSoft: "#ECFDF5",
  amber: "#F59E0B",
  amberSoft: "#FFFBEB",
  red: "#EF4444",
  redSoft: "#FEF2F2",
  blue: "#2563EB",
  navy: "#020617",
  slate: "#64748B",
  white: "#FFFFFF",
};

function clean(value: any) {
  return String(value ?? "").trim();
}

function normalize(value: any) {
  return clean(value).toLowerCase();
}

function isCus(value: any) {
  return clean(value).startsWith("cus_");
}

function isSub(value: any) {
  return clean(value).startsWith("sub_");
}

function isAcct(value: any) {
  return clean(value).startsWith("acct_");
}

function pickCus(...values: any[]) {
  const found = values.find((value) => isCus(value));
  return found ? clean(found) : "";
}

function pickSub(...values: any[]) {
  const found = values.find((value) => isSub(value));
  return found ? clean(found) : "";
}

function pickAcct(...values: any[]) {
  const found = values.find((value) => isAcct(value));
  return found ? clean(found) : "";
}

function boolValue(...values: any[]) {
  const found = values.find((value) => value !== undefined && value !== null);
  if (typeof found === "string") return ["true", "1", "yes", "enabled", "complete"].includes(normalize(found));
  return Boolean(found);
}

function isActiveStatus(status: any) {
  return ["active", "trialing", "past_due"].includes(normalize(status));
}

function money(value: any) {
  return `$${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function shortId(value?: string) {
  const id = clean(value);
  if (!id) return "Missing";
  if (id.length <= 16) return id;
  return `${id.slice(0, 8)}...${id.slice(-5)}`;
}

function goTo(route: FreightRoute) {
  router.push(route as any);
}

function getRate(item: FreightLoad) {
  return Number(
    item.rate ||
      item.freight_total ||
      item.total_due ||
      item.payoutAmount ||
      item.payout_amount ||
      item.driver_payout ||
      item.carrier_payout ||
      item.total ||
      0
  );
}

function getMiles(item: FreightLoad) {
  return Number(item.distance_miles || item.miles || item.estimated_miles || 0);
}

function formatDate(value?: string | null) {
  if (!value) return "Pending";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Pending";
  return date.toLocaleDateString();
}

function statusLabel(status?: string) {
  return String(status || "unknown")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function payoutStatus(item: FreightLoad) {
  return item.payout_status || item.settlement_status || "pending";
}

function payoutIsPaid(item: FreightLoad) {
  return ["paid", "complete", "completed", "settled"].includes(normalize(payoutStatus(item)));
}

export default function FreightEarningsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [carrier, setCarrier] = useState<any>(null);
  const [loads, setLoads] = useState<FreightLoad[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadEarnings();
    }, [])
  );

  const stripeCustomerId = useMemo(
    () => pickCus(carrier?.stripeCustomerId, carrier?.stripe_customer_id, carrier?.stripeId, carrier?.stripe_id),
    [carrier]
  );

  const stripeSubscriptionId = useMemo(
    () => pickSub(carrier?.stripeSubscriptionId, carrier?.stripe_subscription_id, carrier?.subscriptionId, carrier?.subscription_id),
    [carrier]
  );

  const stripeAccountId = useMemo(
    () => pickAcct(carrier?.stripeAccountId, carrier?.stripe_account_id, carrier?.freightAccount, carrier?.freight_account),
    [carrier]
  );

  const payoutsReady = useMemo(
    () => boolValue(carrier?.payoutsEnabled, carrier?.payouts_enabled, carrier?.stripe_payouts_enabled),
    [carrier]
  );

  const chargesReady = useMemo(
    () => boolValue(carrier?.chargesEnabled, carrier?.charges_enabled, carrier?.stripe_charges_enabled),
    [carrier]
  );

  const onboardingReady = useMemo(
    () => boolValue(carrier?.onboardingComplete, carrier?.stripe_onboarding_complete),
    [carrier]
  );

  const completedLoads = useMemo(
    () => loads.filter((item) => COMPLETE_STATUSES.includes(normalize(item.status))),
    [loads]
  );

  const activeLoads = useMemo(
    () => loads.filter((item) => ACTIVE_STATUSES.includes(normalize(item.status))),
    [loads]
  );

  const stats = useMemo(() => {
    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);

    const totalEarnings = completedLoads.reduce((sum, item) => sum + getRate(item), 0);

    const weeklyEarnings = completedLoads
      .filter((item) => {
        const dateValue = item.delivered_at || item.updated_at || item.created_at;
        return dateValue ? new Date(dateValue) >= sevenDaysAgo : false;
      })
      .reduce((sum, item) => sum + getRate(item), 0);

    const monthlyEarnings = completedLoads
      .filter((item) => {
        const dateValue = item.delivered_at || item.updated_at || item.created_at;
        return dateValue ? new Date(dateValue) >= thirtyDaysAgo : false;
      })
      .reduce((sum, item) => sum + getRate(item), 0);

    const totalMiles = completedLoads.reduce((sum, item) => sum + getMiles(item), 0);

    const pendingPayouts = completedLoads
      .filter((item) => !payoutIsPaid(item))
      .reduce((sum, item) => sum + getRate(item), 0);

    const paidPayouts = completedLoads
      .filter((item) => payoutIsPaid(item))
      .reduce((sum, item) => sum + getRate(item), 0);

    const activePayouts = activeLoads.reduce((sum, item) => sum + getRate(item), 0);

    const heldPayouts = completedLoads
      .filter((item) => ["hold", "held", "review", "pending_review"].includes(normalize(payoutStatus(item))))
      .reduce((sum, item) => sum + getRate(item), 0);

    return {
      totalEarnings,
      weeklyEarnings,
      monthlyEarnings,
      completedLoads: completedLoads.length,
      activeLoads: activeLoads.length,
      pendingPayouts,
      paidPayouts,
      activePayouts,
      heldPayouts,
      totalMiles,
      averageRate: completedLoads.length > 0 ? totalEarnings / completedLoads.length : 0,
      averageRatePerMile: totalMiles > 0 ? totalEarnings / totalMiles : 0,
    };
  }, [completedLoads, activeLoads]);

  const setupScore = useMemo(() => {
    let score = 0;
    if (carrier?.id || carrier?.freightId || carrier?.freight_id) score += 20;
    if (stripeCustomerId) score += 20;
    if (stripeSubscriptionId) score += 20;
    if (stripeAccountId) score += 20;
    if (payoutsReady && chargesReady && onboardingReady) score += 20;
    return score;
  }, [carrier, stripeCustomerId, stripeSubscriptionId, stripeAccountId, payoutsReady, chargesReady, onboardingReady]);

  async function getStoredCarrier() {
    const raw =
      (await AsyncStorage.getItem("currentFreightCarrier")) ||
      (await AsyncStorage.getItem("currentFreight")) ||
      (await AsyncStorage.getItem("currentFreightUser")) ||
      (await AsyncStorage.getItem("farm2homeCurrentFreight")) ||
      (await AsyncStorage.getItem("currentUser"));

    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async function saveFreightSession(nextCarrier: any) {
    await AsyncStorage.setItem("currentFreight", JSON.stringify(nextCarrier));
    await AsyncStorage.setItem("currentFreightCarrier", JSON.stringify(nextCarrier));
    await AsyncStorage.setItem("currentFreightUser", JSON.stringify(nextCarrier));
    await AsyncStorage.setItem("farm2homeCurrentFreight", JSON.stringify(nextCarrier));
    await AsyncStorage.setItem("currentUser", JSON.stringify(nextCarrier));
    await AsyncStorage.setItem("userRole", "freight");
    await AsyncStorage.setItem("currentUserRole", "freight");
  }

  async function findSubscription(freightId: string, email: string) {
    const filters = [freightId ? `freight_id.eq.${freightId}` : "", email ? `freight_email.eq.${email}` : ""]
      .filter(Boolean)
      .join(",");

    if (!filters) return null;

    const { data, error } = await supabase
      .from("freight_subscriptions")
      .select("*")
      .or(filters)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (error) {
      console.log("Freight earnings subscription lookup error:", error.message);
      return null;
    }

    return Array.isArray(data) && data.length > 0 ? data[0] : null;
  }

  function buildMergedCarrier(row: any, sub: any = {}, stored: any = {}) {
    const realId = clean(
      row?.id ||
        row?.freight_id ||
        sub?.freight_id ||
        stored?.id ||
        stored?.freightId ||
        stored?.freight_id
    );

    const customerId = pickCus(
      row?.stripe_customer_id,
      row?.stripe_id,
      sub?.stripe_customer_id,
      stored?.stripeCustomerId,
      stored?.stripe_customer_id,
      stored?.stripeId,
      stored?.stripe_id
    );

    const subscriptionId = pickSub(
      row?.stripe_subscription_id,
      row?.subscription_id,
      sub?.stripe_subscription_id,
      stored?.stripeSubscriptionId,
      stored?.stripe_subscription_id,
      stored?.subscriptionId,
      stored?.subscription_id
    );

    const connectAccount = pickAcct(
      row?.stripe_account_id,
      row?.freight_account,
      sub?.stripe_account_id,
      sub?.freight_account,
      stored?.stripeAccountId,
      stored?.stripe_account_id,
      stored?.freightAccount,
      stored?.freight_account
    );

    const subStatus =
      row?.subscription_status ||
      sub?.subscription_status ||
      row?.membership_status ||
      stored?.subscriptionStatus ||
      stored?.subscription_status ||
      stored?.membershipStatus ||
      "not_started";

    const company =
      row?.company_name ||
      row?.business_name ||
      sub?.name ||
      stored?.companyName ||
      stored?.businessName ||
      "Farm2Home Freight Carrier";

    return {
      ...(stored || {}),
      ...(row || {}),
      id: realId,
      freightId: realId,
      freight_id: realId,
      role: "freight",
      accountId: clean(row?.account_id || stored?.accountId || stored?.account_id || ""),
      account_id: clean(row?.account_id || stored?.account_id || stored?.accountId || ""),
      companyName: company,
      company_name: company,
      businessName: row?.business_name || row?.company_name || company,
      business_name: row?.business_name || row?.company_name || company,
      contactName: row?.contact_name || row?.name || stored?.contactName || stored?.contact_name || "",
      contact_name: row?.contact_name || row?.name || stored?.contact_name || stored?.contactName || "",
      username: row?.username || sub?.username || stored?.username || "",
      email: normalize(row?.email || sub?.freight_email || stored?.email || ""),
      phone: row?.phone || stored?.phone || "",
      membershipStatus: row?.membership_status || subStatus,
      membership_status: row?.membership_status || subStatus,
      subscriptionStatus: subStatus,
      subscription_status: subStatus,
      accountActive: Boolean(row?.account_active ?? stored?.accountActive ?? isActiveStatus(subStatus)),
      account_active: Boolean(row?.account_active ?? stored?.account_active ?? isActiveStatus(subStatus)),
      stripeCustomerId: customerId,
      stripe_customer_id: customerId,
      stripeId: customerId,
      stripe_id: customerId,
      stripeSubscriptionId: subscriptionId,
      stripe_subscription_id: subscriptionId,
      subscriptionId,
      subscription_id: subscriptionId,
      stripeAccountId: connectAccount,
      stripe_account_id: connectAccount,
      freightAccount: connectAccount,
      freight_account: connectAccount,
      stripeConnectStatus: row?.stripe_connect_status || stored?.stripeConnectStatus || stored?.stripe_connect_status || (connectAccount ? "started" : "not_started"),
      stripe_connect_status: row?.stripe_connect_status || stored?.stripe_connect_status || stored?.stripeConnectStatus || (connectAccount ? "started" : "not_started"),
      payoutsEnabled: boolValue(row?.payouts_enabled, row?.stripe_payouts_enabled, stored?.payoutsEnabled, stored?.payouts_enabled),
      payouts_enabled: boolValue(row?.payouts_enabled, row?.stripe_payouts_enabled, stored?.payoutsEnabled, stored?.payouts_enabled),
      stripe_payouts_enabled: boolValue(row?.stripe_payouts_enabled, row?.payouts_enabled, stored?.stripe_payouts_enabled),
      chargesEnabled: boolValue(row?.charges_enabled, row?.stripe_charges_enabled, stored?.chargesEnabled, stored?.charges_enabled),
      charges_enabled: boolValue(row?.charges_enabled, row?.stripe_charges_enabled, stored?.chargesEnabled, stored?.charges_enabled),
      stripe_charges_enabled: boolValue(row?.stripe_charges_enabled, row?.charges_enabled, stored?.stripe_charges_enabled),
      onboardingComplete: boolValue(row?.stripe_onboarding_complete, stored?.onboardingComplete),
      stripe_onboarding_complete: boolValue(row?.stripe_onboarding_complete, stored?.stripe_onboarding_complete, stored?.onboardingComplete),
      current_period_end: row?.current_period_end || sub?.current_period_end || stored?.current_period_end || null,
      updatedAt: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  async function loadEarnings() {
    try {
      setLoading(true);

      const stored = await getStoredCarrier();
      const { data: authData } = await supabase.auth.getUser();
      const authUser = authData?.user;

      const authId = clean(authUser?.id || "");
      const storedId = clean(stored?.id || stored?.freightId || stored?.freight_id || "");
      const email = normalize(stored?.email || authUser?.email || "");
      const accountId = clean(stored?.accountId || stored?.account_id || "");

      if (!email && !authId && !storedId && !accountId) {
        router.replace(FREIGHT_ROUTES.login as any);
        return;
      }

      const profileFilters = [
        authId ? `id.eq.${authId}` : "",
        authId ? `auth_user_id.eq.${authId}` : "",
        authId ? `profile_id.eq.${authId}` : "",
        authId ? `freight_id.eq.${authId}` : "",
        storedId ? `id.eq.${storedId}` : "",
        storedId ? `freight_id.eq.${storedId}` : "",
        email ? `email.eq.${email}` : "",
        accountId ? `account_id.eq.${accountId}` : "",
      ]
        .filter(Boolean)
        .join(",");

      const { data: dbRows, error: carrierError } = await supabase
        .from("freight_users")
        .select("*")
        .or(profileFilters)
        .limit(1);

      if (carrierError) console.log("Freight earnings profile error:", carrierError.message);

      const dbCarrier = Array.isArray(dbRows) && dbRows.length > 0 ? dbRows[0] : null;

      if (!dbCarrier) {
        Alert.alert("Freight Profile Missing", "No freight profile was found. Please complete freight registration first.");
        router.replace(FREIGHT_ROUTES.register as any);
        return;
      }

      const sub = await findSubscription(dbCarrier.id || storedId || authId, normalize(dbCarrier.email || email));
      const mergedCarrier = buildMergedCarrier(dbCarrier, sub, stored);

      await saveFreightSession(mergedCarrier);
      setCarrier(mergedCarrier);

      const { data, error } = await supabase
        .from("freight_loads")
        .select("*")
        .or(
          `carrier_id.eq.${mergedCarrier.id},freight_user_id.eq.${mergedCarrier.id},driver_id.eq.${mergedCarrier.id},accepted_by.eq.${mergedCarrier.id}`
        )
        .order("created_at", { ascending: false });

      if (error) {
        console.log("Freight earnings loads error:", error.message);
        setLoads([]);
        return;
      }

      setLoads(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.log("Freight earnings load crash:", error);
      Alert.alert("Earnings Error", error?.message || "Unable to load freight earnings.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function onRefresh() {
    setRefreshing(true);
    loadEarnings();
  }

  function carrierName() {
    return (
      carrier?.companyName ||
      carrier?.businessName ||
      carrier?.ownerName ||
      carrier?.fullName ||
      carrier?.email ||
      "Farm2Home Freight Carrier"
    );
  }

  function stripeStatusText() {
    if (payoutsReady && chargesReady && onboardingReady) return "Payout Ready";
    if (stripeAccountId) return "Setup Incomplete";
    return "Not Connected";
  }

  function stripeStatusColor() {
    if (payoutsReady && chargesReady && onboardingReady) return COLORS.green;
    if (stripeAccountId) return COLORS.amber;
    return COLORS.red;
  }

  function membershipColor() {
    const status = normalize(carrier?.membershipStatus || carrier?.subscriptionStatus);

    if (status.includes("cancel") || status.includes("unpaid") || status.includes("incomplete")) return COLORS.red;
    if (status.includes("pending") || status.includes("past_due")) return COLORS.amber;
    if (status.includes("active") || status.includes("trial")) return COLORS.green;

    return COLORS.amber;
  }

  function renderLoad({ item }: { item: FreightLoad }) {
    const paid = payoutIsPaid(item);

    return (
      <TouchableOpacity
        style={styles.loadCard}
        onPress={() =>
          router.push({
            pathname: FREIGHT_ROUTES.routeDetails as any,
            params: { loadId: item.id },
          })
        }
        activeOpacity={0.86}
      >
        <View style={styles.loadHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.loadTitle}>{item.title || item.commodity || "Farm2Home Freight Load"}</Text>
            <Text style={styles.loadDate}>Delivered: {formatDate(item.delivered_at || item.updated_at)}</Text>
          </View>

          <View style={[styles.statusBadge, paid ? styles.paidBadge : styles.pendingBadge]}>
            <Text style={styles.statusText}>{statusLabel(payoutStatus(item))}</Text>
          </View>
        </View>

        <View style={styles.routeBox}>
          <View style={styles.routeStop}>
            <Ionicons name="radio-button-on" size={18} color={COLORS.primary} />
            <Text style={styles.routeText}>{item.pickup_location || item.pickupLocation || "Pickup location"}</Text>
          </View>

          <View style={styles.routeLine} />

          <View style={styles.routeStop}>
            <Ionicons name="location" size={18} color={COLORS.primary} />
            <Text style={styles.routeText}>{item.dropoff_location || item.dropoffLocation || "Dropoff location"}</Text>
          </View>
        </View>

        <View style={styles.metaGrid}>
          <View style={styles.metaBox}>
            <Text style={styles.metaLabel}>Payout</Text>
            <Text style={styles.metaValue}>{money(getRate(item))}</Text>
          </View>

          <View style={styles.metaBox}>
            <Text style={styles.metaLabel}>Miles</Text>
            <Text style={styles.metaValue}>{getMiles(item).toFixed(0)}</Text>
          </View>

          <View style={styles.metaBox}>
            <Text style={styles.metaLabel}>Rate/Mile</Text>
            <Text style={styles.metaValue}>{getMiles(item) > 0 ? money(getRate(item) / getMiles(item)) : "$0.00"}</Text>
          </View>
        </View>

        <Text style={styles.detailText}>
          Status: {statusLabel(item.status)} · Farmer: {item.farmer_name || item.farmerName || "Farm2Home Farmer"}
        </Text>
      </TouchableOpacity>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />
        <View style={styles.loadingScreen}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading freight earnings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />

      <View style={styles.shell}>
        <View style={styles.sidebar}>
          <View style={styles.brandRow}>
            <View style={styles.brandIcon}>
              <Ionicons name="cash-outline" size={28} color={COLORS.white} />
            </View>
            <View>
              <Text style={styles.brandTitle}>Farm2Home</Text>
              <Text style={styles.brandSubtitle}>Earnings</Text>
            </View>
          </View>

          <View style={styles.sideDivider} />

          <SidebarLink icon="grid-outline" title="Dashboard" route={FREIGHT_ROUTES.dashboard} />
          <SidebarLink icon="apps-outline" title="Management Center" route={FREIGHT_ROUTES.managementCenter} />
          <SidebarLink icon="list-outline" title="Load Board" route={FREIGHT_ROUTES.board} />
          <SidebarLink icon="briefcase-outline" title="My Loads" route={FREIGHT_ROUTES.myLoads} />
          <SidebarLink icon="cash-outline" title="Earnings" active route={FREIGHT_ROUTES.earnings} />
          <SidebarLink icon="business-outline" title="Connect Bank" route={FREIGHT_ROUTES.connectBank} />

          <View style={styles.carrierPanel}>
            <Text style={styles.carrierLabel}>Carrier</Text>
            <Text style={styles.carrierNameSide} numberOfLines={1}>{carrierName()}</Text>
            <Text style={styles.carrierSub} numberOfLines={1}>{carrier?.accountId || carrier?.account_id || "Account pending"}</Text>
          </View>
        </View>

        <View style={styles.main}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            contentContainerStyle={styles.content}
          >
            <View style={styles.topPanel}>
              <View style={{ flex: 1 }}>
                <Text style={styles.eyebrow}>Fina Admin Financial Center</Text>
                <Text style={styles.pageTitle}>Freight Earnings</Text>
                <Text style={styles.pageSubtitle}>
                  Track completed loads, active route value, pending payouts, paid settlements, miles, and payout readiness.
                </Text>
              </View>

              <TouchableOpacity style={styles.topButton} onPress={() => goTo(FREIGHT_ROUTES.dashboard)}>
                <Ionicons name="grid-outline" size={22} color={COLORS.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.profilePanel}>
              <View style={styles.profileAvatar}>
                <Ionicons name="business-outline" size={28} color={COLORS.white} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.companyName}>{carrierName()}</Text>
                <Text style={styles.companyEmail}>{carrier?.email || "Carrier workspace"}</Text>
                <Text style={styles.accountId}>Account ID: {carrier?.accountId || carrier?.account_id || "Not assigned"}</Text>
              </View>

              <View style={styles.profilePills}>
                <View style={[styles.statusMini, { backgroundColor: membershipColor() }]}>
                  <Text style={styles.statusMiniText}>{carrier?.membershipStatus || carrier?.subscriptionStatus || "not_started"}</Text>
                </View>
                <View style={[styles.statusMini, { backgroundColor: stripeStatusColor() }]}>
                  <Text style={styles.statusMiniText}>{stripeStatusText()}</Text>
                </View>
              </View>
            </View>

            <View style={styles.metricGrid}>
              <MetricCard label="Total Earnings" value={money(stats.totalEarnings)} icon="cash-outline" ready />
              <MetricCard label="This Week" value={money(stats.weeklyEarnings)} icon="calendar-outline" ready />
              <MetricCard label="This Month" value={money(stats.monthlyEarnings)} icon="trending-up-outline" ready />
              <MetricCard label="Paid" value={money(stats.paidPayouts)} icon="checkmark-done-outline" ready />
              <MetricCard label="Pending" value={money(stats.pendingPayouts)} icon="time-outline" ready={stats.pendingPayouts === 0} />
              <MetricCard label="On Hold" value={money(stats.heldPayouts)} icon="pause-circle-outline" ready={stats.heldPayouts === 0} />
            </View>

            <View style={styles.metricGrid}>
              <MetricCard label="Active Value" value={money(stats.activePayouts)} icon="navigate-outline" ready={stats.activePayouts > 0} />
              <MetricCard label="Completed Loads" value={String(stats.completedLoads)} icon="cube-outline" ready={stats.completedLoads > 0} />
              <MetricCard label="Active Loads" value={String(stats.activeLoads)} icon="pulse-outline" ready={stats.activeLoads > 0} />
              <MetricCard label="Total Miles" value={stats.totalMiles.toFixed(0)} icon="speedometer-outline" ready={stats.totalMiles > 0} />
              <MetricCard label="Avg Load Pay" value={money(stats.averageRate)} icon="analytics-outline" ready={stats.averageRate > 0} />
              <MetricCard label="Avg Rate/Mile" value={money(stats.averageRatePerMile)} icon="speedometer-outline" ready={stats.averageRatePerMile > 0} />
            </View>

            <View style={styles.card}>
              <SectionHeader
                icon="server-outline"
                title="Stripe & Payout IDs"
                subtitle="Saved values used for subscription, Connect Bank, and payout readiness."
              />

              <View style={styles.idGrid}>
                <IdRow label="Freight UUID" value={carrier?.id || carrier?.freightId || ""} />
                <IdRow label="Static Account ID" value={carrier?.accountId || carrier?.account_id || ""} />
                <IdRow label="Stripe Customer" value={shortId(stripeCustomerId)} />
                <IdRow label="Stripe Subscription" value={shortId(stripeSubscriptionId)} />
                <IdRow label="Connect Account" value={shortId(stripeAccountId)} />
                <IdRow label="Connect Status" value={carrier?.stripeConnectStatus || carrier?.stripe_connect_status || ""} />
              </View>
            </View>

            <View style={styles.settlementCard}>
              <View style={styles.settlementHeader}>
                <Ionicons name="receipt-outline" size={24} color={COLORS.white} />
                <Text style={styles.settlementTitle}>Settlement Summary</Text>
              </View>

              <Text style={styles.settlementText}>Completed freight revenue: {money(stats.totalEarnings)}</Text>
              <Text style={styles.settlementText}>Active route value: {money(stats.activePayouts)}</Text>
              <Text style={styles.settlementText}>Pending payout estimate: {money(stats.pendingPayouts)}</Text>
              <Text style={styles.settlementText}>Completed loads: {stats.completedLoads}</Text>
              <Text style={styles.settlementNote}>
                Final payout timing depends on proof of delivery, issue checks, settlement status, and Stripe processing.
              </Text>
            </View>

            <View style={styles.actionGrid}>
              <ActionButton icon="business-outline" label="Connect Bank" onPress={() => goTo(FREIGHT_ROUTES.connectBank)} primary />
              <ActionButton icon="wallet-outline" label="Settlements" onPress={() => goTo(FREIGHT_ROUTES.settlements)} />
              <ActionButton icon="cash-outline" label="Payout Center" onPress={() => goTo(FREIGHT_ROUTES.payoutCenter)} />
              <ActionButton icon="analytics-outline" label="Analytics" onPress={() => goTo(FREIGHT_ROUTES.analytics)} />
              <ActionButton icon="briefcase-outline" label="My Loads" onPress={() => goTo(FREIGHT_ROUTES.myLoads)} />
              <ActionButton icon="refresh-outline" label="Refresh" onPress={loadEarnings} />
            </View>

            <Text style={styles.sectionTitle}>Completed Load Payments</Text>

            <FlatList
              data={completedLoads}
              keyExtractor={(item, index) => String(item.id || index)}
              scrollEnabled={false}
              contentContainerStyle={{ paddingBottom: 40 }}
              ListEmptyComponent={
                <View style={styles.emptyCard}>
                  <Ionicons name="receipt-outline" size={38} color={COLORS.primary} />
                  <Text style={styles.emptyTitle}>No completed load payments yet.</Text>
                  <Text style={styles.emptyText}>
                    Completed freight deliveries will appear here after delivery confirmation.
                  </Text>

                  <TouchableOpacity style={styles.emptyButton} onPress={() => goTo(FREIGHT_ROUTES.board)}>
                    <Ionicons name="list-outline" size={18} color={COLORS.white} />
                    <Text style={styles.emptyButtonText}>Open Freight Board</Text>
                  </TouchableOpacity>
                </View>
              }
              renderItem={renderLoad}
            />
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

function SidebarLink({
  icon,
  title,
  route,
  active,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  route: FreightRoute;
  active?: boolean;
}) {
  return (
    <TouchableOpacity style={[styles.sidebarLink, active && styles.sidebarLinkActive]} onPress={() => goTo(route)}>
      <Ionicons name={icon} size={18} color={active ? COLORS.white : "#A5B4FC"} />
      <Text style={[styles.sidebarLinkText, active && styles.sidebarLinkTextActive]}>{title}</Text>
    </TouchableOpacity>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIcon}>
        <Ionicons name={icon} size={20} color={COLORS.white} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.sectionHeaderTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

function MetricCard({
  label,
  value,
  icon,
  ready,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  ready: boolean;
}) {
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricIcon, ready ? styles.metricGood : styles.metricWarn]}>
        <Ionicons name={icon} size={21} color={ready ? COLORS.green : COLORS.amber} />
      </View>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function IdRow({ label, value }: { label: string; value?: string }) {
  return (
    <View style={styles.idRow}>
      <Text style={styles.idLabel}>{label}</Text>
      <Text style={[styles.idValue, !value && styles.idMissing]} numberOfLines={1}>
        {value || "Missing"}
      </Text>
    </View>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  primary,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <TouchableOpacity style={primary ? styles.primaryActionButton : styles.actionButton} onPress={onPress}>
      <Ionicons name={icon} size={18} color={primary ? COLORS.white : COLORS.primary} />
      <Text style={primary ? styles.primaryActionText : styles.actionText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  loadingScreen: { flex: 1, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center" },
  loadingText: { color: COLORS.muted, marginTop: 10, fontWeight: "800" },
  shell: {
    flex: 1,
    flexDirection: Platform.OS === "web" ? "row" : "column",
    backgroundColor: COLORS.bg,
  },
  sidebar: {
    backgroundColor: COLORS.navy,
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 22,
    width: Platform.OS === "web" ? 310 : "100%",
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  brandIcon: { width: 54, height: 54, borderRadius: 20, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  brandTitle: { color: COLORS.white, fontSize: 21, fontWeight: "900" },
  brandSubtitle: { color: "#A5B4FC", fontWeight: "800", marginTop: 2 },
  sideDivider: { height: 1, backgroundColor: "#1E293B", marginVertical: 22 },
  sidebarLink: { borderRadius: 16, paddingVertical: 13, paddingHorizontal: 14, flexDirection: "row", gap: 10, alignItems: "center", marginBottom: 8 },
  sidebarLinkActive: { backgroundColor: COLORS.primary },
  sidebarLinkText: { color: "#CBD5E1", fontWeight: "900" },
  sidebarLinkTextActive: { color: COLORS.white },
  carrierPanel: { backgroundColor: "#0F172A", borderWidth: 1, borderColor: "#1E293B", borderRadius: 18, padding: 14, marginTop: 12 },
  carrierLabel: { color: "#A5B4FC", fontWeight: "900", textTransform: "uppercase", fontSize: 11 },
  carrierNameSide: { color: COLORS.white, fontWeight: "900", marginTop: 6 },
  carrierSub: { color: "#CBD5E1", fontWeight: "700", marginTop: 4 },
  main: { flex: 1, padding: 18 },
  content: { paddingBottom: 90 },
  topPanel: {
    backgroundColor: COLORS.white,
    borderRadius: 26,
    padding: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    gap: 14,
    alignItems: "flex-start",
    marginBottom: 14,
  },
  topButton: { width: 50, height: 50, borderRadius: 18, backgroundColor: COLORS.primarySoft, alignItems: "center", justifyContent: "center" },
  eyebrow: { color: COLORS.primary, fontWeight: "900", fontSize: 12, letterSpacing: 1, textTransform: "uppercase" },
  pageTitle: { color: COLORS.text, fontSize: 34, fontWeight: "900", marginTop: 6 },
  pageSubtitle: { color: COLORS.muted, fontWeight: "700", lineHeight: 22, marginTop: 7, maxWidth: 760 },
  profilePanel: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    gap: 13,
    alignItems: "center",
    marginBottom: 14,
  },
  profileAvatar: { width: 58, height: 58, borderRadius: 22, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  companyName: { color: COLORS.text, fontSize: 20, fontWeight: "900" },
  companyEmail: { color: COLORS.muted, fontWeight: "700", marginTop: 4 },
  accountId: { color: COLORS.muted, fontWeight: "800", marginTop: 4, fontSize: 12 },
  profilePills: { gap: 8, alignItems: "flex-end" },
  statusMini: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8 },
  statusMiniText: { color: COLORS.white, fontWeight: "900", fontSize: 12, textTransform: "capitalize" },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 14 },
  metricCard: {
    width: Platform.OS === "web" ? "15.55%" : "48%",
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 22,
    padding: 16,
  },
  metricIcon: { width: 42, height: 42, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  metricGood: { backgroundColor: COLORS.greenSoft },
  metricWarn: { backgroundColor: COLORS.amberSoft },
  metricLabel: { color: COLORS.muted, fontWeight: "900", fontSize: 11, textTransform: "uppercase" },
  metricValue: { color: COLORS.text, fontWeight: "900", fontSize: 18, marginTop: 5 },
  card: { backgroundColor: COLORS.white, borderRadius: 22, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border },
  sectionHeader: { flexDirection: "row", gap: 10, alignItems: "flex-start", marginBottom: 14 },
  sectionIcon: { width: 40, height: 40, borderRadius: 16, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  sectionHeaderTitle: { color: COLORS.text, fontSize: 21, fontWeight: "900" },
  sectionSubtitle: { color: COLORS.muted, fontWeight: "700", lineHeight: 20, marginTop: 3 },
  idGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  idRow: { width: Platform.OS === "web" ? "31.5%" : "100%", backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, padding: 13 },
  idLabel: { color: COLORS.muted, fontWeight: "900", textTransform: "uppercase", fontSize: 11 },
  idValue: { color: COLORS.text, fontWeight: "900", marginTop: 5 },
  idMissing: { color: COLORS.amber },
  settlementCard: { backgroundColor: COLORS.navy, marginBottom: 16, borderRadius: 22, padding: 18 },
  settlementHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  settlementTitle: { color: COLORS.white, fontSize: 22, fontWeight: "900" },
  settlementText: { color: "#C7D2FE", fontWeight: "800", marginBottom: 6, lineHeight: 22 },
  settlementNote: { color: "#D1D5DB", lineHeight: 22, marginTop: 8, fontWeight: "700" },
  actionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 18 },
  primaryActionButton: {
    width: Platform.OS === "web" ? "31.5%" : "48%",
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    width: Platform.OS === "web" ? "31.5%" : "48%",
    backgroundColor: COLORS.primarySoft,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryActionText: { color: COLORS.white, fontWeight: "900" },
  actionText: { color: COLORS.primary, fontWeight: "900" },
  sectionTitle: { color: COLORS.text, fontSize: 24, fontWeight: "900", marginBottom: 12 },
  loadCard: { backgroundColor: COLORS.white, marginBottom: 16, borderRadius: 22, padding: 18, borderWidth: 1, borderColor: COLORS.border },
  loadHeader: { flexDirection: "row", gap: 12, alignItems: "flex-start", marginBottom: 12 },
  loadTitle: { color: COLORS.text, fontSize: 20, fontWeight: "900" },
  loadDate: { color: COLORS.muted, fontWeight: "700", marginTop: 4 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  paidBadge: { backgroundColor: COLORS.green },
  pendingBadge: { backgroundColor: COLORS.amber },
  statusText: { color: COLORS.white, fontWeight: "900", fontSize: 11, textTransform: "capitalize" },
  routeBox: { backgroundColor: COLORS.panel, borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  routeStop: { flexDirection: "row", alignItems: "center", gap: 10 },
  routeLine: { width: 2, height: 22, backgroundColor: COLORS.border, marginLeft: 8, marginVertical: 8 },
  routeText: { color: COLORS.text, fontWeight: "900", fontSize: 15, flex: 1, lineHeight: 21 },
  metaGrid: { flexDirection: Platform.OS === "web" ? "row" : "column", gap: 12, marginBottom: 12 },
  metaBox: { flex: 1, backgroundColor: COLORS.panel, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: COLORS.border },
  metaLabel: { color: COLORS.muted, fontWeight: "900", marginBottom: 4 },
  metaValue: { color: COLORS.primary, fontSize: 22, fontWeight: "900" },
  detailText: { color: COLORS.muted, fontWeight: "700", lineHeight: 21 },
  emptyCard: { backgroundColor: COLORS.white, marginBottom: 16, padding: 24, borderRadius: 22, borderWidth: 1, borderColor: COLORS.border, alignItems: "center" },
  emptyTitle: { color: COLORS.text, fontSize: 20, fontWeight: "900", marginTop: 10, marginBottom: 6 },
  emptyText: { color: COLORS.muted, lineHeight: 22, fontWeight: "700", textAlign: "center" },
  emptyButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 14,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  emptyButtonText: { color: COLORS.white, fontWeight: "900" },
});
