import React, { useCallback, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";

import {
  CartHistoryItem,
  clearCartHistory,
  getCartHistory,
} from "../data/cartStore";

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
    await clearCartHistory();
    setOrders([]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Orders</Text>
        <Text style={styles.subtitle}>
          Saved carts and checkout history from Farm2Home.
        </Text>
      </View>

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListHeaderComponent={
          orders.length > 0 ? (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={handleClearHistory}
            >
              <Text style={styles.clearButtonText}>Clear Cart History</Text>
            </TouchableOpacity>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>No saved cart history yet</Text>
            <Text style={styles.emptyText}>
              Add items to your cart. Your saved cart history will appear here.
            </Text>

            <TouchableOpacity
              style={styles.shopButton}
              onPress={() => router.push("/customer/marketplace" as any)}
            >
              <Text style={styles.shopButtonText}>Shop Fresh Produce</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View>
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
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{cartItem.name}</Text>
                  <Text style={styles.farmName}>{cartItem.farmName}</Text>
                </View>

                <Text style={styles.itemQty}>Qty: {cartItem.quantity}</Text>
                <Text style={styles.itemPrice}>{money(cartItem.price)}</Text>
              </View>
            ))}

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>
                {item.itemCount} item(s)
              </Text>
              <Text style={styles.totalValue}>{money(item.total)}</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f7ef",
  },
  header: {
    backgroundColor: "#2f7d32",
    paddingTop: 58,
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  title: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "900",
  },
  subtitle: {
    color: "#e7f4df",
    fontSize: 15,
    marginTop: 8,
    lineHeight: 21,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  clearButton: {
    backgroundColor: "#b3261e",
    borderRadius: 999,
    paddingVertical: 13,
    alignItems: "center",
    marginBottom: 16,
  },
  clearButtonText: {
    color: "#ffffff",
    fontWeight: "900",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  orderNumber: {
    fontSize: 18,
    fontWeight: "900",
    color: "#21351f",
  },
  dateText: {
    fontSize: 13,
    color: "#6d7668",
    marginTop: 4,
  },
  statusBadge: {
    backgroundColor: "#2f7d32",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#ffffff",
    textTransform: "capitalize",
  },
  divider: {
    height: 1,
    backgroundColor: "#edf0e7",
    marginVertical: 14,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: "#2f7d32",
    marginBottom: 4,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f7faef",
    borderRadius: 12,
    padding: 10,
    marginTop: 6,
  },
  itemName: {
    fontSize: 14,
    fontWeight: "900",
    color: "#243421",
  },
  farmName: {
    color: "#6d7668",
    marginTop: 3,
    fontWeight: "700",
  },
  itemQty: {
    fontSize: 13,
    color: "#6d7668",
    marginHorizontal: 8,
    fontWeight: "800",
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: "900",
    color: "#2f7d32",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#edf0e7",
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "900",
    color: "#21351f",
  },
  totalValue: {
    fontSize: 20,
    fontWeight: "900",
    color: "#2f7d32",
  },
  emptyBox: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 24,
    alignItems: "center",
    marginTop: 30,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#21351f",
    textAlign: "center",
  },
  emptyText: {
    fontSize: 15,
    color: "#6d7668",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 21,
  },
  shopButton: {
    backgroundColor: "#2f7d32",
    borderRadius: 999,
    paddingHorizontal: 22,
    paddingVertical: 13,
    marginTop: 18,
  },
  shopButtonText: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 15,
  },
});