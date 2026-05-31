// app/driver/register.tsx

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
import * as DocumentPicker from "expo-document-picker";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { API_BASE_URL, APP_URL } from "../config/api";
import { supabase } from "../services/supabaseClient";
import freightTheme from "../styles/freightTheme";

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

export default function DriverRegisterScreen() {
  const [loading, setLoading] = useState(false);

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

  async function createOrUpdateProfile({
    authUserId,
    cleanFullName,
    cleanEmail,
    cleanPhone,
    cleanUsername,
  }: {
    authUserId: string;
    cleanFullName: string;
    cleanEmail: string;
    cleanPhone: string;
    cleanUsername: string;
  }) {
    const { data: existingProfile, error: existingProfileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (existingProfileError) throw existingProfileError;

    if (existingProfile?.id) {
      const { data, error } = await supabase
        .from("profiles")
        .update({
          auth_user_id: authUserId,
          role: "driver",
          full_name: cleanFullName,
          name: cleanFullName,
          phone: cleanPhone,
          username: cleanUsername,
          account_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingProfile.id)
        .select("*")
        .single();

      if (error) throw error;
      return data;
    }

    const { data, error } = await supabase
      .from("profiles")
      .insert({
        auth_user_id: authUserId,
        role: "driver",
        full_name: cleanFullName,
        name: cleanFullName,
        email: cleanEmail,
        phone: cleanPhone,
        username: cleanUsername,
        account_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
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
      Alert.alert(
        "Driver Info Required",
        "Vehicle type, license number, and service area are required."
      );
      return false;
    }

    if (!licenseDocument || !insuranceDocument) {
      Alert.alert(
        "Documents Required",
        "Please upload your driver license and insurance document."
      );
      return false;
    }

    if (!hasInsurance || !hasValidLicense || !acceptsBackgroundCheck) {
      Alert.alert(
        "Verification Required",
        "Confirm insurance, valid license, and background check authorization."
      );
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
    const driverCheck = await supabase
      .from("drivers")
      .select("id,email,username")
      .or(`email.eq.${cleanEmail},username.eq.${cleanUsername}`)
      .maybeSingle();

    if (!driverCheck.error && driverCheck.data) {
      Alert.alert(
        "Account Exists",
        "A driver account already exists with this email or username."
      );
      return true;
    }

    const profileCheck = await supabase
      .from("profiles")
      .select("id,email,username")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (!profileCheck.error && profileCheck.data) {
      Alert.alert(
        "Account Exists",
        "A profile already exists with this email. Please login instead."
      );
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

  async function saveDriverSession(driver: any) {
    await AsyncStorage.setItem("pendingDriver", JSON.stringify(driver));
    await AsyncStorage.setItem("currentDriver", JSON.stringify(driver));
    await AsyncStorage.setItem("currentUser", JSON.stringify(driver));
    await AsyncStorage.setItem("farm2homeCurrentDriver", JSON.stringify(driver));
    await AsyncStorage.setItem("farm2homeDriverSession", JSON.stringify(driver));
    await AsyncStorage.setItem("userRole", "driver");
    await AsyncStorage.setItem("currentUserRole", "driver");
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

  async function createDriverStripeCheckout({
    cleanEmail,
    cleanFullName,
    cleanUsername,
    driverId,
    profileId,
  }: {
    cleanEmail: string;
    cleanFullName: string;
    cleanUsername: string;
    driverId: string;
    profileId: string;
  }) {
    const response = await fetch(`${API_BASE_URL}/payments/create-subscription-checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerEmail: cleanEmail,
        email: cleanEmail,
        name: cleanFullName,
        username: cleanUsername,
        userId: driverId,
        driverId,
        profileId,
        planType: "driver",
        successUrl: `${APP_URL}/driver/mobile-driver-app?driverId=${driverId}&stripeReturn=true&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${APP_URL}/driver/register?driverId=${driverId}&stripeCancel=true`,
      }),
    });

    const text = await response.text();

    let data: any = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    console.log("DRIVER STRIPE STATUS:", response.status);
    console.log("DRIVER STRIPE RESPONSE:", data);

    if (!response.ok || !data.url) {
      throw new Error(
        data.error ||
          data.message ||
          data.raw ||
          "Stripe checkout URL was not returned. Check STRIPE_DRIVER_MEMBERSHIP_PRICE_ID and backend planType driver."
      );
    }

    return data;
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

      const profile = await createOrUpdateProfile({
        authUserId: driverId,
        cleanFullName,
        cleanEmail,
        cleanPhone,
        cleanUsername,
      });

      if (!profile?.id) {
        Alert.alert("Profile Error", "Unable to create driver profile record.");
        return;
      }

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
        auth_user_id: driverId,
        profile_id: profile.id,
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
        subscription_status: "pending",
        membership_status: "Pending",

        stripe_customer_id: "",
        stripe_subscription_id: "",

        notifications_enabled: false,
        expo_push_token: "",

        created_at: now,
        updated_at: now,
      };

      const { error: driverError } = await supabase
        .from("drivers")
        .upsert(driverPayload, { onConflict: "id" });

      if (driverError) {
        Alert.alert("Driver Profile Error", driverError.message);
        return;
      }

      const localDriver = {
        id: driverId,
        driverId,
        authUserId: driverId,
        profileId: profile.id,
        profile_id: profile.id,
        role: "driver",

        fullName: cleanFullName,
        name: cleanFullName,
        email: cleanEmail,
        phone: cleanPhone,
        username: cleanUsername,

        vehicleType: vehicleType.trim(),
        licenseNumber: licenseNumber.trim(),
        serviceArea: serviceArea.trim(),

        hasInsurance,
        hasValidLicense,
        acceptsBackgroundCheck,

        licenseDocument: uploadedLicense,
        insuranceDocument: uploadedInsurance,
        uploadedDocs: {
          driver_license: uploadedLicense,
          insurance: uploadedInsurance,
        },
        documentsUploaded: true,

        securityQuestion1,
        securityAnswer1: normalizeAnswer(securityAnswer1),
        securityQuestion2,
        securityAnswer2: normalizeAnswer(securityAnswer2),
        securityQuestion3,
        securityAnswer3: normalizeAnswer(securityAnswer3),

        approved: true,
        verified: true,
        accountActive: true,
        subscriptionStatus: "pending",
        membershipStatus: "Pending",

        stripeCustomerId: "",
        stripeSubscriptionId: "",

        createdAt: now,
        updatedAt: now,
      };

      await saveDriverSession(localDriver);

      try {
        const data = await createDriverStripeCheckout({
          cleanEmail,
          cleanFullName,
          cleanUsername,
          driverId,
          profileId: profile.id,
        });

        const checkoutDriver = {
          ...localDriver,
          stripeCheckoutSessionId: data.id || data.sessionId || null,
          membershipStatus: "Checkout Started",
          subscriptionStatus: "pending",
          updatedAt: new Date().toISOString(),
        };

        await saveDriverSession(checkoutDriver);
        await openCheckoutUrl(data.url);
        return;
      } catch (stripeError: any) {
        console.log("Stripe driver checkout error:", stripeError);

        Alert.alert(
          "Driver Account Created",
          stripeError?.message ||
            "Your driver account was created, but Stripe checkout did not open."
        );

        router.replace("/driver/profile" as any);
        return;
      }
    } catch (error: any) {
      console.log("Driver register error:", error);
      Alert.alert(
        "Registration Error",
        error?.message || "Unable to complete driver registration."
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
              <Ionicons name="car-outline" size={32} color="#FFFFFF" />
            </View>

            <Text style={styles.kicker}>Farm2Home Driver Portal</Text>
            <Text style={styles.title}>Driver Registration</Text>
            <Text style={styles.subtitle}>
              Join the Farm2Home driver board to accept local farm delivery
              orders and earn from nearby deliveries.
            </Text>
          </View>

          <View style={styles.priceBox}>
            <View>
              <Text style={styles.price}>$4.99 / month</Text>
              <Text style={styles.priceSub}>Access the Driver Delivery Board</Text>
            </View>
            <View style={styles.priceBadge}>
              <Ionicons name="flash-outline" size={20} color="#BBF7D0" />
            </View>
          </View>

          <View style={styles.formCard}>
            <SectionHeader
              title="Driver Information"
              icon="person-outline"
              subtitle="Basic contact details for your driver profile."
            />

            <TextInput
              style={styles.input}
              placeholder="Full Name"
              placeholderTextColor="#94A3B8"
              value={fullName}
              onChangeText={setFullName}
            />

            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#94A3B8"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <TextInput
              style={styles.input}
              placeholder="Phone"
              placeholderTextColor="#94A3B8"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.formCard}>
            <SectionHeader
              title="Create Driver Login"
              icon="lock-closed-outline"
              subtitle="Create credentials for the Driver Portal."
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

          <View style={styles.formCard}>
            <SectionHeader
              title="Driver Verification"
              icon="shield-checkmark-outline"
              subtitle="Vehicle, license, insurance, and service area."
            />

            <TextInput
              style={styles.input}
              placeholder="Vehicle Type"
              placeholderTextColor="#94A3B8"
              value={vehicleType}
              onChangeText={setVehicleType}
            />

            <TextInput
              style={styles.input}
              placeholder="Driver License Number"
              placeholderTextColor="#94A3B8"
              value={licenseNumber}
              onChangeText={setLicenseNumber}
            />

            <TextInput
              style={styles.input}
              placeholder="Service Area"
              placeholderTextColor="#94A3B8"
              value={serviceArea}
              onChangeText={setServiceArea}
            />

            <TouchableOpacity
              style={styles.uploadButton}
              onPress={() => pickDocument("license")}
            >
              <Ionicons
                name={licenseDocument ? "checkmark-circle" : "cloud-upload-outline"}
                size={20}
                color={licenseDocument ? "#BBF7D0" : freightTheme.colors.primary}
              />
              <Text
                style={[
                  styles.uploadText,
                  licenseDocument && styles.uploadTextComplete,
                ]}
              >
                {licenseDocument
                  ? `License: ${licenseDocument.name}`
                  : "Upload Driver License"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.uploadButton}
              onPress={() => pickDocument("insurance")}
            >
              <Ionicons
                name={insuranceDocument ? "checkmark-circle" : "cloud-upload-outline"}
                size={20}
                color={insuranceDocument ? "#BBF7D0" : freightTheme.colors.primary}
              />
              <Text
                style={[
                  styles.uploadText,
                  insuranceDocument && styles.uploadTextComplete,
                ]}
              >
                {insuranceDocument
                  ? `Insurance: ${insuranceDocument.name}`
                  : "Upload Insurance"}
              </Text>
            </TouchableOpacity>

            <View style={styles.switchRow}>
              <Text style={styles.switchText}>I have active auto insurance</Text>
              <Switch
                value={hasInsurance}
                onValueChange={setHasInsurance}
                trackColor={{ false: "#334155", true: "#064E3B" }}
                thumbColor={hasInsurance ? "#10B981" : "#CBD5E1"}
              />
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchText}>I have a valid driver license</Text>
              <Switch
                value={hasValidLicense}
                onValueChange={setHasValidLicense}
                trackColor={{ false: "#334155", true: "#064E3B" }}
                thumbColor={hasValidLicense ? "#10B981" : "#CBD5E1"}
              />
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchText}>
                I authorize Farm2Home to review driver eligibility
              </Text>
              <Switch
                value={acceptsBackgroundCheck}
                onValueChange={setAcceptsBackgroundCheck}
                trackColor={{ false: "#334155", true: "#064E3B" }}
                thumbColor={acceptsBackgroundCheck ? "#10B981" : "#CBD5E1"}
              />
            </View>
          </View>

          <View style={styles.securityCard}>
            <SectionHeader
              title="Security Questions"
              icon="key-outline"
              subtitle="Choose 3 questions for account verification."
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

          <TouchableOpacity
            onPress={() => router.push("/driver/login" as any)}
            activeOpacity={0.85}
          >
            <Text style={styles.link}>Already registered? Driver Login</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: freightTheme.colors.background },
  keyboard: { flex: 1, backgroundColor: freightTheme.colors.background },
  page: { flex: 1, backgroundColor: freightTheme.colors.background },
  content: { paddingBottom: 80 },
  heroCard: {
    backgroundColor: "#020617",
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 28,
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
  },
  heroIcon: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#064E3B",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#10B981",
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
  priceBox: {
    backgroundColor: "#064E3B",
    padding: 18,
    borderRadius: 20,
    marginHorizontal: 18,
    marginTop: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#10B981",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  price: {
    fontSize: 26,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  priceSub: {
    color: "#BBF7D0",
    marginTop: 4,
    fontWeight: "800",
  },
  priceBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#052E2B",
    alignItems: "center",
    justifyContent: "center",
  },
  formCard: {
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
  uploadButton: {
    backgroundColor: freightTheme.colors.surface,
    borderWidth: 1,
    borderColor: freightTheme.colors.primary,
    padding: 15,
    borderRadius: 14,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  uploadText: {
    color: freightTheme.colors.primary,
    fontWeight: "900",
    flex: 1,
  },
  uploadTextComplete: {
    color: "#BBF7D0",
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
  questionBox: { marginBottom: 12 },
  questionLabel: {
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
  },
  disabledButton: { opacity: 0.6 },
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