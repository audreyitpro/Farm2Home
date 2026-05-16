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

type Season = "Spring" | "Summer" | "Fall" | "Winter";

type SeasonalItem = {
  id: string;
  name: string;
  farmName: string;
  price: number;
  season: Season;
  month: string;
  recipeIdea: string;
  healthBenefit: string;
};

const seasonalItems: SeasonalItem[] = [
  {
    id: "spring-greens",
    name: "Spring Greens Box",
    farmName: "Leafy Acres",
    price: 18.99,
    season: "Spring",
    month: "April - June",
    recipeIdea: "Fresh spring salad with eggs and honey vinaigrette.",
    healthBenefit: "Rich in vitamins, fiber, and antioxidants.",
  },
  {
    id: "summer-tomatoes",
    name: "Summer Tomato Basket",
    farmName: "Sunrise Produce Farm",
    price: 14.99,
    season: "Summer",
    month: "July - August",
    recipeIdea: "Tomato cucumber salad with grilled chicken.",
    healthBenefit: "Great source of vitamin C and hydration.",
  },
  {
    id: "fall-root-box",
    name: "Fall Root Vegetable Box",
    farmName: "Root Family Farm",
    price: 22.99,
    season: "Fall",
    month: "September - November",
    recipeIdea: "Roasted carrots, potatoes, onions, and chicken.",
    healthBenefit: "Supports hearty meals with fiber and minerals.",
  },
  {
    id: "winter-storage-box",
    name: "Winter Storage Produce Box",
    farmName: "Green Valley Farm",
    price: 24.99,
    season: "Winter",
    month: "December - March",
    recipeIdea: "Warm vegetable soup with eggs and farm bread.",
    healthBenefit: "Comfort food staples for colder months.",
  },
];

