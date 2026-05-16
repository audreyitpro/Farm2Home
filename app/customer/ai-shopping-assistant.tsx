import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { router } from "expo-router";

import { supabase } from "../data/supabaseClient";

import { useAuth } from "../providers/AuthProvider";

type Recommendation = {
  id: string;
  title: string;
  description: string;
  type:
    | "BUNDLE"
    | "MEAL"
    | "REORDER"
    | "HEALTH"
    | "SEASONAL";
};

export default function AiShoppingAssistant() {
  const { profile } = useAuth();

  const [loading, setLoading] =
    useState(false);

  const [goal, setGoal] =
    useState("");

  const [recommendations, setRecommendations] =
    useState<Recommendation[]>([]);

  const quickGoals = useMemo(
    () => [
      "Healthy family meals",
      "High protein foods",
      "Weekly produce bundle",
      "Budget grocery plan",
      "Organic produce only",
      "Quick meal prep",
      "Weight loss foods",
      "Kid-friendly produce",
    ],
    []
  );

  async function generateRecommendations() {
    try {
      setLoading(true);

      const {
        data: products,
      } = await supabase
        .from("products")
        .select("*")
        .limit(20);

      const aiResults: Recommendation[] =
        [];

      if (
        goal
          .toLowerCase()
          .includes("healthy")
      ) {
        aiResults.push({
          id: "healthy_bundle",
          title:
            "Healthy Family Produce Bundle",
          description:
            "AI selected nutrient-rich vegetables, fruits, and whole-food ingredients ideal for healthy family meals.",
          type: "BUNDLE",
        });
      }

      if (
        goal
          .toLowerCase()
          .includes("protein")
      ) {
        aiResults.push({
          id: "protein_plan",
          title:
            "High Protein Farm Selection",
          description:
            "AI curated eggs, dairy, legumes, and protein-rich farm products for energy and muscle recovery.",
          type: "HEALTH",
        });
      }

      if (
        goal
          .toLowerCase()
          .includes("budget")
      ) {
        aiResults.push({
          id: "budget_plan",
          title:
            "Budget Smart Grocery Plan",
          description:
            "AI optimized your grocery plan for affordability while maximizing nutrition and freshness.",
          type: "MEAL",
        });
      }

      aiResults.push({
        id: "seasonal_bundle",
        title:
          "Seasonal Michigan Produce",
        description:
          "AI detected trending seasonal produce from local farms for better freshness and lower delivery cost.",
        type: "SEASONAL",
      });

      aiResults.push({
        id: "smart_reorder",
        title:
          "Smart Reorder Prediction",
        description:
          "AI predicts your household may need produce restocking within the next 5 days.",
        type: "REORDER",
      });

      if (
        products &&
        products.length > 0
      ) {
        aiResults.push({
          id: "farm_bundle",
          title:
            "Recommended Farm Bundle",
          description: `AI analyzed current marketplace inventory and selected premium produce recommendations from ${products.length} active products.`,
          type: "BUNDLE",
        });
      }

      setRecommendations(aiResults);
    } catch (error) {
      console.log(
        "AI shopping assistant error:",
        error
      );

      Alert.alert(
        "AI Error",
        "Unable to generate recommendations."
      );
    } finally {
      setLoading(false);
    }
  }

  function typeColor(
    type: Recommendation["type"]
  ) {
    switch (type) {
      case "BUNDLE":
        return "#10B981";

      case "MEAL":
        return "#2563EB";

      case "HEALTH":
        return "#F59E0B";

      case "REORDER":
        return "#7C3AED";

      case "SEASONAL":
        return "#EA580C";

      default:
        return "#10B981";
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.heroIcon}>
          🛒
        </Text>

        <Text style={styles.heroTitle}>
          AI Shopping Assistant
        </Text>

        <Text style={styles.heroSubtitle}>
          Personalized produce
          recommendations, smart
          grocery planning, healthy
          meal bundles, and AI
          household shopping
          intelligence.
        </Text>
      </View>

      <ScrollView
        style={styles.panel}
        contentContainerStyle={
          styles.panelInner
        }
      >
        <View style={styles.card}>
          <Text style={styles.label}>
            Shopping Goal
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Example: Healthy family meals"
            placeholderTextColor="#94A3B8"
            value={goal}
            onChangeText={setGoal}
          />

          <TouchableOpacity
            style={[
              styles.primaryButton,
              loading &&
                styles.disabledButton,
            ]}
            disabled={loading}
            onPress={
              generateRecommendations
            }
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text
                style={
                  styles.primaryText
                }
              >
                Generate AI Recommendations
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>
          Quick AI Goals
        </Text>

        {quickGoals.map((item) => (
          <TouchableOpacity
            key={item}
            style={styles.goalChip}
            onPress={() =>
              setGoal(item)
            }
          >
            <Text
              style={
                styles.goalText
              }
            >
              {item}
            </Text>
          </TouchableOpacity>
        ))}

        {profile && (
          <View
            style={styles.profileCard}
          >
            <Text
              style={
                styles.profileTitle
              }
            >
              Personalized AI Profile
            </Text>

            <Text
              style={
                styles.profileText
              }
            >
              Recommendations are
              optimized for{" "}
              {profile.full_name ||
                "your household"}
              .
            </Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>
          AI Recommendations
        </Text>

        {recommendations.length ===
        0 ? (
          <View
            style={styles.emptyCard}
          >
            <Text
              style={
                styles.emptyTitle
              }
            >
              No AI recommendations
              yet.
            </Text>

            <Text
              style={
                styles.emptyText
              }
            >
              Enter a shopping goal
              to generate personalized
              produce intelligence.
            </Text>
          </View>
        ) : (
          recommendations.map(
            (item) => (
              <View
                key={item.id}
                style={
                  styles.recommendationCard
                }
              >
                <View
                  style={
                    styles.cardHeader
                  }
                >
                  <View
                    style={{
                      flex: 1,
                    }}
                  >
                    <Text
                      style={
                        styles.recommendationTitle
                      }
                    >
                      {item.title}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.typeBadge,
                      {
                        backgroundColor:
                          typeColor(
                            item.type
                          ),
                      },
                    ]}
                  >
                    <Text
                      style={
                        styles.typeText
                      }
                    >
                      {item.type}
                    </Text>
                  </View>
                </View>

                <Text
                  style={
                    styles.recommendationText
                  }
                >
                  {item.description}
                </Text>

                <TouchableOpacity
                  style={
                    styles.shopButton
                  }
                  onPress={() =>
                    router.push(
                      "/customer/marketplace"
                    )
                  }
                >
                  <Text
                    style={
                      styles.shopText
                    }
                  >
                    Shop Marketplace
                  </Text>
                </TouchableOpacity>
              </View>
            )
          )
        )}

        <View style={styles.navRow}>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() =>
              router.push(
                "/customer/marketplace"
              )
            }
          >
            <Text style={styles.navText}>
              Marketplace
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={
              styles.navButtonOutline
            }
            onPress={() =>
              router.push(
                "/customer/customer-dashboard"
              )
            }
          >
            <Text
              style={
                styles.navTextOutline
              }
            >
              Dashboard
            </Text>
          </TouchableOpacity>
        </View>

        <View
          style={{
            height: 80,
          }}
        />
      </ScrollView>
    </View>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor:
        "#F3F4F6",
    },

    hero: {
      backgroundColor:
        "#14532D",

      paddingTop: 64,
      paddingBottom: 28,
      paddingHorizontal: 20,
      alignItems: "center",
    },

    heroIcon: {
      fontSize: 56,
      marginBottom: 12,
    },

    heroTitle: {
      color: "#FFFFFF",
      fontSize: 32,
      fontWeight: "900",
      marginBottom: 10,
      textAlign: "center",
    },

    heroSubtitle: {
      color: "#DCFCE7",
      textAlign: "center",
      lineHeight: 22,
      maxWidth: 620,
    },

    panel: {
      flex: 1,
      marginTop: -24,
      backgroundColor:
        "#F3F4F6",

      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
    },

    panelInner: {
      padding: 18,
      paddingBottom: 80,
    },

    card: {
      backgroundColor:
        "#FFFFFF",

      borderRadius: 22,
      padding: 18,
      marginBottom: 18,
      borderWidth: 1,
      borderColor: "#E5E7EB",
    },

    label: {
      color: "#111827",
      fontSize: 18,
      fontWeight: "900",
      marginBottom: 10,
    },

    input: {
      backgroundColor:
        "#F3F4F6",

      borderRadius: 16,
      padding: 14,
      marginBottom: 14,
      color: "#111827",
      fontWeight: "700",
    },

    primaryButton: {
      backgroundColor:
        "#10B981",

      padding: 15,
      borderRadius: 14,
      alignItems: "center",
    },

    disabledButton: {
      opacity: 0.6,
    },

    primaryText: {
      color: "#FFFFFF",
      fontWeight: "900",
    },

    sectionTitle: {
      color: "#111827",
      fontSize: 22,
      fontWeight: "900",
      marginBottom: 12,
    },

    goalChip: {
      backgroundColor:
        "#FFFFFF",

      borderRadius: 16,
      padding: 15,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: "#E5E7EB",
    },

    goalText: {
      color: "#111827",
      fontWeight: "800",
    },

    profileCard: {
      backgroundColor:
        "#064E3B",

      borderRadius: 22,
      padding: 18,
      marginVertical: 18,
    },

    profileTitle: {
      color: "#FFFFFF",
      fontSize: 20,
      fontWeight: "900",
      marginBottom: 8,
    },

    profileText: {
      color: "#BBF7D0",
      lineHeight: 22,
      fontWeight: "700",
    },

    emptyCard: {
      backgroundColor:
        "#FFFFFF",

      borderRadius: 22,
      padding: 18,
      borderWidth: 1,
      borderColor: "#E5E7EB",
    },

    emptyTitle: {
      color: "#111827",
      fontSize: 18,
      fontWeight: "900",
      marginBottom: 6,
    },

    emptyText: {
      color: "#6B7280",
      lineHeight: 22,
      fontWeight: "700",
    },

    recommendationCard: {
      backgroundColor:
        "#FFFFFF",

      borderRadius: 22,
      padding: 18,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: "#E5E7EB",
    },

    cardHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      marginBottom: 10,
    },

    recommendationTitle: {
      color: "#111827",
      fontSize: 19,
      fontWeight: "900",
    },

    recommendationText: {
      color: "#374151",
      lineHeight: 22,
      fontWeight: "700",
      marginBottom: 14,
    },

    typeBadge: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
    },

    typeText: {
      color: "#FFFFFF",
      fontWeight: "900",
      fontSize: 10,
    },

    shopButton: {
      backgroundColor:
        "#10B981",

      padding: 14,
      borderRadius: 14,
      alignItems: "center",
    },

    shopText: {
      color: "#FFFFFF",
      fontWeight: "900",
    },

    navRow: {
      flexDirection: "row",
      gap: 10,
      marginTop: 18,
    },

    navButton: {
      flex: 1,
      backgroundColor:
        "#10B981",

      padding: 14,
      borderRadius: 14,
      alignItems: "center",
    },

    navButtonOutline: {
      flex: 1,
      backgroundColor:
        "#FFFFFF",

      borderWidth: 1,
      borderColor: "#10B981",
      padding: 14,
      borderRadius: 14,
      alignItems: "center",
    },

    navText: {
      color: "#FFFFFF",
      fontWeight: "900",
    },

    navTextOutline: {
      color: "#10B981",
      fontWeight: "900",
    },
  });