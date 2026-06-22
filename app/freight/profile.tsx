// app/freight/profile.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
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
  connectBank: "/freight/connect-bank",
  subscription: "/freight/subscription",
  profile: "/freight/profile",
  settings: "/freight/settings",
  support: "/freight/support",
  help: "/freight/help",
  liveRoute: "/freight/live-route",
  login: "/freight/login",
  register: "/freight/register",
} as const;

type FreightRoute = (typeof ROUTES)[keyof typeof ROUTES];

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
  navy: "#020617",
  slate: "#64748B",
  white: "#FFFFFF",
};

function clean(value: any) {
  return String(value ?? "").trim();
}

function normalize(value: any) {
  return clean(value).toLowerCase();
}

function isCus(value: any) {
  return clean(value).startsWith("cus_");
}

function isSub(value: any) {
  return clean(value).startsWith("sub_");
}

function isAcct(value: any) {
  return clean(value).startsWith("acct_");
}

function pickCus(...values: any[]) {
  const found = values.find((value) => isCus(value));
  return found ? clean(found) : "";
}

function pickSub(...values: any[]) {
  const found = values.find((value) => isSub(value));
  return found ? clean(found) : "";
}

function pickAcct(...values: any[]) {
  const found = values.find((value) => isAcct(value));
  return found ? clean(found) : "";
}

function boolValue(...values: any[]) {
  const found = values.find((value) => value !== undefined && value !== null);
  if (typeof found === "string") return ["true", "1", "yes", "enabled", "complete"].includes(normalize(found));
  return Boolean(found);
}

function isActiveStatus(value: any) {
  return ["active", "trialing", "past_due"].includes(normalize(value));
}

function shortId(value?: string) {
  const id = clean(value);
  if (!id) return "Missing";
  if (id.length <= 16) return id;
  return `${id.slice(0, 8)}...${id.slice(-5)}`;
}

function goTo(route: FreightRoute) {
  router.push(route as any);
}

async function parseApiResponse(response: Response) {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { success: false, error: text || "Invalid backend response." };
  }
}

