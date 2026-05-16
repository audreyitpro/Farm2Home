import React, { useMemo, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";

import { addToCart } from "../data/cartStore";
import farmTheme from "../styles/farmTheme";

type InventoryStatus = "Good" | "Low Stock" | "Expiring Soon" | "Out";

type HouseholdItem = {
  id: string;
  name: string;
  category: string;
  farmName: string;
  quantity: number;
  unit: string;
  price: number;
  status: InventoryStatus;
  daysLeft: number;
};

const inventoryItems: HouseholdItem[] = [
  {
    id: "eggs-inventory",
    name: "Farm Fresh Eggs",
    category: "Dairy & Eggs",
    farmName: "Green Valley Farm",
    quantity: 4,
    unit: "eggs",
    price: 5.99,
    status: "Low Stock",
    daysLeft: 5,
  },
  {
    id: "milk-inventory",
    name: "Local Milk",
    category: "Dairy",
    farmName: "Morning Pasture Dairy",
    quantity: 1,
    unit: "half gallon",
    price: 4.99,
    status: "Expiring Soon",
    daysLeft: 2,
  },
  {
    id: "spinach-inventory",
    name: "Fresh Spinach",
    category: "Vegetables",
    farmName: "Leafy Acres",
    quantity: 0,
    unit: "bags",
    price: 4.99,
    status: "Out",
    daysLeft: 0,
  },
  {
    id: "honey-inventory",
    name: "Local Raw Honey",
    category: "Pantry",
    farmName: "Golden Hive Farm",
    quantity: 1,
    unit: "jar",
    price: 9.99,
    status: "Good",
    daysLeft: 45,
  },
  {
    id: "apples-inventory",
    name: "Fresh Apples",
    category: "Fruit",
    farmName: "Berry Patch Farm",
    quantity: 6,
    unit: "apples",
    price: 6.99,
    status: "Good",
    daysLeft: 8,
  },
];

export default function SmartHouseholdInventory() {
  const [items, setItems] = useState<HouseholdItem[]>(inventoryItems);

  const lowStockItems = useMemo(() => {
    return items.filter(
      (item) => item.status === "Low Stock" || item.status === "Out"
    );
  }, [items]);

  const expiringSoonItems = useMemo(() => {
    return items.filter((item) => item.status === "Expiring Soon");
  }, [items]);

  const reorderTotal = useMemo(() => {
    return lowStockItems.reduce((sum, item) => sum + item.price, 0);
  }, [lowStockItems]);

  async function reorderItem(item: HouseholdItem) {
    try {
      await addToCart({
        id: item.id,
        name: item.name,
        price: item.price,
        image: "",
        quantity: 1,
        farmName: item.farmName,
      });

      Alert.alert("Added to Cart", `${item.name} was added to your cart.`);
    } catch (error) {
      console.log("Inventory reorder error:", error);
      Alert.alert("Cart Error", "Unable to add item to cart.");
    }
  }

  async function reorderLowStock() {
    try {
      for (const item of lowStockItems) {
        await addToCart({
          id: item.id,
          name: item.name,
          price: item.price,
          image: "",
          quantity: 1,
          farmName: item.farmName,
        });
      }

      Alert.alert("Reorder Added", "Low-stock items were added to your cart.");
    } catch (error) {
      console.log("Bulk reorder error:", error);
      Alert.alert("Cart Error", "Unable to reorder low-stock items.");
    }
  }

  function markUsed(itemId: string) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              quantity: Math.max(0, item.quantity - 1),
              status:
                item.quantity - 1 <= 0
                  ? "Out"
                  : item.quantity - 1 <= 2
                  ? "Low Stock"
                  : item.status,
            }
          : item
      )
    );
  }

  function statusColor(status: InventoryStatus) {
    if (status === "Good") return "#DCFCE7";
    if (status === "Low Stock") return "#FEF3C7";
    if (status === "Expiring Soon") return "#FFEDD5";
    return "#FEE2E2";
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Farm2Home AI</Text>
        <Text style={styles.title}>Smart Household Inventory</Text>
        <Text style={styles.subtitle}>
          Track pantry, fridge, and farm goods while AI recommends what to
          reorder before you run out.
        </Text>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Household Snapshot</Text>

        <View style={styles.summaryGrid}>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryNumber}>{items.length}</Text>
            <Text style={styles.summaryLabel}>Tracked Items</Text>
          </View>

          <View style={styles.summaryBox}>
            <Text style={styles.summaryNumber}>{lowStockItems.length}</Text>
            <Text style={styles.summaryLabel}>Low Stock</Text>
          </View>

          <View style={styles.summaryBox}>
            <Text style={styles.summaryNumber}>{expiringSoonItems.length}</Text>
            <Text style={styles.summaryLabel}>Expiring Soon</Text>
          </View>
        </View>

        <View style={styles.reorderBox}>
          <View>
            <Text style={styles.reorderLabel}>AI Suggested Reorder</Text>
            <Text style={styles.reorderPrice}>${reorderTotal.toFixed(2)}</Text>
          </View>

          <TouchableOpacity style={styles.reorderButton} onPress={reorderLowStock}>
            <Text style={styles.reorderButtonText}>Reorder</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Inventory Items</Text>

      {items.map((item) => (
        <View key={item.id} style={styles.itemCard}>
          <View style={{ flex: 1 }}>
            <View style={styles.itemHeader}>
              <Text style={styles.itemName}>{item.name}</Text>

              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: statusColor(item.status) },
                ]}
              >
                <Text style={styles.statusText}>{item.status}</Text>
              </View>
            </View>

            <Text style={styles.itemMeta}>
              {item.farmName} · {item.category}
            </Text>

            <Text style={styles.itemQty}>
              Qty: {item.quantity} {item.unit}
            </Text>

            <Text style={styles.itemDays}>
              {item.daysLeft > 0
                ? `${item.daysLeft} days remaining`
                : "Needs reorder now"}
            </Text>
          </View>

          <View style={styles.actionColumn}>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => reorderItem(item)}
            >
              <Text style={styles.addButtonText}>Reorder</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.usedButton}
              onPress={() => markUsed(item.id)}
            >
              <Text style={styles.usedButtonText}>Used One</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      <View style={styles.aiCard}>
        <Text style={styles.aiTitle}>AI Reorder Suggestions</Text>

        <Text style={styles.aiText}>
          Based on your household inventory, Farm2Home recommends restocking
          eggs, spinach, and milk soon.
        </Text>

        <View style={styles.aiList}>
          <Text style={styles.aiItem}>• Reorder low-stock items automatically</Text>
          <Text style={styles.aiItem}>• Alert before food expires</Text>
          <Text style={styles.aiItem}>• Predict weekly household needs</Text>
          <Text style={styles.aiItem}>• Match inventory to meal plans</Text>
          <Text style={styles.aiItem}>• Reduce food waste</Text>
        </View>
      </View>

      <View style={styles.navRow}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => router.push("/customer/ai-meal-planner")}
        >
          <Text style={styles.navButtonText}>Meal Planner</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButtonOutline}
          onPress={() => router.push("/customer/cart")}
        >
          <Text style={styles.navButtonOutlineText}>Go to Cart</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 90 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: farmTheme.colors.background,
  },

  hero: {
    backgroundColor: farmTheme.colors.primary,
    paddingTop: 64,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },

  eyebrow: {
    color: "#D1FAE5",
    fontWeight: "900",
    marginBottom: 8,
  },

  title: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900",
    marginBottom: 10,
    lineHeight: 40,
  },

  subtitle: {
    color: "#E8F5E9",
    lineHeight: 23,
    fontWeight: "700",
  },

  summaryCard: {
    backgroundColor: "#FFFFFF",
    margin: 18,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    ...farmTheme.shadow,
  },

  summaryTitle: {
    color: farmTheme.colors.text,
    fontSize: 23,
    fontWeight: "900",
    marginBottom: 14,
  },

  summaryGrid: {
    flexDirection: "row",
    gap: 10,
  },

  summaryBox: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  summaryNumber: {
    color: farmTheme.colors.primary,
    fontSize: 24,
    fontWeight: "900",
  },

  summaryLabel: {
    color: farmTheme.colors.mutedText,
    fontWeight: "800",
    marginTop: 4,
    fontSize: 12,
  },

  reorderBox: {
    backgroundColor: "#F0FDF4",
    borderRadius: 18,
    padding: 15,
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  reorderLabel: {
    color: farmTheme.colors.text,
    fontWeight: "900",
  },

  reorderPrice: {
    color: farmTheme.colors.primary,
    fontSize: 24,
    fontWeight: "900",
    marginTop: 4,
  },

  reorderButton: {
    backgroundColor: farmTheme.colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
  },

  reorderButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  sectionTitle: {
    color: farmTheme.colors.text,
    fontSize: 23,
    fontWeight: "900",
    paddingHorizontal: 18,
    marginBottom: 12,
  },

  itemCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    marginBottom: 12,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    flexDirection: "row",
    gap: 12,
    ...farmTheme.shadow,
  },

  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },

  itemName: {
    color: farmTheme.colors.text,
    fontSize: 18,
    fontWeight: "900",
  },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },

  statusText: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "900",
  },

  itemMeta: {
    color: farmTheme.colors.mutedText,
    fontWeight: "700",
    marginTop: 6,
  },

  itemQty: {
    color: farmTheme.colors.text,
    fontWeight: "900",
    marginTop: 6,
  },

  itemDays: {
    color: farmTheme.colors.primary,
    fontWeight: "900",
    marginTop: 4,
  },

  actionColumn: {
    justifyContent: "center",
    gap: 8,
  },

  addButton: {
    backgroundColor: farmTheme.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: "center",
  },

  addButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  usedButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: farmTheme.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: "center",
  },

  usedButtonText: {
    color: farmTheme.colors.primary,
    fontWeight: "900",
  },

  aiCard: {
    backgroundColor: "#064E3B",
    marginHorizontal: 18,
    marginTop: 8,
    borderRadius: 22,
    padding: 18,
  },

  aiTitle: {
    color: "#FFFFFF",
    fontSize: 23,
    fontWeight: "900",
    marginBottom: 8,
  },

  aiText: {
    color: "#BBF7D0",
    lineHeight: 22,
    fontWeight: "700",
  },

  aiList: {
    marginTop: 12,
  },

  aiItem: {
    color: "#D1FAE5",
    fontWeight: "800",
    lineHeight: 25,
  },

  navRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 18,
    marginTop: 18,
  },

  navButton: {
    flex: 1,
    backgroundColor: farmTheme.colors.primary,
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
  },

  navButtonOutline: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: farmTheme.colors.primary,
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
  },

  navButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  navButtonOutlineText: {
    color: farmTheme.colors.primary,
    fontWeight: "900",
  },
});