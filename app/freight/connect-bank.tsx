// app/freight/connect-bank.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
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
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../data/supabaseClient";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  "https://farm2home-production-e4bd.up.railway.app";

const APP_URL =
  process.env.EXPO_PUBLIC_APP_URL || "https://farm2home-rho.vercel.app";

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

type Carrier = {
  id?: string;
  freightId?: string;
  freight_id?: string;
  accountId?: string;
  account_id?: string;
  role?: string;
  email?: string;
  companyName?: string;
  company_name?: string;
  businessName?: string;
  business_name?: string;
  contactName?: string;
  contact_name?: string;
  phone?: string;
  username?: string;
  stripeCustomerId?: string;
  stripe_customer_id?: string;
  stripeSubscriptionId?: string;
  stripe_subscription_id?: string;
  subscriptionId?: string;
  subscription_id?: string;
  freightAccount?: string;
  freight_account?: string;
  stripeAccountId?: string;
  stripe_account_id?: string;
  stripeConnectStatus?: string;
  stripe_connect_status?: string;
  payoutsEnabled?: boolean;
  payouts_enabled?: boolean;
  stripe_payouts_enabled?: boolean;
  chargesEnabled?: boolean;
  charges_enabled?: boolean;
  stripe_charges_enabled?: boolean;
  onboardingComplete?: boolean;
  stripe_onboarding_complete?: boolean;
  [key: string]: any;
};

const COLORS = {
  bg: "#F3F4F6",
  card: "#FFFFFF",
  surface: "#F9FAFB",
  black: "#050505",
  red: "#D71920",
  redSoft: "#FFF1F2",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  green: "#16A34A",
  amber: "#D97706",
  blue: "#2563EB",
};

function clean(value: any) {
  return String(value || "").trim();
}

function normalize(value: any) {
  return clean(value).toLowerCase();
}

function isAcct(value: any) {
  return clean(value).startsWith("acct_");
}

function pickAcct(...values: any[]) {
  const found = values.find((value) => isAcct(value));
  return found ? clean(found) : "";
}

function isCus(value: any) {
  return clean(value).startsWith("cus_");
}

function pickCus(...values: any[]) {
  const found = values.find((value) => isCus(value));
  return found ? clean(found) : "";
}

function isSub(value: any) {
  return clean(value).startsWith("sub_");
}

function pickSub(...values: any[]) {
  const found = values.find((value) => isSub(value));
  return found ? clean(found) : "";
}

function boolValue(...values: any[]) {
  const found = values.find((value) => value !== undefined && value !== null);
  return Boolean(found);
}

async function parseApiResponse(response: Response) {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { success: false, error: text || "Invalid backend response." };
  }
}

function goTo(route: FreightRoute) {
  router.push(route as any);
}

async function saveFreightSession(carrier: Carrier) {
  await AsyncStorage.setItem("currentFreight", JSON.stringify(carrier));
  await AsyncStorage.setItem("currentFreightCarrier", JSON.stringify(carrier));
  await AsyncStorage.setItem("currentFreightUser", JSON.stringify(carrier));
  await AsyncStorage.setItem("farm2homeCurrentFreight", JSON.stringify(carrier));
  await AsyncStorage.setItem("currentUser", JSON.stringify(carrier));
  await AsyncStorage.setItem("userRole", "freight");
  await AsyncStorage.setItem("currentUserRole", "freight");
}

