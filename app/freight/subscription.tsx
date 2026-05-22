import React, { useState } from "react";
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

export default function FreightSubscriptionScreen() {
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);

  async function startSubscription() {
    if (loading) return;

    const cleanEmail = email.trim().toLowerCase();
    const cleanCompany = companyName.trim();

    if (!cleanCompany) {
      Alert.alert("Missing Company Name", "Please enter your company name.");
      return;
    }

    if (!cleanEmail || !cleanEmail.includes("@")) {
      Alert.alert("Missing Email", "Please enter a valid freight email.");
      return;
    }

    try {
      setLoading(true);

      const freightId = `freight_${Date.now()}`;

      const freightUser = {
        id: freightId,
        email: cleanEmail,
        companyName: cleanCompany,
        name: cleanCompany,
        role: "freight",

        membershipStatus: "pending_payment",
        subscriptionStatus: "pending_payment",
        membershipType: "freight_membership",
        planType: "freight",

        freightBoardAccess: false,
        accountActive: false,

        createdAt: new Date().toISOString(),
      };

      await AsyncStorage.setItem("currentUser", JSON.stringify(freightUser));
      await AsyncStorage.setItem("currentFreight", JSON.stringify(freightUser));
      await AsyncStorage.setItem(
        "currentFreightUser",
        JSON.stringify(freightUser)
      );
      await AsyncStorage.setItem(
        "currentFreightCarrier",
        JSON.stringify(freightUser)
      );
      await AsyncStorage.setItem("currentUserRole", "freight");
      await AsyncStorage.setItem(
        "pendingFreightSubscription",
        JSON.stringify(freightUser)
      );

      const stripeUrl = PAYMENT_LINKS.freightMembership;

      if (!stripeUrl) {
        throw new Error("Freight membership payment link missing.");
      }

      if (Platform.OS === "web") {
        window.location.href = stripeUrl;
      } else {
        await WebBrowser.openBrowserAsync(stripeUrl);
      }

      Alert.alert(
        "Complete Payment",
        "After payment is complete, return to Farm2Home and tap 'I Completed Payment'."
      );
    } catch (error: any) {
      console.log("FREIGHT_SUBSCRIPTION_ERROR:", error);

      Alert.alert(
        "Subscription Error",
        error?.message || "Unable to start freight membership."
      );
    } finally {
      setLoading(false);
    }
  }

  async function continueAfterPayment() {
    try {
      const pending = await AsyncStorage.getItem("pendingFreightSubscription");

      if (!pending) {
        Alert.alert(
          "No Pending Membership",
          "Please complete freight membership payment first."
        );
        return;
      }

      const freightUser = JSON.parse(pending);

      const activatedFreight = {
        ...freightUser,
        membershipStatus: "active",
        subscriptionStatus: "active",
        hasActiveSubscription: true,
        freightBoardAccess: true,
        accountActive: true,
        activatedAt: new Date().toISOString(),
      };

      await AsyncStorage.setItem("currentUser", JSON.stringify(activatedFreight));
      await AsyncStorage.setItem(
        "currentFreight",
        JSON.stringify(activatedFreight)
      );
      await AsyncStorage.setItem(
        "currentFreightUser",
        JSON.stringify(activatedFreight)
      );
      await AsyncStorage.setItem(
        "currentFreightCarrier",
        JSON.stringify(activatedFreight)
      );
      await AsyncStorage.setItem("freightSubscriptionStatus", "active");
      await AsyncStorage.removeItem("pendingFreightSubscription");

      router.replace("/freight/subscription-success" as any);
    } catch (error: any) {
      console.log("FREIGHT_CONTINUE_AFTER_PAYMENT_ERROR:", error);

      Alert.alert(
        "Activation Error",
        error?.message || "Unable to activate freight membership."
      );
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Farm2Home Freight Membership</Text>

        <Text style={styles.price}>Monthly Freight Membership</Text>

        <Text style={styles.note}>
          Subscribe to access Farm2Home freight posting, load board tools,
          delivery tracking, route management, and logistics dispatch features.
        </Text>

        <View style={styles.featureBox}>
          <Text style={styles.featureTitle}>Membership Includes:</Text>

          {[
            "Freight board access",
            "Load posting tools",
            "Delivery tracking",
            "Route and dispatch support",
            "Carrier verification workflow",
            "Farm-to-market logistics opportunities",
          ].map((item) => (
            <Text key={item} style={styles.featureItem}>
              {`\u2022 ${item}`}
            </Text>
          ))}
        </View>

        <TextInput
          style={styles.input}
          placeholder="Company Name"
          placeholderTextColor="#94A3B8"
          value={companyName}
          onChangeText={setCompanyName}
        />

        <TextInput
          style={styles.input}
          placeholder="Freight Email"
          placeholderTextColor="#94A3B8"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          value={email}
          onChangeText={setEmail}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.disabledButton]}
          onPress={startSubscription}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#052E16" />
          ) : (
            <Text style={styles.buttonText}>Pay Membership with Stripe</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.successButton}
          onPress={continueAfterPayment}
          activeOpacity={0.85}
        >
          <Text style={styles.successButtonText}>I Completed Payment</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.replace("/freight/login" as any)}
        >
          <Text style={styles.secondaryText}>Back to Freight Login</Text>
        </TouchableOpacity>

        <Text style={styles.productionNote}>
          Production Mode Enabled · Stripe Live Payment Links Active
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#0F172A",
  },

  container: {
    flexGrow: 1,
    padding: 24,
    justifyContent: "center",
  },

  title: {
    fontSize: 32,
    fontWeight: "900",
    color: "#FFFFFF",
    marginBottom: 12,
  },

  price: {
    fontSize: 24,
    fontWeight: "900",
    color: "#22C55E",
    marginBottom: 12,
  },

  note: {
    color: "#CBD5E1",
    marginBottom: 20,
    lineHeight: 22,
    fontWeight: "700",
  },

  featureBox: {
    backgroundColor: "#1E293B",
    borderRadius: 20,
    padding: 18,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: "#334155",
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

  input: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#334155",
    color: "#111827",
    fontWeight: "700",
  },

  button: {
    backgroundColor: "#22C55E",
    padding: 18,
    borderRadius: 16,
    alignItems: "center",
    minHeight: 58,
    justifyContent: "center",
  },

  disabledButton: {
    opacity: 0.6,
  },

  buttonText: {
    color: "#052E16",
    fontWeight: "900",
    fontSize: 16,
  },

  successButton: {
    backgroundColor: "#FFFFFF",
    padding: 18,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },

  successButtonText: {
    color: "#0F172A",
    fontWeight: "900",
    fontSize: 15,
  },

  secondaryButton: {
    alignItems: "center",
    marginTop: 22,
  },

  secondaryText: {
    color: "#22C55E",
    fontWeight: "900",
  },

  productionNote: {
    marginTop: 26,
    color: "#94A3B8",
    textAlign: "center",
    fontWeight: "700",
    lineHeight: 20,
  },
});