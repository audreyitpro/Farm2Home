// app/driver/register.tsx

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
import * as DocumentPicker from "expo-document-picker";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { API_BASE_URL, APP_URL } from "../config/api";
import { supabase } from "../data/supabaseClient";

const COLORS = {
  bg: "#F6F7FB",
  card: "#FFFFFF",
  surface: "#F8FAFC",
  surface2: "#F1F5F9",
  primary: "#635BFF",
  primaryDark: "#4638D8",
  primarySoft: "#EEF2FF",
  accent: "#10B981",
  accentDark: "#047857",
  warning: "#F59E0B",
  danger: "#EF4444",
  text: "#101828",
  muted: "#667085",
  border: "#E5E7EB",
  navy: "#020617",
  navyCard: "#111827",
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
  { key: "driver", title: "Driver Info", icon: "car-outline" },
  { key: "documents", title: "Documents", icon: "document-text-outline" },
  { key: "security", title: "Security", icon: "key-outline" },
  { key: "stripe", title: "Stripe", icon: "card-outline" },
  { key: "review", title: "Review", icon: "checkmark-done-outline" },
] as const;

type UploadedDocument = {
  name?: string;
  uri?: string;
  mimeType?: string;
  size?: number;
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

function splitName(fullName: string) {
  const parts = clean(fullName).split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" ") || "",
  };
}

function makeFallbackAccountId() {
  return `Driver_${Date.now().toString().slice(-6)}`;
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
      data?.link ||
      data?.data?.url ||
      data?.result?.url
  );
}

async function openUrl(url: string) {
  const finalUrl = clean(url);

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
    if (result?.type === "cancel" || result?.type === "dismiss") {
      await Linking.openURL(finalUrl);
    }
  } catch {
    const canOpen = await Linking.canOpenURL(finalUrl);
    if (!canOpen) {
      Alert.alert("Stripe Error", "This device cannot open the Stripe URL.");
      return;
    }
    await Linking.openURL(finalUrl);
  }
}

