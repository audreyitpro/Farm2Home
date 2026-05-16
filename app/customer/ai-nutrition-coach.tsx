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

type NutritionMode = "Family" | "Weight Loss" | "Athlete" | "Heart Healthy";

type GroceryScore = {
  id: string;
  name: string;
  farmName: string;
  score: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  recommendation: string;
};

const groceryScores: GroceryScore[] = [
  {
    id: "spinach-score",
    name: "Fresh Spinach",
    farmName: "Leafy Acres",
    score: 96,
    calories: 25,
    protein: 3,
    carbs: 4,
    fat: 0,
    recommendation: "Excellent for vitamins, fiber, and low-calorie meals.",
  },
  {
    id: "eggs-score",
    name: "Farm Fresh Eggs",
    farmName: "Green Valley Farm",
    score: 88,
    calories: 140,
    protein: 12,
    carbs: 1,
    fat: 10,
    recommendation: "Strong protein option for breakfast and meal prep.",
  },
  {
    id: "chicken-score",
    name: "Pasture Raised Chicken",
    farmName: "Oak Hill Farms",
    score: 91,
    calories: 220,
    protein: 34,
    carbs: 0,
    fat: 8,
    recommendation: "Great lean protein for family dinners and athletes.",
  },
  {
    id: "berries-score",
    name: "Mixed Berry Pack",
    farmName: "Berry Patch Farm",
    score: 94,
    calories: 80,
    protein: 1,
    carbs: 18,
    fat: 0,
    recommendation: "Good antioxidant-rich snack with natural sweetness.",
  },
];

