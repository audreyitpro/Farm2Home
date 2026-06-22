// app/customer/subscription-success.tsx

import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { API_BASE_URL } from "../config/api";
import { supabase } from "../data/supabaseClient";

/**
 * app/customer/subscription-success.tsx
 *
 * Full corrected customer subscription success screen.
 *
 * What this does:
 * - Reads Stripe checkout session_id from URL params.
 * - Verifies checkout session with backend.
 * - Saves stripe_customer_id and stripe_subscription_id.
 * - Updates customers table.
 * - Upserts customer_subscriptions table.
 * - Saves currentCustomer/currentUser AsyncStorage.
 * - Marks customer membership active.
 * - Routes to customer dashboard / marketplace.
 */

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
  amber: "#F59E0B",
  amberSoft: "#FEF3C7",
  danger: "#DC2626",
  dangerSoft: "#FEE2E2",
  white: "#FFFFFF",
};

type StoredCustomer = {
  id?: string;
  customer_id?: string;
  customerId?: string;
  profile_id?: string;
  profileId?: string;
  auth_user_id?: string;
  authUserId?: string;
  account_id?: string;
  accountId?: string;
  fullName?: string;
  full_name?: string;
  name?: string;
  email?: string;
  phone?: string;
  username?: string;
  role?: string;
  accountActive?: boolean;
  account_active?: boolean;
  membershipStatus?: string;
  membership_status?: string;
  subscriptionStatus?: string;
  subscription_status?: string;
  subscriptionActive?: boolean;
  hasActiveSubscription?: boolean;
  marketplaceAccess?: boolean;
  stripeCustomerId?: string;
  stripe_customer_id?: string;
  stripeSubscriptionId?: string;
  stripe_subscription_id?: string;
  subscriptionId?: string;
  subscription_id?: string;
  currentPeriodEnd?: string | null;
  current_period_end?: string | null;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  subscriptionActivatedAt?: string;
};

function clean(value: any) {
  return String(value ?? "").trim();
}

function normalize(value: any) {
  return clean(value).toLowerCase();
}

function nowIso() {
  return new Date().toISOString();
}

function safelyParseCustomer(rawValue: string | null): StoredCustomer | null {
  if (!rawValue) return null;

  try {
    return JSON.parse(rawValue);
  } catch {
    return null;
  }
}