async function saveDriverSession(driver: any) {
  const sessionDriver = {
    ...driver,
    role: "driver",
    driverId: driver.driverId || driver.driver_id || driver.id,
    driver_id: driver.driver_id || driver.driverId || driver.id,
    accountId: driver.accountId || driver.account_id,
    account_id: driver.account_id || driver.accountId,
    fullName: driver.fullName || driver.full_name || driver.name,
    full_name: driver.full_name || driver.fullName || driver.name,
    stripeCustomerId: driver.stripeCustomerId || driver.stripe_customer_id,
    stripe_customer_id: driver.stripe_customer_id || driver.stripeCustomerId,
    stripeSubscriptionId:
      driver.stripeSubscriptionId || driver.stripe_subscription_id || driver.subscription_id,
    stripe_subscription_id:
      driver.stripe_subscription_id || driver.stripeSubscriptionId || driver.subscription_id,
    subscriptionId:
      driver.subscriptionId || driver.subscription_id || driver.stripe_subscription_id,
    subscription_id:
      driver.subscription_id || driver.subscriptionId || driver.stripe_subscription_id,
    membershipStatus: driver.membershipStatus || driver.membership_status,
    membership_status: driver.membership_status || driver.membershipStatus,
    updatedAt: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await AsyncStorage.multiSet([
    ["pendingDriver", JSON.stringify(sessionDriver)],
    ["currentDriver", JSON.stringify(sessionDriver)],
    ["currentUser", JSON.stringify(sessionDriver)],
    ["farm2homeCurrentDriver", JSON.stringify(sessionDriver)],
    ["farm2homeDriverSession", JSON.stringify(sessionDriver)],
    ["userRole", "driver"],
    ["currentUserRole", "driver"],
    ["lastLoginRole", "driver"],
    ["lastDriverDashboardReady", hasCompleteDashboardAccess(sessionDriver) ? "true" : "false"],
  ]);
}

function hasCompleteDashboardAccess(row: any) {
  return Boolean(
    clean(row?.id || row?.driver_id || row?.driverId) &&
      clean(row?.account_id || row?.accountId) &&
      isStripeCustomerId(row?.stripe_customer_id || row?.stripeCustomerId) &&
      isStripeSubscriptionId(
        row?.stripe_subscription_id ||
          row?.stripeSubscriptionId ||
          row?.subscription_id ||
          row?.subscriptionId
      )
  );
}

export default function DriverRegisterScreen() {
  const params = useLocalSearchParams();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [syncingStripe, setSyncingStripe] = useState(false);
  const [processingReturn, setProcessingReturn] = useState(false);

  const [savedDriverId, setSavedDriverId] = useState("");
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

  const [vehicleType, setVehicleType] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [serviceArea, setServiceArea] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");

  const [licenseDocument, setLicenseDocument] = useState<UploadedDocument | null>(null);
  const [insuranceDocument, setInsuranceDocument] = useState<UploadedDocument | null>(null);
  const [vehicleRegistrationDocument, setVehicleRegistrationDocument] =
    useState<UploadedDocument | null>(null);

  const [hasInsurance, setHasInsurance] = useState(false);
  const [hasValidLicense, setHasValidLicense] = useState(false);
  const [hasVehicleRegistration, setHasVehicleRegistration] = useState(false);
  const [acceptsBackgroundCheck, setAcceptsBackgroundCheck] = useState(false);

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
        label: "Driver Profile",
        complete: Boolean(savedDriverId),
        value: savedDriverId ? maskId(savedDriverId, "Found") : "Missing",
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
      {
        label: "Documents",
        complete: Boolean(licenseDocument && insuranceDocument),
        value: licenseDocument && insuranceDocument ? "Uploaded" : "Missing",
      },
    ];
  }, [savedDriverId, accountId, stripeCustomerId, stripeSubscriptionId, licenseDocument, insuranceDocument]);

  const setupScore = useMemo(() => setupStatus.filter((item) => item.complete).length, [setupStatus]);

  const allRequirementsFound = useMemo(
    () =>
      Boolean(
        savedDriverId &&
          accountId &&
          isStripeCustomerId(stripeCustomerId) &&
          isStripeSubscriptionId(stripeSubscriptionId) &&
          licenseDocument &&
          insuranceDocument
      ),
    [savedDriverId, accountId, stripeCustomerId, stripeSubscriptionId, licenseDocument, insuranceDocument]
  );

  useEffect(() => {
    loadSavedDriver();
  }, []);

  useEffect(() => {
    const stripeStatus = String(params?.stripe || params?.payment || "");
    const returnedDriverId = clean(String(params?.driverId || params?.driver_id || ""));
    const returnedEmail = normalize(String(params?.email || ""));

    if (returnedEmail) setEmail(returnedEmail);
    if (returnedDriverId) setSavedDriverId(returnedDriverId);

    if (stripeStatus === "success") {
      handleStripeSuccessReturn(returnedDriverId);
    }
  }, [params?.stripe, params?.payment, params?.driverId, params?.driver_id, params?.email]);

  function goNext() {
    setStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  }

  function goBack() {
    setStep((prev) => Math.max(prev - 1, 0));
  }

  function hydrateForm(row: any) {
    const rowDriverId = clean(row?.id || row?.driver_id || row?.driverId || "");
    const rowProfileId = clean(row?.profile_id || row?.profileId || "");
    const rowAccountId = clean(row?.account_id || row?.accountId || "");
    const rowCustomerId = pickStripeCustomerId(row?.stripe_customer_id, row?.stripeCustomerId);
    const rowSubId = pickStripeSubscriptionId(
      row?.stripe_subscription_id,
      row?.stripeSubscriptionId,
      row?.subscription_id,
      row?.subscriptionId
    );

    if (rowDriverId) setSavedDriverId(rowDriverId);
    if (rowProfileId) setProfileId(rowProfileId);
    if (rowAccountId) setAccountId(rowAccountId);
    if (rowCustomerId) setStripeCustomerId(rowCustomerId);
    if (rowSubId) setStripeSubscriptionId(rowSubId);

    setSubscriptionStatus(row?.subscription_status || row?.subscriptionStatus || subscriptionStatus || "");

    if (row?.full_name || row?.fullName || row?.name) {
      setFullName(clean(row.full_name || row.fullName || row.name));
    }
    if (row?.email || row?.driver_email) setEmail(normalize(row.email || row.driver_email));
    if (row?.phone) setPhone(clean(row.phone));
    if (row?.username) setUsername(normalize(row.username));

    if (row?.vehicle_type || row?.vehicleType) setVehicleType(clean(row.vehicle_type || row.vehicleType));
    if (row?.license_number || row?.licenseNumber) setLicenseNumber(clean(row.license_number || row.licenseNumber));
    if (row?.service_area || row?.serviceArea) setServiceArea(clean(row.service_area || row.serviceArea));
    if (row?.years_experience || row?.yearsExperience) setYearsExperience(clean(row.years_experience || row.yearsExperience));

    setHasInsurance(Boolean(row?.has_insurance || row?.hasInsurance));
    setHasValidLicense(Boolean(row?.has_valid_license || row?.hasValidLicense));
    setHasVehicleRegistration(Boolean(row?.has_vehicle_registration || row?.hasVehicleRegistration));
    setAcceptsBackgroundCheck(Boolean(row?.accepts_background_check || row?.acceptsBackgroundCheck));

    if (row?.security_question_1) setSecurityQuestion1(clean(row.security_question_1));
    if (row?.security_question_2) setSecurityQuestion2(clean(row.security_question_2));
    if (row?.security_question_3) setSecurityQuestion3(clean(row.security_question_3));
    setHasSavedSecurityAnswer1(Boolean(row?.security_answer_1));
    setHasSavedSecurityAnswer2(Boolean(row?.security_answer_2));
    setHasSavedSecurityAnswer3(Boolean(row?.security_answer_3));

    const docs = row?.uploaded_docs || {};
    if (row?.license_document) setLicenseDocument(row.license_document);
    else if (docs?.driver_license) setLicenseDocument(docs.driver_license);

    if (row?.insurance_document) setInsuranceDocument(row.insurance_document);
    else if (docs?.insurance) setInsuranceDocument(docs.insurance);

    if (row?.vehicle_registration_document) setVehicleRegistrationDocument(row.vehicle_registration_document);
    else if (docs?.vehicle_registration) setVehicleRegistrationDocument(docs.vehicle_registration);
  }

  function validateForm({ full = true }: { full?: boolean } = {}) {
    if (!fullName.trim() || !normalize(email) || !phone.trim()) {
      Alert.alert("Missing Info", "Full name, email, and phone are required.");
      setStep(0);
      return false;
    }

    if (!normalize(email).includes("@")) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      setStep(0);
      return false;
    }

    if (!savedDriverId) {
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

    if (!vehicleType.trim() || !licenseNumber.trim() || !serviceArea.trim()) {
      Alert.alert("Driver Info Required", "Vehicle type, license number, and service area are required.");
      setStep(1);
      return false;
    }

    if (!full) return true;

    if (!licenseDocument || !insuranceDocument) {
      Alert.alert("Documents Required", "Please upload your driver license and insurance document.");
      setStep(2);
      return false;
    }

    if (!hasInsurance || !hasValidLicense || !acceptsBackgroundCheck) {
      Alert.alert("Verification Required", "Confirm insurance, valid license, and background check authorization.");
      setStep(2);
      return false;
    }

    if (selectedQuestions.length !== 3 || new Set(selectedQuestions).size !== 3) {
      Alert.alert("Security Required", "Please select 3 different security questions.");
      setStep(3);
      return false;
    }

    const missingAnswers =
      (!securityAnswer1.trim() && !hasSavedSecurityAnswer1) ||
      (!securityAnswer2.trim() && !hasSavedSecurityAnswer2) ||
      (!securityAnswer3.trim() && !hasSavedSecurityAnswer3);

    if (missingAnswers) {
      Alert.alert("Security Required", "Please answer all 3 security questions.");
      setStep(3);
      return false;
    }

    return true;
  }

  async function generateDriverAccountId() {
    try {
      const { data, error } = await supabase.rpc("next_account_id", {
        p_role: "driver",
        p_prefix: "Driver",
      });

      if (!error && data) return String(data);
    } catch (error) {
      console.log("next_account_id skipped:", error);
    }

    return makeFallbackAccountId();
  }

  async function getOrCreateAuthUser() {
    const emailValue = normalize(email);

    const { data: currentUserData } = await supabase.auth.getUser();
    if (currentUserData?.user?.id) return currentUserData.user.id;

    const existingDriver = await findDriverByIdOrEmail("", emailValue);
    if (existingDriver?.id) return existingDriver.id;

    const { data, error } = await supabase.auth.signUp({
      email: emailValue,
      password: password.trim(),
      options: {
        data: {
          role: "driver",
          username: normalize(username),
          full_name: fullName.trim(),
          name: fullName.trim(),
        },
      },
    });

    if (error) throw error;
    if (!data?.user?.id) throw new Error("Unable to create driver Auth user.");

    return data.user.id;
  }

  async function findDriverByIdOrEmail(targetId?: string, targetEmail?: string) {
    const id = clean(targetId);
    const emailValue = normalize(targetEmail);

    if (id) {
      const { data, error } = await supabase
        .from("drivers")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (!error && data) return data;
      if (error) console.log("driver lookup by id:", error.message);
    }

    if (emailValue) {
      const { data, error } = await supabase
        .from("drivers")
        .select("*")
        .eq("email", emailValue)
        .maybeSingle();

      if (!error && data) return data;
      if (error) console.log("driver lookup by email:", error.message);
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
      .eq("auth_user_id", authId)
      .maybeSingle();

    if (error) {
      console.log("profile lookup auth error:", error.message);
      return null;
    }

    return data || null;
  }

  async function getBestDriverSubscription(targetId?: string, targetEmail?: string) {
    const id = clean(targetId);
    const emailValue = normalize(targetEmail);

    const filters = [
      id ? `driver_id.eq.${id}` : "",
      emailValue ? `driver_email.eq.${emailValue}` : "",
    ]
      .filter(Boolean)
      .join(",");

    if (!filters) return null;

    const { data, error } = await supabase
      .from("driver_subscriptions")
      .select("*")
      .or(filters)
      .order("updated_at", { ascending: false })
      .limit(10);

    if (error) {
      console.log("driver_subscriptions lookup skipped:", error.message);
      return null;
    }

    if (!Array.isArray(data) || data.length === 0) return null;

    const completeRow = data.find(
      (row) => pickStripeCustomerId(row?.stripe_customer_id) && pickStripeSubscriptionId(row?.stripe_subscription_id)
    );

    return completeRow || data[0];
  }

  async function upsertProfileForDriver(authId: string, emailValue: string, accountValue: string) {
    const existingByEmail = await findProfileByEmail(emailValue);
    const existingByAuth = existingByEmail ? null : await findProfileByAuthId(authId);
    const existing = existingByEmail || existingByAuth;
    const { firstName, lastName } = splitName(fullName);

    const payload = {
      auth_user_id: authId,
      role: "driver",
      full_name: fullName.trim(),
      name: fullName.trim(),
      first_name: firstName,
      last_name: lastName,
      email: normalize(emailValue),
      phone: phone.trim(),
      username: normalize(username),
      account_id: accountValue,
      driver_account: accountValue,
      stripe_account_id: stripeCustomerId || null,
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
        ...payload,
        created_at: new Date().toISOString(),
      })
      .select("*")
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async function upsertDriverSubscriptionRow(values: {
    driverId: string;
    emailValue: string;
    customerId?: string;
    subscriptionValue?: string;
    subscriptionStatusValue?: string;
    currentPeriodEnd?: string | null;
  }) {
    const now = new Date().toISOString();
    const customer = pickStripeCustomerId(values.customerId);
    const sub = pickStripeSubscriptionId(values.subscriptionValue);

    const payload = {
      driver_id: values.driverId,
      driver_email: normalize(values.emailValue),
      stripe_customer_id: customer || null,
      stripe_subscription_id: sub || null,
      subscription_status: values.subscriptionStatusValue || (sub ? "active" : "pending_payment"),
      plan_name: "Driver Membership",
      monthly_amount: 4.99,
      current_period_end: values.currentPeriodEnd || null,
      updated_at: now,
    };

    const { data: existing, error: lookupError } = await supabase
      .from("driver_subscriptions")
      .select("id")
      .or(`driver_id.eq.${values.driverId},driver_email.eq.${normalize(values.emailValue)}`)
      .limit(1);

    if (lookupError) {
      console.log("driver_subscriptions lookup skipped:", lookupError.message);
      return;
    }

    if (Array.isArray(existing) && existing[0]?.id) {
      const { error } = await supabase
        .from("driver_subscriptions")
        .update(payload)
        .eq("id", existing[0].id);

      if (error) console.log("driver_subscriptions update skipped:", error.message);
      return;
    }

    const { error } = await supabase
      .from("driver_subscriptions")
      .insert({ ...payload, created_at: now });

    if (error) console.log("driver_subscriptions insert skipped:", error.message);
  }

  async function saveAdminVerificationIfTableExists(driverId: string, savedDriver: any) {
    const now = new Date().toISOString();
    const paid = Boolean(savedDriver.stripe_subscription_id || savedDriver.subscription_id);

    const payload = {
      id: driverId,
      driver_id: driverId,
      profile_id: savedDriver.profile_id || driverId,
      account_id: savedDriver.account_id || "",
      account_type: "DRIVER",
      role: "driver",
      type: "DRIVER",
      full_name: savedDriver.full_name || savedDriver.name || "",
      name: savedDriver.name || savedDriver.full_name || "",
      email: savedDriver.email || "",
      phone: savedDriver.phone || "",
      username: savedDriver.username || "",
      vehicle_type: savedDriver.vehicle_type || "",
      license_number: savedDriver.license_number || "",
      service_area: savedDriver.service_area || "",
      status: paid ? "SUBMITTED" : "PENDING_PAYMENT",
      compliance_status: paid ? "SUBMITTED" : "PENDING_PAYMENT",
      admin_review_status: paid ? "submitted" : "pending_payment",
      review_decision: paid ? "submitted" : "pending_payment",
      approved: paid,
      rejected: false,
      reviewed: false,
      needs_more_info: false,
      account_active: paid,
      application_submitted: paid,
      submitted_at: paid ? now : null,
      membership_status: paid ? "active" : "pending_payment",
      subscription_status: savedDriver.subscription_status || (paid ? "active" : "pending_payment"),
      driver_membership_paid: paid,
      stripe_customer_id: savedDriver.stripe_customer_id || null,
      stripe_subscription_id: savedDriver.stripe_subscription_id || savedDriver.subscription_id || null,
      subscription_id: savedDriver.stripe_subscription_id || savedDriver.subscription_id || null,
      updated_at: now,
      created_at: now,
    };

    const { error } = await supabase
      .from("admin_verifications")
      .upsert(payload, { onConflict: "id" });

    if (error) console.log("admin_verifications skipped:", error.message);
  }

  async function uploadDriverDocument(
    driverId: string,
    type: "driver_license" | "insurance" | "vehicle_registration",
    document: UploadedDocument | null
  ) {
    if (!document?.uri) return document;

    if (document.uri.startsWith("http")) return document;

    try {
      const response = await fetch(document.uri);
      const blob = await response.blob();

      const safeName = String(document.name || `${type}_${Date.now()}`)
        .replace(/\s+/g, "_")
        .replace(/[^\w.-]/g, "");

      const storagePath = `${driverId}/${type}_${Date.now()}_${safeName}`;

      const { error } = await supabase.storage
        .from("freight-driver-documents")
        .upload(storagePath, blob, {
          contentType: document.mimeType || "application/octet-stream",
          upsert: true,
        });

      if (error) {
        console.log(`${type} storage upload error:`, error.message);
        return document;
      }

      const { data } = supabase.storage
        .from("freight-driver-documents")
        .getPublicUrl(storagePath);

      return {
        ...document,
        uri: data?.publicUrl || storagePath,
      };
    } catch (error) {
      console.log(`${type} storage upload fallback:`, error);
      return document;
    }
  }

  async function pickDocument(type: "license" | "insurance" | "registration") {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/*", "application/pdf"],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) return;

      const file = result.assets?.[0];
      if (!file) return;

      const savedFile: UploadedDocument = {
        name: file.name,
        uri: file.uri,
        mimeType: file.mimeType,
        size: file.size,
      };

      if (type === "license") setLicenseDocument(savedFile);
      else if (type === "insurance") setInsuranceDocument(savedFile);
      else setVehicleRegistrationDocument(savedFile);
    } catch (error: any) {
      Alert.alert("Upload Error", error?.message || "Unable to select document.");
    }
  }

  async function saveDriverProfile(fullValidation = false) {
    if (saving) return null;
    if (!validateForm({ full: fullValidation })) return null;

    try {
      setSaving(true);

      const authId = savedDriverId || (await getOrCreateAuthUser());
      const existing = await findDriverByIdOrEmail(authId, normalize(email));
      const subRow = await getBestDriverSubscription(authId, normalize(email));
      const now = new Date().toISOString();

      const finalAccountId = clean(existing?.account_id || accountId || (await generateDriverAccountId()));
      const finalCustomerId = pickStripeCustomerId(stripeCustomerId, existing?.stripe_customer_id, subRow?.stripe_customer_id);
      const finalSubscriptionId = pickStripeSubscriptionId(
        stripeSubscriptionId,
        existing?.stripe_subscription_id,
        existing?.subscription_id,
        subRow?.stripe_subscription_id,
        subRow?.subscription_id
      );

      const finalStatus =
        subscriptionStatus ||
        subRow?.subscription_status ||
        existing?.subscription_status ||
        (finalSubscriptionId ? "active" : "pending_payment");

      const uploadedLicense = await uploadDriverDocument(authId, "driver_license", licenseDocument);
      const uploadedInsurance = await uploadDriverDocument(authId, "insurance", insuranceDocument);
      const uploadedRegistration = await uploadDriverDocument(
        authId,
        "vehicle_registration",
        vehicleRegistrationDocument
      );

      const profile = await upsertProfileForDriver(authId, normalize(email), finalAccountId);
      if (!profile?.id) throw new Error("Profile could not be created.");

      const paid = Boolean(finalSubscriptionId);

      const driverPayload: any = {
        id: authId,
        driver_id: authId,
        auth_user_id: authId,
        profile_id: profile.id,
        role: "driver",

        full_name: fullName.trim(),
        name: fullName.trim(),
        email: normalize(email),
        phone: phone.trim(),
        username: normalize(username),

        account_id: finalAccountId,

        vehicle_type: vehicleType.trim(),
        license_number: licenseNumber.trim(),
        service_area: serviceArea.trim(),
        years_experience: yearsExperience.trim(),

        has_insurance: hasInsurance,
        has_valid_license: hasValidLicense,
        has_vehicle_registration: hasVehicleRegistration,
        accepts_background_check: acceptsBackgroundCheck,

        license_document: uploadedLicense,
        insurance_document: uploadedInsurance,
        vehicle_registration_document: uploadedRegistration,
        uploaded_docs: {
          driver_license: uploadedLicense,
          insurance: uploadedInsurance,
          vehicle_registration: uploadedRegistration,
        },
        documents_uploaded: Boolean(uploadedLicense && uploadedInsurance),

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

        stripe_customer_id: finalCustomerId || null,
        stripe_subscription_id: finalSubscriptionId || null,
        subscription_id: finalSubscriptionId || null,
        stripe_checkout_session_id: existing?.stripe_checkout_session_id || null,

        subscription_status: finalStatus,
        membership_status: paid ? "active" : "pending_payment",
        driver_membership_paid: paid,

        approved: paid,
        verified: paid,
        account_active: paid,
        application_submitted: paid,
        submitted_at: paid ? existing?.submitted_at || now : null,
        verification_status: paid ? "SUBMITTED" : "PENDING_PAYMENT",
        compliance_status: paid ? "SUBMITTED" : "PENDING_PAYMENT",
        admin_review_status: paid ? "submitted" : "pending_payment",

        notifications_enabled: true,
        expo_push_token: existing?.expo_push_token || "",
        updated_at: now,
      };

      const { data: savedDriver, error } = await supabase
        .from("drivers")
        .upsert(existing?.id ? driverPayload : { ...driverPayload, created_at: now }, {
          onConflict: "id",
        })
        .select("*")
        .maybeSingle();

      if (error) throw error;
      if (!savedDriver?.id) throw new Error("Driver registration did not save.");

      await upsertDriverSubscriptionRow({
        driverId: authId,
        emailValue: normalize(email),
        customerId: finalCustomerId,
        subscriptionValue: finalSubscriptionId,
        subscriptionStatusValue: finalStatus,
      });

      await saveAdminVerificationIfTableExists(authId, savedDriver);

      hydrateForm(savedDriver);
      await saveDriverSession(savedDriver);

      setSavedDriverId(savedDriver.id);
      setProfileId(clean(savedDriver.profile_id));
      setAccountId(clean(savedDriver.account_id));
      setStripeCustomerId(pickStripeCustomerId(savedDriver.stripe_customer_id));
      setStripeSubscriptionId(
        pickStripeSubscriptionId(savedDriver.stripe_subscription_id, savedDriver.subscription_id)
      );
      setSubscriptionStatus(savedDriver.subscription_status || finalStatus);

      setHasSavedSecurityAnswer1(Boolean(savedDriver.security_answer_1));
      setHasSavedSecurityAnswer2(Boolean(savedDriver.security_answer_2));
      setHasSavedSecurityAnswer3(Boolean(savedDriver.security_answer_3));
      setSecurityAnswer1("");
      setSecurityAnswer2("");
      setSecurityAnswer3("");

      Alert.alert("Saved", "Driver registration was saved.");
      return savedDriver;
    } catch (error: any) {
      console.log("saveDriverProfile error:", error);
      Alert.alert("Save Error", error?.message || "Unable to save driver registration.");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function syncStripeFromBackend(silent = false) {
    const emailValue = normalize(email);
    const id = savedDriverId;

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
          role: "driver",
          email: emailValue,
          driver_email: emailValue,
          name: fullName.trim(),
          username: normalize(username),
          userId: id,
          driverId: id,
          driver_id: id,
        }),
      });

      const json = await parseApiResponse(response);

      if (!response.ok || !json.success) {
        if (!silent) Alert.alert("Stripe Sync Not Found", json.error || "No Stripe customer/subscription was found.");
        return null;
      }

      const customer = pickStripeCustomerId(json.stripeCustomerId, json.stripe_customer_id);
      const sub = pickStripeSubscriptionId(json.stripeSubscriptionId, json.stripe_subscription_id, json.subscriptionId, json.subscription_id);
      const status = json.subscriptionStatus || json.subscription_status || "active";

      if (customer) setStripeCustomerId(customer);
      if (sub) setStripeSubscriptionId(sub);
      setSubscriptionStatus(status);

      const authId = id || (await getOrCreateAuthUser());
      const saved = await saveDriverProfile(false);

      if (!silent) Alert.alert("Stripe Retrieved", "Stripe customer and subscription data were saved.");
      return saved || { id: authId, stripe_customer_id: customer, stripe_subscription_id: sub };
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

      const id = savedDriverId || clean(String(params?.driverId || params?.driver_id || ""));
      const emailValue = normalize(email || String(params?.email || ""));

      const dbDriver = await findDriverByIdOrEmail(id, emailValue);
      const subRow = await getBestDriverSubscription(dbDriver?.id || id, dbDriver?.email || emailValue);

      if (!dbDriver && !subRow) {
        const backendSynced = await syncStripeFromBackend(true);
        if (backendSynced && routeWhenReady && hasCompleteDashboardAccess(backendSynced)) {
          router.replace("/driver/dashboard" as any);
        }
        if (!backendSynced) Alert.alert("Not Found", "No driver Stripe records were found.");
        return backendSynced;
      }

      const targetId = dbDriver?.id || subRow?.driver_id || id || (await getOrCreateAuthUser());
      const customer = pickStripeCustomerId(stripeCustomerId, dbDriver?.stripe_customer_id, subRow?.stripe_customer_id);
      const sub = pickStripeSubscriptionId(
        stripeSubscriptionId,
        dbDriver?.stripe_subscription_id,
        dbDriver?.subscription_id,
        subRow?.stripe_subscription_id,
        subRow?.subscription_id
      );
      const status = subRow?.subscription_status || dbDriver?.subscription_status || subscriptionStatus || (sub ? "active" : "pending_payment");

      if (targetId) setSavedDriverId(targetId);
      if (customer) setStripeCustomerId(customer);
      if (sub) setStripeSubscriptionId(sub);
      setSubscriptionStatus(status);

      const saved = await saveDriverProfile(false);

      if (routeWhenReady && saved && hasCompleteDashboardAccess(saved)) {
        router.replace("/driver/dashboard" as any);
      } else if (saved) {
        Alert.alert("Stripe Info Retrieved", "Missing Stripe fields were synced and saved.");
      }

      return saved;
    } catch (error: any) {
      Alert.alert("Retrieve Error", error?.message || "Unable to retrieve driver Stripe information.");
      return null;
    } finally {
      setSyncingStripe(false);
    }
  }

  async function loadSavedDriver() {
    try {
      const returnedId = clean(String(params?.driverId || params?.driver_id || ""));
      const returnedEmail = normalize(String(params?.email || ""));

      const savedRaw =
        (await AsyncStorage.getItem("pendingDriver")) ||
        (await AsyncStorage.getItem("currentDriver")) ||
        (await AsyncStorage.getItem("farm2homeCurrentDriver")) ||
        (await AsyncStorage.getItem("farm2homeDriverSession")) ||
        (await AsyncStorage.getItem("currentUser"));

      let localDriver: any = null;

      if (savedRaw) {
        try {
          localDriver = JSON.parse(savedRaw);
          hydrateForm(localDriver);
        } catch {
          localDriver = null;
        }
      }

      const { data: authData } = await supabase.auth.getUser();
      const authId = clean(authData?.user?.id || "");
      const authEmail = normalize(authData?.user?.email || "");

      const lookupId =
        returnedId ||
        authId ||
        localDriver?.id ||
        localDriver?.driver_id ||
        localDriver?.driverId ||
        savedDriverId;

      const lookupEmail = normalize(returnedEmail || authEmail || localDriver?.email || email);

      if (!lookupId && !lookupEmail) return;

      const dbDriver = await findDriverByIdOrEmail(lookupId, lookupEmail);
      const subRow = await getBestDriverSubscription(dbDriver?.id || lookupId, dbDriver?.email || lookupEmail);

      if (dbDriver) hydrateForm(dbDriver);

      if (subRow) {
        const merged = {
          ...(dbDriver || {}),
          id: dbDriver?.id || subRow.driver_id || lookupId,
          driver_id: dbDriver?.driver_id || subRow.driver_id || lookupId,
          email: dbDriver?.email || subRow.driver_email || subRow.email || lookupEmail,
          full_name: dbDriver?.full_name || subRow.name || fullName,
          name: dbDriver?.name || subRow.name || fullName,
          stripe_customer_id: pickStripeCustomerId(dbDriver?.stripe_customer_id, subRow.stripe_customer_id),
          stripe_subscription_id: pickStripeSubscriptionId(
            dbDriver?.stripe_subscription_id,
            dbDriver?.subscription_id,
            subRow.stripe_subscription_id,
            subRow.subscription_id
          ),
          subscription_id: pickStripeSubscriptionId(
            dbDriver?.stripe_subscription_id,
            dbDriver?.subscription_id,
            subRow.stripe_subscription_id,
            subRow.subscription_id
          ),
          subscription_status: subRow.subscription_status || dbDriver?.subscription_status || subscriptionStatus,
        };

        hydrateForm(merged);
        await saveDriverSession(merged);
      }
    } catch (error) {
      console.log("loadSavedDriver error:", error);
    }
  }

  async function handleStripeSuccessReturn(returnedDriverId?: string) {
    if (processingReturn) return;

    try {
      setProcessingReturn(true);
      if (returnedDriverId) setSavedDriverId(returnedDriverId);

      await loadSavedDriver();
      const synced = await retrieveMissingStripeInfo(false);

      if (synced && hasCompleteDashboardAccess(synced)) {
        await markDriverApplicationSubmittedAndOpenDashboard(synced.id || returnedDriverId);
        return;
      }

      setStep(4);
      Alert.alert("Stripe Synced", "Membership payment returned. Retrieve Stripe info if any ID is still missing.");
    } catch (error: any) {
      Alert.alert("Stripe Return Error", error?.message || "Unable to complete Stripe return.");
    } finally {
      setProcessingReturn(false);
    }
  }

  async function createDriverStripeCheckout(saved: any) {
    const driverId = clean(saved.id || saved.driver_id);
    const cleanEmail = normalize(saved.email || email);

    const successUrl = `${APP_URL}/driver/register?stripe=success&driverId=${encodeURIComponent(driverId)}&email=${encodeURIComponent(cleanEmail)}`;
    const cancelUrl = `${APP_URL}/driver/register?stripe=cancelled&driverId=${encodeURIComponent(driverId)}&email=${encodeURIComponent(cleanEmail)}`;

    const response = await fetch(`${API_BASE_URL}/payments/create-driver-subscription-checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: "driver",
        planType: "driver",
        userId: driverId,
        driverId,
        driver_id: driverId,
        accountId: saved.account_id,
        account_id: saved.account_id,
        email: cleanEmail,
        customerEmail: cleanEmail,
        driver_email: cleanEmail,
        companyName: saved.full_name || saved.name,
        businessName: saved.full_name || saved.name,
        name: saved.full_name || saved.name,
        username: saved.username,
        successUrl,
        success_url: successUrl,
        cancelUrl,
        cancel_url: cancelUrl,
        metadata: {
          role: "driver",
          driver_id: driverId,
          account_id: saved.account_id,
          driver_email: cleanEmail,
          email: cleanEmail,
          name: saved.full_name || saved.name,
          username: saved.username,
        },
      }),
    });

    const json = await parseApiResponse(response);
    const url = getStripeLaunchUrl(json);

    if (!response.ok || (!json.success && !url && !json.alreadySubscribed)) {
      throw new Error(json.error || json.message || "Stripe checkout failed.");
    }

    return { ...json, url };
  }

  async function handleStripeCheckout() {
    if (stripeLoading) return;

    try {
      setStripeLoading(true);

      const restored = await retrieveMissingStripeInfo(false);
      if (restored && isStripeSubscriptionId(restored.stripe_subscription_id || restored.subscription_id)) {
        Alert.alert("Membership Already Active", "Your Stripe subscription is already saved.");
        setStep(4);
        return;
      }

      const saved = restored?.id ? restored : await saveDriverProfile(false);
      if (!saved?.id) return;

      const data = await createDriverStripeCheckout(saved);
      const url = getStripeLaunchUrl(data);

      const customer = pickStripeCustomerId(data.stripeCustomerId, data.stripe_customer_id, data.customerId, data.customer_id);
      const sub = pickStripeSubscriptionId(
        data.stripeSubscriptionId,
        data.stripe_subscription_id,
        data.subscriptionId,
        data.subscription_id
      );

      if (customer) setStripeCustomerId(customer);
      if (sub) setStripeSubscriptionId(sub);
      if (data.subscriptionStatus || data.subscription_status) {
        setSubscriptionStatus(data.subscriptionStatus || data.subscription_status);
      }

      const stripeCheckoutSessionId = data.id || data.sessionId || data.session_id || "";

      await supabase
        .from("drivers")
        .update({
          stripe_customer_id: customer || saved.stripe_customer_id || null,
          stripe_subscription_id: sub || saved.stripe_subscription_id || saved.subscription_id || null,
          subscription_id: sub || saved.subscription_id || saved.stripe_subscription_id || null,
          stripe_checkout_session_id: stripeCheckoutSessionId || saved.stripe_checkout_session_id || null,
          membership_status: data.alreadySubscribed || sub ? "active" : "pending_payment",
          subscription_status:
            data.subscriptionStatus ||
            data.subscription_status ||
            (data.alreadySubscribed || sub ? "active" : "pending_payment"),
          driver_membership_paid: Boolean(data.alreadySubscribed || sub),
          updated_at: new Date().toISOString(),
        })
        .eq("id", saved.id);

      await upsertDriverSubscriptionRow({
        driverId: saved.id,
        emailValue: saved.email,
        customerId: customer || saved.stripe_customer_id,
        subscriptionValue: sub || saved.stripe_subscription_id || saved.subscription_id,
        subscriptionStatusValue:
          data.subscriptionStatus || data.subscription_status || (data.alreadySubscribed || sub ? "active" : "pending_payment"),
      });

      if (data.alreadySubscribed) {
        await markDriverApplicationSubmittedAndOpenDashboard(saved.id);
        return;
      }

      if (!url) {
        Alert.alert("Stripe Error", "Stripe checkout URL was not returned from backend.");
        return;
      }

      await saveDriverSession({
        ...saved,
        stripe_customer_id: customer || saved.stripe_customer_id,
        stripe_subscription_id: sub || saved.stripe_subscription_id,
        subscription_id: sub || saved.subscription_id,
        stripe_checkout_session_id: stripeCheckoutSessionId || saved.stripe_checkout_session_id,
      });

      void openUrl(url);
    } catch (error: any) {
      console.log("handleStripeCheckout error:", error);
      Alert.alert("Stripe Error", error?.message || "Unable to start driver membership checkout.");
    } finally {
      setStripeLoading(false);
    }
  }

  async function markDriverApplicationSubmittedAndOpenDashboard(driverId: string) {
    const now = new Date().toISOString();

    const { data: driverRow } = await supabase
      .from("drivers")
      .select("*")
      .eq("id", driverId)
      .maybeSingle();

    const paid = Boolean(driverRow?.stripe_subscription_id || driverRow?.subscription_id);

    await supabase
      .from("drivers")
      .update({
        application_submitted: true,
        submitted_at: now,
        approved: true,
        verified: true,
        account_active: true,
        verification_status: "SUBMITTED",
        compliance_status: "SUBMITTED",
        admin_review_status: "submitted",
        membership_status: paid ? "active" : "pending",
        subscription_status: driverRow?.subscription_status || (paid ? "active" : "pending"),
        driver_membership_paid: paid,
        updated_at: now,
      })
      .eq("id", driverId);

    await supabase
      .from("profiles")
      .update({
        role: "driver",
        driver_account: driverRow?.account_id || null,
        account_id: driverRow?.account_id || null,
        stripe_account_id: driverRow?.stripe_customer_id || null,
      })
      .eq("auth_user_id", driverId);

    const { data: updatedDriver } = await supabase
      .from("drivers")
      .select("*")
      .eq("id", driverId)
      .maybeSingle();

    if (updatedDriver) {
      await saveAdminVerificationIfTableExists(driverId, updatedDriver);
      await saveDriverSession({
        ...updatedDriver,
        role: "driver",
        driverId: updatedDriver.id,
        accountId: updatedDriver.account_id,
        accountActive: true,
        applicationSubmitted: true,
      });
    }

    router.replace("/driver/dashboard" as any);
  }

  async function handleSubmitAndDashboard() {
    const saved = await saveDriverProfile(true);
    if (!saved?.id) return;

    if (!hasCompleteDashboardAccess(saved)) {
      const missing = [
        !saved.id ? "Driver Profile" : "",
        !saved.account_id ? "Static Account ID" : "",
        !isStripeCustomerId(saved.stripe_customer_id) ? "Stripe Customer ID" : "",
        !isStripeSubscriptionId(saved.stripe_subscription_id || saved.subscription_id) ? "Subscription ID" : "",
      ].filter(Boolean);

      Alert.alert("Setup Incomplete", `Missing: ${missing.join(", ")}.`);
      setStep(4);
      return;
    }

    await markDriverApplicationSubmittedAndOpenDashboard(saved.id);
  }

  async function forceRefreshDriverRegister() {
    try {
      setSyncingStripe(true);
      await supabase.auth.refreshSession();
      await loadSavedDriver();
      await retrieveMissingStripeInfo(false);
      Alert.alert("Updated", "Driver registration refreshed without clearing your form.");
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
          <SectionTitle title="Account Details" subtitle="Create the driver login and primary contact." />

          <Field label="Full Name" value={fullName} onChangeText={setFullName} placeholder="Driver full name" icon="person-outline" />
          <Field label="Email" value={email} onChangeText={(v) => setEmail(normalize(v))} placeholder="driver@email.com" icon="mail-outline" keyboardType="email-address" autoCapitalize="none" />
          <Field label="Phone" value={phone} onChangeText={setPhone} placeholder="(555) 555-5555" icon="call-outline" keyboardType="phone-pad" />
          <Field label="Username" value={username} onChangeText={(v) => setUsername(normalize(v))} placeholder="driver username" icon="at-outline" autoCapitalize="none" />

          {!savedDriverId ? (
            <>
              <Field label="Password" value={password} onChangeText={setPassword} placeholder="Create password" icon="lock-closed-outline" secureTextEntry />
              <Field label="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Confirm password" icon="lock-closed-outline" secureTextEntry />
            </>
          ) : (
            <View style={styles.noticeBox}>
              <Ionicons name="checkmark-circle-outline" size={20} color={COLORS.accent} />
              <Text style={styles.noticeText}>Driver Auth/Profile already exists. Password is managed by Supabase Auth.</Text>
            </View>
          )}
        </View>
      );
    }

    if (step === 1) {
      return (
        <View>
          <SectionTitle title="Driver Information" subtitle="Save vehicle type, service area, license, and delivery experience." />

          <Field label="Vehicle Type" value={vehicleType} onChangeText={setVehicleType} placeholder="Car, van, truck, box truck..." icon="car-outline" />
          <Field label="Driver License Number" value={licenseNumber} onChangeText={setLicenseNumber} placeholder="License number" icon="id-card-outline" />
          <Field label="Service Area" value={serviceArea} onChangeText={setServiceArea} placeholder="Detroit Metro, Sterling Heights..." icon="map-outline" />
          <Field label="Years Experience" value={yearsExperience} onChangeText={setYearsExperience} placeholder="2 years" icon="speedometer-outline" />
        </View>
      );
    }

    if (step === 2) {
      return (
        <View>
          <SectionTitle title="Documents & Verification" subtitle="Upload required driver documents and confirm eligibility." />

          <TouchableOpacity style={styles.uploadButton} onPress={() => pickDocument("license")} activeOpacity={0.9}>
            <Ionicons name={licenseDocument ? "checkmark-circle" : "cloud-upload-outline"} size={20} color={licenseDocument ? COLORS.accentDark : COLORS.primary} />
            <Text style={styles.uploadText}>{licenseDocument ? `License: ${licenseDocument.name}` : "Upload Driver License"}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.uploadButton} onPress={() => pickDocument("insurance")} activeOpacity={0.9}>
            <Ionicons name={insuranceDocument ? "checkmark-circle" : "cloud-upload-outline"} size={20} color={insuranceDocument ? COLORS.accentDark : COLORS.primary} />
            <Text style={styles.uploadText}>{insuranceDocument ? `Insurance: ${insuranceDocument.name}` : "Upload Insurance"}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.uploadButton} onPress={() => pickDocument("registration")} activeOpacity={0.9}>
            <Ionicons name={vehicleRegistrationDocument ? "checkmark-circle" : "cloud-upload-outline"} size={20} color={vehicleRegistrationDocument ? COLORS.accentDark : COLORS.primary} />
            <Text style={styles.uploadText}>{vehicleRegistrationDocument ? `Vehicle Registration: ${vehicleRegistrationDocument.name}` : "Upload Vehicle Registration Optional"}</Text>
          </TouchableOpacity>

          <ToggleRow label="I have active auto insurance" value={hasInsurance} onValueChange={setHasInsurance} />
          <ToggleRow label="I have a valid driver license" value={hasValidLicense} onValueChange={setHasValidLicense} />
          <ToggleRow label="I have vehicle registration available" value={hasVehicleRegistration} onValueChange={setHasVehicleRegistration} />
          <ToggleRow label="I authorize Farm2Home to review driver eligibility" value={acceptsBackgroundCheck} onValueChange={setAcceptsBackgroundCheck} />
        </View>
      );
    }

    if (step === 3) {
      const used1 = [securityQuestion2, securityQuestion3].filter(Boolean);
      const used2 = [securityQuestion1, securityQuestion3].filter(Boolean);
      const used3 = [securityQuestion1, securityQuestion2].filter(Boolean);

      return (
        <View>
          <SectionTitle title="Security Recovery" subtitle="Save three recovery questions for driver account verification." />

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
          <SectionTitle title="Stripe Membership" subtitle="IDs are captured automatically from Auth, Supabase, Stripe Checkout, and backend sync." />

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

          <ReadOnlyId label="Driver ID" value={savedDriverId || "Generated automatically after signup"} />
          <ReadOnlyId label="Account ID" value={accountId || "Generated automatically"} />
          <ReadOnlyId label="Stripe Customer ID" value={stripeCustomerId || "Captured after Stripe checkout/sync"} />
          <ReadOnlyId label="Subscription ID" value={stripeSubscriptionId || "Captured after Stripe checkout/sync"} />

          <ActionButton
            title="Save Profile"
            subtitle="Save registration fields to profiles, drivers, driver_subscriptions, and admin verification."
            icon="save-outline"
            loading={saving}
            onPress={() => saveDriverProfile(false)}
          />

          <ActionButton
            title="Find / Retrieve Missing Stripe Info"
            subtitle="Search driver_subscriptions and backend Stripe sync."
            icon="sync-outline"
            loading={syncingStripe}
            onPress={() => retrieveMissingStripeInfo(false)}
            secondary
          />

          <ActionButton
            title="Start Driver Membership"
            subtitle="Open Stripe Checkout for driver subscription."
            icon="card-outline"
            loading={stripeLoading}
            onPress={handleStripeCheckout}
          />

          <ActionButton
            title="Refresh Without Clearing Form"
            subtitle="Reload Supabase and Stripe info without wiping form fields."
            icon="refresh-outline"
            loading={syncingStripe}
            onPress={forceRefreshDriverRegister}
            secondary
          />
        </View>
      );
    }

    return (
      <View>
        <SectionTitle title="Review & Submit" subtitle="Confirm saved fields and open Driver Dashboard." />

        <ReviewRow label="Driver" value={fullName} />
        <ReviewRow label="Email" value={email} />
        <ReviewRow label="Phone" value={phone} />
        <ReviewRow label="Vehicle" value={vehicleType} />
        <ReviewRow label="Service Area" value={serviceArea} />
        <ReviewRow label="Account ID" value={accountId} />
        <ReviewRow label="Driver ID" value={maskId(savedDriverId)} />
        <ReviewRow label="Stripe Customer" value={maskId(stripeCustomerId)} />
        <ReviewRow label="Subscription" value={maskId(stripeSubscriptionId)} />

        <View style={styles.noticeBox}>
          <Ionicons
            name={allRequirementsFound ? "checkmark-circle-outline" : "warning-outline"}
            size={20}
            color={allRequirementsFound ? COLORS.accent : COLORS.warning}
          />
          <Text style={styles.noticeText}>
            {allRequirementsFound
              ? "Driver profile, documents, Stripe customer, and subscription are saved."
              : "Membership and required profile data must be saved before dashboard routing."}
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
              <Text style={styles.primaryButtonText}>Submit & Open Driver Dashboard</Text>
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
                  <Ionicons name="car-outline" size={28} color={COLORS.white} />
                </View>
                <View>
                  <Text style={styles.brandTitle}>Farm2Home</Text>
                  <Text style={styles.brandSubtitle}>Driver Connect</Text>
                </View>
              </View>

              <View style={styles.sideDivider} />

              <View style={styles.scoreCard}>
                <Text style={styles.scoreLabel}>Setup Progress</Text>
                <Text style={styles.scoreValue}>{setupScore}/5</Text>
                <Text style={styles.scoreHint}>Profile, static account, Stripe customer, subscription, and documents.</Text>
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

              <TouchableOpacity style={styles.loginSideButton} onPress={() => router.push("/driver/login" as any)} activeOpacity={0.9}>
                <Ionicons name="log-in-outline" size={18} color={COLORS.white} />
                <Text style={styles.loginSideButtonText}>Driver Login</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.main}>
              <View style={styles.topPanel}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.eyebrow}>Driver Registration</Text>
                  <Text style={styles.pageTitle}>Driver Access Center</Text>
                  <Text style={styles.pageSubtitle}>
                    Save driver profile, documents, security recovery, and Stripe membership with automatic ID capture.
                  </Text>
                </View>

                <View style={styles.pricePill}>
                  <Text style={styles.pricePillValue}>$4.99</Text>
                  <Text style={styles.pricePillLabel}>monthly</Text>
                </View>
              </View>

              {processingReturn && (
                <View style={styles.noticeBox}>
                  <Ionicons name="sync-outline" size={20} color={COLORS.primary} />
                  <Text style={styles.noticeText}>Completing Stripe return. Please wait while membership data is synced.</Text>
                </View>
              )}

              <View style={styles.card}>{renderStep()}</View>

              <View style={styles.navRow}>
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
                    <Text style={styles.primaryButtonText}>Continue</Text>
                    <Ionicons name="arrow-forward-outline" size={18} color={COLORS.white} />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.primaryButtonSmall} onPress={handleSubmitAndDashboard} activeOpacity={0.9}>
                    <Text style={styles.primaryButtonText}>Submit</Text>
                    <Ionicons name="checkmark-done-outline" size={18} color={COLORS.white} />
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

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.sectionTitleWrap}>
      <Text style={styles.section}>{title}</Text>
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
  secureTextEntry,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  icon: keyof typeof Ionicons.glyphMap;
  keyboardType?: any;
  secureTextEntry?: boolean;
  autoCapitalize?: any;
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
    <View style={styles.switchRow}>
      <Text style={styles.switchText}>{label}</Text>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
  );
}

function ReadOnlyId({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.readOnlyRow}>
      <Text style={styles.readOnlyLabel}>{label}</Text>
      <Text style={styles.readOnlyValue}>{value}</Text>
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
      style={[secondary ? styles.actionButtonSecondary : styles.actionButton, loading && styles.disabledButton]}
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
    </TouchableOpacity>
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
    width: Platform.OS === "web" ? 286 : "100%",
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
  brandTitle: { color: COLORS.white, fontSize: 18, fontWeight: "900" },
  brandSubtitle: { color: "#A5B4FC", fontSize: 12, fontWeight: "800" },
  sideDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
    marginVertical: 8,
  },
  scoreCard: {
    backgroundColor: COLORS.navyCard,
    borderRadius: 18,
    padding: 16,
    marginBottom: 2,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  scoreLabel: { color: "#CBD5E1", fontSize: 12, fontWeight: "900" },
  scoreValue: { color: COLORS.white, fontSize: 32, fontWeight: "900", marginTop: 6 },
  scoreHint: { color: "#A5B4FC", lineHeight: 18, fontSize: 12, fontWeight: "700", marginTop: 4 },
  stepNav: {
    backgroundColor: COLORS.navyCard,
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  stepNavActive: {
    backgroundColor: "rgba(99,91,255,0.25)",
    borderColor: "rgba(99,91,255,0.75)",
  },
  stepNavIcon: {
    width: 30,
    height: 30,
    borderRadius: 12,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNavIconActive: { backgroundColor: COLORS.primary },
  stepNavIconDone: { backgroundColor: COLORS.accent },
  stepNavText: { color: "#CBD5E1", fontWeight: "900" },
  stepNavTextActive: { color: COLORS.white },
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
  homeButtonText: { color: COLORS.white, fontWeight: "900" },
  loginSideButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    padding: 13,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  loginSideButtonText: { color: COLORS.white, fontWeight: "900" },

  main: { flex: 1, padding: 16, paddingBottom: 80 },
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
  pageTitle: { color: COLORS.text, fontSize: 30, fontWeight: "900", marginTop: 4 },
  pageSubtitle: { color: COLORS.muted, lineHeight: 20, fontWeight: "700", marginTop: 4 },
  pricePill: {
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  pricePillValue: { color: COLORS.white, fontSize: 24, fontWeight: "900" },
  pricePillLabel: { color: "#E0E7FF", fontSize: 12, fontWeight: "800", marginTop: 2 },

  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
  },
  sectionTitleWrap: { marginBottom: 16 },
  section: { fontSize: 20, fontWeight: "900", color: COLORS.text },
  sectionSubtitle: { color: COLORS.muted, fontWeight: "700", lineHeight: 20, marginTop: 3 },

  fieldWrap: { marginBottom: 13 },
  inputLabel: { color: COLORS.text, fontWeight: "900", marginBottom: 7 },
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
  input: { flex: 1, color: COLORS.text, fontWeight: "700", paddingVertical: 12, minHeight: 48 },

  uploadButton: {
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    padding: 15,
    borderRadius: 14,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  uploadText: { color: COLORS.primary, fontWeight: "900", flex: 1 },

  switchRow: {
    backgroundColor: COLORS.surface,
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  switchText: { flex: 1, fontWeight: "800", paddingRight: 12, color: COLORS.text },

  questionBlock: { marginBottom: 12 },
  questionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  questionChip: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    maxWidth: 300,
  },
  questionChipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  questionChipDisabled: { opacity: 0.45 },
  questionChipText: { color: COLORS.primary, fontWeight: "900", fontSize: 12 },
  questionChipTextSelected: { color: COLORS.white },
  questionChipTextDisabled: { color: COLORS.muted },

  statusList: { gap: 10, marginBottom: 14 },
  statusRow: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  statusIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  statusGood: { backgroundColor: COLORS.accent },
  statusMissing: { backgroundColor: COLORS.surface2 },
  statusLabel: { color: COLORS.text, fontWeight: "900" },
  statusValue: { color: COLORS.muted, fontWeight: "700", marginTop: 2 },

  readOnlyRow: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  readOnlyLabel: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  readOnlyValue: { color: COLORS.text, fontWeight: "900", marginTop: 4 },

  reviewRow: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 11,
    flexDirection: "row",
    gap: 12,
  },
  reviewLabel: { width: 140, color: COLORS.muted, fontWeight: "900" },
  reviewValue: { flex: 1, color: COLORS.text, fontWeight: "900" },

  noticeBox: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  noticeText: { color: COLORS.muted, fontWeight: "700", lineHeight: 20, flex: 1 },

  actionButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    padding: 14,
    marginTop: 10,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  actionButtonSecondary: {
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    borderRadius: 16,
    padding: 14,
    marginTop: 10,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  actionIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionIconSecondary: { backgroundColor: COLORS.white },
  actionTitle: { color: COLORS.white, fontWeight: "900", fontSize: 15 },
  actionTitleSecondary: { color: COLORS.primary },
  actionSubtitle: { color: COLORS.muted, fontWeight: "700", lineHeight: 18, marginTop: 2 },

  primaryButton: {
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  primaryButtonSmall: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryButtonText: { color: COLORS.white, textAlign: "center", fontWeight: "900", fontSize: 16 },
  navRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  navButton: {
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  navButtonText: { color: COLORS.primary, fontWeight: "900" },
  disabledButton: { opacity: 0.6 },
});
