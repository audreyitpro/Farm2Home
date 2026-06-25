// app/driver/login.tsx

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

const COLORS = {
  bg: "#F6F7FB",
  card: "#FFFFFF",
  text: "#101828",
  muted: "#667085",
  border: "#E5E7EB",
  primary: "#635BFF",
  primarySoft: "#EEF2FF",
  green: "#10B981",
  greenSoft: "#D1FAE5",
  navy: "#020617",
  white: "#FFFFFF",
};

type DriverRow = {
  id: string;
  auth_user_id?: string | null;
  driver_id?: string | null;
  profile_id?: string | null;
  role?: string | null;
  full_name?: string | null;
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  email?: string | null;
  phone?: string | null;
  vehicle_type?: string | null;
  license_number?: string | null;
  service_area?: string | null;
  membership_status?: string | null;
  subscription_status?: string | null;
  account_active?: boolean | null;
  approved?: boolean | null;
  admin_approved?: boolean | null;
  approval_status?: string | null;
  account_id?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  subscription_id?: string | null;
  stripe_account_id?: string | null;
  stripe_connect_status?: string | null;
  payouts_enabled?: boolean | null;
  charges_enabled?: boolean | null;
  stripe_charges_enabled?: boolean | null;
  stripe_payouts_enabled?: boolean | null;
  stripe_onboarding_complete?: boolean | null;
  driver_membership_paid?: boolean | null;
  updated_at?: string | null;
};

type DriverSubscriptionRow = {
  id?: string;
  driver_id?: string | null;
  driver_email?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  subscription_status?: string | null;
  plan_name?: string | null;
  monthly_amount?: number | null;
  current_period_end?: string | null;
};

function clean(value: any) {
  return String(value ?? "").trim();
}

function normalize(value: any) {
  return clean(value).toLowerCase();
}

function isDriverAccountId(value: any) {
  return /^Driver_\d{3,}$/i.test(clean(value));
}

function isStripeCustomerId(value: any) {
  return clean(value).startsWith("cus_");
}

function isStripeSubscriptionId(value: any) {
  return clean(value).startsWith("sub_");
}

function isStripeAccountId(value: any) {
  return clean(value).startsWith("acct_");
}

function isUuidLike(value: any) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clean(value));
}

function activeStatus(value: any) {
  const status = normalize(value || "active");
  return !["canceled", "cancelled", "inactive", "disabled", "rejected", "unpaid"].includes(status);
}

function displayName(row: DriverRow) {
  return (
    clean(row.full_name) ||
    clean(row.name) ||
    [clean(row.first_name), clean(row.last_name)].filter(Boolean).join(" ") ||
    clean(row.username) ||
    "Farm2Home Driver"
  );
}

async function generateDriverAccountId() {
  const { data } = await supabase
    .from("drivers")
    .select("account_id")
    .like("account_id", "Driver_%");

  const maxNumber = Array.isArray(data)
    ? data.reduce((max, row: any) => {
        const match = String(row.account_id || "").match(/^Driver_(\d+)$/i);
        const num = match ? Number(match[1]) : 0;
        return num > max ? num : max;
      }, 0)
    : 0;

  return `Driver_${String(maxNumber + 1).padStart(3, "0")}`;
}

function missingColumn(error: any) {
  const msg = String(error?.message || "");
  return msg.match(/Could not find the '([^']+)' column/i)?.[1] || "";
}

async function safeDriverUpdate(id: string, payload: Record<string, any>) {
  let nextPayload = { ...payload };

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const { data, error } = await supabase
      .from("drivers")
      .update(nextPayload)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (!error) return data as DriverRow;

    const missing = missingColumn(error);
    if (missing && Object.prototype.hasOwnProperty.call(nextPayload, missing)) {
      delete nextPayload[missing];
      continue;
    }

    console.log("safeDriverUpdate skipped:", error);
    return null;
  }

  return null;
}

async function saveDriverSession(driver: DriverRow) {
  const session = {
    ...driver,
    id: driver.id,
    driverId: driver.id,
    driver_id: driver.driver_id || driver.id,
    authUserId: driver.auth_user_id || "",
    role: "driver",
    userRole: "driver",
    fullName: displayName(driver),
    name: displayName(driver),
    email: normalize(driver.email),
    accountId: driver.account_id,
    account_id: driver.account_id,
    membershipStatus: driver.membership_status || "active",
    subscriptionStatus: driver.subscription_status || "active",
    stripeCustomerId: driver.stripe_customer_id,
    stripeSubscriptionId: driver.stripe_subscription_id || driver.subscription_id,
    stripeAccountId: driver.stripe_account_id,
    accountActive: driver.account_active !== false,
    approved: driver.approved || driver.admin_approved || normalize(driver.approval_status) === "approved",
  };

  await AsyncStorage.multiSet([
    ["currentDriver", JSON.stringify(session)],
    ["currentUser", JSON.stringify(session)],
    ["farm2homeCurrentDriver", JSON.stringify(session)],
    ["farm2homeDriverSession", JSON.stringify(session)],
    ["userRole", "driver"],
    ["currentUserRole", "driver"],
    ["lastLoginRole", "driver"],
    ["driverId", driver.id],
    ["driver_id", driver.driver_id || driver.id],
    ["driverAccountId", driver.account_id || ""],
  ]);
}

