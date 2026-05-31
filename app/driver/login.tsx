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
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../services/supabaseClient";
import freightTheme from "../styles/freightTheme";

function normalize(value: any) {
  return String(value || "").trim().toLowerCase();
}

function mapDriver(driver: any, profile?: any) {
  const id = driver?.id || profile?.auth_user_id || "";

  return {
    id,
    driverId: id,
    profileId: driver?.profile_id || profile?.id || "",
    profile_id: driver?.profile_id || profile?.id || "",
    authUserId: driver?.auth_user_id || profile?.auth_user_id || id,
    role: "driver",

    fullName:
      driver?.full_name ||
      driver?.fullName ||
      driver?.name ||
      driver?.driver_name ||
      profile?.full_name ||
      profile?.name ||
      "Farm2Home Driver",

    name:
      driver?.name ||
      driver?.full_name ||
      profile?.full_name ||
      "Farm2Home Driver",

    email: normalize(driver?.email || driver?.driver_email || profile?.email),
    username: driver?.username || profile?.username || "",
    phone: driver?.phone || profile?.phone || "",

    vehicleType: driver?.vehicle_type || driver?.vehicleType || "",
    licenseNumber: driver?.license_number || driver?.licenseNumber || "",
    serviceArea: driver?.service_area || driver?.serviceArea || "",

    accountActive: driver?.account_active ?? profile?.account_active ?? true,

    membershipStatus:
      driver?.membership_status || driver?.membershipStatus || "Active",

    subscriptionStatus:
      driver?.subscription_status || driver?.subscriptionStatus || "active",

    approved: driver?.approved ?? true,
    verified: driver?.verified ?? true,

    expoPushToken: driver?.expo_push_token || driver?.expoPushToken || "",

    notificationsEnabled:
      driver?.notifications_enabled ?? driver?.notificationsEnabled ?? false,

    createdAt: driver?.created_at || driver?.createdAt || profile?.created_at || "",
    updatedAt:
      driver?.updated_at || driver?.updatedAt || new Date().toISOString(),
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
    await AsyncStorage.setItem("currentDriver", JSON.stringify(driver));
    await AsyncStorage.setItem("currentUser", JSON.stringify(driver));
    await AsyncStorage.setItem("farm2homeCurrentDriver", JSON.stringify(driver));
    await AsyncStorage.setItem("farm2homeDriverSession", JSON.stringify(driver));
    await AsyncStorage.setItem("userRole", "driver");
    await AsyncStorage.setItem("currentUserRole", "driver");

    return driver;
  }

  async function findProfile(userId: string, cleanEmail: string) {
    if (userId) {
      const byAuth = await supabase
        .from("profiles")
        .select("*")
        .eq("auth_user_id", userId)
        .eq("role", "driver")
        .maybeSingle();

      if (!byAuth.error && byAuth.data) return byAuth.data;
    }

    if (cleanEmail) {
      const byEmail = await supabase
        .from("profiles")
        .select("*")
        .eq("email", cleanEmail)
        .eq("role", "driver")
        .maybeSingle();

      if (!byEmail.error && byEmail.data) return byEmail.data;
    }

    return null;
  }

  async function findDriverProfile(userId: string, cleanEmail: string) {
    let driver: any = null;
    let profile: any = null;

    if (userId) {
      const byId = await supabase
        .from("drivers")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (!byId.error && byId.data) driver = byId.data;
    }

    if (!driver && cleanEmail) {
      const byEmail = await supabase
        .from("drivers")
        .select("*")
        .eq("email", cleanEmail)
        .maybeSingle();

      if (!byEmail.error && byEmail.data) driver = byEmail.data;
    }

    if (!driver && cleanEmail) {
      const byDriverEmail = await supabase
        .from("drivers")
        .select("*")
        .eq("driver_email", cleanEmail)
        .maybeSingle();

      if (!byDriverEmail.error && byDriverEmail.data) {
        driver = byDriverEmail.data;
      }
    }

    profile = await findProfile(userId, cleanEmail);

    if (!driver && profile?.id) {
      const byProfile = await supabase
        .from("drivers")
        .select("*")
        .eq("profile_id", profile.id)
        .maybeSingle();

      if (!byProfile.error && byProfile.data) driver = byProfile.data;
    }

    if (!driver && profile) {
      driver = {
        id: userId || profile.auth_user_id || profile.id,
        auth_user_id: userId || profile.auth_user_id || "",
        profile_id: profile.id,
        role: "driver",
        full_name: profile.full_name || profile.name || "Farm2Home Driver",
        name: profile.full_name || profile.name || "Farm2Home Driver",
        email: profile.email || cleanEmail,
        phone: profile.phone || "",
        username: profile.username || "",
        account_active: profile.account_active ?? true,
        membership_status: "Active",
        subscription_status: "active",
        approved: true,
        verified: true,
      };
    }

    if (!driver) return null;

    return mapDriver(driver, profile);
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

      const userId = data?.user?.id || "";

      if (!userId) {
        Alert.alert("Login Error", "Unable to confirm driver account.");
        return;
      }

      const normalizedDriver = await findDriverProfile(userId, cleanEmail);

      if (!normalizedDriver) {
        Alert.alert(
          "Driver Profile Missing",
          "Your email/password is valid, but no driver profile row was found. Complete driver registration or contact Farm2Home support."
        );
        router.replace("/driver/register" as any);
        return;
      }

      if (!isDriverActive(normalizedDriver)) {
        Alert.alert(
          "Account Disabled",
          "This driver account is disabled or subscription is not active."
        );
        return;
      }

      await saveLoggedInDriver(normalizedDriver);

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
            <View style={styles.heroTop}>
              <View style={styles.heroIcon}>
                <Ionicons name="car-outline" size={32} color="#FFFFFF" />
              </View>

              <TouchableOpacity
                style={styles.homeChip}
                onPress={() => router.replace("/" as any)}
              >
                <Ionicons name="home-outline" size={15} color="#CBD5E1" />
                <Text style={styles.homeChipText}>Home</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.kicker}>Farm2Home Driver Portal</Text>
            <Text style={styles.title}>Driver Login</Text>
            <Text style={styles.subtitle}>
              Access delivery orders, routes, GPS tracking, proof of delivery,
              customer drop-offs, and driver earnings.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Driver Access</Text>
            <Text style={styles.cardSubtitle}>
              Sign in with the email and password used during driver
              registration.
            </Text>

            <Text style={styles.inputLabel}>Email Address</Text>
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
              placeholder="Enter password"
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
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="log-in-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.loginButtonText}>
                    Login to Driver Portal
                  </Text>
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
              activeOpacity={0.85}
            >
              <Text style={styles.linkText}>Forgot Password?</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.registerButton}
              onPress={() => router.push("/driver/register" as any)}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Ionicons
                name="person-add-outline"
                size={18}
                color={freightTheme.colors.primary}
              />
              <Text style={styles.registerButtonText}>Register as Driver</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Driver Board Access</Text>
            <Text style={styles.infoText}>
              Drivers can view local delivery opportunities, accept open orders,
              track routes, and support Farm2Home farmers and customers.
            </Text>
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
                Enter your driver email. Farm2Home will send a secure reset link
                if the Auth account exists.
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
                activeOpacity={0.85}
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
  safe: { flex: 1, backgroundColor: freightTheme.colors.background },
  keyboard: { flex: 1, backgroundColor: freightTheme.colors.background },
  scrollContent: { flexGrow: 1, paddingBottom: 80 },
  hero: {
    backgroundColor: "#020617",
    paddingTop: 26,
    paddingHorizontal: 20,
    paddingBottom: 28,
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
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
  },
  homeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "#334155",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
  },
  homeChipText: {
    color: "#CBD5E1",
    fontWeight: "900",
    fontSize: 12,
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
    maxWidth: 600,
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
    fontSize: 27,
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
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 15,
    marginBottom: 14,
    color: "#111827",
    fontWeight: "800",
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
  disabledButton: { opacity: 0.6 },
  loginButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },
  linkButton: { marginTop: 16 },
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
  infoCard: {
    marginHorizontal: 18,
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "#1E293B",
    borderRadius: 22,
    padding: 16,
  },
  infoTitle: {
    color: "#10B981",
    fontWeight: "900",
    marginBottom: 6,
  },
  infoText: {
    color: "#CBD5E1",
    fontWeight: "700",
    lineHeight: 21,
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
  closeButton: { marginTop: 18, alignItems: "center" },
  closeText: { color: "#B91C1C", fontWeight: "900" },
});