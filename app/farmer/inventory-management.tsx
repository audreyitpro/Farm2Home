import React, { useMemo, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import farmTheme from "../styles/farmTheme";

type InventoryStatus = "In Stock" | "Low Stock" | "Out of Stock";

type InventoryItem = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  price: number;
  status: InventoryStatus;
};

const starterInventory: InventoryItem[] = [
  {
    id: "eggs",
    name: "Farm Fresh Eggs",
    category: "Dairy & Eggs",
    quantity: 48,
    unit: "dozen",
    price: 5.99,
    status: "In Stock",
  },
  {
    id: "tomatoes",
    name: "Fresh Tomatoes",
    category: "Produce",
    quantity: 12,
    unit: "boxes",
    price: 6.99,
    status: "Low Stock",
  },
  {
    id: "honey",
    name: "Local Raw Honey",
    category: "Pantry",
    quantity: 0,
    unit: "jars",
    price: 9.99,
    status: "Out of Stock",
  },
];

export default function InventoryManagement() {
  const [items, setItems] = useState<InventoryItem[]>(starterInventory);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");

  const lowStockCount = useMemo(() => {
    return items.filter(
      (item) => item.status === "Low Stock" || item.status === "Out of Stock"
    ).length;
  }, [items]);

  function getStatus(qty: number): InventoryStatus {
    if (qty <= 0) return "Out of Stock";
    if (qty <= 15) return "Low Stock";
    return "In Stock";
  }

  function addItem() {
    const qty = Number(quantity);
    const itemPrice = Number(price);

    if (!name.trim() || !category.trim() || Number.isNaN(qty) || Number.isNaN(itemPrice)) {
      Alert.alert("Missing Details", "Enter product name, category, quantity, and price.");
      return;
    }

    const newItem: InventoryItem = {
      id: Date.now().toString(),
      name,
      category,
      quantity: qty,
      unit: "units",
      price: itemPrice,
      status: getStatus(qty),
    };

    setItems((prev) => [newItem, ...prev]);
    setName("");
    setCategory("");
    setQuantity("");
    setPrice("");

    Alert.alert("Inventory Added", `${newItem.name} was added.`);
  }

  function restockItem(id: string) {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        const updatedQty = item.quantity + 25;

        return {
          ...item,
          quantity: updatedQty,
          status: getStatus(updatedQty),
        };
      })
    );
  }

  function markSold(id: string) {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        const updatedQty = Math.max(0, item.quantity - 1);

        return {
          ...item,
          quantity: updatedQty,
          status: getStatus(updatedQty),
        };
      })
    );
  }

  function statusStyle(status: InventoryStatus) {
    if (status === "In Stock") return styles.inStock;
    if (status === "Low Stock") return styles.lowStock;
    return styles.outStock;
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Farm2Home Farmer Tools</Text>
        <Text style={styles.title}>Inventory Management</Text>
        <Text style={styles.subtitle}>
          Restock products, monitor low inventory, update prices, and keep your
          marketplace listings ready.
        </Text>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Inventory Snapshot</Text>

        <View style={styles.summaryGrid}>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryNumber}>{items.length}</Text>
            <Text style={styles.summaryLabel}>Products</Text>
          </View>

          <View style={styles.summaryBox}>
            <Text style={styles.summaryNumber}>{lowStockCount}</Text>
            <Text style={styles.summaryLabel}>Need Attention</Text>
          </View>

          <View style={styles.summaryBox}>
            <Text style={styles.summaryNumber}>
              ${items.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(0)}
            </Text>
            <Text style={styles.summaryLabel}>Inventory Value</Text>
          </View>
        </View>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.formTitle}>Add Product Inventory</Text>

        <TextInput
          style={styles.input}
          placeholder="Product name"
          value={name}
          onChangeText={setName}
        />

        <TextInput
          style={styles.input}
          placeholder="Category"
          value={category}
          onChangeText={setCategory}
        />

        <TextInput
          style={styles.input}
          placeholder="Quantity"
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="number-pad"
        />

        <TextInput
          style={styles.input}
          placeholder="Price"
          value={price}
          onChangeText={setPrice}
          keyboardType="decimal-pad"
        />

        <TouchableOpacity style={styles.primaryButton} onPress={addItem}>
          <Text style={styles.primaryText}>Add Inventory</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Current Inventory</Text>

      {items.map((item) => (
        <View key={item.id} style={styles.itemCard}>
          <View style={{ flex: 1 }}>
            <View style={styles.itemHeader}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={[styles.statusBadge, statusStyle(item.status)]}>
                {item.status}
              </Text>
            </View>

            <Text style={styles.itemMeta}>
              {item.category} · {item.quantity} {item.unit}
            </Text>

            <Text style={styles.itemPrice}>${item.price.toFixed(2)}</Text>
          </View>

          <View style={styles.actionCol}>
            <TouchableOpacity style={styles.restockButton} onPress={() => restockItem(item.id)}>
              <Text style={styles.restockText}>Restock</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.soldButton} onPress={() => markSold(item.id)}>
              <Text style={styles.soldText}>Sold 1</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      <View style={{ height: 90 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: farmTheme.colors.background },

  hero: {
    backgroundColor: farmTheme.colors.primary,
    paddingTop: 64,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },

  eyebrow: { color: "#D1FAE5", fontWeight: "900", marginBottom: 8 },

  title: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900",
    marginBottom: 10,
    lineHeight: 40,
  },

  subtitle: { color: "#E8F5E9", fontWeight: "700", lineHeight: 23 },

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

  summaryGrid: { flexDirection: "row", gap: 10 },

  summaryBox: {
    flex: 1,
    backgroundColor: "#F0FDF4",
    borderRadius: 16,
    padding: 12,
  },

  summaryNumber: {
    color: farmTheme.colors.primary,
    fontSize: 22,
    fontWeight: "900",
  },

  summaryLabel: {
    color: farmTheme.colors.mutedText,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 4,
  },

  formCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    marginBottom: 18,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    ...farmTheme.shadow,
  },

  formTitle: {
    color: farmTheme.colors.text,
    fontSize: 23,
    fontWeight: "900",
    marginBottom: 12,
  },

  input: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    padding: 14,
    color: farmTheme.colors.text,
    fontWeight: "700",
    marginBottom: 12,
  },

  primaryButton: {
    backgroundColor: farmTheme.colors.primary,
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
  },

  primaryText: { color: "#FFFFFF", fontWeight: "900" },

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
  },

  itemHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },

  itemName: { color: farmTheme.colors.text, fontSize: 18, fontWeight: "900" },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: "hidden",
    fontWeight: "900",
    fontSize: 12,
  },

  inStock: { backgroundColor: "#DCFCE7", color: "#166534" },

  lowStock: { backgroundColor: "#FEF3C7", color: "#92400E" },

  outStock: { backgroundColor: "#FEE2E2", color: "#991B1B" },

  itemMeta: { color: farmTheme.colors.mutedText, fontWeight: "700", marginTop: 6 },

  itemPrice: {
    color: farmTheme.colors.primary,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 6,
  },

  actionCol: { justifyContent: "center", gap: 8 },

  restockButton: {
    backgroundColor: farmTheme.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },

  restockText: { color: "#FFFFFF", fontWeight: "900" },

  soldButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: farmTheme.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },

  soldText: { color: farmTheme.colors.primary, fontWeight: "900" },
});