export default function DriverLoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function findDriver(authId: string, authEmail: string) {
    let row: DriverRow | null = null;

    if (authId) {
      const byAuth = await supabase
        .from("drivers")
        .select("*")
        .eq("auth_user_id", authId)
        .maybeSingle();

      if (!byAuth.error && byAuth.data) row = byAuth.data as DriverRow;
    }

    if (!row && authId) {
      const byId = await supabase
        .from("drivers")
        .select("*")
        .eq("id", authId)
        .maybeSingle();

      if (!byId.error && byId.data) row = byId.data as DriverRow;
    }

    if (!row && authEmail) {
      const byEmail = await supabase
        .from("drivers")
        .select("*")
        .eq("email", authEmail)
        .maybeSingle();

      if (!byEmail.error && byEmail.data) row = byEmail.data as DriverRow;
    }

    return row;
  }

  async function findSubscription(driver: DriverRow, authEmail: string) {
    let sub: DriverSubscriptionRow | null = null;

    const driverId = clean(driver.driver_id || driver.id);

    if (driverId) {
      const byDriverId = await supabase
        .from("driver_subscriptions")
        .select("*")
        .eq("driver_id", driverId)
        .maybeSingle();

      if (!byDriverId.error && byDriverId.data) sub = byDriverId.data as DriverSubscriptionRow;
    }

    if (!sub && authEmail) {
      const byEmail = await supabase
        .from("driver_subscriptions")
        .select("*")
        .eq("driver_email", authEmail)
        .maybeSingle();

      if (!byEmail.error && byEmail.data) sub = byEmail.data as DriverSubscriptionRow;
    }

    return sub;
  }

  async function repairDriver(driver: DriverRow, authId: string, sub: DriverSubscriptionRow | null) {
    const finalAccountId = isDriverAccountId(driver.account_id)
      ? clean(driver.account_id)
      : await generateDriverAccountId();

    const finalCustomer = isStripeCustomerId(driver.stripe_customer_id)
      ? clean(driver.stripe_customer_id)
      : clean(sub?.stripe_customer_id);

    const finalSubscription = isStripeSubscriptionId(driver.stripe_subscription_id || driver.subscription_id)
      ? clean(driver.stripe_subscription_id || driver.subscription_id)
      : clean(sub?.stripe_subscription_id);

    const finalSubStatus =
      clean(sub?.subscription_status) ||
      clean(driver.subscription_status) ||
      (finalSubscription ? "active" : "pending_payment");

    const payload: Record<string, any> = {
      role: "driver",
      driver_id: driver.driver_id || driver.id,
      account_id: finalAccountId,
      stripe_customer_id: finalCustomer || null,
      stripe_subscription_id: finalSubscription || null,
      subscription_id: finalSubscription || null,
      subscription_status: finalSubStatus,
      membership_status: finalSubscription ? "active" : driver.membership_status || "active",
      driver_membership_paid: Boolean(finalSubscription),
      account_active: driver.account_active !== false,
      updated_at: new Date().toISOString(),
    };

    if (authId && isUuidLike(authId)) {
      payload.auth_user_id = authId;
    }

    const updated = await safeDriverUpdate(driver.id, payload);

    return {
      ...driver,
      ...payload,
      ...(updated || {}),
    } as DriverRow;
  }

  async function handleLogin() {
    const loginEmail = normalize(email);

    if (!loginEmail || !password) {
      Alert.alert("Missing Login", "Enter driver email and password.");
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      });

      if (error) {
        Alert.alert("Login Failed", error.message);
        return;
      }

      const authId = clean(data.user?.id);
      const authEmail = normalize(data.user?.email || loginEmail);

      const driver = await findDriver(authId, authEmail);

      if (!driver) {
        await supabase.auth.signOut();
        Alert.alert("Driver Profile Missing", "Login worked, but no driver row was found. Complete Driver Registration.");
        router.replace("/driver/register" as any);
        return;
      }

      const finalRole = normalize(driver.role || "driver");

      if (finalRole !== "driver") {
        await supabase.auth.signOut();
        Alert.alert("Wrong Account", "This is not a driver profile.");
        return;
      }

      const subscription = await findSubscription(driver, authEmail);
      const finalDriver = await repairDriver(driver, authId, subscription);

      await saveDriverSession(finalDriver);

      console.log("DRIVER LOGIN SUCCESS", {
        id: finalDriver.id,
        auth_user_id: finalDriver.auth_user_id,
        account_id: finalDriver.account_id,
        stripe_customer_id: finalDriver.stripe_customer_id,
        stripe_subscription_id: finalDriver.stripe_subscription_id,
        stripe_account_id: finalDriver.stripe_account_id,
        role: finalDriver.role,
      });

      const accountActive = finalDriver.account_active !== false;
      const membershipOk = activeStatus(finalDriver.membership_status);
      const subscriptionOk = activeStatus(finalDriver.subscription_status);
      const hasRequiredDriverFields =
        clean(finalDriver.id) &&
        normalize(finalDriver.email) &&
        isDriverAccountId(finalDriver.account_id);

      if (!accountActive || !membershipOk || !subscriptionOk) {
        Alert.alert("Account Needs Review", "Your driver account is not active. Opening profile.");
        router.replace("/driver/profile" as any);
        return;
      }

      if (!hasRequiredDriverFields) {
        Alert.alert("Finish Setup", "Driver account ID or email is missing. Opening profile.");
        router.replace("/driver/profile" as any);
        return;
      }

      router.replace("/driver/mobile-driver-app" as any);
    } catch (err: any) {
      console.log("driver login error:", err);
      Alert.alert("Login Error", err?.message || "Unable to login.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.shell}>
            <View style={styles.hero}>
              <View style={styles.logo}>
                <Ionicons name="car-outline" size={34} color={COLORS.white} />
              </View>
              <Text style={styles.eyebrow}>Farm2Driver</Text>
              <Text style={styles.title}>Driver Login</Text>
              <Text style={styles.subtitle}>
                Fully registered drivers go directly to the Driver App.
              </Text>

              <View style={styles.checkList}>
                <Check label="Uses drivers table only" />
                <Check label="Matches auth_user_id, id, then email" />
                <Check label="Saves complete driver session" />
                <Check label="Does not require Stripe Connect to enter app" />
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Welcome Back</Text>
              <Text style={styles.cardSub}>Use the email and password from Driver Registration.</Text>

              <Text style={styles.label}>Email</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="mail-outline" size={18} color={COLORS.muted} />
                <TextInput
                  value={email}
                  onChangeText={(value) => setEmail(normalize(value))}
                  placeholder="driver@email.com"
                  placeholderTextColor="#94A3B8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.input}
                />
              </View>

              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="lock-closed-outline" size={18} color={COLORS.muted} />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Password"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.input}
                  onSubmitEditing={handleLogin}
                />

                <TouchableOpacity onPress={() => setShowPassword((value) => !value)}>
                  <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={COLORS.muted} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, loading && styles.disabled]}
                disabled={loading}
                onPress={handleLogin}
                activeOpacity={0.9}
              >
                {loading ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <>
                    <Ionicons name="log-in-outline" size={18} color={COLORS.white} />
                    <Text style={styles.primaryText}>Login to Driver App</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.secondaryButton} onPress={() => router.push("/driver/register" as any)}>
                <Ionicons name="person-add-outline" size={18} color={COLORS.primary} />
                <Text style={styles.secondaryText}>Driver Registration</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.linkButton} onPress={() => router.replace("/" as any)}>
                <Text style={styles.linkText}>Back to Home</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Check({ label }: { label: string }) {
  return (
    <View style={styles.checkRow}>
      <View style={styles.checkIcon}>
        <Ionicons name="checkmark" size={13} color={COLORS.green} />
      </View>
      <Text style={styles.checkText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  content: { flexGrow: 1 },
  shell: {
    flex: 1,
    flexDirection: Platform.OS === "web" ? "row" : "column",
    minHeight: Platform.OS === "web" ? 760 : undefined,
  },
  hero: {
    flex: 1,
    backgroundColor: COLORS.navy,
    padding: 28,
    justifyContent: "center",
  },
  logo: {
    width: 68,
    height: 68,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  eyebrow: {
    color: "#A5B4FC",
    fontWeight: "900",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    fontSize: 12,
  },
  title: {
    color: COLORS.white,
    fontSize: 42,
    fontWeight: "900",
    marginTop: 6,
  },
  subtitle: {
    color: "#CBD5E1",
    fontWeight: "700",
    lineHeight: 22,
    marginTop: 8,
    maxWidth: 520,
  },
  checkList: { marginTop: 24, gap: 10 },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  checkIcon: {
    width: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: COLORS.greenSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  checkText: { color: "#E5E7EB", fontWeight: "800" },
  card: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: COLORS.bg,
    padding: Platform.OS === "web" ? 48 : 20,
  },
  cardTitle: { color: COLORS.text, fontSize: 30, fontWeight: "900" },
  cardSub: { color: COLORS.muted, fontWeight: "700", marginTop: 6, marginBottom: 24 },
  label: { color: COLORS.text, fontWeight: "900", marginBottom: 8 },
  inputWrap: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    paddingHorizontal: 13,
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  input: { flex: 1, minHeight: 52, color: COLORS.text, fontWeight: "800" },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },
  primaryText: { color: COLORS.white, fontWeight: "900", fontSize: 15 },
  secondaryButton: {
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    borderRadius: 16,
    padding: 15,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  secondaryText: { color: COLORS.primary, fontWeight: "900" },
  linkButton: { padding: 14, alignItems: "center", marginTop: 4 },
  linkText: { color: COLORS.muted, fontWeight: "900" },
  disabled: { opacity: 0.65 },
});
