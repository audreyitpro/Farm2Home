// app/driver/subscription.tsx

import React, { useCallback, useState } from "react";
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
import * as WebBrowser from "expo-web-browser";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { PAYMENT_LINKS } from "../config/paymentLinks";
import { getBackendUrl } from "../services/apiConfig";
import { supabase } from "../services/supabaseClient";

type DriverProfile = {
  id?: string;
  driverId?: string;
  authUserId?: string;
  profileId?: string;
  profile_id?: string;
  name?: string;
  driverName?: string;
  fullName?: string;
  email?: string;
  role?: string;
  driverSubscriptionActive?: boolean;
  subscriptionStatus?: string;
  membershipStatus?: string;
  hasActiveSubscription?: boolean;
  driverBoardAccess?: boolean;
  stripeCustomerId?: string;
  stripe_customer_id?: string;
  stripeSubscriptionId?: string;
  stripe_subscription_id?: string;
  subscriptionId?: string;
  freightEligible?: boolean;
  farm2DriverEligible?: boolean;
};

const COLORS = {
  bg: "#F4F5F7",
  card: "#FFFFFF",
  surface: "#F9FAFB",
  black: "#050505",
  red: "#D71920",
  redDark: "#9F1117",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  green: "#16A34A",
  amber: "#D97706",
  slate: "#475569",
};

function normalize(value: any) {
  return String(value || "").trim().toLowerCase();
}

