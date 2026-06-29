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
  white: "#FFFFFF",
};

type AdminRow = {
  id: string;
  email: string | null;
  username: string | null;
  password: string | null;
  full_name: string | null;
  role: string | null;
  is_active: boolean | null;
  super_admin: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function clean(value: any) {
  return String(value ?? "").trim();
}

function normalize(value: any) {
  return clean(value).toLowerCase();
}

function mapAdmin(admin: AdminRow) {
  return {
    id: admin.id,
    profileId: admin.id,
    role: "admin",
    adminRole: admin.role || "admin",
    fullName: admin.full_name || admin.username || "Farm2Home Admin",
    email: normalize(admin.email),
    username: clean(admin.username),
    isActive: admin.is_active !== false,
    superAdmin: Boolean(admin.super_admin),
    createdAt: admin.created_at || "",
    updatedAt: admin.updated_at || new Date().toISOString(),
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
      .or(`email.ilike.${value},username.ilike.${value}`)
      .limit(1);

    if (error) throw error;

    if (Array.isArray(data) && data.length > 0) {
      return data[0] as AdminRow;
    }

    return null;
  }

  async function saveAdminSession(admin: AdminRow) {
    const mapped = mapAdmin(admin);

    await AsyncStorage.multiRemove([
      "currentFarmer",
      "currentCustomer",
      "currentDriver",
      "currentFreight",
      "farm2homeCurrentFarmer",
      "farm2homeFarmerSession",
    ]);

    await AsyncStorage.multiSet([
      ["currentAdmin", JSON.stringify(mapped)],
      ["currentUser", JSON.stringify(mapped)],
      ["userRole", "admin"],
      ["currentUserRole", "admin"],
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
        Alert.alert("Admin Not Found", "No admin record was found in the admins table.");
        return;
      }

      if (admin.is_active === false) {
        Alert.alert("Account Disabled", "This admin account is not active.");
        return;
      }

      if (clean(admin.password) !== passwordValue) {
        Alert.alert("Invalid Password", "The password does not match this admin account.");
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
          >
            <Ionicons name="arrow-back-outline" size={18} color="#DBEAFE" />
            <Text style={styles.backText}>Back Home</Text>
          </TouchableOpacity>

          <View style={styles.heroCard}>
            <View style={styles.heroTop}>
              <View style={styles.heroIcon}>
                <Ionicons name="shield-checkmark-outline" size={34} color={ui.white} />
              </View>

              <View style={styles.statusPill}>
                <Ionicons name="lock-closed-outline" size={14} color="#BFDBFE" />
                <Text style={styles.statusText}>Private Admin Access</Text>
              </View>
            </View>

            <Text style={styles.kicker}>Farm2Home Control Center</Text>
            <Text style={styles.header}>Admin Login</Text>
            <Text style={styles.subheader}>
              Sign in with an active record from the admins table.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Secure Admin Portal</Text>
            <Text style={styles.sectionSubtitle}>
              Login checks admin email or username directly in Supabase.
            </Text>

            <Text style={styles.label}>Admin Email or Username</Text>
            <View style={styles.inputShell}>
              <Ionicons name="person-outline" size={19} color={ui.muted} />
              <TextInput
                style={styles.input}
                placeholder="admin@email.com or username"
                placeholderTextColor={ui.muted}
                value={login}
                onChangeText={setLogin}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <Text style={styles.label}>Password</Text>
            <View style={styles.inputShell}>
              <Ionicons name="key-outline" size={19} color={ui.muted} />
              <TextInput
                style={styles.input}
                placeholder="Enter password"
                placeholderTextColor={ui.muted}
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
                  color={ui.primaryDark}
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.loginButton, loading && styles.disabledButton]}
              onPress={loginAdmin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={ui.white} />
              ) : (
                <>
                  <Ionicons name="log-in-outline" size={20} color={ui.white} />
                  <Text style={styles.loginButtonText}>Login to Admin Dashboard</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Admins Table Required</Text>
            <Text style={styles.infoText}>
              Required columns: id, email, username, password, full_name, role,
              is_active, and super_admin.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  heroIcon: {
    width: 62,
    height: 62,
    borderRadius: 22,
    backgroundColor: ui.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  statusPill: {
    backgroundColor: "rgba(29,78,216,0.22)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusText: { color: "#BFDBFE", fontWeight: "900", fontSize: 12 },
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
    color: ui.white,
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
  inputShell: {
    backgroundColor: ui.soft,
    borderWidth: 1,
    borderColor: ui.border,
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
    color: ui.white,
    textAlign: "center",
    fontWeight: "900",
    fontSize: 16,
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
});