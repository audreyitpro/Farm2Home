// app/admin/login.tsx

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

const ui = {
  bg: "#F8FAFC",
  dark: "#020617",
  card: "#FFFFFF",
  border: "#CBD5E1",
  text: "#0F172A",
  muted: "#64748B",
  soft: "#EFF6FF",
  primary: "#1D4ED8",
  primaryDark: "#1E3A8A",
  red: "#DC2626",
  green: "#16A34A",
};

function normalize(value: any) {
  return String(value || "").trim().toLowerCase();
}

function mapAdmin(profile: any) {
  return {
    id: profile.id,
    profileId: profile.id,
    authUserId: profile.auth_user_id || "",
    role: "admin",
    fullName: profile.full_name || profile.name || "Farm2Home Admin",
    email: normalize(profile.email),
    phone: profile.phone || "",
    accountActive: profile.account_active ?? true,
    createdAt: profile.created_at || "",
    updatedAt: new Date().toISOString(),
  };
}

export default function AdminLoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [resetVisible, setResetVisible] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  async function saveAdminSession(admin: any) {
    const mapped = mapAdmin(admin);

    await AsyncStorage.setItem("currentAdmin", JSON.stringify(mapped));
    await AsyncStorage.setItem("currentUser", JSON.stringify(mapped));
    await AsyncStorage.setItem("userRole", "admin");
    await AsyncStorage.setItem("currentUserRole", "admin");

    return mapped;
  }

  async function findAdminProfile(userId: string, cleanEmail: string) {
    let admin: any = null;

    const byAuth = await supabase
      .from("profiles")
      .select("*")
      .eq("auth_user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (byAuth.error) throw byAuth.error;
    if (byAuth.data) admin = byAuth.data;

    if (!admin && cleanEmail) {
      const byEmail = await supabase
        .from("profiles")
        .select("*")
        .eq("email", cleanEmail)
        .eq("role", "admin")
        .maybeSingle();

      if (byEmail.error) throw byEmail.error;
      if (byEmail.data) admin = byEmail.data;
    }

    return admin;
  }

  async function loginAdmin() {
    const cleanEmail = normalize(email);
    const cleanPassword = String(password || "").trim();

    if (!cleanEmail || !cleanPassword) {
      Alert.alert("Missing Login", "Enter admin email and password.");
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
        Alert.alert("Login Error", "Unable to confirm admin account.");
        return;
      }

      const adminProfile = await findAdminProfile(userId, cleanEmail);

      if (!adminProfile) {
        Alert.alert(
          "Admin Profile Missing",
          "Your email/password is valid, but no admin profile was found. Add this user to profiles with role = admin."
        );
        return;
      }

      const mappedAdmin = await saveAdminSession(adminProfile);

      if (mappedAdmin.accountActive === false) {
        Alert.alert("Account Disabled", "This admin account is disabled.");
        return;
      }

      router.replace("/admin/dashboard" as any);
    } catch (error: any) {
      console.log("Admin login error:", error);
      Alert.alert("Login Error", error?.message || "Unable to login.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordReset() {
    const cleanEmail = normalize(resetEmail || email);

    if (!cleanEmail) {
      Alert.alert("Email Required", "Enter your admin email.");
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
      <StatusBar barStyle="light-content" backgroundColor={ui.dark} />

      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.page}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.replace("/" as any)}
            activeOpacity={0.85}
          >
            <Ionicons name="arrow-back-outline" size={18} color="#DBEAFE" />
            <Text style={styles.backText}>Back Home</Text>
          </TouchableOpacity>

          <View style={styles.heroCard}>
            <View style={styles.heroIcon}>
              <Ionicons name="shield-checkmark-outline" size={34} color="#FFFFFF" />
            </View>

            <Text style={styles.kicker}>Farm2Home Control Center</Text>
            <Text style={styles.header}>Admin Login</Text>

            <Text style={styles.subheader}>
              Review farmer applications, documents, compliance status,
              approvals, marketplace activity, drivers, freight, and operations.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Secure Admin Access</Text>

            <Text style={styles.sectionSubtitle}>
              Use your Farm2Home admin email and password.
            </Text>

            <Text style={styles.label}>Admin Email</Text>
            <TextInput
              style={styles.input}
              placeholder="admin@email.com"
              placeholderTextColor={ui.muted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter password"
              placeholderTextColor={ui.muted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TouchableOpacity
              style={[styles.loginButton, loading && styles.disabledButton]}
              onPress={loginAdmin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="log-in-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.loginButtonText}>
                    Login to Admin Dashboard
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
              activeOpacity={0.85}
            >
              <Text style={styles.linkText}>Forgot password?</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Admin Requirements</Text>
            <Text style={styles.infoText}>
              This login requires a Supabase Auth account and a matching row in
              the profiles table with role set to admin.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={resetVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <View style={styles.modalIcon}>
                <Ionicons name="key-outline" size={28} color={ui.primary} />
              </View>

              <Text style={styles.modalTitle}>Reset Admin Password</Text>

              <Text style={styles.modalSubtitle}>
                Enter your admin email. Farm2Home will send a secure reset link
                if the Auth account exists.
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Admin Email"
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: ui.dark },
  keyboard: { flex: 1, backgroundColor: ui.bg },
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
    backgroundColor: "#1E293B",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginBottom: 14,
  },
  backText: { color: "#DBEAFE", fontWeight: "900" },
  heroCard: {
    backgroundColor: ui.dark,
    borderRadius: 30,
    padding: 22,
    marginBottom: 16,
  },
  heroIcon: {
    width: 62,
    height: 62,
    borderRadius: 22,
    backgroundColor: ui.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  kicker: {
    color: "#93C5FD",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  header: {
    fontSize: 34,
    fontWeight: "900",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  subheader: {
    color: "#CBD5E1",
    lineHeight: 22,
    fontWeight: "700",
    fontSize: 15,
  },
  card: {
    backgroundColor: ui.card,
    borderWidth: 1,
    borderColor: ui.border,
    borderRadius: 26,
    padding: 20,
  },
  sectionTitle: {
    color: ui.text,
    fontSize: 25,
    fontWeight: "900",
    textAlign: "center",
  },
  sectionSubtitle: {
    color: ui.muted,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 21,
    marginTop: 7,
    marginBottom: 18,
  },
  label: {
    color: ui.text,
    fontWeight: "900",
    fontSize: 13,
    marginBottom: 7,
    marginTop: 6,
  },
  input: {
    backgroundColor: ui.soft,
    borderWidth: 1,
    borderColor: ui.border,
    borderRadius: 17,
    padding: 15,
    marginBottom: 12,
    color: ui.text,
    fontWeight: "800",
  },
  loginButton: {
    backgroundColor: ui.primary,
    padding: 17,
    borderRadius: 18,
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
  linkButton: { marginTop: 16 },
  linkText: {
    textAlign: "center",
    color: ui.primaryDark,
    fontWeight: "900",
  },
  infoCard: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 22,
    padding: 16,
    marginTop: 16,
  },
  infoTitle: {
    color: ui.primaryDark,
    fontWeight: "900",
    marginBottom: 6,
  },
  infoText: {
    color: "#1E40AF",
    fontWeight: "700",
    lineHeight: 21,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: 22,
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    padding: 22,
    maxHeight: "90%",
  },
  modalIcon: {
    width: 56,
    height: 56,
    borderRadius: 20,
    backgroundColor: "#DBEAFE",
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