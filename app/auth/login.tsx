// app/auth/login.tsx

import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
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
  bg: "#F7F7F2",
  card: "#FFFFFF",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  green: "#2F7D32",
  greenDark: "#064E3B",
  black: "#111827",
  red: "#DC2626",
};

function normalize(value: any) {
  return String(value || "").trim().toLowerCase();
}

function routeForRole(role: Role, user: any) {
  if (role === "driver") return "/driver/board";
  if (role === "freight") return "/freight/dashboard";
  if (role === "customer") return "/customer/marketplace";
  if (role === "farmer") return "/farmer/dashboard";
  if (role === "admin") return "/admin/dashboard";
  return ROLE_ROUTES[role];
}

function sessionKeysForRole(role: Role) {
  if (role === "customer") {
    return ["currentCustomer", "farm2homeCurrentCustomer", "currentUser"];
  }

  if (role === "farmer") {
    return ["currentFarmer", "currentUser"];
  }

  if (role === "driver") {
    return [
      "currentDriver",
      "farm2homeCurrentDriver",
      "farm2homeDriverSession",
      "currentUser",
    ];
  }

  if (role === "freight") {
    return [
      "currentFreightCarrier",
      "currentFreight",
      "currentFreightUser",
      "currentUser",
    ];
  }

  return ["currentAdmin", "currentUser"];
}

function buildLocalUser(role: Role, authUser: any, profileRow: any) {
  const id = profileRow?.id || authUser?.id || "";
  const accountId = profileRow?.account_id || "";

  return {
    ...(profileRow || {}),
    id,
    authUserId: profileRow?.auth_user_id || authUser?.id || id,
    profileId: profileRow?.profile_id || id,
    profile_id: profileRow?.profile_id || id,
    accountId,
    account_id: accountId,
    role,
    email: normalize(profileRow?.email || authUser?.email),
    username: profileRow?.username || authUser?.user_metadata?.username || "",
    fullName:
      profileRow?.full_name ||
      profileRow?.name ||
      profileRow?.contact_name ||
      authUser?.user_metadata?.full_name ||
      "",
    name:
      profileRow?.name ||
      profileRow?.full_name ||
      profileRow?.contact_name ||
      authUser?.user_metadata?.name ||
      "",
    farmName:
      profileRow?.farm_name ||
      profileRow?.farmName ||
      profileRow?.business_name ||
      profileRow?.company_name ||
      "",
    businessName:
      profileRow?.business_name ||
      profileRow?.company_name ||
      profileRow?.farm_name ||
      "",
    companyName:
      profileRow?.company_name ||
      profileRow?.business_name ||
      profileRow?.farm_name ||
      "",
    membershipStatus:
      profileRow?.membership_status ||
      profileRow?.membershipStatus ||
      "not_started",
    subscriptionStatus:
      profileRow?.subscription_status ||
      profileRow?.subscriptionStatus ||
      "not_started",
    accountActive:
      profileRow?.account_active ??
      profileRow?.accountActive ??
      true,
    stripeCustomerId:
      profileRow?.stripe_customer_id ||
      profileRow?.stripe_id ||
      profileRow?.stripeCustomerId ||
      "",
    stripeSubscriptionId:
      profileRow?.stripe_subscription_id ||
      profileRow?.subscription_id ||
      profileRow?.stripeSubscriptionId ||
      "",
    subscriptionId:
      profileRow?.subscription_id ||
      profileRow?.stripe_subscription_id ||
      profileRow?.subscriptionId ||
      "",
    stripeAccountId:
      profileRow?.stripe_account_id ||
      profileRow?.stripeAccountId ||
      "",
    updatedAt: new Date().toISOString(),
  };
}

async function clearOldSessions() {
  const keys = [
    "currentUser",
    "currentUserRole",
    "userRole",
    "currentCustomer",
    "farm2homeCurrentCustomer",
    "currentFarmer",
    "currentDriver",
    "farm2homeCurrentDriver",
    "farm2homeDriverSession",
    "currentFreightCarrier",
    "currentFreight",
    "currentFreightUser",
    "currentAdmin",
  ];

  await AsyncStorage.multiRemove(keys);
}

async function saveSession(role: Role, localUser: any) {
  await clearOldSessions();

  const keys = sessionKeysForRole(role);

  await Promise.all(
    keys.map((key) => AsyncStorage.setItem(key, JSON.stringify(localUser)))
  );

  await AsyncStorage.setItem("currentUserRole", role);
  await AsyncStorage.setItem("userRole", role);
}

