import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";

import { addToCart, getCartItemCount } from "../data/cartStore";
import { getApprovedFarmers } from "../data/farmerStore";

const GREEN_VALLEY_STRIPE_ACCOUNT_ID = "acct_1TWeOKCqJp7Z8L15";
const SUNNYBROOK_STRIPE_ACCOUNT_ID = "acct_1TWjGSE1SmOAMwkt";

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

type Product = {
  id: string;
  name: string;
  category?: string;
  price?: number;
  unit?: string;
  image?: string;
  imageUrl?: string;
  description?: string;
  farmerStripeAccountId?: string;
};

type Farmer = {
  id: string;
  farmName?: string;
  name?: string;
  location?: string;
  farmLocation?: string;
  logoUrl?: string;
  rating?: number;
  distanceMiles?: number;
  stripeAccountId?: string;
  products?: Product[];
};

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
          category: "Fruit",
          price: 4.99,
          unit: "bag",
          description: "Fresh organic apples",
        },
        {
          id: "honey_1",
          name: "Raw Honey",
          category: "Honey",
          price: 9.99,
          unit: "jar",
          description: "Pure Michigan honey",
        },
        {
          id: "corn_1",
          name: "Sweet Corn",
          category: "Vegetables",
          price: 3.5,
          unit: "dozen",
          description: "Fresh picked sweet corn",
        },
        {
          id: "hay_1",
          name: "Bale of Hay",
          category: "Farm Supplies",
          price: 12,
          unit: "bale",
          description: "Premium hay bale",
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
          description: "Cage-free farm eggs",
        },
        {
          id: "milk_1",
          name: "Fresh Milk",
          category: "Dairy",
          price: 6.5,
          unit: "gallon",
          description: "Fresh dairy milk",
        },
        {
          id: "chicken_1",
          name: "Whole Farm Chicken",
          category: "Poultry",
          price: 18.99,
          unit: "each",
          description: "Farm-raised chicken",
        },
      ],
    },
  ];
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

