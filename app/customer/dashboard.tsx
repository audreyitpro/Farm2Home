import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";

export default function CustomerDashboard() {
  return (
    <View style={styles.page}>
      <Text style={styles.title}>Customer Dashboard</Text>
      <Text style={styles.subtitle}>Welcome to Farm2Home.</Text>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push("/marketplace" as any)}
      >
        <Text style={styles.buttonText}>Open Marketplace</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push("/customer/cart" as any)}
      >
        <Text style={styles.buttonText}>View Cart</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push("/customer/orders" as any)}
      >
        <Text style={styles.buttonText}>My Orders</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F7F7F2",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: 34,
    fontWeight: "900",
    color: "#064E3B",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    color: "#4B5563",
    textAlign: "center",
    fontWeight: "700",
    marginBottom: 28,
  },
  button: {
    backgroundColor: "#2F7D32",
    padding: 17,
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 14,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },
});