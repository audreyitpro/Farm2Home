import React, { useEffect, useState } from "react";
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import { router } from "expo-router";

const API_BASE_URL = "http://10.0.0.216:4242";

export default function CustomerProfile() {
  const [customer, setCustomer] = useState<any>(null);

  useEffect(() => {
    guardCustomer();
  }, []);

  async function guardCustomer() {
    try {
      const saved = await AsyncStorage.getItem("currentCustomer");

      if (!saved) {
        router.replace("/customer/login" as never);
        return;
      }

      const current = JSON.parse(saved);

      if (!current || current.membershipStatus !== "Active") {
        router.replace("/customer/login" as never);
        return;
      }

      setCustomer(current);
    } catch (error) {
      console.log("Customer profile guard error:", error);
      router.replace("/customer/login" as never);
    }
  }

  async function openBillingPortal() {
    try {
      const currentRaw = await AsyncStorage.getItem("currentCustomer");
      const current = currentRaw ? JSON.parse(currentRaw) : {};

      if (!current.stripeCustomerId) {
        Alert.alert("Error", "Missing Stripe customer ID.");
        return;
      }

      const res = await fetch(`${API_BASE_URL}/create-billing-portal-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerId: current.stripeCustomerId,
        }),
      });

      const data = await res.json();

      if (data.url) {
        Linking.openURL(data.url);
      } else {
        Alert.alert(
          "Error",
          data.error || "Unable to open billing portal."
        );
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Unable to open billing portal.");
    }
  }

  async function logout() {
    await AsyncStorage.removeItem("currentCustomer");
    router.replace("/customer/login" as never);
  }

  if (!customer) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Customer Profile</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Name</Text>
        <Text style={styles.value}>
          {customer.fullName || customer.name || "Customer"}
        </Text>

        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{customer.email || "Not available"}</Text>

        <Text style={styles.label}>Membership</Text>
        <Text style={styles.active}>
          {customer.membershipStatus || "Active"}
        </Text>
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={openBillingPortal}>
        <Text style={styles.buttonText}>Manage Subscription</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryButton} onPress={logout}>
        <Text style={styles.secondaryText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 22,
    backgroundColor: "#FFFFFF",
  },

  title: {
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 18,
    color: "#111827",
  },

  card: {
    backgroundColor: "#F5F5F5",
    padding: 18,
    borderRadius: 14,
    marginBottom: 24,
  },

  label: {
    color: "#666666",
    marginTop: 10,
    fontWeight: "700",
  },

  value: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
  },

  active: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1F7A3F",
  },

  primaryButton: {
    backgroundColor: "#1F7A3F",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
  },

  buttonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 16,
  },

  secondaryButton: {
    marginTop: 18,
    alignItems: "center",
  },

  secondaryText: {
    color: "#CC0000",
    fontWeight: "700",
  },
});