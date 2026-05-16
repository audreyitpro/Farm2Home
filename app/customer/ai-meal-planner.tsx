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

type MealPlanType = "Family" | "Healthy" | "Budget" | "Quick" | "Seasonal";

type GroceryItem = {
  id: string;
  name: string;
  category: string;
  price: number;
  farmName: string;
  quantity: number;
};

type MealPlan = {
  id: string;
  title: string;
  type: MealPlanType;
  description: string;
  meals: string[];
  groceryList: GroceryItem[];
  estimatedTotal: number;
};

const mealPlans: MealPlan[] = [
  {
    id: "family-harvest-week",
    title: "Family Harvest Week",
    type: "Family",
    description:
      "Balanced weekly meals using fresh produce, dairy, eggs, meat, and local farm goods.",
    meals: [
      "Farm egg breakfast bowls",
      "Chicken and roasted vegetable dinner",
      "Fresh fruit snack boxes",
      "Ground beef taco night",
      "Honey yogurt breakfast cups",
    ],
    groceryList: [
      {
        id: "eggs-family",
        name: "Farm Fresh Eggs",
        category: "Dairy & Eggs",
        price: 5.99,
        farmName: "Green Valley Farm",
        quantity: 1,
      },
      {
        id: "chicken-family",
        name: "Pasture Raised Chicken",
        category: "Meat",
        price: 18.99,
        farmName: "Oak Hill Farms",
        quantity: 1,
      },
      {
        id: "vegetables-family",
        name: "Seasonal Vegetable Box",
        category: "Vegetables",
        price: 21.99,
        farmName: "Sunrise Produce Farm",
        quantity: 1,
      },
      {
        id: "fruit-family",
        name: "Fresh Fruit Basket",
        category: "Fruit",
        price: 16.99,
        farmName: "Berry Patch Farm",
        quantity: 1,
      },
      {
        id: "honey-family",
        name: "Local Raw Honey",
        category: "Pantry",
        price: 9.99,
        farmName: "Golden Hive Farm",
        quantity: 1,
      },
    ],
    estimatedTotal: 73.95,
  },
  {
    id: "healthy-clean-eats",
    title: "Healthy Clean Eats",
    type: "Healthy",
    description:
      "Fresh vegetables, lean protein, fruit, and simple meals focused on nutrition.",
    meals: [
      "Spinach and egg breakfast plate",
      "Grilled chicken salad bowls",
      "Berry yogurt snack cups",
      "Roasted fish and greens",
      "Vegetable soup prep",
    ],
    groceryList: [
      {
        id: "spinach-healthy",
        name: "Fresh Spinach",
        category: "Vegetables",
        price: 4.99,
        farmName: "Leafy Acres",
        quantity: 1,
      },
      {
        id: "eggs-healthy",
        name: "Farm Fresh Eggs",
        category: "Dairy & Eggs",
        price: 5.99,
        farmName: "Green Valley Farm",
        quantity: 1,
      },
      {
        id: "fish-healthy",
        name: "Fresh Local Fish",
        category: "Seafood",
        price: 22.99,
        farmName: "Great Lakes Fresh",
        quantity: 1,
      },
      {
        id: "berries-healthy",
        name: "Mixed Berry Pack",
        category: "Fruit",
        price: 8.99,
        farmName: "Berry Patch Farm",
        quantity: 1,
      },
      {
        id: "greens-healthy",
        name: "Fresh Greens Bundle",
        category: "Vegetables",
        price: 7.99,
        farmName: "Leafy Acres",
        quantity: 1,
      },
    ],
    estimatedTotal: 50.95,
  },
  {
    id: "budget-market-box",
    title: "Budget Market Box",
    type: "Budget",
    description:
      "Affordable weekly staples designed to stretch meals while still using local food.",
    meals: [
      "Egg and potato breakfast skillet",
      "Vegetable rice bowls",
      "Chicken soup leftovers",
      "Fruit and honey snack plates",
      "Simple ground beef pasta night",
    ],
    groceryList: [
      {
        id: "potatoes-budget",
        name: "Potato Bag",
        category: "Vegetables",
        price: 5.49,
        farmName: "Root Family Farm",
        quantity: 1,
      },
      {
        id: "eggs-budget",
        name: "Farm Fresh Eggs",
        category: "Dairy & Eggs",
        price: 5.99,
        farmName: "Green Valley Farm",
        quantity: 1,
      },
      {
        id: "vegetables-budget",
        name: "Budget Vegetable Box",
        category: "Vegetables",
        price: 13.99,
        farmName: "Sunrise Produce Farm",
        quantity: 1,
      },
      {
        id: "ground-beef-budget",
        name: "Ground Beef Pack",
        category: "Meat",
        price: 12.99,
        farmName: "Oak Hill Farms",
        quantity: 1,
      },
    ],
    estimatedTotal: 38.46,
  },
  {
    id: "quick-weeknight",
    title: "Quick Weeknight Meals",
    type: "Quick",
    description:
      "Fast meal ideas for busy families using ready-to-cook farm ingredients.",
    meals: [
      "Egg wraps",
      "Chicken veggie skillet",
      "Fresh salad bowls",
      "Fish tacos",
      "Fruit breakfast cups",
    ],
    groceryList: [
      {
        id: "wrap-eggs",
        name: "Farm Fresh Eggs",
        category: "Dairy & Eggs",
        price: 5.99,
        farmName: "Green Valley Farm",
        quantity: 1,
      },
      {
        id: "quick-chicken",
        name: "Chicken Breast Pack",
        category: "Meat",
        price: 16.99,
        farmName: "Oak Hill Farms",
        quantity: 1,
      },
      {
        id: "salad-quick",
        name: "Salad Greens Kit",
        category: "Vegetables",
        price: 9.99,
        farmName: "Leafy Acres",
        quantity: 1,
      },
      {
        id: "fish-quick",
        name: "Fresh Local Fish",
        category: "Seafood",
        price: 22.99,
        farmName: "Great Lakes Fresh",
        quantity: 1,
      },
    ],
    estimatedTotal: 55.96,
  },
  {
    id: "seasonal-produce",
    title: "Seasonal Produce Optimizer",
    type: "Seasonal",
    description:
      "A seasonal plan focused on in-season local produce and farm specials.",
    meals: [
      "Seasonal vegetable roast",
      "Fruit breakfast bowls",
      "Fresh greens lunch plates",
      "Honey glazed carrots",
      "Farm market soup night",
    ],
    groceryList: [
      {
        id: "seasonal-box",
        name: "Seasonal Produce Box",
        category: "Vegetables",
        price: 24.99,
        farmName: "Sunrise Produce Farm",
        quantity: 1,
      },
      {
        id: "fruit-seasonal",
        name: "Seasonal Fruit Bundle",
        category: "Fruit",
        price: 14.99,
        farmName: "Berry Patch Farm",
        quantity: 1,
      },
      {
        id: "carrots-seasonal",
        name: "Fresh Carrots",
        category: "Vegetables",
        price: 4.49,
        farmName: "Root Family Farm",
        quantity: 1,
      },
      {
        id: "honey-seasonal",
        name: "Local Raw Honey",
        category: "Pantry",
        price: 9.99,
        farmName: "Golden Hive Farm",
        quantity: 1,
      },
    ],
    estimatedTotal: 54.46,
  },
];

