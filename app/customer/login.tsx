import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";

import { supabase } from "../data/supabaseClient";
import farmTheme from "../styles/farmTheme";

type CustomerAccount = {
  id: string;
  role?: "customer";
  fullName?: string;
  name?: string;
  full_name?: string;
  email: string;
  phone?: string;
  username?: string;
  password?: string;
  accountActive?: boolean;
  account_active?: boolean;
  customerMembershipPaid?: boolean;
  customer_membership_paid?: boolean;
  subscriptionStatus?: "pending" | "active";
  subscription_status?: "pending" | "active";
  membershipStatus?: "Pending" | "Active";
  membership_status?: "Pending" | "Active";
  securityQuestion1?: string;
  security_question_1?: string;
  securityAnswer1?: string;
  security_answer_1?: string;
  securityQuestion2?: string;
  security_question_2?: string;
  securityAnswer2?: string;
  security_answer_2?: string;
  securityQuestion3?: string;
  security_question_3?: string;
  securityAnswer3?: string;
  security_answer_3?: string;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
};

const CUSTOMER_ARRAY_KEYS = [
  "farm2homeCustomers",
  "customers",
  "customerAccounts",
];

const CUSTOMER_OBJECT_KEYS = [
  "currentCustomer",
  "currentUser",
  "pendingCustomer",
];

function clean(value: any) {
  return String(value || "").trim();
}

function normalize(value: any) {
  return clean(value).toLowerCase();
}

