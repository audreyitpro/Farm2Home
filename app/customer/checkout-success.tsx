import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";

import { clearCart } from "../data/cartStore";
import {
  addOrder,
  clearPendingOrder,
  getPendingOrder,
} from "../data/orderStore";
import { reduceProductInventory } from "../data/farmerStore";
import farmTheme from "../styles/farmTheme";

export default function CheckoutSuccess() {
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    finishOrder();
  }, []);

  async function finishOrder() {
    try {
      const pendingOrder = await getPendingOrder();

      if (pendingOrder) {
        await addOrder(pendingOrder);

        for (const item of pendingOrder.items) {
          await reduceProductInventory(item.id, item.quantity);
        }

        await clearPendingOrder();
        setSaved(true);
      }

      await clearCart();
    } catch (error) {
      console.error("Checkout success error:", error);
      setHasError(true);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={farmTheme.colors.primary} />
        <Text style={styles.message}>Saving your order...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{hasError ? "⚠️" : "✅"}</Text>

      <Text style={styles.title}>
        {hasError ? "Order Needs Review" : "Order Paid Successfully!"}
      </Text>

      <Text style={styles.message}>
        {hasError
          ? "Payment completed, but there was an issue saving the order details. Please check your orders or contact support."
          : saved
            ? "Your order was saved and inventory was updated."
            : "Payment completed. No pending order was found to save."}
      </Text>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.replace("/customer/orders" as never)}
        activeOpacity={0.85}
      >
        <Text style={styles.buttonText}>View My Orders</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => router.replace("/customer/marketplace" as never)}
        activeOpacity={0.85}
      >
        <Text style={styles.secondaryText}>Back to Marketplace</Text>
      </TouchableOpacity>
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
    fontSize: 32,
    fontWeight: "900",
    color: farmTheme.colors.primary,
    textAlign: "center",
    marginBottom: 14,
  },

  message: {
    fontSize: 17,
    color: farmTheme.colors.mutedText,
    textAlign: "center",
    lineHeight: 25,
    marginBottom: 28,
  },

  button: {
    backgroundColor: farmTheme.colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 14,
    alignItems: "center",
    minWidth: 220,
  },

  buttonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },

  secondaryButton: {
    marginTop: 16,
  },

  secondaryText: {
    color: farmTheme.colors.primary,
    fontWeight: "900",
  },
});