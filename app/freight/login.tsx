// app/freight/login.tsx

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

import { supabase } from "../data/supabaseClient";

/**
 * IMPORTANT SCHEMA NOTE
 * This version matches your actual Supabase schema shown in screenshots:
 *
 * public.freight_users has:
 * - id text
 * - freight_id text
 * - auth_user_id uuid
 * - profile_id uuid
 * - role text
 * - email text
 * - account_id text
 * - company_name text
 * - business_name text
 * - name text
 * - full_name text
 * - username text
 * - stripe_customer_id text
 * - subscription_id text
 * - freight_account text
 * - account_active boolean
 * - approved boolean
 * - freight_membership_paid boolean
 * - membership_status text
 * - verification_status text
 * - compliance_status text
 * - admin_review_status text
 * - created_at timestamp
 * - updated_at timestamp
 *
 * public.profiles has:
 * - id uuid
 * - auth_user_id uuid
 * - role text
 * - full_name text
 * - email text
 * - phone text
 * - created_at timestamp
 * - account_id text
 * - freight_account text
 * - stripe_account_id text
 *
 * public.freight_subscriptions has:
 * - freight_id text
 * - freight_email text
 * - name text
 * - username text
 * - stripe_customer_id text
 * - stripe_subscription_id text
 * - subscription_status text
 * - stripe_account_id text
 * - freight_account text
 */

type FreightUser = {
  id: string;
  freight_id: string;
  auth_user_id: string;
  profile_id: string;
  role: "freight";

  email: string;
  account_id: string;

  company_name: string;
  business_name: string;
  name: string;
  full_name: string;
  username: string;
  phone: string;

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

  created_at?: string;
  updated_at?: string;

  // aliases used by other screens
  freightId?: string;
  accountId?: string;
  companyName?: string;
  businessName?: string;
  fullName?: string;
  stripeCustomerId?: string;
  subscriptionId?: string;
  freightAccount?: string;
  stripeAccountId?: string;
  accountActive?: boolean;
  membershipStatus?: string;
};

const COLORS = {
  bg: "#F7F7FB",
  card: "#FFFFFF",
  panel: "#F8FAFC",
  text: "#0F172A",
  muted: "#64748B",
  border: "#E5E7EB",
  borderDark: "#CBD5E1",
  primary: "#6D5DFB",
  primaryDark: "#4F46E5",
  primarySoft: "#EEF2FF",
  green: "#10B981",
  greenDark: "#047857",
  red: "#EF4444",
  navy: "#020617",
  white: "#FFFFFF",
};

const DASHBOARD_ROUTE = "/freight/dashboard" as const;
const REGISTER_ROUTE = "/freight/register" as const;
const RESET_REDIRECT = "farm2home://reset-password";

function clean(value: any) {
  return String(value ?? "").trim();
}

function normalize(value: any) {
  return clean(value).toLowerCase();
}