export default function SeasonalProduceGuide() {
  const [selectedSeason, setSelectedSeason] = useState<Season>("Summer");

  const seasons: Season[] = ["Spring", "Summer", "Fall", "Winter"];

  const filteredItems = useMemo(() => {
    return seasonalItems.filter((item) => item.season === selectedSeason);
  }, [selectedSeason]);

  const selectedTotal = useMemo(() => {
    return filteredItems.reduce((sum, item) => sum + item.price, 0);
  }, [filteredItems]);

  async function addSeasonalBoxToCart() {
    try {
      for (const item of filteredItems) {
        await addToCart({
          id: item.id,
          name: item.name,
          price: item.price,
          image: "",
          quantity: 1,
          farmName: item.farmName,
        });
      }

      Alert.alert(
        "Seasonal Box Added",
        `${selectedSeason} seasonal produce was added to your cart.`
      );
    } catch (error) {
      console.log("Seasonal produce add error:", error);
      Alert.alert("Cart Error", "Unable to add seasonal produce.");
    }
  }

  async function addSingleItem(item: SeasonalItem) {
    try {
      await addToCart({
        id: item.id,
        name: item.name,
        price: item.price,
        image: "",
        quantity: 1,
        farmName: item.farmName,
      });

      Alert.alert("Added to Cart", `${item.name} added to cart.`);
    } catch (error) {
      console.log("Seasonal single add error:", error);
      Alert.alert("Cart Error", "Unable to add item.");
    }
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Farm2Home Seasonal AI</Text>
        <Text style={styles.title}>Seasonal Produce Guide</Text>
        <Text style={styles.subtitle}>
          Discover what is fresh by season, match produce to nearby farms, and
          build seasonal grocery boxes.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Choose Season</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
        {seasons.map((season) => (
          <TouchableOpacity
            key={season}
            style={[styles.chip, selectedSeason === season && styles.chipActive]}
            onPress={() => setSelectedSeason(season)}
          >
            <Text
              style={[
                styles.chipText,
                selectedSeason === season && styles.chipTextActive,
              ]}
            >
              {season}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryBadge}>{selectedSeason} Harvest</Text>
        <Text style={styles.summaryTitle}>{selectedSeason} Seasonal Box</Text>
        <Text style={styles.summaryText}>
          AI recommends these fresh items based on seasonal availability, local
          farms, recipe ideas, and nutrition value.
        </Text>

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Seasonal Box Total</Text>
          <Text style={styles.totalPrice}>${selectedTotal.toFixed(2)}</Text>
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={addSeasonalBoxToCart}>
          <Text style={styles.primaryText}>Add Seasonal Box to Cart</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.outlineButton}
          onPress={() => router.push("/customer/marketplace")}
        >
          <Text style={styles.outlineText}>Back to Marketplace</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Fresh This Season</Text>

      {filteredItems.map((item) => (
        <View key={item.id} style={styles.produceCard}>
          <View style={styles.produceIcon}>
            <Text style={styles.produceIconText}>🥕</Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.produceName}>{item.name}</Text>
            <Text style={styles.produceMeta}>
              {item.farmName} · {item.month}
            </Text>
            <Text style={styles.recipeText}>Recipe: {item.recipeIdea}</Text>
            <Text style={styles.healthText}>{item.healthBenefit}</Text>
            <Text style={styles.priceText}>${item.price.toFixed(2)}</Text>
          </View>

          <TouchableOpacity style={styles.addButton} onPress={() => addSingleItem(item)}>
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        </View>
      ))}

      <Text style={styles.sectionTitle}>Harvest Calendar</Text>

      {seasonalItems.map((item) => (
        <TouchableOpacity
          key={`${item.id}-calendar`}
          style={[
            styles.calendarCard,
            selectedSeason === item.season && styles.calendarCardActive,
          ]}
          onPress={() => setSelectedSeason(item.season)}
        >
          <View>
            <Text style={styles.calendarSeason}>{item.season}</Text>
            <Text style={styles.calendarName}>{item.name}</Text>
            <Text style={styles.calendarMonth}>{item.month}</Text>
          </View>

          <Text style={styles.calendarArrow}>›</Text>
        </TouchableOpacity>
      ))}

      <View style={styles.aiCard}>
        <Text style={styles.aiTitle}>AI Seasonal Suggestions</Text>
        <Text style={styles.aiText}>
          Farm2Home can recommend produce based on season, customer nutrition
          goals, local farm inventory, recipe plans, and household size.
        </Text>

        <Text style={styles.aiItem}>• Recommend peak-season produce</Text>
        <Text style={styles.aiItem}>• Match crops to nearby farms</Text>
        <Text style={styles.aiItem}>• Build seasonal recipe boxes</Text>
        <Text style={styles.aiItem}>• Support nutrition-based suggestions</Text>
        <Text style={styles.aiItem}>• Reduce waste with seasonal planning</Text>
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

  summaryCard: {
    backgroundColor: "#FFFFFF",
    margin: 18,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    ...farmTheme.shadow,
  },

  summaryBadge: {
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

  summaryTitle: {
    color: farmTheme.colors.text,
    fontSize: 25,
    fontWeight: "900",
    marginBottom: 8,
  },

  summaryText: {
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

  produceCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    marginBottom: 12,
    borderRadius: 20,
    padding: 15,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },

  produceIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#F0FDF4",
    alignItems: "center",
    justifyContent: "center",
  },

  produceIconText: {
    fontSize: 25,
  },

  produceName: {
    color: farmTheme.colors.text,
    fontSize: 18,
    fontWeight: "900",
  },

  produceMeta: {
    color: farmTheme.colors.mutedText,
    fontWeight: "700",
    marginTop: 4,
  },

  recipeText: {
    color: farmTheme.colors.text,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 7,
  },

  healthText: {
    color: farmTheme.colors.mutedText,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 5,
  },

  priceText: {
    color: farmTheme.colors.primary,
    fontWeight: "900",
    fontSize: 17,
    marginTop: 7,
  },

  addButton: {
    backgroundColor: farmTheme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 999,
  },

  addButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  calendarCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    marginBottom: 12,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  calendarCardActive: {
    borderColor: farmTheme.colors.primary,
    borderWidth: 2,
    backgroundColor: "#F0FDF4",
  },

  calendarSeason: {
    color: farmTheme.colors.primary,
    fontWeight: "900",
  },

  calendarName: {
    color: farmTheme.colors.text,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 4,
  },

  calendarMonth: {
    color: farmTheme.colors.mutedText,
    fontWeight: "700",
    marginTop: 4,
  },

  calendarArrow: {
    color: farmTheme.colors.primary,
    fontSize: 34,
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
});