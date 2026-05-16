import React, { useCallback, useEffect, useMemo, useState } from "react";
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

import { addToCart, getCartItemCount } from "../data/cartStore";
import { getApprovedFarmers } from "../data/farmerStore";

const GREEN_VALLEY_STRIPE_ACCOUNT_ID = "acct_1TWeOKCqJp7Z8L15";
const SUNNYBROOK_STRIPE_ACCOUNT_ID = "acct_1TWjGSE1SmOAMwkt";

const DEFAULT_CATEGORIES = [
  "All",
  "Fresh Produce",
  "Vegetables",
  "Fruits",
  "Organic",
  "Eggs",
  "Honey",
  "Meat",
  "Poultry",
  "Fish Farm / Aquaculture",
  "Dairy",
  "Baked Goods",
  "Flowers",
  "Plants & Herbs",
  "Hay",
  "Bale of Hay",
  "Seasonal",
  "Animal Feed",
  "Herbs",
  "Farm Supplies",
  "Garden Starters",
];

type Product = {
  id: string;
  name: string;
  category?: string;
  price?: number;
  unit?: string;
  description?: string;
  image?: string;
  imageUrl?: string;
  farmerId?: string;
  farmName?: string;
  farmerStripeAccountId?: string;
  stripeAccountId?: string;
};

type Farmer = {
  id: string;
  farmName?: string;
  name?: string;
  farmLocation?: string;
  location?: string;
  rating?: number;
  distanceMiles?: number;
  logoUrl?: string;
  stripeAccountId?: string;
  farmerStripeAccountId?: string;
  products?: Product[];
};

function getFarmerName(farmer: Farmer) {
  return farmer.farmName || farmer.name || "Farm2Home Farm";
}

function getFarmerLocation(farmer: Farmer) {
  return farmer.farmLocation || farmer.location || "Michigan";
}

function getFarmerStripeAccountId(farmer: Farmer, product?: Product) {
  return (
    product?.farmerStripeAccountId ||
    product?.stripeAccountId ||
    farmer.farmerStripeAccountId ||
    farmer.stripeAccountId ||
    GREEN_VALLEY_STRIPE_ACCOUNT_ID
  );
}

function getProductEmoji(product: Product) {
  const category = String(product.category || "").toLowerCase();
  const name = String(product.name || "").toLowerCase();

  if (category.includes("flower") || name.includes("flower")) return "💐";
  if (category.includes("hay") || name.includes("hay")) return "🌾";
  if (category.includes("egg") || name.includes("egg")) return "🥚";
  if (category.includes("honey") || name.includes("honey")) return "🍯";
  if (category.includes("dairy") || name.includes("milk")) return "🥛";
  if (category.includes("meat") || category.includes("poultry")) return "🥩";
  if (category.includes("fruit") || name.includes("apple")) return "🍎";
  if (category.includes("vegetable") || category.includes("greens")) return "🥬";

  return "🥬";
}

function getFallbackFarmers(): Farmer[] {
  return [
    {
      id: "farm_1",
      farmName: "Green Valley Farm",
      location: "Sterling Heights, MI",
      rating: 4.8,
      distanceMiles: 5,
      stripeAccountId: GREEN_VALLEY_STRIPE_ACCOUNT_ID,
      products: [
        {
          id: "apple_1",
          name: "Fresh Apples",
          category: "Fruits",
          price: 4.99,
          unit: "bag",
        },
        {
          id: "honey_1",
          name: "Raw Honey",
          category: "Honey",
          price: 9.99,
          unit: "jar",
        },
        {
          id: "corn_1",
          name: "Sweet Corn",
          category: "Vegetables",
          price: 3.5,
          unit: "dozen",
        },
        {
          id: "hay_1",
          name: "Bale of Hay",
          category: "Bale of Hay",
          price: 12,
          unit: "bale",
        },
        {
          id: "flowers_1",
          name: "Fresh Cut Flowers",
          category: "Flowers",
          price: 14.99,
          unit: "bouquet",
        },
      ],
    },
    {
      id: "farm_2",
      farmName: "Sunnybrook Farm",
      location: "Royal Oak, MI",
      rating: 4.9,
      distanceMiles: 9,
      stripeAccountId: SUNNYBROOK_STRIPE_ACCOUNT_ID,
      products: [
        {
          id: "egg_1",
          name: "Farm Eggs",
          category: "Eggs",
          price: 5.99,
          unit: "dozen",
        },
        {
          id: "milk_1",
          name: "Fresh Milk",
          category: "Dairy",
          price: 6.5,
          unit: "gallon",
        },
        {
          id: "feed_1",
          name: "Animal Feed Mix",
          category: "Animal Feed",
          price: 18,
          unit: "bag",
        },
      ],
    },
  ];
}

