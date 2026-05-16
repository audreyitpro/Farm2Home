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

type HouseholdSize = "1-2 People" | "3-4 People" | "5+ People";
type BundleType = "Family" | "Budget" | "Healthy" | "Kids" | "Premium";

type BundleItem = {
  id: string;
  name: string;
  farmName: string;
  price: number;
  quantity: number;
};

type GroceryBundle = {
  id: string;
  name: string;
  type: BundleType;
  badge: string;
  description: string;
  price: number;
  savings: number;
  items: BundleItem[];
  recommended?: boolean;
};

const bundles: GroceryBundle[] = [
  {
    id: "family-dinner-box",
    name: "Family Dinner Box",
    type: "Family",
    badge: "Most Popular",
    description: "A complete family grocery bundle for weekly dinners.",
    price: 74.99,
    savings: 12,
    recommended: true,
    items: [
      { id: "family-eggs", name: "Farm Fresh Eggs", farmName: "Green Valley Farm", price: 5.99, quantity: 1 },
      { id: "family-chicken", name: "Pasture Raised Chicken", farmName: "Oak Hill Farms", price: 18.99, quantity: 1 },
      { id: "family-vegetables", name: "Seasonal Vegetable Box", farmName: "Sunrise Produce Farm", price: 21.99, quantity: 1 },
      { id: "family-fruit", name: "Fresh Fruit Basket", farmName: "Berry Patch Farm", price: 16.99, quantity: 1 },
    ],
  },
  {
    id: "budget-staples-box",
    name: "Budget Staples Box",
    type: "Budget",
    badge: "Best Value",
    description: "Affordable farm staples for stretching weekly meals.",
    price: 39.99,
    savings: 8,
    items: [
      { id: "budget-potatoes", name: "Potato Bag", farmName: "Root Family Farm", price: 5.49, quantity: 1 },
      { id: "budget-eggs", name: "Farm Fresh Eggs", farmName: "Green Valley Farm", price: 5.99, quantity: 1 },
      { id: "budget-vegetables", name: "Budget Vegetable Box", farmName: "Sunrise Produce Farm", price: 13.99, quantity: 1 },
      { id: "budget-beef", name: "Ground Beef Pack", farmName: "Oak Hill Farms", price: 12.99, quantity: 1 },
    ],
  },
  {
    id: "healthy-clean-box",
    name: "Healthy Clean Eating Box",
    type: "Healthy",
    badge: "Healthy",
    description: "Lean protein, greens, fruit, and clean eating staples.",
    price: 59.99,
    savings: 10,
    items: [
      { id: "healthy-spinach", name: "Fresh Spinach", farmName: "Leafy Acres", price: 4.99, quantity: 1 },
      { id: "healthy-fish", name: "Fresh Local Fish", farmName: "Great Lakes Fresh", price: 22.99, quantity: 1 },
      { id: "healthy-berries", name: "Mixed Berry Pack", farmName: "Berry Patch Farm", price: 8.99, quantity: 1 },
      { id: "healthy-greens", name: "Fresh Greens Bundle", farmName: "Leafy Acres", price: 7.99, quantity: 1 },
    ],
  },
  {
    id: "kids-snack-box",
    name: "Kids Snack Box",
    type: "Kids",
    badge: "Kids",
    description: "Fresh snacks for lunchboxes, school, and after-school meals.",
    price: 34.99,
    savings: 6,
    items: [
      { id: "kids-apples", name: "Fresh Apples", farmName: "Berry Patch Farm", price: 6.99, quantity: 1 },
      { id: "kids-honey", name: "Local Raw Honey", farmName: "Golden Hive Farm", price: 9.99, quantity: 1 },
      { id: "kids-yogurt", name: "Local Yogurt Cups", farmName: "Morning Pasture Dairy", price: 8.99, quantity: 1 },
      { id: "kids-carrots", name: "Fresh Carrots", farmName: "Root Family Farm", price: 4.49, quantity: 1 },
    ],
  },
  {
    id: "premium-harvest-box",
    name: "Premium Harvest Bundle",
    type: "Premium",
    badge: "Premium",
    description: "Premium farm goods, produce, protein, and seasonal specialties.",
    price: 99.99,
    savings: 18,
    items: [
      { id: "premium-produce", name: "Premium Produce Box", farmName: "Sunrise Produce Farm", price: 24.99, quantity: 1 },
      { id: "premium-chicken", name: "Pasture Raised Chicken", farmName: "Oak Hill Farms", price: 18.99, quantity: 1 },
      { id: "premium-eggs", name: "Farm Fresh Eggs", farmName: "Green Valley Farm", price: 5.99, quantity: 1 },
      { id: "premium-honey", name: "Local Raw Honey", farmName: "Golden Hive Farm", price: 9.99, quantity: 1 },
    ],
  },
];

