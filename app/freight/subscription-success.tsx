// app/freight/subscription-success.tsx

import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import freightTheme from "../styles/freightTheme";

export default function FreightSubscriptionSuccess() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    activateFreightCarrier();
  }, []);

  async function activateFreightCarrier() {
    try {
      const pending =
        (await AsyncStorage.getItem("pendingFreightCarrier")) ||
        (await AsyncStorage.getItem("currentFreightCarrier")) ||
        (await AsyncStorage.getItem("currentFreight")) ||
        (await AsyncStorage.getItem("currentUser"));

      if (pending) {
        const carrier = JSON.parse(pending);

        const activeCarrier = {
          ...carrier,
          role: "freight",
          membershipStatus: "Active",
          subscriptionStatus: "active",
          freightMembershipPaid: true,
          accountActive: true,
          activatedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await AsyncStorage.setItem(
          "currentFreightCarrier",
          JSON.stringify(activeCarrier)
        );
        await AsyncStorage.setItem("currentFreight", JSON.stringify(activeCarrier));
        await AsyncStorage.setItem(
          "currentFreightUser",
          JSON.stringify(activeCarrier)
        );
        await AsyncStorage.setItem("currentUser", JSON.stringify(activeCarrier));
        await AsyncStorage.setItem("userRole", "freight");
        await AsyncStorage.setItem("currentUserRole", "freight");
        await AsyncStorage.setItem("freightSubscriptionStatus", "active");

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
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor="#020617" />

        <View style={styles.center}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.loadingText}>Activating Freight Connect...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#020617" />

      <View style={styles.container}>
        <View style={styles.successIcon}>
          <Ionicons name="checkmark-done-outline" size={46} color="#FFFFFF" />
        </View>

        <Text style={styles.kicker}>Farm2Home Freight Connect</Text>
        <Text style={styles.title}>Membership Active!</Text>

        <Text style={styles.message}>
          Your Freight Connect membership is now active. Your carrier account may
          still require admin verification before full freight access is unlocked.
        </Text>

        <View style={styles.statusCard}>
          <Text style={styles.statusTitle}>Next Step</Text>
          <Text style={styles.statusText}>
            Continue to your Freight Dashboard to view carrier tools, load board
            access, routes, and account status.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.replace("/freight/dashboard" as any)}
        >
          <Ionicons name="grid-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>Go to Freight Dashboard</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.replace("/freight/profile" as any)}
        >
          <Ionicons
            name="business-outline"
            size={18}
            color={freightTheme.colors.primary}
          />
          <Text style={styles.secondaryButtonText}>Open Freight Profile</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.homeButton}
          onPress={() => router.replace("/" as any)}
        >
          <Text style={styles.homeText}>Back Home</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: freightTheme.colors.background,
  },
  center: {
    flex: 1,
    backgroundColor: freightTheme.colors.background,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingText: {
    color: freightTheme.colors.mutedText,
    marginTop: 12,
    fontWeight: "800",
  },
  container: {
    flex: 1,
    backgroundColor: freightTheme.colors.background,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  successIcon: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: "#064E3B",
    borderWidth: 1,
    borderColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  kicker: {
    color: "#10B981",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
    textAlign: "center",
  },
  title: {
    fontSize: 36,
    fontWeight: "900",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    color: "#CBD5E1",
    textAlign: "center",
    lineHeight: 24,
    fontWeight: "700",
    marginBottom: 20,
  },
  statusCard: {
    backgroundColor: "#064E3B",
    borderWidth: 1,
    borderColor: "#10B981",
    borderRadius: 20,
    padding: 18,
    width: "100%",
    marginBottom: 18,
  },
  statusTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 8,
  },
  statusText: {
    color: "#BBF7D0",
    fontWeight: "700",
    lineHeight: 22,
  },
  primaryButton: {
    width: "100%",
    backgroundColor: freightTheme.colors.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },
  secondaryButton: {
    width: "100%",
    backgroundColor: freightTheme.colors.card,
    borderWidth: 1,
    borderColor: freightTheme.colors.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  secondaryButtonText: {
    color: freightTheme.colors.primary,
    fontWeight: "900",
    fontSize: 16,
  },
  homeButton: {
    marginTop: 18,
  },
  homeText: {
    color: freightTheme.colors.mutedText,
    fontWeight: "900",
  },
});