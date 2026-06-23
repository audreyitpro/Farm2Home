import React from "react";
import { View, Text, StyleSheet } from "react-native";
import finaTheme from "../styles/finaTheme";

export default function FinaMetricCard({
  title,
  value,
}: any) {
  return (
    <View style={styles.card}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: "#FFF",
    padding: 18,
    borderRadius: 20,

    borderWidth: 1,
    borderColor: finaTheme.colors.border,
  },

  value: {
    fontSize: 28,
    fontWeight: "700",
    color: finaTheme.colors.text,
  },

  title: {
    marginTop: 6,
    fontSize: 13,
    color: finaTheme.colors.textSecondary,
  },
});