function safelyParse(rawValue: string | null): any {
  if (!rawValue) return null;

  try {
    return JSON.parse(rawValue);
  } catch {
    return null;
  }
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

function normalizeCustomer(customer: CustomerAccount): CustomerAccount {
  const fullName =
    customer.fullName ||
    customer.full_name ||
    customer.name ||
    "Customer";

  return {
    id: customer.id || `customer_${Date.now()}`,
    role: "customer",
    fullName,
    name: fullName,
    email: normalize(customer.email),
    phone: customer.phone || "",
    username: normalize(customer.username),
    password: clean(customer.password),
    accountActive:
      customer.accountActive ?? customer.account_active ?? true,
    customerMembershipPaid:
      customer.customerMembershipPaid ??
      customer.customer_membership_paid ??
      false,
    subscriptionStatus:
      customer.subscriptionStatus ||
      customer.subscription_status ||
      "pending",
    membershipStatus:
      customer.membershipStatus ||
      customer.membership_status ||
      "Pending",
    securityQuestion1:
      customer.securityQuestion1 || customer.security_question_1 || "",
    securityAnswer1:
      customer.securityAnswer1 || customer.security_answer_1 || "",
    securityQuestion2:
      customer.securityQuestion2 || customer.security_question_2 || "",
    securityAnswer2:
      customer.securityAnswer2 || customer.security_answer_2 || "",
    securityQuestion3:
      customer.securityQuestion3 || customer.security_question_3 || "",
    securityAnswer3:
      customer.securityAnswer3 || customer.security_answer_3 || "",
    createdAt: customer.createdAt || customer.created_at || "",
    updatedAt:
      customer.updatedAt ||
      customer.updated_at ||
      new Date().toISOString(),
  };
}

function mergeCustomers(records: CustomerAccount[]) {
  const merged: CustomerAccount[] = [];

  for (const record of records) {
    const normalized = normalizeCustomer(record);

    const index = merged.findIndex((item) => {
      return (
        item.id === normalized.id ||
        (normalized.email && item.email === normalized.email) ||
        (normalized.username && item.username === normalized.username)
      );
    });

    if (index === -1) {
      merged.push(normalized);
      continue;
    }

    const existing = merged[index];

    merged[index] = {
      ...existing,
      ...normalized,
      username: normalized.username || existing.username,
      password: normalized.password || existing.password,
      email: normalized.email || existing.email,
      accountActive:
        existing.accountActive === true || normalized.accountActive === true,
      membershipStatus:
        normalized.membershipStatus || existing.membershipStatus,
      subscriptionStatus:
        normalized.subscriptionStatus || existing.subscriptionStatus,
    };
  }

  return merged;
}

async function readArrayKey(key: string) {
  const raw = await AsyncStorage.getItem(key);
  return safelyParseArray(raw).map(normalizeCustomer);
}

async function getLocalCustomers() {
  const customers: CustomerAccount[] = [];

  for (const key of CUSTOMER_OBJECT_KEYS) {
    const parsed = safelyParse(await AsyncStorage.getItem(key));

    if (parsed) {
      customers.push(normalizeCustomer(parsed));
    }
  }

  for (const key of CUSTOMER_ARRAY_KEYS) {
    const records = await readArrayKey(key);
    customers.push(...records);
  }

  const merged = mergeCustomers(customers);

  console.log(
    "CUSTOMER LOGIN RECORDS:",
    merged.map((item) => ({
      id: item.id,
      email: item.email,
      username: item.username,
      password: item.password,
      active: item.accountActive,
      membershipStatus: item.membershipStatus,
      subscriptionStatus: item.subscriptionStatus,
    }))
  );

  return merged;
}

async function saveCurrentCustomer(customer: CustomerAccount) {
  const normalized = normalizeCustomer(customer);

  await AsyncStorage.setItem("currentCustomer", JSON.stringify(normalized));
  await AsyncStorage.setItem("currentUser", JSON.stringify(normalized));
  await AsyncStorage.setItem("userRole", "customer");
  await AsyncStorage.setItem("currentUserRole", "customer");
}

async function syncCustomerToLocal(customer: CustomerAccount) {
  const normalized = normalizeCustomer(customer);

  for (const key of CUSTOMER_ARRAY_KEYS) {
    const records = await readArrayKey(key);

    const updatedCustomers = [
      normalized,
      ...records.filter(
        (item) =>
          item.id !== normalized.id &&
          normalize(item.email) !== normalized.email &&
          normalize(item.username) !== normalized.username
      ),
    ];

    await AsyncStorage.setItem(key, JSON.stringify(updatedCustomers));
  }

  await saveCurrentCustomer(normalized);
}

export default function CustomerLoginScreen() {
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function findLocalCustomer(cleanLogin: string, cleanPassword: string) {
    const customers = await getLocalCustomers();

    return (
      customers.find((item) => {
        const emailMatch = normalize(item.email) === cleanLogin;
        const usernameMatch = normalize(item.username) === cleanLogin;

        const storedPassword = clean(item.password);
        const enteredPassword = clean(cleanPassword);

        const passwordMatch = storedPassword === enteredPassword;

        console.log("CUSTOMER LOGIN CHECK", {
          storedEmail: item.email,
          storedUsername: item.username,
          enteredLogin: cleanLogin,
          storedPassword,
          enteredPassword,
          emailMatch,
          usernameMatch,
          passwordMatch,
        });

        return (emailMatch || usernameMatch) && passwordMatch;
      }) || null
    );
  }

  async function findSupabaseCustomer(
    cleanLogin: string,
    cleanPassword: string
  ) {
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .or(`email.eq.${cleanLogin},username.eq.${cleanLogin}`)
        .maybeSingle();

      if (error) {
        console.log("Customer Supabase login skipped:", error.message);
        return null;
      }

      if (!data) return null;

      if (clean(data.password) !== cleanPassword) {
        return null;
      }

      return normalizeCustomer(data);
    } catch (error) {
      console.log("Customer Supabase login failed:", error);
      return null;
    }
  }

  async function loginCustomer() {
    const cleanLogin = normalize(emailOrUsername);
    const cleanPassword = clean(password);

    if (!cleanLogin || !cleanPassword) {
      Alert.alert(
        "Missing Login",
        "Please enter your email/username and password."
      );
      return;
    }

    try {
      setLoading(true);

      let customer = await findLocalCustomer(cleanLogin, cleanPassword);

      if (!customer) {
        customer = await findSupabaseCustomer(cleanLogin, cleanPassword);
      }

      if (!customer) {
        Alert.alert("Login Failed", "Invalid email/username or password.");
        return;
      }

      const normalizedCustomer = normalizeCustomer(customer);

      if (normalizedCustomer.accountActive === false) {
        Alert.alert("Account Disabled", "This customer account is not active.");
        return;
      }

      await syncCustomerToLocal(normalizedCustomer);

      router.replace("/customer/marketplace" as any);
    } catch (error: any) {
      console.log("Customer login error:", error);

      Alert.alert("Login Error", error?.message || "Unable to login.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.header}>Customer Login</Text>

      <Text style={styles.subheader}>
        Login to shop verified farmers and fresh Farm2Home products.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Email or Username"
        placeholderTextColor="#8A8F98"
        value={emailOrUsername}
        onChangeText={setEmailOrUsername}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#8A8F98"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
      />

      <TouchableOpacity
        style={[styles.loginButton, loading && styles.disabledButton]}
        onPress={loginCustomer}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.loginButtonText}>Login</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.linkButton}
        onPress={() => router.push("/customer/register" as any)}
      >
        <Text style={styles.linkText}>Need an account? Register</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.linkButton}
        onPress={() => router.push("/customer/password-recovery" as any)}
      >
        <Text style={styles.linkText}>Forgot password?</Text>
      </TouchableOpacity>
    </ScrollView>
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
    paddingBottom: 50,
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

  loginButton: {
    backgroundColor: farmTheme.colors.primary,
    padding: 18,
    borderRadius: 16,
    marginTop: 10,
    alignItems: "center",
  },

  disabledButton: {
    opacity: 0.6,
  },

  loginButtonText: {
    color: "#FFFFFF",
    textAlign: "center",
    fontWeight: "900",
    fontSize: 16,
  },

  linkButton: {
    marginTop: 16,
  },

  linkText: {
    textAlign: "center",
    color: farmTheme.colors.primary,
    fontWeight: "800",
  },
});