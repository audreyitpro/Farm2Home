// app/freight/settings.tsx

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
  board: "/freight/board",
  liveLoads: "/freight/live-loads",
  myLoads: "/freight/my-loads",
  connectBank: "/freight/connect-bank",
  subscription: "/freight/subscription",
  profile: "/freight/profile",
  settings: "/freight/settings",
  support: "/freight/support",
  help: "/freight/help",
  notifications: "/freight/notifications",
  dispatchAlerts: "/freight/dispatch-alerts",
  communicationCenter: "/freight/communication-center",
  loadIssues: "/freight/load-issues",
  routeExceptions: "/freight/route-exceptions",
  login: "/freight/login",
  register: "/freight/register",
} as const;

type FreightRoute = (typeof FREIGHT_ROUTES)[keyof typeof FREIGHT_ROUTES];

type FreightSettings = {
  pushNotifications: boolean;
  newLoadAlerts: boolean;
  routeStatusAlerts: boolean;
  payoutAlerts: boolean;
  billingAlerts: boolean;
  messageAlerts: boolean;
  dispatchAlerts: boolean;
  issueAlerts: boolean;
  gpsTracking: boolean;
  backgroundRouteUpdates: boolean;
  showOnlyNearbyLoads: boolean;
  showRefrigeratedLoads: boolean;
  showLivestockLoads: boolean;
  showHayLoads: boolean;
  showProduceLoads: boolean;
  darkMode: boolean;
  privacyMode: boolean;
  compactCards: boolean;
};

const SETTINGS_KEY = "farm2homeFreightSettings";

const DEFAULT_SETTINGS: FreightSettings = {
  pushNotifications: true,
  newLoadAlerts: true,
  routeStatusAlerts: true,
  payoutAlerts: true,
  billingAlerts: true,
  messageAlerts: true,
  dispatchAlerts: true,
  issueAlerts: true,
  gpsTracking: true,
  backgroundRouteUpdates: false,
  showOnlyNearbyLoads: false,
  showRefrigeratedLoads: true,
  showLivestockLoads: true,
  showHayLoads: true,
  showProduceLoads: true,
  darkMode: false,
  privacyMode: false,
  compactCards: false,
};

