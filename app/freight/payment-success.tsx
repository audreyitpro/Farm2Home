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

export default function FreightPaymentSuccess() {
  const params = useLocalSearchParams();

  const sessionId = Array.isArray(params.session_id)
    ? params.session_id[0]
    : params.session_id || "";

  const [message, setMessage] = useState(
    "Verifying Freight Connect membership..."
  );

  useEffect(() => {
    verifyPayment();
  }, []);

  async function verifyPayment() {
    try {
      if (!sessionId) {
        Alert.alert("Error", "Missing checkout session.");
        router.replace("/freight/register");
        return;
      }

      const res = await fetch(
        `${API_BASE_URL}/verify-checkout-session`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId,
          }),
        }
      );

      const paymentData = await res.json();

      if (!res.ok || !paymentData.paid) {
        Alert.alert(
          "Payment Not Complete",
          paymentData.error || "Please try again."
        );

        router.replace("/freight/register");
        return;
      }

      const pendingRaw = await AsyncStorage.getItem(
        "pendingFreightCarrier"
      );

      const pending = pendingRaw
        ? JSON.parse(pendingRaw)
        : {};

      const freightCarrier = {
        ...pending,
        email: paymentData.email || pending.email,
        stripeCustomerId: paymentData.customerId,
        stripeSubscriptionId: paymentData.subscriptionId,
        subscriptionStatus: paymentData.subscriptionStatus,
        membershipStatus: "Active",
      };

      await AsyncStorage.setItem(
        "currentFreightCarrier",
        JSON.stringify(freightCarrier)
      );

      await AsyncStorage.removeItem(
        "pendingFreightCarrier"
      );

      setMessage("Freight Connect membership active");

      setTimeout(() => {
        router.replace("/freight/board");
      }, 1200);
    } catch (error: any) {
      Alert.alert(
        "Error",
        error?.message || "Unable to verify payment."
      );

      router.replace("/freight/register");
    }
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator
        size="large"
        color="#1f7a3f"
      />

      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  text: {
    marginTop: 18,
    fontSize: 19,
    fontWeight: "900",
    textAlign: "center",
    color: "#111827",
  },
});