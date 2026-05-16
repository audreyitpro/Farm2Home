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

type BoxType = "Produce" | "Meat" | "Dairy" | "Mixed" | "Premium";
type Frequency = "Weekly" | "Every 2 Weeks" | "Monthly";

type SubscriptionBox = {
  id: string;
  name: string;
  type: BoxType;
  price: number;
  badge: string;
  description: string;
  farmName: string;
  items: string[];
  recommended?: boolean;
};

const boxes: SubscriptionBox[] = [
  {
    id: "produce-weekly",
    name: "Fresh Produce Box",
    type: "Produce",
    price: 34.99,
    badge: "Most Popular",
    description: "Seasonal vegetables and fruit from local farms.",
    farmName: "Sunrise Produce Farm",
    recommended: true,
    items: ["Leafy greens", "Tomatoes", "Carrots", "Apples", "Seasonal herbs"],
  },
  {
    id: "meat-box",
    name: "Farm Meat Box",
    type: "Meat",
    price: 74.99,
    badge: "Protein",
    description: "Local meat bundle for weekly family meals.",
    farmName: "Oak Hill Farms",
    items: ["Chicken", "Ground beef", "Sausage", "Meal prep protein pack"],
  },
  {
    id: "dairy-box",
    name: "Dairy & Eggs Box",
    type: "Dairy",
    price: 29.99,
    badge: "Breakfast",
    description: "Fresh eggs, milk, yogurt, and dairy staples.",
    farmName: "Green Valley Farm",
    items: ["Farm eggs", "Local milk", "Yogurt cups", "Cheese block"],
  },
  {
    id: "mixed-family-box",
    name: "Mixed Family Farm Box",
    type: "Mixed",
    price: 89.99,
    badge: "Family",
    description: "A complete mixed grocery box for families.",
    farmName: "Farm2Home Partner Farms",
    items: ["Produce", "Eggs", "Chicken", "Fruit", "Pantry staple"],
  },
  {
    id: "premium-farm-box",
    name: "Premium Farm Box",
    type: "Premium",
    price: 119.99,
    badge: "Premium",
    description: "Premium farm products and seasonal specialties.",
    farmName: "Farm2Home Premium Network",
    items: ["Premium produce", "Specialty meat", "Honey", "Artisan bread", "Farm eggs"],
  },
];

