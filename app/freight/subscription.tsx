// app/freight/subscription.tsx

import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
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
  slate: "#64748B",
};

function normalize(value: any) {
  return String(value || "").trim().toLowerCase();
}

function isActiveStatus(status: any) {
  return ["active", "trialing", "past_due"].includes(normalize(status));
}

async function saveSession(user: any) {
  await AsyncStorage.setItem("currentUser", JSON.stringify(user));
  await AsyncStorage.setItem("currentFreight", JSON.stringify(user));
  await AsyncStorage.setItem("currentFreightUser", JSON.stringify(user));
  await AsyncStorage.setItem("currentFreightCarrier", JSON.stringify(user));
  await AsyncStorage.setItem("currentUserRole", "freight");
  await AsyncStorage.setItem("userRole", "freight");
}

export default function FreightSubscriptionScreen() {
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [manualCustomerId, setManualCustomerId] = useState("");

  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  const [freightUser, setFreightUser] = useState<any>(null);

  useFocusEffect(
    useCallback(() => {
      loadFreightUser();
    }, [])
  );

  async function getStoredFreightUser() {
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

  function buildLocalUser(row: any, stored: any = {}) {
    const realId = row?.id || row?.freight_id || stored?.id || stored?.freightId || "";

    return {
      ...(stored || {}),
      ...(row || {}),
      id: realId,
      freightId: realId,
      freight_id: realId,
      role: "freight",
      email: normalize(row?.email || stored?.email || ""),
      accountId: row?.account_id || stored?.accountId || stored?.account_id || "",
      account_id: row?.account_id || stored?.account_id || stored?.accountId || "",
      companyName:
        row?.company_name ||
        row?.business_name ||
        stored?.companyName ||
        stored?.businessName ||
        "",
      businessName:
        row?.business_name ||
        row?.company_name ||
        stored?.businessName ||
        stored?.companyName ||
        "",
      username: row?.username || stored?.username || "",
      membershipStatus: row?.membership_status || stored?.membershipStatus || "not_started",
      subscriptionStatus: row?.subscription_status || stored?.subscriptionStatus || "not_started",
      accountActive: Boolean(row?.account_active ?? stored?.accountActive ?? false),
      freightBoardAccess: isActiveStatus(row?.subscription_status || stored?.subscriptionStatus),
      hasActiveSubscription: isActiveStatus(row?.subscription_status || stored?.subscriptionStatus),
      stripeId: row?.stripe_id || row?.stripe_customer_id || stored?.stripeId || "",
      stripe_id: row?.stripe_id || row?.stripe_customer_id || stored?.stripe_id || "",
      stripeCustomerId: row?.stripe_customer_id || row?.stripe_id || stored?.stripeCustomerId || "",
      stripe_customer_id: row?.stripe_customer_id || row?.stripe_id || stored?.stripe_customer_id || "",
      stripeSubscriptionId:
        row?.stripe_subscription_id || row?.subscription_id || stored?.stripeSubscriptionId || "",
      stripe_subscription_id:
        row?.stripe_subscription_id || row?.subscription_id || stored?.stripe_subscription_id || "",
      subscriptionId:
        row?.subscription_id || row?.stripe_subscription_id || stored?.subscriptionId || "",
      subscription_id:
        row?.subscription_id || row?.stripe_subscription_id || stored?.subscription_id || "",
      stripeAccountId: row?.stripe_account_id || stored?.stripeAccountId || "",
      stripe_account_id: row?.stripe_account_id || stored?.stripe_account_id || "",
    };
  }

  async function loadFreightUser() {
    try {
      const stored = await getStoredFreightUser();
      const { data: authData } = await supabase.auth.getUser();

      const savedEmail = normalize(stored?.email || authData?.user?.email || "");

      if (!savedEmail) {
        router.replace(ROUTES.login as any);
        return;
      }

      const { data: dbFreight, error } = await supabase
        .from("freight_users")
        .select("*")
        .eq("email", savedEmail)
        .maybeSingle();

      if (error) {
        Alert.alert("Load Error", error.message);
        return;
      }

      if (!dbFreight?.id) {
        Alert.alert("Freight Profile Missing", "Please complete freight registration first.");
        router.replace(ROUTES.register as any);
        return;
      }

      const merged = buildLocalUser(dbFreight, stored);

      setEmail(merged.email || "");
      setCompanyName(merged.companyName || merged.businessName || "");
      setManualCustomerId(merged.stripeCustomerId || "");

      setFreightUser(merged);
      await saveSession(merged);
    } catch (error: any) {
      Alert.alert("Load Error", error?.message || "Unable to load freight subscription.");
    }
  }

  async function openUrl(url: string) {
    if (!url || !url.startsWith("http")) {
      Alert.alert("Stripe Error", "Invalid Stripe URL.");
      return;
    }

    if (Platform.OS === "web") {
      window.location.href = url;
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
          email: normalize(email || freightUser.email),
          businessName: companyName.trim() || freightUser.companyName,
          companyName: companyName.trim() || freightUser.companyName,
          name: companyName.trim() || freightUser.companyName,
          username: normalize(freightUser.username || email),
          stripeCustomerId: manualCustomerId.trim(),
          stripe_customer_id: manualCustomerId.trim(),
        }),
      });

      const text = await response.text();
      let json: any = {};

      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        json = { success: false, error: text };
      }

      if (!response.ok || !json.success) {
        if (!silent) {
          Alert.alert(
            "Sync Not Found",
            json.error ||
              "No existing Stripe freight subscription was found. Do not purchase again if you already paid."
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
          stripeCustomerId: customerId,
          stripe_customer_id: customerId,
        }),
      });

      const text = await response.text();
      let json: any = {};

      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        json = { success: false, error: text };
      }

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

    if (isActiveStatus(freightUser?.subscriptionStatus || freightUser?.subscription_status)) {
      Alert.alert("Already Active", "This freight account already has an active subscription.");
      return;
    }

    const restored = await syncExistingSubscription(true);

    if (restored?.stripeSubscriptionId) {
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
          customerEmail: cleanEmail,
          companyName: cleanCompany,
          businessName: cleanCompany,
          name: cleanCompany,
          username: normalize(freightUser?.username || cleanEmail),
          successUrl: `${API_BASE_URL.replace("/api", "")}/freight/payment-success?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${API_BASE_URL.replace("/api", "")}/freight/subscription`,
        }),
      });

      const text = await response.text();
      let json: any = {};

      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        json = { success: false, error: text };
      }

      if (!response.ok || !json.success) {
        Alert.alert(
          "Checkout Error",
          json.error || "Backend checkout failed. Do not use a Stripe payment link."
        );
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
          accountId,
          email: cleanEmail,
          companyName: cleanCompany,
          businessName: cleanCompany,
          role: "freight",
          stripeCustomerId: json.stripeCustomerId || "",
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
    const stripeCustomerId =
      freightUser?.stripeCustomerId ||
      freightUser?.stripe_customer_id ||
      freightUser?.stripeId ||
      freightUser?.stripe_id;

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
          role: "freight",
          carrierId: freightUser?.id || freightUser?.freightId,
          returnUrl: Platform.OS === "web" ? window.location.href : "farm2home://freight/subscription",
        }),
      });

      const text = await response.text();
      let json: any = {};

      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        json = { success: false, error: text };
      }

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
    const subscriptionId =
      freightUser?.stripeSubscriptionId ||
      freightUser?.stripe_subscription_id ||
      freightUser?.subscriptionId ||
      freightUser?.subscription_id;

    if (!subscriptionId) {
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
                subscriptionId,
                carrierId: freightUser?.id || freightUser?.freightId,
                role: "freight",
              }),
            });

            const text = await response.text();
            let json: any = {};

            try {
              json = text ? JSON.parse(text) : {};
            } catch {
              json = { success: false, error: text };
            }

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

    if (status.includes("active")) return COLORS.green;
    if (status.includes("pending")) return COLORS.amber;
    if (status.includes("cancel")) return COLORS.red;

    return COLORS.slate;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />

      <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>Farm2Home Freight Connect</Text>
              <Text style={styles.title}>Freight Membership</Text>
              <Text style={styles.subtitle}>
                Backend Stripe Checkout only. No static payment links. No local activation.
              </Text>
            </View>

            <TouchableOpacity style={styles.heroIcon} onPress={() => router.push(ROUTES.dashboard as any)}>
              <Ionicons name="card-outline" size={34} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.priceCard}>
            <Text style={styles.priceLabel}>Monthly Freight Membership</Text>
            <Text style={styles.price}>Freight Access Plan</Text>
            <Text style={styles.priceSub}>Stripe Customer: {freightUser?.stripeCustomerId || "Not linked"}</Text>
            <Text style={styles.priceSub}>Subscription: {freightUser?.stripeSubscriptionId || "Not linked"}</Text>

            <View style={[styles.statusPill, { backgroundColor: statusColor() }]}>
              <Text style={styles.statusPillText}>{membershipStatus()}</Text>
            </View>
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
              placeholderTextColor="#9CA3AF"
              value={companyName}
              onChangeText={setCompanyName}
            />

            <Text style={styles.inputLabel}>Freight Email</Text>
            <TextInput
              style={styles.input}
              placeholder="Freight Email"
              placeholderTextColor="#9CA3AF"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
            />

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.disabledButton]}
              onPress={startSubscription}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="card-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.primaryButtonText}>Start Backend Stripe Checkout</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryButton, syncing && styles.disabledButton]}
              onPress={() => syncExistingSubscription(false)}
              disabled={syncing}
            >
              {syncing ? (
                <ActivityIndicator color={COLORS.red} />
              ) : (
                <>
                  <Ionicons name="refresh-outline" size={18} color={COLORS.red} />
                  <Text style={styles.secondaryButtonText}>Restore Existing Paid Subscription</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <SectionHeader
              icon="link-outline"
              title="Manual Stripe Link"
              subtitle="Use this only for subscriptions already paid with a Stripe payment link."
            />

            <Text style={styles.inputLabel}>Stripe Customer ID</Text>
            <TextInput
              style={styles.input}
              placeholder="cus_..."
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              autoCorrect={false}
              value={manualCustomerId}
              onChangeText={setManualCustomerId}
            />

            <TouchableOpacity
              style={[styles.completedButton, syncing && styles.disabledButton]}
              onPress={linkStripeCustomerManually}
              disabled={syncing}
            >
              {syncing ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="link-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.completedButtonText}>Link Existing Stripe Customer</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.featureBox}>
            <SectionHeader
              icon="sparkles-outline"
              title="Membership Includes"
              subtitle="Carrier tools built for Farm2Home freight operations."
            />

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

          <View style={styles.card}>
            <SectionHeader
              icon="settings-outline"
              title="Billing Management"
              subtitle="Use after Stripe customer ID is linked."
            />

            <TouchableOpacity style={styles.secondaryButton} onPress={manageBillingPortal} disabled={portalLoading}>
              {portalLoading ? (
                <ActivityIndicator color={COLORS.red} />
              ) : (
                <>
                  <Ionicons name="settings-outline" size={18} color={COLORS.red} />
                  <Text style={styles.secondaryButtonText}>Manage Billing Portal</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelButton} onPress={cancelSubscription} disabled={cancelLoading}>
              {cancelLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="close-circle-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.cancelButtonText}>Cancel Subscription</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.quickGrid}>
            <QuickLink icon="grid-outline" label="Dashboard" route={ROUTES.dashboard} />
            <QuickLink icon="list-outline" label="Load Board" route={ROUTES.board} />
            <QuickLink icon="briefcase-outline" label="My Loads" route={ROUTES.myLoads} />
            <QuickLink icon="pulse-outline" label="Live Loads" route={ROUTES.liveLoads} />
            <QuickLink icon="business-outline" label="Profile" route={ROUTES.profile} />
            <QuickLink icon="business-outline" label="Connect Bank" route={ROUTES.connectBank} />
            <QuickLink icon="settings-outline" label="Settings" route={ROUTES.settings} />
            <QuickLink icon="headset-outline" label="Support" route={ROUTES.support} />
            <QuickLink icon="help-circle-outline" label="Help" route={ROUTES.help} />
          </View>

          <TouchableOpacity style={styles.darkButton} onPress={() => router.replace(ROUTES.login as any)}>
            <Text style={styles.darkButtonText}>Back to Freight Login</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
        <Ionicons name={icon} size={20} color="#FFFFFF" />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>
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
  route: string;
}) {
  return (
    <TouchableOpacity style={styles.quickLink} onPress={() => router.push(route as any)}>
      <Ionicons name={icon} size={22} color={COLORS.red} />
      <Text style={styles.quickLinkText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  page: { flex: 1, backgroundColor: COLORS.bg },
  container: { paddingBottom: 90 },
  hero: {
    backgroundColor: COLORS.black,
    paddingTop: 28,
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
  subtitle: { color: "#D1D5DB", lineHeight: 22, fontSize: 14, fontWeight: "700" },
  priceCard: {
    backgroundColor: COLORS.red,
    borderRadius: 22,
    padding: 18,
    marginHorizontal: 18,
    marginTop: 18,
    marginBottom: 14,
  },
  priceLabel: { color: "#FFE4E6", fontWeight: "900", textTransform: "uppercase", fontSize: 12 },
  price: { color: "#FFFFFF", fontSize: 28, fontWeight: "900", marginTop: 5 },
  priceSub: { color: "#FFE4E6", marginTop: 6, fontWeight: "800", lineHeight: 20 },
  statusPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 14,
  },
  statusPillText: { color: "#FFFFFF", fontWeight: "900", textTransform: "capitalize" },
  featureBox: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginHorizontal: 18,
    marginBottom: 16,
  },
  sectionHeader: { flexDirection: "row", gap: 10, alignItems: "flex-start", marginBottom: 14 },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: COLORS.black,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: { color: COLORS.text, fontSize: 21, fontWeight: "900" },
  sectionSubtitle: { color: COLORS.muted, fontWeight: "700", lineHeight: 20, marginTop: 3 },
  featureItem: {
    backgroundColor: COLORS.surface,
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
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 18,
    marginHorizontal: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  inputLabel: { color: COLORS.text, fontWeight: "900", marginBottom: 7 },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
  },
  primaryButton: {
    backgroundColor: COLORS.red,
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
    minHeight: 56,
    flexDirection: "row",
    gap: 8,
  },
  disabledButton: { opacity: 0.6 },
  primaryButtonText: { color: "#FFFFFF", fontWeight: "900", fontSize: 15 },
  completedButton: {
    backgroundColor: COLORS.black,
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
  },
  completedButtonText: { color: "#FFFFFF", fontWeight: "900" },
  secondaryButton: {
    backgroundColor: "#FFF1F2",
    borderWidth: 1,
    borderColor: COLORS.red,
    paddingVertical: 15,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
  },
  secondaryButtonText: { color: COLORS.red, fontWeight: "900" },
  cancelButton: {
    backgroundColor: COLORS.redDark,
    paddingVertical: 15,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
  },
  cancelButtonText: { color: "#FFFFFF", fontWeight: "900" },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 18,
    marginBottom: 16,
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
  quickLinkText: { color: COLORS.text, fontWeight: "900", textAlign: "center" },
  darkButton: {
    backgroundColor: COLORS.black,
    padding: 15,
    borderRadius: 16,
    alignItems: "center",
    marginHorizontal: 18,
    marginBottom: 40,
  },
  darkButtonText: { color: "#FFFFFF", fontWeight: "900" },
});