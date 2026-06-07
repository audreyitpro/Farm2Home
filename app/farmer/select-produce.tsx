// app/farmer/select-produce.tsx

import React, { useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";

import {
  FARM_PRODUCT_CATALOG,
  FARM_PRODUCT_CATEGORIES,
  FarmCatalogProduct,
} from "../data/farmProductCatalog";
import { supabase } from "../data/supabaseClient";

const COLORS = {
  primary: "#2E7D32",
  primaryDark: "#14532D",
  background: "#F8FAF5",
  card: "#FFFFFF",
  text: "#172017",
  muted: "#6B7280",
  border: "#E5E7EB",
  softGreen: "#EAF5E6",
  white: "#FFFFFF",
};

function getFarmerProductsKey(farmerId: string) {
  return `farmer_products_${farmerId}`;
}

function cleanProducts(items: any[]) {
  return (items || []).filter((item: any) => {
    const name = String(item?.name || "").trim().toLowerCase();
    return name && name !== "farm product" && name !== "undefined" && name !== "null";
  });
}

function makeFarmerProduct(item: FarmCatalogProduct, farmer: any) {
  const now = new Date().toISOString();
  const farmerId = farmer.id || farmer.farmerId || "";

  return {
    id: item.id,
    catalogId: item.id,
    catalog_id: item.id,
    name: item.name,
    category: item.category,
    price: item.defaultPrice,
    unit: item.unit,
    stock: item.defaultStock,
    quantity: item.defaultStock,
    inventory: item.defaultStock,
    lowStockThreshold: 5,
    low_stock_threshold: 5,
    image: item.imageUrl,
    imageUrl: item.imageUrl,
    image_url: item.imageUrl,
    tags: item.tags || [],
    farmName:
      farmer.farmName ||
      farmer.businessName ||
      farmer.business_name ||
      farmer.farm_name ||
      "Local Farm",
    farmerId,
    farmer_id: farmerId,
    farmerEmail: farmer.email || "",
    farmer_email: farmer.email || "",
    deliveryOption:
      farmer.pickupDeliveryOption ||
      farmer.pickup_delivery_option ||
      "Pickup and Delivery",
    delivery_option:
      farmer.pickupDeliveryOption ||
      farmer.pickup_delivery_option ||
      "Pickup and Delivery",
    sold: 0,
    grossSales: 0,
    gross_sales: 0,
    active: true,
    available: true,
    marketplace_visible: true,
    removed_from_inventory: false,
    source: "farm_catalog",
    organic: item.tags?.includes("organic") || false,
    local: true,
    seasonal: item.tags?.includes("seasonal") || false,
    isSoldOut: false,
    is_sold_out: false,
    createdAt: now,
    created_at: now,
    updatedAt: now,
    updated_at: now,
  };
}

export default function SelectProduceScreen() {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedProducts, setSelectedProducts] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const [currentFarmer, setCurrentFarmer] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      loadCurrentFarmer();
    }, [])
  );

  async function loadCurrentFarmer() {
    const saved =
      (await AsyncStorage.getItem("currentFarmer")) ||
      (await AsyncStorage.getItem("currentUser"));

    if (!saved) {
      router.replace("/farmer/login" as any);
      return;
    }

    const parsed = JSON.parse(saved);
    const farmerId = parsed.id || parsed.farmerId;

    let latestFarmer = parsed;

    if (farmerId) {
      const localInventory = await AsyncStorage.getItem(getFarmerProductsKey(farmerId));
      if (localInventory) {
        latestFarmer.products = cleanProducts(JSON.parse(localInventory));
      }

      const { data } = await supabase
        .from("farmers")
        .select("*")
        .eq("id", farmerId)
        .maybeSingle();

      if (data) {
        latestFarmer = {
          ...latestFarmer,
          ...data,
          id: data.id,
          farmerId: data.id,
          products: latestFarmer.products?.length
            ? latestFarmer.products
            : data.products || parsed.products || [],
        };
      }
    }

    setCurrentFarmer(latestFarmer);
  }

  const categories = ["All", ...FARM_PRODUCT_CATEGORIES];

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();

    return FARM_PRODUCT_CATALOG.filter((item) => {
      const matchesCategory =
        selectedCategory === "All" || item.category === selectedCategory;

      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.tags.some((tag) => tag.toLowerCase().includes(q));

      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, search]);

  function toggleProduct(productId: string) {
    setSelectedProducts((prev) => ({
      ...prev,
      [productId]: !prev[productId],
    }));
  }

  async function saveSelectedProducts() {
    try {
      setSaving(true);

      const selected = FARM_PRODUCT_CATALOG.filter((item) => selectedProducts[item.id]);

      if (selected.length === 0) {
        Alert.alert("No Products Selected", "Select at least one farm product.");
        return;
      }

      const saved =
        (await AsyncStorage.getItem("currentFarmer")) ||
        (await AsyncStorage.getItem("currentUser"));

      if (!saved) {
        Alert.alert("Session Error", "Please login again.");
        router.replace("/farmer/login" as any);
        return;
      }

      const localFarmer = JSON.parse(saved);
      const farmer = currentFarmer || localFarmer;
      const farmerId = farmer.id || farmer.farmerId;

      if (!farmerId) {
        Alert.alert("Session Error", "Farmer ID missing. Please login again.");
        router.replace("/farmer/login" as any);
        return;
      }

      let latestProducts = cleanProducts(farmer.products || []);

      const localInventory = await AsyncStorage.getItem(getFarmerProductsKey(farmerId));
      if (localInventory) {
        latestProducts = cleanProducts(JSON.parse(localInventory));
      }

      const existingKeys = new Set(
        latestProducts.flatMap((item: any) => [
          String(item.id || "").toLowerCase(),
          String(item.catalogId || item.catalog_id || "").toLowerCase(),
          String(item.name || "").toLowerCase(),
        ])
      );

      const newProducts = selected
        .filter((item) => {
          const idKey = String(item.id).toLowerCase();
          const nameKey = String(item.name).toLowerCase();
          return !existingKeys.has(idKey) && !existingKeys.has(nameKey);
        })
        .map((item) => makeFarmerProduct(item, farmer));

      if (newProducts.length === 0) {
        Alert.alert("Already Added", "Those products are already on your dashboard.");
        router.replace("/farmer/dashboard" as any);
        return;
      }

      const updatedProducts = cleanProducts([...latestProducts, ...newProducts]);

      await AsyncStorage.setItem(
        getFarmerProductsKey(farmerId),
        JSON.stringify(updatedProducts)
      );

      const updatedFarmer = {
        ...farmer,
        id: farmerId,
        farmerId,
        products: updatedProducts,
        selectedProduce: updatedProducts.map((item: any) => item.name),
        selectedProducts: updatedProducts.map((item: any) => item.name),
        selectedProductCategories: Array.from(
          new Set(updatedProducts.map((item: any) => item.category).filter(Boolean))
        ),
        updatedAt: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await AsyncStorage.setItem("currentFarmer", JSON.stringify(updatedFarmer));
      await AsyncStorage.setItem("currentUser", JSON.stringify(updatedFarmer));
      await AsyncStorage.setItem("userRole", "farmer");
      await AsyncStorage.setItem("currentUserRole", "farmer");

      await supabase
        .from("farmers")
        .update({
          products: updatedProducts,
          selected_produce: updatedFarmer.selectedProduce,
          updated_at: new Date().toISOString(),
        })
        .eq("id", farmerId);

      Alert.alert(
        "Products Added",
        `${newProducts.length} product(s) added to your farm inventory.`,
        [{ text: "Go to Dashboard", onPress: () => router.replace("/farmer/dashboard" as any) }]
      );
    } catch (error: any) {
      console.log("SAVE_SELECTED_PRODUCTS_ERROR:", error);
      Alert.alert("Save Error", error?.message || "Unable to save selected farm products.");
    } finally {
      setSaving(false);
    }
  }

  function renderProduct({ item }: { item: FarmCatalogProduct }) {
    const selected = Boolean(selectedProducts[item.id]);

    return (
      <Pressable
        style={[styles.productCard, selected && styles.productCardSelected]}
        onPress={() => toggleProduct(item.id)}
      >
        <Image source={{ uri: item.imageUrl }} style={styles.productImage} />

        <View style={styles.productBody}>
          <View style={styles.productTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.productName}>{item.name}</Text>
              <Text style={styles.productCategory}>{item.category}</Text>
            </View>

            <View style={[styles.checkCircle, selected && styles.checkCircleOn]}>
              <Text style={styles.checkText}>{selected ? "✓" : ""}</Text>
            </View>
          </View>

          <View style={styles.tagRow}>
            <Text style={styles.unitTag}>{item.unit}</Text>
            {item.tags.slice(0, 3).map((tag) => (
              <Text key={`${item.id}-${tag}`} style={styles.tag}>
                {tag}
              </Text>
            ))}
          </View>

          <Text style={styles.price}>
            Starts at ${item.defaultPrice.toFixed(2)} / {item.unit}
          </Text>

          <Text style={styles.stock}>
            Default stock: {item.defaultStock} {item.unit}
          </Text>
        </View>
      </Pressable>
    );
  }

  const selectedCount = Object.values(selectedProducts).filter(Boolean).length;

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>Select Farm Products</Text>
        <Text style={styles.subtitle}>
          Choose products to add to your Farmer Dashboard inventory.
        </Text>

        <TextInput
          style={styles.search}
          placeholder="Search products..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor="#8A9482"
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
        {categories.map((category) => {
          const active = selectedCategory === category;
          return (
            <Pressable
              key={category}
              style={[styles.categoryButton, active && styles.categoryActive]}
              onPress={() => setSelectedCategory(category)}
            >
              <Text style={[styles.categoryText, active && styles.categoryTextActive]}>
                {category}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => item.id}
        renderItem={renderProduct}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />

      <View style={styles.footer}>
        <Pressable
          style={[styles.saveButton, saving && styles.disabledButton]}
          onPress={saveSelectedProducts}
          disabled={saving}
        >
          <Text style={styles.saveText}>
            {saving ? "Adding Products..." : `Add Selected Products (${selectedCount})`}
          </Text>
        </Pressable>

        <Pressable
          style={styles.customButton}
          onPress={() => router.push("/farmer/add-product" as any)}
        >
          <Text style={styles.customText}>Product Not Listed? Upload Your Own</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },
  header: {
    padding: 18,
    paddingTop: 24,
    backgroundColor: COLORS.primaryDark,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  title: { color: COLORS.white, fontSize: 30, fontWeight: "900" },
  subtitle: { color: "#DCFCE7", fontWeight: "700", lineHeight: 21, marginTop: 8 },
  search: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 14,
    marginTop: 16,
    fontWeight: "800",
    color: COLORS.text,
  },
  categoryRow: { paddingHorizontal: 14, paddingVertical: 14, gap: 8 },
  categoryButton: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  categoryActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  categoryText: { color: COLORS.text, fontWeight: "900", fontSize: 12 },
  categoryTextActive: { color: COLORS.white },
  list: { padding: 16, paddingBottom: 170 },
  productCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    marginBottom: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  productCardSelected: { borderColor: COLORS.primary, borderWidth: 3 },
  productImage: { width: "100%", height: 170, backgroundColor: COLORS.softGreen },
  productBody: { padding: 14 },
  productTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  productName: { color: COLORS.text, fontSize: 21, fontWeight: "900" },
  productCategory: { color: COLORS.muted, fontWeight: "800", marginTop: 3 },
  checkCircle: {
    width: 32,
    height: 32,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  checkCircleOn: { backgroundColor: COLORS.primary },
  checkText: { color: COLORS.white, fontWeight: "900", fontSize: 18 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 12 },
  unitTag: {
    backgroundColor: COLORS.primaryDark,
    color: COLORS.white,
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: "hidden",
    fontSize: 12,
  },
  tag: {
    backgroundColor: "#ECFDF5",
    color: COLORS.primaryDark,
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: "hidden",
    fontSize: 12,
  },
  price: { color: COLORS.text, fontWeight: "900", marginTop: 12 },
  stock: { color: COLORS.muted, fontWeight: "700", marginTop: 4 },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.white,
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    padding: 16,
    alignItems: "center",
  },
  disabledButton: { opacity: 0.65 },
  saveText: { color: COLORS.white, fontWeight: "900", fontSize: 15 },
  customButton: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 18,
    padding: 15,
    alignItems: "center",
    marginTop: 10,
  },
  customText: { color: COLORS.primaryDark, fontWeight: "900", textAlign: "center" },
});