function isUuid(value: any) {
  const v = clean(value);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
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

function valueIsFalse(value: any) {
  if (value === false) return true;
  if (typeof value === "string") {
    return ["false", "0", "no", "inactive", "disabled"].includes(normalize(value));
  }
  return false;
}

function statusIsGood(value: any) {
  const status = normalize(value || "active");
  return !["canceled", "cancelled", "unpaid", "inactive", "disabled", "rejected"].includes(status);
}

function maskId(value: string, fallback = "Missing") {
  const id = clean(value);
  if (!id) return fallback;
  if (id.length <= 14) return id;
  return `${id.slice(0, 8)}...${id.slice(-5)}`;
}

function getSubscriptionId(row: any) {
  return pickSub(row?.subscription_id, row?.stripe_subscription_id, row?.stripeSubscriptionId, row?.subscriptionId);
}

function getConnectAccount(row: any) {
  return pickAcct(row?.freight_account, row?.stripe_account_id, row?.freightAccount, row?.stripeAccountId);
}

function getCustomerId(row: any) {
  return pickCus(row?.stripe_customer_id, row?.stripeCustomerId);
}

function buildFreightUser(row: any): FreightUser {
  const id = clean(row?.id || row?.freight_id);
  const freightId = clean(row?.freight_id || row?.id);
  const companyName = clean(row?.company_name || row?.business_name || row?.name || "Freight Carrier");
  const fullName = clean(row?.full_name || row?.name || companyName);
  const subscriptionId = getSubscriptionId(row);
  const connectAccount = getConnectAccount(row);
  const customerId = getCustomerId(row);
  const accountActive = row?.account_active !== false;

  return {
    id,
    freight_id: freightId,
    auth_user_id: clean(row?.auth_user_id),
    profile_id: clean(row?.profile_id),
    role: "freight",

    email: normalize(row?.email || row?.freight_email),
    account_id: clean(row?.account_id),

    company_name: companyName,
    business_name: clean(row?.business_name || companyName),
    name: clean(row?.name || fullName),
    full_name: fullName,
    username: clean(row?.username),
    phone: clean(row?.phone),

    stripe_customer_id: customerId,
    subscription_id: subscriptionId,
    freight_account: connectAccount,

    account_active: accountActive,
    approved: row?.approved !== false,
    freight_membership_paid: row?.freight_membership_paid !== false && Boolean(subscriptionId),
    membership_status: clean(row?.membership_status || row?.subscription_status || (subscriptionId ? "active" : "pending")),

    verification_status: clean(row?.verification_status || "SUBMITTED"),
    compliance_status: clean(row?.compliance_status || "SUBMITTED"),
    admin_review_status: clean(row?.admin_review_status || "submitted"),

    created_at: row?.created_at,
    updated_at: row?.updated_at,

    freightId,
    accountId: clean(row?.account_id),
    companyName,
    businessName: clean(row?.business_name || companyName),
    fullName,
    stripeCustomerId: customerId,
    subscriptionId,
    freightAccount: connectAccount,
    stripeAccountId: connectAccount,
    accountActive,
    membershipStatus: clean(row?.membership_status || row?.subscription_status || (subscriptionId ? "active" : "pending")),
  };
}

function hasDashboardAccess(user: FreightUser | null) {
  if (!user) return false;

  return Boolean(
    clean(user.id) &&
      clean(user.account_id) &&
      isCus(user.stripe_customer_id) &&
      isSub(user.subscription_id) &&
      isAcct(user.freight_account) &&
      !valueIsFalse(user.account_active) &&
      statusIsGood(user.membership_status || "active")
  );
}

function getMissingAccessItems(user: FreightUser | null) {
  if (!user) {
    return [
      "Freight Profile",
      "Static Account ID",
      "Stripe Customer ID",
      "Subscription ID",
      "Stripe Connect Account",
    ];
  }

  return [
    !clean(user.id) ? "Freight Profile" : "",
    !clean(user.account_id) ? "Static Account ID" : "",
    !isCus(user.stripe_customer_id) ? "Stripe Customer ID" : "",
    !isSub(user.subscription_id) ? "Subscription ID" : "",
    !isAcct(user.freight_account) ? "Stripe Connect Account" : "",
  ].filter(Boolean);
}

export default function FreightLoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loginLoading, setLoginLoading] = useState(false);
  const [resetVisible, setResetVisible] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [lastCheckedUser, setLastCheckedUser] = useState<FreightUser | null>(null);
  const [navigatingToDashboard, setNavigatingToDashboard] = useState(false);

  const routingLockedRef = useRef(false);
  const previewTimerRef = useRef<any>(null);

  const accessStatus = useMemo(() => {
    if (!lastCheckedUser) {
      return [
        { label: "Freight Profile", complete: false, value: "Login to check" },
        { label: "Static Account", complete: false, value: "Login to check" },
        { label: "Stripe Customer", complete: false, value: "Login to check" },
        { label: "Subscription", complete: false, value: "Login to check" },
        { label: "Stripe Connect", complete: false, value: "Login to check" },
      ];
    }

    return [
      {
        label: "Freight Profile",
        complete: Boolean(lastCheckedUser.id),
        value: lastCheckedUser.id ? "Found" : "Missing",
      },
      {
        label: "Static Account",
        complete: Boolean(lastCheckedUser.account_id),
        value: lastCheckedUser.account_id || "Missing",
      },
      {
        label: "Stripe Customer",
        complete: isCus(lastCheckedUser.stripe_customer_id),
        value: maskId(lastCheckedUser.stripe_customer_id),
      },
      {
        label: "Subscription",
        complete: isSub(lastCheckedUser.subscription_id),
        value: maskId(lastCheckedUser.subscription_id),
      },
      {
        label: "Stripe Connect",
        complete: isAcct(lastCheckedUser.freight_account),
        value: maskId(lastCheckedUser.freight_account),
      },
    ];
  }, [lastCheckedUser]);

  async function saveFreightSession(user: FreightUser) {
    const sessionUser = {
      ...user,
      role: "freight" as const,
      freightId: user.freight_id || user.id,
      accountId: user.account_id,
      stripeCustomerId: user.stripe_customer_id,
      subscriptionId: user.subscription_id,
      freightAccount: user.freight_account,
      stripeAccountId: user.freight_account,
      accountActive: user.account_active,
      membershipStatus: user.membership_status,
      updatedAt: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await AsyncStorage.multiSet([
      ["pendingFreightCarrier", JSON.stringify(sessionUser)],
      ["pendingFreightProfile", JSON.stringify(sessionUser)],
      ["currentFreight", JSON.stringify(sessionUser)],
      ["currentFreightCarrier", JSON.stringify(sessionUser)],
      ["currentFreightUser", JSON.stringify(sessionUser)],
      ["farm2homeCurrentFreight", JSON.stringify(sessionUser)],
      ["currentUser", JSON.stringify(sessionUser)],
      ["userRole", "freight"],
      ["currentUserRole", "freight"],
      ["lastLoginRole", "freight"],
      ["lastFreightDashboardReady", hasDashboardAccess(user) ? "true" : "false"],
    ]);

    return sessionUser;
  }

  async function findSubscription(userId: string, cleanEmail: string) {
    const filters = [
      userId ? `freight_id.eq.${userId}` : "",
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
      console.log("freight_subscriptions lookup failed:", error.message);
      return null;
    }

    if (!Array.isArray(data) || data.length === 0) return null;

    const complete = data.find(
      (row) =>
        isCus(row?.stripe_customer_id) &&
        isSub(row?.stripe_subscription_id) &&
        isAcct(row?.freight_account || row?.stripe_account_id)
    );

    return complete || data[0];
  }

  async function findProfileByEmail(cleanEmail: string) {
    if (!cleanEmail) return null;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (error) {
      console.log("profiles lookup by email failed:", error.message);
      return null;
    }

    return data || null;
  }

  async function findProfileByAuthId(authUserId: string) {
    if (!authUserId || !isUuid(authUserId)) return null;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .or(`id.eq.${authUserId},auth_user_id.eq.${authUserId}`)
      .maybeSingle();

    if (error) {
      console.log("profiles lookup by auth id failed:", error.message);
      return null;
    }

    return data || null;
  }

  async function findFreightUser(userId: string, cleanEmail: string) {
    if (userId) {
      const { data, error } = await supabase
        .from("freight_users")
        .select("*")
        .or(`id.eq.${userId},freight_id.eq.${userId}`)
        .maybeSingle();

      if (!error && data) return buildFreightUser(data);

      if (error) console.log("freight_users lookup by id failed:", error.message);
    }

    if (cleanEmail) {
      const { data, error } = await supabase
        .from("freight_users")
        .select("*")
        .eq("email", cleanEmail)
        .maybeSingle();

      if (!error && data) return buildFreightUser(data);

      if (error) console.log("freight_users lookup by email failed:", error.message);
    }

    return null;
  }

  async function syncSubscriptionConnectColumn(subscription: any) {
    const connectAccount = pickAcct(subscription?.freight_account, subscription?.stripe_account_id);

    if (!subscription?.id || !connectAccount) return subscription;

    const needsUpdate =
      subscription?.freight_account !== connectAccount || subscription?.stripe_account_id !== connectAccount;

    if (!needsUpdate) return subscription;

    const { data, error } = await supabase
      .from("freight_subscriptions")
      .update({
        freight_account: connectAccount,
        stripe_account_id: connectAccount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", subscription.id)
      .select("*")
      .maybeSingle();

    if (error) {
      console.log("freight_subscriptions connect sync failed:", error.message);
      return subscription;
    }

    return data || subscription;
  }

  async function ensureProfile(authUserId: string, cleanEmail: string, subscription: any, existingFreightUser?: FreightUser | null) {
    const connectAccount = pickAcct(subscription?.freight_account, subscription?.stripe_account_id, existingFreightUser?.freight_account);
    const profileByEmail = await findProfileByEmail(cleanEmail);
    const profileByAuth = profileByEmail ? null : await findProfileByAuthId(authUserId);
    const existingProfile = profileByEmail || profileByAuth;

    const profileFullName = clean(
      subscription?.name ||
        existingProfile?.full_name ||
        existingFreightUser?.full_name ||
        existingFreightUser?.company_name ||
        "Freight Carrier"
    );

    const profileAccountId = clean(existingProfile?.account_id || existingFreightUser?.account_id || "Freight_001");

    if (existingProfile?.id) {
      const { data, error } = await supabase
        .from("profiles")
        .update({
          auth_user_id: authUserId,
          role: "freight",
          full_name: profileFullName,
          account_id: profileAccountId,
          freight_account: connectAccount || existingProfile?.freight_account || null,
          stripe_account_id: connectAccount || existingProfile?.stripe_account_id || null,
        })
        .eq("id", existingProfile.id)
        .select("*")
        .maybeSingle();

      if (error) {
        console.log("profiles update failed:", error.message);
        Alert.alert("Profile Sync Failed", error.message);
        return existingProfile;
      }

      return data || existingProfile;
    }

    const { data, error } = await supabase
      .from("profiles")
      .insert({
        id: authUserId,
        auth_user_id: authUserId,
        role: "freight",
        full_name: profileFullName,
        email: cleanEmail,
        phone: "",
        account_id: profileAccountId,
        freight_account: connectAccount || null,
        stripe_account_id: connectAccount || null,
        created_at: new Date().toISOString(),
      })
      .select("*")
      .maybeSingle();

    if (error) {
      console.log("profiles insert failed:", error.message);
      Alert.alert("Profile Create Failed", error.message);
      return null;
    }

    return data;
  }

  async function syncFreightUser(authUserId: string, cleanEmail: string) {
    const existingFreightUser = await findFreightUser(authUserId, cleanEmail);
    let subscription = await findSubscription(authUserId, cleanEmail);

    if (!subscription && existingFreightUser) {
      const checked = buildFreightUser(existingFreightUser);
      setLastCheckedUser(checked);
      return checked;
    }

    if (!subscription) return existingFreightUser;

    subscription = await syncSubscriptionConnectColumn(subscription);

    const profile = await ensureProfile(authUserId, cleanEmail, subscription, existingFreightUser);

    const profileId = clean(profile?.id || existingFreightUser?.profile_id);
    const profileAuthUserId = clean(profile?.auth_user_id || authUserId);
    const accountId = clean(profile?.account_id || existingFreightUser?.account_id || "Freight_001");

    const customerId = pickCus(subscription?.stripe_customer_id, existingFreightUser?.stripe_customer_id);
    const subscriptionId = pickSub(subscription?.stripe_subscription_id, existingFreightUser?.subscription_id);
    const connectAccount = pickAcct(
      subscription?.freight_account,
      subscription?.stripe_account_id,
      profile?.freight_account,
      profile?.stripe_account_id,
      existingFreightUser?.freight_account
    );

    if (!profileId) {
      Alert.alert("Profile Missing", "The profile row could not be created or found.");
      return existingFreightUser;
    }

    const complete = Boolean(customerId && subscriptionId && connectAccount);

    const payload = {
      id: authUserId,
      freight_id: authUserId,
      auth_user_id: profileAuthUserId,
      profile_id: profileId,
      role: "freight",
      email: cleanEmail,
      account_id: accountId,

      company_name: clean(subscription?.name || existingFreightUser?.company_name || profile?.full_name || "Freight Carrier"),
      business_name: clean(subscription?.name || existingFreightUser?.business_name || profile?.full_name || "Freight Carrier"),
      name: clean(subscription?.name || existingFreightUser?.name || profile?.full_name || "Freight Carrier"),
      full_name: clean(subscription?.name || existingFreightUser?.full_name || profile?.full_name || "Freight Carrier"),
      username: clean(subscription?.username || existingFreightUser?.username || ""),

      stripe_customer_id: customerId || null,
      subscription_id: subscriptionId || null,
      freight_account: connectAccount || null,

      account_active: complete,
      approved: complete,
      freight_membership_paid: Boolean(subscriptionId),
      membership_status: subscriptionId ? "active" : "pending",
      verification_status: complete ? "SUBMITTED" : "REGISTERED",
      compliance_status: complete ? "SUBMITTED" : "PENDING_PAYMENT",
      admin_review_status: complete ? "submitted" : "pending_payment",
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("freight_users")
      .upsert(payload, { onConflict: "id" })
      .select("*")
      .maybeSingle();

    if (error) {
      console.log("freight_users upsert failed:", error.message);
      Alert.alert("Freight User Sync Failed", error.message);
      return existingFreightUser;
    }

    const finalUser = buildFreightUser(data || payload);
    setLastCheckedUser(finalUser);
    return finalUser;
  }

  async function touchLastLogin(user: FreightUser) {
    const { error } = await supabase
      .from("freight_users")
      .update({
        account_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) {
      console.log("last login update skipped:", error.message);
    }
  }

  async function openFreightDashboard(user: FreightUser) {
    if (routingLockedRef.current) return;

    routingLockedRef.current = true;
    setNavigatingToDashboard(true);
    setLastCheckedUser(user);

    await saveFreightSession(user);
    await touchLastLogin(user);

    setTimeout(() => {
      router.replace(DASHBOARD_ROUTE as any);
    }, 120);
  }

  async function previewFreightAccessByEmail(inputEmail: string) {
    const cleanEmail = normalize(inputEmail);
    if (!cleanEmail || !cleanEmail.includes("@")) return;

    try {
      const user = await findFreightUser("", cleanEmail);

      if (user) {
        setLastCheckedUser(user);
        return;
      }

      const subscription = await findSubscription("", cleanEmail);

      if (subscription) {
        const previewUser = buildFreightUser({
          id: subscription.freight_id || "",
          freight_id: subscription.freight_id || "",
          auth_user_id: subscription.freight_id || "",
          profile_id: "",
          role: "freight",
          email: subscription.freight_email || cleanEmail,
          account_id: "",
          company_name: subscription.name || "Freight Carrier",
          business_name: subscription.name || "Freight Carrier",
          name: subscription.name || "Freight Carrier",
          full_name: subscription.name || "Freight Carrier",
          username: subscription.username || "",
          stripe_customer_id: subscription.stripe_customer_id,
          subscription_id: subscription.stripe_subscription_id,
          freight_account: subscription.freight_account || subscription.stripe_account_id,
          account_active: false,
          approved: false,
          freight_membership_paid: Boolean(subscription.stripe_subscription_id),
          membership_status: subscription.subscription_status || "active",
        });

        setLastCheckedUser(previewUser);
      }
    } catch (error) {
      console.log("preview check skipped:", error);
    }
  }

  useEffect(() => {
    const cleanEmail = normalize(email);

    if (!cleanEmail || !cleanEmail.includes("@")) {
      setLastCheckedUser(null);
      return;
    }

    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);

    previewTimerRef.current = setTimeout(() => {
      previewFreightAccessByEmail(cleanEmail);
    }, 650);

    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    };
  }, [email]);

  async function handleLogin() {
    const cleanEmail = normalize(email);
    const cleanPassword = clean(password);

    if (!cleanEmail || !cleanPassword) {
      Alert.alert("Missing Information", "Enter email and password.");
      return;
    }

    try {
      setLoginLoading(true);
      routingLockedRef.current = false;

      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword,
      });

      if (error) {
        Alert.alert("Login Failed", error.message);
        return;
      }

      const authUserId = clean(data?.user?.id);

      if (!authUserId) {
        Alert.alert("Login Error", "Unable to confirm freight account.");
        return;
      }

      const syncedUser = await syncFreightUser(authUserId, cleanEmail);

      if (!syncedUser) {
        Alert.alert(
          "Freight Setup Missing",
          "Your login exists, but no freight subscription or freight profile was found. Registration will open."
        );

        router.replace({
          pathname: REGISTER_ROUTE as any,
          params: { freightId: authUserId, email: cleanEmail },
        });
        return;
      }

      setLastCheckedUser(syncedUser);
      await saveFreightSession(syncedUser);

      if (hasDashboardAccess(syncedUser)) {
        await openFreightDashboard(syncedUser);
        return;
      }

      const missingItems = getMissingAccessItems(syncedUser);

      Alert.alert(
        "Finish Freight Setup",
        `Your account was found, but this setup is missing: ${missingItems.join(", ")}.`
      );
    } catch (error: any) {
      console.log("freight login error:", error);
      Alert.alert("Login Error", error?.message || "Unable to login to freight account.");
    } finally {
      if (!routingLockedRef.current) setLoginLoading(false);
    }
  }

  async function handlePasswordReset() {
    const cleanEmail = normalize(resetEmail || email);

    if (!cleanEmail) {
      Alert.alert("Email Required", "Enter your freight account email.");
      return;
    }

    try {
      setResetLoading(true);

      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: RESET_REDIRECT,
      });

      if (error) {
        Alert.alert("Reset Error", error.message);
        return;
      }

      Alert.alert("Password Reset Sent", "Check your email for the secure password reset link.");
      setResetVisible(false);
      setResetEmail("");
    } catch (error: any) {
      Alert.alert("Reset Error", error?.message || "Unable to send password reset email.");
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />

      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
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

              <SideFeature
                icon="grid-outline"
                title="Dashboard-first access"
                body="Completed freight profiles route directly to the carrier dashboard."
              />

              <SideFeature
                icon="card-outline"
                title="Stripe verified"
                body="Customer, subscription, and Connect account IDs are checked at login."
              />

              <SideFeature
                icon="business-outline"
                title="Carrier workspace"
                body="Manage load board, live routes, payouts, alerts, and profile setup."
              />

              <TouchableOpacity
                style={styles.homeButton}
                onPress={() => router.replace("/" as any)}
                activeOpacity={0.9}
              >
                <Ionicons name="home-outline" size={18} color={COLORS.primary} />
                <Text style={styles.homeButtonText}>Back to Home</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.main}>
              <View style={styles.topPanel}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.eyebrow}>Fina Admin Style Portal</Text>
                  <Text style={styles.pageTitle}>Carrier Login</Text>
                  <Text style={styles.pageSubtitle}>
                    Sign in to access Farm2Home Freight loads, dispatch tools, route tracking, and Stripe payouts.
                  </Text>
                </View>

                <View style={styles.statusBadge}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusBadgeText}>Secure</Text>
                </View>
              </View>

              <View style={styles.metricsRow}>
                <MetricCard
                  icon="person-circle-outline"
                  label="Profile"
                  value={lastCheckedUser?.company_name || "Carrier"}
                />
                <MetricCard
                  icon="business-outline"
                  label="Account"
                  value={lastCheckedUser?.account_id || "Freight ID"}
                />
                <MetricCard
                  icon="shield-checkmark-outline"
                  label="Access"
                  value={hasDashboardAccess(lastCheckedUser) ? "Ready" : "Check Login"}
                />
              </View>

              <View style={styles.formGrid}>
                <View style={styles.loginCard}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardIcon}>
                      <Ionicons name="log-in-outline" size={22} color={COLORS.white} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>Welcome back</Text>
                      <Text style={styles.cardSubtitle}>Use your freight registration email and password.</Text>
                    </View>
                  </View>

                  <Text style={styles.inputLabel}>Email Address</Text>
                  <View style={styles.inputShell}>
                    <Ionicons name="mail-outline" size={18} color={COLORS.muted} />
                    <TextInput
                      style={styles.input}
                      placeholder="carrier@email.com"
                      placeholderTextColor="#94A3B8"
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                      value={email}
                      onChangeText={setEmail}
                    />
                  </View>

                  <Text style={styles.inputLabel}>Password</Text>
                  <View style={styles.inputShell}>
                    <Ionicons name="lock-closed-outline" size={18} color={COLORS.muted} />
                    <TextInput
                      style={styles.input}
                      placeholder="Enter password"
                      placeholderTextColor="#94A3B8"
                      secureTextEntry
                      autoCapitalize="none"
                      autoCorrect={false}
                      value={password}
                      onChangeText={setPassword}
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.primaryButton, (loginLoading || navigatingToDashboard) && styles.disabledButton]}
                    onPress={handleLogin}
                    disabled={loginLoading || navigatingToDashboard}
                    activeOpacity={0.9}
                  >
                    {loginLoading || navigatingToDashboard ? (
                      <ActivityIndicator color={COLORS.white} />
                    ) : (
                      <>
                        <Ionicons name="arrow-forward-outline" size={18} color={COLORS.white} />
                        <Text style={styles.primaryButtonText}>Login to Freight Dashboard</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  {navigatingToDashboard ? (
                    <View style={styles.readyBanner}>
                      <Ionicons name="checkmark-circle-outline" size={18} color={COLORS.greenDark} />
                      <Text style={styles.readyBannerText}>Dashboard session is ready. Opening freight dashboard...</Text>
                    </View>
                  ) : null}

                  <TouchableOpacity
                    style={styles.textButton}
                    onPress={() => {
                      setResetEmail(email);
                      setResetVisible(true);
                    }}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.textButtonText}>Forgot Password?</Text>
                  </TouchableOpacity>

                  <View style={styles.divider} />

                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={() => router.push(REGISTER_ROUTE as any)}
                    activeOpacity={0.9}
                  >
                    <Ionicons name="business-outline" size={18} color={COLORS.primary} />
                    <Text style={styles.secondaryButtonText}>Register for Freight Connect</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.accessCard}>
                  <View style={styles.cardHeader}>
                    <View style={[styles.cardIcon, styles.cardIconSoft]}>
                      <Ionicons name="analytics-outline" size={22} color={COLORS.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>Dashboard access check</Text>
                      <Text style={styles.cardSubtitle}>Login validates the fields below before routing.</Text>
                    </View>
                  </View>

                  {accessStatus.map((item) => (
                    <View key={item.label} style={styles.accessRow}>
                      <View style={[styles.accessIcon, item.complete ? styles.accessGood : styles.accessMissing]}>
                        <Ionicons
                          name={item.complete ? "checkmark-outline" : "ellipse-outline"}
                          size={16}
                          color={item.complete ? COLORS.white : COLORS.muted}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.accessLabel}>{item.label}</Text>
                        <Text style={styles.accessValue}>{item.value}</Text>
                      </View>
                    </View>
                  ))}

                  <View style={styles.noteBox}>
                    <Ionicons name="information-circle-outline" size={20} color={COLORS.primary} />
                    <Text style={styles.noteText}>
                      Freight access requires profile ID, static Freight ID, Stripe customer, subscription, and Stripe Connect account.
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={resetVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIcon}>
              <Ionicons name="key-outline" size={28} color={COLORS.white} />
            </View>

            <Text style={styles.modalTitle}>Reset Freight Password</Text>
            <Text style={styles.modalSubtitle}>
              Enter your freight account email. Farm2Home will send a secure reset link if the Auth account exists.
            </Text>

            <Text style={styles.inputLabel}>Freight Email</Text>
            <View style={styles.inputShell}>
              <Ionicons name="mail-outline" size={18} color={COLORS.muted} />
              <TextInput
                style={styles.input}
                placeholder="Freight Email"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                value={resetEmail}
                onChangeText={setResetEmail}
              />
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, resetLoading && styles.disabledButton]}
              onPress={handlePasswordReset}
              disabled={resetLoading}
              activeOpacity={0.9}
            >
              {resetLoading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <>
                  <Ionicons name="mail-outline" size={18} color={COLORS.white} />
                  <Text style={styles.primaryButtonText}>Send Reset Link</Text>
                </>
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
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function SideFeature({
  icon,
  title,
  body,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}) {
  return (
    <View style={styles.sideFeature}>
      <View style={styles.sideFeatureIcon}>
        <Ionicons name={icon} size={18} color={COLORS.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.sideFeatureTitle}>{title}</Text>
        <Text style={styles.sideFeatureBody}>{body}</Text>
      </View>
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
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  brandIcon: {
    width: 54,
    height: 54,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  brandTitle: {
    color: COLORS.white,
    fontSize: 21,
    fontWeight: "900",
  },
  brandSubtitle: {
    color: "#A5B4FC",
    fontWeight: "800",
    marginTop: 2,
  },
  sideDivider: {
    height: 1,
    backgroundColor: "#1E293B",
    marginVertical: 24,
  },
  sideFeature: {
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "#1E293B",
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  sideFeatureIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  sideFeatureTitle: {
    color: COLORS.white,
    fontWeight: "900",
    marginBottom: 4,
  },
  sideFeatureBody: {
    color: "#CBD5E1",
    fontWeight: "700",
    lineHeight: 19,
    fontSize: 12,
  },
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
  homeButtonText: {
    color: COLORS.white,
    fontWeight: "900",
  },
  main: {
    flex: 1,
    padding: 18,
  },
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
  pageTitle: {
    color: COLORS.text,
    fontSize: 34,
    fontWeight: "900",
    marginTop: 6,
  },
  pageSubtitle: {
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 22,
    marginTop: 7,
    maxWidth: 680,
  },
  statusBadge: {
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: COLORS.green,
  },
  statusBadgeText: {
    color: COLORS.greenDark,
    fontWeight: "900",
  },
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
  metricLabel: {
    color: COLORS.muted,
    fontWeight: "900",
    fontSize: 11,
    textTransform: "uppercase",
  },
  metricValue: {
    color: COLORS.text,
    fontWeight: "900",
    marginTop: 3,
  },
  formGrid: {
    flexDirection: Platform.OS === "web" ? "row" : "column",
    gap: 14,
    alignItems: "flex-start",
  },
  loginCard: {
    flex: 1.1,
    width: "100%",
    backgroundColor: COLORS.white,
    borderRadius: 26,
    padding: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  accessCard: {
    flex: 0.9,
    width: "100%",
    backgroundColor: COLORS.white,
    borderRadius: 26,
    padding: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  cardIcon: {
    width: 46,
    height: 46,
    borderRadius: 17,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  cardIconSoft: {
    backgroundColor: COLORS.primarySoft,
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "900",
  },
  cardSubtitle: {
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 3,
    lineHeight: 19,
  },
  inputLabel: {
    color: COLORS.text,
    fontWeight: "900",
    marginBottom: 8,
  },
  inputShell: {
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
    borderRadius: 16,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 14,
  },
  input: {
    flex: 1,
    color: COLORS.text,
    fontWeight: "800",
    paddingVertical: 15,
  },
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
  primaryButtonText: {
    color: COLORS.white,
    fontWeight: "900",
    fontSize: 15,
    textAlign: "center",
    flexShrink: 1,
  },
  disabledButton: { opacity: 0.6 },
  readyBanner: {
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  readyBannerText: {
    color: COLORS.greenDark,
    fontWeight: "900",
    flex: 1,
    lineHeight: 19,
  },
  textButton: {
    alignItems: "center",
    marginTop: 15,
  },
  textButtonText: {
    color: COLORS.primary,
    fontWeight: "900",
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 18,
  },
  secondaryButton: {
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    borderRadius: 16,
    padding: 15,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    width: "100%",
  },
  secondaryButtonText: {
    color: COLORS.primary,
    fontWeight: "900",
    textAlign: "center",
    flexShrink: 1,
  },
  accessRow: {
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    marginBottom: 10,
  },
  accessIcon: {
    width: 32,
    height: 32,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  accessGood: {
    backgroundColor: COLORS.green,
  },
  accessMissing: {
    backgroundColor: "#E2E8F0",
  },
  accessLabel: {
    color: COLORS.text,
    fontWeight: "900",
  },
  accessValue: {
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 2,
  },
  noteBox: {
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
  noteText: {
    color: COLORS.primaryDark,
    fontWeight: "800",
    lineHeight: 20,
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(2,6,23,0.72)",
    justifyContent: "center",
    padding: 22,
  },
  modalCard: {
    backgroundColor: COLORS.white,
    borderRadius: 26,
    padding: 22,
    maxHeight: "90%",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalIcon: {
    width: 58,
    height: 58,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 14,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center",
  },
  modalSubtitle: {
    color: COLORS.muted,
    textAlign: "center",
    lineHeight: 22,
    marginVertical: 14,
    fontWeight: "700",
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
