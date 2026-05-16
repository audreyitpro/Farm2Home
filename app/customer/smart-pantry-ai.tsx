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

type PantryItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  estimatedDaysLeft: number;
  category: string;
};

type AiInsight = {
  id: string;
  title: string;
  message: string;
  type:
    | "REORDER"
    | "WASTE"
    | "HEALTH"
    | "SAVINGS";
};

export default function SmartPantryAI() {
  const { profile } = useAuth();

  const [loading, setLoading] =
    useState(false);

  const [itemName, setItemName] =
    useState("");

  const [quantity, setQuantity] =
    useState("");

  const [pantry, setPantry] =
    useState<PantryItem[]>([
      {
        id: "1",
        name: "Organic Apples",
        quantity: 5,
        unit: "pcs",
        estimatedDaysLeft: 3,
        category: "Fruit",
      },
      {
        id: "2",
        name: "Fresh Spinach",
        quantity: 1,
        unit: "bag",
        estimatedDaysLeft: 2,
        category: "Vegetable",
      },
    ]);

  const [insights, setInsights] =
    useState<AiInsight[]>([]);

  const quickAdd = useMemo(
    () => [
      "Milk",
      "Eggs",
      "Bananas",
      "Chicken",
      "Spinach",
      "Tomatoes",
      "Potatoes",
      "Strawberries",
    ],
    []
  );

  function addPantryItem() {
    if (
      !itemName.trim() ||
      !quantity.trim()
    ) {
      Alert.alert(
        "Missing Info",
        "Enter item name and quantity."
      );

      return;
    }

    const newItem: PantryItem = {
      id: Date.now().toString(),
      name: itemName,
      quantity:
        Number(quantity) || 1,
      unit: "pcs",
      estimatedDaysLeft:
        Math.floor(
          Math.random() * 7
        ) + 1,
      category: "General",
    };

    setPantry((prev) => [
      ...prev,
      newItem,
    ]);

    setItemName("");
    setQuantity("");
  }

  async function generateAiInsights() {
    try {
      setLoading(true);

      const aiResults: AiInsight[] =
        [];

      const lowItems =
        pantry.filter(
          (item) =>
            item.estimatedDaysLeft <=
            3
        );

      if (
        lowItems.length > 0
      ) {
        aiResults.push({
          id: "reorder",
          title:
            "Smart Reorder Recommendation",
          message: `AI predicts ${
            lowItems.length
          } pantry items may need replenishment within the next few days.`,
          type: "REORDER",
        });
      }

      const produceItems =
        pantry.filter((item) =>
          [
            "Fruit",
            "Vegetable",
          ].includes(
            item.category
          )
        );

      if (
        produceItems.length > 0
      ) {
        aiResults.push({
          id: "waste",
          title:
            "Food Waste Prevention",
          message:
            "AI recommends using your fresh produce soon to reduce spoilage and maximize nutrition.",
          type: "WASTE",
        });
      }

      aiResults.push({
        id: "health",
        title:
          "Healthy Meal Planning",
        message:
          "AI suggests building balanced meals around your current pantry ingredients for healthier household nutrition.",
        type: "HEALTH",
      });

      aiResults.push({
        id: "savings",
        title:
          "Household Savings Opportunity",
        message:
          "AI detected opportunities to save money using recurring produce bundles and smart reorder scheduling.",
        type: "SAVINGS",
      });

      setInsights(aiResults);
    } catch (error) {
      console.log(
        "Smart pantry AI error:",
        error
      );

      Alert.alert(
        "AI Error",
        "Unable to generate pantry insights."
      );
    } finally {
      setLoading(false);
    }
  }

  function typeColor(
    type: AiInsight["type"]
  ) {
    switch (type) {
      case "REORDER":
        return "#10B981";

      case "WASTE":
        return "#DC2626";

      case "HEALTH":
        return "#2563EB";

      case "SAVINGS":
        return "#F59E0B";

      default:
        return "#10B981";
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.heroIcon}>
          🥬
        </Text>

        <Text style={styles.heroTitle}>
          Smart Pantry AI
        </Text>

        <Text style={styles.heroSubtitle}>
          AI-powered household
          inventory management,
          smart grocery automation,
          predictive reordering, and
          food waste reduction.
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
            Add Pantry Item
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Item name"
            placeholderTextColor="#94A3B8"
            value={itemName}
            onChangeText={setItemName}
          />

          <TextInput
            style={styles.input}
            placeholder="Quantity"
            placeholderTextColor="#94A3B8"
            keyboardType="numeric"
            value={quantity}
            onChangeText={setQuantity}
          />

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={addPantryItem}
          >
            <Text
              style={
                styles.primaryText
              }
            >
              Add Pantry Item
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>
          Quick Add
        </Text>

        {quickAdd.map((item) => (
          <TouchableOpacity
            key={item}
            style={styles.quickChip}
            onPress={() =>
              setItemName(item)
            }
          >
            <Text
              style={
                styles.quickText
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
              Household AI Profile
            </Text>

            <Text
              style={
                styles.profileText
              }
            >
              Smart pantry automation
              is personalized for{" "}
              {profile.full_name ||
                "your household"}
              .
            </Text>
          </View>
        )}

        <View style={styles.aiCard}>
          <Text style={styles.aiTitle}>
            AI Pantry Intelligence
          </Text>

          <TouchableOpacity
            style={[
              styles.generateButton,
              loading &&
                styles.disabledButton,
            ]}
            disabled={loading}
            onPress={
              generateAiInsights
            }
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text
                style={
                  styles.generateText
                }
              >
                Generate AI Insights
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>
          Pantry Inventory
        </Text>

        {pantry.map((item) => (
          <View
            key={item.id}
            style={styles.pantryCard}
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
                    styles.pantryTitle
                  }
                >
                  {item.name}
                </Text>

                <Text
                  style={
                    styles.pantrySub
                  }
                >
                  {item.quantity}{" "}
                  {item.unit}
                </Text>
              </View>

              <View
                style={
                  styles.daysBadge
                }
              >
                <Text
                  style={
                    styles.daysText
                  }
                >
                  {
                    item.estimatedDaysLeft
                  }
                  d
                </Text>
              </View>
            </View>

            <Text
              style={
                styles.categoryText
              }
            >
              Category:{" "}
              {item.category}
            </Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>
          AI Household Insights
        </Text>

        {insights.length === 0 ? (
          <View
            style={styles.emptyCard}
          >
            <Text
              style={
                styles.emptyTitle
              }
            >
              No AI insights yet.
            </Text>

            <Text
              style={
                styles.emptyText
              }
            >
              Generate pantry
              intelligence to activate
              smart household
              automation.
            </Text>
          </View>
        ) : (
          insights.map((item) => (
            <View
              key={item.id}
              style={
                styles.insightCard
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
                      styles.insightTitle
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
                  styles.insightText
                }
              >
                {item.message}
              </Text>
            </View>
          ))
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
                "/customer/ai-shopping-assistant"
              )
            }
          >
            <Text
              style={
                styles.navTextOutline
              }
            >
              AI Shopping
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
        "#166534",

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
      marginBottom: 12,
      color: "#111827",
      fontWeight: "700",
    },

    primaryButton: {
      backgroundColor:
        "#10B981",

      padding: 15,
      borderRadius: 14,
      alignItems: "center",
      marginTop: 4,
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

    quickChip: {
      backgroundColor:
        "#FFFFFF",

      borderRadius: 16,
      padding: 15,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: "#E5E7EB",
    },

    quickText: {
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

    aiCard: {
      backgroundColor:
        "#111827",

      borderRadius: 24,
      padding: 20,
      marginBottom: 18,
    },

    aiTitle: {
      color: "#FFFFFF",
      fontSize: 24,
      fontWeight: "900",
      marginBottom: 14,
    },

    generateButton: {
      backgroundColor:
        "#10B981",

      padding: 15,
      borderRadius: 14,
      alignItems: "center",
    },

    disabledButton: {
      opacity: 0.6,
    },

    generateText: {
      color: "#FFFFFF",
      fontWeight: "900",
    },

    pantryCard: {
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

    pantryTitle: {
      color: "#111827",
      fontSize: 19,
      fontWeight: "900",
    },

    pantrySub: {
      color: "#6B7280",
      fontWeight: "700",
      marginTop: 4,
    },

    daysBadge: {
      backgroundColor:
        "#10B981",

      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
    },

    daysText: {
      color: "#FFFFFF",
      fontWeight: "900",
      fontSize: 10,
    },

    categoryText: {
      color: "#374151",
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

    insightCard: {
      backgroundColor:
        "#FFFFFF",

      borderRadius: 22,
      padding: 18,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: "#E5E7EB",
    },

    insightTitle: {
      color: "#111827",
      fontSize: 19,
      fontWeight: "900",
    },

    insightText: {
      color: "#374151",
      lineHeight: 22,
      fontWeight: "700",
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