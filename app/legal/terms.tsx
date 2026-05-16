import React from "react";
import { ScrollView, Text, StyleSheet } from "react-native";

export default function TermsPage() {
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Terms of Service</Text>

      <Text style={styles.text}>
        Farm2Home is a marketplace connecting customers with independent
        farmers and vendors.
      </Text>

      <Text style={styles.text}>
        Farm2Home does not manufacture products and is not liable for product
        defects, spoilage, delays, weather disruptions, or vendor misconduct.
      </Text>

      <Text style={styles.text}>
        Users agree to use the platform lawfully and respectfully.
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