import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";

import farmTheme from "../styles/farmTheme";
import ProtectedRoute from "../components/ProtectedRoute";

type DashboardLink = {
  title: string;
  subtitle: string;
  icon: string;
  route: string;
};

const links: DashboardLink[] = [
  {
    title: "Marketplace",
    subtitle: "Shop local farms",
    icon: "🛒",
    route: "/customer/marketplace",
  },

  {
    title: "Cart",
    subtitle: "Review your groceries",
    icon: "🧺",
    route: "/customer/cart",
  },

  {
    title: "My Orders",
    subtitle: "Track order history",
    icon: "📦",
    route: "/customer/orders",
  },

  {
    title: "Meal Planner",
    subtitle: "AI weekly meals",
    icon: "🤖",
    route: "/customer/ai-meal-planner",
  },

  {
    title: "Nutrition Coach",
    subtitle: "Healthy grocery scoring",
    icon: "🥗",
    route: "/customer/ai-nutrition-coach",
  },

  {
    title: "Smart Inventory",
    subtitle: "Reorder household items",
    icon: "🏠",
    route: "/customer/smart-household-inventory",
  },

  {
    title: "Favorite Farms",
    subtitle: "Reorder from trusted farms",
    icon: "🌾",
    route: "/customer/farm-favorites",
  },

  {
    title: "Delivery Preferences",
    subtitle: "Saved delivery instructions",
    icon: "🚚",
    route: "/customer/delivery-preferences",
  },

  {
    title: "Loyalty Rewards",
    subtitle: "FarmPoints and perks",
    icon: "⭐",
    route: "/customer/loyalty-rewards",
  },

  {
    title: "Referrals",
    subtitle: "Invite and earn",
    icon: "👥",
    route: "/customer/referral-program",
  },

  {
    title: "Coupons",
    subtitle: "Promo codes and savings",
    icon: "🏷️",
    route: "/customer/coupons-promos",
  },

  {
    title: "Support",
    subtitle: "Refunds and order help",
    icon: "🎧",
    route: "/customer/customer-support",
  },
];

export default function CustomerDashboard() {
  return (
    <ProtectedRoute allowedRoles={["customer"]}>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Farm2Home Customer Hub</Text>

          <Text style={styles.title}>Welcome Back</Text>

          <Text style={styles.subtitle}>
            Manage shopping, subscriptions, AI tools, orders, rewards, and
            support from one dashboard.
          </Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Quick Snapshot</Text>

          <View style={styles.summaryGrid}>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryNumber}>3</Text>
              <Text style={styles.summaryLabel}>Active Orders</Text>
            </View>

            <View style={styles.summaryBox}>
              <Text style={styles.summaryNumber}>1,750</Text>
              <Text style={styles.summaryLabel}>FarmPoints</Text>
            </View>

            <View style={styles.summaryBox}>
              <Text style={styles.summaryNumber}>4</Text>
              <Text style={styles.summaryLabel}>Favorite Farms</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Customer Tools</Text>

        <View style={styles.grid}>
          {links.map((item) => (
            <TouchableOpacity
              key={item.route}
              style={styles.card}
              onPress={() => router.push(item.route as any)}
            >
              <Text style={styles.icon}>{item.icon}</Text>

              <Text style={styles.cardTitle}>{item.title}</Text>

              <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 90 }} />
      </ScrollView>
    </ProtectedRoute>
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
    fontWeight: "700",
    lineHeight: 23,
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

  summaryTitle: {
    color: farmTheme.colors.text,
    fontSize: 23,
    fontWeight: "900",
    marginBottom: 14,
  },

  summaryGrid: {
    flexDirection: "row",
    gap: 10,
  },

  summaryBox: {
    flex: 1,
    backgroundColor: "#F0FDF4",
    borderRadius: 16,
    padding: 12,
  },

  summaryNumber: {
    color: farmTheme.colors.primary,
    fontSize: 22,
    fontWeight: "900",
  },

  summaryLabel: {
    color: farmTheme.colors.mutedText,
    fontWeight: "800",
    marginTop: 4,
    fontSize: 12,
  },

  sectionTitle: {
    color: farmTheme.colors.text,
    fontSize: 23,
    fontWeight: "900",
    paddingHorizontal: 18,
    marginBottom: 12,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingHorizontal: 18,
  },

  card: {
    width: "47%",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    ...farmTheme.shadow,
  },

  icon: {
    fontSize: 30,
    marginBottom: 10,
  },

  cardTitle: {
    color: farmTheme.colors.text,
    fontSize: 17,
    fontWeight: "900",
  },

  cardSubtitle: {
    color: farmTheme.colors.mutedText,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 5,
  },
});