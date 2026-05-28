// app/freight/login.tsx

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

import freightTheme from "../styles/freightTheme";
import { registerFreightPushNotifications } from "../services/notificationService";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase: any = createClient(supabaseUrl, supabaseAnonKey);

type FreightUser = {
  id: string;
  role: "freight";
  companyName: string;
  email: string;
  username: string;
  accountActive: boolean;
  membershipStatus: string;
  subscriptionStatus?: string;
  approved?: boolean;
  verificationStatus?: string;
};

function clean(value: any) {
  return String(value || "").trim();
}

function normalize(value: any) {
  return clean(value).toLowerCase();
}

function mapCarrierToFreightUser(item: any): FreightUser {
  return {
    id: item.id || item.freight_id || `freight_${Date.now()}`,
    role: "freight",

    companyName:
      item.company_name ||
      item.companyName ||
      item.business_name ||
      item.businessName ||
      item.name ||
      "Freight Carrier",

    email: normalize(item.email),
    username: normalize(item.username),

    accountActive:
      item.account_active === undefined
        ? item.accountActive !== false
        : item.account_active !== false,

    membershipStatus:
      item.membership_status ||
      item.membershipStatus ||
      "Pending",

    subscriptionStatus:
      item.subscription_status ||
      item.subscriptionStatus ||
      "pending",

    approved:
      item.approved === true ||
      normalize(item.status) === "approved" ||
      normalize(item.verification_status) === "approved" ||
      normalize(item.verificationStatus) === "approved",

    verificationStatus:
      item.verification_status ||
      item.verificationStatus ||
      "PENDING_VERIFICATION",
  };
}

function isFreightActive(user: FreightUser) {
  if (user.accountActive === false) return false;

  const membershipStatus = normalize(user.membershipStatus);
  const subscriptionStatus = normalize(user.subscriptionStatus);

  if (membershipStatus === "canceled") return false;
  if (subscriptionStatus === "canceled") return false;
  if (subscriptionStatus === "past_due") return false;
  if (subscriptionStatus === "unpaid") return false;

  return true;
}

export default function FreightLoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loginLoading, setLoginLoading] = useState(false);

  const [resetVisible, setResetVisible] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  async function saveFreightSession(user: FreightUser) {
    const sessionUser = {
      ...user,
      role: "freight" as const,
      accountActive: user.accountActive !== false,
      membershipStatus: user.membershipStatus || "Pending",
      updatedAt: new Date().toISOString(),
    };

    await AsyncStorage.setItem("currentFreight", JSON.stringify(sessionUser));
    await AsyncStorage.setItem(
      "currentFreightCarrier",
      JSON.stringify(sessionUser)
    );
    await AsyncStorage.setItem("currentFreightUser", JSON.stringify(sessionUser));
    await AsyncStorage.setItem("currentUser", JSON.stringify(sessionUser));
    await AsyncStorage.setItem("userRole", "freight");
    await AsyncStorage.setItem("currentUserRole", "freight");

    return sessionUser;
  }

  async function registerFreightNotificationsSafely(userId: string) {
    try {
      if (!userId) return;

      const pushToken = await registerFreightPushNotifications(userId);
      console.log("Freight push token:", pushToken);
    } catch (error) {
      console.log("Freight push registration error:", error);
    }
  }

  async function handleLogin() {
    const cleanEmail = normalize(email);
    const cleanPassword = clean(password);

    if (!cleanEmail || !cleanPassword) {
      Alert.alert("Missing Information", "Enter email and password.");
      return;
    }

    try {
      setLoginLoading(true);

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
        Alert.alert("Login Error", "Unable to confirm freight account.");
        return;
      }

      const { data: freightUser, error: freightError } = await supabase
        .from("freight_users")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (freightError) {
        Alert.alert("Profile Error", freightError.message);
        return;
      }

      if (!freightUser) {
        Alert.alert(
          "Freight Profile Missing",
          "Your login exists, but your freight profile was not found. Please contact Farm2Home support."
        );
        return;
      }

      const mappedUser = mapCarrierToFreightUser(freightUser);

      if (!isFreightActive(mappedUser)) {
        Alert.alert("Account Not Active", "Your freight account is not active.");
        return;
      }

      await saveFreightSession(mappedUser);
      await registerFreightNotificationsSafely(userId);

      router.replace("/freight/dashboard" as any);
    } catch (error: any) {
      console.log("Freight login error:", error);
      Alert.alert("Login Error", error?.message || "Unable to login to freight account.");
    } finally {
      setLoginLoading(false);
    }
  }

  async function handlePasswordReset() {
    const cleanEmail = normalize(resetEmail || email);

    if (!cleanEmail) {
      Alert.alert("Email Required", "Enter your freight account email.");
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
    <View style={styles.container}>
      <View style={styles.loginCard}>
        <Text style={styles.title}>Freight Connect Login</Text>

        <Text style={styles.subtitle}>
          Access livestock and refrigerated fresh food freight loads.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={freightTheme.colors.mutedText}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={freightTheme.colors.mutedText}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity
          style={[styles.loginButton, loginLoading && styles.disabledButton]}
          onPress={handleLogin}
          disabled={loginLoading}
        >
          {loginLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.loginButtonText}>Login</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.forgotButton}
          onPress={() => {
            setResetEmail(email);
            setResetVisible(true);
          }}
        >
          <Text style={styles.forgotText}>Forgot Password?</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.registerButton}
          onPress={() => router.push("/freight/register" as any)}
        >
          <Text style={styles.registerText}>Register for Freight Connect</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={resetVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>Reset Freight Password</Text>

              <Text style={styles.modalSubtitle}>
                Enter your freight account email. Farm2Home will send a secure
                reset link.
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Freight Email"
                placeholderTextColor={freightTheme.colors.mutedText}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                value={resetEmail}
                onChangeText={setResetEmail}
              />

              <TouchableOpacity
                style={[styles.loginButton, resetLoading && styles.disabledButton]}
                onPress={handlePasswordReset}
                disabled={resetLoading}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: freightTheme.colors.background,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },

  loginCard: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: freightTheme.colors.card,
    borderRadius: 28,
    padding: 28,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
    ...freightTheme.shadow,
  },

  title: {
    color: freightTheme.colors.text,
    fontSize: 34,
    fontWeight: "900",
    textAlign: "center",
  },

  subtitle: {
    color: freightTheme.colors.mutedText,
    textAlign: "center",
    marginTop: 10,
    marginBottom: 28,
    lineHeight: 22,
    fontWeight: "700",
  },

  input: {
    backgroundColor: freightTheme.colors.surface,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    color: freightTheme.colors.text,
    fontWeight: "700",
    marginBottom: 16,
  },

  loginButton: {
    backgroundColor: freightTheme.colors.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 6,
  },

  disabledButton: {
    opacity: 0.6,
  },

  loginButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },

  forgotButton: {
    alignItems: "center",
    marginTop: 16,
  },

  forgotText: {
    color: freightTheme.colors.primary,
    fontWeight: "900",
  },

  registerButton: {
    alignItems: "center",
    marginTop: 18,
  },

  registerText: {
    color: freightTheme.colors.primary,
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

  modalTitle: {
    color: freightTheme.colors.text,
    fontSize: 26,
    fontWeight: "900",
    marginBottom: 8,
    textAlign: "center",
  },

  modalSubtitle: {
    color: freightTheme.colors.mutedText,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 18,
    fontWeight: "700",
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