import React, { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import farmTheme from "../styles/farmTheme";

type Promo = {
  id: string;
  code: string;
  title: string;
  description: string;
  discount: string;
};

const promos: Promo[] = [
  {
    id: "fresh10",
    code: "FRESH10",
    title: "Fresh Produce Discount",
    description: "Save on fresh produce orders.",
    discount: "10% OFF",
  },
  {
    id: "free-delivery",
    code: "DELIVERYFREE",
    title: "Free Delivery",
    description: "Free delivery on eligible local farm orders.",
    discount: "FREE DELIVERY",
  },
  {
    id: "family15",
    code: "FAMILY15",
    title: "Family Bundle Savings",
    description: "Save on family grocery bundles.",
    discount: "$15 OFF",
  },
];

export default function CouponsPromos() {
  const [promoCode, setPromoCode] = useState("");
  const [activeCode, setActiveCode] = useState("");

  function applyPromo(code?: string) {
    const selectedCode = (code || promoCode).trim().toUpperCase();

    if (!selectedCode) {
      Alert.alert("Promo Needed", "Enter a promo code.");
      return;
    }

    const found = promos.find((promo) => promo.code === selectedCode);

    if (!found) {
      Alert.alert("Invalid Promo", "That promo code is not available.");
      return;
    }

    setActiveCode(found.code);
    setPromoCode("");
    Alert.alert("Promo Applied", `${found.discount} applied with ${found.code}.`);
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Farm2Home Savings</Text>
        <Text style={styles.title}>Coupons & Promos</Text>
        <Text style={styles.subtitle}>
          Apply discounts, free delivery codes, family bundle savings, and
          seasonal farm promotions.
        </Text>
      </View>

      <View style={styles.applyCard}>
        <Text style={styles.applyTitle}>Apply Promo Code</Text>

        <TextInput
          style={styles.input}
          placeholder="Enter promo code"
          value={promoCode}
          onChangeText={setPromoCode}
          autoCapitalize="characters"
        />

        <TouchableOpacity style={styles.primaryButton} onPress={() => applyPromo()}>
          <Text style={styles.primaryText}>Apply Promo</Text>
        </TouchableOpacity>

        {activeCode ? (
          <View style={styles.activeBox}>
            <Text style={styles.activeText}>Active Promo: {activeCode}</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.sectionTitle}>Available Promotions</Text>

      {promos.map((promo) => (
        <View key={promo.id} style={styles.promoCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.discount}>{promo.discount}</Text>
            <Text style={styles.promoTitle}>{promo.title}</Text>
            <Text style={styles.promoDescription}>{promo.description}</Text>
            <Text style={styles.promoCode}>Code: {promo.code}</Text>
          </View>

          <TouchableOpacity style={styles.applySmallButton} onPress={() => applyPromo(promo.code)}>
            <Text style={styles.applySmallText}>Apply</Text>
          </TouchableOpacity>
        </View>
      ))}

      <View style={styles.aiCard}>
        <Text style={styles.aiTitle}>AI Promo Engine</Text>
        <Text style={styles.aiText}>
          Later this can personalize coupons based on cart value, customer
          loyalty, favorite farms, churn risk, seasonal inventory, and referrals.
        </Text>
      </View>

      <View style={{ height: 90 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: farmTheme.colors.background },

  hero: {
    backgroundColor: farmTheme.colors.primary,
    paddingTop: 64,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },

  eyebrow: { color: "#D1FAE5", fontWeight: "900", marginBottom: 8 },

  title: { color: "#FFFFFF", fontSize: 36, fontWeight: "900", marginBottom: 10 },

  subtitle: { color: "#E8F5E9", fontWeight: "700", lineHeight: 23 },

  applyCard: {
    backgroundColor: "#FFFFFF",
    margin: 18,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    ...farmTheme.shadow,
  },

  applyTitle: {
    color: farmTheme.colors.text,
    fontSize: 23,
    fontWeight: "900",
    marginBottom: 12,
  },

  input: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    padding: 14,
    color: farmTheme.colors.text,
    fontWeight: "900",
    marginBottom: 14,
  },

  primaryButton: {
    backgroundColor: farmTheme.colors.primary,
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
  },

  primaryText: { color: "#FFFFFF", fontWeight: "900" },

  activeBox: {
    backgroundColor: "#F0FDF4",
    padding: 12,
    borderRadius: 14,
    marginTop: 12,
  },

  activeText: { color: farmTheme.colors.primary, fontWeight: "900" },

  sectionTitle: {
    color: farmTheme.colors.text,
    fontSize: 23,
    fontWeight: "900",
    paddingHorizontal: 18,
    marginBottom: 12,
  },

  promoCard: {
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

  discount: { color: farmTheme.colors.primary, fontSize: 22, fontWeight: "900" },

  promoTitle: { color: farmTheme.colors.text, fontSize: 18, fontWeight: "900", marginTop: 4 },

  promoDescription: { color: farmTheme.colors.mutedText, fontWeight: "700", marginTop: 5 },

  promoCode: { color: farmTheme.colors.text, fontWeight: "900", marginTop: 8 },

  applySmallButton: {
    backgroundColor: farmTheme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 999,
  },

  applySmallText: { color: "#FFFFFF", fontWeight: "900" },

  aiCard: {
    backgroundColor: "#064E3B",
    marginHorizontal: 18,
    marginTop: 8,
    borderRadius: 22,
    padding: 18,
  },

  aiTitle: { color: "#FFFFFF", fontSize: 23, fontWeight: "900", marginBottom: 8 },

  aiText: { color: "#BBF7D0", fontWeight: "700", lineHeight: 22 },
});