import React from "react";
import { router } from "expo-router";
import { SafeAreaView, Text, TouchableOpacity, StyleSheet } from "react-native";

export default function FarmerIndexScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Farmer Screen Works</Text>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push("/farmer/post-load" as any)}
      >
        <Text style={styles.buttonText}>Go To Post Load</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F7F7F2",
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#064E3B",
    marginBottom: 20,
  },
  button: {
    backgroundColor: "#2F7D32",
    padding: 16,
    borderRadius: 14,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
});