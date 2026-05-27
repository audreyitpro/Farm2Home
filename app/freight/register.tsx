import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
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

import { API_BASE_URL, APP_URL } from "../config/api";
import { supabase } from "../data/supabaseClient";
import {
  createVerificationRecordFromFreightCarrier,
  upsertVerificationRecord,
} from "../data/adminStore";

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

type FreightCarrierRegistration = {
  id: string;
  role: "freight";
  companyName: string;
  contactName: string;
  ownerName: string;
  email: string;
  phone: string;
  username: string;
  password: string;
  accountActive: boolean;
  securityQuestion1: string;
  securityAnswer1: string;
  securityQuestion2: string;
  securityAnswer2: string;
  securityQuestion3: string;
  securityAnswer3: string;
  serviceArea: string;
  businessAddress: string;
  city: string;
  state: string;
  zipCode: string;
  mdotNumber: string;
  mcNumber: string;
  insuranceProvider: string;
  insurancePolicyNumber: string;
  authorityActive: boolean;
  insuranceActive: boolean;
  licensedLivestock: boolean;
  licensedRefrigeratedFood: boolean;
  approved: boolean;
  verificationStatus: string;
  membershipStatus: string;
  subscriptionStatus: "pending" | "active";
  freightMembershipPaid: boolean;
  createdAt: string;
  updatedAt: string;
};

function normalizeAnswer(value: string) {
  return String(value || "").trim().toLowerCase();
}

