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

import farmTheme from "../styles/farmTheme";

type BoxSize = "Small" | "Family" | "Healthy" | "Budget" | "Premium";
type Frequency = "Weekly" | "Every 2 Weeks" | "Monthly";

type ProduceBox = {
  id: string;
  name: string;
  size: BoxSize;
  price: number;
  description: string;
  items: string[];
  badge: string;
  recommended?: boolean;
};

const produceBoxes: ProduceBox[] = [
  {
    id: "small-fresh-box",
    name: "Small Fresh Box",
    size: "Small",
    price: 24.99,
    badge: "Starter",
    description: "Perfect for 1–2 people who want fresh local produce.",
    items: ["Leafy greens", "Carrots", "Apples", "Tomatoes", "Seasonal herbs"],
  },
  {
    id: "family-harvest-box",
    name: "Family Harvest Box",
    size: "Family",
    price: 44.99,
    badge: "Most Popular",
    description: "A weekly farm box built for family meals and snacks.",
    items: [
      "Seasonal vegetables",
      "Fresh fruit",
      "Potatoes",
      "Salad greens",
      "Farm eggs",
      "Local honey sample",
    ],
    recommended: true,
  },
  {
    id: "healthy-green-box",
    name: "Healthy Green Box",
    size: "Healthy",
    price: 39.99,
    badge: "Healthy",
    description: "Focused on clean eating, greens, vegetables, and fruit.",
    items: [
      "Spinach",
      "Kale",
      "Mixed greens",
      "Berries",
      "Carrots",
      "Fresh herbs",
    ],
  },
  {
    id: "budget-market-box",
    name: "Budget Market Box",
    size: "Budget",
    price: 29.99,
    badge: "Best Value",
    description: "Affordable farm staples for weekly cooking.",
    items: ["Potatoes", "Onions", "Carrots", "Apples", "Cabbage", "Tomatoes"],
  },
  {
    id: "premium-farm-box",
    name: "Premium Farm Box",
    size: "Premium",
    price: 64.99,
    badge: "Premium",
    description: "Premium produce plus farm extras and seasonal specialties.",
    items: [
      "Premium vegetables",
      "Fresh fruit basket",
      "Farm eggs",
      "Local honey",
      "Artisan bread",
      "Seasonal specialty item",
    ],
  },
];

