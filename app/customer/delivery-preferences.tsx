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
import { router } from "expo-router";

import farmTheme from "../styles/farmTheme";

type DeliveryMethod = "Delivery" | "Pickup" | "Either";
type DeliveryWindow = "Morning" | "Afternoon" | "Evening" | "Anytime";

export default function DeliveryPreferences() {
  const [method, setMethod] = useState<DeliveryMethod>("Delivery");
  const [deliveryWindow, setDeliveryWindow] =
    useState<DeliveryWindow>("Afternoon");
  const [contactless, setContactless] = useState(true);
  const [doorstep, setDoorstep] = useState(true);
  const [callOnArrival, setCallOnArrival] = useState(false);
  const [notes, setNotes] = useState(
    "Leave groceries at front door. Please knock after delivery."
  );

  const methods: DeliveryMethod[] = ["Delivery", "Pickup", "Either"];
  const windows: DeliveryWindow[] = [
    "Morning",
    "Afternoon",
    "Evening",
    "Anytime",
  ];

  function savePreferences() {
    Alert.alert(
      "Preferences Saved",
      `Method: ${method}\nWindow: ${deliveryWindow}\nContactless: ${
        contactless ? "Yes" : "No"
      }`
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Farm2Home Delivery</Text>
        <Text style={styles.title}>Delivery Preferences</Text>
        <Text style={styles.subtitle}>
          Save your preferred delivery method, time window, drop-off style, and
          driver instructions.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Preferred Method</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipRow}
      >
        {methods.map((item) => (
          <TouchableOpacity
            key={item}
            style={[styles.chip, method === item && styles.chipActive]}
            onPress={() => setMethod(item)}
          >
            <Text
              style={[
                styles.chipText,
                method === item && styles.chipTextActive,
              ]}
            >
              {item}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.sectionTitle}>Delivery Window</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipRow}
      >
        {windows.map((item) => (
          <TouchableOpacity
            key={item}
            style={[
              styles.chip,
              deliveryWindow === item && styles.chipActive,
            ]}
            onPress={() => setDeliveryWindow(item)}
          >
            <Text
              style={[
                styles.chipText,
                deliveryWindow === item && styles.chipTextActive,
              ]}
            >
              {item}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Drop-off Options</Text>

        <View style={styles.toggleRow}>
          <View style={styles.toggleCopy}>
            <Text style={styles.toggleTitle}>Contactless Delivery</Text>
            <Text style={styles.toggleText}>
              Driver leaves order without handoff.
            </Text>
          </View>
          <Switch value={contactless} onValueChange={setContactless} />
        </View>

        <View style={styles.toggleRow}>
          <View style={styles.toggleCopy}>
            <Text style={styles.toggleTitle}>Leave at Doorstep</Text>
            <Text style={styles.toggleText}>
              Default drop-off at front door.
            </Text>
          </View>
          <Switch value={doorstep} onValueChange={setDoorstep} />
        </View>

        <View style={styles.toggleRowLast}>
          <View style={styles.toggleCopy}>
            <Text style={styles.toggleTitle}>Call on Arrival</Text>
            <Text style={styles.toggleText}>
              Driver calls when nearby or arrived.
            </Text>
          </View>
          <Switch value={callOnArrival} onValueChange={setCallOnArrival} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Driver Instructions</Text>

        <TextInput
          style={styles.notesInput}
          value={notes}
          onChangeText={setNotes}
          multiline
          placeholder="Example: Gate code, side door, call when close..."
          placeholderTextColor="#9CA3AF"
        />

        <TouchableOpacity style={styles.primaryButton} onPress={savePreferences}>
          <Text style={styles.primaryText}>Save Delivery Preferences</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Current Delivery Setup</Text>
        <Text style={styles.summaryItem}>• Method: {method}</Text>
        <Text style={styles.summaryItem}>• Window: {deliveryWindow}</Text>
        <Text style={styles.summaryItem}>
          • Contactless: {contactless ? "Yes" : "No"}
        </Text>
        <Text style={styles.summaryItem}>
          • Doorstep Drop-off: {doorstep ? "Yes" : "No"}
        </Text>
        <Text style={styles.summaryItem}>
          • Call on Arrival: {callOnArrival ? "Yes" : "No"}
        </Text>
      </View>

      <View style={styles.aiCard}>
        <Text style={styles.aiTitle}>AI Delivery Intelligence</Text>
        <Text style={styles.aiText}>
          Later this can help optimize driver routing, reduce missed deliveries,
          remember household instructions, and match delivery windows to customer
          behavior.
        </Text>

        <Text style={styles.aiItem}>• Route-friendly delivery windows</Text>
        <Text style={styles.aiItem}>• Smart driver instructions</Text>
        <Text style={styles.aiItem}>• Pickup vs delivery recommendations</Text>
        <Text style={styles.aiItem}>• Delivery reminder automation</Text>
      </View>

      <View style={styles.navRow}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => router.push("/customer/checkout")}
        >
          <Text style={styles.navButtonText}>Checkout</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButtonOutline}
          onPress={() => router.push("/customer/order-tracking")}
        >
          <Text style={styles.navButtonOutlineText}>Track Order</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: farmTheme.colors.background,
  },
  hero: {
    backgroundColor: farmTheme.colors.primary,
    paddingTop: 64,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  eyebrow: {
    color: "#D1FAE5",
    fontWeight: "900",
    marginBottom: 8,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 35,
    fontWeight: "900",
    marginBottom: 10,
    lineHeight: 40,
  },
  subtitle: {
    color: "#E8F5E9",
    lineHeight: 23,
    fontWeight: "700",
  },
  sectionTitle: {
    color: farmTheme.colors.text,
    fontSize: 23,
    fontWeight: "900",
    paddingHorizontal: 18,
    marginTop: 18,
    marginBottom: 12,
  },
  chipRow: {
    paddingLeft: 18,
    marginBottom: 4,
  },
  chip: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 999,
    marginRight: 10,
  },
  chipActive: {
    backgroundColor: farmTheme.colors.primary,
    borderColor: farmTheme.colors.primary,
  },
  chipText: {
    color: farmTheme.colors.text,
    fontWeight: "900",
  },
  chipTextActive: {
    color: "#FFFFFF",
  },
  card: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    marginTop: 18,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    ...farmTheme.shadow,
  },
  cardTitle: {
    color: farmTheme.colors.text,
    fontSize: 23,
    fontWeight: "900",
    marginBottom: 12,
  },
  toggleCopy: {
    flex: 1,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    gap: 12,
  },
  toggleRowLast: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 14,
    gap: 12,
  },
  toggleTitle: {
    color: farmTheme.colors.text,
    fontSize: 17,
    fontWeight: "900",
  },
  toggleText: {
    color: farmTheme.colors.mutedText,
    fontWeight: "700",
    marginTop: 4,
    lineHeight: 20,
  },
  notesInput: {
    minHeight: 130,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
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
  primaryText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  summaryCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    marginTop: 18,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
  },
  summaryTitle: {
    color: farmTheme.colors.text,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 10,
  },
  summaryItem: {
    color: farmTheme.colors.mutedText,
    fontWeight: "800",
    lineHeight: 25,
  },
  aiCard: {
    backgroundColor: "#064E3B",
    marginHorizontal: 18,
    marginTop: 18,
    borderRadius: 22,
    padding: 18,
  },
  aiTitle: {
    color: "#FFFFFF",
    fontSize: 23,
    fontWeight: "900",
    marginBottom: 8,
  },
  aiText: {
    color: "#BBF7D0",
    lineHeight: 22,
    fontWeight: "700",
    marginBottom: 12,
  },
  aiItem: {
    color: "#D1FAE5",
    fontWeight: "800",
    lineHeight: 25,
  },
  navRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 18,
    marginTop: 18,
  },
  navButton: {
    flex: 1,
    backgroundColor: farmTheme.colors.primary,
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
  },
  navButtonOutline: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: farmTheme.colors.primary,
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
  },
  navButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  navButtonOutlineText: {
    color: farmTheme.colors.primary,
    fontWeight: "900",
  },
  bottomSpacer: {
    height: 90,
  },
});