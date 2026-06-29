import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import farmTheme from "../styles/farmTheme";
import { supabase } from "../data/supabaseClient";

type InventoryStatus = "In Stock" | "Low Stock" | "Out of Stock";

type InventoryItem = {
  id: string;
  farmer_id: string;
  name: string;
  category: string;
  quantity: number;
  stock: number;
  unit: string;
  price: number;
  status: InventoryStatus;
  marketplace_visible: boolean;
  bundle_eligible: boolean;
  available: boolean;
};

const CATEGORIES = [
  "Produce",
  "Meat",
  "Seafood",
  "Dairy & Eggs",
  "Pantry",
  "Bakery",
  "Plants",
  "Seasonal",
];

const UNITS = ["each", "lb", "dozen", "box", "bag", "bundle", "jar", "case"];

function clean(value: any) {
  return String(value ?? "").trim();
}

function money(value: any) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function getStatus(qty: number): InventoryStatus {
  if (qty <= 0) return "Out of Stock";
  if (qty <= 15) return "Low Stock";
  return "In Stock";
}

export default function InventoryManagement() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [farmerId, setFarmerId] = useState("");
  const [farmName, setFarmName] = useState("Farm2Home Farm");

  const [items, setItems] = useState<InventoryItem[]>([]);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("Produce");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("each");
  const [price, setPrice] = useState("");

  useEffect(() => {
    initialize();
  }, []);

  const summary = useMemo(() => {
    const live = items.filter((item) => item.marketplace_visible).length;
    const bundleReady = items.filter((item) => item.bundle_eligible).length;
    const attention = items.filter(
      (item) => item.status === "Low Stock" || item.status === "Out of Stock"
    ).length;

    const value = items.reduce(
      (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
      0
    );

    return {
      total: items.length,
      live,
      bundleReady,
      attention,
      value,
    };
  }, [items]);

  async function initialize() {
    try {
      setLoading(true);

      const saved =
        (await AsyncStorage.getItem("currentFarmer")) ||
        (await AsyncStorage.getItem("farm2homeCurrentFarmer")) ||
        (await AsyncStorage.getItem("farm2homeFarmerSession")) ||
        (await AsyncStorage.getItem("currentUser"));

      if (!saved) {
        router.replace("/farmer/login" as any);
        return;
      }

      const farmer = JSON.parse(saved);
      const id =
        farmer.id ||
        farmer.farmer_id ||
        farmer.farmerId ||
        farmer.profile_id ||
        "";

      if (!id) {
        router.replace("/farmer/login" as any);
        return;
      }

      setFarmerId(id);
      setFarmName(
        farmer.farmName ||
          farmer.farm_name ||
          farmer.businessName ||
          farmer.business_name ||
          "Farm2Home Farm"
      );

      await loadInventory(id);
    } catch (error: any) {
      Alert.alert("Inventory Error", error?.message || "Unable to load inventory.");
    } finally {
      setLoading(false);
    }
  }

  async function loadInventory(id = farmerId) {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("farmer_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      console.log("Load products error:", error.message);
      setItems([]);
      return;
    }

    const mapped = (data || []).map((row: any) => {
      const qty = Number(row.quantity || row.stock || row.inventory || 0);

      return {
        id: clean(row.id),
        farmer_id: clean(row.farmer_id),
        name: clean(row.name || row.product_name),
        category: clean(row.category || "Produce"),
        quantity: qty,
        stock: qty,
        unit: clean(row.unit || "each"),
        price: Number(row.price || 0),
        status: getStatus(qty),
        marketplace_visible: row.marketplace_visible !== false,
        bundle_eligible: Boolean(row.bundle_eligible ?? true),
        available: row.available !== false && qty > 0,
      };
    });

    setItems(mapped);
  }

  function resetForm() {
    setName("");
    setCategory("Produce");
    setQuantity("");
    setUnit("each");
    setPrice("");
  }

  async function addItem() {
    const qty = Number(quantity);
    const itemPrice = Number(price);

    if (!name.trim() || Number.isNaN(qty) || Number.isNaN(itemPrice)) {
      Alert.alert("Missing Details", "Enter product name, quantity, and price.");
      return;
    }

    const duplicate = items.some(
      (item) => item.name.toLowerCase() === name.trim().toLowerCase()
    );

    if (duplicate) {
      Alert.alert(
        "Duplicate Product",
        "This product already exists. Update the existing product instead."
      );
      return;
    }

    try {
      setSaving(true);

      const payload = {
        farmer_id: farmerId,
        farm_name: farmName,
        name: name.trim(),
        category,
        quantity: qty,
        stock: qty,
        inventory: qty,
        unit,
        price: itemPrice,
        available: qty > 0,
        marketplace_visible: true,
        bundle_eligible: true,
        active: true,
        source: "inventory_management",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("products").insert(payload);
      if (error) throw error;

      resetForm();
      await loadInventory();

      Alert.alert("Added to Market", "Product was added to inventory and marketplace.");
    } catch (error: any) {
      Alert.alert("Save Error", error?.message || "Unable to add product.");
    } finally {
      setSaving(false);
    }
  }

  async function updateProduct(id: string, updates: Partial<InventoryItem>) {
    const qty = Number(updates.quantity ?? updates.stock);

    const payload: any = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    if (!Number.isNaN(qty)) {
      payload.quantity = qty;
      payload.stock = qty;
      payload.inventory = qty;
      payload.available = qty > 0;
    }

    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              ...updates,
              quantity: payload.quantity ?? item.quantity,
              stock: payload.stock ?? item.stock,
              status: getStatus(payload.quantity ?? item.quantity),
            }
          : item
      )
    );

    const { error } = await supabase.from("products").update(payload).eq("id", id);

    if (error) {
      Alert.alert("Update Error", error.message);
      await loadInventory();
    }
  }

  function restockItem(item: InventoryItem) {
    updateProduct(item.id, {
      quantity: Number(item.quantity || 0) + 25,
      stock: Number(item.quantity || 0) + 25,
      available: true,
    });
  }

  function markSold(item: InventoryItem) {
    const nextQty = Math.max(0, Number(item.quantity || 0) - 1);
    updateProduct(item.id, {
      quantity: nextQty,
      stock: nextQty,
      available: nextQty > 0,
    });
  }

  function toggleMarketplace(item: InventoryItem) {
    updateProduct(item.id, {
      marketplace_visible: !item.marketplace_visible,
    });
  }

  function toggleBundleReady(item: InventoryItem) {
    updateProduct(item.id, {
      bundle_eligible: !item.bundle_eligible,
    });
  }

  function deleteProduct(item: InventoryItem) {
    Alert.alert("Remove Product", `Remove ${item.name} from inventory and marketplace?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          const previous = items;
          setItems((prev) => prev.filter((product) => product.id !== item.id));

          const { error } = await supabase.from("products").delete().eq("id", item.id);

          if (error) {
            setItems(previous);
            Alert.alert("Remove Error", error.message);
          }
        },
      },
    ]);
  }

  function goToBundleBuilder() {
    router.push("/farmer/farm-bundles" as any);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={farmTheme.colors.primary} size="large" />
        <Text style={styles.centerText}>Loading product management...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.push("/farmer/dashboard" as any)}
        >
          <Ionicons name="arrow-back-outline" size={22} color="#FFFFFF" />
        </TouchableOpacity>

        <Text style={styles.eyebrow}>Farm2Home Farmer Market</Text>
        <Text style={styles.title}>Manage Products & Marketplace</Text>
        <Text style={styles.subtitle}>
          Control inventory, publish products to the marketplace, and mark
          products as bundle-ready for customer subscription boxes.
        </Text>
      </View>

      <View style={styles.flowCard}>
        <Text style={styles.flowTitle}>Product Management Flow</Text>
        <FlowStep number="1" text="Add or update products your farm sells" />
        <FlowStep number="2" text="Publish products to the customer marketplace" />
        <FlowStep number="3" text="Mark products bundle-ready for subscription boxes" />
        <FlowStep number="4" text="Create bundles from eligible products" />
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Market Snapshot</Text>

        <View style={styles.summaryGrid}>
          <SummaryBox label="Products" value={String(summary.total)} />
          <SummaryBox label="Live Market" value={String(summary.live)} />
          <SummaryBox label="Bundle Ready" value={String(summary.bundleReady)} />
          <SummaryBox label="Attention" value={String(summary.attention)} />
        </View>

        <View style={styles.valueBox}>
          <Text style={styles.valueLabel}>Inventory Value</Text>
          <Text style={styles.valueText}>{money(summary.value)}</Text>
        </View>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.formTitle}>Add Product to Inventory</Text>
        <Text style={styles.formSub}>
          New products are automatically listed in the marketplace and marked
          bundle-ready.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Product name"
          placeholderTextColor="#8A8F98"
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.label}>Category</Text>
        <View style={styles.chipWrap}>
          {CATEGORIES.map((item) => (
            <Chip
              key={item}
              label={item}
              active={category === item}
              onPress={() => setCategory(item)}
            />
          ))}
        </View>

        <TextInput
          style={styles.input}
          placeholder="Quantity"
          placeholderTextColor="#8A8F98"
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="number-pad"
        />

        <Text style={styles.label}>Unit</Text>
        <View style={styles.chipWrap}>
          {UNITS.map((item) => (
            <Chip
              key={item}
              label={item}
              active={unit === item}
              onPress={() => setUnit(item)}
            />
          ))}
        </View>

        <TextInput
          style={styles.input}
          placeholder="Price"
          placeholderTextColor="#8A8F98"
          value={price}
          onChangeText={setPrice}
          keyboardType="decimal-pad"
        />

        <TouchableOpacity
          style={[styles.primaryButton, saving && styles.disabledButton]}
          onPress={addItem}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="storefront-outline" size={18} color="#FFFFFF" />
              <Text style={styles.primaryText}>Add Product to Market</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Current Products</Text>
        <TouchableOpacity style={styles.bundleButton} onPress={goToBundleBuilder}>
          <Ionicons name="basket-outline" size={17} color={farmTheme.colors.primary} />
          <Text style={styles.bundleButtonText}>Build Bundles</Text>
        </TouchableOpacity>
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyEmoji}>🧺</Text>
          <Text style={styles.emptyTitle}>No products yet</Text>
          <Text style={styles.emptyText}>
            Add products above so customers can shop from your farmer market.
          </Text>
        </View>
      ) : (
        items.map((item) => (
          <View key={item.id} style={styles.itemCard}>
            <View style={styles.itemTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemMeta}>
                  {item.category} · {item.quantity} {item.unit}
                </Text>
              </View>

              <Text style={[styles.statusBadge, statusStyle(item.status)]}>
                {item.status}
              </Text>
            </View>

            <View style={styles.priceRow}>
              <Text style={styles.itemPrice}>{money(item.price)}</Text>
              <Text style={styles.visibilityText}>
                {item.marketplace_visible ? "Live in marketplace" : "Hidden from marketplace"}
              </Text>
            </View>

            <View style={styles.marketStateRow}>
              <StatePill
                label={item.marketplace_visible ? "Marketplace Live" : "Marketplace Hidden"}
                active={item.marketplace_visible}
              />
              <StatePill
                label={item.bundle_eligible ? "Bundle Ready" : "Not Bundle Ready"}
                active={item.bundle_eligible}
              />
            </View>

            <View style={styles.actionGrid}>
              <ActionButton label="Restock +25" icon="add-circle-outline" onPress={() => restockItem(item)} />
              <ActionButton label="Sold 1" icon="remove-circle-outline" onPress={() => markSold(item)} />
              <ActionButton
                label={item.marketplace_visible ? "Hide" : "Publish"}
                icon={item.marketplace_visible ? "eye-off-outline" : "eye-outline"}
                onPress={() => toggleMarketplace(item)}
              />
              <ActionButton
                label={item.bundle_eligible ? "Remove Bundle" : "Bundle Ready"}
                icon="basket-outline"
                onPress={() => toggleBundleReady(item)}
              />
            </View>

            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => deleteProduct(item)}
            >
              <Ionicons name="trash-outline" size={17} color="#991B1B" />
              <Text style={styles.deleteText}>Remove Product from Market</Text>
            </TouchableOpacity>
          </View>
        ))
      )}

      <View style={{ height: 90 }} />
    </ScrollView>
  );
}

function FlowStep({ number, text }: { number: string; text: string }) {
  return (
    <View style={styles.flowStep}>
      <Text style={styles.flowNumber}>{number}</Text>
      <Text style={styles.flowText}>{text}</Text>
    </View>
  );
}

function SummaryBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryBox}>
      <Text style={styles.summaryNumber}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && styles.chipActive]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function StatePill({ label, active }: { label: string; active: boolean }) {
  return (
    <Text style={[styles.statePill, active ? styles.stateActive : styles.stateInactive]}>
      {label}
    </Text>
  );
}

function ActionButton({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.actionButton} onPress={onPress}>
      <Ionicons name={icon} size={16} color={farmTheme.colors.primary} />
      <Text style={styles.actionText}>{label}</Text>
    </TouchableOpacity>
  );
}

function statusStyle(status: InventoryStatus) {
  if (status === "In Stock") return styles.inStock;
  if (status === "Low Stock") return styles.lowStock;
  return styles.outStock;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: farmTheme.colors.background },
  center: {
    flex: 1,
    backgroundColor: farmTheme.colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  centerText: {
    color: farmTheme.colors.primary,
    fontWeight: "900",
    marginTop: 10,
  },

  hero: {
    backgroundColor: farmTheme.colors.primary,
    paddingTop: 58,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  eyebrow: {
    color: "#D1FAE5",
    fontWeight: "900",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "900",
    marginBottom: 10,
    lineHeight: 39,
  },
  subtitle: { color: "#E8F5E9", fontWeight: "700", lineHeight: 23 },

  flowCard: {
    backgroundColor: "#FFFFFF",
    margin: 18,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    ...farmTheme.shadow,
  },
  flowTitle: {
    color: farmTheme.colors.text,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 12,
  },
  flowStep: {
    flexDirection: "row",
    gap: 12,
    marginTop: 10,
    alignItems: "center",
  },
  flowNumber: {
    width: 32,
    height: 32,
    borderRadius: 13,
    backgroundColor: "#E9F8EF",
    color: farmTheme.colors.primary,
    fontWeight: "900",
    textAlign: "center",
    textAlignVertical: "center",
    overflow: "hidden",
  },
  flowText: {
    flex: 1,
    color: farmTheme.colors.text,
    fontWeight: "800",
    lineHeight: 20,
  },

  summaryCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    marginBottom: 18,
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
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  summaryBox: {
    flexGrow: 1,
    width: "47%",
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
  valueBox: {
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    padding: 14,
    marginTop: 12,
  },
  valueLabel: {
    color: farmTheme.colors.mutedText,
    fontWeight: "900",
  },
  valueText: {
    color: farmTheme.colors.primary,
    fontWeight: "900",
    fontSize: 24,
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
    marginBottom: 5,
  },
  formSub: {
    color: farmTheme.colors.mutedText,
    fontWeight: "700",
    lineHeight: 21,
    marginBottom: 14,
  },
  label: {
    color: farmTheme.colors.text,
    fontWeight: "900",
    marginBottom: 8,
    marginTop: 4,
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
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: farmTheme.colors.primary,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  chipActive: {
    backgroundColor: farmTheme.colors.primary,
  },
  chipText: {
    color: farmTheme.colors.primary,
    fontWeight: "900",
  },
  chipTextActive: {
    color: "#FFFFFF",
  },
  primaryButton: {
    backgroundColor: farmTheme.colors.primary,
    padding: 15,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryText: { color: "#FFFFFF", fontWeight: "900" },
  disabledButton: { opacity: 0.7 },

  sectionHeader: {
    paddingHorizontal: 18,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionTitle: {
    color: farmTheme.colors.text,
    fontSize: 23,
    fontWeight: "900",
  },
  bundleButton: {
    backgroundColor: "#E9F8EF",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  bundleButtonText: {
    color: farmTheme.colors.primary,
    fontWeight: "900",
  },

  emptyCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    alignItems: "center",
    ...farmTheme.shadow,
  },
  emptyEmoji: { fontSize: 42 },
  emptyTitle: {
    color: farmTheme.colors.text,
    fontWeight: "900",
    fontSize: 18,
    marginTop: 8,
  },
  emptyText: {
    color: farmTheme.colors.mutedText,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 21,
    marginTop: 6,
  },

  itemCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    marginBottom: 12,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    ...farmTheme.shadow,
  },
  itemTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  itemName: { color: farmTheme.colors.text, fontSize: 19, fontWeight: "900" },
  itemMeta: {
    color: farmTheme.colors.mutedText,
    fontWeight: "700",
    marginTop: 5,
  },
  priceRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  itemPrice: {
    color: farmTheme.colors.primary,
    fontSize: 20,
    fontWeight: "900",
  },
  visibilityText: {
    color: farmTheme.colors.mutedText,
    fontWeight: "800",
    flexShrink: 1,
    textAlign: "right",
  },

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

  marketStateRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  statePill: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    overflow: "hidden",
    fontWeight: "900",
    fontSize: 12,
  },
  stateActive: {
    backgroundColor: "#E9F8EF",
    color: farmTheme.colors.primary,
  },
  stateInactive: {
    backgroundColor: "#FEE2E2",
    color: "#991B1B",
  },

  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  actionButton: {
    flexGrow: 1,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  actionText: {
    color: farmTheme.colors.primary,
    fontWeight: "900",
    fontSize: 12,
  },

  deleteButton: {
    marginTop: 12,
    backgroundColor: "#FEE2E2",
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  deleteText: {
    color: "#991B1B",
    fontWeight: "900",
  },
});