import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

export default function OrderConfirmation() {
  const { orderId, total } = useLocalSearchParams();

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>✅</Text>
      <Text style={styles.title}>Order Submitted</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Order ID</Text>
        <Text style={styles.value}>{orderId}</Text>

        <Text style={styles.label}>Total</Text>
        <Text style={styles.total}>${total}</Text>

        <Text style={styles.message}>
          Your Farm2Home order has been submitted. The farmer will prepare your
          items and delivery will be coordinated.
        </Text>
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.replace("/marketplace")}
      >
        <Text style={styles.buttonText}>Back to Marketplace</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.replace("/")}>
        <Text style={styles.link}>Home</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: "#F7F7F2",
    justifyContent: "center",
  },
  icon: {
    fontSize: 54,
    textAlign: "center",
    marginBottom: 10,
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    color: "#1f7a3f",
    textAlign: "center",
    marginBottom: 20,
  },
  card: {
    backgroundColor: "#fff",
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#ddd",
    marginBottom: 20,
  },
  label: {
    color: "#666",
    fontWeight: "700",
    marginTop: 8,
  },
  value: {
    fontSize: 17,
    fontWeight: "900",
  },
  total: {
    fontSize: 24,
    fontWeight: "900",
    color: "#1f7a3f",
  },
  message: {
    color: "#555",
    lineHeight: 21,
    marginTop: 16,
  },
  button: {
    backgroundColor: "#2F7D32",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "900",
  },
  link: {
    textAlign: "center",
    color: "#1E5F74",
    fontWeight: "900",
    marginTop: 18,
  },
});