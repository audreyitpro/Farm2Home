// app/driver/login.tsx

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

function normalize(value: any) {
  return String(value || "").trim().toLowerCase();
}

function mapDriver(driver: any) {
  return {
    id: driver.id,
    driverId: driver.id,
    role: "driver",

    fullName:
      driver.full_name ||
      driver.fullName ||
      driver.name ||
      driver.driver_name ||
      "Farm2Home Driver",

    email: normalize(driver.email),
    username: driver.username || "",
    phone: driver.phone || "",

    accountActive: driver.account_active ?? driver.accountActive ?? true,

    membershipStatus:
      driver.membership_status || driver.membershipStatus || "Active",

    subscriptionStatus:
      driver.subscription_status || driver.subscriptionStatus || "active",

    approved: driver.approved ?? true,
    verified: driver.verified ?? true,

    expoPushToken: driver.expo_push_token || driver.expoPushToken || "",

    notificationsEnabled:
      driver.notifications_enabled ?? driver.notificationsEnabled ?? false,

    createdAt: driver.created_at || driver.createdAt || "",
    updatedAt: driver.updated_at || driver.updatedAt || new Date().toISOString(),
  };
}

function isDriverActive(driver: any) {
  if (driver.accountActive === false) return false;

  const membershipStatus = normalize(driver.membershipStatus);
  const subscriptionStatus = normalize(driver.subscriptionStatus);

  if (membershipStatus === "canceled") return false;
  if (subscriptionStatus === "canceled") return false;
  if (subscriptionStatus === "past_due") return false;
  if (subscriptionStatus === "unpaid") return false;

  return true;
}

export default function DriverLoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);

  const [resetVisible, setResetVisible] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  async function saveLoggedInDriver(driver: any) {
    const normalizedDriver = mapDriver(driver);

    await AsyncStorage.setItem("currentDriver", JSON.stringify(normalizedDriver));
    await AsyncStorage.setItem("currentUser", JSON.stringify(normalizedDriver));
    await AsyncStorage.setItem(
      "farm2homeCurrentDriver",
      JSON.stringify(normalizedDriver)
    );
    await AsyncStorage.setItem(
      "farm2homeDriverSession",
      JSON.stringify(normalizedDriver)
    );
    await AsyncStorage.setItem("userRole", "driver");
    await AsyncStorage.setItem("currentUserRole", "driver");

    return normalizedDriver;
  }

  async function handleLogin() {
    const cleanEmail = normalize(email);
    const cleanPassword = String(password || "").trim();

    if (!cleanEmail || !cleanPassword) {
      Alert.alert("Missing Information", "Enter email and password.");
      return;
    }

    if (!supabaseUrl || !supabaseAnonKey) {
      Alert.alert(
        "Configuration Missing",
        "Supabase environment keys are missing. Check EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY."
      );
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
        Alert.alert("Login Error", "Unable to confirm driver account.");
        return;
      }

      const { data: driver, error: driverError } = await supabase
        .from("drivers")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (driverError) {
        Alert.alert("Profile Error", driverError.message);
        return;
      }

      if (!driver) {
        Alert.alert(
          "Driver Profile Missing",
          "Your login exists, but your driver profile was not found. Please contact Farm2Home support."
        );
        return;
      }

      const normalizedDriver = await saveLoggedInDriver(driver);

      if (!isDriverActive(normalizedDriver)) {
        Alert.alert(
          "Account Disabled",
          "This driver account is disabled or subscription is not active."
        );
        return;
      }

      router.replace("/driver/mobile-driver-app" as any);
    } catch (error: any) {
      console.log("Driver login error:", error);
      Alert.alert("Login Error", error?.message || "Unable to login.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordReset() {
    const cleanEmail = normalize(resetEmail || email);

    if (!cleanEmail) {
      Alert.alert("Email Required", "Enter your driver email.");
      return;
    }

    if (!supabaseUrl || !supabaseAnonKey) {
      Alert.alert(
        "Configuration Missing",
        "Supabase environment keys are missing. Check EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY."
      );
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
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Ionicons name="car-outline" size={32} color="#FFFFFF" />
            </View>

            <Text style={styles.kicker}>Farm2Home Driver Portal</Text>
            <Text style={styles.title}>Driver Login</Text>
            <Text style={styles.subtitle}>
              Access delivery orders, routes, GPS tracking, proof of delivery,
              and earnings.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Welcome Back</Text>
            <Text style={styles.cardSubtitle}>
              Sign in with your approved driver account.
            </Text>

            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="driver@email.com"
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
              style={[styles.loginButton, loading && styles.disabledButton]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="log-in-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.loginButtonText}>Driver Login</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => {
                setResetEmail(email);
                setResetVisible(true);
              }}
              disabled={loading}
            >
              <Text style={styles.linkText}>Forgot Password?</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.registerButton}
              onPress={() => router.push("/driver/register" as any)}
              disabled={loading}
            >
              <Ionicons
                name="person-add-outline"
                size={18}
                color={freightTheme.colors.primary}
              />
              <Text style={styles.registerButtonText}>Register as Driver</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backHomeButton}
              onPress={() => router.replace("/" as any)}
              disabled={loading}
            >
              <Text style={styles.backHomeText}>Back To Home</Text>
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

              <Text style={styles.modalTitle}>Reset Driver Password</Text>

              <Text style={styles.modalSubtitle}>
                Enter your driver email. Farm2Home will send a secure reset link.
              </Text>

              <Text style={styles.inputLabelDark}>Driver Email</Text>
              <TextInput
                style={styles.input}
                placeholder="Driver Email"
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
                disabled={resetLoading}
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
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 80,
  },
  hero: {
    backgroundColor: "#020617",
    paddingTop: 26,
    paddingHorizontal: 20,
    paddingBottom: 28,
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
  },
  heroIcon: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#064E3B",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#10B981",
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
    fontSize: 36,
    fontWeight: "900",
    color: "#FFFFFF",
    marginTop: 6,
  },
  subtitle: {
    color: "#CBD5E1",
    fontWeight: "700",
    lineHeight: 23,
    marginTop: 8,
    maxWidth: 560,
  },
  card: {
    backgroundColor: freightTheme.colors.card,
    margin: 18,
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
  },
  cardTitle: {
    color: freightTheme.colors.text,
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center",
  },
  cardSubtitle: {
    textAlign: "center",
    color: freightTheme.colors.mutedText,
    lineHeight: 22,
    marginTop: 8,
    marginBottom: 22,
    fontWeight: "700",
  },
  inputLabel: {
    color: freightTheme.colors.text,
    fontWeight: "900",
    marginBottom: 7,
  },
  inputLabelDark: {
    color: "#111827",
    fontWeight: "900",
    marginBottom: 7,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    color: "#111827",
    fontWeight: "700",
  },
  loginButton: {
    backgroundColor: freightTheme.colors.primary,
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
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
  linkButton: {
    marginTop: 16,
  },
  linkText: {
    textAlign: "center",
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
  registerButtonText: {
    color: freightTheme.colors.primary,
    fontWeight: "900",
  },
  backHomeButton: {
    marginTop: 16,
    alignItems: "center",
  },
  backHomeText: {
    color: freightTheme.colors.mutedText,
    fontWeight: "900",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    padding: 20,
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
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 8,
    color: "#111827",
  },
  modalSubtitle: {
    textAlign: "center",
    color: "#64748B",
    lineHeight: 22,
    marginBottom: 18,
    fontWeight: "700",
  },
  closeButton: {
    marginTop: 18,
    alignItems: "center",
  },
  closeText: {
    color: "#B91C1C",
    fontWeight: "900",
  },
});