export default function FreightProfileScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [saving, setSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  const [carrier, setCarrier] = useState<any>(null);
  const [allCarriers, setAllCarriers] = useState<any[]>([]);

  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [mdotNumber, setMdotNumber] = useState("");
  const [mcNumber, setMcNumber] = useState("");
  const [insuranceProvider, setInsuranceProvider] = useState("");
  const [insurancePolicyNumber, setInsurancePolicyNumber] = useState("");

  const [licensedLivestock, setLicensedLivestock] = useState(false);
  const [licensedRefrigeratedFood, setLicensedRefrigeratedFood] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  useFocusEffect(
    useCallback(() => {
      loadCarrier();
    }, [])
  );

  const stripeCustomerId = useMemo(
    () => pickCus(carrier?.stripeCustomerId, carrier?.stripe_customer_id, carrier?.stripeId, carrier?.stripe_id),
    [carrier]
  );

  const stripeSubscriptionId = useMemo(
    () =>
      pickSub(
        carrier?.stripeSubscriptionId,
        carrier?.stripe_subscription_id,
        carrier?.subscriptionId,
        carrier?.subscription_id
      ),
    [carrier]
  );

  const stripeAccountId = useMemo(
    () => pickAcct(carrier?.stripeAccountId, carrier?.stripe_account_id, carrier?.freightAccount, carrier?.freight_account),
    [carrier]
  );

  const membershipStatus = useMemo(() => {
    return carrier?.membershipStatus || carrier?.membership_status || carrier?.subscriptionStatus || carrier?.subscription_status || "not_started";
  }, [carrier]);

  const payoutsReady = useMemo(() => {
    return boolValue(carrier?.payoutsEnabled, carrier?.payouts_enabled, carrier?.stripe_payouts_enabled);
  }, [carrier]);

  const chargesReady = useMemo(() => {
    return boolValue(carrier?.chargesEnabled, carrier?.charges_enabled, carrier?.stripe_charges_enabled);
  }, [carrier]);

  const onboardingReady = useMemo(() => {
    return boolValue(carrier?.onboardingComplete, carrier?.stripe_onboarding_complete);
  }, [carrier]);

  const setupScore = useMemo(() => {
    let score = 0;
    if (carrier?.id || carrier?.freightId || carrier?.freight_id) score += 20;
    if (stripeCustomerId) score += 20;
    if (stripeSubscriptionId) score += 20;
    if (stripeAccountId) score += 20;
    if (payoutsReady && chargesReady && onboardingReady) score += 20;
    return score;
  }, [carrier, stripeCustomerId, stripeSubscriptionId, stripeAccountId, payoutsReady, chargesReady, onboardingReady]);

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

  async function saveSession(nextCarrier: any) {
    await AsyncStorage.setItem("currentFreight", JSON.stringify(nextCarrier));
    await AsyncStorage.setItem("currentFreightCarrier", JSON.stringify(nextCarrier));
    await AsyncStorage.setItem("currentFreightUser", JSON.stringify(nextCarrier));
    await AsyncStorage.setItem("farm2homeCurrentFreight", JSON.stringify(nextCarrier));
    await AsyncStorage.setItem("currentUser", JSON.stringify(nextCarrier));
    await AsyncStorage.setItem("userRole", "freight");
    await AsyncStorage.setItem("currentUserRole", "freight");
  }

  async function findSubscription(freightId: string, userEmail: string) {
    const filters = [freightId ? `freight_id.eq.${freightId}` : "", userEmail ? `freight_email.eq.${userEmail}` : ""]
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
      console.log("Freight profile subscription lookup error:", error.message);
      return null;
    }

    return Array.isArray(data) && data.length > 0 ? data[0] : null;
  }

  function buildMergedCarrier(row: any, sub: any = {}, localCurrent: any = {}) {
    const realId = clean(
      row?.id ||
        row?.freight_id ||
        sub?.freight_id ||
        localCurrent?.id ||
        localCurrent?.freightId ||
        localCurrent?.freight_id
    );

    const staticAccountId = clean(row?.account_id || localCurrent?.accountId || localCurrent?.account_id || sub?.freight_account || "");

    const customerId = pickCus(
      row?.stripe_customer_id,
      row?.stripe_id,
      sub?.stripe_customer_id,
      localCurrent?.stripeCustomerId,
      localCurrent?.stripe_customer_id,
      localCurrent?.stripeId,
      localCurrent?.stripe_id
    );

    const subscriptionId = pickSub(
      row?.stripe_subscription_id,
      row?.subscription_id,
      sub?.stripe_subscription_id,
      localCurrent?.stripeSubscriptionId,
      localCurrent?.stripe_subscription_id,
      localCurrent?.subscriptionId,
      localCurrent?.subscription_id
    );

    const connectAccount = pickAcct(
      row?.stripe_account_id,
      row?.freight_account,
      sub?.stripe_account_id,
      sub?.freight_account,
      localCurrent?.stripeAccountId,
      localCurrent?.stripe_account_id,
      localCurrent?.freightAccount,
      localCurrent?.freight_account
    );

    const subStatus =
      row?.subscription_status ||
      sub?.subscription_status ||
      row?.membership_status ||
      localCurrent?.subscriptionStatus ||
      localCurrent?.subscription_status ||
      localCurrent?.membershipStatus ||
      "not_started";

    const company =
      row?.company_name ||
      row?.business_name ||
      sub?.name ||
      localCurrent?.companyName ||
      localCurrent?.businessName ||
      "Freight Connect Carrier";

    return {
      ...(localCurrent || {}),
      ...(row || {}),
      id: realId,
      freightId: realId,
      freight_id: realId,
      role: "freight",
      accountId: staticAccountId,
      account_id: staticAccountId,
      companyName: company,
      company_name: company,
      businessName: row?.business_name || row?.company_name || company,
      business_name: row?.business_name || row?.company_name || company,
      contactName: row?.contact_name || row?.name || localCurrent?.contactName || localCurrent?.ownerName || localCurrent?.fullName || "",
      contact_name: row?.contact_name || row?.name || localCurrent?.contact_name || localCurrent?.contactName || "",
      username: row?.username || sub?.username || localCurrent?.username || "",
      email: normalize(row?.email || sub?.freight_email || localCurrent?.email || ""),
      phone: row?.phone || localCurrent?.phone || "",
      mdotNumber: row?.mdot_number || localCurrent?.mdotNumber || "",
      mdot_number: row?.mdot_number || localCurrent?.mdot_number || localCurrent?.mdotNumber || "",
      mcNumber: row?.mc_number || localCurrent?.mcNumber || "",
      mc_number: row?.mc_number || localCurrent?.mc_number || localCurrent?.mcNumber || "",
      insuranceProvider: row?.insurance_provider || localCurrent?.insuranceProvider || "",
      insurance_provider: row?.insurance_provider || localCurrent?.insurance_provider || localCurrent?.insuranceProvider || "",
      insurancePolicyNumber: row?.insurance_policy_number || localCurrent?.insurancePolicyNumber || "",
      insurance_policy_number: row?.insurance_policy_number || localCurrent?.insurance_policy_number || localCurrent?.insurancePolicyNumber || "",
      licensedLivestock: Boolean(row?.licensed_livestock ?? localCurrent?.licensedLivestock ?? false),
      licensed_livestock: Boolean(row?.licensed_livestock ?? localCurrent?.licensed_livestock ?? localCurrent?.licensedLivestock ?? false),
      licensedRefrigeratedFood: Boolean(row?.licensed_refrigerated_food ?? localCurrent?.licensedRefrigeratedFood ?? false),
      licensed_refrigerated_food: Boolean(
        row?.licensed_refrigerated_food ?? localCurrent?.licensed_refrigerated_food ?? localCurrent?.licensedRefrigeratedFood ?? false
      ),
      membershipStatus: row?.membership_status || subStatus,
      membership_status: row?.membership_status || subStatus,
      subscriptionStatus: subStatus,
      subscription_status: subStatus,
      accountActive: Boolean(row?.account_active ?? localCurrent?.accountActive ?? isActiveStatus(subStatus)),
      account_active: Boolean(row?.account_active ?? localCurrent?.account_active ?? isActiveStatus(subStatus)),
      stripeCustomerId: customerId,
      stripe_customer_id: customerId,
      stripeId: customerId,
      stripe_id: customerId,
      stripeSubscriptionId: subscriptionId,
      stripe_subscription_id: subscriptionId,
      subscriptionId,
      subscription_id: subscriptionId,
      stripeAccountId: connectAccount,
      stripe_account_id: connectAccount,
      freightAccount: connectAccount,
      freight_account: connectAccount,
      stripeConnectStatus: row?.stripe_connect_status || localCurrent?.stripeConnectStatus || localCurrent?.stripe_connect_status || (connectAccount ? "started" : "not_started"),
      stripe_connect_status: row?.stripe_connect_status || localCurrent?.stripe_connect_status || localCurrent?.stripeConnectStatus || (connectAccount ? "started" : "not_started"),
      payoutsEnabled: boolValue(row?.payouts_enabled, row?.stripe_payouts_enabled, localCurrent?.payoutsEnabled, localCurrent?.payouts_enabled),
      payouts_enabled: boolValue(row?.payouts_enabled, row?.stripe_payouts_enabled, localCurrent?.payoutsEnabled, localCurrent?.payouts_enabled),
      stripe_payouts_enabled: boolValue(row?.stripe_payouts_enabled, row?.payouts_enabled, localCurrent?.stripe_payouts_enabled),
      chargesEnabled: boolValue(row?.charges_enabled, row?.stripe_charges_enabled, localCurrent?.chargesEnabled, localCurrent?.charges_enabled),
      charges_enabled: boolValue(row?.charges_enabled, row?.stripe_charges_enabled, localCurrent?.chargesEnabled, localCurrent?.charges_enabled),
      stripe_charges_enabled: boolValue(row?.stripe_charges_enabled, row?.charges_enabled, localCurrent?.stripe_charges_enabled),
      onboardingComplete: boolValue(row?.stripe_onboarding_complete, localCurrent?.onboardingComplete),
      stripe_onboarding_complete: boolValue(row?.stripe_onboarding_complete, localCurrent?.stripe_onboarding_complete, localCurrent?.onboardingComplete),
      current_period_end: row?.current_period_end || sub?.current_period_end || localCurrent?.current_period_end || null,
      updatedAt: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  async function syncFreightTables(nextCarrier: any) {
    const realId = clean(nextCarrier.id || nextCarrier.freightId || nextCarrier.freight_id);
    const now = new Date().toISOString();

    if (!realId) throw new Error("Missing freight profile ID.");

    const updatePayload = {
      company_name: nextCarrier.companyName || nextCarrier.company_name || nextCarrier.businessName,
      business_name: nextCarrier.businessName || nextCarrier.business_name || nextCarrier.companyName,
      contact_name: nextCarrier.contactName || nextCarrier.contact_name,
      name: nextCarrier.contactName || nextCarrier.contact_name,
      username: normalize(nextCarrier.username),
      email: normalize(nextCarrier.email),
      phone: clean(nextCarrier.phone),
      account_id: clean(nextCarrier.accountId || nextCarrier.account_id),
      mdot_number: clean(nextCarrier.mdotNumber || nextCarrier.mdot_number),
      mc_number: clean(nextCarrier.mcNumber || nextCarrier.mc_number),
      insurance_provider: clean(nextCarrier.insuranceProvider || nextCarrier.insurance_provider),
      insurance_policy_number: clean(nextCarrier.insurancePolicyNumber || nextCarrier.insurance_policy_number),
      licensed_livestock: Boolean(nextCarrier.licensedLivestock || nextCarrier.licensed_livestock),
      licensed_refrigerated_food: Boolean(nextCarrier.licensedRefrigeratedFood || nextCarrier.licensed_refrigerated_food),
      membership_status: nextCarrier.membershipStatus || nextCarrier.membership_status,
      subscription_status: nextCarrier.subscriptionStatus || nextCarrier.subscription_status,
      stripe_id: pickCus(nextCarrier.stripeCustomerId, nextCarrier.stripe_customer_id, nextCarrier.stripeId, nextCarrier.stripe_id) || null,
      stripe_customer_id: pickCus(nextCarrier.stripeCustomerId, nextCarrier.stripe_customer_id, nextCarrier.stripeId, nextCarrier.stripe_id) || null,
      stripe_subscription_id: pickSub(nextCarrier.stripeSubscriptionId, nextCarrier.stripe_subscription_id, nextCarrier.subscriptionId, nextCarrier.subscription_id) || null,
      subscription_id: pickSub(nextCarrier.stripeSubscriptionId, nextCarrier.stripe_subscription_id, nextCarrier.subscriptionId, nextCarrier.subscription_id) || null,
      stripe_account_id: pickAcct(nextCarrier.stripeAccountId, nextCarrier.stripe_account_id, nextCarrier.freightAccount, nextCarrier.freight_account) || null,
      freight_account: pickAcct(nextCarrier.freightAccount, nextCarrier.freight_account, nextCarrier.stripeAccountId, nextCarrier.stripe_account_id) || null,
      stripe_connect_status: nextCarrier.stripeConnectStatus || nextCarrier.stripe_connect_status || "not_started",
      payouts_enabled: Boolean(nextCarrier.payoutsEnabled || nextCarrier.payouts_enabled),
      charges_enabled: Boolean(nextCarrier.chargesEnabled || nextCarrier.charges_enabled),
      stripe_payouts_enabled: Boolean(nextCarrier.stripe_payouts_enabled || nextCarrier.payoutsEnabled || nextCarrier.payouts_enabled),
      stripe_charges_enabled: Boolean(nextCarrier.stripe_charges_enabled || nextCarrier.chargesEnabled || nextCarrier.charges_enabled),
      stripe_onboarding_complete: Boolean(nextCarrier.onboardingComplete || nextCarrier.stripe_onboarding_complete),
      account_active: nextCarrier.accountActive !== false && nextCarrier.account_active !== false,
      updated_at: now,
    };

    const { error } = await supabase
      .from("freight_users")
      .update(updatePayload)
      .or(`id.eq.${realId},freight_id.eq.${realId},auth_user_id.eq.${realId},profile_id.eq.${realId}`);

    if (error) throw error;

    await supabase
      .from("freight_subscriptions")
      .update({
        freight_email: updatePayload.email,
        name: updatePayload.company_name,
        username: updatePayload.username,
        stripe_customer_id: updatePayload.stripe_customer_id,
        stripe_subscription_id: updatePayload.stripe_subscription_id,
        subscription_status: updatePayload.subscription_status,
        stripe_account_id: updatePayload.stripe_account_id,
        freight_account: updatePayload.freight_account,
        updated_at: now,
      })
      .eq("freight_id", realId);

    try {
      await supabase
        .from("profiles")
        .update({
          ...updatePayload,
          role: "freight",
        })
        .or(`id.eq.${realId},auth_user_id.eq.${realId},profile_id.eq.${realId}`);
    } catch {
      // Optional table.
    }
  }

  async function persistCarrier(nextCarrier: any, saveToSupabase = true) {
    const realId = clean(nextCarrier.id || nextCarrier.freightId || nextCarrier.freight_id);
    if (!realId) throw new Error("Missing freight profile ID.");

    const normalizedCarrier = buildMergedCarrier(
      {
        id: realId,
        ...nextCarrier,
        email: normalize(nextCarrier.email),
      },
      {},
      nextCarrier
    );

    const existing = allCarriers.length > 0 ? allCarriers : [];
    const exists = existing.some((item) => clean(item.id || item.freightId || item.freight_id) === realId);

    const updatedCarriers = exists
      ? existing.map((item) => (clean(item.id || item.freightId || item.freight_id) === realId ? normalizedCarrier : item))
      : [...existing, normalizedCarrier];

    if (saveToSupabase) await syncFreightTables(normalizedCarrier);

    await AsyncStorage.setItem("farm2homeFreightCarriers", JSON.stringify(updatedCarriers));
    await saveSession(normalizedCarrier);

    setCarrier(normalizedCarrier);
    setAllCarriers(updatedCarriers);
    return normalizedCarrier;
  }

  async function loadCarrier() {
    try {
      setLoading(true);

      const stored = await getStoredCarrier();
      const savedCarriers = await AsyncStorage.getItem("farm2homeFreightCarriers");
      const parsedCarriers = savedCarriers ? JSON.parse(savedCarriers) : [];
      const safeCarriers = Array.isArray(parsedCarriers) ? parsedCarriers : [];

      const { data: authData } = await supabase.auth.getUser();
      const authUser = authData?.user;

      const storedId = clean(stored?.id || stored?.freightId || stored?.freight_id);
      const authId = clean(authUser?.id);
      const carrierEmail = normalize(stored?.email || authUser?.email || "");
      const accountId = clean(stored?.accountId || stored?.account_id || "");

      if (!carrierEmail && !storedId && !authId && !accountId) {
        router.replace(ROUTES.login as any);
        return;
      }

      const filters = [
        authId ? `id.eq.${authId}` : "",
        authId ? `auth_user_id.eq.${authId}` : "",
        authId ? `profile_id.eq.${authId}` : "",
        authId ? `freight_id.eq.${authId}` : "",
        storedId ? `id.eq.${storedId}` : "",
        storedId ? `freight_id.eq.${storedId}` : "",
        carrierEmail ? `email.eq.${carrierEmail}` : "",
        accountId ? `account_id.eq.${accountId}` : "",
      ]
        .filter(Boolean)
        .join(",");

      const { data: dbRows, error } = await supabase.from("freight_users").select("*").or(filters).limit(1);

      if (error) console.log("Load freight profile Supabase error:", error.message);

      const dbCarrier = Array.isArray(dbRows) && dbRows.length > 0 ? dbRows[0] : null;

      if (!dbCarrier) {
        Alert.alert("Freight Profile Missing", "No freight profile was found. Please complete freight registration again.");
        router.replace(ROUTES.register as any);
        return;
      }

      const localCurrent = stored || safeCarriers[safeCarriers.length - 1] || {};
      const sub = await findSubscription(dbCarrier.id || storedId || authId, normalize(dbCarrier.email || carrierEmail));
      const mergedCarrier = buildMergedCarrier(dbCarrier, sub, localCurrent);

      setAllCarriers(safeCarriers);
      setCompanyName(mergedCarrier.companyName || "");
      setContactName(mergedCarrier.contactName || "");
      setUsername(mergedCarrier.username || "");
      setEmail(mergedCarrier.email || "");
      setPhone(mergedCarrier.phone || "");
      setMdotNumber(mergedCarrier.mdotNumber || "");
      setMcNumber(mergedCarrier.mcNumber || "");
      setInsuranceProvider(mergedCarrier.insuranceProvider || "");
      setInsurancePolicyNumber(mergedCarrier.insurancePolicyNumber || "");
      setLicensedLivestock(Boolean(mergedCarrier.licensedLivestock));
      setLicensedRefrigeratedFood(Boolean(mergedCarrier.licensedRefrigeratedFood));

      await persistCarrier(mergedCarrier, false);
    } catch (error) {
      console.log("Load freight profile error:", error);
      Alert.alert("Profile Error", "Unable to load freight profile.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadCarrier();
  }

  async function saveProfile() {
    if (!carrier) {
      Alert.alert("No Profile", "No freight profile was found.");
      return;
    }

    if (!companyName.trim()) {
      Alert.alert("Company Required", "Please enter your company name.");
      return;
    }

    if (!username.trim()) {
      Alert.alert("Username Required", "Please enter your username.");
      return;
    }

    try {
      setSaving(true);

      const updatedCarrier = {
        ...carrier,
        companyName: companyName.trim(),
        company_name: companyName.trim(),
        businessName: companyName.trim(),
        business_name: companyName.trim(),
        contactName: contactName.trim(),
        contact_name: contactName.trim(),
        username: normalize(username),
        email: normalize(email),
        phone: phone.trim(),
        mdotNumber: mdotNumber.trim(),
        mdot_number: mdotNumber.trim(),
        mcNumber: mcNumber.trim(),
        mc_number: mcNumber.trim(),
        insuranceProvider: insuranceProvider.trim(),
        insurance_provider: insuranceProvider.trim(),
        insurancePolicyNumber: insurancePolicyNumber.trim(),
        insurance_policy_number: insurancePolicyNumber.trim(),
        licensedLivestock,
        licensed_livestock: licensedLivestock,
        licensedRefrigeratedFood,
        licensed_refrigerated_food: licensedRefrigeratedFood,
        updatedAt: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await persistCarrier(updatedCarrier, true);
      Alert.alert("Saved", "Freight profile updated.");
    } catch (error: any) {
      Alert.alert("Save Error", error?.message || "Unable to save freight profile.");
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    if (!newPassword.trim()) {
      Alert.alert("New Password Required", "Enter your new password.");
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert("Password Too Short", "Password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      Alert.alert("Password Mismatch", "New passwords do not match.");
      return;
    }

    try {
      setPasswordSaving(true);

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");

      Alert.alert("Password Updated", "Your password was changed successfully.");
    } catch (error: any) {
      Alert.alert("Password Error", error?.message || "Unable to change password.");
    } finally {
      setPasswordSaving(false);
    }
  }

  async function openUrl(url: string) {
    if (!url) return;

    if (Platform.OS === "web") {
      globalThis.location.assign(url);
      return;
    }

    await WebBrowser.openBrowserAsync(url);
  }

  async function manageSubscription() {
    if (!stripeCustomerId) {
      goTo(ROUTES.subscription);
      return;
    }

    try {
      setBillingLoading(true);

      const response = await fetch(`${API_BASE_URL}/payments/create-customer-portal-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: stripeCustomerId,
          stripeCustomerId,
          stripe_customer_id: stripeCustomerId,
          role: "freight",
          carrierId: carrier?.id || carrier?.freightId,
          freightId: carrier?.id || carrier?.freightId,
          freight_id: carrier?.id || carrier?.freightId,
          returnUrl: Platform.OS === "web" ? globalThis.location.href : "farm2home://freight/profile",
        }),
      });

      const data = await parseApiResponse(response);

      if (!response.ok || data.error || !data.url) {
        Alert.alert("Billing Error", data.error || "Unable to open subscription portal.");
        return;
      }

      await openUrl(data.url);
    } catch (error: any) {
      Alert.alert("Billing Error", error?.message || "Unable to open subscription portal.");
    } finally {
      setBillingLoading(false);
    }
  }

  async function cancelSubscription() {
    if (!stripeSubscriptionId) {
      Alert.alert("No Subscription", "No active freight subscription ID was found.");
      return;
    }

    Alert.alert("Cancel Subscription", "Are you sure you want to cancel your freight membership?", [
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
                subscriptionId: stripeSubscriptionId,
                subscription_id: stripeSubscriptionId,
                carrierId: carrier?.id || carrier?.freightId,
                freightId: carrier?.id || carrier?.freightId,
                role: "freight",
              }),
            });

            const data = await parseApiResponse(response);

            if (!response.ok || data.error) {
              Alert.alert("Stripe Error", data.error || "Unable to cancel.");
              return;
            }

            const updatedCarrier = {
              ...carrier,
              membershipStatus: "canceled",
              membership_status: "canceled",
              subscriptionStatus: "canceled",
              subscription_status: "canceled",
              accountActive: false,
              account_active: false,
              updatedAt: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };

            await persistCarrier(updatedCarrier, true);
            Alert.alert("Canceled", "Freight subscription was canceled.");
          } catch (error: any) {
            Alert.alert("Cancel Error", error?.message || "Unable to cancel subscription.");
          } finally {
            setCancelLoading(false);
          }
        },
      },
    ]);
  }

  async function logout() {
    await supabase.auth.signOut();

    await AsyncStorage.multiRemove([
      "currentFreightCarrier",
      "currentFreight",
      "currentFreightUser",
      "farm2homeCurrentFreight",
      "currentUser",
      "userRole",
      "currentUserRole",
    ]);

    router.replace(ROUTES.login as any);
  }

  function membershipColor() {
    const status = normalize(membershipStatus);

    if (status.includes("cancel") || status.includes("unpaid") || status.includes("incomplete")) return COLORS.red;
    if (status.includes("pending") || status.includes("past_due")) return COLORS.amber;
    if (status.includes("active") || status.includes("trial")) return COLORS.green;

    return COLORS.amber;
  }

  function stripeStatusText() {
    if (payoutsReady && chargesReady && onboardingReady) return "Payout Ready";
    if (stripeAccountId) return "Setup Incomplete";
    return "Not Connected";
  }

  function stripeStatusColor() {
    if (payoutsReady && chargesReady && onboardingReady) return COLORS.green;
    if (stripeAccountId) return COLORS.amber;
    return COLORS.red;
  }

  function carrierInitials() {
    const value = companyName || contactName || "Freight Carrier";
    const parts = value.split(" ").filter(Boolean);
    const first = parts[0]?.[0] || "F";
    const second = parts[1]?.[0] || "";
    return `${first}${second}`.toUpperCase();
  }

  function authorizedServices() {
    const services = [];

    if (licensedLivestock) services.push("Livestock Transport");
    if (licensedRefrigeratedFood) services.push("Refrigerated Fresh Food");

    return services.length > 0 ? services.join("\n") : "No services selected";
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.centerText}>Loading freight profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!carrier) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>No freight profile found.</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.replace(ROUTES.login as any)}>
            <Text style={styles.primaryButtonText}>Go to Freight Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />

      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <View style={styles.shell}>
            <View style={styles.sidebar}>
              <View style={styles.brandRow}>
                <View style={styles.brandIcon}>
                  <Text style={styles.avatarText}>{carrierInitials()}</Text>
                </View>
                <View>
                  <Text style={styles.brandTitle}>Farm2Home</Text>
                  <Text style={styles.brandSubtitle}>Freight Profile</Text>
                </View>
              </View>

              <View style={styles.sideDivider} />

              <SidebarLink icon="grid-outline" title="Dashboard" route={ROUTES.dashboard} />
              <SidebarLink icon="list-outline" title="Load Board" route={ROUTES.board} />
              <SidebarLink icon="briefcase-outline" title="My Loads" route={ROUTES.myLoads} />
              <SidebarLink icon="person-outline" title="Profile" active route={ROUTES.profile} />
              <SidebarLink icon="card-outline" title="Subscription" route={ROUTES.subscription} />
              <SidebarLink icon="business-outline" title="Connect Bank" route={ROUTES.connectBank} />

              <View style={styles.carrierPanel}>
                <Text style={styles.carrierLabel}>Carrier</Text>
                <Text style={styles.carrierName} numberOfLines={1}>{companyName || "Freight Carrier"}</Text>
                <Text style={styles.carrierSub} numberOfLines={1}>{carrier?.accountId || carrier?.account_id || "Account pending"}</Text>
              </View>
            </View>

            <View style={styles.main}>
              <View style={styles.topPanel}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.eyebrow}>Fina Admin Carrier Profile</Text>
                  <Text style={styles.pageTitle}>Freight Carrier Profile</Text>
                  <Text style={styles.pageSubtitle}>
                    Manage company details, static account ID, Stripe IDs, carrier credentials, subscription, payout setup, and freight access.
                  </Text>
                </View>

                <TouchableOpacity style={styles.topButton} onPress={() => goTo(ROUTES.dashboard)}>
                  <Ionicons name="grid-outline" size={22} color={COLORS.primary} />
                </TouchableOpacity>
              </View>

              <View style={styles.profilePanel}>
                <View style={styles.profileAvatar}>
                  <Text style={styles.profileAvatarText}>{carrierInitials()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.companyName}>{companyName || "Freight Carrier"}</Text>
                  <Text style={styles.companyEmail}>{email || "Freight account"}</Text>
                  <Text style={styles.accountId}>Account ID: {carrier?.accountId || carrier?.account_id || "Not assigned"}</Text>
                </View>
                <View style={[styles.statusMini, { backgroundColor: membershipColor() }]}>
                  <Text style={styles.statusMiniText}>{membershipStatus}</Text>
                </View>
              </View>

              <View style={styles.metricGrid}>
                <MetricCard icon="analytics-outline" label="Setup" value={`${setupScore}%`} ready={setupScore >= 80} />
                <MetricCard icon="person-circle-outline" label="Customer" value={shortId(stripeCustomerId)} ready={Boolean(stripeCustomerId)} />
                <MetricCard icon="repeat-outline" label="Subscription" value={shortId(stripeSubscriptionId)} ready={Boolean(stripeSubscriptionId)} />
                <MetricCard icon="business-outline" label="Connect" value={shortId(stripeAccountId)} ready={Boolean(stripeAccountId)} />
                <MetricCard icon="wallet-outline" label="Payouts" value={stripeStatusText()} ready={payoutsReady && chargesReady && onboardingReady} />
              </View>

              <View style={styles.quickGrid}>
                <QuickNav icon="grid-outline" label="Dashboard" route={ROUTES.dashboard} />
                <QuickNav icon="list-outline" label="Board" route={ROUTES.board} />
                <QuickNav icon="briefcase-outline" label="My Loads" route={ROUTES.myLoads} />
                <QuickNav icon="pulse-outline" label="Live Loads" route={ROUTES.liveLoads} />
                <QuickNav icon="card-outline" label="Subscription" route={ROUTES.subscription} />
                <QuickNav icon="settings-outline" label="Settings" route={ROUTES.settings} />
                <QuickNav icon="headset-outline" label="Support" route={ROUTES.support} />
                <QuickNav icon="help-circle-outline" label="Help" route={ROUTES.help} />
              </View>

              <View style={styles.gridTwo}>
                <View style={styles.card}>
                  <SectionHeader icon="business-outline" title="Profile Information" subtitle="Company and primary contact information." />

                  <Label text="Username" />
                  <TextInput style={styles.input} value={username} onChangeText={setUsername} placeholder="Username" placeholderTextColor="#94A3B8" autoCapitalize="none" />

                  <Label text="Company Name" />
                  <TextInput style={styles.input} value={companyName} onChangeText={setCompanyName} placeholder="Company name" placeholderTextColor="#94A3B8" />

                  <Label text="Contact Name" />
                  <TextInput style={styles.input} value={contactName} onChangeText={setContactName} placeholder="Contact name" placeholderTextColor="#94A3B8" />

                  <Label text="Email" />
                  <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor="#94A3B8" autoCapitalize="none" keyboardType="email-address" />

                  <Label text="Phone" />
                  <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="Phone" placeholderTextColor="#94A3B8" keyboardType="phone-pad" />

                  <TouchableOpacity style={[styles.primaryButton, saving && styles.disabledButton]} onPress={saveProfile} disabled={saving}>
                    {saving ? <ActivityIndicator color={COLORS.white} /> : <><Ionicons name="save-outline" size={18} color={COLORS.white} /><Text style={styles.primaryButtonText}>Save Profile</Text></>}
                  </TouchableOpacity>
                </View>

                <View style={styles.card}>
                  <SectionHeader icon="trail-sign-outline" title="Carrier Details" subtitle="DOT, MC, insurance, and authorized services." />

                  <Label text="MDOT Number" />
                  <TextInput style={styles.input} value={mdotNumber} onChangeText={setMdotNumber} placeholder="MDOT Number" placeholderTextColor="#94A3B8" />

                  <Label text="MC Number" />
                  <TextInput style={styles.input} value={mcNumber} onChangeText={setMcNumber} placeholder="MC Number" placeholderTextColor="#94A3B8" />

                  <Label text="Insurance Provider" />
                  <TextInput style={styles.input} value={insuranceProvider} onChangeText={setInsuranceProvider} placeholder="Insurance provider" placeholderTextColor="#94A3B8" />

                  <Label text="Policy Number" />
                  <TextInput style={styles.input} value={insurancePolicyNumber} onChangeText={setInsurancePolicyNumber} placeholder="Policy number" placeholderTextColor="#94A3B8" />

                  <SwitchRow label="Licensed Livestock Transport" value={licensedLivestock} onValueChange={setLicensedLivestock} />
                  <SwitchRow label="Licensed Refrigerated Fresh Food" value={licensedRefrigeratedFood} onValueChange={setLicensedRefrigeratedFood} />

                  <View style={styles.valueBox}>
                    <Ionicons name="checkmark-circle-outline" size={20} color={COLORS.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.valueLabel}>Authorized Services</Text>
                      <Text style={styles.value}>{authorizedServices()}</Text>
                    </View>
                  </View>

                  <TouchableOpacity style={[styles.primaryButton, saving && styles.disabledButton]} onPress={saveProfile} disabled={saving}>
                    {saving ? <ActivityIndicator color={COLORS.white} /> : <><Ionicons name="checkmark-circle-outline" size={18} color={COLORS.white} /><Text style={styles.primaryButtonText}>Save Carrier Details</Text></>}
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.card}>
                <SectionHeader icon="server-outline" title="Saved IDs" subtitle="Fields used by login, dashboard, subscription, Connect Bank, and payout screens." />

                <View style={styles.idGrid}>
                  <IdRow label="Freight UUID" value={carrier?.id || carrier?.freightId || ""} />
                  <IdRow label="Static Account ID" value={carrier?.accountId || carrier?.account_id || ""} />
                  <IdRow label="Stripe Customer" value={stripeCustomerId} />
                  <IdRow label="Stripe Subscription" value={stripeSubscriptionId} />
                  <IdRow label="Connect Account" value={stripeAccountId} />
                  <IdRow label="Connect Status" value={carrier?.stripeConnectStatus || carrier?.stripe_connect_status || ""} />
                </View>
              </View>

              <View style={styles.gridTwo}>
                <View style={styles.card}>
                  <SectionHeader icon="key-outline" title="Change Password" subtitle="Update your freight account password." />

                  <TextInput style={styles.input} placeholder="Current password" placeholderTextColor="#94A3B8" value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry />
                  <TextInput style={styles.input} placeholder="New password" placeholderTextColor="#94A3B8" value={newPassword} onChangeText={setNewPassword} secureTextEntry />
                  <TextInput style={styles.input} placeholder="Confirm new password" placeholderTextColor="#94A3B8" value={confirmNewPassword} onChangeText={setConfirmNewPassword} secureTextEntry />

                  <TouchableOpacity style={[styles.darkButtonInline, passwordSaving && styles.disabledButton]} onPress={changePassword} disabled={passwordSaving}>
                    {passwordSaving ? <ActivityIndicator color={COLORS.white} /> : <><Ionicons name="lock-closed-outline" size={18} color={COLORS.white} /><Text style={styles.darkButtonText}>Change Password</Text></>}
                  </TouchableOpacity>
                </View>

                <View style={styles.card}>
                  <SectionHeader icon="card-outline" title="Manage Subscription" subtitle="Manage billing, payment method, cancellation, or Connect Bank." />

                  <TouchableOpacity style={[styles.darkButtonInline, billingLoading && styles.disabledButton]} onPress={manageSubscription} disabled={billingLoading}>
                    {billingLoading ? <ActivityIndicator color={COLORS.white} /> : <><Ionicons name="open-outline" size={18} color={COLORS.white} /><Text style={styles.darkButtonText}>Manage Freight Membership</Text></>}
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.secondaryButton} onPress={() => goTo(ROUTES.connectBank)}>
                    <Ionicons name="business-outline" size={18} color={COLORS.primary} />
                    <Text style={styles.secondaryButtonText}>Open Connect Bank</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={[styles.cancelButton, cancelLoading && styles.disabledButton]} onPress={cancelSubscription} disabled={cancelLoading}>
                    {cancelLoading ? <ActivityIndicator color={COLORS.white} /> : <><Ionicons name="close-circle-outline" size={18} color={COLORS.white} /><Text style={styles.darkButtonText}>Cancel Freight Subscription</Text></>}
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.bottomActions}>
                <TouchableOpacity style={styles.primaryButton} onPress={() => goTo(ROUTES.dashboard)}>
                  <Ionicons name="grid-outline" size={18} color={COLORS.white} />
                  <Text style={styles.primaryButtonText}>Freight Dashboard</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.darkButtonInline} onPress={logout}>
                  <Ionicons name="log-out-outline" size={18} color={COLORS.white} />
                  <Text style={styles.darkButtonText}>Logout</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Label({ text }: { text: string }) {
  return <Text style={styles.label}>{text}</Text>;
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
  subtitle?: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIcon}>
        <Ionicons name={icon} size={20} color={COLORS.white} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {!!subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
      </View>
    </View>
  );
}

function QuickNav({
  icon,
  label,
  route,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  route: FreightRoute;
}) {
  return (
    <TouchableOpacity style={styles.quickCard} onPress={() => goTo(route)}>
      <View style={styles.quickIcon}>
        <Ionicons name={icon} size={22} color={COLORS.primary} />
      </View>
      <Text style={styles.quickText}>{label}</Text>
    </TouchableOpacity>
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

function IdRow({ label, value }: { label: string; value?: string }) {
  return (
    <View style={styles.idRow}>
      <Text style={styles.idLabel}>{label}</Text>
      <Text style={[styles.idValue, !value && styles.idMissing]} numberOfLines={1}>{value || "Missing"}</Text>
    </View>
  );
}

function SwitchRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.switchRow}>
      <Text style={styles.switchLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: "#CBD5E1", true: "#C7D2FE" }}
        thumbColor={value ? COLORS.primary : COLORS.white}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  keyboard: { flex: 1, backgroundColor: COLORS.bg },
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingBottom: 90 },
  center: { flex: 1, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center", padding: 24 },
  centerText: { color: COLORS.muted, marginTop: 12, fontWeight: "800" },
  shell: { flex: 1, flexDirection: Platform.OS === "web" ? "row" : "column", minHeight: Platform.OS === "web" ? 900 : undefined },
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
  avatarText: { color: COLORS.white, fontSize: 18, fontWeight: "900" },
  brandTitle: { color: COLORS.white, fontSize: 21, fontWeight: "900" },
  brandSubtitle: { color: "#A5B4FC", fontWeight: "800", marginTop: 2 },
  sideDivider: { height: 1, backgroundColor: "#1E293B", marginVertical: 22 },
  sidebarLink: { borderRadius: 16, paddingVertical: 13, paddingHorizontal: 14, flexDirection: "row", gap: 10, alignItems: "center", marginBottom: 8 },
  sidebarLinkActive: { backgroundColor: COLORS.primary },
  sidebarLinkText: { color: "#CBD5E1", fontWeight: "900" },
  sidebarLinkTextActive: { color: COLORS.white },
  carrierPanel: { backgroundColor: "#0F172A", borderWidth: 1, borderColor: "#1E293B", borderRadius: 18, padding: 14, marginTop: 12 },
  carrierLabel: { color: "#A5B4FC", fontWeight: "900", textTransform: "uppercase", fontSize: 11 },
  carrierName: { color: COLORS.white, fontWeight: "900", marginTop: 6 },
  carrierSub: { color: "#CBD5E1", fontWeight: "700", marginTop: 4 },
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
  topButton: { width: 50, height: 50, borderRadius: 18, backgroundColor: COLORS.primarySoft, alignItems: "center", justifyContent: "center" },
  eyebrow: { color: COLORS.primary, fontWeight: "900", fontSize: 12, letterSpacing: 1, textTransform: "uppercase" },
  pageTitle: { color: COLORS.text, fontSize: 34, fontWeight: "900", marginTop: 6 },
  pageSubtitle: { color: COLORS.muted, fontWeight: "700", lineHeight: 22, marginTop: 7, maxWidth: 760 },
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
  profileAvatar: { width: 58, height: 58, borderRadius: 22, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  profileAvatarText: { color: COLORS.white, fontSize: 20, fontWeight: "900" },
  companyName: { color: COLORS.text, fontSize: 20, fontWeight: "900" },
  companyEmail: { color: COLORS.muted, fontWeight: "700", marginTop: 4 },
  accountId: { color: COLORS.muted, fontWeight: "800", marginTop: 4, fontSize: 12 },
  statusMini: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8 },
  statusMiniText: { color: COLORS.white, fontWeight: "900", fontSize: 12, textTransform: "capitalize" },
  metricGrid: { flexDirection: Platform.OS === "web" ? "row" : "column", gap: 12, marginBottom: 14 },
  metricCard: { flex: 1, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: 22, padding: 16 },
  metricIcon: { width: 42, height: 42, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  metricGood: { backgroundColor: COLORS.greenSoft },
  metricWarn: { backgroundColor: COLORS.amberSoft },
  metricLabel: { color: COLORS.muted, fontWeight: "900", fontSize: 11, textTransform: "uppercase" },
  metricValue: { color: COLORS.text, fontWeight: "900", fontSize: 18, marginTop: 5 },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
  quickCard: {
    width: Platform.OS === "web" ? "23.5%" : "48%",
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 102,
    justifyContent: "space-between",
  },
  quickIcon: { width: 42, height: 42, borderRadius: 15, backgroundColor: COLORS.primarySoft, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  quickText: { color: COLORS.text, fontWeight: "900" },
  gridTwo: { flexDirection: Platform.OS === "web" ? "row" : "column", gap: 14, alignItems: "flex-start" },
  card: { flex: 1, width: "100%", backgroundColor: COLORS.card, padding: 18, borderRadius: 22, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border },
  sectionHeader: { flexDirection: "row", gap: 10, alignItems: "flex-start", marginBottom: 14 },
  sectionIcon: { width: 40, height: 40, borderRadius: 16, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  sectionTitle: { fontSize: 21, fontWeight: "900", color: COLORS.text },
  sectionSubtitle: { color: COLORS.muted, fontWeight: "700", lineHeight: 20, marginTop: 3 },
  label: { color: COLORS.text, marginTop: 8, marginBottom: 6, fontWeight: "900" },
  input: { backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, padding: 14, fontWeight: "700", marginBottom: 8, color: COLORS.text },
  switchRow: {
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 13,
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  switchLabel: { color: COLORS.text, fontWeight: "900", flex: 1 },
  valueBox: { backgroundColor: COLORS.panel, borderRadius: 14, padding: 13, borderWidth: 1, borderColor: COLORS.border, flexDirection: "row", gap: 10, marginTop: 10 },
  valueLabel: { color: COLORS.primary, fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  value: { fontSize: 15, fontWeight: "800", color: COLORS.text, lineHeight: 22, marginTop: 3 },
  idGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  idRow: { width: Platform.OS === "web" ? "31.5%" : "100%", backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, padding: 13 },
  idLabel: { color: COLORS.muted, fontWeight: "900", textTransform: "uppercase", fontSize: 11 },
  idValue: { color: COLORS.text, fontWeight: "900", marginTop: 5 },
  idMissing: { color: COLORS.amber },
  primaryButton: {
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
  },
  primaryButtonText: { color: COLORS.white, fontWeight: "900", textAlign: "center" },
  secondaryButton: {
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
  },
  secondaryButtonText: { color: COLORS.primary, fontWeight: "900", textAlign: "center" },
  darkButtonInline: { backgroundColor: COLORS.navy, padding: 16, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 10, flexDirection: "row", gap: 8 },
  darkButtonText: { color: COLORS.white, fontWeight: "900", textAlign: "center" },
  cancelButton: { backgroundColor: COLORS.red, padding: 16, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 10, flexDirection: "row", gap: 8 },
  bottomActions: { flexDirection: Platform.OS === "web" ? "row" : "column", gap: 10, marginBottom: 40 },
  disabledButton: { opacity: 0.65 },
  emptyTitle: { fontSize: 22, fontWeight: "900", color: COLORS.text, marginBottom: 16 },
});
