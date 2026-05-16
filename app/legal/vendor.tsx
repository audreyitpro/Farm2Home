import React from "react";
import { ScrollView, Text, StyleSheet } from "react-native";

export default function VendorPage() {
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Vendor Agreement</Text>

      <Text style={styles.text}>
        Farmers are responsible for lawful operations, licenses, insurance,
        taxes, food safety, and product quality.
      </Text>

      <Text style={styles.text}>
        Farm2Home may suspend accounts for fraud, unsafe products, or policy
        violations.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 20 },
  title: { fontSize: 28, fontWeight: "900", marginBottom: 20 },
  text: { marginBottom: 14, lineHeight: 22, color: "#444" },
});