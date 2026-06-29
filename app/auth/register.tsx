// app/auth/register.tsx

import React from "react";
import {
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

type RegisterRole = {
  id: string;
  title: string;
  subtitle: string;
  route: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  badge: string;
};

const COLORS = {
  bg: "#F4F7FB",
  dark: "#07111F",
  card: "#FFFFFF",
  surface: "#F8FAFC",
  text: "#0F172A",
  muted: "#64748B",
  border: "#E2E8F0",
  primary: "#2563EB",
  green: "#16A34A",
  orange: "#EA580C",
  purple: "#7C3AED",
  white: "#FFFFFF",
};

const REGISTER_ROLES: RegisterRole[] = [
  {
    id: "customer",
    title: "Customer",
    subtitle: "Shop local farm products, manage orders, and subscribe to bundles.",
    route: "/customer/register",
    icon: "basket-outline",
    color: COLORS.purple,
    badge: "Shop",
  },
  {
    id: "farmer",
    title: "Farmer",
    subtitle: "Apply, complete compliance, list products, and sell to local communities.",
    route: "/farmer/register",
    icon: "leaf-outline",
    color: COLORS.green,
    badge: "Sell",
  },
  {
    id: "driver",
    title: "Driver",
    subtitle: "Register for delivery work, accept jobs, and manage route activity.",
    route: "/driver/register",
    icon: "car-outline",
    color: COLORS.orange,
    badge: "Deliver",
  },
  {
    id: "freight",
    title: "Freight Carrier",
    subtitle: "Register your freight account, post loads, dispatch, and manage payouts.",
    route: "/freight/register",
    icon: "trail-sign-outline",
    color: COLORS.primary,
    badge: "Freight",
  },
];

export default function RegisterScreen() {
  function goTo(route: string) {
    router.push(route as any);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.dark} />

      <ScrollView style={styles.page} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.replace("/" as any)}
          >
            <Ionicons name="arrow-back-outline" size={18} color={COLORS.white} />
            <Text style={styles.backText}>Back Home</Text>
          </TouchableOpacity>

          <View style={styles.heroIcon}>
            <Ionicons name="person-add-outline" size={34} color={COLORS.white} />
          </View>

          <Text style={styles.kicker}>Farm2Home Access Center</Text>
          <Text style={styles.title}>Create Your Account</Text>
          <Text style={styles.subtitle}>
            Choose the profile that matches how you use Farm2Home. Each account
            type has its own registration flow, Stripe setup, dashboard, and tools.
          </Text>
        </View>

        <View style={styles.flowCard}>
          <Text style={styles.flowTitle}>Registration Flow</Text>
          <FlowStep number="1" text="Choose your account type." />
          <FlowStep number="2" text="Complete the correct registration form." />
          <FlowStep number="3" text="Finish payment, compliance, or setup steps if required." />
          <FlowStep number="4" text="Login and open your dashboard." />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Select Account Type</Text>
          <Text style={styles.sectionSubtitle}>
            Pick one role below to start registration.
          </Text>

          {REGISTER_ROLES.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.roleCard}
              onPress={() => goTo(item.route)}
              activeOpacity={0.86}
            >
              <View style={[styles.roleIconBox, { backgroundColor: `${item.color}18` }]}>
                <Ionicons name={item.icon} size={28} color={item.color} />
              </View>

              <View style={{ flex: 1 }}>
                <View style={styles.roleTop}>
                  <Text style={styles.roleTitle}>{item.title}</Text>
                  <View style={[styles.badge, { backgroundColor: item.color }]}>
                    <Text style={styles.badgeText}>{item.badge}</Text>
                  </View>
                </View>

                <Text style={styles.roleSubtitle}>{item.subtitle}</Text>
              </View>

              <Ionicons name="chevron-forward-outline" size={22} color={COLORS.muted} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.actionCard}>
          <Text style={styles.actionTitle}>Already registered?</Text>
          <Text style={styles.actionText}>
            Login with your account type to continue to your dashboard.
          </Text>

          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.push("/auth/login" as any)}
          >
            <Ionicons name="log-in-outline" size={20} color={COLORS.white} />
            <Text style={styles.loginText}>Go to Login</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 70 }} />
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.dark },
  page: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingBottom: 80 },

  hero: {
    backgroundColor: COLORS.dark,
    paddingTop: 22,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  backButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginBottom: 18,
  },
  backText: { color: COLORS.white, fontWeight: "900" },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  kicker: {
    color: "#93C5FD",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    color: COLORS.white,
    fontSize: 34,
    fontWeight: "900",
    marginTop: 6,
  },
  subtitle: {
    color: "#CBD5E1",
    fontWeight: "700",
    lineHeight: 22,
    marginTop: 8,
  },

  flowCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginHorizontal: 18,
    marginTop: 18,
    marginBottom: 14,
  },
  flowTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 10,
  },
  flowStep: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    marginTop: 8,
  },
  flowNumber: {
    width: 30,
    height: 30,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    color: COLORS.primary,
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

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 26,
    padding: 16,
    marginHorizontal: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 23,
    fontWeight: "900",
  },
  sectionSubtitle: {
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 4,
    marginBottom: 14,
  },
  roleCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    padding: 14,
    marginBottom: 12,
    gap: 12,
  },
  roleIconBox: {
    width: 54,
    height: 54,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  roleTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  roleTitle: {
    color: COLORS.text,
    fontSize: 19,
    fontWeight: "900",
  },
  roleSubtitle: {
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 4,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  badgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: "900",
  },

  actionCard: {
    backgroundColor: COLORS.dark,
    borderRadius: 24,
    padding: 18,
    marginHorizontal: 18,
    marginTop: 16,
  },
  actionTitle: {
    color: COLORS.white,
    fontSize: 22,
    fontWeight: "900",
  },
  actionText: {
    color: "#CBD5E1",
    fontWeight: "700",
    lineHeight: 21,
    marginTop: 6,
    marginBottom: 14,
  },
  loginButton: {
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  loginText: {
    color: COLORS.white,
    fontWeight: "900",
    fontSize: 16,
  },
});