const COLORS = {
  bg: "#F7F7FB",
  card: "#FFFFFF",
  panel: "#F8FAFC",
  text: "#0F172A",
  muted: "#64748B",
  border: "#E5E7EB",
  primary: "#6D5DFB",
  primaryDark: "#4F46E5",
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

function isActiveStatus(status: any) {
  return ["active", "trialing", "past_due"].includes(normalize(status));
}

export default function FreightSettingsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingSync, setSavingSync] = useState(false);
  const [carrier, setCarrier] = useState<any>(null);
  const [settings, setSettings] = useState<FreightSettings>(DEFAULT_SETTINGS);

  useFocusEffect(
    useCallback(() => {
      loadSettings();
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

  const membershipStatus = useMemo(() => {
    return carrier?.membershipStatus || carrier?.membership_status || carrier?.subscriptionStatus || carrier?.subscription_status || "not_started";
  }, [carrier]);

  const payoutsReady = useMemo(() => {
    return boolValue(carrier?.payoutsEnabled, carrier?.payouts_enabled, carrier?.stripe_payouts_enabled);
  }, [carrier]);

  const chargesReady = useMemo(() => {
    return boolValue(carrier?.chargesEnabled, carrier?.charges_enabled, carrier?.stripe_charges_enabled);
  }, [carrier]);

  const onboardingReady = useMemo(() => {
    return boolValue(carrier?.onboardingComplete, carrier?.stripe_onboarding_complete);
  }, [carrier]);

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
      console.log("Freight settings subscription lookup error:", error.message);
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

  function readSettingsFromRow(row: any, localSettings: any = {}) {
    return {
      ...DEFAULT_SETTINGS,
      pushNotifications: row?.push_notifications ?? localSettings?.pushNotifications ?? DEFAULT_SETTINGS.pushNotifications,
      newLoadAlerts: row?.new_load_alerts ?? localSettings?.newLoadAlerts ?? DEFAULT_SETTINGS.newLoadAlerts,
      routeStatusAlerts: row?.route_status_alerts ?? localSettings?.routeStatusAlerts ?? DEFAULT_SETTINGS.routeStatusAlerts,
      payoutAlerts: row?.payout_alerts ?? localSettings?.payoutAlerts ?? DEFAULT_SETTINGS.payoutAlerts,
      billingAlerts: row?.billing_alerts ?? localSettings?.billingAlerts ?? DEFAULT_SETTINGS.billingAlerts,
      messageAlerts: row?.message_alerts ?? localSettings?.messageAlerts ?? DEFAULT_SETTINGS.messageAlerts,
      dispatchAlerts: row?.dispatch_alerts ?? localSettings?.dispatchAlerts ?? DEFAULT_SETTINGS.dispatchAlerts,
      issueAlerts: row?.issue_alerts ?? localSettings?.issueAlerts ?? DEFAULT_SETTINGS.issueAlerts,
      gpsTracking: row?.gps_tracking ?? localSettings?.gpsTracking ?? DEFAULT_SETTINGS.gpsTracking,
      backgroundRouteUpdates: row?.background_route_updates ?? localSettings?.backgroundRouteUpdates ?? DEFAULT_SETTINGS.backgroundRouteUpdates,
      showOnlyNearbyLoads: row?.show_only_nearby_loads ?? localSettings?.showOnlyNearbyLoads ?? DEFAULT_SETTINGS.showOnlyNearbyLoads,
      showRefrigeratedLoads: row?.show_refrigerated_loads ?? localSettings?.showRefrigeratedLoads ?? DEFAULT_SETTINGS.showRefrigeratedLoads,
      showLivestockLoads: row?.show_livestock_loads ?? localSettings?.showLivestockLoads ?? DEFAULT_SETTINGS.showLivestockLoads,
      showHayLoads: row?.show_hay_loads ?? localSettings?.showHayLoads ?? DEFAULT_SETTINGS.showHayLoads,
      showProduceLoads: row?.show_produce_loads ?? localSettings?.showProduceLoads ?? DEFAULT_SETTINGS.showProduceLoads,
      darkMode: row?.dark_mode ?? localSettings?.darkMode ?? DEFAULT_SETTINGS.darkMode,
      privacyMode: row?.privacy_mode ?? localSettings?.privacyMode ?? DEFAULT_SETTINGS.privacyMode,
      compactCards: row?.compact_cards ?? localSettings?.compactCards ?? DEFAULT_SETTINGS.compactCards,
    };
  }

  async function loadSettings() {
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

      if (error) console.log("Freight settings profile load error:", error.message);

      const dbCarrier = Array.isArray(dbRows) && dbRows.length > 0 ? dbRows[0] : null;

      if (!dbCarrier) {
        Alert.alert("Freight Profile Missing", "No freight profile was found. Please complete freight registration again.");
        router.replace(FREIGHT_ROUTES.register as any);
        return;
      }

      const sub = await findSubscription(dbCarrier.id || storedId || authId, normalize(dbCarrier.email || email));
      const mergedCarrier = buildMergedCarrier(dbCarrier, sub, stored);

      await saveFreightSession(mergedCarrier);
      setCarrier(mergedCarrier);

      let localSettings = {};
      const rawSettings = await AsyncStorage.getItem(SETTINGS_KEY);

      if (rawSettings) {
        try {
          localSettings = JSON.parse(rawSettings) || {};
        } catch {
          localSettings = {};
        }
      }

      const mergedSettings = readSettingsFromRow(dbCarrier, localSettings);
      setSettings(mergedSettings);
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(mergedSettings));
    } catch (error) {
      console.log("Freight settings load error:", error);
      Alert.alert("Settings Error", "Unable to load freight settings.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadSettings();
  }

  async function syncCarrierSettings(nextSettings: FreightSettings) {
    const freightId = clean(carrier?.id || carrier?.freightId || carrier?.freight_id);
    const email = normalize(carrier?.email);

    if (!freightId && !email) return;

    try {
      setSavingSync(true);

      const payload = {
        push_notifications: nextSettings.pushNotifications,
        new_load_alerts: nextSettings.newLoadAlerts,
        route_status_alerts: nextSettings.routeStatusAlerts,
        payout_alerts: nextSettings.payoutAlerts,
        billing_alerts: nextSettings.billingAlerts,
        message_alerts: nextSettings.messageAlerts,
        dispatch_alerts: nextSettings.dispatchAlerts,
        issue_alerts: nextSettings.issueAlerts,
        gps_tracking: nextSettings.gpsTracking,
        background_route_updates: nextSettings.backgroundRouteUpdates,
        show_only_nearby_loads: nextSettings.showOnlyNearbyLoads,
        show_refrigerated_loads: nextSettings.showRefrigeratedLoads,
        show_livestock_loads: nextSettings.showLivestockLoads,
        show_hay_loads: nextSettings.showHayLoads,
        show_produce_loads: nextSettings.showProduceLoads,
        dark_mode: nextSettings.darkMode,
        privacy_mode: nextSettings.privacyMode,
        compact_cards: nextSettings.compactCards,
        stripe_customer_id: stripeCustomerId || null,
        stripe_subscription_id: stripeSubscriptionId || null,
        subscription_id: stripeSubscriptionId || null,
        stripe_account_id: stripeAccountId || null,
        freight_account: stripeAccountId || null,
        updated_at: new Date().toISOString(),
      };

      let query = supabase.from("freight_users").update(payload);

      if (freightId) {
        query = query.or(`id.eq.${freightId},freight_id.eq.${freightId},auth_user_id.eq.${freightId},profile_id.eq.${freightId}`);
      } else {
        query = query.eq("email", email);
      }

      const { error } = await query;

      if (error) console.log("Freight settings sync error:", error.message);
    } catch (error) {
      console.log("Freight settings sync skipped:", error);
    } finally {
      setSavingSync(false);
    }
  }

  async function updateSetting(key: keyof FreightSettings, value: boolean) {
    const nextSettings = {
      ...settings,
      [key]: value,
    };

    setSettings(nextSettings);
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(nextSettings));
    await syncCarrierSettings(nextSettings);
  }

  async function resetSettings() {
    Alert.alert("Reset Settings", "Reset Freight Connect settings to default?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reset",
        style: "destructive",
        onPress: async () => {
          setSettings(DEFAULT_SETTINGS);
          await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS));
          await syncCarrierSettings(DEFAULT_SETTINGS);
          Alert.alert("Reset Complete", "Freight settings were reset.");
        },
      },
    ]);
  }

  async function logout() {
    await supabase.auth.signOut();

    await AsyncStorage.multiRemove([
      "currentFreightCarrier",
      "currentFreight",
      "currentFreightUser",
      "farm2homeCurrentFreight",
      "currentUser",
      "userRole",
      "currentUserRole",
    ]);

    router.replace(FREIGHT_ROUTES.login as any);
  }

  function carrierName() {
    return (
      carrier?.companyName ||
      carrier?.businessName ||
      carrier?.contactName ||
      carrier?.username ||
      carrier?.email ||
      "Farm2Home Freight Carrier"
    );
  }

  function membershipColor() {
    const status = normalize(membershipStatus);

    if (status.includes("cancel") || status.includes("unpaid") || status.includes("incomplete")) return COLORS.red;
    if (status.includes("pending") || status.includes("past_due")) return COLORS.amber;
    if (status.includes("active") || status.includes("trial")) return COLORS.green;

    return COLORS.amber;
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

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.centerText}>Loading freight settings...</Text>
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
                <Ionicons name="settings-outline" size={28} color={COLORS.white} />
              </View>
              <View>
                <Text style={styles.brandTitle}>Farm2Home</Text>
                <Text style={styles.brandSubtitle}>Settings</Text>
              </View>
            </View>

            <View style={styles.sideDivider} />

            <SidebarLink icon="grid-outline" title="Dashboard" route={FREIGHT_ROUTES.dashboard} />
            <SidebarLink icon="search-outline" title="Load Board" route={FREIGHT_ROUTES.board} />
            <SidebarLink icon="briefcase-outline" title="My Loads" route={FREIGHT_ROUTES.myLoads} />
            <SidebarLink icon="notifications-outline" title="Notifications" route={FREIGHT_ROUTES.notifications} />
            <SidebarLink icon="person-outline" title="Profile" route={FREIGHT_ROUTES.profile} />
            <SidebarLink icon="settings-outline" title="Settings" active route={FREIGHT_ROUTES.settings} />

            <View style={styles.carrierPanel}>
              <Text style={styles.carrierLabel}>Carrier</Text>
              <Text style={styles.carrierName} numberOfLines={1}>{carrierName()}</Text>
              <Text style={styles.carrierSub} numberOfLines={1}>{carrier?.accountId || carrier?.account_id || "Account pending"}</Text>
            </View>
          </View>

          <View style={styles.main}>
            <View style={styles.topPanel}>
              <View style={{ flex: 1 }}>
                <Text style={styles.eyebrow}>Fina Admin Preferences</Text>
                <Text style={styles.pageTitle}>Freight Settings</Text>
                <Text style={styles.pageSubtitle}>
                  Manage alerts, route tracking, load board filters, privacy, account actions, and Stripe setup shortcuts.
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
                <Text style={styles.companyEmail}>{carrier?.email || "Freight account"}</Text>
                <Text style={styles.accountId}>Account ID: {carrier?.accountId || carrier?.account_id || "Not assigned"}</Text>
              </View>

              <View style={[styles.statusMini, { backgroundColor: membershipColor() }]}>
                <Text style={styles.statusMiniText}>{membershipStatus}</Text>
              </View>
            </View>

            <View style={styles.metricGrid}>
              <MetricCard icon="analytics-outline" label="Setup" value={`${setupScore}%`} ready={setupScore >= 80} />
              <MetricCard icon="person-circle-outline" label="Customer" value={shortId(stripeCustomerId)} ready={Boolean(stripeCustomerId)} />
              <MetricCard icon="repeat-outline" label="Subscription" value={shortId(stripeSubscriptionId)} ready={Boolean(stripeSubscriptionId)} />
              <MetricCard icon="business-outline" label="Connect" value={shortId(stripeAccountId)} ready={Boolean(stripeAccountId)} />
              <MetricCard icon="wallet-outline" label="Payouts" value={stripeStatusText()} ready={payoutsReady && chargesReady && onboardingReady} />
            </View>

            <View style={styles.syncCard}>
              <Ionicons name={savingSync ? "sync-outline" : "cloud-done-outline"} size={20} color={COLORS.primary} />
              <Text style={styles.syncText}>
                {savingSync ? "Syncing settings..." : "Settings saved locally and synced to freight_users when available."}
              </Text>
            </View>

            <View style={styles.quickGrid}>
              <QuickLink icon="grid-outline" label="Dashboard" route={FREIGHT_ROUTES.dashboard} />
              <QuickLink icon="list-outline" label="Load Board" route={FREIGHT_ROUTES.board} />
              <QuickLink icon="briefcase-outline" label="My Loads" route={FREIGHT_ROUTES.myLoads} />
              <QuickLink icon="pulse-outline" label="Live Loads" route={FREIGHT_ROUTES.liveLoads} />
              <QuickLink icon="card-outline" label="Subscription" route={FREIGHT_ROUTES.subscription} />
              <QuickLink icon="business-outline" label="Connect Bank" route={FREIGHT_ROUTES.connectBank} />
              <QuickLink icon="headset-outline" label="Support" route={FREIGHT_ROUTES.support} />
              <QuickLink icon="help-circle-outline" label="Help" route={FREIGHT_ROUTES.help} />
            </View>

            <View style={styles.gridTwo}>
              <View style={styles.card}>
                <SectionHeader icon="notifications-outline" title="Notification Preferences" subtitle="Control freight alerts." />

                <SettingRow icon="notifications-outline" label="Push Notifications" description="Receive Farm2Home freight notifications." value={settings.pushNotifications} onChange={(value) => updateSetting("pushNotifications", value)} />
                <SettingRow icon="cube-outline" label="New Load Alerts" description="Alert me when matching freight loads are posted." value={settings.newLoadAlerts} onChange={(value) => updateSetting("newLoadAlerts", value)} />
                <SettingRow icon="navigate-outline" label="Route Status Alerts" description="Notify me about route, pickup, and dropoff updates." value={settings.routeStatusAlerts} onChange={(value) => updateSetting("routeStatusAlerts", value)} />
                <SettingRow icon="cash-outline" label="Payout Alerts" description="Notify me when settlements or earnings update." value={settings.payoutAlerts} onChange={(value) => updateSetting("payoutAlerts", value)} />
                <SettingRow icon="card-outline" label="Billing Alerts" description="Notify me about membership and payment changes." value={settings.billingAlerts} onChange={(value) => updateSetting("billingAlerts", value)} />
                <SettingRow icon="chatbubbles-outline" label="Message Alerts" description="Notify me about dispatch, support, and load chat messages." value={settings.messageAlerts} onChange={(value) => updateSetting("messageAlerts", value)} />
                <SettingRow icon="megaphone-outline" label="Dispatch Alerts" description="Show urgent dispatch and load-board alerts." value={settings.dispatchAlerts} onChange={(value) => updateSetting("dispatchAlerts", value)} />
                <SettingRow icon="warning-outline" label="Issue Alerts" description="Notify me about load issues and route exceptions." value={settings.issueAlerts} onChange={(value) => updateSetting("issueAlerts", value)} />
              </View>

              <View style={styles.card}>
                <SectionHeader icon="options-outline" title="Load Board Preferences" subtitle="Customize freight opportunities." />

                <SettingRow icon="location-outline" label="Show Only Nearby Loads" description="Prioritize loads near your service area." value={settings.showOnlyNearbyLoads} onChange={(value) => updateSetting("showOnlyNearbyLoads", value)} />
                <SettingRow icon="snow-outline" label="Show Refrigerated Loads" description="Include cold-chain and refrigerated food loads." value={settings.showRefrigeratedLoads} onChange={(value) => updateSetting("showRefrigeratedLoads", value)} />
                <SettingRow icon="paw-outline" label="Show Livestock Loads" description="Include livestock transport opportunities." value={settings.showLivestockLoads} onChange={(value) => updateSetting("showLivestockLoads", value)} />
                <SettingRow icon="leaf-outline" label="Show Produce Loads" description="Include produce and farm product loads." value={settings.showProduceLoads} onChange={(value) => updateSetting("showProduceLoads", value)} />
                <SettingRow icon="archive-outline" label="Show Hay Loads" description="Include hay, feed, and bulk farm loads." value={settings.showHayLoads} onChange={(value) => updateSetting("showHayLoads", value)} />
              </View>
            </View>

            <View style={styles.gridTwo}>
              <View style={styles.card}>
                <SectionHeader icon="map-outline" title="GPS & Live Route" subtitle="Control active route tracking." />

                <SettingRow icon="radio-outline" label="GPS Tracking" description="Allow live GPS updates during active freight routes." value={settings.gpsTracking} onChange={(value) => updateSetting("gpsTracking", value)} />
                <SettingRow icon="phone-portrait-outline" label="Background Route Updates" description="Allow route updates while the app is minimized." value={settings.backgroundRouteUpdates} onChange={(value) => updateSetting("backgroundRouteUpdates", value)} />
              </View>

              <View style={styles.card}>
                <SectionHeader icon="lock-closed-outline" title="Privacy & Display" subtitle="Control visibility and display preferences." />

                <SettingRow icon="moon-outline" label="Dark Mode" description="Save a dark interface preference for freight screens." value={settings.darkMode} onChange={(value) => updateSetting("darkMode", value)} />
                <SettingRow icon="eye-off-outline" label="Privacy Mode" description="Hide sensitive carrier and Stripe IDs on shared screens." value={settings.privacyMode} onChange={(value) => updateSetting("privacyMode", value)} />
                <SettingRow icon="albums-outline" label="Compact Cards" description="Use smaller load cards where supported." value={settings.compactCards} onChange={(value) => updateSetting("compactCards", value)} />
              </View>
            </View>

            <View style={styles.card}>
              <SectionHeader icon="server-outline" title="Saved Account IDs" subtitle="Preserved for login, dashboard, payments, and banking." />

              <View style={styles.idGrid}>
                <IdRow label="Freight UUID" value={carrier?.id || carrier?.freightId || ""} />
                <IdRow label="Static Account ID" value={carrier?.accountId || carrier?.account_id || ""} />
                <IdRow label="Stripe Customer" value={stripeCustomerId} />
                <IdRow label="Stripe Subscription" value={stripeSubscriptionId} />
                <IdRow label="Connect Account" value={stripeAccountId} />
                <IdRow label="Connect Status" value={carrier?.stripeConnectStatus || carrier?.stripe_connect_status || ""} />
              </View>
            </View>

            <View style={styles.card}>
              <SectionHeader icon="construct-outline" title="Account Actions" subtitle="Manage profile, billing, banking, support, or sign out." />

              <View style={styles.actionGrid}>
                <ActionButton icon="business-outline" label="Open Freight Profile" onPress={() => goTo(FREIGHT_ROUTES.profile)} primary />
                <ActionButton icon="card-outline" label="Open Subscription" onPress={() => goTo(FREIGHT_ROUTES.subscription)} />
                <ActionButton icon="wallet-outline" label="Open Connect Bank" onPress={() => goTo(FREIGHT_ROUTES.connectBank)} />
                <ActionButton icon="notifications-outline" label="Open Notifications" onPress={() => goTo(FREIGHT_ROUTES.notifications)} />
                <ActionButton icon="megaphone-outline" label="Dispatch Alerts" onPress={() => goTo(FREIGHT_ROUTES.dispatchAlerts)} />
                <ActionButton icon="chatbubbles-outline" label="Messages" onPress={() => goTo(FREIGHT_ROUTES.communicationCenter)} />
                <ActionButton icon="help-buoy-outline" label="Open Support" onPress={() => goTo(FREIGHT_ROUTES.support)} />
                <ActionButton icon="refresh-outline" label="Reset Settings" onPress={resetSettings} />
                <ActionButton icon="log-out-outline" label="Logout" onPress={logout} danger />
              </View>
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