async function findProfileByRole(role: Role, authUser: any, email: string) {
  const table = ROLE_TABLES[role];

  const authId = authUser?.id || "";

  if (role === "admin") {
    const { data, error } = await supabase
      .from("admins")
      .select("*")
      .or(`id.eq.${authId},auth_user_id.eq.${authId},email.eq.${email}`)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

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

  const { data, error } = await query.maybeSingle();

  if (error) throw error;
  return data;
}

async function inferRole(authUser: any, email: string): Promise<Role | null> {
  const metadataRole = normalize(authUser?.user_metadata?.role);

  if (["customer", "farmer", "driver", "freight", "admin"].includes(metadataRole)) {
    return metadataRole as Role;
  }

  const checks: Role[] = ["customer", "farmer", "driver", "freight", "admin"];

  for (const role of checks) {
    try {
      const row = await findProfileByRole(role, authUser, email);
      if (row?.id) return role;
    } catch {
      // Continue role detection.
    }
  }

  return null;
}

export default function LoginScreen() {
  const [role, setRole] = useState<Role>("customer");
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function resolveEmailForUsername(input: string, activeRole: Role) {
    const value = normalize(input);

    if (value.includes("@")) return value;

    const table = ROLE_TABLES[activeRole];

    const { data, error } = await supabase
      .from(table)
      .select("email")
      .eq("username", value)
      .maybeSingle();

    if (error) throw error;

    if (!data?.email) {
      throw new Error("No account found for this username.");
    }

    return normalize(data.email);
  }

  async function handleLogin() {
    if (loading) return;

    const cleanInput = normalize(emailOrUsername);

    if (!cleanInput || !password.trim()) {
      Alert.alert("Missing Login", "Enter email/username and password.");
      return;
    }

    try {
      setLoading(true);

      const resolvedEmail = await resolveEmailForUsername(cleanInput, role);

      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email: resolvedEmail,
          password: password.trim(),
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

      const detectedRole = (await inferRole(authUser, resolvedEmail)) || role;

      const profileRow = await findProfileByRole(detectedRole, authUser, resolvedEmail);

      if (!profileRow?.id) {
        Alert.alert(
          "Profile Missing",
          `Login succeeded, but no ${detectedRole} profile was found in Supabase.`
        );
        return;
      }

      const localUser = buildLocalUser(detectedRole, authUser, profileRow);

      await saveSession(detectedRole, localUser);

      router.replace(routeForRole(detectedRole, localUser) as any);
    } catch (error: any) {
      Alert.alert("Login Error", error?.message || "Unable to login.");
    } finally {
      setLoading(false);
    }
  }

  function RoleButton({ value, label }: { value: Role; label: string }) {
    const active = role === value;

    return (
      <TouchableOpacity
        style={[styles.roleButton, active && styles.roleButtonActive]}
        onPress={() => setRole(value)}
        activeOpacity={0.85}
      >
        <Text style={[styles.roleButtonText, active && styles.roleButtonTextActive]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>🌾</Text>
        <Text style={styles.title}>Farm2Home Login</Text>
        <Text style={styles.subtitle}>Sign in with your registered account.</Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Select Account Type</Text>

          <View style={styles.roleGrid}>
            <RoleButton value="customer" label="Customer" />
            <RoleButton value="farmer" label="Farmer" />
            <RoleButton value="driver" label="Driver" />
            <RoleButton value="freight" label="Freight" />
            <RoleButton value="admin" label="Admin" />
          </View>

          <TextInput
            style={styles.input}
            placeholder="Email or Username"
            placeholderTextColor="#9CA3AF"
            value={emailOrUsername}
            onChangeText={setEmailOrUsername}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#9CA3AF"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.disabledButton]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Login</Text>
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
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  content: {
    padding: 22,
    paddingTop: 70,
    paddingBottom: 80,
  },
  logo: {
    fontSize: 64,
    textAlign: "center",
    marginBottom: 10,
  },
  title: {
    fontSize: 34,
    fontWeight: "900",
    color: COLORS.greenDark,
    textAlign: "center",
  },
  subtitle: {
    color: COLORS.muted,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 24,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 18,
    marginBottom: 12,
  },
  roleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 18,
  },
  roleButton: {
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  roleButtonActive: {
    backgroundColor: COLORS.green,
    borderColor: COLORS.green,
  },
  roleButtonText: {
    color: COLORS.text,
    fontWeight: "900",
  },
  roleButtonTextActive: {
    color: "#FFFFFF",
  },
  input: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    color: COLORS.text,
    fontWeight: "700",
  },
  button: {
    backgroundColor: COLORS.green,
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 4,
  },
  disabledButton: {
    opacity: 0.65,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },
  links: {
    marginTop: 18,
    alignItems: "center",
    gap: 10,
  },
  linkText: {
    color: COLORS.greenDark,
    fontWeight: "900",
  },
});