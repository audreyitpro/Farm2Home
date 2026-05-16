import React, { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import { router } from "expo-router";

const API_BASE_URL = "http://10.0.0.216:4242";

export default function FreightProfile() {
  const [carrier, setCarrier] = useState<any>(null);

  useEffect(() => {
    loadCarrier();
  }, []);

  async function loadCarrier() {
    const raw = await AsyncStorage.getItem(
      "currentFreightCarrier"
    );

    if (!raw) {
      router.replace("/freight/login");
      return;
    }

    const current = JSON.parse(raw);

    if (
      !current ||
      current.membershipStatus !== "Active"
    ) {
      router.replace("/freight/login");
      return;
    }

    setCarrier(current);
  }

  async function openBillingPortal() {
    try {
      if (!carrier?.stripeCustomerId) {
        Alert.alert(
          "Error",
          "Missing Stripe customer ID."
        );
        return;
      }

      const res = await fetch(
        `${API_BASE_URL}/create-billing-portal-session`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            customerId: carrier.stripeCustomerId,
          }),
        }
      );

      const billingData = await res.json();

      if (billingData.url) {
        Linking.openURL(billingData.url);
      } else {
        Alert.alert(
          "Error",
          billingData.error ||
            "Unable to open billing portal."
        );
      }
    } catch (error: any) {
      Alert.alert(
        "Error",
        error?.message ||
          "Unable to open billing portal."
      );
    }
  }

  async function logout() {
    await AsyncStorage.removeItem(
      "currentFreightCarrier"
    );

    router.replace("/freight/login");
  }

  if (!carrier) {
    return null;
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>
        Freight Carrier Profile
      </Text>

      <View style={styles.card}>
        <Text style={styles.label}>Company</Text>
        <Text style={styles.value}>
          {carrier.companyName}
        </Text>

        <Text style={styles.label}>Contact</Text>
        <Text style={styles.value}>
          {carrier.contactName}
        </Text>

        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>
          {carrier.email}
        </Text>

        <Text style={styles.label}>Phone</Text>
        <Text style={styles.value}>
          {carrier.phone}
        </Text>

        <Text style={styles.label}>MDOT Number</Text>
        <Text style={styles.value}>
          {carrier.mdotNumber}
        </Text>

        <Text style={styles.label}>MC Number</Text>
        <Text style={styles.value}>
          {carrier.mcNumber}
        </Text>

        <Text style={styles.label}>
          Insurance Provider
        </Text>
        <Text style={styles.value}>
          {carrier.insuranceProvider}
        </Text>

        <Text style={styles.label}>Policy Number</Text>
        <Text style={styles.value}>
          {carrier.insurancePolicyNumber}
        </Text>

        <Text style={styles.label}>Membership</Text>
        <Text style={styles.active}>
          {carrier.membershipStatus}
        </Text>

        <Text style={styles.label}>
          Authorized Services
        </Text>

        <Text style={styles.value}>
          {carrier.licensedLivestock
            ? "Livestock Transport\n"
            : ""}
          {carrier.licensedRefrigeratedFood
            ? "Refrigerated Fresh Food"
            : ""}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={openBillingPortal}
      >
        <Text style={styles.buttonText}>
          Manage Freight Membership
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() =>
          router.push("/freight/board")
        }
      >
        <Text style={styles.secondaryText}>
          Back to Freight Board
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.logoutButton}
        onPress={logout}
      >
        <Text style={styles.logoutText}>
          Logout
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 18,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 30,
    fontWeight: "900",
    color: "#1f7a3f",
    marginBottom: 18,
  },
  card: {
    backgroundColor: "#f5f5f5",
    padding: 18,
    borderRadius: 14,
    marginBottom: 20,
  },
  label: {
    color: "#666",
    marginTop: 10,
    fontWeight: "700",
  },
  value: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },
  active: {
    fontSize: 17,
    fontWeight: "900",
    color: "#1f7a3f",
  },
  button: {
    backgroundColor: "#1f7a3f",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "900",
  },
  secondaryButton: {
    marginTop: 16,
    alignItems: "center",
  },
  secondaryText: {
    color: "#1f7a3f",
    fontWeight: "900",
  },
  logoutButton: {
    marginTop: 16,
    alignItems: "center",
    marginBottom: 40,
  },
  logoutText: {
    color: "#cc0000",
    fontWeight: "900",
  },
});