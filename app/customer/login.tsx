// app/customer/login.tsx

import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
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
import { Ionicons } from "@expo/vector-icons";

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
  red: "#DC2626",
};

function normalize(value: any) {
  return String(value || "").trim().toLowerCase();
}

function mapCustomer(customer: any) {
  return {
    id: customer.id,
    role: "customer",
    fullName: customer.full_name || customer.fullName || customer.name || "Customer",
    name: customer.full_name || customer.fullName || customer.name || "Customer",
    email: normalize(customer.email),
    phone: customer.phone || "",
    username: customer.username || "",
    accountActive: customer.account_active ?? customer.accountActive ?? true,
    customerMembershipPaid:
      customer.customer_membership_paid ?? customer.customerMembershipPaid ?? false,
    subscriptionStatus:
      customer.subscription_status || customer.subscriptionStatus || "pending",
    membershipStatus: customer.membership_status || customer.membershipStatus || "Pending",
    createdAt: customer.created_at || customer.createdAt || "",
    updatedAt: customer.updated_at || customer.updatedAt || new Date().toISOString(),
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
          "Your login exists, but your customer profile was not found."
        );
        return;
      }

      const mappedCustomer = await saveCurrentCustomer(customer);

      if (mappedCustomer.accountActive === false) {
        Alert.alert("Account Disabled", "This customer account is not active.");
        return;
      }

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

      Alert.alert("Password Reset Sent", "Check your email for the secure password reset link.");
      setResetVisible(false);
      setResetEmail("");
    } catch (error: any) {
      Alert.alert("Reset Error", error?.message || "Unable to send password reset email.");
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={ui.bg} />

      <ScrollView
        style={styles.page}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity style={styles.backButton} onPress={() => router.push("/")}>
          <Ionicons name="arrow-back-outline" size={18} color={ui.greenDark} />
          <Text style={styles.backText}>Back Home</Text>
        </TouchableOpacity>

        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <Ionicons name="basket-outline" size={30} color="#FFFFFF" />
          </View>

          <Text style={styles.header}>Customer Login</Text>

          <Text style={styles.subheader}>
            Login to shop verified farmers, fresh produce, local goods, and Farm2Home marketplace orders.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Welcome Back</Text>

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={ui.muted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={ui.muted}
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
              <>
                <Ionicons name="log-in-outline" size={20} color="#FFFFFF" />
                <Text style={styles.loginButtonText}>Login</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push("/customer/register" as any)}
          >
            <Text style={styles.secondaryText}>Create Customer Account</Text>
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
        </View>

        <Modal visible={resetVisible} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <ScrollView keyboardShouldPersistTaps="handled">
                <View style={styles.modalIcon}>
                  <Ionicons name="key-outline" size={28} color={ui.greenDark} />
                </View>

                <Text style={styles.modalTitle}>Reset Password</Text>

                <Text style={styles.modalSubtitle}>
                  Enter your customer email. Farm2Home will send a secure reset link.
                </Text>

                <TextInput
                  style={styles.input}
                  placeholder="Customer Email"
                  placeholderTextColor={ui.muted}
                  value={resetEmail}
                  onChangeText={setResetEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                />

                <TouchableOpacity
                  style={[styles.loginButton, resetLoading && styles.disabledButton]}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: ui.bg },
  page: { flex: 1, backgroundColor: ui.bg },
  content: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 60,
    justifyContent: "center",
  },
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
    fontSize: 32,
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
    padding: 18,
  },
  sectionTitle: {
    color: ui.text,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 14,
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
  loginButton: {
    backgroundColor: ui.green,
    padding: 17,
    borderRadius: 17,
    marginTop: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  disabledButton: { opacity: 0.6 },
  loginButtonText: {
    color: "#FFFFFF",
    textAlign: "center",
    fontWeight: "900",
    fontSize: 16,
  },
  secondaryButton: {
    backgroundColor: ui.greenSoft,
    borderRadius: 17,
    padding: 15,
    marginTop: 12,
    alignItems: "center",
  },
  secondaryText: {
    color: ui.greenDark,
    fontWeight: "900",
    fontSize: 15,
  },
  linkButton: { marginTop: 16 },
  linkText: {
    textAlign: "center",
    color: ui.greenDark,
    fontWeight: "900",
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
  modalIcon: {
    width: 56,
    height: 56,
    borderRadius: 20,
    backgroundColor: ui.greenSoft,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  modalTitle: {
    color: ui.text,
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 8,
  },
  modalSubtitle: {
    color: ui.muted,
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
    color: ui.red,
    fontWeight: "900",
  },
});