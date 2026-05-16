import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";

export default function CustomerSubscriptionScreen() {
  const [email, setEmail] = useState("customer@test.com");
  const [loading, setLoading] = useState(false);

  async function startSubscription() {
    if (loading) return;

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes("@")) {
      Alert.alert("Missing Email", "Please enter a valid customer email.");
      return;
    }

    try {
      setLoading(true);

      const customer = {
        id: `customer_${Date.now()}`,
        email: cleanEmail,
        fullName: "Test Customer",
        role: "customer",
        membershipStatus: "Active",
        subscriptionStatus: "Active",
        planType: "customer",
        createdAt: new Date().toISOString(),
      };

      await AsyncStorage.setItem("currentUser", JSON.stringify(customer));
      await AsyncStorage.setItem("currentCustomer", JSON.stringify(customer));
      await AsyncStorage.setItem("currentUserRole", "customer");

      Alert.alert("Membership Active", "Customer test membership is active.", [
        {
          text: "Continue",
          onPress: () => router.replace("/customer/marketplace"),
        },
      ]);
    } catch (error: any) {
      Alert.alert(
        "Subscription Error",
        error?.message || "Unable to start subscription."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Farm2Home Membership</Text>

        <Text style={styles.price}>Monthly Customer Membership</Text>

        <Text style={styles.note}>
          Test mode is active. This button creates a local customer membership
          and opens the marketplace without Stripe.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Customer Email"
          placeholderTextColor="#888888"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          value={email}
          onChangeText={setEmail}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.disabledButton]}
          onPress={startSubscription}
          disabled={loading}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>
            {loading ? "Activating..." : "Create Account + Subscribe"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.replace("/customer/marketplace")}
        >
          <Text style={styles.secondaryText}>Skip to Marketplace</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F7F7F2",
  },
  container: {
    flexGrow: 1,
    padding: 20,
    justifyContent: "center",
  },
  title: {
    fontSize: 30,
    fontWeight: "900",
    color: "#1F7A3F",
    marginBottom: 12,
  },
  price: {
    fontSize: 24,
    fontWeight: "900",
    color: "#111827",
    marginBottom: 12,
  },
  note: {
    color: "#555555",
    marginBottom: 20,
    lineHeight: 22,
    fontWeight: "700",
  },
  input: {
    backgroundColor: "#FFFFFF",
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    color: "#111827",
  },
  button: {
    backgroundColor: "#2F7D32",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  secondaryButton: {
    alignItems: "center",
    marginTop: 16,
  },
  secondaryText: {
    color: "#2F7D32",
    fontWeight: "900",
  },
});