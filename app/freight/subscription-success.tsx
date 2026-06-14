// app/freight/subscription-success.tsx

import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

function normalize(value: any) {
  return String(value || "").trim().toLowerCase();
}

function isActiveStatus(value: any) {
  return ["active", "trialing", "past_due"].includes(normalize(value));
}

async function saveFreightSession(carrier: any) {
  await AsyncStorage.setItem("currentFreightCarrier", JSON.stringify(carrier));
  await AsyncStorage.setItem("currentFreight", JSON.stringify(carrier));
  await AsyncStorage.setItem("currentFreightUser", JSON.stringify(carrier));
  await AsyncStorage.setItem("currentUser", JSON.stringify(carrier));
  await AsyncStorage.setItem("userRole", "freight");
  await AsyncStorage.setItem("currentUserRole", "freight");
}

export default function FreightSubscriptionSuccess() {
  const params = useLocalSearchParams();

  const sessionId = Array.isArray(params.session_id)
    ? params.session_id[0]
    : String(params.session_id || "");

  const [status, setStatus] = useState<StatusType>("loading");
  const [message, setMessage] = useState("Verifying Freight Connect membership...");

  useEffect(() => {
    verifyAndActivate();
  }, []);

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

  async function loadFreightFromSupabase(email?: string, freightId?: string) {
    let query = supabase.from("freight_users").select("*");

    if (freightId) {
      query = query.eq("id", freightId);
    } else if (email) {
      query = query.eq("email", normalize(email));
    } else {
      return null;
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.log("Freight success Supabase load error:", error.message);
      return null;
    }

    return data || null;
  }

  async function verifyCheckoutSession() {
    if (!sessionId) return null;

    const response = await fetch(`${API_BASE_URL}/payments/verify-checkout-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });

    const text = await response.text();
    let json: any = {};

    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { success: false, error: text };
    }

    if (!response.ok || !json.success || !json.paid) {
      throw new Error(json.error || "Stripe checkout was not verified as paid.");
    }

    return json;
  }

  async function forceSyncFreight(stored: any) {
    const freightId = stored?.id || stored?.freightId || stored?.freight_id || "";
    const email = normalize(stored?.email || "");
    const companyName =
      stored?.companyName ||
      stored?.businessName ||
      stored?.company_name ||
      stored?.business_name ||
      "";

    if (!freightId && !email) return null;

    const response = await fetch(`${API_BASE_URL}/payments/force-sync-freight-subscription`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: "freight",
        userId: freightId,
        freightId,
        freight_id: freightId,
        email,
        businessName: companyName,
        companyName,
        name: companyName,
        username: normalize(stored?.username || email),
        stripeCustomerId: stored?.stripeCustomerId || stored?.stripe_customer_id || "",
        stripe_customer_id: stored?.stripeCustomerId || stored?.stripe_customer_id || "",
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

  async function verifyAndActivate() {
    try {
      setStatus("loading");

      const stored = await getStoredFreightUser();

      if (!stored) {
        setStatus("failed");
        setMessage("No freight account session was found. Please log in again.");
        return;
      }

      const storedFreightId = stored.id || stored.freightId || stored.freight_id || "";
      const storedEmail = normalize(stored.email || "");

      if (sessionId) {
        await verifyCheckoutSession();
      } else {
        await forceSyncFreight(stored);
      }

      const dbFreight = await loadFreightFromSupabase(storedEmail, storedFreightId);

      if (!dbFreight?.id) {
        setStatus("failed");
        setMessage("Payment may be complete, but the freight profile was not found in Supabase.");
        return;
      }

      const subscriptionStatus = dbFreight.subscription_status || "";
      const hasStripeCustomer = Boolean(dbFreight.stripe_customer_id || dbFreight.stripe_id);
      const hasStripeSubscription = Boolean(
        dbFreight.stripe_subscription_id || dbFreight.subscription_id
      );

      if (!hasStripeCustomer || !hasStripeSubscription || !isActiveStatus(subscriptionStatus)) {
        setStatus("failed");
        setMessage(
          "Stripe payment was not fully linked yet. Go to Subscription and use Restore Existing Paid Subscription."
        );
        return;
      }

      const activeCarrier = {
        ...stored,
        ...dbFreight,
        id: dbFreight.id,
        freightId: dbFreight.freight_id || dbFreight.id,
        freight_id: dbFreight.freight_id || dbFreight.id,
        role: "freight",
        email: normalize(dbFreight.email || storedEmail),
        accountId: dbFreight.account_id || stored.accountId || "",
        account_id: dbFreight.account_id || stored.account_id || "",
        companyName: dbFreight.company_name || dbFreight.business_name || stored.companyName || "",
        businessName: dbFreight.business_name || dbFreight.company_name || stored.businessName || "",
        stripeId: dbFreight.stripe_id || dbFreight.stripe_customer_id || "",
        stripe_id: dbFreight.stripe_id || dbFreight.stripe_customer_id || "",
        stripeCustomerId: dbFreight.stripe_customer_id || dbFreight.stripe_id || "",
        stripe_customer_id: dbFreight.stripe_customer_id || dbFreight.stripe_id || "",
        stripeSubscriptionId:
          dbFreight.stripe_subscription_id || dbFreight.subscription_id || "",
        stripe_subscription_id:
          dbFreight.stripe_subscription_id || dbFreight.subscription_id || "",
        subscriptionId: dbFreight.subscription_id || dbFreight.stripe_subscription_id || "",
        subscription_id: dbFreight.subscription_id || dbFreight.stripe_subscription_id || "",
        membershipStatus: dbFreight.membership_status || "active",
        subscriptionStatus: dbFreight.subscription_status || "active",
        freightMembershipPaid: true,
        freight_membership_paid: true,
        accountActive: true,
        account_active: true,
        freightBoardAccess: true,
        hasActiveSubscription: true,
        activatedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

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
          <ActivityIndicator size="large" color="#10B981" />
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

        <Text style={styles.title}>
          {success ? "Membership Active!" : "Verification Needed"}
        </Text>

        <Text style={styles.message}>{message}</Text>

        <View style={[styles.statusCard, !success && styles.failedCard]}>
          <Text style={styles.statusTitle}>{success ? "Next Step" : "Action Required"}</Text>
          <Text style={styles.statusText}>
            {success
              ? "Continue to your Freight Dashboard to access carrier tools, load board, routes, and account status."
              : "Open Freight Subscription and tap Restore Existing Paid Subscription or manually link your Stripe Customer ID that starts with cus_."}
          </Text>
        </View>

        {success ? (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.replace("/freight/dashboard" as any)}
          >
            <Ionicons name="grid-outline" size={18} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>Go to Freight Dashboard</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.replace("/freight/subscription" as any)}
          >
            <Ionicons name="refresh-outline" size={18} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>Restore Subscription</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.replace("/freight/profile" as any)}
        >
          <Ionicons name="business-outline" size={18} color={freightTheme.colors.primary} />
          <Text style={styles.secondaryButtonText}>Open Freight Profile</Text>
        </TouchableOpacity>

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
    backgroundColor: freightTheme.colors.background,
  },
  center: {
    flex: 1,
    backgroundColor: freightTheme.colors.background,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingText: {
    color: freightTheme.colors.mutedText,
    marginTop: 12,
    fontWeight: "800",
    textAlign: "center",
  },
  container: {
    flex: 1,
    backgroundColor: freightTheme.colors.background,
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
    backgroundColor: "#064E3B",
    borderColor: "#10B981",
  },
  failedIcon: {
    backgroundColor: "#7F1D1D",
    borderColor: "#F87171",
  },
  kicker: {
    color: "#10B981",
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
    color: "#FFFFFF",
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
    backgroundColor: "#064E3B",
    borderWidth: 1,
    borderColor: "#10B981",
    borderRadius: 20,
    padding: 18,
    width: "100%",
    marginBottom: 18,
  },
  failedCard: {
    backgroundColor: "#7F1D1D",
    borderColor: "#F87171",
  },
  statusTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 8,
  },
  statusText: {
    color: "#E5E7EB",
    fontWeight: "700",
    lineHeight: 22,
  },
  primaryButton: {
    width: "100%",
    backgroundColor: freightTheme.colors.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },
  secondaryButton: {
    width: "100%",
    backgroundColor: freightTheme.colors.card,
    borderWidth: 1,
    borderColor: freightTheme.colors.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  secondaryButtonText: {
    color: freightTheme.colors.primary,
    fontWeight: "900",
    fontSize: 16,
  },
  homeButton: {
    marginTop: 18,
  },
  homeText: {
    color: freightTheme.colors.mutedText,
    fontWeight: "900",
  },
});