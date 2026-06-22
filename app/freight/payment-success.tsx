// app/freight/payment-success.tsx

import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
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

const ROUTES = {
  dashboard: "/freight/dashboard",
  register: "/freight/register",
  subscription: "/freight/subscription",
  connectBank: "/freight/connect-bank",
  profile: "/freight/profile",
  support: "/freight/support",
} as const;

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
  navy: "#020617",
  white: "#FFFFFF",
};

function clean(value: any) {
  return String(value ?? "").trim();
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

function shortId(value?: string) {
  const id = clean(value);
  if (!id) return "Missing";
  if (id.length <= 16) return id;
  return `${id.slice(0, 8)}...${id.slice(-5)}`;
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
    (await AsyncStorage.getItem("pendingFreightSubscription")) ||
    (await AsyncStorage.getItem("pendingFreightCarrier")) ||
    (await AsyncStorage.getItem("currentFreightCarrier")) ||
    (await AsyncStorage.getItem("currentFreight")) ||
    (await AsyncStorage.getItem("currentFreightUser")) ||
    (await AsyncStorage.getItem("farm2homeCurrentFreight")) ||
    (await AsyncStorage.getItem("currentUser")) ||
    "{}";

  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function safeUpdateProfiles(payload: any, carrierId: string) {
  try {
    await supabase
      .from("profiles")
      .update({
        ...payload,
        role: "freight",
        updated_at: new Date().toISOString(),
      })
      .or(`id.eq.${carrierId},auth_user_id.eq.${carrierId},profile_id.eq.${carrierId}`);
  } catch (error) {
    console.log("profiles update skipped:", error);
  }
}

async function safeUpsertAdminVerification(payload: any) {
  try {
    await supabase.from("admin_verifications").upsert(payload, { onConflict: "id" });
  } catch (error) {
    console.log("admin_verifications upsert skipped:", error);
  }
}

async function safeUpsertFreightSubscription(payload: any) {
  try {
    await supabase.from("freight_subscriptions").upsert(payload, { onConflict: "freight_id" });
  } catch (error) {
    console.log("freight_subscriptions upsert skipped:", error);
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

      if (!sessionId && !directFreightId && !pending?.id && !pending?.freightId && !pending?.freight_id) {
        setStatus("error");
        setMessage("Missing Stripe Checkout session. Please restart freight membership setup.");
        Alert.alert("Missing Checkout Session", "Unable to verify payment.");
        router.replace(ROUTES.subscription as any);
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
          router.replace(ROUTES.subscription as any);
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
        metadata.stripeCustomerId,
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
        metadata.stripeSubscriptionId,
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
          .limit(1);

        dbCarrier = Array.isArray(data) && data.length > 0 ? data[0] : null;
      }

      if (!dbCarrier && finalEmail) {
        const { data } = await supabase.from("freight_users").select("*").eq("email", finalEmail).limit(1);
        dbCarrier = Array.isArray(data) && data.length > 0 ? data[0] : null;
      }

      const carrierId = clean(dbCarrier?.id || freightId || pending.id || pending.freightId || pending.freight_id);

      if (!carrierId) {
        setStatus("warning");
        setMessage("Payment verified, but no freight profile was found. Please return to registration so your profile can be linked.");
        Alert.alert("Profile Missing", "Payment verified, but no freight profile was found.");
        router.replace(ROUTES.register as any);
        return;
      }

      const now = new Date().toISOString();

      const finalCustomerId = pickCustomerId(
        stripeCustomerId,
        dbCarrier?.stripe_customer_id,
        dbCarrier?.stripe_id,
        pending.stripe_customer_id,
        pending.stripeCustomerId
      );

      const finalSubscriptionId = pickSubscriptionId(
        stripeSubscriptionId,
        dbCarrier?.stripe_subscription_id,
        dbCarrier?.subscription_id,
        pending.stripe_subscription_id,
        pending.subscription_id,
        pending.stripeSubscriptionId,
        pending.subscriptionId
      );

      const finalStripeAccountId = pickConnectAccountId(
        stripeAccountId,
        dbCarrier?.freight_account,
        dbCarrier?.stripe_account_id,
        pending.freight_account,
        pending.stripe_account_id,
        pending.freightAccount,
        pending.stripeAccountId
      );

      const updatePayload: any = {
        stripe_checkout_session_id: sessionId || dbCarrier?.stripe_checkout_session_id || null,
        stripe_id: finalCustomerId || dbCarrier?.stripe_id || null,
        stripe_customer_id: finalCustomerId || null,
        stripe_subscription_id: finalSubscriptionId || null,
        subscription_id: finalSubscriptionId || null,
        subscription_status: finalSubscriptionId ? "active" : dbCarrier?.subscription_status || "active",
        membership_status: finalSubscriptionId ? "active" : dbCarrier?.membership_status || "active",
        freight_membership_paid: Boolean(finalSubscriptionId || sessionId || finalCustomerId),
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

      await safeUpdateProfiles(updatePayload, carrierId);

      const accountId = dbCarrier?.account_id || pending.account_id || pending.accountId || "";
      const companyName =
        dbCarrier?.company_name ||
        dbCarrier?.business_name ||
        pending.companyName ||
        pending.company_name ||
        pending.businessName ||
        "Farm2Home Freight Carrier";

      await safeUpsertAdminVerification({
        id: carrierId,
        freight_id: carrierId,
        carrier_id: carrierId,
        profile_id: carrierId,
        account_id: accountId,
        account_type: "FREIGHT_CARRIER",
        role: "freight",
        type: "FREIGHT_CARRIER",
        company_name: companyName,
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
      });

      await safeUpsertFreightSubscription({
        freight_id: carrierId,
        freight_email: finalEmail || dbCarrier?.email || pending.email || "",
        name: companyName,
        username: normalize(dbCarrier?.username || pending.username || ""),
        stripe_customer_id: finalCustomerId || null,
        stripe_subscription_id: finalSubscriptionId || null,
        subscription_status: finalSubscriptionId ? "active" : "active",
        current_period_end: paymentData.current_period_end || paymentData.currentPeriodEnd || null,
        freight_account: finalStripeAccountId || null,
        stripe_account_id: finalStripeAccountId || null,
        updated_at: now,
        created_at: dbCarrier?.created_at || now,
      });

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
        companyName,
        company_name: companyName,
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
      await AsyncStorage.removeItem("pendingFreightSubscription");

      setCarrier(refreshedCarrier);
      setStatus("success");
      setMessage("Farm2Home Freight membership is active. Your Stripe customer and subscription were saved.");
      setLoading(false);

      setTimeout(() => {
        router.replace(ROUTES.dashboard as any);
      }, 1200);
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
    return COLORS.primary;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.shell}>
          <View style={styles.sidebar}>
            <View style={styles.brandRow}>
              <View style={styles.brandIcon}>
                <Ionicons name="card-outline" size={28} color={COLORS.white} />
              </View>
              <View>
                <Text style={styles.brandTitle}>Farm2Home</Text>
                <Text style={styles.brandSubtitle}>Payment Success</Text>
              </View>
            </View>

            <View style={styles.sideDivider} />
            <SideLink icon="grid-outline" title="Dashboard" route={ROUTES.dashboard} />
            <SideLink icon="card-outline" title="Subscription" route={ROUTES.subscription} />
            <SideLink icon="business-outline" title="Connect Bank" route={ROUTES.connectBank} />
            <SideLink icon="person-outline" title="Profile" route={ROUTES.profile} />
            <SideLink icon="headset-outline" title="Support" route={ROUTES.support} />
          </View>

          <View style={styles.main}>
            <View style={styles.card}>
              <View style={[styles.iconWrap, { backgroundColor: iconColor() }]}>
                {loading ? (
                  <ActivityIndicator size="large" color={COLORS.white} />
                ) : (
                  <Ionicons name={iconName()} size={38} color={COLORS.white} />
                )}
              </View>

              <Text style={styles.kicker}>Fina Admin Checkout Sync</Text>
              <Text style={styles.title}>{status === "success" ? "Payment Success" : "Payment Verification"}</Text>
              <Text style={styles.message}>{message}</Text>

              {carrier ? (
                <View style={styles.infoCard}>
                  <InfoRow label="Freight UUID" value={carrier.id || carrier.freightId || "Pending"} />
                  <InfoRow label="Static Account ID" value={carrier.account_id || carrier.accountId || "Pending"} />
                  <InfoRow label="Stripe Customer" value={shortId(carrier.stripe_customer_id || carrier.stripeCustomerId)} />
                  <InfoRow label="Subscription" value={shortId(carrier.stripe_subscription_id || carrier.subscription_id)} />
                  <InfoRow label="Connect Account" value={shortId(carrier.stripe_account_id || carrier.freight_account)} />
                </View>
              ) : null}

              <View style={styles.actionGrid}>
                <TouchableOpacity style={styles.primaryButton} onPress={() => router.replace(ROUTES.dashboard as any)}>
                  <Ionicons name="grid-outline" size={18} color={COLORS.white} />
                  <Text style={styles.primaryButtonText}>Go to Freight Dashboard</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.secondaryButton} onPress={() => router.replace(ROUTES.connectBank as any)}>
                  <Ionicons name="business-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.secondaryButtonText}>Connect / Update Bank</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.secondaryButton} onPress={() => router.replace(ROUTES.subscription as any)}>
                  <Ionicons name="card-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.secondaryButtonText}>Subscription Page</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.darkButton} onPress={() => router.replace(ROUTES.register as any)}>
                  <Ionicons name="create-outline" size={18} color={COLORS.white} />
                  <Text style={styles.darkButtonText}>Return to Registration</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SideLink({
  icon,
  title,
  route,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  route: string;
}) {
  return (
    <TouchableOpacity style={styles.sidebarLink} onPress={() => router.push(route as any)}>
      <Ionicons name={icon} size={18} color="#A5B4FC" />
      <Text style={styles.sidebarLinkText}>{title}</Text>
    </TouchableOpacity>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, value === "Missing" || value === "Pending" ? styles.infoMissing : null]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  content: { flexGrow: 1, paddingBottom: 40 },
  shell: {
    flex: 1,
    flexDirection: Platform.OS === "web" ? "row" : "column",
    minHeight: Platform.OS === "web" ? 760 : undefined,
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
  sidebarLinkText: { color: "#CBD5E1", fontWeight: "900" },
  main: { flex: 1, padding: 18, alignItems: "center", justifyContent: "center" },
  card: {
    width: "100%",
    maxWidth: 920,
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
    color: COLORS.primary,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
    fontSize: 12,
    marginBottom: 8,
  },
  title: { color: COLORS.text, fontSize: 32, fontWeight: "900", textAlign: "center" },
  message: {
    color: COLORS.muted,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 23,
    marginTop: 10,
    marginBottom: 20,
    maxWidth: 720,
  },
  infoCard: {
    width: "100%",
    backgroundColor: COLORS.panel,
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
  infoValue: { color: COLORS.text, fontWeight: "900" },
  infoMissing: { color: COLORS.amber },
  actionGrid: { width: "100%", gap: 12 },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
  },
  primaryButtonText: { color: COLORS.white, fontWeight: "900", fontSize: 16 },
  secondaryButton: {
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
  },
  secondaryButtonText: { color: COLORS.primary, fontWeight: "900", fontSize: 16 },
  darkButton: {
    backgroundColor: COLORS.navy,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
  },
  darkButtonText: { color: COLORS.white, fontWeight: "900", fontSize: 16 },
});
