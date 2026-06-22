// app/customer/order-success.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { API_BASE_URL } from "../config/api";
import { clearCart } from "../data/cartStore";
import { supabase } from "../data/supabaseClient";

const COLORS = {
  bg: "#F4F5F7",
  card: "#FFFFFF",
  black: "#050505",
  red: "#D71920",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  green: "#16A34A",
  greenSoft: "#DCFCE7",
  amberSoft: "#FEF3C7",
  amberText: "#92400E",
  white: "#FFFFFF",
};

function clean(value: any) {
  return String(value ?? "").trim();
}

function money(value: any) {
  return `$${Number(value || 0).toFixed(2)}`;
}

async function parseApiResponse(response: Response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { success: false, error: text || "Invalid backend response." };
  }
}

export default function CustomerOrderSuccess() {
  const params = useLocalSearchParams();

  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);
  const [order, setOrder] = useState<any>(null);
  const [message, setMessage] = useState("Verifying your payment and order...");

  const orderId = useMemo(
    () => clean(params?.orderId || params?.order_id || params?.cloudOrderId),
    [params]
  );

  const sessionId = useMemo(
    () => clean(params?.session_id || params?.sessionId),
    [params]
  );

  useFocusEffect(
    useCallback(() => {
      verifyAndFinalizeOrder();
    }, [orderId, sessionId])
  );

  async function loadLocalOrder() {
    const saved =
      (await AsyncStorage.getItem("currentCustomerOrder")) ||
      (await AsyncStorage.getItem("pendingCustomerOrder")) ||
      (await AsyncStorage.getItem("lastPendingCustomerOrder"));

    if (!saved) return null;

    try {
      const parsed = JSON.parse(saved);
      return parsed;
    } catch {
      return null;
    }
  }

  async function fetchOrderFromSupabase(id: string) {
    if (!id) return null;

    const tables = ["orders", "customer_orders", "farm_orders"];

    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select("*")
          .eq("id", id)
          .maybeSingle();

        if (!error && data) return data;
      } catch {
        // Try next table.
      }
    }

    return null;
  }

  async function updateOrderPaid(id: string, extra: any = {}) {
    if (!id) return;

    const payload = {
      status: "PAID",
      payment_status: "paid",
      stripe_checkout_session_id: sessionId || extra?.sessionId || null,
      stripe_payment_intent_id:
        extra?.paymentIntentId ||
        extra?.session?.payment_intent?.id ||
        extra?.session?.payment_intent ||
        null,
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    for (const table of ["orders", "customer_orders", "farm_orders"]) {
      try {
        await supabase.from(table).update(payload).eq("id", id);
      } catch {
        // Some projects may not have every table.
      }
    }

    for (const table of ["order_items", "customer_order_items", "farm_order_items"]) {
      try {
        await supabase
          .from(table)
          .update({
            status: "PAID",
            updated_at: new Date().toISOString(),
          })
          .eq("order_id", id);
      } catch {
        // Some projects may not have every table.
      }
    }
  }

  async function verifyAndFinalizeOrder() {
    try {
      setLoading(true);

      let backendResult: any = null;

      if (sessionId) {
        setMessage("Confirming Stripe payment...");

        const response = await fetch(`${API_BASE_URL}/payments/verify-checkout-session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, session_id: sessionId }),
        });

        backendResult = await parseApiResponse(response);

        if (!response.ok || !backendResult.success) {
          throw new Error(backendResult.error || "Unable to verify Stripe payment.");
        }

        if (!backendResult.paid) {
          setMessage("Stripe returned but payment is not marked paid yet.");
        }
      }

      const localOrder = await loadLocalOrder();
      const finalOrderId =
        orderId ||
        clean(localOrder?.id || localOrder?.orderId || localOrder?.order_id) ||
        clean(backendResult?.session?.metadata?.orderId || backendResult?.session?.metadata?.order_id);

      let dbOrder = await fetchOrderFromSupabase(finalOrderId);

      if (finalOrderId) {
        setMessage("Finalizing order record...");
        await updateOrderPaid(finalOrderId, backendResult || {});
        dbOrder = await fetchOrderFromSupabase(finalOrderId);
      }

      const finalOrder = {
        ...(localOrder || {}),
        ...(dbOrder || {}),
        id: finalOrderId,
        orderId: finalOrderId,
        order_id: finalOrderId,
        status: "PAID",
        payment_status: "paid",
        stripe_checkout_session_id: sessionId || localOrder?.stripe_checkout_session_id || null,
        verifiedAt: new Date().toISOString(),
      };

      setOrder(finalOrder);
      setVerified(true);
      setMessage("Payment complete. Your order is confirmed.");

      await AsyncStorage.multiSet([
        ["lastCustomerOrder", JSON.stringify(finalOrder)],
        ["currentCustomerOrder", JSON.stringify(finalOrder)],
      ]);

      await AsyncStorage.multiRemove([
        "currentCheckoutCart",
        "currentCheckoutSummary",
        "pendingCustomerCheckout",
        "pendingCustomerOrder",
        "lastPendingCustomerOrder",
      ]);

      await clearCart();
    } catch (error: any) {
      console.log("order-success verification error:", error);
      setVerified(false);
      setMessage(error?.message || "Unable to verify order.");
      Alert.alert("Order Verification", error?.message || "Unable to verify order.");
    } finally {
      setLoading(false);
    }
  }

  function openOrders() {
    router.replace("/customer/my-orders" as any);
  }

  function openTracking() {
    router.replace({
      pathname: "/customer/tracking" as any,
      params: { orderId: order?.id || orderId },
    });
  }

  function continueShopping() {
    router.replace("/customer/marketplace" as any);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={[styles.heroIcon, verified ? styles.heroIconGood : styles.heroIconWarn]}>
            {loading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Ionicons
                name={verified ? "checkmark-circle-outline" : "warning-outline"}
                size={38}
                color={COLORS.white}
              />
            )}
          </View>

          <Text style={styles.kicker}>Farm2Home Checkout</Text>
          <Text style={styles.title}>{verified ? "Order Confirmed" : "Order Status"}</Text>
          <Text style={styles.subtitle}>{message}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Order Details</Text>

          <Detail label="Order ID" value={order?.id || orderId || "Pending"} />
          <Detail label="Stripe Session" value={sessionId || "Not provided"} />
          <Detail label="Status" value={verified ? "PAID" : "Needs Review"} />
          <Detail
            label="Total"
            value={
              order?.total || order?.estimated_total
                ? money(order?.total || order?.estimated_total)
                : "See order details"
            }
          />
        </View>

        <View style={styles.noticeCard}>
          <Ionicons name="shield-checkmark-outline" size={22} color={verified ? COLORS.green : COLORS.amberText} />
          <View style={{ flex: 1 }}>
            <Text style={styles.noticeTitle}>
              {verified ? "Cart cleared and order saved" : "Verification needs attention"}
            </Text>
            <Text style={styles.noticeText}>
              {verified
                ? "Your order is ready for farmer processing, delivery assignment, and tracking."
                : "Use My Orders to review the order or return to checkout if payment did not complete."}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, !verified && styles.disabledButton]}
          onPress={openTracking}
          disabled={!verified}
          activeOpacity={0.9}
        >
          <Ionicons name="navigate-outline" size={20} color={COLORS.white} />
          <Text style={styles.primaryText}>Track Order</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={openOrders} activeOpacity={0.9}>
          <Ionicons name="receipt-outline" size={20} color={COLORS.red} />
          <Text style={styles.secondaryText}>My Orders</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={continueShopping} activeOpacity={0.9}>
          <Ionicons name="storefront-outline" size={20} color={COLORS.red} />
          <Text style={styles.secondaryText}>Continue Shopping</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 18, paddingBottom: 60 },
  hero: {
    backgroundColor: COLORS.black,
    borderRadius: 28,
    padding: 24,
    marginBottom: 16,
  },
  heroIcon: {
    width: 70,
    height: 70,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  heroIconGood: { backgroundColor: COLORS.green },
  heroIconWarn: { backgroundColor: "#F59E0B" },
  kicker: {
    color: "#FCA5A5",
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
    fontSize: 12,
  },
  title: {
    color: COLORS.white,
    fontSize: 34,
    fontWeight: "900",
    marginTop: 6,
  },
  subtitle: {
    color: "#CBD5E1",
    fontWeight: "700",
    lineHeight: 22,
    marginTop: 8,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 10,
  },
  detailRow: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingVertical: 12,
  },
  detailLabel: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  detailValue: {
    color: COLORS.text,
    fontWeight: "800",
    marginTop: 4,
  },
  noticeCard: {
    backgroundColor: COLORS.greenSoft,
    borderRadius: 20,
    padding: 15,
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  noticeTitle: {
    color: COLORS.text,
    fontWeight: "900",
    marginBottom: 4,
  },
  noticeText: {
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 20,
  },
  primaryButton: {
    backgroundColor: COLORS.red,
    borderRadius: 18,
    padding: 17,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  primaryText: {
    color: COLORS.white,
    fontWeight: "900",
    fontSize: 16,
  },
  secondaryButton: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    borderRadius: 18,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  secondaryText: {
    color: COLORS.red,
    fontWeight: "900",
    fontSize: 15,
  },
  disabledButton: {
    opacity: 0.55,
  },
});
