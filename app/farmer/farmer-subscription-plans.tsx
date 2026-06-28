import React, { useMemo, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import farmTheme from "../styles/farmTheme";

type FarmerPlan = {
  id: string;
  name: string;
  price: number;
  badge: string;
  headline: string;
  description: string;
  bestFor: string;
  tools: string[];
  growthTools: string[];
  recommended?: boolean;
};

const plans: FarmerPlan[] = [
  {
    id: "starter",
    name: "Farm Starter",
    price: 14.99,
    badge: "Start Selling",
    headline: "Get your farm online",
    description: "For small farms that need a simple marketplace presence.",
    bestFor: "New farms, seasonal growers, small weekly inventory.",
    tools: [
      "Farm marketplace profile",
      "Add produce and custom products",
      "Basic inventory tracking",
      "Customer order notifications",
      "Customer reviews",
    ],
    growthTools: [
      "Start selling locally",
      "Build trust with reviews",
      "Test customer demand",
    ],
  },
  {
    id: "growth",
    name: "Farm Growth",
    price: 49.99,
    badge: "Best for Growth",
    headline: "Grow orders and subscriptions",
    description:
      "For farms ready to sell more products, create bundles, and build repeat customers.",
    bestFor: "Active farms selling produce, meat, seafood, and subscription boxes.",
    tools: [
      "Priority marketplace placement",
      "Advanced inventory tools",
      "Produce, meat, and seafood bundles",
      "Monthly and bi-monthly subscriptions",
      "Promo campaign tools",
      "Revenue analytics",
    ],
    growthTools: [
      "Increase repeat customers",
      "Sell higher-value bundles",
      "Track revenue performance",
    ],
    recommended: true,
  },
  {
    id: "enterprise",
    name: "Farm Enterprise",
    price: 99.99,
    badge: "Scale Farm Sales",
    headline: "Scale high-volume farm operations",
    description:
      "For larger farms, food suppliers, and farm networks managing higher order volume.",
    bestFor: "High-volume farms, co-ops, suppliers, and multi-location sellers.",
    tools: [
      "Premium marketplace visibility",
      "Bulk order management",
      "AI demand forecasting",
      "Advanced reporting",
      "Dedicated support",
      "Priority delivery coordination",
    ],
    growthTools: [
      "Forecast demand",
      "Manage larger customers",
      "Support bulk and recurring orders",
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
      "Start Farmer Plan",
      `${selectedPlan.name} selected at $${selectedPlan.price.toFixed(
        2
      )}/month.\n\nNext step: connect this button to your Stripe farmer subscription checkout endpoint.`
    );
  }

  function goBackToDashboard() {
    router.push("/farmer/dashboard" as any);
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <TouchableOpacity style={styles.backButton} onPress={goBackToDashboard}>
          <Ionicons name="arrow-back-outline" size={22} color="#FFFFFF" />
        </TouchableOpacity>

        <Text style={styles.eyebrow}>Farm2Home Business Tools</Text>
        <Text style={styles.title}>Choose the right tools to grow your farm</Text>
        <Text style={styles.subtitle}>
          Pick a plan based on how your farm sells: simple product listings,
          recurring customer bundles, or high-volume farm operations.
        </Text>
      </View>

      <View style={styles.flowCard}>
        <Text style={styles.flowTitle}>How this helps your farm</Text>

        <FlowStep
          number="1"
          title="List your farm products"
          text="Add produce, meat, seafood, dairy, baked goods, or custom farm items."
        />
        <FlowStep
          number="2"
          title="Create customer bundles"
          text="Build monthly or bi-monthly boxes customers can subscribe to."
        />
        <FlowStep
          number="3"
          title="Fulfill local orders"
          text="Offer pickup, local delivery, or shipping based on your farm setup."
        />
        <FlowStep
          number="4"
          title="Use analytics to grow"
          text="Track sales, reviews, demand, and recurring subscription revenue."
        />
      </View>

      <View style={styles.selectedCard}>
        <Text style={styles.selectedLabel}>Selected Business Plan</Text>
        <Text style={styles.selectedName}>{selectedPlan.name}</Text>
        <Text style={styles.selectedHeadline}>{selectedPlan.headline}</Text>
        <Text style={styles.selectedPrice}>
          ${selectedPlan.price.toFixed(2)} / month
        </Text>
        <Text style={styles.selectedText}>{selectedPlan.description}</Text>

        <View style={styles.bestForBox}>
          <Text style={styles.bestForLabel}>Best for</Text>
          <Text style={styles.bestForText}>{selectedPlan.bestFor}</Text>
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={startPlan}>
          <Ionicons name="card-outline" size={19} color="#FFFFFF" />
          <Text style={styles.primaryText}>Start {selectedPlan.name}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Choose Your Farmer Plan</Text>

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
            activeOpacity={0.9}
          >
            <View style={styles.planHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.badge}>{plan.badge}</Text>
                <Text style={styles.planName}>{plan.name}</Text>
                <Text style={styles.planHeadline}>{plan.headline}</Text>
                <Text style={styles.planDescription}>{plan.description}</Text>
              </View>

              <View style={styles.priceBox}>
                <Text style={styles.planPrice}>${plan.price.toFixed(2)}</Text>
                <Text style={styles.perMonth}>/mo</Text>
              </View>
            </View>

            <Text style={styles.toolHeader}>Included Tools</Text>
            <View style={styles.benefitList}>
              {plan.tools.map((tool) => (
                <Benefit key={tool} text={tool} />
              ))}
            </View>

            <Text style={styles.toolHeader}>Business Growth</Text>
            <View style={styles.growthList}>
              {plan.growthTools.map((tool) => (
                <Text key={tool} style={styles.growthPill}>
                  {tool}
                </Text>
              ))}
            </View>

            {active ? (
              <View style={styles.activeFooter}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={18}
                  color={farmTheme.colors.primary}
                />
                <Text style={styles.activeFooterText}>Selected plan</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        );
      })}

      <View style={styles.bottomCard}>
        <Text style={styles.bottomTitle}>Recommended setup</Text>
        <Text style={styles.bottomText}>
          Use Farm Growth for the best farmer business flow: list products,
          create bundles, accept recurring customers, manage orders, and view
          revenue analytics.
        </Text>
      </View>

      <View style={{ height: 90 }} />
    </ScrollView>
  );
}

