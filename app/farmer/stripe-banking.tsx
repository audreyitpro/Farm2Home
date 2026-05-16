import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  ScrollView,
} from "react-native";
import * as WebBrowser from "expo-web-browser";

const API_BASE_URL = "http://localhost:4242";

export default function FarmerStripeBankingScreen() {
  const [email, setEmail] = useState("");
  const [farmerName, setFarmerName] = useState("");
  const [accountId, setAccountId] = useState("");
  const [loading, setLoading] = useState(false);

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

      if (!email.trim()) {
        Alert.alert("Missing Email", "Please enter farmer email.");
        return;
      }

      setLoading(true);

      console.log("Creating farmer Stripe account...");

      const accountRes = await fetch(
        `${API_BASE_URL}/create-farmer-connect-account`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email.trim(),
            farmerName: farmerName.trim(),
          }),
        }
      );

      const accountText = await accountRes.text();

      console.log("Account status:", accountRes.status);
      console.log("Account raw response:", accountText);

      const accountData = accountText
        ? JSON.parse(accountText)
        : {};

      if (!accountRes.ok || !accountData.accountId) {
        Alert.alert(
          "Stripe Error",
          accountData.error || "Unable to create account."
        );
        return;
      }

      setAccountId(accountData.accountId);

      console.log("Created account:", accountData.accountId);
      console.log("Creating onboarding link...");

      const linkRes = await fetch(
        `${API_BASE_URL}/create-farmer-onboarding-link`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            accountId: accountData.accountId,
          }),
        }
      );

      const linkText = await linkRes.text();

      console.log("Link status:", linkRes.status);
      console.log("Link raw response:", linkText);

      const linkData = linkText
        ? JSON.parse(linkText)
        : {};

      if (!linkRes.ok || !linkData.url) {
        Alert.alert(
          "Stripe Error",
          linkData.error || "Unable to create onboarding link."
        );
        return;
      }

      console.log("Opening Stripe URL:", linkData.url);

      if (Platform.OS === "web") {
        window.open(linkData.url, "_self");
      } else {
        await WebBrowser.openBrowserAsync(linkData.url);
      }
    } catch (error: any) {
      console.error("Stripe onboarding error:", error);

      Alert.alert(
        "Error",
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
        "Enter or create a Stripe account ID first."
      );
      return;
    }

    try {
      setLoading(true);

      const res = await fetch(
        `${API_BASE_URL}/check-farmer-account-status`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            accountId: accountId.trim(),
          }),
        }
      );

      const text = await res.text();

      console.log("Status raw response:", text);

      const statusData = text
        ? JSON.parse(text)
        : {};

      if (!res.ok) {
        Alert.alert(
          "Stripe Error",
          statusData.error || "Unable to check account status."
        );
        return;
      }

      Alert.alert(
        "Farmer Stripe Status",
        `Account ID: ${statusData.accountId}\n` +
          `Charges Enabled: ${
            statusData.chargesEnabled ? "YES" : "NO"
          }\n` +
          `Payouts Enabled: ${
            statusData.payoutsEnabled ? "YES" : "NO"
          }\n` +
          `Details Submitted: ${
            statusData.detailsSubmitted ? "YES" : "NO"
          }`
      );
    } catch (error: any) {
      console.error("Check account status error:", error);

      Alert.alert(
        "Error",
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
        Farmers will securely enter their banking and identity
        information through Stripe Express. Farm2Home does not store
        bank account numbers.
      </Text>

      <View style={styles.card}>
        <Text style={styles.label}>Farmer / Business Name</Text>

        <TextInput
          style={styles.input}
          placeholder="Example: Green Valley Farms"
          value={farmerName}
          onChangeText={setFarmerName}
        />

        <Text style={styles.label}>Farmer Email</Text>

        <TextInput
          style={styles.input}
          placeholder="farmer@email.com"
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
          <Text style={styles.buttonText}>
            {loading
              ? "Opening Stripe..."
              : "Set Up Farmer Banking"}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          Stripe Account ID
        </Text>

        <TextInput
          style={styles.input}
          placeholder="acct_..."
          autoCapitalize="none"
          value={accountId}
          onChangeText={setAccountId}
        />

        <TouchableOpacity
          style={[
            styles.secondaryButton,
            loading && styles.buttonDisabled,
          ]}
          onPress={checkAccountStatus}
          disabled={loading}
        >
          <Text style={styles.secondaryButtonText}>
            Check Account Status
          </Text>
        </TouchableOpacity>

        {accountId ? (
          <Text style={styles.accountText}>
            Save this farmer Stripe Account ID: {accountId}
          </Text>
        ) : null}
      </View>
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
});