export default function RecurringProduce() {
  const [selectedBoxId, setSelectedBoxId] = useState("family-harvest-box");
  const [frequency, setFrequency] = useState<Frequency>("Weekly");
  const [deliveryDay, setDeliveryDay] = useState("Saturday");

  const frequencies: Frequency[] = ["Weekly", "Every 2 Weeks", "Monthly"];
  const deliveryDays = ["Monday", "Wednesday", "Friday", "Saturday", "Sunday"];

  const selectedBox = useMemo(() => {
    return produceBoxes.find((box) => box.id === selectedBoxId) || produceBoxes[1];
  }, [selectedBoxId]);

  const monthlyEstimate = useMemo(() => {
    if (frequency === "Weekly") return selectedBox.price * 4;
    if (frequency === "Every 2 Weeks") return selectedBox.price * 2;
    return selectedBox.price;
  }, [selectedBox, frequency]);

  function startSubscription() {
    Alert.alert(
      "Recurring Produce Selected",
      `${selectedBox.name}\n${frequency} on ${deliveryDay}\nEstimated monthly total: $${monthlyEstimate.toFixed(
        2
      )}\n\nNext step: connect this button to Stripe recurring subscription checkout.`
    );
  }

  function pauseSubscriptionDemo() {
    Alert.alert(
      "Pause Subscription",
      "This is where customers will be able to pause their recurring produce box."
    );
  }

  function manageDeliveryDemo() {
    Alert.alert(
      "Manage Delivery",
      "This is where customers will update delivery day, address, frequency, or box size."
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Farm2Home Subscriptions</Text>
        <Text style={styles.title}>Recurring Produce Boxes</Text>
        <Text style={styles.subtitle}>
          Let customers subscribe to fresh local produce delivered on a recurring
          schedule.
        </Text>

        <View style={styles.heroStats}>
          <View style={styles.heroStatBox}>
            <Text style={styles.heroStatNumber}>5</Text>
            <Text style={styles.heroStatLabel}>Box Plans</Text>
          </View>

          <View style={styles.heroStatBox}>
            <Text style={styles.heroStatNumber}>3</Text>
            <Text style={styles.heroStatLabel}>Frequencies</Text>
          </View>

          <View style={styles.heroStatBox}>
            <Text style={styles.heroStatNumber}>Stripe</Text>
            <Text style={styles.heroStatLabel}>Ready</Text>
          </View>
        </View>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Selected Subscription</Text>
        <Text style={styles.summaryTitle}>{selectedBox.name}</Text>
        <Text style={styles.summaryDescription}>{selectedBox.description}</Text>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryKey}>Frequency</Text>
          <Text style={styles.summaryValue}>{frequency}</Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryKey}>Delivery Day</Text>
          <Text style={styles.summaryValue}>{deliveryDay}</Text>
        </View>

        <View style={styles.totalBox}>
          <Text style={styles.totalLabel}>Estimated Monthly Total</Text>
          <Text style={styles.totalPrice}>${monthlyEstimate.toFixed(2)}</Text>
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={startSubscription}>
          <Text style={styles.primaryText}>Start Recurring Produce</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.outlineButton}
          onPress={() => router.push("/customer/subscription-membership")}
        >
          <Text style={styles.outlineText}>View Membership Plans</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Choose a Produce Box</Text>

      {produceBoxes.map((box) => {
        const selected = selectedBox.id === box.id;

        return (
          <TouchableOpacity
            key={box.id}
            style={[
              styles.boxCard,
              selected && styles.boxCardSelected,
              box.recommended && styles.boxCardRecommended,
            ]}
            onPress={() => setSelectedBoxId(box.id)}
            activeOpacity={0.9}
          >
            <View style={styles.boxHeader}>
              <View style={{ flex: 1 }}>
                <View style={styles.badgeRow}>
                  <Text
                    style={[
                      styles.boxBadge,
                      box.recommended && styles.recommendedBadge,
                    ]}
                  >
                    {box.badge}
                  </Text>

                  {selected ? <Text style={styles.selectedBadge}>Selected</Text> : null}
                </View>

                <Text style={styles.boxName}>{box.name}</Text>
                <Text style={styles.boxDescription}>{box.description}</Text>
              </View>

              <View style={styles.priceBlock}>
                <Text style={styles.boxPrice}>${box.price.toFixed(2)}</Text>
                <Text style={styles.boxPriceSub}>per box</Text>
              </View>
            </View>

            <View style={styles.itemList}>
              {box.items.map((item) => (
                <View key={item} style={styles.itemRow}>
                  <Text style={styles.check}>✓</Text>
                  <Text style={styles.itemText}>{item}</Text>
                </View>
              ))}
            </View>
          </TouchableOpacity>
        );
      })}

      <Text style={styles.sectionTitle}>Delivery Frequency</Text>

      <View style={styles.optionCard}>
        <View style={styles.optionWrap}>
          {frequencies.map((item) => (
            <TouchableOpacity
              key={item}
              style={[
                styles.optionChip,
                frequency === item && styles.optionChipActive,
              ]}
              onPress={() => setFrequency(item)}
            >
              <Text
                style={[
                  styles.optionText,
                  frequency === item && styles.optionTextActive,
                ]}
              >
                {item}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <Text style={styles.sectionTitle}>Preferred Delivery Day</Text>

      <View style={styles.optionCard}>
        <View style={styles.optionWrap}>
          {deliveryDays.map((day) => (
            <TouchableOpacity
              key={day}
              style={[
                styles.optionChip,
                deliveryDay === day && styles.optionChipActive,
              ]}
              onPress={() => setDeliveryDay(day)}
            >
              <Text
                style={[
                  styles.optionText,
                  deliveryDay === day && styles.optionTextActive,
                ]}
              >
                {day}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.manageCard}>
        <Text style={styles.manageTitle}>Subscription Controls</Text>
        <Text style={styles.manageText}>
          These controls prepare the customer experience for managing recurring
          subscriptions after checkout.
        </Text>

        <TouchableOpacity style={styles.manageButton} onPress={manageDeliveryDemo}>
          <Text style={styles.manageButtonText}>Manage Delivery Settings</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.pauseButton} onPress={pauseSubscriptionDemo}>
          <Text style={styles.pauseButtonText}>Pause Subscription</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.aiCard}>
        <Text style={styles.aiTitle}>AI Produce Intelligence</Text>
        <Text style={styles.aiText}>
          Later this can connect to customer preferences, family size, nutrition
          goals, allergies, local farm inventory, seasonal availability, and
          reorder prediction.
        </Text>

        <View style={styles.aiList}>
          <Text style={styles.aiItem}>• Auto-adjust boxes by season</Text>
          <Text style={styles.aiItem}>• Recommend healthier swaps</Text>
          <Text style={styles.aiItem}>• Predict weekly household needs</Text>
          <Text style={styles.aiItem}>• Match customers with nearby farms</Text>
          <Text style={styles.aiItem}>• Reduce food waste with smart sizing</Text>
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
    fontSize: 35,
    fontWeight: "900",
    marginBottom: 10,
    lineHeight: 40,
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
    fontSize: 19,
    fontWeight: "900",
  },

  heroStatLabel: {
    color: "#DFF5E5",
    fontWeight: "800",
    fontSize: 12,
    marginTop: 4,
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

  summaryLabel: {
    color: farmTheme.colors.mutedText,
    fontWeight: "900",
    marginBottom: 6,
  },

  summaryTitle: {
    color: farmTheme.colors.text,
    fontSize: 25,
    fontWeight: "900",
    marginBottom: 8,
  },

  summaryDescription: {
    color: farmTheme.colors.mutedText,
    fontWeight: "700",
    lineHeight: 22,
    marginBottom: 14,
  },

  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingVertical: 12,
  },

  summaryKey: {
    color: farmTheme.colors.mutedText,
    fontWeight: "800",
  },

  summaryValue: {
    color: farmTheme.colors.text,
    fontWeight: "900",
  },

  totalBox: {
    backgroundColor: "#F0FDF4",
    borderRadius: 16,
    padding: 14,
    marginTop: 8,
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

  sectionTitle: {
    color: farmTheme.colors.text,
    fontSize: 23,
    fontWeight: "900",
    paddingHorizontal: 18,
    marginBottom: 12,
  },

  boxCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    marginBottom: 14,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    ...farmTheme.shadow,
  },

  boxCardSelected: {
    borderColor: farmTheme.colors.primary,
    borderWidth: 2,
  },

  boxCardRecommended: {
    backgroundColor: "#F0FDF4",
  },

  boxHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },

  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },

  boxBadge: {
    backgroundColor: "#E5E7EB",
    color: "#374151",
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: "hidden",
  },

  recommendedBadge: {
    backgroundColor: farmTheme.colors.primary,
    color: "#FFFFFF",
  },

  selectedBadge: {
    backgroundColor: "#FACC15",
    color: "#1F2937",
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: "hidden",
  },

  boxName: {
    color: farmTheme.colors.text,
    fontSize: 22,
    fontWeight: "900",
  },

  boxDescription: {
    color: farmTheme.colors.mutedText,
    fontWeight: "700",
    marginTop: 5,
    lineHeight: 21,
  },

  priceBlock: {
    alignItems: "flex-end",
  },

  boxPrice: {
    color: farmTheme.colors.primary,
    fontSize: 22,
    fontWeight: "900",
  },

  boxPriceSub: {
    color: farmTheme.colors.mutedText,
    fontWeight: "800",
  },

  itemList: {
    marginTop: 14,
    gap: 9,
  },

  itemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },

  check: {
    color: farmTheme.colors.primary,
    fontSize: 18,
    fontWeight: "900",
  },

  itemText: {
    flex: 1,
    color: farmTheme.colors.text,
    fontWeight: "800",
    lineHeight: 22,
  },

  optionCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    marginBottom: 18,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    ...farmTheme.shadow,
  },

  optionWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  optionChip: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 15,
    paddingVertical: 11,
    borderRadius: 999,
  },

  optionChipActive: {
    backgroundColor: farmTheme.colors.primary,
    borderColor: farmTheme.colors.primary,
  },

  optionText: {
    color: farmTheme.colors.text,
    fontWeight: "900",
  },

  optionTextActive: {
    color: "#FFFFFF",
  },

  manageCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    marginBottom: 18,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    ...farmTheme.shadow,
  },

  manageTitle: {
    color: farmTheme.colors.text,
    fontSize: 23,
    fontWeight: "900",
    marginBottom: 8,
  },

  manageText: {
    color: farmTheme.colors.mutedText,
    fontWeight: "700",
    lineHeight: 22,
    marginBottom: 14,
  },

  manageButton: {
    backgroundColor: farmTheme.colors.primary,
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 10,
  },

  manageButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  pauseButton: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
  },

  pauseButtonText: {
    color: "#DC2626",
    fontWeight: "900",
  },

  aiCard: {
    backgroundColor: "#064E3B",
    marginHorizontal: 18,
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
    fontWeight: "700",
    lineHeight: 22,
  },

  aiList: {
    marginTop: 12,
  },

  aiItem: {
    color: "#D1FAE5",
    fontWeight: "800",
    lineHeight: 25,
  },
});