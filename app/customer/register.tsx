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

import { API_BASE_URL, APP_URL } from "../config/api";
import { supabase } from "../data/supabaseClient";
import farmTheme from "../styles/farmTheme";

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

type CustomerAccount = {
  id: string;
  role: "customer";
  fullName: string;
  name: string;
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
  customerMembershipPaid: boolean;
  subscriptionStatus: "pending" | "active";
  membershipStatus: "Pending" | "Active";
  createdAt: string;
  updatedAt?: string;
};

function normalizeAnswer(value: string) {
  return String(value || "").trim().toLowerCase();
}

function safelyParseArray(rawValue: string | null): CustomerAccount[] {
  if (!rawValue) return [];

  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function readCustomerArray(key: string) {
  const saved = await AsyncStorage.getItem(key);
  return safelyParseArray(saved);
}

async function saveCustomer(customerAccount: CustomerAccount) {
  const storageKeys = ["farm2homeCustomers", "customers", "customerAccounts"];

  for (const key of storageKeys) {
    const customers = await readCustomerArray(key);

    const updatedCustomers = [
      customerAccount,
      ...customers.filter(
        (item) =>
          item.id !== customerAccount.id &&
          String(item.email || "").toLowerCase() !==
            customerAccount.email.toLowerCase() &&
          String(item.username || "").toLowerCase() !==
            customerAccount.username.toLowerCase()
      ),
    ];

    await AsyncStorage.setItem(key, JSON.stringify(updatedCustomers));
  }

  await AsyncStorage.setItem("pendingCustomer", JSON.stringify(customerAccount));
  await AsyncStorage.setItem("currentCustomer", JSON.stringify(customerAccount));
  await AsyncStorage.setItem("currentUser", JSON.stringify(customerAccount));
  await AsyncStorage.setItem("userRole", "customer");
  await AsyncStorage.setItem("currentUserRole", "customer");
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
  const [testLoading, setTestLoading] = useState(false);

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
    const keys = ["farm2homeCustomers", "customers", "customerAccounts"];

    for (const key of keys) {
      const customers = await readCustomerArray(key);

      const duplicate = customers.find(
        (item) =>
          String(item.email || "").toLowerCase() === cleanEmail ||
          String(item.username || "").toLowerCase() === cleanUsername
      );

      if (duplicate) {
        Alert.alert(
          "Account Exists",
          "A customer account already exists with this email or username."
        );
        return true;
      }
    }

    return false;
  }

  async function createAccountAndSubscribe() {
    if (loading) return;
    if (!validateForm()) return;

    const cleanFullName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim();
    const cleanUsername = username.trim().toLowerCase();
    const cleanPassword = password.trim();
    const now = new Date().toISOString();

    try {
      setLoading(true);

      const duplicate = await checkDuplicateCustomer(cleanEmail, cleanUsername);
      if (duplicate) return;

      const customerAccount: CustomerAccount = {
        id: `customer_${Date.now()}`,
        role: "customer",
        fullName: cleanFullName,
        name: cleanFullName,
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
        customerMembershipPaid: false,
        subscriptionStatus: "pending",
        membershipStatus: "Pending",
        createdAt: now,
        updatedAt: now,
      };

      await saveCustomer(customerAccount);

      try {
        const { error } = await supabase.from("customers").upsert({
          id: customerAccount.id,
          full_name: customerAccount.fullName,
          name: customerAccount.name,
          email: customerAccount.email,
          username: customerAccount.username,
          password: customerAccount.password,
          phone: customerAccount.phone,
          account_active: true,
          customer_membership_paid: false,
          subscription_status: customerAccount.subscriptionStatus,
          membership_status: customerAccount.membershipStatus,
          security_question_1: customerAccount.securityQuestion1,
          security_answer_1: customerAccount.securityAnswer1,
          security_question_2: customerAccount.securityQuestion2,
          security_answer_2: customerAccount.securityAnswer2,
          security_question_3: customerAccount.securityQuestion3,
          security_answer_3: customerAccount.securityAnswer3,
          created_at: customerAccount.createdAt,
          updated_at: customerAccount.updatedAt,
        });

        if (error) {
          console.log("SUPABASE CUSTOMER SAVE SKIPPED:", error.message);
        }
      } catch (error) {
        console.log("SUPABASE SAVE FAILED BUT LOCAL SAVED:", error);
      }

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
            userId: customerAccount.id,
            customerId: customerAccount.id,
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
          "Account Saved",
          data.error ||
            "Your account was saved, but Stripe checkout did not open. Check backend Stripe price ID."
        );
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

  async function createTestCustomer() {
    if (testLoading) return;

    try {
      setTestLoading(true);

      const timestamp = Date.now();

      const testCustomer: CustomerAccount = {
        id: `test_customer_${timestamp}`,
        role: "customer",
        fullName: "Test Customer",
        name: "Test Customer",
        email: `testcustomer${timestamp}@farm2home.com`,
        phone: "555-555-5555",
        username: `testcustomer${timestamp}`,
        password: "Customer123",
        accountActive: true,
        securityQuestion1: SECURITY_QUESTIONS[0],
        securityAnswer1: "dog",
        securityQuestion2: SECURITY_QUESTIONS[1],
        securityAnswer2: "detroit",
        securityQuestion3: SECURITY_QUESTIONS[2],
        securityAnswer3: "school",
        customerMembershipPaid: true,
        subscriptionStatus: "active",
        membershipStatus: "Active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveCustomer(testCustomer);

      Alert.alert(
        "Test Customer Created",
        `Username: ${testCustomer.username}\nPassword: ${testCustomer.password}`,
        [
          {
            text: "Continue",
            onPress: () => router.replace("/customer/marketplace" as any),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Unable to create test customer.");
    } finally {
      setTestLoading(false);
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
          onPress={createTestCustomer}
          disabled={testLoading}
          style={[styles.testButton, testLoading && styles.disabledButton]}
          activeOpacity={0.7}
        >
          {testLoading ? (
            <ActivityIndicator color={farmTheme.colors.primary} />
          ) : (
            <Text style={styles.testButtonText}>Create Test Customer</Text>
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
  testButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: farmTheme.colors.primary,
    padding: 16,
    borderRadius: 16,
    marginTop: 14,
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
  testButtonText: {
    color: farmTheme.colors.primary,
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