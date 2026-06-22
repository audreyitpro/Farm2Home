// app/freight/freight-management-center.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
  postLoad: "/freight/post-load",
  createLoad: "/freight/create-load",
  myLoads: "/freight/my-loads",
  liveLoads: "/freight/live-loads",
  liveRoute: "/freight/live-route",
  routeDetails: "/freight/route-details",
  routeExceptions: "/freight/route-exceptions",
  loadIssues: "/freight/load-issues",
  loadChat: "/freight/load-chat",
  dispatchAlerts: "/freight/dispatch-alerts",
  communicationCenter: "/freight/communication-center",
  deliveryHistory: "/freight/delivery-history",
  proofOfPickup: "/freight/proof-of-pickup",
  proofOfDelivery: "/freight/proof-of-delivery",
  earnings: "/freight/earnings",
  analytics: "/freight/analytics",
  settlements: "/freight/settlements",
  payoutCenter: "/freight/payout-center",
  notifications: "/freight/notifications",
  connectBank: "/freight/connect-bank",
  subscription: "/freight/subscription",
  profile: "/freight/profile",
  settings: "/freight/settings",
  support: "/freight/support",
  help: "/freight/help",
  login: "/freight/login",
  register: "/freight/register",
} as const;

type FreightRoute = (typeof FREIGHT_ROUTES)[keyof typeof FREIGHT_ROUTES];

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

