// app/freight/login.tsx

import React, { useMemo, useState } from "react";
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

type FreightUser = {
  id: string;
  freightId: string;
  freight_id: string;
  profileId: string;
  profile_id: string;
  authUserId: string;
  auth_user_id: string;
  role: "freight";

  accountId: string;
  account_id: string;

  companyName: string;
  company_name: string;
  businessName: string;
  business_name: string;
  contactName: string;
  contact_name: string;
  fullName: string;
  full_name: string;
  email: string;
  phone: string;
  username: string;

  stripeCustomerId: string;
  stripe_customer_id: string;
  stripeSubscriptionId: string;
  stripe_subscription_id: string;
  subscriptionId: string;
  subscription_id: string;
  freightAccount: string;
  freight_account: string;
  stripeAccountId: string;
  stripe_account_id: string;

  accountActive: boolean;
  account_active: boolean;
  membershipStatus: string;
  membership_status: string;
  subscriptionStatus: string;
  subscription_status: string;

  approved: boolean;
  verificationStatus: string;
  verification_status: string;
  registrationComplete: boolean;
  registration_complete: boolean;
  applicationSubmitted: boolean;
  application_submitted: boolean;
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
  amber: "#F59E0B",
  red: "#EF4444",
  dark: "#111827",
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

function statusIsGood(value: any) {
  const status = normalize(value || "active");
  return !["canceled", "cancelled", "unpaid", "inactive", "disabled", "rejected"].includes(status);
}

function formatMaskedId(value: string, fallback = "Missing") {
  const id = clean(value);
  if (!id) return fallback;
  if (id.length <= 14) return id;
  return `${id.slice(0, 8)}...${id.slice(-5)}`;
}

function hasDashboardAccess(user: FreightUser) {
  return Boolean(
    user.id &&
      clean(user.account_id || user.accountId) &&
      isCus(user.stripe_customer_id || user.stripeCustomerId) &&
      isSub(user.stripe_subscription_id || user.subscription_id || user.stripeSubscriptionId) &&
      isAcct(user.freight_account || user.stripe_account_id || user.freightAccount || user.stripeAccountId) &&
      user.account_active !== false &&
      user.accountActive !== false &&
      statusIsGood(user.membership_status || user.membershipStatus) &&
      statusIsGood(user.subscription_status || user.subscriptionStatus)
  );
}

function mapCarrierToFreightUser(item: any, profile?: any, subscription?: any): FreightUser {
  const id = clean(
    item?.id ||
      item?.freight_id ||
      item?.auth_user_id ||
      item?.profile_id ||
      subscription?.freight_id ||
      profile?.auth_user_id ||
      profile?.id ||
      ""
  );

  const accountId = clean(
    item?.account_id ||
      item?.accountId ||
      profile?.account_id ||
      profile?.accountId ||
      ""
  );

  const stripeCustomerId = pickCus(
    item?.stripe_customer_id,
    item?.stripeCustomerId,
    profile?.stripe_customer_id,
    profile?.stripeCustomerId,
    subscription?.stripe_customer_id,
    subscription?.stripeCustomerId
  );

  const stripeSubscriptionId = pickSub(
    item?.stripe_subscription_id,
    item?.subscription_id,
    item?.stripeSubscriptionId,
    item?.subscriptionId,
    profile?.stripe_subscription_id,
    profile?.subscription_id,
    profile?.stripeSubscriptionId,
    profile?.subscriptionId,
    subscription?.stripe_subscription_id,
    subscription?.subscription_id,
    subscription?.stripeSubscriptionId,
    subscription?.subscriptionId
  );

  const freightAccount = pickAcct(
    item?.freight_account,
    item?.freightAccount,
    item?.stripe_account_id,
    item?.stripeAccountId,
    profile?.freight_account,
    profile?.freightAccount,
    profile?.stripe_account_id,
    profile?.stripeAccountId,
    subscription?.freight_account,
    subscription?.freightAccount,
    subscription?.stripe_account_id,
    subscription?.stripeAccountId
  );

  const companyName = clean(
    item?.company_name ||
      item?.business_name ||
      item?.companyName ||
      item?.businessName ||
      subscription?.name ||
      profile?.company_name ||
      profile?.business_name ||
      "Freight Carrier"
  );

  const contactName = clean(
    item?.contact_name ||
      item?.full_name ||
      item?.name ||
      item?.contactName ||
      item?.fullName ||
      profile?.full_name ||
      profile?.name ||
      ""
  );

  const membershipStatus = clean(
    item?.membership_status ||
      item?.membershipStatus ||
      profile?.membership_status ||
      profile?.membershipStatus ||
      (stripeSubscriptionId ? "active" : "pending")
  );

  const subscriptionStatus = clean(
    item?.subscription_status ||
      item?.subscriptionStatus ||
      profile?.subscription_status ||
      profile?.subscriptionStatus ||
      subscription?.subscription_status ||
      subscription?.subscriptionStatus ||
      (stripeSubscriptionId ? "active" : "pending")
  );

  const registrationComplete = Boolean(
    item?.registration_complete ||
      item?.registrationComplete ||
      item?.application_submitted ||
      item?.applicationSubmitted ||
      profile?.registration_complete ||
      profile?.application_submitted ||
      (stripeCustomerId && stripeSubscriptionId && freightAccount)
  );

  const applicationSubmitted = Boolean(
    item?.application_submitted ||
      item?.applicationSubmitted ||
      profile?.application_submitted ||
      registrationComplete
  );

  const accountActive =
    item?.account_active === undefined
      ? profile?.account_active !== false
      : item?.account_active !== false;

  return {
    id,
    freightId: id,
    freight_id: id,
    profileId: clean(item?.profile_id || profile?.id || id),
    profile_id: clean(item?.profile_id || profile?.id || id),
    authUserId: clean(item?.auth_user_id || profile?.auth_user_id || id),
    auth_user_id: clean(item?.auth_user_id || profile?.auth_user_id || id),
    role: "freight",

    accountId,
    account_id: accountId,

    companyName,
    company_name: companyName,
    businessName: clean(item?.business_name || item?.businessName || companyName),
    business_name: clean(item?.business_name || item?.businessName || companyName),
    contactName,
    contact_name: contactName,
    fullName: clean(item?.full_name || item?.fullName || contactName),
    full_name: clean(item?.full_name || item?.fullName || contactName),
    email: normalize(item?.email || profile?.email || subscription?.freight_email),
    phone: clean(item?.phone || profile?.phone || ""),
    username: normalize(item?.username || profile?.username || subscription?.username || ""),

    stripeCustomerId,
    stripe_customer_id: stripeCustomerId,
    stripeSubscriptionId,
    stripe_subscription_id: stripeSubscriptionId,
    subscriptionId: stripeSubscriptionId,
    subscription_id: stripeSubscriptionId,
    freightAccount,
    freight_account: freightAccount,
    stripeAccountId: freightAccount,
    stripe_account_id: freightAccount,

    accountActive,
    account_active: accountActive,
    membershipStatus,
    membership_status: membershipStatus,
    subscriptionStatus,
    subscription_status: subscriptionStatus,

    approved: item?.approved !== false,
    verificationStatus: clean(
      item?.verification_status ||
        item?.admin_review_status ||
        item?.compliance_status ||
        profile?.verification_status ||
        "SUBMITTED"
    ),
    verification_status: clean(
      item?.verification_status ||
        item?.admin_review_status ||
        item?.compliance_status ||
        profile?.verification_status ||
        "SUBMITTED"
    ),
    registrationComplete,
    registration_complete: registrationComplete,
    applicationSubmitted,
    application_submitted: applicationSubmitted,
  };
}

export default function FreightLoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loginLoading, setLoginLoading] = useState(false);
  const [resetVisible, setResetVisible] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [lastCheckedUser, setLastCheckedUser] = useState<FreightUser | null>(null);

  const accessStatus = useMemo(() => {
    if (!lastCheckedUser) {
      return [
        { label: "Freight Profile", complete: false, value: "Login to check" },
        { label: "Static Account", complete: false, value: "Login to check" },
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
        label: "Subscription",
        complete: isSub(lastCheckedUser.stripe_subscription_id || lastCheckedUser.subscription_id),
        value: formatMaskedId(lastCheckedUser.stripe_subscription_id || lastCheckedUser.subscription_id),
      },
      {
        label: "Stripe Connect",
        complete: isAcct(lastCheckedUser.freight_account || lastCheckedUser.stripe_account_id),
        value: formatMaskedId(lastCheckedUser.freight_account || lastCheckedUser.stripe_account_id),
      },
    ];
  }, [lastCheckedUser]);

  async function saveFreightSession(user: FreightUser) {
    const now = new Date().toISOString();
    const sessionUser = {
      ...user,
      role: "freight" as const,
      accountActive: user.accountActive !== false,
      account_active: user.account_active !== false,
      updatedAt: now,
      updated_at: now,
    };

    await AsyncStorage.multiSet([
      ["currentFreight", JSON.stringify(sessionUser)],
      ["currentFreightCarrier", JSON.stringify(sessionUser)],
      ["currentFreightUser", JSON.stringify(sessionUser)],
      ["farm2homeCurrentFreight", JSON.stringify(sessionUser)],
      ["currentUser", JSON.stringify(sessionUser)],
      ["userRole", "freight"],
      ["currentUserRole", "freight"],
    ]);

    return sessionUser;
  }

  async function findProfile(userId: string, cleanEmail: string) {
    if (userId) {
      const byAuth = await supabase
        .from("profiles")
        .select("*")
        .or(`id.eq.${userId},auth_user_id.eq.${userId},profile_id.eq.${userId}`)
        .eq("role", "freight")
        .maybeSingle();

      if (!byAuth.error && byAuth.data) return byAuth.data;
    }

    if (cleanEmail) {
      const byEmail = await supabase
        .from("profiles")
        .select("*")
        .eq("email", cleanEmail)
        .eq("role", "freight")
        .maybeSingle();

      if (!byEmail.error && byEmail.data) return byEmail.data;
    }

    return null;
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
      .limit(1);

    if (error) {
      console.log("Freight subscription lookup error:", error.message);
      return null;
    }

    return Array.isArray(data) && data.length > 0 ? data[0] : null;
  }

  async function findFreightProfile(userId: string, cleanEmail: string) {
    const profile = await findProfile(userId, cleanEmail);
    const subscription = await findSubscription(userId, cleanEmail);
    let freightUser: any = null;

    if (userId) {
      const userById = await supabase
        .from("freight_users")
        .select("*")
        .or(`id.eq.${userId},freight_id.eq.${userId},auth_user_id.eq.${userId},profile_id.eq.${userId}`)
        .maybeSingle();

      if (!userById.error && userById.data) freightUser = userById.data;
    }

    if (!freightUser && cleanEmail) {
      const userByEmail = await supabase
        .from("freight_users")
        .select("*")
        .eq("email", cleanEmail)
        .maybeSingle();

      if (!userByEmail.error && userByEmail.data) freightUser = userByEmail.data;
    }

    if (!freightUser && userId) {
      const carrierById = await supabase
        .from("freight_carriers")
        .select("*")
        .or(`id.eq.${userId},freight_id.eq.${userId},auth_user_id.eq.${userId},profile_id.eq.${userId}`)
        .maybeSingle();

      if (!carrierById.error && carrierById.data) freightUser = carrierById.data;
    }

    if (!freightUser && cleanEmail) {
      const carrierByEmail = await supabase
        .from("freight_carriers")
        .select("*")
        .eq("email", cleanEmail)
        .maybeSingle();

      if (!carrierByEmail.error && carrierByEmail.data) freightUser = carrierByEmail.data;
    }

    if (!freightUser && (profile || subscription)) {
      freightUser = {
        id: userId || profile?.auth_user_id || profile?.id || subscription?.freight_id,
        freight_id: userId || profile?.auth_user_id || profile?.id || subscription?.freight_id,
        auth_user_id: userId || profile?.auth_user_id || profile?.id || subscription?.freight_id,
        profile_id: profile?.id || userId || subscription?.freight_id,
        role: "freight",
        account_id: profile?.account_id,
        company_name: profile?.company_name || profile?.business_name || subscription?.name || "Freight Carrier",
        business_name: profile?.business_name || profile?.company_name || subscription?.name || "Freight Carrier",
        contact_name: profile?.full_name || profile?.name || "",
        full_name: profile?.full_name || profile?.name || "",
        email: profile?.email || subscription?.freight_email || cleanEmail,
        phone: profile?.phone,
        username: profile?.username || subscription?.username || "",
        account_active: profile?.account_active ?? true,
        stripe_customer_id: profile?.stripe_customer_id || subscription?.stripe_customer_id,
        stripe_subscription_id:
          profile?.stripe_subscription_id || profile?.subscription_id || subscription?.stripe_subscription_id,
        subscription_id:
          profile?.subscription_id || profile?.stripe_subscription_id || subscription?.stripe_subscription_id,
        freight_account: profile?.freight_account || subscription?.freight_account,
        stripe_account_id: profile?.stripe_account_id || subscription?.stripe_account_id,
        membership_status: profile?.membership_status || (subscription?.stripe_subscription_id ? "active" : "pending"),
        subscription_status: profile?.subscription_status || subscription?.subscription_status,
        registration_complete: profile?.registration_complete,
        application_submitted: profile?.application_submitted,
      };
    }

    if (!freightUser) return null;

    const mapped = mapCarrierToFreightUser(freightUser, profile, subscription);

    const updates: any = {};
    if (subscription?.stripe_account_id && !pickAcct(freightUser?.stripe_account_id, freightUser?.freight_account)) {
      updates.stripe_account_id = subscription.stripe_account_id;
      updates.freight_account = subscription.freight_account || subscription.stripe_account_id;
      updates.stripe_connect_status = "started";
    }
    if (subscription?.stripe_customer_id && !pickCus(freightUser?.stripe_customer_id)) {
      updates.stripe_customer_id = subscription.stripe_customer_id;
    }
    if (subscription?.stripe_subscription_id && !pickSub(freightUser?.stripe_subscription_id, freightUser?.subscription_id)) {
      updates.stripe_subscription_id = subscription.stripe_subscription_id;
      updates.subscription_id = subscription.stripe_subscription_id;
      updates.subscription_status = subscription.subscription_status || "active";
      updates.membership_status = "active";
      updates.freight_membership_paid = true;
    }

    if (freightUser?.id && Object.keys(updates).length > 0) {
      await supabase
        .from("freight_users")
        .update({ ...updates, account_active: true, updated_at: new Date().toISOString() })
        .eq("id", freightUser.id);

      Object.assign(mapped, {
        stripeCustomerId: pickCus(updates.stripe_customer_id, mapped.stripeCustomerId),
        stripe_customer_id: pickCus(updates.stripe_customer_id, mapped.stripe_customer_id),
        stripeSubscriptionId: pickSub(updates.stripe_subscription_id, mapped.stripeSubscriptionId),
        stripe_subscription_id: pickSub(updates.stripe_subscription_id, mapped.stripe_subscription_id),
        subscriptionId: pickSub(updates.subscription_id, mapped.subscriptionId),
        subscription_id: pickSub(updates.subscription_id, mapped.subscription_id),
        freightAccount: pickAcct(updates.freight_account, updates.stripe_account_id, mapped.freightAccount),
        freight_account: pickAcct(updates.freight_account, updates.stripe_account_id, mapped.freight_account),
        stripeAccountId: pickAcct(updates.freight_account, updates.stripe_account_id, mapped.stripeAccountId),
        stripe_account_id: pickAcct(updates.freight_account, updates.stripe_account_id, mapped.stripe_account_id),
        membershipStatus: updates.membership_status || mapped.membershipStatus,
        membership_status: updates.membership_status || mapped.membership_status,
        subscriptionStatus: updates.subscription_status || mapped.subscriptionStatus,
        subscription_status: updates.subscription_status || mapped.subscription_status,
      });
    }

    return mapped;
  }

  async function touchLastLogin(user: FreightUser) {
    const now = new Date().toISOString();

    await supabase
      .from("freight_users")
      .update({
        last_login_at: now,
        account_active: true,
        updated_at: now,
      })
      .eq("id", user.id);

    await supabase
      .from("profiles")
      .update({
        account_active: true,
        last_login_at: now,
      })
      .eq("id", user.id);
  }

  async function handleLogin() {
    const cleanEmail = normalize(email);
    const cleanPassword = clean(password);

    if (!cleanEmail || !cleanPassword) {
      Alert.alert("Missing Information", "Enter email and password.");
      return;
    }

    try {
      setLoginLoading(true);

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
        Alert.alert("Login Error", "Unable to confirm freight account.");
        return;
      }

      const mappedUser = await findFreightProfile(userId, cleanEmail);

      if (!mappedUser) {
        Alert.alert(
          "Freight Profile Missing",
          "Your login exists, but no freight profile was found. Please complete freight registration."
        );
        router.replace(REGISTER_ROUTE as any);
        return;
      }

      setLastCheckedUser(mappedUser);
      await saveFreightSession(mappedUser);

      if (!statusIsGood(mappedUser.membershipStatus || mappedUser.membership_status)) {
        Alert.alert("Account Not Active", "Your freight membership is not active.");
        router.replace(REGISTER_ROUTE as any);
        return;
      }

      if (!statusIsGood(mappedUser.subscriptionStatus || mappedUser.subscription_status)) {
        Alert.alert("Subscription Issue", "Your freight subscription needs attention.");
        router.replace(REGISTER_ROUTE as any);
        return;
      }

      if (mappedUser.accountActive === false || mappedUser.account_active === false) {
        Alert.alert("Account Not Active", "Your freight account is not active.");
        return;
      }

      if (hasDashboardAccess(mappedUser)) {
        await touchLastLogin(mappedUser);
        router.replace(DASHBOARD_ROUTE as any);
        return;
      }

      const missingItems = [
        !mappedUser.account_id ? "Static Account ID" : "",
        !isCus(mappedUser.stripe_customer_id) ? "Stripe Customer ID" : "",
        !isSub(mappedUser.stripe_subscription_id || mappedUser.subscription_id) ? "Stripe Subscription ID" : "",
        !isAcct(mappedUser.freight_account || mappedUser.stripe_account_id) ? "Stripe Connect Account ID" : "",
      ].filter(Boolean);

      Alert.alert(
        "Finish Freight Setup",
        `Your freight profile was found, but this setup is missing: ${missingItems.join(", ")}. You will be taken to registration to finish setup.`
      );

      router.replace(REGISTER_ROUTE as any);
    } catch (error: any) {
      console.log("Freight login error:", error);
      Alert.alert("Login Error", error?.message || "Unable to login to freight account.");
    } finally {
      setLoginLoading(false);
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

              <TouchableOpacity style={styles.homeButton} onPress={() => router.replace("/" as any)}>
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
                  value={lastCheckedUser?.companyName || "Carrier"}
                />
                <MetricCard
                  icon="business-outline"
                  label="Account"
                  value={lastCheckedUser?.account_id || "Freight ID"}
                />
                <MetricCard
                  icon="shield-checkmark-outline"
                  label="Access"
                  value={lastCheckedUser && hasDashboardAccess(lastCheckedUser) ? "Ready" : "Check Login"}
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
                    style={[styles.primaryButton, loginLoading && styles.disabledButton]}
                    onPress={handleLogin}
                    disabled={loginLoading}
                    activeOpacity={0.9}
                  >
                    {loginLoading ? (
                      <ActivityIndicator color={COLORS.white} />
                    ) : (
                      <>
                        <Ionicons name="arrow-forward-outline" size={18} color={COLORS.white} />
                        <Text style={styles.primaryButtonText}>Login to Freight Dashboard</Text>
                      </>
                    )}
                  </TouchableOpacity>

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
                      If Stripe Connect exists in freight_subscriptions, this login automatically syncs it into freight_users before dashboard routing.
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
