import React from "react";
import { View, StyleSheet } from "react-native";
import finaTheme from "../styles/finaTheme";

export default function FinaCard({
  children,
  style,
}: any) {
  return (
    <View style={[styles.card, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: finaTheme.colors.card,
    borderRadius: 20,
    padding: 18,

    borderWidth: 1,
    borderColor: finaTheme.colors.border,

    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.08,
    shadowRadius: 10,

    elevation: 5,
  },
});