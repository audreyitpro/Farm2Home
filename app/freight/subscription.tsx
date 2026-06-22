// app/freight/subscription.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as WebBrowser from "expo-web-browser";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { API_BASE_URL } from "../config/api";
import { supabase } from "../data/supabaseClient";

const ROUTES = {
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
  login: "/freight/login",
  register: "/freight/register",
} as const;

type FreightRoute = (typeof ROUTES)[keyof typeof ROUTES];

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
  navy: "#020617",
  white: "#FFFFFF",
};

function clean(value: any) {
  return String(value ?? "").trim();
}

function normalize(value: any) {
  return clean(value).toLowerCase();
}

function isActiveStatus(status: any) {
  return ["active", "trialing", "past_due"].includes(normalize(status));
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

function shortId(value?: string) {
  const id = clean(value);
  if (!id) return "Missing";
  if (id.length <= 16) return id;
  return `${id.slice(0, 8)}...${id.slice(-5)}`;
}

async function parseJsonResponse(response: Response) {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { success: false, error: text || "Invalid backend response." };
  }
}

async function saveSession(user: any) {
  await AsyncStorage.setItem("currentUser", JSON.stringify(user));
  await AsyncStorage.setItem("currentFreight", JSON.stringify(user));
  await AsyncStorage.setItem("currentFreightUser", JSON.stringify(user));
  await AsyncStorage.setItem("currentFreightCarrier", JSON.stringify(user));
  await AsyncStorage.setItem("farm2homeCurrentFreight", JSON.stringify(user));
  await AsyncStorage.setItem("currentUserRole", "freight");
  await AsyncStorage.setItem("userRole", "freight");
}

function goTo(route: FreightRoute) {
  router.push(route as any);
}

