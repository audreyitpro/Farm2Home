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
import { router, useLocalSearchParams } from "expo-router";

import { API_BASE_URL } from "../config/api";
import farmTheme from "../styles/farmTheme";

type StoredCustomer = {
  id?: string;
  fullName?: string;
  name?: string;
  email?: string;
  phone?: string;
  username?: string;
  password?: string;
  accountActive?: boolean;
  membershipStatus?: "Pending" | "Active";
  subscriptionStatus?: string;
  subscriptionActive?: boolean;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  currentPeriodEnd?: string | null;
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

function isActiveStripeStatus(status?: string) {
  const clean = String(status || "").toLowerCase();

  return clean === "active" || clean === "trialing";
}

export default function CustomerSubscriptionSuccess() {
  const params = useLocalSearchParams();

  const sessionId =
    String(params.session_id || params.sessionId || "").trim();

  const [loading, setLoading] = useState(true);
  const [activated, setActivated] = useState(false);
  const [message, setMessage] = useState(
    "Activating your Farm2Home membership..."
  );

  useEffect(() => {
    activateMembership();
  }, []);

  async function verifyStripeSession() {
    if (!sessionId) {
      return null;
    }

    const response = await fetch(
      `${API_BASE_URL}/payments/verify-checkout-session`,
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

    const text = await response.text();

    let data: any = {};

    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`Invalid backend response: ${text}`);
    }

    if (!response.ok || !data.success) {
      throw new Error(data.error || "Unable to verify Stripe subscription.");
    }

    return data;
  }

  async function saveActiveCustomer(
    customer: StoredCustomer,
    stripeData: any | null
  ) {
    const stripeStatus =
      stripeData?.subscriptionStatus ||
      stripeData?.metadata?.subscriptionStatus ||
      "active";

    const activeCustomer: StoredCustomer = {
      ...customer,
      id:
        customer.id ||
        stripeData?.metadata?.customerId ||
        stripeData?.metadata?.userId ||
        customer.email ||
        "",
      email:
        customer.email ||
        stripeData?.customerEmail ||
        stripeData?.metadata?.email ||
        "",
      fullName:
        customer.fullName ||
        customer.name ||
        stripeData?.metadata?.name ||
        "Farm2Home Customer",
      accountActive: true,
      membershipStatus: "Active",
      subscriptionStatus: stripeStatus,
      subscriptionActive: true,
      stripeCustomerId: stripeData?.customerId || customer.stripeCustomerId || "",
      stripeSubscriptionId:
        stripeData?.subscriptionId || customer.stripeSubscriptionId || "",
      currentPeriodEnd:
        stripeData?.currentPeriodEnd || customer.currentPeriodEnd || null,
      subscriptionActivatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const customersRaw = await AsyncStorage.getItem("farm2homeCustomers");
    const customers = safelyParseArray(customersRaw);

    const updatedCustomers = [
      ...customers.filter((item) => {
        const sameId =
          item.id && activeCustomer.id && item.id === activeCustomer.id;

        const sameEmail =
          item.email &&
          activeCustomer.email &&
          item.email.toLowerCase() === activeCustomer.email.toLowerCase();

        const sameUsername =
          item.username &&
          activeCustomer.username &&
          item.username.toLowerCase() ===
            activeCustomer.username.toLowerCase();

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

    await AsyncStorage.setItem("currentUser", JSON.stringify(activeCustomer));
    await AsyncStorage.setItem("userRole", "customer");
    await AsyncStorage.setItem("currentUserRole", "customer");
    await AsyncStorage.removeItem("pendingCustomer");

    return activeCustomer;
  }

  async function activateMembership() {
    try {
      setLoading(true);

      const pendingRaw = await AsyncStorage.getItem("pendingCustomer");
      const currentRaw = await AsyncStorage.getItem("currentCustomer");
      const currentUserRaw = await AsyncStorage.getItem("currentUser");

      const pendingCustomer = safelyParseCustomer(pendingRaw);
      const currentCustomer = safelyParseCustomer(currentRaw);
      const currentUser = safelyParseCustomer(currentUserRaw);

      const storedCustomer = pendingCustomer || currentCustomer || currentUser;

      const stripeData = await verifyStripeSession();

      const stripeIsActive =
        stripeData?.mode === "payment"
          ? stripeData?.paymentStatus === "paid"
          : isActiveStripeStatus(stripeData?.subscriptionStatus);

      if (sessionId && !stripeIsActive) {
        setActivated(false);
        setMessage(
          "Stripe payment was found, but the subscription is not active yet."
        );
        return;
      }

      const customer: StoredCustomer =
        storedCustomer || {
          id:
            stripeData?.metadata?.customerId ||
            stripeData?.metadata?.userId ||
            stripeData?.customerEmail ||
            "",
          email:
            stripeData?.customerEmail ||
            stripeData?.metadata?.email ||
            "",
          fullName:
            stripeData?.metadata?.name ||
            "Farm2Home Customer",
        };

      if (!customer.email && !customer.id) {
        setActivated(false);
        setMessage(
          "Payment completed, but Farm2Home could not match the customer account."
        );
        return;
      }

      await saveActiveCustomer(customer, stripeData);

      setActivated(true);
      setMessage(
        "Your customer membership is now active. You can access the Farm2Home marketplace."
      );
    } catch (error: any) {
      console.log("Subscription activation error:", error);

      Alert.alert(
        "Activation Error",
        error?.message || "Unable to activate customer membership."
      );

      setActivated(false);
      setMessage(
        error?.message ||
          "Payment may have completed, but Farm2Home could not verify the subscription."
      );
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

  function retryActivation() {
    activateMembership();
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
        {activated ? "Membership Active!" : "Membership Needs Verification"}
      </Text>

      <Text style={styles.message}>{message}</Text>

      {activated ? (
        <TouchableOpacity
          style={styles.button}
          onPress={goToMarketplace}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>Start Shopping</Text>
        </TouchableOpacity>
      ) : (
        <>
          <TouchableOpacity
            style={styles.button}
            onPress={retryActivation}
            activeOpacity={0.85}
          >
            <Text style={styles.buttonText}>Retry Activation</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={goToLogin}
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryButtonText}>Go To Login</Text>
          </TouchableOpacity>
        </>
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
  secondaryButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: farmTheme.colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 18,
    marginTop: 12,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: farmTheme.colors.primary,
    fontWeight: "900",
    fontSize: 16,
  },
});