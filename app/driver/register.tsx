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
  accentSoft: "#D1FAE5",
  warning: "#F59E0B",
  warningSoft: "#FEF3C7",
  danger: "#EF4444",
  dangerSoft: "#FEE2E2",
  blue: "#2563EB",
  blueSoft: "#DBEAFE",
  text: "#101828",
  muted: "#667085",
  border: "#E5E7EB",
  navy: "#020617",
  navyCard: "#111827",
  dark: "#111827",
  white: "#FFFFFF",
  black: "#020617",
  red: "#635BFF",
  redDark: "#4638D8",
  green: "#10B981",
  amber: "#F59E0B",
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

type UploadedDocument = {
  name?: string;
  uri?: string;
  mimeType?: string;
  size?: number;
};

function normalize(value: string) {
  return String(value || "").trim().toLowerCase();
}

function normalizeAnswer(value: string) {
  return String(value || "").trim().toLowerCase();
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" ") || "",
  };
}

async function saveDriverSession(driver: any) {
  await AsyncStorage.setItem("pendingDriver", JSON.stringify(driver));
  await AsyncStorage.setItem("currentDriver", JSON.stringify(driver));
  await AsyncStorage.setItem("currentUser", JSON.stringify(driver));
  await AsyncStorage.setItem("farm2homeCurrentDriver", JSON.stringify(driver));
  await AsyncStorage.setItem("farm2homeDriverSession", JSON.stringify(driver));
  await AsyncStorage.setItem("userRole", "driver");
  await AsyncStorage.setItem("currentUserRole", "driver");
}

