import React from "react";
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { router } from "expo-router";

export default function SubscriptionLockedScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.icon}>🔒</Text>

        <Text style={styles.title}>Subscription Required</Text>

        <Text style={styles.description}>
          Your Farm2Home subscription is inactive or canceled.
          Renew your membership to regain access to marketplace,
          freight, farmer, and driver features.
        </Text>

        <TouchableOpacity
          style={styles.button}
          onPress={() => router.push("/profile/edit-profile")}
        >
          <Text style={styles.buttonText}>
            Manage Subscription
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.replace("/")}
        >
          <Text style={styles.secondaryButtonText}>
            Return Home
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },

  card: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  icon: {
    fontSize: 72,
    marginBottom: 20,
  },

  title: {
    fontSize: 30,
    fontWeight: "900",
    color: "#064E3B",
    textAlign: "center",
  },

  description: {
    marginTop: 16,
    textAlign: "center",
    color: "#475569",
    lineHeight: 24,
    fontSize: 16,
    fontWeight: "700",
  },

  button: {
    marginTop: 28,
    backgroundColor: "#10B981",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 18,
    width: "100%",
    alignItems: "center",
  },

  buttonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },

  secondaryButton: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    paddingVertical: 15,
    paddingHorizontal: 24,
    borderRadius: 18,
    width: "100%",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },

  secondaryButtonText: {
    color: "#334155",
    fontWeight: "800",
    fontSize: 15,
  },
});