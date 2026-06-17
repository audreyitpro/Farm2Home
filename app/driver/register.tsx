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
  amber: "#D97706",
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

    const { data, error } = await supabase
      .from("profiles")
      .upsert(
        {
          id: payload.id,
          auth_user_id: payload.id,
          profile_id: payload.id,
          account_id: payload.account_id,
          role: "driver",
          full_name: payload.full_name,
          name: payload.name,
          email: payload.email,
          phone: payload.phone,
          username: payload.username,
          account_active: true,
          updated_at: payload.updated_at || now,
          created_at: payload.created_at || now,
        },
        { onConflict: "id" }
      )
      .select("*")
      .single();

    if (error) throw error;
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

        await supabase
          .from("profiles")
          .update({
            stripe_customer_id: stripeCustomerId || null,
            stripe_subscription_id: stripeSubscriptionId || null,
            subscription_id: stripeSubscriptionId || null,
            subscription_status: subscriptionStatus,
            membership_status: stripeSubscriptionId ? "active" : "pending",
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
        account_active: true,
        membership_status: paid ? "active" : "pending",
        subscription_status: driverRow?.subscription_status || (paid ? "active" : "pending"),
        updated_at: now,
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
      <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />

      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.page}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heroCard}>
            <View style={styles.heroIcon}>
              <Ionicons name="car-outline" size={32} color="#FFFFFF" />
            </View>

            <Text style={styles.kicker}>Farm2Home Driver Portal</Text>
            <Text style={styles.title}>Driver Registration</Text>
            <Text style={styles.subtitle}>
              Register, complete Stripe checkout, and your application will automatically submit before opening the Driver Dashboard.
            </Text>
          </View>

          {processingReturn ? (
            <View style={styles.noticeBox}>
              <Text style={styles.noticeTitle}>Completing Driver Registration</Text>
              <Text style={styles.noticeText}>
                Please wait while we sync Stripe, submit your application, and open your dashboard.
              </Text>
            </View>
          ) : (
            <View style={styles.noticeBox}>
              <Text style={styles.noticeTitle}>Permanent Profile Setup</Text>
              <Text style={styles.noticeText}>
                Your driver profile is saved to Supabase before Stripe checkout. Stripe customer and subscription IDs are synced after payment.
              </Text>
            </View>
          )}

          <View style={styles.priceBox}>
            <View>
              <Text style={styles.price}>$4.99 / month</Text>
              <Text style={styles.priceSub}>Access the Driver Delivery Board</Text>
            </View>
            <View style={styles.priceBadge}>
              <Ionicons name="flash-outline" size={20} color="#FFFFFF" />
            </View>
          </View>

          <View style={styles.formCard}>
            <SectionHeader
              title="Driver Information"
              icon="person-outline"
              subtitle="Basic contact details for your driver profile."
            />

            <TextInput style={styles.input} placeholder="Full Name" placeholderTextColor="#94A3B8" value={fullName} onChangeText={setFullName} />
            <TextInput style={styles.input} placeholder="Email" placeholderTextColor="#94A3B8" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
            <TextInput style={styles.input} placeholder="Phone" placeholderTextColor="#94A3B8" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          </View>

          <View style={styles.formCard}>
            <SectionHeader title="Create Driver Login" icon="lock-closed-outline" subtitle="Create credentials for the Driver Portal." />
            <TextInput style={styles.input} placeholder="Create Username" placeholderTextColor="#94A3B8" value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} />
            <TextInput style={styles.input} placeholder="Create Password" placeholderTextColor="#94A3B8" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" />
            <TextInput style={styles.input} placeholder="Confirm Password" placeholderTextColor="#94A3B8" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry autoCapitalize="none" />
          </View>

          <View style={styles.formCard}>
            <SectionHeader title="Driver Verification" icon="shield-checkmark-outline" subtitle="Vehicle, license, insurance, and service area." />

            <TextInput style={styles.input} placeholder="Vehicle Type" placeholderTextColor="#94A3B8" value={vehicleType} onChangeText={setVehicleType} />
            <TextInput style={styles.input} placeholder="Driver License Number" placeholderTextColor="#94A3B8" value={licenseNumber} onChangeText={setLicenseNumber} />
            <TextInput style={styles.input} placeholder="Service Area" placeholderTextColor="#94A3B8" value={serviceArea} onChangeText={setServiceArea} />

            <TouchableOpacity style={styles.uploadButton} onPress={() => pickDocument("license")}>
              <Ionicons name={licenseDocument ? "checkmark-circle" : "cloud-upload-outline"} size={20} color={COLORS.red} />
              <Text style={styles.uploadText}>
                {licenseDocument ? `License: ${licenseDocument.name}` : "Upload Driver License"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.uploadButton} onPress={() => pickDocument("insurance")}>
              <Ionicons name={insuranceDocument ? "checkmark-circle" : "cloud-upload-outline"} size={20} color={COLORS.red} />
              <Text style={styles.uploadText}>
                {insuranceDocument ? `Insurance: ${insuranceDocument.name}` : "Upload Insurance"}
              </Text>
            </TouchableOpacity>

            <View style={styles.switchRow}>
              <Text style={styles.switchText}>I have active auto insurance</Text>
              <Switch value={hasInsurance} onValueChange={setHasInsurance} />
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchText}>I have a valid driver license</Text>
              <Switch value={hasValidLicense} onValueChange={setHasValidLicense} />
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchText}>I authorize Farm2Home to review driver eligibility</Text>
              <Switch value={acceptsBackgroundCheck} onValueChange={setAcceptsBackgroundCheck} />
            </View>
          </View>

          <View style={styles.securityCard}>
            <SectionHeader title="Security Questions" icon="key-outline" subtitle="Choose 3 questions for account verification." />
            {renderQuestionPicker("Security Question 1", securityQuestion1, setSecurityQuestion1, securityAnswer1, setSecurityAnswer1)}
            {renderQuestionPicker("Security Question 2", securityQuestion2, setSecurityQuestion2, securityAnswer2, setSecurityAnswer2)}
            {renderQuestionPicker("Security Question 3", securityQuestion3, setSecurityQuestion3, securityAnswer3, setSecurityAnswer3)}
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.disabledButton]}
            onPress={registerDriver}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="card-outline" size={18} color="#FFFFFF" />
                <Text style={styles.buttonText}>Register + Subscribe</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push("/driver/login" as any)} activeOpacity={0.85}>
            <Text style={styles.link}>Already registered? Driver Login</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  keyboard: { flex: 1, backgroundColor: COLORS.bg },
  page: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingBottom: 90 },
  heroCard: {
    backgroundColor: COLORS.black,
    paddingTop: 26,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  heroIcon: {
    width: 62,
    height: 62,
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
    fontSize: 36,
    fontWeight: "900",
    marginTop: 6,
    color: "#FFFFFF",
  },
  subtitle: {
    color: "#CBD5E1",
    fontSize: 15,
    lineHeight: 23,
    fontWeight: "700",
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
  noticeTitle: { color: COLORS.text, fontWeight: "900", fontSize: 17 },
  noticeText: { color: COLORS.muted, fontWeight: "700", lineHeight: 22, marginTop: 6 },
  priceBox: {
    backgroundColor: COLORS.red,
    padding: 18,
    borderRadius: 20,
    marginHorizontal: 18,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  price: { fontSize: 26, fontWeight: "900", color: "#FFFFFF" },
  priceSub: { color: "#FFE4E6", marginTop: 4, fontWeight: "800" },
  priceBadge: {
    width: 44,
    height: 44,
    borderRadius: 18,
    backgroundColor: COLORS.black,
    alignItems: "center",
    justifyContent: "center",
  },
  formCard: {
    backgroundColor: COLORS.card,
    marginHorizontal: 18,
    marginBottom: 16,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  securityCard: {
    backgroundColor: COLORS.card,
    marginHorizontal: 18,
    marginBottom: 16,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionHeader: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    marginBottom: 16,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: COLORS.black,
    alignItems: "center",
    justifyContent: "center",
  },
  section: { fontSize: 20, fontWeight: "900", color: COLORS.text },
  sectionSubtitle: {
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 3,
  },
  input: {
    backgroundColor: COLORS.surface,
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    fontSize: 16,
    color: COLORS.text,
    fontWeight: "700",
  },
  uploadButton: {
    backgroundColor: "#FFF1F2",
    borderWidth: 1,
    borderColor: COLORS.red,
    padding: 15,
    borderRadius: 14,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  uploadText: { color: COLORS.red, fontWeight: "900", flex: 1 },
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
  switchText: {
    flex: 1,
    fontWeight: "800",
    paddingRight: 12,
    color: COLORS.text,
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
  questionChipText: {
    color: COLORS.red,
    fontWeight: "900",
  },
  questionChipTextActive: { color: "#FFFFFF" },
  button: {
    backgroundColor: COLORS.red,
    padding: 16,
    borderRadius: 16,
    marginHorizontal: 18,
    marginTop: 4,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  disabledButton: { opacity: 0.6 },
  buttonText: {
    color: "#FFFFFF",
    textAlign: "center",
    fontWeight: "900",
    fontSize: 16,
  },
  link: {
    color: COLORS.red,
    textAlign: "center",
    fontWeight: "900",
    marginTop: 18,
  },
});