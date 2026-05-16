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

type FarmProduct = {
  id: string;
  name: string;
  price: number;
};

type FavoriteFarm = {
  id: string;
  name: string;
  distance: string;
  rating: number;
  category: string;
  location: string;
  loyaltyPoints: number;
  products: FarmProduct[];
};

const farms: FavoriteFarm[] = [
  {
    id: "green-valley",
    name: "Green Valley Farm",
    distance: "4.2 mi",
    rating: 4.9,
    category: "Eggs & Dairy",
    location: "Sterling Heights, MI",
    loyaltyPoints: 420,
    products: [
      { id: "green-eggs", name: "Farm Fresh Eggs", price: 5.99 },
      { id: "green-milk", name: "Local Milk", price: 4.99 },
      { id: "green-yogurt", name: "Yogurt Cups", price: 8.99 },
    ],
  },
  {
    id: "sunrise-produce",
    name: "Sunrise Produce Farm",
    distance: "7.8 mi",
    rating: 4.8,
    category: "Fresh Produce",
    location: "Macomb County, MI",
    loyaltyPoints: 315,
    products: [
      { id: "sunrise-box", name: "Seasonal Vegetable Box", price: 21.99 },
      { id: "sunrise-tomatoes", name: "Fresh Tomatoes", price: 6.99 },
      { id: "sunrise-greens", name: "Greens Bundle", price: 7.99 },
    ],
  },
  {
    id: "oak-hill",
    name: "Oak Hill Farms",
    distance: "11.5 mi",
    rating: 4.7,
    category: "Meat & Poultry",
    location: "Washington Twp, MI",
    loyaltyPoints: 275,
    products: [
      { id: "oak-chicken", name: "Pasture Raised Chicken", price: 18.99 },
      { id: "oak-beef", name: "Ground Beef Pack", price: 12.99 },
      { id: "oak-family-meat", name: "Family Meat Bundle", price: 49.99 },
    ],
  },
];

