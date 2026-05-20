import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";

import { API_BASE_URL } from "../config/api";
import { getFarmerById, updateFarmerStore } from "../data/farmerStore";

export default function StripeOnboardingCompleteScreen() {
  const params = useLocalSearchParams();

  const accountIdFromParams = params.accountId
    ? String(params.accountId)
    : "";

  const [loading, setLoading] = useState(true);

  const [farmerId, setFarmerId] = useState("");
  const [accountId, setAccountId] = useState(accountIdFromParams);

  const [chargesEnabled, setChargesEnabled] = useState(false);
  const [payoutsEnabled, setPayoutsEnabled] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  const [payoutAccount, setPayoutAccount] = useState("");

  useEffect(() => {
    loadAndVerifyStripe();
  }, []);

  async function loadAndVerifyStripe() {
    try {
      const saved =
        (await AsyncStorage.getItem("currentFarmer")) ||
        (await AsyncStorage.getItem("currentUser"));

      if (!saved) {
        setLoading(false);

        Alert.alert(
          "Farmer Session Missing",
          "Please login as a farmer to verify Stripe status."
        );

        return;
      }

      const currentFarmer = JSON.parse(saved);

      const latestFarmer = await getFarmerById(currentFarmer.id);

      const activeFarmer = latestFarmer || currentFarmer;

      const activeFarmerId = activeFarmer.id || "";

      const activeAccountId =
        accountIdFromParams ||
        activeFarmer.stripeAccountId ||
        activeFarmer.farmerStripeAccountId ||
        "";

      setFarmerId(activeFarmerId);
      setAccountId(activeAccountId);

      if (!activeAccountId) {
        setLoading(false);

        Alert.alert(
          "Stripe Account Missing",
          "No Stripe account ID was found. Return to banking setup and try again."
        );

        return;
      }

      await verifyStripeStatus(activeFarmerId, activeAccountId);
    } catch (error: any) {
      console.log("Stripe complete load error:", error);

      Alert.alert(
        "Stripe Status Error",
        error?.message || "Unable to load Stripe onboarding status."
      );
    } finally {
      setLoading(false);
    }
  }

  async function verifyStripeStatus(
    activeFarmerId = farmerId,
    activeAccountId = accountId
  ) {
    try {
      if (!activeFarmerId || !activeAccountId) {
        Alert.alert(
          "Missing Information",
          "Farmer ID or Stripe account ID is missing."
        );

        return;
      }

      setLoading(true);

      const response = await fetch(
        `${API_BASE_URL}/payments/check-farmer-connect-account`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            stripeAccountId: activeAccountId,
            accountId: activeAccountId,
          }),
        }
      );

      const text = await response.text();

      console.log("Stripe complete status response:", text);

      let data: any = {};

      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(`Backend returned invalid response: ${text}`);
      }

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || data.message || "Unable to verify Stripe account."
        );
      }

      const resolvedAccountId =
        data.accountId ||
        data.stripeAccountId ||
        activeAccountId;

      const stripeChargesEnabled = Boolean(data.chargesEnabled);

      const stripePayoutsEnabled = Boolean(data.payoutsEnabled);

      const stripeOnboardingComplete = Boolean(
        data.onboardingComplete || data.detailsSubmitted
      );

      const payoutLabel = stripePayoutsEnabled
        ? "Stripe Express payout account connected"
        : "Stripe Express setup pending";

      const updatedStripeFields = {
        stripeAccountId: resolvedAccountId,
        farmerStripeAccountId: resolvedAccountId,

        stripePayoutAccount: payoutLabel,

        stripeOnboardingComplete: stripeOnboardingComplete,
        stripeChargesEnabled: stripeChargesEnabled,
        stripePayoutsEnabled: stripePayoutsEnabled,

        payoutsEnabled: stripePayoutsEnabled,
        chargesEnabled: stripeChargesEnabled,
        detailsSubmitted: stripeOnboardingComplete,

        complianceStatus: stripePayoutsEnabled
          ? "stripe_complete"
          : "stripe_pending",

        updatedAt: new Date().toISOString(),
      };

      await updateFarmerStore(
        activeFarmerId,
        updatedStripeFields as any
      );

      const latestFarmer = await getFarmerById(activeFarmerId);

      if (latestFarmer) {
        await AsyncStorage.setItem(
          "currentFarmer",
          JSON.stringify(latestFarmer)
        );

        await AsyncStorage.setItem(
          "currentUser",
          JSON.stringify(latestFarmer)
        );

        await AsyncStorage.setItem("currentUserRole", "farmer");
        await AsyncStorage.setItem("userRole", "farmer");
      }

      setAccountId(resolvedAccountId);

      setChargesEnabled(stripeChargesEnabled);

      setPayoutsEnabled(stripePayoutsEnabled);

      setOnboardingComplete(stripeOnboardingComplete);

      setPayoutAccount(payoutLabel);
    } catch (error: any) {
      console.log("Stripe complete verify error:", error);

      Alert.alert(
        "Stripe Verification Error",
        error?.message || "Unable to verify Stripe account."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Stripe Setup Submitted</Text>

      {loading ? (
        <View style={styles.card}>
          <ActivityIndicator color="#2F7D32" />

          <Text style={styles.loadingText}>
            Checking Stripe status...
          </Text>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.statusTitle}>
            {payoutsEnabled
              ? "Payouts Enabled"
              : "Stripe Review Pending"}
          </Text>

          <Text style={styles.message}>
            Your farmer banking setup was submitted to Stripe.
          </Text>

          <Text style={styles.statusLine}>
            Account ID: {accountId || "Missing"}
          </Text>

          <Text style={styles.statusLine}>
            Onboarding Complete:{" "}
            {onboardingComplete ? "YES" : "NO"}
          </Text>

          <Text style={styles.statusLine}>
            Charges Enabled:{" "}
            {chargesEnabled ? "YES" : "NO"}
          </Text>

          <Text style={styles.statusLine}>
            Payouts Enabled:{" "}
            {payoutsEnabled ? "YES" : "NO"}
          </Text>

          <Text style={styles.statusLine}>
            Payout Account:{" "}
            {payoutAccount || "Not available yet"}
          </Text>

          <Text style={styles.note}>
            You can receive Farm2Home payouts once Stripe shows
            payouts enabled. If still pending, return to banking
            setup and complete any missing Stripe requirements.
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={styles.button}
        onPress={() =>
          router.push("/farmer/stripe-banking" as any)
        }
      >
        <Text style={styles.buttonText}>
          Return to Banking Dashboard
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() =>
          router.push("/farmer/compliance-upload" as any)
        }
      >
        <Text style={styles.secondaryButtonText}>
          Return to Compliance Verification
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.refreshButton}
        onPress={() => verifyStripeStatus()}
        disabled={loading}
      >
        <Text style={styles.refreshButtonText}>
          {loading ? "Checking..." : "Refresh Stripe Status"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F7F2",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },

  title: {
    fontSize: 34,
    fontWeight: "900",
    color: "#1f7a3f",
    marginBottom: 16,
    textAlign: "center",
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    width: "100%",
    maxWidth: 520,
    borderWidth: 1,
    borderColor: "#DDE7DB",
    marginBottom: 18,
  },

  statusTitle: {
    color: "#14532D",
    fontWeight: "900",
    fontSize: 22,
    textAlign: "center",
    marginBottom: 12,
  },

  message: {
    fontSize: 17,
    color: "#333",
    textAlign: "center",
    marginBottom: 14,
    lineHeight: 26,
    fontWeight: "700",
  },

  note: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    lineHeight: 24,
    marginTop: 16,
  },

  statusLine: {
    color: "#374151",
    fontWeight: "800",
    marginBottom: 6,
    lineHeight: 22,
  },

  loadingText: {
    color: "#14532D",
    fontWeight: "800",
    textAlign: "center",
    marginTop: 12,
  },

  button: {
    backgroundColor: "#2F7D32",
    paddingVertical: 16,
    paddingHorizontal: 26,
    borderRadius: 12,
    width: "100%",
    maxWidth: 520,
    alignItems: "center",
    marginBottom: 12,
  },

  buttonText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 16,
  },

  secondaryButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#2F7D32",
    paddingVertical: 16,
    paddingHorizontal: 26,
    borderRadius: 12,
    width: "100%",
    maxWidth: 520,
    alignItems: "center",
    marginBottom: 12,
  },

  secondaryButtonText: {
    color: "#2F7D32",
    fontWeight: "900",
    fontSize: 16,
  },

  refreshButton: {
    backgroundColor: "#111827",
    paddingVertical: 16,
    paddingHorizontal: 26,
    borderRadius: 12,
    width: "100%",
    maxWidth: 520,
    alignItems: "center",
  },

  refreshButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },
});