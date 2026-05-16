import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";

type Role = "customer" | "farmer" | "driver" | "freight" | "admin";

const TEST_ROUTES: Record<Role, string> = {
  customer: "/marketplace",
  farmer: "/farmer/dashboard",
  driver: "/driver/dashboard",
  freight: "/freight/board",
  admin: "/admin/dashboard",
};

async function loginAs(role: Role) {
  const user = {
    id: `test_${role}_001`,
    email: `${role}@test.com`,
    fullName: `Test ${role}`,
    role,
    membershipStatus: "Active",
    subscriptionStatus: "Active",
    createdAt: new Date().toISOString(),
  };

  await AsyncStorage.setItem("currentUser", JSON.stringify(user));
  await AsyncStorage.setItem("currentUserRole", role);

  router.replace(TEST_ROUTES[role] as any);
}

export default function LoginScreen() {
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.logo}>🌾</Text>
      <Text style={styles.title}>Farm2Home Test Login</Text>
      <Text style={styles.subtitle}>Tap a role to open that section.</Text>

      <View style={styles.card}>
        <TouchableOpacity style={styles.button} onPress={() => loginAs("customer")}>
          <Text style={styles.buttonText}>Login as Customer</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={() => loginAs("farmer")}>
          <Text style={styles.buttonText}>Login as Farmer</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={() => loginAs("driver")}>
          <Text style={styles.buttonText}>Login as Driver</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={() => loginAs("freight")}>
          <Text style={styles.buttonText}>Login as Freight</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.adminButton} onPress={() => loginAs("admin")}>
          <Text style={styles.buttonText}>Login as Admin</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F7F7F2",
  },
  content: {
    padding: 22,
    paddingTop: 70,
  },
  logo: {
    fontSize: 64,
    textAlign: "center",
    marginBottom: 10,
  },
  title: {
    fontSize: 34,
    fontWeight: "900",
    color: "#064E3B",
    textAlign: "center",
  },
  subtitle: {
    color: "#475569",
    fontWeight: "700",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 24,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  button: {
    backgroundColor: "#2F7D32",
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  adminButton: {
    backgroundColor: "#111827",
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },
});