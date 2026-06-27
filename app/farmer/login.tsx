// app/farmer/login.tsx

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
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
 * Farmer login updated to match the Freight login pattern.
 *
 * Required Supabase tables:
 * - public.farmers
 * - public.profiles
 * - public.farmer_subscriptions
 *
 * public.farmer_subscriptions currently has:
 * - id uuid
 * - farmer_id text
 * - farmer_email text
 * - name text
 * - username text
 * - stripe_customer_id text
 * - stripe_subscription_id text
 * - subscription_status text
 * - current_period_end timestamp
 * - created_at timestamp
 * - updated_at timestamp
 *
 * Recommended added farmer document columns on farmers table:
 * - farm_business_license_document text
 * - food_safety_document text
 * - product_liability_insurance_document text
 * - w9_document text
 * - farm_permit_document text
 * - organic_certification_document text nullable
 * - meat_dairy_license_document text nullable
 * - produce_safety_certificate_document text nullable
 */

type FarmerUser = {
  id: string;
  farmer_id: string;
  auth_user_id: string;
  profile_id: string;
  role: "farmer";

  email: string;
  account_id: string;

  farm_name: string;
  business_name: string;
  company_name: string;
  owner_name: string;
  full_name: string;
  name: string;
  username: string;
  phone: string;
  state: string;

  stripe_customer_id: string;
  stripe_subscription_id: string;
  subscription_id: string;
  subscription_status: string;
  membership_status: string;

  status: string;
  account_active: boolean;
  approved: boolean;
  rejected?: boolean;
  reviewed?: boolean;
  needs_more_info?: boolean;
  farmer_membership_paid: boolean;
  store_unlocked: boolean;
  compliance_submitted: boolean;
  has_completed_compliance: boolean;

  verification_status: string;
  compliance_status: string;
  admin_review_status: string;
  review_decision: string;

  farm_business_license_document: string;
  food_safety_document: string;
  product_liability_insurance_document: string;
  w9_document: string;
  farm_permit_document: string;
  organic_certification_document: string;
  meat_dairy_license_document: string;
  produce_safety_certificate_document: string;

  created_at?: string;
  updated_at?: string;

  farmerId?: string;
  accountId?: string;
  farmName?: string;
  businessName?: string;
  ownerName?: string;
  fullName?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionId?: string;
  accountActive?: boolean;
  membershipStatus?: string;
};

const COLORS = {
  bg: "#F4F8F1",
  card: "#FFFFFF",
  panel: "#F8FAFC",
  text: "#102A1C",
  muted: "#66756B",
  border: "#DDE8D8",
  borderDark: "#CBD5E1",
  primary: "#166534",
  primaryDark: "#14532D",
  primarySoft: "#ECFDF5",
  gold: "#F59E0B",
  danger: "#B91C1C",
  green: "#16A34A",
  navy: "#020617",
  white: "#FFFFFF",
};

const DASHBOARD_ROUTE = "/farmer/dashboard" as const;
const REGISTER_ROUTE = "/farmer/register" as const;
const RESET_REDIRECT = "farm2home://reset-password";

function clean(value: any) {
  return String(value ?? "").trim();
}

function normalize(value: any) {
  return clean(value).toLowerCase();
}

function isEmail(value: any) {
  return normalize(value).includes("@");
}

function isUuid(value: any) {
  const v = clean(value);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(v);
}

function isCus(value: any) {
  return clean(value).startsWith("cus_");
}

function isSub(value: any) {
  return clean(value).startsWith("sub_");
}

function pickCus(...values: any[]) {
  const found = values.find((value) => isCus(value));
  return found ? clean(found) : "";
}

function pickSub(...values: any[]) {
  const found = values.find((value) => isSub(value));
  return found ? clean(found) : "";
}

