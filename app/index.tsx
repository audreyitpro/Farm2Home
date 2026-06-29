// app/index.tsx

import React from "react";
import {
  Image,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import farmTheme from "./styles/farmTheme";

const ui = {
  bg: "#F7FBF4",
  card: "#FFFFFF",
  text: "#102A1C",
  muted: "#5F6F64",
  green: "#166534",
  greenDark: "#14532D",
  greenSoft: "#DCFCE7",
  orange: "#EA580C",
  blue: "#1D4ED8",
  border: "#DDE7D6",
};

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={ui.greenDark} />

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

            <View style={styles.badge}>
              <Ionicons name="leaf-outline" size={17} color={ui.greenDark} />
              <Text style={styles.badgeText}>
                Local Farms • Fresh Food • Fast Delivery
              </Text>
            </View>

            <Text style={styles.heroTitle}>
              Fresh From Local Farms To Your Family
            </Text>

            <Text style={styles.heroSubtitle}>
              Shop fresh produce, eggs, dairy, meat, fish, honey, baked goods,
              flowers, hay, and local farm products directly from trusted farmers.
            </Text>

            <View style={styles.heroActions}>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => router.push("/customer/login" as any)}
                activeOpacity={0.88}
              >
                <Ionicons name="basket-outline" size={20} color="#FFFFFF" />
                <Text style={styles.primaryText}>Shop Farm Fresh</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.lightButton}
                onPress={() => router.push("/farmer/register" as any)}
                activeOpacity={0.88}
              >
                <Ionicons name="leaf-outline" size={20} color={ui.greenDark} />
                <Text style={styles.lightButtonText}>Sell As A Farmer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionEyebrow}>How it works</Text>
          <Text style={styles.sectionTitle}>
            Farm2Home connects the whole farm market.
          </Text>

          <View style={styles.cardRow}>
            <FeatureCard
              icon="basket-outline"
              title="Shop Fresh Food"
              text="Customers browse local produce, meats, dairy, baked goods, flowers, and seasonal farm products."
            />

            <FeatureCard
              icon="leaf-outline"
              title="Support Farmers"
              text="Farmers sell directly to families, communities, businesses, and nearby markets."
            />

            <FeatureCard
              icon="home-outline"
              title="Pickup or Delivery"
              text="Customers can choose pickup or delivery based on what each farmer offers."
            />

            <FeatureCard
              icon="car-outline"
              title="Driver Network"
              text="Drivers can subscribe, view available deliveries, and accept delivery work."
            />
          </View>

          <View style={styles.portalGrid}>
            <PortalCard
              icon="person-circle-outline"
              title="Customer Portal"
              text="Shop farm-fresh food and manage orders."
              primaryLabel="Customer Login"
              primaryRoute="/customer/login"
              secondaryLabel="Create Customer Account"
              secondaryRoute="/customer/register"
              color={ui.green}
            />

            <PortalCard
              icon="leaf-outline"
              title="Farmer Portal"
              text="Apply, complete compliance, connect Stripe, and build your farm store."
              primaryLabel="Become a Farmer"
              primaryRoute="/farmer/register"
              secondaryLabel="Farmer Login"
              secondaryRoute="/farmer/login"
              color={ui.greenDark}
            />

            <PortalCard
              icon="trail-sign-outline"
              title="Freight Connect"
              text="Carriers and freight users can register, post loads, and manage freight activity."
              primaryLabel="Freight Registration"
              primaryRoute="/freight/register"
              secondaryLabel="Freight Login"
              secondaryRoute="/freight/login"
              color={ui.blue}
            />

            <PortalCard
              icon="car-outline"
              title="Driver Delivery Network"
              text="Drivers can subscribe, log in, view the board, and accept delivery opportunities."
              primaryLabel="Driver Login / Setup"
              primaryRoute="/driver/login"
              secondaryLabel="Driver Board"
              secondaryRoute="/driver/board"
              color={ui.orange}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function FeatureCard({
  icon,
  title,
  text,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  text: string;
}) {
  return (
    <View style={styles.featureCard}>
      <View style={styles.featureIcon}>
        <Ionicons name={icon} size={26} color={ui.greenDark} />
      </View>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardText}>{text}</Text>
    </View>
  );
}

