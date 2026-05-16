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

type MembershipPlan = {
  id: string;
  name: string;
  price: number;
  billing: string;
  badge: string;
  description: string;
  benefits: string[];
  recommended?: boolean;
};

const plans: MembershipPlan[] = [
  {
    id: "fresh-start",
    name: "Fresh Start",
    price: 9.99,
    billing: "month",
    badge: "Basic",
    description: "Best for occasional local grocery orders.",
    benefits: [
      "Reduced delivery fees",
      "Access to local farm deals",
      "Order tracking",
      "Standard customer support",
    ],
  },
  {
    id: "farm2home-plus",
    name: "Farm2Home Plus",
    price: 19.99,
    billing: "month",
    badge: "Most Popular",
    description: "Best for families ordering weekly fresh food.",
    benefits: [
      "Free delivery on eligible orders",
      "Priority customer support",
      "Premium marketplace deals",
      "Early access to nearby farms",
      "AI grocery recommendations",
    ],
    recommended: true,
  },
  {
    id: "family-harvest",
    name: "Family Harvest",
    price: 34.99,
    billing: "month",
    badge: "Family Plan",
    description: "Best for larger households and recurring grocery needs.",
    benefits: [
      "Free delivery on more eligible orders",
      "Family grocery bundles",
      "Recurring produce subscriptions",
      "AI meal planning preview",
      "Priority refund review",
      "Premium farm partner access",
    ],
  },
];

