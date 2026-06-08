// app/customer/cart.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Image,
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
  farmKey: string;
  farmName: string;
  farmerId: string;
  farmerStripeAccountId: string;
  items: CartItem[];
};

function getItemId(item: any) {
  return String(item.id || item.cartItemId || item.productId || "");
}

function getItemName(item: any) {
  return item.name || item.productName || "Farm Product";
}

function getItemImage(item: any) {
  return item.image || item.imageUrl || item.image_url || "";
}

function getFarmName(item: any) {
  return item.farmName || item.farmerName || item.farm_name || "Farm2Home Farm";
}

function getFarmerId(item: any) {
  return String(item.farmerId || item.farmer_id || "");
}

function getFarmerStripeAccountId(item: any) {
  return (
    item.farmerStripeAccountId ||
    item.stripeAccountId ||
    item.farmer_stripe_account_id ||
    item.stripe_account_id ||
    ""
  );
}

function groupCartByFarm(cart: CartItem[]): CartGroup[] {
  const grouped: Record<string, CartGroup> = {};

  cart.forEach((item: any) => {
    const farmerId = getFarmerId(item);
    const farmName = getFarmName(item);
    const farmerStripeAccountId = getFarmerStripeAccountId(item);
    const farmKey = farmerId || farmName;

    if (!grouped[farmKey]) {
      grouped[farmKey] = {
        farmKey,
        farmName,
        farmerId,
        farmerStripeAccountId,
        items: [],
      };
    }

    grouped[farmKey].items.push(item);
  });

  return Object.values(grouped);
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
      setCart(Array.isArray(cartData) ? cartData : []);
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
      (sum: number, item: any) =>
        sum + Number(item.price || 0) * Number(item.quantity || 0),
      0
    );
  }, [cart]);

  const itemCount = useMemo(() => {
    return cart.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0);
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
            style={({ pressed }) => [styles.backCircle, pressed && styles.pressed]}
            onPress={() => router.push("/customer/marketplace" as any)}
          >
            <Text style={styles.backCircleText}>‹</Text>
          </Pressable>

          <View style={styles.topTitleBlock}>
            <Text style={styles.title}>Cart</Text>
            <Text style={styles.subtitle}>
              {itemCount} item{itemCount === 1 ? "" : "s"} from {cartGroups.length} farm
              {cartGroups.length === 1 ? "" : "s"}
            </Text>
          </View>

          <Pressable
            style={({ pressed }) => [styles.clearTopButton, pressed && styles.pressed]}
            onPress={handleClear}
          >
            <Text style={styles.clearTopText}>Clear</Text>
          </Pressable>
        </View>

        <View style={styles.heroCard}>
          <Text style={styles.heroBadge}>Fresh Checkout</Text>
          <Text style={styles.heroTitle}>Review your farm order</Text>
          <Text style={styles.heroText}>
            Items stay grouped by farm for inventory, pickup, delivery, and farmer payouts.
          </Text>
        </View>

        {cart.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconBox}>
              <Text style={styles.emptyIconText}>0</Text>
            </View>

            <Text style={styles.emptyTitle}>Your cart is empty</Text>
            <Text style={styles.emptyText}>
              Add fresh produce, eggs, honey, dairy, flowers, hay, or farm supplies to begin checkout.
            </Text>

            <Pressable
              style={({ pressed }) => [styles.shopButton, pressed && styles.pressed]}
              onPress={() => router.push("/customer/marketplace" as any)}
            >
              <Text style={styles.shopButtonText}>Shop Marketplace</Text>
            </Pressable>
          </View>
        ) : (
          cartGroups.map((group) => {
            const farmSubtotal = group.items.reduce(
              (sum: number, item: any) =>
                sum + Number(item.price || 0) * Number(item.quantity || 0),
              0
            );

            return (
              <View key={group.farmKey} style={styles.farmCard}>
                <View style={styles.farmHeader}>
                  <View style={styles.farmTitleRow}>
                    <View style={styles.farmIconBox}>
                      <Text style={styles.farmInitial}>
                        {group.farmName.slice(0, 1).toUpperCase()}
                      </Text>
                    </View>

                    <View style={styles.farmNameBlock}>
                      <Text style={styles.farmTitle}>{group.farmName}</Text>
                      <Text style={styles.farmMeta}>
                        {group.farmerId ? `Farmer ID: ${group.farmerId}` : "Local Farm2Home seller"}
                      </Text>
                      <Text style={styles.farmMeta}>
                        {group.farmerStripeAccountId
                          ? "Payout account connected"
                          : "Payout account pending"}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.farmSubtotal}>${farmSubtotal.toFixed(2)}</Text>
                </View>

                {group.items.map((item: any) => {
                  const id = getItemId(item);
                  const image = getItemImage(item);
                  const lineTotal = Number(item.price || 0) * Number(item.quantity || 0);

                  return (
                    <View key={id} style={styles.itemCard}>
                      {image ? (
                        <Image source={{ uri: image }} style={styles.productImage} />
                      ) : (
                        <View style={styles.productInitialBox}>
                          <Text style={styles.productInitialText}>
                            {getItemName(item).slice(0, 1).toUpperCase()}
                          </Text>
                        </View>
                      )}

                      <View style={styles.itemInfo}>
                        <Text style={styles.itemName} numberOfLines={2}>
                          {getItemName(item)}
                        </Text>

                        <Text style={styles.itemMeta}>
                          ${Number(item.price || 0).toFixed(2)}
                          {item.unit ? ` / ${item.unit}` : " each"}
                        </Text>

                        <Text style={styles.itemMeta}>
                          {item.category ? `${item.category} · ` : ""}
                          Quantity {Number(item.quantity || 0)}
                        </Text>

                        <Text style={styles.lineTotal}>
                          Line total: ${lineTotal.toFixed(2)}
                        </Text>

                        <Pressable
                          style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}
                          onPress={() => handleRemove(id)}
                        >
                          <Text style={styles.removeText}>Remove</Text>
                        </Pressable>
                      </View>

                      <View style={styles.qtyPill}>
                        <Pressable
                          style={({ pressed }) => [styles.qtyButton, pressed && styles.pressed]}
                          onPress={() => handleDecrease(id)}
                        >
                          <Text style={styles.qtyButtonText}>−</Text>
                        </Pressable>

                        <Text style={styles.qtyText}>{item.quantity}</Text>

                        <Pressable
                          style={({ pressed }) => [styles.qtyButton, pressed && styles.pressed]}
                          onPress={() => handleIncrease(id)}
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
          <Text style={styles.checkoutAmount}>${estimatedTotal.toFixed(2)}</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.backToMarketButton, pressed && styles.pressed]}
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
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.card,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  backCircleText: {
    fontSize: 32,
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
    borderRadius: 12,
  },
  clearTopText: {
    color: COLORS.danger,
    fontWeight: "900",
  },
  heroCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
  },
  heroBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.18)",
    color: "#FFFFFF",
    fontWeight: "900",
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: 10,
    fontSize: 12,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
  },
  heroText: {
    color: "#EAF7E6",
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 8,
  },
  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    marginBottom: 18,
    ...farmTheme.shadow,
  },
  emptyIconBox: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: COLORS.softGreen,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  emptyIconText: {
    color: COLORS.primary,
    fontWeight: "900",
    fontSize: 24,
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
    borderRadius: 13,
  },
  shopButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  farmCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 15,
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
    width: 52,
    height: 52,
    borderRadius: 15,
    backgroundColor: COLORS.primaryDark,
    justifyContent: "center",
    alignItems: "center",
  },
  farmInitial: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 22,
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
    borderRadius: 16,
    padding: 11,
    marginTop: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 11,
  },
  productImage: {
    width: 58,
    height: 58,
    borderRadius: 14,
    backgroundColor: COLORS.card,
  },
  productInitialBox: {
    width: 58,
    height: 58,
    borderRadius: 14,
    backgroundColor: COLORS.card,
    justifyContent: "center",
    alignItems: "center",
  },
  productInitialText: {
    color: COLORS.primaryDark,
    fontSize: 23,
    fontWeight: "900",
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
    borderRadius: 18,
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
    borderRadius: 15,
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