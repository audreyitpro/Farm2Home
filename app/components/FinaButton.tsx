import React from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
} from "react-native";

import finaTheme from "../styles/finaTheme";

export default function FinaButton({
  title,
  onPress,
  loading = false,
}: any) {
  return (
    <TouchableOpacity
      disabled={loading}
      style={styles.button}
      onPress={onPress}
    >
      <Text style={styles.text}>
        {loading ? "Loading..." : title}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: finaTheme.colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },

  text: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },
});