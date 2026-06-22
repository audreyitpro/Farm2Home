// app/freight/help.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
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
  board: "/freight/board",
  myLoads: "/freight/my-loads",
  liveLoads: "/freight/live-loads",
  liveRoute: "/freight/live-route",
  profile: "/freight/profile",
  subscription: "/freight/subscription",
  settings: "/freight/settings",
  support: "/freight/support",
  connectBank: "/freight/connect-bank",
  notifications: "/freight/notifications",
  dispatchAlerts: "/freight/dispatch-alerts",
  communicationCenter: "/freight/communication-center",
  loadIssues: "/freight/load-issues",
  routeExceptions: "/freight/route-exceptions",
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

function shortId(value?: string) {
  const id = clean(value);
  if (!id) return "Missing";
  if (id.length <= 16) return id;
  return `${id.slice(0, 8)}...${id.slice(-5)}`;
}

function goTo(route: FreightRoute) {
  router.push(route as any);
}

export default function FreightHelpScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [carrier, setCarrier] = useState<any>(null);

  useFocusEffect(
    useCallback(() => {
      loadCarrier();
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
      console.log("Freight help subscription lookup error:", error.message);
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

  async function loadCarrier() {
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

      const filters = [
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

      const { data: dbRows, error } = await supabase.from("freight_users").select("*").or(filters).limit(1);

      if (error) console.log("Load freight help profile error:", error.message);

      const dbCarrier = Array.isArray(dbRows) && dbRows.length > 0 ? dbRows[0] : null;

      if (!dbCarrier) {
        Alert.alert("Freight Profile Missing", "No freight profile was found. Please complete freight registration first.");
        router.replace(FREIGHT_ROUTES.register as any);
        return;
      }

      const sub = await findSubscription(dbCarrier.id || storedId || authId, normalize(dbCarrier.email || email));
      const merged = buildMergedCarrier(dbCarrier, sub, stored);

      await saveFreightSession(merged);
      setCarrier(merged);
    } catch (error) {
      console.log("Load freight help error:", error);
      Alert.alert("Help Error", "Unable to load freight help.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadCarrier();
  }

  async function callSupport() {
    try {
      await Linking.openURL("tel:+18005550199");
    } catch {
      Alert.alert("Call Error", "Unable to open phone dialer.");
    }
  }

  async function emailSupport() {
    try {
      const mailUrl = `mailto:support@farm2home.app?subject=Farm2Home Freight Help&body=Carrier: ${encodeURIComponent(
        carrier?.companyName || carrier?.businessName || "Freight Carrier"
      )}%0AEmail: ${encodeURIComponent(carrier?.email || "")}%0A%0AMessage:%0A`;

      await Linking.openURL(mailUrl);
    } catch {
      Alert.alert("Email Error", "Unable to open email app.");
    }
  }

  function showEmergencyNotice() {
    Alert.alert(
      "Freight Emergency",
      "For urgent route, livestock, cold-chain, accident, safety, or rejected-delivery issues, contact the pickup/dropoff party first, then call Farm2Home support immediately."
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

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.centerText}>Loading freight help...</Text>
        </View>
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
                <Ionicons name="help-circle-outline" size={28} color={COLORS.white} />
              </View>
              <View>
                <Text style={styles.brandTitle}>Farm2Home</Text>
                <Text style={styles.brandSubtitle}>Help Center</Text>
              </View>
            </View>

            <View style={styles.sideDivider} />

            <SidebarLink icon="grid-outline" title="Dashboard" route={FREIGHT_ROUTES.dashboard} />
            <SidebarLink icon="search-outline" title="Load Board" route={FREIGHT_ROUTES.board} />
            <SidebarLink icon="briefcase-outline" title="My Loads" route={FREIGHT_ROUTES.myLoads} />
            <SidebarLink icon="business-outline" title="Connect Bank" route={FREIGHT_ROUTES.connectBank} />
            <SidebarLink icon="headset-outline" title="Support" route={FREIGHT_ROUTES.support} />
            <SidebarLink icon="help-circle-outline" title="Help" active route={FREIGHT_ROUTES.help} />

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
                <Text style={styles.eyebrow}>Fina Admin Knowledge Center</Text>
                <Text style={styles.pageTitle}>Freight Help</Text>
                <Text style={styles.pageSubtitle}>
                  Learn freight board tools, subscription setup, Stripe Connect banking, routing, alerts, load issues, and support workflows.
                </Text>
              </View>

              <TouchableOpacity style={styles.topButton} onPress={() => goTo(FREIGHT_ROUTES.dashboard)}>
                <Ionicons name="grid-outline" size={22} color={COLORS.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.profilePanel}>
              <View style={styles.profileAvatar}>
                <Ionicons name="trail-sign-outline" size={28} color={COLORS.white} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.companyName}>
                  {carrier?.companyName || carrier?.businessName || "Farm2Home Freight Carrier"}
                </Text>
                <Text style={styles.companyEmail}>{carrier?.email || "Carrier account"}</Text>
                <Text style={styles.accountId}>Account ID: {carrier?.accountId || carrier?.account_id || "Not assigned"}</Text>
              </View>

              <View style={[styles.statusMini, { backgroundColor: membershipColor() }]}>
                <Text style={styles.statusMiniText}>
                  {carrier?.membershipStatus || carrier?.subscriptionStatus || "not_started"}
                </Text>
              </View>
            </View>

            <View style={styles.metricGrid}>
              <MetricCard icon="analytics-outline" label="Setup" value={`${setupScore}%`} ready={setupScore >= 80} />
              <MetricCard icon="person-circle-outline" label="Customer" value={shortId(stripeCustomerId)} ready={Boolean(stripeCustomerId)} />
              <MetricCard icon="repeat-outline" label="Subscription" value={shortId(stripeSubscriptionId)} ready={Boolean(stripeSubscriptionId)} />
              <MetricCard icon="business-outline" label="Connect" value={shortId(stripeAccountId)} ready={Boolean(stripeAccountId)} />
              <MetricCard icon="wallet-outline" label="Payouts" value={stripeStatusText()} ready={payoutsReady && chargesReady && onboardingReady} />
            </View>

            <View style={styles.quickGrid}>
              <QuickAction icon="call-outline" label="Call Support" onPress={callSupport} />
              <QuickAction icon="mail-outline" label="Email Support" onPress={emailSupport} />
              <QuickAction icon="help-buoy-outline" label="Support" onPress={() => goTo(FREIGHT_ROUTES.support)} />
              <QuickAction icon="alert-circle-outline" label="Emergency" onPress={showEmergencyNotice} />
              <QuickAction icon="grid-outline" label="Dashboard" onPress={() => goTo(FREIGHT_ROUTES.dashboard)} />
              <QuickAction icon="list-outline" label="Load Board" onPress={() => goTo(FREIGHT_ROUTES.board)} />
              <QuickAction icon="business-outline" label="Connect Bank" onPress={() => goTo(FREIGHT_ROUTES.connectBank)} />
              <QuickAction icon="card-outline" label="Subscription" onPress={() => goTo(FREIGHT_ROUTES.subscription)} />
            </View>

            <View style={styles.gridTwo}>
              <HelpSection
                icon="grid-outline"
                title="Using the Freight Dashboard"
                items={[
                  "Open Freight Dashboard to view active carrier workspace metrics.",
                  "Review open loads, active routes, completed loads, and payout setup status.",
                  "Use dashboard shortcuts to open board, profile, settings, subscription, banking, and support.",
                  "Refresh dashboard when Stripe or Supabase data looks stale.",
                ]}
              />

              <HelpSection
                icon="list-outline"
                title="Using the Freight Board"
                items={[
                  "Open the Load Board to see available freight opportunities.",
                  "Search by city, farmer, commodity, equipment type, or route direction.",
                  "Use nearby and max-mile filters to control route distance.",
                  "Tap Accept Load only when the pickup/dropoff details and equipment match your carrier.",
                ]}
              />
            </View>

            <View style={styles.gridTwo}>
              <HelpSection
                icon="business-outline"
                title="Stripe Connect Bank Help"
                items={[
                  "Use Connect Bank to start Stripe Express onboarding.",
                  "If you already have a subscription and acct_ account, use Update Banking Info to change bank details.",
                  "After Stripe onboarding, return to Connect Bank and tap Reload Payout Status.",
                  "Payout Ready requires Connect account, onboarding complete, charges enabled, and payouts enabled.",
                ]}
              />

              <HelpSection
                icon="card-outline"
                title="Subscription Help"
                items={[
                  "Use Subscription to start backend Stripe Checkout.",
                  "Do not use a static Stripe payment link because it will not attach freight ID metadata correctly.",
                  "If you already paid, use Restore Existing Paid Subscription or paste your cus_ customer ID.",
                  "After payment success, the app stores stripe_customer_id and stripe_subscription_id.",
                ]}
              />
            </View>

            <View style={styles.gridTwo}>
              <HelpSection
                icon="map-outline"
                title="Route Tracking Help"
                items={[
                  "Use Live Route tools for active route visibility.",
                  "Keep GPS tracking enabled during active freight movement.",
                  "Update pickup, transit, and dropoff statuses as the route progresses.",
                  "Use Route Exceptions when traffic, weather, blocked access, or timing problems occur.",
                ]}
              />

              <HelpSection
                icon="alert-circle-outline"
                title="Load Issues Help"
                items={[
                  "Use Load Issues for cargo damage, missing items, temperature excursion, rejected delivery, or livestock problems.",
                  "High or critical issues may place payout or settlement on review hold.",
                  "Give clear notes, estimated delay, and contact information.",
                  "Use Support for follow-up after submitting a load issue.",
                ]}
              />
            </View>

            <View style={styles.gridTwo}>
              <HelpSection
                icon="snow-outline"
                title="Cold-Chain and Fresh Food"
                items={[
                  "Check each load for temperature notes before accepting.",
                  "Use refrigerated equipment when required.",
                  "Record temperature details during pickup or delivery when requested.",
                  "Report spoiled, damaged, unsafe, or delayed products immediately.",
                ]}
              />

              <HelpSection
                icon="paw-outline"
                title="Livestock and Farm Bulk"
                items={[
                  "Only accept livestock or bulk farm loads if your carrier equipment is approved.",
                  "Confirm pickup timing, loading requirements, and safety notes before dispatch.",
                  "Follow local transport safety and animal-handling requirements.",
                  "Use support if route details, weight, or equipment requirements are unclear.",
                ]}
              />
            </View>

            <View style={styles.card}>
              <SectionHeader
                icon="navigate-circle-outline"
                title="Freight Portal Shortcuts"
                subtitle="Jump directly to the freight tool you need."
              />

              <View style={styles.routeGrid}>
                <RouteButton title="Freight Dashboard" route={FREIGHT_ROUTES.dashboard} />
                <RouteButton title="Live Freight Board" route={FREIGHT_ROUTES.board} />
                <RouteButton title="My Loads" route={FREIGHT_ROUTES.myLoads} />
                <RouteButton title="Live Loads" route={FREIGHT_ROUTES.liveLoads} />
                <RouteButton title="Carrier Profile" route={FREIGHT_ROUTES.profile} />
                <RouteButton title="Connect Bank" route={FREIGHT_ROUTES.connectBank} />
                <RouteButton title="Freight Settings" route={FREIGHT_ROUTES.settings} />
                <RouteButton title="Freight Subscription" route={FREIGHT_ROUTES.subscription} />
                <RouteButton title="Notifications" route={FREIGHT_ROUTES.notifications} />
                <RouteButton title="Dispatch Alerts" route={FREIGHT_ROUTES.dispatchAlerts} />
                <RouteButton title="Messages" route={FREIGHT_ROUTES.communicationCenter} />
                <RouteButton title="Support" route={FREIGHT_ROUTES.support} />
              </View>
            </View>

            <TouchableOpacity style={styles.darkButton} onPress={() => router.replace(FREIGHT_ROUTES.dashboard as any)}>
              <Ionicons name="grid-outline" size={18} color={COLORS.white} />
              <Text style={styles.darkButtonText}>Back to Freight Dashboard</Text>
            </TouchableOpacity>
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
  subtitle?: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIcon}>
        <Ionicons name={icon} size={20} color={COLORS.white} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {!!subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
      </View>
    </View>
  );
}

function MetricCard({
  icon,
  label,
  value,
  ready,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
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

function HelpSection({
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
      <SectionHeader icon={icon} title={title} />

      {items.map((item, index) => (
        <View key={`${title}-${index}`} style={styles.helpItem}>
          <View style={styles.helpNumber}>
            <Text style={styles.helpNumberText}>{index + 1}</Text>
          </View>
          <Text style={styles.helpText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.quickAction} onPress={onPress}>
      <View style={styles.quickIcon}>
        <Ionicons name={icon} size={22} color={COLORS.primary} />
      </View>
      <Text style={styles.quickActionText}>{label}</Text>
    </TouchableOpacity>
  );
}

function RouteButton({ title, route }: { title: string; route: FreightRoute }) {
  return (
    <TouchableOpacity style={styles.routeButton} onPress={() => goTo(route)}>
      <Text style={styles.routeButtonText}>{title}</Text>
      <Ionicons name="chevron-forward-outline" size={20} color={COLORS.primary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingBottom: 90 },
  center: { flex: 1, backgroundColor: COLORS.bg, justifyContent: "center", alignItems: "center", padding: 24 },
  centerText: { color: COLORS.muted, marginTop: 10, fontWeight: "800" },
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
  statusMini: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8 },
  statusMiniText: { color: COLORS.white, fontWeight: "900", fontSize: 12, textTransform: "capitalize" },
  metricGrid: { flexDirection: Platform.OS === "web" ? "row" : "column", gap: 12, marginBottom: 14 },
  metricCard: { flex: 1, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: 22, padding: 16 },
  metricIcon: { width: 42, height: 42, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  metricGood: { backgroundColor: COLORS.greenSoft },
  metricWarn: { backgroundColor: COLORS.amberSoft },
  metricLabel: { color: COLORS.muted, fontWeight: "900", fontSize: 11, textTransform: "uppercase" },
  metricValue: { color: COLORS.text, fontWeight: "900", fontSize: 18, marginTop: 5 },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 },
  quickAction: {
    width: Platform.OS === "web" ? "23.5%" : "48%",
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 102,
    justifyContent: "space-between",
  },
  quickIcon: { width: 42, height: 42, borderRadius: 15, backgroundColor: COLORS.primarySoft, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  quickActionText: { color: COLORS.text, fontWeight: "900" },
  gridTwo: { flexDirection: Platform.OS === "web" ? "row" : "column", gap: 14, alignItems: "flex-start" },
  card: { flex: 1, width: "100%", backgroundColor: COLORS.white, borderRadius: 22, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border },
  sectionHeader: { flexDirection: "row", gap: 10, alignItems: "flex-start", marginBottom: 14 },
  sectionIcon: { width: 40, height: 40, borderRadius: 16, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  sectionTitle: { color: COLORS.text, fontSize: 21, fontWeight: "900" },
  sectionSubtitle: { color: COLORS.muted, fontWeight: "700", lineHeight: 20, marginTop: 3 },
  helpItem: {
    backgroundColor: COLORS.panel,
    borderRadius: 14,
    padding: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  helpNumber: { width: 25, height: 25, borderRadius: 999, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  helpNumberText: { color: COLORS.white, fontWeight: "900", fontSize: 12 },
  helpText: { color: COLORS.text, fontWeight: "800", flex: 1, lineHeight: 20 },
  routeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  routeButton: {
    width: Platform.OS === "web" ? "31.5%" : "100%",
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
  },
  routeButtonText: { flex: 1, color: COLORS.text, fontWeight: "900" },
  darkButton: {
    backgroundColor: COLORS.navy,
    padding: 15,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 40,
    flexDirection: "row",
    gap: 8,
  },
  darkButtonText: { color: COLORS.white, fontWeight: "900" },
});