function safelyParseArray(rawValue: string | null): StoredCustomer[] {
  if (!rawValue) return [];

  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isActiveStripeStatus(status?: string) {
  const cleanStatus = normalize(status);
  return ["active", "trialing", "paid", "complete", "completed"].includes(cleanStatus);
}

function getCustomerId(customer: StoredCustomer | null) {
  return clean(customer?.id || customer?.customer_id || customer?.customerId);
}

function getProfileId(customer: StoredCustomer | null) {
  return clean(customer?.profile_id || customer?.profileId);
}

function getCustomerName(customer: StoredCustomer | null) {
  return clean(customer?.full_name || customer?.fullName || customer?.name || "Farm2Home Customer");
}

function getCustomerEmail(customer: StoredCustomer | null) {
  return normalize(customer?.email);
}

function getStripeCustomer(customer: StoredCustomer | null) {
  return clean(customer?.stripe_customer_id || customer?.stripeCustomerId);
}

function getStripeSubscription(customer: StoredCustomer | null) {
  return clean(
    customer?.stripe_subscription_id ||
      customer?.stripeSubscriptionId ||
      customer?.subscription_id ||
      customer?.subscriptionId
  );
}

function extractMetadata(stripeData: any) {
  return stripeData?.metadata || stripeData?.session?.metadata || {};
}

function extractCustomerId(stripeData: any) {
  const metadata = extractMetadata(stripeData);

  return clean(
    stripeData?.customerId ||
      stripeData?.stripeCustomerId ||
      stripeData?.customer ||
      stripeData?.session?.customer ||
      stripeData?.session?.customer?.id ||
      metadata?.stripeCustomerId ||
      metadata?.stripe_customer_id
  );
}

function extractSubscriptionId(stripeData: any) {
  const metadata = extractMetadata(stripeData);

  return clean(
    stripeData?.subscriptionId ||
      stripeData?.stripeSubscriptionId ||
      stripeData?.subscription ||
      stripeData?.session?.subscription ||
      stripeData?.session?.subscription?.id ||
      metadata?.stripeSubscriptionId ||
      metadata?.stripe_subscription_id ||
      metadata?.subscriptionId ||
      metadata?.subscription_id
  );
}

function extractCustomerEmail(stripeData: any) {
  const metadata = extractMetadata(stripeData);

  return normalize(
    stripeData?.customerEmail ||
      stripeData?.email ||
      stripeData?.session?.customer_details?.email ||
      stripeData?.session?.customer_email ||
      metadata?.email ||
      metadata?.customerEmail ||
      metadata?.customer_email
  );
}

function extractName(stripeData: any) {
  const metadata = extractMetadata(stripeData);

  return clean(
    stripeData?.name ||
      stripeData?.customerName ||
      stripeData?.session?.customer_details?.name ||
      metadata?.name ||
      metadata?.fullName ||
      metadata?.full_name
  );
}

function extractSubscriptionStatus(stripeData: any) {
  return clean(
    stripeData?.subscriptionStatus ||
      stripeData?.subscription_status ||
      stripeData?.status ||
      stripeData?.subscription?.status ||
      "active"
  );
}

function extractCurrentPeriodEnd(stripeData: any) {
  const value =
    stripeData?.currentPeriodEnd ||
    stripeData?.current_period_end ||
    stripeData?.subscription?.current_period_end ||
    null;

  if (!value) return null;

  if (typeof value === "number") {
    return new Date(value * 1000).toISOString();
  }

  return clean(value);
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

export default function CustomerSubscriptionSuccess() {
  const params = useLocalSearchParams();

  const sessionId = clean(params.session_id || params.sessionId);
  const [loading, setLoading] = useState(true);
  const [activated, setActivated] = useState(false);
  const [activeCustomer, setActiveCustomer] = useState<StoredCustomer | null>(null);
  const [message, setMessage] = useState("Activating your Farm2Home membership...");

  useEffect(() => {
    activateMembership();
  }, []);

  async function verifyStripeSession() {
    if (!sessionId) return null;

    const response = await fetch(`${API_BASE_URL}/payments/verify-checkout-session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionId,
        session_id: sessionId,
        role: "customer",
      }),
    });

    const data = await parseApiResponse(response);

    if (!response.ok || !data.success) {
      throw new Error(data.error || "Unable to verify Stripe subscription.");
    }

    return data;
  }

  async function findCustomerByAuthOrEmail(emailHint: string) {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const authId = clean(authData?.user?.id);
      const authEmail = normalize(authData?.user?.email || emailHint);

      if (authId) {
        const { data } = await supabase
          .from("customers")
          .select("*")
          .or(`id.eq.${authId},customer_id.eq.${authId},auth_user_id.eq.${authId},profile_id.eq.${authId}`)
          .limit(1);

        if (Array.isArray(data) && data[0]) return data[0];
      }

      if (authEmail) {
        const { data } = await supabase
          .from("customers")
          .select("*")
          .eq("email", authEmail)
          .limit(1);

        if (Array.isArray(data) && data[0]) return data[0];
      }
    } catch {
      // Continue with local data.
    }

    return null;
  }

  async function loadStoredCustomer(stripeData: any | null) {
    const pendingRaw =
      (await AsyncStorage.getItem("pendingCustomerSubscription")) ||
      (await AsyncStorage.getItem("pendingCustomer"));

    const currentRaw =
      (await AsyncStorage.getItem("currentCustomer")) ||
      (await AsyncStorage.getItem("farm2homeCurrentCustomer"));

    const currentUserRaw = await AsyncStorage.getItem("currentUser");

    const pendingCustomer = safelyParseCustomer(pendingRaw);
    const currentCustomer = safelyParseCustomer(currentRaw);
    const currentUser = safelyParseCustomer(currentUserRaw);

    const stripeEmail = extractCustomerEmail(stripeData);
    const dbCustomer = await findCustomerByAuthOrEmail(
      stripeEmail || getCustomerEmail(pendingCustomer) || getCustomerEmail(currentCustomer)
    );

    return {
      ...(currentUser || {}),
      ...(currentCustomer || {}),
      ...(pendingCustomer || {}),
      ...(dbCustomer || {}),
    };
  }

  async function upsertCustomersTable(customer: StoredCustomer) {
    const customerId = getCustomerId(customer);

    if (!customerId) return;

    const payload: any = {
      id: customerId,
      customer_id: customerId,
      profile_id: getProfileId(customer) || null,
      auth_user_id: clean(customer.auth_user_id || customer.authUserId) || null,
      account_id: clean(customer.account_id || customer.accountId) || null,
      full_name: getCustomerName(customer),
      name: getCustomerName(customer),
      username: clean(customer.username),
      email: getCustomerEmail(customer),
      phone: clean(customer.phone),
      role: "customer",
      stripe_customer_id: getStripeCustomer(customer) || null,
      stripe_subscription_id: getStripeSubscription(customer) || null,
      subscription_id: getStripeSubscription(customer) || null,
      subscription_status: clean(customer.subscription_status || customer.subscriptionStatus || "active"),
      membership_status: "active",
      account_active: true,
      updated_at: nowIso(),
    };

    try {
      await supabase.from("customers").upsert(payload, { onConflict: "id" });
    } catch (error: any) {
      console.log("customers subscription-success upsert skipped:", error?.message || error);
    }
  }

  async function upsertCustomerSubscription(customer: StoredCustomer) {
    const customerId = getCustomerId(customer);
    const email = getCustomerEmail(customer);
    const stripeCustomerId = getStripeCustomer(customer);
    const stripeSubscriptionId = getStripeSubscription(customer);

    if (!customerId && !email) return;

    const payload: any = {
      customer_id: customerId,
      customer_email: email,
      name: getCustomerName(customer),
      username: clean(customer.username),
      stripe_customer_id: stripeCustomerId || null,
      stripe_subscription_id: stripeSubscriptionId || null,
      subscription_status: clean(customer.subscription_status || customer.subscriptionStatus || "active"),
      current_period_end: clean(customer.current_period_end || customer.currentPeriodEnd) || null,
      updated_at: nowIso(),
    };

    try {
      const { data } = await supabase
        .from("customer_subscriptions")
        .select("*")
        .or(
          [
            customerId ? `customer_id.eq.${customerId}` : "",
            email ? `customer_email.eq.${email}` : "",
            stripeCustomerId ? `stripe_customer_id.eq.${stripeCustomerId}` : "",
            stripeSubscriptionId ? `stripe_subscription_id.eq.${stripeSubscriptionId}` : "",
          ]
            .filter(Boolean)
            .join(",")
        )
        .limit(1);

      if (Array.isArray(data) && data[0]?.id) {
        await supabase.from("customer_subscriptions").update(payload).eq("id", data[0].id);
      } else {
        await supabase.from("customer_subscriptions").insert({
          ...payload,
          created_at: nowIso(),
        });
      }
    } catch (error: any) {
      console.log("customer_subscriptions upsert skipped:", error?.message || error);
    }
  }

  async function saveActiveCustomer(customer: StoredCustomer, stripeData: any | null) {
    const metadata = extractMetadata(stripeData);

    const stripeStatus = extractSubscriptionStatus(stripeData);
    const customerId =
      getCustomerId(customer) ||
      clean(metadata?.customerId || metadata?.customer_id || metadata?.userId || metadata?.user_id) ||
      extractCustomerEmail(stripeData) ||
      `customer_${Date.now()}`;

    const stripeCustomerId = extractCustomerId(stripeData) || getStripeCustomer(customer);
    const stripeSubscriptionId = extractSubscriptionId(stripeData) || getStripeSubscription(customer);
    const customerEmail =
      getCustomerEmail(customer) ||
      extractCustomerEmail(stripeData) ||
      normalize(metadata?.email);

    const active: StoredCustomer = {
      ...customer,
      id: customerId,
      customer_id: customerId,
      customerId,
      email: customerEmail,
      full_name: getCustomerName(customer) || extractName(stripeData),
      fullName: getCustomerName(customer) || extractName(stripeData),
      name: getCustomerName(customer) || extractName(stripeData),
      username: clean(customer.username || metadata?.username),
      role: "customer",
      accountActive: true,
      account_active: true,
      membershipStatus: "active",
      membership_status: "active",
      subscriptionStatus: stripeStatus || "active",
      subscription_status: stripeStatus || "active",
      subscriptionActive: true,
      hasActiveSubscription: true,
      marketplaceAccess: true,
      stripeCustomerId: stripeCustomerId,
      stripe_customer_id: stripeCustomerId,
      stripeSubscriptionId: stripeSubscriptionId,
      stripe_subscription_id: stripeSubscriptionId,
      subscriptionId: stripeSubscriptionId,
      subscription_id: stripeSubscriptionId,
      currentPeriodEnd: extractCurrentPeriodEnd(stripeData),
      current_period_end: extractCurrentPeriodEnd(stripeData),
      subscriptionActivatedAt: nowIso(),
      updatedAt: nowIso(),
      updated_at: nowIso(),
      createdAt: customer.createdAt || customer.created_at || nowIso(),
      created_at: customer.created_at || customer.createdAt || nowIso(),
    };

    const customersRaw = await AsyncStorage.getItem("farm2homeCustomers");
    const customers = safelyParseArray(customersRaw);

    const updatedCustomers = [
      ...customers.filter((item) => {
        const sameId = getCustomerId(item) && getCustomerId(active) && getCustomerId(item) === getCustomerId(active);
        const sameEmail =
          getCustomerEmail(item) &&
          getCustomerEmail(active) &&
          getCustomerEmail(item) === getCustomerEmail(active);
        const sameUsername =
          clean(item.username) &&
          clean(active.username) &&
          normalize(item.username) === normalize(active.username);

        return !sameId && !sameEmail && !sameUsername;
      }),
      active,
    ];

    await AsyncStorage.multiSet([
      ["farm2homeCustomers", JSON.stringify(updatedCustomers)],
      ["currentCustomer", JSON.stringify(active)],
      ["farm2homeCurrentCustomer", JSON.stringify(active)],
      ["currentUser", JSON.stringify({ ...active, role: "customer" })],
      ["userRole", "customer"],
      ["currentUserRole", "customer"],
      ["customerSubscriptionStatus", "active"],
    ]);

    await AsyncStorage.multiRemove([
      "pendingCustomer",
      "pendingCustomerSubscription",
      "pendingCustomerCheckout",
    ]);

    await upsertCustomersTable(active);
    await upsertCustomerSubscription(active);

    return active;
  }

  async function activateMembership() {
    try {
      setLoading(true);
      setMessage("Verifying Stripe payment...");

      const stripeData = await verifyStripeSession();

      const stripeIsActive =
        !sessionId ||
        stripeData?.mode === "payment"
          ? stripeData?.paymentStatus === "paid" ||
            stripeData?.payment_status === "paid" ||
            stripeData?.paid === true
          : isActiveStripeStatus(extractSubscriptionStatus(stripeData));

      const checkoutStatus = normalize(
        stripeData?.checkoutStatus ||
          stripeData?.checkout_status ||
          stripeData?.session?.status ||
          ""
      );

      const subscriptionStatus = extractSubscriptionStatus(stripeData);

      const paidOrComplete =
        stripeIsActive ||
        checkoutStatus === "complete" ||
        checkoutStatus === "paid" ||
        isActiveStripeStatus(subscriptionStatus);

      if (sessionId && !paidOrComplete) {
        setActivated(false);
        setMessage("Stripe payment was found, but the membership is not active yet.");
        return;
      }

      setMessage("Saving customer membership...");

      const storedCustomer = await loadStoredCustomer(stripeData);
      const customerEmail =
        getCustomerEmail(storedCustomer) ||
        extractCustomerEmail(stripeData);

      if (!customerEmail && !getCustomerId(storedCustomer)) {
        setActivated(false);
        setMessage("Payment completed, but Farm2Home could not match the customer account.");
        return;
      }

      const saved = await saveActiveCustomer(storedCustomer, stripeData);

      setActiveCustomer(saved);
      setActivated(true);
      setMessage("Your customer membership is active. You now have full Farm2Home marketplace access.");
    } catch (error: any) {
      console.log("Subscription activation error:", error);

      Alert.alert(
        "Activation Error",
        error?.message || "Unable to activate customer membership."
      );

      setActivated(false);
      setMessage(
        error?.message ||
          "Payment may have completed, but Farm2Home could not verify the subscription."
      );
    } finally {
      setLoading(false);
    }
  }

  function goToDashboard() {
    router.replace("/customer/dashboard" as any);
  }

  function goToMarketplace() {
    router.replace("/customer/marketplace" as any);
  }

  function goToProfile() {
    router.replace("/customer/profile" as any);
  }

  function goToLogin() {
    router.replace("/customer/login" as any);
  }

  function retryActivation() {
    activateMembership();
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />

        <View style={styles.center}>
          <View style={styles.loadingIcon}>
            <ActivityIndicator size="large" color={COLORS.white} />
          </View>

          <Text style={styles.loadingTitle}>Activating Membership</Text>
          <Text style={styles.loadingText}>{message}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={[styles.heroIcon, activated ? styles.successIcon : styles.warningIcon]}>
            <Ionicons
              name={activated ? "checkmark-circle-outline" : "warning-outline"}
              size={42}
              color={COLORS.white}
            />
          </View>

          <Text style={styles.kicker}>Farm2Home Customer</Text>
          <Text style={styles.title}>
            {activated ? "Membership Active" : "Verification Needed"}
          </Text>
          <Text style={styles.subtitle}>{message}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Membership Details</Text>

          <Detail label="Customer" value={getCustomerName(activeCustomer) || "Customer"} />
          <Detail label="Email" value={getCustomerEmail(activeCustomer) || "Not listed"} />
          <Detail label="Customer ID" value={getCustomerId(activeCustomer) || "Not listed"} />
          <Detail label="Stripe Customer" value={getStripeCustomer(activeCustomer) || "Not synced"} />
          <Detail label="Subscription" value={getStripeSubscription(activeCustomer) || "Not synced"} />
          <Detail label="Status" value={activated ? "active" : "needs verification"} />
        </View>

        {activated ? (
          <>
            <TouchableOpacity style={styles.primaryButton} onPress={goToDashboard} activeOpacity={0.9}>
              <Ionicons name="home-outline" size={20} color={COLORS.white} />
              <Text style={styles.primaryButtonText}>Go to Customer Dashboard</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={goToMarketplace} activeOpacity={0.9}>
              <Ionicons name="storefront-outline" size={20} color={COLORS.red} />
              <Text style={styles.secondaryButtonText}>Start Shopping</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={goToProfile} activeOpacity={0.9}>
              <Ionicons name="person-outline" size={20} color={COLORS.red} />
              <Text style={styles.secondaryButtonText}>View Profile</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity style={styles.primaryButton} onPress={retryActivation} activeOpacity={0.9}>
              <Ionicons name="refresh-outline" size={20} color={COLORS.white} />
              <Text style={styles.primaryButtonText}>Retry Activation</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={goToLogin} activeOpacity={0.9}>
              <Ionicons name="log-in-outline" size={20} color={COLORS.red} />
              <Text style={styles.secondaryButtonText}>Go to Login</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingIcon: {
    width: 76,
    height: 76,
    borderRadius: 28,
    backgroundColor: COLORS.red,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  loadingTitle: {
    color: COLORS.text,
    fontSize: 27,
    fontWeight: "900",
    textAlign: "center",
  },
  loadingText: {
    color: COLORS.muted,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 22,
    marginTop: 8,
  },
  content: {
    paddingBottom: 70,
  },
  hero: {
    backgroundColor: COLORS.black,
    paddingHorizontal: 22,
    paddingTop: 36,
    paddingBottom: 34,
  },
  heroIcon: {
    width: 78,
    height: 78,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  successIcon: {
    backgroundColor: COLORS.green,
  },
  warningIcon: {
    backgroundColor: COLORS.amber,
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
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 18,
    marginHorizontal: 18,
    marginTop: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 8,
  },
  detailRow: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingVertical: 12,
  },
  detailLabel: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  detailValue: {
    color: COLORS.text,
    fontWeight: "800",
    marginTop: 4,
  },
  primaryButton: {
    backgroundColor: COLORS.red,
    borderRadius: 18,
    padding: 17,
    marginHorizontal: 18,
    marginTop: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontWeight: "900",
    fontSize: 16,
  },
  secondaryButton: {
    backgroundColor: "#FEE2E2",
    borderRadius: 18,
    padding: 17,
    marginHorizontal: 18,
    marginTop: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  secondaryButtonText: {
    color: COLORS.red,
    fontWeight: "900",
    fontSize: 15,
  },
});
