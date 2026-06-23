// app/customer/register.tsx

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
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Ionicons } from "@expo/vector-icons";

import { API_BASE_URL, APP_URL } from "../config/api";
import { supabase } from "../data/supabaseClient";

/**
 * Customer registration using the same Fina/Freight UI pattern.
 *
 * Customer access rules:
 * - customer profile exists
 * - stripe_customer_id starts with cus_
 * - stripe_subscription_id/subscription_id starts with sub_
 * - subscription_status is active, trialing, or past_due
 *
 * DO NOT require account_id for customer cart/checkout/marketplace access.
 * DO NOT use Stripe Connect for customers.
 */

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
  "What is your favorite color?",
];

const STEPS = [
  { key: "account", title: "Account", icon: "person-outline" },
  { key: "delivery", title: "Delivery", icon: "location-outline" },
  { key: "security", title: "Security", icon: "key-outline" },
  { key: "stripe", title: "Stripe", icon: "card-outline" },
  { key: "review", title: "Review", icon: "checkmark-done-outline" },
] as const;

type CustomerRecord = {
  id: string;
  customer_id?: string;
  auth_user_id?: string;
  profile_id?: string;
  account_id?: string | null;
  role: "customer";

  full_name: string;
  name: string;
  email: string;
  phone: string;
  username: string;

  delivery_address?: string | null;
  delivery_city?: string | null;
  delivery_state?: string | null;
  delivery_zip?: string | null;
  delivery_instructions?: string | null;
  preferred_delivery_option?: string | null;

  account_active: boolean;
  customer_membership_paid: boolean;
  subscription_status: string;
  membership_status: string;
  application_complete: boolean;
  application_submitted: boolean;
  submitted_at?: string | null;

  stripe_id?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  subscription_id?: string | null;
  stripe_checkout_session_id?: string | null;

  security_question_1?: string;
  security_answer_1?: string | null;
  security_question_2?: string;
  security_answer_2?: string | null;
  security_question_3?: string;
  security_answer_3?: string | null;

  notifications_enabled?: boolean;
  expo_push_token?: string;

  created_at?: string;
  updated_at?: string;
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

function isStripeCustomerId(value: any) {
  return clean(value).startsWith("cus_");
}

function isStripeSubscriptionId(value: any) {
  return clean(value).startsWith("sub_");
}

function isStripeConnectAccountId(value: any) {
  return clean(value).startsWith("acct_");
}

function isValidCustomerSubscriptionStatus(value: any) {
  return ["active", "trialing", "past_due"].includes(String(value || "").toLowerCase());
}

function pickStripeCustomerId(...values: any[]) {
  const found = values.find((value) => isStripeCustomerId(value));
  return found ? clean(found) : "";
}

function pickStripeSubscriptionId(...values: any[]) {
  const found = values.find((value) => isStripeSubscriptionId(value));
  return found ? clean(found) : "";
}

function maskId(value: string, fallback = "Missing") {
  const id = clean(value);
  if (!id) return fallback;
  if (id.length <= 14) return id;
  return `${id.slice(0, 8)}...${id.slice(-5)}`;
}

function fallbackCustomerAccountId() {
  const stamp = Date.now().toString().slice(-6);
  return `Customer_${stamp}`;
}

function removeBadAcctFromCustomerId(value: any) {
  return isStripeConnectAccountId(value) ? "" : clean(value);
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
      data?.checkoutUrl ||
      data?.checkout_url ||
      data?.sessionUrl ||
      data?.session_url ||
      data?.checkoutSessionUrl ||
      data?.checkout_session_url ||
      data?.paymentUrl ||
      data?.payment_url ||
      data?.link ||
      data?.data?.url ||
      data?.result?.url
  );
}