export default function AiNutritionCoach() {
  const [mode, setMode] = useState<NutritionMode>("Family");

  const modes: NutritionMode[] = [
    "Family",
    "Weight Loss",
    "Athlete",
    "Heart Healthy",
  ];

  const dailyGoals = useMemo(() => {
    if (mode === "Weight Loss") {
      return { calories: 1800, protein: 130, carbs: 160, fat: 55 };
    }

    if (mode === "Athlete") {
      return { calories: 2800, protein: 190, carbs: 310, fat: 85 };
    }

    if (mode === "Heart Healthy") {
      return { calories: 2100, protein: 120, carbs: 230, fat: 60 };
    }

    return { calories: 2200, protein: 140, carbs: 240, fat: 70 };
  }, [mode]);

  const averageScore = useMemo(() => {
    const total = groceryScores.reduce((sum, item) => sum + item.score, 0);
    return Math.round(total / groceryScores.length);
  }, []);

  function generatePlan() {
    Alert.alert(
      "AI Nutrition Plan",
      `${mode} plan generated.\n\nDaily target:\n${dailyGoals.calories} calories\n${dailyGoals.protein}g protein\n${dailyGoals.carbs}g carbs\n${dailyGoals.fat}g fat`
    );
  }

  function analyzeCart() {
    Alert.alert(
      "Cart Health Score",
      `Your current grocery health score is ${averageScore}/100. Farm2Home recommends more greens, lean protein, and seasonal fruit.`
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Farm2Home AI Wellness</Text>
        <Text style={styles.title}>AI Nutrition Coach</Text>
        <Text style={styles.subtitle}>
          Get healthy grocery scoring, nutrition goals, meal guidance, and
          personalized farm-food recommendations.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Nutrition Mode</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.modeRow}
      >
        {modes.map((item) => (
          <TouchableOpacity
            key={item}
            style={[styles.modeChip, mode === item && styles.modeChipActive]}
            onPress={() => setMode(item)}
          >
            <Text
              style={[styles.modeText, mode === item && styles.modeTextActive]}
            >
              {item}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.goalCard}>
        <Text style={styles.goalLabel}>Selected Plan</Text>
        <Text style={styles.goalTitle}>{mode}</Text>

        <View style={styles.goalGrid}>
          <View style={styles.goalBox}>
            <Text style={styles.goalNumber}>{dailyGoals.calories}</Text>
            <Text style={styles.goalText}>Calories</Text>
          </View>

          <View style={styles.goalBox}>
            <Text style={styles.goalNumber}>{dailyGoals.protein}g</Text>
            <Text style={styles.goalText}>Protein</Text>
          </View>

          <View style={styles.goalBox}>
            <Text style={styles.goalNumber}>{dailyGoals.carbs}g</Text>
            <Text style={styles.goalText}>Carbs</Text>
          </View>

          <View style={styles.goalBox}>
            <Text style={styles.goalNumber}>{dailyGoals.fat}g</Text>
            <Text style={styles.goalText}>Fat</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={generatePlan}>
          <Text style={styles.primaryText}>Generate AI Nutrition Plan</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.outlineButton} onPress={analyzeCart}>
          <Text style={styles.outlineText}>Analyze Grocery Health Score</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.scoreCard}>
        <Text style={styles.scoreTitle}>Grocery Health Score</Text>
        <Text style={styles.scoreNumber}>{averageScore}/100</Text>
        <Text style={styles.scoreText}>
          Strong grocery selection with lean protein, fresh greens, fruit, and
          farm-sourced staples.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Healthy Grocery Analysis</Text>

      {groceryScores.map((item) => (
        <View key={item.id} style={styles.foodCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.foodName}>{item.name}</Text>
            <Text style={styles.foodFarm}>{item.farmName}</Text>
            <Text style={styles.foodRecommendation}>
              {item.recommendation}
            </Text>

            <View style={styles.macroRow}>
              <Text style={styles.macroText}>{item.calories} cal</Text>
              <Text style={styles.macroText}>{item.protein}g protein</Text>
              <Text style={styles.macroText}>{item.carbs}g carbs</Text>
              <Text style={styles.macroText}>{item.fat}g fat</Text>
            </View>
          </View>

          <View style={styles.foodScoreBadge}>
            <Text style={styles.foodScoreText}>{item.score}</Text>
          </View>
        </View>
      ))}

      <View style={styles.aiCard}>
        <Text style={styles.aiTitle}>AI Wellness Recommendations</Text>
        <Text style={styles.aiText}>
          Farm2Home can later connect nutrition goals to marketplace products,
          meal plans, smart inventory, recurring produce boxes, and family
          preferences.
        </Text>

        <View style={styles.aiList}>
          <Text style={styles.aiItem}>• Recommend healthier grocery swaps</Text>
          <Text style={styles.aiItem}>• Match meals to nutrition targets</Text>
          <Text style={styles.aiItem}>• Track household food goals</Text>
          <Text style={styles.aiItem}>• Support athlete and family plans</Text>
          <Text style={styles.aiItem}>• Create nutrition-based produce boxes</Text>
        </View>
      </View>

      <View style={styles.navRow}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => router.push("/customer/ai-meal-planner")}
        >
          <Text style={styles.navButtonText}>Meal Planner</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButtonOutline}
          onPress={() => router.push("/customer/marketplace")}
        >
          <Text style={styles.navButtonOutlineText}>Marketplace</Text>
        </TouchableOpacity>
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
    fontSize: 36,
    fontWeight: "900",
    marginBottom: 10,
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

  modeRow: {
    paddingLeft: 18,
    marginBottom: 12,
  },

  modeChip: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 999,
    marginRight: 10,
  },

  modeChipActive: {
    backgroundColor: farmTheme.colors.primary,
    borderColor: farmTheme.colors.primary,
  },

  modeText: {
    color: farmTheme.colors.text,
    fontWeight: "900",
  },

  modeTextActive: {
    color: "#FFFFFF",
  },

  goalCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    ...farmTheme.shadow,
  },

  goalLabel: {
    color: farmTheme.colors.mutedText,
    fontWeight: "900",
    marginBottom: 6,
  },

  goalTitle: {
    color: farmTheme.colors.text,
    fontSize: 28,
    fontWeight: "900",
    marginBottom: 16,
  },

  goalGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },

  goalBox: {
    width: "47%",
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  goalNumber: {
    color: farmTheme.colors.primary,
    fontSize: 22,
    fontWeight: "900",
  },

  goalText: {
    color: farmTheme.colors.mutedText,
    fontWeight: "800",
    marginTop: 4,
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

  scoreCard: {
    backgroundColor: "#064E3B",
    margin: 18,
    borderRadius: 22,
    padding: 18,
  },

  scoreTitle: {
    color: "#BBF7D0",
    fontWeight: "900",
    marginBottom: 6,
  },

  scoreNumber: {
    color: "#FFFFFF",
    fontSize: 42,
    fontWeight: "900",
  },

  scoreText: {
    color: "#D1FAE5",
    fontWeight: "700",
    lineHeight: 22,
    marginTop: 8,
  },

  foodCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    marginBottom: 12,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },

  foodName: {
    color: farmTheme.colors.text,
    fontSize: 18,
    fontWeight: "900",
  },

  foodFarm: {
    color: farmTheme.colors.mutedText,
    fontWeight: "700",
    marginTop: 4,
  },

  foodRecommendation: {
    color: farmTheme.colors.text,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 8,
  },

  macroRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },

  macroText: {
    backgroundColor: "#F0FDF4",
    color: farmTheme.colors.primary,
    fontWeight: "900",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: "hidden",
    fontSize: 12,
  },

  foodScoreBadge: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: farmTheme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  foodScoreText: {
    color: "#FFFFFF",
    fontSize: 20,
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
  },

  aiList: {
    marginTop: 12,
  },

  aiItem: {
    color: "#D1FAE5",
    fontWeight: "800",
    lineHeight: 25,
  },

  navRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 18,
    marginTop: 18,
  },

  navButton: {
    flex: 1,
    backgroundColor: farmTheme.colors.primary,
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
  },

  navButtonOutline: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: farmTheme.colors.primary,
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
  },

  navButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  navButtonOutlineText: {
    color: farmTheme.colors.primary,
    fontWeight: "900",
  },
});