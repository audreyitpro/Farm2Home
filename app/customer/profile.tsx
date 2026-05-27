import React, { useCallback, useState } from "react";
import {
  Alert,
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
import { router, useFocusEffect } from "expo-router";

import { API_BASE_URL } from "../config/api";

export default function CustomerProfile() {
  const [customer, setCustomer] = useState<any>(null);
  const [allCustomers, setAllCustomers] = useState<any[]>([]);

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  useFocusEffect(
    useCallback(() => {
      loadCustomer();
    }, [])
  );

  async function loadCustomer() {
    try {
      const currentRaw =
        (await AsyncStorage.getItem("currentCustomer")) ||
        (await AsyncStorage.getItem("currentUser"));

      const savedCustomers = await AsyncStorage.getItem("farm2homeCustomers");

      const customers = savedCustomers ? JSON.parse(savedCustomers) : [];
      const safeCustomers = Array.isArray(customers) ? customers : [];

      setAllCustomers(safeCustomers);

      if (!currentRaw && safeCustomers.length === 0) {
        router.replace("/customer/login" as never);
        return;
      }

      let current = currentRaw
        ? JSON.parse(currentRaw)
        : safeCustomers[safeCustomers.length - 1];

      if (!current) {
        router.replace("/customer/login" as never);
        return;
      }

      setCustomer(current);

      setFullName(current.fullName || current.name || "");
      setUsername(current.username || "");
      setEmail(current.email || "");
    } catch (error) {
      console.log("Customer profile load error:", error);
      router.replace("/customer/login" as never);
    }
  }

  async function persistCustomer(updatedCustomer: any) {
    const existing = allCustomers.length > 0 ? allCustomers : [];

    const exists = existing.some(
      (item) => item.id === updatedCustomer.id
    );

    const updatedCustomers = exists
      ? existing.map((item) =>
          item.id === updatedCustomer.id
            ? updatedCustomer
            : item
        )
      : [...existing, updatedCustomer];

    await AsyncStorage.setItem(
      "farm2homeCustomers",
      JSON.stringify(updatedCustomers)
    );

    await AsyncStorage.setItem(
      "currentCustomer",
      JSON.stringify(updatedCustomer)
    );

    await AsyncStorage.setItem(
      "currentUser",
      JSON.stringify(updatedCustomer)
    );

    await AsyncStorage.setItem("userRole", "customer");
    await AsyncStorage.setItem("currentUserRole", "customer");

    setCustomer(updatedCustomer);
    setAllCustomers(updatedCustomers);
  }

  async function saveProfile() {
    if (!customer) {
      Alert.alert(
        "No Customer",
        "No customer profile was found."
      );
      return;
    }

    if (!fullName.trim()) {
      Alert.alert(
        "Name Required",
        "Please enter your name."
      );
      return;
    }

    if (!username.trim()) {
      Alert.alert(
        "Username Required",
        "Please enter your username."
      );
      return;
    }

    const updatedCustomer = {
      ...customer,
      fullName: fullName.trim(),
      name: fullName.trim(),
      username: username.trim(),
      email: email.trim(),
      updatedAt: new Date().toISOString(),
    };

    await persistCustomer(updatedCustomer);

    Alert.alert(
      "Saved",
      "Customer profile updated successfully."
    );
  }

  async function changePassword() {
    if (!customer) return;

    if (!currentPassword.trim()) {
      Alert.alert(
        "Current Password Required",
        "Please enter your current password."
      );
      return;
    }

    if (
      customer.password &&
      currentPassword !== customer.password
    ) {
      Alert.alert(
        "Incorrect Password",
        "Your current password is incorrect."
      );
      return;
    }

    if (!newPassword.trim()) {
      Alert.alert(
        "New Password Required",
        "Please enter a new password."
      );
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert(
        "Password Too Short",
        "Password must be at least 6 characters."
      );
      return;
    }

    if (newPassword !== confirmNewPassword) {
      Alert.alert(
        "Password Mismatch",
        "New passwords do not match."
      );
      return;
    }

    const updatedCustomer = {
      ...customer,
      password: newPassword,
      updatedAt: new Date().toISOString(),
    };

    await persistCustomer(updatedCustomer);

    setCurrentPassword("");
    setNewPassword("");
    setConfirmNewPassword("");

    Alert.alert(
      "Password Updated",
      "Your password was changed successfully."
    );
  }

  async function openUrl(url: string) {
    if (!url) return;

    if (Platform.OS === "web") {
      window.location.href = url;
      return;
    }

    await WebBrowser.openBrowserAsync(url);
  }

  async function openBillingPortal() {
    try {
      const stripeCustomerId =
        customer?.stripeCustomerId ||
        customer?.customerId;

      if (!stripeCustomerId) {
        Alert.alert(
          "Missing Stripe Customer",
          "No Stripe customer ID was found."
        );
        return;
      }

      const res = await fetch(
        `${API_BASE_URL}/payments/create-customer-portal-session`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            customerId: stripeCustomerId,
            returnUrl: "farm2home://customer/profile",
          }),
        }
      );

      const data = await res.json();

      if (!res.ok || data.error || !data.url) {
        Alert.alert(
          "Billing Error",
          data.error ||
            "Unable to open billing portal."
        );
        return;
      }

      await openUrl(data.url);
    } catch (error: any) {
      Alert.alert(
        "Billing Error",
        error.message ||
          "Unable to open billing portal."
      );
    }
  }

  async function cancelSubscription() {
    const subscriptionId =
      customer?.stripeSubscriptionId ||
      customer?.subscriptionId;

    if (!subscriptionId) {
      Alert.alert(
        "No Subscription",
        "No active customer subscription was found."
      );
      return;
    }

    Alert.alert(
      "Cancel Subscription",
      "Are you sure you want to cancel your customer membership?",
      [
        {
          text: "No",
          style: "cancel",
        },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            try {
              const response = await fetch(
                `${API_BASE_URL}/payments/cancel-subscription`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type":
                      "application/json",
                  },
                  body: JSON.stringify({
                    subscriptionId,
                    customerId: customer?.id,
                    role: "customer",
                  }),
                }
              );

              const data = await response.json();

              if (!response.ok || data.error) {
                Alert.alert(
                  "Stripe Error",
                  data.error ||
                    "Unable to cancel subscription."
                );
                return;
              }

              const updatedCustomer = {
                ...customer,
                membershipStatus: "Canceled",
                subscriptionStatus: "canceled",
                updatedAt:
                  new Date().toISOString(),
              };

              await persistCustomer(
                updatedCustomer
              );

              Alert.alert(
                "Canceled",
                "Customer subscription canceled successfully."
              );
            } catch (error: any) {
              Alert.alert(
                "Cancel Error",
                error.message ||
                  "Unable to cancel subscription."
              );
            }
          },
        },
      ]
    );
  }

  async function logout() {
    await AsyncStorage.removeItem("currentCustomer");
    await AsyncStorage.removeItem("currentUser");
    await AsyncStorage.removeItem("userRole");
    await AsyncStorage.removeItem("currentUserRole");

    router.replace("/customer/login" as never);
  }

  if (!customer) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>
          Customer Profile
        </Text>

        <Text style={styles.subheader}>
          No customer profile found.
        </Text>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() =>
            router.replace("/customer/login" as never)
          }
        >
          <Text style={styles.buttonText}>
            Go to Customer Login
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.title}>
        Customer Profile
      </Text>

      <View style={styles.statusCard}>
        <Text style={styles.statusTitle}>
          Membership Status
        </Text>

        <Text style={styles.active}>
          {customer.membershipStatus ||
            customer.subscriptionStatus ||
            "Active"}
        </Text>

        <Text style={styles.statusSmall}>
          Customer membership provides access
          to Farm2Home ordering, delivery,
          subscriptions, and premium features.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          Profile Information
        </Text>

        <Text style={styles.label}>
          Full Name
        </Text>

        <TextInput
          style={styles.input}
          value={fullName}
          onChangeText={setFullName}
          placeholder="Full name"
        />

        <Text style={styles.label}>
          Username
        </Text>

        <TextInput
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          placeholder="Username"
          autoCapitalize="none"
        />

        <Text style={styles.label}>
          Email
        </Text>

        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={saveProfile}
        >
          <Text style={styles.buttonText}>
            Save Profile
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          Change Password
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Current password"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
        />

        <TextInput
          style={styles.input}
          placeholder="New password"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
        />

        <TextInput
          style={styles.input}
          placeholder="Confirm new password"
          value={confirmNewPassword}
          onChangeText={
            setConfirmNewPassword
          }
          secureTextEntry
        />

        <TouchableOpacity
          style={styles.blueButton}
          onPress={changePassword}
        >
          <Text style={styles.buttonText}>
            Change Password
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          Manage Subscription
        </Text>

        <Text style={styles.helpText}>
          Manage your Farm2Home customer
          membership, update your payment
          method, review invoices, or cancel
          your subscription.
        </Text>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={openBillingPortal}
        >
          <Text style={styles.buttonText}>
            Manage Subscription
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={cancelSubscription}
        >
          <Text style={styles.buttonText}>
            Cancel Subscription
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.marketButton}
        onPress={() =>
          router.push(
            "/customer/marketplace" as never
          )
        }
      >
        <Text style={styles.buttonText}>
          Go to Marketplace
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.logoutButton}
        onPress={logout}
      >
        <Text style={styles.buttonText}>
          Logout
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  content: {
    padding: 22,
    paddingBottom: 70,
  },

  title: {
    fontSize: 30,
    fontWeight: "900",
    marginBottom: 12,
    color: "#111827",
  },

  subheader: {
    color: "#666666",
    marginBottom: 20,
    fontWeight: "700",
  },

  statusCard: {
    backgroundColor: "#E8F5E9",
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#B7DFB9",
  },

  statusTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#14532D",
    marginBottom: 6,
  },

  statusSmall: {
    marginTop: 8,
    color: "#14532D",
    fontWeight: "700",
    lineHeight: 20,
  },

  card: {
    backgroundColor: "#F5F5F5",
    padding: 18,
    borderRadius: 16,
    marginBottom: 18,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 14,
    color: "#111827",
  },

  label: {
    color: "#666666",
    marginTop: 10,
    marginBottom: 6,
    fontWeight: "700",
  },

  value: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
  },

  active: {
    fontSize: 18,
    fontWeight: "900",
    color: "#1F7A3F",
  },

  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    fontWeight: "700",
  },

  helpText: {
    color: "#4B5563",
    fontWeight: "700",
    lineHeight: 21,
    marginBottom: 12,
  },

  primaryButton: {
    backgroundColor: "#1F7A3F",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 10,
  },

  blueButton: {
    backgroundColor: "#1565C0",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 10,
  },

  marketButton: {
    backgroundColor: "#111827",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 6,
  },

  cancelButton: {
    backgroundColor: "#D32F2F",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 10,
  },

  logoutButton: {
    backgroundColor: "#6B7280",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 10,
    marginBottom: 40,
  },

  buttonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },
});