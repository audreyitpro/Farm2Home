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
import { router } from "expo-router";

import farmTheme from "../styles/farmTheme";

type StoredCustomer = {
  id?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  username?: string;
  password?: string;
  accountActive?: boolean;
  membershipStatus?: "Pending" | "Active";
  createdAt?: string;
  updatedAt?: string;
  subscriptionActivatedAt?: string;
};

function safelyParseCustomer(rawValue: string | null): StoredCustomer | null {
  if (!rawValue) return null;

  try {
    return JSON.parse(rawValue);
  } catch {
    return null;
  }
}

function safelyParseArray(rawValue: string | null): StoredCustomer[] {
  if (!rawValue) return [];

  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function CustomerSubscriptionSuccess() {
  const [loading, setLoading] = useState(true);
  const [activated, setActivated] = useState(false);

  useEffect(() => {
    activateMembership();
  }, []);

  async function activateMembership() {
    try {
      const pendingRaw = await AsyncStorage.getItem("pendingCustomer");
      const currentRaw = await AsyncStorage.getItem("currentCustomer");

      const pendingCustomer = safelyParseCustomer(pendingRaw);
      const currentCustomer = safelyParseCustomer(currentRaw);

      const customer = pendingCustomer || currentCustomer;

      if (!customer) {
        setActivated(false);
        setLoading(false);
        return;
      }

      const activeCustomer: StoredCustomer = {
        ...customer,
        accountActive: true,
        membershipStatus: "Active",
        subscriptionActivatedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const customersRaw = await AsyncStorage.getItem("farm2homeCustomers");
      const customers = safelyParseArray(customersRaw);

      const updatedCustomers = [
        ...customers.filter((item) => {
          const sameId = item.id && activeCustomer.id && item.id === activeCustomer.id;
          const sameEmail =
            item.email &&
            activeCustomer.email &&
            item.email.toLowerCase() === activeCustomer.email.toLowerCase();
          const sameUsername =
            item.username &&
            activeCustomer.username &&
            item.username.toLowerCase() === activeCustomer.username.toLowerCase();

          return !sameId && !sameEmail && !sameUsername;
        }),
        activeCustomer,
      ];

      await AsyncStorage.setItem(
        "farm2homeCustomers",
        JSON.stringify(updatedCustomers)
      );

      await AsyncStorage.setItem(
        "currentCustomer",
        JSON.stringify(activeCustomer)
      );

      await AsyncStorage.removeItem("pendingCustomer");
      await AsyncStorage.setItem("userRole", "customer");

      setActivated(true);
    } catch (error: any) {
      console.log("Subscription activation error:", error);

      Alert.alert(
        "Activation Error",
        error?.message || "Unable to activate customer membership."
      );

      setActivated(false);
    } finally {
      setLoading(false);
    }
  }

  function goToMarketplace() {
    router.replace("/customer/marketplace" as any);
  }

  function goToLogin() {
    router.replace("/customer/login" as any);
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={farmTheme.colors.primary} />

        <Text style={styles.note}>Activating your Farm2Home membership...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{activated ? "✅" : "⚠️"}</Text>

      <Text style={styles.title}>
        {activated ? "Membership Active!" : "Membership Needs Review"}
      </Text>

      <Text style={styles.message}>
        {activated
          ? "Your customer membership is now active. You can access the Farm2Home marketplace."
          : "Payment may have completed, but we could not find your saved customer record on this device. Please login or register again."}
      </Text>

      {activated ? (
        <TouchableOpacity
          style={styles.button}
          onPress={goToMarketplace}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>Start Shopping</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={styles.button}
          onPress={goToLogin}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>Go To Login</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: farmTheme.colors.background,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  icon: {
    fontSize: 56,
    marginBottom: 14,
  },
  title: {
    fontSize: 34,
    fontWeight: "900",
    color: farmTheme.colors.primary,
    marginBottom: 12,
    textAlign: "center",
  },
  message: {
    fontSize: 18,
    color: farmTheme.colors.text,
    textAlign: "center",
    lineHeight: 27,
    marginBottom: 24,
  },
  note: {
    marginTop: 14,
    color: farmTheme.colors.mutedText,
    fontWeight: "700",
    textAlign: "center",
  },
  button: {
    backgroundColor: farmTheme.colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 18,
    marginTop: 10,
    alignItems: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },
});