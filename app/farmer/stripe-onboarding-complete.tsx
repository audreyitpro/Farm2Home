import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { router } from "expo-router";

export default function StripeOnboardingCompleteScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Stripe Setup Complete</Text>

      <Text style={styles.message}>
        Your farmer banking setup was successfully submitted to Stripe.
      </Text>

      <Text style={styles.note}>
        You can now receive payouts from Farm2Home orders once Stripe finishes
        processing the account.
      </Text>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push("/farmer/stripe-banking")}
      >
        <Text style={styles.buttonText}>Return to Banking Dashboard</Text>
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
  message: {
    fontSize: 18,
    color: "#333",
    textAlign: "center",
    marginBottom: 14,
    lineHeight: 28,
  },
  note: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 28,
  },
  button: {
    backgroundColor: "#2F7D32",
    paddingVertical: 16,
    paddingHorizontal: 26,
    borderRadius: 12,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 16,
  },
});