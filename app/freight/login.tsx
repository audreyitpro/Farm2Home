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

function accountIdOf(user: any) {
  return clean(user?.account_id || user?.accountId);
}

function customerIdOf(user: any) {
  return pickCus(user?.stripe_customer_id, user?.stripeCustomerId);
}

function subscriptionIdOf(user: any) {
  return pickSub(
    user?.stripe_subscription_id,
    user?.subscription_id,
    user?.stripeSubscriptionId,
    user?.subscriptionId
  );
}

function connectIdOf(user: any) {
  return pickAcct(
    user?.freight_account,
    user?.stripe_account_id,
    user?.freightAccount,
    user?.stripeAccountId
  );
}

function formatMaskedId(value: string, fallback = "Missing") {
  const id = clean(value);
  if (!id) return fallback;
  if (id.length <= 14) return id;
  return `${id.slice(0, 8)}...${id.slice(-5)}`;
}

function ensureFreightUserAliases(user: FreightUser): FreightUser {
  const id = clean(user.id || user.freight_id || user.freightId || user.auth_user_id || user.authUserId);
  const accountId = accountIdOf(user);
  const stripeCustomerId = customerIdOf(user);
  const stripeSubscriptionId = subscriptionIdOf(user);
  const stripeConnectId = connectIdOf(user);

  return {
    ...user,
    id,
    freightId: id,
    freight_id: id,
    authUserId: clean(user.authUserId || user.auth_user_id || id),
    auth_user_id: clean(user.auth_user_id || user.authUserId || id),
    profileId: clean(user.profileId || user.profile_id || id),
    profile_id: clean(user.profile_id || user.profileId || id),

    accountId,
    account_id: accountId,

    stripeCustomerId,
    stripe_customer_id: stripeCustomerId,
    stripeSubscriptionId: stripeSubscriptionId,
    stripe_subscription_id: stripeSubscriptionId,
    subscriptionId: stripeSubscriptionId,
    subscription_id: stripeSubscriptionId,
    freightAccount: stripeConnectId,
    freight_account: stripeConnectId,
    stripeAccountId: stripeConnectId,
    stripe_account_id: stripeConnectId,

    accountActive: user.accountActive !== false && user.account_active !== false,
    account_active: user.accountActive !== false && user.account_active !== false,
  };
}

function hasAllFiveFreightRequirements(user: FreightUser) {
  const fixed = ensureFreightUserAliases(user);

  return Boolean(
    fixed.id &&
      accountIdOf(fixed) &&
      isCus(customerIdOf(fixed)) &&
      isSub(subscriptionIdOf(fixed)) &&
      isAcct(connectIdOf(fixed))
  );
}

function hasDashboardAccess(user: FreightUser) {
  const fixed = ensureFreightUserAliases(user);

  if (!hasAllFiveFreightRequirements(fixed)) return false;

  return Boolean(
    !valueIsFalse(fixed.account_active) &&
      !valueIsFalse(fixed.accountActive) &&
      statusIsGood(fixed.membership_status || fixed.membershipStatus || "active") &&
      statusIsGood(fixed.subscription_status || fixed.subscriptionStatus || "active")
  );
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

  return `Freight_${Date.now()}`;
}

