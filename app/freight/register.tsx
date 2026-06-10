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
  redDark: "#9F1117",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  green: "#16A34A",
  amber: "#D97706",
  slate: "#64748B",
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

export default function FreightRegister() {
  const [loading, setLoading] = useState(false);

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

  function validateSecurityQuestions() {
    if (selectedQuestions.length !== 3) {
      Alert.alert("Security Questions Required", "Please choose 3 security questions.");
      return false;
    }

    if (new Set(selectedQuestions).size !== 3) {
      Alert.alert("Duplicate Security Questions", "Please choose 3 different security questions.");
      return false;
    }

    if (!securityAnswer1.trim() || !securityAnswer2.trim() || !securityAnswer3.trim()) {
      Alert.alert("Security Answers Required", "Please answer all 3 security questions.");
      return false;
    }

    return true;
  }

  async function checkDuplicateFreight(cleanEmail: string, cleanUsername: string) {
    const { data, error } = await supabase
      .from("freight_users")
      .select("id,email,username")
      .or(`email.eq.${cleanEmail},username.eq.${cleanUsername}`)
      .maybeSingle();

    if (error) {
      console.log("Freight duplicate check error:", error.message);
      return false;
    }

    if (data) {
      Alert.alert(
        "Account Exists",
        "A freight account already exists with this email or username."
      );
      return true;
    }

    return false;
  }

  async function saveFreightSession(carrier: any) {
    await AsyncStorage.setItem("pendingFreightCarrier", JSON.stringify(carrier));
    await AsyncStorage.setItem("currentFreightCarrier", JSON.stringify(carrier));
    await AsyncStorage.setItem("currentFreight", JSON.stringify(carrier));
    await AsyncStorage.setItem("currentFreightUser", JSON.stringify(carrier));
    await AsyncStorage.setItem("farm2homeCurrentFreight", JSON.stringify(carrier));
    await AsyncStorage.setItem("currentUser", JSON.stringify(carrier));
    await AsyncStorage.setItem("userRole", "freight");
    await AsyncStorage.setItem("currentUserRole", "freight");
  }

  async function upsertProfile(payload: any) {
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", payload.id)
      .maybeSingle();

    if (existingProfile?.id) {
      const { data, error } = await supabase
        .from("profiles")
        .update({
          auth_user_id: payload.id,
          role: "freight",
          full_name: payload.contact_name,
          name: payload.contact_name,
          email: payload.email,
          phone: payload.phone,
          company_name: payload.company_name,
          account_active: true,
          updated_at: payload.updated_at,
        })
        .eq("id", payload.id)
        .select("*")
        .single();

      if (error) throw error;
      return data;
    }

    const { data, error } = await supabase
      .from("profiles")
      .insert({
        id: payload.id,
        auth_user_id: payload.id,
        role: "freight",
        full_name: payload.contact_name,
        name: payload.contact_name,
        email: payload.email,
        phone: payload.phone,
        company_name: payload.company_name,
        account_active: true,
        created_at: payload.created_at,
        updated_at: payload.updated_at,
      })
      .select("*")
      .single();

    if (error) throw error;
    return data;
  }

  async function createAdminVerificationRecord(carrier: any) {
    const adminRecord = {
      id: carrier.id,
      carrier_id: carrier.id,
      freight_id: carrier.id,
      profile_id: carrier.profile_id,
      account_type: "FREIGHT_CARRIER",

      company_name: carrier.company_name,
      business_name: carrier.business_name,
      contact_name: carrier.contact_name,
      owner_name: carrier.owner_name,
      email: carrier.email,
      phone: carrier.phone,
      username: carrier.username,

      business_address: carrier.business_address,
      city: carrier.city,
      state: carrier.state,
      zip_code: carrier.zip_code,

      mdot_number: carrier.mdot_number,
      mc_number: carrier.mc_number,
      dot_number: carrier.dot_number,

      insurance_provider: carrier.insurance_provider,
      insurance_policy_number: carrier.insurance_policy_number,
      authority_active: carrier.authority_active,
      insurance_active: carrier.insurance_active,
      licensed_livestock: carrier.licensed_livestock,
      licensed_refrigerated_food: carrier.licensed_refrigerated_food,

      documents: [],
      status: "PENDING_VERIFICATION",
      compliance_status: "PENDING_VERIFICATION",
      admin_review_status: "pending",
      review_decision: "pending",

      approved: false,
      rejected: false,
      reviewed: false,
      needs_more_info: false,
      account_active: true,
      store_unlocked: false,

      membership_status: "not_started",
      subscription_status: "not_started",
      freight_membership_paid: false,

      created_at: carrier.created_at,
      updated_at: carrier.updated_at,
    };

    const { error } = await supabase
      .from("admin_verifications")
      .upsert(adminRecord, { onConflict: "id" });

    if (error) {
      console.log("Freight admin verification insert error:", error.message);
    }
  }

  async function notifyAdminFreightVerification(carrier: any) {
    try {
      await fetch(`${API_BASE_URL}/notify/freight-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(carrier),
      });
    } catch (error) {
      console.log("Freight admin email error:", error);
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

    await WebBrowser.openBrowserAsync(url);
  }

  async function submit() {
    if (loading) return;

    const cleanCompanyName = companyName.trim();
    const cleanContactName = contactName.trim();
    const cleanEmail = normalize(email);
    const cleanPhone = phone.trim();
    const cleanServiceArea = serviceArea.trim();
    const cleanUsername = normalize(username);
    const cleanPassword = password.trim();
    const cleanConfirmPassword = confirmPassword.trim();

    const cleanBusinessAddress = businessAddress.trim();
    const cleanCity = city.trim();
    const cleanState = stateValue.trim().toUpperCase();
    const cleanZipCode = zipCode.trim();
    const cleanMdotNumber = mdotNumber.trim();
    const cleanMcNumber = mcNumber.trim();
    const cleanInsuranceProvider = insuranceProvider.trim();
    const cleanInsurancePolicyNumber = insurancePolicyNumber.trim();

    if (!cleanCompanyName || !cleanContactName || !cleanEmail || !cleanPhone) {
      Alert.alert("Missing Info", "Company, contact, email, and phone are required.");
      return;
    }

    if (!cleanEmail.includes("@")) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
      return;
    }

    if (!cleanUsername || !cleanPassword || !cleanConfirmPassword) {
      Alert.alert("Login Required", "Please create a username and password.");
      return;
    }

    if (cleanUsername.length < 4) {
      Alert.alert("Invalid Username", "Username must be at least 4 characters.");
      return;
    }

    if (cleanPassword.length < 6) {
      Alert.alert("Weak Password", "Password must be at least 6 characters.");
      return;
    }

    if (cleanPassword !== cleanConfirmPassword) {
      Alert.alert("Password Mismatch", "Passwords do not match.");
      return;
    }

    if (!validateSecurityQuestions()) return;

    if (!cleanBusinessAddress || !cleanCity || !cleanState || !cleanZipCode) {
      Alert.alert("Missing Address", "Business address, city, state, and zip code are required.");
      return;
    }

    if (!cleanMdotNumber || !cleanMcNumber) {
      Alert.alert("Missing Authority", "MDOT number and MC number are required.");
      return;
    }

    if (!cleanInsuranceProvider || !cleanInsurancePolicyNumber) {
      Alert.alert("Missing Insurance", "Insurance provider and policy number are required.");
      return;
    }

    if (!authorityActive || !insuranceActive) {
      Alert.alert(
        "Verification Required",
        "Please confirm active operating authority and active insurance."
      );
      return;
    }

    if (!licensedLivestock && !licensedRefrigeratedFood) {
      Alert.alert(
        "License Required",
        "Select livestock transport, refrigerated fresh food transport, or both."
      );
      return;
    }

    try {
      setLoading(true);

      const duplicate = await checkDuplicateFreight(cleanEmail, cleanUsername);
      if (duplicate) return;

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: cleanEmail,
        password: cleanPassword,
        options: {
          data: {
            role: "freight",
            username: cleanUsername,
            company_name: cleanCompanyName,
            contact_name: cleanContactName,
            full_name: cleanContactName,
          },
        },
      });

      if (authError) {
        Alert.alert("Signup Error", authError.message);
        return;
      }

      const carrierId = authData?.user?.id;

      if (!carrierId) {
        Alert.alert("Signup Error", "Unable to create freight account. Please try again.");
        return;
      }

      const now = new Date().toISOString();

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

        stripe_account_id: null,
        stripe_customer_id: null,
        stripe_subscription_id: null,
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

        service_area: cleanServiceArea,
        business_address: cleanBusinessAddress,
        city: cleanCity,
        state: cleanState,
        zip_code: cleanZipCode,

        mdot_number: cleanMdotNumber,
        dot_number: cleanMdotNumber,
        mc_number: cleanMcNumber,
        insurance_provider: cleanInsuranceProvider,
        insurance_policy_number: cleanInsurancePolicyNumber,

        authority_active: authorityActive,
        insurance_active: insuranceActive,
        licensed_livestock: licensedLivestock,
        licensed_refrigerated_food: licensedRefrigeratedFood,

        approved: false,
        verification_status: "PENDING_VERIFICATION",
        compliance_status: "PENDING_VERIFICATION",
        membership_status: "not_started",
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

      await upsertProfile(freightPayload);

      const { data: freightUser, error: freightUserError } = await supabase
        .from("freight_users")
        .upsert(freightPayload, { onConflict: "id" })
        .select("*")
        .single();

      if (freightUserError) {
        Alert.alert("Freight User Error", freightUserError.message);
        return;
      }

      const localCarrier = {
        id: carrierId,
        freightId: carrierId,
        profileId: carrierId,
        authUserId: carrierId,
        role: "freight" as const,

        companyName: cleanCompanyName,
        businessName: cleanCompanyName,
        contactName: cleanContactName,
        fullName: cleanContactName,
        ownerName: cleanContactName,
        email: cleanEmail,
        phone: cleanPhone,
        username: cleanUsername,

        accountActive: true,

        stripeAccountId: "",
        stripeCustomerId: "",
        stripeSubscriptionId: "",
        stripeConnectStatus: "not_started",
        payoutsEnabled: false,
        chargesEnabled: false,
        onboardingComplete: false,

        securityQuestion1,
        securityAnswer1: normalizeAnswer(securityAnswer1),
        securityQuestion2,
        securityAnswer2: normalizeAnswer(securityAnswer2),
        securityQuestion3,
        securityAnswer3: normalizeAnswer(securityAnswer3),

        serviceArea: cleanServiceArea,
        businessAddress: cleanBusinessAddress,
        city: cleanCity,
        state: cleanState,
        zipCode: cleanZipCode,

        mdotNumber: cleanMdotNumber,
        dotNumber: cleanMdotNumber,
        mcNumber: cleanMcNumber,
        insuranceProvider: cleanInsuranceProvider,
        insurancePolicyNumber: cleanInsurancePolicyNumber,

        authorityActive,
        insuranceActive,
        licensedLivestock,
        licensedRefrigeratedFood,

        approved: false,
        verificationStatus: "PENDING_VERIFICATION",
        complianceStatus: "PENDING_VERIFICATION",
        membershipStatus: "not_started",
        subscriptionStatus: "not_started",
        freightMembershipPaid: false,

        createdAt: now,
        updatedAt: now,
      };

      await saveFreightSession(localCarrier);
      await createAdminVerificationRecord(freightUser);
      await notifyAdminFreightVerification(localCarrier);

      const response = await fetch(`${API_BASE_URL}/payments/create-subscription-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerEmail: cleanEmail,
          email: cleanEmail,
          name: cleanContactName,
          username: cleanUsername,
          userId: carrierId,
          freightId: carrierId,
          companyName: cleanCompanyName,
          businessName: cleanCompanyName,
          planType: "freight",
        }),
      });

      const text = await response.text();

      let data: any = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = {};
      }

      if (!response.ok || !data.url) {
        Alert.alert(
          "Account Saved",
          data.error ||
            data.message ||
            "Your freight account was saved, but Stripe checkout did not open."
        );
        router.replace("/freight/login" as any);
        return;
      }

      const checkoutCarrier = {
        ...localCarrier,
        stripeCustomerId: data.stripeCustomerId || data.customerId || "",
        stripeCheckoutSessionId: data.id || data.sessionId || null,
        membershipStatus: "pending_payment",
        subscriptionStatus: "pending_payment",
        updatedAt: new Date().toISOString(),
      };

      await saveFreightSession(checkoutCarrier);

      await supabase
        .from("freight_users")
        .update({
          stripe_customer_id: data.stripeCustomerId || data.customerId || null,
          membership_status: "pending_payment",
          subscription_status: "pending_payment",
          updated_at: new Date().toISOString(),
        })
        .eq("id", carrierId);

      await openCheckoutUrl(data.url);
    } catch (error: any) {
      console.log("FREIGHT REGISTER ERROR:", error);
      Alert.alert(
        "Registration Error",
        error?.message || "Unable to complete freight registration."
      );
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
                <Text
                  style={[
                    styles.questionChipText,
                    active && styles.questionChipTextActive,
                  ]}
                >
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
    icon,
    title,
    subtitle,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
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
              <Ionicons name="trail-sign-outline" size={34} color="#FFFFFF" />
            </View>

            <Text style={styles.kicker}>Farm2Home Freight Connect</Text>
            <Text style={styles.title}>Carrier Registration</Text>

            <Text style={styles.subtitle}>
              Professional freight verification for livestock, refrigerated food,
              Farm2Home delivery loads, and Farm2Driver logistics operations.
            </Text>
          </View>

          <View style={styles.noticeBox}>
            <View style={styles.noticeHeader}>
              <Ionicons name="alert-circle-outline" size={22} color={COLORS.amber} />
              <Text style={styles.noticeTitle}>Carrier Verification Required</Text>
            </View>

            <Text style={styles.noticeText}>
              Your account will be saved to Supabase immediately. Stripe customer,
              subscription, and payout IDs will be permanently saved as each Stripe step is completed.
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
            <SectionHeader
              icon="business-outline"
              title="Company Information"
              subtitle="Business and primary contact information."
            />

            <TextInput style={styles.input} placeholder="Company Name" placeholderTextColor="#94A3B8" value={companyName} onChangeText={setCompanyName} />
            <TextInput style={styles.input} placeholder="Contact Name" placeholderTextColor="#94A3B8" value={contactName} onChangeText={setContactName} />
            <TextInput style={styles.input} placeholder="Email" placeholderTextColor="#94A3B8" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
            <TextInput style={styles.input} placeholder="Phone" placeholderTextColor="#94A3B8" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
            <TextInput style={styles.input} placeholder="Service Area (States / Cities)" placeholderTextColor="#94A3B8" value={serviceArea} onChangeText={setServiceArea} />
          </View>

          <View style={styles.card}>
            <SectionHeader
              icon="lock-closed-outline"
              title="Create Freight Login"
              subtitle="Create credentials for the Freight Connect portal."
            />

            <TextInput style={styles.input} placeholder="Create Username" placeholderTextColor="#94A3B8" value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} />
            <TextInput style={styles.input} placeholder="Create Password" placeholderTextColor="#94A3B8" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" />
            <TextInput style={styles.input} placeholder="Confirm Password" placeholderTextColor="#94A3B8" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry autoCapitalize="none" />
          </View>

          <View style={styles.securityCard}>
            <SectionHeader
              icon="key-outline"
              title="Security Questions"
              subtitle="Choose 3 different questions for account verification."
            />

            {renderQuestionPicker("Security Question 1", securityQuestion1, setSecurityQuestion1, securityAnswer1, setSecurityAnswer1)}
            {renderQuestionPicker("Security Question 2", securityQuestion2, setSecurityQuestion2, securityAnswer2, setSecurityAnswer2)}
            {renderQuestionPicker("Security Question 3", securityQuestion3, setSecurityQuestion3, securityAnswer3, setSecurityAnswer3)}
          </View>

          <View style={styles.card}>
            <SectionHeader icon="location-outline" title="Business Address" subtitle="Carrier business location for verification." />

            <TextInput style={styles.input} placeholder="Business Address" placeholderTextColor="#94A3B8" value={businessAddress} onChangeText={setBusinessAddress} />
            <TextInput style={styles.input} placeholder="City" placeholderTextColor="#94A3B8" value={city} onChangeText={setCity} />
            <TextInput style={styles.input} placeholder="State" placeholderTextColor="#94A3B8" value={stateValue} onChangeText={setStateValue} />
            <TextInput style={styles.input} placeholder="Zip Code" placeholderTextColor="#94A3B8" keyboardType="numeric" value={zipCode} onChangeText={setZipCode} />
          </View>

          <View style={styles.card}>
            <SectionHeader icon="shield-checkmark-outline" title="Authority & Insurance" subtitle="Operating authority and policy verification." />

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
            <SectionHeader icon="cube-outline" title="Transport Authorization" subtitle="Select the freight services your carrier can provide." />

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
            style={[styles.button, loading && styles.disabledButton]}
            onPress={submit}
            disabled={loading}
            activeOpacity={0.7}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="card-outline" size={18} color="#FFFFFF" />
                <Text style={styles.buttonText}>Register + Subscribe + Start Verification</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push("/freight/login" as any)} activeOpacity={0.85}>
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
  sectionHeader: { flexDirection: "row", gap: 10, alignItems: "flex-start", marginBottom: 16 },
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
  questionChipActive: {
    backgroundColor: COLORS.red,
    borderColor: COLORS.red,
  },
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