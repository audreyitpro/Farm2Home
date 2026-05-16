import React, { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import farmTheme from "../styles/farmTheme";

type DeliveryRange = "5 miles" | "10 miles" | "25 miles" | "50 miles";

export default function DeliveryPickupSettings() {
  const [pickupEnabled, setPickupEnabled] = useState(true);
  const [deliveryEnabled, setDeliveryEnabled] = useState(true);
  const [contactless, setContactless] = useState(true);
  const [range, setRange] = useState<DeliveryRange>("25 miles");
  const [pickupWindow, setPickupWindow] = useState("Saturday 9 AM - 2 PM");
  const [deliveryNotes, setDeliveryNotes] = useState(
    "Orders placed before 6 PM are eligible for next-day delivery."
  );

  const ranges: DeliveryRange[] = ["5 miles", "10 miles", "25 miles", "50 miles"];

  function saveSettings() {
    Alert.alert(
      "Settings Saved",
      `Pickup: ${pickupEnabled ? "On" : "Off"}\nDelivery: ${
        deliveryEnabled ? "On" : "Off"
      }\nRange: ${range}`
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Farm2Home Fulfillment</Text>
        <Text style={styles.title}>Delivery & Pickup Settings</Text>
        <Text style={styles.subtitle}>
          Control pickup availability, delivery range, customer instructions,
          and fulfillment rules.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Fulfillment Options</Text>

        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleTitle}>Pickup Enabled</Text>
            <Text style={styles.toggleText}>Customers can pick up at your farm or market stand.</Text>
          </View>
          <Switch value={pickupEnabled} onValueChange={setPickupEnabled} />
        </View>

        <View style={styles.toggleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleTitle}>Delivery Enabled</Text>
            <Text style={styles.toggleText}>Customers can request local farm delivery.</Text>
          </View>
          <Switch value={deliveryEnabled} onValueChange={setDeliveryEnabled} />
        </View>

        <View style={styles.toggleRowLast}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleTitle}>Contactless Drop-off</Text>
            <Text style={styles.toggleText}>Allow driver or farmer contactless delivery.</Text>
          </View>
          <Switch value={contactless} onValueChange={setContactless} />
        </View>
      </View>

      <Text style={styles.sectionTitle}>Delivery Range</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
        {ranges.map((item) => (
          <TouchableOpacity
            key={item}
            style={[styles.chip, range === item && styles.chipActive]}
            onPress={() => setRange(item)}
          >
            <Text style={[styles.chipText, range === item && styles.chipTextActive]}>
              {item}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Pickup Window</Text>

        <TextInput
          style={styles.input}
          value={pickupWindow}
          onChangeText={setPickupWindow}
          placeholder="Example: Saturday 9 AM - 2 PM"
        />

        <Text style={styles.cardTitle}>Delivery Notes</Text>

        <TextInput
          style={styles.notesInput}
          value={deliveryNotes}
          onChangeText={setDeliveryNotes}
          multiline
          placeholder="Delivery rules, cutoffs, packaging notes..."
        />

        <TouchableOpacity style={styles.primaryButton} onPress={saveSettings}>
          <Text style={styles.primaryText}>Save Fulfillment Settings</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.aiCard}>
        <Text style={styles.aiTitle}>AI Fulfillment Intelligence</Text>
        <Text style={styles.aiText}>
          Later this can optimize delivery zones, pickup windows, driver routing,
          and order cutoff times based on demand.
        </Text>
      </View>

      <View style={{ height: 90 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: farmTheme.colors.background },

  hero: {
    backgroundColor: farmTheme.colors.primary,
    paddingTop: 64,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },

  eyebrow: { color: "#D1FAE5", fontWeight: "900", marginBottom: 8 },

  title: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900",
    marginBottom: 10,
    lineHeight: 40,
  },

  subtitle: { color: "#E8F5E9", fontWeight: "700", lineHeight: 23 },

  card: {
    backgroundColor: "#FFFFFF",
    margin: 18,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    ...farmTheme.shadow,
  },

  cardTitle: {
    color: farmTheme.colors.text,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 12,
  },

  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },

  toggleRowLast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: 14,
  },

  toggleTitle: { color: farmTheme.colors.text, fontSize: 17, fontWeight: "900" },

  toggleText: { color: farmTheme.colors.mutedText, fontWeight: "700", marginTop: 4, lineHeight: 20 },

  sectionTitle: {
    color: farmTheme.colors.text,
    fontSize: 23,
    fontWeight: "900",
    paddingHorizontal: 18,
    marginBottom: 12,
  },

  chipRow: { paddingLeft: 18, marginBottom: 4 },

  chip: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 999,
    marginRight: 10,
  },

  chipActive: { backgroundColor: farmTheme.colors.primary, borderColor: farmTheme.colors.primary },

  chipText: { color: farmTheme.colors.text, fontWeight: "900" },

  chipTextActive: { color: "#FFFFFF" },

  input: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    padding: 14,
    color: farmTheme.colors.text,
    fontWeight: "700",
    marginBottom: 16,
  },

  notesInput: {
    minHeight: 120,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    padding: 14,
    color: farmTheme.colors.text,
    fontWeight: "700",
    textAlignVertical: "top",
    marginBottom: 14,
  },

  primaryButton: {
    backgroundColor: farmTheme.colors.primary,
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
  },

  primaryText: { color: "#FFFFFF", fontWeight: "900" },

  aiCard: {
    backgroundColor: "#064E3B",
    marginHorizontal: 18,
    borderRadius: 22,
    padding: 18,
  },

  aiTitle: { color: "#FFFFFF", fontSize: 23, fontWeight: "900", marginBottom: 8 },

  aiText: { color: "#BBF7D0", fontWeight: "700", lineHeight: 22 },
});