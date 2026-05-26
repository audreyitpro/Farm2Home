import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import { router } from "expo-router";

export default function LoginSelect() {
  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <Text style={styles.logo}>🌾</Text>

        <Text style={styles.title}>
          Farm2Home Login
        </Text>

        <Text style={styles.subtitle}>
          Choose your account type to continue
        </Text>
      </View>

      {/* CUSTOMER */}
      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push("/customer/login")}
      >
        <Text style={styles.buttonText}>
          Customer Login
        </Text>
      </TouchableOpacity>

      {/* FARMER */}
      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push("/farmer/login")}
      >
        <Text style={styles.buttonText}>
          Farmer Login
        </Text>
      </TouchableOpacity>

      {/* FREIGHT */}
      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push("/freight/login")}
      >
        <Text style={styles.buttonText}>
          Freight Login
        </Text>
      </TouchableOpacity>

      {/* DRIVER */}
      <TouchableOpacity
        style={styles.driverButton}
        onPress={() => router.push("/driver/login")}
      >
        <Text style={styles.buttonText}>
          Driver Login
        </Text>
      </TouchableOpacity>

      {/* ADMIN */}
      <TouchableOpacity
        style={styles.adminButton}
        onPress={() => router.push("/admin/login")}
      >
        <Text style={styles.buttonText}>
          Farm2Home Admin Login
        </Text>
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Fresh Food • Local Farms • Smart Freight
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#F7F7F2",
  },

  hero: {
    alignItems: "center",
    marginBottom: 34,
  },

  logo: {
    fontSize: 72,
    marginBottom: 10,
  },

  title: {
    fontSize: 34,
    fontWeight: "900",
    color: "#2F7D32",
    textAlign: "center",
  },

  subtitle: {
    textAlign: "center",
    color: "#666",
    marginTop: 10,
    marginBottom: 10,
    fontSize: 15,
    fontWeight: "700",
  },

  button: {
    backgroundColor: "#2F7D32",
    padding: 18,
    borderRadius: 16,
    marginBottom: 14,
    elevation: 2,
  },

  driverButton: {
    backgroundColor: "#2563EB",
    padding: 18,
    borderRadius: 16,
    marginBottom: 14,
    elevation: 2,
  },

  adminButton: {
    backgroundColor: "#111827",
    padding: 18,
    borderRadius: 16,
    marginBottom: 14,
    elevation: 2,
  },

  buttonText: {
    color: "#FFFFFF",
    textAlign: "center",
    fontWeight: "900",
    fontSize: 16,
  },

  footer: {
    marginTop: 28,
    alignItems: "center",
  },

  footerText: {
    color: "#64748B",
    fontWeight: "700",
    textAlign: "center",
  },
});