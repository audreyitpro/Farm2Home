// app/driver/login.tsx

import React, { useMemo, useState } from "react";
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

const COLORS = {
  bg: "#F6F7FB",
  card: "#FFFFFF",
  surface: "#F8FAFC",
  surface2: "#F1F5F9",
  primary: "#635BFF",
  primaryDark: "#4638D8",
  primarySoft: "#EEF2FF",
  accent: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
  text: "#101828",
  muted: "#667085",
  border: "#E5E7EB",
  dark: "#111827",
  white: "#FFFFFF",
  navy: "#020617",
};

function clean(value: any) {
  return String(value ?? "").trim();
}

function normalize(value: any) {
  return clean(value).toLowerCase();
}

function isStripeCustomerId(value: any) {
  return clean(value).startsWith("cus_");
}

function isStripeSubscriptionId(value: any) {
  return clean(value).startsWith("sub_");
}

function isValidDriverSubscriptionStatus(value: any) {
  return ["active", "trialing", "past_due"].includes(normalize(value));
}

function maskId(value: string, fallback = "Missing") {
  const id = clean(value);
  if (!id) return fallback;
  if (id.length <= 14) return id;
  return `${id.slice(0, 8)}...${id.slice(-5)}`;
}

function pickStripeCustomerId(...values: any[]) {
  const found = values.find((value) => isStripeCustomerId(value));
  return found ? clean(found) : "";
}

function pickStripeSubscriptionId(...values: any[]) {
  const found = values.find((value) => isStripeSubscriptionId(value));
  return found ? clean(found) : "";
}

function mapDriver(driver: any, profile?: any, subscription?: any) {
  const id = clean(
    driver?.id ||
      driver?.driver_id ||
      profile?.auth_user_id ||
      profile?.id ||
      subscription?.driver_id
  );

  const stripeCustomerId = pickStripeCustomerId(
    driver?.stripe_customer_id,
    driver?.stripeCustomerId,
    profile?.stripe_customer_id,
    subscription?.stripe_customer_id
  );

  const stripeSubscriptionId = pickStripeSubscriptionId(
    driver?.stripe_subscription_id,
    driver?.subscription_id,
    driver?.stripeSubscriptionId,
    driver?.subscriptionId,
    profile?.stripe_subscription_id,
    profile?.subscription_id,
    subscription?.stripe_subscription_id
  );

  const subscriptionStatus = clean(
    driver?.subscription_status ||
      driver?.subscriptionStatus ||
      subscription?.subscription_status ||
      profile?.subscription_status ||
      (stripeSubscriptionId ? "active" : "pending_payment")
  );

  const accountId = clean(driver?.account_id || profile?.account_id);

  const active =
    Boolean(id) &&
    accountId.startsWith("Driver_") &&
    driver?.account_active !== false &&
    (
      isValidDriverSubscriptionStatus(subscriptionStatus) ||
      Boolean(driver?.driver_membership_paid) ||
      isStripeSubscriptionId(stripeSubscriptionId)
    );

  return {
    ...driver,
    ...(profile || {}),
    ...(subscription || {}),

    id,
    driverId: id,
    driver_id: id,
    profileId: clean(driver?.profile_id || profile?.id || profile?.profile_id || id),
    profile_id: clean(driver?.profile_id || profile?.id || profile?.profile_id || id),
    authUserId: clean(driver?.auth_user_id || profile?.auth_user_id || id),
    auth_user_id: clean(driver?.auth_user_id || profile?.auth_user_id || id),
    role: "driver",

    fullName:
      clean(driver?.full_name || driver?.fullName || driver?.name || driver?.driver_name || profile?.full_name || profile?.name) ||
      "Farm2Home Driver",
    full_name:
      clean(driver?.full_name || driver?.fullName || driver?.name || driver?.driver_name || profile?.full_name || profile?.name) ||
      "Farm2Home Driver",
    name:
      clean(driver?.name || driver?.full_name || profile?.full_name || profile?.name) ||
      "Farm2Home Driver",

    email: normalize(driver?.email || driver?.driver_email || profile?.email || subscription?.driver_email),
    driver_email: normalize(driver?.email || driver?.driver_email || profile?.email || subscription?.driver_email),
    username: clean(driver?.username || profile?.username || subscription?.username),
    phone: clean(driver?.phone || profile?.phone),

    accountId,
    account_id: accountId,

    vehicleType: clean(driver?.vehicle_type || driver?.vehicleType),
    vehicle_type: clean(driver?.vehicle_type || driver?.vehicleType),
    licenseNumber: clean(driver?.license_number || driver?.licenseNumber),
    license_number: clean(driver?.license_number || driver?.licenseNumber),
    serviceArea: clean(driver?.service_area || driver?.serviceArea),
    service_area: clean(driver?.service_area || driver?.serviceArea),

    stripeCustomerId,
    stripe_customer_id: stripeCustomerId,
    stripeSubscriptionId,
    stripe_subscription_id: stripeSubscriptionId,
    subscriptionId: stripeSubscriptionId,
    subscription_id: stripeSubscriptionId,

    accountActive: active,
    account_active: active,
    membershipStatus: active ? "active" : clean(driver?.membership_status || "pending_payment"),
    membership_status: active ? "active" : clean(driver?.membership_status || "pending_payment"),
    subscriptionStatus,
    subscription_status: subscriptionStatus,
    driverMembershipPaid: active,
    driver_membership_paid: active,

    approved: driver?.approved ?? active,
    verified: driver?.verified ?? active,

    expoPushToken: driver?.expo_push_token || driver?.expoPushToken || "",
    expo_push_token: driver?.expo_push_token || driver?.expoPushToken || "",

    notificationsEnabled:
      driver?.notifications_enabled ?? driver?.notificationsEnabled ?? false,
    notifications_enabled:
      driver?.notifications_enabled ?? driver?.notificationsEnabled ?? false,

    createdAt: driver?.created_at || driver?.createdAt || profile?.created_at || "",
    created_at: driver?.created_at || driver?.createdAt || profile?.created_at || "",
    updatedAt: driver?.updated_at || driver?.updatedAt || new Date().toISOString(),
    updated_at: driver?.updated_at || driver?.updatedAt || new Date().toISOString(),
  };
}

