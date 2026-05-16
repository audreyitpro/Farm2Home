import { View, Text, StyleSheet } from "react-native";

export default function Livestock() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>🐄 Livestock Market</Text>
      <Text>Cattle, goats, sheep, poultry listings.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 30, fontWeight: "bold", marginBottom: 15 },
});