export default function FamilyGroceryBundles() {
  const [householdSize, setHouseholdSize] = useState<HouseholdSize>("3-4 People");
  const [selectedType, setSelectedType] = useState<BundleType>("Family");
  const [selectedBundleId, setSelectedBundleId] = useState("family-dinner-box");

  const householdSizes: HouseholdSize[] = ["1-2 People", "3-4 People", "5+ People"];
  const bundleTypes: BundleType[] = ["Family", "Budget", "Healthy", "Kids", "Premium"];

  const filteredBundles = useMemo(() => {
    return bundles.filter((bundle) => bundle.type === selectedType);
  }, [selectedType]);

  const selectedBundle = useMemo(() => {
    return (
      bundles.find((bundle) => bundle.id === selectedBundleId) ||
      filteredBundles[0] ||
      bundles[0]
    );
  }, [selectedBundleId, filteredBundles]);

  const adjustedPrice = useMemo(() => {
    if (householdSize === "1-2 People") return selectedBundle.price * 0.75;
    if (householdSize === "5+ People") return selectedBundle.price * 1.35;
    return selectedBundle.price;
  }, [householdSize, selectedBundle]);

  function selectType(type: BundleType) {
    setSelectedType(type);

    const firstBundle = bundles.find((bundle) => bundle.type === type);
    if (firstBundle) {
      setSelectedBundleId(firstBundle.id);
    }
  }

  async function addBundleToCart() {
    try {
      for (const item of selectedBundle.items) {
        await addToCart({
          id: item.id,
          name: item.name,
          price: item.price,
          image: "",
          quantity:
            householdSize === "5+ People"
              ? item.quantity + 1
              : item.quantity,
          farmName: item.farmName,
        });
      }

      Alert.alert(
        "Bundle Added",
        `${selectedBundle.name} was added to your cart.`
      );
    } catch (error) {
      console.log("Bundle add error:", error);
      Alert.alert("Cart Error", "Unable to add this bundle to cart.");
    }
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Farm2Home Bundles</Text>
        <Text style={styles.title}>Family Grocery Bundles</Text>
        <Text style={styles.subtitle}>
          Choose ready-made grocery bundles for families, kids, budgets,
          healthy meals, and premium farm boxes.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Household Size</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
        {householdSizes.map((size) => (
          <TouchableOpacity
            key={size}
            style={[styles.chip, householdSize === size && styles.chipActive]}
            onPress={() => setHouseholdSize(size)}
          >
            <Text style={[styles.chipText, householdSize === size && styles.chipTextActive]}>
              {size}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.sectionTitle}>Bundle Type</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
        {bundleTypes.map((type) => (
          <TouchableOpacity
            key={type}
            style={[styles.chip, selectedType === type && styles.chipActive]}
            onPress={() => selectType(type)}
          >
            <Text style={[styles.chipText, selectedType === type && styles.chipTextActive]}>
              {type}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.selectedCard}>
        <Text style={styles.selectedBadge}>{selectedBundle.badge}</Text>
        <Text style={styles.selectedTitle}>{selectedBundle.name}</Text>
        <Text style={styles.selectedDescription}>{selectedBundle.description}</Text>

        <View style={styles.totalRow}>
          <View>
            <Text style={styles.totalLabel}>Adjusted Bundle Price</Text>
            <Text style={styles.savingsText}>Save ${selectedBundle.savings}</Text>
          </View>

          <Text style={styles.totalPrice}>${adjustedPrice.toFixed(2)}</Text>
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={addBundleToCart}>
          <Text style={styles.primaryText}>Add Bundle to Cart</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.outlineButton}
          onPress={() => router.push("/customer/cart")}
        >
          <Text style={styles.outlineText}>Go to Cart</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Bundle Includes</Text>

      {selectedBundle.items.map((item) => (
        <View key={item.id} style={styles.itemCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.itemFarm}>{item.farmName}</Text>
            <Text style={styles.itemQty}>
              Qty {householdSize === "5+ People" ? item.quantity + 1 : item.quantity}
            </Text>
          </View>

          <Text style={styles.itemPrice}>${item.price.toFixed(2)}</Text>
        </View>
      ))}

      <Text style={styles.sectionTitle}>All Bundles</Text>

      {bundles.map((bundle) => {
        const active = selectedBundle.id === bundle.id;

        return (
          <TouchableOpacity
            key={bundle.id}
            style={[styles.bundleCard, active && styles.bundleCardActive]}
            onPress={() => {
              setSelectedType(bundle.type);
              setSelectedBundleId(bundle.id);
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.bundleType}>{bundle.type}</Text>
              <Text style={styles.bundleName}>{bundle.name}</Text>
              <Text style={styles.bundleDescription}>{bundle.description}</Text>
            </View>

            <View style={styles.bundlePriceBlock}>
              <Text style={styles.bundlePrice}>${bundle.price.toFixed(2)}</Text>
              <Text style={styles.bundleSavings}>Save ${bundle.savings}</Text>
            </View>
          </TouchableOpacity>
        );
      })}

      <View style={styles.aiCard}>
        <Text style={styles.aiTitle}>AI Bundle Intelligence</Text>
        <Text style={styles.aiText}>
          Later this can connect bundle recommendations to household size,
          nutrition goals, purchase history, budget limits, and nearby farm
          inventory.
        </Text>

        <Text style={styles.aiItem}>• Recommend bundles by family size</Text>
        <Text style={styles.aiItem}>• Match bundles to meal plans</Text>
        <Text style={styles.aiItem}>• Create budget grocery packs</Text>
        <Text style={styles.aiItem}>• Build kid-friendly snack plans</Text>
        <Text style={styles.aiItem}>• Optimize grocery savings</Text>
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

  sectionTitle: {
    color: farmTheme.colors.text,
    fontSize: 23,
    fontWeight: "900",
    paddingHorizontal: 18,
    marginTop: 18,
    marginBottom: 12,
  },

  chipRow: {
    paddingLeft: 18,
    marginBottom: 4,
  },

  chip: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 999,
    marginRight: 10,
  },

  chipActive: {
    backgroundColor: farmTheme.colors.primary,
    borderColor: farmTheme.colors.primary,
  },

  chipText: {
    color: farmTheme.colors.text,
    fontWeight: "900",
  },

  chipTextActive: {
    color: "#FFFFFF",
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
    fontSize: 25,
    fontWeight: "900",
    marginBottom: 8,
  },

  selectedDescription: {
    color: farmTheme.colors.mutedText,
    lineHeight: 22,
    fontWeight: "700",
  },

  totalRow: {
    backgroundColor: "#F0FDF4",
    borderRadius: 18,
    padding: 15,
    marginTop: 14,
    marginBottom: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  totalLabel: {
    color: farmTheme.colors.text,
    fontWeight: "900",
  },

  savingsText: {
    color: farmTheme.colors.primary,
    fontWeight: "900",
    marginTop: 4,
  },

  totalPrice: {
    color: farmTheme.colors.primary,
    fontSize: 24,
    fontWeight: "900",
  },

  primaryButton: {
    backgroundColor: farmTheme.colors.primary,
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 10,
  },

  primaryText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  outlineButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: farmTheme.colors.primary,
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
  },

  outlineText: {
    color: farmTheme.colors.primary,
    fontWeight: "900",
  },

  itemCard: {
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

  itemName: {
    color: farmTheme.colors.text,
    fontSize: 18,
    fontWeight: "900",
  },

  itemFarm: {
    color: farmTheme.colors.mutedText,
    fontWeight: "700",
    marginTop: 4,
  },

  itemQty: {
    color: farmTheme.colors.primary,
    fontWeight: "900",
    marginTop: 5,
  },

  itemPrice: {
    color: farmTheme.colors.primary,
    fontSize: 18,
    fontWeight: "900",
  },

  bundleCard: {
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

  bundleCardActive: {
    borderColor: farmTheme.colors.primary,
    borderWidth: 2,
    backgroundColor: "#F0FDF4",
  },

  bundleType: {
    color: farmTheme.colors.primary,
    fontWeight: "900",
    marginBottom: 4,
  },

  bundleName: {
    color: farmTheme.colors.text,
    fontSize: 18,
    fontWeight: "900",
  },

  bundleDescription: {
    color: farmTheme.colors.mutedText,
    lineHeight: 20,
    fontWeight: "700",
    marginTop: 4,
  },

  bundlePriceBlock: {
    alignItems: "flex-end",
    justifyContent: "center",
  },

  bundlePrice: {
    color: farmTheme.colors.primary,
    fontSize: 18,
    fontWeight: "900",
  },

  bundleSavings: {
    color: farmTheme.colors.mutedText,
    fontWeight: "800",
    marginTop: 4,
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
});