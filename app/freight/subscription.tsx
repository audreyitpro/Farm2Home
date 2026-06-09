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

import { PAYMENT_LINKS } from "../config/paymentLinks";
import { API_BASE_URL } from "../config/api";
import { supabase } from "../data/supabaseClient";

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

export default function FreightSubscriptionScreen() {
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
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

  async function loadFreightUser() {
    try {
      const stored = await getStoredFreightUser();
      const { data: authData } = await supabase.auth.getUser();
      const authUser = authData?.user;

      const freightId = stored?.id || stored?.freightId || authUser?.id || "";
      const savedEmail = normalize(stored?.email || authUser?.email || "");

      let dbFreight: any = null;

      if (freightId) {
        const result = await supabase
          .from("freight_users")
          .select("*")
          .eq("id", freightId)
          .maybeSingle();

        if (!result.error && result.data) dbFreight = result.data;
      }

      if (!dbFreight && savedEmail) {
        const result = await supabase
          .from("freight_users")
          .select("*")
          .eq("email", savedEmail)
          .maybeSingle();

        if (!result.error && result.data) dbFreight = result.data;
      }

      const merged = {
        ...(stored || {}),
        ...(dbFreight || {}),
        id: dbFreight?.id || stored?.id || stored?.freightId || authUser?.id || "",
        freightId: dbFreight?.id || stored?.freightId || stored?.id || authUser?.id || "",
        email: normalize(dbFreight?.email || stored?.email || savedEmail),
        companyName:
          dbFreight?.company_name ||
          dbFreight?.business_name ||
          stored?.companyName ||
          stored?.businessName ||
          "",
        businessName:
          dbFreight?.business_name ||
          dbFreight?.company_name ||
          stored?.businessName ||
          stored?.companyName ||
          "",
        role: "freight",
        membershipStatus:
          dbFreight?.membership_status || stored?.membershipStatus || "not_started",
        subscriptionStatus:
          dbFreight?.subscription_status || stored?.subscriptionStatus || "not_started",
        membershipType: stored?.membershipType || "freight_membership",
        planType: stored?.planType || "freight",
        freightBoardAccess:
          dbFreight?.subscription_status === "active" ||
          stored?.freightBoardAccess ||
          false,
        accountActive: dbFreight?.account_active ?? stored?.accountActive ?? false,
        hasActiveSubscription:
          dbFreight?.subscription_status === "active" ||
          stored?.hasActiveSubscription ||
          false,
        stripeCustomerId:
          dbFreight?.stripe_customer_id ||
          stored?.stripeCustomerId ||
          stored?.customerId ||
          "",
        stripeSubscriptionId:
          dbFreight?.stripe_subscription_id ||
          stored?.stripeSubscriptionId ||
          stored?.subscriptionId ||
          "",
      };

      if (merged.email) setEmail(merged.email);
      if (merged.companyName) setCompanyName(merged.companyName);

      if (merged.id || merged.email) {
        setFreightUser(merged);
        await persistFreightUser(merged, false);
      }
    } catch (error) {
      console.log("LOAD_FREIGHT_SUBSCRIPTION_ERROR:", error);
    }
  }

  async function persistFreightUser(user: any, saveToSupabase = true) {
    const now = new Date().toISOString();

    const normalizedUser = {
      ...user,
      id: user.id || user.freightId || `freight_${Date.now()}`,
      freightId: user.freightId || user.id || `freight_${Date.now()}`,
      email: normalize(user.email),
      companyName: user.companyName || user.businessName || user.name,
      businessName: user.businessName || user.companyName || user.name,
      name: user.name || user.companyName || user.businessName,
      role: "freight",
      updatedAt: now,
    };

    if (saveToSupabase && normalizedUser.id) {
      const { error } = await supabase.from("freight_users").upsert(
        {
          id: normalizedUser.id,
          email: normalizedUser.email,
          company_name: normalizedUser.companyName,
          business_name: normalizedUser.businessName,
          name: normalizedUser.name,
          role: "freight",
          membership_status: normalizedUser.membershipStatus,
          subscription_status: normalizedUser.subscriptionStatus,
          account_active: normalizedUser.accountActive,
          stripe_customer_id: normalizedUser.stripeCustomerId || null,
          stripe_subscription_id: normalizedUser.stripeSubscriptionId || null,
          updated_at: now,
        },
        { onConflict: "id" }
      );

      if (error) console.log("Freight subscription Supabase sync skipped:", error.message);
    }

    await AsyncStorage.setItem("currentUser", JSON.stringify(normalizedUser));
    await AsyncStorage.setItem("currentFreight", JSON.stringify(normalizedUser));
    await AsyncStorage.setItem("currentFreightUser", JSON.stringify(normalizedUser));
    await AsyncStorage.setItem("currentFreightCarrier", JSON.stringify(normalizedUser));
    await AsyncStorage.setItem("currentUserRole", "freight");
    await AsyncStorage.setItem("userRole", "freight");

    setFreightUser(normalizedUser);
    return normalizedUser;
  }

  async function openUrl(url: string) {
    if (!url || !url.startsWith("http")) {
      Alert.alert("Stripe Error", "Invalid Stripe checkout URL.");
      return;
    }

    if (Platform.OS === "web") {
      window.location.href = url;
      return;
    }

    await WebBrowser.openBrowserAsync(url);
  }

  async function startSubscription() {
    if (loading) return;

    const cleanEmail = email.trim().toLowerCase();
    const cleanCompany = companyName.trim();

    if (!cleanCompany) {
      Alert.alert("Missing Company Name", "Please enter your company name.");
      return;
    }

    if (!cleanEmail || !cleanEmail.includes("@")) {
      Alert.alert("Missing Email", "Please enter a valid freight email.");
      return;
    }

    try {
      setLoading(true);

      const freightId =
        freightUser?.id || freightUser?.freightId || `freight_${Date.now()}`;

      const pendingFreight = {
        ...freightUser,
        id: freightId,
        freightId,
        email: cleanEmail,
        companyName: cleanCompany,
        businessName: cleanCompany,
        name: cleanCompany,
        role: "freight",
        membershipStatus: "pending_payment",
        subscriptionStatus: "pending_payment",
        membershipType: "freight_membership",
        planType: "freight",
        freightBoardAccess: false,
        accountActive: false,
        hasActiveSubscription: false,
        createdAt: freightUser?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await persistFreightUser(pendingFreight, true);
      await AsyncStorage.setItem(
        "pendingFreightSubscription",
        JSON.stringify(pendingFreight)
      );

      const stripeUrl = PAYMENT_LINKS.freightMembership;

      if (!stripeUrl) {
        throw new Error("Freight membership payment link missing.");
      }

      await openUrl(stripeUrl);

      Alert.alert(
        "Complete Payment",
        "After payment is complete, return to Farm2Home and tap 'I Completed Payment'."
      );
    } catch (error: any) {
      console.log("FREIGHT_SUBSCRIPTION_ERROR:", error);
      Alert.alert(
        "Subscription Error",
        error?.message || "Unable to start freight membership."
      );
    } finally {
      setLoading(false);
    }
  }

  async function continueAfterPayment() {
    try {
      const pending = await AsyncStorage.getItem("pendingFreightSubscription");

      if (!pending) {
        Alert.alert(
          "No Pending Membership",
          "Please complete freight membership payment first."
        );
        return;
      }

      const pendingFreight = JSON.parse(pending);

      const activatedFreight = {
        ...pendingFreight,
        membershipStatus: "active",
        subscriptionStatus: "active",
        hasActiveSubscription: true,
        freightBoardAccess: true,
        accountActive: true,
        activatedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await persistFreightUser(activatedFreight, true);
      await AsyncStorage.setItem("freightSubscriptionStatus", "active");
      await AsyncStorage.removeItem("pendingFreightSubscription");

      router.replace("/freight/subscription-success" as any);
    } catch (error: any) {
      console.log("FREIGHT_CONTINUE_AFTER_PAYMENT_ERROR:", error);
      Alert.alert(
        "Activation Error",
        error?.message || "Unable to activate freight membership."
      );
    }
  }

  async function manageBillingPortal() {
    const stripeCustomerId =
      freightUser?.stripeCustomerId ||
      freightUser?.stripe_customer_id ||
      freightUser?.customerId;

    if (!stripeCustomerId) {
      Alert.alert(
        "Missing Stripe Customer",
        "No Stripe customer ID was found for this freight account."
      );
      return;
    }

    try {
      setPortalLoading(true);

      const response = await fetch(
        `${API_BASE_URL}/payments/create-customer-portal-session`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerId: stripeCustomerId,
            role: "freight",
            carrierId: freightUser?.id || freightUser?.freightId,
            returnUrl:
              Platform.OS === "web"
                ? window.location.href
                : "farm2home://freight/subscription",
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || data.error || !data.url) {
        Alert.alert("Billing Error", data.error || "Unable to open billing portal.");
        return;
      }

      await openUrl(data.url);
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
      freightUser?.subscriptionId;

    if (!subscriptionId) {
      Alert.alert("No Subscription", "No active freight subscription ID was found.");
      return;
    }

    Alert.alert(
      "Cancel Freight Membership",
      "Are you sure you want to cancel your freight membership?",
      [
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

              const data = await response.json();

              if (!response.ok || data.error) {
                Alert.alert("Stripe Error", data.error || "Unable to cancel.");
                return;
              }

              const updatedFreight = {
                ...freightUser,
                membershipStatus: "canceled",
                subscriptionStatus: "canceled",
                hasActiveSubscription: false,
                freightBoardAccess: false,
                accountActive: false,
                updatedAt: new Date().toISOString(),
              };

              await persistFreightUser(updatedFreight, true);

              Alert.alert("Canceled", "Freight subscription was canceled.");
            } catch (error: any) {
              Alert.alert(
                "Cancel Error",
                error?.message || "Unable to cancel subscription."
              );
            } finally {
              setCancelLoading(false);
            }
          },
        },
      ]
    );
  }

  function membershipStatus() {
    return freightUser?.membershipStatus || freightUser?.subscriptionStatus || "not_started";
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

      <KeyboardAvoidingView
        style={styles.page}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
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
                Subscribe to access freight posting, live load board tools,
                route management, carrier dispatch, and logistics support.
              </Text>
            </View>

            <View style={styles.heroIcon}>
              <Ionicons name="card-outline" size={34} color="#FFFFFF" />
            </View>
          </View>

          <View style={styles.priceCard}>
            <Text style={styles.priceLabel}>Monthly Freight Membership</Text>
            <Text style={styles.price}>Freight Access Plan</Text>
            <Text style={styles.priceSub}>
              Production Mode Enabled · Stripe Live Payment Links Active
            </Text>

            <View style={[styles.statusPill, { backgroundColor: statusColor() }]}>
              <Text style={styles.statusPillText}>{membershipStatus()}</Text>
            </View>
          </View>

          <View style={styles.featureBox}>
            <SectionHeader
              icon="sparkles-outline"
              title="Membership Includes"
              subtitle="Carrier tools built for Farm2Home freight operations."
            />

            {[
              "Freight board access",
              "Load posting tools",
              "Delivery tracking",
              "Route and dispatch support",
              "Carrier verification workflow",
              "Farm-to-market logistics opportunities",
              "Freight profile and billing management",
              "Live operations support",
            ].map((item) => (
              <View key={item} style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={18} color={COLORS.green} />
                <Text style={styles.featureText}>{item}</Text>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <SectionHeader
              icon="business-outline"
              title="Billing Profile"
              subtitle="Confirm the freight company and email used for membership billing."
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
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="card-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.primaryButtonText}>
                    Pay Membership with Stripe
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.completedButton}
              onPress={continueAfterPayment}
              activeOpacity={0.85}
            >
              <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
              <Text style={styles.completedButtonText}>I Completed Payment</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={manageBillingPortal}
              disabled={portalLoading}
            >
              {portalLoading ? (
                <ActivityIndicator color={COLORS.red} />
              ) : (
                <>
                  <Ionicons name="settings-outline" size={18} color={COLORS.red} />
                  <Text style={styles.secondaryButtonText}>Manage Billing Portal</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={cancelSubscription}
              disabled={cancelLoading}
            >
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
            <QuickLink icon="grid-outline" label="Dashboard" route="/freight/dashboard" />
            <QuickLink icon="list-outline" label="Load Board" route="/freight/board" />
            <QuickLink icon="business-outline" label="Profile" route="/freight/profile" />
            <QuickLink icon="settings-outline" label="Settings" route="/freight/settings" />
          </View>

          <TouchableOpacity
            style={styles.darkButton}
            onPress={() => router.replace("/freight/login" as any)}
          >
            <Text style={styles.darkButtonText}>Back to Freight Login</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SectionHeader({ icon, title, subtitle }: any) {
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

function QuickLink({ icon, label, route }: any) {
  return (
    <TouchableOpacity style={styles.quickLink} onPress={() => router.push(route as any)}>
      <Ionicons name={icon} size={22} color={COLORS.red} />
      <Text style={styles.quickLinkText}>{label}</Text>
    </TouchableOpacity>
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
    paddingBottom: 90,
  },
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
  title: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "900",
    marginBottom: 10,
  },
  subtitle: {
    color: "#D1D5DB",
    lineHeight: 22,
    fontSize: 14,
    fontWeight: "700",
  },
  priceCard: {
    backgroundColor: COLORS.red,
    borderRadius: 22,
    padding: 18,
    marginHorizontal: 18,
    marginTop: 18,
    marginBottom: 14,
  },
  priceLabel: {
    color: "#FFE4E6",
    fontWeight: "900",
    textTransform: "uppercase",
    fontSize: 12,
  },
  price: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "900",
    marginTop: 5,
  },
  priceSub: {
    color: "#FFE4E6",
    marginTop: 6,
    fontWeight: "800",
    lineHeight: 20,
  },
  statusPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 14,
  },
  statusPillText: {
    color: "#FFFFFF",
    fontWeight: "900",
    textTransform: "capitalize",
  },
  featureBox: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginHorizontal: 18,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    marginBottom: 14,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: COLORS.black,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 21,
    fontWeight: "900",
  },
  sectionSubtitle: {
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 3,
  },
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
  featureText: {
    color: COLORS.text,
    fontWeight: "800",
    flex: 1,
    lineHeight: 20,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 18,
    marginHorizontal: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  inputLabel: {
    color: COLORS.text,
    fontWeight: "900",
    marginBottom: 7,
  },
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
  disabledButton: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 15,
  },
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
  completedButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
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
  secondaryButtonText: {
    color: COLORS.red,
    fontWeight: "900",
  },
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
  cancelButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
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
  quickLinkText: {
    color: COLORS.text,
    fontWeight: "900",
  },
  darkButton: {
    backgroundColor: COLORS.black,
    padding: 15,
    borderRadius: 16,
    alignItems: "center",
    marginHorizontal: 18,
    marginBottom: 40,
  },
  darkButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
});