export default function FarmerShopScreen() {
  const params = useLocalSearchParams();
  const farmerId = String(params.farmerId || "");

  const [farmer, setFarmer] = useState<Farmer | null>(null);
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    loadFarmer();
    refreshCartCount();
  }, [farmerId]);

  async function refreshCartCount() {
    const count = await getCartItemCount();
    setCartCount(count);
  }

  async function loadFarmer() {
    try {
      const approvedFarmers = (await getApprovedFarmers()) || [];
      const storedFarmersRaw = await AsyncStorage.getItem("farm2homeFarmers");
      const storedFarmers = storedFarmersRaw ? JSON.parse(storedFarmersRaw) : [];

      const allFarmers = [...approvedFarmers, ...storedFarmers];
      const farmersToUse =
        allFarmers.length > 0 ? allFarmers : getFallbackFarmers();

      const selectedFarmer =
        farmersToUse.find((item: Farmer) => item.id === farmerId) ||
        getFallbackFarmers().find((item) => item.id === farmerId);

      setFarmer(selectedFarmer || null);
    } catch (error) {
      console.log("Load farmer shop error:", error);

      const fallbackFarmer = getFallbackFarmers().find(
        (item) => item.id === farmerId
      );

      setFarmer(fallbackFarmer || null);
    }
  }

  const groupedProducts = useMemo(() => {
    if (!farmer?.products) return {};

    return farmer.products.reduce((acc: Record<string, Product[]>, product) => {
      const category = product.category || "Farm Goods";

      if (!acc[category]) acc[category] = [];

      acc[category].push(product);

      return acc;
    }, {});
  }, [farmer]);

  const productCount = farmer?.products?.length || 0;

  async function handleAddToCart(product: Product) {
    try {
      if (!farmer) return;

      const farmerStripeAccountId =
        product.farmerStripeAccountId || farmer.stripeAccountId || "";

      if (!farmerStripeAccountId) {
        Alert.alert("Missing Payout Account", "This farm needs a Stripe account.");
        return;
      }

      await addToCart({
        id: `${farmer.id}_${product.id}`,
        productId: product.id,
        name: product.name,
        quantity: 1,
        price: Number(product.price || 0),
        image: product.image || product.imageUrl,
        farmName: farmer.farmName || farmer.name || "Farm2Home Farm",
        farmerId: farmer.id,
        farmerStripeAccountId,
        unit: product.unit || "each",
      } as any);

      await refreshCartCount();

      Alert.alert("Added To Cart", `${product.name} was added to your cart.`);
    } catch (error) {
      console.log("Farmer shop add to cart error:", error);
      Alert.alert("Error", "Unable to add item to cart.");
    }
  }

  if (!farmer) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingIcon}>🚜</Text>
        <Text style={styles.loadingText}>Loading farmer storefront...</Text>
      </View>
    );
  }

  const farmName = farmer.farmName || farmer.name || "Farm2Home Farm";
  const farmLocation = farmer.location || farmer.farmLocation || "Michigan";

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
            <Text style={styles.title}>Farm Store</Text>
            <Text style={styles.subtitle}>Shop directly from this farmer</Text>
          </View>

          <Pressable
            style={({ pressed }) => [styles.cartTopButton, pressed && styles.pressed]}
            onPress={() => router.push("/customer/cart" as any)}
          >
            <Text style={styles.cartTopText}>🛒</Text>
            {cartCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartCount}</Text>
              </View>
            )}
          </Pressable>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.logoWrap}>
            {farmer.logoUrl ? (
              <Image source={{ uri: farmer.logoUrl }} style={styles.logo} />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Text style={styles.logoEmoji}>🚜</Text>
              </View>
            )}
          </View>

          <View style={styles.heroContent}>
            <Text style={styles.heroBadge}>Verified Farm</Text>
            <Text style={styles.farmName}>{farmName}</Text>
            <Text style={styles.location}>{farmLocation}</Text>

            <View style={styles.metaRow}>
              <View style={styles.metaPill}>
                <Text style={styles.metaPillText}>
                  ⭐ {Number(farmer.rating || 4.8).toFixed(1)}
                </Text>
              </View>

              <View style={styles.metaPill}>
                <Text style={styles.metaPillText}>
                  {Number(farmer.distanceMiles || 5).toFixed(1)} mi
                </Text>
              </View>

              <View style={styles.metaPill}>
                <Text style={styles.metaPillText}>{productCount} items</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.storeInfoCard}>
          <Text style={styles.storeInfoTitle}>Fresh from {farmName}</Text>
          <Text style={styles.storeInfoText}>
            Browse locally sourced farm goods, seasonal products, and fresh
            items available from this Farm2Home seller.
          </Text>

          <Pressable
            style={({ pressed }) => [styles.viewCartButton, pressed && styles.pressed]}
            onPress={() => router.push("/customer/cart" as any)}
          >
            <Text style={styles.viewCartButtonText}>View Cart ({cartCount})</Text>
          </Pressable>
        </View>

        {Object.entries(groupedProducts).map(([category, products]) => (
          <View key={category} style={styles.categorySection}>
            <View style={styles.categoryHeader}>
              <Text style={styles.categoryTitle}>{category}</Text>
              <Text style={styles.categoryCount}>
                {products.length} item{products.length === 1 ? "" : "s"}
              </Text>
            </View>

            {products.map((product) => {
              const imageSource = product.image || product.imageUrl || "";

              return (
                <View key={product.id} style={styles.productCard}>
                  {imageSource ? (
                    <Image
                      source={{ uri: imageSource }}
                      style={styles.productImage}
                    />
                  ) : (
                    <View style={styles.imagePlaceholder}>
                      <Text style={styles.imageEmoji}>
                        {getProductEmoji(product)}
                      </Text>
                    </View>
                  )}

                  <View style={styles.productInfo}>
                    <Text style={styles.productCategory}>
                      {product.category || "Farm Goods"}
                    </Text>

                    <Text style={styles.productName} numberOfLines={2}>
                      {product.name}
                    </Text>

                    <Text style={styles.productDescription} numberOfLines={2}>
                      {product.description || "Fresh farm product"}
                    </Text>

                    <View style={styles.priceRow}>
                      <View>
                        <Text style={styles.price}>
                          ${Number(product.price || 0).toFixed(2)}
                        </Text>
                        <Text style={styles.unit}>
                          {product.unit ? `per ${product.unit}` : "each"}
                        </Text>
                      </View>

                      <Pressable
                        style={({ pressed }) => [
                          styles.addCircleButton,
                          pressed && styles.pressed,
                        ]}
                        onPress={() => handleAddToCart(product)}
                      >
                        <Text style={styles.addCircleText}>+</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        ))}

        <Pressable
          style={({ pressed }) => [styles.goCartButton, pressed && styles.pressed]}
          onPress={() => router.push("/customer/cart" as any)}
        >
          <Text style={styles.goCartButtonText}>Go To Cart ({cartCount})</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 110,
  },
  center: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingIcon: {
    fontSize: 52,
    marginBottom: 10,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.primary,
    textAlign: "center",
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
  cartTopButton: {
    width: 50,
    height: 50,
    borderRadius: 17,
    backgroundColor: COLORS.card,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cartTopText: {
    fontSize: 22,
  },
  cartBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: COLORS.secondary,
    minWidth: 24,
    height: 24,
    borderRadius: 999,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: COLORS.card,
  },
  cartBadgeText: {
    color: COLORS.dark,
    fontWeight: "900",
    fontSize: 12,
  },
  heroCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 32,
    padding: 18,
    marginBottom: 16,
  },
  logoWrap: {
    alignSelf: "center",
    marginBottom: 14,
  },
  logo: {
    width: 112,
    height: 112,
    borderRadius: 32,
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.28)",
  },
  logoPlaceholder: {
    width: 112,
    height: 112,
    borderRadius: 32,
    backgroundColor: COLORS.secondary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.28)",
  },
  logoEmoji: {
    fontSize: 50,
  },
  heroContent: {
    alignItems: "center",
  },
  heroBadge: {
    alignSelf: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    color: "#FFFFFF",
    fontWeight: "900",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: 10,
  },
  farmName: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "900",
    textAlign: "center",
  },
  location: {
    color: "#EAF7E6",
    marginTop: 7,
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 9,
    marginTop: 14,
  },
  metaPill: {
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  metaPillText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 12,
  },
  storeInfoCard: {
    backgroundColor: COLORS.card,
    borderRadius: 28,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  storeInfoTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "900",
  },
  storeInfoText: {
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 22,
    marginTop: 8,
  },
  viewCartButton: {
    backgroundColor: COLORS.primary,
    padding: 15,
    borderRadius: 18,
    alignItems: "center",
    marginTop: 14,
  },
  viewCartButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  categorySection: {
    marginTop: 8,
  },
  categoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 12,
  },
  categoryTitle: {
    fontSize: 23,
    fontWeight: "900",
    color: COLORS.text,
  },
  categoryCount: {
    color: COLORS.muted,
    fontWeight: "800",
    fontSize: 13,
  },
  productCard: {
    backgroundColor: COLORS.card,
    marginBottom: 14,
    borderRadius: 28,
    padding: 13,
    flexDirection: "row",
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    gap: 12,
  },
  productImage: {
    width: 112,
    height: 126,
    borderRadius: 22,
    backgroundColor: COLORS.softGreen,
  },
  imagePlaceholder: {
    width: 112,
    height: 126,
    borderRadius: 22,
    backgroundColor: COLORS.softGreen,
    justifyContent: "center",
    alignItems: "center",
  },
  imageEmoji: {
    fontSize: 44,
  },
  productInfo: {
    flex: 1,
  },
  productCategory: {
    color: COLORS.primary,
    fontWeight: "900",
    fontSize: 11,
    marginBottom: 4,
  },
  productName: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.text,
  },
  productDescription: {
    marginTop: 6,
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 19,
    fontSize: 12,
  },
  priceRow: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  price: {
    fontSize: 21,
    fontWeight: "900",
    color: COLORS.primary,
  },
  unit: {
    color: COLORS.muted,
    fontWeight: "700",
    fontSize: 11,
    marginTop: 2,
  },
  addCircleButton: {
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  addCircleText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 26,
    marginTop: -2,
  },
  goCartButton: {
    backgroundColor: COLORS.dark,
    paddingVertical: 17,
    borderRadius: 20,
    alignItems: "center",
    marginTop: 8,
  },
  goCartButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },
  pressed: {
    opacity: 0.75,
  },
});