export default function FreightConnectBankScreen() {
  const params = useLocalSearchParams();

  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [carrier, setCarrier] = useState<Carrier | null>(null);

  const freightAccount = useMemo(() => currentFreightAccount(carrier), [carrier]);

  const payoutsReady = useMemo(() => {
    return Boolean(
      carrier?.payoutsEnabled ||
        carrier?.payouts_enabled ||
        carrier?.stripe_payouts_enabled
    );
  }, [carrier]);

  const chargesReady = useMemo(() => {
    return Boolean(
      carrier?.chargesEnabled ||
        carrier?.charges_enabled ||
        carrier?.stripe_charges_enabled
    );
  }, [carrier]);

  const onboardingReady = useMemo(() => {
    return Boolean(carrier?.onboardingComplete || carrier?.stripe_onboarding_complete);
  }, [carrier]);

  useFocusEffect(
    useCallback(() => {
      loadCarrier();

      const connected = clean(params?.connected);
      const refresh = clean(params?.refresh);

      if (connected === "true" || refresh === "true") {
        setTimeout(() => {
          checkConnectStatus(true);
        }, 600);
      }
    }, [params?.connected, params?.refresh, params?.freightId])
  );

  async function getStoredCarrier() {
    const raw =
      (await AsyncStorage.getItem("currentFreightCarrier")) ||
      (await AsyncStorage.getItem("currentFreight")) ||
      (await AsyncStorage.getItem("currentFreightUser")) ||
      (await AsyncStorage.getItem("farm2homeCurrentFreight")) ||
      (await AsyncStorage.getItem("currentUser"));

    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async function persistCarrier(nextCarrier: Carrier) {
    const realId = clean(
      nextCarrier.id ||
        nextCarrier.freightId ||
        nextCarrier.freight_id ||
        nextCarrier.auth_user_id ||
        nextCarrier.profile_id
    );

    const accountId = clean(nextCarrier.accountId || nextCarrier.account_id || "");

    const freightConnectAccount = pickAcct(
      nextCarrier.freight_account,
      nextCarrier.freightAccount,
      nextCarrier.stripe_account_id,
      nextCarrier.stripeAccountId
    );

    const stripeCustomerId = pickCus(
      nextCarrier.stripe_customer_id,
      nextCarrier.stripeCustomerId
    );

    const stripeSubscriptionId = pickSub(
      nextCarrier.stripe_subscription_id,
      nextCarrier.subscription_id,
      nextCarrier.stripeSubscriptionId,
      nextCarrier.subscriptionId
    );

    const payoutsEnabled = boolValue(
      nextCarrier.payouts_enabled,
      nextCarrier.payoutsEnabled,
      nextCarrier.stripe_payouts_enabled
    );

    const chargesEnabled = boolValue(
      nextCarrier.charges_enabled,
      nextCarrier.chargesEnabled,
      nextCarrier.stripe_charges_enabled
    );

    const onboardingComplete = boolValue(
      nextCarrier.stripe_onboarding_complete,
      nextCarrier.onboardingComplete
    );

    const normalized: Carrier = {
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
      company_name:
        nextCarrier.company_name ||
        nextCarrier.companyName ||
        nextCarrier.business_name ||
        nextCarrier.businessName ||
        "Farm2Home Freight Carrier",
      businessName:
        nextCarrier.businessName ||
        nextCarrier.companyName ||
        nextCarrier.business_name ||
        nextCarrier.company_name ||
        "Farm2Home Freight Carrier",
      business_name:
        nextCarrier.business_name ||
        nextCarrier.businessName ||
        nextCarrier.company_name ||
        nextCarrier.companyName ||
        "Farm2Home Freight Carrier",
      accountId,
      account_id: accountId,
      stripeCustomerId,
      stripe_customer_id: stripeCustomerId,
      stripeSubscriptionId,
      stripe_subscription_id: stripeSubscriptionId,
      subscriptionId: stripeSubscriptionId,
      subscription_id: stripeSubscriptionId,
      freightAccount: freightConnectAccount,
      freight_account: freightConnectAccount,
      stripeAccountId: freightConnectAccount,
      stripe_account_id: freightConnectAccount,
      stripeConnectStatus:
        nextCarrier.stripeConnectStatus ||
        nextCarrier.stripe_connect_status ||
        (freightConnectAccount ? "started" : "not_started"),
      stripe_connect_status:
        nextCarrier.stripe_connect_status ||
        nextCarrier.stripeConnectStatus ||
        (freightConnectAccount ? "started" : "not_started"),
      payoutsEnabled,
      payouts_enabled: payoutsEnabled,
      stripe_payouts_enabled: payoutsEnabled,
      chargesEnabled,
      charges_enabled: chargesEnabled,
      stripe_charges_enabled: chargesEnabled,
      onboardingComplete,
      stripe_onboarding_complete: onboardingComplete,
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

      const authId = clean(authData?.user?.id);
      const paramFreightId = clean(params?.freightId || params?.freight_id);
      const storedId = clean(stored?.id || stored?.freightId || stored?.freight_id);
      const email = normalize(stored?.email || authData?.user?.email || "");
      const staticAccountId = clean(stored?.accountId || stored?.account_id || "");

      if (!email && !authId && !storedId && !staticAccountId && !paramFreightId) {
        router.replace(ROUTES.login as any);
        return;
      }

      const filters = [
        paramFreightId ? `id.eq.${paramFreightId}` : "",
        paramFreightId ? `freight_id.eq.${paramFreightId}` : "",
        storedId ? `id.eq.${storedId}` : "",
        storedId ? `freight_id.eq.${storedId}` : "",
        authId ? `id.eq.${authId}` : "",
        authId ? `auth_user_id.eq.${authId}` : "",
        authId ? `profile_id.eq.${authId}` : "",
        email ? `email.eq.${email}` : "",
        staticAccountId ? `account_id.eq.${staticAccountId}` : "",
      ]
        .filter(Boolean)
        .join(",");

      const { data: dbRows, error } = await supabase
        .from("freight_users")
        .select("*")
        .or(filters)
        .limit(1);

      if (error) {
        console.log("Freight connect bank profile load error:", error.message);
      }

      const dbCarrier = Array.isArray(dbRows) && dbRows.length > 0 ? dbRows[0] : null;

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

  async function updateSupabaseConnectStatus(payload: any, sourceCarrier?: Carrier | null) {
    const activeCarrier = sourceCarrier || carrier;
    const freightId = clean(
      activeCarrier?.id || activeCarrier?.freightId || activeCarrier?.freight_id
    );
    const email = normalize(activeCarrier?.email);

    if (!freightId && !email) {
      throw new Error("Missing freight profile identity.");
    }

    const freightConnectAccount = pickAcct(
      payload.freight_account,
      payload.stripe_account_id,
      activeCarrier?.freight_account,
      activeCarrier?.freightAccount,
      activeCarrier?.stripe_account_id,
      activeCarrier?.stripeAccountId
    );

    const updatePayload = {
      ...payload,
      freight_account: freightConnectAccount || null,
      stripe_account_id: freightConnectAccount || null,
      stripe_connect_status:
        payload.stripe_connect_status || (freightConnectAccount ? "started" : "not_started"),
      updated_at: new Date().toISOString(),
    };

    let freightQuery = supabase.from("freight_users").update(updatePayload);

    if (freightId) {
      freightQuery = freightQuery.or(
        `id.eq.${freightId},freight_id.eq.${freightId},auth_user_id.eq.${freightId},profile_id.eq.${freightId}`
      );
    } else {
      freightQuery = freightQuery.eq("email", email);
    }

    const { error } = await freightQuery;
    if (error) throw error;

    if (freightId) {
      await supabase
        .from("profiles")
        .update(updatePayload)
        .or(`id.eq.${freightId},auth_user_id.eq.${freightId},profile_id.eq.${freightId}`);

      await supabase
        .from("admin_verifications")
        .update(updatePayload)
        .or(`id.eq.${freightId},freight_id.eq.${freightId},carrier_id.eq.${freightId},profile_id.eq.${freightId}`);

      await supabase
        .from("freight_subscriptions")
        .update({
          freight_account: freightConnectAccount || null,
          stripe_account_id: freightConnectAccount || null,
          updated_at: new Date().toISOString(),
        })
        .or(`freight_id.eq.${freightId},freight_email.eq.${email}`);
    } else if (email) {
      await supabase
        .from("freight_subscriptions")
        .update({
          freight_account: freightConnectAccount || null,
          stripe_account_id: freightConnectAccount || null,
          updated_at: new Date().toISOString(),
        })
        .eq("freight_email", email);
    }
  }

  async function openStripeUrl(url: string) {
    const finalUrl = clean(url);

    if (!finalUrl || !finalUrl.startsWith("https://connect.stripe.com/")) {
      Alert.alert("Stripe Error", "No valid Stripe Connect onboarding URL was returned.");
      return;
    }

    if (Platform.OS === "web") {
      globalThis.location.assign(finalUrl);
      return;
    }

    try {
      const supported = await Linking.canOpenURL(finalUrl);

      if (supported) {
        await Linking.openURL(finalUrl);
        return;
      }

      await WebBrowser.openBrowserAsync(finalUrl);
    } catch {
      await WebBrowser.openBrowserAsync(finalUrl);
    }
  }

  async function startConnectBank() {
    if (!carrier) {
      Alert.alert("Profile Missing", "Please log in again.");
      return;
    }

    try {
      setConnecting(true);

      const freightId = clean(carrier.id || carrier.freightId || carrier.freight_id);
      const staticAccountId = clean(carrier.accountId || carrier.account_id || "");
      const existingFreightAccount = currentFreightAccount(carrier);
      const email = normalize(carrier.email);

      if (!freightId) {
        Alert.alert("Profile ID Error", "Missing freight Supabase UUID.");
        return;
      }

      if (!email) {
        Alert.alert("Email Missing", "Your freight profile is missing an email address.");
        return;
      }

      const returnUrl = `${APP_URL}/freight/connect-bank?connected=true&freightId=${encodeURIComponent(
        freightId
      )}`;

      const refreshUrl = `${APP_URL}/freight/connect-bank?refresh=true&freightId=${encodeURIComponent(
        freightId
      )}`;

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
          email,
          freight_email: email,
          companyName: carrier.companyName || carrier.businessName || carrier.company_name,
          businessName: carrier.businessName || carrier.companyName || carrier.business_name,
          business_name: carrier.businessName || carrier.companyName || carrier.business_name,
          name: carrier.companyName || carrier.businessName || carrier.company_name,
          contactName: carrier.contactName || carrier.contact_name || "",
          phone: carrier.phone || "",
          username: normalize(carrier.username),
          freight_account: existingFreightAccount || undefined,
          stripe_account_id: existingFreightAccount || undefined,
          returnUrl,
          return_url: returnUrl,
          refreshUrl,
          refresh_url: refreshUrl,
          metadata: {
            role: "freight",
            userId: freightId,
            freightId,
            freight_id: freightId,
            accountId: staticAccountId,
            account_id: staticAccountId,
            email,
            freight_email: email,
          },
        }),
      });

      const data = await parseApiResponse(response);

      if (!response.ok || !data.success) {
        Alert.alert("Stripe Error", data.error || "Unable to open Stripe onboarding.");
        return;
      }

      const newFreightAccount = pickAcct(
        data.freight_account,
        data.account,
        data.connectedAccountId,
        data.connected_account_id,
        data.stripeAccountId,
        data.stripe_account_id,
        existingFreightAccount
      );

      if (!newFreightAccount) {
        Alert.alert("Stripe Error", "Stripe did not return an acct_ account ID.");
        return;
      }

      const onboardingUrl = clean(data.url || data.onboardingUrl || data.onboarding_url);

      if (!onboardingUrl) {
        Alert.alert("Stripe Error", "Backend did not return a Stripe onboarding URL.");
        return;
      }

      const statusUpdate = {
        freight_account: newFreightAccount,
        stripe_account_id: newFreightAccount,
        stripe_connect_status: "started",
        payouts_enabled: Boolean(data.payoutsEnabled || data.payouts_enabled),
        charges_enabled: Boolean(data.chargesEnabled || data.charges_enabled),
        stripe_payouts_enabled: Boolean(data.payoutsEnabled || data.payouts_enabled),
        stripe_charges_enabled: Boolean(data.chargesEnabled || data.charges_enabled),
        stripe_onboarding_complete: Boolean(
          data.onboardingComplete || data.onboarding_complete || data.stripe_onboarding_complete
        ),
      };

      await updateSupabaseConnectStatus(statusUpdate, carrier);

      const updated = await persistCarrier({
        ...carrier,
        ...statusUpdate,
        freightAccount: newFreightAccount,
        stripeAccountId: newFreightAccount,
        payoutsEnabled: statusUpdate.payouts_enabled,
        chargesEnabled: statusUpdate.charges_enabled,
        onboardingComplete: statusUpdate.stripe_onboarding_complete,
      });

      setCarrier(updated);

      await openStripeUrl(onboardingUrl);
    } catch (error: any) {
      console.log("Connect bank error:", error);
      Alert.alert("Connect Bank Error", error?.message || "Unable to start payout setup.");
    } finally {
      setConnecting(false);
    }
  }

  async function checkConnectStatus(silent = false) {
    const activeCarrier = carrier || (await getStoredCarrier());

    if (!activeCarrier) {
      if (!silent) Alert.alert("Profile Missing", "Please log in again.");
      return;
    }

    const activeFreightAccount = currentFreightAccount(activeCarrier);
    const freightId = clean(activeCarrier.id || activeCarrier.freightId || activeCarrier.freight_id);
    const email = normalize(activeCarrier.email);

    if (!activeFreightAccount) {
      if (!silent) Alert.alert("No Stripe Account", "Start payout setup first.");
      return;
    }

    try {
      setChecking(true);

      let updatedFromBackend: any = null;

      try {
        const response = await fetch(`${API_BASE_URL}/payments/check-connect-account`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: "freight",
            userId: freightId,
            freightId,
            freight_id: freightId,
            email,
            freight_email: email,
            accountId: activeCarrier.accountId || activeCarrier.account_id || "",
            account_id: activeCarrier.accountId || activeCarrier.account_id || "",
            freight_account: activeFreightAccount,
            stripe_account_id: activeFreightAccount,
          }),
        });

        const data = await parseApiResponse(response);

        if (response.ok && data.success) {
          const returnedAccount = pickAcct(
            data.freight_account,
            data.stripeAccountId,
            data.stripe_account_id,
            data.account,
            activeFreightAccount
          );

          updatedFromBackend = {
            freight_account: returnedAccount,
            stripe_account_id: returnedAccount,
            stripe_connect_status:
              data.stripeConnectStatus ||
              data.stripe_connect_status ||
              (returnedAccount ? "started" : "not_started"),
            payouts_enabled: Boolean(data.payoutsEnabled || data.payouts_enabled),
            charges_enabled: Boolean(data.chargesEnabled || data.charges_enabled),
            stripe_payouts_enabled: Boolean(data.payoutsEnabled || data.payouts_enabled),
            stripe_charges_enabled: Boolean(data.chargesEnabled || data.charges_enabled),
            stripe_onboarding_complete: Boolean(
              data.onboardingComplete || data.onboarding_complete || data.stripe_onboarding_complete
            ),
          };

          await updateSupabaseConnectStatus(updatedFromBackend, activeCarrier);
        }
      } catch (backendError) {
        console.log("Connect account backend check skipped:", backendError);
      }

      await loadCarrier();

      const refreshed = await getStoredCarrier();
      const merged = await persistCarrier({
        ...(refreshed || activeCarrier),
        ...(updatedFromBackend || {}),
      });

      const ready =
        Boolean(merged.payouts_enabled || merged.payoutsEnabled) &&
        Boolean(merged.charges_enabled || merged.chargesEnabled) &&
        Boolean(merged.stripe_onboarding_complete || merged.onboardingComplete);

      if (!silent) {
        if (ready) {
          Alert.alert("Payout Setup Complete", "Your freight payout account is ready.");
        } else {
          Alert.alert(
            "Stripe Setup Pending",
            "If you just finished Stripe onboarding, wait a moment and tap Reload Payout Status again."
          );
        }
      }
    } catch (error: any) {
      if (!silent) {
        Alert.alert("Status Error", error?.message || "Unable to check payout status.");
      }
    } finally {
      setChecking(false);
    }
  }

  function statusColor() {
    if (payoutsReady && chargesReady && onboardingReady) {
      return COLORS.green;
    }

    if (freightAccount) {
      return COLORS.amber;
    }

    return COLORS.red;
  }

  function statusText() {
    if (payoutsReady && chargesReady && onboardingReady) {
      return "Payout Ready";
    }

    if (freightAccount) {
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
                Complete Stripe Express onboarding. Your saved Stripe acct_ ID is reused instead
                of creating duplicate payout accounts.
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
            <Text style={styles.accountId}>
              Account ID: {carrier?.accountId || carrier?.account_id || "Not assigned"}
            </Text>
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
            Stripe Connect Account ID: {freightAccount || "Not created yet"}
          </Text>
        </View>

        <View style={styles.card}>
          <SectionHeader
            icon="shield-checkmark-outline"
            title="Permanent Stripe Connect Setup"
            subtitle="This page saves freight_account and stripe_account_id to freight_users, profiles, admin_verifications, and freight_subscriptions."
          />

          <InfoRow
            label="Stripe Connect Account"
            value={freightAccount ? "Saved" : "Missing"}
            good={Boolean(freightAccount)}
          />
          <InfoRow
            label="Onboarding"
            value={onboardingReady ? "Complete" : "Required"}
            good={onboardingReady}
          />
          <InfoRow
            label="Charges Enabled"
            value={chargesReady ? "Enabled" : "Pending"}
            good={chargesReady}
          />
          <InfoRow
            label="Payouts Enabled"
            value={payoutsReady ? "Enabled" : "Pending"}
            good={payoutsReady}
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
                {freightAccount ? "Continue Stripe Setup" : "Start Stripe Payout Setup"}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryButton, checking && styles.disabledButton]}
          onPress={() => checkConnectStatus(false)}
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

        <TouchableOpacity style={styles.dashboardButton} onPress={() => goTo(ROUTES.dashboard)}>
          <Ionicons name="arrow-back-outline" size={18} color={COLORS.text} />
          <Text style={styles.dashboardButtonText}>Back to Freight Dashboard</Text>
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

function currentFreightAccount(activeCarrier?: Carrier | null) {
  return pickAcct(
    activeCarrier?.freight_account,
    activeCarrier?.freightAccount,
    activeCarrier?.stripe_account_id,
    activeCarrier?.stripeAccountId
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
}) {
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

function InfoRow({ label, value, good }: { label: string; value: string; good: boolean }) {
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
  accountId: { color: COLORS.muted, fontWeight: "800", marginTop: 4, fontSize: 12 },
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
    backgroundColor: COLORS.redSoft,
    borderWidth: 1,
    borderColor: COLORS.red,
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 18,
    marginTop: 12,
    marginBottom: 12,
    flexDirection: "row",
    gap: 8,
  },
  dashboardButton: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 18,
    marginBottom: 16,
    flexDirection: "row",
    gap: 8,
  },
  disabledButton: { opacity: 0.65 },
  buttonText: { color: "#FFFFFF", fontWeight: "900" },
  secondaryButtonText: { color: COLORS.red, fontWeight: "900" },
  dashboardButtonText: { color: COLORS.text, fontWeight: "900" },
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
