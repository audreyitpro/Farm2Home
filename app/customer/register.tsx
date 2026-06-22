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
 * app/customer/register.tsx
 *
 * Fully corrected Customer registration workflow.
 *
 * Saves and syncs:
 * 1. public.customers
 * 2. public.profiles
 * 3. public.customer_subscriptions
 *
 * Customer Stripe rules:
 * - stripe_customer_id MUST be cus_...
 * - stripe_subscription_id MUST be sub_...
 * - subscription_id MUST be sub_...
 * - NEVER save acct_... into customer_subscriptions.stripe_customer_id
 * - Customers do not use Stripe Connect. acct_... belongs to farmer/driver/freight payout accounts only.
 *
 * Important:
 * This file intentionally uses only safe columns for profiles based on the schema you showed:
 * id, auth_user_id, role, full_name, email, phone, account_id, created_at.
 * It does not write profile_id, username, stripe_customer_id, subscription_id, etc. into profiles.
 */

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
  greenSoft: "#DCFCE7",
  amber: "#F59E0B",
  amberSoft: "#FEF3C7",
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
  "What is your favorite color?",
];

type CustomerRecord = {
  id: string;
  customer_id?: string;
  auth_user_id?: string;
  profile_id?: string;
  account_id: string;
  role: "customer";

  full_name: string;
  name: string;
  email: string;
  phone: string;
  username: string;

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

function normalize(value: any) {
  return String(value ?? "").trim().toLowerCase();
}

function clean(value: any) {
  return String(value ?? "").trim();
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

async function openCheckoutUrl(url: string) {
  if (!url || !url.startsWith("http")) {
    Alert.alert("Stripe Error", "No valid Stripe checkout URL returned.");
    return;
  }

  if (Platform.OS === "web") {
    window.location.href = url;
    return;
  }

  try {
    await WebBrowser.openBrowserAsync(url);
  } catch {
    await Linking.openURL(url);
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

    stripeId: stripeCustomerId,
    stripe_id: stripeCustomerId,
    stripeCustomerId,
    stripe_customer_id: stripeCustomerId,
    stripeSubscriptionId,
    stripe_subscription_id: stripeSubscriptionId,
    subscriptionId: stripeSubscriptionId,
    subscription_id: stripeSubscriptionId,

    membershipStatus: clean(
      row?.membership_status ||
        row?.membershipStatus ||
        (stripeSubscriptionId ? "active" : "pending_payment")
    ),
    membership_status: clean(
      row?.membership_status ||
        row?.membershipStatus ||
        (stripeSubscriptionId ? "active" : "pending_payment")
    ),
    subscriptionStatus: clean(
      row?.subscription_status ||
        row?.subscriptionStatus ||
        (stripeSubscriptionId ? "active" : "pending_payment")
    ),
    subscription_status: clean(
      row?.subscription_status ||
        row?.subscriptionStatus ||
        (stripeSubscriptionId ? "active" : "pending_payment")
    ),

    accountActive: row?.account_active !== false,
    account_active: row?.account_active !== false,

    customerMembershipPaid: Boolean(row?.customer_membership_paid || stripeSubscriptionId),
    customer_membership_paid: Boolean(row?.customer_membership_paid || stripeSubscriptionId),

    applicationComplete: Boolean(row?.application_complete || stripeSubscriptionId),
    application_complete: Boolean(row?.application_complete || stripeSubscriptionId),

    applicationSubmitted: Boolean(row?.application_submitted || stripeSubscriptionId),
    application_submitted: Boolean(row?.application_submitted || stripeSubscriptionId),

    updatedAt: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function customerReadyForMarketplace(row: any) {
  const customer = buildCustomerSession(row);

  return Boolean(
    customer.id &&
      customer.account_id &&
      isStripeCustomerId(customer.stripe_customer_id) &&
      isStripeSubscriptionId(customer.subscription_id)
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

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [securityQuestion1, setSecurityQuestion1] = useState("");
  const [securityAnswer1, setSecurityAnswer1] = useState("");
  const [securityQuestion2, setSecurityQuestion2] = useState("");
  const [securityAnswer2, setSecurityAnswer2] = useState("");
  const [securityQuestion3, setSecurityQuestion3] = useState("");
  const [securityAnswer3, setSecurityAnswer3] = useState("");

  const [customerId, setCustomerId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [stripeCustomerId, setStripeCustomerId] = useState("");
  const [stripeSubscriptionId, setStripeSubscriptionId] = useState("");
  const [subscriptionStatus, setSubscriptionStatus] = useState("");

  const [loading, setLoading] = useState(false);
  const [savingOnly, setSavingOnly] = useState(false);
  const [syncingStripe, setSyncingStripe] = useState(false);
  const [processingReturn, setProcessingReturn] = useState(false);

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
        complete: isStripeSubscriptionId(stripeSubscriptionId),
        value: maskId(stripeSubscriptionId),
      },
    ];
  }, [customerId, accountId, stripeCustomerId, stripeSubscriptionId]);

  const setupScore = useMemo(
    () => setupStatus.filter((item) => item.complete).length,
    [setupStatus]
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

  function hydrateCustomer(row: any) {
    const session = buildCustomerSession(row);

    if (session.id) setCustomerId(session.id);
    if (session.account_id) setAccountId(session.account_id);
    if (session.stripe_customer_id) setStripeCustomerId(session.stripe_customer_id);
    if (session.subscription_id) setStripeSubscriptionId(session.subscription_id);
    if (session.subscription_status) setSubscriptionStatus(session.subscription_status);

    if (session.full_name) setFullName(session.full_name);
    if (session.email) setEmail(session.email);
    if (session.phone) setPhone(session.phone);
    if (session.username) setUsername(session.username);

    if (row?.security_question_1) setSecurityQuestion1(clean(row.security_question_1));
    if (row?.security_question_2) setSecurityQuestion2(clean(row.security_question_2));
    if (row?.security_question_3) setSecurityQuestion3(clean(row.security_question_3));

    return session;
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

  function validateForm({ requirePassword = true, requireSecurity = true } = {}) {
    if (!fullName.trim() || !email.trim() || !phone.trim()) {
      Alert.alert("Missing Info", "Please enter your name, email, and phone.");
      return false;
    }

    if (!normalize(email).includes("@")) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return false;
    }

    if (!username.trim()) {
      Alert.alert("Username Required", "Please create a username.");
      return false;
    }

    if (normalize(username).length < 4) {
      Alert.alert("Invalid Username", "Username must be at least 4 characters.");
      return false;
    }

    if (requirePassword && !customerId) {
      if (!password.trim() || !confirmPassword.trim()) {
        Alert.alert("Password Required", "Please create and confirm your password.");
        return false;
      }

      if (password.trim().length < 6) {
        Alert.alert("Weak Password", "Password must be at least 6 characters.");
        return false;
      }

      if (password.trim() !== confirmPassword.trim()) {
        Alert.alert("Password Mismatch", "Passwords do not match.");
        return false;
      }
    }

    if (requireSecurity && !customerId) {
      if (selectedQuestions.length !== 3 || new Set(selectedQuestions).size !== 3) {
        Alert.alert("Security Required", "Please select 3 different security questions.");
        return false;
      }

      if (!securityAnswer1.trim() || !securityAnswer2.trim() || !securityAnswer3.trim()) {
        Alert.alert("Security Required", "Please answer all 3 security questions.");
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
        .or(`id.eq.${cleanId},auth_user_id.eq.${cleanId},profile_id.eq.${cleanId}`)
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
          pickStripeSubscriptionId(row?.stripe_subscription_id)
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

    return {
      ...customer,
      id: clean(customer?.id || subRow?.customer_id || customerId),
      customer_id: clean(customer?.id || subRow?.customer_id || customerId),
      auth_user_id: clean(customer?.auth_user_id || customer?.id || subRow?.customer_id || customerId),
      profile_id: clean(customer?.profile_id || customer?.id || subRow?.customer_id || customerId),
      account_id: clean(customer?.account_id || accountId),
      full_name: clean(customer?.full_name || customer?.name || subRow?.name || fullName),
      name: clean(customer?.name || customer?.full_name || subRow?.name || fullName),
      email: normalize(customer?.email || subRow?.customer_email || email),
      phone: clean(customer?.phone || phone),
      username: normalize(customer?.username || subRow?.username || username),
      stripe_id: stripeCustomer || null,
      stripe_customer_id: stripeCustomer || null,
      stripe_subscription_id: stripeSub || null,
      subscription_id: stripeSub || null,
      subscription_status: clean(
        customer?.subscription_status ||
          subRow?.subscription_status ||
          subscriptionStatus ||
          (stripeSub ? "active" : "pending_payment")
      ),
      membership_status: stripeSub ? "active" : clean(customer?.membership_status || "pending_payment"),
      customer_membership_paid: Boolean(stripeSub || customer?.customer_membership_paid),
      account_active: true,
      application_complete: Boolean(stripeSub || customer?.application_complete),
      application_submitted: Boolean(stripeSub || customer?.application_submitted),
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
      account_id: payload.account_id,
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
    const stripeCustomer = pickStripeCustomerId(customer?.stripe_customer_id, customer?.stripe_id, customer?.stripeCustomerId);
    const stripeSub = pickStripeSubscriptionId(
      customer?.stripe_subscription_id,
      customer?.subscription_id,
      customer?.stripeSubscriptionId,
      customer?.subscriptionId
    );

    if (!id && !customerEmail) return;

    await cleanBadCustomerSubscriptionAcct(customerEmail, id);

    const now = new Date().toISOString();

    const payload = {
      customer_id: id,
      customer_email: customerEmail,
      name: clean(customer?.full_name || customer?.name),
      username: normalize(customer?.username),
      stripe_customer_id: stripeCustomer || null,
      stripe_subscription_id: stripeSub || null,
      subscription_status: customer?.subscription_status || (stripeSub ? "active" : "pending_payment"),
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

    const finalStatus =
      backendSync?.subscriptionStatus ||
      backendSync?.subscription_status ||
      merged.subscription_status ||
      (stripeSub ? "active" : "pending_payment");

    const updatePayload = {
      stripe_id: stripeCustomer || null,
      stripe_customer_id: stripeCustomer || null,
      stripe_subscription_id: stripeSub || null,
      subscription_id: stripeSub || null,
      subscription_status: finalStatus,
      membership_status: stripeSub ? "active" : "pending_payment",
      customer_membership_paid: Boolean(stripeSub),
      account_active: true,
      application_complete: Boolean(stripeSub),
      application_submitted: Boolean(stripeSub),
      submitted_at: stripeSub ? new Date().toISOString() : null,
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
    const paid = Boolean(stripeSub);

    const completePayload = {
      application_complete: true,
      application_submitted: true,
      submitted_at: now,
      account_active: true,
      customer_membership_paid: paid,
      membership_status: paid ? "active" : "pending",
      subscription_status: customerRow?.subscription_status || (paid ? "active" : "pending"),
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
          account_id: customerRow.account_id || "",
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
          account_id: customerRow?.account_id || "",
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
          customer_membership_paid: paid,
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
    if (savingOnly) return;
    if (!validateForm({ requirePassword: !customerId, requireSecurity: !customerId })) return;

    try {
      setSavingOnly(true);

      const saved = await createOrUpdateCustomer({ startCheckout: false });

      if (saved) {
        Alert.alert("Saved", "Customer profile saved. You can now subscribe or go to marketplace if already active.");
      }

      return saved;
    } catch (error: any) {
      Alert.alert("Save Error", error?.message || "Unable to save customer profile.");
      return null;
    } finally {
      setSavingOnly(false);
    }
  }

  async function createOrUpdateCustomer({ startCheckout }: { startCheckout: boolean }) {
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

    const finalStatus =
      subscriptionStatus ||
      existingCustomer?.subscription_status ||
      subRow?.subscription_status ||
      (finalStripeSubscriptionId ? "active" : "pending_payment");

    const paid = Boolean(finalStripeSubscriptionId);

    const customerPayload: CustomerRecord = {
      id: finalCustomerId,
      customer_id: finalCustomerId,
      account_id: finalAccountId,
      auth_user_id: finalCustomerId,
      profile_id: finalCustomerId,
      role: "customer",

      full_name: cleanFullName,
      name: cleanFullName,
      email: cleanEmail,
      phone: cleanPhone,
      username: cleanUsername,

      account_active: true,
      customer_membership_paid: paid,
      subscription_status: finalStatus,
      membership_status: paid ? "active" : "pending_payment",
      application_complete: paid,
      application_submitted: paid,
      submitted_at: paid ? now : existingCustomer?.submitted_at || null,

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

    if (startCheckout) {
      await startCustomerCheckout(customerRow, finalSession);
    }

    return finalSession;
  }

  async function startCustomerCheckout(customerRow: any, localCustomer: any) {
    const id = clean(customerRow.id);
    const acct = clean(customerRow.account_id);
    const cleanEmail = normalize(customerRow.email);
    const cleanFullName = clean(customerRow.full_name || customerRow.name);
    const cleanUsername = normalize(customerRow.username);

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

        accountId: acct,
        account_id: acct,

        customerEmail: cleanEmail,
        customer_email: cleanEmail,
        email: cleanEmail,

        name: cleanFullName,
        fullName: cleanFullName,
        companyName: cleanFullName,
        businessName: cleanFullName,
        username: cleanUsername,

        successUrl,
        success_url: successUrl,
        cancelUrl,
        cancel_url: cancelUrl,

        metadata: {
          role: "customer",
          customer_id: id,
          account_id: acct,
          customer_email: cleanEmail,
          email: cleanEmail,
          name: cleanFullName,
          username: cleanUsername,
        },
      }),
    });

    const data = await parseApiResponse(response);

    if (!response.ok || (!data.success && !data.url && !data.alreadySubscribed)) {
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
        data.stripe_subscription_id
      );

      const updatePayload = {
        stripe_id: stripeCustomer || null,
        stripe_customer_id: stripeCustomer || null,
        stripe_subscription_id: stripeSub || null,
        subscription_id: stripeSub || null,
        membership_status: "active",
        subscription_status: data.subscriptionStatus || data.subscription_status || "active",
        customer_membership_paid: Boolean(stripeSub),
        application_complete: Boolean(stripeSub),
        application_submitted: Boolean(stripeSub),
        submitted_at: stripeSub ? new Date().toISOString() : null,
        account_active: true,
        updated_at: new Date().toISOString(),
      };

      const { data: updatedCustomer, error } = await supabase
        .from("customers")
        .update(updatePayload)
        .eq("id", id)
        .select("*")
        .maybeSingle();

      if (error) throw error;

      const finalCustomer = buildCustomerSession(updatedCustomer || { ...customerRow, ...updatePayload });
      await upsertCustomerSubscriptionRow(finalCustomer);
      await saveCurrentCustomer(finalCustomer);

      if (customerReadyForMarketplace(finalCustomer)) {
        await markCustomerCompleteAndOpenMarketplace(id);
      } else {
        Alert.alert("Subscription Incomplete", "Customer was found, but a valid sub_ subscription was not returned.");
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
      updated_at: new Date().toISOString(),
    };

    await supabase.from("customers").update(pendingPayload).eq("id", id);

    const pendingCustomer = buildCustomerSession({
      ...localCustomer,
      ...pendingPayload,
      id,
      account_id: acct,
      email: cleanEmail,
      full_name: cleanFullName,
      name: cleanFullName,
      username: cleanUsername,
    });

    await upsertCustomerSubscriptionRow(pendingCustomer);
    await saveCurrentCustomer(pendingCustomer);

    if (!data.url) throw new Error("Stripe checkout URL was not returned.");

    await openCheckoutUrl(data.url);
  }

  async function createAccountAndSubscribe() {
    if (loading) return;
    if (!validateForm({ requirePassword: !customerId, requireSecurity: !customerId })) return;

    try {
      setLoading(true);

      const saved = await createOrUpdateCustomer({ startCheckout: false });

      if (!saved?.id) {
        throw new Error("Customer profile did not save.");
      }

      if (customerReadyForMarketplace(saved)) {
        await markCustomerCompleteAndOpenMarketplace(saved.id);
        return;
      }

      await startCustomerCheckout(saved, saved);
    } catch (error: any) {
      console.log("CUSTOMER REGISTER ERROR:", error);
      Alert.alert(
        "Registration Error",
        error?.message || "Unable to complete customer registration."
      );
    } finally {
      setLoading(false);
    }
  }

  function renderQuestionPicker(
    label: string,
    selectedQuestion: string,
    setSelectedQuestion: (value: string) => void,
    answer: string,
    setAnswer: (value: string) => void
  ) {
    return (
      <View style={styles.questionBox}>
        <Text style={styles.questionLabel}>{label}</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {SECURITY_QUESTIONS.map((question) => {
            const active = selectedQuestion === question;
            const usedByOther =
              question !== selectedQuestion &&
              [securityQuestion1, securityQuestion2, securityQuestion3].includes(question);

            return (
              <TouchableOpacity
                key={question}
                style={[
                  styles.questionChip,
                  active && styles.questionChipActive,
                  usedByOther && styles.questionChipDisabled,
                ]}
                activeOpacity={0.85}
                disabled={usedByOther}
                onPress={() => setSelectedQuestion(question)}
              >
                <Text
                  style={[
                    styles.questionChipText,
                    active && styles.questionChipTextActive,
                    usedByOther && styles.questionChipTextDisabled,
                  ]}
                >
                  {question}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <TextInput
          style={styles.input}
          value={answer}
          onChangeText={setAnswer}
          placeholder="Hidden answer"
          placeholderTextColor="#94A3B8"
          secureTextEntry
        />
      </View>
    );
  }

  function SectionTitle({
    title,
    icon,
    subtitle,
  }: {
    title: string;
    icon: keyof typeof Ionicons.glyphMap;
    subtitle?: string;
  }) {
    return (
      <View style={styles.sectionTitleRow}>
        <View style={styles.sectionIcon}>
          <Ionicons name={icon} size={20} color="#FFFFFF" />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {!!subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />

      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.push("/")}>
              <Ionicons name="arrow-back-outline" size={18} color="#FFFFFF" />
              <Text style={styles.backText}>Back Home</Text>
            </TouchableOpacity>

            <View style={styles.heroIcon}>
              <Ionicons name="basket-outline" size={34} color="#FFFFFF" />
            </View>

            <Text style={styles.kicker}>Farm2Home Marketplace</Text>
            <Text style={styles.title}>Create Customer Account</Text>

            <Text style={styles.subtitle}>
              Shop fresh produce, local farm products, and delivery options from nearby Farm2Home farmers.
            </Text>
          </View>

          <View style={styles.noticeBox}>
            <View style={styles.noticeHeader}>
              <Ionicons name="shield-checkmark-outline" size={22} color={COLORS.red} />
              <Text style={styles.noticeTitle}>
                {processingReturn ? "Completing Customer Registration" : "Permanent Customer Profile"}
              </Text>
            </View>

            <Text style={styles.noticeText}>
              {processingReturn
                ? "Please wait while Stripe syncs, your account is completed, and the marketplace opens."
                : "This screen saves customers, profiles, and customer_subscriptions. Customer Stripe IDs must be cus_ and sub_, never acct_."}
            </Text>
          </View>

          <View style={styles.progressCard}>
            <View style={styles.progressTop}>
              <Text style={styles.progressTitle}>Setup Progress</Text>
              <Text style={styles.progressScore}>{setupScore}/4</Text>
            </View>

            {setupStatus.map((item) => (
              <View key={item.label} style={styles.statusRow}>
                <View style={[styles.statusIcon, item.complete ? styles.statusGood : styles.statusMissing]}>
                  <Ionicons
                    name={item.complete ? "checkmark-outline" : "ellipse-outline"}
                    size={15}
                    color={item.complete ? COLORS.white : COLORS.muted}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.statusLabel}>{item.label}</Text>
                  <Text style={styles.statusValue}>{item.value}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={styles.priceCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.priceTitle}>Customer Membership</Text>
              <Text style={styles.priceText}>
                $4.99 monthly marketplace access for Farm2Home shopping and ordering.
              </Text>
            </View>

            <View style={styles.priceBadge}>
              <Text style={styles.priceAmount}>$4.99</Text>
            </View>
          </View>

          <View style={styles.card}>
            <SectionTitle
              title="Customer Information"
              icon="person-outline"
              subtitle="Your shopping account and contact details."
            />

            <TextInput
              style={styles.input}
              placeholder="Full Name"
              placeholderTextColor="#94A3B8"
              value={fullName}
              onChangeText={setFullName}
            />
            <TextInput
              style={styles.input}
              placeholder="Email Address"
              placeholderTextColor="#94A3B8"
              value={email}
              onChangeText={(value) => setEmail(normalize(value))}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TextInput
              style={styles.input}
              placeholder="Phone Number"
              placeholderTextColor="#94A3B8"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.card}>
            <SectionTitle
              title="Create Customer Login"
              icon="lock-closed-outline"
              subtitle={
                customerId
                  ? "Customer profile exists. Password is managed by Supabase Auth."
                  : "Create credentials for customer marketplace access."
              }
            />

            <TextInput
              style={styles.input}
              placeholder="Create Username"
              placeholderTextColor="#94A3B8"
              value={username}
              onChangeText={(value) => setUsername(normalize(value))}
              autoCapitalize="none"
              autoCorrect={false}
            />

            {!customerId ? (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Create Password"
                  placeholderTextColor="#94A3B8"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Confirm Password"
                  placeholderTextColor="#94A3B8"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </>
            ) : (
              <View style={styles.savedBanner}>
                <Ionicons name="checkmark-circle-outline" size={18} color={COLORS.green} />
                <Text style={styles.savedBannerText}>Existing customer account loaded.</Text>
              </View>
            )}
          </View>

          {!customerId ? (
            <View style={styles.card}>
              <SectionTitle
                title="Security Questions"
                icon="help-circle-outline"
                subtitle="Choose 3 different questions for account recovery."
              />

              {renderQuestionPicker(
                "Security Question 1",
                securityQuestion1,
                setSecurityQuestion1,
                securityAnswer1,
                setSecurityAnswer1
              )}
              {renderQuestionPicker(
                "Security Question 2",
                securityQuestion2,
                setSecurityQuestion2,
                securityAnswer2,
                setSecurityAnswer2
              )}
              {renderQuestionPicker(
                "Security Question 3",
                securityQuestion3,
                setSecurityQuestion3,
                securityAnswer3,
                setSecurityAnswer3
              )}
            </View>
          ) : null}

          <TouchableOpacity
            onPress={saveCustomerProfileOnly}
            disabled={savingOnly || loading || processingReturn}
            style={[styles.secondaryButton, (savingOnly || loading || processingReturn) && styles.disabledButton]}
            activeOpacity={0.85}
          >
            {savingOnly ? (
              <ActivityIndicator color={COLORS.red} />
            ) : (
              <>
                <Ionicons name="save-outline" size={20} color={COLORS.red} />
                <Text style={styles.secondaryButtonText}>Save Customer Profile</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => retrieveMissingStripeInfo(true)}
            disabled={syncingStripe || loading || processingReturn}
            style={[styles.secondaryButton, (syncingStripe || loading || processingReturn) && styles.disabledButton]}
            activeOpacity={0.85}
          >
            {syncingStripe ? (
              <ActivityIndicator color={COLORS.red} />
            ) : (
              <>
                <Ionicons name="sync-outline" size={20} color={COLORS.red} />
                <Text style={styles.secondaryButtonText}>Retrieve Missing Stripe Info</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={createAccountAndSubscribe}
            disabled={loading || processingReturn}
            style={[styles.createButton, (loading || processingReturn) && styles.disabledButton]}
            activeOpacity={0.85}
          >
            {loading || processingReturn ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="card-outline" size={20} color="#FFFFFF" />
                <Text style={styles.createButtonText}>Create Account + Subscribe</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              if (customerReadyForMarketplace({ id: customerId, account_id: accountId, stripe_customer_id: stripeCustomerId, subscription_id: stripeSubscriptionId })) {
                router.replace("/customer/marketplace" as any);
              } else {
                Alert.alert("Membership Required", "A valid cus_ customer and sub_ subscription are required before opening Marketplace.");
              }
            }}
            style={styles.marketplaceButton}
            activeOpacity={0.85}
          >
            <Ionicons name="storefront-outline" size={20} color={COLORS.black} />
            <Text style={styles.marketplaceButtonText}>Open Marketplace</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/customer/login" as any)}
            style={styles.loginLink}
          >
            <Text style={styles.loginLinkText}>Already have an account? Login</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  keyboard: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingBottom: 90 },
  hero: {
    backgroundColor: COLORS.black,
    paddingTop: 22,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  backButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.red,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginBottom: 18,
  },
  backText: { color: "#FFFFFF", fontWeight: "900" },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 24,
    backgroundColor: COLORS.red,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  kicker: {
    color: "#FCA5A5",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "900",
    color: "#FFFFFF",
    marginTop: 6,
  },
  subtitle: {
    color: "#CBD5E1",
    lineHeight: 22,
    fontWeight: "700",
    fontSize: 15,
    marginTop: 8,
  },
  noticeBox: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    marginHorizontal: 18,
    marginTop: 18,
    marginBottom: 14,
  },
  noticeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 7,
  },
  noticeTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 17,
  },
  noticeText: {
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 22,
  },
  progressCard: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    marginHorizontal: 18,
    marginBottom: 14,
  },
  progressTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  progressTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 18,
  },
  progressScore: {
    color: COLORS.red,
    fontWeight: "900",
    fontSize: 24,
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
    marginBottom: 8,
  },
  statusIcon: {
    width: 30,
    height: 30,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  statusGood: {
    backgroundColor: COLORS.green,
  },
  statusMissing: {
    backgroundColor: "#E5E7EB",
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
  priceCard: {
    backgroundColor: COLORS.red,
    borderRadius: 22,
    padding: 18,
    marginHorizontal: 18,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  priceTitle: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 20,
  },
  priceText: {
    color: "#FFE4E6",
    fontWeight: "700",
    marginTop: 4,
    lineHeight: 20,
  },
  priceBadge: {
    backgroundColor: COLORS.black,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
  },
  priceAmount: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 22,
  },
  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 22,
    padding: 18,
    marginHorizontal: 18,
    marginBottom: 16,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
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
    fontSize: 20,
    fontWeight: "900",
  },
  sectionSubtitle: {
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 3,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 15,
    padding: 14,
    marginBottom: 12,
    color: COLORS.text,
    fontWeight: "700",
  },
  questionBox: { marginBottom: 12 },
  questionLabel: {
    color: COLORS.text,
    fontWeight: "900",
    marginBottom: 8,
  },
  questionChip: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    marginRight: 8,
    marginBottom: 10,
    maxWidth: 280,
  },
  questionChipActive: {
    backgroundColor: COLORS.red,
    borderColor: COLORS.red,
  },
  questionChipDisabled: {
    opacity: 0.45,
  },
  questionChipText: {
    color: COLORS.red,
    fontWeight: "900",
  },
  questionChipTextActive: {
    color: "#FFFFFF",
  },
  questionChipTextDisabled: {
    color: COLORS.muted,
  },
  savedBanner: {
    backgroundColor: COLORS.greenSoft,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    borderRadius: 15,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  savedBannerText: {
    color: "#166534",
    fontWeight: "900",
  },
  createButton: {
    backgroundColor: COLORS.red,
    padding: 18,
    borderRadius: 18,
    marginHorizontal: 18,
    marginTop: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  createButtonText: {
    color: "#FFFFFF",
    textAlign: "center",
    fontWeight: "900",
    fontSize: 16,
  },
  secondaryButton: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    padding: 16,
    borderRadius: 18,
    marginHorizontal: 18,
    marginTop: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  secondaryButtonText: {
    color: COLORS.red,
    textAlign: "center",
    fontWeight: "900",
    fontSize: 15,
  },
  marketplaceButton: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    borderRadius: 18,
    marginHorizontal: 18,
    marginTop: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  marketplaceButtonText: {
    color: COLORS.black,
    textAlign: "center",
    fontWeight: "900",
    fontSize: 15,
  },
  disabledButton: { opacity: 0.6 },
  loginLink: {
    marginTop: 16,
    padding: 10,
  },
  loginLinkText: {
    textAlign: "center",
    color: COLORS.red,
    fontWeight: "900",
  },
});
