import React from "react";
import { ScrollView, Text, StyleSheet } from "react-native";

export default function RefundPage() {
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Refund Policy</Text>

      <Text style={styles.text}>
        Refunds may be granted for missing items, incorrect orders, or verified
        damaged goods reported promptly.
      </Text>

      <Text style={styles.text}>
        Perishable items may require photo evidence and same-day reporting.
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