function FlowStep({
  number,
  title,
  text,
}: {
  number: string;
  title: string;
  text: string;
}) {
  return (
    <View style={styles.flowStep}>
      <Text style={styles.flowNumber}>{number}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.flowStepTitle}>{title}</Text>
        <Text style={styles.flowStepText}>{text}</Text>
      </View>
    </View>
  );
}

function Benefit({ text }: { text: string }) {
  return (
    <View style={styles.benefitRow}>
      <Ionicons
        name="checkmark-circle-outline"
        size={18}
        color={farmTheme.colors.primary}
      />
      <Text style={styles.benefit}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: farmTheme.colors.background },

  hero: {
    backgroundColor: farmTheme.colors.primary,
    paddingTop: 58,
    paddingHorizontal: 20,
    paddingBottom: 32,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },

  eyebrow: {
    color: "#D1FAE5",
    fontWeight: "900",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  title: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "900",
    marginBottom: 10,
    lineHeight: 39,
  },

  subtitle: { color: "#E8F5E9", fontWeight: "700", lineHeight: 23 },

  flowCard: {
    backgroundColor: "#FFFFFF",
    margin: 18,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    ...farmTheme.shadow,
  },

  flowTitle: {
    color: farmTheme.colors.text,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 12,
  },

  flowStep: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
    alignItems: "flex-start",
  },

  flowNumber: {
    width: 32,
    height: 32,
    borderRadius: 13,
    backgroundColor: "#E9F8EF",
    color: farmTheme.colors.primary,
    fontWeight: "900",
    textAlign: "center",
    textAlignVertical: "center",
    overflow: "hidden",
  },

  flowStepTitle: {
    color: farmTheme.colors.text,
    fontWeight: "900",
    fontSize: 15,
  },

  flowStepText: {
    color: farmTheme.colors.mutedText,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 3,
  },

  selectedCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    marginBottom: 18,
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

  selectedHeadline: {
    color: farmTheme.colors.primary,
    fontWeight: "900",
    fontSize: 16,
    marginTop: 4,
  },

  selectedPrice: {
    color: farmTheme.colors.primary,
    fontSize: 26,
    fontWeight: "900",
    marginTop: 8,
  },

  selectedText: {
    color: farmTheme.colors.mutedText,
    fontWeight: "700",
    lineHeight: 22,
    marginTop: 8,
  },

  bestForBox: {
    backgroundColor: "#F0FDF4",
    borderRadius: 18,
    padding: 14,
    marginTop: 14,
    marginBottom: 14,
  },

  bestForLabel: {
    color: farmTheme.colors.primary,
    fontWeight: "900",
    marginBottom: 4,
  },

  bestForText: {
    color: farmTheme.colors.text,
    fontWeight: "800",
    lineHeight: 20,
  },

  primaryButton: {
    backgroundColor: farmTheme.colors.primary,
    padding: 15,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
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

  planHeadline: {
    color: farmTheme.colors.primary,
    fontWeight: "900",
    marginTop: 4,
  },

  planDescription: {
    color: farmTheme.colors.mutedText,
    fontWeight: "700",
    lineHeight: 21,
    marginTop: 5,
  },

  priceBox: { alignItems: "flex-end" },

  planPrice: { color: farmTheme.colors.primary, fontSize: 22, fontWeight: "900" },

  perMonth: { color: farmTheme.colors.mutedText, fontWeight: "800" },

  toolHeader: {
    color: farmTheme.colors.text,
    fontWeight: "900",
    marginTop: 16,
    marginBottom: 8,
  },

  benefitList: { gap: 8 },

  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  benefit: {
    flex: 1,
    color: farmTheme.colors.text,
    fontWeight: "800",
    lineHeight: 22,
  },

  growthList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  growthPill: {
    backgroundColor: "#E9F8EF",
    color: farmTheme.colors.primary,
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    overflow: "hidden",
  },

  activeFooter: {
    marginTop: 16,
    backgroundColor: "#E9F8EF",
    borderRadius: 15,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  activeFooterText: {
    color: farmTheme.colors.primary,
    fontWeight: "900",
  },

  bottomCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    marginTop: 4,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    ...farmTheme.shadow,
  },

  bottomTitle: {
    color: farmTheme.colors.text,
    fontWeight: "900",
    fontSize: 19,
  },

  bottomText: {
    color: farmTheme.colors.mutedText,
    fontWeight: "700",
    lineHeight: 22,
    marginTop: 8,
  },
});