export default function FarmFavorites() {
  const [selectedFarmId, setSelectedFarmId] = useState("green-valley");

  const selectedFarm = useMemo(() => {
    return farms.find((farm) => farm.id === selectedFarmId) || farms[0];
  }, [selectedFarmId]);

  async function reorderProduct(product: FarmProduct) {
    try {
      await addToCart({
        id: product.id,
        name: product.name,
        price: product.price,
        image: "",
        quantity: 1,
        farmName: selectedFarm.name,
      });

      Alert.alert("Added to Cart", `${product.name} added from ${selectedFarm.name}.`);
    } catch (error) {
      console.log("Favorite farm reorder error:", error);
      Alert.alert("Cart Error", "Unable to add product to cart.");
    }
  }

  async function reorderFarmFavorites() {
    try {
      for (const product of selectedFarm.products) {
        await addToCart({
          id: product.id,
          name: product.name,
          price: product.price,
          image: "",
          quantity: 1,
          farmName: selectedFarm.name,
        });
      }

      Alert.alert("Farm Favorites Added", `${selectedFarm.name} favorites added to cart.`);
    } catch (error) {
      console.log("Favorite farm bulk reorder error:", error);
      Alert.alert("Cart Error", "Unable to add farm favorites.");
    }
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Farm2Home Customer Loyalty</Text>
        <Text style={styles.title}>Favorite Farms</Text>
        <Text style={styles.subtitle}>
          Save your favorite farms, reorder trusted products, and build loyalty
          with nearby growers.
        </Text>
      </View>

      <View style={styles.selectedCard}>
        <Text style={styles.selectedBadge}>Selected Farm</Text>
        <Text style={styles.selectedTitle}>{selectedFarm.name}</Text>
        <Text style={styles.selectedMeta}>
          {selectedFarm.category} · {selectedFarm.distance} · ⭐ {selectedFarm.rating}
        </Text>
        <Text style={styles.selectedLocation}>{selectedFarm.location}</Text>

        <View style={styles.loyaltyBox}>
          <View>
            <Text style={styles.loyaltyLabel}>Farm Loyalty Points</Text>
            <Text style={styles.loyaltyNumber}>
              {selectedFarm.loyaltyPoints.toLocaleString()}
            </Text>
          </View>

          <TouchableOpacity style={styles.primaryButtonSmall} onPress={reorderFarmFavorites}>
            <Text style={styles.primaryButtonSmallText}>Reorder</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Favorite Farms</Text>

      {farms.map((farm) => {
        const active = selectedFarm.id === farm.id;

        return (
          <TouchableOpacity
            key={farm.id}
            style={[styles.farmCard, active && styles.farmCardActive]}
            onPress={() => setSelectedFarmId(farm.id)}
          >
            <View style={styles.farmAvatar}>
              <Text style={styles.farmAvatarText}>🌾</Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.farmName}>{farm.name}</Text>
              <Text style={styles.farmMeta}>
                {farm.category} · {farm.distance}
              </Text>
              <Text style={styles.farmRating}>⭐ {farm.rating} · {farm.location}</Text>
            </View>

            <Text style={styles.favoriteHeart}>♥</Text>
          </TouchableOpacity>
        );
      })}

      <Text style={styles.sectionTitle}>Top Products</Text>

      {selectedFarm.products.map((product) => (
        <View key={product.id} style={styles.productCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.productName}>{product.name}</Text>
            <Text style={styles.productFarm}>{selectedFarm.name}</Text>
            <Text style={styles.productPrice}>${product.price.toFixed(2)}</Text>
          </View>

          <TouchableOpacity
            style={styles.addButton}
            onPress={() => reorderProduct(product)}
          >
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        </View>
      ))}

      <View style={styles.aiCard}>
        <Text style={styles.aiTitle}>AI Farm Loyalty Engine</Text>
        <Text style={styles.aiText}>
          Later this can recommend farms based on distance, order history,
          favorite products, freshness, reviews, and recurring grocery needs.
        </Text>

        <Text style={styles.aiItem}>• Reorder from trusted farms</Text>
        <Text style={styles.aiItem}>• Recommend nearby growers</Text>
        <Text style={styles.aiItem}>• Build farm-level loyalty rewards</Text>
        <Text style={styles.aiItem}>• Match farms to meal plans</Text>
        <Text style={styles.aiItem}>• Promote seasonal farm specials</Text>
      </View>

      <View style={styles.navRow}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => router.push("/customer/marketplace")}
        >
          <Text style={styles.navButtonText}>Marketplace</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButtonOutline}
          onPress={() => router.push("/customer/cart")}
        >
          <Text style={styles.navButtonOutlineText}>Cart</Text>
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
    fontSize: 36,
    fontWeight: "900",
    marginBottom: 10,
  },

  subtitle: {
    color: "#E8F5E9",
    lineHeight: 23,
    fontWeight: "700",
  },

  selectedCard: {
    backgroundColor: "#FFFFFF",
    margin: 18,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    ...farmTheme.shadow,
  },

  selectedBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#FACC15",
    color: "#1F2937",
    fontWeight: "900",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: 10,
  },

  selectedTitle: {
    color: farmTheme.colors.text,
    fontSize: 26,
    fontWeight: "900",
  },

  selectedMeta: {
    color: farmTheme.colors.primary,
    fontWeight: "900",
    marginTop: 6,
  },

  selectedLocation: {
    color: farmTheme.colors.mutedText,
    fontWeight: "700",
    marginTop: 5,
  },

  loyaltyBox: {
    backgroundColor: "#F0FDF4",
    borderRadius: 18,
    padding: 15,
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  loyaltyLabel: {
    color: farmTheme.colors.text,
    fontWeight: "900",
  },

  loyaltyNumber: {
    color: farmTheme.colors.primary,
    fontSize: 26,
    fontWeight: "900",
    marginTop: 4,
  },

  primaryButtonSmall: {
    backgroundColor: farmTheme.colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
  },

  primaryButtonSmallText: {
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

  farmCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    marginBottom: 12,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },

  farmCardActive: {
    borderColor: farmTheme.colors.primary,
    borderWidth: 2,
    backgroundColor: "#F0FDF4",
  },

  farmAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: farmTheme.colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },

  farmAvatarText: {
    fontSize: 25,
  },

  farmName: {
    color: farmTheme.colors.text,
    fontSize: 18,
    fontWeight: "900",
  },

  farmMeta: {
    color: farmTheme.colors.mutedText,
    fontWeight: "700",
    marginTop: 4,
  },

  farmRating: {
    color: farmTheme.colors.primary,
    fontWeight: "800",
    marginTop: 4,
  },

  favoriteHeart: {
    color: "#DC2626",
    fontSize: 26,
    fontWeight: "900",
  },

  productCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    marginBottom: 12,
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    flexDirection: "row",
    alignItems: "center",
  },

  productName: {
    color: farmTheme.colors.text,
    fontSize: 18,
    fontWeight: "900",
  },

  productFarm: {
    color: farmTheme.colors.mutedText,
    fontWeight: "700",
    marginTop: 4,
  },

  productPrice: {
    color: farmTheme.colors.primary,
    fontWeight: "900",
    fontSize: 18,
    marginTop: 5,
  },

  addButton: {
    backgroundColor: farmTheme.colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 999,
  },

  addButtonText: {
    color: "#FFFFFF",
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
    marginBottom: 12,
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