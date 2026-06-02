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
import { router } from "expo-router";

import {
  FARM_PRODUCT_CATALOG,
  FARM_PRODUCT_CATEGORIES,
  FarmCatalogProduct,
} from "../data/farmProductCatalog";

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

export default function SelectProduceScreen() {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedProducts, setSelectedProducts] = useState<
    Record<string, boolean>
  >({});
  const [search, setSearch] = useState("");

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
      const selected = FARM_PRODUCT_CATALOG.filter(
        (item) => selectedProducts[item.id]
      );

      if (selected.length === 0) {
        Alert.alert("No Products Selected", "Select at least one farm product.");
        return;
      }

      const saved =
        (await AsyncStorage.getItem("currentFarmer")) ||
        (await AsyncStorage.getItem("currentUser"));

      const currentFarmer = saved ? JSON.parse(saved) : {};

      const existingProducts = Array.isArray(currentFarmer.products)
        ? currentFarmer.products
        : [];

      const existingIds = new Set(
        existingProducts.map((item: any) => String(item.id))
      );

      const newProducts = selected
        .filter((item) => !existingIds.has(item.id))
        .map((item) => ({
          id: item.id,
          name: item.name,
          category: item.category,
          price: item.defaultPrice,
          unit: item.unit,
          stock: item.defaultStock,
          quantity: item.defaultStock,
          lowStockThreshold: 5,
          image: item.imageUrl,
          imageUrl: item.imageUrl,
          tags: item.tags,

          farmName:
            currentFarmer.farmName ||
            currentFarmer.businessName ||
            currentFarmer.business_name ||
            currentFarmer.farm_name ||
            "Local Farm",

          farmerId: currentFarmer.id || currentFarmer.farmerId || "",
          farmerEmail: currentFarmer.email || "",

          deliveryOption:
            currentFarmer.pickupDeliveryOption ||
            currentFarmer.pickup_delivery_option ||
            "Pickup and Delivery",

          sold: 0,
          grossSales: 0,
          active: true,
          source: "farm_catalog",

          harvestDate: "",
          organic: item.tags.includes("organic"),
          local: item.tags.includes("local") || true,
          seasonal: item.tags.includes("seasonal"),
        }));

      const updatedProducts = [...existingProducts, ...newProducts];

      const updatedFarmer = {
        ...currentFarmer,
        products: updatedProducts,
        selectedProduce: selected.map((item) => item.name),
        selectedProducts: selected.map((item) => item.name),
        selectedProductCategories: Array.from(
          new Set(selected.map((item) => item.category))
        ),
        updatedAt: new Date().toISOString(),
      };

      await AsyncStorage.setItem("currentFarmer", JSON.stringify(updatedFarmer));
      await AsyncStorage.setItem("currentUser", JSON.stringify(updatedFarmer));
      await AsyncStorage.setItem("userRole", "farmer");
      await AsyncStorage.setItem("currentUserRole", "farmer");

      Alert.alert(
        "Products Added",
        `${newProducts.length} new product(s) added to your farm inventory.`
      );

      router.replace("/farmer/dashboard");
    } catch (error) {
      console.log("SAVE_SELECTED_PRODUCTS_ERROR:", error);
      Alert.alert("Save Error", "Unable to save selected farm products.");
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
          Choose produce, fish, hay, seasonal items, flowers, farm supplies, and
          more to add to your Farmer Store.
        </Text>

        <TextInput
          style={styles.search}
          placeholder="Search products..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor="#8A9482"
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryRow}
      >
        {categories.map((category) => {
          const active = selectedCategory === category;

          return (
            <Pressable
              key={category}
              style={[styles.categoryButton, active && styles.categoryActive]}
              onPress={() => setSelectedCategory(category)}
            >
              <Text
                style={[
                  styles.categoryText,
                  active && styles.categoryTextActive,
                ]}
              >
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
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>No product found</Text>
            <Text style={styles.emptyText}>
              Add it as a custom product with your own photo, price, unit, and
              stock quantity.
            </Text>

            <Pressable
              style={styles.emptyCustomButton}
              onPress={() => router.push("/farmer/add-product")}
            >
              <Text style={styles.emptyCustomText}>Upload Custom Product</Text>
            </Pressable>
          </View>
        }
      />

      <View style={styles.footer}>
        <Pressable style={styles.saveButton} onPress={saveSelectedProducts}>
          <Text style={styles.saveText}>
            Add Selected Products ({selectedCount})
          </Text>
        </Pressable>

        <Pressable
          style={styles.customButton}
          onPress={() => router.push("/farmer/add-product")}
        >
          <Text style={styles.customText}>
            Product Not Listed? Upload Your Own
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    padding: 18,
    paddingTop: 24,
    backgroundColor: COLORS.primaryDark,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  title: {
    color: COLORS.white,
    fontSize: 30,
    fontWeight: "900",
  },
  subtitle: {
    color: "#DCFCE7",
    fontWeight: "700",
    lineHeight: 21,
    marginTop: 8,
  },
  search: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 14,
    marginTop: 16,
    fontWeight: "800",
    color: COLORS.text,
  },
  categoryRow: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 8,
  },
  categoryButton: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  categoryActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  categoryText: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 12,
  },
  categoryTextActive: {
    color: COLORS.white,
  },
  list: {
    padding: 16,
    paddingBottom: 170,
  },
  productCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    marginBottom: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  productCardSelected: {
    borderColor: COLORS.primary,
    borderWidth: 3,
  },
  productImage: {
    width: "100%",
    height: 170,
    backgroundColor: COLORS.softGreen,
  },
  productBody: {
    padding: 14,
  },
  productTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  productName: {
    color: COLORS.text,
    fontSize: 21,
    fontWeight: "900",
  },
  productCategory: {
    color: COLORS.muted,
    fontWeight: "800",
    marginTop: 3,
  },
  checkCircle: {
    width: 32,
    height: 32,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  checkCircleOn: {
    backgroundColor: COLORS.primary,
  },
  checkText: {
    color: COLORS.white,
    fontWeight: "900",
    fontSize: 18,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 12,
  },
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
  price: {
    color: COLORS.text,
    fontWeight: "900",
    marginTop: 12,
  },
  stock: {
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 4,
  },
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
  saveText: {
    color: COLORS.white,
    fontWeight: "900",
    fontSize: 15,
  },
  customButton: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 18,
    padding: 15,
    alignItems: "center",
    marginTop: 10,
  },
  customText: {
    color: COLORS.primaryDark,
    fontWeight: "900",
    textAlign: "center",
  },
  emptyBox: {
    backgroundColor: COLORS.white,
    padding: 20,
    borderRadius: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "900",
  },
  emptyText: {
    color: COLORS.muted,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
  emptyCustomButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 16,
    marginTop: 14,
  },
  emptyCustomText: {
    color: COLORS.white,
    fontWeight: "900",
  },
});