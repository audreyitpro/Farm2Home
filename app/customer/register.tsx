// app/customer/register.tsx

import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Ionicons } from "@expo/vector-icons";

import { API_BASE_URL, APP_URL } from "../config/api";
import { supabase } from "../services/supabaseClient";

const ui = {
  bg: "#F7FBF4",
  card: "#FFFFFF",
  border: "#DDE7D6",
  text: "#102A1C",
  muted: "#647067",
  soft: "#F1F8EC",
  green: "#166534",
  greenDark: "#14532D",
  greenSoft: "#DCFCE7",
  orange: "#EA580C",
  red: "#DC2626",
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
  "What is your favorite color?",
];

function normalize(value: string) {
  return String(value || "").trim().toLowerCase();
}

function normalizeAnswer(value: string) {
  return String(value || "").trim().toLowerCase();
}

export default function CustomerRegister() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [securityQuestion1, setSecurityQuestion1] = useState("");
  const [securityAnswer1, setSecurityAnswer1] = useState("");
  const [securityQuestion2, setSecurityQuestion2] = useState("");
  const [securityAnswer2, setSecurityAnswer2] = useState("");
  const [securityQuestion3, setSecurityQuestion3] = useState("");
  const [securityAnswer3, setSecurityAnswer3] = useState("");

  const [loading, setLoading] = useState(false);

  const selectedQuestions = useMemo(
    () => [securityQuestion1, securityQuestion2, securityQuestion3].filter(Boolean),
    [securityQuestion1, securityQuestion2, securityQuestion3]
  );

  function validateForm() {
    if (
      !fullName.trim() ||
      !email.trim() ||
      !phone.trim() ||
      !username.trim() ||
      !password.trim() ||
      !confirmPassword.trim()
    ) {
      Alert.alert("Missing Info", "Please complete all customer fields.");
      return false;
    }

    if (!email.trim().includes("@")) {
      Alert.alert("Invalid Email", "Please enter a valid email address.");
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

    if (selectedQuestions.length !== 3) {
      Alert.alert("Security Required", "Please select 3 security questions.");
      return false;
    }

    if (new Set(selectedQuestions).size !== 3) {
      Alert.alert("Duplicate Questions", "Please select 3 different security questions.");
      return false;
    }

    if (!securityAnswer1.trim() || !securityAnswer2.trim() || !securityAnswer3.trim()) {
      Alert.alert("Security Required", "Please answer all 3 security questions.");
      return false;
    }

    return true;
  }

  async function checkDuplicateCustomer(cleanEmail: string, cleanUsername: string) {
    const customerCheck = await supabase
      .from("customers")
      .select("id,email,username")
      .or(`email.eq.${cleanEmail},username.eq.${cleanUsername}`)
      .maybeSingle();

    if (!customerCheck.error && customerCheck.data) {
      Alert.alert(
        "Account Exists",
        "A customer account already exists with this email or username."
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
          role: "customer",
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
        role: "customer",
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

  async function saveCurrentCustomer(customerAccount: any) {
    await AsyncStorage.setItem("pendingCustomer", JSON.stringify(customerAccount));
    await AsyncStorage.setItem("currentCustomer", JSON.stringify(customerAccount));
    await AsyncStorage.setItem("currentUser", JSON.stringify(customerAccount));
    await AsyncStorage.setItem("farm2homeCurrentCustomer", JSON.stringify(customerAccount));
    await AsyncStorage.setItem("userRole", "customer");
    await AsyncStorage.setItem("currentUserRole", "customer");
  }

  async function createAccountAndSubscribe() {
    if (loading) return;
    if (!validateForm()) return;

    const cleanFullName = fullName.trim();
    const cleanEmail = normalize(email);
    const cleanPhone = phone.trim();
    const cleanUsername = normalize(username);
    const cleanPassword = password.trim();
    const now = new Date().toISOString();

    try {
      setLoading(true);

      const duplicate = await checkDuplicateCustomer(cleanEmail, cleanUsername);
      if (duplicate) return;

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: cleanEmail,
        password: cleanPassword,
        options: {
          data: {
            role: "customer",
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

      const customerId = authData?.user?.id;

      if (!customerId) {
        Alert.alert("Signup Error", "Unable to create customer account. Please try again.");
        return;
      }

      const profile = await createOrUpdateProfile({
        authUserId: customerId,
        cleanFullName,
        cleanEmail,
        cleanPhone,
        cleanUsername,
      });

      if (!profile?.id) {
        Alert.alert("Profile Error", "Unable to create customer profile record.");
        return;
      }

      const customerPayload = {
        id: customerId,
        auth_user_id: customerId,
        profile_id: profile.id,

        role: "customer",
        full_name: cleanFullName,
        name: cleanFullName,
        email: cleanEmail,
        phone: cleanPhone,
        username: cleanUsername,

        account_active: true,
        customer_membership_paid: false,
        subscription_status: "pending",
        membership_status: "Pending",

        stripe_customer_id: "",
        stripe_subscription_id: "",

        security_question_1: securityQuestion1,
        security_answer_1: normalizeAnswer(securityAnswer1),
        security_question_2: securityQuestion2,
        security_answer_2: normalizeAnswer(securityAnswer2),
        security_question_3: securityQuestion3,
        security_answer_3: normalizeAnswer(securityAnswer3),

        notifications_enabled: false,
        expo_push_token: "",

        created_at: now,
        updated_at: now,
      };

      const { error: customerError } = await supabase
        .from("customers")
        .upsert(customerPayload, { onConflict: "id" });

      if (customerError) {
        Alert.alert("Customer Profile Error", customerError.message);
        return;
      }

      const localCustomer = {
        id: customerId,
        customerId,
        authUserId: customerId,
        profileId: profile.id,
        profile_id: profile.id,
        role: "customer",

        fullName: cleanFullName,
        name: cleanFullName,
        email: cleanEmail,
        phone: cleanPhone,
        username: cleanUsername,

        accountActive: true,
        customerMembershipPaid: false,
        subscriptionStatus: "pending",
        membershipStatus: "Pending",

        stripeCustomerId: "",
        stripeSubscriptionId: "",

        securityQuestion1,
        securityAnswer1: normalizeAnswer(securityAnswer1),
        securityQuestion2,
        securityAnswer2: normalizeAnswer(securityAnswer2),
        securityQuestion3,
        securityAnswer3: normalizeAnswer(securityAnswer3),

        createdAt: now,
        updatedAt: now,
      };

      await saveCurrentCustomer(localCustomer);

      const response = await fetch(`${API_BASE_URL}/payments/create-subscription-checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerEmail: cleanEmail,
          email: cleanEmail,
          name: cleanFullName,
          username: cleanUsername,
          userId: customerId,
          customerId,
          profileId: profile.id,
          planType: "customer",
          successUrl: `${APP_URL}/customer/subscription-success?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${APP_URL}/customer/register`,
        }),
      });

      const text = await response.text();

      console.log("CUSTOMER STRIPE STATUS:", response.status);
      console.log("CUSTOMER STRIPE RESPONSE:", text);

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
          "Account Created",
          data.error ||
            data.message ||
            "Your account was created, but Stripe checkout did not open. Please try subscribing from the customer subscription screen."
        );

        router.replace("/customer/subscription" as any);
        return;
      }

      const checkoutCustomer = {
        ...localCustomer,
        stripeCheckoutSessionId: data.id || data.sessionId || null,
        membershipStatus: "Checkout Started",
        subscriptionStatus: "pending",
        updatedAt: new Date().toISOString(),
      };

      await saveCurrentCustomer(checkoutCustomer);

      if (Platform.OS === "web") {
        window.location.href = data.url;
      } else {
        await WebBrowser.openBrowserAsync(data.url);
      }
    } catch (error: any) {
      console.log("CUSTOMER REGISTER ERROR:", error);
      Alert.alert(
        "Registration Error",
        error?.message || "Unable to complete customer registration."
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
                activeOpacity={0.8}
                onPress={() => setSelectedQuestion(question)}
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
          value={answer}
          onChangeText={setAnswer}
          placeholder="Hidden answer"
          placeholderTextColor={ui.muted}
          secureTextEntry
        />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={ui.bg} />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="always">
        <TouchableOpacity style={styles.backButton} onPress={() => router.push("/")}>
          <Ionicons name="arrow-back-outline" size={18} color={ui.greenDark} />
          <Text style={styles.backText}>Back Home</Text>
        </TouchableOpacity>

        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <Ionicons name="basket-outline" size={30} color="#FFFFFF" />
          </View>

          <Text style={styles.header}>Create Customer Account</Text>

          <Text style={styles.subheader}>
            Join Farm2Home, save your login and security questions, then complete your $4.99 monthly customer subscription.
          </Text>
        </View>

        <View style={styles.card}>
          <SectionTitle title="Customer Information" icon="person-outline" />

          <TextInput
            style={styles.input}
            placeholder="Full Name"
            placeholderTextColor={ui.muted}
            value={fullName}
            onChangeText={setFullName}
          />

          <TextInput
            style={styles.input}
            placeholder="Email Address"
            placeholderTextColor={ui.muted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <TextInput
            style={styles.input}
            placeholder="Phone Number"
            placeholderTextColor={ui.muted}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.card}>
          <SectionTitle title="Create Customer Login" icon="lock-closed-outline" />

          <TextInput
            style={styles.input}
            placeholder="Create Username"
            placeholderTextColor={ui.muted}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TextInput
            style={styles.input}
            placeholder="Create Password"
            placeholderTextColor={ui.muted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            placeholderTextColor={ui.muted}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.card}>
          <SectionTitle title="Security Questions" icon="help-circle-outline" />

          <Text style={styles.helperText}>
            Choose 3 different questions. These are used for account recovery.
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

        <View style={styles.priceCard}>
          <View>
            <Text style={styles.priceTitle}>Customer Membership</Text>
            <Text style={styles.priceText}>
              $4.99 monthly to access Farm2Home marketplace ordering.
            </Text>
          </View>
          <Text style={styles.priceAmount}>$4.99</Text>
        </View>

        <TouchableOpacity
          onPress={createAccountAndSubscribe}
          disabled={loading}
          style={[styles.createButton, loading && styles.disabledButton]}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="card-outline" size={20} color="#FFFFFF" />
              <Text style={styles.createButtonText}>Create Account + Subscribe</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push("/customer/login" as any)}
          style={styles.loginLink}
        >
          <Text style={styles.loginLinkText}>Already have an account? Login</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionTitle({
  title,
  icon,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.sectionTitleRow}>
      <View style={styles.sectionIcon}>
        <Ionicons name={icon} size={20} color={ui.greenDark} />
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: ui.bg },
  content: { flexGrow: 1, padding: 20, paddingBottom: 70 },
  backButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: ui.greenSoft,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginBottom: 14,
  },
  backText: { color: ui.greenDark, fontWeight: "900" },
  heroCard: {
    backgroundColor: ui.greenDark,
    borderRadius: 28,
    padding: 22,
    marginBottom: 16,
  },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  header: {
    fontSize: 31,
    lineHeight: 38,
    fontWeight: "900",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  subheader: {
    color: "#DCFCE7",
    lineHeight: 22,
    fontWeight: "700",
    fontSize: 15,
  },
  card: {
    backgroundColor: ui.card,
    borderWidth: 1,
    borderColor: ui.border,
    borderRadius: 24,
    padding: 17,
    marginBottom: 14,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 13,
  },
  sectionIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: ui.greenSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    color: ui.text,
    fontSize: 19,
    fontWeight: "900",
  },
  helperText: {
    color: ui.muted,
    fontWeight: "700",
    lineHeight: 20,
    marginBottom: 12,
  },
  input: {
    backgroundColor: ui.soft,
    borderWidth: 1,
    borderColor: ui.border,
    borderRadius: 15,
    padding: 14,
    marginBottom: 12,
    color: ui.text,
    fontWeight: "700",
  },
  questionBox: { marginBottom: 12 },
  questionLabel: {
    color: ui.text,
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
    maxWidth: 280,
  },
  questionChipActive: { backgroundColor: ui.green },
  questionChipText: { color: ui.greenDark, fontWeight: "900" },
  questionChipTextActive: { color: "#FFFFFF" },
  priceCard: {
    backgroundColor: ui.card,
    borderWidth: 1,
    borderColor: ui.border,
    borderRadius: 24,
    padding: 17,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  priceTitle: {
    color: ui.text,
    fontWeight: "900",
    fontSize: 18,
  },
  priceText: {
    color: ui.muted,
    fontWeight: "700",
    marginTop: 4,
    lineHeight: 20,
    maxWidth: 640,
  },
  priceAmount: {
    color: ui.green,
    fontWeight: "900",
    fontSize: 24,
  },
  createButton: {
    backgroundColor: ui.green,
    padding: 18,
    borderRadius: 18,
    marginTop: 4,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  disabledButton: { opacity: 0.6 },
  createButtonText: {
    color: "#FFFFFF",
    textAlign: "center",
    fontWeight: "900",
    fontSize: 16,
  },
  loginLink: {
    marginTop: 16,
    padding: 10,
  },
  loginLinkText: {
    textAlign: "center",
    color: ui.greenDark,
    fontWeight: "900",
  },
});