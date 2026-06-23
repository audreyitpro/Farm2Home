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
  navy: "#020617",
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

type FreightRow = {
  id: string;
  freight_id: string;
  auth_user_id: string;
  profile_id: string;
  role: "freight";
  email: string;
  account_id: string;
  company_name: string;
  business_name: string;
  contact_name: string;
  full_name: string;
  name: string;
  owner_name: string;
  phone: string;
  username: string;
  stripe_customer_id: string;
  subscription_id: string;
  freight_account: string;
  account_active: boolean;
  approved: boolean;
  freight_membership_paid: boolean;
  membership_status: string;
  verification_status: string;
  compliance_status: string;
  admin_review_status: string;
};

function clean(value: any) {
  return String(value ?? "").trim();
}

function normalize(value: any) {
  return clean(value).toLowerCase();
}

function normalizeAnswer(value: any) {
  return normalize(value);
}

function isUuid(value: any) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clean(value));
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

function maskId(value: string, fallback = "Missing") {
  const id = clean(value);
  if (!id) return fallback;
  if (id.length <= 14) return id;
  return `${id.slice(0, 8)}...${id.slice(-5)}`;
}

function makeFallbackAccountId() {
  const stamp = Date.now().toString().slice(-6);
  return `Freight_${stamp}`;
}

async function parseApiResponse(response: Response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { success: false, error: text || "Invalid backend response." };
  }
}

function getStripeLaunchUrl(data: any) {
  return clean(
    data?.url ||
      data?.onboardingUrl ||
      data?.onboarding_url ||
      data?.accountLink ||
      data?.account_link ||
      data?.accountLinkUrl ||
      data?.account_link_url ||
      data?.connectUrl ||
      data?.connect_url ||
      data?.checkoutUrl ||
      data?.checkout_url ||
      data?.sessionUrl ||
      data?.session_url ||
      data?.checkoutSessionUrl ||
      data?.checkout_session_url ||
      data?.link ||
      data?.accountLink?.url ||
      data?.account_link?.url ||
      data?.data?.url ||
      data?.data?.onboardingUrl ||
      data?.data?.onboarding_url ||
      data?.data?.accountLink ||
      data?.data?.account_link ||
      data?.data?.accountLink?.url ||
      data?.data?.account_link?.url ||
      data?.result?.url ||
      data?.result?.onboardingUrl ||
      data?.result?.onboarding_url ||
      data?.result?.accountLink ||
      data?.result?.account_link ||
      data?.result?.accountLink?.url ||
      data?.result?.account_link?.url
  );
}

async function openUrl(url: string) {
  const finalUrl = clean(url);

  console.log("OPEN STRIPE URL:", finalUrl);

  if (!finalUrl || !finalUrl.startsWith("http")) {
    Alert.alert("Stripe Error", "No valid Stripe URL was returned.");
    return;
  }

  if (Platform.OS === "web") {
    window.location.assign(finalUrl);
    return;
  }

  try {
    const result = await WebBrowser.openBrowserAsync(finalUrl);
    console.log("STRIPE BROWSER RESULT:", result);

    if (result?.type === "cancel" || result?.type === "dismiss") {
      await Linking.openURL(finalUrl);
    }
  } catch (browserError) {
    console.log("WebBrowser open failed, trying Linking:", browserError);

    const canOpen = await Linking.canOpenURL(finalUrl);
    if (!canOpen) {
      Alert.alert("Stripe Error", "This device cannot open the Stripe URL.");
      return;
    }

    await Linking.openURL(finalUrl);
  }
}