export default function AiMealPlanner() {
  const [selectedType, setSelectedType] = useState<MealPlanType>("Family");
  const [selectedPlanId, setSelectedPlanId] = useState("family-harvest-week");

  const planTypes: MealPlanType[] = [
    "Family",
    "Healthy",
    "Budget",
    "Quick",
    "Seasonal",
  ];

  const filteredPlans = useMemo(() => {
    return mealPlans.filter((plan) => plan.type === selectedType);
  }, [selectedType]);

  const selectedPlan = useMemo(() => {
    return (
      mealPlans.find((plan) => plan.id === selectedPlanId) ||
      filteredPlans[0] ||
      mealPlans[0]
    );
  }, [selectedPlanId, filteredPlans]);

  function selectType(type: MealPlanType) {
    setSelectedType(type);

    const firstPlan = mealPlans.find((plan) => plan.type === type);

    if (firstPlan) {
      setSelectedPlanId(firstPlan.id);
    }
  }

  function getEstimatedTotal() {
    return selectedPlan.groceryList.reduce((sum, item) => {
      return sum + item.price * item.quantity;
    }, 0);
  }

  async function addSingleItemToCart(item: GroceryItem) {
    try {
      await addToCart({
        id: item.id,
        name: item.name,
        price: item.price,
        image: "",
        quantity: item.quantity,
        farmName: item.farmName,
      });

      Alert.alert("Added", `${item.name} added to cart.`);
    } catch (error) {
      console.log("AI meal planner single add error:", error);
      Alert.alert("Cart Error", "Unable to add this item to cart.");
    }
  }

  async function addGroceryListToCart() {
    try {
      for (const item of selectedPlan.groceryList) {
        await addToCart({
          id: item.id,
          name: item.name,
          price: item.price,
          image: "",
          quantity: item.quantity,
          farmName: item.farmName,
        });
      }

      Alert.alert(
        "Groceries Added",
        `${selectedPlan.title} grocery list was added to your cart.`
      );
    } catch (error) {
      console.log("AI meal planner add to cart error:", error);
      Alert.alert("Cart Error", "Unable to add groceries to cart.");
    }
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Farm2Home AI</Text>
        <Text style={styles.title}>AI Meal Planner</Text>
        <Text style={styles.subtitle}>
          Build weekly meals, match local farm products, and turn meal plans into
          grocery carts.
        </Text>

        <View style={styles.heroStats}>
          <View style={styles.heroStatBox}>
            <Text style={styles.heroStatNumber}>5</Text>
            <Text style={styles.heroStatLabel}>Plan Types</Text>
          </View>

          <View style={styles.heroStatBox}>
            <Text style={styles.heroStatNumber}>AI</Text>
            <Text style={styles.heroStatLabel}>Grocery Match</Text>
          </View>

          <View style={styles.heroStatBox}>
            <Text style={styles.heroStatNumber}>1-Tap</Text>
            <Text style={styles.heroStatLabel}>Add Cart</Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Meal Plan Style</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.typeRow}
      >
        {planTypes.map((type) => (
          <TouchableOpacity
            key={type}
            style={[
              styles.typeChip,
              selectedType === type && styles.typeChipActive,
            ]}
            onPress={() => selectType(type)}
          >
            <Text
              style={[
                styles.typeText,
                selectedType === type && styles.typeTextActive,
              ]}
            >
              {type}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.selectedCard}>
        <Text style={styles.selectedBadge}>Recommended Plan</Text>
        <Text style={styles.selectedTitle}>{selectedPlan.title}</Text>
        <Text style={styles.selectedDescription}>
          {selectedPlan.description}
        </Text>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Estimated Grocery Total</Text>
          <Text style={styles.totalPrice}>${getEstimatedTotal().toFixed(2)}</Text>
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={addGroceryListToCart}
        >
          <Text style={styles.primaryText}>Add Full Grocery List to Cart</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.outlineButton}
          onPress={() => router.push("/customer/cart")}
        >
          <Text style={styles.outlineText}>Go to Cart</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Meals This Plan Creates</Text>

      <View style={styles.mealCard}>
        {selectedPlan.meals.map((meal, index) => (
          <View key={`${meal}-${index}`} style={styles.mealRow}>
            <View style={styles.mealNumber}>
              <Text style={styles.mealNumberText}>{index + 1}</Text>
            </View>

            <Text style={styles.mealText}>{meal}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>AI Grocery List</Text>

      {selectedPlan.groceryList.map((item) => (
        <View key={item.id} style={styles.groceryCard}>
          <View style={styles.groceryIcon}>
            <Text style={styles.groceryIconText}>🥕</Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.groceryName}>{item.name}</Text>
            <Text style={styles.groceryMeta}>
              {item.farmName} · {item.category}
            </Text>
            <Text style={styles.groceryQty}>Qty {item.quantity}</Text>
          </View>

          <View style={styles.priceBlock}>
            <Text style={styles.groceryPrice}>${item.price.toFixed(2)}</Text>

            <TouchableOpacity
              style={styles.addSmallButton}
              onPress={() => addSingleItemToCart(item)}
            >
              <Text style={styles.addSmallText}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      <Text style={styles.sectionTitle}>Other Plans</Text>

      {mealPlans.map((plan) => {
        const active = selectedPlan.id === plan.id;

        return (
          <TouchableOpacity
            key={plan.id}
            style={[styles.planCard, active && styles.planCardActive]}
            onPress={() => {
              setSelectedType(plan.type);
              setSelectedPlanId(plan.id);
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.planType}>{plan.type}</Text>
              <Text style={styles.planTitle}>{plan.title}</Text>
              <Text style={styles.planDescription}>{plan.description}</Text>
            </View>

            <View style={styles.planPriceBlock}>
              <Text style={styles.planPrice}>
                ${plan.estimatedTotal.toFixed(2)}
              </Text>
              <Text style={styles.planItems}>
                {plan.groceryList.length} items
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}

      <View style={styles.aiInsightCard}>
        <Text style={styles.aiInsightTitle}>AI Grocery Intelligence</Text>
        <Text style={styles.aiInsightText}>
          This screen can later connect to real customer preferences, household
          size, nutrition goals, budget limits, allergies, and nearby farm
          inventory.
        </Text>

        <View style={styles.insightList}>
          <Text style={styles.insightItem}>• Match meals to local farm supply</Text>
          <Text style={styles.insightItem}>• Recommend seasonal produce</Text>
          <Text style={styles.insightItem}>• Create budget grocery bundles</Text>
          <Text style={styles.insightItem}>• Predict recurring household needs</Text>
          <Text style={styles.insightItem}>• Suggest healthier swaps</Text>
        </View>
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
    paddingBottom: 28,
  },

  eyebrow: {
    color: "#DFF5E5",
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
    fontWeight: "700",
    lineHeight: 23,
  },

  heroStats: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
  },

  heroStatBox: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 16,
    padding: 12,
  },

  heroStatNumber: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
  },

  heroStatLabel: {
    color: "#DFF5E5",
    fontWeight: "800",
    fontSize: 12,
    marginTop: 4,
  },

  sectionTitle: {
    color: farmTheme.colors.text,
    fontSize: 23,
    fontWeight: "900",
    paddingHorizontal: 18,
    marginTop: 18,
    marginBottom: 12,
  },

  typeRow: {
    paddingLeft: 18,
    marginBottom: 6,
  },

  typeChip: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 999,
    marginRight: 10,
  },

  typeChipActive: {
    backgroundColor: farmTheme.colors.primary,
    borderColor: farmTheme.colors.primary,
  },

  typeText: {
    color: farmTheme.colors.text,
    fontWeight: "900",
  },

  typeTextActive: {
    color: "#FFFFFF",
  },

  selectedCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    marginTop: 12,
    marginBottom: 2,
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
    fontWeight: "700",
    lineHeight: 22,
  },

  totalRow: {
    backgroundColor: "#F0FDF4",
    borderRadius: 16,
    padding: 14,
    marginTop: 14,
    marginBottom: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  totalLabel: {
    color: farmTheme.colors.text,
    fontWeight: "900",
    flex: 1,
  },

  totalPrice: {
    color: farmTheme.colors.primary,
    fontSize: 22,
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

  mealCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    ...farmTheme.shadow,
  },

  mealRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },

  mealNumber: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: farmTheme.colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },

  mealNumberText: {
    color: farmTheme.colors.primary,
    fontWeight: "900",
  },

  mealText: {
    flex: 1,
    color: farmTheme.colors.text,
    fontWeight: "900",
    lineHeight: 22,
  },

  groceryCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    marginBottom: 12,
    borderRadius: 20,
    padding: 15,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  groceryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#F0FDF4",
    alignItems: "center",
    justifyContent: "center",
  },

  groceryIconText: {
    fontSize: 24,
  },

  groceryName: {
    color: farmTheme.colors.text,
    fontSize: 17,
    fontWeight: "900",
  },

  groceryMeta: {
    color: farmTheme.colors.mutedText,
    fontWeight: "700",
    marginTop: 4,
  },

  groceryQty: {
    color: farmTheme.colors.primary,
    fontWeight: "900",
    marginTop: 4,
  },

  priceBlock: {
    alignItems: "flex-end",
  },

  groceryPrice: {
    color: farmTheme.colors.primary,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 8,
  },

  addSmallButton: {
    backgroundColor: farmTheme.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
  },

  addSmallText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  planCard: {
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

  planCardActive: {
    borderColor: farmTheme.colors.primary,
    borderWidth: 2,
    backgroundColor: "#F0FDF4",
  },

  planType: {
    color: farmTheme.colors.primary,
    fontWeight: "900",
    marginBottom: 4,
  },

  planTitle: {
    color: farmTheme.colors.text,
    fontSize: 18,
    fontWeight: "900",
  },

  planDescription: {
    color: farmTheme.colors.mutedText,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 4,
  },

  planPriceBlock: {
    alignItems: "flex-end",
    justifyContent: "center",
  },

  planPrice: {
    color: farmTheme.colors.primary,
    fontSize: 18,
    fontWeight: "900",
  },

  planItems: {
    color: farmTheme.colors.mutedText,
    fontWeight: "800",
    marginTop: 4,
  },

  aiInsightCard: {
    backgroundColor: "#064E3B",
    marginHorizontal: 18,
    marginTop: 8,
    borderRadius: 22,
    padding: 18,
  },

  aiInsightTitle: {
    color: "#FFFFFF",
    fontSize: 23,
    fontWeight: "900",
    marginBottom: 8,
  },

  aiInsightText: {
    color: "#BBF7D0",
    fontWeight: "700",
    lineHeight: 22,
  },

  insightList: {
    marginTop: 12,
  },

  insightItem: {
    color: "#D1FAE5",
    fontWeight: "800",
    lineHeight: 25,
  },
});