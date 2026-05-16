import React, { useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import farmTheme from "../styles/farmTheme";

type FarmerPlan = {
  id: string;
  name: string;
  price: number;
  badge: string;
  description: string;
  benefits: string[];
  recommended?: boolean;
};

const plans: FarmerPlan[] = [
  {
    id: "starter",
    name: "Farm Starter",
    price: 19.99,
    badge: "Starter",
    description: "For small farms starting on Farm2Home.",
    benefits: ["Marketplace listing", "Basic inventory", "Order notifications", "Customer reviews"],
  },
  {
    id: "growth",
    name: "Farm Growth",
    price: 49.99,
    badge: "Most Popular",
    description: "For farms growing online orders and subscriptions.",
    benefits: [
      "Priority marketplace placement",
      "Advanced inventory tools",
      "Revenue analytics",
      "Subscription boxes",
      "Promo campaigns",
    ],
    recommended: true,
  },
  {
    id: "enterprise",
    name: "Farm Enterprise",
    price: 99.99,
    badge: "Enterprise",
    description: "For high-volume farm networks and food suppliers.",
    benefits: [
      "Premium visibility",
      "AI demand forecasting",
      "Bulk order management",
      "Dedicated support",
      "Advanced reporting",
    ],
  },
];

export default function FarmerSubscriptionPlans() {
  const [selectedPlanId, setSelectedPlanId] = useState("growth");

  const selectedPlan = useMemo(() => {
    return plans.find((plan) => plan.id === selectedPlanId) || plans[1];
  }, [selectedPlanId]);

  function startPlan() {
    Alert.alert(
      "Farmer Plan Selected",
      `${selectedPlan.name} selected at $${selectedPlan.price.toFixed(
        2
      )}/month.\n\nNext step: connect to Stripe subscription checkout.`
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Farm2Home Farmer Revenue</Text>
        <Text style={styles.title}>Farmer Subscription Plans</Text>
        <Text style={styles.subtitle}>
          Monetize farmer access with marketplace visibility, analytics,
          inventory tools, and subscription box features.
        </Text>
      </View>

      <View style={styles.selectedCard}>
        <Text style={styles.selectedLabel}>Selected Plan</Text>
        <Text style={styles.selectedName}>{selectedPlan.name}</Text>
        <Text style={styles.selectedPrice}>${selectedPlan.price.toFixed(2)} / month</Text>
        <Text style={styles.selectedText}>{selectedPlan.description}</Text>

        <TouchableOpacity style={styles.primaryButton} onPress={startPlan}>
          <Text style={styles.primaryText}>Start {selectedPlan.name}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Choose a Plan</Text>

      {plans.map((plan) => {
        const active = selectedPlan.id === plan.id;

        return (
          <TouchableOpacity
            key={plan.id}
            style={[
              styles.planCard,
              active && styles.planCardActive,
              plan.recommended && styles.planCardRecommended,
            ]}
            onPress={() => setSelectedPlanId(plan.id)}
          >
            <View style={styles.planHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.badge}>{plan.badge}</Text>
                <Text style={styles.planName}>{plan.name}</Text>
                <Text style={styles.planDescription}>{plan.description}</Text>
              </View>

              <Text style={styles.planPrice}>${plan.price.toFixed(2)}</Text>
            </View>

            <View style={styles.benefitList}>
              {plan.benefits.map((benefit) => (
                <Text key={benefit} style={styles.benefit}>
                  ✓ {benefit}
                </Text>
              ))}
            </View>
          </TouchableOpacity>
        );
      })}

      <View style={{ height: 90 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: farmTheme.colors.background },

  hero: {
    backgroundColor: farmTheme.colors.primary,
    paddingTop: 64,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },

  eyebrow: { color: "#D1FAE5", fontWeight: "900", marginBottom: 8 },

  title: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900",
    marginBottom: 10,
    lineHeight: 40,
  },

  subtitle: { color: "#E8F5E9", fontWeight: "700", lineHeight: 23 },

  selectedCard: {
    backgroundColor: "#FFFFFF",
    margin: 18,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    ...farmTheme.shadow,
  },

  selectedLabel: { color: farmTheme.colors.mutedText, fontWeight: "900" },

  selectedName: {
    color: farmTheme.colors.text,
    fontSize: 26,
    fontWeight: "900",
    marginTop: 6,
  },

  selectedPrice: {
    color: farmTheme.colors.primary,
    fontSize: 26,
    fontWeight: "900",
    marginTop: 6,
  },

  selectedText: {
    color: farmTheme.colors.mutedText,
    fontWeight: "700",
    lineHeight: 22,
    marginTop: 8,
    marginBottom: 14,
  },

  primaryButton: {
    backgroundColor: farmTheme.colors.primary,
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
  },

  primaryText: { color: "#FFFFFF", fontWeight: "900" },

  sectionTitle: {
    color: farmTheme.colors.text,
    fontSize: 23,
    fontWeight: "900",
    paddingHorizontal: 18,
    marginBottom: 12,
  },

  planCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    marginBottom: 14,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    ...farmTheme.shadow,
  },

  planCardActive: { borderColor: farmTheme.colors.primary, borderWidth: 2 },

  planCardRecommended: { backgroundColor: "#F0FDF4" },

  planHeader: { flexDirection: "row", gap: 12 },

  badge: {
    alignSelf: "flex-start",
    backgroundColor: "#FACC15",
    color: "#1F2937",
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: 8,
  },

  planName: { color: farmTheme.colors.text, fontSize: 22, fontWeight: "900" },

  planDescription: {
    color: farmTheme.colors.mutedText,
    fontWeight: "700",
    lineHeight: 21,
    marginTop: 5,
  },

  planPrice: { color: farmTheme.colors.primary, fontSize: 22, fontWeight: "900" },

  benefitList: { marginTop: 14, gap: 8 },

  benefit: { color: farmTheme.colors.text, fontWeight: "800", lineHeight: 22 },
});