async function saveFreightSession(carrier: any) {
  const sessionCarrier = {
    ...carrier,
    role: "freight",
    freightId: carrier.freight_id || carrier.freightId || carrier.id,
    freight_id: carrier.freight_id || carrier.freightId || carrier.id,
    accountId: carrier.account_id || carrier.accountId,
    account_id: carrier.account_id || carrier.accountId,
    companyName: carrier.company_name || carrier.companyName || carrier.business_name || carrier.businessName,
    company_name: carrier.company_name || carrier.companyName || carrier.business_name || carrier.businessName,
    businessName: carrier.business_name || carrier.businessName || carrier.company_name || carrier.companyName,
    business_name: carrier.business_name || carrier.businessName || carrier.company_name || carrier.companyName,
    fullName: carrier.full_name || carrier.fullName || carrier.name || carrier.contact_name,
    full_name: carrier.full_name || carrier.fullName || carrier.name || carrier.contact_name,
    stripeCustomerId: carrier.stripe_customer_id || carrier.stripeCustomerId,
    stripe_customer_id: carrier.stripe_customer_id || carrier.stripeCustomerId,
    subscriptionId: carrier.subscription_id || carrier.subscriptionId || carrier.stripe_subscription_id,
    subscription_id: carrier.subscription_id || carrier.subscriptionId || carrier.stripe_subscription_id,
    stripeSubscriptionId: carrier.subscription_id || carrier.subscriptionId || carrier.stripe_subscription_id,
    stripe_subscription_id: carrier.subscription_id || carrier.subscriptionId || carrier.stripe_subscription_id,
    freightAccount: carrier.freight_account || carrier.freightAccount || carrier.stripe_account_id,
    freight_account: carrier.freight_account || carrier.freightAccount || carrier.stripe_account_id,
    stripeAccountId: carrier.freight_account || carrier.freightAccount || carrier.stripe_account_id,
    stripe_account_id: carrier.freight_account || carrier.freightAccount || carrier.stripe_account_id,
    accountActive: carrier.account_active,
    account_active: carrier.account_active,
    membershipStatus: carrier.membership_status,
    membership_status: carrier.membership_status,
    updatedAt: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await AsyncStorage.multiSet([
    ["pendingFreightCarrier", JSON.stringify(sessionCarrier)],
    ["pendingFreightProfile", JSON.stringify(sessionCarrier)],
    ["currentFreightCarrier", JSON.stringify(sessionCarrier)],
    ["currentFreight", JSON.stringify(sessionCarrier)],
    ["currentFreightUser", JSON.stringify(sessionCarrier)],
    ["farm2homeCurrentFreight", JSON.stringify(sessionCarrier)],
    ["currentUser", JSON.stringify(sessionCarrier)],
    ["userRole", "freight"],
    ["currentUserRole", "freight"],
    ["lastLoginRole", "freight"],
    ["lastFreightDashboardReady", hasCompleteDashboardAccess(sessionCarrier) ? "true" : "false"],
  ]);
}

function hasCompleteDashboardAccess(row: any) {
  return Boolean(
    clean(row?.id || row?.freight_id || row?.freightId) &&
      clean(row?.account_id || row?.accountId) &&
      isStripeCustomerId(row?.stripe_customer_id || row?.stripeCustomerId) &&
      isStripeSubscriptionId(row?.subscription_id || row?.subscriptionId || row?.stripe_subscription_id) &&
      isStripeConnectAccountId(row?.freight_account || row?.freightAccount || row?.stripe_account_id)
  );
}

export default function FreightRegister() {
  const params = useLocalSearchParams();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [syncingStripe, setSyncingStripe] = useState(false);
  const [connectLoading, setConnectLoading] = useState(false);
  const [processingReturn, setProcessingReturn] = useState(false);

  const [savedCarrierId, setSavedCarrierId] = useState("");
  const [profileId, setProfileId] = useState("");
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

  const setupStatus = useMemo(() => {
    return [
      {
        label: "Freight Profile",
        complete: Boolean(savedCarrierId || freightId),
        value: savedCarrierId || freightId ? "Found" : "Missing",
      },
      {
        label: "Static Account",
        complete: Boolean(accountId),
        value: accountId || "Missing",
      },
      {
        label: "Stripe Customer",
        complete: isStripeCustomerId(stripeCustomerId),
        value: maskId(stripeCustomerId),
      },
      {
        label: "Subscription",
        complete: isStripeSubscriptionId(subscriptionId),
        value: maskId(subscriptionId),
      },
      {
        label: "Stripe Connect",
        complete: isStripeConnectAccountId(freightAccount),
        value: maskId(freightAccount),
      },
    ];
  }, [savedCarrierId, freightId, accountId, stripeCustomerId, subscriptionId, freightAccount]);

  const setupScore = useMemo(() => setupStatus.filter((item) => item.complete).length, [setupStatus]);

  const allFiveRequirementsFound = useMemo(
    () =>
      Boolean(
        (savedCarrierId || freightId) &&
          accountId &&
          isStripeCustomerId(stripeCustomerId) &&
          isStripeSubscriptionId(subscriptionId) &&
          isStripeConnectAccountId(freightAccount)
      ),
    [savedCarrierId, freightId, accountId, stripeCustomerId, subscriptionId, freightAccount]
  );

  useEffect(() => {
    loadSavedFreight();
  }, []);

  useEffect(() => {
    const stripeStatus = String(params?.stripe || params?.payment || "");
    const connectStatus = String(params?.connect || params?.connected || "");
    const returnedFreightId = String(params?.freightId || params?.freight_id || "");
    const returnedEmail = String(params?.email || "");

    if (returnedEmail) setEmail(normalize(returnedEmail));
    if (returnedFreightId) {
      setFreightId(returnedFreightId);
      setSavedCarrierId(returnedFreightId);
    }

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
    params?.email,
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

  function hydrateForm(row: any) {
    const rowFreightId = clean(row?.id || row?.freight_id || row?.freightId || "");
    const rowProfileId = clean(row?.profile_id || row?.profileId || "");
    const rowAccountId = clean(row?.account_id || row?.accountId || "");
    const rowCustomerId = pickStripeCustomerId(row?.stripe_customer_id, row?.stripeCustomerId);
    const rowSubId = pickStripeSubscriptionId(row?.subscription_id, row?.subscriptionId, row?.stripe_subscription_id);
    const rowConnectId = pickStripeConnectAccountId(row?.freight_account, row?.freightAccount, row?.stripe_account_id);

    if (rowFreightId) {
      setFreightId(rowFreightId);
      setSavedCarrierId(rowFreightId);
    }
    if (rowProfileId) setProfileId(rowProfileId);
    if (rowAccountId) setAccountId(rowAccountId);
    if (rowCustomerId) setStripeCustomerId(rowCustomerId);
    if (rowSubId) setSubscriptionId(rowSubId);
    if (rowConnectId) setFreightAccount(rowConnectId);

    setSubscriptionStatus(row?.subscription_status || row?.subscriptionStatus || subscriptionStatus || "");

    if (row?.company_name || row?.business_name || row?.companyName) {
      setCompanyName(clean(row.company_name || row.business_name || row.companyName));
    }
    if (row?.full_name || row?.contact_name || row?.name) {
      setContactName(clean(row.full_name || row.contact_name || row.name));
    }
    if (row?.email || row?.freight_email) setEmail(normalize(row.email || row.freight_email));
    if (row?.phone) setPhone(clean(row.phone));
    if (row?.username) setUsername(clean(row.username));
    if (row?.service_area) setServiceArea(clean(row.service_area));

    if (row?.business_address) setBusinessAddress(clean(row.business_address));
    if (row?.city) setCity(clean(row.city));
    if (row?.state) setStateValue(clean(row.state));
    if (row?.zip_code) setZipCode(clean(row.zip_code));

    if (row?.mdot_number || row?.dot_number) setMdotNumber(clean(row.mdot_number || row.dot_number));
    if (row?.mc_number) setMcNumber(clean(row.mc_number));
    if (row?.insurance_provider) setInsuranceProvider(clean(row.insurance_provider));
    if (row?.insurance_policy_number) setInsurancePolicyNumber(clean(row.insurance_policy_number));

    setAuthorityActive(Boolean(row?.authority_active));
    setInsuranceActive(Boolean(row?.insurance_active));
    setLicensedLivestock(Boolean(row?.licensed_livestock));
    setLicensedRefrigeratedFood(Boolean(row?.licensed_refrigerated_food));

    if (row?.security_question_1) setSecurityQuestion1(clean(row.security_question_1));
    if (row?.security_question_2) setSecurityQuestion2(clean(row.security_question_2));
    if (row?.security_question_3) setSecurityQuestion3(clean(row.security_question_3));
    setHasSavedSecurityAnswer1(Boolean(row?.security_answer_1));
    setHasSavedSecurityAnswer2(Boolean(row?.security_answer_2));
    setHasSavedSecurityAnswer3(Boolean(row?.security_answer_3));

    const equipmentText = clean(row?.equipment_type || "");
    if (equipmentText) {
      setSelectedEquipment(
        equipmentText
          .split(",")
          .map((item) => normalize(item))
          .filter(Boolean)
      );
    }
  }

  function buildCurrentSnapshot(base: any = {}) {
    const id = clean(base.id || base.freight_id || savedCarrierId || freightId);
    const finalConnect = pickStripeConnectAccountId(base.freight_account, base.stripe_account_id, freightAccount);
    const finalSub = pickStripeSubscriptionId(base.subscription_id, base.stripe_subscription_id, subscriptionId);
    const finalCustomer = pickStripeCustomerId(base.stripe_customer_id, stripeCustomerId);

    return {
      ...base,
      id,
      freight_id: id,
      freightId: id,
      auth_user_id: clean(base.auth_user_id || id),
      profile_id: clean(base.profile_id || profileId),
      role: "freight",
      email: normalize(base.email || email),
      account_id: clean(base.account_id || accountId),
      accountId: clean(base.account_id || accountId),
      company_name: clean(base.company_name || companyName),
      companyName: clean(base.company_name || companyName),
      business_name: clean(base.business_name || companyName),
      businessName: clean(base.business_name || companyName),
      contact_name: clean(base.contact_name || contactName),
      full_name: clean(base.full_name || contactName),
      fullName: clean(base.full_name || contactName),
      name: clean(base.name || contactName),
      phone: clean(base.phone || phone),
      username: normalize(base.username || username),
      stripe_customer_id: finalCustomer,
      stripeCustomerId: finalCustomer,
      subscription_id: finalSub,
      subscriptionId: finalSub,
      stripe_subscription_id: finalSub,
      stripeSubscriptionId: finalSub,
      subscription_status: clean(base.subscription_status || subscriptionStatus || (finalSub ? "active" : "pending_payment")),
      freight_account: finalConnect,
      freightAccount: finalConnect,
      stripe_account_id: finalConnect,
      stripeAccountId: finalConnect,
      membership_status: finalSub ? "active" : "pending_payment",
      account_active: Boolean(id && accountId && finalCustomer && finalSub && finalConnect),
      updated_at: new Date().toISOString(),
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

    if (!savedCarrierId && !freightId) {
      if (!username.trim() || !password.trim() || !confirmPassword.trim()) {
        Alert.alert("Login Required", "Please create a username and password.");
        setStep(0);
        return false;
      }

      if (password.trim().length < 6) {
        Alert.alert("Weak Password", "Password must be at least 6 characters.");
        setStep(0);
        return false;
      }

      if (password.trim() !== confirmPassword.trim()) {
        Alert.alert("Password Mismatch", "Passwords do not match.");
        setStep(0);
        return false;
      }
    }

    if (username.trim() && normalize(username).length < 4) {
      Alert.alert("Invalid Username", "Username must be at least 4 characters.");
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
      Alert.alert("License Required", "Select livestock, refrigerated food, or refrigerated produce.");
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
      Alert.alert("Security Answers Required", "Please answer all 3 security questions.");
      setStep(3);
      return false;
    }

    return true;
  }

  async function generateFreightAccountId() {
    try {
      const { data, error } = await supabase.rpc("next_account_id", {
        p_role: "freight",
        p_prefix: "Freight",
      });

      if (!error && data) return String(data);
    } catch (error) {
      console.log("next_account_id skipped:", error);
    }

    return makeFallbackAccountId();
  }

  async function findFreightUserByIdOrEmail(targetId?: string, targetEmail?: string) {
    const id = clean(targetId);
    const emailValue = normalize(targetEmail);

    if (id) {
      const { data, error } = await supabase
        .from("freight_users")
        .select("*")
        .or(`id.eq.${id},freight_id.eq.${id}`)
        .maybeSingle();

      if (!error && data) return data;
      if (error) console.log("freight lookup by id:", error.message);
    }

    if (emailValue) {
      const { data, error } = await supabase
        .from("freight_users")
        .select("*")
        .eq("email", emailValue)
        .maybeSingle();

      if (!error && data) return data;
      if (error) console.log("freight lookup by email:", error.message);
    }

    return null;
  }

  async function findProfileByEmail(targetEmail: string) {
    const emailValue = normalize(targetEmail);
    if (!emailValue) return null;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", emailValue)
      .maybeSingle();

    if (error) {
      console.log("profile lookup error:", error.message);
      return null;
    }

    return data || null;
  }

  async function findProfileByAuthId(authId: string) {
    if (!isUuid(authId)) return null;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .or(`id.eq.${authId},auth_user_id.eq.${authId}`)
      .maybeSingle();

    if (error) {
      console.log("profile lookup auth error:", error.message);
      return null;
    }

    return data || null;
  }

  async function getBestFreightSubscription(targetId?: string, targetEmail?: string) {
    const id = clean(targetId);
    const emailValue = normalize(targetEmail);

    const filters = [
      id ? `freight_id.eq.${id}` : "",
      emailValue ? `freight_email.eq.${emailValue}` : "",
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
      console.log("subscription lookup error:", error.message);
      return null;
    }

    if (!Array.isArray(data) || data.length === 0) return null;

    const completeRow = data.find(
      (row) =>
        pickStripeCustomerId(row?.stripe_customer_id) &&
        pickStripeSubscriptionId(row?.stripe_subscription_id) &&
        pickStripeConnectAccountId(row?.freight_account, row?.stripe_account_id)
    );

    return completeRow || data[0];
  }

  async function upsertProfileForFreight(authId: string, emailValue: string, accountValue: string, connectValue: string) {
    const existingByEmail = await findProfileByEmail(emailValue);
    const existingByAuth = existingByEmail ? null : await findProfileByAuthId(authId);
    const existing = existingByEmail || existingByAuth;

    const payload = {
      auth_user_id: authId,
      role: "freight",
      full_name: contactName.trim(),
      email: normalize(emailValue),
      phone: phone.trim(),
      account_id: accountValue,
      freight_account: connectValue || null,
      stripe_account_id: connectValue || null,
    };

    if (existing?.id) {
      const { data, error } = await supabase
        .from("profiles")
        .update(payload)
        .eq("id", existing.id)
        .select("*")
        .maybeSingle();

      if (error) throw error;
      return data || { ...existing, ...payload };
    }

    const { data, error } = await supabase
      .from("profiles")
      .insert({
        id: authId,
        ...payload,
        created_at: new Date().toISOString(),
      })
      .select("*")
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async function upsertFreightSubscriptionRow(values: {
    freightId: string;
    emailValue: string;
    customerId?: string;
    subscriptionValue?: string;
    connectValue?: string;
    subscriptionStatusValue?: string;
  }) {
    const now = new Date().toISOString();
    const connect = pickStripeConnectAccountId(values.connectValue);
    const sub = pickStripeSubscriptionId(values.subscriptionValue);
    const customer = pickStripeCustomerId(values.customerId);

    const payload = {
      freight_id: values.freightId,
      freight_email: normalize(values.emailValue),
      name: companyName.trim(),
      username: normalize(username),
      stripe_customer_id: customer || null,
      stripe_subscription_id: sub || null,
      subscription_status: values.subscriptionStatusValue || (sub ? "active" : "pending_payment"),
      stripe_account_id: connect || null,
      freight_account: connect || null,
      updated_at: now,
    };

    const { data: existing, error: lookupError } = await supabase
      .from("freight_subscriptions")
      .select("id")
      .or(`freight_id.eq.${values.freightId},freight_email.eq.${normalize(values.emailValue)}`)
      .limit(1);

    if (lookupError) {
      console.log("subscription lookup before save failed:", lookupError.message);
    }

    if (Array.isArray(existing) && existing[0]?.id) {
      const { error } = await supabase
        .from("freight_subscriptions")
        .update(payload)
        .eq("id", existing[0].id);

      if (error) throw error;
      return;
    }

    const { error } = await supabase
      .from("freight_subscriptions")
      .insert({ ...payload, created_at: now });

    if (error) throw error;
  }

  async function saveAdminVerificationIfTableExists(carrierId: string, savedFreightUser: any) {
    const now = new Date().toISOString();
    const paid = Boolean(savedFreightUser.subscription_id);
    const connect = pickStripeConnectAccountId(savedFreightUser.freight_account);

    const payload = {
      id: carrierId,
      account_id: savedFreightUser.account_id,
      carrier_id: carrierId,
      freight_id: carrierId,
      profile_id: savedFreightUser.profile_id,
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
      approved: paid,
      rejected: false,
      reviewed: false,
      needs_more_info: false,
      account_active: paid,
      membership_status: paid ? "active" : "pending_payment",
      subscription_status: subscriptionStatus || (paid ? "active" : "pending_payment"),
      freight_membership_paid: paid,
      application_submitted: paid,
      submitted_at: paid ? now : null,
      stripe_customer_id: savedFreightUser.stripe_customer_id || null,
      freight_account: connect || null,
      stripe_account_id: connect || null,
      stripe_subscription_id: savedFreightUser.subscription_id || null,
      subscription_id: savedFreightUser.subscription_id || null,
      updated_at: now,
      created_at: now,
    };

    const { error } = await supabase
      .from("admin_verifications")
      .upsert(payload, { onConflict: "id" });

    if (error) console.log("admin_verifications skipped:", error.message);
  }

  async function saveFreightUserRow(authId: string, passedAccountId?: string) {
    const now = new Date().toISOString();
    const emailValue = normalize(email);
    const existing = await findFreightUserByIdOrEmail(authId, emailValue);
    const subRow = await getBestFreightSubscription(authId, emailValue);

    const finalAccountId = clean(existing?.account_id || passedAccountId || accountId || (await generateFreightAccountId()));
    const finalCustomerId = pickStripeCustomerId(stripeCustomerId, existing?.stripe_customer_id, subRow?.stripe_customer_id);
    const finalSubscriptionId = pickStripeSubscriptionId(subscriptionId, existing?.subscription_id, subRow?.stripe_subscription_id);
    const finalConnectAccount = pickStripeConnectAccountId(
      freightAccount,
      existing?.freight_account,
      subRow?.freight_account,
      subRow?.stripe_account_id
    );
    const finalStatus = subscriptionStatus || subRow?.subscription_status || (finalSubscriptionId ? "active" : "pending_payment");
    const complete = Boolean(authId && finalAccountId && finalCustomerId && finalSubscriptionId && finalConnectAccount);

    const profile = await upsertProfileForFreight(authId, emailValue, finalAccountId, finalConnectAccount);
    if (!profile?.id) throw new Error("Profile could not be created.");

    const freightPayload: any = {
      id: authId,
      freight_id: authId,
      auth_user_id: authId,
      profile_id: profile.id,
      role: "freight",

      company_name: companyName.trim(),
      business_name: companyName.trim(),
      contact_name: contactName.trim(),
      full_name: contactName.trim(),
      name: contactName.trim(),
      owner_name: contactName.trim(),

      email: emailValue,
      phone: phone.trim(),
      username: normalize(username),

      // Do not store raw passwords in Supabase profile tables.
      // Authentication uses Supabase Auth.

      account_id: finalAccountId,
      stripe_customer_id: finalCustomerId || null,
      subscription_id: finalSubscriptionId || null,
      freight_account: finalConnectAccount || null,

      account_active: complete,
      approved: complete,
      freight_membership_paid: Boolean(finalSubscriptionId),
      membership_status: finalSubscriptionId ? "active" : "pending_payment",
      verification_status: complete ? "SUBMITTED" : "REGISTERED",
      compliance_status: complete ? "SUBMITTED" : "PENDING_PAYMENT",
      admin_review_status: complete ? "submitted" : "pending_payment",

      security_question_1: securityQuestion1,
      security_question_2: securityQuestion2,
      security_question_3: securityQuestion3,
      security_answer_1: securityAnswer1.trim()
        ? normalizeAnswer(securityAnswer1)
        : existing?.security_answer_1 || null,
      security_answer_2: securityAnswer2.trim()
        ? normalizeAnswer(securityAnswer2)
        : existing?.security_answer_2 || null,
      security_answer_3: securityAnswer3.trim()
        ? normalizeAnswer(securityAnswer3)
        : existing?.security_answer_3 || null,

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

      updated_at: now,
    };

    const { data: savedFreightUser, error } = await supabase
      .from("freight_users")
      .upsert(existing?.id ? freightPayload : { ...freightPayload, created_at: now }, {
        onConflict: "id",
      })
      .select("*")
      .maybeSingle();

    if (error) throw error;
    if (!savedFreightUser?.id) throw new Error("Freight registration did not save.");

    await upsertFreightSubscriptionRow({
      freightId: authId,
      emailValue,
      customerId: finalCustomerId,
      subscriptionValue: finalSubscriptionId,
      connectValue: finalConnectAccount,
      subscriptionStatusValue: finalStatus,
    });

    await saveAdminVerificationIfTableExists(authId, savedFreightUser);

    const finalRow = {
      ...savedFreightUser,
      stripe_subscription_id: savedFreightUser.subscription_id,
      stripe_account_id: savedFreightUser.freight_account,
      subscription_status: finalStatus,
    };

    hydrateForm(finalRow);
    await saveFreightSession(finalRow);

    setSavedCarrierId(savedFreightUser.id);
    setFreightId(savedFreightUser.id);
    setProfileId(clean(savedFreightUser.profile_id));
    setAccountId(clean(savedFreightUser.account_id));
    setStripeCustomerId(pickStripeCustomerId(savedFreightUser.stripe_customer_id));
    setSubscriptionId(pickStripeSubscriptionId(savedFreightUser.subscription_id));
    setFreightAccount(pickStripeConnectAccountId(savedFreightUser.freight_account));
    setSubscriptionStatus(finalStatus);

    setHasSavedSecurityAnswer1(Boolean(savedFreightUser.security_answer_1));
    setHasSavedSecurityAnswer2(Boolean(savedFreightUser.security_answer_2));
    setHasSavedSecurityAnswer3(Boolean(savedFreightUser.security_answer_3));
    setSecurityAnswer1("");
    setSecurityAnswer2("");
    setSecurityAnswer3("");

    return finalRow;
  }

  async function getOrCreateAuthUser() {
    const emailValue = normalize(email);

    const { data: currentUserData } = await supabase.auth.getUser();
    if (currentUserData?.user?.id) return currentUserData.user.id;

    const existingFreightUser = await findFreightUserByIdOrEmail("", emailValue);
    if (existingFreightUser?.id) return existingFreightUser.id;

    const { data, error } = await supabase.auth.signUp({
      email: emailValue,
      password: password.trim(),
      options: {
        data: {
          role: "freight",
          username: normalize(username),
          company_name: companyName.trim(),
          contact_name: contactName.trim(),
          full_name: contactName.trim(),
        },
      },
    });

    if (error) throw error;
    if (!data?.user?.id) throw new Error("Unable to create freight Auth user.");

    return data.user.id;
  }

  async function saveFreightProfile(fullValidation = false) {
    if (saving) return null;
    if (!validateForm({ full: fullValidation })) return null;

    try {
      setSaving(true);
      const authId = savedCarrierId || freightId || (await getOrCreateAuthUser());
      const saved = await saveFreightUserRow(authId, accountId || undefined);

      Alert.alert("Saved", "Freight registration was saved.");
      return saved;
    } catch (error: any) {
      Alert.alert("Save Error", error?.message || "Unable to save freight registration.");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function syncStripeFromBackend(silent = false) {
    const emailValue = normalize(email);
    const id = savedCarrierId || freightId;

    if (!emailValue && !id) {
      if (!silent) Alert.alert("Search Required", "Enter email or save registration first.");
      return null;
    }

    try {
      setSyncingStripe(true);

      const response = await fetch(`${API_BASE_URL}/payments/sync-stripe-by-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "freight",
          email: emailValue,
          freight_email: emailValue,
          businessName: companyName.trim(),
          companyName: companyName.trim(),
          name: companyName.trim() || contactName.trim(),
          username: normalize(username),
          userId: id,
          freightId: id,
          freight_id: id,
        }),
      });

      const json = await parseApiResponse(response);

      if (!response.ok || !json.success) {
        if (!silent) Alert.alert("Stripe Sync Not Found", json.error || "No Stripe customer/subscription was found.");
        return null;
      }

      const customer = pickStripeCustomerId(json.stripeCustomerId, json.stripe_customer_id);
      const sub = pickStripeSubscriptionId(json.stripeSubscriptionId, json.stripe_subscription_id);
      const connect = pickStripeConnectAccountId(json.freight_account, json.stripeAccountId, json.stripe_account_id);
      const status = json.subscriptionStatus || json.subscription_status || "active";

      if (customer) setStripeCustomerId(customer);
      if (sub) setSubscriptionId(sub);
      if (connect) setFreightAccount(connect);
      setSubscriptionStatus(status);

      const authId = id || (await getOrCreateAuthUser());
      const saved = await saveFreightUserRow(authId, accountId || undefined);

      if (!silent) Alert.alert("Stripe Retrieved", "Stripe customer, subscription, and Connect data were saved.");
      return saved;
    } catch (error: any) {
      if (!silent) Alert.alert("Retrieve Error", error?.message || "Unable to retrieve Stripe information.");
      return null;
    } finally {
      setSyncingStripe(false);
    }
  }

  async function retrieveMissingStripeInfo(routeWhenReady = false) {
    try {
      setSyncingStripe(true);

      const id = savedCarrierId || freightId || clean(String(params?.freightId || params?.freight_id || ""));
      const emailValue = normalize(email || String(params?.email || ""));

      const dbCarrier = await findFreightUserByIdOrEmail(id, emailValue);
      const subRow = await getBestFreightSubscription(dbCarrier?.id || id, dbCarrier?.email || emailValue);

      if (!dbCarrier && !subRow) {
        const backendSynced = await syncStripeFromBackend(true);
        if (backendSynced && routeWhenReady && hasCompleteDashboardAccess(backendSynced)) goDashboard();
        if (!backendSynced) Alert.alert("Not Found", "No freight Stripe records were found.");
        return backendSynced;
      }

      const targetId = dbCarrier?.id || subRow?.freight_id || id || (await getOrCreateAuthUser());
      const customer = pickStripeCustomerId(stripeCustomerId, dbCarrier?.stripe_customer_id, subRow?.stripe_customer_id);
      const sub = pickStripeSubscriptionId(subscriptionId, dbCarrier?.subscription_id, subRow?.stripe_subscription_id);
      const connect = pickStripeConnectAccountId(freightAccount, dbCarrier?.freight_account, subRow?.freight_account, subRow?.stripe_account_id);
      const status = subRow?.subscription_status || subscriptionStatus || (sub ? "active" : "pending_payment");

      if (customer) setStripeCustomerId(customer);
      if (sub) setSubscriptionId(sub);
      if (connect) setFreightAccount(connect);
      setSubscriptionStatus(status);

      const saved = await saveFreightUserRow(targetId, dbCarrier?.account_id || accountId || undefined);

      if (routeWhenReady && hasCompleteDashboardAccess(saved)) goDashboard();
      else Alert.alert("Stripe Info Retrieved", "Missing Stripe fields were synced and saved.");

      return saved;
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

      const savedRaw =
        (await AsyncStorage.getItem("pendingFreightCarrier")) ||
        (await AsyncStorage.getItem("currentFreightCarrier")) ||
        (await AsyncStorage.getItem("currentFreight")) ||
        (await AsyncStorage.getItem("currentFreightUser")) ||
        (await AsyncStorage.getItem("farm2homeCurrentFreight")) ||
        (await AsyncStorage.getItem("currentUser"));

      let localCarrier: any = null;

      if (savedRaw) {
        try {
          localCarrier = JSON.parse(savedRaw);
          hydrateForm(localCarrier);
        } catch {
          localCarrier = null;
        }
      }

      const { data: authData } = await supabase.auth.getUser();
      const authId = clean(authData?.user?.id || "");
      const authEmail = normalize(authData?.user?.email || "");

      const lookupId =
        returnedId ||
        authId ||
        localCarrier?.id ||
        localCarrier?.freight_id ||
        localCarrier?.freightId ||
        savedCarrierId ||
        freightId;

      const lookupEmail = normalize(returnedEmail || authEmail || localCarrier?.email || email);

      if (!lookupId && !lookupEmail) return;

      const dbCarrier = await findFreightUserByIdOrEmail(lookupId, lookupEmail);
      const subRow = await getBestFreightSubscription(dbCarrier?.id || lookupId, dbCarrier?.email || lookupEmail);

      if (dbCarrier) hydrateForm(dbCarrier);

      if (subRow) {
        const merged = {
          ...(dbCarrier || {}),
          id: dbCarrier?.id || subRow.freight_id || lookupId,
          freight_id: dbCarrier?.freight_id || subRow.freight_id || lookupId,
          email: dbCarrier?.email || subRow.freight_email || lookupEmail,
          company_name: dbCarrier?.company_name || subRow.name || companyName,
          business_name: dbCarrier?.business_name || subRow.name || companyName,
          name: dbCarrier?.name || subRow.name || contactName,
          stripe_customer_id: pickStripeCustomerId(dbCarrier?.stripe_customer_id, subRow.stripe_customer_id),
          subscription_id: pickStripeSubscriptionId(dbCarrier?.subscription_id, subRow.stripe_subscription_id),
          subscription_status: subRow.subscription_status || subscriptionStatus,
          freight_account: pickStripeConnectAccountId(dbCarrier?.freight_account, subRow.freight_account, subRow.stripe_account_id),
        };

        hydrateForm(merged);
        await saveFreightSession(merged);
      }
    } catch (error) {
      console.log("loadSavedFreight error:", error);
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
      const synced = await retrieveMissingStripeInfo(false);

      if (synced && hasCompleteDashboardAccess(synced)) {
        await saveFreightSession(synced);
        router.replace("/freight/dashboard" as any);
        return;
      }

      setStep(4);
      Alert.alert("Stripe Synced", "Membership payment returned. Complete Stripe Connect if still missing.");
    } catch (error: any) {
      Alert.alert("Stripe Return Error", error?.message || "Unable to complete Stripe return.");
    } finally {
      setProcessingReturn(false);
    }
  }

  async function handleConnectSuccessReturn(returnedFreightId?: string) {
    if (processingReturn) return;

    try {
      setProcessingReturn(true);
      if (returnedFreightId) {
        setSavedCarrierId(returnedFreightId);
        setFreightId(returnedFreightId);
      }

      await loadSavedFreight();
      const synced = await retrieveMissingStripeInfo(false);

      if (synced && hasCompleteDashboardAccess(synced)) {
        await saveFreightSession(synced);
        router.replace("/freight/dashboard" as any);
        return;
      }

      setStep(4);
      Alert.alert("Connect Synced", "Stripe Connect returned. Complete any remaining setup.");
    } catch (error: any) {
      Alert.alert("Connect Return Error", error?.message || "Unable to complete Stripe Connect return.");
    } finally {
      setProcessingReturn(false);
    }
  }

  async function handleStripeCheckout() {
    if (stripeLoading) return;

    try {
      setStripeLoading(true);

      const restored = await retrieveMissingStripeInfo(false);
      if (restored && isStripeSubscriptionId(restored.subscription_id)) {
        Alert.alert("Membership Already Active", "Your Stripe subscription is already saved.");
        setStep(4);
        return;
      }

      const saved = restored?.id ? restored : await saveFreightProfile(false);
      if (!saved?.id) return;

      const successUrl = `${APP_URL}/freight/register?stripe=success&freightId=${encodeURIComponent(saved.id)}&email=${encodeURIComponent(saved.email)}`;
      const cancelUrl = `${APP_URL}/freight/register?stripe=cancelled&freightId=${encodeURIComponent(saved.id)}&email=${encodeURIComponent(saved.email)}`;

      const response = await fetch(`${API_BASE_URL}/payments/create-freight-subscription-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "freight",
          planType: "freight",
          userId: saved.id,
          freightId: saved.id,
          freight_id: saved.id,
          accountId: saved.account_id,
          account_id: saved.account_id,
          email: saved.email,
          freight_email: saved.email,
          customerEmail: saved.email,
          companyName: saved.company_name,
          company_name: saved.company_name,
          businessName: saved.business_name,
          business_name: saved.business_name,
          name: saved.company_name,
          username: saved.username,
          successUrl,
          success_url: successUrl,
          cancelUrl,
          cancel_url: cancelUrl,
        }),
      });

      const json = await parseApiResponse(response);
      const url = getStripeLaunchUrl(json);
      console.log("FREIGHT STRIPE CHECKOUT RESPONSE:", json);

      if (!response.ok || (!json.success && !url && !json.alreadySubscribed)) {
        console.log("FREIGHT STRIPE ERROR RESPONSE:", json);
        Alert.alert("Stripe Error", json.error || json.message || "Unable to open Stripe membership checkout.");
        return;
      }

      const customer = pickStripeCustomerId(json.stripeCustomerId, json.stripe_customer_id, json.customerId, json.customer_id);
      const sub = pickStripeSubscriptionId(json.stripeSubscriptionId, json.stripe_subscription_id, json.subscriptionId, json.subscription_id);

      if (!url) {
        console.log("FREIGHT STRIPE CHECKOUT RESPONSE:", json);
        Alert.alert("Stripe Error", "Stripe checkout URL was not returned from backend.");
        return;
      }

      // Launch Stripe immediately. Do not let Supabase saves block browser launch.
      void openUrl(url);

      if (customer) setStripeCustomerId(customer);
      if (sub) setSubscriptionId(sub);
      if (json.subscriptionStatus || json.subscription_status) {
        setSubscriptionStatus(json.subscriptionStatus || json.subscription_status);
      }

      try {
        await saveFreightUserRow(saved.id, saved.account_id);
      } catch (saveError) {
        console.log("freight membership save after launch skipped:", saveError);
      }
    } catch (error: any) {
      Alert.alert("Stripe Error", error?.message || "Unable to start freight membership checkout.");
    } finally {
      setStripeLoading(false);
    }
  }

  async function handleConnectBank() {
    if (connectLoading) return;

    try {
      setConnectLoading(true);

      const saved = await saveFreightProfile(false);
      if (!saved?.id) return;

      const finalFreightId = clean(saved.id || saved.freight_id || freightId || savedCarrierId);
      const finalEmail = normalize(saved.email || email);
      const finalAccountId = clean(saved.account_id || accountId);
      const finalBusinessName = clean(
        saved.company_name ||
          saved.business_name ||
          companyName ||
          saved.name ||
          "Farm2Home Carrier"
      );

      const returnUrl = `${APP_URL}/freight/connect-bank?success=true&freightId=${encodeURIComponent(
        finalFreightId
      )}&email=${encodeURIComponent(finalEmail)}`;

      const refreshUrl = `${APP_URL}/freight/connect-bank?refresh=true&freightId=${encodeURIComponent(
        finalFreightId
      )}&email=${encodeURIComponent(finalEmail)}`;

      const response = await fetch(`${API_BASE_URL}/payments/create-connect-account`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "freight",

          userId: finalFreightId,
          freightId: finalFreightId,
          freight_id: finalFreightId,
          profileId: finalFreightId,
          authUserId: finalFreightId,

          accountId: finalAccountId,
          account_id: finalAccountId,

          email: finalEmail,
          freight_email: finalEmail,

          businessName: finalBusinessName,
          business_name: finalBusinessName,
          companyName: finalBusinessName,
          company_name: finalBusinessName,
          name: finalBusinessName,
          username: normalize(saved.username || username),

          stripeCustomerId: stripeCustomerId || saved.stripe_customer_id || saved.stripeCustomerId,
          stripe_customer_id: stripeCustomerId || saved.stripe_customer_id || saved.stripeCustomerId,

          stripeAccountId: freightAccount || saved.freight_account || saved.stripe_account_id,
          stripe_account_id: freightAccount || saved.freight_account || saved.stripe_account_id,

          returnUrl,
          return_url: returnUrl,
          refreshUrl,
          refresh_url: refreshUrl,
        }),
      });

      const data = await parseApiResponse(response);
      console.log("FREIGHT CONNECT RESPONSE:", data);

      const launchUrl = data?.url || data?.onboardingUrl || getStripeLaunchUrl(data);

      if (!response.ok || !data.success || !launchUrl) {
        Alert.alert(
          "Connect Error",
          data.error || data.message || "Stripe Connect onboarding URL was not returned."
        );
        return;
      }

      const connectAccount = pickStripeConnectAccountId(
        data.stripeAccountId,
        data.stripe_account_id,
        data.freight_account,
        data.account,
        data.account_id
      );

      if (connectAccount) {
        setFreightAccount(connectAccount);
      }

      // Launch Stripe immediately. Do not let Supabase saves block browser launch.
      void openUrl(launchUrl);

      if (connectAccount) {
        try {
          await supabase
            .from("freight_users")
            .update({
              freight_account: connectAccount,
              stripe_account_id: connectAccount,
              stripe_connect_status: data.onboardingComplete ? "complete" : "started",
              payouts_enabled: Boolean(data.payoutsEnabled),
              charges_enabled: Boolean(data.chargesEnabled),
              stripe_payouts_enabled: Boolean(data.payoutsEnabled),
              stripe_charges_enabled: Boolean(data.chargesEnabled),
              stripe_onboarding_complete: Boolean(data.onboardingComplete),
              updated_at: new Date().toISOString(),
            })
            .eq("id", finalFreightId);
        } catch (updateError) {
          console.log("freight_users connect update skipped:", updateError);
        }

        try {
          await upsertFreightSubscriptionRow({
            freightId: finalFreightId,
            emailValue: finalEmail,
            customerId: stripeCustomerId || saved.stripe_customer_id,
            subscriptionValue: subscriptionId || saved.subscription_id || saved.stripe_subscription_id,
            connectValue: connectAccount,
            subscriptionStatusValue:
              subscriptionStatus || saved.subscription_status || "active",
          });
        } catch (subscriptionError) {
          console.log("freight_subscriptions connect update skipped:", subscriptionError);
        }

        try {
          await saveFreightSession({
            ...saved,
            id: finalFreightId,
            freight_id: finalFreightId,
            account_id: finalAccountId,
            stripe_customer_id: stripeCustomerId || saved.stripe_customer_id,
            subscription_id: subscriptionId || saved.subscription_id || saved.stripe_subscription_id,
            freight_account: connectAccount,
            stripe_account_id: connectAccount,
          });
        } catch (sessionError) {
          console.log("freight session save after launch skipped:", sessionError);
        }
      }
    } catch (error: any) {
      console.log("FREIGHT CONNECT ERROR:", error);
      Alert.alert("Connect Error", error?.message || "Unable to connect Stripe payouts.");
    } finally {
      setConnectLoading(false);
    }
  }

  async function handleSubmitAndDashboard() {
    const saved = await saveFreightProfile(true);
    if (!saved?.id) return;

    if (!hasCompleteDashboardAccess(saved)) {
      const missing = [
        !saved.id ? "Freight Profile" : "",
        !saved.account_id ? "Static Account ID" : "",
        !isStripeCustomerId(saved.stripe_customer_id) ? "Stripe Customer ID" : "",
        !isStripeSubscriptionId(saved.subscription_id) ? "Subscription ID" : "",
        !isStripeConnectAccountId(saved.freight_account) ? "Stripe Connect Account" : "",
      ].filter(Boolean);

      Alert.alert("Setup Incomplete", `Missing: ${missing.join(", ")}.`);
      setStep(4);
      return;
    }

    await saveFreightSession(saved);
    router.replace("/freight/dashboard" as any);
  }

  async function forceRefreshFreightRegister() {
    try {
      setSyncingStripe(true);
      await supabase.auth.refreshSession();
      await loadSavedFreight();
      await retrieveMissingStripeInfo(false);
      Alert.alert("Updated", "Freight registration refreshed without clearing your form.");
    } catch (error: any) {
      Alert.alert("Refresh Error", error?.message || "Unable to refresh registration.");
    } finally {
      setSyncingStripe(false);
    }
  }

  function renderQuestionPicker(
    value: string,
    setValue: (v: string) => void,
    label: string,
    usedValues: string[]
  ) {
    return (
      <View style={styles.questionBlock}>
        <Text style={styles.inputLabel}>{label}</Text>
        <View style={styles.questionGrid}>
          {SECURITY_QUESTIONS.map((question) => {
            const selected = value === question;
            const disabled = !selected && usedValues.includes(question);
            return (
              <TouchableOpacity
                key={question}
                disabled={disabled}
                onPress={() => setValue(question)}
                style={[
                  styles.questionChip,
                  selected && styles.questionChipSelected,
                  disabled && styles.questionChipDisabled,
                ]}
                activeOpacity={0.9}
              >
                <Text
                  style={[
                    styles.questionChipText,
                    selected && styles.questionChipTextSelected,
                    disabled && styles.questionChipTextDisabled,
                  ]}
                >
                  {question}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  }

  function renderStep() {
    if (step === 0) {
      return (
        <View>
          <SectionTitle title="Account Details" subtitle="Create the freight login and primary contact." />

          <Field label="Company Name" value={companyName} onChangeText={setCompanyName} placeholder="ASO Freight LLC" icon="business-outline" />
          <Field label="Contact Name" value={contactName} onChangeText={setContactName} placeholder="Owner or dispatcher name" icon="person-outline" />
          <Field label="Email" value={email} onChangeText={(v) => setEmail(normalize(v))} placeholder="carrier@email.com" icon="mail-outline" keyboardType="email-address" autoCapitalize="none" />
          <Field label="Phone" value={phone} onChangeText={setPhone} placeholder="(555) 555-5555" icon="call-outline" keyboardType="phone-pad" />
          <Field label="Username" value={username} onChangeText={(v) => setUsername(normalize(v))} placeholder="carrier username" icon="at-outline" autoCapitalize="none" />

          {!savedCarrierId && !freightId ? (
            <>
              <Field label="Password" value={password} onChangeText={setPassword} placeholder="Create password" icon="lock-closed-outline" secureTextEntry />
              <Field label="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Confirm password" icon="lock-closed-outline" secureTextEntry />
            </>
          ) : (
            <View style={styles.noticeBox}>
              <Ionicons name="checkmark-circle-outline" size={20} color={COLORS.accent} />
              <Text style={styles.noticeText}>Freight Auth/Profile already exists. Password is managed by Supabase Auth.</Text>
            </View>
          )}
        </View>
      );
    }

    if (step === 1) {
      return (
        <View>
          <SectionTitle title="Company Information" subtitle="Save business location and service area." />

          <Field label="Service Area" value={serviceArea} onChangeText={setServiceArea} placeholder="Detroit Metro, Michigan, Midwest" icon="map-outline" />
          <Field label="Business Address" value={businessAddress} onChangeText={setBusinessAddress} placeholder="Street address" icon="location-outline" />
          <View style={styles.twoCol}>
            <View style={styles.col}>
              <Field label="City" value={city} onChangeText={setCity} placeholder="Detroit" icon="business-outline" />
            </View>
            <View style={styles.col}>
              <Field label="State" value={stateValue} onChangeText={(v) => setStateValue(v.toUpperCase())} placeholder="MI" icon="flag-outline" autoCapitalize="characters" />
            </View>
          </View>
          <Field label="Zip Code" value={zipCode} onChangeText={setZipCode} placeholder="48201" icon="mail-open-outline" keyboardType="numeric" />

          <Text style={styles.inputLabel}>Equipment / Load Types</Text>
          <View style={styles.equipmentGrid}>
            {EQUIPMENT_OPTIONS.map((item) => {
              const selected = selectedEquipment.includes(item.key);
              return (
                <TouchableOpacity
                  key={item.key}
                  style={[styles.equipmentChip, selected && styles.equipmentChipSelected]}
                  onPress={() => toggleEquipment(item.key)}
                  activeOpacity={0.9}
                >
                  <Ionicons name={item.icon as any} size={18} color={selected ? COLORS.white : COLORS.primary} />
                  <Text style={[styles.equipmentText, selected && styles.equipmentTextSelected]}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      );
    }

    if (step === 2) {
      return (
        <View>
          <SectionTitle title="Authority & Insurance" subtitle="Save authority, insurance, livestock, and refrigerated-food requirements." />

          <View style={styles.twoCol}>
            <View style={styles.col}>
              <Field label="MDOT / DOT Number" value={mdotNumber} onChangeText={setMdotNumber} placeholder="DOT / MDOT #" icon="document-text-outline" />
            </View>
            <View style={styles.col}>
              <Field label="MC Number" value={mcNumber} onChangeText={setMcNumber} placeholder="MC #" icon="shield-outline" />
            </View>
          </View>

          <Field label="Insurance Provider" value={insuranceProvider} onChangeText={setInsuranceProvider} placeholder="Insurance company" icon="umbrella-outline" />
          <Field label="Policy Number" value={insurancePolicyNumber} onChangeText={setInsurancePolicyNumber} placeholder="Policy #" icon="reader-outline" />

          <ToggleRow label="Authority Active" value={authorityActive} onValueChange={setAuthorityActive} />
          <ToggleRow label="Insurance Active" value={insuranceActive} onValueChange={setInsuranceActive} />
          <ToggleRow label="Licensed Livestock" value={licensedLivestock} onValueChange={setLicensedLivestock} />
          <ToggleRow label="Licensed Refrigerated Food / Produce" value={licensedRefrigeratedFood} onValueChange={setLicensedRefrigeratedFood} />
        </View>
      );
    }

    if (step === 3) {
      const used1 = [securityQuestion2, securityQuestion3].filter(Boolean);
      const used2 = [securityQuestion1, securityQuestion3].filter(Boolean);
      const used3 = [securityQuestion1, securityQuestion2].filter(Boolean);

      return (
        <View>
          <SectionTitle title="Security Recovery" subtitle="Save three recovery questions. Answers are stored normalized for matching." />

          {renderQuestionPicker(securityQuestion1, setSecurityQuestion1, "Security Question 1", used1)}
          <Field
            label={hasSavedSecurityAnswer1 ? "Answer 1 - saved, enter only to replace" : "Answer 1"}
            value={securityAnswer1}
            onChangeText={setSecurityAnswer1}
            placeholder={hasSavedSecurityAnswer1 ? "Saved answer on file" : "Your answer"}
            icon="key-outline"
            secureTextEntry
          />

          {renderQuestionPicker(securityQuestion2, setSecurityQuestion2, "Security Question 2", used2)}
          <Field
            label={hasSavedSecurityAnswer2 ? "Answer 2 - saved, enter only to replace" : "Answer 2"}
            value={securityAnswer2}
            onChangeText={setSecurityAnswer2}
            placeholder={hasSavedSecurityAnswer2 ? "Saved answer on file" : "Your answer"}
            icon="key-outline"
            secureTextEntry
          />

          {renderQuestionPicker(securityQuestion3, setSecurityQuestion3, "Security Question 3", used3)}
          <Field
            label={hasSavedSecurityAnswer3 ? "Answer 3 - saved, enter only to replace" : "Answer 3"}
            value={securityAnswer3}
            onChangeText={setSecurityAnswer3}
            placeholder={hasSavedSecurityAnswer3 ? "Saved answer on file" : "Your answer"}
            icon="key-outline"
            secureTextEntry
          />
        </View>
      );
    }

    if (step === 4) {
      return (
        <View>
          <SectionTitle title="Stripe Membership & Payouts" subtitle="Save subscription and Stripe Connect payout account." />

          <View style={styles.statusList}>
            {setupStatus.map((item) => (
              <View key={item.label} style={styles.statusRow}>
                <View style={[styles.statusIcon, item.complete ? styles.statusGood : styles.statusMissing]}>
                  <Ionicons name={item.complete ? "checkmark-outline" : "ellipse-outline"} size={16} color={item.complete ? COLORS.white : COLORS.muted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.statusLabel}>{item.label}</Text>
                  <Text style={styles.statusValue}>{item.value}</Text>
                </View>
              </View>
            ))}
          </View>

          <ActionButton
            title="Save Profile"
            subtitle="Save registration fields to profiles, freight_users, and freight_subscriptions."
            icon="save-outline"
            loading={saving}
            onPress={() => saveFreightProfile(false)}
          />

          <ActionButton
            title="Find / Retrieve Missing Stripe Info"
            subtitle="Search existing freight_subscriptions and backend Stripe sync."
            icon="sync-outline"
            loading={syncingStripe}
            onPress={() => retrieveMissingStripeInfo(false)}
            secondary
          />

          <ActionButton
            title="Start Freight Membership"
            subtitle="Open Stripe Checkout for freight subscription."
            icon="card-outline"
            loading={stripeLoading}
            onPress={handleStripeCheckout}
          />

          <ActionButton
            title="Connect Stripe Payouts"
            subtitle="Open Stripe Connect onboarding for freight_account / stripe_account_id."
            icon="wallet-outline"
            loading={connectLoading}
            onPress={handleConnectBank}
            secondary
          />

          <ActionButton
            title="Refresh Without Clearing Form"
            subtitle="Reload Supabase and Stripe info without wiping the form."
            icon="refresh-outline"
            loading={syncingStripe}
            onPress={forceRefreshFreightRegister}
            secondary
          />
        </View>
      );
    }

    return (
      <View>
        <SectionTitle title="Review & Submit" subtitle="Confirm saved fields and open Freight Dashboard." />

        <ReviewRow label="Company" value={companyName} />
        <ReviewRow label="Contact" value={contactName} />
        <ReviewRow label="Email" value={email} />
        <ReviewRow label="Account ID" value={accountId} />
        <ReviewRow label="Stripe Customer" value={maskId(stripeCustomerId)} />
        <ReviewRow label="Subscription" value={maskId(subscriptionId)} />
        <ReviewRow label="Stripe Connect" value={maskId(freightAccount)} />

        <View style={styles.noticeBox}>
          <Ionicons
            name={allFiveRequirementsFound ? "checkmark-circle-outline" : "warning-outline"}
            size={20}
            color={allFiveRequirementsFound ? COLORS.accent : COLORS.warning}
          />
          <Text style={styles.noticeText}>
            {allFiveRequirementsFound
              ? "All five dashboard requirements are saved."
              : "Membership and Stripe Connect must be saved before dashboard routing."}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, saving && styles.disabledButton]}
          onPress={handleSubmitAndDashboard}
          disabled={saving}
          activeOpacity={0.9}
        >
          {saving ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <>
              <Ionicons name="checkmark-done-outline" size={18} color={COLORS.white} />
              <Text style={styles.primaryButtonText}>Submit & Open Freight Dashboard</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />

      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.shell}>
            <View style={styles.sidebar}>
              <View style={styles.brandRow}>
                <View style={styles.brandIcon}>
                  <Ionicons name="trail-sign-outline" size={28} color={COLORS.white} />
                </View>
                <View>
                  <Text style={styles.brandTitle}>Farm2Home</Text>
                  <Text style={styles.brandSubtitle}>Freight Connect</Text>
                </View>
              </View>

              <View style={styles.sideDivider} />

              <View style={styles.scoreCard}>
                <Text style={styles.scoreLabel}>Setup Progress</Text>
                <Text style={styles.scoreValue}>{setupScore}/5</Text>
                <Text style={styles.scoreHint}>Profile, static account, Stripe customer, subscription, and Connect account.</Text>
              </View>

              {STEPS.map((item, index) => {
                const active = index === step;
                const done = index < step;
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[styles.stepNav, active && styles.stepNavActive]}
                    onPress={() => setStep(index)}
                    activeOpacity={0.9}
                  >
                    <View style={[styles.stepNavIcon, active && styles.stepNavIconActive, done && styles.stepNavIconDone]}>
                      <Ionicons name={done ? "checkmark-outline" : (item.icon as any)} size={18} color={active || done ? COLORS.white : COLORS.primary} />
                    </View>
                    <Text style={[styles.stepNavText, active && styles.stepNavTextActive]}>{item.title}</Text>
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity style={styles.homeButton} onPress={() => router.replace("/" as any)} activeOpacity={0.9}>
                <Ionicons name="home-outline" size={18} color={COLORS.primary} />
                <Text style={styles.homeButtonText}>Back to Home</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.main}>
              <View style={styles.topPanel}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.eyebrow}>Freight Carrier Registration</Text>
                  <Text style={styles.pageTitle}>Freight Connect Setup</Text>
                  <Text style={styles.pageSubtitle}>
                    Save carrier information, subscription, and Stripe Connect details to Supabase.
                  </Text>
                </View>

                <TouchableOpacity style={styles.loginButton} onPress={() => router.replace("/freight/login" as any)} activeOpacity={0.9}>
                  <Ionicons name="log-in-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.loginButtonText}>Freight Login</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.metricsRow}>
                <MetricCard icon="business-outline" label="Account" value={accountId || "Not assigned"} />
                <MetricCard icon="card-outline" label="Subscription" value={isStripeSubscriptionId(subscriptionId) ? "Saved" : "Missing"} />
                <MetricCard icon="wallet-outline" label="Connect" value={isStripeConnectAccountId(freightAccount) ? "Saved" : "Missing"} />
              </View>

              <View style={styles.card}>
                {processingReturn ? (
                  <View style={styles.processingBox}>
                    <ActivityIndicator color={COLORS.primary} />
                    <Text style={styles.processingText}>Processing Stripe return...</Text>
                  </View>
                ) : null}

                {renderStep()}

                <View style={styles.footerNav}>
                  <TouchableOpacity
                    style={[styles.navButton, step === 0 && styles.disabledButton]}
                    onPress={goBack}
                    disabled={step === 0}
                    activeOpacity={0.9}
                  >
                    <Ionicons name="arrow-back-outline" size={18} color={COLORS.primary} />
                    <Text style={styles.navButtonText}>Back</Text>
                  </TouchableOpacity>

                  {step < STEPS.length - 1 ? (
                    <TouchableOpacity style={styles.primaryButtonSmall} onPress={goNext} activeOpacity={0.9}>
                      <Text style={styles.primaryButtonText}>Next</Text>
                      <Ionicons name="arrow-forward-outline" size={18} color={COLORS.white} />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[styles.primaryButtonSmall, saving && styles.disabledButton]}
                      onPress={handleSubmitAndDashboard}
                      disabled={saving}
                      activeOpacity={0.9}
                    >
                      {saving ? (
                        <ActivityIndicator color={COLORS.white} />
                      ) : (
                        <>
                          <Text style={styles.primaryButtonText}>Submit</Text>
                          <Ionicons name="checkmark-outline" size={18} color={COLORS.white} />
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionSubtitle}>{subtitle}</Text>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  icon,
  keyboardType,
  autoCapitalize,
  secureTextEntry,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  icon: keyof typeof Ionicons.glyphMap;
  keyboardType?: any;
  autoCapitalize?: any;
  secureTextEntry?: boolean;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.inputShell}>
        <Ionicons name={icon} size={18} color={COLORS.muted} />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize || "none"}
          autoCorrect={false}
          secureTextEntry={secureTextEntry}
        />
      </View>
    </View>
  );
}

function ToggleRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <View>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleSub}>{value ? "Confirmed" : "Tap to confirm"}</Text>
      </View>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text style={styles.reviewValue}>{value || "Missing"}</Text>
    </View>
  );
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.metricCard}>
      <View style={styles.metricIcon}>
        <Ionicons name={icon} size={20} color={COLORS.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={styles.metricValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function ActionButton({
  title,
  subtitle,
  icon,
  loading,
  onPress,
  secondary,
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  onPress: () => void;
  secondary?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.actionButton, secondary && styles.actionButtonSecondary]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.9}
    >
      <View style={[styles.actionIcon, secondary && styles.actionIconSecondary]}>
        {loading ? (
          <ActivityIndicator color={secondary ? COLORS.primary : COLORS.white} />
        ) : (
          <Ionicons name={icon} size={20} color={secondary ? COLORS.primary : COLORS.white} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.actionTitle, secondary && styles.actionTitleSecondary]}>{title}</Text>
        <Text style={styles.actionSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward-outline" size={18} color={secondary ? COLORS.primary : COLORS.white} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  keyboard: { flex: 1 },
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
    width: Platform.OS === "web" ? 330 : "100%",
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
  sideDivider: { height: 1, backgroundColor: "#1E293B", marginVertical: 24 },
  scoreCard: {
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "#1E293B",
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },
  scoreLabel: { color: "#CBD5E1", fontWeight: "800" },
  scoreValue: { color: COLORS.white, fontSize: 34, fontWeight: "900", marginTop: 4 },
  scoreHint: { color: "#94A3B8", fontWeight: "700", lineHeight: 19, marginTop: 4 },
  stepNav: {
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "#1E293B",
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  stepNavActive: { borderColor: "#818CF8", backgroundColor: "#111827" },
  stepNavIcon: {
    width: 34,
    height: 34,
    borderRadius: 13,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNavIconActive: { backgroundColor: COLORS.primary },
  stepNavIconDone: { backgroundColor: COLORS.accent },
  stepNavText: { color: "#CBD5E1", fontWeight: "900" },
  stepNavTextActive: { color: COLORS.white },
  homeButton: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#312E81",
    backgroundColor: "#111827",
    padding: 14,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  homeButtonText: { color: COLORS.white, fontWeight: "900" },
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
  eyebrow: {
    color: COLORS.primary,
    fontWeight: "900",
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  pageTitle: { color: COLORS.text, fontSize: 34, fontWeight: "900", marginTop: 6 },
  pageSubtitle: { color: COLORS.muted, fontWeight: "700", lineHeight: 22, marginTop: 7, maxWidth: 760 },
  loginButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    backgroundColor: COLORS.primarySoft,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  loginButtonText: { color: COLORS.primary, fontWeight: "900" },
  metricsRow: {
    flexDirection: Platform.OS === "web" ? "row" : "column",
    gap: 12,
    marginBottom: 14,
  },
  metricCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  metricIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  metricLabel: { color: COLORS.muted, fontWeight: "900", fontSize: 11, textTransform: "uppercase" },
  metricValue: { color: COLORS.text, fontWeight: "900", marginTop: 3 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 26,
    padding: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  processingBox: {
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  processingText: { color: COLORS.primaryDark, fontWeight: "900" },
  sectionHeader: { marginBottom: 18 },
  sectionTitle: { color: COLORS.text, fontSize: 24, fontWeight: "900" },
  sectionSubtitle: { color: COLORS.muted, fontWeight: "700", lineHeight: 21, marginTop: 4 },
  fieldWrap: { marginBottom: 13 },
  inputLabel: { color: COLORS.text, fontWeight: "900", marginBottom: 8 },
  inputShell: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 16,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  input: { flex: 1, color: COLORS.text, fontWeight: "800", paddingVertical: 15 },
  twoCol: {
    flexDirection: Platform.OS === "web" ? "row" : "column",
    gap: 12,
  },
  col: { flex: 1 },
  equipmentGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 14,
  },
  equipmentChip: {
    borderWidth: 1,
    borderColor: "#C7D2FE",
    backgroundColor: COLORS.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  equipmentChipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  equipmentText: { color: COLORS.primary, fontWeight: "900" },
  equipmentTextSelected: { color: COLORS.white },
  toggleRow: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  toggleLabel: { color: COLORS.text, fontWeight: "900" },
  toggleSub: { color: COLORS.muted, fontWeight: "700", marginTop: 2 },
  questionBlock: { marginBottom: 12 },
  questionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  questionChip: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  questionChipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  questionChipDisabled: { opacity: 0.45 },
  questionChipText: { color: COLORS.text, fontWeight: "800", fontSize: 12 },
  questionChipTextSelected: { color: COLORS.white },
  questionChipTextDisabled: { color: COLORS.muted },
  statusList: { marginBottom: 14 },
  statusRow: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    marginBottom: 10,
  },
  statusIcon: {
    width: 32,
    height: 32,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  statusGood: { backgroundColor: COLORS.accent },
  statusMissing: { backgroundColor: "#E2E8F0" },
  statusLabel: { color: COLORS.text, fontWeight: "900" },
  statusValue: { color: COLORS.muted, fontWeight: "700", marginTop: 2 },
  actionButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  actionButtonSecondary: {
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: "#C7D2FE",
  },
  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionIconSecondary: { backgroundColor: COLORS.white },
  actionTitle: { color: COLORS.white, fontWeight: "900", fontSize: 15 },
  actionTitleSecondary: { color: COLORS.primary },
  actionSubtitle: { color: COLORS.muted, fontWeight: "700", lineHeight: 18, marginTop: 2 },
  reviewRow: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  reviewLabel: { color: COLORS.muted, fontWeight: "900" },
  reviewValue: { color: COLORS.text, fontWeight: "900", flex: 1, textAlign: "right" },
  noticeBox: {
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    borderRadius: 16,
    padding: 13,
    flexDirection: "row",
    gap: 9,
    alignItems: "flex-start",
    marginVertical: 12,
  },
  noticeText: { color: COLORS.primaryDark, fontWeight: "800", lineHeight: 20, flex: 1 },
  primaryButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
    flexDirection: "row",
    gap: 8,
    width: "100%",
  },
  primaryButtonSmall: {
    backgroundColor: COLORS.primary,
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontWeight: "900",
    fontSize: 15,
    textAlign: "center",
    flexShrink: 1,
  },
  disabledButton: { opacity: 0.55 },
  footerNav: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 16,
    marginTop: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  navButton: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    backgroundColor: COLORS.primarySoft,
    paddingVertical: 13,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  navButtonText: { color: COLORS.primary, fontWeight: "900" },
});
