// app/customer/register.tsx

import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { createClient } from "@supabase/supabase-js";

import { API_BASE_URL, APP_URL } from "../config/api";
import farmTheme from "../styles/farmTheme";

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
    () =>
      [securityQuestion1, securityQuestion2, securityQuestion3].filter(Boolean),
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
      Alert.alert(
        "Duplicate Questions",
        "Please select 3 different security questions."
      );
      return false;
    }

    if (
      !securityAnswer1.trim() ||
      !securityAnswer2.trim() ||
      !securityAnswer3.trim()
    ) {
      Alert.alert("Security Required", "Please answer all 3 security questions.");
      return false;
    }

    return true;
  }

  async function checkDuplicateCustomer(cleanEmail: string, cleanUsername: string) {
    const { data, error } = await supabase
      .from("customers")
      .select("id,email,username")
      .or(`email.eq.${cleanEmail},username.eq.${cleanUsername}`)
      .maybeSingle();

    if (error) {
      console.log("Duplicate customer check error:", error.message);
      return false;
    }

    if (data) {
      Alert.alert(
        "Account Exists",
        "A customer account already exists with this email or username."
      );
      return true;
    }

    return false;
  }

  async function saveCurrentCustomer(customerAccount: any) {
    await AsyncStorage.setItem(
      "pendingCustomer",
      JSON.stringify(customerAccount)
    );
    await AsyncStorage.setItem(
      "currentCustomer",
      JSON.stringify(customerAccount)
    );
    await AsyncStorage.setItem("currentUser", JSON.stringify(customerAccount));
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
          },
        },
      });

      if (authError) {
        Alert.alert("Signup Error", authError.message);
        return;
      }

      const customerId = authData?.user?.id;

      if (!customerId) {
        Alert.alert(
          "Signup Error",
          "Unable to create customer account. Please try again."
        );
        return;
      }

      const customerPayload = {
        id: customerId,
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

      const { error: profileError } = await supabase
        .from("customers")
        .upsert(customerPayload, { onConflict: "id" });

      if (profileError) {
        Alert.alert("Profile Error", profileError.message);
        return;
      }

      const localCustomer = {
        id: customerId,
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
            name: cleanFullName,
            username: cleanUsername,
            userId: customerId,
            customerId,
            planType: "customer",
            successUrl: `${APP_URL}/customer/subscription-success?session_id={CHECKOUT_SESSION_ID}`,
            cancelUrl: `${APP_URL}/customer/register`,
          }),
        }
      );

      const text = await response.text();

      console.log("CUSTOMER STRIPE STATUS:", response.status);
      console.log("CUSTOMER STRIPE RESPONSE:", text);

      let data: { success?: boolean; url?: string; error?: string } = {};

      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = {};
      }

      if (!response.ok || !data.url) {
        Alert.alert(
          "Account Created",
          data.error ||
            "Your account was created, but Stripe checkout did not open. Please try subscribing from the customer subscription screen."
        );

        router.replace("/customer/subscription" as any);
        return;
      }

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
                style={[
                  styles.questionChip,
                  active && styles.questionChipActive,
                ]}
                activeOpacity={0.8}
                onPress={() => setSelectedQuestion(question)}
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
          value={answer}
          onChangeText={setAnswer}
          placeholder="Hidden answer"
          placeholderTextColor="#8A8F98"
          secureTextEntry
        />
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="always"
      >
        <Text style={styles.header}>Create Customer Account</Text>

        <Text style={styles.subheader}>
          Create your login, save security questions, then complete Stripe
          subscription to access the marketplace.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Full Name"
          placeholderTextColor="#8A8F98"
          value={fullName}
          onChangeText={setFullName}
        />

        <TextInput
          style={styles.input}
          placeholder="Email Address"
          placeholderTextColor="#8A8F98"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TextInput
          style={styles.input}
          placeholder="Phone Number"
          placeholderTextColor="#8A8F98"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />

        <Text style={styles.sectionTitle}>Create Customer Login</Text>

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
          autoCorrect={false}
        />

        <TextInput
          style={styles.input}
          placeholder="Confirm Password"
          placeholderTextColor="#8A8F98"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
        />

        <View style={styles.securityCard}>
          <Text style={styles.securityTitle}>Security Questions</Text>

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
          onPress={createAccountAndSubscribe}
          disabled={loading}
          style={[styles.createButton, loading && styles.disabledButton]}
          activeOpacity={0.7}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.createButtonText}>
              Create Account + Subscribe
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push("/customer/login" as any)}
          style={styles.loginLink}
        >
          <Text style={styles.loginLinkText}>Already have an account? Login</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: farmTheme.colors.background,
  },
  content: {
    flexGrow: 1,
    padding: 22,
    paddingBottom: 60,
    justifyContent: "center",
  },
  header: {
    fontSize: 30,
    fontWeight: "900",
    color: farmTheme.colors.primary,
    marginBottom: 8,
  },
  subheader: {
    color: farmTheme.colors.mutedText,
    lineHeight: 21,
    marginBottom: 20,
    fontWeight: "700",
  },
  sectionTitle: {
    color: farmTheme.colors.primary,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 10,
    marginTop: 6,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    color: farmTheme.colors.text,
    fontWeight: "700",
  },
  securityCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    borderRadius: 18,
    padding: 16,
    marginTop: 8,
    marginBottom: 12,
  },
  securityTitle: {
    color: farmTheme.colors.primary,
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 10,
  },
  questionBox: {
    marginBottom: 14,
  },
  questionLabel: {
    color: farmTheme.colors.text,
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
  questionChipActive: {
    backgroundColor: farmTheme.colors.primary,
  },
  questionChipText: {
    color: farmTheme.colors.primary,
    fontWeight: "900",
  },
  questionChipTextActive: {
    color: "#FFFFFF",
  },
  createButton: {
    backgroundColor: farmTheme.colors.primary,
    padding: 18,
    borderRadius: 16,
    marginTop: 10,
    alignItems: "center",
    zIndex: 9999,
    elevation: 20,
  },
  disabledButton: {
    opacity: 0.6,
  },
  createButtonText: {
    color: "#FFFFFF",
    textAlign: "center",
    fontWeight: "900",
    fontSize: 16,
  },
  loginLink: {
    marginTop: 18,
    padding: 10,
  },
  loginLinkText: {
    textAlign: "center",
    color: farmTheme.colors.primary,
    fontWeight: "800",
  },
});