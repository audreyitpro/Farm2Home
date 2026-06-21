// app/freight/payment-success.tsx

import React, { useEffect, useMemo, useState } from "react";
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

import { supabase } from "../data/supabaseClient";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  "https://farm2home-production-e4bd.up.railway.app";

const COLORS = {
  bg: "#F3F4F6",
  card: "#FFFFFF",
  surface: "#F9FAFB",
  black: "#050505",
  red: "#D71920",
  green: "#16A34A",
  amber: "#D97706",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
};

function clean(value: any) {
  return String(value || "").trim();
}

function normalize(value: any) {
  return clean(value).toLowerCase();
}

function isStripeCustomerId(value: any) {
  return clean(value).startsWith("cus_");
}

function isStripeSubscriptionId(value: any) {
  return clean(value).startsWith("sub_");
}

function isStripeConnectAccountId(value: any) {
  return clean(value).startsWith("acct_");
}

function pickCustomerId(...values: any[]) {
  const found = values.find((value) => isStripeCustomerId(value));
  return found ? clean(found) : "";
}

function pickSubscriptionId(...values: any[]) {
  const found = values.find((value) => isStripeSubscriptionId(value));
  return found ? clean(found) : "";
}

function pickConnectAccountId(...values: any[]) {
  const found = values.find((value) => isStripeConnectAccountId(value));
  return found ? clean(found) : "";
}

async function parseApiResponse(response: Response) {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { success: false, error: text || "Invalid backend response." };
  }
}

