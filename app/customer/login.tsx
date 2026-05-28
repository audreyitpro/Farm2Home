// app/customer/login.tsx

import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { createClient } from "@supabase/supabase-js";

import farmTheme from "../styles/farmTheme";
import { registerForPushNotificationsAsync } from "../services/notificationService";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase: any = createClient(supabaseUrl, supabaseAnonKey);

function normalize(value: any) {
  return String(value || "").trim().toLowerCase();
}

function mapCustomer(customer: any) {
  return {
    id: customer.id,
    role: "customer",
    fullName:
      customer.full_name ||
      customer.fullName ||
      customer.name ||
      "Customer",
    name:
      customer.full_name ||
      customer.fullName ||
      customer.name ||
      "Customer",
    email: normalize(customer.email),
    phone: customer.phone || "",
    username: customer.username || "",
    accountActive:
      customer.account_active ?? customer.accountActive ?? true,
    customerMembershipPaid:
      customer.customer_membership_paid ??
      customer.customerMembershipPaid ??
      false,
    subscriptionStatus:
      customer.subscription_status ||
      customer.subscriptionStatus ||
      "pending",
    membershipStatus:
      customer.membership_status ||
      customer.membershipStatus ||
      "Pending",
    createdAt: customer.created_at || customer.createdAt || "",
    updatedAt:
      customer.updated_at ||
      customer.updatedAt ||
      new Date().toISOString(),
  };
}

export default function CustomerLoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [resetVisible, setResetVisible] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  async function saveCurrentCustomer(customer: any) {
    const mapped = mapCustomer(customer);

    await AsyncStorage.setItem("currentCustomer", JSON.stringify(mapped));
    await AsyncStorage.setItem("currentUser", JSON.stringify(mapped));
    await AsyncStorage.setItem("userRole", "customer");
    await AsyncStorage.setItem("currentUserRole", "customer");

    return mapped;
  }

  async function loginCustomer() {
    const cleanEmail = normalize(email);
    const cleanPassword = String(password || "").trim();

    if (!cleanEmail || !cleanPassword) {
      Alert.alert("Missing Login", "Please enter your email and password.");
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword,
      });

      if (error) {
        Alert.alert("Login Failed", error.message);
        return;
      }

      const userId = data?.user?.id;

      if (!userId) {
        Alert.alert("Login Error", "Unable to confirm customer account.");
        return;
      }

      const { data: customer, error: customerError } = await supabase
        .from("customers")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (customerError) {
        Alert.alert("Profile Error", customerError.message);
        return;
      }

      if (!customer) {
        Alert.alert(
          "Customer Profile Missing",
          "Your login exists, but your customer profile was not found. Please contact Farm2Home support."
        );
        return;
      }

      const mappedCustomer = await saveCurrentCustomer(customer);

      if (mappedCustomer.accountActive === false) {
        Alert.alert("Account Disabled", "This customer account is not active.");
        return;
      }

      await registerForPushNotificationsAsync(userId, "customer");

      router.replace("/customer/marketplace" as any);
    } catch (error: any) {
      console.log("Customer login error:", error);
      Alert.alert("Login Error", error?.message || "Unable to login.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordReset() {
    const cleanEmail = normalize(resetEmail || email);

    if (!cleanEmail) {
      Alert.alert("Email Required", "Enter your customer email.");
      return;
    }

    try {
      setResetLoading(true);

      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: "farm2home://reset-password",
      });

      if (error) {
        Alert.alert("Reset Error", error.message);
        return;
      }

      Alert.alert(
        "Password Reset Sent",
        "Check your email for the secure password reset link."
      );

      setResetVisible(false);
      setResetEmail("");
    } catch (error: any) {
      Alert.alert(
        "Reset Error",
        error?.message || "Unable to send password reset email."
      );
    } finally {
      setResetLoading(false);
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
        placeholder="Email"
        placeholderTextColor="#8A8F98"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
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
        onPress={() => {
          setResetEmail(email);
          setResetVisible(true);
        }}
      >
        <Text style={styles.linkText}>Forgot password?</Text>
      </TouchableOpacity>

      <Modal visible={resetVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>Reset Password</Text>

              <Text style={styles.modalSubtitle}>
                Enter your customer email. Farm2Home will send a secure reset
                link.
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Customer Email"
                placeholderTextColor="#8A8F98"
                value={resetEmail}
                onChangeText={setResetEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
              />

              <TouchableOpacity
                style={[
                  styles.loginButton,
                  resetLoading && styles.disabledButton,
                ]}
                onPress={handlePasswordReset}
                disabled={resetLoading}
                activeOpacity={0.85}
              >
                {resetLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.loginButtonText}>Send Reset Link</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setResetVisible(false);
                  setResetEmail("");
                }}
              >
                <Text style={styles.closeText}>Close</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
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

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: 22,
  },

  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 22,
    maxHeight: "90%",
  },

  modalTitle: {
    color: farmTheme.colors.primary,
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 8,
  },

  modalSubtitle: {
    color: farmTheme.colors.mutedText,
    fontWeight: "700",
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 18,
  },

  closeButton: {
    marginTop: 16,
    alignItems: "center",
  },

  closeText: {
    color: "#B91C1C",
    fontWeight: "900",
  },
});