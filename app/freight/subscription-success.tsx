// app/freight/subscription-success.tsx
// Verifies Stripe Checkout, force-syncs the freight subscription, activates Supabase records,
// and saves the active freight session locally.

import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
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
import freightTheme from "../styles/freightTheme";

type StatusType = "loading" | "success" | "failed";

const COLORS = {
  bg: freightTheme?.colors?.background || "#020617",
  card: freightTheme?.colors?.card || "#0F172A",
  primary: freightTheme?.colors?.primary || "#D71920",
  muted: freightTheme?.colors?.mutedText || "#94A3B8",
  white: "#FFFFFF",
  text: "#E5E7EB",
  green: "#10B981",
  greenDark: "#064E3B",
  red: "#EF4444",
  redDark: "#7F1D1D",
  border: "#334155",
};

function asString(value: any) {
  if (Array.isArray(value)) return String(value[0] || "").trim();
  return String(value || "").trim();
}

function normalize(value: any) {
  return String(value || "").trim().toLowerCase();
}

function isActiveStatus(value: any) {
  const status = normalize(value);
  return ["active", "trialing", "past_due", "paid", "complete", "completed"].includes(status);
}

function firstValue(...values: any[]) {
  for (const value of values) {
    const clean = String(value ?? "").trim();
    if (clean.length > 0) return clean;
  }
  return "";
}

function boolValue(...values: any[]) {
  for (const value of values) {
    if (value === true) return true;
    if (value === false) continue;
    if (String(value).toLowerCase() === "true") return true;
  }
  return false;
}

async function saveFreightSession(carrier: any) {
  await AsyncStorage.setItem("currentFreightCarrier", JSON.stringify(carrier));
  await AsyncStorage.setItem("currentFreight", JSON.stringify(carrier));
  await AsyncStorage.setItem("currentFreightUser", JSON.stringify(carrier));
  await AsyncStorage.setItem("currentUser", JSON.stringify(carrier));
  await AsyncStorage.setItem("userRole", "freight");
  await AsyncStorage.setItem("currentUserRole", "freight");
}

