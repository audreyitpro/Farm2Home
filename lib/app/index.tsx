import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { router } from "expo-router";

export default function Home() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.logo}>🌾 Farm2Home</Text>

      <Text style={styles.subtitle}>
        Fresh local food • Farmers • Livestock • Freight
      </Text>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push("/marketplace")}
      >
        <Text style={styles.buttonText}>🛒 Shop Marketplace</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push("/farmer/register")}
      >
        <Text style={styles.buttonText}>🚜 Farmer Sign Up</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push("/livestock")}
      >
        <Text style={styles.buttonText}>🐄 Livestock Market</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push("/freight/register")}
      >
        <Text style={styles.buttonText}>🚚 Freight Connect</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.admin}
        onPress={() => router.push("/admin/documents")}
      >
        <Text style={styles.buttonText}>⚙️ Admin Dashboard</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 25,
    backgroundColor: "#f5f8f2",
  },
  logo: {
    fontSize: 38,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 15,
    color: "#2f7d32",
  },
  subtitle: {
    textAlign: "center",
    fontSize: 18,
    marginBottom: 35,
    color: "#444",
  },
  button: {
    backgroundColor: "#2f7d32",
    padding: 18,
    borderRadius: 14,
    marginBottom: 14,
  },
  admin: {
    backgroundColor: "#222",
    padding: 18,
    borderRadius: 14,
    marginTop: 10,
  },
  buttonText: {
    color: "white",
    textAlign: "center",
    fontSize: 17,
    fontWeight: "bold",
  },
});