import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { supabase } from "../data/supabaseClient";

const COLORS = {
  bg: "#F6F8F2",
  card: "#FFFFFF",
  text: "#172017",
  muted: "#6B7280",
  border: "#E3E8DD",
  primary: "#2E7D32",
  primaryDark: "#14532D",
  soft: "#EEF5EA",
  dark: "#111827",
};

export default function AssignedDriversScreen() {
  const [loading, setLoading] = useState(true);
  const [farmerId, setFarmerId] = useState("");
  const [drivers, setDrivers] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    loadDrivers();
  }, []);

  async function loadDrivers() {
    try {
      setLoading(true);

      const saved =
        (await AsyncStorage.getItem("currentFarmer")) ||
        (await AsyncStorage.getItem("currentUser"));

      if (!saved) {
        router.replace("/farmer/login" as any);
        return;
      }

      const farmer = JSON.parse(saved);
      const id = farmer.id || farmer.farmerId;

      if (!id) {
        router.replace("/farmer/login" as any);
        return;
      }

      setFarmerId(id);

      const { data } = await supabase
        .from("farmer_internal_drivers")
        .select("*")
        .eq("farmer_id", id)
        .eq("active", true)
        .order("created_at", { ascending: false });

      setDrivers(data || []);
    } catch (error: any) {
      Alert.alert("Drivers Error", error?.message || "Unable to load drivers.");
    } finally {
      setLoading(false);
    }
  }

  async function addDriver() {
    if (!name.trim()) {
      Alert.alert("Missing Name", "Enter driver name.");
      return;
    }

    const { error } = await supabase.from("farmer_internal_drivers").insert({
      farmer_id: farmerId,
      driver_name: name.trim(),
      driver_email: email.trim().toLowerCase(),
      driver_phone: phone.trim(),
      active: true,
      created_at: new Date().toISOString(),
    });

    if (error) {
      Alert.alert("Driver Error", error.message);
      return;
    }

    setName("");
    setEmail("");
    setPhone("");
    await loadDrivers();
  }

  async function removeDriver(id: string) {
    await supabase
      .from("farmer_internal_drivers")
      .update({ active: false })
      .eq("id", id);

    await loadDrivers();
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.centerText}>Loading assigned drivers...</Text>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Assigned Drivers</Text>
            <Text style={styles.subtitle}>Manage internal farm drivers</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Add Internal Driver</Text>

          <TextInput
            style={styles.input}
            placeholder="Driver name"
            placeholderTextColor="#8A9482"
            value={name}
            onChangeText={setName}
          />

          <TextInput
            style={styles.input}
            placeholder="Driver email"
            placeholderTextColor="#8A9482"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <TextInput
            style={styles.input}
            placeholder="Driver phone"
            placeholderTextColor="#8A9482"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />

          <Pressable style={styles.primaryButton} onPress={addDriver}>
            <Text style={styles.primaryButtonText}>Add Driver</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Active Drivers</Text>

          {drivers.length === 0 ? (
            <Text style={styles.emptyText}>No internal drivers added yet.</Text>
          ) : (
            drivers.map((driver) => (
              <View key={driver.id} style={styles.driverRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.driverName}>{driver.driver_name}</Text>
                  <Text style={styles.driverMeta}>
                    {driver.driver_email || "No email"} · {driver.driver_phone || "No phone"}
                  </Text>
                </View>

                <Pressable
                  style={styles.removeButton}
                  onPress={() => removeDriver(driver.id)}
                >
                  <Text style={styles.removeButtonText}>Remove</Text>
                </Pressable>
              </View>
            ))
          )}
        </View>

        <Pressable
          style={styles.darkButton}
          onPress={() => router.push("/farmer/delivery-orders" as any)}
        >
          <Text style={styles.darkButtonText}>View Delivery Orders</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16, paddingBottom: 40 },
  center: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: "center",
    alignItems: "center",
  },
  centerText: { marginTop: 10, color: COLORS.primary, fontWeight: "800" },
  header: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
  },
  backText: { fontSize: 28, fontWeight: "900", color: COLORS.text, marginTop: -4 },
  title: { color: COLORS.text, fontWeight: "900", fontSize: 24 },
  subtitle: { color: COLORS.muted, fontWeight: "700", fontSize: 12 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 12,
  },
  sectionTitle: { color: COLORS.text, fontWeight: "900", fontSize: 18, marginBottom: 10 },
  input: {
    backgroundColor: COLORS.soft,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.text,
    fontWeight: "700",
    marginBottom: 8,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 4,
  },
  primaryButtonText: { color: "#FFFFFF", fontWeight: "900" },
  emptyText: { color: COLORS.muted, fontWeight: "700", textAlign: "center" },
  driverRow: {
    backgroundColor: COLORS.soft,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  driverName: { color: COLORS.text, fontWeight: "900" },
  driverMeta: { color: COLORS.muted, fontWeight: "700", fontSize: 12, marginTop: 3 },
  removeButton: {
    backgroundColor: "#FEE2E2",
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  removeButtonText: { color: "#991B1B", fontWeight: "900", fontSize: 12 },
  darkButton: {
    backgroundColor: COLORS.dark,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  darkButtonText: { color: "#FFFFFF", fontWeight: "900" },
});