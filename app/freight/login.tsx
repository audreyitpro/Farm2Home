// app/freight/login.tsx

import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
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
import { createClient } from "@supabase/supabase-js";
import { Ionicons } from "@expo/vector-icons";

import freightTheme from "../styles/freightTheme";

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
      item.membership_status || item.membershipStatus || "Pending",

    subscriptionStatus:
      item.subscription_status || item.subscriptionStatus || "pending",

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

      router.replace("/freight/dashboard" as any);
    } catch (error: any) {
      console.log("Freight login error:", error);
      Alert.alert(
        "Login Error",
        error?.message || "Unable to login to freight account."
      );
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
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#020617" />

      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Ionicons name="trail-sign-outline" size={34} color="#FFFFFF" />
            </View>

            <Text style={styles.kicker}>Farm2Home Freight Connect</Text>
            <Text style={styles.title}>Freight Login</Text>
            <Text style={styles.subtitle}>
              Access livestock, refrigerated fresh food freight loads, carrier
              routes, live tracking, and earnings.
            </Text>
          </View>

          <View style={styles.loginCard}>
            <Text style={styles.cardTitle}>Carrier Access</Text>
            <Text style={styles.cardSubtitle}>
              Sign in with your approved Freight Connect account.
            </Text>

            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="carrier@email.com"
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />

            <Text style={styles.inputLabel}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#94A3B8"
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
                <>
                  <Ionicons name="log-in-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.loginButtonText}>Login</Text>
                </>
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

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.registerButton}
              onPress={() => router.push("/freight/register" as any)}
            >
              <Ionicons
                name="business-outline"
                size={18}
                color={freightTheme.colors.primary}
              />
              <Text style={styles.registerText}>Register for Freight Connect</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.homeButton}
              onPress={() => router.replace("/" as any)}
            >
              <Text style={styles.homeText}>Back To Home</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={resetVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <View style={styles.modalIcon}>
                <Ionicons name="key-outline" size={28} color="#FFFFFF" />
              </View>

              <Text style={styles.modalTitle}>Reset Freight Password</Text>

              <Text style={styles.modalSubtitle}>
                Enter your freight account email. Farm2Home will send a secure
                reset link.
              </Text>

              <Text style={styles.modalInputLabel}>Freight Email</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Freight Email"
                placeholderTextColor="#94A3B8"
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
                  <>
                    <Ionicons name="mail-outline" size={18} color="#FFFFFF" />
                    <Text style={styles.loginButtonText}>Send Reset Link</Text>
                  </>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: freightTheme.colors.background,
  },
  keyboard: {
    flex: 1,
    backgroundColor: freightTheme.colors.background,
  },
  content: {
    flexGrow: 1,
    paddingBottom: 90,
  },
  hero: {
    backgroundColor: "#020617",
    paddingTop: 28,
    paddingHorizontal: 20,
    paddingBottom: 30,
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#064E3B",
    borderWidth: 1,
    borderColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
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
    color: "#FFFFFF",
    fontSize: 36,
    fontWeight: "900",
    marginTop: 6,
  },
  subtitle: {
    color: "#CBD5E1",
    marginTop: 8,
    lineHeight: 23,
    fontWeight: "700",
    maxWidth: 620,
  },
  loginCard: {
    width: "auto",
    backgroundColor: freightTheme.colors.card,
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
    margin: 18,
  },
  cardTitle: {
    color: freightTheme.colors.text,
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center",
  },
  cardSubtitle: {
    color: freightTheme.colors.mutedText,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 22,
    lineHeight: 22,
    fontWeight: "700",
  },
  inputLabel: {
    color: freightTheme.colors.text,
    fontWeight: "900",
    marginBottom: 7,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
    color: "#111827",
    fontWeight: "700",
    marginBottom: 14,
  },
  loginButton: {
    backgroundColor: freightTheme.colors.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
    flexDirection: "row",
    gap: 8,
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
  divider: {
    height: 1,
    backgroundColor: freightTheme.colors.border,
    marginVertical: 18,
  },
  registerButton: {
    backgroundColor: freightTheme.colors.surface,
    borderWidth: 1,
    borderColor: freightTheme.colors.primary,
    borderRadius: 16,
    padding: 15,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  registerText: {
    color: freightTheme.colors.primary,
    fontWeight: "900",
  },
  homeButton: {
    alignItems: "center",
    marginTop: 16,
  },
  homeText: {
    color: freightTheme.colors.mutedText,
    fontWeight: "900",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
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
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: freightTheme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 14,
  },
  modalTitle: {
    color: "#111827",
    fontSize: 26,
    fontWeight: "900",
    marginBottom: 8,
    textAlign: "center",
  },
  modalSubtitle: {
    color: "#64748B",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 18,
    fontWeight: "700",
  },
  modalInputLabel: {
    color: "#111827",
    fontWeight: "900",
    marginBottom: 7,
  },
  modalInput: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
    color: "#111827",
    fontWeight: "700",
    marginBottom: 14,
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