async function openStripeUrl(url: string) {
  const finalUrl = clean(url);

  console.log("OPEN STRIPE URL:", finalUrl);

  if (!finalUrl || !finalUrl.startsWith("http")) {
    Alert.alert("Stripe Error", "No valid Stripe checkout URL returned.");
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

function buildCustomerSession(row: any) {
  const id = clean(row?.id || row?.customer_id || row?.customerId);
  const accountId = clean(row?.account_id || row?.accountId);

  const stripeCustomerId = pickStripeCustomerId(
    row?.stripe_customer_id,
    row?.stripeCustomerId,
    row?.stripe_id,
    row?.stripeId
  );

  const stripeSubscriptionId = pickStripeSubscriptionId(
    row?.stripe_subscription_id,
    row?.stripeSubscriptionId,
    row?.subscription_id,
    row?.subscriptionId
  );

  const subscriptionStatus = clean(
    row?.subscription_status ||
      row?.subscriptionStatus ||
      (stripeSubscriptionId ? "active" : "pending_payment")
  );

  const active =
    Boolean(id) &&
    isStripeCustomerId(stripeCustomerId) &&
    isStripeSubscriptionId(stripeSubscriptionId) &&
    isValidCustomerSubscriptionStatus(subscriptionStatus);

  return {
    ...row,
    id,
    customerId: id,
    customer_id: id,
    authUserId: clean(row?.auth_user_id || row?.authUserId || id),
    auth_user_id: clean(row?.auth_user_id || row?.authUserId || id),
    profileId: clean(row?.profile_id || row?.profileId || id),
    profile_id: clean(row?.profile_id || row?.profileId || id),
    role: "customer",

    accountId,
    account_id: accountId,

    fullName: clean(row?.full_name || row?.fullName || row?.name),
    full_name: clean(row?.full_name || row?.fullName || row?.name),
    name: clean(row?.name || row?.full_name || row?.fullName),
    email: normalize(row?.email || row?.customer_email),
    phone: clean(row?.phone),
    username: normalize(row?.username),

    delivery_address: clean(row?.delivery_address),
    delivery_city: clean(row?.delivery_city),
    delivery_state: clean(row?.delivery_state),
    delivery_zip: clean(row?.delivery_zip),
    delivery_instructions: clean(row?.delivery_instructions),
    preferred_delivery_option: clean(row?.preferred_delivery_option || "delivery"),

    stripeId: stripeCustomerId,
    stripe_id: stripeCustomerId,
    stripeCustomerId,
    stripe_customer_id: stripeCustomerId,
    stripeSubscriptionId,
    stripe_subscription_id: stripeSubscriptionId,
    subscriptionId: stripeSubscriptionId,
    subscription_id: stripeSubscriptionId,

    membershipStatus: active ? "active" : clean(row?.membership_status || row?.membershipStatus || "pending_payment"),
    membership_status: active ? "active" : clean(row?.membership_status || row?.membershipStatus || "pending_payment"),

    subscriptionStatus,
    subscription_status: subscriptionStatus,

    accountActive: active,
    account_active: active,

    customerMembershipPaid: active,
    customer_membership_paid: active,

    applicationComplete: active,
    application_complete: active,

    applicationSubmitted: active,
    application_submitted: active,

    updatedAt: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function customerReadyForMarketplace(row: any) {
  const customer = buildCustomerSession(row);

  return Boolean(
    customer.id &&
      isStripeCustomerId(customer.stripe_customer_id) &&
      isStripeSubscriptionId(customer.subscription_id) &&
      isValidCustomerSubscriptionStatus(customer.subscription_status)
  );
}

async function saveCurrentCustomer(customerAccount: any) {
  const session = buildCustomerSession(customerAccount);

  await AsyncStorage.multiSet([
    ["pendingCustomer", JSON.stringify(session)],
    ["currentCustomer", JSON.stringify(session)],
    ["currentUser", JSON.stringify(session)],
    ["farm2homeCurrentCustomer", JSON.stringify(session)],
    ["userRole", "customer"],
    ["currentUserRole", "customer"],
    ["lastLoginRole", "customer"],
    ["lastCustomerDashboardReady", customerReadyForMarketplace(session) ? "true" : "false"],
  ]);
}

export default function CustomerRegister() {
  const params = useLocalSearchParams();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [syncingStripe, setSyncingStripe] = useState(false);
  const [processingReturn, setProcessingReturn] = useState(false);

  const [customerId, setCustomerId] = useState("");
  const [profileId, setProfileId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [stripeCustomerId, setStripeCustomerId] = useState("");
  const [stripeSubscriptionId, setStripeSubscriptionId] = useState("");
  const [subscriptionStatus, setSubscriptionStatus] = useState("");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryCity, setDeliveryCity] = useState("");
  const [deliveryState, setDeliveryState] = useState("");
  const [deliveryZip, setDeliveryZip] = useState("");
  const [deliveryInstructions, setDeliveryInstructions] = useState("");
  const [preferredDeliveryOption, setPreferredDeliveryOption] = useState("delivery");

  const [securityQuestion1, setSecurityQuestion1] = useState("");
  const [securityAnswer1, setSecurityAnswer1] = useState("");
  const [securityQuestion2, setSecurityQuestion2] = useState("");
  const [securityAnswer2, setSecurityAnswer2] = useState("");
  const [securityQuestion3, setSecurityQuestion3] = useState("");
  const [securityAnswer3, setSecurityAnswer3] = useState("");
  const [hasSavedSecurityAnswer1, setHasSavedSecurityAnswer1] = useState(false);
  const [hasSavedSecurityAnswer2, setHasSavedSecurityAnswer2] = useState(false);
  const [hasSavedSecurityAnswer3, setHasSavedSecurityAnswer3] = useState(false);

  const selectedQuestions = useMemo(
    () => [securityQuestion1, securityQuestion2, securityQuestion3].filter(Boolean),
    [securityQuestion1, securityQuestion2, securityQuestion3]
  );

  const setupStatus = useMemo(() => {
    return [
      {
        label: "Customer Profile",
        complete: Boolean(customerId),
        value: customerId ? "Found" : "Missing",
      },
      {
        label: "Stripe Customer",
        complete: isStripeCustomerId(stripeCustomerId),
        value: maskId(stripeCustomerId),
      },
      {
        label: "Subscription",
        complete: isStripeSubscriptionId(stripeSubscriptionId),
        value: maskId(stripeSubscriptionId),
      },
      {
        label: "Membership Status",
        complete: isValidCustomerSubscriptionStatus(subscriptionStatus),
        value: subscriptionStatus || "Missing",
      },
    ];
  }, [customerId, stripeCustomerId, stripeSubscriptionId, subscriptionStatus]);

  const setupScore = useMemo(() => setupStatus.filter((item) => item.complete).length, [setupStatus]);

  const customerIsReady = useMemo(
    () =>
      customerReadyForMarketplace({
        id: customerId,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
        subscription_status: subscriptionStatus,
      }),
    [customerId, stripeCustomerId, stripeSubscriptionId, subscriptionStatus]
  );

  useEffect(() => {
    loadSavedCustomer();
  }, []);

  useEffect(() => {
    const stripeStatus = String(params?.stripe || params?.payment || "");
    const returnedCustomerId = String(params?.customerId || params?.customer_id || "");
    const returnedEmail = String(params?.email || "");

    if (returnedCustomerId) setCustomerId(returnedCustomerId);
    if (returnedEmail) setEmail(normalize(returnedEmail));

    if (stripeStatus === "success") {
      handleStripeSuccessReturn(returnedCustomerId);
    }
  }, [params?.stripe, params?.payment, params?.customerId, params?.customer_id, params?.email]);

  function goNext() {
    setStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  }

  function goBack() {
    setStep((prev) => Math.max(prev - 1, 0));
  }

  function goMarketplace() {
    router.replace("/customer/marketplace" as any);
  }

  function hydrateCustomer(row: any) {
    const session = buildCustomerSession(row);

    if (session.id) setCustomerId(session.id);
    if (session.profile_id) setProfileId(session.profile_id);
    if (session.account_id) setAccountId(session.account_id);
    if (session.stripe_customer_id) setStripeCustomerId(session.stripe_customer_id);
    if (session.subscription_id) setStripeSubscriptionId(session.subscription_id);
    if (session.subscription_status) setSubscriptionStatus(session.subscription_status);

    if (session.full_name) setFullName(session.full_name);
    if (session.email) setEmail(session.email);
    if (session.phone) setPhone(session.phone);
    if (session.username) setUsername(session.username);

    if (session.delivery_address) setDeliveryAddress(session.delivery_address);
    if (session.delivery_city) setDeliveryCity(session.delivery_city);
    if (session.delivery_state) setDeliveryState(session.delivery_state);
    if (session.delivery_zip) setDeliveryZip(session.delivery_zip);
    if (session.delivery_instructions) setDeliveryInstructions(session.delivery_instructions);
    if (session.preferred_delivery_option) setPreferredDeliveryOption(session.preferred_delivery_option);

    if (row?.security_question_1) setSecurityQuestion1(clean(row.security_question_1));
    if (row?.security_question_2) setSecurityQuestion2(clean(row.security_question_2));
    if (row?.security_question_3) setSecurityQuestion3(clean(row.security_question_3));
    setHasSavedSecurityAnswer1(Boolean(row?.security_answer_1));
    setHasSavedSecurityAnswer2(Boolean(row?.security_answer_2));
    setHasSavedSecurityAnswer3(Boolean(row?.security_answer_3));

    return session;
  }

  function validateForm({ full = false }: { full?: boolean } = {}) {
    if (!fullName.trim() || !email.trim() || !phone.trim()) {
      Alert.alert("Missing Info", "Please enter your name, email, and phone.");
      setStep(0);
      return false;
    }

    if (!normalize(email).includes("@")) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      setStep(0);
      return false;
    }

    if (!username.trim()) {
      Alert.alert("Username Required", "Please create a username.");
      setStep(0);
      return false;
    }

    if (normalize(username).length < 4) {
      Alert.alert("Invalid Username", "Username must be at least 4 characters.");
      setStep(0);
      return false;
    }

    if (!customerId) {
      if (!password.trim() || !confirmPassword.trim()) {
        Alert.alert("Password Required", "Please create and confirm your password.");
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

    if (full) {
      if (!deliveryAddress.trim() || !deliveryCity.trim() || !deliveryState.trim() || !deliveryZip.trim()) {
        Alert.alert("Delivery Info Required", "Please enter your delivery address, city, state, and ZIP.");
        setStep(1);
        return false;
      }

      if (selectedQuestions.length !== 3 || new Set(selectedQuestions).size !== 3) {
        Alert.alert("Security Required", "Please select 3 different security questions.");
        setStep(2);
        return false;
      }

      const missingSecurityAnswers =
        (!securityAnswer1.trim() && !hasSavedSecurityAnswer1) ||
        (!securityAnswer2.trim() && !hasSavedSecurityAnswer2) ||
        (!securityAnswer3.trim() && !hasSavedSecurityAnswer3);

      if (missingSecurityAnswers) {
        Alert.alert("Security Required", "Please answer all 3 security questions.");
        setStep(2);
        return false;
      }
    }

    return true;
  }

  async function generateCustomerAccountId() {
    try {
      const { data, error } = await supabase.rpc("next_account_id", {
        p_role: "customer",
        p_prefix: "Customer",
      });

      if (!error && data) return String(data);
    } catch (error) {
      console.log("Customer account_id RPC skipped:", error);
    }

    return fallbackCustomerAccountId();
  }

  async function findCustomerByIdOrEmail(id?: string, targetEmail?: string) {
    const cleanId = clean(id);
    const cleanEmail = normalize(targetEmail);

    if (cleanId) {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .or(`id.eq.${cleanId},customer_id.eq.${cleanId},auth_user_id.eq.${cleanId},profile_id.eq.${cleanId}`)
        .limit(1);

      if (!error && Array.isArray(data) && data[0]) return data[0];
      if (error) console.log("Customer id lookup error:", error.message);
    }

    if (cleanEmail) {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("email", cleanEmail)
        .limit(1);

      if (!error && Array.isArray(data) && data[0]) return data[0];
      if (error) console.log("Customer email lookup error:", error.message);
    }

    return null;
  }

  async function findExistingCustomer(cleanEmail: string, cleanUsername: string) {
    const filters = [
      cleanEmail ? `email.eq.${cleanEmail}` : "",
      cleanUsername ? `username.eq.${cleanUsername}` : "",
    ]
      .filter(Boolean)
      .join(",");

    if (!filters) return null;

    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .or(filters)
      .limit(1);

    if (error) {
      console.log("Customer duplicate check error:", error.message);
      return null;
    }

    return Array.isArray(data) && data.length > 0 ? data[0] : null;
  }

  async function getBestCustomerSubscription(id?: string, targetEmail?: string) {
    const cleanId = clean(id);
    const cleanEmail = normalize(targetEmail);

    const filters = [
      cleanId ? `customer_id.eq.${cleanId}` : "",
      cleanEmail ? `customer_email.eq.${cleanEmail}` : "",
    ]
      .filter(Boolean)
      .join(",");

    if (!filters) return null;

    try {
      const { data, error } = await supabase
        .from("customer_subscriptions")
        .select("*")
        .or(filters)
        .order("updated_at", { ascending: false })
        .limit(10);

      if (error) {
        console.log("customer_subscriptions lookup skipped:", error.message);
        return null;
      }

      if (!Array.isArray(data) || data.length === 0) return null;

      const fixed = data.map((row) => ({
        ...row,
        stripe_customer_id: removeBadAcctFromCustomerId(row?.stripe_customer_id),
      }));

      const complete = fixed.find(
        (row) =>
          pickStripeCustomerId(row?.stripe_customer_id) &&
          pickStripeSubscriptionId(row?.stripe_subscription_id) &&
          isValidCustomerSubscriptionStatus(row?.subscription_status)
      );

      return complete || fixed[0];
    } catch (error) {
      console.log("customer_subscriptions lookup exception:", error);
      return null;
    }
  }

  function mergeCustomerAndSubscription(customer: any, subRow: any) {
    const stripeCustomer = pickStripeCustomerId(
      customer?.stripe_customer_id,
      customer?.stripe_id,
      subRow?.stripe_customer_id,
      stripeCustomerId
    );

    const stripeSub = pickStripeSubscriptionId(
      customer?.stripe_subscription_id,
      customer?.subscription_id,
      subRow?.stripe_subscription_id,
      stripeSubscriptionId
    );

    const status = clean(
      customer?.subscription_status ||
        subRow?.subscription_status ||
        subscriptionStatus ||
        (stripeSub ? "active" : "pending_payment")
    );

    const active =
      isStripeCustomerId(stripeCustomer) &&
      isStripeSubscriptionId(stripeSub) &&
      isValidCustomerSubscriptionStatus(status);

    return {
      ...customer,
      id: clean(customer?.id || customer?.customer_id || subRow?.customer_id || customerId),
      customer_id: clean(customer?.customer_id || customer?.id || subRow?.customer_id || customerId),
      auth_user_id: clean(customer?.auth_user_id || customer?.id || subRow?.customer_id || customerId),
      profile_id: clean(customer?.profile_id || customer?.id || subRow?.customer_id || customerId),
      account_id: clean(customer?.account_id || accountId),
      full_name: clean(customer?.full_name || customer?.name || subRow?.name || fullName),
      name: clean(customer?.name || customer?.full_name || subRow?.name || fullName),
      email: normalize(customer?.email || subRow?.customer_email || email),
      phone: clean(customer?.phone || phone),
      username: normalize(customer?.username || subRow?.username || username),
      delivery_address: clean(customer?.delivery_address || deliveryAddress),
      delivery_city: clean(customer?.delivery_city || deliveryCity),
      delivery_state: clean(customer?.delivery_state || deliveryState),
      delivery_zip: clean(customer?.delivery_zip || deliveryZip),
      delivery_instructions: clean(customer?.delivery_instructions || deliveryInstructions),
      preferred_delivery_option: clean(customer?.preferred_delivery_option || preferredDeliveryOption),
      stripe_id: stripeCustomer || null,
      stripe_customer_id: stripeCustomer || null,
      stripe_subscription_id: stripeSub || null,
      subscription_id: stripeSub || null,
      subscription_status: status,
      membership_status: active ? "active" : "pending_payment",
      customer_membership_paid: active,
      account_active: active,
      application_complete: active,
      application_submitted: active,
    };
  }

  async function upsertProfile(payload: any) {
    const now = new Date().toISOString();

    const profilePayload = {
      id: payload.id,
      auth_user_id: payload.auth_user_id || payload.id,
      role: "customer",
      full_name: payload.full_name || payload.name,
      email: normalize(payload.email),
      phone: clean(payload.phone),
      account_id: payload.account_id || null,
      created_at: payload.created_at || now,
    };

    const { data, error } = await supabase
      .from("profiles")
      .upsert(profilePayload, { onConflict: "id" })
      .select("*")
      .maybeSingle();

    if (error) throw error;
    return data || profilePayload;
  }

  async function saveCustomerRow(customerPayload: any) {
    const { data, error } = await supabase
      .from("customers")
      .upsert(customerPayload, { onConflict: "id" })
      .select("*")
      .maybeSingle();

    if (error) throw error;
    if (!data?.id) throw new Error("Customer record did not save.");
    return data;
  }

  async function cleanBadCustomerSubscriptionAcct(customerEmail?: string, id?: string) {
    const filters = [
      id ? `customer_id.eq.${id}` : "",
      customerEmail ? `customer_email.eq.${normalize(customerEmail)}` : "",
    ]
      .filter(Boolean)
      .join(",");

    if (!filters) return;

    try {
      const { error } = await supabase
        .from("customer_subscriptions")
        .update({
          stripe_customer_id: null,
          stripe_subscription_id: null,
          subscription_status: "pending_payment",
          updated_at: new Date().toISOString(),
        })
        .or(filters)
        .like("stripe_customer_id", "acct_%");

      if (error) console.log("clean bad customer_subscriptions skipped:", error.message);
    } catch (error) {
      console.log("clean bad customer_subscriptions exception:", error);
    }
  }

  async function upsertCustomerSubscriptionRow(customer: any) {
    const id = clean(customer?.id || customer?.customer_id || customer?.customerId);
    const customerEmail = normalize(customer?.email || customer?.customer_email);
    const stripeCustomer = pickStripeCustomerId(
      customer?.stripe_customer_id,
      customer?.stripe_id,
      customer?.stripeCustomerId
    );
    const stripeSub = pickStripeSubscriptionId(
      customer?.stripe_subscription_id,
      customer?.subscription_id,
      customer?.stripeSubscriptionId,
      customer?.subscriptionId
    );

    if (!id && !customerEmail) return;

    await cleanBadCustomerSubscriptionAcct(customerEmail, id);

    const now = new Date().toISOString();

    const status = clean(customer?.subscription_status || (stripeSub ? "active" : "pending_payment"));

    const payload = {
      customer_id: id,
      customer_email: customerEmail,
      name: clean(customer?.full_name || customer?.name),
      username: normalize(customer?.username),
      stripe_customer_id: stripeCustomer || null,
      stripe_subscription_id: stripeSub || null,
      subscription_status: status,
      current_period_end: customer?.current_period_end || null,
      updated_at: now,
    };

    try {
      const { data: existing, error: lookupError } = await supabase
        .from("customer_subscriptions")
        .select("id")
        .or(`customer_id.eq.${id},customer_email.eq.${customerEmail}`)
        .limit(1);

      if (lookupError) {
        console.log("customer_subscriptions lookup skipped:", lookupError.message);
        return;
      }

      if (Array.isArray(existing) && existing[0]?.id) {
        const { error } = await supabase
          .from("customer_subscriptions")
          .update(payload)
          .eq("id", existing[0].id);

        if (error) console.log("customer_subscriptions update skipped:", error.message);
        return;
      }

      const { error } = await supabase
        .from("customer_subscriptions")
        .insert({ ...payload, created_at: now });

      if (error) console.log("customer_subscriptions insert skipped:", error.message);
    } catch (error) {
      console.log("customer_subscriptions skipped:", error);
    }
  }

  async function syncCustomerSubscriptionToTables(customerIdValue: string, localCustomer?: any) {
    const customerRow = await findCustomerByIdOrEmail(customerIdValue, localCustomer?.email || email);
    const subRow = await getBestCustomerSubscription(
      customerIdValue,
      customerRow?.email || localCustomer?.email || email
    );

    let backendSync: any = null;

    try {
      const response = await fetch(`${API_BASE_URL}/payments/sync-stripe-by-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "customer",
          email: normalize(customerRow?.email || localCustomer?.email || email),
          name: customerRow?.name || customerRow?.full_name || localCustomer?.name || fullName,
          username: normalize(customerRow?.username || localCustomer?.username || username),
          userId: customerIdValue,
          customerId: customerIdValue,
          customer_id: customerIdValue,
        }),
      });

      const json = await parseApiResponse(response);
      console.log("CUSTOMER BACKEND STRIPE SYNC RESPONSE:", json);

      if (response.ok && json.success) backendSync = json;
    } catch (error) {
      console.log("backend customer stripe sync skipped:", error);
    }

    const merged = mergeCustomerAndSubscription(customerRow || localCustomer || {}, {
      ...(subRow || {}),
      stripe_customer_id: pickStripeCustomerId(
        subRow?.stripe_customer_id,
        backendSync?.stripeCustomerId,
        backendSync?.stripe_customer_id
      ),
      stripe_subscription_id: pickStripeSubscriptionId(
        subRow?.stripe_subscription_id,
        backendSync?.stripeSubscriptionId,
        backendSync?.stripe_subscription_id
      ),
      subscription_status:
        subRow?.subscription_status ||
        backendSync?.subscriptionStatus ||
        backendSync?.subscription_status,
    });

    const stripeCustomer = pickStripeCustomerId(
      merged.stripe_customer_id,
      backendSync?.stripeCustomerId,
      backendSync?.stripe_customer_id
    );

    const stripeSub = pickStripeSubscriptionId(
      merged.subscription_id,
      backendSync?.stripeSubscriptionId,
      backendSync?.stripe_subscription_id
    );

    const finalStatus = clean(
      backendSync?.subscriptionStatus ||
        backendSync?.subscription_status ||
        merged.subscription_status ||
        (stripeSub ? "active" : "pending_payment")
    );

    const active =
      isStripeCustomerId(stripeCustomer) &&
      isStripeSubscriptionId(stripeSub) &&
      isValidCustomerSubscriptionStatus(finalStatus);

    const updatePayload = {
      stripe_id: stripeCustomer || null,
      stripe_customer_id: stripeCustomer || null,
      stripe_subscription_id: stripeSub || null,
      subscription_id: stripeSub || null,
      subscription_status: finalStatus,
      membership_status: active ? "active" : "pending_payment",
      customer_membership_paid: active,
      account_active: active,
      application_complete: active,
      application_submitted: active,
      submitted_at: active ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("customers")
      .update(updatePayload)
      .eq("id", customerIdValue)
      .select("*")
      .maybeSingle();

    if (error) {
      console.log("customers stripe update error:", error.message);
      return merged;
    }

    const finalCustomer = buildCustomerSession(data || { ...merged, ...updatePayload });

    await upsertCustomerSubscriptionRow(finalCustomer);
    await saveCurrentCustomer(finalCustomer);
    hydrateCustomer(finalCustomer);

    return finalCustomer;
  }

  async function retrieveMissingStripeInfo(showAlert = true, overrideCustomerId?: string) {
    try {
      setSyncingStripe(true);

      const id = clean(overrideCustomerId || customerId || String(params?.customerId || params?.customer_id || ""));
      const emailValue = normalize(email || String(params?.email || ""));

      let customerRow = await findCustomerByIdOrEmail(id, emailValue);
      let subRow = await getBestCustomerSubscription(customerRow?.id || id, customerRow?.email || emailValue);

      if (!customerRow && !subRow) {
        if (showAlert) Alert.alert("Not Found", "No customer or Stripe subscription record was found.");
        return null;
      }

      const finalCustomerId = clean(customerRow?.id || subRow?.customer_id || id);

      if (!finalCustomerId) {
        if (showAlert) Alert.alert("Missing Customer", "Customer ID could not be found.");
        return null;
      }

      const synced = await syncCustomerSubscriptionToTables(finalCustomerId, customerRow || subRow);

      if (showAlert) {
        Alert.alert("Stripe Info Retrieved", "Customer Stripe information was synced and saved.");
      }

      return synced;
    } catch (error: any) {
      if (showAlert) Alert.alert("Retrieve Error", error?.message || "Unable to retrieve Stripe information.");
      return null;
    } finally {
      setSyncingStripe(false);
    }
  }

  async function loadSavedCustomer() {
    try {
      const saved =
        (await AsyncStorage.getItem("currentCustomer")) ||
        (await AsyncStorage.getItem("farm2homeCurrentCustomer")) ||
        (await AsyncStorage.getItem("pendingCustomer")) ||
        (await AsyncStorage.getItem("currentUser"));

      let localCustomer: any = null;

      if (saved) {
        try {
          localCustomer = JSON.parse(saved);
          hydrateCustomer(localCustomer);
        } catch {
          localCustomer = null;
        }
      }

      const { data: authData } = await supabase.auth.getUser();
      const authId = clean(authData?.user?.id || "");
      const authEmail = normalize(authData?.user?.email || "");

      const lookupId = clean(
        String(params?.customerId || params?.customer_id || "") ||
          authId ||
          localCustomer?.id ||
          localCustomer?.customerId ||
          customerId
      );

      const lookupEmail = normalize(
        String(params?.email || "") ||
          authEmail ||
          localCustomer?.email ||
          email
      );

      if (!lookupId && !lookupEmail) return;

      const dbCustomer = await findCustomerByIdOrEmail(lookupId, lookupEmail);
      const subRow = await getBestCustomerSubscription(
        dbCustomer?.id || lookupId,
        dbCustomer?.email || lookupEmail
      );

      if (dbCustomer || subRow) {
        const merged = mergeCustomerAndSubscription(dbCustomer || {}, subRow || {});
        hydrateCustomer(merged);
        await saveCurrentCustomer(merged);
      }
    } catch (error) {
      console.log("loadSavedCustomer error:", error);
    }
  }

  async function handleStripeSuccessReturn(returnedCustomerId?: string) {
    if (processingReturn) return;

    try {
      setProcessingReturn(true);

      const saved =
        (await AsyncStorage.getItem("currentCustomer")) ||
        (await AsyncStorage.getItem("farm2homeCurrentCustomer")) ||
        (await AsyncStorage.getItem("pendingCustomer")) ||
        (await AsyncStorage.getItem("currentUser"));

      const localCustomer = saved ? JSON.parse(saved) : null;
      const finalCustomerId =
        clean(returnedCustomerId) ||
        localCustomer?.id ||
        localCustomer?.customerId ||
        customerId;

      if (!finalCustomerId) {
        Alert.alert(
          "Customer Not Found",
          "Stripe payment completed, but the customer profile could not be found."
        );
        return;
      }

      const synced = await retrieveMissingStripeInfo(false, finalCustomerId);

      if (synced && customerReadyForMarketplace(synced)) {
        await markCustomerCompleteAndOpenMarketplace(synced.id);
        return;
      }

      setStep(3);
      Alert.alert(
        "Payment Processing",
        "Stripe returned, but the subscription may still be syncing. Tap Retrieve Missing Stripe Info."
      );
    } catch (error: any) {
      Alert.alert(
        "Stripe Return Error",
        error?.message || "Unable to complete customer registration."
      );
    } finally {
      setProcessingReturn(false);
    }
  }

  async function markCustomerCompleteAndOpenMarketplace(customerIdValue: string) {
    const now = new Date().toISOString();

    const { data: customerRow, error } = await supabase
      .from("customers")
      .select("*")
      .eq("id", customerIdValue)
      .maybeSingle();

    if (error) {
      Alert.alert("Customer Error", error.message);
      return;
    }

    if (!customerRow) {
      Alert.alert("Customer Missing", "Customer record was not found.");
      return;
    }

    const stripeCustomer = pickStripeCustomerId(customerRow.stripe_customer_id, customerRow.stripe_id);
    const stripeSub = pickStripeSubscriptionId(customerRow.stripe_subscription_id, customerRow.subscription_id);
    const status = clean(customerRow?.subscription_status || (stripeSub ? "active" : "pending_payment"));

    const active =
      isStripeCustomerId(stripeCustomer) &&
      isStripeSubscriptionId(stripeSub) &&
      isValidCustomerSubscriptionStatus(status);

    if (!active) {
      Alert.alert(
        "Membership Required",
        "A valid cus_ customer, sub_ subscription, and active/trialing/past_due status are required."
      );
      return;
    }

    const completePayload = {
      application_complete: true,
      application_submitted: true,
      submitted_at: now,
      account_active: true,
      customer_membership_paid: true,
      membership_status: "active",
      subscription_status: status,
      updated_at: now,
    };

    await supabase.from("customers").update(completePayload).eq("id", customerIdValue);

    try {
      await supabase
        .from("profiles")
        .update({
          role: "customer",
          full_name: customerRow.full_name || customerRow.name || "",
          email: customerRow.email,
          phone: customerRow.phone || "",
          account_id: customerRow.account_id || null,
        })
        .eq("id", customerIdValue);
    } catch (profileError) {
      console.log("profile complete update skipped:", profileError);
    }

    try {
      await supabase.from("admin_verifications").upsert(
        {
          id: customerIdValue,
          customer_id: customerIdValue,
          profile_id: customerIdValue,
          account_id: customerRow?.account_id || null,
          account_type: "CUSTOMER",
          role: "customer",
          type: "CUSTOMER",
          full_name: customerRow?.full_name || customerRow?.name || "",
          name: customerRow?.name || customerRow?.full_name || "",
          email: customerRow?.email || "",
          phone: customerRow?.phone || "",
          username: customerRow?.username || "",
          status: "COMPLETE",
          compliance_status: "COMPLETE",
          admin_review_status: "complete",
          review_decision: "complete",
          approved: true,
          rejected: false,
          reviewed: true,
          needs_more_info: false,
          account_active: true,
          application_complete: true,
          application_submitted: true,
          submitted_at: now,
          membership_status: completePayload.membership_status,
          subscription_status: completePayload.subscription_status,
          customer_membership_paid: true,
          stripe_customer_id: stripeCustomer || null,
          stripe_id: stripeCustomer || null,
          stripe_subscription_id: stripeSub || null,
          subscription_id: stripeSub || null,
          updated_at: now,
          created_at: customerRow?.created_at || now,
        },
        { onConflict: "id" }
      );
    } catch (adminError) {
      console.log("admin_verifications customer skipped:", adminError);
    }

    const finalCustomer = buildCustomerSession({
      ...customerRow,
      ...completePayload,
      stripe_customer_id: stripeCustomer,
      stripe_id: stripeCustomer,
      stripe_subscription_id: stripeSub,
      subscription_id: stripeSub,
    });

    await upsertCustomerSubscriptionRow(finalCustomer);
    await saveCurrentCustomer(finalCustomer);
    router.replace("/customer/marketplace" as any);
  }

  async function saveCustomerProfileOnly() {
    if (saving) return null;
    if (!validateForm({ full: false })) return null;

    try {
      setSaving(true);

      const saved = await createOrUpdateCustomer();

      if (saved) {
        Alert.alert("Saved", "Customer profile saved. You can now subscribe or open marketplace if already active.");
      }

      return saved;
    } catch (error: any) {
      Alert.alert("Save Error", error?.message || "Unable to save customer profile.");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function createOrUpdateCustomer() {
    const cleanFullName = clean(fullName);
    const cleanEmail = normalize(email);
    const cleanPhone = clean(phone);
    const cleanUsername = normalize(username);
    const now = new Date().toISOString();

    const existingCustomer = await findExistingCustomer(cleanEmail, cleanUsername);

    let finalCustomerId = clean(customerId || existingCustomer?.id);
    let finalAccountId = clean(accountId || existingCustomer?.account_id);

    if (!finalCustomerId) {
      const { data: currentUserData } = await supabase.auth.getUser();

      if (currentUserData?.user?.id) {
        finalCustomerId = currentUserData.user.id;
      }
    }

    if (!finalCustomerId && !existingCustomer?.id) {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: cleanEmail,
        password: clean(password),
        options: {
          data: {
            role: "customer",
            username: cleanUsername,
            full_name: cleanFullName,
            name: cleanFullName,
          },
        },
      });

      if (authError) throw authError;
      if (!authData?.user?.id) throw new Error("Unable to create customer auth account.");

      finalCustomerId = authData.user.id;
    }

    if (!finalCustomerId) {
      finalCustomerId = existingCustomer?.id;
    }

    if (!finalCustomerId) throw new Error("Unable to resolve customer ID.");

    if (!finalAccountId) {
      finalAccountId = await generateCustomerAccountId();
    }

    const subRow = await getBestCustomerSubscription(finalCustomerId, cleanEmail);

    const finalStripeCustomerId = pickStripeCustomerId(
      stripeCustomerId,
      existingCustomer?.stripe_customer_id,
      existingCustomer?.stripe_id,
      subRow?.stripe_customer_id
    );

    const finalStripeSubscriptionId = pickStripeSubscriptionId(
      stripeSubscriptionId,
      existingCustomer?.stripe_subscription_id,
      existingCustomer?.subscription_id,
      subRow?.stripe_subscription_id
    );

    const finalStatus = clean(
      subscriptionStatus ||
        existingCustomer?.subscription_status ||
        subRow?.subscription_status ||
        (finalStripeSubscriptionId ? "active" : "pending_payment")
    );

    const active =
      isStripeCustomerId(finalStripeCustomerId) &&
      isStripeSubscriptionId(finalStripeSubscriptionId) &&
      isValidCustomerSubscriptionStatus(finalStatus);

    const customerPayload: CustomerRecord = {
      id: finalCustomerId,
      customer_id: finalCustomerId,
      account_id: finalAccountId || null,
      auth_user_id: finalCustomerId,
      profile_id: finalCustomerId,
      role: "customer",

      full_name: cleanFullName,
      name: cleanFullName,
      email: cleanEmail,
      phone: cleanPhone,
      username: cleanUsername,

      delivery_address: deliveryAddress.trim() || existingCustomer?.delivery_address || null,
      delivery_city: deliveryCity.trim() || existingCustomer?.delivery_city || null,
      delivery_state: deliveryState.trim().toUpperCase() || existingCustomer?.delivery_state || null,
      delivery_zip: deliveryZip.trim() || existingCustomer?.delivery_zip || null,
      delivery_instructions: deliveryInstructions.trim() || existingCustomer?.delivery_instructions || null,
      preferred_delivery_option: preferredDeliveryOption || existingCustomer?.preferred_delivery_option || "delivery",

      account_active: active,
      customer_membership_paid: active,
      subscription_status: finalStatus,
      membership_status: active ? "active" : "pending_payment",
      application_complete: active,
      application_submitted: active,
      submitted_at: active ? now : existingCustomer?.submitted_at || null,

      stripe_id: finalStripeCustomerId || null,
      stripe_customer_id: finalStripeCustomerId || null,
      stripe_subscription_id: finalStripeSubscriptionId || null,
      subscription_id: finalStripeSubscriptionId || null,
      stripe_checkout_session_id: existingCustomer?.stripe_checkout_session_id || null,

      security_question_1: securityQuestion1 || existingCustomer?.security_question_1 || "",
      security_answer_1: securityAnswer1.trim()
        ? normalizeAnswer(securityAnswer1)
        : existingCustomer?.security_answer_1 || null,
      security_question_2: securityQuestion2 || existingCustomer?.security_question_2 || "",
      security_answer_2: securityAnswer2.trim()
        ? normalizeAnswer(securityAnswer2)
        : existingCustomer?.security_answer_2 || null,
      security_question_3: securityQuestion3 || existingCustomer?.security_question_3 || "",
      security_answer_3: securityAnswer3.trim()
        ? normalizeAnswer(securityAnswer3)
        : existingCustomer?.security_answer_3 || null,

      notifications_enabled: existingCustomer?.notifications_enabled ?? true,
      expo_push_token: existingCustomer?.expo_push_token || "",

      created_at: existingCustomer?.created_at || now,
      updated_at: now,
    };

    await upsertProfile(customerPayload);
    const customerRow = await saveCustomerRow(customerPayload);
    await upsertCustomerSubscriptionRow(customerRow);

    const finalSession = buildCustomerSession(customerRow);

    hydrateCustomer(finalSession);
    await saveCurrentCustomer(finalSession);

    return finalSession;
  }

  async function startCustomerCheckout() {
    if (stripeLoading) return;
    if (!validateForm({ full: false })) return;

    try {
      setStripeLoading(true);

      const restored = await retrieveMissingStripeInfo(false);
      if (restored && customerReadyForMarketplace(restored)) {
        Alert.alert("Membership Already Active", "Your customer subscription is already saved.");
        await markCustomerCompleteAndOpenMarketplace(restored.id);
        return;
      }

      const saved = restored?.id ? restored : await createOrUpdateCustomer();
      if (!saved?.id) throw new Error("Customer profile did not save.");

      const id = clean(saved.id);
      const cleanEmail = normalize(saved.email);
      const cleanFullName = clean(saved.full_name || saved.name || fullName);
      const cleanUsername = normalize(saved.username || username);

      const successUrl = `${APP_URL}/customer/register?stripe=success&customerId=${encodeURIComponent(
        id
      )}&email=${encodeURIComponent(cleanEmail)}`;

      const cancelUrl = `${APP_URL}/customer/register?stripe=cancelled&customerId=${encodeURIComponent(
        id
      )}&email=${encodeURIComponent(cleanEmail)}`;

      const response = await fetch(`${API_BASE_URL}/payments/create-customer-subscription-checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          role: "customer",
          planType: "customer",

          userId: id,
          customerId: id,
          customer_id: id,
          profileId: id,
          authUserId: id,

          accountId: saved.account_id || accountId || null,
          account_id: saved.account_id || accountId || null,

          customerEmail: cleanEmail,
          customer_email: cleanEmail,
          email: cleanEmail,

          name: cleanFullName,
          fullName: cleanFullName,
          username: cleanUsername,

          successUrl,
          success_url: successUrl,
          cancelUrl,
          cancel_url: cancelUrl,

          metadata: {
            role: "customer",
            customer_id: id,
            account_id: saved.account_id || accountId || "",
            customer_email: cleanEmail,
            email: cleanEmail,
            name: cleanFullName,
            username: cleanUsername,
          },
        }),
      });

      const data = await parseApiResponse(response);
      console.log("CUSTOMER STRIPE CHECKOUT RESPONSE:", data);

      const checkoutUrl = data?.url || getStripeLaunchUrl(data);

      if (!response.ok || (!data.success && !checkoutUrl && !data.alreadySubscribed)) {
        console.log("CUSTOMER STRIPE ERROR RESPONSE:", data);
        throw new Error(data.error || data.message || "Stripe checkout failed.");
      }

      if (data.alreadySubscribed) {
        const stripeCustomer = pickStripeCustomerId(
          data.stripeCustomerId,
          data.stripe_customer_id,
          data.customerId
        );

        const stripeSub = pickStripeSubscriptionId(
          data.stripeSubscriptionId,
          data.stripe_subscription_id,
          data.subscriptionId,
          data.subscription_id
        );

        const finalStatus = clean(data.subscriptionStatus || data.subscription_status || "active");

        const active =
          isStripeCustomerId(stripeCustomer) &&
          isStripeSubscriptionId(stripeSub) &&
          isValidCustomerSubscriptionStatus(finalStatus);

        const updatePayload = {
          stripe_id: stripeCustomer || null,
          stripe_customer_id: stripeCustomer || null,
          stripe_subscription_id: stripeSub || null,
          subscription_id: stripeSub || null,
          membership_status: active ? "active" : "pending_payment",
          subscription_status: finalStatus,
          customer_membership_paid: active,
          application_complete: active,
          application_submitted: active,
          submitted_at: active ? new Date().toISOString() : null,
          account_active: active,
          updated_at: new Date().toISOString(),
        };

        const { data: updatedCustomer, error } = await supabase
          .from("customers")
          .update(updatePayload)
          .eq("id", id)
          .select("*")
          .maybeSingle();

        if (error) throw error;

        const finalCustomer = buildCustomerSession(updatedCustomer || { ...saved, ...updatePayload });
        await upsertCustomerSubscriptionRow(finalCustomer);
        await saveCurrentCustomer(finalCustomer);
        hydrateCustomer(finalCustomer);

        if (customerReadyForMarketplace(finalCustomer)) {
          await markCustomerCompleteAndOpenMarketplace(id);
        } else {
          Alert.alert(
            "Subscription Incomplete",
            "Customer was found, but a valid cus_ customer and sub_ subscription was not returned."
          );
        }

        return;
      }

      const stripeCustomer = pickStripeCustomerId(
        data.stripeCustomerId,
        data.stripe_customer_id,
        data.customerId,
        data.customer_id
      );

      const checkoutSessionId = clean(data.id || data.sessionId || data.session_id);

      const pendingPayload = {
        stripe_id: stripeCustomer || null,
        stripe_customer_id: stripeCustomer || null,
        stripe_checkout_session_id: checkoutSessionId || null,
        membership_status: "pending_payment",
        subscription_status: "pending_payment",
        application_complete: false,
        application_submitted: false,
        account_active: false,
        updated_at: new Date().toISOString(),
      };

      if (!checkoutUrl) {
        throw new Error("Stripe checkout URL was not returned from backend.");
      }

      // Launch Stripe immediately. Do not let Supabase saves block browser launch.
      void openStripeUrl(checkoutUrl);

      try {
        await supabase.from("customers").update(pendingPayload).eq("id", id);
      } catch (customerUpdateError) {
        console.log("customer pending update after launch skipped:", customerUpdateError);
      }

      const pendingCustomer = buildCustomerSession({
        ...saved,
        ...pendingPayload,
        id,
        email: cleanEmail,
        full_name: cleanFullName,
        name: cleanFullName,
        username: cleanUsername,
      });

      try {
        await upsertCustomerSubscriptionRow(pendingCustomer);
      } catch (subscriptionSaveError) {
        console.log("customer subscription pending save after launch skipped:", subscriptionSaveError);
      }

      try {
        await saveCurrentCustomer(pendingCustomer);
      } catch (sessionSaveError) {
        console.log("customer session save after launch skipped:", sessionSaveError);
      }
    } catch (error: any) {
      console.log("CUSTOMER REGISTER ERROR:", error);
      Alert.alert(
        "Registration Error",
        error?.message || "Unable to complete customer registration."
      );
    } finally {
      setStripeLoading(false);
    }
  }

  async function openMarketplaceIfReady() {
    const synced = await retrieveMissingStripeInfo(false);

    const target = synced || {
      id: customerId,
      stripe_customer_id: stripeCustomerId,
      subscription_id: stripeSubscriptionId,
      subscription_status: subscriptionStatus,
    };

    if (customerReadyForMarketplace(target)) {
      await markCustomerCompleteAndOpenMarketplace(target.id || customerId);
      return;
    }

    Alert.alert(
      "Membership Required",
      "A valid cus_ customer, sub_ subscription, and active/trialing/past_due status are required before opening Marketplace."
    );
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
          <SectionTitle title="Customer Account" subtitle="Create the marketplace login and primary contact." />

          <Field label="Full Name" value={fullName} onChangeText={setFullName} placeholder="Customer full name" icon="person-outline" />
          <Field label="Email" value={email} onChangeText={(v) => setEmail(normalize(v))} placeholder="customer@email.com" icon="mail-outline" keyboardType="email-address" autoCapitalize="none" />
          <Field label="Phone" value={phone} onChangeText={setPhone} placeholder="(555) 555-5555" icon="call-outline" keyboardType="phone-pad" />
          <Field label="Username" value={username} onChangeText={(v) => setUsername(normalize(v))} placeholder="customer username" icon="at-outline" autoCapitalize="none" />

          {!customerId ? (
            <>
              <Field label="Password" value={password} onChangeText={setPassword} placeholder="Create password" icon="lock-closed-outline" secureTextEntry />
              <Field label="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Confirm password" icon="lock-closed-outline" secureTextEntry />
            </>
          ) : (
            <View style={styles.noticeBox}>
              <Ionicons name="checkmark-circle-outline" size={20} color={COLORS.accent} />
              <Text style={styles.noticeText}>Customer Auth/Profile already exists. Password is managed by Supabase Auth.</Text>
            </View>
          )}
        </View>
      );
    }

    if (step === 1) {
      return (
        <View>
          <SectionTitle title="Delivery Information" subtitle="Save default delivery address for Farm2Home orders." />

          <Field label="Delivery Address" value={deliveryAddress} onChangeText={setDeliveryAddress} placeholder="Street address" icon="location-outline" />
          <View style={styles.twoCol}>
            <View style={styles.col}>
              <Field label="City" value={deliveryCity} onChangeText={setDeliveryCity} placeholder="Detroit" icon="business-outline" />
            </View>
            <View style={styles.col}>
              <Field label="State" value={deliveryState} onChangeText={(v) => setDeliveryState(v.toUpperCase())} placeholder="MI" icon="flag-outline" autoCapitalize="characters" />
            </View>
          </View>
          <Field label="ZIP Code" value={deliveryZip} onChangeText={setDeliveryZip} placeholder="48201" icon="mail-open-outline" keyboardType="numeric" />
          <Field label="Delivery Instructions" value={deliveryInstructions} onChangeText={setDeliveryInstructions} placeholder="Gate code, porch, call on arrival..." icon="reader-outline" />

          <Text style={styles.inputLabel}>Preferred Option</Text>
          <View style={styles.optionRow}>
            {["delivery", "pickup"].map((option) => {
              const active = preferredDeliveryOption === option;
              return (
                <TouchableOpacity
                  key={option}
                  style={[styles.optionChip, active && styles.optionChipSelected]}
                  onPress={() => setPreferredDeliveryOption(option)}
                  activeOpacity={0.9}
                >
                  <Ionicons
                    name={option === "delivery" ? "car-outline" : "bag-handle-outline"}
                    size={18}
                    color={active ? COLORS.white : COLORS.primary}
                  />
                  <Text style={[styles.optionText, active && styles.optionTextSelected]}>
                    {option === "delivery" ? "Delivery" : "Pickup"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      );
    }

    if (step === 2) {
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

    if (step === 3) {
      return (
        <View>
          <SectionTitle title="Stripe Customer Membership" subtitle="Save customer subscription for marketplace access." />

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
            subtitle="Save customer fields to profiles, customers, and customer_subscriptions."
            icon="save-outline"
            loading={saving}
            onPress={saveCustomerProfileOnly}
          />

          <ActionButton
            title="Find / Retrieve Missing Stripe Info"
            subtitle="Search customer_subscriptions and backend Stripe sync."
            icon="sync-outline"
            loading={syncingStripe}
            onPress={() => retrieveMissingStripeInfo(true)}
            secondary
          />

          <ActionButton
            title="Create Account + Subscribe"
            subtitle="Open Stripe Checkout for customer membership."
            icon="card-outline"
            loading={stripeLoading}
            onPress={startCustomerCheckout}
          />

          <ActionButton
            title="Open Marketplace"
            subtitle="Only opens after valid cus_, sub_, and active/trialing/past_due status."
            icon="storefront-outline"
            loading={syncingStripe}
            onPress={openMarketplaceIfReady}
            secondary
          />
        </View>
      );
    }

    return (
      <View>
        <SectionTitle title="Review & Open Marketplace" subtitle="Confirm saved customer fields and marketplace access." />

        <ReviewRow label="Customer" value={fullName} />
        <ReviewRow label="Email" value={email} />
        <ReviewRow label="Phone" value={phone} />
        <ReviewRow label="Delivery" value={`${deliveryAddress || "No address"} ${deliveryCity ? `, ${deliveryCity}` : ""}`} />
        <ReviewRow label="Stripe Customer" value={maskId(stripeCustomerId)} />
        <ReviewRow label="Subscription" value={maskId(stripeSubscriptionId)} />
        <ReviewRow label="Status" value={subscriptionStatus || "Missing"} />

        <View style={styles.noticeBox}>
          <Ionicons
            name={customerIsReady ? "checkmark-circle-outline" : "warning-outline"}
            size={20}
            color={customerIsReady ? COLORS.accent : COLORS.warning}
          />
          <Text style={styles.noticeText}>
            {customerIsReady
              ? "Customer membership is active and marketplace access is ready."
              : "Customer marketplace access requires cus_, sub_, and active/trialing/past_due status."}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, syncingStripe && styles.disabledButton]}
          onPress={openMarketplaceIfReady}
          disabled={syncingStripe}
          activeOpacity={0.9}
        >
          {syncingStripe ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <>
              <Ionicons name="storefront-outline" size={18} color={COLORS.white} />
              <Text style={styles.primaryButtonText}>Open Marketplace</Text>
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
                  <Ionicons name="basket-outline" size={28} color={COLORS.white} />
                </View>
                <View>
                  <Text style={styles.brandTitle}>Farm2Home</Text>
                  <Text style={styles.brandSubtitle}>Customer Market</Text>
                </View>
              </View>

              <View style={styles.sideDivider} />

              <View style={styles.scoreCard}>
                <Text style={styles.scoreLabel}>Setup Progress</Text>
                <Text style={styles.scoreValue}>{setupScore}/4</Text>
                <Text style={styles.scoreHint}>
                  Customer profile, Stripe customer, subscription, and valid status. Account ID is optional.
                </Text>
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
                  <Text style={styles.eyebrow}>Customer Registration</Text>
                  <Text style={styles.pageTitle}>Customer Marketplace Setup</Text>
                  <Text style={styles.pageSubtitle}>
                    Save customer information and Stripe membership for marketplace access.
                  </Text>
                </View>

                <TouchableOpacity style={styles.loginButton} onPress={() => router.replace("/customer/login" as any)} activeOpacity={0.9}>
                  <Ionicons name="log-in-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.loginButtonText}>Customer Login</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.metricsRow}>
                <MetricCard icon="person-outline" label="Customer" value={customerId ? "Found" : "Missing"} />
                <MetricCard icon="card-outline" label="Subscription" value={isStripeSubscriptionId(stripeSubscriptionId) ? "Saved" : "Missing"} />
                <MetricCard icon="storefront-outline" label="Marketplace" value={customerIsReady ? "Ready" : "Locked"} />
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
                      style={[styles.primaryButtonSmall, syncingStripe && styles.disabledButton]}
                      onPress={openMarketplaceIfReady}
                      disabled={syncingStripe}
                      activeOpacity={0.9}
                    >
                      {syncingStripe ? (
                        <ActivityIndicator color={COLORS.white} />
                      ) : (
                        <>
                          <Text style={styles.primaryButtonText}>Marketplace</Text>
                          <Ionicons name="storefront-outline" size={18} color={COLORS.white} />
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
      style={[styles.actionButton, secondary && styles.actionButtonSecondary, loading && styles.disabledButton]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.9}
    >
      <View style={[styles.actionIcon, secondary && styles.actionIconSecondary]}>
        {loading ? (
          <ActivityIndicator color={secondary ? COLORS.primary : COLORS.white} />
        ) : (
          <Ionicons name={icon} size={19} color={secondary ? COLORS.primary : COLORS.white} />
        )}
      </View>

      <View style={{ flex: 1 }}>
        <Text style={[styles.actionTitle, secondary && styles.actionTitleSecondary]}>{title}</Text>
        <Text style={styles.actionSubtitle}>{subtitle}</Text>
      </View>

      <Ionicons name="chevron-forward-outline" size={20} color={secondary ? COLORS.primary : COLORS.white} />
    </TouchableOpacity>
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
      <View>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={styles.metricValue}>{value}</Text>
      </View>
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  keyboard: { flex: 1, backgroundColor: COLORS.bg },
  content: { flexGrow: 1 },
  shell: {
    flexDirection: Platform.OS === "web" ? "row" : "column",
    minHeight: "100%",
  },
  sidebar: {
    width: Platform.OS === "web" ? 270 : "100%",
    backgroundColor: COLORS.navy,
    padding: 16,
    gap: 10,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
  },
  brandIcon: {
    width: 48,
    height: 48,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  brandTitle: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: "900",
  },
  brandSubtitle: {
    color: "#A5B4FC",
    fontSize: 12,
    fontWeight: "800",
  },
  sideDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
    marginVertical: 8,
  },
  scoreCard: {
    backgroundColor: "#111827",
    borderRadius: 18,
    padding: 16,
    marginBottom: 2,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  scoreLabel: {
    color: "#CBD5E1",
    fontSize: 12,
    fontWeight: "900",
  },
  scoreValue: {
    color: COLORS.white,
    fontSize: 32,
    fontWeight: "900",
    marginTop: 6,
  },
  scoreHint: {
    color: "#A5B4FC",
    lineHeight: 18,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },
  stepNav: {
    backgroundColor: "#111827",
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  stepNavActive: {
    borderColor: COLORS.primary,
    backgroundColor: "#172033",
  },
  stepNavIcon: {
    width: 30,
    height: 30,
    borderRadius: 12,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNavIconActive: {
    backgroundColor: COLORS.primary,
  },
  stepNavIconDone: {
    backgroundColor: COLORS.accent,
  },
  stepNavText: {
    color: "#CBD5E1",
    fontWeight: "900",
  },
  stepNavTextActive: {
    color: COLORS.white,
  },
  homeButton: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "rgba(99,91,255,0.55)",
    borderRadius: 14,
    padding: 13,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  homeButtonText: {
    color: COLORS.white,
    fontWeight: "900",
  },
  main: {
    flex: 1,
    padding: 16,
  },
  topPanel: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 22,
    padding: 18,
    flexDirection: Platform.OS === "web" ? "row" : "column",
    gap: 12,
    alignItems: Platform.OS === "web" ? "center" : "stretch",
    marginBottom: 14,
  },
  eyebrow: {
    color: COLORS.primary,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontSize: 12,
    fontWeight: "900",
  },
  pageTitle: {
    color: COLORS.text,
    fontSize: 30,
    fontWeight: "900",
    marginTop: 4,
  },
  pageSubtitle: {
    color: COLORS.muted,
    lineHeight: 20,
    fontWeight: "700",
    marginTop: 4,
  },
  loginButton: {
    backgroundColor: COLORS.primarySoft,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  loginButtonText: {
    color: COLORS.primary,
    fontWeight: "900",
  },
  metricsRow: {
    flexDirection: Platform.OS === "web" ? "row" : "column",
    gap: 12,
    marginBottom: 14,
  },
  metricCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  metricIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  metricLabel: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  metricValue: {
    color: COLORS.text,
    fontWeight: "900",
    marginTop: 3,
  },
  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 22,
    padding: 18,
  },
  processingBox: {
    backgroundColor: COLORS.primarySoft,
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  processingText: {
    color: COLORS.primary,
    fontWeight: "900",
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "900",
  },
  sectionSubtitle: {
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 4,
    lineHeight: 20,
  },
  fieldWrap: {
    marginBottom: 13,
  },
  inputLabel: {
    color: COLORS.text,
    fontWeight: "900",
    marginBottom: 7,
  },
  inputShell: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 15,
    paddingHorizontal: 12,
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  input: {
    flex: 1,
    color: COLORS.text,
    fontWeight: "700",
    paddingVertical: 12,
  },
  twoCol: {
    flexDirection: Platform.OS === "web" ? "row" : "column",
    gap: 12,
  },
  col: {
    flex: 1,
  },
  optionRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  optionChip: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 15,
    padding: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  optionChipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  optionText: {
    color: COLORS.primary,
    fontWeight: "900",
  },
  optionTextSelected: {
    color: COLORS.white,
  },
  questionBlock: {
    marginBottom: 12,
  },
  questionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  questionChip: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  questionChipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  questionChipDisabled: {
    opacity: 0.45,
  },
  questionChipText: {
    color: COLORS.primary,
    fontWeight: "900",
    fontSize: 12,
  },
  questionChipTextSelected: {
    color: COLORS.white,
  },
  questionChipTextDisabled: {
    color: COLORS.muted,
  },
  noticeBox: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 13,
    flexDirection: "row",
    gap: 9,
    alignItems: "center",
    marginBottom: 12,
  },
  noticeText: {
    color: COLORS.muted,
    flex: 1,
    fontWeight: "700",
    lineHeight: 19,
  },
  statusList: {
    gap: 9,
    marginBottom: 14,
  },
  statusRow: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 15,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  statusIcon: {
    width: 30,
    height: 30,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  statusGood: {
    backgroundColor: COLORS.accent,
  },
  statusMissing: {
    backgroundColor: COLORS.surface2,
  },
  statusLabel: {
    color: COLORS.text,
    fontWeight: "900",
  },
  statusValue: {
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 2,
  },
  actionButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    padding: 15,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  actionButtonSecondary: {
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: "#C7D2FE",
  },
  actionIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.17)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionIconSecondary: {
    backgroundColor: COLORS.white,
  },
  actionTitle: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: "900",
  },
  actionTitleSecondary: {
    color: COLORS.primary,
  },
  actionSubtitle: {
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 2,
    lineHeight: 18,
  },
  reviewRow: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 15,
    padding: 13,
    marginBottom: 9,
  },
  reviewLabel: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  reviewValue: {
    color: COLORS.text,
    fontWeight: "900",
    marginTop: 3,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    padding: 15,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryButtonSmall: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontWeight: "900",
  },
  footerNav: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: 18,
    paddingTop: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  navButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.white,
  },
  navButtonText: {
    color: COLORS.primary,
    fontWeight: "900",
  },
  disabledButton: {
    opacity: 0.55,
  },
});
