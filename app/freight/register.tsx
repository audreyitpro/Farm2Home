// app/freight/register.tsx

import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
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
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../data/supabaseClient";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  "https://farm2home-production-e4bd.up.railway.app";

const APP_URL =
  process.env.EXPO_PUBLIC_APP_URL || "https://farm2home-rho.vercel.app";

const COLORS = {
  bg: "#F6F7FB",
  card: "#FFFFFF",
  surface: "#F8FAFC",
  surface2: "#F1F5F9",
  primary: "#635BFF",
  primaryDark: "#4638D8",
  primarySoft: "#EEF2FF",
  accent: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
  text: "#101828",
  muted: "#667085",
  border: "#E5E7EB",
  dark: "#111827",
  white: "#FFFFFF",
};

const SECURITY_QUESTIONS = [
  "What was the name of your first pet?",
  "What city were you born in?",
  "What is your mother’s maiden name?",
  "What was the name of your elementary school?",
  "What was your first car?",
  "What is your favorite food?",
  "What was the name of your childhood best friend?",
  "What street did you grow up on?",
  "What is your favorite teacher’s name?",
  "What was your first delivery vehicle?",
];

const STEPS = [
  { key: "account", title: "Account", icon: "person-outline" },
  { key: "company", title: "Company", icon: "business-outline" },
  { key: "authority", title: "Authority", icon: "shield-checkmark-outline" },
  { key: "security", title: "Security", icon: "key-outline" },
  { key: "stripe", title: "Stripe", icon: "card-outline" },
  { key: "review", title: "Review", icon: "checkmark-done-outline" },
] as const;

const EQUIPMENT_OPTIONS = [
  { key: "dry_van", label: "Dry Van", icon: "cube-outline" },
  { key: "reefer", label: "Reefer", icon: "snow-outline" },
  { key: "box_truck", label: "Box Truck", icon: "file-tray-stacked-outline" },
  { key: "flatbed", label: "Flatbed", icon: "layers-outline" },
  { key: "livestock", label: "Livestock", icon: "paw-outline" },
  { key: "produce", label: "Produce", icon: "leaf-outline" },
];

function clean(value: any) {
  return String(value || "").trim();
}

function normalize(value: any) {
  return clean(value).toLowerCase();
}