function normalizeFarmers(inputFarmers: Farmer[]): Farmer[] {
  return inputFarmers.map((farmer) => {
    let stripeAccountId =
      farmer.stripeAccountId ||
      farmer.farmerStripeAccountId ||
      GREEN_VALLEY_STRIPE_ACCOUNT_ID;

    if (farmer.id === "farm_2" || getFarmerName(farmer).includes("Sunnybrook")) {
      stripeAccountId = SUNNYBROOK_STRIPE_ACCOUNT_ID;
    }

    const farmName = getFarmerName(farmer);

    return {
      ...farmer,
      farmName,
      location: getFarmerLocation(farmer),
      stripeAccountId,
      products: (farmer.products || []).map((product) => ({
        ...product,
        farmerId: product.farmerId || farmer.id,
        farmName: product.farmName || farmName,
        farmerStripeAccountId:
          product.farmerStripeAccountId ||
          product.stripeAccountId ||
          stripeAccountId,
      })),
    };
  });
}

export default function MarketplaceScreen() {
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [cartCount, setCartCount] = useState(0);

  const refreshCartCount = useCallback(async () => {
    try {
      const count = await getCartItemCount();
      setCartCount(count);
    } catch (error) {
      console.log("Cart count error:", error);
      setCartCount(0);
    }
  }, []);

  const loadMarketplace = useCallback(async () => {
    try {
      setLoading(true);

      const approvedFarmers = (await getApprovedFarmers()) || [];
      const testFarmRaw = await AsyncStorage.getItem("farm2homeFarmers");
      const testFarmers = testFarmRaw ? JSON.parse(testFarmRaw) : [];

      const mergedFarmers: Farmer[] = [
        ...(Array.isArray(approvedFarmers) ? approvedFarmers : []),
        ...(Array.isArray(testFarmers) ? testFarmers : []),
      ];

      const farmersToUse =
        mergedFarmers.length > 0 ? mergedFarmers : getFallbackFarmers();

      const normalizedFarmers = normalizeFarmers(farmersToUse).filter(
        (farmer) => farmer.products && farmer.products.length > 0
      );

      const uniqueFarmers = Array.from(
        new Map(normalizedFarmers.map((farmer) => [farmer.id, farmer])).values()
      );

      setFarmers(uniqueFarmers);
    } catch (error) {
      console.log("Marketplace load error:", error);
      setFarmers(normalizeFarmers(getFallbackFarmers()));
      Alert.alert("Using Test Marketplace", "Test farmers were loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMarketplace();
    refreshCartCount();
  }, [loadMarketplace, refreshCartCount]);

  const categories = useMemo(() => {
    const categorySet = new Set<string>();

    farmers.forEach((farmer) => {
      (farmer.products || []).forEach((product) => {
        if (product.category) categorySet.add(product.category);
      });
    });

    const dynamicCategories = Array.from(categorySet);

    return Array.from(
      new Set([...DEFAULT_CATEGORIES, ...dynamicCategories])
    );
  }, [farmers]);

  const filteredFarmers = useMemo(() => {
    const search = searchText.trim().toLowerCase();

    return farmers
      .map((farmer) => {
        const filteredProducts = (farmer.products || []).filter((product) => {
          const matchesCategory =
            selectedCategory === "All" || product.category === selectedCategory;

          const matchesSearch =
            !search ||
            product.name?.toLowerCase().includes(search) ||
            product.category?.toLowerCase().includes(search) ||
            product.unit?.toLowerCase().includes(search) ||
            farmer.farmName?.toLowerCase().includes(search) ||
            farmer.name?.toLowerCase().includes(search);

          return matchesCategory && matchesSearch;
        });

        return { ...farmer, products: filteredProducts };
      })
      .filter((farmer) => farmer.products && farmer.products.length > 0);
  }, [farmers, selectedCategory, searchText]);

  async function handleAddToCart(farmer: Farmer, product: Product) {
    try {
      const farmerStripeAccountId = getFarmerStripeAccountId(farmer, product);

      if (!farmerStripeAccountId) {
        Alert.alert("Missing Stripe Account", "This farm needs a payout account.");
        return;
      }

      await addToCart({
        id: `${farmer.id}_${product.id}`,
        productId: product.id,
        name: product.name,
        price: Number(product.price || 0),
        quantity: 1,
        image: product.image || product.imageUrl,
        farmName: getFarmerName(farmer),
        farmerId: farmer.id,
        farmerStripeAccountId,
        unit: product.unit || "each",
      } as any);

      await refreshCartCount();

      Alert.alert(
        "Added to Cart",
        `${product.name} added to cart at $${Number(product.price || 0).toFixed(
          2
        )}${product.unit ? ` / ${product.unit}` : ""}.`
      );
    } catch (error) {
      console.log("Add cart error:", error);
      Alert.alert("Error", "Unable to add item to cart.");
    }
  }

  function openFarmerShop(farmer: Farmer) {
    router.push({
      pathname: "/customer/farmer-shop",
      params: {
        farmerId: farmer.id,
      },
    } as any);
  }

  function renderProduct(farmer: Farmer, product: Product) {
    const imageSource = product.image || product.imageUrl || "";

    return (
      <View key={product.id} style={styles.productCard}>
        {imageSource ? (
          <Image source={{ uri: imageSource }} style={styles.productImage} />
        ) : (
          <View style={styles.productPlaceholder}>
            <Text style={styles.productEmoji}>{getProductEmoji(product)}</Text>
          </View>
        )}

        <Text style={styles.productName} numberOfLines={1}>
          {product.name}
        </Text>

        <Text style={styles.productCategory}>
          {product.category || "Farm Goods"}
        </Text>

        <Text style={styles.productPrice}>
          ${Number(product.price || 0).toFixed(2)}
          {product.unit ? ` / ${product.unit}` : ""}
        </Text>

        <Pressable
          style={({ pressed }) => [
            styles.addButton,
            pressed && styles.pressedButton,
          ]}
          onPress={() => handleAddToCart(farmer, product)}
        >
          <Text style={styles.addButtonText}>Add</Text>
        </Pressable>
      </View>
    );
  }

  function renderFarmerRow({ item }: { item: Farmer }) {
    return (
      <View style={styles.farmRow}>
        <Pressable
          style={({ pressed }) => [
            styles.leftFarmColumn,
            pressed && styles.pressedButton,
          ]}
          onPress={() => openFarmerShop(item)}
        >
          {item.logoUrl ? (
            <Image source={{ uri: item.logoUrl }} style={styles.farmLogo} />
          ) : (
            <View style={styles.logoPlaceholder}>
              <Text style={styles.logoPlaceholderText}>🚜</Text>
            </View>
          )}

          <Text style={styles.farmName}>{getFarmerName(item)}</Text>
          <Text style={styles.farmLocation}>{getFarmerLocation(item)}</Text>

          <View style={styles.ratingBox}>
            <Text style={styles.ratingText}>
              ⭐ {Number(item.rating || 4.8).toFixed(1)}
            </Text>
          </View>

          <Text style={styles.distanceText}>
            {Number(item.distanceMiles || 5).toFixed(1)} mi away
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.visitFarmButton,
              pressed && styles.pressedButton,
            ]}
            onPress={() => openFarmerShop(item)}
          >
            <Text style={styles.visitFarmButtonText}>Visit Farm</Text>
          </Pressable>
        </Pressable>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.productsRow}
        >
          {(item.products || []).map((product) => renderProduct(item, product))}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <FlatList
        data={filteredFarmers}
        keyExtractor={(item) => item.id}
        renderItem={renderFarmerRow}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            <View style={styles.hero}>
              <Image
                source={require("../../assets/images/farm-marketplace-hero.png")}
                style={styles.heroImage}
              />

              <View style={styles.heroOverlay}>
                <Text style={styles.heroBadge}>🌾 Farm2Home</Text>
                <Text style={styles.heroTitle}>Shop Fresh Farm Goods</Text>
                <Text style={styles.heroSubtitle}>
                  Fresh produce, flowers, hay, feed, dairy, eggs, and local farm
                  products from trusted Farm2Home sellers.
                </Text>

                <Pressable
                  style={({ pressed }) => [
                    styles.heroCartButton,
                    pressed && styles.pressedButton,
                  ]}
                  onPress={() => router.push("/customer/cart" as any)}
                >
                  <Text style={styles.heroCartText}>View Cart ({cartCount})</Text>
                </Pressable>
              </View>
            </View>

            <TextInput
              style={styles.searchInput}
              placeholder="Search produce, flowers, hay, farm, or category"
              placeholderTextColor="#6B7280"
              value={searchText}
              onChangeText={setSearchText}
            />

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryRow}
            >
              {categories.map((category) => {
                const active = category === selectedCategory;

                return (
                  <Pressable
                    key={category}
                    style={[
                      styles.categoryChip,
                      active && styles.categoryChipActive,
                    ]}
                    onPress={() => setSelectedCategory(category)}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        active && styles.categoryChipTextActive,
                      ]}
                    >
                      {category}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>
              {loading ? "Loading marketplace..." : "No farmers found"}
            </Text>
            <Text style={styles.emptySubtitle}>
              Try another search or check back later.
            </Text>
          </View>
        }
      />

      <Pressable
        style={({ pressed }) => [
          styles.cartFloating,
          pressed && styles.pressedButton,
        ]}
        onPress={() => router.push("/customer/cart" as any)}
      >
        <Text style={styles.cartFloatingText}>Cart ({cartCount})</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F7F7F2",
  },
  listContent: {
    paddingBottom: 120,
  },
  hero: {
    height: 260,
    overflow: "hidden",
    position: "relative",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  heroOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    padding: 22,
  },
  heroBadge: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 18,
    marginBottom: 14,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 34,
  },
  heroSubtitle: {
    color: "#FFFFFF",
    marginTop: 10,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "800",
  },
  heroCartButton: {
    backgroundColor: "#2E7D32",
    borderWidth: 1,
    borderColor: "#FFFFFF",
    padding: 15,
    borderRadius: 15,
    alignItems: "center",
    marginTop: 18,
  },
  heroCartText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  searchInput: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 12,
    marginTop: 16,
    borderRadius: 18,
    padding: 18,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    fontWeight: "700",
  },
  categoryRow: {
    paddingHorizontal: 12,
    paddingVertical: 16,
    gap: 12,
  },
  categoryChip: {
    backgroundColor: "#DDE7DB",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
  },
  categoryChipActive: {
    backgroundColor: "#047857",
  },
  categoryChipText: {
    color: "#047857",
    fontWeight: "900",
    fontSize: 15,
  },
  categoryChipTextActive: {
    color: "#FFFFFF",
  },
  farmRow: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    marginHorizontal: 12,
    marginBottom: 18,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  leftFarmColumn: {
    width: 190,
    marginRight: 16,
  },
  farmLogo: {
    width: 88,
    height: 88,
    borderRadius: 22,
    marginBottom: 12,
  },
  logoPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 22,
    backgroundColor: "#DCFCE7",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  logoPlaceholderText: {
    fontSize: 38,
  },
  farmName: {
    fontSize: 20,
    fontWeight: "900",
    color: "#111827",
  },
  farmLocation: {
    color: "#6B7280",
    marginTop: 4,
    fontSize: 14,
    fontWeight: "700",
  },
  ratingBox: {
    backgroundColor: "#FEF3C7",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    marginTop: 10,
  },
  ratingText: {
    color: "#92400E",
    fontWeight: "900",
  },
  distanceText: {
    marginTop: 10,
    color: "#047857",
    fontWeight: "900",
  },
  visitFarmButton: {
    backgroundColor: "#14532D",
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
  },
  visitFarmButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 14,
  },
  productsRow: {
    gap: 16,
    paddingRight: 20,
  },
  productCard: {
    width: 220,
    backgroundColor: "#F9FAFB",
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  productImage: {
    width: "100%",
    height: 120,
    borderRadius: 18,
    marginBottom: 12,
  },
  productPlaceholder: {
    width: "100%",
    height: 120,
    borderRadius: 18,
    backgroundColor: "#DCFCE7",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  productEmoji: {
    fontSize: 46,
  },
  productName: {
    fontWeight: "900",
    fontSize: 17,
    color: "#111827",
  },
  productCategory: {
    color: "#6B7280",
    marginTop: 4,
    fontSize: 13,
    fontWeight: "700",
  },
  productPrice: {
    marginTop: 8,
    fontWeight: "900",
    fontSize: 20,
    color: "#047857",
  },
  addButton: {
    backgroundColor: "#047857",
    paddingVertical: 13,
    borderRadius: 15,
    marginTop: 12,
    alignItems: "center",
  },
  addButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 15,
  },
  pressedButton: {
    opacity: 0.75,
  },
  emptyBox: {
    backgroundColor: "#FFFFFF",
    margin: 12,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  emptyTitle: {
    fontWeight: "900",
    fontSize: 20,
    color: "#111827",
  },
  emptySubtitle: {
    marginTop: 10,
    color: "#6B7280",
    fontSize: 14,
    fontWeight: "700",
  },
  cartFloating: {
    position: "absolute",
    bottom: 20,
    right: 20,
    backgroundColor: "#0F172A",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 999,
  },
  cartFloatingText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },
});