export default function FreightSubscriptionScreen() {
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [manualCustomerId, setManualCustomerId] = useState("");

  const [loading, setLoading] = useState(false);
  const [screenLoading, setScreenLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  const [freightUser, setFreightUser] = useState<any>(null);

  useFocusEffect(
    useCallback(() => {
      loadFreightUser();
    }, [])
  );

  const stripeCustomerId = useMemo(
    () =>
      pickCus(
        freightUser?.stripeCustomerId,
        freightUser?.stripe_customer_id,
        freightUser?.stripeId,
        freightUser?.stripe_id
      ),
    [freightUser]
  );

  const stripeSubscriptionId = useMemo(
    () =>
      pickSub(
        freightUser?.stripeSubscriptionId,
        freightUser?.stripe_subscription_id,
        freightUser?.subscriptionId,
        freightUser?.subscription_id
      ),
    [freightUser]
  );

  const stripeAccountId = useMemo(
    () =>
      pickAcct(
        freightUser?.stripeAccountId,
        freightUser?.stripe_account_id,
        freightUser?.freightAccount,
        freightUser?.freight_account
      ),
    [freightUser]
  );

  const activeSubscription = isActiveStatus(
    freightUser?.subscriptionStatus ||
      freightUser?.subscription_status ||
      freightUser?.membershipStatus ||
      freightUser?.membership_status
  );

  const setupScore = useMemo(() => {
    let score = 0;
    if (freightUser?.id || freightUser?.freightId) score += 25;
    if (stripeCustomerId) score += 25;
    if (stripeSubscriptionId) score += 25;
    if (activeSubscription) score += 25;
    return score;
  }, [freightUser, stripeCustomerId, stripeSubscriptionId, activeSubscription]);

  async function getStoredFreightUser() {
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

  function buildLocalUser(row: any, sub: any = {}, stored: any = {}) {
    const realId =
      row?.id ||
      row?.freight_id ||
      sub?.freight_id ||
      stored?.id ||
      stored?.freightId ||
      stored?.freight_id ||
      "";

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

    const subscriptionStatus =
      row?.subscription_status ||
      sub?.subscription_status ||
      row?.membership_status ||
      stored?.subscriptionStatus ||
      stored?.subscription_status ||
      stored?.membershipStatus ||
      "not_started";

    return {
      ...(stored || {}),
      ...(row || {}),
      id: realId,
      freightId: realId,
      freight_id: realId,
      role: "freight",
      email: normalize(row?.email || sub?.freight_email || stored?.email || ""),
      accountId: row?.account_id || sub?.freight_account || stored?.accountId || stored?.account_id || "",
      account_id: row?.account_id || stored?.account_id || stored?.accountId || "",
      companyName:
        row?.company_name ||
        row?.business_name ||
        sub?.name ||
        stored?.companyName ||
        stored?.businessName ||
        "",
      company_name:
        row?.company_name ||
        row?.business_name ||
        sub?.name ||
        stored?.company_name ||
        stored?.business_name ||
        "",
      businessName:
        row?.business_name ||
        row?.company_name ||
        sub?.name ||
        stored?.businessName ||
        stored?.companyName ||
        "",
      business_name:
        row?.business_name ||
        row?.company_name ||
        sub?.name ||
        stored?.business_name ||
        stored?.company_name ||
        "",
      username: row?.username || sub?.username || stored?.username || "",
      membershipStatus: row?.membership_status || subscriptionStatus,
      membership_status: row?.membership_status || subscriptionStatus,
      subscriptionStatus,
      subscription_status: subscriptionStatus,
      current_period_end: row?.current_period_end || sub?.current_period_end || stored?.current_period_end || null,
      accountActive: Boolean(row?.account_active ?? stored?.accountActive ?? isActiveStatus(subscriptionStatus)),
      freightBoardAccess: isActiveStatus(subscriptionStatus),
      hasActiveSubscription: isActiveStatus(subscriptionStatus),
      stripeId: customerId,
      stripe_id: customerId,
      stripeCustomerId: customerId,
      stripe_customer_id: customerId,
      stripeSubscriptionId: subscriptionId,
      stripe_subscription_id: subscriptionId,
      subscriptionId,
      subscription_id: subscriptionId,
      stripeAccountId: connectAccount,
      stripe_account_id: connectAccount,
      freightAccount: connectAccount,
      freight_account: connectAccount,
    };
  }

  async function findSubscription(freightId: string, userEmail: string) {
    const filters = [
      freightId ? `freight_id.eq.${freightId}` : "",
      userEmail ? `freight_email.eq.${userEmail}` : "",
    ]
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
      console.log("Subscription lookup error:", error.message);
      return null;
    }

    return Array.isArray(data) && data.length > 0 ? data[0] : null;
  }

  async function syncFreightUserFromSubscription(user: any) {
    const freightId = clean(user?.id || user?.freightId || user?.freight_id);
    const userEmail = normalize(user?.email);

    if (!freightId && !userEmail) return;

    const updatePayload: any = {
      stripe_customer_id: pickCus(user?.stripeCustomerId, user?.stripe_customer_id, user?.stripeId, user?.stripe_id) || null,
      stripe_id: pickCus(user?.stripeCustomerId, user?.stripe_customer_id, user?.stripeId, user?.stripe_id) || null,
      stripe_subscription_id: pickSub(user?.stripeSubscriptionId, user?.stripe_subscription_id, user?.subscriptionId, user?.subscription_id) || null,
      subscription_id: pickSub(user?.stripeSubscriptionId, user?.stripe_subscription_id, user?.subscriptionId, user?.subscription_id) || null,
      subscription_status: user?.subscription_status || user?.subscriptionStatus || "not_started",
      membership_status: user?.membership_status || user?.membershipStatus || user?.subscription_status || "not_started",
      account_active: isActiveStatus(user?.subscription_status || user?.subscriptionStatus),
      updated_at: new Date().toISOString(),
    };

    const connectAcct = pickAcct(user?.stripeAccountId, user?.stripe_account_id, user?.freightAccount, user?.freight_account);
    if (connectAcct) {
      updatePayload.stripe_account_id = connectAcct;
      updatePayload.freight_account = connectAcct;
      updatePayload.stripe_connect_status = "started";
    }

    if (freightId) {
      await supabase
        .from("freight_users")
        .update(updatePayload)
        .or(`id.eq.${freightId},freight_id.eq.${freightId},auth_user_id.eq.${freightId},profile_id.eq.${freightId}`);
    } else if (userEmail) {
      await supabase.from("freight_users").update(updatePayload).eq("email", userEmail);
    }
  }

  async function loadFreightUser() {
    try {
      setScreenLoading(true);

      const stored = await getStoredFreightUser();
      const { data: authData } = await supabase.auth.getUser();

      const authId = clean(authData?.user?.id || "");
      const savedEmail = normalize(stored?.email || authData?.user?.email || "");
      const storedId = clean(stored?.id || stored?.freightId || stored?.freight_id || "");
      const accountId = clean(stored?.accountId || stored?.account_id || "");

      if (!savedEmail && !authId && !storedId && !accountId) {
        router.replace(ROUTES.login as any);
        return;
      }

      const filters = [
        authId ? `id.eq.${authId}` : "",
        authId ? `auth_user_id.eq.${authId}` : "",
        authId ? `profile_id.eq.${authId}` : "",
        authId ? `freight_id.eq.${authId}` : "",
        storedId ? `id.eq.${storedId}` : "",
        storedId ? `freight_id.eq.${storedId}` : "",
        savedEmail ? `email.eq.${savedEmail}` : "",
        accountId ? `account_id.eq.${accountId}` : "",
      ]
        .filter(Boolean)
        .join(",");

      const { data: dbRows, error } = await supabase.from("freight_users").select("*").or(filters).limit(1);

      if (error) {
        Alert.alert("Load Error", error.message);
        return;
      }

      const dbFreight = Array.isArray(dbRows) && dbRows.length > 0 ? dbRows[0] : null;

      if (!dbFreight?.id) {
        Alert.alert("Freight Profile Missing", "Please complete freight registration first.");
        router.replace(ROUTES.register as any);
        return;
      }

      const sub = await findSubscription(dbFreight.id || storedId || authId, normalize(dbFreight.email || savedEmail));
      const merged = buildLocalUser(dbFreight, sub, stored);

      await syncFreightUserFromSubscription(merged);

      setEmail(merged.email || "");
      setCompanyName(merged.companyName || merged.businessName || "");
      setManualCustomerId(merged.stripeCustomerId || "");

      setFreightUser(merged);
      await saveSession(merged);
    } catch (error: any) {
      Alert.alert("Load Error", error?.message || "Unable to load freight subscription.");
    } finally {
      setScreenLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadFreightUser();
  }

  async function openUrl(url: string) {
    if (!url || !url.startsWith("http")) {
      Alert.alert("Stripe Error", "Invalid Stripe URL.");
      return;
    }

    if (Platform.OS === "web") {
      globalThis.location.assign(url);
      return;
    }

    await WebBrowser.openBrowserAsync(url);
  }

  async function refreshFromSupabase() {
    await loadFreightUser();
  }

  async function syncExistingSubscription(silent = false) {
    if (!freightUser?.id && !freightUser?.freightId) {
      if (!silent) Alert.alert("Save Required", "Save freight registration first.");
      return null;
    }

    try {
      setSyncing(true);

      const freightId = freightUser.id || freightUser.freightId;

      const response = await fetch(`${API_BASE_URL}/payments/force-sync-freight-subscription`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "freight",
          userId: freightId,
          freightId,
          freight_id: freightId,
          accountId: freightUser.accountId || freightUser.account_id || "",
          account_id: freightUser.accountId || freightUser.account_id || "",
          email: normalize(email || freightUser.email),
          freight_email: normalize(email || freightUser.email),
          businessName: companyName.trim() || freightUser.companyName,
          companyName: companyName.trim() || freightUser.companyName,
          name: companyName.trim() || freightUser.companyName,
          username: normalize(freightUser.username || email),
          stripeCustomerId: manualCustomerId.trim(),
          stripe_customer_id: manualCustomerId.trim(),
        }),
      });

      const json = await parseJsonResponse(response);

      if (!response.ok || !json.success) {
        if (!silent) {
          Alert.alert(
            "Sync Not Found",
            json.error || "No existing Stripe freight subscription was found. Do not purchase again if you already paid."
          );
        }
        return null;
      }

      await refreshFromSupabase();

      if (!silent) {
        Alert.alert("Subscription Restored", "Your existing Stripe subscription was linked to Supabase.");
      }

      return json;
    } catch (error: any) {
      if (!silent) Alert.alert("Sync Error", error?.message || "Unable to sync subscription.");
      return null;
    } finally {
      setSyncing(false);
    }
  }

  async function linkStripeCustomerManually() {
    const customerId = manualCustomerId.trim();
    const freightId = freightUser?.id || freightUser?.freightId;

    if (!freightId) {
      Alert.alert("Save Required", "Save freight registration first.");
      return;
    }

    if (!customerId.startsWith("cus_")) {
      Alert.alert("Invalid Stripe Customer", "Paste the Stripe Customer ID that starts with cus_.");
      return;
    }

    try {
      setSyncing(true);

      const response = await fetch(`${API_BASE_URL}/payments/link-freight-stripe-account`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          freightId,
          freight_id: freightId,
          userId: freightId,
          email: normalize(email || freightUser.email),
          freight_email: normalize(email || freightUser.email),
          stripeCustomerId: customerId,
          stripe_customer_id: customerId,
        }),
      });

      const json = await parseJsonResponse(response);

      if (!response.ok || !json.success) {
        Alert.alert("Link Failed", json.error || "Unable to link Stripe customer.");
        return;
      }

      await refreshFromSupabase();
      Alert.alert("Stripe Linked", "The Stripe customer/subscription was linked to this freight account.");
    } catch (error: any) {
      Alert.alert("Link Error", error?.message || "Unable to link Stripe customer.");
    } finally {
      setSyncing(false);
    }
  }

  async function startSubscription() {
    if (loading) return;

    const cleanEmail = normalize(email);
    const cleanCompany = companyName.trim();
    const freightId = freightUser?.id || freightUser?.freightId;
    const accountId = freightUser?.accountId || freightUser?.account_id || "";

    if (!freightId) {
      Alert.alert("Profile Missing", "Please complete freight registration before subscribing.");
      return;
    }

    if (!cleanCompany) {
      Alert.alert("Missing Company Name", "Please enter your company name.");
      return;
    }

    if (!cleanEmail || !cleanEmail.includes("@")) {
      Alert.alert("Missing Email", "Please enter a valid freight email.");
      return;
    }

    if (activeSubscription) {
      Alert.alert("Already Active", "This freight account already has an active subscription.", [
        { text: "Dashboard", onPress: () => router.replace(ROUTES.dashboard as any) },
        { text: "Stay Here", style: "cancel" },
      ]);
      return;
    }

    const restored = await syncExistingSubscription(true);

    if (restored?.stripeSubscriptionId || restored?.stripe_subscription_id) {
      Alert.alert("Subscription Found", "Your existing Stripe subscription was restored.", [
        { text: "Dashboard", onPress: () => router.replace(ROUTES.dashboard as any) },
        { text: "Stay Here", style: "cancel" },
      ]);
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(`${API_BASE_URL}/payments/create-freight-subscription-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "freight",
          planType: "freight",
          userId: freightId,
          freightId,
          freight_id: freightId,
          accountId,
          account_id: accountId,
          email: cleanEmail,
          freight_email: cleanEmail,
          customerEmail: cleanEmail,
          companyName: cleanCompany,
          businessName: cleanCompany,
          name: cleanCompany,
          username: normalize(freightUser?.username || cleanEmail),
          stripeAccountId,
          stripe_account_id: stripeAccountId,
          freight_account: stripeAccountId,
          successUrl: `${API_BASE_URL.replace("/api", "")}/freight/payment-success?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${API_BASE_URL.replace("/api", "")}/freight/subscription`,
        }),
      });

      const json = await parseJsonResponse(response);

      if (!response.ok || !json.success) {
        Alert.alert("Checkout Error", json.error || "Backend checkout failed. Do not use a Stripe payment link.");
        return;
      }

      if (json.alreadySubscribed) {
        await refreshFromSupabase();

        Alert.alert("Subscription Already Linked", "Your Stripe subscription is already active.", [
          { text: "Dashboard", onPress: () => router.replace(ROUTES.dashboard as any) },
          { text: "Stay Here", style: "cancel" },
        ]);
        return;
      }

      if (!json.url) {
        Alert.alert("Checkout Error", "Backend did not return a Stripe Checkout URL.");
        return;
      }

      await AsyncStorage.setItem(
        "pendingFreightSubscription",
        JSON.stringify({
          ...freightUser,
          id: freightId,
          freightId,
          freight_id: freightId,
          accountId,
          account_id: accountId,
          email: cleanEmail,
          companyName: cleanCompany,
          businessName: cleanCompany,
          role: "freight",
          stripeCustomerId: json.stripeCustomerId || json.stripe_customer_id || "",
          checkoutSessionId: json.sessionId || json.id || "",
        })
      );

      await openUrl(json.url);
    } catch (error: any) {
      Alert.alert("Subscription Error", error?.message || "Unable to start freight subscription.");
    } finally {
      setLoading(false);
    }
  }

  async function manageBillingPortal() {
    if (!stripeCustomerId) {
      Alert.alert("Missing Stripe Customer", "No Stripe customer ID was found. Link or sync subscription first.");
      return;
    }

    try {
      setPortalLoading(true);

      const response = await fetch(`${API_BASE_URL}/payments/create-customer-portal-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: stripeCustomerId,
          stripeCustomerId,
          stripe_customer_id: stripeCustomerId,
          role: "freight",
          carrierId: freightUser?.id || freightUser?.freightId,
          freightId: freightUser?.id || freightUser?.freightId,
          freight_id: freightUser?.id || freightUser?.freightId,
          returnUrl: Platform.OS === "web" ? globalThis.location.href : "farm2home://freight/subscription",
        }),
      });

      const json = await parseJsonResponse(response);

      if (!response.ok || !json.url) {
        Alert.alert("Billing Error", json.error || "Unable to open billing portal.");
        return;
      }

      await openUrl(json.url);
    } catch (error: any) {
      Alert.alert("Billing Error", error?.message || "Unable to open billing portal.");
    } finally {
      setPortalLoading(false);
    }
  }

  async function cancelSubscription() {
    if (!stripeSubscriptionId) {
      Alert.alert("No Subscription", "No active freight subscription ID was found.");
      return;
    }

    Alert.alert("Cancel Freight Membership", "Are you sure you want to cancel this membership?", [
      { text: "No", style: "cancel" },
      {
        text: "Yes, Cancel",
        style: "destructive",
        onPress: async () => {
          try {
            setCancelLoading(true);

            const response = await fetch(`${API_BASE_URL}/payments/cancel-subscription`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                subscriptionId: stripeSubscriptionId,
                subscription_id: stripeSubscriptionId,
                carrierId: freightUser?.id || freightUser?.freightId,
                freightId: freightUser?.id || freightUser?.freightId,
                role: "freight",
              }),
            });

            const json = await parseJsonResponse(response);

            if (!response.ok || json.error) {
              Alert.alert("Stripe Error", json.error || "Unable to cancel.");
              return;
            }

            await refreshFromSupabase();
            Alert.alert("Canceled", "Freight subscription was canceled.");
          } catch (error: any) {
            Alert.alert("Cancel Error", error?.message || "Unable to cancel subscription.");
          } finally {
            setCancelLoading(false);
          }
        },
      },
    ]);
  }

  function membershipStatus() {
    return (
      freightUser?.membershipStatus ||
      freightUser?.membership_status ||
      freightUser?.subscriptionStatus ||
      freightUser?.subscription_status ||
      "not_started"
    );
  }

  function statusColor() {
    const status = normalize(membershipStatus());

    if (status.includes("active") || status.includes("trial")) return COLORS.green;
    if (status.includes("past_due") || status.includes("pending")) return COLORS.amber;
    if (status.includes("cancel") || status.includes("incomplete")) return COLORS.red;

    return COLORS.amber;
  }

  if (screenLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.centerText}>Loading freight subscription...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />

      <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={styles.container}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.shell}>
            <View style={styles.sidebar}>
              <View style={styles.brandRow}>
                <View style={styles.brandIcon}>
                  <Ionicons name="card-outline" size={28} color={COLORS.white} />
                </View>
                <View>
                  <Text style={styles.brandTitle}>Farm2Home</Text>
                  <Text style={styles.brandSubtitle}>Subscription</Text>
                </View>
              </View>

              <View style={styles.sideDivider} />

              <SidebarLink icon="grid-outline" title="Dashboard" route={ROUTES.dashboard} />
              <SidebarLink icon="search-outline" title="Load Board" route={ROUTES.board} />
              <SidebarLink icon="briefcase-outline" title="My Loads" route={ROUTES.myLoads} />
              <SidebarLink icon="card-outline" title="Subscription" active route={ROUTES.subscription} />
              <SidebarLink icon="business-outline" title="Connect Bank" route={ROUTES.connectBank} />
              <SidebarLink icon="person-outline" title="Profile" route={ROUTES.profile} />

              <View style={styles.sideNote}>
                <Ionicons name="shield-checkmark-outline" size={20} color="#A5B4FC" />
                <Text style={styles.sideNoteText}>
                  Subscription IDs are hydrated from freight_subscriptions and saved back to freight_users.
                </Text>
              </View>
            </View>

            <View style={styles.main}>
              <View style={styles.topPanel}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.eyebrow}>Fina Admin Membership</Text>
                  <Text style={styles.pageTitle}>Freight Membership</Text>
                  <Text style={styles.pageSubtitle}>
                    Manage Stripe Checkout, restore existing paid subscriptions, billing portal, cancellation, and saved Stripe IDs.
                  </Text>
                </View>

                <TouchableOpacity style={styles.topButton} onPress={() => goTo(ROUTES.dashboard)}>
                  <Ionicons name="grid-outline" size={22} color={COLORS.primary} />
                </TouchableOpacity>
              </View>

              <View style={styles.profilePanel}>
                <View style={styles.profileAvatar}>
                  <Ionicons name="business-outline" size={26} color={COLORS.white} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.companyName}>{companyName || "Freight Carrier"}</Text>
                  <Text style={styles.companyEmail}>{email || "Freight account"}</Text>
                  <Text style={styles.accountId}>Account ID: {freightUser?.accountId || freightUser?.account_id || "Not assigned"}</Text>
                </View>
                <View style={[styles.statusMini, { backgroundColor: statusColor() }]}>
                  <Text style={styles.statusMiniText}>{membershipStatus()}</Text>
                </View>
              </View>

              <View style={styles.metricGrid}>
                <MetricCard icon="person-circle-outline" label="Customer" value={shortId(stripeCustomerId)} ready={Boolean(stripeCustomerId)} />
                <MetricCard icon="repeat-outline" label="Subscription" value={shortId(stripeSubscriptionId)} ready={Boolean(stripeSubscriptionId)} />
                <MetricCard icon="business-outline" label="Connect" value={shortId(stripeAccountId)} ready={Boolean(stripeAccountId)} />
                <MetricCard icon="checkmark-circle-outline" label="Status" value={activeSubscription ? "Active" : "Pending"} ready={activeSubscription} />
              </View>

              <View style={styles.gridTwo}>
                <View style={styles.card}>
                  <SectionHeader
                    icon="analytics-outline"
                    title="Membership Progress"
                    subtitle="Profile, Stripe customer, subscription ID, and active membership."
                  />

                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${setupScore}%` }]} />
                  </View>

                  <InfoRow label="Freight Profile" value={freightUser?.id ? shortId(freightUser.id) : "Missing"} good={Boolean(freightUser?.id)} />
                  <InfoRow label="Stripe Customer" value={shortId(stripeCustomerId)} good={Boolean(stripeCustomerId)} />
                  <InfoRow label="Stripe Subscription" value={shortId(stripeSubscriptionId)} good={Boolean(stripeSubscriptionId)} />
                  <InfoRow label="Membership Status" value={membershipStatus()} good={activeSubscription} />

                  <TouchableOpacity style={[styles.primaryButton, loading && styles.disabledButton]} onPress={startSubscription} disabled={loading}>
                    {loading ? (
                      <ActivityIndicator color={COLORS.white} />
                    ) : (
                      <>
                        <Ionicons name="card-outline" size={18} color={COLORS.white} />
                        <Text style={styles.primaryButtonText}>
                          {activeSubscription ? "Subscription Active" : "Start Backend Stripe Checkout"}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.secondaryButton, syncing && styles.disabledButton]}
                    onPress={() => syncExistingSubscription(false)}
                    disabled={syncing}
                  >
                    {syncing ? (
                      <ActivityIndicator color={COLORS.primary} />
                    ) : (
                      <>
                        <Ionicons name="refresh-outline" size={18} color={COLORS.primary} />
                        <Text style={styles.secondaryButtonText}>Restore Existing Paid Subscription</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.darkButtonInline} onPress={() => goTo(ROUTES.dashboard)}>
                    <Ionicons name="grid-outline" size={18} color={COLORS.white} />
                    <Text style={styles.darkButtonInlineText}>Go to Freight Dashboard</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.card}>
                  <SectionHeader
                    icon="business-outline"
                    title="Billing Profile"
                    subtitle="Confirm company info before opening backend Stripe Checkout."
                  />

                  <Text style={styles.inputLabel}>Company Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Company Name"
                    placeholderTextColor="#94A3B8"
                    value={companyName}
                    onChangeText={setCompanyName}
                  />

                  <Text style={styles.inputLabel}>Freight Email</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Freight Email"
                    placeholderTextColor="#94A3B8"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={email}
                    onChangeText={setEmail}
                  />

                  <Text style={styles.inputLabel}>Stripe Customer ID</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="cus_..."
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={manualCustomerId}
                    onChangeText={setManualCustomerId}
                  />

                  <TouchableOpacity
                    style={[styles.secondaryButton, syncing && styles.disabledButton]}
                    onPress={linkStripeCustomerManually}
                    disabled={syncing}
                  >
                    {syncing ? (
                      <ActivityIndicator color={COLORS.primary} />
                    ) : (
                      <>
                        <Ionicons name="link-outline" size={18} color={COLORS.primary} />
                        <Text style={styles.secondaryButtonText}>Link Existing Stripe Customer</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.gridTwo}>
                <View style={styles.card}>
                  <SectionHeader icon="settings-outline" title="Billing Management" subtitle="Use after Stripe customer ID is linked." />

                  <TouchableOpacity style={styles.secondaryButton} onPress={manageBillingPortal} disabled={portalLoading}>
                    {portalLoading ? (
                      <ActivityIndicator color={COLORS.primary} />
                    ) : (
                      <>
                        <Ionicons name="settings-outline" size={18} color={COLORS.primary} />
                        <Text style={styles.secondaryButtonText}>Manage Billing Portal</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.cancelButton} onPress={cancelSubscription} disabled={cancelLoading}>
                    {cancelLoading ? (
                      <ActivityIndicator color={COLORS.white} />
                    ) : (
                      <>
                        <Ionicons name="close-circle-outline" size={18} color={COLORS.white} />
                        <Text style={styles.cancelButtonText}>Cancel Subscription</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                <View style={styles.card}>
                  <SectionHeader icon="sparkles-outline" title="Membership Includes" subtitle="Carrier tools built for freight operations." />

                  {[
                    "Freight board access",
                    "Live load board tools",
                    "Route and dispatch support",
                    "Payment tracking",
                    "Broker / farmer details",
                    "Freight profile and billing management",
                  ].map((item) => (
                    <View key={item} style={styles.featureItem}>
                      <Ionicons name="checkmark-circle" size={18} color={COLORS.green} />
                      <Text style={styles.featureText}>{item}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.card}>
                <SectionHeader icon="server-outline" title="Saved Stripe IDs" subtitle="IDs used by login, dashboard, connect-bank, and payouts." />

                <View style={styles.idGrid}>
                  <IdRow label="Freight UUID" value={freightUser?.id || freightUser?.freightId || ""} />
                  <IdRow label="Static Account ID" value={freightUser?.accountId || freightUser?.account_id || ""} />
                  <IdRow label="Stripe Customer" value={stripeCustomerId} />
                  <IdRow label="Stripe Subscription" value={stripeSubscriptionId} />
                  <IdRow label="Connect Account" value={stripeAccountId} />
                  <IdRow label="Current Period End" value={freightUser?.current_period_end || ""} />
                </View>
              </View>

              <View style={styles.card}>
                <SectionHeader icon="apps-outline" title="Quick Navigation" subtitle="Continue freight setup or return to operations." />

                <View style={styles.quickGrid}>
                  <QuickLink icon="grid-outline" label="Dashboard" route={ROUTES.dashboard} />
                  <QuickLink icon="list-outline" label="Load Board" route={ROUTES.board} />
                  <QuickLink icon="briefcase-outline" label="My Loads" route={ROUTES.myLoads} />
                  <QuickLink icon="pulse-outline" label="Live Loads" route={ROUTES.liveLoads} />
                  <QuickLink icon="business-outline" label="Connect Bank" route={ROUTES.connectBank} />
                  <QuickLink icon="person-outline" label="Profile" route={ROUTES.profile} />
                  <QuickLink icon="settings-outline" label="Settings" route={ROUTES.settings} />
                  <QuickLink icon="headset-outline" label="Support" route={ROUTES.support} />
                  <QuickLink icon="help-circle-outline" label="Help" route={ROUTES.help} />
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
      <Text style={styles.metricValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function InfoRow({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <View style={styles.infoRow}>
      <View style={[styles.infoIcon, good ? styles.infoGood : styles.infoWarn]}>
        <Ionicons name={good ? "checkmark-outline" : "alert-circle-outline"} size={16} color={good ? COLORS.white : COLORS.amber} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
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
        <Ionicons name={icon} size={21} color={COLORS.primary} />
      </View>
      <Text style={styles.quickLinkText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  page: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center", padding: 24 },
  centerText: { color: COLORS.muted, marginTop: 12, fontWeight: "800" },
  container: { flexGrow: 1, paddingBottom: 40 },
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
  brandIcon: {
    width: 54,
    height: 54,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  brandTitle: { color: COLORS.white, fontSize: 21, fontWeight: "900" },
  brandSubtitle: { color: "#A5B4FC", fontWeight: "800", marginTop: 2 },
  sideDivider: { height: 1, backgroundColor: "#1E293B", marginVertical: 22 },
  sidebarLink: {
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 14,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    marginBottom: 8,
  },
  sidebarLinkActive: { backgroundColor: COLORS.primary },
  sidebarLinkText: { color: "#CBD5E1", fontWeight: "900" },
  sidebarLinkTextActive: { color: COLORS.white },
  sideNote: {
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "#1E293B",
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    marginTop: 12,
  },
  sideNoteText: { color: "#CBD5E1", fontWeight: "700", lineHeight: 20, flex: 1 },
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
  eyebrow: { color: COLORS.primary, fontWeight: "900", fontSize: 12, letterSpacing: 1, textTransform: "uppercase" },
  pageTitle: { color: COLORS.text, fontSize: 34, fontWeight: "900", marginTop: 6 },
  pageSubtitle: { color: COLORS.muted, fontWeight: "700", lineHeight: 22, marginTop: 7, maxWidth: 760 },
  topButton: {
    width: 50,
    height: 50,
    borderRadius: 18,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
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
  profileAvatar: {
    width: 58,
    height: 58,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  companyName: { color: COLORS.text, fontSize: 20, fontWeight: "900" },
  companyEmail: { color: COLORS.muted, fontWeight: "700", marginTop: 4 },
  accountId: { color: COLORS.muted, fontWeight: "800", marginTop: 4, fontSize: 12 },
  statusMini: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8 },
  statusMiniText: { color: COLORS.white, fontWeight: "900", fontSize: 12, textTransform: "capitalize" },
  metricGrid: { flexDirection: Platform.OS === "web" ? "row" : "column", gap: 12, marginBottom: 14 },
  metricCard: {
    flex: 1,
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
  gridTwo: { flexDirection: Platform.OS === "web" ? "row" : "column", gap: 14, alignItems: "flex-start" },
  card: {
    flex: 1,
    width: "100%",
    backgroundColor: COLORS.white,
    borderRadius: 26,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
  },
  sectionHeader: { flexDirection: "row", gap: 12, alignItems: "flex-start", marginBottom: 16 },
  sectionIcon: { width: 42, height: 42, borderRadius: 16, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  sectionTitle: { color: COLORS.text, fontSize: 21, fontWeight: "900" },
  sectionSubtitle: { color: COLORS.muted, fontWeight: "700", lineHeight: 20, marginTop: 3 },
  progressTrack: { height: 10, borderRadius: 999, backgroundColor: "#E5E7EB", overflow: "hidden", marginBottom: 14 },
  progressFill: { height: 10, borderRadius: 999, backgroundColor: COLORS.primary },
  infoRow: {
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    marginBottom: 10,
  },
  infoIcon: { width: 32, height: 32, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  infoGood: { backgroundColor: COLORS.green },
  infoWarn: { backgroundColor: COLORS.amberSoft },
  infoLabel: { color: COLORS.text, fontWeight: "900" },
  infoValue: { color: COLORS.muted, fontWeight: "700", marginTop: 2, textTransform: "capitalize" },
  primaryButton: {
    backgroundColor: COLORS.primary,
    padding: 15,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
    width: "100%",
  },
  primaryButtonText: { color: COLORS.white, fontWeight: "900", textAlign: "center", flexShrink: 1 },
  secondaryButton: {
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    padding: 15,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    width: "100%",
  },
  secondaryButtonText: { color: COLORS.primary, fontWeight: "900", textAlign: "center", flexShrink: 1 },
  darkButtonInline: {
    backgroundColor: COLORS.navy,
    borderRadius: 16,
    padding: 15,
    marginTop: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  darkButtonInlineText: { color: COLORS.white, fontWeight: "900" },
  disabledButton: { opacity: 0.65 },
  inputLabel: { color: COLORS.text, fontWeight: "900", marginBottom: 7 },
  input: {
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
  },
  cancelButton: {
    backgroundColor: COLORS.red,
    padding: 15,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    width: "100%",
  },
  cancelButtonText: { color: COLORS.white, fontWeight: "900" },
  featureItem: {
    backgroundColor: COLORS.panel,
    borderRadius: 14,
    padding: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  featureText: { color: COLORS.text, fontWeight: "800", flex: 1, lineHeight: 20 },
  idGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  idRow: {
    width: Platform.OS === "web" ? "31.5%" : "100%",
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 13,
  },
  idLabel: { color: COLORS.muted, fontWeight: "900", textTransform: "uppercase", fontSize: 11 },
  idValue: { color: COLORS.text, fontWeight: "900", marginTop: 5 },
  idMissing: { color: COLORS.amber },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  quickLink: {
    width: Platform.OS === "web" ? "23.5%" : "48%",
    backgroundColor: COLORS.panel,
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 102,
    justifyContent: "space-between",
  },
  quickIcon: { width: 42, height: 42, borderRadius: 15, backgroundColor: COLORS.primarySoft, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  quickLinkText: { color: COLORS.text, fontWeight: "900" },
});