async function saveFreightSession(carrier: any) {
  const normalized = {
    ...carrier,
    role: "freight",
    updatedAt: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await AsyncStorage.setItem("currentFreightCarrier", JSON.stringify(normalized));
  await AsyncStorage.setItem("currentFreight", JSON.stringify(normalized));
  await AsyncStorage.setItem("currentFreightUser", JSON.stringify(normalized));
  await AsyncStorage.setItem("farm2homeCurrentFreight", JSON.stringify(normalized));
  await AsyncStorage.setItem("currentUser", JSON.stringify(normalized));
  await AsyncStorage.setItem("userRole", "freight");
  await AsyncStorage.setItem("currentUserRole", "freight");
}

async function getPendingFreightCarrier() {
  const raw =
    (await AsyncStorage.getItem("pendingFreightCarrier")) ||
    (await AsyncStorage.getItem("currentFreightCarrier")) ||
    (await AsyncStorage.getItem("currentFreight")) ||
    (await AsyncStorage.getItem("currentFreightUser")) ||
    (await AsyncStorage.getItem("currentUser")) ||
    "{}";

  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export default function FreightPaymentSuccess() {
  const params = useLocalSearchParams();

  const sessionId = useMemo(() => {
    return Array.isArray(params.session_id)
      ? params.session_id[0]
      : String(params.session_id || params.sessionId || "");
  }, [params.session_id, params.sessionId]);

  const directFreightId = useMemo(() => {
    return Array.isArray(params.freightId)
      ? params.freightId[0]
      : String(params.freightId || params.freight_id || "");
  }, [params.freightId, params.freight_id]);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("Verifying Farm2Home Freight membership...");
  const [status, setStatus] = useState<"loading" | "success" | "warning" | "error">("loading");
  const [carrier, setCarrier] = useState<any>(null);

  useEffect(() => {
    verifyPayment();
  }, []);

  async function verifyPayment() {
    try {
      setLoading(true);
      setStatus("loading");

      const pending = await getPendingFreightCarrier();

      if (!sessionId && !directFreightId && !pending?.id && !pending?.freightId) {
        setStatus("error");
        setMessage("Missing Stripe Checkout session. Please restart freight membership setup.");
        Alert.alert("Missing Checkout Session", "Unable to verify payment.");
        router.replace("/freight/register" as any);
        return;
      }

      let paymentData: any = {};
      let session: any = {};
      let metadata: any = {};

      if (sessionId) {
        const response = await fetch(`${API_BASE_URL}/payments/verify-checkout-session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            session_id: sessionId,
            role: "freight",
          }),
        });

        paymentData = await parseApiResponse(response);

        if (!response.ok || !paymentData.success || paymentData.paid === false) {
          setStatus("error");
          setMessage(paymentData.error || "Stripe payment was not completed.");
          Alert.alert("Payment Not Complete", paymentData.error || "Stripe payment was not completed.");
          router.replace("/freight/register" as any);
          return;
        }

        session = paymentData.session || {};
        metadata = session.metadata || paymentData.metadata || {};
      }

      const stripeCustomerId = pickCustomerId(
        session.customer,
        session.customer?.id,
        paymentData.customerId,
        paymentData.customer_id,
        paymentData.stripeCustomerId,
        paymentData.stripe_customer_id,
        metadata.stripe_customer_id,
        pending.stripeCustomerId,
        pending.stripe_customer_id
      );

      const stripeSubscriptionId = pickSubscriptionId(
        session.subscription,
        session.subscription?.id,
        paymentData.subscriptionId,
        paymentData.subscription_id,
        paymentData.stripeSubscriptionId,
        paymentData.stripe_subscription_id,
        metadata.stripe_subscription_id,
        pending.stripeSubscriptionId,
        pending.stripe_subscription_id,
        pending.subscriptionId,
        pending.subscription_id
      );

      const stripeAccountId = pickConnectAccountId(
        paymentData.stripeAccountId,
        paymentData.stripe_account_id,
        paymentData.freight_account,
        metadata.stripe_account_id,
        metadata.freight_account,
        pending.stripeAccountId,
        pending.stripe_account_id,
        pending.freightAccount,
        pending.freight_account
      );

      const finalEmail = normalize(
        metadata.email ||
          metadata.freight_email ||
          session.customer_details?.email ||
          session.customer_email ||
          paymentData.email ||
          paymentData.freight_email ||
          pending.email ||
          ""
      );

      const freightId =
        clean(metadata.freightId) ||
        clean(metadata.freight_id) ||
        clean(metadata.userId) ||
        clean(paymentData.freightId) ||
        clean(paymentData.freight_id) ||
        clean(directFreightId) ||
        clean(pending.id) ||
        clean(pending.freightId) ||
        clean(pending.freight_id) ||
        "";

      let dbCarrier: any = null;

      if (freightId) {
        const { data } = await supabase
          .from("freight_users")
          .select("*")
          .or(`id.eq.${freightId},freight_id.eq.${freightId},auth_user_id.eq.${freightId},profile_id.eq.${freightId}`)
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

      const carrierId = clean(dbCarrier?.id || freightId || pending.id || pending.freightId);

      if (!carrierId) {
        setStatus("warning");
        setMessage("Payment verified, but no freight profile was found. Please return to registration so your profile can be linked.");
        Alert.alert("Profile Missing", "Payment verified, but no freight profile was found.");
        router.replace("/freight/register" as any);
        return;
      }

      const now = new Date().toISOString();
      const finalCustomerId = pickCustomerId(stripeCustomerId, dbCarrier?.stripe_customer_id, pending.stripe_customer_id);
      const finalSubscriptionId = pickSubscriptionId(
        stripeSubscriptionId,
        dbCarrier?.stripe_subscription_id,
        dbCarrier?.subscription_id,
        pending.stripe_subscription_id,
        pending.subscription_id
      );
      const finalStripeAccountId = pickConnectAccountId(
        stripeAccountId,
        dbCarrier?.freight_account,
        dbCarrier?.stripe_account_id,
        pending.freight_account,
        pending.stripe_account_id
      );

      const updatePayload: any = {
        stripe_checkout_session_id: sessionId || dbCarrier?.stripe_checkout_session_id || null,
        stripe_id: finalCustomerId || dbCarrier?.stripe_id || null,
        stripe_customer_id: finalCustomerId || null,
        stripe_subscription_id: finalSubscriptionId || null,
        subscription_id: finalSubscriptionId || null,
        subscription_status: finalSubscriptionId ? "active" : dbCarrier?.subscription_status || "active",
        membership_status: finalSubscriptionId ? "active" : dbCarrier?.membership_status || "active",
        freight_membership_paid: Boolean(finalSubscriptionId || sessionId),
        account_active: true,
        approved: true,
        verification_status: "SUBMITTED",
        compliance_status: "SUBMITTED",
        admin_review_status: "submitted",
        application_submitted: true,
        submitted_at: dbCarrier?.submitted_at || now,
        updated_at: now,
      };

      if (finalStripeAccountId) {
        updatePayload.freight_account = finalStripeAccountId;
        updatePayload.stripe_account_id = finalStripeAccountId;
        updatePayload.stripe_connect_status = dbCarrier?.stripe_connect_status || "started";
      }

      const { error: freightUpdateError } = await supabase
        .from("freight_users")
        .update(updatePayload)
        .eq("id", carrierId);

      if (freightUpdateError) throw freightUpdateError;

      await supabase
        .from("profiles")
        .update({
          ...updatePayload,
          role: "freight",
          updated_at: now,
        })
        .or(`id.eq.${carrierId},auth_user_id.eq.${carrierId},profile_id.eq.${carrierId}`);

      await supabase.from("admin_verifications").upsert(
        {
          id: carrierId,
          freight_id: carrierId,
          carrier_id: carrierId,
          profile_id: carrierId,
          account_id: dbCarrier?.account_id || pending.account_id || pending.accountId || "",
          account_type: "FREIGHT_CARRIER",
          role: "freight",
          type: "FREIGHT_CARRIER",
          company_name:
            dbCarrier?.company_name ||
            dbCarrier?.business_name ||
            pending.companyName ||
            pending.company_name ||
            pending.businessName ||
            "Farm2Home Freight Carrier",
          business_name:
            dbCarrier?.business_name ||
            dbCarrier?.company_name ||
            pending.businessName ||
            pending.business_name ||
            pending.companyName ||
            "Farm2Home Freight Carrier",
          contact_name:
            dbCarrier?.contact_name ||
            dbCarrier?.full_name ||
            pending.contactName ||
            pending.contact_name ||
            pending.fullName ||
            "",
          email: finalEmail || dbCarrier?.email || pending.email || "",
          phone: dbCarrier?.phone || pending.phone || "",
          username: normalize(dbCarrier?.username || pending.username || ""),
          status: "SUBMITTED",
          review_decision: "submitted",
          approved: true,
          rejected: false,
          reviewed: false,
          needs_more_info: false,
          ...updatePayload,
          created_at: dbCarrier?.created_at || now,
          updated_at: now,
        },
        { onConflict: "id" }
      );

      await supabase.from("freight_subscriptions").upsert(
        {
          freight_id: carrierId,
          freight_email: finalEmail || dbCarrier?.email || pending.email || "",
          name:
            dbCarrier?.company_name ||
            dbCarrier?.business_name ||
            pending.companyName ||
            pending.businessName ||
            "Farm2Home Freight Carrier",
          username: normalize(dbCarrier?.username || pending.username || ""),
          stripe_customer_id: finalCustomerId || null,
          stripe_subscription_id: finalSubscriptionId || null,
          subscription_status: finalSubscriptionId ? "active" : "active",
          freight_account: finalStripeAccountId || null,
          stripe_account_id: finalStripeAccountId || null,
          updated_at: now,
          created_at: dbCarrier?.created_at || now,
        },
        { onConflict: "freight_id" }
      );

      const { data: refreshedDbCarrier } = await supabase
        .from("freight_users")
        .select("*")
        .eq("id", carrierId)
        .maybeSingle();

      const refreshedCarrier = {
        ...(pending || {}),
        ...(dbCarrier || {}),
        ...(refreshedDbCarrier || {}),
        id: carrierId,
        freightId: carrierId,
        freight_id: carrierId,
        role: "freight",
        email: finalEmail || refreshedDbCarrier?.email || dbCarrier?.email || pending.email || "",
        accountId: refreshedDbCarrier?.account_id || dbCarrier?.account_id || pending.accountId || pending.account_id || "",
        account_id: refreshedDbCarrier?.account_id || dbCarrier?.account_id || pending.account_id || pending.accountId || "",
        companyName:
          refreshedDbCarrier?.company_name ||
          refreshedDbCarrier?.business_name ||
          dbCarrier?.company_name ||
          dbCarrier?.business_name ||
          pending.companyName ||
          pending.company_name ||
          pending.businessName ||
          "Farm2Home Freight Carrier",
        company_name:
          refreshedDbCarrier?.company_name ||
          refreshedDbCarrier?.business_name ||
          dbCarrier?.company_name ||
          dbCarrier?.business_name ||
          pending.company_name ||
          pending.companyName ||
          "Farm2Home Freight Carrier",
        businessName:
          refreshedDbCarrier?.business_name ||
          refreshedDbCarrier?.company_name ||
          pending.businessName ||
          pending.business_name ||
          pending.companyName ||
          "Farm2Home Freight Carrier",
        business_name:
          refreshedDbCarrier?.business_name ||
          refreshedDbCarrier?.company_name ||
          pending.business_name ||
          pending.businessName ||
          pending.companyName ||
          "Farm2Home Freight Carrier",
        stripeId: finalCustomerId,
        stripe_id: finalCustomerId,
        stripeCustomerId: finalCustomerId,
        stripe_customer_id: finalCustomerId,
        stripeSubscriptionId: finalSubscriptionId,
        stripe_subscription_id: finalSubscriptionId,
        subscriptionId: finalSubscriptionId,
        subscription_id: finalSubscriptionId,
        freightAccount: finalStripeAccountId,
        freight_account: finalStripeAccountId,
        stripeAccountId: finalStripeAccountId,
        stripe_account_id: finalStripeAccountId,
        subscriptionStatus: "active",
        subscription_status: "active",
        membershipStatus: "active",
        membership_status: "active",
        freightMembershipPaid: true,
        freight_membership_paid: true,
        accountActive: true,
        account_active: true,
        applicationSubmitted: true,
        application_submitted: true,
      };

      await saveFreightSession(refreshedCarrier);
      await AsyncStorage.removeItem("pendingFreightCarrier");

      setCarrier(refreshedCarrier);
      setStatus("success");
      setMessage("Farm2Home Freight membership is active. Your profile was updated and you can open the freight dashboard.");
      setLoading(false);

      setTimeout(() => {
        router.replace("/freight/dashboard" as any);
      }, 900);
    } catch (error: any) {
      console.log("Freight payment verification error:", error);
      setStatus("error");
      setMessage(error?.message || "Unable to verify payment.");
      setLoading(false);
      Alert.alert("Verification Error", error?.message || "Unable to verify payment.");
    }
  }

  function iconName() {
    if (status === "success") return "checkmark-done-outline";
    if (status === "warning") return "alert-circle-outline";
    if (status === "error") return "close-circle-outline";
    return "card-outline";
  }

  function iconColor() {
    if (status === "success") return COLORS.green;
    if (status === "warning") return COLORS.amber;
    if (status === "error") return COLORS.red;
    return COLORS.black;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={[styles.iconWrap, { backgroundColor: iconColor() }]}>
            {loading ? (
              <ActivityIndicator size="large" color="#FFFFFF" />
            ) : (
              <Ionicons name={iconName()} size={38} color="#FFFFFF" />
            )}
          </View>

          <Text style={styles.kicker}>Farm2Home Freight</Text>
          <Text style={styles.title}>{status === "success" ? "Payment Success" : "Payment Verification"}</Text>
          <Text style={styles.message}>{message}</Text>

          {carrier ? (
            <View style={styles.infoCard}>
              <InfoRow label="Account ID" value={carrier.account_id || carrier.accountId || "Pending"} />
              <InfoRow label="Stripe Customer" value={carrier.stripe_customer_id || carrier.stripeCustomerId || "Pending"} />
              <InfoRow label="Subscription" value={carrier.stripe_subscription_id || carrier.subscription_id || "Pending"} />
              <InfoRow label="Connect Account" value={carrier.stripe_account_id || carrier.freight_account || "Connect bank next"} />
            </View>
          ) : null}

          <TouchableOpacity
            style={styles.button}
            onPress={() => router.replace("/freight/dashboard" as any)}
          >
            <Ionicons name="grid-outline" size={18} color="#FFFFFF" />
            <Text style={styles.buttonText}>Go to Freight Dashboard</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.outlineButton}
            onPress={() => router.replace("/freight/register" as any)}
          >
            <Ionicons name="create-outline" size={18} color={COLORS.red} />
            <Text style={styles.outlineButtonText}>Return to Registration</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  content: {
    flexGrow: 1,
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
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  kicker: {
    color: COLORS.red,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
    fontSize: 12,
    marginBottom: 8,
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
    marginBottom: 20,
  },
  infoCard: {
    width: "100%",
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 14,
    marginBottom: 18,
  },
  infoRow: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 10,
  },
  infoLabel: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  infoValue: {
    color: COLORS.text,
    fontWeight: "900",
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
  outlineButton: {
    backgroundColor: "#FFF1F2",
    borderWidth: 1,
    borderColor: COLORS.red,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    marginTop: 12,
  },
  outlineButtonText: {
    color: COLORS.red,
    fontWeight: "900",
    fontSize: 16,
  },
});