export default function FreightManagementCenterScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [carrier, setCarrier] = useState<any>(null);
  const [loads, setLoads] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadCenter();
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

  const stats = useMemo(() => {
    const active = loads.filter((item) =>
      ["accepted", "booked", "assigned", "arrived_pickup", "picked_up", "in_transit", "arrived_dropoff", "delayed"].includes(
        normalize(item.status)
      )
    );

    const completed = loads.filter((item) => ["delivered", "completed"].includes(normalize(item.status)));
    const available = loads.filter((item) => normalize(item.status) === "available");
    const issues = loads.filter((item) => item.dispute_status || item.dispute_reason || item.route_exception_status || item.route_exception_type);
    const unread = notifications.filter((item) => !(item.read || item.is_read)).length;
    const openTickets = tickets.filter((item) => ["open", "new", "pending", "in_progress"].includes(normalize(item.status))).length;

    return {
      available: available.length,
      active: active.length,
      completed: completed.length,
      issues: issues.length,
      unread,
      openTickets,
      activeValue: active.reduce((sum, item) => sum + Number(item.rate || item.payout_amount || item.freight_total || item.total_due || 0), 0),
      completedValue: completed.reduce((sum, item) => sum + Number(item.rate || item.payout_amount || item.freight_total || item.total_due || 0), 0),
    };
  }, [loads, notifications, tickets]);

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
      console.log("Freight center subscription lookup error:", error.message);
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

  async function loadCenter() {
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

      if (carrierError) console.log("Freight center profile error:", carrierError.message);

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

      const { data: loadData, error: loadError } = await supabase
        .from("freight_loads")
        .select("*")
        .or(
          `status.eq.available,carrier_id.eq.${mergedCarrier.id},freight_user_id.eq.${mergedCarrier.id},driver_id.eq.${mergedCarrier.id},accepted_by.eq.${mergedCarrier.id}`
        )
        .order("updated_at", { ascending: false });

      if (loadError) {
        console.log("Freight center loads error:", loadError.message);
        setLoads([]);
      } else {
        setLoads(Array.isArray(loadData) ? loadData : []);
      }

      const { data: freightNotificationData, error: freightNotificationError } = await supabase
        .from("freight_notifications")
        .select("*")
        .or(`user_id.eq.${mergedCarrier.id},freight_id.eq.${mergedCarrier.id},freight_user_id.eq.${mergedCarrier.id}`)
        .order("created_at", { ascending: false })
        .limit(20);

      if (freightNotificationError) {
        console.log("Freight center notifications error:", freightNotificationError.message);
        setNotifications([]);
      } else {
        setNotifications(Array.isArray(freightNotificationData) ? freightNotificationData : []);
      }

      const { data: ticketData, error: ticketError } = await supabase
        .from("support_tickets")
        .select("*")
        .or(`user_id.eq.${mergedCarrier.id},freight_id.eq.${mergedCarrier.id},email.eq.${mergedCarrier.email}`)
        .order("created_at", { ascending: false })
        .limit(10);

      if (ticketError) {
        console.log("Freight center support tickets error:", ticketError.message);
        setTickets([]);
      } else {
        setTickets(Array.isArray(ticketData) ? ticketData : []);
      }
    } catch (error: any) {
      console.log("Freight management center error:", error);
      Alert.alert("Center Error", error?.message || "Unable to load freight management center.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadCenter();
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

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.centerText}>Loading freight management center...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.shell}>
          <View style={styles.sidebar}>
            <View style={styles.brandRow}>
              <View style={styles.brandIcon}>
                <Ionicons name="apps-outline" size={28} color={COLORS.white} />
              </View>
              <View>
                <Text style={styles.brandTitle}>Farm2Home</Text>
                <Text style={styles.brandSubtitle}>Management Center</Text>
              </View>
            </View>

            <View style={styles.sideDivider} />

            <SidebarLink icon="grid-outline" title="Dashboard" route={FREIGHT_ROUTES.dashboard} />
            <SidebarLink icon="apps-outline" title="Management Center" active route={FREIGHT_ROUTES.managementCenter} />
            <SidebarLink icon="search-outline" title="Load Board" route={FREIGHT_ROUTES.board} />
            <SidebarLink icon="briefcase-outline" title="My Loads" route={FREIGHT_ROUTES.myLoads} />
            <SidebarLink icon="business-outline" title="Connect Bank" route={FREIGHT_ROUTES.connectBank} />
            <SidebarLink icon="headset-outline" title="Support" route={FREIGHT_ROUTES.support} />

            <View style={styles.carrierPanel}>
              <Text style={styles.carrierLabel}>Carrier</Text>
              <Text style={styles.carrierName} numberOfLines={1}>
                {carrier?.companyName || carrier?.businessName || "Farm2Home Freight Carrier"}
              </Text>
              <Text style={styles.carrierSub} numberOfLines={1}>
                {carrier?.accountId || carrier?.account_id || "Account pending"}
              </Text>
            </View>
          </View>

          <View style={styles.main}>
            <View style={styles.topPanel}>
              <View style={{ flex: 1 }}>
                <Text style={styles.eyebrow}>Fina Admin Operations Hub</Text>
                <Text style={styles.pageTitle}>Freight Management Center</Text>
                <Text style={styles.pageSubtitle}>
                  Central hub for loads, routes, dispatch, support, Stripe, payouts, analytics, notifications, and account tools.
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
                <Text style={styles.companyName}>
                  {carrier?.companyName || carrier?.businessName || "Farm2Home Freight Carrier"}
                </Text>
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
              <MetricCard label="Setup" value={`${setupScore}%`} icon="analytics-outline" ready={setupScore >= 80} />
              <MetricCard label="Available" value={String(stats.available)} icon="cube-outline" ready={stats.available > 0} />
              <MetricCard label="Active Loads" value={String(stats.active)} icon="navigate-outline" ready={stats.active > 0} />
              <MetricCard label="Completed" value={String(stats.completed)} icon="checkmark-done-outline" ready={stats.completed > 0} />
              <MetricCard label="Unread Alerts" value={String(stats.unread)} icon="notifications-outline" ready={stats.unread === 0} />
              <MetricCard label="Open Support" value={String(stats.openTickets)} icon="help-buoy-outline" ready={stats.openTickets === 0} />
            </View>

            <View style={styles.moneyGrid}>
              <MoneyCard label="Active Load Value" value={money(stats.activeValue)} icon="cash-outline" />
              <MoneyCard label="Completed Value" value={money(stats.completedValue)} icon="wallet-outline" />
              <MoneyCard label="Issues / Exceptions" value={String(stats.issues)} icon="warning-outline" />
            </View>

            <View style={styles.card}>
              <SectionHeader icon="server-outline" title="Saved Freight IDs" subtitle="Preserved IDs used by login, subscription, Connect Bank, dashboard, and payouts." />
              <View style={styles.idGrid}>
                <IdRow label="Freight UUID" value={carrier?.id || carrier?.freightId || ""} />
                <IdRow label="Static Account ID" value={carrier?.accountId || carrier?.account_id || ""} />
                <IdRow label="Stripe Customer" value={shortId(stripeCustomerId)} />
                <IdRow label="Stripe Subscription" value={shortId(stripeSubscriptionId)} />
                <IdRow label="Connect Account" value={shortId(stripeAccountId)} />
                <IdRow label="Connect Status" value={carrier?.stripeConnectStatus || carrier?.stripe_connect_status || ""} />
              </View>
            </View>

            <HubSection title="Operations" subtitle="Load board, dispatch, route, and active freight workflow." />
            <View style={styles.grid}>
              <HubTile icon="grid-outline" title="Dashboard" route={FREIGHT_ROUTES.dashboard} />
              <HubTile icon="list-outline" title="Load Board" route={FREIGHT_ROUTES.board} />
              <HubTile icon="add-circle-outline" title="Post Load" route={FREIGHT_ROUTES.postLoad} />
              <HubTile icon="create-outline" title="Create Load" route={FREIGHT_ROUTES.createLoad} />
              <HubTile icon="briefcase-outline" title="My Loads" route={FREIGHT_ROUTES.myLoads} />
              <HubTile icon="pulse-outline" title="Live Loads" route={FREIGHT_ROUTES.liveLoads} />
              <HubTile icon="map-outline" title="Live Route" route={FREIGHT_ROUTES.liveRoute} />
              <HubTile icon="trail-sign-outline" title="Route Details" route={FREIGHT_ROUTES.routeDetails} />
              <HubTile icon="warning-outline" title="Route Exceptions" route={FREIGHT_ROUTES.routeExceptions} />
              <HubTile icon="alert-circle-outline" title="Load Issues" route={FREIGHT_ROUTES.loadIssues} />
              <HubTile icon="chatbubble-ellipses-outline" title="Load Chat" route={FREIGHT_ROUTES.loadChat} />
              <HubTile icon="megaphone-outline" title="Dispatch Alerts" route={FREIGHT_ROUTES.dispatchAlerts} />
            </View>

            <HubSection title="Delivery & History" subtitle="Proof workflow, route history, and delivery records." />
            <View style={styles.grid}>
              <HubTile icon="camera-outline" title="Proof Pickup" route={FREIGHT_ROUTES.proofOfPickup} />
              <HubTile icon="checkmark-done-outline" title="Proof Delivery" route={FREIGHT_ROUTES.proofOfDelivery} />
              <HubTile icon="time-outline" title="Delivery History" route={FREIGHT_ROUTES.deliveryHistory} />
              <HubTile icon="notifications-outline" title="Notifications" route={FREIGHT_ROUTES.notifications} />
              <HubTile icon="chatbubbles-outline" title="Communication" route={FREIGHT_ROUTES.communicationCenter} />
            </View>

            <HubSection title="Financials" subtitle="Payouts, settlements, earnings, analytics, subscription, and bank setup." />
            <View style={styles.grid}>
              <HubTile icon="cash-outline" title="Earnings" route={FREIGHT_ROUTES.earnings} />
              <HubTile icon="analytics-outline" title="Analytics" route={FREIGHT_ROUTES.analytics} />
              <HubTile icon="wallet-outline" title="Settlements" route={FREIGHT_ROUTES.settlements} />
              <HubTile icon="business-outline" title="Connect Bank" route={FREIGHT_ROUTES.connectBank} />
              <HubTile icon="card-outline" title="Subscription" route={FREIGHT_ROUTES.subscription} />
              <HubTile icon="cash-outline" title="Payout Center" route={FREIGHT_ROUTES.payoutCenter} />
            </View>

            <HubSection title="Account & Help" subtitle="Carrier profile, settings, support, and help center." />
            <View style={styles.grid}>
              <HubTile icon="person-outline" title="Profile" route={FREIGHT_ROUTES.profile} />
              <HubTile icon="settings-outline" title="Settings" route={FREIGHT_ROUTES.settings} />
              <HubTile icon="headset-outline" title="Support" route={FREIGHT_ROUTES.support} />
              <HubTile icon="help-circle-outline" title="Help" route={FREIGHT_ROUTES.help} />
            </View>

            <View style={styles.bottomActions}>
              <TouchableOpacity style={styles.primaryButton} onPress={() => goTo(FREIGHT_ROUTES.board)}>
                <Ionicons name="list-outline" size={18} color={COLORS.white} />
                <Text style={styles.primaryButtonText}>Open Freight Board</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.darkButton} onPress={() => goTo(FREIGHT_ROUTES.dashboard)}>
                <Ionicons name="grid-outline" size={18} color={COLORS.white} />
                <Text style={styles.primaryButtonText}>Back to Dashboard</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
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
        <Text style={styles.sectionTitle}>{title}</Text>
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

function MoneyCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.moneyCard}>
      <View style={styles.moneyIcon}>
        <Ionicons name={icon} size={22} color={COLORS.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.moneyLabel}>{label}</Text>
        <Text style={styles.moneyValue}>{value}</Text>
      </View>
    </View>
  );
}

function HubSection({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.hubSection}>
      <Text style={styles.hubTitle}>{title}</Text>
      <Text style={styles.hubSubtitle}>{subtitle}</Text>
    </View>
  );
}

function HubTile({
  icon,
  title,
  route,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  route: FreightRoute;
}) {
  return (
    <TouchableOpacity style={styles.tile} onPress={() => goTo(route)}>
      <View style={styles.tileIcon}>
        <Ionicons name={icon} size={24} color={COLORS.primary} />
      </View>

      <Text style={styles.tileTitle}>{title}</Text>
      <Ionicons name="chevron-forward-outline" size={18} color={COLORS.muted} />
    </TouchableOpacity>
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingBottom: 90 },
  center: { flex: 1, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center", padding: 24 },
  centerText: { color: COLORS.muted, marginTop: 12, fontWeight: "800" },
  shell: {
    flex: 1,
    flexDirection: Platform.OS === "web" ? "row" : "column",
    minHeight: Platform.OS === "web" ? 900 : undefined,
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
  carrierName: { color: COLORS.white, fontWeight: "900", marginTop: 6 },
  carrierSub: { color: "#CBD5E1", fontWeight: "700", marginTop: 4 },
  main: { flex: 1, padding: 18 },
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
  moneyGrid: { flexDirection: Platform.OS === "web" ? "row" : "column", gap: 12, marginBottom: 14 },
  moneyCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 22,
    padding: 16,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  moneyIcon: { width: 44, height: 44, borderRadius: 16, backgroundColor: COLORS.primarySoft, alignItems: "center", justifyContent: "center" },
  moneyLabel: { color: COLORS.muted, fontWeight: "900", textTransform: "uppercase", fontSize: 11 },
  moneyValue: { color: COLORS.text, fontWeight: "900", fontSize: 22, marginTop: 3 },
  card: { backgroundColor: COLORS.white, borderRadius: 22, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border },
  sectionHeader: { flexDirection: "row", gap: 10, alignItems: "flex-start", marginBottom: 14 },
  sectionIcon: { width: 40, height: 40, borderRadius: 16, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  sectionTitle: { color: COLORS.text, fontSize: 21, fontWeight: "900" },
  sectionSubtitle: { color: COLORS.muted, fontWeight: "700", lineHeight: 20, marginTop: 3 },
  idGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  idRow: { width: Platform.OS === "web" ? "31.5%" : "100%", backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, padding: 13 },
  idLabel: { color: COLORS.muted, fontWeight: "900", textTransform: "uppercase", fontSize: 11 },
  idValue: { color: COLORS.text, fontWeight: "900", marginTop: 5 },
  idMissing: { color: COLORS.amber },
  hubSection: { marginTop: 10, marginBottom: 10 },
  hubTitle: { color: COLORS.text, fontSize: 24, fontWeight: "900" },
  hubSubtitle: { color: COLORS.muted, fontWeight: "700", lineHeight: 21, marginTop: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },
  tile: {
    width: Platform.OS === "web" ? "23.5%" : "48%",
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 15,
    minHeight: 122,
    justifyContent: "space-between",
  },
  tileIcon: { width: 44, height: 44, borderRadius: 16, backgroundColor: COLORS.primarySoft, alignItems: "center", justifyContent: "center" },
  tileTitle: { color: COLORS.text, fontWeight: "900", fontSize: 15, marginTop: 10 },
  bottomActions: { flexDirection: Platform.OS === "web" ? "row" : "column", gap: 12, marginBottom: 40 },
  primaryButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  darkButton: {
    flex: 1,
    backgroundColor: COLORS.navy,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryButtonText: { color: COLORS.white, fontWeight: "900" },
});
