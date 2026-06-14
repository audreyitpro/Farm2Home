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

const ROUTES = {
  dashboard: "/freight/dashboard",
  board: "/freight/board",
  liveLoads: "/freight/live-loads",
  myLoads: "/freight/my-loads",
  subscription: "/freight/subscription",
  profile: "/freight/profile",
  settings: "/freight/settings",
  support: "/freight/support",
  help: "/freight/help",
  login: "/freight/login",
  register: "/freight/register",
} as const;

type FreightRoute = (typeof ROUTES)[keyof typeof ROUTES];

const COLORS = {
  bg: "#F3F4F6",
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

function goTo(route: FreightRoute) {
  router.push(route as any);
}

async function saveFreightSession(carrier: any) {
  await AsyncStorage.setItem("currentFreight", JSON.stringify(carrier));
  await AsyncStorage.setItem("currentFreightCarrier", JSON.stringify(carrier));
  await AsyncStorage.setItem("currentFreightUser", JSON.stringify(carrier));
  await AsyncStorage.setItem("currentUser", JSON.stringify(carrier));
  await AsyncStorage.setItem("userRole", "freight");
  await AsyncStorage.setItem("currentUserRole", "freight");
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
    const realId = nextCarrier.id || nextCarrier.freightId || nextCarrier.freight_id;

    const normalized = {
      ...nextCarrier,
      id: realId,
      freightId: realId,
      freight_id: realId,
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
      accountId: nextCarrier.accountId || nextCarrier.account_id || "",
      account_id: nextCarrier.account_id || nextCarrier.accountId || "",
      stripeAccountId:
        nextCarrier.stripeAccountId || nextCarrier.stripe_account_id || "",
      stripe_account_id:
        nextCarrier.stripe_account_id || nextCarrier.stripeAccountId || "",
      stripeConnectStatus:
        nextCarrier.stripeConnectStatus ||
        nextCarrier.stripe_connect_status ||
        "not_started",
      stripe_connect_status:
        nextCarrier.stripe_connect_status ||
        nextCarrier.stripeConnectStatus ||
        "not_started",
      payoutsEnabled:
        nextCarrier.payoutsEnabled ??
        nextCarrier.payouts_enabled ??
        nextCarrier.stripe_payouts_enabled ??
        false,
      payouts_enabled:
        nextCarrier.payouts_enabled ??
        nextCarrier.payoutsEnabled ??
        nextCarrier.stripe_payouts_enabled ??
        false,
      chargesEnabled:
        nextCarrier.chargesEnabled ??
        nextCarrier.charges_enabled ??
        nextCarrier.stripe_charges_enabled ??
        false,
      charges_enabled:
        nextCarrier.charges_enabled ??
        nextCarrier.chargesEnabled ??
        nextCarrier.stripe_charges_enabled ??
        false,
      onboardingComplete:
        nextCarrier.onboardingComplete ??
        nextCarrier.stripe_onboarding_complete ??
        false,
      stripe_onboarding_complete:
        nextCarrier.stripe_onboarding_complete ??
        nextCarrier.onboardingComplete ??
        false,
    };

    await saveFreightSession(normalized);
    setCarrier(normalized);
    return normalized;
  }

  async function loadCarrier() {
    try {
      setLoading(true);

      const stored = await getStoredCarrier();
      const { data: authData } = await supabase.auth.getUser();

      const email = normalize(stored?.email || authData?.user?.email || "");

      if (!email) {
        router.replace(ROUTES.login as any);
        return;
      }

      const { data: dbCarrier, error } = await supabase
        .from("freight_users")
        .select("*")
        .eq("email", email)
        .maybeSingle();

      if (error) {
        console.log("Freight connect bank profile load error:", error.message);
      }

      if (!dbCarrier) {
        Alert.alert(
          "Freight Profile Missing",
          "No freight profile was found. Please complete freight registration first."
        );
        router.replace(ROUTES.register as any);
        return;
      }

      await persistCarrier({
        ...(stored || {}),
        ...(dbCarrier || {}),
        id: dbCarrier.id,
        freightId: dbCarrier.freight_id || dbCarrier.id,
        freight_id: dbCarrier.freight_id || dbCarrier.id,
        email: normalize(dbCarrier.email || email),
      });
    } catch (error) {
      console.log("Freight connect bank load error:", error);
      Alert.alert("Connect Bank Error", "Unable to load freight payout setup.");
    } finally {
      setLoading(false);
    }
  }

  async function updateSupabaseConnectStatus(payload: any) {
    const freightId = carrier?.id || carrier?.freightId || carrier?.freight_id;
    const email = normalize(carrier?.email);

    if (!freightId && !email) {
      throw new Error("Missing freight profile identity.");
    }

    const updatePayload = {
      ...payload,
      updated_at: new Date().toISOString(),
    };

    let query = supabase.from("freight_users").update(updatePayload);

    if (freightId) {
      query = query.eq("id", freightId);
    } else {
      query = query.eq("email", email);
    }

    const { error } = await query;
    if (error) throw error;

    if (freightId) {
      await supabase
        .from("profiles")
        .update(updatePayload)
        .or(`id.eq.${freightId},auth_user_id.eq.${freightId},profile_id.eq.${freightId}`);

      await supabase
        .from("admin_verifications")
        .update(updatePayload)
        .or(`id.eq.${freightId},freight_id.eq.${freightId},profile_id.eq.${freightId}`);
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

      const freightId = carrier.id || carrier.freightId || carrier.freight_id;
      const staticAccountId = carrier.accountId || carrier.account_id || "";
      const existingStripeAccountId =
        carrier.stripeAccountId || carrier.stripe_account_id || "";

      if (!freightId) {
        Alert.alert("Profile ID Error", "Missing freight Supabase UUID.");
        return;
      }

      const response = await fetch(`${API_BASE_URL}/payments/create-connect-account`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "freight",
          userId: freightId,
          freightId,
          freight_id: freightId,
          accountId: staticAccountId,
          account_id: staticAccountId,
          email: carrier.email,
          companyName: carrier.companyName || carrier.businessName,
          businessName: carrier.businessName || carrier.companyName,
          name: carrier.companyName || carrier.businessName,
          stripeAccountId: existingStripeAccountId,
          stripe_account_id: existingStripeAccountId,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        Alert.alert("Stripe Error", data.error || "Unable to open Stripe onboarding.");
        return;
      }

      const accountId =
        data.stripeAccountId ||
        data.stripe_account_id ||
        data.accountId ||
        existingStripeAccountId;

      if (!accountId) {
        Alert.alert("Stripe Error", "Stripe did not return an acct_ account ID.");
        return;
      }

      await updateSupabaseConnectStatus({
        stripe_account_id: accountId,
        stripe_connect_status: "created",
        payouts_enabled: false,
        charges_enabled: false,
        stripe_payouts_enabled: false,
        stripe_charges_enabled: false,
        stripe_onboarding_complete: false,
      });

      const updated = await persistCarrier({
        ...carrier,
        stripeAccountId: accountId,
        stripe_account_id: accountId,
        stripeConnectStatus: "created",
        stripe_connect_status: "created",
        payoutsEnabled: false,
        payouts_enabled: false,
        chargesEnabled: false,
        charges_enabled: false,
        onboardingComplete: false,
        stripe_onboarding_complete: false,
      });

      setCarrier(updated);

      await openUrl(data.url || data.onboardingUrl);
    } catch (error: any) {
      console.log("Connect bank error:", error);
      Alert.alert("Connect Bank Error", error?.message || "Unable to start payout setup.");
    } finally {
      setConnecting(false);
    }
  }

  async function checkConnectStatus() {
    if (!carrier) return;

    const accountId = carrier.stripeAccountId || carrier.stripe_account_id || "";

    if (!accountId) {
      Alert.alert("No Stripe Account", "Start payout setup first.");
      return;
    }

    try {
      setChecking(true);

      await loadCarrier();

      const refreshed = await getStoredCarrier();
      const payoutsEnabled = Boolean(refreshed?.payouts_enabled || refreshed?.payoutsEnabled);
      const chargesEnabled = Boolean(refreshed?.charges_enabled || refreshed?.chargesEnabled);
      const onboardingComplete = Boolean(
        refreshed?.stripe_onboarding_complete || refreshed?.onboardingComplete
      );

      if (payoutsEnabled && chargesEnabled && onboardingComplete) {
        Alert.alert("Payout Setup Complete", "Your freight payout account is ready.");
      } else {
        Alert.alert(
          "Stripe Setup Pending",
          "If you just finished Stripe onboarding, wait a moment and tap Check Payout Status again."
        );
      }
    } catch (error: any) {
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
          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>Farm2Home Freight</Text>
              <Text style={styles.title}>Connect Bank</Text>
              <Text style={styles.subtitle}>
                Complete Stripe Express onboarding. Existing acct_ accounts are reused permanently.
              </Text>
            </View>

            <TouchableOpacity style={styles.heroIcon} onPress={() => goTo(ROUTES.dashboard)}>
              <Ionicons name="grid-outline" size={30} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
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
            Stripe Account ID: {carrier?.stripeAccountId || carrier?.stripe_account_id || "Not created yet"}
          </Text>
        </View>

        <View style={styles.card}>
          <SectionHeader
            icon="shield-checkmark-outline"
            title="Permanent Stripe Connect Setup"
            subtitle="One freight profile uses one saved Stripe Connect acct_ account."
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
              <Text style={styles.secondaryButtonText}>Reload Payout Status</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.quickGrid}>
          <QuickLink icon="grid-outline" label="Dashboard" route={ROUTES.dashboard} />
          <QuickLink icon="list-outline" label="Load Board" route={ROUTES.board} />
          <QuickLink icon="briefcase-outline" label="My Loads" route={ROUTES.myLoads} />
          <QuickLink icon="pulse-outline" label="Live Loads" route={ROUTES.liveLoads} />
          <QuickLink icon="card-outline" label="Subscription" route={ROUTES.subscription} />
          <QuickLink icon="business-outline" label="Profile" route={ROUTES.profile} />
          <QuickLink icon="settings-outline" label="Settings" route={ROUTES.settings} />
          <QuickLink icon="headset-outline" label="Support" route={ROUTES.support} />
          <QuickLink icon="help-circle-outline" label="Help" route={ROUTES.help} />
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

function QuickLink({
  icon,
  label,
  route,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  route: FreightRoute;
}) {
  return (
    <TouchableOpacity style={styles.quickLink} onPress={() => goTo(route)}>
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
  heroTop: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  heroIcon: {
    width: 54,
    height: 54,
    borderRadius: 20,
    backgroundColor: COLORS.red,
    alignItems: "center",
    justifyContent: "center",
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
  quickLinkText: { color: COLORS.text, fontWeight: "900", textAlign: "center" },
});