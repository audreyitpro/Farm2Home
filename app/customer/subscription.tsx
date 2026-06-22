// app/customer/subscription.tsx

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

import { API_BASE_URL, APP_URL } from "../config/api";
import { supabase } from "../data/supabaseClient";

const COLORS = {
  bg: "#F4F5F7",
  card: "#FFFFFF",
  black: "#050505",
  red: "#D71920",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  green: "#16A34A",
  greenDark: "#14532D",
  greenSoft: "#DCFCE7",
  amberSoft: "#FEF3C7",
  white: "#FFFFFF",
};

type CustomerRecord = {
  id?: string;
  customer_id?: string;
  customerId?: string;
  account_id?: string;
  accountId?: string;
  email?: string;
  name?: string;
  full_name?: string;
  fullName?: string;
  username?: string;
  stripe_customer_id?: string;
  stripeCustomerId?: string;
  stripe_subscription_id?: string;
  stripeSubscriptionId?: string;
  subscription_id?: string;
  subscriptionId?: string;
  subscription_status?: string;
  subscriptionStatus?: string;
  membership_status?: string;
  membershipStatus?: string;
  account_active?: boolean;
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

function getCustomerId(customer: CustomerRecord | null) {
  return clean(customer?.id || customer?.customer_id || customer?.customerId);
}

function getCustomerName(customer: CustomerRecord | null) {
  return clean(customer?.full_name || customer?.fullName || customer?.name || "");
}

function getStripeCustomer(customer: CustomerRecord | null) {
  return clean(customer?.stripe_customer_id || customer?.stripeCustomerId);
}

function getStripeSubscription(customer: CustomerRecord | null) {
  return clean(
    customer?.stripe_subscription_id ||
      customer?.stripeSubscriptionId ||
      customer?.subscription_id ||
      customer?.subscriptionId
  );
}

function statusIsActive(value: any) {
  return ["active", "trialing", "past_due"].includes(normalize(value));
}

async function parseApiResponse(response: Response) {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {
      success: false,
      error: text || "Invalid backend response.",
    };
  }
}

async function openStripeUrl(url: string) {
  if (!url || !url.startsWith("http")) {
    Alert.alert("Stripe Error", "No valid Stripe checkout URL was returned.");
    return;
  }

  if (Platform.OS === "web") {
    window.location.href = url;
    return;
  }

  await WebBrowser.openBrowserAsync(url);
}