export default function SubscriptionMembership() {
  const [selectedPlanId, setSelectedPlanId] = useState("farm2home-plus");

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === selectedPlanId) || plans[1],
    [selectedPlanId]
  );

  function startMembership() {
    Alert.alert(
      "Membership Selected",
      `${selectedPlan.name} selected at $${selectedPlan.price.toFixed(
        2
      )}/${selectedPlan.billing}. Connect this screen to Stripe subscription checkout next.`
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Farm2Home Membership</Text>
        <Text style={styles.title}>Save More on Fresh Local Food</Text>
        <Text style={styles.subtitle}>
          Unlock free delivery, premium farm deals, AI grocery recommendations,
          and priority support.
        </Text>

        <View style={styles.heroBadge}>
          <Text style={styles.heroBadgeText}>Recurring Revenue Layer</Text>
        </View>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Selected Plan</Text>
        <Text style={styles.summaryPlan}>{selectedPlan.name}</Text>
        <Text style={styles.summaryPrice}>
          ${selectedPlan.price.toFixed(2)}
          <Text style={styles.summaryBilling}> / {selectedPlan.billing}</Text>
        </Text>
        <Text style={styles.summaryDescription}>{selectedPlan.description}</Text>
      </View>

      <Text style={styles.sectionTitle}>Choose Your Plan</Text>

      {plans.map((plan) => {
        const selected = selectedPlanId === plan.id;

        return (
          <TouchableOpacity
            key={plan.id}
            style={[
              styles.planCard,
              selected && styles.planCardSelected,
              plan.recommended && styles.planCardRecommended,
            ]}
            onPress={() => setSelectedPlanId(plan.id)}
            activeOpacity={0.9}
          >
            <View style={styles.planHeader}>
              <View style={{ flex: 1 }}>
                <View style={styles.badgeRow}>
                  <Text
                    style={[
                      styles.planBadge,
                      plan.recommended && styles.recommendedBadge,
                    ]}
                  >
                    {plan.badge}
                  </Text>

                  {selected ? (
                    <Text style={styles.selectedBadge}>Selected</Text>
                  ) : null}
                </View>

                <Text style={styles.planName}>{plan.name}</Text>
                <Text style={styles.planDescription}>{plan.description}</Text>
              </View>

              <View style={styles.priceBlock}>
                <Text style={styles.planPrice}>
                  ${plan.price.toFixed(2)}
                </Text>
                <Text style={styles.planBilling}>/{plan.billing}</Text>
              </View>
            </View>

            <View style={styles.benefitsList}>
              {plan.benefits.map((benefit) => (
                <View key={benefit} style={styles.benefitRow}>
                  <Text style={styles.check}>✓</Text>
                  <Text style={styles.benefitText}>{benefit}</Text>
                </View>
              ))}
            </View>
          </TouchableOpacity>
        );
      })}

      <View style={styles.valueCard}>
        <Text style={styles.valueTitle}>Premium Benefits</Text>

        <View style={styles.valueGrid}>
          <View style={styles.valueBox}>
            <Text style={styles.valueIcon}>🚚</Text>
            <Text style={styles.valueLabel}>Free Delivery</Text>
            <Text style={styles.valueText}>Save on weekly grocery orders.</Text>
          </View>

          <View style={styles.valueBox}>
            <Text style={styles.valueIcon}>🥕</Text>
            <Text style={styles.valueLabel}>Farm Deals</Text>
            <Text style={styles.valueText}>Unlock member-only produce pricing.</Text>
          </View>

          <View style={styles.valueBox}>
            <Text style={styles.valueIcon}>🤖</Text>
            <Text style={styles.valueLabel}>AI Shopping</Text>
            <Text style={styles.valueText}>Get smart grocery recommendations.</Text>
          </View>

          <View style={styles.valueBox}>
            <Text style={styles.valueIcon}>⭐</Text>
            <Text style={styles.valueLabel}>Priority Help</Text>
            <Text style={styles.valueText}>Get faster support and refund review.</Text>
          </View>
        </View>
      </View>

      <View style={styles.ctaCard}>
        <Text style={styles.ctaTitle}>Ready to upgrade?</Text>
        <Text style={styles.ctaText}>
          Start with {selectedPlan.name} and connect this page to Stripe
          subscription checkout when ready.
        </Text>

        <TouchableOpacity style={styles.primaryButton} onPress={startMembership}>
          <Text style={styles.primaryText}>
            Start {selectedPlan.name}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.outlineButton}
          onPress={() => router.push("/customer/marketplace")}
        >
          <Text style={styles.outlineText}>Back to Marketplace</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.nextCard}>
        <Text style={styles.nextTitle}>Next Premium Add-ons</Text>
        <Text style={styles.nextText}>• Loyalty rewards</Text>
        <Text style={styles.nextText}>• Referral credits</Text>
        <Text style={styles.nextText}>• Recurring produce boxes</Text>
        <Text style={styles.nextText}>• AI meal planning</Text>
        <Text style={styles.nextText}>• Premium grocery bundles</Text>
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
    fontSize: 34,
    fontWeight: "900",
    marginBottom: 10,
    lineHeight: 40,
  },

  subtitle: {
    color: "#E8F5E9",
    fontWeight: "700",
    lineHeight: 23,
  },

  heroBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#FACC15",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    marginTop: 18,
  },

  heroBadgeText: {
    color: "#1F2937",
    fontWeight: "900",
  },

  summaryCard: {
    backgroundColor: "#FFFFFF",
    margin: 18,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    ...farmTheme.shadow,
  },

  summaryTitle: {
    color: farmTheme.colors.mutedText,
    fontWeight: "900",
    marginBottom: 6,
  },

  summaryPlan: {
    color: farmTheme.colors.text,
    fontSize: 24,
    fontWeight: "900",
  },

  summaryPrice: {
    color: farmTheme.colors.primary,
    fontSize: 30,
    fontWeight: "900",
    marginTop: 6,
  },

  summaryBilling: {
    color: farmTheme.colors.mutedText,
    fontSize: 15,
    fontWeight: "800",
  },

  summaryDescription: {
    color: farmTheme.colors.mutedText,
    fontWeight: "700",
    lineHeight: 22,
    marginTop: 8,
  },

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

  planCardSelected: {
    borderColor: farmTheme.colors.primary,
    borderWidth: 2,
  },

  planCardRecommended: {
    backgroundColor: "#F0FDF4",
  },

  planHeader: {
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

  planBadge: {
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

  planName: {
    color: farmTheme.colors.text,
    fontSize: 22,
    fontWeight: "900",
  },

  planDescription: {
    color: farmTheme.colors.mutedText,
    fontWeight: "700",
    marginTop: 5,
    lineHeight: 21,
  },

  priceBlock: {
    alignItems: "flex-end",
  },

  planPrice: {
    color: farmTheme.colors.primary,
    fontSize: 22,
    fontWeight: "900",
  },

  planBilling: {
    color: farmTheme.colors.mutedText,
    fontWeight: "800",
  },

  benefitsList: {
    marginTop: 14,
    gap: 10,
  },

  benefitRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },

  check: {
    color: farmTheme.colors.primary,
    fontSize: 18,
    fontWeight: "900",
  },

  benefitText: {
    flex: 1,
    color: farmTheme.colors.text,
    fontWeight: "800",
    lineHeight: 22,
  },

  valueCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    marginTop: 4,
    marginBottom: 18,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    ...farmTheme.shadow,
  },

  valueTitle: {
    color: farmTheme.colors.text,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 14,
  },

  valueGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },

  valueBox: {
    width: "47%",
    backgroundColor: "#F9FAFB",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  valueIcon: {
    fontSize: 28,
    marginBottom: 8,
  },

  valueLabel: {
    color: farmTheme.colors.text,
    fontWeight: "900",
    marginBottom: 4,
  },

  valueText: {
    color: farmTheme.colors.mutedText,
    fontWeight: "700",
    lineHeight: 19,
  },

  ctaCard: {
    backgroundColor: "#064E3B",
    marginHorizontal: 18,
    marginBottom: 18,
    borderRadius: 22,
    padding: 18,
  },

  ctaTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 8,
  },

  ctaText: {
    color: "#BBF7D0",
    fontWeight: "700",
    lineHeight: 22,
    marginBottom: 16,
  },

  primaryButton: {
    backgroundColor: "#10B981",
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 12,
  },

  primaryText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  outlineButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
  },

  outlineText: {
    color: "#BBF7D0",
    fontWeight: "900",
  },

  nextCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
  },

  nextTitle: {
    color: farmTheme.colors.text,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 10,
  },

  nextText: {
    color: farmTheme.colors.mutedText,
    fontWeight: "800",
    lineHeight: 25,
  },
});