// app/admin/login.tsx

import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
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

import { supabase } from "../data/supabaseClient";

const COLORS = {
  bg: "#F6F7FB",
  card: "#FFFFFF",
  surface: "#F8FAFC",
  black: "#020617",
  primary: "#635BFF",
  primaryDark: "#4638D8",
  text: "#101828",
  muted: "#667085",
  border: "#E5E7EB",
  green: "#10B981",
  white: "#FFFFFF",
};

type AdminRow = {
  id: string;
  email?: string | null;
  username?: string | null;
  password?: string | null;
  full_name?: string | null;
  role?: string | null;
  is_active?: boolean | null;
  super_admin?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function clean(value: any) {
  return String(value ?? "").trim();
}

function normalize(value: any) {
  return clean(value).toLowerCase();
}

function buildAdminSession(admin: AdminRow) {
  return {
    ...admin,
    id: clean(admin.id),
    profileId: clean(admin.id),
    profile_id: clean(admin.id),
    role: "admin",
    adminRole: clean(admin.role || "admin"),
    admin_role: clean(admin.role || "admin"),
    fullName: clean(admin.full_name || admin.username || "Farm2Home Admin"),
    full_name: clean(admin.full_name || admin.username || "Farm2Home Admin"),
    email: normalize(admin.email),
    username: normalize(admin.username),
    isActive: admin.is_active !== false,
    is_active: admin.is_active !== false,
    superAdmin: Boolean(admin.super_admin),
    super_admin: Boolean(admin.super_admin),
    createdAt: admin.created_at || "",
    created_at: admin.created_at || "",
    updatedAt: admin.updated_at || new Date().toISOString(),
    updated_at: admin.updated_at || new Date().toISOString(),
  };
}

export default function AdminLoginScreen() {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [securePassword, setSecurePassword] = useState(true);
  const [loading, setLoading] = useState(false);

  async function findAdminAccount(loginValue: string): Promise<AdminRow | null> {
    const value = normalize(loginValue);

    const { data, error } = await supabase
      .from("admins")
      .select("*")
      .or(`email.eq.${value},username.eq.${value}`)
      .limit(1);

    if (error) {
      console.log("admins lookup error:", error.message);
      throw error;
    }

    if (Array.isArray(data) && data.length > 0) {
      return data[0] as AdminRow;
    }

    return null;
  }

  async function saveAdminSession(admin: AdminRow) {
    const mapped = buildAdminSession(admin);

    await AsyncStorage.multiRemove([
      "currentCustomer",
      "pendingCustomer",
      "farm2homeCurrentCustomer",
      "currentFarmer",
      "farm2homeCurrentFarmer",
      "farm2homeFarmerSession",
      "currentDriver",
      "currentFreight",
    ]);

    await AsyncStorage.multiSet([
      ["currentAdmin", JSON.stringify(mapped)],
      ["currentUser", JSON.stringify(mapped)],
      ["userRole", "admin"],
      ["currentUserRole", "admin"],
      ["lastLoginRole", "admin"],
    ]);

    return mapped;
  }

  async function loginAdmin() {
    const loginValue = normalize(login);
    const passwordValue = clean(password);

    if (!loginValue || !passwordValue) {
      Alert.alert("Missing Login", "Enter admin email/username and password.");
      return;
    }

    try {
      setLoading(true);

      const admin = await findAdminAccount(loginValue);

      if (!admin) {
        Alert.alert(
          "Admin Not Found",
          "No matching record was found in the admins table."
        );
        return;
      }

      if (admin.is_active === false) {
        Alert.alert("Account Disabled", "This admin account is not active.");
        return;
      }

      if (clean(admin.password) !== passwordValue) {
        Alert.alert("Invalid Password", "Password does not match the admins table.");
        return;
      }

      await saveAdminSession(admin);

      router.replace("/admin/dashboard" as any);
    } catch (error: any) {
      console.log("Admin login error:", error);
      Alert.alert("Login Error", error?.message || "Unable to login admin.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />

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
          <View style={styles.hero}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.replace("/" as any)}
            >
              <Ionicons name="arrow-back-outline" size={18} color={COLORS.white} />
              <Text style={styles.backText}>Back Home</Text>
            </TouchableOpacity>

            <View style={styles.heroIcon}>
              <Ionicons name="shield-checkmark-outline" size={34} color={COLORS.white} />
            </View>

            <Text style={styles.kicker}>Farm2Home Control Center</Text>
            <Text style={styles.title}>Admin Login</Text>
            <Text style={styles.subtitle}>
              This login checks the Supabase admins table directly. It does not use
              customer, driver, farmer, or Supabase Auth login.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Secure Admin Portal</Text>
            <Text style={styles.sectionSubtitle}>
              Enter the admin username/email and password saved in the admins table.
            </Text>

            <Text style={styles.label}>Admin Email or Username</Text>
            <View style={styles.inputShell}>
              <Ionicons name="person-outline" size={19} color={COLORS.muted} />
              <TextInput
                style={styles.input}
                placeholder="admin@email.com or admin username"
                placeholderTextColor="#94A3B8"
                value={login}
                onChangeText={(value) => setLogin(normalize(value))}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <Text style={styles.label}>Password</Text>
            <View style={styles.inputShell}>
              <Ionicons name="key-outline" size={19} color={COLORS.muted} />
              <TextInput
                style={styles.input}
                placeholder="Enter password"
                placeholderTextColor="#94A3B8"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={securePassword}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <TouchableOpacity onPress={() => setSecurePassword((prev) => !prev)}>
                <Ionicons
                  name={securePassword ? "eye-outline" : "eye-off-outline"}
                  size={20}
                  color={COLORS.primaryDark}
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.loginButton, loading && styles.disabledButton]}
              onPress={loginAdmin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <>
                  <Ionicons name="log-in-outline" size={20} color={COLORS.white} />
                  <Text style={styles.loginButtonText}>Login to Admin Dashboard</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.infoCard}>
            <Ionicons name="server-outline" size={22} color={COLORS.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.infoTitle}>Admins Table Lookup</Text>
              <Text style={styles.infoText}>
                Reads from admins where email or username matches. Required columns:
                id, email, username, password, full_name, role, is_active, super_admin.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  keyboard: { flex: 1, backgroundColor: COLORS.bg },
  page: { flex: 1, backgroundColor: COLORS.bg },
  content: {
    flexGrow: 1,
    paddingBottom: 70,
  },
  hero: {
    backgroundColor: COLORS.black,
    paddingTop: 22,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  backButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginBottom: 18,
  },
  backText: { color: COLORS.white, fontWeight: "900" },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  kicker: {
    color: "#A5B4FC",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "900",
    color: COLORS.white,
    marginTop: 6,
  },
  subtitle: {
    color: "#CBD5E1",
    lineHeight: 22,
    fontWeight: "700",
    fontSize: 15,
    marginTop: 8,
  },
  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 26,
    padding: 20,
    marginHorizontal: 18,
    marginTop: 18,
    marginBottom: 16,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
  },
  sectionSubtitle: {
    color: COLORS.muted,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 21,
    marginTop: 7,
    marginBottom: 18,
  },
  label: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 13,
    marginBottom: 7,
    marginTop: 6,
  },
  inputShell: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 17,
    paddingHorizontal: 13,
    minHeight: 56,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  input: {
    flex: 1,
    minHeight: 54,
    color: COLORS.text,
    fontWeight: "800",
  },
  loginButton: {
    backgroundColor: COLORS.primary,
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
    color: COLORS.white,
    textAlign: "center",
    fontWeight: "900",
    fontSize: 16,
  },
  infoCard: {
    backgroundColor: "#EEF2FF",
    borderWidth: 1,
    borderColor: "#C7D2FE",
    borderRadius: 22,
    padding: 16,
    marginHorizontal: 18,
    marginBottom: 16,
    flexDirection: "row",
    gap: 12,
  },
  infoTitle: {
    color: COLORS.primaryDark,
    fontWeight: "900",
    marginBottom: 6,
  },
  infoText: {
    color: COLORS.primaryDark,
    fontWeight: "700",
    lineHeight: 21,
  },
});