import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";

const API_BASE_URL = "http://localhost:4242";
const TEST_STRIPE_ACCOUNT_ID = "acct_1TWeOKCqJp7Z8L15";

type FarmerProfile = {
  id?: string;
  farmName?: string;
  email?: string;
  stripeAccountId?: string;
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

  async function getOrCreateLocalFarmer(): Promise<FarmerProfile> {
    const rawFarmer = await AsyncStorage.getItem("currentFarmer");

    if (rawFarmer) {
      try {
        return JSON.parse(rawFarmer);
      } catch (error) {
        console.log("Parse currentFarmer error:", error);
      }
    }

    const fallbackFarmer: FarmerProfile = {
      id: "test_farmer_green_valley",
      farmName: "Green Valley Test Farm",
      email: "marketplacetest@example.com",
      stripeAccountId: TEST_STRIPE_ACCOUNT_ID,
      payoutsEnabled: false,
      chargesEnabled: false,
      detailsSubmitted: false,
    };

    await AsyncStorage.setItem("currentFarmer", JSON.stringify(fallbackFarmer));

    return fallbackFarmer;
  }

  async function checkStripeStatus() {
    try {
      setLoading(true);

      const farmer = await getOrCreateLocalFarmer();

      const stripeAccountId = farmer.stripeAccountId || TEST_STRIPE_ACCOUNT_ID;

      console.log("Current Farmer:", farmer);
      console.log("Checking Stripe account:", stripeAccountId);

      const response = await fetch(
        `${API_BASE_URL}/payments/check-farmer-connect-account`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            stripeAccountId,
          }),
        }
      );

      const data = await response.json();

      console.log("Stripe Status:", data);

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Unable to check Stripe status.");
      }

      const updatedFarmer: FarmerProfile = {
        ...farmer,
        stripeAccountId,
        payoutsEnabled: Boolean(data.payoutsEnabled),
        chargesEnabled: Boolean(data.chargesEnabled),
        detailsSubmitted: Boolean(data.detailsSubmitted),
      };

      await AsyncStorage.setItem("currentFarmer", JSON.stringify(updatedFarmer));

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

      const farmer = await getOrCreateLocalFarmer();
      const stripeAccountId = farmer.stripeAccountId || TEST_STRIPE_ACCOUNT_ID;

      const response = await fetch(
        `${API_BASE_URL}/payments/create-farmer-onboarding-link`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            stripeAccountId,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Unable to create onboarding link.");
      }

      if (data.onboardingUrl) {
        window.location.href = data.onboardingUrl;
      }
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
    Boolean(status?.chargesEnabled) &&
    Boolean(status?.payoutsEnabled) &&
    Boolean(status?.detailsSubmitted);

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Stripe Account Status</Text>

      <View style={styles.card}>
        <Text style={styles.row}>
          Stripe Account: {status?.stripeAccountId || TEST_STRIPE_ACCOUNT_ID}
        </Text>

        <Text style={styles.row}>
          Details Submitted: {status?.detailsSubmitted ? "✅" : "❌"}
        </Text>

        <Text style={styles.row}>
          Charges Enabled: {status?.chargesEnabled ? "✅" : "❌"}
        </Text>

        <Text style={styles.row}>
          Payouts Enabled: {status?.payoutsEnabled ? "✅" : "❌"}
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
    marginBottom: 24,
    textAlign: "center",
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
    padding: 14,
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