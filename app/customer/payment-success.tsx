import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";

const API_BASE_URL = "http://10.0.0.216:4242";

type VerifyCheckoutResponse = {
  paid?: boolean;
  error?: string;
  email?: string;
  customerId?: string;
  subscriptionId?: string;
};

export default function PaymentSuccess() {
  const params = useLocalSearchParams();
  const sessionId = String(params.session_id || "");

  const [message, setMessage] = useState("Verifying payment...");

  useEffect(() => {
    verifyPayment();
  }, []);

  async function verifyPayment() {
    try {
      if (!sessionId) {
        Alert.alert("Error", "Missing Stripe checkout session.");
        router.replace("/customer/login" as never);
        return;
      }

      const res = await fetch(`${API_BASE_URL}/verify-checkout-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
        }),
      });

      const data = (await res.json()) as VerifyCheckoutResponse;

      if (!res.ok || !data.paid) {
        Alert.alert(
          "Payment Not Complete",
          data.error || "Please try again."
        );
        router.replace("/customer/login" as never);
        return;
      }

      const pendingRaw = await AsyncStorage.getItem("pendingCustomer");
      const pending = pendingRaw ? JSON.parse(pendingRaw) : {};

      const customer = {
        ...pending,
        name: pending.name || pending.fullName || "",
        fullName: pending.fullName || pending.name || "",
        email: data.email || pending.email || "",
        stripeCustomerId: data.customerId || pending.stripeCustomerId || "",
        stripeSubscriptionId:
          data.subscriptionId || pending.stripeSubscriptionId || "",
        membershipStatus: "Active",
        updatedAt: new Date().toISOString(),
      };

      await AsyncStorage.setItem("currentCustomer", JSON.stringify(customer));
      await AsyncStorage.removeItem("pendingCustomer");

      setMessage("Payment complete");

      setTimeout(() => {
        router.replace("/customer/marketplace" as never);
      }, 1200);
    } catch (error: any) {
      Alert.alert("Error", error.message || "Unable to verify payment.");
      router.replace("/customer/login" as never);
    }
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#1f7a3f" />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },

  text: {
    marginTop: 18,
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
});