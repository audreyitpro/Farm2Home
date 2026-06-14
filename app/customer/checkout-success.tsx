// app/customer/checkout-success.tsx

import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { supabase } from "../data/supabaseClient";
import farmTheme from "../styles/farmTheme";

type SaveStatus = "loading" | "success" | "warning" | "error";

function getProductId(item: any) {
  return String(item?.productId || item?.product_id || item?.id || "");
}

function getQuantity(item: any) {
  const qty = Number(item?.quantity || item?.qty || 1);
  return Number.isFinite(qty) && qty > 0 ? qty : 1;
}

async function reduceProductInventory(productId: string, quantity: number) {
  if (!productId || !quantity) return;

  const { data, error } = await supabase
    .from("products")
    .select("id, stock, quantity, inventory")
    .eq("id", productId)
    .maybeSingle();

  if (error || !data?.id) {
    console.log("Inventory lookup skipped:", error?.message || productId);
    return;
  }

  const currentStock = Number(data.stock ?? data.quantity ?? data.inventory ?? 0);
  const newStock = Math.max(currentStock - quantity, 0);

  const { error: updateError } = await supabase
    .from("products")
    .update({
      stock: newStock,
      quantity: newStock,
      inventory: newStock,
      available: newStock > 0,
      active: true,
      marketplace_visible: newStock > 0,
      is_sold_out: newStock <= 0,
      updated_at: new Date().toISOString(),
    })
    .eq("id", productId);

  if (updateError) {
    console.log("Inventory update error:", updateError.message);
  }
}

export default function CheckoutSuccess() {
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [status, setStatus] = useState<SaveStatus>("loading");
  const [message, setMessage] = useState("Saving your order...");

  useEffect(() => {
    finishOrder();
  }, []);

  async function finishOrder() {
    try {
      const pendingOrder = await getPendingOrder();

      if (!pendingOrder) {
        await clearCart();
        setSaved(false);
        setStatus("warning");
        setMessage("Payment completed. No pending order was found to save.");
        return;
      }

      await addOrder({
  ...pendingOrder,
  status: pendingOrder.status || "PAID",
  updatedAt: new Date().toISOString(),
});

      const items = Array.isArray(pendingOrder.items) ? pendingOrder.items : [];

      for (const item of items) {
        await reduceProductInventory(getProductId(item), getQuantity(item));
      }

      await clearPendingOrder();
      await clearCart();

      setSaved(true);
      setStatus("success");
      setMessage("Your order was saved and inventory was updated.");
    } catch (error: any) {
      console.error("Checkout success error:", error);
      setSaved(false);
      setStatus("error");
      setMessage(
        error?.message ||
          "Payment completed, but there was an issue saving the order details."
      );

      Alert.alert(
        "Order Save Error",
        "Payment completed, but the order may need review."
      );
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={farmTheme.colors.primary} />
        <Text style={styles.message}>{message}</Text>
      </View>
    );
  }

  const isError = status === "error";
  const isWarning = status === "warning";

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{isError ? "⚠️" : isWarning ? "ℹ️" : "✅"}</Text>

      <Text style={styles.title}>
        {isError
          ? "Order Needs Review"
          : isWarning
          ? "Payment Completed"
          : "Order Paid Successfully!"}
      </Text>

      <Text style={styles.message}>
        {saved
          ? "Your order was saved and inventory was updated."
          : message}
      </Text>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.replace("/customer/orders" as any)}
        activeOpacity={0.85}
      >
        <Text style={styles.buttonText}>View My Orders</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => router.replace("/customer/marketplace" as any)}
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