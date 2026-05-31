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

const COLORS = {
  primary: "#2E7D32",
  primaryDark: "#14532D",
  secondary: "#F9A825",
  background: "#F8FAF5",
  card: "#FFFFFF",
  text: "#172017",
  muted: "#75806F",
  border: "#E2E8DA",
  softGreen: "#EAF5E6",
  lightGreen: "#F1FAED",
  danger: "#DC2626",
  dark: "#111827",
};

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
    if (cart.length === 0) return;

    Alert.alert("Clear Cart", "Remove all items from your cart?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: async () => {
          await clearCart();
          setCart([]);
        },
      },
    ]);
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

  const itemCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  }, [cart]);

  const serviceFee = subtotal * 0.04;
  const estimatedTotal = subtotal + serviceFee;

  return (
    <View style={styles.page}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.topBar}>
          <Pressable
            style={({ pressed }) => [
              styles.backCircle,
              pressed && styles.pressed,
            ]}
            onPress={() => router.push("/customer/marketplace" as any)}
          >
            <Text style={styles.backCircleText}>‹</Text>
          </Pressable>

          <View style={styles.topTitleBlock}>
            <Text style={styles.title}>My Cart</Text>
            <Text style={styles.subtitle}>
              {itemCount} item{itemCount === 1 ? "" : "s"} from{" "}
              {cartGroups.length} farm{cartGroups.length === 1 ? "" : "s"}
            </Text>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.clearTopButton,
              pressed && styles.pressed,
            ]}
            onPress={handleClear}
          >
            <Text style={styles.clearTopText}>Clear</Text>
          </Pressable>
        </View>

        <View style={styles.heroCard}>
          <View>
            <Text style={styles.heroBadge}>Fresh Checkout</Text>
            <Text style={styles.heroTitle}>Review your farm goods</Text>
            <Text style={styles.heroText}>
              Items stay grouped by farm for pickup, delivery, inventory, and farmer payouts.
            </Text>
          </View>
          <Text style={styles.heroEmoji}>🧺</Text>
        </View>

        {cart.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🌾</Text>
            <Text style={styles.emptyTitle}>Your cart is empty</Text>
            <Text style={styles.emptyText}>
              Add fresh produce, eggs, honey, dairy, flowers, hay, or farm supplies to begin checkout.
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.shopButton,
                pressed && styles.pressed,
              ]}
              onPress={() => router.push("/customer/marketplace" as any)}
            >
              <Text style={styles.shopButtonText}>Shop Marketplace</Text>
            </Pressable>
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
                  <View style={styles.farmTitleRow}>
                    <View style={styles.farmIconBox}>
                      <Text style={styles.farmIcon}>🚜</Text>
                    </View>

                    <View style={styles.farmNameBlock}>
                      <Text style={styles.farmTitle}>{group.farmName}</Text>
                      <Text style={styles.farmMeta}>
                        Pickup or delivery confirmed during checkout
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.farmSubtotal}>
                    ${farmSubtotal.toFixed(2)}
                  </Text>
                </View>

                {group.items.map((item) => {
                  const lineTotal =
                    Number(item.price || 0) * Number(item.quantity || 0);

                  return (
                    <View key={item.id} style={styles.itemCard}>
                      <View style={styles.productIcon}>
                        <Text style={styles.productIconText}>🥬</Text>
                      </View>

                      <View style={styles.itemInfo}>
                        <Text style={styles.itemName} numberOfLines={2}>
                          {item.name}
                        </Text>

                        <Text style={styles.itemMeta}>
                          ${Number(item.price || 0).toFixed(2)}
                          {item.unit ? ` / ${item.unit}` : " each"}
                        </Text>

                        <Text style={styles.lineTotal}>
                          Line total: ${lineTotal.toFixed(2)}
                        </Text>

                        <Pressable
                          style={({ pressed }) => [
                            styles.removeButton,
                            pressed && styles.pressed,
                          ]}
                          onPress={() => handleRemove(item.id)}
                        >
                          <Text style={styles.removeText}>Remove</Text>
                        </Pressable>
                      </View>

                      <View style={styles.qtyPill}>
                        <Pressable
                          style={({ pressed }) => [
                            styles.qtyButton,
                            pressed && styles.pressed,
                          ]}
                          onPress={() => handleDecrease(item.id)}
                        >
                          <Text style={styles.qtyButtonText}>−</Text>
                        </Pressable>

                        <Text style={styles.qtyText}>{item.quantity}</Text>

                        <Pressable
                          style={({ pressed }) => [
                            styles.qtyButton,
                            pressed && styles.pressed,
                          ]}
                          onPress={() => handleIncrease(item.id)}
                        >
                          <Text style={styles.qtyButtonText}>+</Text>
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

          <View style={styles.divider} />

          <View style={styles.totalLine}>
            <Text style={styles.totalLabel}>Estimated Total</Text>
            <Text style={styles.totalValue}>${estimatedTotal.toFixed(2)}</Text>
          </View>

          <Text style={styles.summaryNote}>
            Delivery fee, pickup options, and final payment details are confirmed on the next screen.
          </Text>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.checkoutButton,
            cart.length === 0 && styles.disabledButton,
            pressed && cart.length > 0 && styles.pressed,
          ]}
          onPress={goToCheckout}
        >
          <Text style={styles.checkoutButtonText}>Continue to Checkout</Text>
          <Text style={styles.checkoutAmount}>
            ${estimatedTotal.toFixed(2)}
          </Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.backToMarketButton,
            pressed && styles.pressed,
          ]}
          onPress={() => router.push("/customer/marketplace" as any)}
        >
          <Text style={styles.backToMarketText}>Back to Marketplace</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: COLORS.background || farmTheme.colors.background,
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 44,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
    gap: 12,
  },
  backCircle: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  backCircleText: {
    fontSize: 34,
    color: COLORS.text,
    fontWeight: "900",
    marginTop: -4,
  },
  topTitleBlock: {
    flex: 1,
  },
  title: {
    fontSize: 30,
    fontWeight: "900",
    color: COLORS.text,
  },
  subtitle: {
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 3,
  },
  clearTopButton: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  clearTopText: {
    color: COLORS.danger,
    fontWeight: "900",
  },
  heroCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 30,
    padding: 20,
    marginBottom: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  heroBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.18)",
    color: "#FFFFFF",
    fontWeight: "900",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: 10,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
    maxWidth: 230,
  },
  heroText: {
    color: "#EAF7E6",
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 8,
    maxWidth: 250,
  },
  heroEmoji: {
    fontSize: 58,
  },
  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 28,
    padding: 26,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    marginBottom: 18,
    ...farmTheme.shadow,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: COLORS.text,
    textAlign: "center",
  },
  emptyText: {
    color: COLORS.muted,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 8,
    fontWeight: "700",
  },
  shopButton: {
    marginTop: 18,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 999,
  },
  shopButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  farmCard: {
    backgroundColor: COLORS.card,
    borderRadius: 28,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...farmTheme.shadow,
  },
  farmHeader: {
    marginBottom: 12,
  },
  farmTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  farmIconBox: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: COLORS.softGreen,
    justifyContent: "center",
    alignItems: "center",
  },
  farmIcon: {
    fontSize: 27,
  },
  farmNameBlock: {
    flex: 1,
  },
  farmTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900",
  },
  farmMeta: {
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 3,
    fontSize: 12,
    lineHeight: 17,
  },
  farmSubtotal: {
    color: COLORS.primary,
    fontSize: 20,
    fontWeight: "900",
    marginTop: 10,
    alignSelf: "flex-end",
  },
  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.lightGreen,
    borderRadius: 22,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
  },
  productIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: COLORS.card,
    justifyContent: "center",
    alignItems: "center",
  },
  productIconText: {
    fontSize: 30,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "900",
  },
  itemMeta: {
    color: COLORS.muted,
    marginTop: 3,
    fontSize: 12,
    fontWeight: "700",
  },
  lineTotal: {
    color: COLORS.primary,
    fontWeight: "900",
    marginTop: 5,
    fontSize: 13,
  },
  removeButton: {
    alignSelf: "flex-start",
    marginTop: 7,
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  removeText: {
    color: COLORS.danger,
    fontWeight: "900",
    fontSize: 12,
  },
  qtyPill: {
    backgroundColor: COLORS.card,
    borderRadius: 999,
    padding: 5,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  qtyButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  qtyButtonText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
    marginTop: -2,
  },
  qtyText: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 16,
    marginVertical: 7,
  },
  summaryCard: {
    backgroundColor: COLORS.card,
    borderRadius: 28,
    padding: 18,
    marginTop: 2,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...farmTheme.shadow,
  },
  summaryTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 14,
  },
  summaryLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 11,
    gap: 12,
  },
  summaryLabel: {
    color: COLORS.muted,
    fontWeight: "800",
    flex: 1,
  },
  summaryValue: {
    color: COLORS.text,
    fontWeight: "900",
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 8,
  },
  totalLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  totalLabel: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 18,
    flex: 1,
  },
  totalValue: {
    color: COLORS.primary,
    fontWeight: "900",
    fontSize: 22,
  },
  summaryNote: {
    marginTop: 12,
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 20,
    fontSize: 12,
  },
  checkoutButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 17,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  disabledButton: {
    backgroundColor: "#A7B8A2",
  },
  checkoutButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },
  checkoutAmount: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 17,
  },
  backToMarketButton: {
    alignItems: "center",
    paddingVertical: 18,
  },
  backToMarketText: {
    color: COLORS.primary,
    fontWeight: "900",
    fontSize: 15,
  },
  pressed: {
    opacity: 0.75,
  },
});