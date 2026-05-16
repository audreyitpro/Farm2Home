import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";

export default function FreightSubscriptionSuccess() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    activateFreightCarrier();
  }, []);

  async function activateFreightCarrier() {
    try {
      const pending = await AsyncStorage.getItem("pendingFreightCarrier");

      if (pending) {
        const carrier = JSON.parse(pending);

        const activeCarrier = {
          ...carrier,
          membershipStatus: "Active",
          activatedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await AsyncStorage.setItem(
          "currentFreightCarrier",
          JSON.stringify(activeCarrier)
        );

        await AsyncStorage.removeItem("pendingFreightCarrier");
      }
    } catch (error) {
      console.log("Freight activation error:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#2F7D32" />
        <Text style={styles.message}>Activating Freight Connect...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Freight Connect Active!</Text>

      <Text style={styles.message}>
        Your carrier membership is now active. You can access Freight Connect
        opportunities.
      </Text>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.replace("/freight/dashboard")}
      >
        <Text style={styles.buttonText}>Go to Freight Dashboard</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => router.replace("/")}
      >
        <Text style={styles.secondaryText}>Back Home</Text>
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
    fontSize: 32,
    fontWeight: "900",
    color: "#2F7D32",
    textAlign: "center",
    marginBottom: 14,
  },
  message: {
    fontSize: 17,
    color: "#444444",
    textAlign: "center",
    lineHeight: 25,
    marginBottom: 28,
  },
  button: {
    backgroundColor: "#2F7D32",
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 14,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },
  secondaryButton: {
    marginTop: 16,
  },
  secondaryText: {
    color: "#1565C0",
    fontWeight: "900",
  },
});