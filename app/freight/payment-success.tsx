// app/freight/payment-success.tsx

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

import { supabase } from "../data/supabaseClient";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  "https://farm2home-production-e4bd.up.railway.app";

const COLORS = {
  bg: "#F3F4F6",
  card: "#FFFFFF",
  black: "#050505",
  red: "#D71920",
  green: "#16A34A",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
};

function normalize(value: any) {
  return String(value || "").trim().toLowerCase();
}

async function saveFreightSession(carrier: any) {
  await AsyncStorage.setItem("currentFreightCarrier", JSON.stringify(carrier));
  await AsyncStorage.setItem("currentFreight", JSON.stringify(carrier));
  await AsyncStorage.setItem("currentFreightUser", JSON.stringify(carrier));
  await AsyncStorage.setItem("currentUser", JSON.stringify(carrier));
  await AsyncStorage.setItem("userRole", "freight");
  await AsyncStorage.setItem("currentUserRole", "freight");
}

export default function FreightPaymentSuccess() {
  const params = useLocalSearchParams();

  const sessionId = Array.isArray(params.session_id)
    ? params.session_id[0]
    : String(params.session_id || "");

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("Verifying Farm2Home Freight membership...");

  useEffect(() => {
    verifyPayment();
  }, []);

  async function verifyPayment() {
    try {
      if (!sessionId) {
        Alert.alert("Missing Checkout Session", "Unable to verify payment.");
        router.replace("/freight/register" as any);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/payments/verify-checkout-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sessionId }),
      });

      const paymentData = await response.json();

      if (!response.ok || !paymentData.success || !paymentData.paid) {
        Alert.alert(
          "Payment Not Complete",
          paymentData.error || "Stripe payment was not completed."
        );
        router.replace("/freight/register" as any);
        return;
      }

      const session = paymentData.session || {};
      const metadata = session.metadata || {};

      const stripeCustomerId =
        typeof session.customer === "string"
          ? session.customer
          : session.customer?.id || paymentData.customerId || paymentData.stripeCustomerId || "";

      const stripeSubscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id ||
            paymentData.subscriptionId ||
            paymentData.stripeSubscriptionId ||
            "";

      const finalEmail = normalize(
        metadata.email ||
          session.customer_details?.email ||
          session.customer_email ||
          paymentData.email ||
          ""
      );

      const pendingRaw =
        (await AsyncStorage.getItem("pendingFreightCarrier")) ||
        (await AsyncStorage.getItem("currentFreightCarrier")) ||
        (await AsyncStorage.getItem("currentFreight")) ||
        "{}";

      const pending = JSON.parse(pendingRaw);

      const freightId =
        metadata.freightId ||
        metadata.freight_id ||
        metadata.userId ||
        pending.id ||
        pending.freightId ||
        pending.freight_id ||
        "";

      let dbCarrier: any = null;

      if (freightId) {
        const { data } = await supabase
          .from("freight_users")
          .select("*")
          .eq("id", freightId)
          .maybeSingle();

        dbCarrier = data || null;
      }

      if (!dbCarrier && finalEmail) {
        const { data } = await supabase
          .from("freight_users")
          .select("*")
          .eq("email", finalEmail)
          .maybeSingle();

        dbCarrier = data || null;
      }

      const carrierId = dbCarrier?.id || freightId;

      if (carrierId) {
        const now = new Date().toISOString();

        const updatePayload = {
          stripe_id: stripeCustomerId || dbCarrier?.stripe_id || null,
          stripe_customer_id: stripeCustomerId || dbCarrier?.stripe_customer_id || null,
          stripe_subscription_id: stripeSubscriptionId || dbCarrier?.stripe_subscription_id || null,
          subscription_id: stripeSubscriptionId || dbCarrier?.subscription_id || null,
          stripe_checkout_session_id: sessionId,
          subscription_status: "active",
          membership_status: "active",
          freight_membership_paid: true,
          account_active: true,
          updated_at: now,
        };

        await supabase.from("freight_users").update(updatePayload).eq("id", carrierId);

        await supabase
          .from("profiles")
          .update({
            ...updatePayload,
            role: "freight",
            updated_at: now,
          })
          .or(`id.eq.${carrierId},auth_user_id.eq.${carrierId},profile_id.eq.${carrierId}`);

        await supabase
          .from("admin_verifications")
          .update({
            ...updatePayload,
            updated_at: now,
          })
          .or(`id.eq.${carrierId},freight_id.eq.${carrierId},profile_id.eq.${carrierId}`);
      }

      const refreshedCarrier = {
        ...(pending || {}),
        ...(dbCarrier || {}),
        id: carrierId || pending.id,
        freightId: carrierId || pending.freightId,
        freight_id: carrierId || pending.freight_id,
        role: "freight",
        email: finalEmail || pending.email || dbCarrier?.email || "",
        accountId: dbCarrier?.account_id || pending.accountId || pending.account_id || "",
        account_id: dbCarrier?.account_id || pending.account_id || pending.accountId || "",
        companyName:
          dbCarrier?.company_name ||
          dbCarrier?.business_name ||
          pending.companyName ||
          pending.company_name ||
          pending.businessName ||
          "Farm2Home Freight Carrier",
        company_name:
          dbCarrier?.company_name ||
          dbCarrier?.business_name ||
          pending.company_name ||
          pending.companyName ||
          "Farm2Home Freight Carrier",
        stripeId: stripeCustomerId,
        stripe_id: stripeCustomerId,
        stripeCustomerId,
        stripe_customer_id: stripeCustomerId,
        stripeSubscriptionId,
        stripe_subscription_id: stripeSubscriptionId,
        subscriptionId: stripeSubscriptionId,
        subscription_id: stripeSubscriptionId,
        subscriptionStatus: "active",
        subscription_status: "active",
        membershipStatus: "active",
        membership_status: "active",
        freightMembershipPaid: true,
        freight_membership_paid: true,
        accountActive: true,
        account_active: true,
      };

      await saveFreightSession(refreshedCarrier);
      await AsyncStorage.removeItem("pendingFreightCarrier");

      setMessage("Farm2Home Freight membership active.");
      setLoading(false);

      setTimeout(() => {
        router.replace("/freight/dashboard" as any);
      }, 1000);
    } catch (error: any) {
      setLoading(false);
      Alert.alert("Verification Error", error?.message || "Unable to verify payment.");
      router.replace("/freight/register" as any);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />

      <View style={styles.card}>
        <View style={styles.iconWrap}>
          {loading ? (
            <ActivityIndicator size="large" color="#FFFFFF" />
          ) : (
            <Ionicons name="checkmark-done-outline" size={38} color="#FFFFFF" />
          )}
        </View>

        <Text style={styles.title}>Payment Success</Text>
        <Text style={styles.message}>{message}</Text>

        <TouchableOpacity
          style={styles.button}
          onPress={() => router.replace("/freight/dashboard" as any)}
        >
          <Ionicons name="grid-outline" size={18} color="#FFFFFF" />
          <Text style={styles.buttonText}>Go to Freight Dashboard</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    backgroundColor: COLORS.card,
    borderRadius: 28,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  iconWrap: {
    width: 76,
    height: 76,
    borderRadius: 28,
    backgroundColor: COLORS.green,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  title: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: "900",
    textAlign: "center",
  },
  message: {
    color: COLORS.muted,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 23,
    marginTop: 10,
    marginBottom: 22,
  },
  button: {
    backgroundColor: COLORS.red,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },
});