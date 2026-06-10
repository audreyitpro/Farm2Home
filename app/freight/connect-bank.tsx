// app/freight/connect-bank.tsx

import React, { useCallback, useState } from "react";
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
import * as WebBrowser from "expo-web-browser";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { API_BASE_URL } from "../config/api";
import { supabase } from "../data/supabaseClient";

const COLORS = {
  bg: "#F4F5F7",
  card: "#FFFFFF",
  surface: "#F9FAFB",
  black: "#050505",
  red: "#D71920",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  green: "#16A34A",
  amber: "#D97706",
};

function normalize(value: any) {
  return String(value || "").trim().toLowerCase();
}

export default function FreightConnectBankScreen() {
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [carrier, setCarrier] = useState<any>(null);

  useFocusEffect(
    useCallback(() => {
      loadCarrier();
    }, [])
  );

  async function getStoredCarrier() {
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

  async function persistCarrier(nextCarrier: any) {
    const normalized = {
      ...nextCarrier,
      id: nextCarrier.id || nextCarrier.freightId,
      freightId: nextCarrier.freightId || nextCarrier.id,
      role: "freight",
      email: normalize(nextCarrier.email),
      companyName:
        nextCarrier.companyName ||
        nextCarrier.businessName ||
        nextCarrier.company_name ||
        nextCarrier.business_name ||
        "Farm2Home Freight Carrier",
      businessName:
        nextCarrier.businessName ||
        nextCarrier.companyName ||
        nextCarrier.business_name ||
        nextCarrier.company_name ||
        "Farm2Home Freight Carrier",
    };

    await AsyncStorage.setItem("currentFreight", JSON.stringify(normalized));
    await AsyncStorage.setItem("currentFreightCarrier", JSON.stringify(normalized));
    await AsyncStorage.setItem("currentFreightUser", JSON.stringify(normalized));
    await AsyncStorage.setItem("currentUser", JSON.stringify(normalized));
    await AsyncStorage.setItem("userRole", "freight");
    await AsyncStorage.setItem("currentUserRole", "freight");

    setCarrier(normalized);
    return normalized;
  }

  async function saveStripeAccountToSupabase(accountId: string, status = "created") {
    const freightId = carrier?.id || carrier?.freightId;
    const email = normalize(carrier?.email);

    const payload = {
      stripe_account_id: accountId,
      stripe_connect_status: status,
      updated_at: new Date().toISOString(),
    };

    let saved = false;

    if (freightId) {
      const { error } = await supabase
        .from("freight_users")
        .update(payload)
        .eq("id", freightId);

      if (!error) saved = true;
      else console.log("Save stripe account by id failed:", error.message);
    }

    if (!saved && email) {
      const { error } = await supabase
        .from("freight_users")
        .update(payload)
        .eq("email", email);

      if (error) {
        console.log("Save stripe account by email failed:", error.message);
        throw error;
      }
    }
  }

  async function saveStripeStatusToSupabase({
    accountId,
    payoutsEnabled,
    chargesEnabled,
    onboardingComplete,
  }: {
    accountId: string;
    payoutsEnabled: boolean;
    chargesEnabled: boolean;
    onboardingComplete: boolean;
  }) {
    const freightId = carrier?.id || carrier?.freightId;
    const email = normalize(carrier?.email);

    const payload = {
      stripe_account_id: accountId,
      stripe_connect_status: onboardingComplete ? "complete" : "created",
      payouts_enabled: payoutsEnabled,
      charges_enabled: chargesEnabled,
      stripe_payouts_enabled: payoutsEnabled,
      stripe_charges_enabled: chargesEnabled,
      stripe_onboarding_complete: onboardingComplete,
      updated_at: new Date().toISOString(),
    };

    let saved = false;

    if (freightId) {
      const { error } = await supabase
        .from("freight_users")
        .update(payload)
        .eq("id", freightId);

      if (!error) saved = true;
      else console.log("Save stripe status by id failed:", error.message);
    }

    if (!saved && email) {
      const { error } = await supabase
        .from("freight_users")
        .update(payload)
        .eq("email", email);

      if (error) {
        console.log("Save stripe status by email failed:", error.message);
        throw error;
      }
    }
  }

  async function loadCarrier() {
    try {
      setLoading(true);

      const stored = await getStoredCarrier();
      const { data: authData } = await supabase.auth.getUser();
      const authUser = authData?.user;

      const freightId = stored?.id || stored?.freightId || authUser?.id || "";
      const email = normalize(stored?.email || authUser?.email || "");

      if (!freightId && !email) {
        router.replace("/freight/login" as any);
        return;
      }

      let dbCarrier: any = null;

      if (freightId) {
        const result = await supabase
          .from("freight_users")
          .select("*")
          .eq("id", freightId)
          .maybeSingle();

        if (!result.error && result.data) dbCarrier = result.data;
      }

      if (!dbCarrier && email) {
        const result = await supabase
          .from("freight_users")
          .select("*")
          .eq("email", email)
          .maybeSingle();

        if (!result.error && result.data) dbCarrier = result.data;
      }

      const merged = {
        ...(stored || {}),
        ...(dbCarrier || {}),
        id: dbCarrier?.id || stored?.id || stored?.freightId || authUser?.id || "",
        freightId: dbCarrier?.id || stored?.freightId || stored?.id || authUser?.id || "",
        role: "freight",
        email: normalize(dbCarrier?.email || stored?.email || email),
        companyName:
          dbCarrier?.company_name ||
          dbCarrier?.business_name ||
          stored?.companyName ||
          stored?.businessName ||
          "Farm2Home Freight Carrier",
        businessName:
          dbCarrier?.business_name ||
          dbCarrier?.company_name ||
          stored?.businessName ||
          stored?.companyName ||
          "Farm2Home Freight Carrier",
        stripeAccountId:
          dbCarrier?.stripe_account_id ||
          stored?.stripeAccountId ||
          stored?.stripe_account_id ||
          "",
        stripe_account_id:
          dbCarrier?.stripe_account_id ||
          stored?.stripe_account_id ||
          stored?.stripeAccountId ||
          "",
        stripeConnectStatus:
          dbCarrier?.stripe_connect_status ||
          stored?.stripeConnectStatus ||
          stored?.stripe_connect_status ||
          "not_started",
        stripe_connect_status:
          dbCarrier?.stripe_connect_status ||
          stored?.stripe_connect_status ||
          stored?.stripeConnectStatus ||
          "not_started",
        payoutsEnabled:
          dbCarrier?.payouts_enabled ??
          dbCarrier?.stripe_payouts_enabled ??
          stored?.payoutsEnabled ??
          stored?.payouts_enabled ??
          false,
        payouts_enabled:
          dbCarrier?.payouts_enabled ??
          stored?.payouts_enabled ??
          stored?.payoutsEnabled ??
          false,
        chargesEnabled:
          dbCarrier?.charges_enabled ??
          dbCarrier?.stripe_charges_enabled ??
          stored?.chargesEnabled ??
          stored?.charges_enabled ??
          false,
        charges_enabled:
          dbCarrier?.charges_enabled ??
          stored?.charges_enabled ??
          stored?.chargesEnabled ??
          false,
        onboardingComplete:
          dbCarrier?.stripe_onboarding_complete ??
          stored?.onboardingComplete ??
          stored?.stripe_onboarding_complete ??
          false,
        stripe_onboarding_complete:
          dbCarrier?.stripe_onboarding_complete ??
          stored?.stripe_onboarding_complete ??
          stored?.onboardingComplete ??
          false,
      };

      await persistCarrier(merged);
    } catch (error) {
      console.log("Freight connect bank load error:", error);
      Alert.alert("Connect Bank Error", "Unable to load freight payout setup.");
    } finally {
      setLoading(false);
    }
  }

  async function openUrl(url: string) {
    if (!url || !url.startsWith("http")) {
      Alert.alert("Stripe Error", "Invalid Stripe onboarding URL.");
      return;
    }

    if (Platform.OS === "web") {
      window.location.href = url;
      return;
    }

    await WebBrowser.openBrowserAsync(url);
  }

  async function startConnectBank() {
    if (!carrier) {
      Alert.alert("Profile Missing", "Please log in again.");
      return;
    }

    try {
      setConnecting(true);

      const freightId = carrier.id || carrier.freightId;
      const existingAccountId =
        carrier.stripeAccountId ||
        carrier.stripe_account_id ||
        carrier.accountId ||
        "";

      const response = await fetch(`${API_BASE_URL}/payments/create-freight-connect-account`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          freightId,
          profileId: freightId,
          userId: freightId,
          email: carrier.email,
          companyName: carrier.companyName || carrier.businessName,
          businessName: carrier.businessName || carrier.companyName,
          existingStripeAccountId: existingAccountId,
          stripeAccountId: existingAccountId,
          accountId: existingAccountId,
        }),
      });

      const text = await response.text();

      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { raw: text };
      }

      if (!response.ok || !data.success) {
        Alert.alert("Stripe Error", data.error || data.raw || "Unable to open Stripe onboarding.");
        return;
      }

      const accountId = data.accountId || data.stripeAccountId || existingAccountId;

      if (!accountId) {
        Alert.alert("Stripe Error", "Stripe did not return an account ID.");
        return;
      }

      await saveStripeAccountToSupabase(accountId, "created");

      const updated = {
        ...carrier,
        stripeAccountId: accountId,
        stripe_account_id: accountId,
        accountId,
        stripeConnectStatus: "created",
        stripe_connect_status: "created",
      };

      await persistCarrier(updated);

      await openUrl(data.onboardingUrl || data.url);
    } catch (error: any) {
      console.log("Connect bank error:", error);
      Alert.alert("Connect Bank Error", error?.message || "Unable to start payout setup.");
    } finally {
      setConnecting(false);
    }
  }

  async function checkConnectStatus() {
    if (!carrier) return;

    const accountId =
      carrier.stripeAccountId ||
      carrier.stripe_account_id ||
      carrier.accountId ||
      "";

    if (!accountId) {
      Alert.alert("No Stripe Account", "Start payout setup first.");
      return;
    }

    try {
      setChecking(true);

      const response = await fetch(`${API_BASE_URL}/payments/check-freight-connect-account`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          freightId: carrier.id || carrier.freightId,
          profileId: carrier.id || carrier.freightId,
          userId: carrier.id || carrier.freightId,
          email: carrier.email,
          stripeAccountId: accountId,
          accountId,
        }),
      });

      const text = await response.text();

      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { raw: text };
      }

      if (!response.ok || !data.success) {
        Alert.alert("Status Error", data.error || data.raw || "Unable to check Stripe status.");
        return;
      }

      const finalAccountId = data.accountId || data.stripeAccountId || accountId;

      const payoutsEnabled = Boolean(data.payoutsEnabled);
      const chargesEnabled = Boolean(data.chargesEnabled);
      const onboardingComplete = Boolean(data.onboardingComplete);

      await saveStripeStatusToSupabase({
        accountId: finalAccountId,
        payoutsEnabled,
        chargesEnabled,
        onboardingComplete,
      });

      const updated = {
        ...carrier,
        stripeAccountId: finalAccountId,
        stripe_account_id: finalAccountId,
        accountId: finalAccountId,
        payoutsEnabled,
        payouts_enabled: payoutsEnabled,
        chargesEnabled,
        charges_enabled: chargesEnabled,
        onboardingComplete,
        stripe_onboarding_complete: onboardingComplete,
        stripeConnectStatus: onboardingComplete ? "complete" : "created",
        stripe_connect_status: onboardingComplete ? "complete" : "created",
      };

      await persistCarrier(updated);

      if (payoutsEnabled && chargesEnabled && onboardingComplete) {
        Alert.alert("Payout Setup Complete", "Your freight payout account is ready.");
      } else {
        Alert.alert(
          "Stripe Setup Still Pending",
          "Stripe still requires more information before payouts are enabled."
        );
      }
    } catch (error: any) {
      console.log("Check connect status error:", error);
      Alert.alert("Status Error", error?.message || "Unable to check payout status.");
    } finally {
      setChecking(false);
    }
  }

  function statusColor() {
    if (carrier?.payoutsEnabled && carrier?.chargesEnabled && carrier?.onboardingComplete) {
      return COLORS.green;
    }

    if (carrier?.stripeAccountId || carrier?.stripe_account_id) {
      return COLORS.amber;
    }

    return COLORS.red;
  }

  function statusText() {
    if (carrier?.payoutsEnabled && carrier?.chargesEnabled && carrier?.onboardingComplete) {
      return "Payout Ready";
    }

    if (carrier?.stripeAccountId || carrier?.stripe_account_id) {
      return "Setup Incomplete";
    }

    return "Not Connected";
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.red} />
          <Text style={styles.centerText}>Loading freight bank setup...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Farm2Home Freight Connect</Text>
          <Text style={styles.title}>Connect Bank</Text>
          <Text style={styles.subtitle}>
            Complete Stripe Express onboarding. Farm2Home will permanently reuse your
            saved Stripe Connect account.
          </Text>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Ionicons name="business-outline" size={28} color="#FFFFFF" />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.companyName}>
              {carrier?.companyName || carrier?.businessName || "Freight Carrier"}
            </Text>
            <Text style={styles.companyEmail}>{carrier?.email || "Freight account"}</Text>
          </View>
        </View>

        <View style={styles.statusCard}>
          <View style={styles.statusTop}>
            <View>
              <Text style={styles.statusLabel}>Stripe Payout Status</Text>
              <View style={[styles.statusPill, { backgroundColor: statusColor() }]}>
                <Text style={styles.statusPillText}>{statusText()}</Text>
              </View>
            </View>

            <Ionicons name="card-outline" size={34} color="#FFFFFF" />
          </View>

          <Text style={styles.statusNote}>
            Account ID: {carrier?.stripeAccountId || carrier?.stripe_account_id || "Not created yet"}
          </Text>
        </View>

        <View style={styles.card}>
          <SectionHeader
            icon="shield-checkmark-outline"
            title="Permanent Stripe Setup"
            subtitle="One freight profile uses one permanent Stripe Connect account."
          />

          <InfoRow
            label="Stripe Account"
            value={carrier?.stripeAccountId || carrier?.stripe_account_id ? "Saved" : "Missing"}
            good={Boolean(carrier?.stripeAccountId || carrier?.stripe_account_id)}
          />

          <InfoRow
            label="Onboarding"
            value={carrier?.onboardingComplete ? "Complete" : "Required"}
            good={Boolean(carrier?.onboardingComplete)}
          />

          <InfoRow
            label="Charges Enabled"
            value={carrier?.chargesEnabled ? "Enabled" : "Pending"}
            good={Boolean(carrier?.chargesEnabled)}
          />

          <InfoRow
            label="Payouts Enabled"
            value={carrier?.payoutsEnabled ? "Enabled" : "Pending"}
            good={Boolean(carrier?.payoutsEnabled)}
          />
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, connecting && styles.disabledButton]}
          onPress={startConnectBank}
          disabled={connecting}
        >
          {connecting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="open-outline" size={18} color="#FFFFFF" />
              <Text style={styles.buttonText}>
                {carrier?.stripeAccountId || carrier?.stripe_account_id
                  ? "Continue Stripe Setup"
                  : "Start Stripe Payout Setup"}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryButton, checking && styles.disabledButton]}
          onPress={checkConnectStatus}
          disabled={checking}
        >
          {checking ? (
            <ActivityIndicator color={COLORS.red} />
          ) : (
            <>
              <Ionicons name="refresh-outline" size={18} color={COLORS.red} />
              <Text style={styles.secondaryButtonText}>Check Payout Status</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.quickGrid}>
          <QuickLink icon="grid-outline" label="Dashboard" route="/freight/dashboard" />
          <QuickLink icon="list-outline" label="Load Board" route="/freight/board" />
          <QuickLink icon="business-outline" label="Profile" route="/freight/profile" />
          <QuickLink icon="settings-outline" label="Settings" route="/freight/settings" />
        </View>
      </ScrollView>
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

function InfoRow({ label, value, good }: any) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <View style={[styles.infoBadge, { backgroundColor: good ? COLORS.green : COLORS.amber }]}>
        <Text style={styles.infoBadgeText}>{value}</Text>
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
  safe: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingBottom: 90 },
  center: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  centerText: { color: COLORS.muted, marginTop: 12, fontWeight: "800" },
  hero: {
    backgroundColor: COLORS.black,
    paddingTop: 30,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  eyebrow: {
    color: "#FCA5A5",
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
    fontSize: 12,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "900",
    marginTop: 6,
  },
  subtitle: {
    color: "#D1D5DB",
    marginTop: 8,
    lineHeight: 22,
    fontWeight: "700",
  },
  profileCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 16,
    marginHorizontal: 18,
    marginTop: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: COLORS.red,
    alignItems: "center",
    justifyContent: "center",
  },
  companyName: { color: COLORS.text, fontSize: 19, fontWeight: "900" },
  companyEmail: { color: COLORS.muted, fontWeight: "700", marginTop: 4 },
  statusCard: {
    backgroundColor: COLORS.red,
    borderRadius: 22,
    padding: 18,
    marginHorizontal: 18,
    marginBottom: 16,
  },
  statusTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusLabel: {
    color: "#FFE4E6",
    fontWeight: "900",
    textTransform: "uppercase",
    fontSize: 12,
  },
  statusPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    marginTop: 8,
  },
  statusPillText: { color: "#FFFFFF", fontWeight: "900" },
  statusNote: {
    color: "#FFE4E6",
    fontWeight: "800",
    marginTop: 14,
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
  sectionTitle: { color: COLORS.text, fontSize: 21, fontWeight: "900" },
  sectionSubtitle: {
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 3,
  },
  infoRow: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 13,
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  infoLabel: { color: COLORS.text, fontWeight: "900", flex: 1 },
  infoBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  infoBadgeText: { color: "#FFFFFF", fontWeight: "900", fontSize: 12 },
  primaryButton: {
    backgroundColor: COLORS.red,
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 18,
    flexDirection: "row",
    gap: 8,
  },
  secondaryButton: {
    backgroundColor: "#FFF1F2",
    borderWidth: 1,
    borderColor: COLORS.red,
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 18,
    marginTop: 12,
    marginBottom: 16,
    flexDirection: "row",
    gap: 8,
  },
  disabledButton: { opacity: 0.65 },
  buttonText: { color: "#FFFFFF", fontWeight: "900" },
  secondaryButtonText: { color: COLORS.red, fontWeight: "900" },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 18,
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
  quickLinkText: { color: COLORS.text, fontWeight: "900" },
});