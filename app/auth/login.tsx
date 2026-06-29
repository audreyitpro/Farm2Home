// app/auth/login.tsx

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

type Role = "customer" | "farmer" | "driver" | "freight" | "admin";

const ROLE_ROUTES: Record<Role, string> = {
  customer: "/customer/marketplace",
  farmer: "/farmer/dashboard",
  driver: "/driver/board",
  freight: "/freight/dashboard",
  admin: "/admin/dashboard",
};

const ROLE_TABLES: Record<Role, string> = {
  customer: "customers",
  farmer: "farmers",
  driver: "drivers",
  freight: "freight_users",
  admin: "admins",
};

const COLORS = {
  bg: "#F4F7FB",
  dark: "#07111F",
  card: "#FFFFFF",
  surface: "#F8FAFC",
  text: "#0F172A",
  muted: "#64748B",
  border: "#E2E8F0",
  primary: "#2563EB",
  primaryDark: "#1D4ED8",
  green: "#16A34A",
  orange: "#EA580C",
  purple: "#7C3AED",
  white: "#FFFFFF",
};

function clean(value: any) {
  return String(value ?? "").trim();
}

function normalize(value: any) {
  return clean(value).toLowerCase();
}

async function clearOldSessions() {
  await AsyncStorage.multiRemove([
    "currentUser",
    "currentUserRole",
    "userRole",
    "lastLoginRole",
    "currentCustomer",
    "farm2homeCurrentCustomer",
    "currentFarmer",
    "farm2homeCurrentFarmer",
    "farm2homeFarmerSession",
    "currentDriver",
    "farm2homeCurrentDriver",
    "farm2homeDriverSession",
    "currentFreightCarrier",
    "currentFreight",
    "currentFreightUser",
    "currentAdmin",
  ]);
}

function sessionKeysForRole(role: Role) {
  if (role === "customer") return ["currentCustomer", "farm2homeCurrentCustomer", "currentUser"];
  if (role === "farmer") return ["currentFarmer", "farm2homeCurrentFarmer", "currentUser"];
  if (role === "driver") return ["currentDriver", "farm2homeCurrentDriver", "farm2homeDriverSession", "currentUser"];
  if (role === "freight") return ["currentFreightCarrier", "currentFreight", "currentFreightUser", "currentUser"];
  return ["currentAdmin", "currentUser"];
}