function normalizeStatus(value: any) {
  return clean(value || "").toUpperCase();
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

function getCustomerId(row: any) {
  return pickCus(row?.stripe_customer_id, row?.stripeCustomerId);
}

function buildFarmerUser(row: any): FarmerUser {
  const id = clean(row?.id || row?.farmer_id || row?.farmerId);
  const farmerId = clean(row?.farmer_id || row?.farmerId || row?.id);
  const farmName = clean(row?.farm_name || row?.farmName || row?.business_name || row?.businessName || "Farm Seller");
  const businessName = clean(row?.business_name || row?.businessName || farmName);
  const ownerName = clean(row?.owner_name || row?.ownerName || row?.full_name || row?.name || farmName);
  const customerId = getCustomerId(row);
  const subscriptionId = getSubscriptionId(row);
  const status = clean(row?.membership_status || row?.subscription_status || (subscriptionId ? "active" : "pending_payment"));

  return {
    id,
    farmer_id: farmerId,
    auth_user_id: clean(row?.auth_user_id || row?.authUserId || id),
    profile_id: clean(row?.profile_id || row?.profileId || id),
    role: "farmer",

    email: normalize(row?.email || row?.farmer_email),
    account_id: clean(row?.account_id || row?.accountId),

    farm_name: farmName,
    business_name: businessName,
    company_name: clean(row?.company_name || row?.companyName || businessName),
    owner_name: ownerName,
    full_name: clean(row?.full_name || row?.fullName || ownerName),
    name: clean(row?.name || ownerName),
    username: clean(row?.username),
    phone: clean(row?.phone),
    state: clean(row?.state || "MI"),

    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    subscription_id: subscriptionId,
    subscription_status: clean(row?.subscription_status || row?.subscriptionStatus || status),
    membership_status: status,
    status: clean(row?.status || row?.verification_status || row?.compliance_status || status),

    account_active: row?.account_active !== false,
    approved: row?.approved !== false,
    farmer_membership_paid: row?.farmer_membership_paid !== false && Boolean(subscriptionId),
    store_unlocked: row?.store_unlocked !== false,
    compliance_submitted: Boolean(row?.compliance_submitted || row?.complianceSubmitted),
    has_completed_compliance: Boolean(row?.has_completed_compliance || row?.hasCompletedCompliance),

    verification_status: clean(row?.verification_status || "REGISTERED"),
    compliance_status: clean(row?.compliance_status || "PENDING_PAYMENT"),
    admin_review_status: clean(row?.admin_review_status || "pending_payment"),
    review_decision: clean(row?.review_decision || "pending_payment"),

    farm_business_license_document: clean(row?.farm_business_license_document || row?.farmBusinessLicenseDocument),
    food_safety_document: clean(row?.food_safety_document || row?.foodSafetyDocument),
    product_liability_insurance_document: clean(row?.product_liability_insurance_document || row?.productLiabilityInsuranceDocument),
    w9_document: clean(row?.w9_document || row?.w9Document),
    farm_permit_document: clean(row?.farm_permit_document || row?.farmPermitDocument),
    organic_certification_document: clean(row?.organic_certification_document || row?.organicCertificationDocument),
    meat_dairy_license_document: clean(row?.meat_dairy_license_document || row?.meatDairyLicenseDocument),
    produce_safety_certificate_document: clean(row?.produce_safety_certificate_document || row?.produceSafetyCertificateDocument),

    created_at: row?.created_at,
    updated_at: row?.updated_at,

    farmerId,
    accountId: clean(row?.account_id || row?.accountId),
    farmName,
    businessName,
    ownerName,
    fullName: clean(row?.full_name || row?.fullName || ownerName),
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    subscriptionId,
    accountActive: row?.account_active !== false,
    membershipStatus: status,
  };
}

function hasRequiredDocuments(user: FarmerUser | null) {
  if (!user) return false;

  return Boolean(
    clean(user.farm_business_license_document) &&
      clean(user.food_safety_document) &&
      clean(user.product_liability_insurance_document) &&
      clean(user.w9_document) &&
      clean(user.farm_permit_document)
  );
}

function hasDashboardAccess(user: FarmerUser | null) {
  if (!user) return false;

  const rejected =
    normalizeStatus(user.review_decision) === "REJECTED" ||
    normalizeStatus(user.admin_review_status) === "REJECTED" ||
    normalizeStatus(user.compliance_status) === "REJECTED";

  return Boolean(
    clean(user.id) &&
      clean(user.account_id) &&
      isCus(user.stripe_customer_id) &&
      isSub(user.subscription_id) &&
      hasRequiredDocuments(user) &&
      !valueIsFalse(user.account_active) &&
      statusIsGood(user.membership_status || user.subscription_status || "active") &&
      !rejected
  );
}

function getMissingAccessItems(user: FarmerUser | null) {
  if (!user) {
    return [
      "Farmer Profile",
      "Static Account ID",
      "Stripe Customer ID",
      "Subscription ID",
      "Farmer Documents",
    ];
  }

  return [
    !clean(user.id) ? "Farmer Profile" : "",
    !clean(user.account_id) ? "Static Account ID" : "",
    !isCus(user.stripe_customer_id) ? "Stripe Customer ID" : "",
    !isSub(user.subscription_id) ? "Subscription ID" : "",
    !clean(user.farm_business_license_document) ? "Farm Business License" : "",
    !clean(user.food_safety_document) ? "Food Safety / Cottage Food Document" : "",
    !clean(user.product_liability_insurance_document) ? "Product Liability Insurance" : "",
    !clean(user.w9_document) ? "W-9 Form" : "",
    !clean(user.farm_permit_document) ? "Farm Permit / Producer Certificate" : "",
  ].filter(Boolean);
}

export default function FarmerLoginScreen() {
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const [resetVisible, setResetVisible] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [lastCheckedUser, setLastCheckedUser] = useState<FarmerUser | null>(null);
  const [navigatingToDashboard, setNavigatingToDashboard] = useState(false);

  const routingLockedRef = useRef(false);
  const previewTimerRef = useRef<any>(null);

  const accessStatus = useMemo(() => {
    if (!lastCheckedUser) {
      return [
        { label: "Farmer Profile", complete: false, value: "Login to check" },
        { label: "Static Account", complete: false, value: "Login to check" },
        { label: "Stripe Customer", complete: false, value: "Login to check" },
        { label: "Subscription", complete: false, value: "Login to check" },
        { label: "Documents", complete: false, value: "Login to check" },
      ];
    }

    return [
      { label: "Farmer Profile", complete: Boolean(lastCheckedUser.id), value: lastCheckedUser.id ? "Found" : "Missing" },
      { label: "Static Account", complete: Boolean(lastCheckedUser.account_id), value: lastCheckedUser.account_id || "Missing" },
      { label: "Stripe Customer", complete: isCus(lastCheckedUser.stripe_customer_id), value: maskId(lastCheckedUser.stripe_customer_id) },
      { label: "Subscription", complete: isSub(lastCheckedUser.subscription_id), value: maskId(lastCheckedUser.subscription_id) },
      { label: "Documents", complete: hasRequiredDocuments(lastCheckedUser), value: hasRequiredDocuments(lastCheckedUser) ? "Complete" : "Missing" },
    ];
  }, [lastCheckedUser]);

  async function saveFarmerSession(farmer: FarmerUser) {
    const localFarmer = {
      ...farmer,
      role: "farmer" as const,
      farmerId: farmer.farmer_id || farmer.id,
      farmer_id: farmer.farmer_id || farmer.id,
      profileId: farmer.profile_id,
      profile_id: farmer.profile_id,
      accountId: farmer.account_id,
      account_id: farmer.account_id,
      farmName: farmer.farm_name,
      farm_name: farmer.farm_name,
      businessName: farmer.business_name,
      business_name: farmer.business_name,
      ownerName: farmer.owner_name,
      owner_name: farmer.owner_name,
      fullName: farmer.full_name,
      full_name: farmer.full_name,
      stripeCustomerId: farmer.stripe_customer_id,
      stripe_customer_id: farmer.stripe_customer_id,
      stripeSubscriptionId: farmer.subscription_id,
      stripe_subscription_id: farmer.subscription_id,
      subscriptionId: farmer.subscription_id,
      subscription_id: farmer.subscription_id,
      accountActive: farmer.account_active,
      account_active: farmer.account_active,
      membershipStatus: farmer.membership_status,
      membership_status: farmer.membership_status,
      dashboardReady: hasDashboardAccess(farmer),
      updatedAt: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await AsyncStorage.multiSet([
      ["currentFarmer", JSON.stringify(localFarmer)],
      ["pendingFarmerApplication", JSON.stringify(localFarmer)],
      ["currentFarmerUser", JSON.stringify(localFarmer)],
      ["farm2homeCurrentFarmer", JSON.stringify(localFarmer)],
      ["currentUser", JSON.stringify(localFarmer)],
      ["userRole", "farmer"],
      ["currentUserRole", "farmer"],
      ["lastLoginRole", "farmer"],
      ["lastFarmerDashboardReady", hasDashboardAccess(farmer) ? "true" : "false"],
    ]);

    return localFarmer;
  }

  async function findSubscription(userId: string, cleanEmail: string) {
    const filters = [userId ? `farmer_id.eq.${userId}` : "", cleanEmail ? `farmer_email.eq.${cleanEmail}` : ""]
      .filter(Boolean)
      .join(",");

    if (!filters) return null;

    const { data, error } = await supabase
      .from("farmer_subscriptions")
      .select("*")
      .or(filters)
      .order("updated_at", { ascending: false })
      .limit(10);

    if (error) {
      console.log("farmer_subscriptions lookup failed:", error.message);
      return null;
    }

    if (!Array.isArray(data) || data.length === 0) return null;

    const complete = data.find((row) => isCus(row?.stripe_customer_id) && isSub(row?.stripe_subscription_id));
    return complete || data[0];
  }

  async function findProfileByEmail(cleanEmail: string) {
    if (!cleanEmail) return null;

    const { data, error } = await supabase.from("profiles").select("*").eq("email", cleanEmail).maybeSingle();

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

  async function findFarmerUser(userId: string, cleanEmail: string) {
    if (userId) {
      const { data, error } = await supabase
        .from("farmers")
        .select("*")
        .or(`id.eq.${userId},farmer_id.eq.${userId},profile_id.eq.${userId}`)
        .maybeSingle();

      if (!error && data) return buildFarmerUser(data);
      if (error) console.log("farmers lookup by id failed:", error.message);
    }

    if (cleanEmail) {
      const { data, error } = await supabase.from("farmers").select("*").eq("email", cleanEmail).maybeSingle();

      if (!error && data) return buildFarmerUser(data);
      if (error) console.log("farmers lookup by email failed:", error.message);
    }

    return null;
  }

  async function ensureProfile(authUserId: string, cleanEmail: string, subscription: any, existingFarmer?: FarmerUser | null) {
    const profileByEmail = await findProfileByEmail(cleanEmail);
    const profileByAuth = profileByEmail ? null : await findProfileByAuthId(authUserId);
    const existingProfile = profileByEmail || profileByAuth;

    const fullName = clean(subscription?.name || existingProfile?.full_name || existingFarmer?.full_name || "Farm Seller");
    const accountId = clean(existingProfile?.account_id || existingFarmer?.account_id || "Farmer_001");

    const payload = {
      auth_user_id: authUserId,
      role: "farmer",
      full_name: fullName,
      name: fullName,
      email: cleanEmail,
      phone: existingFarmer?.phone || existingProfile?.phone || "",
      username: subscription?.username || existingFarmer?.username || existingProfile?.username || "",
      company_name: existingFarmer?.business_name || existingProfile?.company_name || fullName,
      account_id: accountId,
      updated_at: new Date().toISOString(),
    };

    if (existingProfile?.id) {
      const { data, error } = await supabase.from("profiles").update(payload).eq("id", existingProfile.id).select("*").maybeSingle();
      if (error) {
        console.log("profiles update failed:", error.message);
        Alert.alert("Profile Sync Failed", error.message);
        return existingProfile;
      }
      return data || existingProfile;
    }

    const { data, error } = await supabase
      .from("profiles")
      .insert({ id: authUserId, ...payload, created_at: new Date().toISOString() })
      .select("*")
      .maybeSingle();

    if (error) {
      console.log("profiles insert failed:", error.message);
      Alert.alert("Profile Create Failed", error.message);
      return null;
    }

    return data;
  }

  async function syncFarmerUser(authUserId: string, cleanEmail: string) {
    const existingFarmer = await findFarmerUser(authUserId, cleanEmail);
    const subscription = await findSubscription(authUserId, cleanEmail);

    if (!subscription && existingFarmer) {
      setLastCheckedUser(existingFarmer);
      return existingFarmer;
    }

    if (!subscription) return existingFarmer;

    const profile = await ensureProfile(authUserId, cleanEmail, subscription, existingFarmer);
    const profileId = clean(profile?.id || existingFarmer?.profile_id || authUserId);
    const accountId = clean(profile?.account_id || existingFarmer?.account_id || "Farmer_001");
    const customerId = pickCus(subscription?.stripe_customer_id, existingFarmer?.stripe_customer_id);
    const subscriptionId = pickSub(subscription?.stripe_subscription_id, existingFarmer?.subscription_id);
    const complete = Boolean(customerId && subscriptionId && hasRequiredDocuments(existingFarmer || null));

    const payload: any = {
      id: authUserId,
      farmer_id: authUserId,
      auth_user_id: authUserId,
      profile_id: profileId,
      role: "farmer",
      email: cleanEmail,
      account_id: accountId,

      farm_name: existingFarmer?.farm_name || subscription?.name || profile?.company_name || "Farm Seller",
      business_name: existingFarmer?.business_name || subscription?.name || profile?.company_name || "Farm Seller",
      company_name: existingFarmer?.company_name || existingFarmer?.business_name || subscription?.name || profile?.company_name || "Farm Seller",
      owner_name: existingFarmer?.owner_name || subscription?.name || profile?.full_name || "Farm Seller",
      full_name: existingFarmer?.full_name || subscription?.name || profile?.full_name || "Farm Seller",
      name: existingFarmer?.name || subscription?.name || profile?.full_name || "Farm Seller",
      username: existingFarmer?.username || subscription?.username || "",
      phone: existingFarmer?.phone || profile?.phone || "",
      state: existingFarmer?.state || "MI",

      stripe_customer_id: customerId || null,
      stripe_subscription_id: subscriptionId || null,
      subscription_id: subscriptionId || null,
      subscription_status: subscription?.subscription_status || (subscriptionId ? "active" : "pending_payment"),
      membership_status: subscriptionId ? "active" : "pending_payment",

      account_active: complete,
      approved: complete,
      farmer_membership_paid: Boolean(subscriptionId),
      store_unlocked: complete,
      compliance_submitted: hasRequiredDocuments(existingFarmer || null),
      has_completed_compliance: hasRequiredDocuments(existingFarmer || null),

      verification_status: complete ? "SUBMITTED" : "REGISTERED",
      compliance_status: complete ? "SUBMITTED" : "PENDING_DOCUMENTS",
      admin_review_status: complete ? "submitted" : "pending_documents",
      review_decision: complete ? "submitted" : "pending_documents",

      farm_business_license_document: existingFarmer?.farm_business_license_document || null,
      food_safety_document: existingFarmer?.food_safety_document || null,
      product_liability_insurance_document: existingFarmer?.product_liability_insurance_document || null,
      w9_document: existingFarmer?.w9_document || null,
      farm_permit_document: existingFarmer?.farm_permit_document || null,
      organic_certification_document: existingFarmer?.organic_certification_document || null,
      meat_dairy_license_document: existingFarmer?.meat_dairy_license_document || null,
      produce_safety_certificate_document: existingFarmer?.produce_safety_certificate_document || null,

      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from("farmers").upsert(payload, { onConflict: "id" }).select("*").maybeSingle();

    if (error) {
      console.log("farmers upsert failed:", error.message);
      Alert.alert("Farmer Sync Failed", error.message);
      return existingFarmer;
    }

    const finalUser = buildFarmerUser(data || payload);
    setLastCheckedUser(finalUser);
    return finalUser;
  }

  async function touchLastLogin(user: FarmerUser) {
    const { error } = await supabase
      .from("farmers")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", user.id);

    if (error) console.log("farmer last login update skipped:", error.message);
  }

  async function openFarmerDashboard(user: FarmerUser) {
    if (routingLockedRef.current) return;

    routingLockedRef.current = true;
    setNavigatingToDashboard(true);
    setLastCheckedUser(user);

    await saveFarmerSession(user);
    await touchLastLogin(user);

    setTimeout(() => {
      router.replace(DASHBOARD_ROUTE as any);
    }, 120);
  }

  async function previewFarmerAccessByEmail(inputEmail: string) {
    const cleanEmail = normalize(inputEmail);
    if (!cleanEmail || !cleanEmail.includes("@")) return;

    try {
      const farmer = await findFarmerUser("", cleanEmail);
      if (farmer) {
        setLastCheckedUser(farmer);
        return;
      }

      const subscription = await findSubscription("", cleanEmail);
      if (subscription) {
        setLastCheckedUser(
          buildFarmerUser({
            id: subscription.farmer_id || "",
            farmer_id: subscription.farmer_id || "",
            email: subscription.farmer_email || cleanEmail,
            account_id: "",
            farm_name: subscription.name || "Farm Seller",
            business_name: subscription.name || "Farm Seller",
            owner_name: subscription.name || "Farm Seller",
            username: subscription.username || "",
            stripe_customer_id: subscription.stripe_customer_id,
            stripe_subscription_id: subscription.stripe_subscription_id,
            subscription_status: subscription.subscription_status || "active",
            account_active: false,
            approved: false,
          })
        );
      }
    } catch (error) {
      console.log("farmer preview check skipped:", error);
    }
  }

  useEffect(() => {
    const cleanEmail = normalize(loginId);
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setLastCheckedUser(null);
      return;
    }

    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(() => previewFarmerAccessByEmail(cleanEmail), 650);

    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    };
  }, [loginId]);

  function routeIncompleteFarmer(user: FarmerUser, missing: string[]) {
    Alert.alert("Finish Farmer Setup", `Your account was found, but this setup is missing: ${missing.join(", ")}.`);

    router.replace({
      pathname: REGISTER_ROUTE as any,
      params: {
        farmerId: user.id || user.farmer_id || "",
        farmer_id: user.id || user.farmer_id || "",
        email: user.email || "",
      },
    });
  }

  async function handleLogin() {
    const cleanLogin = normalize(loginId);
    const cleanPassword = clean(password);

    if (!cleanLogin || !cleanPassword) {
      Alert.alert("Missing Information", "Enter email and password.");
      return;
    }

    if (!isEmail(cleanLogin)) {
      Alert.alert("Email Required", "Please enter the email connected to your farmer account.");
      return;
    }

    try {
      setLoading(true);
      routingLockedRef.current = false;

      const { data, error } = await supabase.auth.signInWithPassword({ email: cleanLogin, password: cleanPassword });

      if (error) {
        Alert.alert("Login Failed", error.message);
        return;
      }

      const authUserId = clean(data?.user?.id);
      const authEmail = normalize(data?.user?.email || cleanLogin);

      if (!authUserId) {
        Alert.alert("Login Error", "Unable to confirm farmer account.");
        return;
      }

      const farmer = await syncFarmerUser(authUserId, authEmail);

      if (!farmer) {
        Alert.alert("Farmer Setup Missing", "Your login exists, but no farmer subscription or farmer profile was found. Registration will open.");
        router.replace({ pathname: REGISTER_ROUTE as any, params: { farmerId: authUserId, email: authEmail } });
        return;
      }

      setLastCheckedUser(farmer);
      await saveFarmerSession(farmer);

      const status = normalizeStatus(farmer.status || farmer.verification_status || farmer.compliance_status);
      const rejected =
        status === "REJECTED" ||
        normalizeStatus(farmer.review_decision) === "REJECTED" ||
        normalizeStatus(farmer.admin_review_status) === "REJECTED";

      if (rejected) {
        Alert.alert("Application Rejected", "This farmer application was rejected. Contact Farm2Home support.");
        return;
      }

      if (hasDashboardAccess(farmer)) {
        await openFarmerDashboard(farmer);
        return;
      }

      routeIncompleteFarmer(farmer, getMissingAccessItems(farmer));
    } catch (error: any) {
      console.log("Farmer login error:", error);
      Alert.alert("Login Error", error?.message || "Unable to login.");
    } finally {
      if (!routingLockedRef.current) setLoading(false);
    }
  }

  async function handlePasswordReset() {
    const cleanEmail = normalize(resetEmail || loginId);

    if (!cleanEmail || !isEmail(cleanEmail)) {
      Alert.alert("Email Required", "Enter your farmer email.");
      return;
    }

    try {
      setResetLoading(true);

      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, { redirectTo: RESET_REDIRECT });
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
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>FARM2HOME FARMER PORTAL</Text>
          </View>
          <Text style={styles.heroIcon}>🌾</Text>
          <Text style={styles.heroTitle}>Welcome Back, Farmer</Text>
          <Text style={styles.heroSubtitle}>
            Login verifies your farmer profile, subscription, and required seller documents before dashboard access.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Farmer Login</Text>
          <Text style={styles.cardSubtitle}>Use the email and password connected to your farmer account.</Text>

          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={styles.input}
            placeholder="farmer@email.com"
            placeholderTextColor="#94A3B8"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={loginId}
            onChangeText={setLoginId}
          />

          <Text style={styles.label}>Password</Text>
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

          <View style={styles.statusBox}>
            <Text style={styles.statusTitle}>Dashboard Access Check</Text>
            {accessStatus.map((item) => (
              <View key={item.label} style={styles.statusRow}>
                <Ionicons name={item.complete ? "checkmark-circle" : "ellipse-outline"} size={18} color={item.complete ? COLORS.green : COLORS.muted} />
                <Text style={styles.statusLabel}>{item.label}</Text>
                <Text style={[styles.statusValue, item.complete && styles.statusValueGood]}>{item.value}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity style={[styles.loginButton, (loading || navigatingToDashboard) && styles.disabled]} onPress={handleLogin} disabled={loading || navigatingToDashboard} activeOpacity={0.85}>
            {loading || navigatingToDashboard ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.loginButtonText}>Login to Farmer Dashboard</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={() => { setResetEmail(loginId); setResetVisible(true); }} activeOpacity={0.85}>
            <Text style={styles.secondaryButtonText}>Forgot Password?</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.registerButton} onPress={() => router.push(REGISTER_ROUTE as any)} activeOpacity={0.85}>
            <Text style={styles.registerButtonText}>New farmer? Start registration</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Farmer Setup Flow</Text>
          <Text style={styles.infoText}>Register → Upload required farmer documents → Pay membership → Sync Stripe subscription → Farmer Dashboard.</Text>
        </View>
      </ScrollView>

      <Modal visible={resetVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalIcon}>🔐</Text>
              <Text style={styles.modalTitle}>Reset Farmer Password</Text>
              <Text style={styles.modalSubtitle}>Enter your farmer email. Farm2Home will send a secure reset link.</Text>

              <TextInput
                style={styles.input}
                placeholder="Farmer Email"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                value={resetEmail}
                onChangeText={setResetEmail}
              />

              <TouchableOpacity style={[styles.loginButton, resetLoading && styles.disabled]} onPress={handlePasswordReset} disabled={resetLoading}>
                {resetLoading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.loginButtonText}>Send Reset Link</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={styles.closeButton} onPress={() => { setResetVisible(false); setResetEmail(""); }}>
                <Text style={styles.closeText}>Close</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  content: { flexGrow: 1, padding: 20, justifyContent: "center" },
  hero: { backgroundColor: COLORS.primary, borderRadius: 32, padding: 24, marginBottom: 16, alignItems: "center" },
  badge: { backgroundColor: "rgba(255,255,255,0.16)", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, marginBottom: 12 },
  badgeText: { color: "#DCFCE7", fontWeight: "900", fontSize: 11, letterSpacing: 0.8 },
  heroIcon: { fontSize: 48, marginBottom: 8 },
  heroTitle: { color: "#FFFFFF", fontSize: 31, fontWeight: "900", textAlign: "center" },
  heroSubtitle: { color: "#DCFCE7", fontSize: 14, fontWeight: "700", textAlign: "center", lineHeight: 22, marginTop: 8 },
  card: { backgroundColor: COLORS.card, borderRadius: 28, padding: 22, borderWidth: 1, borderColor: COLORS.border },
  cardTitle: { color: COLORS.text, fontSize: 28, fontWeight: "900", textAlign: "center" },
  cardSubtitle: { color: COLORS.muted, fontWeight: "700", textAlign: "center", lineHeight: 21, marginTop: 8, marginBottom: 18 },
  label: { color: COLORS.text, fontWeight: "900", fontSize: 13, marginBottom: 7, marginTop: 6 },
  input: { backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 18, paddingHorizontal: 15, paddingVertical: 15, fontSize: 15, fontWeight: "800", marginBottom: 13, color: "#0F172A" },
  statusBox: { backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.border, borderRadius: 18, padding: 14, marginBottom: 12 },
  statusTitle: { color: COLORS.text, fontSize: 14, fontWeight: "900", marginBottom: 8 },
  statusRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6, gap: 8 },
  statusLabel: { flex: 1, color: COLORS.text, fontWeight: "800" },
  statusValue: { color: COLORS.muted, fontWeight: "900", fontSize: 12 },
  statusValueGood: { color: COLORS.green },
  loginButton: { backgroundColor: COLORS.primary, paddingVertical: 17, borderRadius: 18, alignItems: "center", marginTop: 6 },
  loginButtonText: { color: "#FFFFFF", fontWeight: "900", fontSize: 16 },
  secondaryButton: { backgroundColor: COLORS.primarySoft, borderWidth: 1, borderColor: "#BBF7D0", paddingVertical: 15, borderRadius: 18, alignItems: "center", marginTop: 12 },
  secondaryButtonText: { color: COLORS.primary, fontWeight: "900" },
  registerButton: { paddingVertical: 16, alignItems: "center" },
  registerButtonText: { color: COLORS.gold, fontWeight: "900" },
  infoCard: { backgroundColor: "#FFFBEB", borderColor: "#FDE68A", borderWidth: 1, borderRadius: 24, padding: 16, marginTop: 16 },
  infoTitle: { color: "#92400E", fontWeight: "900", marginBottom: 5 },
  infoText: { color: "#78350F", fontWeight: "700", lineHeight: 21 },
  disabled: { opacity: 0.65 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", padding: 22 },
  modalCard: { backgroundColor: COLORS.card, borderRadius: 28, padding: 22, maxHeight: "90%" },
  modalIcon: { fontSize: 42, textAlign: "center", marginBottom: 8 },
  modalTitle: { color: COLORS.text, fontSize: 25, fontWeight: "900", textAlign: "center" },
  modalSubtitle: { color: COLORS.muted, fontWeight: "700", lineHeight: 22, textAlign: "center", marginTop: 8, marginBottom: 18 },
  closeButton: { marginTop: 16, alignItems: "center" },
  closeText: { color: COLORS.danger, fontWeight: "900" },
});
