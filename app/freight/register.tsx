// app/freight/register.tsx

import React, { useMemo, useState } from "react";
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
import * as WebBrowser from "expo-web-browser";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { API_BASE_URL, APP_URL } from "../config/api";
import { supabase } from "../data/supabaseClient";

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
  const [subscribing, setSubscribing] = useState(false);
  const [savedCarrierId, setSavedCarrierId] = useState("");

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

  async function checkDuplicateFreight(cleanEmail: string, cleanUsername: string) {
    const { data, error } = await supabase
      .from("freight_users")
      .select("id,email,username")
      .or(`email.eq.${cleanEmail},username.eq.${cleanUsername}`)
      .limit(1);

    if (error) {
      console.log("Freight duplicate check skipped:", error.message);
      return null;
    }

    return Array.isArray(data) && data.length > 0 ? data[0] : null;
  }

  async function buildAndSaveFreightPayload(carrierId: string) {
    const now = new Date().toISOString();

    const cleanCompanyName = companyName.trim();
    const cleanContactName = contactName.trim();
    const cleanEmail = normalize(email);
    const cleanPhone = phone.trim();
    const cleanUsername = normalize(username);

    const freightPayload = {
      id: carrierId,
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

      stripe_id: null,
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

      membership_status: "registration_saved",
      subscription_status: "not_started",
      freight_membership_paid: false,

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
        role: "freight",
        full_name: cleanContactName,
        name: cleanContactName,
        email: cleanEmail,
        phone: cleanPhone,
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

    const { data, error } = await supabase
      .from("freight_users")
      .upsert(freightPayload, { onConflict: "id" })
      .select("*")
      .single();

    if (error) {
      console.log("FREIGHT USERS UPSERT ERROR:", error.message);
      Alert.alert("Freight Save Error", error.message);
      throw error;
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

    console.log("FREIGHT SAVE VERIFIED:", verify.data);

    if (!verify.data?.id) {
      throw new Error("Freight registration did not save to freight_users.");
    }

    await supabase.from("admin_verifications").upsert(
      {
        id: carrierId,
        carrier_id: carrierId,
        freight_id: carrierId,
        profile_id: carrierId,
        account_type: "FREIGHT_CARRIER",
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
        membership_status: "registration_saved",
        subscription_status: "not_started",
        freight_membership_paid: false,
        created_at: now,
        updated_at: now,
      },
      { onConflict: "id" }
    );

    const localCarrier = {
      id: carrierId,
      freightId: carrierId,
      profileId: carrierId,
      authUserId: carrierId,
      role: "freight",
      companyName: cleanCompanyName,
      businessName: cleanCompanyName,
      contactName: cleanContactName,
      email: cleanEmail,
      phone: cleanPhone,
      username: cleanUsername,
      accountActive: true,
      membershipStatus: "registration_saved",
      subscriptionStatus: "not_started",
      freightMembershipPaid: false,
      createdAt: now,
      updatedAt: now,
    };

    await saveFreightSession(localCarrier);
    setSavedCarrierId(carrierId);

    return data;
  }

  async function saveRegistration() {
    if (saving || subscribing) return;
    if (!validateForm()) return;

    try {
      setSaving(true);

      const cleanEmail = normalize(email);
      const cleanUsername = normalize(username);

      const duplicate = await checkDuplicateFreight(cleanEmail, cleanUsername);

      if (duplicate?.id) {
        setSavedCarrierId(duplicate.id);
        await buildAndSaveFreightPayload(duplicate.id);
        Alert.alert("Updated", "Existing freight registration was updated in Supabase.");
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

      await buildAndSaveFreightPayload(carrierId);

      Alert.alert(
        "Registration Saved",
        "Your freight registration was verified and saved to freight_users."
      );
    } catch (error: any) {
      console.log("SAVE FREIGHT REGISTER ERROR:", error);
      Alert.alert("Save Error", error?.message || "Unable to save freight registration.");
    } finally {
      setSaving(false);
    }
  }

  async function createStripeCheckout(payload: any) {
    const endpoints = [
      `${API_BASE_URL}/payments/create-freight-subscription-checkout`,
      `${API_BASE_URL}/payments/create-subscription-checkout`,
      `${API_BASE_URL}/api/payments/create-subscription-checkout`,
    ];

    let lastError = "";

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const text = await response.text();

        let data: any = {};
        try {
          data = text ? JSON.parse(text) : {};
        } catch {
          data = {};
        }

        const checkoutUrl =
          data.url ||
          data.checkoutUrl ||
          data.checkout_url ||
          data.sessionUrl ||
          data.session_url;

        if (response.ok && checkoutUrl) {
          return { ...data, url: checkoutUrl };
        }

        lastError = data.error || data.message || `Checkout failed at ${endpoint}`;
      } catch (error: any) {
        lastError = error?.message || `Checkout failed at ${endpoint}`;
      }
    }

    throw new Error(lastError || "Unable to start Stripe checkout.");
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

    await WebBrowser.openBrowserAsync(url);
  }

  async function startSubscription() {
    if (saving || subscribing) return;

    try {
      setSubscribing(true);

      let carrierId = savedCarrierId;

      if (!carrierId) {
        const raw =
          (await AsyncStorage.getItem("currentFreightCarrier")) ||
          (await AsyncStorage.getItem("currentFreight")) ||
          (await AsyncStorage.getItem("currentFreightUser"));

        if (raw) {
          const parsed = JSON.parse(raw);
          carrierId = parsed.id || parsed.freightId || "";
        }
      }

      if (!carrierId) {
        Alert.alert("Save Required", "Please save the freight registration first.");
        return;
      }

      const cleanEmail = normalize(email);
      const cleanContactName = contactName.trim();
      const cleanCompanyName = companyName.trim();

      const checkoutData = await createStripeCheckout({
        customerEmail: cleanEmail,
        email: cleanEmail,
        name: cleanContactName,
        username: normalize(username),
        userId: carrierId,
        freightId: carrierId,
        profileId: carrierId,
        companyName: cleanCompanyName,
        businessName: cleanCompanyName,
        role: "freight",
        planType: "freight",
        successUrl: `${APP_URL}/freight/subscription-success?freightId=${carrierId}`,
        cancelUrl: `${APP_URL}/freight/register`,
      });

      const stripeCustomerId =
        checkoutData.stripeCustomerId ??
        checkoutData.customer_id ??
        checkoutData.customer ??
        checkoutData.customerId ??
        null;

      const stripeSessionId =
        checkoutData.sessionId ??
        checkoutData.session_id ??
        checkoutData.id ??
        null;

      const stripeCheckoutUrl =
        checkoutData.url ??
        checkoutData.checkoutUrl ??
        checkoutData.checkout_url ??
        checkoutData.sessionUrl ??
        checkoutData.session_url ??
        null;

      await supabase
        .from("freight_users")
        .update({
          stripe_id: stripeCustomerId,
          stripe_customer_id: stripeCustomerId,
          stripe_checkout_session_id: stripeSessionId,
          membership_status: "pending_payment",
          subscription_status: "pending_payment",
          freight_membership_paid: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", carrierId);

      await saveFreightSession({
        id: carrierId,
        freightId: carrierId,
        role: "freight",
        companyName: cleanCompanyName,
        businessName: cleanCompanyName,
        contactName: cleanContactName,
        email: cleanEmail,
        username: normalize(username),
        stripeId: stripeCustomerId,
        stripeCustomerId,
        stripeCheckoutSessionId: stripeSessionId,
        membershipStatus: "pending_payment",
        subscriptionStatus: "pending_payment",
        freightMembershipPaid: false,
      });

      if (!stripeCheckoutUrl) {
        Alert.alert("Stripe Error", "The backend did not return a Checkout URL.");
        return;
      }

      await openCheckoutUrl(stripeCheckoutUrl);
    } catch (error: any) {
      console.log("START FREIGHT SUBSCRIPTION ERROR:", error);
      Alert.alert("Subscription Error", error?.message || "Unable to start subscription.");
    } finally {
      setSubscribing(false);
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
              Save freight carrier details to Supabase first, then start the Stripe subscription.
            </Text>
          </View>

          <View style={styles.noticeBox}>
            <View style={styles.noticeHeader}>
              <Ionicons name="alert-circle-outline" size={22} color={COLORS.amber} />
              <Text style={styles.noticeTitle}>Two-Step Registration</Text>
            </View>
            <Text style={styles.noticeText}>
              Save Registration verifies the row exists in freight_users before Stripe opens.
            </Text>
          </View>

          <View style={styles.priceBox}>
            <View>
              <Text style={styles.price}>$9.99 / month</Text>
              <Text style={styles.priceSub}>Access the Farm2Home Freight Board</Text>
            </View>
            <View style={styles.priceIcon}>
              <Ionicons name="flash-outline" size={22} color="#FFFFFF" />
            </View>
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
            disabled={saving || subscribing}
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

          <TouchableOpacity
            style={[styles.secondaryButton, subscribing && styles.disabledButton]}
            onPress={startSubscription}
            disabled={saving || subscribing}
          >
            {subscribing ? (
              <ActivityIndicator color={COLORS.red} />
            ) : (
              <>
                <Ionicons name="card-outline" size={18} color={COLORS.red} />
                <Text style={styles.secondaryButtonText}>Start Subscription</Text>
              </>
            )}
          </TouchableOpacity>

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
  secondaryButton: {
    backgroundColor: "#FFF1F2",
    borderWidth: 1,
    borderColor: COLORS.red,
    padding: 16,
    borderRadius: 16,
    marginHorizontal: 18,
    marginTop: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  secondaryButtonText: {
    color: COLORS.red,
    textAlign: "center",
    fontWeight: "900",
    fontSize: 16,
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