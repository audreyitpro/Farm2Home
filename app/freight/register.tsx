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
import { createClient } from "@supabase/supabase-js";
import { Ionicons } from "@expo/vector-icons";

import { API_BASE_URL, APP_URL } from "../config/api";
import freightTheme from "../styles/freightTheme";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase: any = createClient(supabaseUrl, supabaseAnonKey);

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
  const [licensedRefrigeratedFood, setLicensedRefrigeratedFood] =
    useState(false);

  const selectedQuestions = useMemo(
    () =>
      [securityQuestion1, securityQuestion2, securityQuestion3].filter(Boolean),
    [securityQuestion1, securityQuestion2, securityQuestion3]
  );

  function validateSecurityQuestions() {
    if (selectedQuestions.length !== 3) {
      Alert.alert(
        "Security Questions Required",
        "Please choose 3 security questions."
      );
      return false;
    }

    if (new Set(selectedQuestions).size !== 3) {
      Alert.alert(
        "Duplicate Security Questions",
        "Please choose 3 different security questions."
      );
      return false;
    }

    if (
      !securityAnswer1.trim() ||
      !securityAnswer2.trim() ||
      !securityAnswer3.trim()
    ) {
      Alert.alert(
        "Security Answers Required",
        "Please answer all 3 security questions."
      );
      return false;
    }

    return true;
  }

  async function checkDuplicateFreightUser(
    cleanEmail: string,
    cleanUsername: string
  ) {
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
    await AsyncStorage.setItem("currentUser", JSON.stringify(carrier));
    await AsyncStorage.setItem("userRole", "freight");
    await AsyncStorage.setItem("currentUserRole", "freight");
  }

  async function createAdminVerificationRecord(carrier: any) {
    const adminRecord = {
      id: carrier.id,
      carrier_id: carrier.id,
      freight_id: carrier.id,
      account_type: "FREIGHT_CARRIER",

      company_name: carrier.company_name,
      business_name: carrier.company_name,
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

      membership_status: "Pending",
      subscription_status: "pending",
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
      const response = await fetch(
        `${API_BASE_URL}/notify/freight-verification`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(carrier),
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        console.log("Freight admin email failed:", data);
      }
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
                style={[
                  styles.questionChip,
                  active && styles.questionChipActive,
                ]}
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
      Alert.alert(
        "Missing Info",
        "Company, contact, email, and phone are required."
      );
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

    if (!cleanMdotNumber || !cleanMcNumber) {
      Alert.alert("Missing Authority", "MDOT number and MC number are required.");
      return;
    }

    if (!cleanInsuranceProvider || !cleanInsurancePolicyNumber) {
      Alert.alert(
        "Missing Insurance",
        "Insurance provider and policy number are required."
      );
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

      const duplicate = await checkDuplicateFreightUser(
        cleanEmail,
        cleanUsername
      );

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
          },
        },
      });

      if (authError) {
        Alert.alert("Signup Error", authError.message);
        return;
      }

      const carrierId = authData?.user?.id;

      if (!carrierId) {
        Alert.alert(
          "Signup Error",
          "Unable to create freight account. Please try again."
        );
        return;
      }

      const now = new Date().toISOString();

      const freightPayload = {
        id: carrierId,
        role: "freight",

        company_name: cleanCompanyName,
        contact_name: cleanContactName,
        owner_name: cleanContactName,
        email: cleanEmail,
        phone: cleanPhone,
        username: cleanUsername,

        account_active: true,

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
        mc_number: cleanMcNumber,
        insurance_provider: cleanInsuranceProvider,
        insurance_policy_number: cleanInsurancePolicyNumber,

        authority_active: authorityActive,
        insurance_active: insuranceActive,
        licensed_livestock: licensedLivestock,
        licensed_refrigerated_food: licensedRefrigeratedFood,

        approved: false,
        verification_status: "PENDING_VERIFICATION",
        membership_status: "Pending",
        subscription_status: "pending",
        freight_membership_paid: false,

        notifications_enabled: false,
        expo_push_token: "",

        created_at: now,
        updated_at: now,
      };

      const { error: freightError } = await supabase
        .from("freight_users")
        .upsert(freightPayload, { onConflict: "id" });

      if (freightError) {
        Alert.alert("Profile Error", freightError.message);
        return;
      }

      const localCarrier = {
        id: carrierId,
        role: "freight" as const,

        companyName: cleanCompanyName,
        contactName: cleanContactName,
        ownerName: cleanContactName,
        email: cleanEmail,
        phone: cleanPhone,
        username: cleanUsername,

        accountActive: true,

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
        mcNumber: cleanMcNumber,
        insuranceProvider: cleanInsuranceProvider,
        insurancePolicyNumber: cleanInsurancePolicyNumber,

        authorityActive,
        insuranceActive,
        licensedLivestock,
        licensedRefrigeratedFood,

        approved: false,
        verificationStatus: "PENDING_VERIFICATION",
        membershipStatus: "Pending",
        subscriptionStatus: "pending",
        freightMembershipPaid: false,

        createdAt: now,
        updatedAt: now,
      };

      await saveFreightSession(localCarrier);
      await createAdminVerificationRecord(freightPayload);
      await notifyAdminFreightVerification(localCarrier);

      const response = await fetch(
        `${API_BASE_URL}/payments/create-subscription-checkout`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            customerEmail: cleanEmail,
            email: cleanEmail,
            name: cleanContactName,
            username: cleanUsername,
            userId: carrierId,
            freightId: carrierId,
            companyName: cleanCompanyName,
            planType: "freight",
            successUrl: `${APP_URL}/freight/subscription-success?session_id={CHECKOUT_SESSION_ID}`,
            cancelUrl: `${APP_URL}/freight/register`,
          }),
        }
      );

      const text = await response.text();

      console.log("FREIGHT STRIPE STATUS:", response.status);
      console.log("FREIGHT STRIPE RESPONSE:", text);

      let data: {
        success?: boolean;
        url?: string;
        id?: string;
        sessionId?: string;
        error?: string;
        message?: string;
      } = {};

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
            "Your freight account was saved, but Stripe checkout did not open. Check STRIPE_FREIGHT_MEMBERSHIP_PRICE_ID."
        );
        return;
      }

      const checkoutCarrier = {
        ...localCarrier,
        stripeCheckoutSessionId: data.id || data.sessionId || null,
        membershipStatus: "Checkout Started",
        updatedAt: new Date().toISOString(),
      };

      await saveFreightSession(checkoutCarrier);
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
      <StatusBar barStyle="light-content" backgroundColor="#020617" />

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
              AI driver network-style carrier verification for livestock,
              refrigerated food, and Farm2Home delivery loads.
            </Text>
          </View>

          <View style={styles.noticeBox}>
            <View style={styles.noticeHeader}>
              <Ionicons name="alert-circle-outline" size={22} color="#F59E0B" />
              <Text style={styles.noticeTitle}>Carrier Approval Required</Text>
            </View>

            <Text style={styles.noticeText}>
              Your account will stay pending until Farm2Home admin reviews your
              authority, insurance, vehicle, and compliance documents.
            </Text>
          </View>

          <View style={styles.priceBox}>
            <View>
              <Text style={styles.price}>$9.99 / month</Text>
              <Text style={styles.priceSub}>Access the Farm2Home Freight Board</Text>
            </View>

            <View style={styles.priceIcon}>
              <Ionicons name="flash-outline" size={22} color="#BBF7D0" />
            </View>
          </View>

          <View style={styles.card}>
            <SectionHeader
              icon="business-outline"
              title="Company Information"
              subtitle="Business and primary contact information."
            />

            <TextInput
              style={styles.input}
              placeholder="Company Name"
              placeholderTextColor="#94A3B8"
              value={companyName}
              onChangeText={setCompanyName}
            />

            <TextInput
              style={styles.input}
              placeholder="Contact Name"
              placeholderTextColor="#94A3B8"
              value={contactName}
              onChangeText={setContactName}
            />

            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />

            <TextInput
              style={styles.input}
              placeholder="Phone"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />

            <TextInput
              style={styles.input}
              placeholder="Service Area (States / Cities)"
              placeholderTextColor="#94A3B8"
              value={serviceArea}
              onChangeText={setServiceArea}
            />
          </View>

          <View style={styles.card}>
            <SectionHeader
              icon="lock-closed-outline"
              title="Create Freight Login"
              subtitle="Create credentials for the Freight Connect portal."
            />

            <TextInput
              style={styles.input}
              placeholder="Create Username"
              placeholderTextColor="#94A3B8"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TextInput
              style={styles.input}
              placeholder="Create Password"
              placeholderTextColor="#94A3B8"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />

            <TextInput
              style={styles.input}
              placeholder="Confirm Password"
              placeholderTextColor="#94A3B8"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          <View style={styles.securityCard}>
            <SectionHeader
              icon="key-outline"
              title="Security Questions"
              subtitle="Choose 3 different questions for account verification."
            />

            {renderQuestionPicker(
              "Security Question 1",
              securityQuestion1,
              setSecurityQuestion1,
              securityAnswer1,
              setSecurityAnswer1
            )}

            {renderQuestionPicker(
              "Security Question 2",
              securityQuestion2,
              setSecurityQuestion2,
              securityAnswer2,
              setSecurityAnswer2
            )}

            {renderQuestionPicker(
              "Security Question 3",
              securityQuestion3,
              setSecurityQuestion3,
              securityAnswer3,
              setSecurityAnswer3
            )}
          </View>

          <View style={styles.card}>
            <SectionHeader
              icon="location-outline"
              title="Business Address"
              subtitle="Carrier business location for verification."
            />

            <TextInput
              style={styles.input}
              placeholder="Business Address"
              placeholderTextColor="#94A3B8"
              value={businessAddress}
              onChangeText={setBusinessAddress}
            />

            <TextInput
              style={styles.input}
              placeholder="City"
              placeholderTextColor="#94A3B8"
              value={city}
              onChangeText={setCity}
            />

            <TextInput
              style={styles.input}
              placeholder="State"
              placeholderTextColor="#94A3B8"
              value={stateValue}
              onChangeText={setStateValue}
            />

            <TextInput
              style={styles.input}
              placeholder="Zip Code"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
              value={zipCode}
              onChangeText={setZipCode}
            />
          </View>

          <View style={styles.card}>
            <SectionHeader
              icon="shield-checkmark-outline"
              title="Authority & Insurance"
              subtitle="Operating authority and policy verification."
            />

            <TextInput
              style={styles.input}
              placeholder="MDOT Number"
              placeholderTextColor="#94A3B8"
              value={mdotNumber}
              onChangeText={setMdotNumber}
            />

            <TextInput
              style={styles.input}
              placeholder="MC Number"
              placeholderTextColor="#94A3B8"
              value={mcNumber}
              onChangeText={setMcNumber}
            />

            <TextInput
              style={styles.input}
              placeholder="Insurance Provider"
              placeholderTextColor="#94A3B8"
              value={insuranceProvider}
              onChangeText={setInsuranceProvider}
            />

            <TextInput
              style={styles.input}
              placeholder="Insurance Policy Number"
              placeholderTextColor="#94A3B8"
              value={insurancePolicyNumber}
              onChangeText={setInsurancePolicyNumber}
            />

            <View style={styles.switchRow}>
              <Text style={styles.switchText}>Active MC / Operating Authority</Text>
              <Switch
                value={authorityActive}
                onValueChange={setAuthorityActive}
                trackColor={{ false: "#334155", true: "#064E3B" }}
                thumbColor={authorityActive ? "#10B981" : "#CBD5E1"}
              />
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchText}>Active Insurance</Text>
              <Switch
                value={insuranceActive}
                onValueChange={setInsuranceActive}
                trackColor={{ false: "#334155", true: "#064E3B" }}
                thumbColor={insuranceActive ? "#10B981" : "#CBD5E1"}
              />
            </View>
          </View>

          <View style={styles.card}>
            <SectionHeader
              icon="cube-outline"
              title="Transport Authorization"
              subtitle="Select the freight services your carrier can provide."
            />

            <View style={styles.switchRow}>
              <Text style={styles.switchText}>Licensed to Move Livestock</Text>
              <Switch
                value={licensedLivestock}
                onValueChange={setLicensedLivestock}
                trackColor={{ false: "#334155", true: "#064E3B" }}
                thumbColor={licensedLivestock ? "#10B981" : "#CBD5E1"}
              />
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchText}>Licensed for Refrigerated Fresh Food</Text>
              <Switch
                value={licensedRefrigeratedFood}
                onValueChange={setLicensedRefrigeratedFood}
                trackColor={{ false: "#334155", true: "#064E3B" }}
                thumbColor={licensedRefrigeratedFood ? "#10B981" : "#CBD5E1"}
              />
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
                <Text style={styles.buttonText}>
                  Register + Subscribe + Start Verification
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/freight/login" as any)}
            activeOpacity={0.85}
          >
            <Text style={styles.link}>Already registered? Login</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: freightTheme.colors.background,
  },
  keyboard: {
    flex: 1,
    backgroundColor: freightTheme.colors.background,
  },
  page: {
    flex: 1,
    backgroundColor: freightTheme.colors.background,
  },
  content: {
    paddingBottom: 90,
  },
  heroCard: {
    backgroundColor: "#020617",
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 28,
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#064E3B",
    borderWidth: 1,
    borderColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  kicker: {
    color: "#10B981",
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
    backgroundColor: "#451A03",
    borderColor: "#F59E0B",
    borderWidth: 1,
    borderRadius: 18,
    padding: 15,
    marginHorizontal: 18,
    marginTop: 18,
    marginBottom: 14,
  },
  noticeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  noticeTitle: {
    color: "#FCD34D",
    fontWeight: "900",
    fontSize: 17,
  },
  noticeText: {
    color: "#FEF3C7",
    fontWeight: "700",
    lineHeight: 22,
  },
  priceBox: {
    backgroundColor: "#064E3B",
    padding: 18,
    borderRadius: 20,
    marginHorizontal: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#10B981",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  price: {
    fontSize: 27,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  priceSub: {
    color: "#BBF7D0",
    marginTop: 4,
    fontWeight: "800",
  },
  priceIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#052E2B",
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    backgroundColor: freightTheme.colors.card,
    marginHorizontal: 18,
    marginBottom: 16,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
  },
  securityCard: {
    backgroundColor: freightTheme.colors.card,
    marginHorizontal: 18,
    marginBottom: 16,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
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
    borderRadius: 20,
    backgroundColor: freightTheme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  section: {
    fontSize: 20,
    fontWeight: "900",
    color: freightTheme.colors.text,
  },
  sectionSubtitle: {
    color: freightTheme.colors.mutedText,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 3,
  },
  input: {
    backgroundColor: "#FFFFFF",
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    fontSize: 16,
    color: "#111827",
    fontWeight: "700",
  },
  securityBox: {
    marginBottom: 12,
  },
  securityLabel: {
    color: freightTheme.colors.text,
    fontWeight: "900",
    marginBottom: 8,
  },
  questionChip: {
    backgroundColor: freightTheme.colors.surface,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    marginRight: 8,
    marginBottom: 10,
    maxWidth: 280,
  },
  questionChipActive: {
    backgroundColor: freightTheme.colors.primary,
    borderColor: freightTheme.colors.primary,
  },
  questionChipText: {
    color: freightTheme.colors.primary,
    fontWeight: "900",
  },
  questionChipTextActive: {
    color: "#FFFFFF",
  },
  switchRow: {
    backgroundColor: freightTheme.colors.surface,
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  switchText: {
    flex: 1,
    fontWeight: "800",
    paddingRight: 12,
    color: freightTheme.colors.text,
  },
  button: {
    backgroundColor: freightTheme.colors.primary,
    padding: 16,
    borderRadius: 16,
    marginHorizontal: 18,
    marginTop: 4,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    zIndex: 9999,
    elevation: 20,
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#FFFFFF",
    textAlign: "center",
    fontWeight: "900",
    fontSize: 16,
  },
  link: {
    color: freightTheme.colors.primary,
    textAlign: "center",
    fontWeight: "900",
    marginTop: 18,
  },
});