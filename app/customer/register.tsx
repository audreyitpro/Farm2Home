import React, { useState } from "react";
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
  "What is the name of your elementary school?",
];

type CustomerAccount = {
  id: string;
  fullName: string;
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

async function getCustomers() {
  const savedCustomers = await AsyncStorage.getItem("farm2homeCustomers");
  return safelyParseArray(savedCustomers);
}

async function saveCustomer(customerAccount: CustomerAccount) {
  const customers = await getCustomers();

  const updatedCustomers = [
    ...customers.filter(
      (item) =>
        item.email.toLowerCase() !== customerAccount.email.toLowerCase() &&
        item.username.toLowerCase() !== customerAccount.username.toLowerCase()
    ),
    customerAccount,
  ];

  await AsyncStorage.setItem(
    "farm2homeCustomers",
    JSON.stringify(updatedCustomers)
  );

  await AsyncStorage.setItem("pendingCustomer", JSON.stringify(customerAccount));
  await AsyncStorage.setItem("currentCustomer", JSON.stringify(customerAccount));
  await AsyncStorage.setItem("currentUser", JSON.stringify(customerAccount));
  await AsyncStorage.setItem("userRole", "customer");
  await AsyncStorage.setItem("currentUserRole", "customer");
}

export default function CustomerRegister() {
  const [fullName, setFullName] = useState("Test Customer");
  const [email, setEmail] = useState(`test${Date.now()}@farm2home.com`);
  const [phone, setPhone] = useState("555-555-5555");

  const [username, setUsername] = useState(`customer${Date.now()}`);
  const [password, setPassword] = useState("Password123");
  const [confirmPassword, setConfirmPassword] = useState("Password123");

  const [securityQuestion1, setSecurityQuestion1] =
    useState(SECURITY_QUESTIONS[0]);
  const [securityAnswer1, setSecurityAnswer1] = useState("dog");

  const [securityQuestion2, setSecurityQuestion2] =
    useState(SECURITY_QUESTIONS[1]);
  const [securityAnswer2, setSecurityAnswer2] = useState("detroit");

  const [securityQuestion3, setSecurityQuestion3] =
    useState(SECURITY_QUESTIONS[2]);
  const [securityAnswer3, setSecurityAnswer3] = useState("school");

  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);

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

    if (
      !securityQuestion1 ||
      !securityQuestion2 ||
      !securityQuestion3 ||
      !securityAnswer1.trim() ||
      !securityAnswer2.trim() ||
      !securityAnswer3.trim()
    ) {
      Alert.alert(
        "Security Required",
        "Please complete all 3 security questions and answers."
      );
      return false;
    }

    return true;
  }

  async function checkDuplicateCustomer(
    cleanEmail: string,
    cleanUsername: string
  ) {
    const customers = await getCustomers();

    const duplicate = customers.find(
      (item) =>
        item.email.toLowerCase() === cleanEmail ||
        item.username.toLowerCase() === cleanUsername
    );

    if (duplicate) {
      Alert.alert(
        "Account Exists",
        "A customer account already exists with this email or username."
      );
      return true;
    }

    return false;
  }

  async function createAccountAndSubscribe() {
    console.log("CREATE ACCOUNT + SUBSCRIBE CLICKED");

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
        fullName: cleanFullName,
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
        membershipStatus: "Pending",
        createdAt: now,
        updatedAt: now,
      };

      await saveCustomer(customerAccount);

      try {
        const { error } = await supabase.from("customers").upsert({
          id: customerAccount.id,
          full_name: customerAccount.fullName,
          email: customerAccount.email,
          username: customerAccount.username,
          password: customerAccount.password,
          phone: customerAccount.phone,
          account_active: true,
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

      console.log("STRIPE STATUS:", response.status);
      console.log("STRIPE RESPONSE:", text);

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
        fullName: "Test Customer",
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
        />

        <TextInput
          style={styles.input}
          placeholder="Create Password"
          placeholderTextColor="#8A8F98"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TextInput
          style={styles.input}
          placeholder="Confirm Password"
          placeholderTextColor="#8A8F98"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
        />

        <View style={styles.securityCard}>
          <Text style={styles.securityTitle}>Security Questions</Text>

          <TextInput
            style={styles.input}
            value={securityQuestion1}
            onChangeText={setSecurityQuestion1}
            placeholder="Security Question 1"
          />

          <TextInput
            style={styles.input}
            value={securityAnswer1}
            onChangeText={setSecurityAnswer1}
            placeholder="Answer 1"
          />

          <TextInput
            style={styles.input}
            value={securityQuestion2}
            onChangeText={setSecurityQuestion2}
            placeholder="Security Question 2"
          />

          <TextInput
            style={styles.input}
            value={securityAnswer2}
            onChangeText={setSecurityAnswer2}
            placeholder="Answer 2"
          />

          <TextInput
            style={styles.input}
            value={securityQuestion3}
            onChangeText={setSecurityQuestion3}
            placeholder="Security Question 3"
          />

          <TextInput
            style={styles.input}
            value={securityAnswer3}
            onChangeText={setSecurityAnswer3}
            placeholder="Answer 3"
          />
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