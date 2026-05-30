import React, { useCallback, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as WebBrowser from "expo-web-browser";
import { router, useFocusEffect } from "expo-router";

import { API_BASE_URL } from "../config/api";

const COLORS = {
  primary: "#2E7D32",
  primaryDark: "#14532D",
  secondary: "#F9A825",
  background: "#F8FAF5",
  card: "#FFFFFF",
  text: "#172017",
  muted: "#75806F",
  border: "#E2E8DA",
  softGreen: "#EAF5E6",
  lightGreen: "#F1FAED",
  danger: "#DC2626",
  dark: "#111827",
  blue: "#1565C0",
};

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

      const current = currentRaw
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

    const exists = existing.some((item) => item.id === updatedCustomer.id);

    const updatedCustomers = exists
      ? existing.map((item) =>
          item.id === updatedCustomer.id ? updatedCustomer : item
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

    await AsyncStorage.setItem("currentUser", JSON.stringify(updatedCustomer));
    await AsyncStorage.setItem("userRole", "customer");
    await AsyncStorage.setItem("currentUserRole", "customer");

    setCustomer(updatedCustomer);
    setAllCustomers(updatedCustomers);
  }

  async function saveProfile() {
    if (!customer) {
      Alert.alert("No Customer", "No customer profile was found.");
      return;
    }

    if (!fullName.trim()) {
      Alert.alert("Name Required", "Please enter your name.");
      return;
    }

    if (!username.trim()) {
      Alert.alert("Username Required", "Please enter your username.");
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

    Alert.alert("Saved", "Customer profile updated successfully.");
  }

  async function changePassword() {
    if (!customer) return;

    if (!currentPassword.trim()) {
      Alert.alert("Current Password Required", "Please enter your current password.");
      return;
    }

    if (customer.password && currentPassword !== customer.password) {
      Alert.alert("Incorrect Password", "Your current password is incorrect.");
      return;
    }

    if (!newPassword.trim()) {
      Alert.alert("New Password Required", "Please enter a new password.");
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert("Password Too Short", "Password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      Alert.alert("Password Mismatch", "New passwords do not match.");
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

    Alert.alert("Password Updated", "Your password was changed successfully.");
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
      const stripeCustomerId = customer?.stripeCustomerId || customer?.customerId;

      if (!stripeCustomerId) {
        Alert.alert("Missing Stripe Customer", "No Stripe customer ID was found.");
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
          data.error || "Unable to open billing portal."
        );
        return;
      }

      await openUrl(data.url);
    } catch (error: any) {
      Alert.alert(
        "Billing Error",
        error.message || "Unable to open billing portal."
      );
    }
  }

  async function cancelSubscription() {
    const subscriptionId =
      customer?.stripeSubscriptionId || customer?.subscriptionId;

    if (!subscriptionId) {
      Alert.alert("No Subscription", "No active customer subscription was found.");
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
                    "Content-Type": "application/json",
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
                  data.error || "Unable to cancel subscription."
                );
                return;
              }

              const updatedCustomer = {
                ...customer,
                membershipStatus: "Canceled",
                subscriptionStatus: "canceled",
                updatedAt: new Date().toISOString(),
              };

              await persistCustomer(updatedCustomer);

              Alert.alert(
                "Canceled",
                "Customer subscription canceled successfully."
              );
            } catch (error: any) {
              Alert.alert(
                "Cancel Error",
                error.message || "Unable to cancel subscription."
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
      <View style={styles.emptyPage}>
        <Text style={styles.emptyIcon}>👤</Text>
        <Text style={styles.emptyTitle}>Customer Profile</Text>
        <Text style={styles.emptyText}>No customer profile found.</Text>

        <Pressable
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          onPress={() => router.replace("/customer/login" as never)}
        >
          <Text style={styles.buttonText}>Go to Customer Login</Text>
        </Pressable>
      </View>
    );
  }

  const membershipStatus =
    customer.membershipStatus || customer.subscriptionStatus || "Active";

  return (
    <View style={styles.page}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.topBar}>
          <Pressable
            style={({ pressed }) => [styles.backCircle, pressed && styles.pressed]}
            onPress={() => router.push("/customer/marketplace" as never)}
          >
            <Text style={styles.backCircleText}>‹</Text>
          </Pressable>

          <View style={styles.topTitleBlock}>
            <Text style={styles.title}>Profile</Text>
            <Text style={styles.subtitle}>Customer account settings</Text>
          </View>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {(fullName || username || "C").slice(0, 1).toUpperCase()}
            </Text>
          </View>

          <View style={styles.heroTextBlock}>
            <Text style={styles.heroName}>
              {fullName || customer.name || "Farm2Home Customer"}
            </Text>
            <Text style={styles.heroEmail}>{email || "No email saved"}</Text>

            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>{membershipStatus}</Text>
            </View>
          </View>
        </View>

        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <Text style={styles.statusIcon}>🌱</Text>
            <View style={styles.statusTextBlock}>
              <Text style={styles.statusTitle}>Membership Status</Text>
              <Text style={styles.active}>{membershipStatus}</Text>
            </View>
          </View>

          <Text style={styles.statusSmall}>
            Customer membership provides access to Farm2Home ordering, delivery,
            subscriptions, and premium features.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Profile Information</Text>

          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={styles.input}
            value={fullName}
            onChangeText={setFullName}
            placeholder="Full name"
            placeholderTextColor="#8A9482"
          />

          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="Username"
            placeholderTextColor="#8A9482"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor="#8A9482"
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            onPress={saveProfile}
          >
            <Text style={styles.buttonText}>Save Profile</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Change Password</Text>

          <TextInput
            style={styles.input}
            placeholder="Current password"
            placeholderTextColor="#8A9482"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
          />

          <TextInput
            style={styles.input}
            placeholder="New password"
            placeholderTextColor="#8A9482"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
          />

          <TextInput
            style={styles.input}
            placeholder="Confirm new password"
            placeholderTextColor="#8A9482"
            value={confirmNewPassword}
            onChangeText={setConfirmNewPassword}
            secureTextEntry
          />

          <Pressable
            style={({ pressed }) => [styles.blueButton, pressed && styles.pressed]}
            onPress={changePassword}
          >
            <Text style={styles.buttonText}>Change Password</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Manage Subscription</Text>

          <Text style={styles.helpText}>
            Manage your Farm2Home customer membership, update payment method,
            review invoices, or cancel your subscription.
          </Text>

          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            onPress={openBillingPortal}
          >
            <Text style={styles.buttonText}>Manage Subscription</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
            onPress={cancelSubscription}
          >
            <Text style={styles.buttonText}>Cancel Subscription</Text>
          </Pressable>
        </View>

        <View style={styles.quickActionsCard}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>

          <Pressable
            style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}
            onPress={() => router.push("/customer/marketplace" as never)}
          >
            <View style={styles.actionIcon}>
              <Text style={styles.actionIconText}>🛒</Text>
            </View>
            <View style={styles.actionTextBlock}>
              <Text style={styles.actionTitle}>Go to Marketplace</Text>
              <Text style={styles.actionSubtitle}>Shop local farm goods</Text>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}
            onPress={() => router.push("/customer/orders" as never)}
          >
            <View style={styles.actionIcon}>
              <Text style={styles.actionIconText}>🧾</Text>
            </View>
            <View style={styles.actionTextBlock}>
              <Text style={styles.actionTitle}>My Orders</Text>
              <Text style={styles.actionSubtitle}>View cart and order history</Text>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </Pressable>
        </View>

        <Pressable
          style={({ pressed }) => [styles.logoutButton, pressed && styles.pressed]}
          onPress={logout}
        >
          <Text style={styles.buttonText}>Logout</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 18,
    paddingBottom: 70,
  },
  emptyPage: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  emptyIcon: {
    fontSize: 52,
    marginBottom: 10,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: "900",
    textAlign: "center",
  },
  emptyText: {
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 8,
    marginBottom: 18,
    textAlign: "center",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
    gap: 12,
  },
  backCircle: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  backCircleText: {
    fontSize: 34,
    color: COLORS.text,
    fontWeight: "900",
    marginTop: -4,
  },
  topTitleBlock: {
    flex: 1,
  },
  title: {
    fontSize: 30,
    fontWeight: "900",
    color: COLORS.text,
  },
  subtitle: {
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 3,
  },
  heroCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 30,
    padding: 18,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatarCircle: {
    width: 74,
    height: 74,
    borderRadius: 26,
    backgroundColor: COLORS.secondary,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: COLORS.dark,
    fontSize: 30,
    fontWeight: "900",
  },
  heroTextBlock: {
    flex: 1,
  },
  heroName: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
  },
  heroEmail: {
    color: "#EAF7E6",
    fontWeight: "700",
    marginTop: 4,
  },
  statusPill: {
    alignSelf: "flex-start",
    marginTop: 10,
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  statusPillText: {
    color: "#FFFFFF",
    fontWeight: "900",
    textTransform: "capitalize",
  },
  statusCard: {
    backgroundColor: COLORS.card,
    borderRadius: 28,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  statusHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  statusIcon: {
    fontSize: 34,
  },
  statusTextBlock: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.text,
  },
  active: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.primary,
    marginTop: 4,
    textTransform: "capitalize",
  },
  statusSmall: {
    marginTop: 12,
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 21,
  },
  card: {
    backgroundColor: COLORS.card,
    padding: 18,
    borderRadius: 28,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 21,
    fontWeight: "900",
    marginBottom: 14,
    color: COLORS.text,
  },
  label: {
    color: COLORS.muted,
    marginTop: 6,
    marginBottom: 7,
    fontWeight: "900",
    fontSize: 13,
  },
  input: {
    backgroundColor: COLORS.lightGreen,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 15,
    marginBottom: 10,
    fontWeight: "800",
    color: COLORS.text,
  },
  helpText: {
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 22,
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 18,
    alignItems: "center",
    marginTop: 10,
  },
  blueButton: {
    backgroundColor: COLORS.blue,
    padding: 16,
    borderRadius: 18,
    alignItems: "center",
    marginTop: 10,
  },
  cancelButton: {
    backgroundColor: COLORS.danger,
    padding: 16,
    borderRadius: 18,
    alignItems: "center",
    marginTop: 10,
  },
  logoutButton: {
    backgroundColor: COLORS.dark,
    padding: 16,
    borderRadius: 18,
    alignItems: "center",
    marginTop: 4,
    marginBottom: 30,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },
  quickActionsCard: {
    backgroundColor: COLORS.card,
    padding: 18,
    borderRadius: 28,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.lightGreen,
    padding: 13,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 10,
    gap: 12,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    justifyContent: "center",
    alignItems: "center",
  },
  actionIconText: {
    fontSize: 25,
  },
  actionTextBlock: {
    flex: 1,
  },
  actionTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 16,
  },
  actionSubtitle: {
    color: COLORS.muted,
    fontWeight: "700",
    fontSize: 12,
    marginTop: 3,
  },
  actionArrow: {
    color: COLORS.primary,
    fontSize: 26,
    fontWeight: "900",
  },
  pressed: {
    opacity: 0.75,
  },
});