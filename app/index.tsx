import React from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import { router } from "expo-router";

import farmTheme from "./styles/farmTheme";

export default function HomeScreen() {
  return (
    <ScrollView style={styles.page} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Image
          source={{
            uri: "https://images.unsplash.com/photo-1500937386664-56d1dfef3854",
          }}
          style={styles.heroImage}
        />

        <View style={styles.overlay}>
          <Image
            source={require("../assets/images/farm2home-logo.jpg")}
            style={styles.logo}
            resizeMode="contain"
          />

          <Text style={styles.heroTitle}>
            Fresh From Local Farms To Your Family
          </Text>

          <Text style={styles.heroSubtitle}>
            Shop fresh produce, eggs, dairy, meat, fish, honey, baked goods,
            flowers, hay, and local farm products directly from trusted farmers.
          </Text>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push("/customer/login")}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryText}>Shop Farm Fresh Food</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>How Farm2Home Works</Text>

        <View style={styles.cardRow}>
          <View style={styles.card}>
            <Text style={styles.icon}>🥬</Text>

            <Text style={styles.cardTitle}>Choose Fresh Food</Text>

            <Text style={styles.cardText}>
              Browse local produce, meats, dairy, baked goods, flowers, and
              seasonal farm products.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.icon}>🚜</Text>

            <Text style={styles.cardTitle}>Support Farmers</Text>

            <Text style={styles.cardText}>
              Buy directly from local farmers and support agriculture in your
              community.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.icon}>🏡</Text>

            <Text style={styles.cardTitle}>Pickup or Delivery</Text>

            <Text style={styles.cardText}>
              Farmers and drivers coordinate pickup and delivery directly to
              customers.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.icon}>🚚</Text>

            <Text style={styles.cardTitle}>Driver Delivery Network</Text>

            <Text style={styles.cardText}>
              Drivers can register, subscribe, and accept available delivery
              orders through the Farm2Home driver board.
            </Text>
          </View>
        </View>

        <View style={styles.portalSection}>
          <Text style={styles.portalTitle}>Customer Portal</Text>

          <TouchableOpacity
            style={styles.customerButton}
            onPress={() => router.push("/customer/login")}
            activeOpacity={0.85}
          >
            <Text style={styles.buttonText}>Customer Login</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.portalSection}>
          <Text style={styles.portalTitle}>Farmer Portal</Text>

          <TouchableOpacity
            style={styles.farmerButton}
            onPress={() => router.push("/farmer/register")}
            activeOpacity={0.85}
          >
            <Text style={styles.buttonText}>Become a Farm2Home Farmer</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryFarmerButton}
            onPress={() => router.push("/farmer/login")}
            activeOpacity={0.85}
          >
            <Text style={styles.buttonText}>Farmer Login</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.portalSection}>
          <Text style={styles.portalTitle}>Freight Connect</Text>

          <TouchableOpacity
            style={styles.freightButton}
            onPress={() => router.push("/freight/register")}
            activeOpacity={0.85}
          >
            <Text style={styles.buttonText}>Freight Carrier Registration</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryFreightButton}
            onPress={() => router.push("/freight/login")}
            activeOpacity={0.85}
          >
            <Text style={styles.buttonText}>Freight Login</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.portalSection}>
          <Text style={styles.portalTitle}>Driver Delivery Network</Text>

          <TouchableOpacity
            style={styles.driverButton}
            onPress={() => router.push("/driver/login")}
            activeOpacity={0.85}
          >
            <Text style={styles.buttonText}>Driver Login / Driver Setup</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: farmTheme.colors.background,
  },

  hero: {
    height: 760,
    position: "relative",
  },

  heroImage: {
    width: "100%",
    height: "100%",
  },

  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.42)",
    justifyContent: "center",
    alignItems: "center",
    padding: farmTheme.spacing.lg,
  },

  logo: {
    width: 240,
    height: 160,
    marginBottom: 12,
    borderRadius: 22,
  },

  heroTitle: {
    color: "#FFFFFF",
    fontSize: 46,
    fontWeight: "900",
    textAlign: "center",
    maxWidth: 900,
    marginBottom: 14,
  },

  heroSubtitle: {
    color: "#FFFFFF",
    fontSize: 20,
    lineHeight: 30,
    textAlign: "center",
    maxWidth: 760,
    marginBottom: 26,
  },

  primaryButton: {
    ...farmTheme.buttons.secondary,
    paddingHorizontal: 34,
  },

  primaryText: {
    ...farmTheme.typography.button,
    fontSize: 17,
  },

  section: {
    padding: farmTheme.spacing.lg,
    paddingBottom: 60,
  },

  sectionTitle: {
    fontSize: 34,
    fontWeight: "900",
    color: farmTheme.colors.primary,
    textAlign: "center",
    marginBottom: 22,
  },

  cardRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 16,
    marginBottom: 34,
  },

  card: {
    ...farmTheme.cards.default,
    width: 280,
    alignItems: "center",
  },

  icon: {
    fontSize: 42,
    marginBottom: 10,
  },

  cardTitle: {
    fontSize: 19,
    fontWeight: "900",
    color: farmTheme.colors.primary,
    marginBottom: 8,
    textAlign: "center",
  },

  cardText: {
    ...farmTheme.typography.body,
    textAlign: "center",
  },

  portalSection: {
    marginBottom: 24,
  },

  portalTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: farmTheme.colors.primary,
    marginBottom: 12,
  },

  customerButton: {
    ...farmTheme.buttons.primary,
    marginBottom: 12,
    borderRadius: 18,
  },

  farmerButton: {
    backgroundColor: "#14532D",
    padding: 18,
    borderRadius: 18,
    marginBottom: 12,
    alignItems: "center",
  },

  secondaryFarmerButton: {
    backgroundColor: "#166534",
    padding: 18,
    borderRadius: 18,
    alignItems: "center",
  },

  freightButton: {
    backgroundColor: "#1565C0",
    padding: 18,
    borderRadius: 18,
    marginBottom: 12,
    alignItems: "center",
  },

  secondaryFreightButton: {
    backgroundColor: "#1D4ED8",
    padding: 18,
    borderRadius: 18,
    alignItems: "center",
  },

  driverButton: {
    backgroundColor: "#EA580C",
    padding: 18,
    borderRadius: 18,
    alignItems: "center",
  },

  buttonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    textAlign: "center",
    fontSize: 16,
  },
});