export default function DriverSubscriptionScreen() {
  const [loading, setLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [driver, setDriver] = useState<DriverProfile | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  useFocusEffect(
    useCallback(() => {
      loadDriver();
    }, [])
  );

  async function getStoredDriver() {
    const raw =
      (await AsyncStorage.getItem("currentDriver")) ||
      (await AsyncStorage.getItem("farm2homeCurrentDriver")) ||
      (await AsyncStorage.getItem("farm2homeDriverSession")) ||
      (await AsyncStorage.getItem("currentUser"));

    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async function loadDriver() {
    try {
      const stored = await getStoredDriver();
      const { data: authData } = await supabase.auth.getUser();
      const authUser = authData?.user;

      const driverId = stored?.id || stored?.driverId || authUser?.id || "";
      const authEmail = normalize(stored?.email || authUser?.email || "");

      let dbDriver: any = null;

      if (driverId) {
        const result = await supabase
          .from("drivers")
          .select("*")
          .eq("id", driverId)
          .maybeSingle();

        if (!result.error && result.data) dbDriver = result.data;
      }

      if (!dbDriver && authEmail) {
        const result = await supabase
          .from("drivers")
          .select("*")
          .eq("email", authEmail)
          .maybeSingle();

        if (!result.error && result.data) dbDriver = result.data;
      }

      const merged: DriverProfile = {
        ...(stored || {}),
        ...(dbDriver || {}),
        id: dbDriver?.id || stored?.id || stored?.driverId || authUser?.id || "",
        driverId: dbDriver?.id || stored?.driverId || stored?.id || authUser?.id || "",
        authUserId: dbDriver?.auth_user_id || stored?.authUserId || authUser?.id || "",
        profileId: dbDriver?.profile_id || stored?.profileId || "",
        profile_id: dbDriver?.profile_id || stored?.profile_id || "",
        role: "driver",
        name:
          dbDriver?.name ||
          dbDriver?.full_name ||
          stored?.name ||
          stored?.fullName ||
          stored?.driverName ||
          "",
        fullName:
          dbDriver?.full_name ||
          dbDriver?.name ||
          stored?.fullName ||
          stored?.name ||
          stored?.driverName ||
          "",
        driverName:
          dbDriver?.full_name ||
          dbDriver?.name ||
          stored?.driverName ||
          stored?.fullName ||
          "",
        email: normalize(dbDriver?.email || stored?.email || authEmail),
        membershipStatus:
          dbDriver?.membership_status || stored?.membershipStatus || "not_started",
        subscriptionStatus:
          dbDriver?.subscription_status || stored?.subscriptionStatus || "not_started",
        driverSubscriptionActive:
          dbDriver?.subscription_status === "active" ||
          stored?.driverSubscriptionActive ||
          false,
        hasActiveSubscription:
          dbDriver?.subscription_status === "active" ||
          stored?.hasActiveSubscription ||
          false,
        driverBoardAccess:
          dbDriver?.subscription_status === "active" ||
          stored?.driverBoardAccess ||
          false,
        stripeCustomerId: dbDriver?.stripe_customer_id || stored?.stripeCustomerId || "",
        stripe_customer_id: dbDriver?.stripe_customer_id || stored?.stripe_customer_id || "",
        stripeSubscriptionId:
          dbDriver?.stripe_subscription_id ||
          stored?.stripeSubscriptionId ||
          stored?.subscriptionId ||
          "",
        stripe_subscription_id:
          dbDriver?.stripe_subscription_id ||
          stored?.stripe_subscription_id ||
          stored?.subscriptionId ||
          "",
        freightEligible: dbDriver?.freight_eligible ?? stored?.freightEligible ?? false,
        farm2DriverEligible:
          dbDriver?.farm2driver_eligible ?? stored?.farm2DriverEligible ?? true,
      };

      setDriver(merged);
      setName(merged.name || merged.fullName || merged.driverName || "");
      setEmail(merged.email || "");

      await persistDriver(merged, false);
    } catch (error) {
      console.log("Load driver error:", error);
    }
  }

  async function persistDriver(updatedDriver: DriverProfile, saveToSupabase = true) {
    const now = new Date().toISOString();

    const normalizedDriver: DriverProfile = {
      ...updatedDriver,
      id: updatedDriver.id || updatedDriver.driverId || updatedDriver.authUserId,
      driverId: updatedDriver.driverId || updatedDriver.id || updatedDriver.authUserId,
      role: "driver",
      email: normalize(updatedDriver.email),
    };

    if (saveToSupabase && normalizedDriver.id) {
      const { error } = await supabase
        .from("drivers")
        .update({
          full_name: normalizedDriver.fullName || normalizedDriver.name,
          name: normalizedDriver.fullName || normalizedDriver.name,
          email: normalizedDriver.email,
          membership_status: normalizedDriver.membershipStatus,
          subscription_status: normalizedDriver.subscriptionStatus,
          updated_at: now,
        })
        .eq("id", normalizedDriver.id);

      if (error) throw error;
    }

    await AsyncStorage.setItem("currentDriver", JSON.stringify(normalizedDriver));
    await AsyncStorage.setItem("currentUser", JSON.stringify(normalizedDriver));
    await AsyncStorage.setItem("farm2homeCurrentDriver", JSON.stringify(normalizedDriver));
    await AsyncStorage.setItem("farm2homeDriverSession", JSON.stringify(normalizedDriver));
    await AsyncStorage.setItem("currentUserRole", "driver");
    await AsyncStorage.setItem("userRole", "driver");

    setDriver(normalizedDriver);
  }

  async function savePendingDriverProfile() {
    const driverId = driver?.id || driver?.driverId || `driver_${Date.now()}`;

    const updatedDriver: DriverProfile = {
      ...driver,
      id: driverId,
      driverId,
      name: name.trim(),
      fullName: name.trim(),
      driverName: name.trim(),
      email: email.trim().toLowerCase(),
      role: "driver",
      driverSubscriptionActive: false,
      hasActiveSubscription: false,
      driverBoardAccess: false,
      membershipStatus: "pending_payment",
      subscriptionStatus: "pending_payment",
    };

    await persistDriver(updatedDriver, true);
    await AsyncStorage.setItem("pendingDriverSubscription", JSON.stringify(updatedDriver));

    return updatedDriver;
  }

  async function openCheckoutUrl(url: string) {
    if (!url || !url.startsWith("http")) {
      Alert.alert("Stripe Error", "Invalid Stripe checkout URL.");
      return;
    }

    if (Platform.OS === "web") {
      window.location.href = url;
      return;
    }

    await WebBrowser.openBrowserAsync(url);
  }

  async function startDriverMembership() {
    try {
      if (loading) return;

      if (!name.trim()) {
        Alert.alert("Name Required", "Please enter your driver name.");
        return;
      }

      if (!email.trim() || !email.includes("@")) {
        Alert.alert("Email Required", "Please enter a valid email.");
        return;
      }

      setLoading(true);

      await savePendingDriverProfile();

      const stripeUrl = PAYMENT_LINKS.driverMembership;

      if (!stripeUrl) {
        throw new Error("Driver membership payment link missing.");
      }

      await openCheckoutUrl(stripeUrl);

      Alert.alert(
        "Complete Payment",
        "After payment is complete, return to Farm2Home and tap 'I Completed Payment'."
      );
    } catch (error: any) {
      console.log("Driver membership error:", error);
      Alert.alert(
        "Membership Error",
        error?.message || "Unable to start Driver Board membership."
      );
    } finally {
      setLoading(false);
    }
  }

  async function continueAfterPayment() {
    try {
      const pending = await AsyncStorage.getItem("pendingDriverSubscription");

      if (!pending) {
        Alert.alert(
          "No Pending Membership",
          "Please complete Driver Board membership payment first."
        );
        return;
      }

      const pendingDriver = JSON.parse(pending);

      const activatedDriver: DriverProfile = {
        ...pendingDriver,
        role: "driver",
        driverSubscriptionActive: true,
        hasActiveSubscription: true,
        driverBoardAccess: true,
        membershipStatus: "active",
        subscriptionStatus: "active",
      };

      await persistDriver(activatedDriver, true);
      await AsyncStorage.setItem("driverSubscriptionStatus", "active");
      await AsyncStorage.removeItem("pendingDriverSubscription");

      Alert.alert(
        "Membership Active",
        "Your Driver Board membership is active. You can now accept delivery jobs.",
        [
          {
            text: "Go to Driver Board",
            onPress: () => router.replace("/driver/board" as any),
          },
        ]
      );
    } catch (error: any) {
      console.log("Driver activation error:", error);
      Alert.alert(
        "Activation Error",
        error?.message || "Unable to activate Driver Board membership."
      );
    }
  }

  async function manageBilling() {
    const stripeCustomerId =
      driver?.stripeCustomerId ||
      driver?.stripe_customer_id ||
      "";

    if (!stripeCustomerId) {
      Alert.alert(
        "Missing Stripe Customer",
        "No Stripe customer ID was found. If you just paid, wait a moment and log back in."
      );
      return;
    }

    try {
      setPortalLoading(true);

      const response = await fetch(`${getBackendUrl()}/payments/create-customer-portal-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: stripeCustomerId,
          role: "driver",
          driverId: driver?.id || driver?.driverId,
          returnUrl:
            Platform.OS === "web"
              ? window.location.href
              : "farm2home://driver/subscription",
        }),
      });

      const data = await response.json();

      if (!response.ok || data.error || !data.url) {
        Alert.alert("Billing Error", data.error || "Unable to open billing portal.");
        return;
      }

      await openCheckoutUrl(data.url);
    } catch (error: any) {
      Alert.alert("Billing Error", error?.message || "Unable to open billing portal.");
    } finally {
      setPortalLoading(false);
    }
  }

  async function cancelSubscription() {
    const subscriptionId =
      driver?.stripeSubscriptionId ||
      driver?.stripe_subscription_id ||
      driver?.subscriptionId ||
      "";

    if (!subscriptionId) {
      Alert.alert("No Subscription", "No active driver subscription ID was found.");
      return;
    }

    Alert.alert(
      "Cancel Subscription",
      "Are you sure you want to cancel your Farm2Driver membership?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            try {
              setCancelLoading(true);

              const response = await fetch(`${getBackendUrl()}/payments/cancel-subscription`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  subscriptionId,
                  driverId: driver?.id || driver?.driverId,
                  role: "driver",
                }),
              });

              const data = await response.json();

              if (!response.ok || data.error) {
                Alert.alert("Stripe Error", data.error || "Unable to cancel.");
                return;
              }

              const updatedDriver: DriverProfile = {
                ...driver,
                membershipStatus: "canceled",
                subscriptionStatus: "canceled",
                driverSubscriptionActive: false,
                hasActiveSubscription: false,
                driverBoardAccess: false,
              };

              await persistDriver(updatedDriver, true);
              Alert.alert("Canceled", "Driver subscription was canceled.");
            } catch (error: any) {
              Alert.alert("Cancel Error", error?.message || "Unable to cancel subscription.");
            } finally {
              setCancelLoading(false);
            }
          },
        },
      ]
    );
  }

  function showMembershipInfo() {
    Alert.alert(
      "Driver Board Membership",
      "Drivers need the Farm2Driver membership to accept local delivery jobs, view board opportunities, use proof workflows, and manage driver earnings."
    );
  }

  function membershipStatus() {
    return driver?.membershipStatus || driver?.subscriptionStatus || "not_started";
  }

  function statusColor() {
    const status = normalize(membershipStatus());

    if (status.includes("active")) return COLORS.green;
    if (status.includes("pending")) return COLORS.amber;
    if (status.includes("cancel")) return COLORS.red;

    return COLORS.slate;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />

      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.heroTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.eyebrow}>Farm2Driver Billing</Text>
                <Text style={styles.title}>Driver Membership</Text>
                <Text style={styles.subtitle}>
                  Subscribe to access local Farm2Home delivery jobs, route tools,
                  proof workflows, freight support, and driver earnings.
                </Text>
              </View>

              <View style={styles.heroIcon}>
                <Ionicons name="card-outline" size={34} color="#FFFFFF" />
              </View>
            </View>
          </View>

          <View style={styles.priceCard}>
            <View>
              <Text style={styles.priceLabel}>Driver Access Plan</Text>
              <Text style={styles.price}>$4.99 / month</Text>
              <Text style={styles.priceSub}>Unlock Driver Board + delivery workflows</Text>
            </View>

            <View style={styles.priceBadge}>
              <Ionicons name="flash-outline" size={22} color="#FFFFFF" />
            </View>
          </View>

          <View style={styles.statusCard}>
            <Text style={styles.statusLabel}>Current Membership Status</Text>
            <View style={[styles.statusPill, { backgroundColor: statusColor() }]}>
              <Text style={styles.statusPillText}>{membershipStatus()}</Text>
            </View>
            <Text style={styles.statusHelp}>
              Active membership unlocks the Driver Board, local deliveries, freight
              visibility, proof workflows, and driver earnings tools.
            </Text>
          </View>

          <View style={styles.featureBox}>
            <SectionHeader
              icon="sparkles-outline"
              title="Membership Includes"
              subtitle="Everything needed to accept and complete Farm2Home driver work."
            />

            {[
              "Open Driver Board access",
              "Local farm delivery opportunities",
              "Freight board support when eligible",
              "Delivery acceptance tools",
              "Proof-of-pickup workflow",
              "Proof-of-delivery workflow",
              "Route and live delivery tracking",
              "Driver earnings dashboard",
            ].map((item) => (
              <View key={item} style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={18} color={COLORS.green} />
                <Text style={styles.featureText}>{item}</Text>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <SectionHeader
              icon="person-outline"
              title="Driver Billing Profile"
              subtitle="Confirm the driver name and email used for membership billing."
            />

            <Text style={styles.inputLabel}>Driver Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Driver Name"
              placeholderTextColor="#9CA3AF"
              value={name}
              onChangeText={setName}
            />

            <Text style={styles.inputLabel}>Driver Email</Text>
            <TextInput
              style={styles.input}
              placeholder="Driver Email"
              placeholderTextColor="#9CA3AF"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
            />

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.disabledButton]}
              onPress={startDriverMembership}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="card-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.primaryButtonText}>
                    Pay Driver Membership with Stripe
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.completedButton}
              onPress={continueAfterPayment}
              activeOpacity={0.85}
            >
              <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
              <Text style={styles.completedButtonText}>I Completed Payment</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={manageBilling}
              disabled={portalLoading}
            >
              {portalLoading ? (
                <ActivityIndicator color={COLORS.red} />
              ) : (
                <>
                  <Ionicons name="settings-outline" size={18} color={COLORS.red} />
                  <Text style={styles.secondaryButtonText}>Manage Billing Portal</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={cancelSubscription}
              disabled={cancelLoading}
            >
              {cancelLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="close-circle-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.cancelButtonText}>Cancel Subscription</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.linkButton} onPress={showMembershipInfo}>
              <Text style={styles.linkButtonText}>Why do I need a membership?</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.quickGrid}>
            <QuickLink icon="person-outline" label="Profile" route="/driver/profile" />
            <QuickLink
              icon="phone-portrait-outline"
              label="Driver Hub"
              route="/driver/mobile-driver-app"
            />
            <QuickLink icon="list-outline" label="Board" route="/driver/board" />
            <QuickLink icon="wallet-outline" label="Earnings" route="/driver/earnings" />
            <QuickLink
              icon="notifications-outline"
              label="Alerts"
              route="/driver/notifications"
            />
            <QuickLink
              icon="cube-outline"
              label="Deliveries"
              route="/driver/my-deliveries"
            />
          </View>

          <TouchableOpacity
            style={styles.darkButton}
            onPress={() => router.replace("/driver/mobile-driver-app" as any)}
          >
            <Text style={styles.darkButtonText}>Back to Driver Hub</Text>
          </TouchableOpacity>

          <Text style={styles.footer}>
            Production Mode Enabled · Stripe Live Driver Membership
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIcon}>
        <Ionicons name={icon} size={20} color="#FFFFFF" />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

function QuickLink({
  icon,
  label,
  route,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  route: string;
}) {
  return (
    <TouchableOpacity style={styles.quickLink} onPress={() => router.push(route as any)}>
      <Ionicons name={icon} size={22} color={COLORS.red} />
      <Text style={styles.quickLinkText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  keyboard: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  content: {
    paddingBottom: 90,
  },
  hero: {
    backgroundColor: COLORS.black,
    paddingTop: 28,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 24,
    backgroundColor: COLORS.red,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: {
    color: "#FCA5A5",
    fontWeight: "900",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontSize: 12,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "900",
    marginBottom: 10,
  },
  subtitle: {
    color: "#D1D5DB",
    lineHeight: 22,
    fontSize: 14,
    fontWeight: "700",
  },
  priceCard: {
    backgroundColor: COLORS.red,
    borderRadius: 22,
    padding: 18,
    marginHorizontal: 18,
    marginTop: 18,
    marginBottom: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  priceLabel: {
    color: "#FFE4E6",
    fontWeight: "900",
  },
  price: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "900",
    marginTop: 4,
  },
  priceSub: {
    color: "#FFE4E6",
    marginTop: 4,
    fontWeight: "800",
  },
  priceBadge: {
    width: 52,
    height: 52,
    borderRadius: 20,
    backgroundColor: COLORS.black,
    alignItems: "center",
    justifyContent: "center",
  },
  statusCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 18,
    marginHorizontal: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statusLabel: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 10,
  },
  statusPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusPillText: {
    color: "#FFFFFF",
    fontWeight: "900",
    textTransform: "capitalize",
  },
  statusHelp: {
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 21,
    marginTop: 12,
  },
  featureBox: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginHorizontal: 18,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    marginBottom: 14,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: COLORS.black,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 21,
    fontWeight: "900",
  },
  sectionSubtitle: {
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 3,
  },
  featureItem: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  featureText: {
    color: COLORS.text,
    fontWeight: "800",
    flex: 1,
    lineHeight: 20,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 18,
    marginHorizontal: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  inputLabel: {
    color: COLORS.text,
    fontWeight: "900",
    marginBottom: 7,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
  },
  primaryButton: {
    backgroundColor: COLORS.red,
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
    minHeight: 56,
    flexDirection: "row",
    gap: 8,
  },
  disabledButton: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 15,
  },
  completedButton: {
    backgroundColor: COLORS.black,
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
  },
  completedButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  secondaryButton: {
    backgroundColor: "#FFF1F2",
    borderWidth: 1,
    borderColor: COLORS.red,
    paddingVertical: 15,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
  },
  secondaryButtonText: {
    color: COLORS.red,
    fontWeight: "900",
  },
  cancelButton: {
    backgroundColor: COLORS.redDark,
    paddingVertical: 15,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
  },
  cancelButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  linkButton: {
    paddingVertical: 14,
    alignItems: "center",
  },
  linkButtonText: {
    color: COLORS.red,
    fontWeight: "900",
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 18,
    marginBottom: 16,
  },
  quickLink: {
    width: "48%",
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    gap: 8,
  },
  quickLinkText: {
    color: COLORS.text,
    fontWeight: "900",
  },
  darkButton: {
    backgroundColor: COLORS.black,
    padding: 15,
    borderRadius: 16,
    alignItems: "center",
    marginHorizontal: 18,
    marginBottom: 14,
  },
  darkButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  footer: {
    color: COLORS.muted,
    textAlign: "center",
    marginTop: 4,
    lineHeight: 21,
    fontWeight: "700",
    paddingHorizontal: 18,
  },
});