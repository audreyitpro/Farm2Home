import React from "react";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

const COLORS = {
  bg: "#F6F8F2",
  card: "#FFFFFF",
  green: "#1FA463",
  greenDark: "#0B5D35",
  greenSoft: "#E9F8EF",
  text: "#162115",
  muted: "#667085",
  border: "#E3E8DD",
  white: "#FFFFFF",
};

export default function FarmerIndexScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.badge}>Farm2Home Farmer Market</Text>
          <Text style={styles.title}>Run your digital farmers market</Text>
          <Text style={styles.subtitle}>
            Set up your store, add products, create bundles, manage orders, and post delivery loads.
          </Text>
        </View>

        <View style={styles.flowCard}>
          <Text style={styles.sectionTitle}>Farmer Workflow</Text>
          <FlowStep number="1" text="Setup your farmer store" />
          <FlowStep number="2" text="Add products to the marketplace" />
          <FlowStep number="3" text="Create bundles for subscribed customers" />
          <FlowStep number="4" text="Manage orders, delivery, and freight loads" />
        </View>

        <View style={styles.grid}>
          <ActionCard
            title="Farmer Dashboard"
            subtitle="View your full market hub"
            icon="grid-outline"
            primary
            onPress={() => router.push("/farmer/dashboard" as any)}
          />

          <ActionCard
            title="Setup Store"
            subtitle="Farm profile, logo, pickup, delivery"
            icon="storefront-outline"
            onPress={() => router.push("/farmer/setup-store" as any)}
          />

          <ActionCard
            title="Add Product"
            subtitle="Post products to the market"
            icon="add-circle-outline"
            onPress={() => router.push("/farmer/add-product" as any)}
          />

          <ActionCard
            title="Manage Products"
            subtitle="Inventory, marketplace, bundle-ready"
            icon="archive-outline"
            onPress={() => router.push("/farmer/inventory-management" as any)}
          />

          <ActionCard
            title="Create Bundles"
            subtitle="Produce, meat, seafood boxes"
            icon="basket-outline"
            onPress={() => router.push("/farmer/farm-bundles" as any)}
          />

          <ActionCard
            title="Post Load"
            subtitle="Post farm freight to live board"
            icon="trail-sign-outline"
            onPress={() => router.push("/farmer/post-load" as any)}
          />

          <ActionCard
            title="Orders"
            subtitle="Review customer orders"
            icon="receipt-outline"
            onPress={() => router.push("/farmer/orders" as any)}
          />

          <ActionCard
            title="Drivers"
            subtitle="Assign drivers and delivery jobs"
            icon="car-outline"
            onPress={() => router.push("/farmer/assigned-drivers" as any)}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function FlowStep({ number, text }: { number: string; text: string }) {
  return (
    <View style={styles.flowStep}>
      <Text style={styles.flowNumber}>{number}</Text>
      <Text style={styles.flowText}>{text}</Text>
    </View>
  );
}

function ActionCard({
  title,
  subtitle,
  icon,
  onPress,
  primary,
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.card, primary && styles.cardPrimary]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View style={[styles.iconBox, primary && styles.iconBoxPrimary]}>
        <Ionicons name={icon} size={22} color={primary ? COLORS.white : COLORS.greenDark} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={[styles.cardTitle, primary && styles.cardTitlePrimary]}>{title}</Text>
        <Text style={[styles.cardSub, primary && styles.cardSubPrimary]}>{subtitle}</Text>
      </View>

      <Ionicons
        name="chevron-forward-outline"
        size={18}
        color={primary ? COLORS.white : COLORS.muted}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 18, paddingBottom: 90 },

  hero: {
    backgroundColor: COLORS.green,
    borderRadius: 30,
    padding: 22,
    marginBottom: 16,
  },
  badge: {
    color: "#DDF8C8",
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontSize: 12,
  },
  title: {
    color: COLORS.white,
    fontSize: 32,
    fontWeight: "900",
    lineHeight: 38,
    marginTop: 8,
  },
  subtitle: {
    color: COLORS.white,
    opacity: 0.92,
    fontWeight: "700",
    lineHeight: 22,
    marginTop: 8,
  },

  flowCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  sectionTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 21,
    marginBottom: 10,
  },
  flowStep: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 9,
  },
  flowNumber: {
    width: 30,
    height: 30,
    borderRadius: 12,
    backgroundColor: COLORS.greenSoft,
    color: COLORS.greenDark,
    textAlign: "center",
    textAlignVertical: "center",
    fontWeight: "900",
    overflow: "hidden",
  },
  flowText: {
    flex: 1,
    color: COLORS.text,
    fontWeight: "800",
    lineHeight: 20,
  },

  grid: { gap: 11 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cardPrimary: {
    backgroundColor: COLORS.greenDark,
    borderColor: COLORS.greenDark,
  },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 17,
    backgroundColor: COLORS.greenSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBoxPrimary: {
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  cardTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 16,
  },
  cardTitlePrimary: {
    color: COLORS.white,
  },
  cardSub: {
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 3,
    lineHeight: 18,
  },
  cardSubPrimary: {
    color: "rgba(255,255,255,0.86)",
  },
});