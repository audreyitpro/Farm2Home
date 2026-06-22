// app/freight/connect-bank.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  RefreshControl,
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
  connectBank: "/freight/connect-bank",
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
  subscription_status?: string;
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
  bg: "#F7F7FB",
  card: "#FFFFFF",
  panel: "#F8FAFC",
  text: "#0F172A",
  muted: "#64748B",
  border: "#E5E7EB",
  primary: "#6D5DFB",
  primaryDark: "#4F46E5",
  primarySoft: "#EEF2FF",
  green: "#10B981",
  greenSoft: "#ECFDF5",
  amber: "#F59E0B",
  amberSoft: "#FFFBEB",
  red: "#EF4444",
  redSoft: "#FEF2F2",
  blue: "#2563EB",
  navy: "#020617",
  white: "#FFFFFF",
};

function clean(value: any) {
  return String(value ?? "").trim();
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
  if (typeof found === "string") return ["true", "1", "yes", "enabled", "complete"].includes(normalize(found));
  return Boolean(found);
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

function goTo(route: FreightRoute) {
  router.push(route as any);
}

function currentFreightAccount(activeCarrier?: Carrier | null) {
  return pickAcct(
    activeCarrier?.freight_account,
    activeCarrier?.freightAccount,
    activeCarrier?.stripe_account_id,
    activeCarrier?.stripeAccountId
  );
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
  const [refreshing, setRefreshing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [carrier, setCarrier] = useState<Carrier | null>(null);

  const freightAccount = useMemo(() => currentFreightAccount(carrier), [carrier]);

  const payoutsReady = useMemo(() => {
    return Boolean(carrier?.payoutsEnabled || carrier?.payouts_enabled || carrier?.stripe_payouts_enabled);
  }, [carrier]);

  const chargesReady = useMemo(() => {
    return Boolean(carrier?.chargesEnabled || carrier?.charges_enabled || carrier?.stripe_charges_enabled);
  }, [carrier]);

  const onboardingReady = useMemo(() => {
    return Boolean(carrier?.onboardingComplete || carrier?.stripe_onboarding_complete);
  }, [carrier]);

  const hasSubscription = useMemo(() => {
    return Boolean(
      pickSub(carrier?.stripeSubscriptionId, carrier?.stripe_subscription_id, carrier?.subscriptionId, carrier?.subscription_id) ||
        carrier?.subscription_status
    );
  }, [carrier]);

  const setupScore = useMemo(() => {
    let score = 0;
    if (freightAccount) score += 25;
    if (onboardingReady) score += 25;
    if (chargesReady) score += 25;
    if (payoutsReady) score += 25;
    return score;
  }, [freightAccount, onboardingReady, chargesReady, payoutsReady]);

  useFocusEffect(
    useCallback(() => {
      loadCarrier();

      const connected = clean(params?.connected);
      const refresh = clean(params?.refresh);

      if (connected === "true" || refresh === "true") {
        setTimeout(() => {
          checkConnectStatus(true);
        }, 700);
      }
    }, [params?.connected, params?.refresh, params?.freightId, params?.freight_id])
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

    const stripeCustomerId = pickCus(nextCarrier.stripe_customer_id, nextCarrier.stripeCustomerId);

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

  async function findSubscription(freightId: string, email: string) {
    const filters = [
      freightId ? `freight_id.eq.${freightId}` : "",
      email ? `freight_email.eq.${email}` : "",
    ]
      .filter(Boolean)
      .join(",");

    if (!filters) return null;

    const { data, error } = await supabase
      .from("freight_subscriptions")
      .select("*")
      .or(filters)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (error) {
      console.log("Connect bank subscription lookup error:", error.message);
      return null;
    }

    return Array.isArray(data) && data.length > 0 ? data[0] : null;
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
        authId ? `freight_id.eq.${authId}` : "",
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

      if (error) console.log("Freight connect bank profile load error:", error.message);

      const dbCarrier = Array.isArray(dbRows) && dbRows.length > 0 ? dbRows[0] : null;

      if (!dbCarrier) {
        Alert.alert("Freight Profile Missing", "No freight profile was found. Please complete freight registration first.");
        router.replace(ROUTES.register as any);
        return;
      }

      const sub = await findSubscription(
        dbCarrier.id || paramFreightId || storedId || authId,
        normalize(dbCarrier.email || email)
      );

      const subAcct = pickAcct(sub?.freight_account, sub?.stripe_account_id);
      const carrierAcct = pickAcct(dbCarrier?.freight_account, dbCarrier?.stripe_account_id);

      let mergedCarrier: Carrier = {
        ...(stored || {}),
        ...(dbCarrier || {}),
        id: dbCarrier.id,
        freightId: dbCarrier.freight_id || dbCarrier.id,
        freight_id: dbCarrier.freight_id || dbCarrier.id,
        email: normalize(dbCarrier.email || email),
        stripe_customer_id: pickCus(dbCarrier.stripe_customer_id, sub?.stripe_customer_id),
        stripe_subscription_id: pickSub(
          dbCarrier.stripe_subscription_id,
          dbCarrier.subscription_id,
          sub?.stripe_subscription_id
        ),
        subscription_id: pickSub(
          dbCarrier.subscription_id,
          dbCarrier.stripe_subscription_id,
          sub?.stripe_subscription_id
        ),
        subscription_status: dbCarrier.subscription_status || sub?.subscription_status || "",
        freight_account: pickAcct(dbCarrier.freight_account, dbCarrier.stripe_account_id, subAcct),
        stripe_account_id: pickAcct(dbCarrier.stripe_account_id, dbCarrier.freight_account, subAcct),
      };

      if (subAcct && !carrierAcct) {
        const updatePayload = {
          freight_account: subAcct,
          stripe_account_id: subAcct,
          stripe_connect_status: "started",
          updated_at: new Date().toISOString(),
        };

        await supabase.from("freight_users").update(updatePayload).eq("id", dbCarrier.id);
        mergedCarrier = { ...mergedCarrier, ...updatePayload };
      }

      await persistCarrier(mergedCarrier);
    } catch (error: any) {
      console.log("Freight connect bank load error:", error);
      Alert.alert("Connect Bank Error", error?.message || "Unable to load freight payout setup.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadCarrier();
  }

  async function safeUpdateProfiles(payload: any, freightId: string) {
    try {
      await supabase
        .from("profiles")
        .update(payload)
        .or(`id.eq.${freightId},auth_user_id.eq.${freightId},profile_id.eq.${freightId}`);
    } catch (error) {
      console.log("Profiles update skipped:", error);
    }
  }

  async function safeUpdateAdmin(payload: any, freightId: string) {
    try {
      await supabase
        .from("admin_verifications")
        .update(payload)
        .or(`id.eq.${freightId},freight_id.eq.${freightId},carrier_id.eq.${freightId},profile_id.eq.${freightId}`);
    } catch (error) {
      console.log("Admin verification update skipped:", error);
    }
  }

  async function updateSupabaseConnectStatus(payload: any, sourceCarrier?: Carrier | null) {
    const activeCarrier = sourceCarrier || carrier;
    const freightId = clean(activeCarrier?.id || activeCarrier?.freightId || activeCarrier?.freight_id);
    const email = normalize(activeCarrier?.email);

    if (!freightId && !email) throw new Error("Missing freight profile identity.");

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
      stripe_connect_status: payload.stripe_connect_status || (freightConnectAccount ? "started" : "not_started"),
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

    const subscriptionPayload = {
      freight_account: freightConnectAccount || null,
      stripe_account_id: freightConnectAccount || null,
      updated_at: new Date().toISOString(),
    };

    if (freightId && email) {
      await supabase
        .from("freight_subscriptions")
        .update(subscriptionPayload)
        .or(`freight_id.eq.${freightId},freight_email.eq.${email}`);
    } else if (freightId) {
      await supabase.from("freight_subscriptions").update(subscriptionPayload).eq("freight_id", freightId);
    } else if (email) {
      await supabase.from("freight_subscriptions").update(subscriptionPayload).eq("freight_email", email);
    }

    if (freightId) {
      await safeUpdateProfiles(updatePayload, freightId);
      await safeUpdateAdmin(updatePayload, freightId);
    }
  }

  async function openStripeUrl(url: string) {
    const finalUrl = clean(url);

    if (!finalUrl || !finalUrl.startsWith("https://connect.stripe.com/")) {
      Alert.alert("Stripe Error", "No valid Stripe Connect onboarding or update URL was returned.");
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

  async function createOrUpdateStripeLink(mode: "onboarding" | "update") {
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

      if (mode === "update" && !existingFreightAccount) {
        Alert.alert("No Stripe Account", "Start Stripe payout setup first before updating banking info.");
        return;
      }

      const returnUrl = `${APP_URL}/freight/connect-bank?connected=true&freightId=${encodeURIComponent(freightId)}`;
      const refreshUrl = `${APP_URL}/freight/connect-bank?refresh=true&freightId=${encodeURIComponent(freightId)}`;

      const requestBody = {
        role: "freight",
        mode,
        purpose: mode === "update" ? "update_bank" : "onboarding",
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
        update_existing: Boolean(existingFreightAccount),
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
          mode,
        },
      };

      const response = await fetch(`${API_BASE_URL}/payments/create-connect-account`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const data = await parseApiResponse(response);

      if (!response.ok || !data.success) {
        Alert.alert("Stripe Error", data.error || "Unable to open Stripe Connect.");
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

      const stripeUrl = clean(
        data.url ||
          data.onboardingUrl ||
          data.onboarding_url ||
          data.accountLinkUrl ||
          data.account_link_url ||
          data.updateUrl ||
          data.update_url
      );

      if (!stripeUrl) {
        Alert.alert("Stripe Error", "Backend did not return a Stripe onboarding/update URL.");
        return;
      }

      const statusUpdate = {
        freight_account: newFreightAccount,
        stripe_account_id: newFreightAccount,
        stripe_connect_status: mode === "update" ? "update_started" : "started",
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
      await openStripeUrl(stripeUrl);
    } catch (error: any) {
      console.log("Connect bank error:", error);
      Alert.alert("Connect Bank Error", error?.message || "Unable to open Stripe Connect.");
    } finally {
      setConnecting(false);
    }
  }

  async function startConnectBank() {
    await createOrUpdateStripeLink("onboarding");
  }

  async function updateBankingInfo() {
    await createOrUpdateStripeLink("update");
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
            "If you just finished Stripe onboarding or banking updates, wait a moment and tap Reload Payout Status again."
          );
        }
      }
    } catch (error: any) {
      if (!silent) Alert.alert("Status Error", error?.message || "Unable to check payout status.");
    } finally {
      setChecking(false);
    }
  }

  function statusColor() {
    if (payoutsReady && chargesReady && onboardingReady) return COLORS.green;
    if (freightAccount) return COLORS.amber;
    return COLORS.red;
  }

  function statusText() {
    if (payoutsReady && chargesReady && onboardingReady) return "Payout Ready";
    if (freightAccount) return "Setup Incomplete";
    return "Not Connected";
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.centerText}>Loading freight bank setup...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.shell}>
          <View style={styles.sidebar}>
            <View style={styles.brandRow}>
              <View style={styles.brandIcon}>
                <Ionicons name="business-outline" size={28} color={COLORS.white} />
              </View>
              <View>
                <Text style={styles.brandTitle}>Farm2Home</Text>
                <Text style={styles.brandSubtitle}>Connect Bank</Text>
              </View>
            </View>

            <View style={styles.sideDivider} />

            <SidebarLink icon="grid-outline" title="Dashboard" route={ROUTES.dashboard} />
            <SidebarLink icon="search-outline" title="Load Board" route={ROUTES.board} />
            <SidebarLink icon="briefcase-outline" title="My Loads" route={ROUTES.myLoads} />
            <SidebarLink icon="business-outline" title="Connect Bank" active route={ROUTES.connectBank} />
            <SidebarLink icon="person-outline" title="Profile" route={ROUTES.profile} />
            <SidebarLink icon="settings-outline" title="Settings" route={ROUTES.settings} />

            <View style={styles.sideNote}>
              <Ionicons name="shield-checkmark-outline" size={20} color="#A5B4FC" />
              <Text style={styles.sideNoteText}>
                Existing subscription carriers can reopen Stripe to update banking without creating duplicate acct_ accounts.
              </Text>
            </View>
          </View>

          <View style={styles.main}>
            <View style={styles.topPanel}>
              <View style={{ flex: 1 }}>
                <Text style={styles.eyebrow}>Fina Admin Style Payout Setup</Text>
                <Text style={styles.pageTitle}>Stripe Connect Bank</Text>
                <Text style={styles.pageSubtitle}>
                  Start onboarding, continue setup, update banking info for an existing subscription, and sync payout readiness.
                </Text>
              </View>

              <TouchableOpacity style={styles.topButton} onPress={() => goTo(ROUTES.dashboard)}>
                <Ionicons name="grid-outline" size={22} color={COLORS.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.profilePanel}>
              <View style={styles.profileAvatar}>
                <Ionicons name="business-outline" size={26} color={COLORS.white} />
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
              <View style={[styles.statusMini, { backgroundColor: statusColor() }]}>
                <Text style={styles.statusMiniText}>{statusText()}</Text>
              </View>
            </View>

            <View style={styles.metricGrid}>
              <MetricCard icon="card-outline" label="Connect Account" value={shortId(freightAccount)} ready={Boolean(freightAccount)} />
              <MetricCard icon="checkmark-circle-outline" label="Onboarding" value={onboardingReady ? "Complete" : "Required"} ready={onboardingReady} />
              <MetricCard icon="cash-outline" label="Charges" value={chargesReady ? "Enabled" : "Pending"} ready={chargesReady} />
              <MetricCard icon="wallet-outline" label="Payouts" value={payoutsReady ? "Enabled" : "Pending"} ready={payoutsReady} />
            </View>

            <View style={styles.gridTwo}>
              <View style={styles.card}>
                <SectionHeader
                  icon="shield-checkmark-outline"
                  title="Payout Setup Progress"
                  subtitle="Stripe account, onboarding, charges, payouts, and banking updates."
                />

                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${setupScore}%` }]} />
                </View>

                <InfoRow label="Stripe Connect Account" value={freightAccount ? shortId(freightAccount) : "Missing"} good={Boolean(freightAccount)} />
                <InfoRow label="Active Subscription" value={hasSubscription ? "Found" : "Missing"} good={hasSubscription} />
                <InfoRow label="Onboarding" value={onboardingReady ? "Complete" : "Required"} good={onboardingReady} />
                <InfoRow label="Charges Enabled" value={chargesReady ? "Enabled" : "Pending"} good={chargesReady} />
                <InfoRow label="Payouts Enabled" value={payoutsReady ? "Enabled" : "Pending"} good={payoutsReady} />

                <TouchableOpacity
                  style={[styles.primaryButton, connecting && styles.disabledButton]}
                  onPress={startConnectBank}
                  disabled={connecting}
                >
                  {connecting ? (
                    <ActivityIndicator color={COLORS.white} />
                  ) : (
                    <>
                      <Ionicons name="open-outline" size={18} color={COLORS.white} />
                      <Text style={styles.primaryButtonText}>
                        {freightAccount ? "Continue Stripe Setup" : "Start Stripe Payout Setup"}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.secondaryButton, connecting && styles.disabledButton]}
                  onPress={updateBankingInfo}
                  disabled={connecting || !freightAccount}
                >
                  {connecting ? (
                    <ActivityIndicator color={COLORS.primary} />
                  ) : (
                    <>
                      <Ionicons name="card-outline" size={18} color={COLORS.primary} />
                      <Text style={styles.secondaryButtonText}>Update Banking Info</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.secondaryButton, checking && styles.disabledButton]}
                  onPress={() => checkConnectStatus(false)}
                  disabled={checking}
                >
                  {checking ? (
                    <ActivityIndicator color={COLORS.primary} />
                  ) : (
                    <>
                      <Ionicons name="refresh-outline" size={18} color={COLORS.primary} />
                      <Text style={styles.secondaryButtonText}>Reload Payout Status</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.card}>
                <SectionHeader icon="server-outline" title="Saved Stripe IDs" subtitle="Values used by login, dashboard, and payout screens." />

                <IdRow label="Freight UUID" value={carrier?.id || carrier?.freightId || ""} />
                <IdRow label="Static Account ID" value={carrier?.accountId || carrier?.account_id || ""} />
                <IdRow label="Stripe Customer" value={pickCus(carrier?.stripeCustomerId, carrier?.stripe_customer_id)} />
                <IdRow label="Subscription" value={pickSub(carrier?.stripeSubscriptionId, carrier?.stripe_subscription_id, carrier?.subscription_id)} />
                <IdRow label="Connect Account" value={freightAccount} />

                <View style={styles.noticeBox}>
                  <Ionicons name="information-circle-outline" size={20} color={COLORS.primary} />
                  <Text style={styles.noticeText}>
                    This page hydrates acct_ from freight_subscriptions into freight_users and sends the existing acct_ to Stripe when updating banking.
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.card}>
              <SectionHeader icon="apps-outline" title="Quick Navigation" subtitle="Continue freight setup or return to operations." />

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
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SidebarLink({
  icon,
  title,
  route,
  active,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  route: FreightRoute;
  active?: boolean;
}) {
  return (
    <TouchableOpacity style={[styles.sidebarLink, active && styles.sidebarLinkActive]} onPress={() => goTo(route)}>
      <Ionicons name={icon} size={18} color={active ? COLORS.white : "#A5B4FC"} />
      <Text style={[styles.sidebarLinkText, active && styles.sidebarLinkTextActive]}>{title}</Text>
    </TouchableOpacity>
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
        <Ionicons name={icon} size={20} color={COLORS.white} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

function MetricCard({
  icon,
  label,
  value,
  ready,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  ready: boolean;
}) {
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricIcon, ready ? styles.metricGood : styles.metricWarn]}>
        <Ionicons name={icon} size={21} color={ready ? COLORS.green : COLORS.amber} />
      </View>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function InfoRow({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <View style={styles.infoRow}>
      <View style={[styles.infoIcon, good ? styles.infoGood : styles.infoWarn]}>
        <Ionicons name={good ? "checkmark-outline" : "alert-circle-outline"} size={16} color={good ? COLORS.white : COLORS.amber} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

function IdRow({ label, value }: { label: string; value?: string }) {
  return (
    <View style={styles.idRow}>
      <Text style={styles.idLabel}>{label}</Text>
      <Text style={[styles.idValue, !value && styles.idMissing]} numberOfLines={1}>
        {value || "Missing"}
      </Text>
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
      <View style={styles.quickIcon}>
        <Ionicons name={icon} size={21} color={COLORS.primary} />
      </View>
      <Text style={styles.quickLinkText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  content: { flexGrow: 1, paddingBottom: 40 },
  center: { flex: 1, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center", padding: 24 },
  centerText: { color: COLORS.muted, marginTop: 12, fontWeight: "800" },
  shell: {
    flex: 1,
    flexDirection: Platform.OS === "web" ? "row" : "column",
    minHeight: Platform.OS === "web" ? 840 : undefined,
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
  sidebarLinkActive: { backgroundColor: COLORS.primary },
  sidebarLinkText: { color: "#CBD5E1", fontWeight: "900" },
  sidebarLinkTextActive: { color: COLORS.white },
  sideNote: {
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "#1E293B",
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    marginTop: 12,
  },
  sideNoteText: { color: "#CBD5E1", fontWeight: "700", lineHeight: 20, flex: 1 },
  main: { flex: 1, padding: 18 },
  topPanel: {
    backgroundColor: COLORS.white,
    borderRadius: 26,
    padding: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    gap: 14,
    alignItems: "flex-start",
    marginBottom: 14,
  },
  eyebrow: { color: COLORS.primary, fontWeight: "900", fontSize: 12, letterSpacing: 1, textTransform: "uppercase" },
  pageTitle: { color: COLORS.text, fontSize: 34, fontWeight: "900", marginTop: 6 },
  pageSubtitle: { color: COLORS.muted, fontWeight: "700", lineHeight: 22, marginTop: 7, maxWidth: 760 },
  topButton: {
    width: 50,
    height: 50,
    borderRadius: 18,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  profilePanel: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    gap: 13,
    alignItems: "center",
    marginBottom: 14,
  },
  profileAvatar: {
    width: 58,
    height: 58,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  companyName: { color: COLORS.text, fontSize: 20, fontWeight: "900" },
  companyEmail: { color: COLORS.muted, fontWeight: "700", marginTop: 4 },
  accountId: { color: COLORS.muted, fontWeight: "800", marginTop: 4, fontSize: 12 },
  statusMini: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8 },
  statusMiniText: { color: COLORS.white, fontWeight: "900", fontSize: 12 },
  metricGrid: { flexDirection: Platform.OS === "web" ? "row" : "column", gap: 12, marginBottom: 14 },
  metricCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 22,
    padding: 16,
  },
  metricIcon: { width: 42, height: 42, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  metricGood: { backgroundColor: COLORS.greenSoft },
  metricWarn: { backgroundColor: COLORS.amberSoft },
  metricLabel: { color: COLORS.muted, fontWeight: "900", fontSize: 11, textTransform: "uppercase" },
  metricValue: { color: COLORS.text, fontWeight: "900", fontSize: 18, marginTop: 5 },
  gridTwo: { flexDirection: Platform.OS === "web" ? "row" : "column", gap: 14, alignItems: "flex-start" },
  card: {
    flex: 1,
    width: "100%",
    backgroundColor: COLORS.white,
    borderRadius: 26,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
  },
  sectionHeader: { flexDirection: "row", gap: 12, alignItems: "flex-start", marginBottom: 16 },
  sectionIcon: { width: 42, height: 42, borderRadius: 16, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  sectionTitle: { color: COLORS.text, fontSize: 21, fontWeight: "900" },
  sectionSubtitle: { color: COLORS.muted, fontWeight: "700", lineHeight: 20, marginTop: 3 },
  progressTrack: { height: 10, borderRadius: 999, backgroundColor: "#E5E7EB", overflow: "hidden", marginBottom: 14 },
  progressFill: { height: 10, borderRadius: 999, backgroundColor: COLORS.primary },
  infoRow: {
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    marginBottom: 10,
  },
  infoIcon: { width: 32, height: 32, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  infoGood: { backgroundColor: COLORS.green },
  infoWarn: { backgroundColor: COLORS.amberSoft },
  infoLabel: { color: COLORS.text, fontWeight: "900" },
  infoValue: { color: COLORS.muted, fontWeight: "700", marginTop: 2 },
  primaryButton: {
    backgroundColor: COLORS.primary,
    padding: 15,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
    width: "100%",
  },
  primaryButtonText: { color: COLORS.white, fontWeight: "900", textAlign: "center", flexShrink: 1 },
  secondaryButton: {
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    padding: 15,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    width: "100%",
  },
  secondaryButtonText: { color: COLORS.primary, fontWeight: "900", textAlign: "center", flexShrink: 1 },
  disabledButton: { opacity: 0.65 },
  idRow: {
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 13,
    marginBottom: 10,
  },
  idLabel: { color: COLORS.muted, fontWeight: "900", textTransform: "uppercase", fontSize: 11 },
  idValue: { color: COLORS.text, fontWeight: "900", marginTop: 5 },
  idMissing: { color: COLORS.amber },
  noticeBox: {
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    borderRadius: 16,
    padding: 13,
    flexDirection: "row",
    gap: 9,
    alignItems: "flex-start",
    marginTop: 4,
  },
  noticeText: { color: COLORS.primaryDark, fontWeight: "800", lineHeight: 20, flex: 1 },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  quickLink: {
    width: Platform.OS === "web" ? "23.5%" : "48%",
    backgroundColor: COLORS.panel,
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 102,
    justifyContent: "space-between",
  },
  quickIcon: { width: 42, height: 42, borderRadius: 15, backgroundColor: COLORS.primarySoft, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  quickLinkText: { color: COLORS.text, fontWeight: "900" },
});