function buildLocalUser(role: Role, authUser: any, profileRow: any) {
  const id = clean(profileRow?.id || authUser?.id);
  const fullName = clean(
    profileRow?.full_name ||
      profileRow?.fullName ||
      profileRow?.name ||
      profileRow?.contact_name ||
      profileRow?.username ||
      "Farm2Home User"
  );

  return {
    ...(profileRow || {}),
    id,
    authUserId: clean(profileRow?.auth_user_id || authUser?.id || id),
    auth_user_id: clean(profileRow?.auth_user_id || authUser?.id || id),
    profileId: clean(profileRow?.profile_id || id),
    profile_id: clean(profileRow?.profile_id || id),
    accountId: clean(profileRow?.account_id),
    account_id: clean(profileRow?.account_id),
    role,
    email: normalize(profileRow?.email || authUser?.email),
    username: normalize(profileRow?.username),
    fullName,
    full_name: fullName,
    name: clean(profileRow?.name || fullName),
    farmName: clean(profileRow?.farm_name || profileRow?.business_name || profileRow?.company_name),
    farm_name: clean(profileRow?.farm_name || profileRow?.business_name || profileRow?.company_name),
    businessName: clean(profileRow?.business_name || profileRow?.company_name || profileRow?.farm_name),
    business_name: clean(profileRow?.business_name || profileRow?.company_name || profileRow?.farm_name),
    companyName: clean(profileRow?.company_name || profileRow?.business_name),
    company_name: clean(profileRow?.company_name || profileRow?.business_name),
    accountActive: profileRow?.account_active !== false && profileRow?.is_active !== false,
    account_active: profileRow?.account_active !== false && profileRow?.is_active !== false,
    isActive: profileRow?.is_active !== false,
    is_active: profileRow?.is_active !== false,
    superAdmin: Boolean(profileRow?.super_admin),
    super_admin: Boolean(profileRow?.super_admin),
    membershipStatus: clean(profileRow?.membership_status || profileRow?.membershipStatus || "not_started"),
    membership_status: clean(profileRow?.membership_status || profileRow?.membershipStatus || "not_started"),
    subscriptionStatus: clean(profileRow?.subscription_status || profileRow?.subscriptionStatus || "not_started"),
    subscription_status: clean(profileRow?.subscription_status || profileRow?.subscriptionStatus || "not_started"),
    updatedAt: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

async function saveSession(role: Role, localUser: any) {
  await clearOldSessions();

  const keys = sessionKeysForRole(role);

  await Promise.all(keys.map((key) => AsyncStorage.setItem(key, JSON.stringify(localUser))));
  await AsyncStorage.setItem("currentUserRole", role);
  await AsyncStorage.setItem("userRole", role);
  await AsyncStorage.setItem("lastLoginRole", role);
}

async function resolveEmailForUsername(input: string, activeRole: Role) {
  const value = normalize(input);

  if (value.includes("@")) return value;

  const { data, error } = await supabase
    .from(ROLE_TABLES[activeRole])
    .select("email")
    .eq("username", value)
    .limit(1);

  if (error) throw error;

  if (Array.isArray(data) && data[0]?.email) return normalize(data[0].email);

  throw new Error("No account found for this username.");
}

async function findProfileByRole(role: Role, authUser: any, email: string) {
  const table = ROLE_TABLES[role];
  const authId = clean(authUser?.id);

  let query = supabase.from(table).select("*");

  if (authId && email) {
    query = query.or(
      `id.eq.${authId},auth_user_id.eq.${authId},profile_id.eq.${authId},email.eq.${email}`
    );
  } else if (authId) {
    query = query.or(`id.eq.${authId},auth_user_id.eq.${authId},profile_id.eq.${authId}`);
  } else {
    query = query.eq("email", email);
  }

  const { data, error } = await query.limit(1);

  if (error) throw error;

  return Array.isArray(data) && data[0] ? data[0] : null;
}

async function findAdminByLogin(loginValue: string) {
  const value = normalize(loginValue);

  const { data, error } = await supabase
    .from("admins")
    .select("*")
    .or(`email.eq.${value},username.eq.${value}`)
    .limit(1);

  if (error) throw error;

  return Array.isArray(data) && data[0] ? data[0] : null;
}

export default function LoginScreen() {
  const [role, setRole] = useState<Role>("customer");
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [securePassword, setSecurePassword] = useState(true);
  const [loading, setLoading] = useState(false);

  async function loginAdminDirectly() {
    const input = normalize(emailOrUsername);
    const pass = clean(password);

    const admin = await findAdminByLogin(input);

    if (!admin) {
      Alert.alert("Admin Not Found", "No matching account was found in the admins table.");
      return;
    }

    if (admin.is_active === false) {
      Alert.alert("Account Disabled", "This admin account is not active.");
      return;
    }

    if (clean(admin.password) !== pass) {
      Alert.alert("Invalid Password", "Password does not match the admins table.");
      return;
    }

    const localAdmin = buildLocalUser("admin", null, {
      ...admin,
      role: "admin",
      account_active: admin.is_active !== false,
    });

    await saveSession("admin", localAdmin);

    router.replace("/admin/dashboard" as any);
  }

  async function loginStandardRole() {
    const input = normalize(emailOrUsername);
    const pass = clean(password);

    const resolvedEmail = await resolveEmailForUsername(input, role);

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: resolvedEmail,
      password: pass,
    });

    if (authError) {
      Alert.alert("Login Error", authError.message);
      return;
    }

    const authUser = authData?.user;

    if (!authUser?.id) {
      Alert.alert("Login Error", "Unable to verify user account.");
      return;
    }

    const profileRow = await findProfileByRole(role, authUser, resolvedEmail);

    if (!profileRow?.id) {
      Alert.alert(
        "Profile Missing",
        `Login succeeded, but no ${role} profile was found in Supabase.`
      );
      return;
    }

    const localUser = buildLocalUser(role, authUser, profileRow);

    if (localUser.accountActive === false || localUser.isActive === false) {
      Alert.alert("Account Disabled", "This account is not active.");
      return;
    }

    await saveSession(role, localUser);

    router.replace(ROLE_ROUTES[role] as any);
  }

  async function handleLogin() {
    if (loading) return;

    const input = normalize(emailOrUsername);
    const pass = clean(password);

    if (!input || !pass) {
      Alert.alert("Missing Login", "Enter email/username and password.");
      return;
    }

    try {
      setLoading(true);

      if (role === "admin") {
        await loginAdminDirectly();
        return;
      }

      await loginStandardRole();
    } catch (error: any) {
      console.log("Login error:", error);
      Alert.alert("Login Error", error?.message || "Unable to login.");
    } finally {
      setLoading(false);
    }
  }

  function RoleButton({
    value,
    label,
    icon,
    color,
  }: {
    value: Role;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
  }) {
    const active = role === value;

    return (
      <TouchableOpacity
        style={[styles.roleButton, active && { backgroundColor: color, borderColor: color }]}
        onPress={() => setRole(value)}
        activeOpacity={0.85}
      >
        <Ionicons name={icon} size={18} color={active ? COLORS.white : color} />
        <Text style={[styles.roleButtonText, active && styles.roleButtonTextActive]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.dark} />

      <KeyboardAvoidingView
        style={styles.page}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.replace("/" as any)}
              activeOpacity={0.85}
            >
              <Ionicons name="arrow-back-outline" size={18} color={COLORS.white} />
              <Text style={styles.backText}>Back Home</Text>
            </TouchableOpacity>

            <View style={styles.heroIcon}>
              <Ionicons name="shield-checkmark-outline" size={34} color={COLORS.white} />
            </View>

            <Text style={styles.kicker}>Farm2Home Access Center</Text>
            <Text style={styles.title}>Login</Text>
            <Text style={styles.subtitle}>
              Select your account type. Admin login checks the admins table directly.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Select Account Type</Text>

            <View style={styles.roleGrid}>
              <RoleButton value="customer" label="Customer" icon="basket-outline" color={COLORS.purple} />
              <RoleButton value="farmer" label="Farmer" icon="leaf-outline" color={COLORS.green} />
              <RoleButton value="driver" label="Driver" icon="car-outline" color={COLORS.orange} />
              <RoleButton value="freight" label="Freight" icon="trail-sign-outline" color={COLORS.primary} />
              <RoleButton value="admin" label="Admin" icon="shield-checkmark-outline" color={COLORS.dark} />
            </View>

            {role === "admin" ? (
              <View style={styles.adminNotice}>
                <Ionicons name="server-outline" size={20} color={COLORS.primary} />
                <Text style={styles.adminNoticeText}>
                  Admin does not use Supabase Auth. It reads email/username and password
                  from the admins table.
                </Text>
              </View>
            ) : null}

            <Text style={styles.label}>Email or Username</Text>
            <View style={styles.inputShell}>
              <Ionicons name="person-outline" size={19} color={COLORS.muted} />
              <TextInput
                style={styles.input}
                placeholder="Email or Username"
                placeholderTextColor="#94A3B8"
                value={emailOrUsername}
                onChangeText={(value) => setEmailOrUsername(normalize(value))}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <Text style={styles.label}>Password</Text>
            <View style={styles.inputShell}>
              <Ionicons name="key-outline" size={19} color={COLORS.muted} />
              <TextInput
                style={styles.input}
                placeholder="Password"
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
                  color={COLORS.primary}
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.button, loading && styles.disabledButton]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <>
                  <Ionicons name="log-in-outline" size={20} color={COLORS.white} />
                  <Text style={styles.buttonText}>
                    Login to {role.charAt(0).toUpperCase() + role.slice(1)}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.links}>
            <TouchableOpacity onPress={() => router.push("/customer/register" as any)}>
              <Text style={styles.linkText}>Customer Register</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push("/farmer/register" as any)}>
              <Text style={styles.linkText}>Farmer Register</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push("/driver/register" as any)}>
              <Text style={styles.linkText}>Driver Register</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push("/freight/register" as any)}>
              <Text style={styles.linkText}>Freight Register</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.dark },
  page: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingBottom: 80 },
  hero: {
    backgroundColor: COLORS.dark,
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
    color: "#93C5FD",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    color: COLORS.white,
    fontSize: 34,
    fontWeight: "900",
    marginTop: 6,
  },
  subtitle: {
    color: "#CBD5E1",
    fontWeight: "700",
    lineHeight: 22,
    marginTop: 8,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 26,
    padding: 20,
    marginHorizontal: 18,
    marginTop: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 12,
  },
  roleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
    marginBottom: 16,
  },
  roleButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  roleButtonText: {
    color: COLORS.text,
    fontWeight: "900",
  },
  roleButtonTextActive: {
    color: COLORS.white,
  },
  adminNotice: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 18,
    padding: 13,
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  adminNoticeText: {
    color: COLORS.primaryDark,
    fontWeight: "800",
    lineHeight: 20,
    flex: 1,
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
    color: COLORS.text,
    fontWeight: "800",
    minHeight: 54,
  },
  button: {
    backgroundColor: COLORS.primary,
    padding: 17,
    borderRadius: 18,
    marginTop: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  disabledButton: { opacity: 0.65 },
  buttonText: {
    color: COLORS.white,
    fontWeight: "900",
    fontSize: 16,
  },
  links: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 22,
    padding: 16,
    marginHorizontal: 18,
    marginTop: 16,
    gap: 10,
    alignItems: "center",
  },
  linkText: {
    color: COLORS.primary,
    fontWeight: "900",
  },
});