export default function CustomerSubscriptionScreen() {
  const [customer, setCustomer] = useState<CustomerRecord | null>(null);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadCustomer();
    }, [])
  );

  async function loadCustomer() {
    try {
      const stored =
        (await AsyncStorage.getItem("currentCustomer")) ||
        (await AsyncStorage.getItem("farm2homeCurrentCustomer")) ||
        (await AsyncStorage.getItem("pendingCustomer")) ||
        (await AsyncStorage.getItem("currentUser"));

      let localCustomer: CustomerRecord | null = null;

      if (stored) {
        localCustomer = JSON.parse(stored);
        setCustomer(localCustomer);
        setEmail(clean(localCustomer?.email));
        setFullName(getCustomerName(localCustomer));
        setUsername(clean(localCustomer?.username));
      }

      const { data: authData } = await supabase.auth.getUser();
      const authId = clean(authData?.user?.id);
      const authEmail = normalize(authData?.user?.email || localCustomer?.email);

      if (!authId && !authEmail) return;

      let dbCustomer: any = null;

      if (authId) {
        const { data } = await supabase
          .from("customers")
          .select("*")
          .or(`id.eq.${authId},auth_user_id.eq.${authId},profile_id.eq.${authId}`)
          .limit(1);

        if (Array.isArray(data) && data[0]) dbCustomer = data[0];
      }

      if (!dbCustomer && authEmail) {
        const { data } = await supabase
          .from("customers")
          .select("*")
          .eq("email", authEmail)
          .limit(1);

        if (Array.isArray(data) && data[0]) dbCustomer = data[0];
      }

      if (dbCustomer) {
        const sub = await fetchCustomerSubscription(dbCustomer.id, dbCustomer.email);

        const merged = {
          ...dbCustomer,
          customerId: dbCustomer.id,
          accountId: dbCustomer.account_id,
          stripe_customer_id:
            dbCustomer.stripe_customer_id ||
            dbCustomer.stripe_id ||
            sub?.stripe_customer_id,
          stripe_subscription_id:
            dbCustomer.stripe_subscription_id ||
            dbCustomer.subscription_id ||
            sub?.stripe_subscription_id,
          subscription_id:
            dbCustomer.subscription_id ||
            dbCustomer.stripe_subscription_id ||
            sub?.stripe_subscription_id,
          subscription_status:
            dbCustomer.subscription_status || sub?.subscription_status,
          membership_status:
            dbCustomer.membership_status || sub?.subscription_status,
        };

        setCustomer(merged);
        setEmail(clean(merged.email));
        setFullName(getCustomerName(merged));
        setUsername(clean(merged.username));

        await AsyncStorage.multiSet([
          ["currentCustomer", JSON.stringify(merged)],
          ["farm2homeCurrentCustomer", JSON.stringify(merged)],
          ["currentUser", JSON.stringify({ ...merged, role: "customer" })],
          ["currentUserRole", "customer"],
        ]);
      }
    } catch (error) {
      console.log("LOAD_CUSTOMER_SUBSCRIPTION_ERROR:", error);
    }
  }

  async function fetchCustomerSubscription(customerId?: string, customerEmail?: string) {
    const filters = [
      customerId ? `customer_id.eq.${customerId}` : "",
      customerEmail ? `customer_email.eq.${normalize(customerEmail)}` : "",
    ]
      .filter(Boolean)
      .join(",");

    if (!filters) return null;

    try {
      const { data } = await supabase
        .from("customer_subscriptions")
        .select("*")
        .or(filters)
        .order("updated_at", { ascending: false })
        .limit(1);

      return Array.isArray(data) ? data[0] : null;
    } catch {
      return null;
    }
  }

  async function savePendingCustomer() {
    const cleanEmail = normalize(email);
    const cleanName = clean(fullName);
    const cleanUsername = clean(username);

    if (!cleanName) {
      Alert.alert("Missing Name", "Please enter your full name.");
      return null;
    }

    if (!cleanEmail || !cleanEmail.includes("@")) {
      Alert.alert("Missing Email", "Please enter a valid customer email.");
      return null;
    }

    const existingId = getCustomerId(customer);
    const customerId = existingId || `customer_${Date.now()}`;

    const pendingCustomer = {
      ...(customer || {}),
      id: customerId,
      customer_id: customerId,
      customerId,
      email: cleanEmail,
      full_name: cleanName,
      fullName: cleanName,
      name: cleanName,
      username: cleanUsername,
      role: "customer",
      membership_status: "pending_payment",
      membershipStatus: "pending_payment",
      subscription_status: "pending_payment",
      subscriptionStatus: "pending_payment",
      membershipType: "customer_membership",
      planType: "customer",
      marketplaceAccess: false,
      updated_at: new Date().toISOString(),
      created_at: customer?.id ? customer?.["created_at" as keyof CustomerRecord] : new Date().toISOString(),
    };

    await AsyncStorage.multiSet([
      ["currentUser", JSON.stringify(pendingCustomer)],
      ["currentCustomer", JSON.stringify(pendingCustomer)],
      ["farm2homeCurrentCustomer", JSON.stringify(pendingCustomer)],
      ["currentUserRole", "customer"],
      ["pendingCustomerSubscription", JSON.stringify(pendingCustomer)],
    ]);

    setCustomer(pendingCustomer);

    try {
      await supabase.from("customers").upsert(
        {
          id: customerId,
          customer_id: customerId,
          email: cleanEmail,
          full_name: cleanName,
          name: cleanName,
          username: cleanUsername,
          role: "customer",
          membership_status: "pending_payment",
          subscription_status: "pending_payment",
          account_active: false,
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: "id" }
      );
    } catch {
      // Supabase schema may not match exactly; backend/webhook will still sync.
    }

    return pendingCustomer;
  }

  async function startSubscription() {
    if (loading) return;

    try {
      setLoading(true);

      const pendingCustomer = await savePendingCustomer();
      if (!pendingCustomer) return;

      const successUrl = `${APP_URL}/customer/subscription-success?session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${APP_URL}/customer/subscription`;

      const response = await fetch(`${API_BASE_URL}/payments/create-customer-subscription-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "customer",
          planType: "customer",
          customerId: getCustomerId(pendingCustomer),
          customer_id: getCustomerId(pendingCustomer),
          userId: getCustomerId(pendingCustomer),
          profileId: getCustomerId(pendingCustomer),
          email: pendingCustomer.email,
          customerEmail: pendingCustomer.email,
          name: getCustomerName(pendingCustomer),
          fullName: getCustomerName(pendingCustomer),
          username: pendingCustomer.username || "",
          accountId: pendingCustomer.account_id || pendingCustomer.accountId || "",
          account_id: pendingCustomer.account_id || pendingCustomer.accountId || "",
          successUrl,
          success_url: successUrl,
          cancelUrl,
          cancel_url: cancelUrl,
        }),
      });

      const data = await parseApiResponse(response);

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Unable to create customer membership checkout.");
      }

      if (data.alreadySubscribed) {
        const activatedCustomer = {
          ...pendingCustomer,
          stripe_customer_id: data.stripeCustomerId,
          stripe_subscription_id: data.stripeSubscriptionId,
          subscription_id: data.stripeSubscriptionId,
          subscription_status: data.subscriptionStatus || "active",
          membership_status: "active",
          hasActiveSubscription: true,
          marketplaceAccess: true,
          account_active: true,
          activatedAt: new Date().toISOString(),
        };

        await AsyncStorage.multiSet([
          ["currentUser", JSON.stringify(activatedCustomer)],
          ["currentCustomer", JSON.stringify(activatedCustomer)],
          ["farm2homeCurrentCustomer", JSON.stringify(activatedCustomer)],
          ["customerSubscriptionStatus", "active"],
        ]);

        await AsyncStorage.removeItem("pendingCustomerSubscription");

        router.replace("/customer/dashboard" as any);
        return;
      }

      await openStripeUrl(data.url);
    } catch (error: any) {
      console.log("CUSTOMER_SUBSCRIPTION_ERROR:", error);

      Alert.alert(
        "Subscription Error",
        error?.message || "Unable to start customer membership."
      );
    } finally {
      setLoading(false);
    }
  }

  async function restoreSubscription() {
    if (syncing) return;

    const cleanEmail = normalize(email || customer?.email);

    if (!cleanEmail || !cleanEmail.includes("@")) {
      Alert.alert("Missing Email", "Enter the email used for Stripe membership.");
      return;
    }

    try {
      setSyncing(true);

      const response = await fetch(`${API_BASE_URL}/payments/sync-stripe-by-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "customer",
          customerId: getCustomerId(customer),
          customer_id: getCustomerId(customer),
          userId: getCustomerId(customer),
          email: cleanEmail,
          name: fullName,
          username,
        }),
      });

      const data = await parseApiResponse(response);

      if (!response.ok || !data.success) {
        throw new Error(data.error || "No active customer membership found.");
      }

      const restoredCustomer = {
        ...(customer || {}),
        id: getCustomerId(customer) || data.userId || `customer_${Date.now()}`,
        customer_id: getCustomerId(customer) || data.userId || `customer_${Date.now()}`,
        customerId: getCustomerId(customer) || data.userId || `customer_${Date.now()}`,
        email: cleanEmail,
        full_name: fullName,
        name: fullName,
        username,
        stripe_customer_id: data.stripeCustomerId,
        stripe_subscription_id: data.stripeSubscriptionId,
        subscription_id: data.stripeSubscriptionId,
        subscription_status: data.subscriptionStatus,
        membership_status: data.subscriptionActive ? "active" : data.subscriptionStatus,
        account_active: Boolean(data.subscriptionActive),
        hasActiveSubscription: Boolean(data.subscriptionActive),
        marketplaceAccess: Boolean(data.subscriptionActive),
        updated_at: new Date().toISOString(),
      };

      setCustomer(restoredCustomer);

      await AsyncStorage.multiSet([
        ["currentUser", JSON.stringify(restoredCustomer)],
        ["currentCustomer", JSON.stringify(restoredCustomer)],
        ["farm2homeCurrentCustomer", JSON.stringify(restoredCustomer)],
        ["customerSubscriptionStatus", data.subscriptionActive ? "active" : data.subscriptionStatus],
        ["currentUserRole", "customer"],
      ]);

      Alert.alert("Membership Synced", "Customer membership was restored.", [
        {
          text: "Go to Dashboard",
          onPress: () => router.replace("/customer/dashboard" as any),
        },
      ]);
    } catch (error: any) {
      Alert.alert("Restore Error", error?.message || "Unable to restore membership.");
    } finally {
      setSyncing(false);
    }
  }

  function membershipActive() {
    return (
      statusIsActive(customer?.membership_status || customer?.membershipStatus) ||
      statusIsActive(customer?.subscription_status || customer?.subscriptionStatus) ||
      (isCus(getStripeCustomer(customer)) && isSub(getStripeSubscription(customer)))
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />

      <KeyboardAvoidingView
        style={styles.page}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.hero}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.replace("/customer/register" as any)}
              activeOpacity={0.9}
            >
              <Ionicons name="arrow-back-outline" size={18} color={COLORS.white} />
              <Text style={styles.backButtonText}>Register</Text>
            </TouchableOpacity>

            <View style={styles.heroIcon}>
              <Ionicons name="shield-checkmark-outline" size={34} color={COLORS.white} />
            </View>

            <Text style={styles.kicker}>Farm2Home Customer</Text>
            <Text style={styles.title}>Membership</Text>
            <Text style={styles.subtitle}>
              Unlock Farm2Home marketplace access, local farm ordering, tracking, and secure checkout.
            </Text>
          </View>

          <View style={styles.statusCard}>
            <View style={styles.statusTop}>
              <Text style={styles.statusTitle}>Membership Status</Text>
              <View style={[styles.statusBadge, membershipActive() ? styles.activeBadge : styles.pendingBadge]}>
                <Text style={[styles.statusBadgeText, membershipActive() ? styles.activeText : styles.pendingText]}>
                  {membershipActive() ? "Active" : "Pending"}
                </Text>
              </View>
            </View>

            <InfoLine label="Stripe Customer" value={getStripeCustomer(customer) || "Not synced"} />
            <InfoLine label="Subscription" value={getStripeSubscription(customer) || "Not synced"} />
            <InfoLine label="Customer ID" value={getCustomerId(customer) || "Not created"} />
          </View>

          <View style={styles.priceCard}>
            <Text style={styles.price}>$4.99 / month</Text>
            <Text style={styles.note}>
              Customer membership unlocks shopping, order tracking, delivery updates, farmer chat, driver chat, and secure Stripe checkout.
            </Text>

            {[
              "Access to Farm2Home marketplace",
              "Fresh farm produce ordering",
              "Multi-farmer checkout",
              "Real-time order tracking",
              "Farmer and driver messaging",
              "Secure Stripe membership sync",
            ].map((item) => (
              <View key={item} style={styles.featureRow}>
                <Ionicons name="checkmark-circle-outline" size={18} color={COLORS.green} />
                <Text style={styles.featureItem}>{item}</Text>
              </View>
            ))}
          </View>

          <TextInput
            style={styles.input}
            placeholder="Full Name"
            placeholderTextColor="#94A3B8"
            value={fullName}
            onChangeText={setFullName}
          />

          <TextInput
            style={styles.input}
            placeholder="Username"
            placeholderTextColor="#94A3B8"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />

          <TextInput
            style={styles.input}
            placeholder="Customer Email"
            placeholderTextColor="#94A3B8"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.disabledButton]}
            onPress={startSubscription}
            disabled={loading}
            activeOpacity={0.9}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="card-outline" size={20} color={COLORS.white} />
                <Text style={styles.buttonText}>
                  {membershipActive() ? "Open / Verify Membership" : "Pay Membership with Stripe"}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.restoreButton, syncing && styles.disabledButton]}
            onPress={restoreSubscription}
            disabled={syncing}
            activeOpacity={0.9}
          >
            {syncing ? (
              <ActivityIndicator color={COLORS.red} />
            ) : (
              <>
                <Ionicons name="refresh-outline" size={20} color={COLORS.red} />
                <Text style={styles.restoreButtonText}>Restore / Sync Stripe Membership</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dashboardButton}
            onPress={() => router.replace("/customer/dashboard" as any)}
            activeOpacity={0.9}
          >
            <Text style={styles.dashboardText}>Go to Customer Dashboard</Text>
          </TouchableOpacity>

          <Text style={styles.productionNote}>
            Production Stripe Checkout enabled. Customer subscription data syncs through backend and webhook.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoLine}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  page: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  container: {
    paddingBottom: 60,
  },
  hero: {
    backgroundColor: COLORS.black,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
  },
  backButton: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.red,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    marginBottom: 18,
  },
  backButtonText: {
    color: COLORS.white,
    fontWeight: "900",
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 24,
    backgroundColor: COLORS.red,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  kicker: {
    color: "#FCA5A5",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  title: {
    color: COLORS.white,
    fontSize: 36,
    fontWeight: "900",
    marginTop: 6,
  },
  subtitle: {
    color: "#CBD5E1",
    fontWeight: "700",
    lineHeight: 22,
    marginTop: 8,
  },
  statusCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    margin: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statusTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    marginBottom: 10,
  },
  statusTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "900",
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  activeBadge: {
    backgroundColor: COLORS.greenSoft,
  },
  pendingBadge: {
    backgroundColor: COLORS.amberSoft,
  },
  statusBadgeText: {
    fontWeight: "900",
    fontSize: 12,
  },
  activeText: {
    color: COLORS.greenDark,
  },
  pendingText: {
    color: "#92400E",
  },
  infoLine: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingVertical: 10,
  },
  infoLabel: {
    color: COLORS.muted,
    fontWeight: "900",
    fontSize: 11,
    textTransform: "uppercase",
  },
  infoValue: {
    color: COLORS.text,
    fontWeight: "800",
    marginTop: 3,
  },
  priceCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    marginHorizontal: 18,
    marginBottom: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  price: {
    fontSize: 30,
    fontWeight: "900",
    color: COLORS.red,
    marginBottom: 10,
  },
  note: {
    color: COLORS.muted,
    lineHeight: 22,
    fontWeight: "700",
    marginBottom: 14,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 9,
  },
  featureItem: {
    color: COLORS.text,
    fontWeight: "800",
    flex: 1,
  },
  input: {
    backgroundColor: COLORS.card,
    padding: 16,
    borderRadius: 16,
    marginHorizontal: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.text,
    fontWeight: "800",
  },
  button: {
    backgroundColor: COLORS.red,
    padding: 18,
    borderRadius: 16,
    marginHorizontal: 18,
    marginTop: 4,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 58,
    flexDirection: "row",
    gap: 8,
  },
  disabledButton: {
    opacity: 0.65,
  },
  buttonText: {
    color: COLORS.white,
    fontWeight: "900",
    fontSize: 16,
  },
  restoreButton: {
    backgroundColor: "#FEE2E2",
    padding: 17,
    borderRadius: 16,
    marginHorizontal: 18,
    marginTop: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  restoreButtonText: {
    color: COLORS.red,
    fontWeight: "900",
    fontSize: 15,
  },
  dashboardButton: {
    alignItems: "center",
    marginTop: 22,
  },
  dashboardText: {
    color: COLORS.red,
    fontWeight: "900",
  },
  productionNote: {
    marginTop: 26,
    color: COLORS.muted,
    textAlign: "center",
    fontWeight: "700",
    lineHeight: 20,
    paddingHorizontal: 22,
  },
});