import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";

import {
  CartItem,
  clearCart,
  decreaseCartItem,
  getCart,
  increaseCartItem,
  removeCartItem,
} from "../data/cartStore";
import farmTheme from "../styles/farmTheme";

type CartGroup = {
  farmName: string;
  items: CartItem[];
};

function groupCartByFarm(cart: CartItem[]): CartGroup[] {
  const grouped: Record<string, CartItem[]> = {};

  cart.forEach((item) => {
    const farmName = item.farmName || "Farm2Home Farm";
    if (!grouped[farmName]) grouped[farmName] = [];
    grouped[farmName].push(item);
  });

  return Object.entries(grouped).map(([farmName, items]) => ({
    farmName,
    items,
  }));
}

export default function CustomerCart() {
  const [cart, setCart] = useState<CartItem[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadCart();
    }, [])
  );

  async function loadCart() {
    try {
      const cartData = await getCart();
      setCart(cartData);
    } catch (error) {
      console.log("Load cart error:", error);
      Alert.alert("Cart Error", "Unable to load your cart.");
    }
  }

  async function handleIncrease(id: string) {
    const updatedCart = await increaseCartItem(id);
    setCart(updatedCart);
  }

  async function handleDecrease(id: string) {
    const updatedCart = await decreaseCartItem(id);
    setCart(updatedCart);
  }

  async function handleRemove(id: string) {
    const updatedCart = await removeCartItem(id);
    setCart(updatedCart);
  }

  async function handleClear() {
    await clearCart();
    setCart([]);
  }

  function goToCheckout() {
    if (cart.length === 0) {
      Alert.alert("Cart Empty", "Add items before checkout.");
      return;
    }

    router.push("/customer/checkout" as any);
  }

  const cartGroups = useMemo(() => groupCartByFarm(cart), [cart]);

  const subtotal = useMemo(() => {
    return cart.reduce(
      (sum, item) =>
        sum + Number(item.price || 0) * Number(item.quantity || 0),
      0
    );
  }, [cart]);

  const serviceFee = subtotal * 0.08;
  const estimatedTotal = subtotal + serviceFee;

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Your Farm2Home Cart</Text>

        <Text style={styles.subtitle}>
          Items are grouped by farm so pickup, delivery, and inventory stay
          organized by seller.
        </Text>

        {cart.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Your cart is empty.</Text>
            <Text style={styles.emptyText}>
              Add fresh products from local farms to begin checkout.
            </Text>
          </View>
        ) : (
          cartGroups.map((group) => {
            const farmSubtotal = group.items.reduce(
              (sum, item) =>
                sum + Number(item.price || 0) * Number(item.quantity || 0),
              0
            );

            return (
              <View key={group.farmName} style={styles.farmCard}>
                <View style={styles.farmHeader}>
                  <Text style={styles.farmTitle}>🚜 {group.farmName}</Text>
                  <Text style={styles.farmSubtotal}>
                    ${farmSubtotal.toFixed(2)}
                  </Text>
                </View>

                <Text style={styles.farmMeta}>
                  Pickup / delivery will be confirmed for this farm during
                  checkout.
                </Text>

                {group.items.map((item) => {
                  const lineTotal =
                    Number(item.price || 0) * Number(item.quantity || 0);

                  return (
                    <View key={item.id} style={styles.itemRow}>
                      <View style={styles.itemInfo}>
                        <Text style={styles.name}>{item.name}</Text>

                        <Text style={styles.meta}>
                          ${Number(item.price || 0).toFixed(2)} each
                        </Text>

                        <Text style={styles.lineTotal}>
                          Line Total: ${lineTotal.toFixed(2)}
                        </Text>
                      </View>

                      <View style={styles.controls}>
                        <Pressable
                          style={({ pressed }) => [
                            styles.qtyButton,
                            pressed && styles.pressed,
                          ]}
                          onPress={() => handleDecrease(item.id)}
                        >
                          <Text style={styles.qtyText}>−</Text>
                        </Pressable>

                        <Text style={styles.qty}>{item.quantity}</Text>

                        <Pressable
                          style={({ pressed }) => [
                            styles.qtyButton,
                            pressed && styles.pressed,
                          ]}
                          onPress={() => handleIncrease(item.id)}
                        >
                          <Text style={styles.qtyText}>+</Text>
                        </Pressable>

                        <Pressable
                          style={({ pressed }) => [
                            styles.trashButton,
                            pressed && styles.pressed,
                          ]}
                          onPress={() => handleRemove(item.id)}
                        >
                          <Text style={styles.trashText}>Remove</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>
            );
          })
        )}

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Order Summary</Text>

          <View style={styles.summaryLine}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>${subtotal.toFixed(2)}</Text>
          </View>

          <View style={styles.summaryLine}>
            <Text style={styles.summaryLabel}>Marketplace Service Fee</Text>
            <Text style={styles.summaryValue}>${serviceFee.toFixed(2)}</Text>
          </View>

          <View style={styles.totalLine}>
            <Text style={styles.totalLabel}>Estimated Total</Text>
            <Text style={styles.totalValue}>${estimatedTotal.toFixed(2)}</Text>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.checkoutButton,
            pressed && styles.pressed,
          ]}
          onPress={goToCheckout}
        >
          <Text style={styles.buttonText}>Continue to Checkout</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.clearButton,
            pressed && styles.pressed,
          ]}
          onPress={handleClear}
        >
          <Text style={styles.clearText}>Clear Cart</Text>
        </Pressable>

        <Pressable onPress={() => router.push("/customer/marketplace" as any)}>
          <Text style={styles.backText}>Back to Marketplace</Text>
        </Pressable>

        <View style={styles.bottomSpace} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 18,
    backgroundColor: farmTheme.colors.background,
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    color: farmTheme.colors.primary,
    marginBottom: 8,
  },
  subtitle: {
    color: farmTheme.colors.mutedText,
    lineHeight: 22,
    marginBottom: 18,
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    marginBottom: 16,
    ...farmTheme.shadow,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: farmTheme.colors.text,
    marginBottom: 6,
  },
  emptyText: {
    color: farmTheme.colors.mutedText,
    lineHeight: 22,
  },
  farmCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    ...farmTheme.shadow,
  },
  farmHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
    gap: 12,
  },
  farmTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: farmTheme.colors.primary,
    flex: 1,
  },
  farmSubtotal: {
    fontSize: 18,
    fontWeight: "900",
    color: farmTheme.colors.text,
  },
  farmMeta: {
    color: farmTheme.colors.mutedText,
    marginBottom: 12,
    lineHeight: 20,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: farmTheme.colors.border,
    minHeight: 110,
  },
  itemInfo: {
    flex: 1,
  },
  name: {
    fontSize: 17,
    fontWeight: "900",
    color: farmTheme.colors.text,
    marginBottom: 2,
  },
  meta: {
    color: farmTheme.colors.mutedText,
    marginBottom: 2,
    fontSize: 13,
  },
  lineTotal: {
    fontWeight: "900",
    color: farmTheme.colors.primary,
    marginTop: 2,
    fontSize: 14,
  },
  controls: {
    width: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyButton: {
    backgroundColor: farmTheme.colors.primary,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyText: {
    color: "#FFFFFF",
    fontSize: 21,
    fontWeight: "900",
  },
  qty: {
    fontSize: 16,
    fontWeight: "900",
    marginVertical: 5,
    color: farmTheme.colors.text,
  },
  trashButton: {
    backgroundColor: "#DC2626",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginTop: 6,
  },
  trashText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 12,
  },
  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 16,
    marginTop: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
  },
  summaryTitle: {
    fontSize: 21,
    fontWeight: "900",
    color: farmTheme.colors.text,
    marginBottom: 12,
  },
  summaryLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
    gap: 12,
  },
  summaryLabel: {
    color: farmTheme.colors.mutedText,
    fontWeight: "700",
    flex: 1,
  },
  summaryValue: {
    color: farmTheme.colors.text,
    fontWeight: "900",
  },
  totalLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: farmTheme.colors.border,
    paddingTop: 12,
    marginTop: 8,
    gap: 12,
  },
  totalLabel: {
    color: farmTheme.colors.text,
    fontWeight: "900",
    fontSize: 17,
    flex: 1,
  },
  totalValue: {
    color: farmTheme.colors.primary,
    fontWeight: "900",
    fontSize: 20,
  },
  checkoutButton: {
    backgroundColor: farmTheme.colors.primary,
    padding: 16,
    borderRadius: 18,
    alignItems: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },
  clearButton: {
    marginTop: 14,
    alignItems: "center",
  },
  clearText: {
    color: "#DC2626",
    fontWeight: "900",
  },
  backText: {
    marginTop: 18,
    textAlign: "center",
    color: farmTheme.colors.primary,
    fontWeight: "900",
  },
  pressed: {
    opacity: 0.75,
  },
  bottomSpace: {
    height: 40,
  },
});