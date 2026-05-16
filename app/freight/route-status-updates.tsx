import React, { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";

type RouteStatus =
  | "Picked Up"
  | "In Transit"
  | "Delayed"
  | "At Delivery"
  | "Delivered";

export default function RouteStatusUpdates() {
  const [status, setStatus] = useState<RouteStatus>("In Transit");
  const [eta, setEta] = useState("Today 6:30 PM");
  const [location, setLocation] = useState("Toledo, OH");
  const [notes, setNotes] = useState("");

  const statuses: RouteStatus[] = [
    "Picked Up",
    "In Transit",
    "Delayed",
    "At Delivery",
    "Delivered",
  ];

  function submitUpdate() {
    Alert.alert(
      "Route Status Updated",
      `Status: ${status}\nLocation: ${location}\nETA: ${eta}`
    );

    if (status === "Delivered") {
      router.push("/freight/load-payment-tracking");
    }
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Freight Tracking</Text>
        <Text style={styles.title}>Route Status Updates</Text>
        <Text style={styles.subtitle}>
          Send dispatch and customer updates during the active route.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Current Status</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
        {statuses.map((item) => (
          <TouchableOpacity
            key={item}
            style={[styles.chip, status === item && styles.chipActive]}
            onPress={() => setStatus(item)}
          >
            <Text style={[styles.chipText, status === item && styles.chipTextActive]}>
              {item}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Route Update</Text>

        <TextInput style={styles.input} value={location} onChangeText={setLocation} placeholder="Current location" />
        <TextInput style={styles.input} value={eta} onChangeText={setEta} placeholder="ETA" />

        <TextInput
          style={styles.notesInput}
          value={notes}
          onChangeText={setNotes}
          placeholder="Delay reason, route condition, dock notes..."
          multiline
        />

        <TouchableOpacity style={styles.primaryButton} onPress={submitUpdate}>
          <Text style={styles.primaryText}>Send Route Update</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.timelineCard}>
        <Text style={styles.timelineTitle}>Route Timeline</Text>
        <Text style={styles.timelineItem}>✓ Load booked</Text>
        <Text style={styles.timelineItem}>✓ Proof of pickup submitted</Text>
        <Text style={styles.timelineItem}>• Current: {status}</Text>
        <Text style={styles.timelineItem}>• ETA: {eta}</Text>
        <Text style={styles.timelineItem}>• Location: {location}</Text>
      </View>

      <View style={{ height: 90 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F4F6" },

  hero: {
    backgroundColor: "#111827",
    paddingTop: 64,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },

  eyebrow: { color: "#93C5FD", fontWeight: "900", marginBottom: 8 },

  title: { color: "#FFFFFF", fontSize: 35, fontWeight: "900", marginBottom: 10 },

  subtitle: { color: "#D1D5DB", fontWeight: "700", lineHeight: 23 },

  sectionTitle: {
    color: "#111827",
    fontSize: 23,
    fontWeight: "900",
    paddingHorizontal: 18,
    marginTop: 18,
    marginBottom: 12,
  },

  chipRow: { paddingLeft: 18, marginBottom: 4 },

  chip: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 999,
    marginRight: 10,
  },

  chipActive: { backgroundColor: "#2563EB", borderColor: "#2563EB" },

  chipText: { color: "#111827", fontWeight: "900" },

  chipTextActive: { color: "#FFFFFF" },

  card: {
    backgroundColor: "#FFFFFF",
    margin: 18,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  cardTitle: { color: "#111827", fontSize: 23, fontWeight: "900", marginBottom: 12 },

  input: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    padding: 14,
    color: "#111827",
    fontWeight: "700",
    marginBottom: 12,
  },

  notesInput: {
    minHeight: 120,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    padding: 14,
    color: "#111827",
    fontWeight: "700",
    textAlignVertical: "top",
    marginBottom: 14,
  },

  primaryButton: {
    backgroundColor: "#2563EB",
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
  },

  primaryText: { color: "#FFFFFF", fontWeight: "900" },

  timelineCard: {
    backgroundColor: "#111827",
    marginHorizontal: 18,
    borderRadius: 22,
    padding: 18,
  },

  timelineTitle: { color: "#FFFFFF", fontSize: 23, fontWeight: "900", marginBottom: 10 },

  timelineItem: { color: "#BFDBFE", fontWeight: "800", lineHeight: 26 },
});