function SettingRow({
  icon,
  label,
  description,
  value,
  onChange,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingIcon}>
        <Ionicons name={icon} size={20} color={COLORS.primary} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.settingLabel}>{label}</Text>
        <Text style={styles.settingDescription}>{description}</Text>
      </View>

      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: "#CBD5E1", true: "#C7D2FE" }}
        thumbColor={value ? COLORS.primary : COLORS.white}
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
      <View style={styles.quickIcon}>
        <Ionicons name={icon} size={22} color={COLORS.primary} />
      </View>
      <Text style={styles.quickLinkText}>{label}</Text>
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
  danger,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  primary?: boolean;
  danger?: boolean;
}) {
  const style = primary ? styles.primaryButton : danger ? styles.logoutButton : styles.secondaryButton;
  const color = primary || danger ? COLORS.white : COLORS.primary;
  const textStyle = primary || danger ? styles.buttonText : styles.secondaryButtonText;

  return (
    <TouchableOpacity style={style} onPress={onPress}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={textStyle}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center", padding: 24 },
  centerText: { color: COLORS.muted, marginTop: 12, fontWeight: "800" },
  content: { paddingBottom: 90 },
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
  syncCard: {
    backgroundColor: COLORS.white,
    marginBottom: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  syncText: { color: COLORS.text, fontWeight: "800", flex: 1, lineHeight: 20 },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
  quickLink: {
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
  quickLinkText: { color: COLORS.text, fontWeight: "900" },
  gridTwo: { flexDirection: Platform.OS === "web" ? "row" : "column", gap: 14, alignItems: "flex-start" },
  card: { flex: 1, width: "100%", backgroundColor: COLORS.white, padding: 18, borderRadius: 22, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border },
  sectionHeader: { flexDirection: "row", gap: 10, alignItems: "flex-start", marginBottom: 14 },
  sectionIcon: { width: 40, height: 40, borderRadius: 16, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  sectionTitle: { color: COLORS.text, fontSize: 21, fontWeight: "900" },
  sectionSubtitle: { color: COLORS.muted, fontWeight: "700", lineHeight: 20, marginTop: 3 },
  settingRow: {
    backgroundColor: COLORS.panel,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  settingIcon: { width: 38, height: 38, borderRadius: 16, backgroundColor: COLORS.primarySoft, alignItems: "center", justifyContent: "center" },
  settingLabel: { color: COLORS.text, fontWeight: "900", marginBottom: 3 },
  settingDescription: { color: COLORS.muted, fontWeight: "700", lineHeight: 19 },
  idGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  idRow: { width: Platform.OS === "web" ? "31.5%" : "100%", backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, padding: 13 },
  idLabel: { color: COLORS.muted, fontWeight: "900", textTransform: "uppercase", fontSize: 11 },
  idValue: { color: COLORS.text, fontWeight: "900", marginTop: 5 },
  idMissing: { color: COLORS.amber },
  actionGrid: { flexDirection: Platform.OS === "web" ? "row" : "column", flexWrap: "wrap", gap: 10 },
  primaryButton: {
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    minWidth: Platform.OS === "web" ? "31.5%" : "100%",
  },
  secondaryButton: {
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    minWidth: Platform.OS === "web" ? "31.5%" : "100%",
  },
  logoutButton: {
    backgroundColor: COLORS.red,
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    minWidth: Platform.OS === "web" ? "31.5%" : "100%",
  },
  buttonText: { color: COLORS.white, fontWeight: "900", textAlign: "center" },
  secondaryButtonText: { color: COLORS.primary, fontWeight: "900", textAlign: "center" },
});