function normalizeAnswer(value: any) {
  return normalize(value);
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

function pickStripeCustomerId(...values: any[]) {
  const found = values.find((value) => isStripeCustomerId(value));
  return found ? clean(found) : "";
}

function pickStripeSubscriptionId(...values: any[]) {
  const found = values.find((value) => isStripeSubscriptionId(value));
  return found ? clean(found) : "";
}

function pickStripeConnectAccountId(...values: any[]) {
  const found = values.find((value) => isStripeConnectAccountId(value));
  return found ? clean(found) : "";
}

function keepValue(newValue: any, oldValue: any) {
  const cleaned = String(newValue ?? "").trim();
  return cleaned.length > 0 ? newValue : oldValue;
}

function makeFallbackAccountId() {
  return `Freight_${Date.now()}`;
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
  await AsyncStorage.setItem("pendingFreightCarrier", JSON.stringify(carrier));
  await AsyncStorage.setItem("currentFreightCarrier", JSON.stringify(carrier));
  await AsyncStorage.setItem("currentFreight", JSON.stringify(carrier));
  await AsyncStorage.setItem("currentFreightUser", JSON.stringify(carrier));
  await AsyncStorage.setItem("currentUser", JSON.stringify(carrier));
  await AsyncStorage.setItem("farm2homeCurrentFreight", JSON.stringify(carrier));
  await AsyncStorage.setItem("userRole", "freight");
  await AsyncStorage.setItem("currentUserRole", "freight");
}

export default function FreightRegister() {
  const params = useLocalSearchParams();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [syncingStripe, setSyncingStripe] = useState(false);
  const [connectLoading, setConnectLoading] = useState(false);
  const [processingReturn, setProcessingReturn] = useState(false);
  const [autoRouting, setAutoRouting] = useState(false);

  const [savedCarrierId, setSavedCarrierId] = useState("");
  const [freightId, setFreightId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [stripeCustomerId, setStripeCustomerId] = useState("");
  const [freightAccount, setFreightAccount] = useState("");
  const [subscriptionId, setSubscriptionId] = useState("");
  const [subscriptionStatus, setSubscriptionStatus] = useState("");

  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceArea, setServiceArea] = useState("");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [securityQuestion1, setSecurityQuestion1] = useState("");
  const [securityAnswer1, setSecurityAnswer1] = useState("");
  const [securityQuestion2, setSecurityQuestion2] = useState("");
  const [securityAnswer2, setSecurityAnswer2] = useState("");
  const [securityQuestion3, setSecurityQuestion3] = useState("");
  const [securityAnswer3, setSecurityAnswer3] = useState("");
  const [hasSavedSecurityAnswer1, setHasSavedSecurityAnswer1] = useState(false);
  const [hasSavedSecurityAnswer2, setHasSavedSecurityAnswer2] = useState(false);
  const [hasSavedSecurityAnswer3, setHasSavedSecurityAnswer3] = useState(false);

  const [businessAddress, setBusinessAddress] = useState("");
  const [city, setCity] = useState("");
  const [stateValue, setStateValue] = useState("");
  const [zipCode, setZipCode] = useState("");

  const [mdotNumber, setMdotNumber] = useState("");
  const [mcNumber, setMcNumber] = useState("");
  const [insuranceProvider, setInsuranceProvider] = useState("");
  const [insurancePolicyNumber, setInsurancePolicyNumber] = useState("");

  const [authorityActive, setAuthorityActive] = useState(false);
  const [insuranceActive, setInsuranceActive] = useState(false);
  const [licensedLivestock, setLicensedLivestock] = useState(false);
  const [licensedRefrigeratedFood, setLicensedRefrigeratedFood] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);

  const selectedQuestions = useMemo(
    () => [securityQuestion1, securityQuestion2, securityQuestion3].filter(Boolean),
    [securityQuestion1, securityQuestion2, securityQuestion3]
  );

  const hasActiveSubscription = useMemo(() => {
    return Boolean(
      isStripeSubscriptionId(subscriptionId) &&
        ["active", "trialing", "past_due"].includes(normalize(subscriptionStatus || "active"))
    );
  }, [subscriptionId, subscriptionStatus]);

  const hasStripeConnectAccount = useMemo(() => isStripeConnectAccountId(freightAccount), [freightAccount]);
  const registrationReadyForDashboard = useMemo(
    () => Boolean(hasActiveSubscription && hasStripeConnectAccount),
    [hasActiveSubscription, hasStripeConnectAccount]
  );

  const allFiveRequirementsFound = useMemo(() => {
    return Boolean(
      freightId &&
        accountId &&
        isStripeCustomerId(stripeCustomerId) &&
        isStripeSubscriptionId(subscriptionId) &&
        hasStripeConnectAccount &&
        ["active", "trialing", "past_due"].includes(normalize(subscriptionStatus || "active"))
    );
  }, [freightId, accountId, stripeCustomerId, subscriptionId, subscriptionStatus, hasStripeConnectAccount]);

  const setupScore = useMemo(() => {
    let score = 0;
    if (freightId) score += 1;
    if (accountId) score += 1;
    if (isStripeCustomerId(stripeCustomerId)) score += 1;
    if (isStripeSubscriptionId(subscriptionId)) score += 1;
    if (isStripeConnectAccountId(freightAccount)) score += 1;
    return score;
  }, [freightId, accountId, stripeCustomerId, subscriptionId, freightAccount]);

  function objectHasCompleteFreightSetup(row: any) {
    return Boolean(
      clean(row?.id || row?.freightId || row?.freight_id || freightId || savedCarrierId) &&
        clean(row?.account_id || row?.accountId || accountId) &&
        pickStripeCustomerId(row?.stripe_customer_id, row?.stripeCustomerId, stripeCustomerId) &&
        pickStripeSubscriptionId(row?.stripe_subscription_id, row?.subscription_id, row?.stripeSubscriptionId, row?.subscriptionId, subscriptionId) &&
        pickStripeConnectAccountId(row?.freight_account, row?.stripe_account_id, row?.freightAccount, row?.stripeAccountId, freightAccount)
    );
  }

  function objectHasActiveSubscription(row: any) {
    return Boolean(
      pickStripeSubscriptionId(row?.stripe_subscription_id, row?.subscription_id, row?.stripeSubscriptionId, row?.subscriptionId, subscriptionId) &&
        ["active", "trialing", "past_due"].includes(normalize(row?.subscription_status || row?.subscriptionStatus || subscriptionStatus || "active"))
    );
  }


  useEffect(() => {
    loadSavedFreight();
  }, []);

  useEffect(() => {
    if (!allFiveRequirementsFound) return;
    if (saving || stripeLoading || connectLoading || syncingStripe || processingReturn || autoRouting) return;

    autoOpenDashboardWhenReady();
  }, [
    allFiveRequirementsFound,
    saving,
    stripeLoading,
    connectLoading,
    syncingStripe,
    processingReturn,
    autoRouting,
  ]);

  useEffect(() => {
    const stripeStatus = String(params?.stripe || params?.payment || "");
    const connectStatus = String(params?.connect || params?.connected || "");
    const returnedFreightId = String(params?.freightId || params?.freight_id || "");

    if (stripeStatus === "success") {
      handleStripeSuccessReturn(returnedFreightId);
      return;
    }

    if (connectStatus === "success" || connectStatus === "true") {
      handleConnectSuccessReturn(returnedFreightId);
    }
  }, [
    params?.stripe,
    params?.payment,
    params?.connect,
    params?.connected,
    params?.freightId,
    params?.freight_id,
  ]);

  function toggleEquipment(key: string) {
    setSelectedEquipment((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    );
  }

  function goNext() {
    setStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  }

  function goBack() {
    setStep((prev) => Math.max(prev - 1, 0));
  }

  function goDashboard() {
    router.replace("/freight/dashboard" as any);
  }

  async function autoOpenDashboardWhenReady() {
    const finalId = savedCarrierId || freightId;

    if (!finalId) return;
    if (!allFiveRequirementsFound) return;

    try {
      setAutoRouting(true);

      const readySnapshot = buildCurrentFreightSnapshot({
        id: finalId,
        freight_id: finalId,
        account_id: accountId,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: subscriptionId,
        subscription_id: subscriptionId,
        subscription_status: subscriptionStatus || "active",
        freight_account: freightAccount,
        stripe_account_id: freightAccount,
        account_active: true,
        membership_status: "active",
        application_submitted: true,
      });

      await saveFreightSnapshot(readySnapshot);

      await markApplicationSubmittedAndOpenDashboard(finalId, {
        stripeCustomerId,
        stripeSubscriptionId: subscriptionId,
        subscriptionStatus: subscriptionStatus || "active",
      });
    } catch (error: any) {
      console.log("AUTO DASHBOARD ROUTE ERROR:", error?.message || error);
      setAutoRouting(false);
    }
  }

  async function forceRefreshFreightRegister() {
    try {
      setSyncingStripe(true);

      // IMPORTANT: do not clear AsyncStorage here. Clearing these keys is what makes the form boxes go blank.
      await supabase.auth.refreshSession();
      const restored = await retrieveMissingStripeInfo(false);
      if (!restored) await loadSavedFreight();

      Alert.alert("Updated", "Freight registration refreshed without clearing your form.");
    } catch (error: any) {
      Alert.alert("Refresh Error", error?.message || "Unable to refresh registration.");
    } finally {
      setSyncingStripe(false);
    }
  }

  async function handleStripeSuccessReturn(returnedFreightId?: string) {
    if (processingReturn) return;

    try {
      setProcessingReturn(true);

      if (returnedFreightId) {
        setSavedCarrierId(returnedFreightId);
        setFreightId(returnedFreightId);
      }

      await loadSavedFreight();
      const synced = await forceSyncFreightSubscription(true, returnedFreightId);

      const syncedSubscriptionId = pickStripeSubscriptionId(
        synced?.stripeSubscriptionId,
        synced?.stripe_subscription_id,
        synced?.subscriptionId,
        synced?.subscription_id
      );

      if (!syncedSubscriptionId) {
        Alert.alert(
          "Payment Processing",
          "Stripe payment completed, but the subscription is still syncing. Tap Find Stripe Info."
        );
        return;
      }

      await markApplicationSubmittedAndOpenDashboard(returnedFreightId || savedCarrierId || freightId, {
        stripeCustomerId: pickStripeCustomerId(synced?.stripeCustomerId, synced?.stripe_customer_id),
        stripeSubscriptionId: syncedSubscriptionId,
        subscriptionStatus: synced?.subscriptionStatus || synced?.subscription_status || "active",
      });
    } catch (error: any) {
      Alert.alert("Stripe Return Error", error?.message || "Unable to complete freight registration.");
    } finally {
      setProcessingReturn(false);
    }
  }

  async function handleConnectSuccessReturn(returnedFreightId?: string) {
    if (processingReturn) return;

    try {
      setProcessingReturn(true);

      const targetId = returnedFreightId || savedCarrierId || freightId;

      if (targetId) {
        setSavedCarrierId(targetId);
        setFreightId(targetId);
      }

      const pendingRaw =
        (await AsyncStorage.getItem("pendingFreightCarrier")) ||
        (await AsyncStorage.getItem("currentFreightCarrier")) ||
        (await AsyncStorage.getItem("currentFreight")) ||
        (await AsyncStorage.getItem("currentFreightUser")) ||
        (await AsyncStorage.getItem("farm2homeCurrentFreight")) ||
        (await AsyncStorage.getItem("currentUser"));

      let pendingCarrier: any = null;

      if (pendingRaw) {
        try {
          pendingCarrier = JSON.parse(pendingRaw);
          hydrateForm(pendingCarrier);
        } catch {
          pendingCarrier = null;
        }
      }

      const lookupId =
        targetId ||
        pendingCarrier?.id ||
        pendingCarrier?.freightId ||
        pendingCarrier?.freight_id ||
        "";

      const lookupEmail = normalize(pendingCarrier?.email || email);

      let dbCarrier: any = null;

      if (lookupId) {
        const { data } = await supabase
          .from("freight_users")
          .select("*")
          .or(`id.eq.${lookupId},freight_id.eq.${lookupId},auth_user_id.eq.${lookupId},profile_id.eq.${lookupId}`)
          .limit(1);

        dbCarrier = Array.isArray(data) && data.length > 0 ? data[0] : null;
      }

      if (!dbCarrier && lookupEmail) {
        const { data } = await supabase
          .from("freight_users")
          .select("*")
          .eq("email", lookupEmail)
          .limit(1);

        dbCarrier = Array.isArray(data) && data.length > 0 ? data[0] : null;
      }

      if (!dbCarrier?.id) {
        Alert.alert(
          "Connect Returned",
          "Stripe Connect returned, but the freight profile could not be found. Your form data was kept. Tap Find / Retrieve Missing Stripe Info."
        );
        return;
      }

      const subRow = await getBestFreightSubscription(dbCarrier.id, normalize(dbCarrier.email || lookupEmail));

      const merged = mergeCarrierAndSubscription(dbCarrier, subRow);
      hydrateForm(merged);
      await saveHydratedSession(merged);

      const mergedSubscriptionId = pickStripeSubscriptionId(
        merged.stripe_subscription_id,
        merged.subscription_id,
        subRow?.stripe_subscription_id,
        subscriptionId
      );

      const mergedConnectAccount = pickStripeConnectAccountId(
        merged.freight_account,
        merged.stripe_account_id,
        subRow?.freight_account,
        subRow?.stripe_account_id,
        freightAccount
      );

      if (mergedConnectAccount) setFreightAccount(mergedConnectAccount);
      if (mergedSubscriptionId) setSubscriptionId(mergedSubscriptionId);
      if (merged.subscription_status || subRow?.subscription_status) {
        setSubscriptionStatus(merged.subscription_status || subRow?.subscription_status || "active");
      }

      if (
        dbCarrier.id &&
        (merged.account_id || accountId) &&
        pickStripeCustomerId(merged.stripe_customer_id, subRow?.stripe_customer_id, stripeCustomerId) &&
        mergedSubscriptionId &&
        mergedConnectAccount
      ) {
        await markApplicationSubmittedAndOpenDashboard(dbCarrier.id, {
          stripeCustomerId: pickStripeCustomerId(merged.stripe_customer_id, subRow?.stripe_customer_id, stripeCustomerId),
          stripeSubscriptionId: mergedSubscriptionId,
          subscriptionStatus: merged.subscription_status || subRow?.subscription_status || "active",
        });
        return;
      }

      setStep(4);
      Alert.alert(
        "Stripe Connect Saved",
        mergedSubscriptionId
          ? "Stripe Connect is saved. Complete any remaining setup, then submit to dashboard."
          : "Stripe Connect is saved. Start or restore the Stripe Membership, then submit to dashboard."
      );
    } catch (error: any) {
      Alert.alert("Connect Return Error", error?.message || "Unable to complete Stripe Connect return.");
    } finally {
      setProcessingReturn(false);
    }
  }

  async function getBestFreightSubscription(targetId?: string, targetEmail?: string) {
    const cleanId = clean(targetId);
    const cleanEmail = normalize(targetEmail);

    const filters = [
      cleanId ? `freight_id.eq.${cleanId}` : "",
      cleanEmail ? `freight_email.eq.${cleanEmail}` : "",
    ]
      .filter(Boolean)
      .join(",");

    if (!filters) return null;

    const { data, error } = await supabase
      .from("freight_subscriptions")
      .select("*")
      .or(filters)
      .order("updated_at", { ascending: false })
      .limit(10);

    if (error) {
      console.log("BEST FREIGHT SUBSCRIPTION ERROR:", error.message);
      return null;
    }

    if (!Array.isArray(data) || data.length === 0) return null;

    const completeRow = data.find(
      (row) =>
        pickStripeCustomerId(row?.stripe_customer_id) &&
        pickStripeSubscriptionId(row?.stripe_subscription_id) &&
        pickStripeConnectAccountId(row?.stripe_account_id, row?.freight_account)
    );

    return completeRow || data[0];
  }

  async function findFreightUserByIdOrEmail(targetId?: string, targetEmail?: string) {
    const cleanId = clean(targetId);
    const cleanEmail = normalize(targetEmail);

    const filters = [
      cleanId ? `id.eq.${cleanId}` : "",
      cleanId ? `freight_id.eq.${cleanId}` : "",
      cleanId ? `auth_user_id.eq.${cleanId}` : "",
      cleanId ? `profile_id.eq.${cleanId}` : "",
      cleanEmail ? `email.eq.${cleanEmail}` : "",
    ]
      .filter(Boolean)
      .join(",");

    if (!filters) return null;

    const { data, error } = await supabase
      .from("freight_users")
      .select("*")
      .or(filters)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (error) {
      console.log("FREIGHT USER LOOKUP ERROR:", error.message);
      return null;
    }

    return Array.isArray(data) && data.length > 0 ? data[0] : null;
  }

  async function syncCompleteFreightAccountIfReady(sourceCarrier: any, sourceSub: any = null, routeWhenReady = false) {
    const merged = mergeCarrierAndSubscription(sourceCarrier || {}, sourceSub || {});
    const finalId = clean(merged?.id || merged?.freight_id || savedCarrierId || freightId);
    const finalEmail = normalize(merged?.email || email);
    const finalAccountId = clean(merged?.account_id || accountId);
    const finalCustomerId = pickStripeCustomerId(merged?.stripe_customer_id, sourceSub?.stripe_customer_id, stripeCustomerId);
    const finalSubscriptionId = pickStripeSubscriptionId(
      merged?.stripe_subscription_id,
      merged?.subscription_id,
      sourceSub?.stripe_subscription_id,
      subscriptionId
    );
    const finalConnectAccount = pickStripeConnectAccountId(
      merged?.freight_account,
      merged?.stripe_account_id,
      sourceSub?.freight_account,
      sourceSub?.stripe_account_id,
      freightAccount
    );
    const finalStatus = merged?.subscription_status || sourceSub?.subscription_status || subscriptionStatus || "active";

    const hydrated = {
      ...merged,
      id: finalId,
      freight_id: finalId,
      account_id: finalAccountId,
      email: finalEmail,
      stripe_customer_id: finalCustomerId,
      stripe_subscription_id: finalSubscriptionId,
      subscription_id: finalSubscriptionId,
      subscription_status: finalStatus,
      freight_account: finalConnectAccount,
      stripe_account_id: finalConnectAccount,
      account_active: Boolean(finalId && finalAccountId && finalCustomerId && finalSubscriptionId && finalConnectAccount),
      membership_status: finalSubscriptionId ? "active" : merged?.membership_status || "pending_payment",
      freight_membership_paid: Boolean(finalSubscriptionId),
      registration_complete: Boolean(finalId && finalAccountId && finalCustomerId && finalSubscriptionId && finalConnectAccount),
      application_submitted: Boolean(finalId && finalAccountId && finalCustomerId && finalSubscriptionId && finalConnectAccount),
      updated_at: new Date().toISOString(),
    };

    hydrateForm(hydrated);
    await saveHydratedSession(hydrated);

    if (finalId && finalAccountId && finalCustomerId && finalSubscriptionId && finalConnectAccount) {
      const updatePayload = {
        account_active: true,
        approved: true,
        registration_complete: true,
        application_submitted: true,
        freight_membership_paid: true,
        membership_status: "active",
        subscription_status: finalStatus || "active",
        stripe_customer_id: finalCustomerId,
        stripe_subscription_id: finalSubscriptionId,
        subscription_id: finalSubscriptionId,
        freight_account: finalConnectAccount,
        stripe_account_id: finalConnectAccount,
        verification_status: "SUBMITTED",
        compliance_status: "SUBMITTED",
        admin_review_status: "submitted",
        updated_at: new Date().toISOString(),
      };

      await supabase.from("freight_users").update(updatePayload).eq("id", finalId);

      await safeUpsertProfile(finalId, {
        id: finalId,
        auth_user_id: finalId,
        profile_id: finalId,
        role: "freight",
        email: finalEmail,
        account_id: finalAccountId,
        full_name: contactName.trim() || hydrated.contact_name || hydrated.name || "",
        name: contactName.trim() || hydrated.contact_name || hydrated.name || "",
        company_name: companyName.trim() || hydrated.company_name || hydrated.business_name || "",
        stripe_customer_id: finalCustomerId,
        stripe_subscription_id: finalSubscriptionId,
        subscription_id: finalSubscriptionId,
        freight_account: finalConnectAccount,
        stripe_account_id: finalConnectAccount,
        membership_status: "active",
        subscription_status: finalStatus || "active",
        account_active: true,
        registration_complete: true,
        application_submitted: true,
        updated_at: new Date().toISOString(),
      });

      await upsertFreightSubscriptionRow({
        freightId: finalId,
        accountId: finalAccountId,
        stripeCustomerId: finalCustomerId,
        stripeSubscriptionId: finalSubscriptionId,
        stripeAccountId: finalConnectAccount,
        subscriptionStatus: finalStatus || "active",
      });

      if (routeWhenReady) {
        await saveHydratedSession({
          ...hydrated,
          ...updatePayload,
        });
        router.replace("/freight/dashboard" as any);
      }
    }

    return hydrated;
  }

  async function retrieveMissingStripeInfo(routeWhenReady = false) {
    const targetId = savedCarrierId || freightId || clean(String(params?.freightId || params?.freight_id || ""));
    const targetEmail = normalize(email || String(params?.email || ""));

    if (!targetId && !targetEmail) {
      Alert.alert("Search Required", "Enter your freight email or save registration first.");
      return null;
    }

    try {
      setSyncingStripe(true);

      const dbCarrier = await findFreightUserByIdOrEmail(targetId, targetEmail);
      const subRow = await getBestFreightSubscription(dbCarrier?.id || targetId, dbCarrier?.email || targetEmail);

      if (!dbCarrier && !subRow) {
        const backendSync = await syncStripeByEmail(targetEmail, true);
        const forcedSync = backendSync || (await forceSyncFreightSubscription(true, targetId));

        if (!forcedSync) {
          Alert.alert("Not Found", "No freight Stripe records were found for this email or freight ID.");
          return null;
        }

        await loadSavedFreight();
        return forcedSync;
      }

      const baseCarrier =
        dbCarrier || {
          id: targetId || subRow?.freight_id,
          freight_id: targetId || subRow?.freight_id,
          account_id: accountId,
          email: targetEmail || subRow?.freight_email,
          company_name: companyName || subRow?.name || "",
          business_name: companyName || subRow?.name || "",
          contact_name: contactName || subRow?.name || "",
          username: username || subRow?.username || "",
        };

      const synced = await syncCompleteFreightAccountIfReady(baseCarrier, subRow, routeWhenReady);

      if (!routeWhenReady) {
        Alert.alert("Stripe Info Retrieved", "Freight Stripe IDs were restored without clearing the form.");
      }

      return synced;
    } catch (error: any) {
      Alert.alert("Retrieve Error", error?.message || "Unable to retrieve freight Stripe information.");
      return null;
    } finally {
      setSyncingStripe(false);
    }
  }

  async function loadSavedFreight() {
    try {
      const returnedId = clean(String(params?.freightId || params?.freight_id || ""));
      const returnedEmail = normalize(String(params?.email || ""));

      const saved =
        (await AsyncStorage.getItem("pendingFreightCarrier")) ||
        (await AsyncStorage.getItem("currentFreightCarrier")) ||
        (await AsyncStorage.getItem("currentFreight")) ||
        (await AsyncStorage.getItem("currentFreightUser")) ||
        (await AsyncStorage.getItem("farm2homeCurrentFreight")) ||
        (await AsyncStorage.getItem("currentUser"));

      let localCarrier: any = null;
      if (saved) {
        try {
          localCarrier = JSON.parse(saved);
          hydrateForm(localCarrier);
        } catch {
          localCarrier = null;
        }
      }

      const { data: authData } = await supabase.auth.getUser();
      const authId = clean(authData?.user?.id || "");
      const authEmail = normalize(authData?.user?.email || "");
      const lookupId = returnedId || authId || localCarrier?.id || localCarrier?.freightId || localCarrier?.freight_id || savedCarrierId || freightId;
      const lookupEmail = normalize(returnedEmail || authEmail || localCarrier?.email || email);

      if (!lookupEmail && !lookupId) return;

      const dbCarrier = await findFreightUserByIdOrEmail(lookupId, lookupEmail);
      const subData = await getBestFreightSubscription(dbCarrier?.id || lookupId, dbCarrier?.email || lookupEmail);

      if (dbCarrier?.id || subData) {
        const baseCarrier =
          dbCarrier || {
            id: lookupId || subData?.freight_id,
            freight_id: lookupId || subData?.freight_id,
            account_id: accountId || localCarrier?.account_id || localCarrier?.accountId || "",
            email: lookupEmail || subData?.freight_email,
            company_name: companyName || localCarrier?.company_name || localCarrier?.business_name || subData?.name || "",
            business_name: companyName || localCarrier?.business_name || localCarrier?.company_name || subData?.name || "",
            contact_name: contactName || localCarrier?.contact_name || localCarrier?.name || subData?.name || "",
            username: username || localCarrier?.username || subData?.username || "",
          };

        await syncCompleteFreightAccountIfReady(baseCarrier, subData, false);
      }
    } catch (error) {
      console.log("LOAD FREIGHT SESSION ERROR:", error);
    }
  }

  function mergeCarrierAndSubscription(carrier: any, subscriptionRow?: any) {
    return {
      ...carrier,
      stripe_customer_id: pickStripeCustomerId(carrier?.stripe_customer_id, subscriptionRow?.stripe_customer_id),
      stripe_subscription_id: pickStripeSubscriptionId(
        carrier?.stripe_subscription_id,
        carrier?.subscription_id,
        subscriptionRow?.stripe_subscription_id
      ),
      subscription_id: pickStripeSubscriptionId(
        carrier?.subscription_id,
        carrier?.stripe_subscription_id,
        subscriptionRow?.stripe_subscription_id
      ),
      subscription_status: carrier?.subscription_status || subscriptionRow?.subscription_status || "",
      freight_account: pickStripeConnectAccountId(
        carrier?.freight_account,
        carrier?.stripe_account_id,
        subscriptionRow?.freight_account,
        subscriptionRow?.stripe_account_id
      ),
      stripe_account_id: pickStripeConnectAccountId(
        carrier?.stripe_account_id,
        carrier?.freight_account,
        subscriptionRow?.stripe_account_id,
        subscriptionRow?.freight_account
      ),
    };
  }

  async function saveHydratedSession(carrier: any) {
    const connectAccount = pickStripeConnectAccountId(
      carrier.freight_account,
      carrier.freightAccount,
      carrier.stripe_account_id,
      carrier.stripeAccountId
    );

    await saveFreightSession({
      ...carrier,
      id: carrier.id,
      freightId: carrier.freight_id || carrier.id,
      freight_id: carrier.freight_id || carrier.id,
      accountId: carrier.account_id || "",
      account_id: carrier.account_id || "",
      companyName: carrier.company_name || carrier.business_name || "",
      company_name: carrier.company_name || carrier.business_name || "",
      businessName: carrier.business_name || carrier.company_name || "",
      business_name: carrier.business_name || carrier.company_name || "",
      contactName: carrier.contact_name || carrier.name || "",
      contact_name: carrier.contact_name || carrier.name || "",
      stripeCustomerId: pickStripeCustomerId(carrier.stripe_customer_id, carrier.stripeCustomerId),
      stripe_customer_id: pickStripeCustomerId(carrier.stripe_customer_id, carrier.stripeCustomerId),
      freightAccount: connectAccount,
      freight_account: connectAccount,
      stripeAccountId: connectAccount,
      stripe_account_id: connectAccount,
      stripeSubscriptionId: pickStripeSubscriptionId(carrier.stripe_subscription_id, carrier.subscription_id),
      stripe_subscription_id: pickStripeSubscriptionId(carrier.stripe_subscription_id, carrier.subscription_id),
      subscriptionId: pickStripeSubscriptionId(carrier.subscription_id, carrier.stripe_subscription_id),
      subscription_id: pickStripeSubscriptionId(carrier.subscription_id, carrier.stripe_subscription_id),
      subscriptionStatus: carrier.subscription_status || "",
      role: "freight",
    });
  }

  function hydrateStripeOnly(row: any) {
    const rowCustomerId = pickStripeCustomerId(row.stripe_customer_id, row.stripeCustomerId, stripeCustomerId);
    const rowSubscriptionId = pickStripeSubscriptionId(row.stripe_subscription_id, row.subscription_id, subscriptionId);
    const rowFreightAccount = pickStripeConnectAccountId(
      row.freight_account,
      row.freightAccount,
      row.stripe_account_id,
      row.stripeAccountId,
      freightAccount
    );

    setStripeCustomerId(rowCustomerId);
    setSubscriptionId(rowSubscriptionId);
    setSubscriptionStatus(row.subscription_status || subscriptionStatus || "");
    setFreightAccount(rowFreightAccount);
    if (row.account_id) setAccountId(row.account_id);
    if (row.id) {
      setFreightId(row.id);
      setSavedCarrierId(row.id);
    }
  }

  function hydrateForm(carrier: any) {
    const dbFreightId = carrier.id || carrier.freightId || carrier.freight_id || "";
    const dbStripeCustomerId = pickStripeCustomerId(carrier.stripe_customer_id, carrier.stripeCustomerId);
    const dbSubscriptionId = pickStripeSubscriptionId(
      carrier.subscriptionId,
      carrier.subscription_id,
      carrier.stripeSubscriptionId,
      carrier.stripe_subscription_id
    );
    const dbFreightAccount = pickStripeConnectAccountId(
      carrier.freight_account,
      carrier.freightAccount,
      carrier.stripe_account_id,
      carrier.stripeAccountId
    );

    setFreightId(dbFreightId);
    setSavedCarrierId(dbFreightId);
    setAccountId(carrier.accountId || carrier.account_id || "");
    setStripeCustomerId(dbStripeCustomerId);
    setSubscriptionId(dbSubscriptionId);
    setSubscriptionStatus(carrier.subscriptionStatus || carrier.subscription_status || "");
    setFreightAccount(dbFreightAccount);

    setCompanyName(carrier.companyName || carrier.company_name || carrier.business_name || "");
    setContactName(carrier.contactName || carrier.contact_name || carrier.full_name || carrier.name || "");
    setEmail(carrier.email || "");
    setPhone(carrier.phone || "");
    setUsername(carrier.username || "");
    setServiceArea(carrier.serviceArea || carrier.service_area || "");

    setBusinessAddress(carrier.businessAddress || carrier.business_address || "");
    setCity(carrier.city || "");
    setStateValue(carrier.state || "");
    setZipCode(carrier.zipCode || carrier.zip_code || "");

    setMdotNumber(carrier.mdotNumber || carrier.mdot_number || carrier.dot_number || "");
    setMcNumber(carrier.mcNumber || carrier.mc_number || "");
    setInsuranceProvider(carrier.insuranceProvider || carrier.insurance_provider || "");
    setInsurancePolicyNumber(carrier.insurancePolicyNumber || carrier.insurance_policy_number || "");

    setAuthorityActive(Boolean(carrier.authorityActive || carrier.authority_active));
    setInsuranceActive(Boolean(carrier.insuranceActive || carrier.insurance_active));
    setLicensedLivestock(Boolean(carrier.licensedLivestock || carrier.licensed_livestock));
    setLicensedRefrigeratedFood(
      Boolean(carrier.licensedRefrigeratedFood || carrier.licensed_refrigerated_food)
    );

    const equipment = carrier.equipment_types || carrier.equipment_type || carrier.equipment || [];
    if (Array.isArray(equipment)) setSelectedEquipment(equipment.map(String));
    else if (equipment) setSelectedEquipment(String(equipment).split(",").map((item) => normalize(item)));

    setSecurityQuestion1(carrier.security_question_1 || carrier.securityQuestion1 || "");
    setSecurityQuestion2(carrier.security_question_2 || carrier.securityQuestion2 || "");
    setSecurityQuestion3(carrier.security_question_3 || carrier.securityQuestion3 || "");
    setHasSavedSecurityAnswer1(Boolean(carrier.security_answer_1 || carrier.securityAnswer1));
    setHasSavedSecurityAnswer2(Boolean(carrier.security_answer_2 || carrier.securityAnswer2));
    setHasSavedSecurityAnswer3(Boolean(carrier.security_answer_3 || carrier.securityAnswer3));
  }

  function buildCurrentFreightSnapshot(base: any = {}) {
    const currentId = base.id || base.freightId || base.freight_id || savedCarrierId || freightId;
    const currentAccountId = base.account_id || base.accountId || accountId;
    const currentEmail = normalize(base.email || email);
    const currentCompanyName = base.company_name || base.companyName || base.business_name || base.businessName || companyName.trim();
    const currentContactName = base.contact_name || base.contactName || base.full_name || base.name || contactName.trim();
    const currentUsername = normalize(base.username || username);
    const currentCustomerId = pickStripeCustomerId(base.stripe_customer_id, base.stripeCustomerId, stripeCustomerId);
    const currentSubscriptionId = pickStripeSubscriptionId(
      base.stripe_subscription_id,
      base.subscription_id,
      base.stripeSubscriptionId,
      base.subscriptionId,
      subscriptionId
    );
    const currentConnectAccount = pickStripeConnectAccountId(
      base.freight_account,
      base.freightAccount,
      base.stripe_account_id,
      base.stripeAccountId,
      freightAccount
    );

    return {
      ...base,
      id: currentId,
      freightId: currentId,
      freight_id: currentId,
      accountId: currentAccountId,
      account_id: currentAccountId,
      role: "freight",
      companyName: currentCompanyName,
      company_name: currentCompanyName,
      businessName: currentCompanyName,
      business_name: currentCompanyName,
      contactName: currentContactName,
      contact_name: currentContactName,
      fullName: currentContactName,
      full_name: currentContactName,
      name: currentContactName,
      email: currentEmail,
      phone: base.phone || phone.trim(),
      username: currentUsername,
      serviceArea: base.serviceArea || base.service_area || serviceArea.trim(),
      service_area: base.service_area || base.serviceArea || serviceArea.trim(),
      businessAddress: base.businessAddress || base.business_address || businessAddress.trim(),
      business_address: base.business_address || base.businessAddress || businessAddress.trim(),
      city: base.city || city.trim(),
      state: base.state || stateValue.trim().toUpperCase(),
      zipCode: base.zipCode || base.zip_code || zipCode.trim(),
      zip_code: base.zip_code || base.zipCode || zipCode.trim(),
      mdotNumber: base.mdotNumber || base.mdot_number || mdotNumber.trim(),
      mdot_number: base.mdot_number || base.mdotNumber || mdotNumber.trim(),
      dot_number: base.dot_number || base.mdot_number || mdotNumber.trim(),
      mcNumber: base.mcNumber || base.mc_number || mcNumber.trim(),
      mc_number: base.mc_number || base.mcNumber || mcNumber.trim(),
      insuranceProvider: base.insuranceProvider || base.insurance_provider || insuranceProvider.trim(),
      insurance_provider: base.insurance_provider || base.insuranceProvider || insuranceProvider.trim(),
      insurancePolicyNumber: base.insurancePolicyNumber || base.insurance_policy_number || insurancePolicyNumber.trim(),
      insurance_policy_number: base.insurance_policy_number || base.insurancePolicyNumber || insurancePolicyNumber.trim(),
      authorityActive: Boolean(base.authorityActive ?? base.authority_active ?? authorityActive),
      authority_active: Boolean(base.authority_active ?? base.authorityActive ?? authorityActive),
      insuranceActive: Boolean(base.insuranceActive ?? base.insurance_active ?? insuranceActive),
      insurance_active: Boolean(base.insurance_active ?? base.insuranceActive ?? insuranceActive),
      licensedLivestock: Boolean(base.licensedLivestock ?? base.licensed_livestock ?? licensedLivestock),
      licensed_livestock: Boolean(base.licensed_livestock ?? base.licensedLivestock ?? licensedLivestock),
      licensedRefrigeratedFood: Boolean(base.licensedRefrigeratedFood ?? base.licensed_refrigerated_food ?? licensedRefrigeratedFood),
      licensed_refrigerated_food: Boolean(base.licensed_refrigerated_food ?? base.licensedRefrigeratedFood ?? licensedRefrigeratedFood),
      equipment_types: selectedEquipment.length ? selectedEquipment : base.equipment_types || [],
      equipment_type: selectedEquipment.length ? selectedEquipment.join(", ") : base.equipment_type || "",
      stripeCustomerId: currentCustomerId,
      stripe_customer_id: currentCustomerId,
      stripeId: currentCustomerId,
      stripe_id: currentCustomerId,
      stripeSubscriptionId: currentSubscriptionId,
      stripe_subscription_id: currentSubscriptionId,
      subscriptionId: currentSubscriptionId,
      subscription_id: currentSubscriptionId,
      subscriptionStatus: base.subscriptionStatus || base.subscription_status || subscriptionStatus,
      subscription_status: base.subscription_status || base.subscriptionStatus || subscriptionStatus,
      freightAccount: currentConnectAccount,
      freight_account: currentConnectAccount,
      stripeAccountId: currentConnectAccount,
      stripe_account_id: currentConnectAccount,
      updatedAt: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  async function saveFreightSnapshot(snapshot: any) {
    await AsyncStorage.setItem("pendingFreightCarrier", JSON.stringify(snapshot));
    await AsyncStorage.setItem("currentFreightCarrier", JSON.stringify(snapshot));
    await AsyncStorage.setItem("currentFreight", JSON.stringify(snapshot));
    await AsyncStorage.setItem("currentFreightUser", JSON.stringify(snapshot));
    await AsyncStorage.setItem("farm2homeCurrentFreight", JSON.stringify(snapshot));
    await AsyncStorage.setItem("currentUser", JSON.stringify(snapshot));
    await AsyncStorage.setItem("userRole", "freight");
    await AsyncStorage.setItem("currentUserRole", "freight");
  }

  function buildPreservedCarrier(row: any) {
    const pickedCustomerId = pickStripeCustomerId(row.stripe_customer_id, row.stripeCustomerId, stripeCustomerId);
    const pickedSubscriptionId = pickStripeSubscriptionId(row.stripe_subscription_id, row.subscription_id, subscriptionId);
    const pickedFreightAccount = pickStripeConnectAccountId(
      row.freight_account,
      row.freightAccount,
      row.stripe_account_id,
      row.stripeAccountId,
      freightAccount
    );

    return {
      ...row,
      id: row.id || savedCarrierId || freightId,
      freight_id: row.freight_id || row.id || savedCarrierId || freightId,
      account_id: keepValue(row.account_id, accountId),
      company_name: keepValue(companyName, row.company_name),
      business_name: keepValue(companyName, row.business_name),
      contact_name: keepValue(contactName, row.contact_name),
      full_name: keepValue(contactName, row.full_name),
      name: keepValue(contactName, row.name),
      email: keepValue(email, row.email),
      phone: keepValue(phone, row.phone),
      username: keepValue(username, row.username),
      service_area: keepValue(serviceArea, row.service_area),
      business_address: keepValue(businessAddress, row.business_address),
      city: keepValue(city, row.city),
      state: keepValue(stateValue, row.state),
      zip_code: keepValue(zipCode, row.zip_code),
      mdot_number: keepValue(mdotNumber, row.mdot_number),
      dot_number: keepValue(mdotNumber, row.dot_number),
      mc_number: keepValue(mcNumber, row.mc_number),
      insurance_provider: keepValue(insuranceProvider, row.insurance_provider),
      insurance_policy_number: keepValue(insurancePolicyNumber, row.insurance_policy_number),
      authority_active: authorityActive || Boolean(row.authority_active),
      insurance_active: insuranceActive || Boolean(row.insurance_active),
      licensed_livestock: licensedLivestock || Boolean(row.licensed_livestock),
      licensed_refrigerated_food: licensedRefrigeratedFood || Boolean(row.licensed_refrigerated_food),
      equipment_types: selectedEquipment.length ? selectedEquipment : row.equipment_types,
      security_question_1: keepValue(securityQuestion1, row.security_question_1),
      security_question_2: keepValue(securityQuestion2, row.security_question_2),
      security_question_3: keepValue(securityQuestion3, row.security_question_3),
      security_answer_1: securityAnswer1 ? normalizeAnswer(securityAnswer1) : row.security_answer_1,
      security_answer_2: securityAnswer2 ? normalizeAnswer(securityAnswer2) : row.security_answer_2,
      security_answer_3: securityAnswer3 ? normalizeAnswer(securityAnswer3) : row.security_answer_3,
      stripe_customer_id: pickedCustomerId,
      stripe_subscription_id: pickedSubscriptionId,
      subscription_id: pickedSubscriptionId,
      freight_account: pickedFreightAccount,
      stripe_account_id: pickedFreightAccount,
      subscription_status: row.subscription_status || subscriptionStatus || "",
    };
  }

  function validateForm({ full = true }: { full?: boolean } = {}) {
    if (!companyName.trim() || !contactName.trim() || !normalize(email) || !phone.trim()) {
      Alert.alert("Missing Info", "Company, contact, email, and phone are required.");
      setStep(0);
      return false;
    }

    if (!normalize(email).includes("@")) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      setStep(0);
      return false;
    }

    if (!savedCarrierId && (!username.trim() || !password.trim() || !confirmPassword.trim())) {
      Alert.alert("Login Required", "Please create a username and password.");
      setStep(0);
      return false;
    }

    if (normalize(username).length < 4) {
      Alert.alert("Invalid Username", "Username must be at least 4 characters.");
      setStep(0);
      return false;
    }

    if (!savedCarrierId && password.trim().length < 6) {
      Alert.alert("Weak Password", "Password must be at least 6 characters.");
      setStep(0);
      return false;
    }

    if (!savedCarrierId && password.trim() !== confirmPassword.trim()) {
      Alert.alert("Password Mismatch", "Passwords do not match.");
      setStep(0);
      return false;
    }

    if (!businessAddress.trim() || !city.trim() || !stateValue.trim() || !zipCode.trim()) {
      Alert.alert("Missing Address", "Business address, city, state, and zip code are required.");
      setStep(1);
      return false;
    }

    if (!full) return true;

    if (!mdotNumber.trim() || !mcNumber.trim()) {
      Alert.alert("Missing Authority", "MDOT number and MC number are required.");
      setStep(2);
      return false;
    }

    if (!insuranceProvider.trim() || !insurancePolicyNumber.trim()) {
      Alert.alert("Missing Insurance", "Insurance provider and policy number are required.");
      setStep(2);
      return false;
    }

    if (!authorityActive || !insuranceActive) {
      Alert.alert("Verification Required", "Confirm active authority and insurance.");
      setStep(2);
      return false;
    }

    if (!licensedLivestock && !licensedRefrigeratedFood) {
      Alert.alert("License Required", "Select livestock, refrigerated food, or both.");
      setStep(2);
      return false;
    }

    if (selectedQuestions.length !== 3 || new Set(selectedQuestions).size !== 3) {
      Alert.alert("Security Questions Required", "Please choose 3 different security questions.");
      setStep(3);
      return false;
    }

    const missingSecurityAnswers =
      (!securityAnswer1.trim() && !hasSavedSecurityAnswer1) ||
      (!securityAnswer2.trim() && !hasSavedSecurityAnswer2) ||
      (!securityAnswer3.trim() && !hasSavedSecurityAnswer3);

    if (missingSecurityAnswers) {
      Alert.alert(
        "Security Answers Required",
        "Please answer all 3 security questions. Saved accounts may leave an answer blank only when an answer is already on file."
      );
      setStep(3);
      return false;
    }

    return true;
  }

  async function generateFreightAccountId() {
    const { data, error } = await supabase.rpc("next_account_id", {
      p_role: "freight",
      p_prefix: "Freight",
    });
    if (error) return makeFallbackAccountId();
    return data ? String(data) : makeFallbackAccountId();
  }

  async function checkDuplicateFreight(cleanEmailValue: string, cleanUsername: string) {
    const filters = [
      `email.eq.${cleanEmailValue}`,
      `username.eq.${cleanUsername}`,
      stripeCustomerId ? `stripe_customer_id.eq.${stripeCustomerId}` : "",
    ]
      .filter(Boolean)
      .join(",");

    const { data, error } = await supabase.from("freight_users").select("*").or(filters).limit(1);
    if (error) return null;
    return Array.isArray(data) && data.length > 0 ? data[0] : null;
  }

  async function syncStripeByEmail(targetEmail?: string, silent = false) {
    const finalEmail = normalize(targetEmail || email);
    const finalBusinessName = companyName.trim();
    const finalUsername = normalize(username);
    const finalId = savedCarrierId || freightId;

    if (!finalEmail && !finalBusinessName && !finalUsername && !finalId) {
      if (!silent) Alert.alert("Search Required", "Enter email, business name, or username first.");
      return null;
    }

    try {
      setSyncingStripe(true);
      const response = await fetch(`${API_BASE_URL}/payments/sync-stripe-by-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "freight",
          email: finalEmail,
          businessName: finalBusinessName,
          companyName: finalBusinessName,
          name: finalBusinessName,
          username: finalUsername,
          userId: finalId,
          freightId: finalId,
          freight_id: finalId,
        }),
      });

      const json = await parseApiResponse(response);
      if (!response.ok || !json.success) {
        if (!silent) Alert.alert("Stripe Sync Not Found", json.error || "No Stripe customer/subscription was found.");
        return null;
      }

      const syncedCustomerId = pickStripeCustomerId(json.stripeCustomerId, json.stripe_customer_id);
      const syncedSubscriptionId = pickStripeSubscriptionId(json.stripeSubscriptionId, json.stripe_subscription_id);
      const syncedFreightAccount = pickStripeConnectAccountId(
        json.freight_account,
        json.stripeAccountId,
        json.stripe_account_id
      );

      if (syncedCustomerId) setStripeCustomerId(syncedCustomerId);
      if (syncedSubscriptionId) setSubscriptionId(syncedSubscriptionId);
      if (json.subscriptionStatus || json.subscription_status) {
        setSubscriptionStatus(json.subscriptionStatus || json.subscription_status || "");
      }
      if (syncedFreightAccount) setFreightAccount(syncedFreightAccount);

      if (json.updatedRows?.[0]) {
        const preserved = buildPreservedCarrier(json.updatedRows[0]);
        hydrateStripeOnly(preserved);
        await saveHydratedSession(preserved);
      }

      if (!silent) Alert.alert("Stripe Synced", "Stripe customer/subscription information was saved.");
      return json;
    } catch (error: any) {
      if (!silent) Alert.alert("Stripe Sync Error", error?.message || "Unable to sync Stripe.");
      return null;
    } finally {
      setSyncingStripe(false);
    }
  }

  async function forceSyncFreightSubscription(silent = false, overrideId?: string) {
    const finalEmail = normalize(email);
    const finalBusinessName = companyName.trim();
    const finalUsername = normalize(username);
    const finalId = overrideId || savedCarrierId || freightId;

    if (!finalEmail && !finalBusinessName && !finalUsername && !finalId) {
      if (!silent) Alert.alert("Missing Info", "Enter your email, business name, or username first.");
      return null;
    }

    try {
      setSyncingStripe(true);
      const response = await fetch(`${API_BASE_URL}/payments/force-sync-freight-subscription`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "freight",
          email: finalEmail,
          businessName: finalBusinessName,
          companyName: finalBusinessName,
          name: finalBusinessName,
          username: finalUsername,
          freightId: finalId,
          freight_id: finalId,
          userId: finalId,
        }),
      });

      const json = await parseApiResponse(response);
      if (!response.ok || !json.success) {
        if (!silent) Alert.alert("Stripe Sync Failed", json.error || "No paid freight subscription was found.");
        return null;
      }

      const syncedCustomerId = pickStripeCustomerId(json.stripeCustomerId, json.stripe_customer_id);
      const syncedSubscriptionId = pickStripeSubscriptionId(json.stripeSubscriptionId, json.stripe_subscription_id);
      const syncedFreightAccount = pickStripeConnectAccountId(
        json.freight_account,
        json.stripeAccountId,
        json.stripe_account_id
      );
      const syncedStatus = json.subscriptionStatus || json.subscription_status || "active";

      if (syncedCustomerId) setStripeCustomerId(syncedCustomerId);
      if (syncedSubscriptionId) setSubscriptionId(syncedSubscriptionId);
      if (syncedFreightAccount) setFreightAccount(syncedFreightAccount);
      setSubscriptionStatus(syncedStatus);

      if (json.updatedRows?.[0]) {
        const preserved = buildPreservedCarrier(json.updatedRows[0]);
        hydrateStripeOnly(preserved);
        await saveHydratedSession(preserved);
      }

      if (!silent) Alert.alert("Subscription Restored", "Your paid freight subscription was saved to Supabase.");
      return json;
    } catch (error: any) {
      if (!silent) Alert.alert("Force Sync Error", error?.message || "Unable to restore subscription.");
      return null;
    } finally {
      setSyncingStripe(false);
    }
  }

  async function saveFreightUserRow(carrierId: string, savedAccountId?: string) {
    const now = new Date().toISOString();

    const { data: existingFreightUser, error: existingError } = await supabase
      .from("freight_users")
      .select("*")
      .eq("id", carrierId)
      .maybeSingle();

    if (existingError) throw existingError;

    const subRow = await getBestFreightSubscription(carrierId, normalize(email));

    const cleanCompanyName = companyName.trim();
    const cleanContactName = contactName.trim();
    const cleanEmailValue = normalize(email);
    const cleanPhone = phone.trim();
    const cleanUsername = normalize(username);

    const finalAccountId = existingFreightUser?.account_id || savedAccountId || accountId || (await generateFreightAccountId());

    const finalStripeCustomerId = pickStripeCustomerId(
      stripeCustomerId,
      existingFreightUser?.stripe_customer_id,
      subRow?.stripe_customer_id
    );

    const finalSubscriptionId = pickStripeSubscriptionId(
      subscriptionId,
      existingFreightUser?.stripe_subscription_id,
      existingFreightUser?.subscription_id,
      subRow?.stripe_subscription_id
    );

    const finalFreightAccount = pickStripeConnectAccountId(
      freightAccount,
      existingFreightUser?.freight_account,
      existingFreightUser?.stripe_account_id,
      subRow?.freight_account,
      subRow?.stripe_account_id
    );

    const finalSubscriptionStatus =
      subscriptionStatus || existingFreightUser?.subscription_status || subRow?.subscription_status || (finalSubscriptionId ? "active" : "pending_payment");

    const freightPayload: any = {
      id: carrierId,
      account_id: finalAccountId,
      freight_id: carrierId,
      profile_id: carrierId,
      auth_user_id: carrierId,
      role: "freight",
      company_name: cleanCompanyName,
      business_name: cleanCompanyName,
      contact_name: cleanContactName,
      full_name: cleanContactName,
      name: cleanContactName,
      owner_name: cleanContactName,
      email: cleanEmailValue,
      phone: cleanPhone,
      username: cleanUsername,
      account_active: true,
      stripe_customer_id: finalStripeCustomerId || null,
      stripe_subscription_id: finalSubscriptionId || null,
      subscription_id: finalSubscriptionId || null,
      freight_account: finalFreightAccount || null,
      stripe_account_id: finalFreightAccount || null,
      stripe_connect_status: finalFreightAccount ? "started" : "not_started",
      payouts_enabled: existingFreightUser?.payouts_enabled || false,
      charges_enabled: existingFreightUser?.charges_enabled || false,
      stripe_payouts_enabled: existingFreightUser?.stripe_payouts_enabled || false,
      stripe_charges_enabled: existingFreightUser?.stripe_charges_enabled || false,
      stripe_onboarding_complete: existingFreightUser?.stripe_onboarding_complete || false,
      security_question_1: securityQuestion1,
      security_question_2: securityQuestion2,
      security_question_3: securityQuestion3,
      security_answer_1: securityAnswer1.trim() ? normalizeAnswer(securityAnswer1) : existingFreightUser?.security_answer_1 || null,
      security_answer_2: securityAnswer2.trim() ? normalizeAnswer(securityAnswer2) : existingFreightUser?.security_answer_2 || null,
      security_answer_3: securityAnswer3.trim() ? normalizeAnswer(securityAnswer3) : existingFreightUser?.security_answer_3 || null,
      service_area: serviceArea.trim(),
      business_address: businessAddress.trim(),
      city: city.trim(),
      state: stateValue.trim().toUpperCase(),
      zip_code: zipCode.trim(),
      mdot_number: mdotNumber.trim(),
      dot_number: mdotNumber.trim(),
      mc_number: mcNumber.trim(),
      insurance_provider: insuranceProvider.trim(),
      insurance_policy_number: insurancePolicyNumber.trim(),
      authority_active: authorityActive,
      insurance_active: insuranceActive,
      licensed_livestock: licensedLivestock,
      licensed_refrigerated_food: licensedRefrigeratedFood,
      equipment_types: selectedEquipment,
      equipment_type: selectedEquipment.join(", "),
      approved: true,
      verification_status: finalSubscriptionId ? "SUBMITTED" : "REGISTERED",
      compliance_status: finalSubscriptionId ? "SUBMITTED" : "PENDING_PAYMENT",
      admin_review_status: finalSubscriptionId ? "submitted" : "pending_payment",
      membership_status: finalSubscriptionId ? "active" : "pending_payment",
      subscription_status: finalSubscriptionStatus,
      freight_membership_paid: Boolean(finalSubscriptionId),
      application_submitted: Boolean(finalSubscriptionId),
      submitted_at: finalSubscriptionId ? now : existingFreightUser?.submitted_at || null,
      push_notifications: true,
      new_load_alerts: true,
      route_status_alerts: true,
      payout_alerts: true,
      billing_alerts: true,
      gps_tracking: true,
      background_route_updates: false,
      show_only_nearby_loads: false,
      show_refrigerated_loads: true,
      show_livestock_loads: true,
      privacy_mode: false,
      notifications_enabled: true,
      expo_push_token: existingFreightUser?.expo_push_token || "",
      updated_at: now,
    };

    await safeUpsertProfile(carrierId, {
      id: carrierId,
      auth_user_id: carrierId,
      profile_id: carrierId,
      account_id: finalAccountId,
      role: "freight",
      full_name: cleanContactName,
      name: cleanContactName,
      email: cleanEmailValue,
      phone: cleanPhone,
      username: cleanUsername,
      company_name: cleanCompanyName,
      stripe_customer_id: finalStripeCustomerId || null,
      stripe_subscription_id: finalSubscriptionId || null,
      subscription_id: finalSubscriptionId || null,
      membership_status: finalSubscriptionId ? "active" : "pending_payment",
      subscription_status: finalSubscriptionStatus,
      account_active: true,
    });

    const { data: savedFreightUser, error: saveError } = await supabase
      .from("freight_users")
      .upsert(existingFreightUser?.id ? freightPayload : { ...freightPayload, created_at: now }, { onConflict: "id" })
      .select()
      .single();

    if (saveError) throw saveError;
    if (!savedFreightUser?.id) throw new Error("Freight registration did not save.");

    await upsertFreightSubscriptionRow({
      freightId: carrierId,
      accountId: finalAccountId,
      stripeCustomerId: finalStripeCustomerId,
      stripeSubscriptionId: finalSubscriptionId,
      stripeAccountId: finalFreightAccount,
      subscriptionStatus: finalSubscriptionStatus,
    });

    await upsertAdminVerification(carrierId, savedFreightUser, finalSubscriptionId, finalSubscriptionStatus);
    await saveHydratedSession(savedFreightUser);
    hydrateForm(savedFreightUser);
    setHasSavedSecurityAnswer1(Boolean(savedFreightUser.security_answer_1));
    setHasSavedSecurityAnswer2(Boolean(savedFreightUser.security_answer_2));
    setHasSavedSecurityAnswer3(Boolean(savedFreightUser.security_answer_3));
    setSecurityAnswer1("");
    setSecurityAnswer2("");
    setSecurityAnswer3("");

    return savedFreightUser;
  }

  async function safeUpsertProfile(carrierId: string, payload: any) {
    const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
    if (!error) return;
    console.log("profiles upsert skipped:", error.message);
  }

  async function upsertFreightSubscriptionRow(values: {
    freightId: string;
    accountId?: string;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    stripeAccountId?: string;
    subscriptionStatus?: string;
  }) {
    const now = new Date().toISOString();
    const payload = {
      freight_id: values.freightId,
      freight_email: normalize(email),
      name: companyName.trim(),
      username: normalize(username),
      stripe_customer_id: values.stripeCustomerId || null,
      stripe_subscription_id: values.stripeSubscriptionId || null,
      subscription_status: values.subscriptionStatus || (values.stripeSubscriptionId ? "active" : "pending_payment"),
      stripe_account_id: values.stripeAccountId || null,
      freight_account: values.stripeAccountId || null,
      updated_at: now,
    };

    const { data: existing } = await supabase
      .from("freight_subscriptions")
      .select("id")
      .or(`freight_id.eq.${values.freightId},freight_email.eq.${normalize(email)}`)
      .limit(1);

    if (Array.isArray(existing) && existing[0]?.id) {
      await supabase.from("freight_subscriptions").update(payload).eq("id", existing[0].id);
      return;
    }

    await supabase.from("freight_subscriptions").insert({ ...payload, created_at: now });
  }

  async function upsertAdminVerification(carrierId: string, savedFreightUser: any, finalSubscriptionId?: string, finalSubscriptionStatus?: string) {
    const now = new Date().toISOString();
    const cleanCompanyName = companyName.trim();
    const cleanContactName = contactName.trim();
    const cleanEmailValue = normalize(email);
    const finalAccountId = savedFreightUser.account_id || accountId;
    const paid = Boolean(finalSubscriptionId || subscriptionId);
    const finalFreightAccount = pickStripeConnectAccountId(
      freightAccount,
      savedFreightUser.freight_account,
      savedFreightUser.stripe_account_id
    );

    const { error } = await supabase.from("admin_verifications").upsert(
      {
        id: carrierId,
        account_id: finalAccountId,
        carrier_id: carrierId,
        freight_id: carrierId,
        profile_id: carrierId,
        account_type: "FREIGHT_CARRIER",
        role: "freight",
        type: "FREIGHT_CARRIER",
        company_name: cleanCompanyName,
        business_name: cleanCompanyName,
        contact_name: cleanContactName,
        owner_name: cleanContactName,
        email: cleanEmailValue,
        phone: phone.trim(),
        username: normalize(username),
        business_address: businessAddress.trim(),
        city: city.trim(),
        state: stateValue.trim().toUpperCase(),
        zip_code: zipCode.trim(),
        mdot_number: mdotNumber.trim(),
        dot_number: mdotNumber.trim(),
        mc_number: mcNumber.trim(),
        insurance_provider: insuranceProvider.trim(),
        insurance_policy_number: insurancePolicyNumber.trim(),
        authority_active: authorityActive,
        insurance_active: insuranceActive,
        licensed_livestock: licensedLivestock,
        licensed_refrigerated_food: licensedRefrigeratedFood,
        status: paid ? "SUBMITTED" : "PENDING_PAYMENT",
        compliance_status: paid ? "SUBMITTED" : "PENDING_PAYMENT",
        admin_review_status: paid ? "submitted" : "pending_payment",
        review_decision: paid ? "submitted" : "pending_payment",
        approved: true,
        rejected: false,
        reviewed: false,
        needs_more_info: false,
        account_active: true,
        membership_status: paid ? "active" : "pending_payment",
        subscription_status: finalSubscriptionStatus || subscriptionStatus || (paid ? "active" : "pending_payment"),
        freight_membership_paid: paid,
        application_submitted: paid,
        submitted_at: paid ? now : null,
        stripe_customer_id: stripeCustomerId || null,
        freight_account: finalFreightAccount || null,
        stripe_account_id: finalFreightAccount || null,
        stripe_subscription_id: finalSubscriptionId || subscriptionId || null,
        subscription_id: finalSubscriptionId || subscriptionId || null,
        updated_at: now,
        created_at: savedFreightUser?.created_at || now,
      },
      { onConflict: "id" }
    );
    if (error) console.log("admin_verifications upsert skipped:", error.message);
  }

  async function saveRegistration() {
    if (saving) return null;
    if (!validateForm({ full: false })) return null;

    try {
      setSaving(true);
      const cleanEmailValue = normalize(email);
      const cleanUsername = normalize(username);

      const duplicate = await checkDuplicateFreight(cleanEmailValue, cleanUsername);
      if (duplicate?.id) {
        setFreightId(duplicate.id);
        setSavedCarrierId(duplicate.id);
        setAccountId(duplicate.account_id || accountId);
        const saved = await saveFreightUserRow(duplicate.id, duplicate.account_id || undefined);
        return saved;
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: cleanEmailValue,
        password: password.trim(),
        options: {
          data: {
            role: "freight",
            username: cleanUsername,
            company_name: companyName.trim(),
            contact_name: contactName.trim(),
            full_name: contactName.trim(),
          },
        },
      });

      if (authError) {
        Alert.alert("Signup Error", authError.message);
        return null;
      }

      const carrierId = authData?.user?.id;
      if (!carrierId) {
        Alert.alert("Signup Error", "Unable to create freight auth account.");
        return null;
      }

      const generatedAccountId = await generateFreightAccountId();
      setFreightId(carrierId);
      setSavedCarrierId(carrierId);
      setAccountId(generatedAccountId);

      return await saveFreightUserRow(carrierId, generatedAccountId);
    } catch (error: any) {
      Alert.alert("Save Error", error?.message || "Unable to save freight registration.");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function saveFreightProfile(fullValidation = false) {
    if (saving) return null;

    if (savedCarrierId || freightId) {
      if (!validateForm({ full: fullValidation })) return null;

      try {
        setSaving(true);

        const existingId = savedCarrierId || freightId;
        const saved = await saveFreightUserRow(existingId, accountId || undefined);
        return saved;
      } catch (error: any) {
        Alert.alert("Save Error", error?.message || "Unable to save freight profile.");
        return null;
      } finally {
        setSaving(false);
      }
    }

    return await saveRegistration();
  }

  async function handleStripeCheckout() {
    if (stripeLoading) return;

    try {
      setStripeLoading(true);

      const restoredBeforeCheckout = await retrieveMissingStripeInfo(false);

      if (objectHasCompleteFreightSetup(restoredBeforeCheckout)) {
        await markApplicationSubmittedAndOpenDashboard(
          restoredBeforeCheckout?.id || restoredBeforeCheckout?.freight_id || savedCarrierId || freightId,
          {
            stripeCustomerId: pickStripeCustomerId(restoredBeforeCheckout?.stripe_customer_id, restoredBeforeCheckout?.stripeCustomerId, stripeCustomerId),
            stripeSubscriptionId: pickStripeSubscriptionId(restoredBeforeCheckout?.stripe_subscription_id, restoredBeforeCheckout?.subscription_id, subscriptionId),
            subscriptionStatus: restoredBeforeCheckout?.subscription_status || restoredBeforeCheckout?.subscriptionStatus || subscriptionStatus || "active",
          }
        );
        return;
      }

      if (objectHasActiveSubscription(restoredBeforeCheckout)) {
        Alert.alert(
          "Membership Already Active",
          "Your membership subscription is already saved. Use Connect Stripe Payouts if banking still needs setup."
        );
        setStep(4);
        return;
      }

      const savedProfile = restoredBeforeCheckout?.id
        ? restoredBeforeCheckout
        : await saveFreightProfile(false);

      if (!savedProfile?.id) {
        Alert.alert("Save Required", "Freight profile could not be saved. Enter the required registration fields, then try again.");
        return;
      }

      const savedId = savedProfile.id;
      const savedAccountId = savedProfile.account_id || savedProfile.accountId || accountId;
      const savedEmail = normalize(savedProfile.email || email);
      const savedCompanyName =
        savedProfile.company_name ||
        savedProfile.companyName ||
        savedProfile.business_name ||
        savedProfile.businessName ||
        companyName.trim();
      const savedBusinessName =
        savedProfile.business_name ||
        savedProfile.businessName ||
        savedProfile.company_name ||
        savedProfile.companyName ||
        companyName.trim();
      const savedUsername = normalize(savedProfile.username || username);

      const pendingCarrier = {
        ...savedProfile,
        role: "freight",
        freightId: savedId,
        freight_id: savedId,
        accountId: savedAccountId,
        account_id: savedAccountId,
        email: savedEmail,
        companyName: savedCompanyName,
        company_name: savedCompanyName,
        businessName: savedBusinessName,
        business_name: savedBusinessName,
        username: savedUsername,
        stripeCustomerId: pickStripeCustomerId(savedProfile.stripeCustomerId, savedProfile.stripe_customer_id, stripeCustomerId),
        stripe_customer_id: pickStripeCustomerId(savedProfile.stripeCustomerId, savedProfile.stripe_customer_id, stripeCustomerId),
        stripeSubscriptionId: pickStripeSubscriptionId(savedProfile.stripeSubscriptionId, savedProfile.stripe_subscription_id, savedProfile.subscription_id, subscriptionId),
        stripe_subscription_id: pickStripeSubscriptionId(savedProfile.stripeSubscriptionId, savedProfile.stripe_subscription_id, savedProfile.subscription_id, subscriptionId),
        subscriptionId: pickStripeSubscriptionId(savedProfile.subscriptionId, savedProfile.subscription_id, savedProfile.stripe_subscription_id, subscriptionId),
        subscription_id: pickStripeSubscriptionId(savedProfile.subscriptionId, savedProfile.subscription_id, savedProfile.stripe_subscription_id, subscriptionId),
        freightAccount: pickStripeConnectAccountId(savedProfile.freightAccount, savedProfile.freight_account, savedProfile.stripe_account_id, freightAccount),
        freight_account: pickStripeConnectAccountId(savedProfile.freightAccount, savedProfile.freight_account, savedProfile.stripe_account_id, freightAccount),
        stripeAccountId: pickStripeConnectAccountId(savedProfile.stripeAccountId, savedProfile.stripe_account_id, savedProfile.freight_account, freightAccount),
        stripe_account_id: pickStripeConnectAccountId(savedProfile.stripeAccountId, savedProfile.stripe_account_id, savedProfile.freight_account, freightAccount),
      };

      await AsyncStorage.setItem("pendingFreightCarrier", JSON.stringify(pendingCarrier));
      await AsyncStorage.setItem("currentFreightCarrier", JSON.stringify(pendingCarrier));
      await AsyncStorage.setItem("currentFreight", JSON.stringify(pendingCarrier));
      await AsyncStorage.setItem("currentFreightUser", JSON.stringify(pendingCarrier));
      await AsyncStorage.setItem("currentUser", JSON.stringify(pendingCarrier));
      await AsyncStorage.setItem("userRole", "freight");
      await AsyncStorage.setItem("currentUserRole", "freight");

      const successUrl = `${APP_URL}/freight/register?stripe=success&freightId=${encodeURIComponent(savedId)}`;
      const cancelUrl = `${APP_URL}/freight/register?stripe=cancelled&freightId=${encodeURIComponent(savedId)}`;

      const response = await fetch(`${API_BASE_URL}/payments/create-freight-subscription-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "freight",
          planType: "freight",
          userId: savedId,
          freightId: savedId,
          freight_id: savedId,
          accountId: savedAccountId,
          account_id: savedAccountId,
          email: savedEmail,
          freight_email: savedEmail,
          customerEmail: savedEmail,
          companyName: savedCompanyName,
          company_name: savedCompanyName,
          businessName: savedBusinessName,
          business_name: savedBusinessName,
          name: savedCompanyName,
          contactName: savedProfile.contact_name || savedProfile.contactName || contactName.trim(),
          contact_name: savedProfile.contact_name || savedProfile.contactName || contactName.trim(),
          username: savedUsername,
          successUrl,
          success_url: successUrl,
          cancelUrl,
          cancel_url: cancelUrl,
          metadata: {
            role: "freight",
            userId: savedId,
            freightId: savedId,
            freight_id: savedId,
            accountId: savedAccountId,
            account_id: savedAccountId,
            email: savedEmail,
            freight_email: savedEmail,
            companyName: savedCompanyName,
            company_name: savedCompanyName,
            businessName: savedBusinessName,
            business_name: savedBusinessName,
            username: savedUsername,
          },
        }),
      });

      const data = await parseApiResponse(response);

      if (!response.ok || !data?.success || !data?.url) {
        Alert.alert("Stripe Error", data?.error || "Unable to open Stripe checkout.");
        return;
      }

      const returnedCustomerId = pickStripeCustomerId(data.stripeCustomerId, data.stripe_customer_id, data.customerId, data.customer_id);
      if (returnedCustomerId) setStripeCustomerId(returnedCustomerId);

      if (data.alreadySubscribed) {
        const returnedSubscriptionId = pickStripeSubscriptionId(
          data.stripeSubscriptionId,
          data.stripe_subscription_id,
          data.subscriptionId,
          data.subscription_id
        );
        const returnedStatus = data.subscriptionStatus || data.subscription_status || "active";

        if (returnedSubscriptionId) setSubscriptionId(returnedSubscriptionId);
        setSubscriptionStatus(returnedStatus);

        await markApplicationSubmittedAndOpenDashboard(savedId, {
          stripeCustomerId: returnedCustomerId,
          stripeSubscriptionId: returnedSubscriptionId,
          subscriptionStatus: returnedStatus,
        });
        return;
      }

      const stripeUrl = String(data.url || data.checkoutUrl || data.checkout_url || "").trim();

      if (!stripeUrl || !stripeUrl.startsWith("https://")) {
        Alert.alert("Stripe Error", "No valid Stripe Checkout URL was returned.");
        return;
      }

      if (Platform.OS === "web") {
        window.location.href = stripeUrl;
        return;
      }

      await WebBrowser.openBrowserAsync(stripeUrl);
    } catch (error: any) {
      Alert.alert("Stripe Error", error?.message || "Unable to open Stripe.");
    } finally {
      setStripeLoading(false);
    }
  }

  async function startSubscriptionCheckout() {
    if (stripeLoading || saving || syncingStripe) return;

    const restored = await retrieveMissingStripeInfo(false);

    if (objectHasCompleteFreightSetup(restored)) {
      await markApplicationSubmittedAndOpenDashboard(restored?.id || restored?.freight_id || savedCarrierId || freightId, {
        stripeCustomerId: pickStripeCustomerId(restored?.stripe_customer_id, restored?.stripeCustomerId, stripeCustomerId),
        stripeSubscriptionId: pickStripeSubscriptionId(restored?.stripe_subscription_id, restored?.subscription_id, subscriptionId),
        subscriptionStatus: restored?.subscription_status || restored?.subscriptionStatus || subscriptionStatus || "active",
      });
      return;
    }

    if (objectHasActiveSubscription(restored)) {
      Alert.alert(
        "Membership Already Active",
        "Your Stripe membership is already active. Complete or update Stripe Connect banking if needed."
      );
      setStep(4);
      return;
    }

    await handleStripeCheckout();
  }

  async function markApplicationSubmittedAndOpenDashboard(
    targetId?: string,
    stripeOverride?: { stripeCustomerId?: string; stripeSubscriptionId?: string; subscriptionStatus?: string }
  ) {
    const finalId = targetId || savedCarrierId || freightId;
    if (!finalId) {
      Alert.alert("Save Required", "Save your freight registration first.");
      return;
    }

    const now = new Date().toISOString();
    let finalStripeCustomerId = pickStripeCustomerId(stripeOverride?.stripeCustomerId, stripeCustomerId);
    let finalSubscriptionId = pickStripeSubscriptionId(stripeOverride?.stripeSubscriptionId, subscriptionId);
    let finalFreightAccount = pickStripeConnectAccountId(freightAccount);
    let finalStatus = stripeOverride?.subscriptionStatus || subscriptionStatus || (finalSubscriptionId ? "active" : "pending");

    if (!finalSubscriptionId || !finalFreightAccount) {
      const subRow = await getBestFreightSubscription(finalId, normalize(email));

      finalStripeCustomerId = pickStripeCustomerId(finalStripeCustomerId, subRow?.stripe_customer_id);
      finalSubscriptionId = pickStripeSubscriptionId(finalSubscriptionId, subRow?.stripe_subscription_id);
      finalFreightAccount = pickStripeConnectAccountId(finalFreightAccount, subRow?.stripe_account_id, subRow?.freight_account);
      finalStatus = finalStatus || subRow?.subscription_status || (finalSubscriptionId ? "active" : "pending");
    }

    if (!finalSubscriptionId) {
      const sync = await forceSyncFreightSubscription(true, finalId);
      finalStripeCustomerId = pickStripeCustomerId(sync?.stripeCustomerId, sync?.stripe_customer_id, finalStripeCustomerId);
      finalSubscriptionId = pickStripeSubscriptionId(
        sync?.stripeSubscriptionId,
        sync?.stripe_subscription_id,
        sync?.subscriptionId,
        sync?.subscription_id,
        finalSubscriptionId
      );
      finalFreightAccount = pickStripeConnectAccountId(sync?.stripe_account_id, sync?.stripeAccountId, sync?.freight_account, finalFreightAccount);
      finalStatus = sync?.subscriptionStatus || sync?.subscription_status || finalStatus || (finalSubscriptionId ? "active" : "pending");
    }

    const updatePayload: any = {
      application_submitted: true,
      submitted_at: now,
      verification_status: "SUBMITTED",
      compliance_status: "SUBMITTED",
      admin_review_status: "submitted",
      membership_status: finalSubscriptionId ? "active" : "pending",
      subscription_status: finalStatus,
      freight_membership_paid: Boolean(finalSubscriptionId),
      stripe_customer_id: finalStripeCustomerId || null,
      stripe_subscription_id: finalSubscriptionId || null,
      subscription_id: finalSubscriptionId || null,
      freight_account: finalFreightAccount || null,
      stripe_account_id: finalFreightAccount || null,
      account_active: true,
      updated_at: now,
    };

    await supabase.from("freight_users").update(updatePayload).eq("id", finalId);
    await safeUpsertProfile(finalId, {
      id: finalId,
      role: "freight",
      email: normalize(email),
      account_id: accountId,
      full_name: contactName.trim(),
      name: contactName.trim(),
      company_name: companyName.trim(),
      stripe_customer_id: finalStripeCustomerId || null,
      stripe_subscription_id: finalSubscriptionId || null,
      subscription_id: finalSubscriptionId || null,
      membership_status: finalSubscriptionId ? "active" : "pending",
      subscription_status: finalStatus,
      account_active: true,
    });

    await upsertFreightSubscriptionRow({
      freightId: finalId,
      accountId,
      stripeCustomerId: finalStripeCustomerId,
      stripeSubscriptionId: finalSubscriptionId,
      stripeAccountId: finalFreightAccount,
      subscriptionStatus: finalStatus,
    });

    await supabase.from("admin_verifications").upsert(
      {
        ...updatePayload,
        id: finalId,
        freight_id: finalId,
        carrier_id: finalId,
        profile_id: finalId,
        account_id: accountId,
        account_type: "FREIGHT_CARRIER",
        role: "freight",
        type: "FREIGHT_CARRIER",
        company_name: companyName.trim(),
        business_name: companyName.trim(),
        contact_name: contactName.trim(),
        owner_name: contactName.trim(),
        email: normalize(email),
        phone: phone.trim(),
        username: normalize(username),
        status: "SUBMITTED",
        review_decision: "submitted",
        approved: true,
        rejected: false,
        reviewed: false,
        needs_more_info: false,
      },
      { onConflict: "id" }
    );

    const { data: updatedCarrier } = await supabase.from("freight_users").select("*").eq("id", finalId).maybeSingle();
    if (updatedCarrier) {
      const finalSub = await getBestFreightSubscription(finalId, normalize(updatedCarrier.email || email));
      const finalMerged = mergeCarrierAndSubscription(updatedCarrier, finalSub);
      await saveHydratedSession(finalMerged);

      const readyNow = Boolean(
        finalMerged.id &&
          finalMerged.account_id &&
          pickStripeCustomerId(finalMerged.stripe_customer_id) &&
          pickStripeSubscriptionId(finalMerged.stripe_subscription_id, finalMerged.subscription_id) &&
          pickStripeConnectAccountId(finalMerged.freight_account, finalMerged.stripe_account_id)
      );

      if (readyNow) {
        goDashboard();
        return;
      }
    }

    Alert.alert("Setup Still Syncing", "Your form was saved. Tap Find / Retrieve Missing Stripe Info, then Submit & Open Dashboard.");
  }

  async function submitToDashboard() {
    const finalId = savedCarrierId || freightId;
    if (!finalId) {
      Alert.alert("Save Required", "Save the freight registration first.");
      return;
    }

    if (!allFiveRequirementsFound) {
      const restored = await retrieveMissingStripeInfo(false);
      const restoredCustomer = pickStripeCustomerId(restored?.stripe_customer_id, restored?.stripeCustomerId, stripeCustomerId);
      const restoredSub = pickStripeSubscriptionId(restored?.stripe_subscription_id, restored?.subscription_id, restored?.stripeSubscriptionId, subscriptionId);
      const restoredAcct = pickStripeConnectAccountId(restored?.freight_account, restored?.stripe_account_id, restored?.freightAccount, freightAccount);
      const restoredAccountId = restored?.account_id || accountId;

      if (!(finalId && restoredAccountId && restoredCustomer && restoredSub && restoredAcct)) {
        Alert.alert(
          "Setup Still Missing",
          "Complete membership and Stripe Connect, or tap Find / Retrieve Missing Stripe Info after Stripe finishes."
        );
        setStep(4);
        return;
      }
    }

    await markApplicationSubmittedAndOpenDashboard(finalId);
  }

  async function startStripeConnectOnboarding() {
    if (connectLoading || saving) return;

    const restoredBeforeConnect = await retrieveMissingStripeInfo(false);
    const preSaveSnapshot = buildCurrentFreightSnapshot(restoredBeforeConnect || {});
    await saveFreightSnapshot(preSaveSnapshot);

    let finalFreightId = savedCarrierId || freightId || preSaveSnapshot.id || restoredBeforeConnect?.id || restoredBeforeConnect?.freight_id;
    let finalAccountId = accountId || preSaveSnapshot.account_id || preSaveSnapshot.accountId || restoredBeforeConnect?.account_id || restoredBeforeConnect?.accountId;
    let finalEmail = normalize(email || preSaveSnapshot.email || restoredBeforeConnect?.email);

    try {
      setConnectLoading(true);

      if (!finalFreightId || !finalEmail) {
        const savedProfile = await saveFreightProfile(false);

        if (!savedProfile?.id) {
          Alert.alert("Save Required", "Save the freight registration before connecting Stripe payouts.");
          return;
        }

        const savedSnapshot = buildCurrentFreightSnapshot(savedProfile);
        await saveFreightSnapshot(savedSnapshot);

        finalFreightId = savedSnapshot.id;
        finalAccountId = savedSnapshot.account_id || savedSnapshot.accountId;
        finalEmail = normalize(savedSnapshot.email);
      }

      if (!finalFreightId || !finalEmail) {
        Alert.alert("Save Required", "Missing freight ID or email. Save the registration first.");
        return;
      }

      const connectSnapshot = buildCurrentFreightSnapshot({
        ...preSaveSnapshot,
        id: finalFreightId,
        freight_id: finalFreightId,
        account_id: finalAccountId,
        email: finalEmail,
      });

      await saveFreightSnapshot(connectSnapshot);

      const returnUrl = `${APP_URL}/freight/register?connect=success&freightId=${encodeURIComponent(finalFreightId)}`;
      const refreshUrl = `${APP_URL}/freight/register?connect=refresh&freightId=${encodeURIComponent(finalFreightId)}`;

      const response = await fetch(`${API_BASE_URL}/payments/create-connect-account`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "freight",
          mode: freightAccount ? "update" : "onboarding",
          purpose: freightAccount ? "update_bank" : "onboarding",
          freightId: finalFreightId,
          freight_id: finalFreightId,
          userId: finalFreightId,
          accountId: finalAccountId,
          account_id: finalAccountId,
          email: finalEmail,
          freight_email: finalEmail,
          companyName: companyName.trim() || connectSnapshot.companyName,
          company_name: companyName.trim() || connectSnapshot.company_name,
          businessName: companyName.trim() || connectSnapshot.businessName,
          business_name: companyName.trim() || connectSnapshot.business_name,
          name: companyName.trim() || connectSnapshot.companyName,
          contactName: contactName.trim() || connectSnapshot.contactName,
          contact_name: contactName.trim() || connectSnapshot.contact_name,
          username: normalize(username || connectSnapshot.username),
          phone: phone.trim() || connectSnapshot.phone,
          freight_account: freightAccount || connectSnapshot.freight_account || undefined,
          stripe_account_id: freightAccount || connectSnapshot.stripe_account_id || undefined,
          update_existing: Boolean(freightAccount || connectSnapshot.freight_account || connectSnapshot.stripe_account_id),
          returnUrl,
          return_url: returnUrl,
          refreshUrl,
          refresh_url: refreshUrl,
          metadata: {
            role: "freight",
            userId: finalFreightId,
            freightId: finalFreightId,
            freight_id: finalFreightId,
            accountId: finalAccountId,
            account_id: finalAccountId,
            email: finalEmail,
            freight_email: finalEmail,
            company_name: companyName.trim() || connectSnapshot.companyName,
            username: normalize(username || connectSnapshot.username),
          },
        }),
      });

      const json = await parseApiResponse(response);

      if (!response.ok || !json.success) {
        Alert.alert("Connect Stripe Error", json.error || "Unable to create Stripe Connect onboarding link.");
        return;
      }

      const returnedFreightAccount = pickStripeConnectAccountId(
        json.freight_account,
        json.stripeAccountId,
        json.stripe_account_id,
        json.connectedAccountId,
        json.connected_account_id,
        json.account,
        freightAccount
      );

      const onboardingUrl = String(
        json.url ||
          json.onboardingUrl ||
          json.onboarding_url ||
          json.accountLinkUrl ||
          json.account_link_url ||
          json.updateUrl ||
          json.update_url ||
          ""
      ).trim();

      if (!returnedFreightAccount) {
        Alert.alert("Connect Stripe Error", "Stripe did not return a real Account ID that starts with acct_.");
        return;
      }

      if (!onboardingUrl || !onboardingUrl.startsWith("https://connect.stripe.com/")) {
        Alert.alert("Stripe Connect Error", "No valid Stripe Connect onboarding URL was returned.");
        return;
      }

      setFreightAccount(returnedFreightAccount);

      const connectUpdate = {
        freight_account: returnedFreightAccount,
        stripe_account_id: returnedFreightAccount,
        stripe_connect_status: "started",
        payouts_enabled: Boolean(json.payoutsEnabled || json.payouts_enabled),
        charges_enabled: Boolean(json.chargesEnabled || json.charges_enabled),
        stripe_payouts_enabled: Boolean(json.payoutsEnabled || json.payouts_enabled),
        stripe_charges_enabled: Boolean(json.chargesEnabled || json.charges_enabled),
        stripe_onboarding_complete: Boolean(json.onboardingComplete || json.onboarding_complete || json.stripe_onboarding_complete),
        updated_at: new Date().toISOString(),
      };

      await supabase.from("freight_users").update(connectUpdate).eq("id", finalFreightId);

      await supabase
        .from("freight_subscriptions")
        .update({
          freight_account: returnedFreightAccount,
          stripe_account_id: returnedFreightAccount,
          updated_at: new Date().toISOString(),
        })
        .or(`freight_id.eq.${finalFreightId},freight_email.eq.${finalEmail}`);

      await supabase
        .from("admin_verifications")
        .update(connectUpdate)
        .or(`id.eq.${finalFreightId},freight_id.eq.${finalFreightId},profile_id.eq.${finalFreightId}`);

      const updatedSnapshot = buildCurrentFreightSnapshot({
        ...connectSnapshot,
        ...connectUpdate,
        id: finalFreightId,
        freight_id: finalFreightId,
        account_id: finalAccountId,
        email: finalEmail,
        freight_account: returnedFreightAccount,
        stripe_account_id: returnedFreightAccount,
      });

      await saveFreightSnapshot(updatedSnapshot);

      if (Platform.OS === "web") {
        window.location.href = onboardingUrl;
        return;
      }

      await WebBrowser.openBrowserAsync(onboardingUrl);
    } catch (error: any) {
      Alert.alert("Connect Stripe Error", error?.message || "Unable to start Stripe Connect onboarding.");
    } finally {
      setConnectLoading(false);
    }
  }

  function renderQuestionPicker(
    label: string,
    selectedQuestion: string,
    setSelectedQuestion: (value: string) => void,
    answer: string,
    setAnswer: (value: string) => void,
    saved: boolean
  ) {
    return (
      <View style={styles.questionBlock}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.questionRow}>
          {SECURITY_QUESTIONS.map((question) => {
            const active = selectedQuestion === question;
            return (
              <TouchableOpacity
                key={question}
                style={[styles.questionChip, active && styles.questionChipActive]}
                onPress={() => setSelectedQuestion(question)}
                activeOpacity={0.85}
              >
                <Text style={[styles.questionChipText, active && styles.questionChipTextActive]}>{question}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <TextInput
          style={styles.input}
          placeholder={savedCarrierId || saved ? "Leave blank to keep saved answer" : "Hidden answer"}
          placeholderTextColor="#98A2B3"
          value={answer}
          onChangeText={setAnswer}
          secureTextEntry
        />
      </View>
    );
  }

  function renderCurrentStep() {
    if (step === 0) return renderAccountStep();
    if (step === 1) return renderCompanyStep();
    if (step === 2) return renderAuthorityStep();
    if (step === 3) return renderSecurityStep();
    if (step === 4) return renderStripeStep();
    return renderReviewStep();
  }

  function renderAccountStep() {
    return (
      <FinaPanel icon="person-outline" title="Account Information" subtitle="Create or resume a Freight Connect carrier account.">
        <TwoColumn>
          <Field label="Company Name" value={companyName} onChangeText={setCompanyName} placeholder="ASO Freight LLC" />
          <Field label="Contact Name" value={contactName} onChangeText={setContactName} placeholder="Owner / Dispatch Contact" />
          <Field label="Email" value={email} onChangeText={setEmail} placeholder="carrier@email.com" keyboardType="email-address" autoCapitalize="none" />
          <Field label="Phone" value={phone} onChangeText={setPhone} placeholder="Phone" keyboardType="phone-pad" />
          <Field label="Username" value={username} onChangeText={setUsername} placeholder="Create username" autoCapitalize="none" />
          <Field label="Service Area" value={serviceArea} onChangeText={setServiceArea} placeholder="Michigan, Ohio, Indiana" />
        </TwoColumn>

        {!savedCarrierId ? (
          <TwoColumn>
            <Field label="Password" value={password} onChangeText={setPassword} placeholder="Create password" secureTextEntry autoCapitalize="none" />
            <Field label="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Confirm password" secureTextEntry autoCapitalize="none" />
          </TwoColumn>
        ) : (
          <InfoBanner icon="lock-closed-outline" title="Password already exists" text="Use reset password from freight login if this account needs a password change." tone="info" />
        )}
      </FinaPanel>
    );
  }

  function renderCompanyStep() {
    return (
      <FinaPanel icon="business-outline" title="Company & Address" subtitle="Business location and service identity used for Stripe, loads, and account matching.">
        <TwoColumn>
          <Field label="Business Address" value={businessAddress} onChangeText={setBusinessAddress} placeholder="Street address" />
          <Field label="City" value={city} onChangeText={setCity} placeholder="City" />
          <Field label="State" value={stateValue} onChangeText={setStateValue} placeholder="MI" autoCapitalize="characters" />
          <Field label="Zip Code" value={zipCode} onChangeText={setZipCode} placeholder="Zip code" keyboardType="numeric" />
        </TwoColumn>
      </FinaPanel>
    );
  }

  function renderAuthorityStep() {
    return (
      <>
        <FinaPanel icon="shield-checkmark-outline" title="Authority & Insurance" subtitle="Carrier authority and coverage details are required before the account can be submitted.">
          <TwoColumn>
            <Field label="MDOT / DOT Number" value={mdotNumber} onChangeText={setMdotNumber} placeholder="DOT / MDOT Number" />
            <Field label="MC Number" value={mcNumber} onChangeText={setMcNumber} placeholder="MC Number" />
            <Field label="Insurance Provider" value={insuranceProvider} onChangeText={setInsuranceProvider} placeholder="Insurance provider" />
            <Field label="Policy Number" value={insurancePolicyNumber} onChangeText={setInsurancePolicyNumber} placeholder="Policy number" />
          </TwoColumn>
          <SwitchCard label="Active MC / Operating Authority" description="I confirm this carrier has active operating authority." value={authorityActive} onValueChange={setAuthorityActive} />
          <SwitchCard label="Active Insurance" description="I confirm insurance is active and current." value={insuranceActive} onValueChange={setInsuranceActive} />
        </FinaPanel>

        <FinaPanel icon="cube-outline" title="Equipment & Authorization" subtitle="Choose freight types and transport permissions.">
          <View style={styles.equipmentGrid}>
            {EQUIPMENT_OPTIONS.map((item) => {
              const active = selectedEquipment.includes(item.key);
              return (
                <TouchableOpacity key={item.key} style={[styles.equipmentCard, active && styles.equipmentCardActive]} onPress={() => toggleEquipment(item.key)}>
                  <Ionicons name={item.icon as any} size={23} color={active ? COLORS.white : COLORS.primary} />
                  <Text style={[styles.equipmentText, active && styles.equipmentTextActive]}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <SwitchCard label="Licensed to Move Livestock" description="Carrier is authorized for livestock transportation." value={licensedLivestock} onValueChange={setLicensedLivestock} />
          <SwitchCard label="Licensed for Refrigerated Fresh Food" description="Carrier can handle cold-chain or refrigerated farm freight." value={licensedRefrigeratedFood} onValueChange={setLicensedRefrigeratedFood} />
        </FinaPanel>
      </>
    );
  }

  function renderSecurityStep() {
    return (
      <FinaPanel icon="key-outline" title="Security Questions" subtitle="Used for account recovery and profile verification.">
        {renderQuestionPicker("Security Question 1", securityQuestion1, setSecurityQuestion1, securityAnswer1, setSecurityAnswer1, hasSavedSecurityAnswer1)}
        {renderQuestionPicker("Security Question 2", securityQuestion2, setSecurityQuestion2, securityAnswer2, setSecurityAnswer2, hasSavedSecurityAnswer2)}
        {renderQuestionPicker("Security Question 3", securityQuestion3, setSecurityQuestion3, securityAnswer3, setSecurityAnswer3, hasSavedSecurityAnswer3)}
      </FinaPanel>
    );
  }

  function renderStripeStep() {
    return (
      <>
        <FinaPanel icon="card-outline" title="Stripe Membership & Connect" subtitle="Complete membership and payout setup. The Connect acct_ ID is checked from freight_users and freight_subscriptions.">
          <View style={styles.statusGrid}>
            <StatusTile title="Customer" value={stripeCustomerId || "Missing"} good={isStripeCustomerId(stripeCustomerId)} icon="person-circle-outline" />
            <StatusTile title="Subscription" value={subscriptionId || "Missing"} good={hasActiveSubscription} icon="repeat-outline" />
            <StatusTile title="Connect" value={freightAccount || "Missing"} good={hasStripeConnectAccount} icon="business-outline" />
          </View>

          <View style={styles.actionStack}>
            <ActionButton icon="save-outline" label="Save Registration" onPress={saveRegistration} loading={saving} />
            <ActionButton icon="card-outline" label={hasActiveSubscription ? "Membership Active" : "Start Stripe Membership"} onPress={startSubscriptionCheckout} loading={stripeLoading || saving} variant="dark" disabled={stripeLoading} />
            <ActionButton icon="business-outline" label={hasStripeConnectAccount ? "Open / Update Stripe Banking" : "Connect Stripe Payouts"} onPress={startStripeConnectOnboarding} loading={connectLoading || saving} variant="outline" disabled={connectLoading} />
            <ActionButton icon="refresh-outline" label="Find / Retrieve Missing Stripe Info" onPress={async () => {
              await retrieveMissingStripeInfo(true);
            }} loading={syncingStripe} variant="secondary" />
          </View>
        </FinaPanel>
      </>
    );
  }

  function renderReviewStep() {
    return (
      <>
        <FinaPanel icon="checkmark-done-outline" title="Review & Finish" subtitle="Confirm everything is complete before opening the freight dashboard.">
          <View style={styles.reviewGrid}>
            <ReviewRow label="Company" value={companyName || "Missing"} />
            <ReviewRow label="Contact" value={contactName || "Missing"} />
            <ReviewRow label="Email" value={email || "Missing"} />
            <ReviewRow label="Account ID" value={accountId || "Assigned after save"} />
            <ReviewRow label="Freight UUID" value={freightId || "Assigned after save"} />
            <ReviewRow label="DOT / MDOT" value={mdotNumber || "Missing"} />
            <ReviewRow label="MC Number" value={mcNumber || "Missing"} />
            <ReviewRow label="Equipment" value={selectedEquipment.length ? selectedEquipment.join(", ") : "Not selected"} />
            <ReviewRow label="Stripe Customer" value={stripeCustomerId || "Missing"} />
            <ReviewRow label="Stripe Subscription" value={subscriptionId || "Missing"} />
            <ReviewRow label="Stripe Connect" value={freightAccount || "Missing"} />
          </View>
          <InfoBanner
            icon={registrationReadyForDashboard ? "checkmark-circle-outline" : "alert-circle-outline"}
            title={registrationReadyForDashboard ? "Ready for Dashboard" : "Stripe Setup Required"}
            text={registrationReadyForDashboard ? "Subscription and Connect account are available." : "Complete Stripe Membership and Connect Banking before submitting."}
            tone={registrationReadyForDashboard ? "success" : "warning"}
          />
          <ActionButton icon="grid-outline" label="Submit & Open Dashboard" onPress={submitToDashboard} loading={saving} />
        </FinaPanel>
      </>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="always" showsVerticalScrollIndicator={false}>
          <View style={styles.shell}>
            <View style={styles.sidebar}>
              <View style={styles.brandBlock}>
                <View style={styles.brandIcon}><Ionicons name="leaf-outline" size={24} color={COLORS.white} /></View>
                <View>
                  <Text style={styles.brandTitle}>Farm2Home</Text>
                  <Text style={styles.brandSub}>Freight Connect</Text>
                </View>
              </View>

              {STEPS.map((item, index) => {
                const active = step === index;
                const completed = index < step;
                return (
                  <TouchableOpacity key={item.key} style={[styles.sideStep, active && styles.sideStepActive]} onPress={() => setStep(index)}>
                    <View style={[styles.sideStepIcon, active && styles.sideStepIconActive, completed && styles.sideStepIconDone]}>
                      <Ionicons name={completed ? "checkmark-outline" : (item.icon as any)} size={17} color={active || completed ? COLORS.white : COLORS.primary} />
                    </View>
                    <Text style={[styles.sideStepText, active && styles.sideStepTextActive]}>{item.title}</Text>
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity style={styles.sidebarLogin} onPress={() => router.push("/freight/login" as any)}>
                <Ionicons name="log-in-outline" size={18} color={COLORS.primary} />
                <Text style={styles.sidebarLoginText}>Freight Login</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.main}>
              <View style={styles.topbar}>
                <View>
                  <Text style={styles.kicker}>Carrier Onboarding</Text>
                  <Text style={styles.title}>Freight Registration</Text>
                  <Text style={styles.subtitle}>Fina Admin-style setup for profile, compliance, membership, and payouts.</Text>
                </View>
                <TouchableOpacity style={styles.dashboardButton} onPress={allFiveRequirementsFound ? goDashboard : forceRefreshFreightRegister}>
                  <Ionicons name={allFiveRequirementsFound ? "grid-outline" : "refresh-outline"} size={18} color={COLORS.white} />
                  <Text style={styles.dashboardButtonText}>{allFiveRequirementsFound ? "Dashboard" : "Refresh"}</Text>
                </TouchableOpacity>
              </View>

              {processingReturn ? (
                <InfoBanner icon="sync-outline" title="Completing Stripe Registration" text="Please wait while we sync your Stripe subscription and submit your freight application." tone="warning" />
              ) : null}

              {autoRouting ? (
                <InfoBanner icon="grid-outline" title="Opening freight dashboard" text="All 5 requirements were found. You are being logged into the freight dashboard." tone="success" />
              ) : null}

              <View style={styles.metricGrid}>
                <MetricCard label="Setup" value={`${setupScore}/5`} icon="analytics-outline" tone="primary" />
                <MetricCard label="Account" value={accountId || "Pending"} icon="id-card-outline" tone="dark" />
                <MetricCard label="Subscription" value={hasActiveSubscription ? "Active" : "Pending"} icon="repeat-outline" tone={hasActiveSubscription ? "success" : "warning"} />
                <MetricCard label="Connect" value={hasStripeConnectAccount ? "Connected" : "Missing"} icon="business-outline" tone={hasStripeConnectAccount ? "success" : "danger"} />
              </View>

              <View style={styles.mobileStepper}>
                <WizardStepper step={step} setStep={setStep} />
              </View>

              {renderCurrentStep()}

              <View style={styles.footerNav}>
                <TouchableOpacity style={[styles.footerButton, step === 0 && styles.disabledButton]} onPress={goBack} disabled={step === 0}>
                  <Ionicons name="chevron-back-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.footerButtonText}>Back</Text>
                </TouchableOpacity>
                {step < STEPS.length - 1 ? (
                  <TouchableOpacity style={styles.footerPrimaryButton} onPress={goNext}>
                    <Text style={styles.footerPrimaryText}>Continue</Text>
                    <Ionicons name="chevron-forward-outline" size={18} color={COLORS.white} />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.footerPrimaryButton} onPress={submitToDashboard}>
                    <Text style={styles.footerPrimaryText}>Finish</Text>
                    <Ionicons name="checkmark-outline" size={18} color={COLORS.white} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function WizardStepper({ step, setStep }: { step: number; setStep: (index: number) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stepperRow}>
      {STEPS.map((item, index) => {
        const active = step === index;
        const complete = index < step;
        return (
          <TouchableOpacity key={item.key} style={styles.stepperItem} onPress={() => setStep(index)}>
            <View style={[styles.stepCircle, active && styles.stepCircleActive, complete && styles.stepCircleDone]}>
              <Text style={[styles.stepNumber, (active || complete) && styles.stepNumberActive]}>{complete ? "✓" : index + 1}</Text>
            </View>
            <Text style={[styles.stepLabel, active && styles.stepLabelActive]}>{item.title}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

function FinaPanel({ icon, title, subtitle, children }: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <View style={styles.panelIcon}><Ionicons name={icon} size={22} color={COLORS.white} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.panelTitle}>{title}</Text>
          <Text style={styles.panelSubtitle}>{subtitle}</Text>
        </View>
      </View>
      {children}
    </View>
  );
}

function TwoColumn({ children }: { children: React.ReactNode }) {
  return <View style={styles.twoColumn}>{children}</View>;
}

function Field({ label, ...props }: any) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput style={styles.input} placeholderTextColor="#98A2B3" {...props} />
    </View>
  );
}

function MetricCard({ label, value, icon, tone }: { label: string; value: string; icon: keyof typeof Ionicons.glyphMap; tone: "primary" | "dark" | "success" | "warning" | "danger" }) {
  const bg = tone === "primary" ? COLORS.primary : tone === "success" ? COLORS.accent : tone === "warning" ? COLORS.warning : tone === "danger" ? COLORS.danger : COLORS.dark;
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricIcon, { backgroundColor: bg }]}><Ionicons name={icon} size={20} color={COLORS.white} /></View>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function StatusTile({ title, value, good, icon }: { title: string; value: string; good: boolean; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.statusTile}>
      <View style={[styles.statusIcon, { backgroundColor: good ? COLORS.accent : COLORS.warning }]}>
        <Ionicons name={good ? "checkmark-outline" : icon} size={19} color={COLORS.white} />
      </View>
      <Text style={styles.statusTitle}>{title}</Text>
      <Text style={styles.statusValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text style={styles.reviewValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function InfoBanner({ icon, title, text, tone }: { icon: keyof typeof Ionicons.glyphMap; title: string; text: string; tone: "info" | "success" | "warning" }) {
  const bg = tone === "success" ? "#ECFDF3" : tone === "warning" ? "#FFFAEB" : COLORS.primarySoft;
  const border = tone === "success" ? "#ABEFC6" : tone === "warning" ? "#FEDF89" : "#C7D7FE";
  const iconBg = tone === "success" ? COLORS.accent : tone === "warning" ? COLORS.warning : COLORS.primary;
  return (
    <View style={[styles.infoBanner, { backgroundColor: bg, borderColor: border }]}>
      <View style={[styles.infoBannerIcon, { backgroundColor: iconBg }]}><Ionicons name={icon} size={18} color={COLORS.white} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoBannerTitle}>{title}</Text>
        <Text style={styles.infoBannerText}>{text}</Text>
      </View>
    </View>
  );
}

function SwitchCard({ label, description, value, onValueChange }: { label: string; description: string; value: boolean; onValueChange: (value: boolean) => void }) {
  return (
    <View style={styles.switchCard}>
      <View style={{ flex: 1 }}>
        <Text style={styles.switchTitle}>{label}</Text>
        <Text style={styles.switchSub}>{description}</Text>
      </View>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ false: "#D0D5DD", true: COLORS.primary }} thumbColor={COLORS.white} />
    </View>
  );
}

function ActionButton({ icon, label, onPress, loading, variant = "primary", disabled }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; loading?: boolean; variant?: "primary" | "dark" | "outline" | "secondary"; disabled?: boolean }) {
  const style = variant === "outline" ? styles.outlineAction : variant === "dark" ? styles.darkAction : variant === "secondary" ? styles.secondaryAction : styles.primaryAction;
  const color = variant === "outline" || variant === "secondary" ? COLORS.primary : COLORS.white;
  return (
    <TouchableOpacity style={[style, (loading || disabled) && styles.disabledButton]} onPress={onPress} disabled={loading || disabled} activeOpacity={0.85}>
      {loading ? <ActivityIndicator color={color} /> : <Ionicons name={icon} size={18} color={color} />}
      <Text style={[styles.actionText, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  keyboard: { flex: 1 },
  page: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16, paddingBottom: 70 },
  shell: { flexDirection: Platform.OS === "web" ? "row" : "column", gap: 18, width: "100%" },
  sidebar: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 28,
    padding: 16,
    width: Platform.OS === "web" ? 270 : "100%",
    alignSelf: "stretch",
  },
  brandBlock: { flexDirection: "row", gap: 12, alignItems: "center", marginBottom: 18 },
  brandIcon: { width: 46, height: 46, borderRadius: 16, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  brandTitle: { color: COLORS.text, fontWeight: "900", fontSize: 18 },
  brandSub: { color: COLORS.muted, fontWeight: "700", marginTop: 2 },
  sideStep: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 16, marginBottom: 7 },
  sideStepActive: { backgroundColor: COLORS.primarySoft },
  sideStepIcon: { width: 34, height: 34, borderRadius: 13, backgroundColor: COLORS.primarySoft, alignItems: "center", justifyContent: "center" },
  sideStepIconActive: { backgroundColor: COLORS.primary },
  sideStepIconDone: { backgroundColor: COLORS.accent },
  sideStepText: { color: COLORS.muted, fontWeight: "800" },
  sideStepTextActive: { color: COLORS.primary, fontWeight: "900" },
  sidebarLogin: { marginTop: 10, padding: 13, borderRadius: 15, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 },
  sidebarLoginText: { color: COLORS.primary, fontWeight: "900" },
  main: { flex: 1, minWidth: 0 },
  topbar: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: 28, padding: 20, flexDirection: "row", gap: 12, justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  kicker: { color: COLORS.primary, fontSize: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1 },
  title: { color: COLORS.text, fontSize: 32, fontWeight: "900", marginTop: 4 },
  subtitle: { color: COLORS.muted, fontWeight: "700", marginTop: 6, lineHeight: 22 },
  dashboardButton: { backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16, flexDirection: "row", alignItems: "center", gap: 8 },
  dashboardButtonText: { color: COLORS.white, fontWeight: "900" },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 16 },
  metricCard: { flexGrow: 1, flexBasis: Platform.OS === "web" ? "23%" : "47%", backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: 22, padding: 16, minHeight: 125 },
  metricIcon: { width: 38, height: 38, borderRadius: 14, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  metricLabel: { color: COLORS.muted, fontWeight: "800", fontSize: 12, textTransform: "uppercase" },
  metricValue: { color: COLORS.text, fontWeight: "900", fontSize: 20, marginTop: 5 },
  mobileStepper: { display: Platform.OS === "web" ? "none" : "flex", marginBottom: 14 },
  stepperRow: { gap: 12, paddingVertical: 4 },
  stepperItem: { alignItems: "center", gap: 5, minWidth: 70 },
  stepCircle: { width: 32, height: 32, borderRadius: 999, backgroundColor: COLORS.surface2, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.border },
  stepCircleActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  stepCircleDone: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  stepNumber: { color: COLORS.muted, fontWeight: "900" },
  stepNumberActive: { color: COLORS.white },
  stepLabel: { color: COLORS.muted, fontWeight: "800", fontSize: 11 },
  stepLabelActive: { color: COLORS.primary },
  panel: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: 28, padding: 20, marginBottom: 16 },
  panelHeader: { flexDirection: "row", gap: 12, alignItems: "flex-start", marginBottom: 18 },
  panelIcon: { width: 46, height: 46, borderRadius: 16, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  panelTitle: { color: COLORS.text, fontWeight: "900", fontSize: 23 },
  panelSubtitle: { color: COLORS.muted, fontWeight: "700", lineHeight: 21, marginTop: 4 },
  twoColumn: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  fieldWrap: { flexGrow: 1, flexBasis: Platform.OS === "web" ? "48%" : "100%" },
  fieldLabel: { color: COLORS.text, fontWeight: "900", marginBottom: 7 },
  input: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 15, paddingHorizontal: 14, paddingVertical: 14, color: COLORS.text, fontWeight: "800", fontSize: 15, marginBottom: 12 },
  equipmentGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },
  equipmentCard: { flexBasis: Platform.OS === "web" ? "31%" : "47%", flexGrow: 1, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 18, padding: 14, minHeight: 96, justifyContent: "space-between" },
  equipmentCardActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  equipmentText: { color: COLORS.text, fontWeight: "900", marginTop: 10 },
  equipmentTextActive: { color: COLORS.white },
  switchCard: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 18, padding: 15, marginBottom: 10, flexDirection: "row", alignItems: "center", gap: 12 },
  switchTitle: { color: COLORS.text, fontWeight: "900" },
  switchSub: { color: COLORS.muted, fontWeight: "700", marginTop: 4, lineHeight: 19 },
  questionBlock: { marginBottom: 12 },
  questionRow: { gap: 8, paddingBottom: 8 },
  questionChip: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 999, maxWidth: 280 },
  questionChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  questionChipText: { color: COLORS.primary, fontWeight: "900" },
  questionChipTextActive: { color: COLORS.white },
  statusGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
  statusTile: { flexGrow: 1, flexBasis: Platform.OS === "web" ? "31%" : "100%", backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 20, padding: 15 },
  statusIcon: { width: 36, height: 36, borderRadius: 14, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  statusTitle: { color: COLORS.muted, fontWeight: "900", textTransform: "uppercase", fontSize: 12 },
  statusValue: { color: COLORS.text, fontWeight: "900", marginTop: 5 },
  actionStack: { gap: 10 },
  primaryAction: { backgroundColor: COLORS.primary, borderRadius: 16, padding: 15, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, width: "100%" },
  darkAction: { backgroundColor: COLORS.dark, borderRadius: 16, padding: 15, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, width: "100%" },
  outlineAction: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.primary, borderRadius: 16, padding: 15, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, width: "100%" },
  secondaryAction: { backgroundColor: COLORS.primarySoft, borderWidth: 1, borderColor: "#C7D7FE", borderRadius: 16, padding: 15, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, width: "100%" },
  actionText: { fontWeight: "900", textAlign: "center", flexShrink: 1 },
  reviewGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 },
  reviewRow: { flexGrow: 1, flexBasis: Platform.OS === "web" ? "31%" : "100%", backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, padding: 13 },
  reviewLabel: { color: COLORS.muted, fontWeight: "900", fontSize: 11, textTransform: "uppercase" },
  reviewValue: { color: COLORS.text, fontWeight: "900", marginTop: 5, lineHeight: 19 },
  infoBanner: { borderWidth: 1, borderRadius: 18, padding: 14, flexDirection: "row", gap: 10, alignItems: "flex-start", marginBottom: 12 },
  infoBannerIcon: { width: 34, height: 34, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  infoBannerTitle: { color: COLORS.text, fontWeight: "900" },
  infoBannerText: { color: COLORS.muted, fontWeight: "700", lineHeight: 20, marginTop: 3 },
  footerNav: { flexDirection: "row", justifyContent: "space-between", gap: 12, marginBottom: 20 },
  footerButton: { flex: 1, backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, padding: 15, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 },
  footerButtonText: { color: COLORS.primary, fontWeight: "900" },
  footerPrimaryButton: { flex: 1, backgroundColor: COLORS.primary, borderRadius: 16, padding: 15, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 },
  footerPrimaryText: { color: COLORS.white, fontWeight: "900" },
  disabledButton: { opacity: 0.55 },
});
