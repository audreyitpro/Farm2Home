import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as WebBrowser from "expo-web-browser";
import { router, useFocusEffect } from "expo-router";

import { API_BASE_URL } from "../config/api";

type FarmerProfile = {
  id?: string;
  farmName?: string;
  businessName?: string;
  email?: string;
  stripeAccountId?: string;
  farmerStripeAccountId?: string;
  stripePayoutsEnabled?: boolean;
  stripeChargesEnabled?: boolean;
  stripeOnboardingComplete?: boolean;
  payoutsEnabled?: boolean;
  chargesEnabled?: boolean;
  detailsSubmitted?: boolean;
};

export default function ConnectBankScreen() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<FarmerProfile | null>(null);

  useFocusEffect(
    useCallback(() => {
      checkStripeStatus();
    }, [])
  );

  async function getCurrentFarmer(): Promise<FarmerProfile | null> {
    const rawFarmer =
      (await AsyncStorage.getItem("currentFarmer")) ||
      (await AsyncStorage.getItem("currentUser"));

    if (!rawFarmer) return null;

    try {
      return JSON.parse(rawFarmer);
    } catch (error) {
      console.log("Parse currentFarmer error:", error);
      return null;
    }
  }

  function getStripeAccountId(farmer: FarmerProfile | null) {
    return (
      farmer?.stripeAccountId ||
      farmer?.farmerStripeAccountId ||
      ""
    );
  }

  async function saveUpdatedFarmer(updatedFarmer: FarmerProfile) {
    await AsyncStorage.setItem("currentFarmer", JSON.stringify(updatedFarmer));
    await AsyncStorage.setItem("currentUser", JSON.stringify(updatedFarmer));
    await AsyncStorage.setItem("currentUserRole", "farmer");
  }

  async function openExternalUrl(url: string) {
    if (!url || !url.startsWith("http")) {
      Alert.alert("Stripe Error", "Invalid Stripe onboarding URL.");
      return;
    }

    if (Platform.OS === "web") {
      window.location.href = url;
      return;
    }

    const supported = await Linking.canOpenURL(url);

    if (supported) {
      await WebBrowser.openBrowserAsync(url);
    } else {
      Alert.alert("Open Error", "Unable to open Stripe onboarding link.");
    }
  }

  async function checkStripeStatus() {
    try {
      setLoading(true);

      const farmer = await getCurrentFarmer();

      if (!farmer?.id) {
        Alert.alert(
          "Farmer Session Required",
          "Please login or complete farmer registration first."
        );
        router.replace("/farmer/login" as any);
        return;
      }

      const stripeAccountId = getStripeAccountId(farmer);

      if (!stripeAccountId) {
        Alert.alert(
          "Stripe Required",
          "Please complete Stripe setup from the Farmer Compliance page first.",
          [
            {
              text: "Go to Compliance",
              onPress: () => router.push("/farmer/compliance-upload" as any),
            },
          ]
        );
        setStatus(farmer);
        return;
      }

      const response = await fetch(
        `${API_BASE_URL}/payments/check-farmer-connect-account`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            stripeAccountId,
            accountId: stripeAccountId,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Unable to check Stripe status.");
      }

      const updatedFarmer: FarmerProfile = {
        ...farmer,
        stripeAccountId: data.accountId || data.stripeAccountId || stripeAccountId,
        farmerStripeAccountId:
          data.accountId || data.stripeAccountId || stripeAccountId,
        payoutsEnabled: Boolean(data.payoutsEnabled),
        chargesEnabled: Boolean(data.chargesEnabled),
        detailsSubmitted: Boolean(data.detailsSubmitted),
        stripePayoutsEnabled: Boolean(data.payoutsEnabled),
        stripeChargesEnabled: Boolean(data.chargesEnabled),
        stripeOnboardingComplete: Boolean(
          data.onboardingComplete || data.detailsSubmitted
        ),
      };

      await saveUpdatedFarmer(updatedFarmer);

      setStatus(updatedFarmer);
    } catch (error: any) {
      console.log("Stripe status check error:", error);

      Alert.alert(
        "Stripe Status Error",
        error.message || "Unable to check Stripe account."
      );
    } finally {
      setLoading(false);
    }
  }

  async function resumeOnboarding() {
    try {
      setLoading(true);

      const farmer = await getCurrentFarmer();

      if (!farmer?.id) {
        Alert.alert("Farmer Session Required", "Please login again.");
        router.replace("/farmer/login" as any);
        return;
      }

      const stripeAccountId = getStripeAccountId(farmer);

      if (!stripeAccountId) {
        Alert.alert(
          "Stripe Required",
          "Please start Stripe setup from the Farmer Compliance page.",
          [
            {
              text: "Go to Compliance",
              onPress: () => router.push("/farmer/compliance-upload" as any),
            },
          ]
        );
        return;
      }

      const response = await fetch(
        `${API_BASE_URL}/payments/create-farmer-onboarding-link`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            stripeAccountId,
            accountId: stripeAccountId,
            farmerId: farmer.id,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Unable to create onboarding link.");
      }

      const onboardingUrl = data.onboardingUrl || data.url;

      await openExternalUrl(onboardingUrl);
    } catch (error: any) {
      console.log("Resume onboarding error:", error);

      Alert.alert(
        "Onboarding Error",
        error.message || "Unable to resume Stripe onboarding."
      );
    } finally {
      setLoading(false);
    }
  }

  const fullyConnected =
    Boolean(status?.chargesEnabled || status?.stripeChargesEnabled) &&
    Boolean(status?.payoutsEnabled || status?.stripePayoutsEnabled) &&
    Boolean(status?.detailsSubmitted || status?.stripeOnboardingComplete);

  const accountId = getStripeAccountId(status);

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Stripe Account Status</Text>

      <Text style={styles.subtitle}>
        Verify that your Stripe Express account is ready to receive Farm2Home
        marketplace payouts.
      </Text>

      <View style={styles.card}>
        <Text style={styles.row}>
          Stripe Account: {accountId || "Not connected"}
        </Text>

        <Text style={styles.row}>
          Details Submitted:{" "}
          {status?.detailsSubmitted || status?.stripeOnboardingComplete
            ? "✅"
            : "❌"}
        </Text>

        <Text style={styles.row}>
          Charges Enabled:{" "}
          {status?.chargesEnabled || status?.stripeChargesEnabled ? "✅" : "❌"}
        </Text>

        <Text style={styles.row}>
          Payouts Enabled:{" "}
          {status?.payoutsEnabled || status?.stripePayoutsEnabled ? "✅" : "❌"}
        </Text>
      </View>

      <Text style={[styles.status, fullyConnected ? styles.good : styles.bad]}>
        {fullyConnected
          ? "Farmer payouts are fully enabled."
          : "Stripe onboarding is incomplete."}
      </Text>

      <Pressable
        style={({ pressed }) => [
          styles.button,
          pressed && styles.pressed,
          loading && styles.disabled,
        ]}
        onPress={checkStripeStatus}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonText}>Refresh Stripe Status</Text>
        )}
      </Pressable>

      <Pressable
        style={({ pressed }) => [
          styles.secondaryButton,
          pressed && styles.pressed,
          loading && styles.disabled,
        ]}
        onPress={resumeOnboarding}
        disabled={loading}
      >
        <Text style={styles.secondaryButtonText}>Resume Stripe Onboarding</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}
        onPress={() => router.push("/farmer/compliance-upload" as any)}
      >
        <Text style={styles.linkText}>Back To Compliance</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}
        onPress={() => router.push("/farmer/dashboard" as any)}
      >
        <Text style={styles.linkText}>Continue To Dashboard</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F7F7F2",
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: 30,
    fontWeight: "900",
    color: "#047857",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    color: "#64748B",
    fontWeight: "700",
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 22,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
  },
  row: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
    color: "#111827",
  },
  status: {
    textAlign: "center",
    fontWeight: "900",
    fontSize: 18,
    marginBottom: 24,
  },
  good: {
    color: "#047857",
  },
  bad: {
    color: "#DC2626",
  },
  button: {
    backgroundColor: "#047857",
    padding: 18,
    borderRadius: 18,
    alignItems: "center",
    marginBottom: 14,
  },
  secondaryButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#047857",
    padding: 16,
    borderRadius: 18,
    alignItems: "center",
    marginBottom: 14,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },
  secondaryButtonText: {
    color: "#047857",
    fontWeight: "900",
    fontSize: 16,
  },
  linkButton: {
    padding: 10,
    alignItems: "center",
  },
  linkText: {
    color: "#047857",
    fontWeight: "900",
  },
  pressed: {
    opacity: 0.75,
  },
  disabled: {
    opacity: 0.6,
  },
});