// app/auth/register.tsx

import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";

type RegisterRole = {
  id: string;
  title: string;
  subtitle: string;
  route: string;
  icon: string;
};

const REGISTER_ROLES: RegisterRole[] = [
  {
    id: "customer",
    title: "Customer",
    subtitle: "Shop fresh farm products and manage orders.",
    route: "/customer/register",
    icon: "🛒",
  },
  {
    id: "farmer",
    title: "Farmer",
    subtitle: "Sell products, manage inventory, and fulfill orders.",
    route: "/farmer/register",
    icon: "🌾",
  },
  {
    id: "driver",
    title: "Driver",
    subtitle: "Accept delivery jobs and manage route work.",
    route: "/driver/register",
    icon: "🚚",
  },
  {
    id: "freight",
    title: "Freight Carrier",
    subtitle: "Access freight loads, dispatch tools, and payouts.",
    route: "/freight/register",
    icon: "🚛",
  },
];

export default function RegisterScreen() {
  function goTo(route: string) {
    router.push(route as any);
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.logo}>🌱</Text>
        <Text style={styles.kicker}>Farm2Home</Text>
        <Text style={styles.title}>Create Your Account</Text>
        <Text style={styles.subtitle}>
          Choose the account type you want to register. Each profile saves to
          Supabase and connects to the correct dashboard.
        </Text>
      </View>

      <View style={styles.card}>
        {REGISTER_ROLES.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.roleCard}
            onPress={() => goTo(item.route)}
            activeOpacity={0.85}
          >
            <Text style={styles.roleIcon}>{item.icon}</Text>

            <View style={{ flex: 1 }}>
              <Text style={styles.roleTitle}>{item.title}</Text>
              <Text style={styles.roleSubtitle}>{item.subtitle}</Text>
            </View>

            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={styles.loginButton}
        onPress={() => router.push("/auth/login" as any)}
      >
        <Text style={styles.loginText}>Already have an account? Login</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.homeButton}
        onPress={() => router.replace("/" as any)}
      >
        <Text style={styles.homeText}>Back Home</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F7F7F2",
  },
  content: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 80,
  },
  hero: {
    backgroundColor: "#064E3B",
    borderRadius: 28,
    padding: 24,
    marginBottom: 18,
  },
  logo: {
    fontSize: 54,
    marginBottom: 8,
  },
  kicker: {
    color: "#BBF7D0",
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
    fontSize: 12,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900",
    marginTop: 8,
  },
  subtitle: {
    color: "#D1FAE5",
    fontWeight: "700",
    lineHeight: 23,
    marginTop: 10,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  roleCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
  },
  roleIcon: {
    fontSize: 32,
    marginRight: 14,
  },
  roleTitle: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "900",
  },
  roleSubtitle: {
    color: "#6B7280",
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 4,
  },
  arrow: {
    fontSize: 34,
    color: "#2F7D32",
    fontWeight: "900",
    marginLeft: 10,
  },
  loginButton: {
    backgroundColor: "#2F7D32",
    borderRadius: 18,
    padding: 16,
    alignItems: "center",
    marginTop: 18,
  },
  loginText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },
  homeButton: {
    padding: 16,
    alignItems: "center",
  },
  homeText: {
    color: "#064E3B",
    fontWeight: "900",
  },
});