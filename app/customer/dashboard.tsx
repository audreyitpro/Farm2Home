import React, { useEffect, useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function CustomerDashboard() {
  const [customerName, setCustomerName] = useState("Customer");

  useEffect(() => {
    loadCustomer();
  }, []);

  async function loadCustomer() {
    try {
      const stored = await AsyncStorage.getItem("currentCustomer");

      if (!stored) return;

      const customer = JSON.parse(stored);

      setCustomerName(
        customer?.fullName ||
          customer?.full_name ||
          customer?.name ||
          "Customer"
      );
    } catch (error) {
      console.log(error);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.page}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons
              name="basket-outline"
              size={36}
              color="#FFFFFF"
            />
          </View>

          <Text style={styles.title}>
            Welcome Back
          </Text>

          <Text style={styles.customerName}>
            {customerName}
          </Text>

          <Text style={styles.subtitle}>
            Shop local farms, track orders,
            manage subscriptions, and support
            your local farming community.
          </Text>
        </View>

        <View style={styles.quickActions}>
          <Text style={styles.sectionTitle}>
            Quick Actions
          </Text>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() =>
              router.push("/customer/marketplace" as any)
            }
          >
            <Ionicons
              name="storefront-outline"
              size={22}
              color="#FFFFFF"
            />

            <Text style={styles.primaryButtonText}>
              Shop Marketplace
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() =>
              router.push("/customer/cart" as any)
            }
          >
            <Ionicons
              name="cart-outline"
              size={22}
              color="#166534"
            />

            <Text style={styles.secondaryButtonText}>
              View Cart
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() =>
              router.push("/customer/orders" as any)
            }
          >
            <Ionicons
              name="receipt-outline"
              size={22}
              color="#166534"
            />

            <Text style={styles.secondaryButtonText}>
              My Orders
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() =>
              router.push("/customer/profile" as any)
            }
          >
            <Ionicons
              name="person-outline"
              size={22}
              color="#166534"
            />

            <Text style={styles.secondaryButtonText}>
              My Profile
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>
            Farm2Home Benefits
          </Text>

          <Text style={styles.infoText}>
            • Buy directly from local farmers
          </Text>

          <Text style={styles.infoText}>
            • Fresh produce, meat, dairy and baked goods
          </Text>

          <Text style={styles.infoText}>
            • Pickup or delivery options
          </Text>

          <Text style={styles.infoText}>
            • Support local agriculture
          </Text>

          <Text style={styles.infoText}>
            • Secure online ordering
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F7FBF4",
  },

  page: {
    flex: 1,
  },

  content: {
    padding: 20,
    paddingBottom: 60,
  },

  hero: {
    backgroundColor: "#14532D",
    borderRadius: 28,
    padding: 24,
    marginBottom: 20,
  },

  heroIcon: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.18)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },

  title: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },

  customerName: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "900",
    marginTop: 4,
    marginBottom: 10,
  },

  subtitle: {
    color: "#DCFCE7",
    lineHeight: 22,
    fontWeight: "700",
  },

  quickActions: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#DDE7D6",
  },

  sectionTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#102A1C",
    marginBottom: 14,
  },

  primaryButton: {
    backgroundColor: "#166534",
    borderRadius: 18,
    padding: 18,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },

  secondaryButton: {
    backgroundColor: "#F1F8EC",
    borderRadius: 18,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#DDE7D6",
  },

  secondaryButtonText: {
    color: "#166534",
    fontWeight: "900",
    fontSize: 15,
  },

  infoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "#DDE7D6",
  },

  infoTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#102A1C",
    marginBottom: 12,
  },

  infoText: {
    color: "#647067",
    fontWeight: "700",
    marginBottom: 8,
    lineHeight: 20,
  },
});