export default function FarmSubscriptionBoxes() {
  const [selectedType, setSelectedType] = useState<BoxType>("Produce");
  const [selectedBoxId, setSelectedBoxId] = useState("produce-weekly");
  const [frequency, setFrequency] = useState<Frequency>("Weekly");

  const boxTypes: BoxType[] = ["Produce", "Meat", "Dairy", "Mixed", "Premium"];
  const frequencies: Frequency[] = ["Weekly", "Every 2 Weeks", "Monthly"];

  const filteredBoxes = useMemo(() => {
    return boxes.filter((box) => box.type === selectedType);
  }, [selectedType]);

  const selectedBox = useMemo(() => {
    return boxes.find((box) => box.id === selectedBoxId) || filteredBoxes[0] || boxes[0];
  }, [selectedBoxId, filteredBoxes]);

  const monthlyEstimate = useMemo(() => {
    if (frequency === "Weekly") return selectedBox.price * 4;
    if (frequency === "Every 2 Weeks") return selectedBox.price * 2;
    return selectedBox.price;
  }, [frequency, selectedBox]);

  function selectType(type: BoxType) {
    setSelectedType(type);

    const firstBox = boxes.find((box) => box.type === type);
    if (firstBox) {
      setSelectedBoxId(firstBox.id);
    }
  }

  function startSubscription() {
    Alert.alert(
      "Subscription Box Selected",
      `${selectedBox.name}\n${frequency}\nEstimated monthly total: $${monthlyEstimate.toFixed(
        2
      )}\n\nNext step: connect this to Stripe recurring checkout.`
    );
  }

  function pauseSubscription() {
    Alert.alert(
      "Pause Subscription",
      "This is where customers can pause or skip their next farm box delivery."
    );
  }

  function customizeBox() {
    Alert.alert(
      "Customize Box",
      "This is where customers can swap items, remove products, or add premium upgrades."
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Farm2Home Subscriptions</Text>
        <Text style={styles.title}>Farm Subscription Boxes</Text>
        <Text style={styles.subtitle}>
          Subscribe to recurring farm boxes for produce, meat, dairy, mixed
          groceries, and premium local farm products.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Box Type</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
        {boxTypes.map((type) => (
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
        <Text style={styles.badge}>{selectedBox.badge}</Text>
        <Text style={styles.selectedTitle}>{selectedBox.name}</Text>
        <Text style={styles.selectedMeta}>{selectedBox.farmName}</Text>
        <Text style={styles.selectedDescription}>{selectedBox.description}</Text>

        <View style={styles.totalBox}>
          <View>
            <Text style={styles.totalLabel}>Estimated Monthly Total</Text>
            <Text style={styles.frequencyText}>{frequency}</Text>
          </View>

          <Text style={styles.totalPrice}>${monthlyEstimate.toFixed(2)}</Text>
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={startSubscription}>
          <Text style={styles.primaryText}>Start Subscription</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.outlineButton} onPress={customizeBox}>
          <Text style={styles.outlineText}>Customize Box</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Delivery Frequency</Text>

      <View style={styles.optionCard}>
        <View style={styles.optionWrap}>
          {frequencies.map((item) => (
            <TouchableOpacity
              key={item}
              style={[styles.optionChip, frequency === item && styles.optionChipActive]}
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

      <Text style={styles.sectionTitle}>Box Includes</Text>

      <View style={styles.itemsCard}>
        {selectedBox.items.map((item) => (
          <View key={item} style={styles.itemRow}>
            <Text style={styles.check}>✓</Text>
            <Text style={styles.itemText}>{item}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>All Subscription Boxes</Text>

      {boxes.map((box) => {
        const active = selectedBox.id === box.id;

        return (
          <TouchableOpacity
            key={box.id}
            style={[styles.boxCard, active && styles.boxCardActive]}
            onPress={() => {
              setSelectedType(box.type);
              setSelectedBoxId(box.id);
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.boxType}>{box.type}</Text>
              <Text style={styles.boxName}>{box.name}</Text>
              <Text style={styles.boxFarm}>{box.farmName}</Text>
              <Text style={styles.boxDescription}>{box.description}</Text>
            </View>

            <View style={styles.priceBlock}>
              <Text style={styles.boxPrice}>${box.price.toFixed(2)}</Text>
              <Text style={styles.boxPriceSub}>per box</Text>
            </View>
          </TouchableOpacity>
        );
      })}

      <View style={styles.manageCard}>
        <Text style={styles.manageTitle}>Subscription Controls</Text>
        <Text style={styles.manageText}>
          Customers can later manage delivery dates, skip boxes, pause service,
          customize items, and upgrade their subscription.
        </Text>

        <TouchableOpacity style={styles.pauseButton} onPress={pauseSubscription}>
          <Text style={styles.pauseButtonText}>Skip / Pause Next Box</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cartButton}
          onPress={() => router.push("/customer/recurring-produce")}
        >
          <Text style={styles.cartButtonText}>View Recurring Produce</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.aiCard}>
        <Text style={styles.aiTitle}>AI Personalized Subscriptions</Text>
        <Text style={styles.aiText}>
          Later this can personalize boxes using household size, nutrition goals,
          family preferences, allergies, favorite farms, order history, and local
          farm inventory.
        </Text>

        <Text style={styles.aiItem}>• Auto-build farm boxes by household needs</Text>
        <Text style={styles.aiItem}>• Suggest seasonal swaps</Text>
        <Text style={styles.aiItem}>• Match boxes to meal plans</Text>
        <Text style={styles.aiItem}>• Predict recurring grocery needs</Text>
        <Text style={styles.aiItem}>• Optimize farmer inventory</Text>
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

  badge: {
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
  },

  selectedMeta: {
    color: farmTheme.colors.primary,
    fontWeight: "900",
    marginTop: 5,
  },

  selectedDescription: {
    color: farmTheme.colors.mutedText,
    lineHeight: 22,
    fontWeight: "700",
    marginTop: 8,
  },

  totalBox: {
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

  frequencyText: {
    color: farmTheme.colors.mutedText,
    fontWeight: "800",
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

  optionCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    marginBottom: 4,
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

  itemsCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    ...farmTheme.shadow,
  },

  itemRow: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 8,
    alignItems: "flex-start",
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

  boxCard: {
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

  boxCardActive: {
    borderColor: farmTheme.colors.primary,
    borderWidth: 2,
    backgroundColor: "#F0FDF4",
  },

  boxType: {
    color: farmTheme.colors.primary,
    fontWeight: "900",
    marginBottom: 4,
  },

  boxName: {
    color: farmTheme.colors.text,
    fontSize: 18,
    fontWeight: "900",
  },

  boxFarm: {
    color: farmTheme.colors.mutedText,
    fontWeight: "700",
    marginTop: 4,
  },

  boxDescription: {
    color: farmTheme.colors.mutedText,
    lineHeight: 20,
    fontWeight: "700",
    marginTop: 4,
  },

  priceBlock: {
    alignItems: "flex-end",
    justifyContent: "center",
  },

  boxPrice: {
    color: farmTheme.colors.primary,
    fontSize: 18,
    fontWeight: "900",
  },

  boxPriceSub: {
    color: farmTheme.colors.mutedText,
    fontWeight: "800",
    marginTop: 4,
  },

  manageCard: {
    backgroundColor: "#FFFFFF",
    margin: 18,
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
    lineHeight: 22,
    fontWeight: "700",
    marginBottom: 14,
  },

  pauseButton: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FCA5A5",
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 10,
  },

  pauseButtonText: {
    color: "#DC2626",
    fontWeight: "900",
  },

  cartButton: {
    backgroundColor: farmTheme.colors.primary,
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
  },

  cartButtonText: {
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
});