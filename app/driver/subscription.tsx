// app/driver/subscription.tsx

import React, { useEffect, useState } from "react";
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
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { PAYMENT_LINKS } from "../config/paymentLinks";
import freightTheme from "../styles/freightTheme";

type DriverProfile = {
  id?: string;
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
};

export default function DriverSubscriptionScreen() {
  const [loading, setLoading] = useState(false);
  const [driver, setDriver] = useState<DriverProfile | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    loadDriver();
  }, []);

  async function loadDriver() {
    try {
      const rawDriver =
        (await AsyncStorage.getItem("currentDriver")) ||
        (await AsyncStorage.getItem("currentUser"));

      if (!rawDriver) return;

      const parsed = JSON.parse(rawDriver);

      setDriver(parsed);
      setName(parsed.name || parsed.fullName || parsed.driverName || "");
      setEmail(parsed.email || "");
    } catch (error) {
      console.log("Load driver error:", error);
    }
  }

  async function saveDriverProfile() {
    const driverId = driver?.id || `driver_${Date.now()}`;

    const updatedDriver: DriverProfile = {
      ...driver,
      id: driverId,
      name: name.trim(),
      fullName: name.trim(),
      email: email.trim().toLowerCase(),
      role: "driver",
      driverSubscriptionActive: false,
      hasActiveSubscription: false,
      driverBoardAccess: false,
      membershipStatus: "pending_payment",
      subscriptionStatus: "pending_payment",
    };

    await AsyncStorage.setItem("currentDriver", JSON.stringify(updatedDriver));
    await AsyncStorage.setItem("currentUser", JSON.stringify(updatedDriver));
    await AsyncStorage.setItem("currentUserRole", "driver");
    await AsyncStorage.setItem("userRole", "driver");
    await AsyncStorage.setItem(
      "pendingDriverSubscription",
      JSON.stringify(updatedDriver)
    );

    setDriver(updatedDriver);

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

      await saveDriverProfile();

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

      await AsyncStorage.setItem("currentDriver", JSON.stringify(activatedDriver));
      await AsyncStorage.setItem("currentUser", JSON.stringify(activatedDriver));
      await AsyncStorage.setItem("currentUserRole", "driver");
      await AsyncStorage.setItem("userRole", "driver");
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

  function showMembershipInfo() {
    Alert.alert(
      "Driver Board Membership",
      "Drivers need the Driver Board membership to accept local Farm2Home delivery opportunities posted to the open board."
    );
  }

  function membershipStatus() {
    return driver?.membershipStatus || driver?.subscriptionStatus || "Not Started";
  }

  function statusColor() {
    const status = String(membershipStatus()).toLowerCase();

    if (status.includes("active")) return "#10B981";
    if (status.includes("pending")) return "#F59E0B";
    if (status.includes("cancel")) return "#DC2626";

    return "#64748B";
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#020617" />

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
                <Text style={styles.eyebrow}>Farm2Home Driver</Text>
                <Text style={styles.title}>Driver Board Membership</Text>
                <Text style={styles.subtitle}>
                  Subscribe to access local Farm2Home delivery jobs, route tools,
                  proof workflows, and driver earnings.
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
              <Text style={styles.priceSub}>Access the Driver Delivery Board</Text>
            </View>

            <View style={styles.priceBadge}>
              <Ionicons name="flash-outline" size={22} color="#BBF7D0" />
            </View>
          </View>

          <View style={styles.statusCard}>
            <Text style={styles.statusLabel}>Current Membership Status</Text>
            <View style={[styles.statusPill, { backgroundColor: statusColor() }]}>
              <Text style={styles.statusPillText}>{membershipStatus()}</Text>
            </View>
            <Text style={styles.statusHelp}>
              Active membership unlocks the Driver Board and local delivery
              acceptance tools.
            </Text>
          </View>

          <View style={styles.featureBox}>
            <SectionHeader
              icon="sparkles-outline"
              title="Membership Includes"
              subtitle="Everything needed to accept and complete local deliveries."
            />

            {[
              "Open Driver Board access",
              "Local farm delivery opportunities",
              "Delivery acceptance tools",
              "Proof-of-pickup workflow",
              "Proof-of-delivery workflow",
              "Route and live delivery tracking",
            ].map((item) => (
              <View key={item} style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                <Text style={styles.featureText}>{item}</Text>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <SectionHeader
              icon="person-outline"
              title="Driver Profile"
              subtitle="Confirm your membership billing profile."
            />

            <Text style={styles.inputLabel}>Driver Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Driver Name"
              placeholderTextColor="#94A3B8"
              value={name}
              onChangeText={setName}
            />

            <Text style={styles.inputLabel}>Driver Email</Text>
            <TextInput
              style={styles.input}
              placeholder="Driver Email"
              placeholderTextColor="#94A3B8"
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
              onPress={() => router.push("/driver/board" as any)}
            >
              <Ionicons
                name="list-outline"
                size={18}
                color={freightTheme.colors.primary}
              />
              <Text style={styles.secondaryButtonText}>View Driver Board</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.linkButton} onPress={showMembershipInfo}>
              <Text style={styles.linkButtonText}>Why do I need a membership?</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.quickGrid}>
            <QuickLink
              icon="person-outline"
              label="Profile"
              route="/driver/profile"
            />
            <QuickLink
              icon="phone-portrait-outline"
              label="Driver App"
              route="/driver/mobile-driver-app"
            />
            <QuickLink icon="wallet-outline" label="Earnings" route="/driver/earnings" />
            <QuickLink
              icon="notifications-outline"
              label="Alerts"
              route="/driver/notifications"
            />
          </View>

          <Text style={styles.footer}>
            Production Mode Enabled · Stripe Live Payment Link Active
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
    <TouchableOpacity
      style={styles.quickLink}
      onPress={() => router.push(route as any)}
    >
      <Ionicons name={icon} size={22} color="#10B981" />
      <Text style={styles.quickLinkText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: freightTheme.colors.background,
  },
  keyboard: {
    flex: 1,
    backgroundColor: freightTheme.colors.background,
  },
  content: {
    paddingBottom: 90,
  },
  hero: {
    backgroundColor: "#020617",
    paddingTop: 22,
    paddingHorizontal: 20,
    paddingBottom: 26,
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#064E3B",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#10B981",
  },
  eyebrow: {
    color: "#10B981",
    fontWeight: "900",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900",
    marginBottom: 10,
  },
  subtitle: {
    color: "#D1D5DB",
    lineHeight: 23,
    fontSize: 15,
    fontWeight: "700",
  },
  priceCard: {
    backgroundColor: "#064E3B",
    borderRadius: 20,
    padding: 18,
    marginHorizontal: 18,
    marginTop: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#10B981",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  priceLabel: {
    color: "#BBF7D0",
    fontWeight: "900",
  },
  price: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "900",
    marginTop: 4,
  },
  priceSub: {
    color: "#D1FAE5",
    marginTop: 4,
    fontWeight: "800",
  },
  priceBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#052E2B",
    alignItems: "center",
    justifyContent: "center",
  },
  statusCard: {
    backgroundColor: freightTheme.colors.card,
    borderRadius: 20,
    padding: 18,
    marginHorizontal: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
  },
  statusLabel: {
    color: freightTheme.colors.text,
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
    color: freightTheme.colors.mutedText,
    fontWeight: "700",
    lineHeight: 21,
    marginTop: 12,
  },
  featureBox: {
    backgroundColor: freightTheme.colors.card,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
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
    borderRadius: 20,
    backgroundColor: freightTheme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    color: freightTheme.colors.text,
    fontSize: 21,
    fontWeight: "900",
  },
  sectionSubtitle: {
    color: freightTheme.colors.mutedText,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 3,
  },
  featureItem: {
    backgroundColor: freightTheme.colors.surface,
    borderRadius: 14,
    padding: 13,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  featureText: {
    color: freightTheme.colors.text,
    fontWeight: "800",
    flex: 1,
    lineHeight: 20,
  },
  card: {
    backgroundColor: freightTheme.colors.card,
    borderRadius: 22,
    padding: 18,
    marginHorizontal: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
  },
  inputLabel: {
    color: freightTheme.colors.text,
    fontWeight: "900",
    marginBottom: 7,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },
  primaryButton: {
    backgroundColor: freightTheme.colors.primary,
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
    backgroundColor: "#111827",
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
    backgroundColor: freightTheme.colors.surface,
    borderWidth: 1,
    borderColor: freightTheme.colors.primary,
    paddingVertical: 15,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
  },
  secondaryButtonText: {
    color: freightTheme.colors.primary,
    fontWeight: "900",
  },
  linkButton: {
    paddingVertical: 14,
    alignItems: "center",
  },
  linkButtonText: {
    color: freightTheme.colors.primary,
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
    backgroundColor: freightTheme.colors.card,
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
    alignItems: "center",
    gap: 8,
  },
  quickLinkText: {
    color: freightTheme.colors.text,
    fontWeight: "900",
  },
  footer: {
    color: freightTheme.colors.mutedText,
    textAlign: "center",
    marginTop: 4,
    lineHeight: 21,
    fontWeight: "700",
    paddingHorizontal: 18,
  },
});