// app/customer/order-confirmation.tsx

import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";

import { clearCart } from "../data/cartStore";
import { getPendingOrder } from "../data/orderStore";
import { supabase } from "../data/supabaseClient";

const COLORS = {
  primary: "#2E7D32",
  primaryDark: "#14532D",
  background: "#F8FAF5",
  card: "#FFFFFF",
  text: "#172017",
  muted: "#75806F",
  border: "#E2E8DA",
  lightGreen: "#F1FAED",
  dark: "#111827",
};

function getParamString(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

function money(value: any) {
  return `$${Number(value || 0).toFixed(2)}`;
}

async function saveFinalOrder(order: any) {
  const existingRaw = await AsyncStorage.getItem("farm2homeCustomerOrders");

  let existingOrders: any[] = [];

  try {
    existingOrders = existingRaw ? JSON.parse(existingRaw) : [];
  } catch {
    existingOrders = [];
  }

  const filtered = existingOrders.filter((item) => item.id !== order.id);
  const updated = [order, ...filtered];

  await AsyncStorage.setItem("farm2homeCustomerOrders", JSON.stringify(updated));
  await AsyncStorage.setItem("lastCustomerOrder", JSON.stringify(order));
  await AsyncStorage.setItem(`farm2home_order_${order.id}`, JSON.stringify(order));
}

export default function OrderConfirmation() {
  const params = useLocalSearchParams();

  const sessionId = getParamString(params.session_id);
  const orderIdParam = getParamString(params.orderId);
  const totalParam = getParamString(params.total);

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<any>(null);

  useEffect(() => {
    finalizeOrder();
  }, []);

  async function finalizeOrder() {
    try {
      setLoading(true);

      const pendingOrder = await getPendingOrder();

      const finalizedOrder = {
        ...(pendingOrder || {}),
        id: pendingOrder?.id || orderIdParam || `order_${Date.now()}`,
        stripeSessionId: sessionId || "",
        status: "PAID",
        fulfillmentStatus: "ORDER_PLACED",
        paymentStatus: "paid",
        total: Number(pendingOrder?.total || totalParam || 0),
        updatedAt: new Date().toISOString(),
      };

      await saveFinalOrder(finalizedOrder);
      await saveOrderToSupabase(finalizedOrder);
      await clearCart();

      setOrder(finalizedOrder);
    } catch (error: any) {
      console.log("ORDER_CONFIRMATION_ERROR:", error);
      Alert.alert(
        "Order Confirmation",
        "Payment completed, but the app had trouble refreshing the order record."
      );
    } finally {
      setLoading(false);
    }
  }

  async function saveOrderToSupabase(finalizedOrder: any) {
    try {
      await supabase.from("orders").upsert({
        id: finalizedOrder.id,
        customer_email: finalizedOrder.customerEmail || "",
        customer_name: finalizedOrder.customerName || "",
        items: finalizedOrder.items || [],
        subtotal: Number(finalizedOrder.subtotal || 0),
        delivery_fee: Number(finalizedOrder.deliveryFee || 0),
        tip: Number(finalizedOrder.tip || 0),
        total: Number(finalizedOrder.total || 0),
        delivery_info: finalizedOrder.deliveryInfo || {},
        status: "PAID",
        fulfillment_status: "ORDER_PLACED",
        payment_status: "paid",
        stripe_session_id: sessionId || "",
        created_at: finalizedOrder.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    } catch (error) {
      console.log("Supabase order save skipped:", error);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.centerText}>Finalizing order...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const displayOrderId = order?.id || orderIdParam || "Pending";
  const displayTotal = money(order?.total || totalParam);
  const deliveryOption = order?.deliveryInfo?.deliveryOption || "Delivery";

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.successMark}>
          <Text style={styles.successText}>✓</Text>
        </View>

        <Text style={styles.title}>Order Confirmed</Text>
        <Text style={styles.subtitle}>
          Your Farm2Home order has been submitted and payment was received.
        </Text>

        <View style={styles.card}>
          <InfoRow label="Order ID" value={displayOrderId} />
          <InfoRow label="Payment Status" value="Paid" />
          <InfoRow label="Order Type" value={deliveryOption} />
          <InfoRow label="Total" value={displayTotal} highlight />
          {!!sessionId && <InfoRow label="Stripe Session" value={sessionId} />}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>What Happens Next</Text>

          <Step
            number="1"
            title="Farmer receives the order"
            text="The farmer prepares your items and confirms availability."
          />

          <Step
            number="2"
            title={
              deliveryOption === "Delivery"
                ? "Driver workflow starts"
                : "Pickup details are confirmed"
            }
            text={
              deliveryOption === "Delivery"
                ? "A delivery job is created for driver assignment, tracking, pickup proof, and delivery proof."
                : "Pickup instructions are saved with your order."
            }
          />

          <Step
            number="3"
            title="Track your order"
            text="Use order tracking to view fulfillment status, delivery updates, and chat if needed."
          />
        </View>

        <Pressable
          style={styles.primaryButton}
          onPress={() =>
            router.replace({
              pathname: "/customer/order-tracking",
              params: { orderId: displayOrderId },
            } as any)
          }
        >
          <Text style={styles.primaryButtonText}>Track Order</Text>
        </Pressable>

        <Pressable
          style={styles.secondaryButton}
          onPress={() => router.replace("/customer/marketplace" as any)}
        >
          <Text style={styles.secondaryButtonText}>Back to Marketplace</Text>
        </Pressable>

        <Pressable
          style={styles.linkButton}
          onPress={() => router.replace("/customer/orders" as any)}
        >
          <Text style={styles.linkText}>View My Orders</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, highlight && styles.infoHighlight]}>
        {value}
      </Text>
    </View>
  );
}

function Step({
  number,
  title,
  text,
}: {
  number: string;
  title: string;
  text: string;
}) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepNumber}>
        <Text style={styles.stepNumberText}>{number}</Text>
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepText}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  center: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  centerText: {
    marginTop: 12,
    color: COLORS.primary,
    fontWeight: "900",
  },
  content: {
    padding: 20,
    paddingBottom: 80,
  },
  successMark: {
    width: 74,
    height: 74,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginTop: 28,
    marginBottom: 16,
  },
  successText: {
    color: "#FFFFFF",
    fontSize: 42,
    fontWeight: "900",
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    color: COLORS.text,
    textAlign: "center",
  },
  subtitle: {
    color: COLORS.muted,
    textAlign: "center",
    fontWeight: "700",
    lineHeight: 22,
    marginTop: 8,
    marginBottom: 20,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  infoRow: {
    backgroundColor: COLORS.lightGreen,
    borderRadius: 13,
    padding: 13,
    marginBottom: 10,
  },
  infoLabel: {
    color: COLORS.primaryDark,
    fontWeight: "900",
    fontSize: 11,
    textTransform: "uppercase",
  },
  infoValue: {
    color: COLORS.text,
    fontWeight: "800",
    marginTop: 4,
    lineHeight: 20,
  },
  infoHighlight: {
    color: COLORS.primary,
    fontSize: 22,
    fontWeight: "900",
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 14,
  },
  stepRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: COLORS.primaryDark,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumberText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  stepTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 15,
  },
  stepText: {
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 3,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 15,
    padding: 16,
    alignItems: "center",
    marginTop: 4,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  secondaryButton: {
    backgroundColor: COLORS.dark,
    borderRadius: 15,
    padding: 16,
    alignItems: "center",
    marginTop: 10,
  },
  secondaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  linkButton: {
    padding: 16,
    alignItems: "center",
  },
  linkText: {
    color: COLORS.primary,
    fontWeight: "900",
  },
});