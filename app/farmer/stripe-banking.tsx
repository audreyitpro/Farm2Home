import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

import { API_BASE_URL } from "../config/api";
import { getFarmerById, updateFarmerStore } from "../data/farmerStore";

export default function FarmerStripeBankingScreen() {
  const [farmerId, setFarmerId] = useState("");
  const [email, setEmail] = useState("");
  const [farmerName, setFarmerName] = useState("");
  const [accountId, setAccountId] = useState("");

  const [chargesEnabled, setChargesEnabled] = useState(false);
  const [payoutsEnabled, setPayoutsEnabled] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [payoutAccount, setPayoutAccount] = useState("");

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadFarmer();
  }, []);

  async function loadFarmer() {
    try {
      const saved =
        (await AsyncStorage.getItem("currentFarmer")) ||
        (await AsyncStorage.getItem("currentUser"));

      if (!saved) {
        Alert.alert(
          "Farmer Login Required",
          "Please login or register as a farmer first."
        );
        router.replace("/farmer/login" as any);
        return;
      }

      const currentFarmer = JSON.parse(saved);
      const farmer = await getFarmerById(currentFarmer.id);

      const activeFarmer = farmer || currentFarmer;

      setFarmerId(activeFarmer.id || "");

      setFarmerName(
        activeFarmer.farmName ||
          activeFarmer.businessName ||
          activeFarmer.ownerName ||
          ""
      );

      setEmail(activeFarmer.email || "");

      setAccountId(
        activeFarmer.stripeAccountId ||
          activeFarmer.farmerStripeAccountId ||
          ""
      );

      setChargesEnabled(
        Boolean(activeFarmer.stripeChargesEnabled || activeFarmer.chargesEnabled)
      );

      setPayoutsEnabled(
        Boolean(activeFarmer.stripePayoutsEnabled || activeFarmer.payoutsEnabled)
      );

      setOnboardingComplete(
        Boolean(
          activeFarmer.stripeOnboardingComplete ||
            activeFarmer.detailsSubmitted
        )
      );

      setPayoutAccount(activeFarmer.stripePayoutAccount || "");
    } catch (error: any) {
      console.log("Load farmer banking error:", error);

      Alert.alert(
        "Load Error",
        error?.message || "Unable to load farmer banking profile."
      );
    }
  }

  async function syncFarmerStripeStatus(update: any) {
    if (!farmerId) return;

    await updateFarmerStore(farmerId, update as any);

    const latestFarmer = await getFarmerById(farmerId);

    if (latestFarmer) {
      await AsyncStorage.setItem("currentFarmer", JSON.stringify(latestFarmer));
      await AsyncStorage.setItem("currentUser", JSON.stringify(latestFarmer));
      await AsyncStorage.setItem("currentUserRole", "farmer");
      await AsyncStorage.setItem("userRole", "farmer");
    }
  }

  async function openStripeUrl(url: string) {
    if (!url || !url.startsWith("http")) {
      Alert.alert("Stripe Error", "No valid Stripe onboarding URL returned.");
      return;
    }

    if (Platform.OS === "web") {
      window.location.href = url;
      return;
    }

    await WebBrowser.openBrowserAsync(url);
  }

  async function createAccountAndOnboard() {
    if (loading) return;

    try {
      if (!farmerName.trim()) {
        Alert.alert(
          "Missing Farmer Name",
          "Please enter farmer or business name."
        );
        return;
      }

      if (!email.trim() || !email.includes("@")) {
        Alert.alert("Valid Email Required", "Please enter a valid farmer email.");
        return;
      }

      setLoading(true);

      const activeFarmerId = farmerId || `farmer_${Date.now()}`;

      const response = await fetch(
        `${API_BASE_URL}/payments/create-farmer-connect-account`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            farmerId: activeFarmerId,
            email: email.trim().toLowerCase(),
            farmName: farmerName.trim(),
            existingStripeAccountId: accountId || "",
          }),
        }
      );

      const text = await response.text();

      let data: any = {};

      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(`Backend returned invalid response: ${text}`);
      }

      const onboardingUrl = data.onboardingUrl || data.url;
      const returnedAccountId = data.accountId || data.stripeAccountId;

      if (!response.ok || !data.success || !onboardingUrl || !returnedAccountId) {
        throw new Error(
          data.error || data.message || "Unable to create Stripe onboarding."
        );
      }

      setFarmerId(activeFarmerId);
      setAccountId(returnedAccountId);

      await syncFarmerStripeStatus({
        id: activeFarmerId,
        stripeAccountId: returnedAccountId,
        farmerStripeAccountId: returnedAccountId,
        email: email.trim().toLowerCase(),
        farmName: farmerName.trim(),
        complianceStatus: "stripe_pending",
        stripeOnboardingComplete: false,
        stripeChargesEnabled: false,
        stripePayoutsEnabled: false,
      });

      await openStripeUrl(onboardingUrl);
    } catch (error: any) {
      console.log("Stripe onboarding error:", error);

      Alert.alert(
        "Stripe Error",
        error?.message || "Unable to start Stripe onboarding."
      );
    } finally {
      setLoading(false);
    }
  }

  async function checkAccountStatus() {
    if (!accountId.trim()) {
      Alert.alert(
        "Missing Account ID",
        "Complete Stripe setup first or enter a Stripe account ID."
      );
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(
        `${API_BASE_URL}/payments/check-farmer-connect-account`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            stripeAccountId: accountId.trim(),
            accountId: accountId.trim(),
          }),
        }
      );

      const text = await response.text();

      let data: any = {};

      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(`Backend returned invalid response: ${text}`);
      }

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || data.message || "Unable to check account status."
        );
      }

      const returnedAccountId =
        data.accountId || data.stripeAccountId || accountId.trim();

      const statusChargesEnabled = Boolean(data.chargesEnabled);
      const statusPayoutsEnabled = Boolean(data.payoutsEnabled);
      const statusOnboardingComplete = Boolean(
        data.onboardingComplete || data.detailsSubmitted
      );

      const payoutLabel = statusPayoutsEnabled
        ? "Stripe Express payout account connected"
        : "Stripe Express setup pending";

      setAccountId(returnedAccountId);
      setChargesEnabled(statusChargesEnabled);
      setPayoutsEnabled(statusPayoutsEnabled);
      setOnboardingComplete(statusOnboardingComplete);
      setPayoutAccount(payoutLabel);

      await syncFarmerStripeStatus({
        stripeAccountId: returnedAccountId,
        farmerStripeAccountId: returnedAccountId,
        stripePayoutAccount: payoutLabel,
        stripeOnboardingComplete: statusOnboardingComplete,
        stripeChargesEnabled: statusChargesEnabled,
        stripePayoutsEnabled: statusPayoutsEnabled,
        payoutsEnabled: statusPayoutsEnabled,
        chargesEnabled: statusChargesEnabled,
        detailsSubmitted: statusOnboardingComplete,
        complianceStatus: statusPayoutsEnabled
          ? "stripe_complete"
          : "stripe_pending",
      });

      Alert.alert(
        statusPayoutsEnabled ? "Stripe Ready" : "Stripe Pending",
        `Account ID: ${returnedAccountId}\n` +
          `Onboarding Complete: ${
            statusOnboardingComplete ? "YES" : "NO"
          }\n` +
          `Charges Enabled: ${statusChargesEnabled ? "YES" : "NO"}\n` +
          `Payouts Enabled: ${statusPayoutsEnabled ? "YES" : "NO"}\n` +
          `Payout Account: ${payoutLabel}`
      );
    } catch (error: any) {
      console.log("Check account status error:", error);

      Alert.alert(
        "Stripe Error",
        error?.message || "Unable to check Stripe account status."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Farmer Banking Setup</Text>

      <Text style={styles.note}>
        Farmers securely enter banking and identity information through Stripe
        Express. Farm2Home does not store bank account numbers.
      </Text>

      <View style={styles.statusCard}>
        <Text style={styles.sectionTitle}>Production Stripe Status</Text>

        <Text style={styles.statusLine}>
          Account: {accountId ? accountId : "Not connected"}
        </Text>

        <Text style={styles.statusLine}>
          Onboarding: {onboardingComplete ? "Complete" : "Pending"}
        </Text>

        <Text style={styles.statusLine}>
          Charges: {chargesEnabled ? "Enabled" : "Pending"}
        </Text>

        <Text style={styles.statusLine}>
          Payouts: {payoutsEnabled ? "Enabled" : "Pending"}
        </Text>

        <Text style={styles.statusLine}>
          Payout Account: {payoutAccount || "Not available"}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Farmer / Business Name</Text>

        <TextInput
          style={styles.input}
          placeholder="Example: Green Valley Farms"
          placeholderTextColor="#8A8F98"
          value={farmerName}
          onChangeText={setFarmerName}
        />

        <Text style={styles.label}>Farmer Email</Text>

        <TextInput
          style={styles.input}
          placeholder="farmer@email.com"
          placeholderTextColor="#8A8F98"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={createAccountAndOnboard}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Set Up Farmer Banking</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Stripe Account ID</Text>

        <TextInput
          style={styles.input}
          placeholder="acct_..."
          placeholderTextColor="#8A8F98"
          autoCapitalize="none"
          value={accountId}
          onChangeText={setAccountId}
        />

        <TouchableOpacity
          style={[styles.secondaryButton, loading && styles.buttonDisabled]}
          onPress={checkAccountStatus}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#1f7a3f" />
          ) : (
            <Text style={styles.secondaryButtonText}>Check Account Status</Text>
          )}
        </TouchableOpacity>

        {accountId ? (
          <Text style={styles.accountText}>
            Farmer Stripe Account ID: {accountId}
          </Text>
        ) : null}
      </View>

      <TouchableOpacity
        style={styles.complianceButton}
        onPress={() => router.push("/farmer/compliance-upload" as any)}
      >
        <Text style={styles.complianceButtonText}>
          Return to Compliance Verification
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: "#F7F7F2",
  },

  title: {
    fontSize: 30,
    fontWeight: "900",
    color: "#1f7a3f",
    marginBottom: 12,
  },

  note: {
    fontSize: 15,
    color: "#555",
    marginBottom: 20,
    lineHeight: 22,
  },

  statusCard: {
    backgroundColor: "#EAF6EC",
    borderRadius: 16,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#B7DDBE",
  },

  statusLine: {
    color: "#14532D",
    fontWeight: "800",
    marginBottom: 6,
    lineHeight: 20,
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#E2E2D8",
  },

  label: {
    fontWeight: "900",
    color: "#333",
    marginBottom: 6,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#1f7a3f",
    marginBottom: 12,
  },

  input: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    color: "#111827",
  },

  button: {
    backgroundColor: "#2F7D32",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  buttonText: {
    color: "#fff",
    fontWeight: "900",
  },

  secondaryButton: {
    backgroundColor: "#EAF6EC",
    borderWidth: 1,
    borderColor: "#B7DDBE",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },

  secondaryButtonText: {
    color: "#1f7a3f",
    fontWeight: "900",
  },

  accountText: {
    marginTop: 14,
    color: "#333",
    fontWeight: "700",
    lineHeight: 22,
  },

  complianceButton: {
    backgroundColor: "#14532D",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 30,
  },

  complianceButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
});