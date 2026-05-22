import React, { useEffect, useState } from "react";
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
import * as WebBrowser from "expo-web-browser";
import { router } from "expo-router";

import { PAYMENT_LINKS } from "../config/paymentLinks";

type DriverProfile = {
  id?: string;
  name?: string;
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
      setName(parsed.name || parsed.driverName || "");
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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.logo}>Farm2Home</Text>

        <Text style={styles.title}>Driver Board Membership</Text>

        <Text style={styles.price}>Driver Access Plan</Text>

        <Text style={styles.description}>
          Join the Farm2Home Driver Board to access available local farm delivery
          jobs. Preferred farmer drivers receive first access, then remaining
          jobs open to subscribed board drivers.
        </Text>

        <View style={styles.featureBox}>
          <Text style={styles.featureTitle}>Membership Includes:</Text>

          {[
            "Open Driver Board access",
            "Local farm delivery opportunities",
            "Delivery acceptance tools",
            "Proof-of-pickup workflow",
            "Proof-of-delivery workflow",
            "Route and live delivery tracking",
          ].map((item) => (
            <Text key={item} style={styles.featureItem}>
              {`\u2022 ${item}`}
            </Text>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Driver Profile</Text>

          <TextInput
            style={styles.input}
            placeholder="Driver Name"
            placeholderTextColor="#94A3B8"
            value={name}
            onChangeText={setName}
          />

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
              <Text style={styles.primaryButtonText}>
                Pay Driver Membership with Stripe
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.completedButton}
            onPress={continueAfterPayment}
            activeOpacity={0.85}
          >
            <Text style={styles.completedButtonText}>I Completed Payment</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push("/driver/board" as any)}
          >
            <Text style={styles.secondaryButtonText}>View Driver Board</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkButton} onPress={showMembershipInfo}>
            <Text style={styles.linkButtonText}>Why do I need a membership?</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>
          Production Mode Enabled · Stripe Live Payment Link Active
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A",
  },

  content: {
    flexGrow: 1,
    padding: 22,
    justifyContent: "center",
  },

  logo: {
    color: "#22C55E",
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 8,
  },

  title: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "900",
    textAlign: "center",
  },

  price: {
    color: "#86EFAC",
    fontSize: 30,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 10,
  },

  description: {
    color: "#CBD5E1",
    textAlign: "center",
    lineHeight: 23,
    fontWeight: "700",
    marginTop: 14,
    marginBottom: 20,
  },

  featureBox: {
    backgroundColor: "#1E293B",
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: "#334155",
    marginBottom: 18,
  },

  featureTitle: {
    color: "#22C55E",
    fontWeight: "900",
    fontSize: 18,
    marginBottom: 10,
  },

  featureItem: {
    color: "#E5E7EB",
    fontWeight: "700",
    marginBottom: 7,
    lineHeight: 20,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
  },

  cardTitle: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 14,
  },

  input: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },

  primaryButton: {
    backgroundColor: "#15803D",
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: "center",
    marginTop: 6,
    minHeight: 56,
    justifyContent: "center",
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
    marginTop: 12,
  },

  completedButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  secondaryButton: {
    backgroundColor: "#E5E7EB",
    paddingVertical: 15,
    borderRadius: 18,
    alignItems: "center",
    marginTop: 12,
  },

  secondaryButtonText: {
    color: "#111827",
    fontWeight: "900",
  },

  linkButton: {
    paddingVertical: 14,
    alignItems: "center",
  },

  linkButtonText: {
    color: "#15803D",
    fontWeight: "900",
  },

  footer: {
    color: "#94A3B8",
    textAlign: "center",
    marginTop: 20,
    lineHeight: 21,
    fontWeight: "700",
  },
});