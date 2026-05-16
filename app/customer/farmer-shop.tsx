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
        name: product.name,
        quantity: 1,
        price: Number(product.price || 0),
        image: product.image || product.imageUrl,
        farmName: farmer.farmName || farmer.name || "Farm2Home Farm",
        farmerId: farmer.id,
        farmerStripeAccountId,
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
        <Text style={styles.loadingText}>Loading farmer storefront...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        {farmer.logoUrl ? (
          <Image source={{ uri: farmer.logoUrl }} style={styles.logo} />
        ) : (
          <View style={styles.logoPlaceholder}>
            <Text style={styles.logoEmoji}>🚜</Text>
          </View>
        )}

        <Text style={styles.farmName}>{farmer.farmName || farmer.name}</Text>

        <Text style={styles.location}>
          {farmer.location || farmer.farmLocation}
        </Text>

        <Text style={styles.rating}>
          ⭐ {Number(farmer.rating || 4.8).toFixed(1)} ·{" "}
          {Number(farmer.distanceMiles || 5).toFixed(1)} mi away
        </Text>

        <Pressable
          style={styles.cartButton}
          onPress={() => router.push("/customer/cart" as any)}
        >
          <Text style={styles.cartButtonText}>View Cart ({cartCount})</Text>
        </Pressable>
      </View>

      {Object.entries(groupedProducts).map(([category, products]) => (
        <View key={category}>
          <Text style={styles.categoryTitle}>{category}</Text>

          {products.map((product) => (
            <View key={product.id} style={styles.productCard}>
              {product.image || product.imageUrl ? (
                <Image
                  source={{ uri: product.image || product.imageUrl }}
                  style={styles.productImage}
                />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Text style={styles.imageEmoji}>🥬</Text>
                </View>
              )}

              <View style={{ flex: 1 }}>
                <Text style={styles.productName}>{product.name}</Text>

                <Text style={styles.productDescription}>
                  {product.description || "Fresh farm product"}
                </Text>

                <Text style={styles.price}>
                  ${Number(product.price || 0).toFixed(2)}
                  {product.unit ? ` / ${product.unit}` : ""}
                </Text>

                <Pressable
                  style={({ pressed }) => [
                    styles.addButton,
                    pressed && styles.pressedButton,
                  ]}
                  onPress={() => handleAddToCart(product)}
                >
                  <Text style={styles.addButtonText}>Add To Cart</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      ))}

      <View style={styles.bottomActions}>
        <Pressable
          style={styles.goCartButton}
          onPress={() => router.push("/customer/cart" as any)}
        >
          <Text style={styles.goCartButtonText}>Go To Cart ({cartCount})</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F0",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#14532D",
  },
  hero: {
    backgroundColor: "#14532D",
    paddingTop: 70,
    paddingBottom: 32,
    alignItems: "center",
    paddingHorizontal: 20,
  },
  logo: {
    width: 120,
    height: 120,
    borderRadius: 30,
    marginBottom: 16,
  },
  logoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 30,
    backgroundColor: "#DCFCE7",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  logoEmoji: {
    fontSize: 52,
  },
  farmName: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900",
    textAlign: "center",
  },
  location: {
    color: "#D1FAE5",
    marginTop: 8,
    fontSize: 16,
    fontWeight: "700",
  },
  rating: {
    color: "#FEF3C7",
    marginTop: 10,
    fontSize: 16,
    fontWeight: "900",
  },
  cartButton: {
    marginTop: 20,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 26,
    paddingVertical: 14,
    borderRadius: 999,
  },
  cartButtonText: {
    color: "#14532D",
    fontWeight: "900",
    fontSize: 15,
  },
  categoryTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: "#111827",
    marginHorizontal: 18,
    marginTop: 28,
    marginBottom: 16,
  },
  productCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    marginBottom: 16,
    borderRadius: 24,
    padding: 16,
    flexDirection: "row",
  },
  productImage: {
    width: 120,
    height: 120,
    borderRadius: 20,
    marginRight: 16,
  },
  imagePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 20,
    backgroundColor: "#DCFCE7",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  imageEmoji: {
    fontSize: 44,
  },
  productName: {
    fontSize: 20,
    fontWeight: "900",
    color: "#111827",
  },
  productDescription: {
    marginTop: 8,
    color: "#6B7280",
    fontWeight: "700",
    lineHeight: 22,
  },
  price: {
    marginTop: 10,
    fontSize: 24,
    fontWeight: "900",
    color: "#047857",
  },
  addButton: {
    backgroundColor: "#047857",
    marginTop: 14,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  addButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  pressedButton: {
    opacity: 0.75,
  },
  bottomActions: {
    padding: 18,
    paddingBottom: 120,
  },
  goCartButton: {
    backgroundColor: "#14532D",
    paddingVertical: 18,
    borderRadius: 18,
    alignItems: "center",
  },
  goCartButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },
});