function buildEmptyFreightUser(userId: string, email: string): FreightUser {
  return {
    id: userId,
    freightId: userId,
    freight_id: userId,
    profileId: userId,
    profile_id: userId,
    authUserId: userId,
    auth_user_id: userId,
    role: "freight",

    accountId: "",
    account_id: "",

    companyName: "Freight Carrier",
    company_name: "Freight Carrier",
    businessName: "Freight Carrier",
    business_name: "Freight Carrier",
    contactName: "",
    contact_name: "",
    fullName: "",
    full_name: "",
    email,
    phone: "",
    username: "",

    stripeCustomerId: "",
    stripe_customer_id: "",
    stripeSubscriptionId: "",
    stripe_subscription_id: "",
    subscriptionId: "",
    subscription_id: "",
    freightAccount: "",
    freight_account: "",
    stripeAccountId: "",
    stripe_account_id: "",

    accountActive: false,
    account_active: false,
    membershipStatus: "pending",
    membership_status: "pending",
    subscriptionStatus: "pending",
    subscription_status: "pending",

    approved: false,
    verificationStatus: "REGISTERED",
    verification_status: "REGISTERED",
    registrationComplete: false,
    registration_complete: false,
    applicationSubmitted: false,
    application_submitted: false,
  };
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

  const accountId = clean(item?.account_id || item?.accountId || profile?.account_id || profile?.accountId || "");

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
      profile?.company_name ||
      profile?.business_name ||
      subscription?.name ||
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
      subscription?.name ||
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
      ? !valueIsFalse(profile?.account_active)
      : !valueIsFalse(item?.account_active);

  return ensureFreightUserAliases({
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
  });
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

    const fixed = ensureFreightUserAliases(lastCheckedUser);
    const accountId = accountIdOf(fixed);
    const customerId = customerIdOf(fixed);
    const subscriptionId = subscriptionIdOf(fixed);
    const connectId = connectIdOf(fixed);

    return [
      {
        label: "Freight Profile",
        complete: Boolean(fixed.id),
        value: fixed.id ? "Found" : "Missing",
      },
      {
        label: "Static Account",
        complete: Boolean(accountId),
        value: accountId || "Missing",
      },
      {
        label: "Stripe Customer",
        complete: isCus(customerId),
        value: formatMaskedId(customerId),
      },
      {
        label: "Subscription",
        complete: isSub(subscriptionId),
        value: formatMaskedId(subscriptionId),
      },
      {
        label: "Stripe Connect",
        complete: isAcct(connectId),
        value: formatMaskedId(connectId),
      },
    ];
  }, [lastCheckedUser]);

  async function saveFreightSession(user: FreightUser) {
    const now = new Date().toISOString();
    const fixed = ensureFreightUserAliases(user);

    const sessionUser = {
      ...fixed,
      role: "freight" as const,
      updatedAt: now,
      updated_at: now,
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
      ["lastFreightDashboardReady", hasDashboardAccess(sessionUser) ? "true" : "false"],
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
      .limit(10);

    if (error) {
      console.log("Freight subscription lookup error:", error.message);
      return null;
    }

    if (!Array.isArray(data) || data.length === 0) return null;

    const complete = data.find(
      (row) =>
        pickCus(row?.stripe_customer_id) &&
        pickSub(row?.stripe_subscription_id) &&
        pickAcct(row?.stripe_account_id, row?.freight_account)
    );

    return complete || data[0];
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
        contact_name: profile?.full_name || profile?.name || subscription?.name || "",
        full_name: profile?.full_name || profile?.name || subscription?.name || "",
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
    const subscriptionCustomer = pickCus(subscription?.stripe_customer_id);
    const subscriptionSub = pickSub(subscription?.stripe_subscription_id);
    const subscriptionConnect = pickAcct(subscription?.stripe_account_id, subscription?.freight_account);

    if (subscriptionCustomer && !customerIdOf(mapped)) updates.stripe_customer_id = subscriptionCustomer;

    if (subscriptionSub && !subscriptionIdOf(mapped)) {
      updates.stripe_subscription_id = subscriptionSub;
      updates.subscription_id = subscriptionSub;
      updates.subscription_status = subscription?.subscription_status || "active";
      updates.membership_status = "active";
      updates.freight_membership_paid = true;
    }

    if (subscriptionConnect && !connectIdOf(mapped)) {
      updates.stripe_account_id = subscriptionConnect;
      updates.freight_account = subscriptionConnect;
      updates.stripe_connect_status = "started";
    }

    if (mapped?.id && Object.keys(updates).length > 0) {
      await supabase
        .from("freight_users")
        .update({
          ...updates,
          account_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", mapped.id);

      return ensureFreightUserAliases({
        ...mapped,
        stripe_customer_id: pickCus(updates.stripe_customer_id, mapped.stripe_customer_id),
        stripeCustomerId: pickCus(updates.stripe_customer_id, mapped.stripeCustomerId),
        stripe_subscription_id: pickSub(updates.stripe_subscription_id, mapped.stripe_subscription_id),
        stripeSubscriptionId: pickSub(updates.stripe_subscription_id, mapped.stripeSubscriptionId),
        subscription_id: pickSub(updates.subscription_id, mapped.subscription_id),
        subscriptionId: pickSub(updates.subscription_id, mapped.subscriptionId),
        freight_account: pickAcct(updates.freight_account, updates.stripe_account_id, mapped.freight_account),
        freightAccount: pickAcct(updates.freight_account, updates.stripe_account_id, mapped.freightAccount),
        stripe_account_id: pickAcct(updates.stripe_account_id, updates.freight_account, mapped.stripe_account_id),
        stripeAccountId: pickAcct(updates.stripe_account_id, updates.freight_account, mapped.stripeAccountId),
        membership_status: updates.membership_status || mapped.membership_status,
        membershipStatus: updates.membership_status || mapped.membershipStatus,
        subscription_status: updates.subscription_status || mapped.subscription_status,
        subscriptionStatus: updates.subscription_status || mapped.subscriptionStatus,
        account_active: true,
        accountActive: true,
      });
    }

    return ensureFreightUserAliases(mapped);
  }

  async function completeFreightLoginFromSubscription(user: FreightUser, authUserId: string, loginEmail: string) {
    const subscription = await findSubscription(user.id || authUserId, loginEmail);

    const finalId = clean(user.id || authUserId || subscription?.freight_id);
    const finalEmail = normalize(user.email || loginEmail || subscription?.freight_email);

    let finalAccountId = accountIdOf(user);

    if (!finalAccountId && finalId) {
      const { data } = await supabase
        .from("freight_users")
        .select("account_id")
        .or(`id.eq.${finalId},freight_id.eq.${finalId},auth_user_id.eq.${finalId},profile_id.eq.${finalId}`)
        .limit(1);

      if (Array.isArray(data) && data[0]?.account_id) finalAccountId = clean(data[0].account_id);
    }

    if (!finalAccountId && finalEmail) {
      const { data } = await supabase
        .from("freight_users")
        .select("account_id")
        .eq("email", finalEmail)
        .limit(1);

      if (Array.isArray(data) && data[0]?.account_id) finalAccountId = clean(data[0].account_id);
    }

    if (!finalAccountId) finalAccountId = await generateFreightAccountId();

    const finalCustomerId = pickCus(subscription?.stripe_customer_id, customerIdOf(user));
    const finalSubscriptionId = pickSub(subscription?.stripe_subscription_id, subscriptionIdOf(user));
    const finalConnectAccount = pickAcct(subscription?.stripe_account_id, subscription?.freight_account, connectIdOf(user));

    const finalSubscriptionStatus =
      subscription?.subscription_status ||
      user.subscription_status ||
      user.subscriptionStatus ||
      (finalSubscriptionId ? "active" : "pending");

    const completed = Boolean(finalId && finalAccountId && finalCustomerId && finalSubscriptionId && finalConnectAccount);

    const completedUser = ensureFreightUserAliases({
      ...user,
      id: finalId,
      freightId: finalId,
      freight_id: finalId,
      authUserId: clean(user.authUserId || user.auth_user_id || authUserId || finalId),
      auth_user_id: clean(user.auth_user_id || user.authUserId || authUserId || finalId),
      profileId: clean(user.profileId || user.profile_id || finalId),
      profile_id: clean(user.profile_id || user.profileId || finalId),

      accountId: finalAccountId,
      account_id: finalAccountId,
      email: finalEmail,

      stripeCustomerId: finalCustomerId,
      stripe_customer_id: finalCustomerId,
      stripeSubscriptionId: finalSubscriptionId,
      stripe_subscription_id: finalSubscriptionId,
      subscriptionId: finalSubscriptionId,
      subscription_id: finalSubscriptionId,
      freightAccount: finalConnectAccount,
      freight_account: finalConnectAccount,
      stripeAccountId: finalConnectAccount,
      stripe_account_id: finalConnectAccount,

      accountActive: completed,
      account_active: completed,
      membershipStatus: finalSubscriptionId ? "active" : "pending",
      membership_status: finalSubscriptionId ? "active" : "pending",
      subscriptionStatus: finalSubscriptionStatus,
      subscription_status: finalSubscriptionStatus,
      approved: completed,
      registrationComplete: completed,
      registration_complete: completed,
      applicationSubmitted: completed,
      application_submitted: completed,
    });

    const now = new Date().toISOString();

    if (finalId) {
      const freightPayload = {
        id: finalId,
        freight_id: finalId,
        profile_id: finalId,
        auth_user_id: authUserId || finalId,
        role: "freight",
        account_id: finalAccountId,
        email: finalEmail,
        company_name: completedUser.company_name || completedUser.companyName || subscription?.name || "Freight Carrier",
        business_name: completedUser.business_name || completedUser.businessName || subscription?.name || "Freight Carrier",
        contact_name:
          completedUser.contact_name ||
          completedUser.contactName ||
          completedUser.full_name ||
          completedUser.fullName ||
          "",
        full_name:
          completedUser.full_name ||
          completedUser.fullName ||
          completedUser.contact_name ||
          completedUser.contactName ||
          "",
        phone: completedUser.phone || "",
        username: completedUser.username || subscription?.username || "",
        stripe_customer_id: finalCustomerId || null,
        stripe_subscription_id: finalSubscriptionId || null,
        subscription_id: finalSubscriptionId || null,
        freight_account: finalConnectAccount || null,
        stripe_account_id: finalConnectAccount || null,
        stripe_connect_status: finalConnectAccount ? "started" : "not_started",
        account_active: completed,
        approved: completed,
        registration_complete: completed,
        application_submitted: completed,
        freight_membership_paid: Boolean(finalSubscriptionId),
        membership_status: finalSubscriptionId ? "active" : "pending_payment",
        subscription_status: finalSubscriptionStatus,
        verification_status: completed ? "SUBMITTED" : "REGISTERED",
        compliance_status: completed ? "SUBMITTED" : "PENDING_PAYMENT",
        admin_review_status: completed ? "submitted" : "pending_payment",
        updated_at: now,
      };

      await supabase.from("freight_users").upsert(freightPayload, { onConflict: "id" });

      try {
        await supabase.from("profiles").upsert(
          {
            id: finalId,
            auth_user_id: authUserId || finalId,
            profile_id: finalId,
            role: "freight",
            account_id: finalAccountId,
            email: finalEmail,
            full_name: freightPayload.full_name,
            name: freightPayload.full_name,
            username: freightPayload.username,
            company_name: freightPayload.company_name,
            stripe_customer_id: finalCustomerId || null,
            stripe_subscription_id: finalSubscriptionId || null,
            subscription_id: finalSubscriptionId || null,
            freight_account: finalConnectAccount || null,
            stripe_account_id: finalConnectAccount || null,
            account_active: completed,
            registration_complete: completed,
            application_submitted: completed,
            membership_status: finalSubscriptionId ? "active" : "pending_payment",
            subscription_status: finalSubscriptionStatus,
            updated_at: now,
          },
          { onConflict: "id" }
        );
      } catch (error) {
        console.log("Freight login profile upsert skipped:", error);
      }

      if (finalCustomerId || finalSubscriptionId || finalConnectAccount) {
        const subscriptionPayload = {
          freight_id: finalId,
          freight_email: finalEmail,
          name: freightPayload.company_name,
          username: freightPayload.username,
          stripe_customer_id: finalCustomerId || null,
          stripe_subscription_id: finalSubscriptionId || null,
          subscription_status: finalSubscriptionStatus,
          stripe_account_id: finalConnectAccount || null,
          freight_account: finalConnectAccount || null,
          updated_at: now,
        };

        const { data: existingSub } = await supabase
          .from("freight_subscriptions")
          .select("id")
          .or(`freight_id.eq.${finalId},freight_email.eq.${finalEmail}`)
          .limit(1);

        if (Array.isArray(existingSub) && existingSub[0]?.id) {
          await supabase.from("freight_subscriptions").update(subscriptionPayload).eq("id", existingSub[0].id);
        } else {
          await supabase.from("freight_subscriptions").insert({
            ...subscriptionPayload,
            created_at: now,
          });
        }
      }
    }

    return ensureFreightUserAliases(completedUser);
  }

  async function activateCompletedFreightAccount(user: FreightUser) {
    const fixed = ensureFreightUserAliases(user);

    if (!hasAllFiveFreightRequirements(fixed)) return fixed;

    const now = new Date().toISOString();

    const activePayload = {
      account_active: true,
      approved: true,
      registration_complete: true,
      application_submitted: true,
      freight_membership_paid: true,
      membership_status: "active",
      subscription_status: fixed.subscription_status || fixed.subscriptionStatus || "active",
      verification_status: "SUBMITTED",
      compliance_status: "SUBMITTED",
      admin_review_status: "submitted",
      stripe_customer_id: customerIdOf(fixed),
      stripe_subscription_id: subscriptionIdOf(fixed),
      subscription_id: subscriptionIdOf(fixed),
      freight_account: connectIdOf(fixed),
      stripe_account_id: connectIdOf(fixed),
      updated_at: now,
    };

    await supabase.from("freight_users").update(activePayload).eq("id", fixed.id);

    try {
      await supabase
        .from("profiles")
        .update({
          account_active: true,
          registration_complete: true,
          application_submitted: true,
          membership_status: "active",
          subscription_status: activePayload.subscription_status,
          stripe_customer_id: activePayload.stripe_customer_id,
          stripe_subscription_id: activePayload.stripe_subscription_id,
          subscription_id: activePayload.subscription_id,
          stripe_account_id: activePayload.stripe_account_id,
          freight_account: activePayload.freight_account,
          updated_at: now,
        })
        .or(`id.eq.${fixed.id},auth_user_id.eq.${fixed.id},profile_id.eq.${fixed.id}`);
    } catch (error) {
      console.log("profiles active sync skipped:", error);
    }

    try {
      await supabase
        .from("freight_subscriptions")
        .update({
          stripe_customer_id: activePayload.stripe_customer_id,
          stripe_subscription_id: activePayload.stripe_subscription_id,
          subscription_status: activePayload.subscription_status,
          stripe_account_id: activePayload.stripe_account_id,
          freight_account: activePayload.freight_account,
          updated_at: now,
        })
        .or(`freight_id.eq.${fixed.id},freight_email.eq.${fixed.email}`);
    } catch (error) {
      console.log("freight_subscriptions active sync skipped:", error);
    }

    return ensureFreightUserAliases({
      ...fixed,
      accountActive: true,
      account_active: true,
      approved: true,
      registrationComplete: true,
      registration_complete: true,
      applicationSubmitted: true,
      application_submitted: true,
      membershipStatus: "active",
      membership_status: "active",
      subscriptionStatus: activePayload.subscription_status,
      subscription_status: activePayload.subscription_status,
      stripeCustomerId: activePayload.stripe_customer_id,
      stripe_customer_id: activePayload.stripe_customer_id,
      stripeSubscriptionId: activePayload.stripe_subscription_id,
      stripe_subscription_id: activePayload.stripe_subscription_id,
      subscriptionId: activePayload.subscription_id,
      subscription_id: activePayload.subscription_id,
      freightAccount: activePayload.freight_account,
      freight_account: activePayload.freight_account,
      stripeAccountId: activePayload.stripe_account_id,
      stripe_account_id: activePayload.stripe_account_id,
    });
  }

  async function touchLastLogin(user: FreightUser) {
    const fixed = ensureFreightUserAliases(user);
    const now = new Date().toISOString();

    await supabase
      .from("freight_users")
      .update({
        last_login_at: now,
        account_active: true,
        updated_at: now,
      })
      .eq("id", fixed.id);

    try {
      await supabase
        .from("profiles")
        .update({
          account_active: true,
          last_login_at: now,
        })
        .or(`id.eq.${fixed.id},auth_user_id.eq.${fixed.id},profile_id.eq.${fixed.id}`);
    } catch (error) {
      console.log("profiles last login update skipped:", error);
    }
  }

  async function openFreightDashboard(user: FreightUser) {
    if (routingLockedRef.current) return;

    const fixed = ensureFreightUserAliases(user);

    routingLockedRef.current = true;
    setNavigatingToDashboard(true);
    setLastCheckedUser(fixed);

    const savedUser = await saveFreightSession(fixed);
    await touchLastLogin(savedUser);

    setTimeout(() => {
      router.replace(DASHBOARD_ROUTE as any);
    }, 150);
  }

  async function previewFreightAccessByEmail(inputEmail: string) {
    const cleanEmail = normalize(inputEmail);
    if (!cleanEmail || !cleanEmail.includes("@")) return;

    try {
      const mappedUser = await findFreightProfile("", cleanEmail);
      if (mappedUser) setLastCheckedUser(ensureFreightUserAliases(mappedUser));
    } catch (error) {
      console.log("Freight preview access check skipped:", error);
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

      const userId = clean(data?.user?.id);

      if (!userId) {
        Alert.alert("Login Error", "Unable to confirm freight account.");
        return;
      }

      const subscriptionFirst = await findSubscription(userId, cleanEmail);
      const subscriptionCustomerId = pickCus(subscriptionFirst?.stripe_customer_id);
      const subscriptionSubscriptionId = pickSub(subscriptionFirst?.stripe_subscription_id);
      const subscriptionConnectAccount = pickAcct(subscriptionFirst?.stripe_account_id, subscriptionFirst?.freight_account);

      if (subscriptionCustomerId && subscriptionSubscriptionId && subscriptionConnectAccount) {
        const existingProfile = await findProfile(userId, cleanEmail);

        const subscriptionUser = mapCarrierToFreightUser(
          {
            id: userId,
            freight_id: userId,
            auth_user_id: userId,
            profile_id: userId,
            role: "freight",
            account_id: existingProfile?.account_id || "",
            company_name:
              existingProfile?.company_name ||
              existingProfile?.business_name ||
              subscriptionFirst?.name ||
              "Freight Carrier",
            business_name:
              existingProfile?.business_name ||
              existingProfile?.company_name ||
              subscriptionFirst?.name ||
              "Freight Carrier",
            contact_name: existingProfile?.full_name || existingProfile?.name || subscriptionFirst?.name || "",
            full_name: existingProfile?.full_name || existingProfile?.name || subscriptionFirst?.name || "",
            email: cleanEmail,
            phone: existingProfile?.phone || "",
            username: existingProfile?.username || subscriptionFirst?.username || "",
            account_active: true,
            approved: true,
            registration_complete: true,
            application_submitted: true,
            membership_status: "active",
            subscription_status: subscriptionFirst?.subscription_status || "active",
            stripe_customer_id: subscriptionCustomerId,
            stripe_subscription_id: subscriptionSubscriptionId,
            subscription_id: subscriptionSubscriptionId,
            freight_account: subscriptionConnectAccount,
            stripe_account_id: subscriptionConnectAccount,
          },
          existingProfile,
          subscriptionFirst
        );

        const completedUser = await completeFreightLoginFromSubscription(subscriptionUser, userId, cleanEmail);
        const activeUser = await activateCompletedFreightAccount(completedUser);
        const fixedActiveUser = ensureFreightUserAliases(activeUser);

        setLastCheckedUser(fixedActiveUser);
        await saveFreightSession(fixedActiveUser);

        if (hasDashboardAccess(fixedActiveUser)) {
          await openFreightDashboard(fixedActiveUser);
          return;
        }
      }

      const mappedUser = await findFreightProfile(userId, cleanEmail);

      if (!mappedUser) {
        const emptyUser = buildEmptyFreightUser(userId, cleanEmail);
        const completedUser = await completeFreightLoginFromSubscription(emptyUser, userId, cleanEmail);
        const activeUser = await activateCompletedFreightAccount(completedUser);
        const fixedActiveUser = ensureFreightUserAliases(activeUser);

        setLastCheckedUser(fixedActiveUser);
        await saveFreightSession(fixedActiveUser);

        if (hasDashboardAccess(fixedActiveUser)) {
          await openFreightDashboard(fixedActiveUser);
          return;
        }

        Alert.alert(
          "Freight Profile Missing",
          "Your login exists, but the freight setup is incomplete. Registration will open with your saved email."
        );

        router.replace({
          pathname: REGISTER_ROUTE as any,
          params: { freightId: userId, email: cleanEmail },
        });
        return;
      }

      const completedUser = await completeFreightLoginFromSubscription(mappedUser, userId, cleanEmail);
      const activeUser = await activateCompletedFreightAccount(completedUser);
      const fixedActiveUser = ensureFreightUserAliases(activeUser);

      setLastCheckedUser(fixedActiveUser);
      await saveFreightSession(fixedActiveUser);

      if (hasDashboardAccess(fixedActiveUser)) {
        await openFreightDashboard(fixedActiveUser);
        return;
      }

      const missingItems = [
        !fixedActiveUser.id ? "Freight Profile ID" : "",
        !accountIdOf(fixedActiveUser) ? "Static Account ID" : "",
        !isCus(customerIdOf(fixedActiveUser)) ? "Stripe Customer ID" : "",
        !isSub(subscriptionIdOf(fixedActiveUser)) ? "Stripe Subscription ID" : "",
        !isAcct(connectIdOf(fixedActiveUser)) ? "Stripe Connect Account ID" : "",
      ].filter(Boolean);

      Alert.alert(
        "Finish Freight Setup",
        `Your freight profile was found, but this setup is missing: ${missingItems.join(
          ", "
        )}. Registration will open with your saved information.`
      );

      router.replace({
        pathname: REGISTER_ROUTE as any,
        params: {
          freightId: fixedActiveUser.id || userId,
          email: fixedActiveUser.email || cleanEmail,
        },
      });
    } catch (error: any) {
      console.log("Freight login error:", error);
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

              <SideFeature icon="grid-outline" title="Dashboard-first access" body="Completed freight profiles route directly to the carrier dashboard." />
              <SideFeature icon="card-outline" title="Stripe verified" body="Customer, subscription, and Connect account IDs are checked at login." />
              <SideFeature icon="business-outline" title="Carrier workspace" body="Manage load board, live routes, payouts, alerts, and profile setup." />

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
                <MetricCard icon="person-circle-outline" label="Profile" value={lastCheckedUser?.companyName || "Carrier"} />
                <MetricCard icon="business-outline" label="Account" value={lastCheckedUser ? accountIdOf(lastCheckedUser) || "Freight ID" : "Freight ID"} />
                <MetricCard icon="shield-checkmark-outline" label="Access" value={lastCheckedUser && hasDashboardAccess(lastCheckedUser) ? "Ready" : "Check Login"} />
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

                  <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push(REGISTER_ROUTE as any)} activeOpacity={0.9}>
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

            <TouchableOpacity style={[styles.primaryButton, resetLoading && styles.disabledButton]} onPress={handlePasswordReset} disabled={resetLoading} activeOpacity={0.9}>
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
  sideFeatureTitle: { color: COLORS.white, fontWeight: "900", marginBottom: 4 },
  sideFeatureBody: { color: "#CBD5E1", fontWeight: "700", lineHeight: 19, fontSize: 12 },
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
  pageSubtitle: { color: COLORS.muted, fontWeight: "700", lineHeight: 22, marginTop: 7, maxWidth: 680 },
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
  statusDot: { width: 8, height: 8, borderRadius: 999, backgroundColor: COLORS.green },
  statusBadgeText: { color: COLORS.greenDark, fontWeight: "900" },
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
  metricValue: { color: COLORS.text, fontWeight: "900", marginTop: 3 },
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
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 },
  cardIcon: {
    width: 46,
    height: 46,
    borderRadius: 17,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  cardIconSoft: { backgroundColor: COLORS.primarySoft },
  cardTitle: { color: COLORS.text, fontSize: 22, fontWeight: "900" },
  cardSubtitle: { color: COLORS.muted, fontWeight: "700", marginTop: 3, lineHeight: 19 },
  inputLabel: { color: COLORS.text, fontWeight: "900", marginBottom: 8 },
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
  input: { flex: 1, color: COLORS.text, fontWeight: "800", paddingVertical: 15 },
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
  primaryButtonText: { color: COLORS.white, fontWeight: "900", fontSize: 15, textAlign: "center", flexShrink: 1 },
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
  readyBannerText: { color: COLORS.greenDark, fontWeight: "900", flex: 1, lineHeight: 19 },
  textButton: { alignItems: "center", marginTop: 15 },
  textButtonText: { color: COLORS.primary, fontWeight: "900" },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 18 },
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
  secondaryButtonText: { color: COLORS.primary, fontWeight: "900", textAlign: "center", flexShrink: 1 },
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
  accessGood: { backgroundColor: COLORS.green },
  accessMissing: { backgroundColor: "#E2E8F0" },
  accessLabel: { color: COLORS.text, fontWeight: "900" },
  accessValue: { color: COLORS.muted, fontWeight: "700", marginTop: 2 },
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
  noteText: { color: COLORS.primaryDark, fontWeight: "800", lineHeight: 20, flex: 1 },
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
  modalTitle: { color: COLORS.text, fontSize: 26, fontWeight: "900", textAlign: "center" },
  modalSubtitle: {
    color: COLORS.muted,
    textAlign: "center",
    lineHeight: 22,
    marginVertical: 14,
    fontWeight: "700",
  },
  closeButton: { marginTop: 16, alignItems: "center" },
  closeText: { color: COLORS.red, fontWeight: "900" },
});