function PortalCard({
  icon,
  title,
  text,
  primaryLabel,
  primaryRoute,
  secondaryLabel,
  secondaryRoute,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  text: string;
  primaryLabel: string;
  primaryRoute: string;
  secondaryLabel: string;
  secondaryRoute: string;
  color: string;
}) {
  return (
    <View style={styles.portalCard}>
      <View style={[styles.portalIcon, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={28} color={color} />
      </View>

      <Text style={styles.portalTitle}>{title}</Text>
      <Text style={styles.portalText}>{text}</Text>

      <TouchableOpacity
        style={[styles.portalPrimaryButton, { backgroundColor: color }]}
        onPress={() => router.push(primaryRoute as any)}
        activeOpacity={0.88}
      >
        <Text style={styles.portalPrimaryText}>{primaryLabel}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.portalSecondaryButton}
        onPress={() => router.push(secondaryRoute as any)}
        activeOpacity={0.88}
      >
        <Text style={[styles.portalSecondaryText, { color }]}>
          {secondaryLabel}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: ui.bg,
  },
  page: {
    flex: 1,
    backgroundColor: ui.bg,
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
    inset: 0 as any,
    backgroundColor: "rgba(0,0,0,0.48)",
    justifyContent: "center",
    alignItems: "center",
    padding: 22,
  },
  logo: {
    width: 230,
    height: 150,
    marginBottom: 14,
    borderRadius: 24,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginBottom: 16,
  },
  badgeText: {
    color: ui.greenDark,
    fontWeight: "900",
    fontSize: 13,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 46,
    fontWeight: "900",
    textAlign: "center",
    maxWidth: 920,
    marginBottom: 14,
  },
  heroSubtitle: {
    color: "#F8FAFC",
    fontSize: 20,
    lineHeight: 30,
    textAlign: "center",
    maxWidth: 780,
    marginBottom: 28,
    fontWeight: "600",
  },
  heroActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "center",
  },
  primaryButton: {
    backgroundColor: ui.green,
    paddingHorizontal: 26,
    paddingVertical: 16,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  primaryText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },
  lightButton: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  lightButtonText: {
    color: ui.greenDark,
    fontWeight: "900",
    fontSize: 16,
  },
  section: {
    padding: 20,
    paddingBottom: 70,
  },
  sectionEyebrow: {
    color: ui.green,
    fontWeight: "900",
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 34,
    lineHeight: 41,
    fontWeight: "900",
    color: ui.text,
    textAlign: "center",
    marginBottom: 24,
  },
  cardRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 14,
    marginBottom: 28,
  },
  featureCard: {
    width: 280,
    backgroundColor: ui.card,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: ui.border,
    alignItems: "center",
  },
  featureIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: ui.greenSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: ui.text,
    marginBottom: 8,
    textAlign: "center",
  },
  cardText: {
    color: ui.muted,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 21,
  },
  portalGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    justifyContent: "center",
    marginTop: 8,
  },
  portalCard: {
    width: 310,
    backgroundColor: ui.card,
    borderRadius: 26,
    padding: 20,
    borderWidth: 1,
    borderColor: ui.border,
  },
  portalIcon: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  portalTitle: {
    color: ui.text,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 8,
  },
  portalText: {
    color: ui.muted,
    fontWeight: "700",
    lineHeight: 21,
    minHeight: 64,
    marginBottom: 16,
  },
  portalPrimaryButton: {
    borderRadius: 16,
    padding: 15,
    alignItems: "center",
    marginBottom: 10,
  },
  portalPrimaryText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 15,
    textAlign: "center",
  },
  portalSecondaryButton: {
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: ui.border,
    backgroundColor: "#FFFFFF",
  },
  portalSecondaryText: {
    fontWeight: "900",
    fontSize: 15,
    textAlign: "center",
  },
});