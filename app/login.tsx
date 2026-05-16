import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { router } from "expo-router";

export default function LoginSelect() {
  return (
    <View style={styles.page}>
      <Text style={styles.title}>Farm2Home Login</Text>
      <Text style={styles.subtitle}>Choose your account type</Text>

      <TouchableOpacity style={styles.button} onPress={() => router.push("/customer/login")}>
        <Text style={styles.buttonText}>Customer Login</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={() => router.push("/farmer/login")}>
        <Text style={styles.buttonText}>Farmer Login</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.adminButton} onPress={() => router.push("/admin/login")}>
        <Text style={styles.buttonText}>Farm2Home Admin Login</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#F7F7F2" },
  title: { fontSize: 32, fontWeight: "900", color: "#2F7D32", textAlign: "center" },
  subtitle: { textAlign: "center", color: "#666", marginBottom: 24 },
  button: { backgroundColor: "#2F7D32", padding: 16, borderRadius: 14, marginBottom: 12 },
  adminButton: { backgroundColor: "#111", padding: 16, borderRadius: 14 },
  buttonText: { color: "#fff", textAlign: "center", fontWeight: "900" },
});