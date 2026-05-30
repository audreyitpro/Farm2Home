import React, { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";

import {
  CartHistoryItem,
  clearCartHistory,
  getCartHistory,
} from "../data/cartStore";

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

function money(value: number) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function formatDate(value?: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleString();
}

export default function CustomerOrdersScreen() {
  const [orders, setOrders] = useState<CartHistoryItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadOrders = useCallback(async () => {
    const history = await getCartHistory();
    setOrders(history || []);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadOrders();
    }, [loadOrders])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadOrders();
  };

  const handleClearHistory = async () => {
    if (orders.length === 0) return;

    Alert.alert("Clear Order History", "Remove all saved cart history?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: async () => {
          await clearCartHistory();
          setOrders([]);
        },
      },
    ]);
  };

  function openTracking(item: CartHistoryItem) {
    router.push({
      pathname: "/customer/order-tracking",
      params: {
        orderId: item.id,
      },
    } as any);
  }

  return (
    <View style={styles.page}>
      <View style={styles.topBar}>
        <Pressable
          style={({ pressed }) => [styles.backCircle, pressed && styles.pressed]}
          onPress={() => router.push("/customer/marketplace" as any)}
        >
          <Text style={styles.backCircleText}>‹</Text>
        </Pressable>

        <View style={styles.topTitleBlock}>
          <Text style={styles.title}>My Orders</Text>
          <Text style={styles.subtitle}>Saved carts and checkout history</Text>
        </View>
      </View>

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListHeaderComponent={
          <View>
            <View style={styles.heroCard}>
              <View style={styles.heroTextBlock}>
                <Text style={styles.heroBadge}>Farm2Home History</Text>
                <Text style={styles.heroTitle}>Track and review your farm orders</Text>
                <Text style={styles.heroText}>
                  View saved carts, totals, item history, and delivery tracking.
                </Text>
              </View>

              <Text style={styles.heroEmoji}>🧾</Text>
            </View>

            {orders.length > 0 && (
              <Pressable
                style={({ pressed }) => [
                  styles.clearButton,
                  pressed && styles.pressed,
                ]}
                onPress={handleClearHistory}
              >
                <Text style={styles.clearButtonText}>Clear Cart History</Text>
              </Pressable>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>🌾</Text>
            <Text style={styles.emptyTitle}>No saved cart history yet</Text>
            <Text style={styles.emptyText}>
              Add items to your cart. Your saved cart history will appear here.
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.shopButton,
                pressed && styles.pressed,
              ]}
              onPress={() => router.push("/customer/marketplace" as any)}
            >
              <Text style={styles.shopButtonText}>Shop Fresh Produce</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.orderIconBox}>
                <Text style={styles.orderIcon}>🧺</Text>
              </View>

              <View style={styles.orderHeaderText}>
                <Text style={styles.orderNumber}>Cart #{item.id.slice(-8)}</Text>
                <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
              </View>

              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>{item.status}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <Text style={styles.sectionTitle}>Items</Text>

            {item.items.map((cartItem) => (
              <View key={`${item.id}-${cartItem.id}`} style={styles.itemRow}>
                <View style={styles.productIcon}>
                  <Text style={styles.productIconText}>🥬</Text>
                </View>

                <View style={styles.itemInfo}>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {cartItem.name}
                  </Text>
                  <Text style={styles.farmName} numberOfLines={1}>
                    {cartItem.farmName || "Farm2Home Farm"}
                  </Text>
                </View>

                <View style={styles.itemRight}>
                  <Text style={styles.itemQty}>Qty {cartItem.quantity}</Text>
                  <Text style={styles.itemPrice}>{money(cartItem.price)}</Text>
                </View>
              </View>
            ))}

            <View style={styles.totalRow}>
              <View>
                <Text style={styles.totalLabel}>
                  {item.itemCount} item{item.itemCount === 1 ? "" : "s"}
                </Text>
                <Text style={styles.totalSubtext}>Order total</Text>
              </View>

              <Text style={styles.totalValue}>{money(item.total)}</Text>
            </View>

            <View style={styles.actionRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.trackButton,
                  pressed && styles.pressed,
                ]}
                onPress={() => openTracking(item)}
              >
                <Text style={styles.trackButtonText}>Track Order</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.marketButton,
                  pressed && styles.pressed,
                ]}
                onPress={() => router.push("/customer/marketplace" as any)}
              >
                <Text style={styles.marketButtonText}>Shop Again</Text>
              </Pressable>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
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
    color: COLORS.text,
    fontSize: 30,
    fontWeight: "900",
  },
  subtitle: {
    color: COLORS.muted,
    fontSize: 14,
    marginTop: 3,
    fontWeight: "700",
  },
  listContent: {
    padding: 18,
    paddingTop: 0,
    paddingBottom: 38,
  },
  heroCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 30,
    padding: 20,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroTextBlock: {
    flex: 1,
    paddingRight: 12,
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
    lineHeight: 30,
  },
  heroText: {
    color: "#EAF7E6",
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 8,
  },
  heroEmoji: {
    fontSize: 54,
  },
  clearButton: {
    backgroundColor: "#FEE2E2",
    borderRadius: 999,
    paddingVertical: 13,
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  clearButtonText: {
    color: COLORS.danger,
    fontWeight: "900",
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 28,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  orderIconBox: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: COLORS.softGreen,
    justifyContent: "center",
    alignItems: "center",
  },
  orderIcon: {
    fontSize: 28,
  },
  orderHeaderText: {
    flex: 1,
  },
  orderNumber: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.text,
  },
  dateText: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 4,
    fontWeight: "700",
  },
  statusBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  statusText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#FFFFFF",
    textTransform: "capitalize",
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 14,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: COLORS.primary,
    marginBottom: 6,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.lightGreen,
    borderRadius: 18,
    padding: 10,
    marginTop: 7,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  productIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: COLORS.card,
    justifyContent: "center",
    alignItems: "center",
  },
  productIconText: {
    fontSize: 22,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: "900",
    color: COLORS.text,
  },
  farmName: {
    color: COLORS.muted,
    marginTop: 3,
    fontWeight: "700",
    fontSize: 12,
  },
  itemRight: {
    alignItems: "flex-end",
  },
  itemQty: {
    fontSize: 12,
    color: COLORS.muted,
    fontWeight: "800",
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: "900",
    color: COLORS.primary,
    marginTop: 4,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "900",
    color: COLORS.text,
  },
  totalSubtext: {
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 3,
    fontSize: 12,
  },
  totalValue: {
    fontSize: 22,
    fontWeight: "900",
    color: COLORS.primary,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  trackButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: "center",
  },
  trackButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  marketButton: {
    flex: 1,
    backgroundColor: COLORS.softGreen,
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  marketButtonText: {
    color: COLORS.primary,
    fontWeight: "900",
  },
  emptyBox: {
    backgroundColor: COLORS.card,
    borderRadius: 28,
    padding: 26,
    alignItems: "center",
    marginTop: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
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
    fontSize: 15,
    color: COLORS.muted,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 21,
    fontWeight: "700",
  },
  shopButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingHorizontal: 22,
    paddingVertical: 13,
    marginTop: 18,
  },
  shopButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 15,
  },
  pressed: {
    opacity: 0.75,
  },
});