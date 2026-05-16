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
            Shop fresh produce, eggs, dairy, meat, fish, honey, baked goods, and
            farm products directly from trusted farmers.
          </Text>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push("/customer/login")}
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
              Browse local farm products and seasonal produce.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.icon}>🚜</Text>
            <Text style={styles.cardTitle}>Support Farmers</Text>
            <Text style={styles.cardText}>
              Buy directly from farmers in your community.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.icon}>🏡</Text>
            <Text style={styles.cardTitle}>Pickup or Delivery</Text>
            <Text style={styles.cardText}>
              Farmers control pickup and delivery options.
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.customerButton}
          onPress={() => router.push("/customer/login")}
        >
          <Text style={styles.buttonText}>Customer Login</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.farmerButton}
          onPress={() => router.push("/farmer/register")}
        >
          <Text style={styles.buttonText}>Become a Farm2Home Farmer</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.freightButton}
          onPress={() => router.push("/freight/register")}
        >
          <Text style={styles.buttonText}>Freight Connect</Text>
        </TouchableOpacity>
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
    height: 680,
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
    backgroundColor: "rgba(0,0,0,0.35)",
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
    marginBottom: 28,
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
  customerButton: {
    ...farmTheme.buttons.primary,
    marginBottom: 12,
    borderRadius: 18,
  },
  farmerButton: {
    backgroundColor: farmTheme.colors.text,
    padding: 18,
    borderRadius: 18,
    marginBottom: 12,
    alignItems: "center",
  },
  freightButton: {
    backgroundColor: "#1565C0",
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