function safelyParseArray(rawValue: string | null): FreightCarrierRegistration[] {
  if (!rawValue) return [];

  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function getFreightCarriers() {
  const saved = await AsyncStorage.getItem("farm2homeFreightCarriers");
  return safelyParseArray(saved);
}

async function saveFreightCarrier(carrier: FreightCarrierRegistration) {
  const storageKeys = [
    "farm2homeFreightCarriers",
    "farm2homeFreightUsers",
    "freight_carriers",
    "freightUsers",
  ];

  for (const key of storageKeys) {
    const raw = await AsyncStorage.getItem(key);
    let existing: any[] = [];

    try {
      existing = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(existing)) existing = [];
    } catch {
      existing = [];
    }

    const updated = [
      carrier,
      ...existing.filter(
        (item) =>
          String(item.email || "").toLowerCase() !==
            carrier.email.toLowerCase() &&
          String(item.username || "").toLowerCase() !==
            carrier.username.toLowerCase() &&
          item.id !== carrier.id
      ),
    ];

    await AsyncStorage.setItem(key, JSON.stringify(updated));
  }

  await AsyncStorage.setItem("pendingFreightCarrier", JSON.stringify(carrier));
  await AsyncStorage.setItem("currentFreightCarrier", JSON.stringify(carrier));
  await AsyncStorage.setItem("currentFreight", JSON.stringify(carrier));
  await AsyncStorage.setItem("currentFreightUser", JSON.stringify(carrier));
  await AsyncStorage.setItem("currentUser", JSON.stringify(carrier));
  await AsyncStorage.setItem("userRole", "freight");
  await AsyncStorage.setItem("currentUserRole", "freight");
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

  function validateSecurityQuestions() {
    const selectedQuestions = [
      securityQuestion1,
      securityQuestion2,
      securityQuestion3,
    ].filter(Boolean);

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
    const carriers = await getFreightCarriers();

    const duplicate = carriers.find(
      (item) =>
        item.email.toLowerCase() === cleanEmail ||
        item.username.toLowerCase() === cleanUsername
    );

    if (duplicate) {
      Alert.alert(
        "Account Exists",
        "A freight account already exists with this email or username."
      );
      return true;
    }

    try {
      const { data, error } = await supabase
        .from("freight_users")
        .select("id,email,username")
        .or(`email.eq.${cleanEmail},username.eq.${cleanUsername}`)
        .limit(1);

      if (!error && data && data.length > 0) {
        Alert.alert(
          "Account Exists",
          "A freight account already exists with this email or username."
        );
        return true;
      }
    } catch (error) {
      console.log("Freight duplicate Supabase check skipped:", error);
    }

    return false;
  }

  async function saveFreightToSupabase(carrier: FreightCarrierRegistration) {
    try {
      const { error } = await supabase.from("freight_users").upsert({
        id: carrier.id,
        role: "freight",
        company_name: carrier.companyName,
        contact_name: carrier.contactName,
        owner_name: carrier.ownerName,
        email: carrier.email,
        phone: carrier.phone,
        username: carrier.username,
        password: carrier.password,
        account_active: carrier.accountActive,
        security_question_1: carrier.securityQuestion1,
        security_answer_1: carrier.securityAnswer1,
        security_question_2: carrier.securityQuestion2,
        security_answer_2: carrier.securityAnswer2,
        security_question_3: carrier.securityQuestion3,
        security_answer_3: carrier.securityAnswer3,
        service_area: carrier.serviceArea,
        business_address: carrier.businessAddress,
        city: carrier.city,
        state: carrier.state,
        zip_code: carrier.zipCode,
        mdot_number: carrier.mdotNumber,
        mc_number: carrier.mcNumber,
        insurance_provider: carrier.insuranceProvider,
        insurance_policy_number: carrier.insurancePolicyNumber,
        authority_active: carrier.authorityActive,
        insurance_active: carrier.insuranceActive,
        licensed_livestock: carrier.licensedLivestock,
        licensed_refrigerated_food: carrier.licensedRefrigeratedFood,
        approved: carrier.approved,
        verification_status: carrier.verificationStatus,
        membership_status: carrier.membershipStatus,
        subscription_status: carrier.subscriptionStatus,
        freight_membership_paid: carrier.freightMembershipPaid,
        created_at: carrier.createdAt,
        updated_at: carrier.updatedAt,
      });

      if (error) {
        console.log("SUPABASE FREIGHT SAVE SKIPPED:", error.message);
      }
    } catch (error) {
      console.log("SUPABASE FREIGHT SAVE FAILED BUT LOCAL SAVED:", error);
    }
  }

  async function notifyAdminFreightVerification(
    carrier: FreightCarrierRegistration
  ) {
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
          placeholder="Answer"
          placeholderTextColor="#8A8F98"
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
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim();
    const cleanServiceArea = serviceArea.trim();

    const cleanUsername = username.trim().toLowerCase();
    const cleanPassword = password.trim();
    const cleanConfirmPassword = confirmPassword.trim();

    const cleanBusinessAddress = businessAddress.trim();
    const cleanCity = city.trim();
    const cleanState = stateValue.trim();
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

      const carrierId = `carrier_${Date.now()}`;
      const now = new Date().toISOString();

      const freightCarrier: FreightCarrierRegistration = {
        id: carrierId,
        role: "freight",
        companyName: cleanCompanyName,
        contactName: cleanContactName,
        ownerName: cleanContactName,
        email: cleanEmail,
        phone: cleanPhone,
        username: cleanUsername,
        password: cleanPassword,
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

      const verificationRecord = createVerificationRecordFromFreightCarrier({
        carrierId,
        companyName: cleanCompanyName,
        ownerName: cleanContactName,
        email: cleanEmail,
        phone: cleanPhone,
        documents: [],
      });

      await upsertVerificationRecord({
        ...verificationRecord,
        id: carrierId,
        carrierId,
        accountType: "FREIGHT_CARRIER",
        username: cleanUsername,
        password: cleanPassword,
        accountActive: true,
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
        status: "PENDING_VERIFICATION",
        updatedAt: now,
      } as any);

      await saveFreightCarrier(freightCarrier);
      await saveFreightToSupabase(freightCarrier);
      await notifyAdminFreightVerification(freightCarrier);

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
        ...freightCarrier,
        stripeCheckoutSessionId: data.id || data.sessionId || null,
        membershipStatus: "Checkout Started",
        updatedAt: new Date().toISOString(),
      };

      await saveFreightCarrier(checkoutCarrier);

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

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="always"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heroCard}>
        <Text style={styles.title}>Freight Connect</Text>

        <Text style={styles.subtitle}>
          AI driver network-style carrier verification for livestock,
          refrigerated food, and Farm2Home delivery loads.
        </Text>
      </View>

      <View style={styles.noticeBox}>
        <Text style={styles.noticeTitle}>Carrier Approval Required</Text>

        <Text style={styles.noticeText}>
          Your account will stay pending until Farm2Home admin reviews your
          authority, insurance, vehicle, and compliance documents.
        </Text>
      </View>

      <View style={styles.priceBox}>
        <Text style={styles.price}>$9.99 / month</Text>
        <Text style={styles.priceSub}>Access the Farm2Home Freight Board</Text>
      </View>

      <Text style={styles.section}>Company Information</Text>

      <TextInput
        style={styles.input}
        placeholder="Company Name"
        placeholderTextColor="#8A8F98"
        value={companyName}
        onChangeText={setCompanyName}
      />

      <TextInput
        style={styles.input}
        placeholder="Contact Name"
        placeholderTextColor="#8A8F98"
        value={contactName}
        onChangeText={setContactName}
      />

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#8A8F98"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      <TextInput
        style={styles.input}
        placeholder="Phone"
        placeholderTextColor="#8A8F98"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
      />

      <TextInput
        style={styles.input}
        placeholder="Service Area (States / Cities)"
        placeholderTextColor="#8A8F98"
        value={serviceArea}
        onChangeText={setServiceArea}
      />

      <Text style={styles.section}>Create Freight Login</Text>

      <TextInput
        style={styles.input}
        placeholder="Create Username"
        placeholderTextColor="#8A8F98"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <TextInput
        style={styles.input}
        placeholder="Create Password"
        placeholderTextColor="#8A8F98"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
      />

      <TextInput
        style={styles.input}
        placeholder="Confirm Password"
        placeholderTextColor="#8A8F98"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        autoCapitalize="none"
      />

      <View style={styles.securityCard}>
        <Text style={styles.securityTitle}>Security Questions</Text>

        <Text style={styles.securityHelp}>
          Choose 3 different questions. These will be used for freight account
          password recovery.
        </Text>

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

      <Text style={styles.section}>Business Address</Text>

      <TextInput
        style={styles.input}
        placeholder="Business Address"
        placeholderTextColor="#8A8F98"
        value={businessAddress}
        onChangeText={setBusinessAddress}
      />

      <TextInput
        style={styles.input}
        placeholder="City"
        placeholderTextColor="#8A8F98"
        value={city}
        onChangeText={setCity}
      />

      <TextInput
        style={styles.input}
        placeholder="State"
        placeholderTextColor="#8A8F98"
        value={stateValue}
        onChangeText={setStateValue}
      />

      <TextInput
        style={styles.input}
        placeholder="Zip Code"
        placeholderTextColor="#8A8F98"
        keyboardType="numeric"
        value={zipCode}
        onChangeText={setZipCode}
      />

      <Text style={styles.section}>Authority & Insurance</Text>

      <TextInput
        style={styles.input}
        placeholder="MDOT Number"
        placeholderTextColor="#8A8F98"
        value={mdotNumber}
        onChangeText={setMdotNumber}
      />

      <TextInput
        style={styles.input}
        placeholder="MC Number"
        placeholderTextColor="#8A8F98"
        value={mcNumber}
        onChangeText={setMcNumber}
      />

      <TextInput
        style={styles.input}
        placeholder="Insurance Provider"
        placeholderTextColor="#8A8F98"
        value={insuranceProvider}
        onChangeText={setInsuranceProvider}
      />

      <TextInput
        style={styles.input}
        placeholder="Insurance Policy Number"
        placeholderTextColor="#8A8F98"
        value={insurancePolicyNumber}
        onChangeText={setInsurancePolicyNumber}
      />

      <View style={styles.switchRow}>
        <Text style={styles.switchText}>Active MC / Operating Authority</Text>
        <Switch value={authorityActive} onValueChange={setAuthorityActive} />
      </View>

      <View style={styles.switchRow}>
        <Text style={styles.switchText}>Active Insurance</Text>
        <Switch value={insuranceActive} onValueChange={setInsuranceActive} />
      </View>

      <Text style={styles.section}>Transport Authorization</Text>

      <View style={styles.switchRow}>
        <Text style={styles.switchText}>Licensed to Move Livestock</Text>
        <Switch
          value={licensedLivestock}
          onValueChange={setLicensedLivestock}
        />
      </View>

      <View style={styles.switchRow}>
        <Text style={styles.switchText}>Licensed for Refrigerated Fresh Food</Text>
        <Switch
          value={licensedRefrigeratedFood}
          onValueChange={setLicensedRefrigeratedFood}
        />
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
          <Text style={styles.buttonText}>
            Register + Subscribe + Start Verification
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push("/freight/login" as any)}
        activeOpacity={0.85}
      >
        <Text style={styles.link}>Already registered? Login</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F7F7F2",
  },
  content: {
    padding: 20,
    paddingBottom: 50,
  },
  heroCard: {
    backgroundColor: "#2F7D32",
    borderRadius: 28,
    padding: 22,
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    marginBottom: 8,
    color: "#FFFFFF",
  },
  subtitle: {
    color: "#E8F5E9",
    fontSize: 15,
    lineHeight: 23,
    fontWeight: "700",
  },
  noticeBox: {
    backgroundColor: "#FFF7ED",
    borderColor: "#FED7AA",
    borderWidth: 1,
    borderRadius: 18,
    padding: 15,
    marginBottom: 16,
  },
  noticeTitle: {
    color: "#9A3412",
    fontWeight: "900",
    fontSize: 17,
    marginBottom: 6,
  },
  noticeText: {
    color: "#7C2D12",
    fontWeight: "700",
    lineHeight: 22,
  },
  priceBox: {
    backgroundColor: "#EAF6EC",
    padding: 16,
    borderRadius: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#CDE8D2",
  },
  price: {
    fontSize: 25,
    fontWeight: "900",
    color: "#1f7a3f",
  },
  priceSub: {
    color: "#555555",
    marginTop: 4,
    fontWeight: "700",
  },
  section: {
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 10,
    marginTop: 8,
    color: "#111827",
  },
  input: {
    backgroundColor: "#FFFFFF",
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    fontSize: 16,
    color: "#111827",
  },
  securityCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDDDDD",
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  securityTitle: {
    color: "#2F7D32",
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 6,
  },
  securityHelp: {
    color: "#555555",
    lineHeight: 20,
    fontWeight: "700",
    marginBottom: 12,
  },
  securityBox: {
    marginBottom: 12,
  },
  securityLabel: {
    color: "#111827",
    fontWeight: "900",
    marginBottom: 8,
  },
  questionChip: {
    backgroundColor: "#E5E7EB",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    marginRight: 8,
    marginBottom: 10,
    maxWidth: 260,
  },
  questionChipActive: {
    backgroundColor: "#2F7D32",
  },
  questionChipText: {
    color: "#2F7D32",
    fontWeight: "900",
  },
  questionChipTextActive: {
    color: "#FFFFFF",
  },
  switchRow: {
    backgroundColor: "#FFFFFF",
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  switchText: {
    flex: 1,
    fontWeight: "800",
    paddingRight: 12,
    color: "#111827",
  },
  button: {
    backgroundColor: "#2F7D32",
    padding: 16,
    borderRadius: 16,
    marginTop: 10,
    alignItems: "center",
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
    color: "#2F7D32",
    textAlign: "center",
    fontWeight: "900",
    marginTop: 18,
  },
});