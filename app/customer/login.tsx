// app/customer/login.tsx

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
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
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { API_BASE_URL } from "../config/api";
import { supabase } from "../data/supabaseClient";

/**
 * app/customer/login.tsx
 *
 * Fully corrected customer login with updated UI and dashboard access checklist.
 *
 * Customer access requires:
 * 1. customers.id
 * 2. customers.account_id
 * 3. customers.stripe_customer_id = cus_...
 * 4. customers.subscription_id or customers.stripe_subscription_id = sub_...
 *
 * Customer Stripe rules:
 * - cus_ is Stripe Customer
 * - sub_ is Stripe Subscription
 * - acct_ is Stripe Connect and must NEVER count as a customer subscription/customer ID
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
  greenDark: "#14532D",
  greenSoft: "#DCFCE7",
  amber: "#F59E0B",
  amberSoft: "#FEF3C7",
  white: "#FFFFFF",
};

type CustomerRecord = {
  id: string;
  customer_id?: string;
  auth_user_id?: string;
  profile_id?: string;
  account_id?: string;
  role?: string;

  full_name?: string;
  name?: string;
  email?: string;
  phone?: string;
  username?: string;

  account_active?: boolean;
  customer_membership_paid?: boolean;
  subscription_status?: string;
  membership_status?: string;
  application_complete?: boolean;
  application_submitted?: boolean;

  stripe_id?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  subscription_id?: string | null;
  stripe_checkout_session_id?: string | null;

  created_at?: string;
  updated_at?: string;
};

function clean(value: any) {
  return String(value ?? "").trim();
}

function normalize(value: any) {
  return clean(value).toLowerCase();
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

function statusIsBlocked(value: any) {
  const status = normalize(value);
  return ["canceled", "cancelled", "unpaid", "inactive", "disabled", "rejected"].includes(status);
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

  const fullName = clean(row?.full_name || row?.fullName || row?.name || "Customer");
  const subscriptionStatus = clean(
    row?.subscription_status ||
      row?.subscriptionStatus ||
      (stripeSubscriptionId ? "active" : "pending_payment")
  );

  const membershipStatus = clean(
    row?.membership_status ||
      row?.membershipStatus ||
      (stripeSubscriptionId ? "active" : "pending_payment")
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

    fullName,
    full_name: fullName,
    name: clean(row?.name || fullName),
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

    subscriptionStatus,
    subscription_status: subscriptionStatus,
    membershipStatus,
    membership_status: membershipStatus,

    accountActive: row?.account_active !== false,
    account_active: row?.account_active !== false,

    customerMembershipPaid: Boolean(row?.customer_membership_paid || stripeSubscriptionId),
    customer_membership_paid: Boolean(row?.customer_membership_paid || stripeSubscriptionId),

    applicationComplete: Boolean(row?.application_complete || stripeSubscriptionId),
    application_complete: Boolean(row?.application_complete || stripeSubscriptionId),

    applicationSubmitted: Boolean(row?.application_submitted || stripeSubscriptionId),
    application_submitted: Boolean(row?.application_submitted || stripeSubscriptionId),

    createdAt: row?.created_at || "",
    created_at: row?.created_at || "",
    updatedAt: row?.updated_at || new Date().toISOString(),
    updated_at: row?.updated_at || new Date().toISOString(),
  };
}

function customerHasMarketplaceAccess(row: any) {
  const customer = buildCustomerSession(row);

  return Boolean(
    customer.id &&
      customer.account_id &&
      isStripeCustomerId(customer.stripe_customer_id) &&
      isStripeSubscriptionId(customer.subscription_id) &&
      customer.account_active !== false &&
      !statusIsBlocked(customer.membership_status) &&
      !statusIsBlocked(customer.subscription_status)
  );
}

function missingAccessItems(row: any) {
  const customer = row ? buildCustomerSession(row) : null;

  if (!customer) {
    return ["Customer Profile", "Static Account ID", "Stripe Customer ID", "Subscription ID"];
  }

  return [
    !customer.id ? "Customer Profile" : "",
    !customer.account_id ? "Static Account ID" : "",
    !isStripeCustomerId(customer.stripe_customer_id) ? "Stripe Customer ID" : "",
    !isStripeSubscriptionId(customer.subscription_id) ? "Subscription ID" : "",
  ].filter(Boolean);
}

async function parseApiResponse(response: Response) {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { success: false, error: text || "Invalid backend response." };
  }
}

export default function CustomerLoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [syncingStripe, setSyncingStripe] = useState(false);
  const [resetVisible, setResetVisible] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [lastCheckedCustomer, setLastCheckedCustomer] = useState<any>(null);
  const [openingMarketplace, setOpeningMarketplace] = useState(false);

  const previewTimerRef = useRef<any>(null);
  const routingLockedRef = useRef(false);

  const accessStatus = useMemo(() => {
    if (!lastCheckedCustomer) {
      return [
        { label: "Customer Profile", complete: false, value: "Login to check" },
        { label: "Static Account", complete: false, value: "Login to check" },
        { label: "Stripe Customer", complete: false, value: "Login to check" },
        { label: "Subscription", complete: false, value: "Login to check" },
      ];
    }

    const customer = buildCustomerSession(lastCheckedCustomer);

    return [
      {
        label: "Customer Profile",
        complete: Boolean(customer.id),
        value: customer.id ? "Found" : "Missing",
      },
      {
        label: "Static Account",
        complete: Boolean(customer.account_id),
        value: customer.account_id || "Missing",
      },
      {
        label: "Stripe Customer",
        complete: isStripeCustomerId(customer.stripe_customer_id),
        value: maskId(customer.stripe_customer_id),
      },
      {
        label: "Subscription",
        complete: isStripeSubscriptionId(customer.subscription_id),
        value: maskId(customer.subscription_id),
      },
    ];
  }, [lastCheckedCustomer]);

  async function saveCurrentCustomer(customer: any) {
    const mapped = buildCustomerSession(customer);

    await AsyncStorage.multiSet([
      ["pendingCustomer", JSON.stringify(mapped)],
      ["currentCustomer", JSON.stringify(mapped)],
      ["currentUser", JSON.stringify(mapped)],
      ["farm2homeCurrentCustomer", JSON.stringify(mapped)],
      ["userRole", "customer"],
      ["currentUserRole", "customer"],
      ["lastLoginRole", "customer"],
      ["lastCustomerDashboardReady", customerHasMarketplaceAccess(mapped) ? "true" : "false"],
    ]);

    return mapped;
  }

  async function findCustomerByIdOrEmail(userId?: string, cleanEmail?: string) {
    const id = clean(userId);
    const mail = normalize(cleanEmail);

    if (id) {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .or(`id.eq.${id},auth_user_id.eq.${id},profile_id.eq.${id}`)
        .limit(1);

      if (!error && Array.isArray(data) && data[0]) return data[0];
      if (error) console.log("customers id lookup error:", error.message);
    }

    if (mail) {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("email", mail)
        .limit(1);

      if (!error && Array.isArray(data) && data[0]) return data[0];
      if (error) console.log("customers email lookup error:", error.message);
    }

    return null;
  }

  async function findProfileByIdOrEmail(userId?: string, cleanEmail?: string) {
    const id = clean(userId);
    const mail = normalize(cleanEmail);

    if (id) {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .or(`id.eq.${id},auth_user_id.eq.${id}`)
        .eq("role", "customer")
        .limit(1);

      if (!error && Array.isArray(data) && data[0]) return data[0];
      if (error) console.log("profiles id lookup error:", error.message);
    }

    if (mail) {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("email", mail)
        .eq("role", "customer")
        .limit(1);

      if (!error && Array.isArray(data) && data[0]) return data[0];
      if (error) console.log("profiles email lookup error:", error.message);
    }

    return null;
  }

  async function findCustomerSubscription(userId?: string, cleanEmail?: string) {
    const id = clean(userId);
    const mail = normalize(cleanEmail);

    const filters = [
      id ? `customer_id.eq.${id}` : "",
      mail ? `customer_email.eq.${mail}` : "",
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
        console.log("customer_subscriptions lookup error:", error.message);
        return null;
      }

      if (!Array.isArray(data) || data.length === 0) return null;

      const cleaned = data.map((row) => ({
        ...row,
        stripe_customer_id: isStripeConnectAccountId(row?.stripe_customer_id)
          ? ""
          : row?.stripe_customer_id,
      }));

      const complete = cleaned.find(
        (row) =>
          isStripeCustomerId(row?.stripe_customer_id) &&
          isStripeSubscriptionId(row?.stripe_subscription_id)
      );

      return complete || cleaned[0];
    } catch (error) {
      console.log("customer_subscriptions lookup skipped:", error);
      return null;
    }
  }

  function mergeCustomerProfileSubscription(customer: any, profile: any, subscription: any) {
    const base = {
      ...(profile || {}),
      ...(customer || {}),
      id: clean(customer?.id || subscription?.customer_id || profile?.auth_user_id || profile?.id),
      auth_user_id: clean(customer?.auth_user_id || profile?.auth_user_id || profile?.id),
      profile_id: clean(customer?.profile_id || profile?.id || customer?.id),
      role: "customer",
      account_id: clean(customer?.account_id || profile?.account_id || ""),
      full_name: clean(customer?.full_name || customer?.name || profile?.full_name || subscription?.name || "Customer"),
      name: clean(customer?.name || customer?.full_name || profile?.full_name || subscription?.name || "Customer"),
      email: normalize(customer?.email || profile?.email || subscription?.customer_email),
      phone: clean(customer?.phone || profile?.phone),
      username: normalize(customer?.username || subscription?.username),
      stripe_customer_id: pickStripeCustomerId(
        customer?.stripe_customer_id,
        customer?.stripe_id,
        subscription?.stripe_customer_id
      ),
      stripe_id: pickStripeCustomerId(
        customer?.stripe_customer_id,
        customer?.stripe_id,
        subscription?.stripe_customer_id
      ),
      stripe_subscription_id: pickStripeSubscriptionId(
        customer?.stripe_subscription_id,
        customer?.subscription_id,
        subscription?.stripe_subscription_id
      ),
      subscription_id: pickStripeSubscriptionId(
        customer?.stripe_subscription_id,
        customer?.subscription_id,
        subscription?.stripe_subscription_id
      ),
      subscription_status: clean(
        customer?.subscription_status ||
          subscription?.subscription_status ||
          (subscription?.stripe_subscription_id ? "active" : "pending_payment")
      ),
      membership_status: clean(
        customer?.membership_status ||
          (subscription?.stripe_subscription_id ? "active" : "pending_payment")
      ),
      account_active: customer?.account_active !== false,
      customer_membership_paid: Boolean(
        customer?.customer_membership_paid ||
          customer?.subscription_id ||
          customer?.stripe_subscription_id ||
          subscription?.stripe_subscription_id
      ),
    };

    return buildCustomerSession(base);
  }

  async function cleanBadAcctCustomerSubscription(id?: string, mail?: string) {
    const filters = [
      id ? `customer_id.eq.${id}` : "",
      mail ? `customer_email.eq.${normalize(mail)}` : "",
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

      if (error) console.log("clean bad customer subscription skipped:", error.message);
    } catch (error) {
      console.log("clean bad customer subscription exception:", error);
    }
  }

  async function upsertCustomerSubscriptionRow(customer: any) {
    const mapped = buildCustomerSession(customer);
    const id = mapped.id;
    const mail = mapped.email;

    if (!id && !mail) return;

    await cleanBadAcctCustomerSubscription(id, mail);

    const payload = {
      customer_id: id,
      customer_email: mail,
      name: mapped.full_name,
      username: mapped.username,
      stripe_customer_id: isStripeCustomerId(mapped.stripe_customer_id)
        ? mapped.stripe_customer_id
        : null,
      stripe_subscription_id: isStripeSubscriptionId(mapped.subscription_id)
        ? mapped.subscription_id
        : null,
      subscription_status:
        mapped.subscription_status ||
        (isStripeSubscriptionId(mapped.subscription_id) ? "active" : "pending_payment"),
      current_period_end: null,
      updated_at: new Date().toISOString(),
    };

    try {
      const { data: existing, error: lookupError } = await supabase
        .from("customer_subscriptions")
        .select("id")
        .or(`customer_id.eq.${id},customer_email.eq.${mail}`)
        .limit(1);

      if (lookupError) {
        console.log("customer_subscriptions upsert lookup skipped:", lookupError.message);
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
        .insert({ ...payload, created_at: new Date().toISOString() });

      if (error) console.log("customer_subscriptions insert skipped:", error.message);
    } catch (error) {
      console.log("customer_subscriptions upsert skipped:", error);
    }
  }

  async function syncStripeByEmail(customer: any, showAlert = false) {
    const mapped = buildCustomerSession(customer);

    if (!mapped.email && !mapped.id) return mapped;

    try {
      setSyncingStripe(true);

      const response = await fetch(`${API_BASE_URL}/payments/sync-stripe-by-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "customer",
          email: mapped.email,
          name: mapped.full_name || mapped.name,
          username: mapped.username,
          userId: mapped.id,
          customerId: mapped.id,
          customer_id: mapped.id,
        }),
      });

      const json = await parseApiResponse(response);

      if (!response.ok || !json.success) {
        if (showAlert) {
          Alert.alert("Stripe Sync", json.error || "No customer subscription found in Stripe yet.");
        }
        return mapped;
      }

      const stripeCustomerId = pickStripeCustomerId(
        json.stripeCustomerId,
        json.stripe_customer_id
      );

      const stripeSubscriptionId = pickStripeSubscriptionId(
        json.stripeSubscriptionId,
        json.stripe_subscription_id
      );

      const updatePayload = {
        stripe_id: stripeCustomerId || null,
        stripe_customer_id: stripeCustomerId || null,
        stripe_subscription_id: stripeSubscriptionId || null,
        subscription_id: stripeSubscriptionId || null,
        subscription_status:
          json.subscriptionStatus ||
          json.subscription_status ||
          (stripeSubscriptionId ? "active" : "pending_payment"),
        membership_status: stripeSubscriptionId ? "active" : "pending_payment",
        customer_membership_paid: Boolean(stripeSubscriptionId),
        account_active: true,
        application_complete: Boolean(stripeSubscriptionId),
        application_submitted: Boolean(stripeSubscriptionId),
        submitted_at: stripeSubscriptionId ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("customers")
        .update(updatePayload)
        .eq("id", mapped.id)
        .select("*")
        .maybeSingle();

      if (error) {
        console.log("customers stripe sync update error:", error.message);
        return mapped;
      }

      const finalCustomer = buildCustomerSession(data || { ...mapped, ...updatePayload });
      await upsertCustomerSubscriptionRow(finalCustomer);
      await saveCurrentCustomer(finalCustomer);
      setLastCheckedCustomer(finalCustomer);

      if (showAlert) Alert.alert("Stripe Synced", "Customer Stripe subscription was synced.");

      return finalCustomer;
    } catch (error: any) {
      if (showAlert) Alert.alert("Sync Error", error?.message || "Unable to sync Stripe.");
      return mapped;
    } finally {
      setSyncingStripe(false);
    }
  }

  async function ensureCustomerRowFromProfile(userId: string, cleanEmail: string, profile: any) {
    if (!profile?.id && !userId) return null;

    const id = clean(userId || profile?.auth_user_id || profile?.id);
    const now = new Date().toISOString();

    const payload = {
      id,
      customer_id: id,
      auth_user_id: id,
      profile_id: clean(profile?.id || id),
      role: "customer",
      account_id: clean(profile?.account_id || `Customer_${Date.now().toString().slice(-6)}`),
      full_name: clean(profile?.full_name || "Customer"),
      name: clean(profile?.full_name || "Customer"),
      email: normalize(profile?.email || cleanEmail),
      phone: clean(profile?.phone),
      username: normalize(profile?.username || ""),
      account_active: true,
      customer_membership_paid: false,
      subscription_status: "pending_payment",
      membership_status: "pending_payment",
      application_complete: false,
      application_submitted: false,
      notifications_enabled: true,
      expo_push_token: "",
      created_at: now,
      updated_at: now,
    };

    const { data, error } = await supabase
      .from("customers")
      .upsert(payload, { onConflict: "id" })
      .select("*")
      .maybeSingle();

    if (error) {
      console.log("ensure customer from profile failed:", error.message);
      return null;
    }

    return data;
  }

  async function findAndSyncCustomerProfile(userId: string, cleanEmail: string, showStripeAlert = false) {
    const customer = await findCustomerByIdOrEmail(userId, cleanEmail);
    const profile = await findProfileByIdOrEmail(userId, cleanEmail);
    const subscription = await findCustomerSubscription(customer?.id || userId, customer?.email || cleanEmail);

    let finalCustomer = customer;

    if (!finalCustomer && profile) {
      finalCustomer = await ensureCustomerRowFromProfile(userId, cleanEmail, profile);
    }

    if (!finalCustomer && !profile && !subscription) return null;

    const merged = mergeCustomerProfileSubscription(finalCustomer || {}, profile || {}, subscription || {});
    setLastCheckedCustomer(merged);

    let synced = merged;

    if (!customerHasMarketplaceAccess(merged)) {
      synced = await syncStripeByEmail(merged, showStripeAlert);
    } else {
      await upsertCustomerSubscriptionRow(merged);
      await saveCurrentCustomer(merged);
    }

    setLastCheckedCustomer(synced);
    return synced;
  }

  async function previewCustomerByEmail(inputEmail: string) {
    const mail = normalize(inputEmail);
    if (!mail || !mail.includes("@")) {
      setLastCheckedCustomer(null);
      return;
    }

    try {
      const customer = await findCustomerByIdOrEmail("", mail);
      const profile = await findProfileByIdOrEmail("", mail);
      const subscription = await findCustomerSubscription(customer?.id || "", customer?.email || mail);

      if (customer || profile || subscription) {
        const merged = mergeCustomerProfileSubscription(customer || {}, profile || {}, subscription || {});
        setLastCheckedCustomer(merged);
      }
    } catch (error) {
      console.log("customer preview skipped:", error);
    }
  }

  useEffect(() => {
    const mail = normalize(email);

    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);

    if (!mail || !mail.includes("@")) {
      setLastCheckedCustomer(null);
      return;
    }

    previewTimerRef.current = setTimeout(() => {
      previewCustomerByEmail(mail);
    }, 650);

    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    };
  }, [email]);

  async function openMarketplace(customer: any) {
    if (routingLockedRef.current) return;

    routingLockedRef.current = true;
    setOpeningMarketplace(true);

    const mapped = await saveCurrentCustomer(customer);

    setTimeout(() => {
      router.replace("/customer/marketplace" as any);
    }, 120);

    return mapped;
  }

  async function loginCustomer() {
    const cleanEmail = normalize(email);
    const cleanPassword = clean(password);

    if (!cleanEmail || !cleanPassword) {
      Alert.alert("Missing Login", "Please enter your email and password.");
      return;
    }

    try {
      setLoading(true);
      routingLockedRef.current = false;

      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword,
      });

      if (error) {
        Alert.alert("Login Failed", error.message);
        return;
      }

      const userId = clean(data?.user?.id);

      if (!userId) {
        Alert.alert("Login Error", "Unable to confirm customer account.");
        return;
      }

      const customer = await findAndSyncCustomerProfile(userId, cleanEmail, false);

      if (!customer) {
        Alert.alert(
          "Customer Profile Missing",
          "Your login is valid, but no customer profile was found. Complete customer registration."
        );
        router.replace({
          pathname: "/customer/register" as any,
          params: { customerId: userId, email: cleanEmail },
        });
        return;
      }

      const mappedCustomer = await saveCurrentCustomer(customer);
      setLastCheckedCustomer(mappedCustomer);

      if (mappedCustomer.accountActive === false) {
        Alert.alert("Account Disabled", "This customer account is not active.");
        return;
      }

      if (statusIsBlocked(mappedCustomer.membershipStatus) || statusIsBlocked(mappedCustomer.subscriptionStatus)) {
        Alert.alert(
          "Membership Required",
          "Your customer membership is inactive. Please renew your membership."
        );
        router.replace({
          pathname: "/customer/register" as any,
          params: { customerId: mappedCustomer.id, email: mappedCustomer.email },
        });
        return;
      }

      if (!customerHasMarketplaceAccess(mappedCustomer)) {
        const missing = missingAccessItems(mappedCustomer);

        Alert.alert(
          "Membership Setup Missing",
          `Your account was found, but this setup is missing: ${missing.join(", ")}.`
        );
        router.replace({
          pathname: "/customer/register" as any,
          params: { customerId: mappedCustomer.id, email: mappedCustomer.email },
        });
        return;
      }

      await openMarketplace(mappedCustomer);
    } catch (error: any) {
      console.log("Customer login error:", error);
      Alert.alert("Login Error", error?.message || "Unable to login.");
    } finally {
      if (!routingLockedRef.current) setLoading(false);
    }
  }

  async function handleSyncStripeButton() {
    const cleanEmail = normalize(email);

    if (!cleanEmail) {
      Alert.alert("Email Required", "Enter your customer email first.");
      return;
    }

    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = clean(authData?.user?.id || lastCheckedCustomer?.id || "");
      const synced = await findAndSyncCustomerProfile(userId, cleanEmail, true);

      if (synced && customerHasMarketplaceAccess(synced)) {
        Alert.alert("Ready", "Customer membership is active. You can login to marketplace.");
      }
    } catch (error: any) {
      Alert.alert("Sync Error", error?.message || "Unable to sync Stripe.");
    }
  }

  async function handlePasswordReset() {
    const cleanEmail = normalize(resetEmail || email);

    if (!cleanEmail) {
      Alert.alert("Email Required", "Enter your customer email.");
      return;
    }

    try {
      setResetLoading(true);

      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: "farm2home://reset-password",
      });

      if (error) {
        Alert.alert("Reset Error", error.message);
        return;
      }

      Alert.alert(
        "Password Reset Sent",
        "Check your email for the secure password reset link."
      );

      setResetVisible(false);
      setResetEmail("");
    } catch (error: any) {
      Alert.alert(
        "Reset Error",
        error?.message || "Unable to send password reset email."
      );
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />

      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.page}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.push("/" as any)}
              activeOpacity={0.85}
            >
              <Ionicons name="arrow-back-outline" size={18} color={COLORS.white} />
              <Text style={styles.backText}>Back Home</Text>
            </TouchableOpacity>

            <View style={styles.heroIcon}>
              <Ionicons name="basket-outline" size={34} color={COLORS.white} />
            </View>

            <Text style={styles.kicker}>Farm2Home Marketplace</Text>
            <Text style={styles.title}>Customer Login</Text>

            <Text style={styles.subtitle}>
              Shop fresh produce, farm groceries, local goods, delivery tracking, and order updates.
            </Text>
          </View>

          <View style={styles.noticeBox}>
            <View style={styles.noticeHeader}>
              <Ionicons name="shield-checkmark-outline" size={22} color={COLORS.red} />
              <Text style={styles.noticeTitle}>Marketplace Access Check</Text>
            </View>
            <Text style={styles.noticeText}>
              Customer login verifies profile, static customer account, Stripe customer ID, and subscription ID before opening Marketplace.
            </Text>
          </View>

          <View style={styles.progressCard}>
            <View style={styles.progressTop}>
              <Text style={styles.progressTitle}>Login Checklist</Text>
              <Text style={styles.progressScore}>
                {accessStatus.filter((item) => item.complete).length}/4
              </Text>
            </View>

            {accessStatus.map((item) => (
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

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderIcon}>
                <Ionicons name="log-in-outline" size={22} color={COLORS.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>Welcome Back</Text>
                <Text style={styles.sectionSubtitle}>
                  Use the email and password created during customer registration.
                </Text>
              </View>
            </View>

            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.input}
              placeholder="customer@email.com"
              placeholderTextColor="#94A3B8"
              value={email}
              onChangeText={(value) => setEmail(normalize(value))}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter password"
              placeholderTextColor="#94A3B8"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TouchableOpacity
              style={[styles.loginButton, (loading || openingMarketplace) && styles.disabledButton]}
              onPress={loginCustomer}
              disabled={loading || openingMarketplace}
              activeOpacity={0.85}
            >
              {loading || openingMarketplace ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="storefront-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.loginButtonText}>Login to Marketplace</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryButton, syncingStripe && styles.disabledButton]}
              onPress={handleSyncStripeButton}
              disabled={syncingStripe}
              activeOpacity={0.85}
            >
              {syncingStripe ? (
                <ActivityIndicator color={COLORS.red} />
              ) : (
                <>
                  <Ionicons name="sync-outline" size={20} color={COLORS.red} />
                  <Text style={styles.secondaryText}>Retrieve Missing Stripe Info</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.marketButton}
              onPress={() => router.push("/customer/register" as any)}
              activeOpacity={0.85}
            >
              <Ionicons name="person-add-outline" size={20} color={COLORS.black} />
              <Text style={styles.marketButtonText}>Create Customer Account</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => {
                setResetEmail(email);
                setResetVisible(true);
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.linkText}>Forgot password?</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.infoCard}>
            <View style={styles.infoIcon}>
              <Ionicons name="leaf-outline" size={20} color="#92400E" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoTitle}>Fresh from local farms</Text>
              <Text style={styles.infoText}>
                Browse produce, groceries, farm goods, delivery options, and order updates from your Farm2Home customer account.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={resetVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <View style={styles.modalIcon}>
                <Ionicons name="key-outline" size={28} color={COLORS.red} />
              </View>

              <Text style={styles.modalTitle}>Reset Password</Text>

              <Text style={styles.modalSubtitle}>
                Enter your customer email. Farm2Home will send a secure reset link if the Auth account exists.
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Customer Email"
                placeholderTextColor="#94A3B8"
                value={resetEmail}
                onChangeText={(value) => setResetEmail(normalize(value))}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
              />

              <TouchableOpacity
                style={[styles.loginButton, resetLoading && styles.disabledButton]}
                onPress={handlePasswordReset}
                disabled={resetLoading}
                activeOpacity={0.85}
              >
                {resetLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.loginButtonText}>Send Reset Link</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setResetVisible(false);
                  setResetEmail("");
                }}
              >
                <Text style={styles.closeText}>Close</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  keyboard: { flex: 1, backgroundColor: COLORS.bg },
  page: { flex: 1, backgroundColor: COLORS.bg },
  content: {
    flexGrow: 1,
    paddingBottom: 70,
  },
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
  backText: { color: COLORS.white, fontWeight: "900" },
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
    color: COLORS.white,
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
  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 26,
    padding: 20,
    marginHorizontal: 18,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
  },
  cardHeaderIcon: {
    width: 46,
    height: 46,
    borderRadius: 18,
    backgroundColor: COLORS.red,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: "900",
  },
  sectionSubtitle: {
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 21,
    marginTop: 4,
  },
  label: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 13,
    marginBottom: 7,
    marginTop: 6,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 17,
    padding: 15,
    marginBottom: 12,
    color: COLORS.text,
    fontWeight: "800",
  },
  loginButton: {
    backgroundColor: COLORS.red,
    padding: 17,
    borderRadius: 18,
    marginTop: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  disabledButton: { opacity: 0.6 },
  loginButtonText: {
    color: COLORS.white,
    textAlign: "center",
    fontWeight: "900",
    fontSize: 16,
  },
  secondaryButton: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    borderRadius: 18,
    padding: 15,
    marginTop: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  secondaryText: {
    color: COLORS.red,
    fontWeight: "900",
    fontSize: 15,
  },
  marketButton: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 15,
    marginTop: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  marketButtonText: {
    color: COLORS.black,
    fontWeight: "900",
    fontSize: 15,
  },
  linkButton: { marginTop: 16 },
  linkText: {
    textAlign: "center",
    color: COLORS.red,
    fontWeight: "900",
  },
  infoCard: {
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 22,
    padding: 16,
    marginHorizontal: 18,
    marginBottom: 16,
    flexDirection: "row",
    gap: 12,
  },
  infoIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
  },
  infoTitle: {
    color: "#92400E",
    fontWeight: "900",
    marginBottom: 6,
  },
  infoText: {
    color: "#78350F",
    fontWeight: "700",
    lineHeight: 21,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: 22,
  },
  modalCard: {
    backgroundColor: COLORS.white,
    borderRadius: 26,
    padding: 22,
    maxHeight: "90%",
  },
  modalIcon: {
    width: 56,
    height: 56,
    borderRadius: 20,
    backgroundColor: "#FEE2E2",
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 8,
  },
  modalSubtitle: {
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 18,
  },
  closeButton: {
    marginTop: 16,
    alignItems: "center",
  },
  closeText: {
    color: COLORS.red,
    fontWeight: "900",
  },
});
