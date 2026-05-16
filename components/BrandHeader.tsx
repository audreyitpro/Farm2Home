import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";

export default function BrandHeader() {
  return (
    <View style={styles.container}>
      <Image
        source={require("../assets/images/farm2home-logo.png")}
        style={styles.logo}
        resizeMode="contain"
      />

      <Text style={styles.title}>Farm2Home</Text>
      <Text style={styles.tagline}>From Local Farms To Your Family</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    marginBottom: 18,
  },
  logo: {
    width: 160,
    height: 160,
    marginBottom: 6,
  },
  title: {
    fontSize: 34,
    fontWeight: "900",
    color: "#2F7D32",
  },
  tagline: {
    fontSize: 14,
    color: "#5C3B1E",
    fontWeight: "600",
    marginTop: 4,
    textAlign: "center",
  },
});