function isDriverActive(driver: any) {
  if (!driver?.id) return false;

  const membershipStatus = normalize(
    driver?.membership_status ||
      driver?.membershipStatus ||
      driver?.subscription_status ||
      driver?.subscriptionStatus ||
      "pending"
  );

  const hasDriverAccount =
    clean(driver?.account_id || driver?.accountId).startsWith("Driver_");

  const hasMembership =
    membershipStatus === "active" ||
    membershipStatus === "trialing" ||
    membershipStatus === "past_due" ||
    Boolean(driver?.driver_membership_paid || driver?.driverMembershipPaid) ||
    isStripeSubscriptionId(driver?.subscription_id || driver?.stripe_subscription_id);

  return Boolean(
    driver.account_active !== false &&
      driver.accountActive !== false &&
      hasDriverAccount &&
      hasMembership
  );
}

export default function DriverLoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [lastCheckedDriver, setLastCheckedDriver] = useState<any>(null);

  const [resetVisible, setResetVisible] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  const accessStatus = useMemo(() => {
    if (!lastCheckedDriver) {
      return [
        { label: "Driver Profile", complete: false, value: "Login to check" },
        { label: "Stripe Customer", complete: false, value: "Login to check" },
        { label: "Subscription", complete: false, value: "Login to check" },
        { label: "Membership Status", complete: false, value: "Login to check" },
      ];
    }

    return [
      {
        label: "Driver Profile",
        complete: Boolean(lastCheckedDriver.id),
        value: lastCheckedDriver.id ? "Found" : "Missing",
      },
      {
        label: "Stripe Customer",
        complete: isStripeCustomerId(lastCheckedDriver.stripe_customer_id),
        value: maskId(lastCheckedDriver.stripe_customer_id),
      },
      {
        label: "Subscription",
        complete: isStripeSubscriptionId(lastCheckedDriver.subscription_id),
        value: maskId(lastCheckedDriver.subscription_id),
      },
      {
        label: "Membership Status",
        complete: isValidDriverSubscriptionStatus(lastCheckedDriver.subscription_status),
        value: lastCheckedDriver.subscription_status || "Missing",
      },
    ];
  }, [lastCheckedDriver]);

  const accessScore = useMemo(
    () => accessStatus.filter((item) => item.complete).length,
    [accessStatus]
  );

  async function saveLoggedInDriver(driver: any) {
    await AsyncStorage.multiSet([
      ["currentDriver", JSON.stringify(driver)],
      ["currentUser", JSON.stringify(driver)],
      ["farm2homeCurrentDriver", JSON.stringify(driver)],
      ["farm2homeDriverSession", JSON.stringify(driver)],
      ["userRole", "driver"],
      ["currentUserRole", "driver"],
      ["lastLoginRole", "driver"],
      ["lastDriverDashboardReady", isDriverActive(driver) ? "true" : "false"],
    ]);

    return driver;
  }

  async function findProfile(userId: string, cleanEmail: string) {
    if (userId) {
      const byAuth = await supabase
        .from("profiles")
        .select("*")
        .or(`id.eq.${userId},auth_user_id.eq.${userId}`)
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

  async function getBestDriverSubscription(driverId?: string, targetEmail?: string) {
    const id = clean(driverId);
    const cleanEmail = normalize(targetEmail);

    const filters = [
      id ? `driver_id.eq.${id}` : "",
      cleanEmail ? `driver_email.eq.${cleanEmail}` : "",
    ]
      .filter(Boolean)
      .join(",");

    if (!filters) return null;

    try {
      const { data, error } = await supabase
        .from("driver_subscriptions")
        .select("*")
        .or(filters)
        .order("updated_at", { ascending: false })
        .limit(10);

      if (error) {
        console.log("driver_subscriptions lookup skipped:", error.message);
        return null;
      }

      if (!Array.isArray(data) || data.length === 0) return null;

      const complete = data.find(
        (row) =>
          pickStripeCustomerId(row?.stripe_customer_id) &&
          pickStripeSubscriptionId(row?.stripe_subscription_id) &&
          isValidDriverSubscriptionStatus(row?.subscription_status)
      );

      return complete || data[0];
    } catch (error) {
      console.log("driver_subscriptions lookup exception:", error);
      return null;
    }
  }

  async function syncDriverSubscription(driverId: string, cleanEmail: string, driverRow: any) {
    let backendSync: any = null;

    try {
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_BASE_URL || "https://farm2home-production-e4bd.up.railway.app"}/payments/sync-stripe-by-email`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: "driver",
            email: cleanEmail,
            name: driverRow?.name || driverRow?.full_name || "Farm2Home Driver",
            username: driverRow?.username || "",
            userId: driverId,
            driverId,
            driver_id: driverId,
          }),
        }
      );

      const json = await response.json();
      console.log("DRIVER STRIPE SYNC RESPONSE:", json);
      if (response.ok && json.success) backendSync = json;
    } catch (error) {
      console.log("backend driver stripe sync skipped:", error);
    }

    const subRow = await getBestDriverSubscription(driverId, cleanEmail);

    const finalStripeCustomer = pickStripeCustomerId(
      driverRow?.stripe_customer_id,
      backendSync?.stripeCustomerId,
      backendSync?.stripe_customer_id,
      subRow?.stripe_customer_id
    );

    const finalStripeSub = pickStripeSubscriptionId(
      driverRow?.stripe_subscription_id,
      driverRow?.subscription_id,
      backendSync?.stripeSubscriptionId,
      backendSync?.stripe_subscription_id,
      subRow?.stripe_subscription_id
    );

    const finalStatus = clean(
      backendSync?.subscriptionStatus ||
        backendSync?.subscription_status ||
        subRow?.subscription_status ||
        driverRow?.subscription_status ||
        (finalStripeSub ? "active" : "pending_payment")
    );

    const active =
      isStripeCustomerId(finalStripeCustomer) &&
      isStripeSubscriptionId(finalStripeSub) &&
      isValidDriverSubscriptionStatus(finalStatus);

    if (driverId && (finalStripeCustomer || finalStripeSub)) {
      try {
        await supabase
          .from("drivers")
          .update({
            stripe_customer_id: finalStripeCustomer || null,
            stripe_subscription_id: finalStripeSub || null,
            subscription_id: finalStripeSub || null,
            subscription_status: finalStatus,
            membership_status: active ? "active" : clean(driverRow?.membership_status || "active"),
            driver_membership_paid: active || Boolean(driverRow?.driver_membership_paid),
            account_active: driverRow?.account_active !== false,
            updated_at: new Date().toISOString(),
          })
          .eq("id", driverId);
      } catch (error) {
        console.log("drivers subscription update skipped:", error);
      }
    }

    return {
      ...driverRow,
      stripe_customer_id: finalStripeCustomer,
      stripe_subscription_id: finalStripeSub,
      subscription_id: finalStripeSub,
      subscription_status: finalStatus,
      membership_status: active ? "active" : clean(driverRow?.membership_status || "active"),
      driver_membership_paid: active || Boolean(driverRow?.driver_membership_paid),
      account_active: driverRow?.account_active !== false,
    };
  }

  async function findDriverProfile(userId: string, cleanEmail: string) {
    let driver: any = null;
    let profile: any = null;

    if (userId) {
      const byId = await supabase
        .from("drivers")
        .select("*")
        .or(`id.eq.${userId},driver_id.eq.${userId},auth_user_id.eq.${userId},profile_id.eq.${userId}`)
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
        driver_id: userId || profile.auth_user_id || profile.id,
        auth_user_id: userId || profile.auth_user_id || "",
        profile_id: profile.id,
        role: "driver",
        full_name: profile.full_name || profile.name || "Farm2Home Driver",
        name: profile.full_name || profile.name || "Farm2Home Driver",
        email: profile.email || cleanEmail,
        phone: profile.phone || "",
        username: profile.username || "",
        account_id: profile.account_id || "",
      };
    }

    if (!driver) return null;

    const syncedDriver = await syncDriverSubscription(driver.id || userId, cleanEmail, driver);
    const subscription = await getBestDriverSubscription(driver.id || userId, cleanEmail);

    return mapDriver(syncedDriver, profile, subscription);
  }

  async function handleLogin() {
    const cleanEmail = normalize(email);
    const cleanPassword = clean(password);

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
      setLastCheckedDriver(normalizedDriver);

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
          "Membership Required",
          "Driver access requires a saved driver profile, Driver_ account ID, and active membership/subscription status."
        );
        return;
      }

      await saveLoggedInDriver(normalizedDriver);

      console.log("FINAL DRIVER OBJECT", {
        id: normalizedDriver.id,
        account_id: normalizedDriver.account_id,
        membership_status: normalizedDriver.membership_status,
        subscription_status: normalizedDriver.subscription_status,
        stripe_customer_id: normalizedDriver.stripe_customer_id,
        stripe_subscription_id: normalizedDriver.stripe_subscription_id,
        stripe_account_id: normalizedDriver.stripe_account_id,
        active: isDriverActive(normalizedDriver),
      });

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
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />

      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.shell}>
            <View style={styles.sidebar}>
              <View style={styles.brandRow}>
                <View style={styles.brandIcon}>
                  <Ionicons name="car-outline" size={28} color={COLORS.white} />
                </View>
                <View>
                  <Text style={styles.brandTitle}>Farm2Home</Text>
                  <Text style={styles.brandSubtitle}>Driver Portal</Text>
                </View>
              </View>

              <View style={styles.sideDivider} />

              <View style={styles.scoreCard}>
                <Text style={styles.scoreLabel}>Access Progress</Text>
                <Text style={styles.scoreValue}>{accessScore}/4</Text>
                <Text style={styles.scoreHint}>
                  Driver profile, Stripe customer, subscription, and valid membership status.
                </Text>
              </View>

              {accessStatus.map((item) => (
                <View key={item.label} style={styles.stepNav}>
                  <View style={[styles.stepNavIcon, item.complete && styles.stepNavIconDone]}>
                    <Ionicons
                      name={item.complete ? "checkmark-outline" : "ellipse-outline"}
                      size={18}
                      color={item.complete ? COLORS.white : COLORS.primary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stepNavText}>{item.label}</Text>
                    <Text style={styles.stepNavSubText}>{item.value}</Text>
                  </View>
                </View>
              ))}

              <TouchableOpacity
                style={styles.homeButton}
                onPress={() => router.replace("/" as any)}
                activeOpacity={0.9}
              >
                <Ionicons name="home-outline" size={18} color={COLORS.primary} />
                <Text style={styles.homeButtonText}>Back to Home</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.main}>
              <View style={styles.topPanel}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.eyebrow}>Driver Login</Text>
                  <Text style={styles.pageTitle}>Driver Access Center</Text>
                  <Text style={styles.pageSubtitle}>
                    Access routes, available deliveries, proof of pickup, proof of delivery, and driver earnings.
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.registerTopButton}
                  onPress={() => router.push("/driver/register" as any)}
                  disabled={loading}
                  activeOpacity={0.9}
                >
                  <Ionicons name="person-add-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.registerTopButtonText}>Register</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.metricsRow}>
                <MetricCard icon="person-outline" label="Profile" value={lastCheckedDriver?.id ? "Found" : "Pending"} />
                <MetricCard icon="card-outline" label="Subscription" value={isStripeSubscriptionId(lastCheckedDriver?.subscription_id) ? "Saved" : "Check login"} />
                <MetricCard icon="navigate-outline" label="Driver Board" value={isDriverActive(lastCheckedDriver) ? "Ready" : "Locked"} />
              </View>

              <View style={styles.card}>
                <SectionTitle
                  title="Driver Sign In"
                  subtitle="Use the email and password from driver registration."
                />

                <Field
                  label="Email Address"
                  value={email}
                  onChangeText={(value) => setEmail(normalize(value))}
                  placeholder="driver@email.com"
                  icon="mail-outline"
                  keyboardType="email-address"
                />

                <Field
                  label="Password"
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter password"
                  icon="lock-closed-outline"
                  secureTextEntry
                />

                <TouchableOpacity
                  style={[styles.primaryButton, loading && styles.disabledButton]}
                  onPress={handleLogin}
                  disabled={loading}
                  activeOpacity={0.9}
                >
                  {loading ? (
                    <ActivityIndicator color={COLORS.white} />
                  ) : (
                    <>
                      <Ionicons name="log-in-outline" size={18} color={COLORS.white} />
                      <Text style={styles.primaryButtonText}>Login to Driver Portal</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => {
                    setResetEmail(email);
                    setResetVisible(true);
                  }}
                  disabled={loading}
                  activeOpacity={0.9}
                >
                  <Ionicons name="key-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.secondaryButtonText}>Forgot Password?</Text>
                </TouchableOpacity>

                <View style={styles.noticeBox}>
                  <Ionicons name="shield-checkmark-outline" size={20} color={COLORS.primary} />
                  <Text style={styles.noticeText}>
                    Driver portal unlocks after your driver profile and membership subscription are synced.
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={resetVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <View style={styles.modalIcon}>
                <Ionicons name="key-outline" size={28} color={COLORS.white} />
              </View>

              <Text style={styles.modalTitle}>Reset Driver Password</Text>

              <Text style={styles.modalSubtitle}>
                Enter your driver email. Farm2Home will send a secure reset link if the Auth account exists.
              </Text>

              <Field
                label="Driver Email"
                value={resetEmail}
                onChangeText={(value) => setResetEmail(normalize(value))}
                placeholder="driver@email.com"
                icon="mail-outline"
                keyboardType="email-address"
              />

              <TouchableOpacity
                style={[styles.primaryButton, resetLoading && styles.disabledButton]}
                onPress={handlePasswordReset}
                disabled={resetLoading}
                activeOpacity={0.9}
              >
                {resetLoading ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <>
                    <Ionicons name="mail-outline" size={18} color={COLORS.white} />
                    <Text style={styles.primaryButtonText}>Send Reset Link</Text>
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

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionSubtitle}>{subtitle}</Text>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  icon,
  keyboardType,
  secureTextEntry,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  icon: keyof typeof Ionicons.glyphMap;
  keyboardType?: any;
  secureTextEntry?: boolean;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.inputShell}>
        <Ionicons name={icon} size={18} color={COLORS.muted} />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry={secureTextEntry}
        />
      </View>
    </View>
  );
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.metricCard}>
      <View style={styles.metricIcon}>
        <Ionicons name={icon} size={20} color={COLORS.primary} />
      </View>
      <View>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={styles.metricValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  keyboard: { flex: 1, backgroundColor: COLORS.bg },
  content: { flexGrow: 1 },
  shell: {
    flexDirection: Platform.OS === "web" ? "row" : "column",
    minHeight: "100%",
  },
  sidebar: {
    width: Platform.OS === "web" ? 270 : "100%",
    backgroundColor: COLORS.navy,
    padding: 16,
    gap: 10,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
  },
  brandIcon: {
    width: 48,
    height: 48,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  brandTitle: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: "900",
  },
  brandSubtitle: {
    color: "#A5B4FC",
    fontSize: 12,
    fontWeight: "800",
  },
  sideDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
    marginVertical: 8,
  },
  scoreCard: {
    backgroundColor: "#111827",
    borderRadius: 18,
    padding: 16,
    marginBottom: 2,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  scoreLabel: {
    color: "#CBD5E1",
    fontSize: 12,
    fontWeight: "900",
  },
  scoreValue: {
    color: COLORS.white,
    fontSize: 32,
    fontWeight: "900",
    marginTop: 6,
  },
  scoreHint: {
    color: "#A5B4FC",
    lineHeight: 18,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },
  stepNav: {
    backgroundColor: "#111827",
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  stepNavIcon: {
    width: 30,
    height: 30,
    borderRadius: 12,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNavIconDone: {
    backgroundColor: COLORS.accent,
  },
  stepNavText: {
    color: "#CBD5E1",
    fontWeight: "900",
  },
  stepNavSubText: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },
  homeButton: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "rgba(99,91,255,0.55)",
    borderRadius: 14,
    padding: 13,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  homeButtonText: {
    color: COLORS.white,
    fontWeight: "900",
  },
  main: {
    flex: 1,
    padding: 16,
  },
  topPanel: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 22,
    padding: 18,
    flexDirection: Platform.OS === "web" ? "row" : "column",
    gap: 12,
    alignItems: Platform.OS === "web" ? "center" : "stretch",
    marginBottom: 14,
  },
  eyebrow: {
    color: COLORS.primary,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontSize: 12,
    fontWeight: "900",
  },
  pageTitle: {
    color: COLORS.text,
    fontSize: 30,
    fontWeight: "900",
    marginTop: 4,
  },
  pageSubtitle: {
    color: COLORS.muted,
    lineHeight: 20,
    fontWeight: "700",
    marginTop: 4,
  },
  registerTopButton: {
    backgroundColor: COLORS.primarySoft,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  registerTopButtonText: {
    color: COLORS.primary,
    fontWeight: "900",
  },
  metricsRow: {
    flexDirection: Platform.OS === "web" ? "row" : "column",
    gap: 12,
    marginBottom: 14,
  },
  metricCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  metricIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  metricLabel: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  metricValue: {
    color: COLORS.text,
    fontWeight: "900",
    marginTop: 3,
  },
  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 22,
    padding: 18,
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "900",
  },
  sectionSubtitle: {
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 4,
    lineHeight: 20,
  },
  fieldWrap: {
    marginBottom: 13,
  },
  inputLabel: {
    color: COLORS.text,
    fontWeight: "900",
    marginBottom: 7,
  },
  inputShell: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 15,
    paddingHorizontal: 12,
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  input: {
    flex: 1,
    color: COLORS.text,
    fontWeight: "700",
    paddingVertical: 12,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    padding: 15,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontWeight: "900",
  },
  secondaryButton: {
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    padding: 15,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  secondaryButtonText: {
    color: COLORS.primary,
    fontWeight: "900",
  },
  disabledButton: { opacity: 0.6 },
  noticeBox: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 13,
    flexDirection: "row",
    gap: 9,
    alignItems: "center",
    marginTop: 14,
  },
  noticeText: {
    color: COLORS.muted,
    flex: 1,
    fontWeight: "700",
    lineHeight: 19,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 22,
    maxHeight: "90%",
  },
  modalIcon: {
    width: 54,
    height: 54,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
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
    color: COLORS.text,
  },
  modalSubtitle: {
    textAlign: "center",
    color: COLORS.muted,
    lineHeight: 22,
    marginBottom: 18,
    fontWeight: "700",
  },
  closeButton: { marginTop: 18, alignItems: "center" },
  closeText: { color: COLORS.danger, fontWeight: "900" },
});
