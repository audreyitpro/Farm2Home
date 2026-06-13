// app/freight/register.tsx

import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
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
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../data/supabaseClient";

const STRIPE_BUY_BUTTON_ID = "buy_btn_1Thv9XCfiUZdoSmRqMvxAPee";
const STRIPE_PUBLISHABLE_KEY =
  "pk_live_51TTl33CfiUZdoSmRb0FzebTFOelowqxf1RikjB8mH7hBCMASmORBT9F8hud7VFL7suy59d8XIOBRGHUGMiXYkjCb00RAs1GpA9";

const COLORS = {
  bg: "#F4F5F7",
  card: "#FFFFFF",
  surface: "#F9FAFB",
  black: "#050505",
  red: "#D71920",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
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

function normalize(value: string) {
  return String(value || "").trim().toLowerCase();
}

function normalizeAnswer(value: string) {
  return String(value || "").trim().toLowerCase();
}

async function saveFreightSession(carrier: any) {
  await AsyncStorage.setItem("pendingFreightCarrier", JSON.stringify(carrier));
  await AsyncStorage.setItem("currentFreightCarrier", JSON.stringify(carrier));
  await AsyncStorage.setItem("currentFreight", JSON.stringify(carrier));
  await AsyncStorage.setItem("currentFreightUser", JSON.stringify(carrier));
  await AsyncStorage.setItem("currentUser", JSON.stringify(carrier));
  await AsyncStorage.setItem("userRole", "freight");
  await AsyncStorage.setItem("currentUserRole", "freight");
}

export default function FreightRegister() {
  const [saving, setSaving] = useState(false);
  const [savedCarrierId, setSavedCarrierId] = useState("");

  const [freightId, setFreightId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [stripeId, setStripeId] = useState("");
  const [subscriptionId, setSubscriptionId] = useState("");

  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceArea, setServiceArea] = useState("");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [securityQuestion1, setSecurityQuestion1] = useState("");
  const [securityAnswer1, setSecurityAnswer1] = useState("");
  const [securityQuestion2, setSecurityQuestion2] = useState("");
  const [securityAnswer2, setSecurityAnswer2] = useState("");
  const [securityQuestion3, setSecurityQuestion3] = useState("");
  const [securityAnswer3, setSecurityAnswer3] = useState("");

  const [businessAddress, setBusinessAddress] = useState("");
  const [city, setCity] = useState("");
  const [stateValue, setStateValue] = useState("");
  const [zipCode, setZipCode] = useState("");

  const [mdotNumber, setMdotNumber] = useState("");
  const [mcNumber, setMcNumber] = useState("");
  const [insuranceProvider, setInsuranceProvider] = useState("");
  const [insurancePolicyNumber, setInsurancePolicyNumber] = useState("");

  const [authorityActive, setAuthorityActive] = useState(false);
  const [insuranceActive, setInsuranceActive] = useState(false);
  const [licensedLivestock, setLicensedLivestock] = useState(false);
  const [licensedRefrigeratedFood, setLicensedRefrigeratedFood] = useState(false);

  const selectedQuestions = useMemo(
    () => [securityQuestion1, securityQuestion2, securityQuestion3].filter(Boolean),
    [securityQuestion1, securityQuestion2, securityQuestion3]
  );

  useEffect(() => {
    async function loadSavedFreight() {
      try {
        const saved =
          (await AsyncStorage.getItem("currentFreightCarrier")) ||
          (await AsyncStorage.getItem("currentFreight")) ||
          (await AsyncStorage.getItem("currentFreightUser"));

        if (!saved) return;

        const carrier = JSON.parse(saved);

        setFreightId(carrier.id || carrier.freightId || carrier.freight_id || "");
        setSavedCarrierId(carrier.id || carrier.freightId || carrier.freight_id || "");
        setAccountId(carrier.accountId || carrier.account_id || "");
        setStripeId(carrier.stripeCustomerId || carrier.stripe_customer_id || carrier.stripeId || "");
        setSubscriptionId(carrier.stripeSubscriptionId || carrier.stripe_subscription_id || "");

        setCompanyName(carrier.companyName || carrier.company_name || "");
        setContactName(carrier.contactName || carrier.contact_name || "");
        setEmail(carrier.email || "");
        setPhone(carrier.phone || "");
        setUsername(carrier.username || "");
        setServiceArea(carrier.serviceArea || carrier.service_area || "");

        setBusinessAddress(carrier.businessAddress || carrier.business_address || "");
        setCity(carrier.city || "");
        setStateValue(carrier.state || "");
        setZipCode(carrier.zipCode || carrier.zip_code || "");

        setMdotNumber(carrier.mdotNumber || carrier.mdot_number || carrier.dot_number || "");
        setMcNumber(carrier.mcNumber || carrier.mc_number || "");
        setInsuranceProvider(carrier.insuranceProvider || carrier.insurance_provider || "");
        setInsurancePolicyNumber(
          carrier.insurancePolicyNumber || carrier.insurance_policy_number || ""
        );

        setAuthorityActive(Boolean(carrier.authorityActive || carrier.authority_active));
        setInsuranceActive(Boolean(carrier.insuranceActive || carrier.insurance_active));
        setLicensedLivestock(Boolean(carrier.licensedLivestock || carrier.licensed_livestock));
        setLicensedRefrigeratedFood(
          Boolean(carrier.licensedRefrigeratedFood || carrier.licensed_refrigerated_food)
        );
      } catch (error) {
        console.log("LOAD FREIGHT SESSION ERROR:", error);
      }
    }

    loadSavedFreight();
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") return;

    const existing = document.querySelector(
      'script[src="https://js.stripe.com/v3/buy-button.js"]'
    );

    if (existing) return;

    const script = document.createElement("script");
    script.src = "https://js.stripe.com/v3/buy-button.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  function validateForm() {
    if (!companyName.trim() || !contactName.trim() || !normalize(email) || !phone.trim()) {
      Alert.alert("Missing Info", "Company, contact, email, and phone are required.");
      return false;
    }

    if (!normalize(email).includes("@")) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return false;
    }

    if (!username.trim() || !password.trim() || !confirmPassword.trim()) {
      Alert.alert("Login Required", "Please create a username and password.");
      return false;
    }

    if (normalize(username).length < 4) {
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

    if (selectedQuestions.length !== 3 || new Set(selectedQuestions).size !== 3) {
      Alert.alert("Security Questions Required", "Please choose 3 different security questions.");
      return false;
    }

    if (!securityAnswer1.trim() || !securityAnswer2.trim() || !securityAnswer3.trim()) {
      Alert.alert("Security Answers Required", "Please answer all 3 security questions.");
      return false;
    }

    if (!businessAddress.trim() || !city.trim() || !stateValue.trim() || !zipCode.trim()) {
      Alert.alert("Missing Address", "Business address, city, state, and zip code are required.");
      return false;
    }

    if (!mdotNumber.trim() || !mcNumber.trim()) {
      Alert.alert("Missing Authority", "MDOT number and MC number are required.");
      return false;
    }

    if (!insuranceProvider.trim() || !insurancePolicyNumber.trim()) {
      Alert.alert("Missing Insurance", "Insurance provider and policy number are required.");
      return false;
    }

    if (!authorityActive || !insuranceActive) {
      Alert.alert("Verification Required", "Confirm active authority and insurance.");
      return false;
    }

    if (!licensedLivestock && !licensedRefrigeratedFood) {
      Alert.alert("License Required", "Select livestock, refrigerated food, or both.");
      return false;
    }

    return true;
  }

  async function generateFreightAccountId() {
    const { data, error } = await supabase.rpc("next_account_id", {
      p_role: "freight",
      p_prefix: "Freight",
    });

    if (error) {
      console.log("Freight account_id RPC error:", error.message);
      throw error;
    }

    if (!data) {
      throw new Error("Unable to generate freight account ID.");
    }

    return String(data);
  }

  async function checkDuplicateFreight(cleanEmail: string, cleanUsername: string) {
    const { data, error } = await supabase
      .from("freight_users")
      .select(
        "id,account_id,freight_id,email,username,stripe_id,stripe_customer_id,stripe_subscription_id"
      )
      .or(`email.eq.${cleanEmail},username.eq.${cleanUsername}`)
      .limit(1);

    if (error) {
      console.log("Freight duplicate check skipped:", error.message);
      return null;
    }

    return Array.isArray(data) && data.length > 0 ? data[0] : null;
  }

  async function saveFreightUserRow(carrierId: string, savedAccountId?: string) {
    const now = new Date().toISOString();

    const cleanCompanyName = companyName.trim();
    const cleanContactName = contactName.trim();
    const cleanEmail = normalize(email);
    const cleanPhone = phone.trim();
    const cleanUsername = normalize(username);
    const finalAccountId = savedAccountId || accountId || (await generateFreightAccountId());

    const freightPayload = {
      id: carrierId,
      account_id: finalAccountId,
      freight_id: carrierId,
      profile_id: carrierId,
      auth_user_id: carrierId,
      role: "freight",

      company_name: cleanCompanyName,
      business_name: cleanCompanyName,
      contact_name: cleanContactName,
      full_name: cleanContactName,
      name: cleanContactName,
      owner_name: cleanContactName,
      email: cleanEmail,
      phone: cleanPhone,
      username: cleanUsername,

      account_active: true,

      stripe_id: stripeId || null,
      stripe_account_id: null,
      stripe_customer_id: stripeId || null,
      stripe_subscription_id: subscriptionId || null,
      stripe_checkout_session_id: null,
      stripe_connect_status: "not_started",
      payouts_enabled: false,
      charges_enabled: false,
      stripe_payouts_enabled: false,
      stripe_charges_enabled: false,
      stripe_onboarding_complete: false,

      security_question_1: securityQuestion1,
      security_answer_1: normalizeAnswer(securityAnswer1),
      security_question_2: securityQuestion2,
      security_answer_2: normalizeAnswer(securityAnswer2),
      security_question_3: securityQuestion3,
      security_answer_3: normalizeAnswer(securityAnswer3),

      service_area: serviceArea.trim(),
      business_address: businessAddress.trim(),
      city: city.trim(),
      state: stateValue.trim().toUpperCase(),
      zip_code: zipCode.trim(),

      mdot_number: mdotNumber.trim(),
      dot_number: mdotNumber.trim(),
      mc_number: mcNumber.trim(),
      insurance_provider: insuranceProvider.trim(),
      insurance_policy_number: insurancePolicyNumber.trim(),

      authority_active: authorityActive,
      insurance_active: insuranceActive,
      licensed_livestock: licensedLivestock,
      licensed_refrigerated_food: licensedRefrigeratedFood,

      approved: false,
      verification_status: "PENDING_VERIFICATION",
      compliance_status: "PENDING_VERIFICATION",
      admin_review_status: "pending",

      membership_status: subscriptionId ? "active" : "registration_saved",
      subscription_status: subscriptionId ? "active" : "not_started",
      freight_membership_paid: Boolean(subscriptionId),

      push_notifications: true,
      new_load_alerts: true,
      route_status_alerts: true,
      payout_alerts: true,
      billing_alerts: true,
      gps_tracking: true,
      background_route_updates: false,
      show_only_nearby_loads: false,
      show_refrigerated_loads: true,
      show_livestock_loads: true,
      privacy_mode: false,
      notifications_enabled: true,
      expo_push_token: "",

      created_at: now,
      updated_at: now,
    };

    const { error: profileError } = await supabase.from("profiles").upsert(
      {
        id: carrierId,
        auth_user_id: carrierId,
        account_id: finalAccountId,
        role: "freight",
        full_name: cleanContactName,
        name: cleanContactName,
        email: cleanEmail,
        phone: cleanPhone,
        username: cleanUsername,
        company_name: cleanCompanyName,
        account_active: true,
        created_at: now,
        updated_at: now,
      },
      { onConflict: "id" }
    );

    if (profileError) {
      console.log("PROFILE SAVE ERROR:", profileError.message);
    }

    const { data: existingFreightUser, error: existingError } = await supabase
      .from("freight_users")
      .select("id,account_id")
      .eq("id", carrierId)
      .maybeSingle();

    if (existingError) {
      console.log("FREIGHT LOOKUP ERROR:", existingError.message);
      Alert.alert("Lookup Error", existingError.message);
      throw existingError;
    }

    let savedFreightUser: any = null;
    let saveError: any = null;

    if (existingFreightUser?.id) {
      const { created_at, ...updatePayload } = freightPayload as any;

      const result = await supabase
        .from("freight_users")
        .update({
          ...updatePayload,
          account_id: existingFreightUser.account_id || finalAccountId,
          updated_at: now,
        })
        .eq("id", carrierId)
        .select()
        .single();

      savedFreightUser = result.data;
      saveError = result.error;
    } else {
      const result = await supabase
        .from("freight_users")
        .insert([freightPayload])
        .select()
        .single();

      savedFreightUser = result.data;
      saveError = result.error;
    }

    if (saveError) {
      console.log("FREIGHT USERS SAVE ERROR:", saveError.message);
      Alert.alert("Freight Save Error", saveError.message);
      throw saveError;
    }

    if (!savedFreightUser?.id) {
      throw new Error("Freight registration did not save to freight_users.");
    }

    const verify = await supabase
      .from("freight_users")
      .select("*")
      .eq("id", carrierId)
      .maybeSingle();

    if (verify.error) {
      console.log("VERIFY SAVE ERROR:", verify.error.message);
      Alert.alert("Verify Error", verify.error.message);
      throw verify.error;
    }

    if (!verify.data?.id) {
      throw new Error("Freight registration could not be verified in freight_users.");
    }

    await supabase.from("admin_verifications").upsert(
      {
        id: carrierId,
        account_id: verify.data.account_id || finalAccountId,
        carrier_id: carrierId,
        freight_id: carrierId,
        profile_id: carrierId,
        account_type: "FREIGHT_CARRIER",
        role: "freight",
        type: "FREIGHT_CARRIER",
        company_name: cleanCompanyName,
        business_name: cleanCompanyName,
        contact_name: cleanContactName,
        owner_name: cleanContactName,
        email: cleanEmail,
        phone: cleanPhone,
        username: cleanUsername,
        business_address: businessAddress.trim(),
        city: city.trim(),
        state: stateValue.trim().toUpperCase(),
        zip_code: zipCode.trim(),
        mdot_number: mdotNumber.trim(),
        dot_number: mdotNumber.trim(),
        mc_number: mcNumber.trim(),
        insurance_provider: insuranceProvider.trim(),
        insurance_policy_number: insurancePolicyNumber.trim(),
        authority_active: authorityActive,
        insurance_active: insuranceActive,
        licensed_livestock: licensedLivestock,
        licensed_refrigerated_food: licensedRefrigeratedFood,
        status: "PENDING_VERIFICATION",
        compliance_status: "PENDING_VERIFICATION",
        admin_review_status: "pending",
        review_decision: "pending",
        approved: false,
        rejected: false,
        reviewed: false,
        needs_more_info: false,
        account_active: true,
        membership_status: subscriptionId ? "active" : "registration_saved",
        subscription_status: subscriptionId ? "active" : "not_started",
        freight_membership_paid: Boolean(subscriptionId),
        stripe_id: stripeId || null,
        stripe_customer_id: stripeId || null,
        stripe_subscription_id: subscriptionId || null,
        created_at: now,
        updated_at: now,
      },
      { onConflict: "id" }
    );

    const localCarrier = {
      id: carrierId,
      accountId: verify.data.account_id || finalAccountId,
      account_id: verify.data.account_id || finalAccountId,

      freightId: carrierId,
      freight_id: carrierId,
      profileId: carrierId,
      profile_id: carrierId,
      authUserId: carrierId,
      auth_user_id: carrierId,

      role: "freight",

      companyName: cleanCompanyName,
      company_name: cleanCompanyName,
      businessName: cleanCompanyName,
      business_name: cleanCompanyName,
      contactName: cleanContactName,
      contact_name: cleanContactName,

      email: cleanEmail,
      phone: cleanPhone,
      username: cleanUsername,

      serviceArea: serviceArea.trim(),
      service_area: serviceArea.trim(),

      businessAddress: businessAddress.trim(),
      business_address: businessAddress.trim(),
      city: city.trim(),
      state: stateValue.trim().toUpperCase(),
      zipCode: zipCode.trim(),
      zip_code: zipCode.trim(),

      mdotNumber: mdotNumber.trim(),
      mdot_number: mdotNumber.trim(),
      dot_number: mdotNumber.trim(),
      mcNumber: mcNumber.trim(),
      mc_number: mcNumber.trim(),

      insuranceProvider: insuranceProvider.trim(),
      insurance_provider: insuranceProvider.trim(),
      insurancePolicyNumber: insurancePolicyNumber.trim(),
      insurance_policy_number: insurancePolicyNumber.trim(),

      authorityActive,
      authority_active: authorityActive,
      insuranceActive,
      insurance_active: insuranceActive,
      licensedLivestock,
      licensed_livestock: licensedLivestock,
      licensedRefrigeratedFood,
      licensed_refrigerated_food: licensedRefrigeratedFood,

      accountActive: true,
      account_active: true,

      stripeId: stripeId || "",
      stripe_customer_id: stripeId || "",
      stripeCustomerId: stripeId || "",
      stripeSubscriptionId: subscriptionId || "",
      stripe_subscription_id: subscriptionId || "",

      membershipStatus: subscriptionId ? "active" : "registration_saved",
      membership_status: subscriptionId ? "active" : "registration_saved",
      subscriptionStatus: subscriptionId ? "active" : "not_started",
      subscription_status: subscriptionId ? "active" : "not_started",

      freightMembershipPaid: Boolean(subscriptionId),
      freight_membership_paid: Boolean(subscriptionId),

      createdAt: now,
      created_at: now,
      updatedAt: now,
      updated_at: now,
    };

    await saveFreightSession(localCarrier);

    setFreightId(carrierId);
    setAccountId(verify.data.account_id || finalAccountId);
    setSavedCarrierId(carrierId);
    setStripeId(verify.data.stripe_customer_id || verify.data.stripe_id || "");
    setSubscriptionId(verify.data.stripe_subscription_id || "");

    return verify.data;
  }

  async function saveRegistration() {
    if (saving) return;
    if (!validateForm()) return;

    try {
      setSaving(true);

      const cleanEmail = normalize(email);
      const cleanUsername = normalize(username);

      const duplicate = await checkDuplicateFreight(cleanEmail, cleanUsername);

      if (duplicate?.id) {
        setFreightId(duplicate.freight_id || duplicate.id);
        setSavedCarrierId(duplicate.id);
        setAccountId(duplicate.account_id || "");
        setStripeId(duplicate.stripe_id || duplicate.stripe_customer_id || "");
        setSubscriptionId(duplicate.stripe_subscription_id || "");

        await saveFreightUserRow(duplicate.id, duplicate.account_id || undefined);

        Alert.alert("Updated", "Existing freight registration was updated in freight_users.");
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: cleanEmail,
        password: password.trim(),
        options: {
          data: {
            role: "freight",
            username: cleanUsername,
            company_name: companyName.trim(),
            contact_name: contactName.trim(),
            full_name: contactName.trim(),
          },
        },
      });

      if (authError) {
        Alert.alert("Signup Error", authError.message);
        return;
      }

      const carrierId = authData?.user?.id;

      if (!carrierId) {
        Alert.alert("Signup Error", "Unable to create freight auth account.");
        return;
      }

      const generatedAccountId = await generateFreightAccountId();

      setFreightId(carrierId);
      setSavedCarrierId(carrierId);
      setAccountId(generatedAccountId);

      await saveFreightUserRow(carrierId, generatedAccountId);

      Alert.alert("Registration Saved", "Your freight registration was saved to freight_users.");
    } catch (error: any) {
      console.log("SAVE FREIGHT REGISTER ERROR:", error);
      Alert.alert("Save Error", error?.message || "Unable to save freight registration.");
    } finally {
      setSaving(false);
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
      <View style={styles.securityBox}>
        <Text style={styles.securityLabel}>{label}</Text>

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

  function SectionHeader({ icon, title }: { icon: keyof typeof Ionicons.glyphMap; title: string }) {
    return (
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}>
          <Ionicons name={icon} size={20} color="#FFFFFF" />
        </View>
        <Text style={styles.section}>{title}</Text>
      </View>
    );
  }

  function WebStripeBuyButton() {
    if (Platform.OS !== "web") {
      return (
        <View style={styles.nativeStripeNotice}>
          <Text style={styles.nativeStripeText}>
            Stripe Buy Button is available on web. For mobile, use the backend Checkout flow or open
            this registration page in the browser.
          </Text>
        </View>
      );
    }

    return React.createElement("stripe-buy-button" as any, {
      "buy-button-id": STRIPE_BUY_BUTTON_ID,
      "publishable-key": STRIPE_PUBLISHABLE_KEY,
    });
  }

  function ReadOnlyIdBox({
    label,
    value,
    fallback,
  }: {
    label: string;
    value: string;
    fallback: string;
  }) {
    return (
      <View style={styles.readOnlyBox}>
        <Text style={styles.readOnlyLabel}>{label}</Text>
        <Text style={[styles.readOnlyValue, !value && styles.readOnlyFallback]}>
          {value || fallback}
        </Text>
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
              <Ionicons name="trail-sign-outline" size={34} color="#FFFFFF" />
            </View>
            <Text style={styles.kicker}>Farm2Home Freight Connect</Text>
            <Text style={styles.title}>Carrier Registration</Text>
            <Text style={styles.subtitle}>
              Save your freight carrier registration to Supabase, then complete your freight
              subscription using Stripe.
            </Text>
          </View>

          <View style={styles.noticeBox}>
            <View style={styles.noticeHeader}>
              <Ionicons name="alert-circle-outline" size={22} color={COLORS.amber} />
              <Text style={styles.noticeTitle}>Automatic Account IDs</Text>
            </View>
            <Text style={styles.noticeText}>
              Account IDs are assigned automatically. The Supabase UUID stays unchanged, and
              Farm2Home creates a separate readable ID like Freight_001.
            </Text>
          </View>

          <View style={styles.priceBox}>
            <View>
              <Text style={styles.price}>$9.99 / month</Text>
              <Text style={styles.priceSub}>Farm2Home Freight Membership</Text>
            </View>
            <View style={styles.priceIcon}>
              <Ionicons name="flash-outline" size={22} color="#FFFFFF" />
            </View>
          </View>

          <View style={styles.card}>
            <SectionHeader icon="key-outline" title="Account IDs" />

            <Text style={styles.helperText}>
              These values are assigned automatically. Do not enter account IDs manually.
            </Text>

            <ReadOnlyIdBox
              label="Supabase UUID / Freight ID"
              value={freightId}
              fallback="Assigned after save"
            />

            <ReadOnlyIdBox
              label="Static Account ID"
              value={accountId}
              fallback="Assigned after save"
            />

            <ReadOnlyIdBox
              label="Stripe Customer ID"
              value={stripeId}
              fallback="Assigned by Stripe checkout/webhook"
            />

            <ReadOnlyIdBox
              label="Stripe Subscription ID"
              value={subscriptionId}
              fallback="Assigned by Stripe checkout/webhook"
            />
          </View>

          <View style={styles.card}>
            <SectionHeader icon="business-outline" title="Company Information" />
            <TextInput style={styles.input} placeholder="Company Name" placeholderTextColor="#94A3B8" value={companyName} onChangeText={setCompanyName} />
            <TextInput style={styles.input} placeholder="Contact Name" placeholderTextColor="#94A3B8" value={contactName} onChangeText={setContactName} />
            <TextInput style={styles.input} placeholder="Email" placeholderTextColor="#94A3B8" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
            <TextInput style={styles.input} placeholder="Phone" placeholderTextColor="#94A3B8" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
            <TextInput style={styles.input} placeholder="Service Area" placeholderTextColor="#94A3B8" value={serviceArea} onChangeText={setServiceArea} />
          </View>

          <View style={styles.card}>
            <SectionHeader icon="lock-closed-outline" title="Create Freight Login" />
            <TextInput style={styles.input} placeholder="Create Username" placeholderTextColor="#94A3B8" value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} />
            <TextInput style={styles.input} placeholder="Create Password" placeholderTextColor="#94A3B8" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" />
            <TextInput style={styles.input} placeholder="Confirm Password" placeholderTextColor="#94A3B8" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry autoCapitalize="none" />
          </View>

          <View style={styles.securityCard}>
            <SectionHeader icon="key-outline" title="Security Questions" />
            {renderQuestionPicker("Security Question 1", securityQuestion1, setSecurityQuestion1, securityAnswer1, setSecurityAnswer1)}
            {renderQuestionPicker("Security Question 2", securityQuestion2, setSecurityQuestion2, securityAnswer2, setSecurityAnswer2)}
            {renderQuestionPicker("Security Question 3", securityQuestion3, setSecurityQuestion3, securityAnswer3, setSecurityAnswer3)}
          </View>

          <View style={styles.card}>
            <SectionHeader icon="location-outline" title="Business Address" />
            <TextInput style={styles.input} placeholder="Business Address" placeholderTextColor="#94A3B8" value={businessAddress} onChangeText={setBusinessAddress} />
            <TextInput style={styles.input} placeholder="City" placeholderTextColor="#94A3B8" value={city} onChangeText={setCity} />
            <TextInput style={styles.input} placeholder="State" placeholderTextColor="#94A3B8" value={stateValue} onChangeText={setStateValue} />
            <TextInput style={styles.input} placeholder="Zip Code" placeholderTextColor="#94A3B8" keyboardType="numeric" value={zipCode} onChangeText={setZipCode} />
          </View>

          <View style={styles.card}>
            <SectionHeader icon="shield-checkmark-outline" title="Authority & Insurance" />
            <TextInput style={styles.input} placeholder="MDOT Number" placeholderTextColor="#94A3B8" value={mdotNumber} onChangeText={setMdotNumber} />
            <TextInput style={styles.input} placeholder="MC Number" placeholderTextColor="#94A3B8" value={mcNumber} onChangeText={setMcNumber} />
            <TextInput style={styles.input} placeholder="Insurance Provider" placeholderTextColor="#94A3B8" value={insuranceProvider} onChangeText={setInsuranceProvider} />
            <TextInput style={styles.input} placeholder="Insurance Policy Number" placeholderTextColor="#94A3B8" value={insurancePolicyNumber} onChangeText={setInsurancePolicyNumber} />

            <View style={styles.switchRow}>
              <Text style={styles.switchText}>Active MC / Operating Authority</Text>
              <Switch value={authorityActive} onValueChange={setAuthorityActive} />
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchText}>Active Insurance</Text>
              <Switch value={insuranceActive} onValueChange={setInsuranceActive} />
            </View>
          </View>

          <View style={styles.card}>
            <SectionHeader icon="cube-outline" title="Transport Authorization" />
            <View style={styles.switchRow}>
              <Text style={styles.switchText}>Licensed to Move Livestock</Text>
              <Switch value={licensedLivestock} onValueChange={setLicensedLivestock} />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchText}>Licensed for Refrigerated Fresh Food</Text>
              <Switch value={licensedRefrigeratedFood} onValueChange={setLicensedRefrigeratedFood} />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.button, saving && styles.disabledButton]}
            onPress={saveRegistration}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="save-outline" size={18} color="#FFFFFF" />
                <Text style={styles.buttonText}>Save Freight Registration</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.stripeCard}>
            <SectionHeader icon="card-outline" title="Start Subscription" />
            <Text style={styles.stripeText}>
              After saving registration, complete payment below. Stripe customer and subscription
              IDs must be saved by your backend Checkout/webhook.
            </Text>

            <View style={styles.buyButtonBox}>
              <WebStripeBuyButton />
            </View>
          </View>

          <TouchableOpacity onPress={() => router.push("/freight/login" as any)}>
            <Text style={styles.link}>Already registered? Login</Text>
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
  title: { fontSize: 36, fontWeight: "900", marginTop: 6, color: "#FFFFFF" },
  subtitle: {
    color: "#CBD5E1",
    fontSize: 15,
    lineHeight: 23,
    fontWeight: "700",
    marginTop: 8,
  },
  noticeBox: {
    backgroundColor: "#FFFBEB",
    borderColor: COLORS.amber,
    borderWidth: 1,
    borderRadius: 18,
    padding: 15,
    marginHorizontal: 18,
    marginTop: 18,
    marginBottom: 14,
  },
  noticeHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  noticeTitle: { color: COLORS.text, fontWeight: "900", fontSize: 17 },
  noticeText: { color: COLORS.text, fontWeight: "700", lineHeight: 22 },
  priceBox: {
    backgroundColor: COLORS.red,
    padding: 18,
    borderRadius: 20,
    marginHorizontal: 18,
    marginBottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  price: { fontSize: 27, fontWeight: "900", color: "#FFFFFF" },
  priceSub: { color: "#FFE4E6", marginTop: 4, fontWeight: "800" },
  priceIcon: {
    width: 48,
    height: 48,
    borderRadius: 18,
    backgroundColor: COLORS.black,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
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
  stripeCard: {
    backgroundColor: COLORS.card,
    marginHorizontal: 18,
    marginTop: 12,
    marginBottom: 16,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  stripeText: {
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 21,
    marginBottom: 14,
  },
  buyButtonBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    minHeight: 90,
    justifyContent: "center",
  },
  nativeStripeNotice: {
    backgroundColor: "#FFF1F2",
    borderColor: COLORS.red,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  nativeStripeText: {
    color: COLORS.red,
    fontWeight: "800",
    lineHeight: 20,
  },
  sectionHeader: { flexDirection: "row", gap: 10, alignItems: "center", marginBottom: 16 },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: COLORS.black,
    alignItems: "center",
    justifyContent: "center",
  },
  section: { fontSize: 20, fontWeight: "900", color: COLORS.text },
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
  helperText: {
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 21,
    marginBottom: 14,
  },
  readOnlyBox: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  readOnlyLabel: {
    color: COLORS.muted,
    fontWeight: "900",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  readOnlyValue: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 15,
  },
  readOnlyFallback: {
    color: "#94A3B8",
  },
  securityBox: { marginBottom: 12 },
  securityLabel: { color: COLORS.text, fontWeight: "900", marginBottom: 8 },
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
  questionChipActive: { backgroundColor: COLORS.red, borderColor: COLORS.red },
  questionChipText: { color: COLORS.red, fontWeight: "900" },
  questionChipTextActive: { color: "#FFFFFF" },
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