async function getStoredFreightUser() {
  const raw =
    (await AsyncStorage.getItem("pendingFreightSubscription")) ||
    (await AsyncStorage.getItem("pendingFreightCarrier")) ||
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

export default function FreightSubscriptionSuccess() {
  const params = useLocalSearchParams();

  const sessionId = useMemo(() => asString(params.session_id || params.sessionId), [params]);
  const paramFreightId = useMemo(
    () => asString(params.freightId || params.freight_id || params.userId || params.user_id),
    [params]
  );
  const paramEmail = useMemo(() => normalize(params.email || params.freight_email), [params]);

  const [status, setStatus] = useState<StatusType>("loading");
  const [message, setMessage] = useState("Verifying Freight Connect membership...");

  useEffect(() => {
    verifyAndActivate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadFreightFromSupabase(args: {
    freightId?: string;
    email?: string;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
  }) {
    const freightId = firstValue(args.freightId);
    const email = normalize(args.email);
    const stripeCustomerId = firstValue(args.stripeCustomerId);
    const stripeSubscriptionId = firstValue(args.stripeSubscriptionId);

    const filters = [
      freightId ? `id.eq.${freightId}` : "",
      freightId ? `freight_id.eq.${freightId}` : "",
      freightId ? `auth_user_id.eq.${freightId}` : "",
      email ? `email.eq.${email}` : "",
      stripeCustomerId ? `stripe_customer_id.eq.${stripeCustomerId}` : "",
      stripeCustomerId ? `stripe_id.eq.${stripeCustomerId}` : "",
      stripeSubscriptionId ? `stripe_subscription_id.eq.${stripeSubscriptionId}` : "",
      stripeSubscriptionId ? `subscription_id.eq.${stripeSubscriptionId}` : "",
    ]
      .filter(Boolean)
      .join(",");

    if (!filters) return null;

    const { data, error } = await supabase
      .from("freight_users")
      .select("*")
      .or(filters)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (error) {
      console.log("Freight success Supabase load error:", error.message);
      return null;
    }

    return Array.isArray(data) && data.length > 0 ? data[0] : null;
  }

  async function verifyCheckoutSession() {
    if (!sessionId) return null;

    const response = await fetch(`${API_BASE_URL}/payments/verify-checkout-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, session_id: sessionId, role: "freight" }),
    });

    const text = await response.text();
    let json: any = {};

    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { success: false, error: text };
    }

    if (!response.ok || !json.success) {
      throw new Error(json.error || "Stripe checkout verification failed.");
    }

    const paid =
      json.paid === true ||
      json.payment_status === "paid" ||
      json.status === "complete" ||
      json.checkoutStatus === "complete";

    if (!paid) {
      throw new Error("Stripe checkout was not verified as paid yet.");
    }

    return json;
  }

  async function forceSyncFreight(stored: any, checkout: any = null) {
    const freightId = firstValue(
      paramFreightId,
      stored?.id,
      stored?.freightId,
      stored?.freight_id,
      checkout?.freightId,
      checkout?.freight_id,
      checkout?.userId,
      checkout?.metadata?.freight_id,
      checkout?.metadata?.userId
    );

    const email = normalize(
      firstValue(
        paramEmail,
        stored?.email,
        checkout?.email,
        checkout?.customerEmail,
        checkout?.customer_email,
        checkout?.metadata?.email,
        checkout?.metadata?.freight_email
      )
    );

    const companyName = firstValue(
      stored?.companyName,
      stored?.businessName,
      stored?.company_name,
      stored?.business_name,
      checkout?.companyName,
      checkout?.businessName,
      checkout?.metadata?.company_name,
      checkout?.metadata?.business_name
    );

    const username = normalize(
      firstValue(
        stored?.username,
        checkout?.username,
        checkout?.metadata?.username,
        email
      )
    );

    const stripeCustomerId = firstValue(
      checkout?.stripeCustomerId,
      checkout?.stripe_customer_id,
      checkout?.customer,
      checkout?.customerId,
      stored?.stripeCustomerId,
      stored?.stripe_customer_id,
      stored?.stripe_id
    );

    const stripeSubscriptionId = firstValue(
      checkout?.stripeSubscriptionId,
      checkout?.stripe_subscription_id,
      checkout?.subscription,
      checkout?.subscriptionId,
      stored?.stripeSubscriptionId,
      stored?.stripe_subscription_id,
      stored?.subscription_id
    );

    if (!freightId && !email && !stripeCustomerId && !stripeSubscriptionId) return null;

    const response = await fetch(`${API_BASE_URL}/payments/force-sync-freight-subscription`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: "freight",
        userId: freightId,
        freightId,
        freight_id: freightId,
        email,
        freight_email: email,
        businessName: companyName,
        business_name: companyName,
        companyName,
        name: companyName,
        username,
        stripeCustomerId,
        stripe_customer_id: stripeCustomerId,
        stripeSubscriptionId,
        stripe_subscription_id: stripeSubscriptionId,
        sessionId,
        session_id: sessionId,
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
      console.log("Force sync after success failed:", json.error || text);
      return null;
    }

    return json;
  }

  async function activateSupabaseRecords(dbFreight: any, synced: any = null, checkout: any = null) {
    const now = new Date().toISOString();

    const freightId = firstValue(dbFreight.id, dbFreight.freight_id, synced?.freightId, synced?.freight_id);
    const accountId = firstValue(dbFreight.account_id, synced?.accountId, synced?.account_id);

    const stripeCustomerId = firstValue(
      synced?.stripeCustomerId,
      synced?.stripe_customer_id,
      synced?.customer,
      checkout?.stripeCustomerId,
      checkout?.stripe_customer_id,
      checkout?.customer,
      dbFreight.stripe_customer_id,
      dbFreight.stripe_id
    );

    const stripeSubscriptionId = firstValue(
      synced?.stripeSubscriptionId,
      synced?.stripe_subscription_id,
      synced?.subscriptionId,
      synced?.subscription_id,
      synced?.subscription,
      checkout?.stripeSubscriptionId,
      checkout?.stripe_subscription_id,
      checkout?.subscription,
      dbFreight.stripe_subscription_id,
      dbFreight.subscription_id
    );

    const subscriptionStatus = firstValue(
      synced?.subscriptionStatus,
      synced?.subscription_status,
      checkout?.subscriptionStatus,
      checkout?.subscription_status,
      dbFreight.subscription_status,
      stripeSubscriptionId ? "active" : "pending"
    );

    const updatePayload: any = {
      account_active: true,
      approved: true,
      application_submitted: true,
      submitted_at: dbFreight.submitted_at || now,
      verification_status: "SUBMITTED",
      compliance_status: "SUBMITTED",
      admin_review_status: "submitted",
      membership_status: stripeSubscriptionId ? "active" : "pending",
      subscription_status: subscriptionStatus,
      freight_membership_paid: Boolean(stripeSubscriptionId),
      stripe_customer_id: stripeCustomerId || null,
      stripe_id: stripeCustomerId || null,
      stripe_subscription_id: stripeSubscriptionId || null,
      subscription_id: stripeSubscriptionId || null,
      updated_at: now,
    };

    if (accountId) updatePayload.account_id = accountId;

    const { error: freightError } = await supabase
      .from("freight_users")
      .update(updatePayload)
      .eq("id", freightId);

    if (freightError) throw freightError;

    await supabase
      .from("profiles")
      .update({
        ...updatePayload,
        role: "freight",
      })
      .or(`id.eq.${freightId},auth_user_id.eq.${freightId},profile_id.eq.${freightId}`);

    await supabase.from("admin_verifications").upsert(
      {
        id: freightId,
        freight_id: freightId,
        carrier_id: freightId,
        profile_id: freightId,
        account_id: accountId || dbFreight.account_id || "",
        account_type: "FREIGHT_CARRIER",
        role: "freight",
        type: "FREIGHT_CARRIER",

        company_name: firstValue(dbFreight.company_name, dbFreight.business_name, synced?.companyName),
        business_name: firstValue(dbFreight.business_name, dbFreight.company_name, synced?.businessName),
        contact_name: firstValue(dbFreight.contact_name, dbFreight.name, dbFreight.full_name),
        owner_name: firstValue(dbFreight.owner_name, dbFreight.contact_name, dbFreight.name),
        email: normalize(dbFreight.email),
        phone: firstValue(dbFreight.phone),
        username: normalize(dbFreight.username),

        status: "SUBMITTED",
        compliance_status: "SUBMITTED",
        admin_review_status: "submitted",
        review_decision: "submitted",
        approved: true,
        rejected: false,
        reviewed: false,
        needs_more_info: false,

        ...updatePayload,
      },
      { onConflict: "id" }
    );

    const refreshed = await loadFreightFromSupabase({
      freightId,
      email: dbFreight.email,
      stripeCustomerId,
      stripeSubscriptionId,
    });

    return refreshed || { ...dbFreight, ...updatePayload };
  }

  function buildActiveCarrier(stored: any, dbFreight: any) {
    const freightId = firstValue(dbFreight.id, dbFreight.freight_id, stored?.id, stored?.freightId);
    const accountId = firstValue(dbFreight.account_id, stored?.accountId, stored?.account_id);
    const stripeCustomerId = firstValue(dbFreight.stripe_customer_id, dbFreight.stripe_id, stored?.stripeCustomerId);
    const stripeSubscriptionId = firstValue(
      dbFreight.stripe_subscription_id,
      dbFreight.subscription_id,
      stored?.stripeSubscriptionId,
      stored?.subscriptionId
    );
    const stripeAccountId = firstValue(dbFreight.stripe_account_id, stored?.stripeAccountId, stored?.stripe_account_id);

    return {
      ...stored,
      ...dbFreight,

      id: freightId,
      freightId,
      freight_id: freightId,
      profile_id: firstValue(dbFreight.profile_id, freightId),
      auth_user_id: firstValue(dbFreight.auth_user_id, freightId),
      role: "freight",

      email: normalize(firstValue(dbFreight.email, stored?.email)),
      accountId,
      account_id: accountId,

      companyName: firstValue(dbFreight.company_name, dbFreight.business_name, stored?.companyName, stored?.businessName),
      company_name: firstValue(dbFreight.company_name, dbFreight.business_name, stored?.company_name),
      businessName: firstValue(dbFreight.business_name, dbFreight.company_name, stored?.businessName, stored?.companyName),
      business_name: firstValue(dbFreight.business_name, dbFreight.company_name, stored?.business_name),
      contactName: firstValue(dbFreight.contact_name, dbFreight.full_name, dbFreight.name, stored?.contactName),
      contact_name: firstValue(dbFreight.contact_name, dbFreight.full_name, dbFreight.name, stored?.contact_name),
      username: normalize(firstValue(dbFreight.username, stored?.username)),

      stripeId: stripeCustomerId,
      stripe_id: stripeCustomerId,
      stripeCustomerId,
      stripe_customer_id: stripeCustomerId,
      stripeSubscriptionId,
      stripe_subscription_id: stripeSubscriptionId,
      subscriptionId: stripeSubscriptionId,
      subscription_id: stripeSubscriptionId,
      stripeAccountId,
      stripe_account_id: stripeAccountId,

      membershipStatus: firstValue(dbFreight.membership_status, "active"),
      membership_status: firstValue(dbFreight.membership_status, "active"),
      subscriptionStatus: firstValue(dbFreight.subscription_status, "active"),
      subscription_status: firstValue(dbFreight.subscription_status, "active"),
      freightMembershipPaid: true,
      freight_membership_paid: true,

      payoutsEnabled: boolValue(dbFreight.payouts_enabled, dbFreight.stripe_payouts_enabled, stored?.payoutsEnabled),
      payouts_enabled: boolValue(dbFreight.payouts_enabled, dbFreight.stripe_payouts_enabled, stored?.payouts_enabled),
      chargesEnabled: boolValue(dbFreight.charges_enabled, dbFreight.stripe_charges_enabled, stored?.chargesEnabled),
      charges_enabled: boolValue(dbFreight.charges_enabled, dbFreight.stripe_charges_enabled, stored?.charges_enabled),
      onboardingComplete: boolValue(dbFreight.stripe_onboarding_complete, stored?.onboardingComplete),
      stripe_onboarding_complete: boolValue(dbFreight.stripe_onboarding_complete, stored?.stripe_onboarding_complete),

      accountActive: true,
      account_active: true,
      freightBoardAccess: true,
      hasActiveSubscription: true,
      activatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async function verifyAndActivate() {
    try {
      setStatus("loading");
      setMessage("Verifying Freight Connect membership...");

      const stored = (await getStoredFreightUser()) || {};
      const auth = await supabase.auth.getUser();
      const authEmail = normalize(auth?.data?.user?.email || "");

      const storedFreightId = firstValue(paramFreightId, stored.id, stored.freightId, stored.freight_id, auth?.data?.user?.id);
      const storedEmail = normalize(firstValue(paramEmail, stored.email, authEmail));

      let checkout: any = null;

      if (sessionId) {
        checkout = await verifyCheckoutSession();
      }

      setMessage("Syncing Stripe subscription to Supabase...");
      const synced = await forceSyncFreight(
        {
          ...stored,
          id: storedFreightId,
          freightId: storedFreightId,
          freight_id: storedFreightId,
          email: storedEmail,
        },
        checkout
      );

      const stripeCustomerId = firstValue(
        synced?.stripeCustomerId,
        synced?.stripe_customer_id,
        checkout?.stripeCustomerId,
        checkout?.stripe_customer_id,
        checkout?.customer,
        stored?.stripeCustomerId,
        stored?.stripe_customer_id
      );

      const stripeSubscriptionId = firstValue(
        synced?.stripeSubscriptionId,
        synced?.stripe_subscription_id,
        synced?.subscriptionId,
        synced?.subscription_id,
        checkout?.stripeSubscriptionId,
        checkout?.stripe_subscription_id,
        checkout?.subscription,
        stored?.stripeSubscriptionId,
        stored?.stripe_subscription_id
      );

      setMessage("Loading freight profile...");
      let dbFreight = await loadFreightFromSupabase({
        freightId: firstValue(synced?.freightId, synced?.freight_id, storedFreightId),
        email: firstValue(synced?.email, storedEmail),
        stripeCustomerId,
        stripeSubscriptionId,
      });

      if (!dbFreight?.id) {
        setStatus("failed");
        setMessage("Payment may be complete, but the freight profile was not found in Supabase.");
        return;
      }

      const dbStripeCustomerId = firstValue(dbFreight.stripe_customer_id, dbFreight.stripe_id, stripeCustomerId);
      const dbStripeSubscriptionId = firstValue(
        dbFreight.stripe_subscription_id,
        dbFreight.subscription_id,
        stripeSubscriptionId
      );
      const dbSubscriptionStatus = firstValue(dbFreight.subscription_status, synced?.subscriptionStatus, synced?.subscription_status);

      if (!dbStripeCustomerId || !dbStripeSubscriptionId) {
        setStatus("failed");
        setMessage(
          "Stripe payment was found, but the customer/subscription ID was not saved yet. Open Freight Subscription and tap Restore Existing Paid Subscription."
        );
        return;
      }

      if (!isActiveStatus(dbSubscriptionStatus)) {
        setStatus("failed");
        setMessage(
          `Stripe subscription was linked, but its status is "${dbSubscriptionStatus || "unknown"}". Open Freight Subscription to restore or refresh it.`
        );
        return;
      }

      setMessage("Activating freight dashboard access...");
      dbFreight = await activateSupabaseRecords(
        {
          ...dbFreight,
          stripe_customer_id: dbStripeCustomerId,
          stripe_id: dbStripeCustomerId,
          stripe_subscription_id: dbStripeSubscriptionId,
          subscription_id: dbStripeSubscriptionId,
          subscription_status: dbSubscriptionStatus || "active",
        },
        synced,
        checkout
      );

      const activeCarrier = buildActiveCarrier(stored, dbFreight);

      await saveFreightSession(activeCarrier);
      await AsyncStorage.setItem("freightSubscriptionStatus", "active");
      await AsyncStorage.removeItem("pendingFreightCarrier");
      await AsyncStorage.removeItem("pendingFreightSubscription");

      setStatus("success");
      setMessage("Your Freight Connect membership is active and linked to Supabase.");
    } catch (error: any) {
      console.log("Freight subscription success verification error:", error);
      setStatus("failed");
      setMessage(error?.message || "Unable to verify freight subscription.");
    }
  }

  if (status === "loading") {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor="#020617" />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.green} />
          <Text style={styles.loadingText}>{message}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const success = status === "success";

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#020617" />

      <View style={styles.container}>
        <View style={[styles.statusIcon, success ? styles.successIcon : styles.failedIcon]}>
          <Ionicons
            name={success ? "checkmark-done-outline" : "alert-circle-outline"}
            size={46}
            color="#FFFFFF"
          />
        </View>

        <Text style={styles.kicker}>Farm2Home Freight Connect</Text>

        <Text style={styles.title}>{success ? "Membership Active!" : "Verification Needed"}</Text>

        <Text style={styles.message}>{message}</Text>

        <View style={[styles.statusCard, !success && styles.failedCard]}>
          <Text style={styles.statusTitle}>{success ? "Next Step" : "Action Required"}</Text>
          <Text style={styles.statusText}>
            {success
              ? "Continue to your Freight Dashboard to access carrier tools, load board, routes, payouts, and account status."
              : "Open Freight Subscription and tap Restore Existing Paid Subscription. If you just completed checkout, wait a moment and tap it again so Stripe webhooks can finish syncing."}
          </Text>
        </View>

        {success ? (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.replace("/freight/dashboard" as any)}
            activeOpacity={0.88}
          >
            <Ionicons name="grid-outline" size={18} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>Go to Freight Dashboard</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.replace("/freight/subscription" as any)}
            activeOpacity={0.88}
          >
            <Ionicons name="refresh-outline" size={18} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>Restore Subscription</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.replace("/freight/profile" as any)}
          activeOpacity={0.88}
        >
          <Ionicons name="business-outline" size={18} color={COLORS.primary} />
          <Text style={styles.secondaryButtonText}>Open Freight Profile</Text>
        </TouchableOpacity>

        {!success ? (
          <TouchableOpacity
            style={styles.outlineButton}
            onPress={verifyAndActivate}
            activeOpacity={0.88}
          >
            <Ionicons name="reload-outline" size={18} color={COLORS.text} />
            <Text style={styles.outlineButtonText}>Try Verification Again</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity style={styles.homeButton} onPress={() => router.replace("/" as any)}>
          <Text style={styles.homeText}>Back Home</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  center: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingText: {
    color: COLORS.muted,
    marginTop: 12,
    fontWeight: "800",
    textAlign: "center",
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  statusIcon: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  successIcon: {
    backgroundColor: COLORS.greenDark,
    borderColor: COLORS.green,
  },
  failedIcon: {
    backgroundColor: COLORS.redDark,
    borderColor: "#F87171",
  },
  kicker: {
    color: COLORS.green,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
    textAlign: "center",
  },
  title: {
    fontSize: 34,
    fontWeight: "900",
    color: COLORS.white,
    textAlign: "center",
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    color: "#CBD5E1",
    textAlign: "center",
    lineHeight: 24,
    fontWeight: "700",
    marginBottom: 20,
  },
  statusCard: {
    backgroundColor: COLORS.greenDark,
    borderWidth: 1,
    borderColor: COLORS.green,
    borderRadius: 20,
    padding: 18,
    width: "100%",
    marginBottom: 18,
  },
  failedCard: {
    backgroundColor: COLORS.redDark,
    borderColor: "#F87171",
  },
  statusTitle: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 8,
  },
  statusText: {
    color: COLORS.text,
    fontWeight: "700",
    lineHeight: 22,
  },
  primaryButton: {
    width: "100%",
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 16,
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
    width: "100%",
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  secondaryButtonText: {
    color: COLORS.primary,
    fontWeight: "900",
    fontSize: 16,
  },
  outlineButton: {
    width: "100%",
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  outlineButtonText: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 16,
  },
  homeButton: {
    marginTop: 18,
  },
  homeText: {
    color: COLORS.muted,
    fontWeight: "900",
  },
});
