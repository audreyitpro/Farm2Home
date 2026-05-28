// app/driver/login.tsx

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
import { registerDriverPushNotifications } from "../services/notificationService";

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

    accountActive:
      driver.account_active ?? driver.accountActive ?? true,

    membershipStatus:
      driver.membership_status ||
      driver.membershipStatus ||
      "Active",

    subscriptionStatus:
      driver.subscription_status ||
      driver.subscriptionStatus ||
      "active",

    approved: driver.approved ?? true,
    verified: driver.verified ?? true,

    expoPushToken:
      driver.expo_push_token || driver.expoPushToken || "",

    notificationsEnabled:
      driver.notifications_enabled ??
      driver.notificationsEnabled ??
      false,

    createdAt: driver.created_at || driver.createdAt || "",
    updatedAt:
      driver.updated_at ||
      driver.updatedAt ||
      new Date().toISOString(),
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

    await AsyncStorage.setItem(
      "currentDriver",
      JSON.stringify(normalizedDriver)
    );
    await AsyncStorage.setItem(
      "currentUser",
      JSON.stringify(normalizedDriver)
    );
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

      try {
        const token = await registerDriverPushNotifications(userId);
        console.log("Driver push token:", token);
      } catch (pushError) {
        console.log("Driver push registration error:", pushError);
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
      <View style={styles.card}>
        <Text style={styles.title}>Driver Login</Text>

        <Text style={styles.subtitle}>
          Access Farm2Home delivery orders, routes, proof of delivery, and
          earnings.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#8A8F98"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#8A8F98"
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
            <Text style={styles.loginButtonText}>Driver Login</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => {
            setResetEmail(email);
            setResetVisible(true);
          }}
        >
          <Text style={styles.linkText}>Forgot Password?</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => router.push("/driver/register" as any)}
        >
          <Text style={styles.linkText}>Register as Driver</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={resetVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>Reset Driver Password</Text>

              <Text style={styles.modalSubtitle}>
                Enter your driver email. Farm2Home will send a secure reset
                link.
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Driver Email"
                placeholderTextColor="#8A8F98"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                value={resetEmail}
                onChangeText={setResetEmail}
              />

              <TouchableOpacity
                style={[
                  styles.loginButton,
                  resetLoading && styles.disabledButton,
                ]}
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

  card: {
    width: "100%",
    maxWidth: 500,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
  },

  title: {
    fontSize: 32,
    fontWeight: "900",
    color: freightTheme.colors.primary,
    textAlign: "center",
    marginBottom: 10,
  },

  subtitle: {
    textAlign: "center",
    color: freightTheme.colors.mutedText,
    lineHeight: 22,
    marginBottom: 22,
    fontWeight: "700",
  },

  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDDDDD",
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    color: "#111827",
    fontWeight: "700",
  },

  loginButton: {
    backgroundColor: "#EA580C",
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
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
    color: "#EA580C",
    fontWeight: "900",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: 20,
  },

  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 22,
    maxHeight: "90%",
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
    color: freightTheme.colors.mutedText,
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