export default function DriverRegisterScreen() {
  const params = useLocalSearchParams();

  const [loading, setLoading] = useState(false);
  const [processingReturn, setProcessingReturn] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [vehicleType, setVehicleType] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [serviceArea, setServiceArea] = useState("");

  const [licenseDocument, setLicenseDocument] = useState<UploadedDocument | null>(null);
  const [insuranceDocument, setInsuranceDocument] = useState<UploadedDocument | null>(null);

  const [hasInsurance, setHasInsurance] = useState(false);
  const [hasValidLicense, setHasValidLicense] = useState(false);
  const [acceptsBackgroundCheck, setAcceptsBackgroundCheck] = useState(false);

  const [securityQuestion1, setSecurityQuestion1] = useState("");
  const [securityAnswer1, setSecurityAnswer1] = useState("");
  const [securityQuestion2, setSecurityQuestion2] = useState("");
  const [securityAnswer2, setSecurityAnswer2] = useState("");
  const [securityQuestion3, setSecurityQuestion3] = useState("");
  const [securityAnswer3, setSecurityAnswer3] = useState("");

  const selectedQuestions = useMemo(
    () => [securityQuestion1, securityQuestion2, securityQuestion3].filter(Boolean),
    [securityQuestion1, securityQuestion2, securityQuestion3]
  );

  const checklistItems = useMemo(
    () => [
      {
        label: "Driver Profile",
        value: fullName.trim() && email.trim() && phone.trim() ? "Complete" : "Needs name, email, phone",
        complete: Boolean(fullName.trim() && email.trim() && phone.trim()),
      },
      {
        label: "Login Credentials",
        value:
          username.trim() && password.trim() && password.trim() === confirmPassword.trim()
            ? "Complete"
            : "Username + matching password",
        complete: Boolean(username.trim() && password.trim() && password.trim() === confirmPassword.trim()),
      },
      {
        label: "Vehicle & Service Area",
        value:
          vehicleType.trim() && licenseNumber.trim() && serviceArea.trim()
            ? "Complete"
            : "Vehicle, license, service area",
        complete: Boolean(vehicleType.trim() && licenseNumber.trim() && serviceArea.trim()),
      },
      {
        label: "Documents",
        value:
          licenseDocument && insuranceDocument
            ? "License + insurance uploaded"
            : "Upload license + insurance",
        complete: Boolean(licenseDocument && insuranceDocument),
      },
      {
        label: "Verification Checks",
        value:
          hasInsurance && hasValidLicense && acceptsBackgroundCheck
            ? "Confirmed"
            : "Insurance, license, review auth",
        complete: Boolean(hasInsurance && hasValidLicense && acceptsBackgroundCheck),
      },
      {
        label: "Security Questions",
        value:
          selectedQuestions.length === 3 &&
          new Set(selectedQuestions).size === 3 &&
          securityAnswer1.trim() &&
          securityAnswer2.trim() &&
          securityAnswer3.trim()
            ? "Complete"
            : "Choose 3 unique questions",
        complete: Boolean(
          selectedQuestions.length === 3 &&
            new Set(selectedQuestions).size === 3 &&
            securityAnswer1.trim() &&
            securityAnswer2.trim() &&
            securityAnswer3.trim()
        ),
      },
    ],
    [
      fullName,
      email,
      phone,
      username,
      password,
      confirmPassword,
      vehicleType,
      licenseNumber,
      serviceArea,
      licenseDocument,
      insuranceDocument,
      hasInsurance,
      hasValidLicense,
      acceptsBackgroundCheck,
      selectedQuestions,
      securityAnswer1,
      securityAnswer2,
      securityAnswer3,
    ]
  );

  const checklistScore = useMemo(
    () => checklistItems.filter((item) => item.complete).length,
    [checklistItems]
  );

  useEffect(() => {
    const stripeStatus = String(params?.stripe || params?.payment || "");
    const returnedDriverId = String(params?.driverId || params?.driver_id || "");

    if (stripeStatus === "success") {
      handleStripeSuccessReturn(returnedDriverId);
    }
  }, [params?.stripe, params?.payment, params?.driverId, params?.driver_id]);

  async function handleStripeSuccessReturn(returnedDriverId?: string) {
    if (processingReturn) return;

    try {
      setProcessingReturn(true);

      const saved =
        (await AsyncStorage.getItem("currentDriver")) ||
        (await AsyncStorage.getItem("farm2homeCurrentDriver")) ||
        (await AsyncStorage.getItem("farm2homeDriverSession"));

      const localDriver = saved ? JSON.parse(saved) : null;
      const finalDriverId = returnedDriverId || localDriver?.id || localDriver?.driverId;

      if (!finalDriverId) {
        Alert.alert("Driver Not Found", "Stripe payment completed, but the driver profile could not be found.");
        return;
      }

      await forceSyncDriverSubscription(finalDriverId, localDriver);
      await markDriverApplicationSubmittedAndOpenDashboard(finalDriverId);
    } catch (error: any) {
      Alert.alert("Stripe Return Error", error?.message || "Unable to complete driver registration.");
    } finally {
      setProcessingReturn(false);
    }
  }

  async function generateDriverAccountId() {
    const { data, error } = await supabase.rpc("next_account_id", {
      p_role: "driver",
      p_prefix: "Driver",
    });

    if (error) {
      console.log("Driver account_id RPC error:", error.message);
      throw error;
    }

    if (!data) {
      throw new Error("Unable to generate driver account ID.");
    }

    return String(data);
  }

  async function upsertProfile(payload: any) {
    const now = new Date().toISOString();
    const { firstName, lastName } = splitName(payload.full_name || payload.name || "");

    const profilePayload = {
      id: payload.id,
      auth_user_id: payload.id,
      role: "driver",
      full_name: payload.full_name,
      name: payload.name || payload.full_name,
      first_name: firstName,
      last_name: lastName,
      email: payload.email,
      phone: payload.phone,
      username: payload.username,
      account_id: payload.account_id,
      driver_account: payload.account_id,
      stripe_account_id: payload.stripe_account_id || null,
      created_at: payload.created_at || now,
    };

    const { data, error } = await supabase
      .from("profiles")
      .upsert(profilePayload, { onConflict: "id" })
      .select("*")
      .single();

    if (error) {
      console.log("Profile upsert error:", error);
      throw error;
    }

    return data;
  }

  async function pickDocument(type: "license" | "insurance") {
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
      else setInsuranceDocument(savedFile);
    } catch (error: any) {
      Alert.alert("Upload Error", error?.message || "Unable to select document.");
    }
  }

  function validateForm() {
    if (!fullName.trim() || !email.trim() || !phone.trim()) {
      Alert.alert("Missing Info", "Full name, email, and phone are required.");
      return false;
    }

    if (!email.trim().includes("@")) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return false;
    }

    if (!username.trim() || !password.trim() || !confirmPassword.trim()) {
      Alert.alert("Login Required", "Please create a username and password.");
      return false;
    }

    if (username.trim().length < 4) {
      Alert.alert("Invalid Username", "Username must be at least 4 characters.");
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

    if (!vehicleType.trim() || !licenseNumber.trim() || !serviceArea.trim()) {
      Alert.alert("Driver Info Required", "Vehicle type, license number, and service area are required.");
      return false;
    }

    if (!licenseDocument || !insuranceDocument) {
      Alert.alert("Documents Required", "Please upload your driver license and insurance document.");
      return false;
    }

    if (!hasInsurance || !hasValidLicense || !acceptsBackgroundCheck) {
      Alert.alert("Verification Required", "Confirm insurance, valid license, and background check authorization.");
      return false;
    }

    if (selectedQuestions.length !== 3) {
      Alert.alert("Security Required", "Please select 3 security questions.");
      return false;
    }

    if (new Set(selectedQuestions).size !== 3) {
      Alert.alert("Duplicate Questions", "Please select 3 different questions.");
      return false;
    }

    if (!securityAnswer1.trim() || !securityAnswer2.trim() || !securityAnswer3.trim()) {
      Alert.alert("Security Required", "Please answer all 3 security questions.");
      return false;
    }

    return true;
  }

  async function checkDuplicateDriver(cleanEmail: string, cleanUsername: string) {
    const { data, error } = await supabase
      .from("drivers")
      .select("id,account_id,email,username")
      .or(`email.eq.${cleanEmail},username.eq.${cleanUsername}`)
      .maybeSingle();

    if (error) {
      console.log("Driver duplicate check error:", error.message);
      return false;
    }

    if (data) {
      Alert.alert("Account Exists", "A driver account already exists with this email or username.");
      return true;
    }

    return false;
  }

  async function uploadDriverDocument(
    driverId: string,
    type: "driver_license" | "insurance",
    document: UploadedDocument
  ) {
    if (!document?.uri) return document;

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

  async function openCheckoutUrl(url: string) {
    if (!url || !url.startsWith("http")) {
      Alert.alert("Stripe Error", "No valid Stripe checkout URL returned.");
      return;
    }

    if (Platform.OS === "web") {
      window.location.href = url;
      return;
    }

    await Linking.openURL(url).catch(async () => {
      await WebBrowser.openBrowserAsync(url);
    });
  }

  async function createDriverStripeCheckout({
    cleanEmail,
    cleanFullName,
    cleanUsername,
    driverId,
    accountId,
  }: {
    cleanEmail: string;
    cleanFullName: string;
    cleanUsername: string;
    driverId: string;
    accountId: string;
  }) {
    const successUrl = `${APP_URL}/driver/register?stripe=success&driverId=${encodeURIComponent(driverId)}`;
    const cancelUrl = `${APP_URL}/driver/register?stripe=cancelled&driverId=${encodeURIComponent(driverId)}`;

    const response = await fetch(`${API_BASE_URL}/payments/create-driver-subscription-checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: "driver",
        planType: "driver",
        userId: driverId,
        driverId,
        driver_id: driverId,
        accountId,
        account_id: accountId,
        email: cleanEmail,
        customerEmail: cleanEmail,
        driver_email: cleanEmail,
        companyName: cleanFullName,
        businessName: cleanFullName,
        name: cleanFullName,
        username: cleanUsername,
        successUrl,
        success_url: successUrl,
        cancelUrl,
        cancel_url: cancelUrl,
        metadata: {
          role: "driver",
          driver_id: driverId,
          account_id: accountId,
          driver_email: cleanEmail,
          email: cleanEmail,
          name: cleanFullName,
          username: cleanUsername,
        },
      }),
    });

    const text = await response.text();

    let data: any = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    if (!response.ok || (!data.url && !data.alreadySubscribed)) {
      throw new Error(data.error || data.message || data.raw || "Stripe checkout failed.");
    }

    return data;
  }

  async function forceSyncDriverSubscription(driverId: string, localDriver?: any) {
    try {
      const response = await fetch(`${API_BASE_URL}/payments/sync-stripe-by-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "driver",
          email: normalize(localDriver?.email || email),
          name: localDriver?.name || localDriver?.fullName || fullName,
          username: normalize(localDriver?.username || username),
          userId: driverId,
          driverId,
          driver_id: driverId,
        }),
      });

      const text = await response.text();
      let json: any = {};
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        json = { success: false, error: text };
      }

      if (!response.ok || !json.success) return null;

      const stripeCustomerId = json.stripeCustomerId || json.stripe_customer_id || "";
      const stripeSubscriptionId = json.stripeSubscriptionId || json.stripe_subscription_id || "";
      const subscriptionStatus = json.subscriptionStatus || json.subscription_status || "active";

      if (stripeCustomerId || stripeSubscriptionId) {
        await supabase
          .from("drivers")
          .update({
            stripe_customer_id: stripeCustomerId || null,
            stripe_subscription_id: stripeSubscriptionId || null,
            subscription_id: stripeSubscriptionId || null,
            subscription_status: subscriptionStatus,
            membership_status: stripeSubscriptionId ? "active" : "pending",
            driver_membership_paid: Boolean(stripeSubscriptionId),
            updated_at: new Date().toISOString(),
          })
          .eq("id", driverId);
      }

      return json;
    } catch {
      return null;
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
        stripe_account_id: driverRow?.stripe_account_id || null,
      })
      .eq("id", driverId);

    await supabase.from("admin_verifications").upsert(
      {
        id: driverId,
        driver_id: driverId,
        profile_id: driverId,
        account_id: driverRow?.account_id || "",
        account_type: "DRIVER",
        role: "driver",
        type: "DRIVER",
        full_name: driverRow?.full_name || driverRow?.name || "",
        name: driverRow?.name || driverRow?.full_name || "",
        email: driverRow?.email || "",
        phone: driverRow?.phone || "",
        username: driverRow?.username || "",
        status: "SUBMITTED",
        compliance_status: "SUBMITTED",
        admin_review_status: "submitted",
        review_decision: "submitted",
        approved: true,
        rejected: false,
        reviewed: false,
        needs_more_info: false,
        account_active: true,
        application_submitted: true,
        submitted_at: now,
        membership_status: paid ? "active" : "pending",
        subscription_status: driverRow?.subscription_status || (paid ? "active" : "pending"),
        driver_membership_paid: paid,
        stripe_customer_id: driverRow?.stripe_customer_id || null,
        stripe_subscription_id: driverRow?.stripe_subscription_id || driverRow?.subscription_id || null,
        subscription_id: driverRow?.stripe_subscription_id || driverRow?.subscription_id || null,
        updated_at: now,
        created_at: driverRow?.created_at || now,
      },
      { onConflict: "id" }
    );

    const { data: updatedDriver } = await supabase
      .from("drivers")
      .select("*")
      .eq("id", driverId)
      .maybeSingle();

    if (updatedDriver) {
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

  async function registerDriver() {
    if (loading) return;
    if (!validateForm()) return;

    const cleanFullName = fullName.trim();
    const cleanEmail = normalize(email);
    const cleanPhone = phone.trim();
    const cleanUsername = normalize(username);
    const cleanPassword = password.trim();

    try {
      setLoading(true);

      const duplicate = await checkDuplicateDriver(cleanEmail, cleanUsername);
      if (duplicate) return;

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: cleanEmail,
        password: cleanPassword,
        options: {
          data: {
            role: "driver",
            username: cleanUsername,
            full_name: cleanFullName,
            name: cleanFullName,
          },
        },
      });

      if (authError) {
        Alert.alert("Signup Error", authError.message);
        return;
      }

      const driverId = authData?.user?.id;

      if (!driverId) {
        Alert.alert("Signup Error", "Unable to create driver account. Please try again.");
        return;
      }

      const accountId = await generateDriverAccountId();
      const now = new Date().toISOString();

      const uploadedLicense = await uploadDriverDocument(
        driverId,
        "driver_license",
        licenseDocument as UploadedDocument
      );

      const uploadedInsurance = await uploadDriverDocument(
        driverId,
        "insurance",
        insuranceDocument as UploadedDocument
      );

      const driverPayload = {
        id: driverId,
        account_id: accountId,
        auth_user_id: driverId,
        profile_id: driverId,
        role: "driver",

        full_name: cleanFullName,
        name: cleanFullName,
        email: cleanEmail,
        phone: cleanPhone,
        username: cleanUsername,

        vehicle_type: vehicleType.trim(),
        license_number: licenseNumber.trim(),
        service_area: serviceArea.trim(),

        has_insurance: hasInsurance,
        has_valid_license: hasValidLicense,
        accepts_background_check: acceptsBackgroundCheck,

        license_document: uploadedLicense,
        insurance_document: uploadedInsurance,
        uploaded_docs: {
          driver_license: uploadedLicense,
          insurance: uploadedInsurance,
        },
        documents_uploaded: true,

        security_question_1: securityQuestion1,
        security_answer_1: normalizeAnswer(securityAnswer1),
        security_question_2: securityQuestion2,
        security_answer_2: normalizeAnswer(securityAnswer2),
        security_question_3: securityQuestion3,
        security_answer_3: normalizeAnswer(securityAnswer3),

        approved: true,
        verified: true,
        account_active: true,

        application_submitted: false,
        submitted_at: null,
        verification_status: "PENDING_PAYMENT",
        compliance_status: "PENDING_PAYMENT",
        admin_review_status: "pending_payment",

        stripe_account_id: null,
        stripe_customer_id: null,
        stripe_subscription_id: null,
        stripe_checkout_session_id: null,
        stripe_connect_status: "not_started",
        payouts_enabled: false,
        charges_enabled: false,
        stripe_payouts_enabled: false,
        stripe_charges_enabled: false,
        stripe_onboarding_complete: false,

        subscription_status: "pending_payment",
        membership_status: "pending_payment",
        driver_membership_paid: false,

        notifications_enabled: true,
        expo_push_token: "",

        created_at: now,
        updated_at: now,
      };

      await upsertProfile(driverPayload);

      const { error: driverError } = await supabase
        .from("drivers")
        .upsert(driverPayload, { onConflict: "id" });

      if (driverError) {
        Alert.alert("Driver Profile Error", driverError.message);
        return;
      }

      const localDriver = {
        ...driverPayload,
        driverId,
        accountId,
        account_id: accountId,
        fullName: cleanFullName,
        vehicleType: vehicleType.trim(),
        licenseNumber: licenseNumber.trim(),
        serviceArea: serviceArea.trim(),
        hasInsurance,
        hasValidLicense,
        acceptsBackgroundCheck,
        licenseDocument: uploadedLicense,
        insuranceDocument: uploadedInsurance,
        documentsUploaded: true,
        applicationSubmitted: false,
        subscriptionStatus: "pending_payment",
        membershipStatus: "pending_payment",
        driverMembershipPaid: false,
      };

      await saveDriverSession(localDriver);

      const data = await createDriverStripeCheckout({
        cleanEmail,
        cleanFullName,
        cleanUsername,
        driverId,
        accountId,
      });

      const stripeCustomerId =
        data.stripeCustomerId ||
        data.stripe_customer_id ||
        data.customerId ||
        data.customer_id ||
        "";

      const stripeCheckoutSessionId = data.id || data.sessionId || data.session_id || "";

      await supabase
        .from("drivers")
        .update({
          stripe_customer_id: stripeCustomerId || null,
          stripe_checkout_session_id: stripeCheckoutSessionId || null,
          membership_status: data.alreadySubscribed ? "active" : "pending_payment",
          subscription_status: data.subscriptionStatus || (data.alreadySubscribed ? "active" : "pending_payment"),
          updated_at: new Date().toISOString(),
        })
        .eq("id", driverId);

      await saveDriverSession({
        ...localDriver,
        stripeCustomerId,
        stripeCheckoutSessionId,
        membershipStatus: data.alreadySubscribed ? "active" : "pending_payment",
        subscriptionStatus: data.subscriptionStatus || (data.alreadySubscribed ? "active" : "pending_payment"),
        updatedAt: new Date().toISOString(),
      });

      if (data.alreadySubscribed) {
        await forceSyncDriverSubscription(driverId, localDriver);
        await markDriverApplicationSubmittedAndOpenDashboard(driverId);
        return;
      }

      await openCheckoutUrl(data.url);
    } catch (error: any) {
      console.log("Driver register error:", error);
      Alert.alert("Registration Error", error?.message || "Unable to complete driver registration.");
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

            return (
              <TouchableOpacity
                key={question}
                style={[styles.questionChip, active && styles.questionChipActive]}
                onPress={() => setSelectedQuestion(question)}
                activeOpacity={0.85}
              >
                <Text style={[styles.questionChipText, active && styles.questionChipTextActive]}>
                  {question}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <TextInput
          style={styles.input}
          placeholder="Hidden answer"
          placeholderTextColor="#94A3B8"
          value={answer}
          onChangeText={setAnswer}
          secureTextEntry
        />
      </View>
    );
  }

  function SectionHeader({
    title,
    icon,
    subtitle,
  }: {
    title: string;
    icon: keyof typeof Ionicons.glyphMap;
    subtitle?: string;
  }) {
    return (
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}>
          <Ionicons name={icon} size={20} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.section}>{title}</Text>
          {!!subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
        </View>
      </View>
    );
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
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.shell}>
            <View style={styles.sidebar}>
              <View style={styles.brandRow}>
                <View style={styles.brandIcon}>
                  <Ionicons name="car-outline" size={28} color={COLORS.white} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.brandTitle}>Farm2Home</Text>
                  <Text style={styles.brandSubtitle}>Driver Registration</Text>
                </View>
              </View>

              <View style={styles.sideDivider} />

              <View style={styles.scoreCard}>
                <Text style={styles.scoreLabel}>Registration Progress</Text>
                <Text style={styles.scoreValue}>{checklistScore}/6</Text>
                <Text style={styles.scoreHint}>
                  Complete profile, login, verification, documents, security, then subscribe.
                </Text>
              </View>

              {checklistItems.map((item) => (
                <View key={item.label} style={styles.stepNav}>
                  <View style={[styles.stepNavIcon, item.complete && styles.stepNavIconDone]}>
                    <Ionicons
                      name={item.complete ? "checkmark-outline" : "ellipse-outline"}
                      size={18}
                      color={item.complete ? COLORS.white : COLORS.primary}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.stepNavText}>{item.label}</Text>
                    <Text style={styles.stepNavSubText}>{item.value}</Text>
                  </View>
                </View>
              ))}

              <TouchableOpacity
                style={styles.homeButton}
                onPress={() => router.replace("/" as any)}
                activeOpacity={0.9}
              >
                <Ionicons name="home-outline" size={18} color={COLORS.primary} />
                <Text style={styles.homeButtonText}>Back to Home</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.loginSideButton}
                onPress={() => router.push("/driver/login" as any)}
                activeOpacity={0.9}
              >
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
                    Create your driver profile, upload required documents, complete Stripe membership, then open the driver dashboard.
                  </Text>
                </View>

                <View style={styles.pricePill}>
                  <Text style={styles.pricePillValue}>$4.99</Text>
                  <Text style={styles.pricePillLabel}>monthly</Text>
                </View>
              </View>

              <View style={styles.metricsRow}>
                <MetricCard icon="person-outline" label="Profile" value={fullName ? "Started" : "Pending"} />
                <MetricCard icon="cloud-upload-outline" label="Documents" value={licenseDocument && insuranceDocument ? "Uploaded" : "Required"} />
                <MetricCard icon="card-outline" label="Stripe" value="Checkout" />
              </View>

              <View style={styles.noticeBox}>
                <Ionicons
                  name={processingReturn ? "sync-outline" : "shield-checkmark-outline"}
                  size={20}
                  color={COLORS.primary}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.noticeTitle}>
                    {processingReturn ? "Completing Driver Registration" : "Permanent Profile Setup"}
                  </Text>
                  <Text style={styles.noticeText}>
                    {processingReturn
                      ? "Please wait while we sync Stripe, submit your application, and open your dashboard."
                      : "Your driver profile saves to Supabase before Stripe checkout. Customer and subscription IDs sync after payment."}
                  </Text>
                </View>
              </View>

              <View style={styles.card}>
                <SectionHeader title="Driver Information" icon="person-outline" subtitle="Basic contact details for your driver profile." />
                <Field label="Full Name" value={fullName} onChangeText={setFullName} placeholder="Full name" icon="person-outline" />
                <Field label="Email" value={email} onChangeText={setEmail} placeholder="driver@email.com" icon="mail-outline" keyboardType="email-address" />
                <Field label="Phone" value={phone} onChangeText={setPhone} placeholder="Phone number" icon="call-outline" keyboardType="phone-pad" />
              </View>

              <View style={styles.card}>
                <SectionHeader title="Create Driver Login" icon="lock-closed-outline" subtitle="Create credentials for the Driver Portal." />
                <Field label="Username" value={username} onChangeText={setUsername} placeholder="Create username" icon="person-circle-outline" />
                <Field label="Password" value={password} onChangeText={setPassword} placeholder="Create password" icon="lock-closed-outline" secureTextEntry />
                <Field label="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Confirm password" icon="shield-checkmark-outline" secureTextEntry />
              </View>

              <View style={styles.card}>
                <SectionHeader title="Driver Verification" icon="shield-checkmark-outline" subtitle="Vehicle, license, insurance, and service area." />
                <Field label="Vehicle Type" value={vehicleType} onChangeText={setVehicleType} placeholder="Car, van, truck, box truck..." icon="car-outline" />
                <Field label="Driver License Number" value={licenseNumber} onChangeText={setLicenseNumber} placeholder="License number" icon="id-card-outline" />
                <Field label="Service Area" value={serviceArea} onChangeText={setServiceArea} placeholder="Detroit Metro, Sterling Heights..." icon="map-outline" />

                <TouchableOpacity style={styles.uploadButton} onPress={() => pickDocument("license")} activeOpacity={0.9}>
                  <Ionicons name={licenseDocument ? "checkmark-circle" : "cloud-upload-outline"} size={20} color={licenseDocument ? COLORS.accentDark : COLORS.primary} />
                  <Text style={styles.uploadText}>{licenseDocument ? `License: ${licenseDocument.name}` : "Upload Driver License"}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.uploadButton} onPress={() => pickDocument("insurance")} activeOpacity={0.9}>
                  <Ionicons name={insuranceDocument ? "checkmark-circle" : "cloud-upload-outline"} size={20} color={insuranceDocument ? COLORS.accentDark : COLORS.primary} />
                  <Text style={styles.uploadText}>{insuranceDocument ? `Insurance: ${insuranceDocument.name}` : "Upload Insurance"}</Text>
                </TouchableOpacity>

                <ToggleRow label="I have active auto insurance" value={hasInsurance} onValueChange={setHasInsurance} />
                <ToggleRow label="I have a valid driver license" value={hasValidLicense} onValueChange={setHasValidLicense} />
                <ToggleRow label="I authorize Farm2Home to review driver eligibility" value={acceptsBackgroundCheck} onValueChange={setAcceptsBackgroundCheck} />
              </View>

              <View style={styles.card}>
                <SectionHeader title="Security Questions" icon="key-outline" subtitle="Choose 3 different questions for account verification." />
                {renderQuestionPicker("Security Question 1", securityQuestion1, setSecurityQuestion1, securityAnswer1, setSecurityAnswer1)}
                {renderQuestionPicker("Security Question 2", securityQuestion2, setSecurityQuestion2, securityAnswer2, setSecurityAnswer2)}
                {renderQuestionPicker("Security Question 3", securityQuestion3, setSecurityQuestion3, securityAnswer3, setSecurityAnswer3)}
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, loading && styles.disabledButton]}
                onPress={registerDriver}
                disabled={loading}
                activeOpacity={0.9}
              >
                {loading ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <>
                    <Ionicons name="card-outline" size={18} color={COLORS.white} />
                    <Text style={styles.primaryButtonText}>Register + Subscribe</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => router.push("/driver/login" as any)}
                disabled={loading}
                activeOpacity={0.9}
              >
                <Ionicons name="log-in-outline" size={18} color={COLORS.primary} />
                <Text style={styles.secondaryButtonText}>Already registered? Driver Login</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  icon: keyof typeof Ionicons.glyphMap;
  keyboardType?: any;
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
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry={secureTextEntry}
        />
      </View>
    </View>
  );
}

