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

import farmTheme from "../styles/farmTheme";

type CustomerAccount = {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  username?: string;
  password?: string;
  accountActive?: boolean;
  membershipStatus?: "Pending" | "Active";
  createdAt?: string;
  updatedAt?: string;
};

function safelyParseArray(rawValue: string | null): CustomerAccount[] {
  if (!rawValue) return [];

  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function CustomerLoginScreen() {
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function loginCustomer() {
    const cleanLogin = emailOrUsername.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanLogin || !cleanPassword) {
      Alert.alert(
        "Missing Login",
        "Please enter your email/username and password."
      );
      return;
    }

    try {
      setLoading(true);

      const savedCustomers = await AsyncStorage.getItem(
        "farm2homeCustomers"
      );

      const customers = safelyParseArray(savedCustomers);

      const customer = customers.find((item) => {
        const emailMatch =
          item.email?.toLowerCase() === cleanLogin;

        const usernameMatch =
          item.username?.toLowerCase() === cleanLogin;

        const passwordMatch =
          item.password === cleanPassword;

        return (emailMatch || usernameMatch) && passwordMatch;
      });

      if (!customer) {
        Alert.alert(
          "Login Failed",
          "Invalid email/username or password."
        );
        return;
      }

      if (customer.accountActive === false) {
        Alert.alert(
          "Account Disabled",
          "This customer account is not active."
        );
        return;
      }

      await AsyncStorage.setItem(
        "currentCustomer",
        JSON.stringify(customer)
      );

      await AsyncStorage.setItem(
        "userRole",
        "customer"
      );

      router.replace("/customer/marketplace" as any);
    } catch (error: any) {
      console.log("Customer login error:", error);

      Alert.alert(
        "Login Error",
        error?.message || "Unable to login."
      );
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
      <Text style={styles.header}>
        Customer Login
      </Text>

      <Text style={styles.subheader}>
        Login to shop verified farmers and
        fresh Farm2Home products.
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
      />

      <TouchableOpacity
        style={[
          styles.loginButton,
          loading && styles.disabledButton,
        ]}
        onPress={loginCustomer}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.loginButtonText}>
            Login
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.linkButton}
        onPress={() =>
          router.push("/customer/register" as any)
        }
      >
        <Text style={styles.linkText}>
          Need an account? Register
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.linkButton}
        onPress={() =>
          router.push(
            "/customer/password-recovery" as any
          )
        }
      >
        <Text style={styles.linkText}>
          Forgot password?
        </Text>
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