function ToggleRow({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (value: boolean) => void }) {
  return (
    <View style={styles.switchRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.switchText}>{label}</Text>
      </View>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
  );
}

function MetricCard({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
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
  brandRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 },
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
  sideDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.12)", marginVertical: 8 },
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
  stepNavIcon: {
    width: 30,
    height: 30,
    borderRadius: 12,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNavIconDone: { backgroundColor: COLORS.accent },
  stepNavText: { color: "#CBD5E1", fontWeight: "900" },
  stepNavSubText: { color: "#94A3B8", fontSize: 11, fontWeight: "700", marginTop: 2 },
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
  eyebrow: { color: COLORS.primary, textTransform: "uppercase", letterSpacing: 1, fontSize: 12, fontWeight: "900" },
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
  metricsRow: { flexDirection: Platform.OS === "web" ? "row" : "column", gap: 12, marginBottom: 14 },
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
  metricLabel: { color: COLORS.muted, fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  metricValue: { color: COLORS.text, fontWeight: "900", marginTop: 3 },
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
  noticeTitle: { color: COLORS.text, fontWeight: "900", fontSize: 16 },
  noticeText: { color: COLORS.muted, fontWeight: "700", lineHeight: 20, marginTop: 4 },
  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
  },
  sectionHeader: { flexDirection: "row", gap: 10, alignItems: "flex-start", marginBottom: 16 },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
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
  questionBox: { marginBottom: 12 },
  questionLabel: { color: COLORS.text, fontWeight: "900", marginBottom: 8 },
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
  questionChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  questionChipText: { color: COLORS.primary, fontWeight: "900" },
  questionChipTextActive: { color: COLORS.white },
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
  primaryButtonText: { color: COLORS.white, textAlign: "center", fontWeight: "900", fontSize: 16 },
  secondaryButton: {
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    padding: 15,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  secondaryButtonText: { color: COLORS.primary, fontWeight: "900" },
  disabledButton: { opacity: 0.6 },
});