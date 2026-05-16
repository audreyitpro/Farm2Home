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
import farmTheme from "../styles/farmTheme";

type RefundReason =
  | "Missing Item"
  | "Damaged Product"
  | "Late Delivery"
  | "Wrong Item"
  | "Quality Issue"
  | "Other";

export default function RefundRequest() {
  const [reason, setReason] = useState<RefundReason>("Missing Item");
  const [orderId, setOrderId] = useState("");
  const [amount, setAmount] = useState("");
  const [details, setDetails] = useState("");

  const reasons: RefundReason[] = [
    "Missing Item",
    "Damaged Product",
    "Late Delivery",
    "Wrong Item",
    "Quality Issue",
    "Other",
  ];

  function submitRefund() {
    if (!orderId.trim() || !details.trim()) {
      Alert.alert("Missing Details", "Enter order ID and issue details.");
      return;
    }

    Alert.alert(
      "Refund Request Submitted",
      `Order: ${orderId}\nReason: ${reason}\nAmount: ${amount || "Review needed"}`
    );

    setOrderId("");
    setAmount("");
    setDetails("");
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Farm2Home Support</Text>
        <Text style={styles.title}>Refund Request</Text>
        <Text style={styles.subtitle}>
          Submit refund requests for missing items, damaged products, delivery
          issues, or quality concerns.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Refund Reason</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
        {reasons.map((item) => (
          <TouchableOpacity
            key={item}
            style={[styles.chip, reason === item && styles.chipActive]}
            onPress={() => setReason(item)}
          >
            <Text style={[styles.chipText, reason === item && styles.chipTextActive]}>
              {item}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.formCard}>
        <Text style={styles.formTitle}>Request Details</Text>

        <TextInput
          style={styles.input}
          placeholder="Order ID"
          value={orderId}
          onChangeText={setOrderId}
        />

        <TextInput
          style={styles.input}
          placeholder="Requested amount optional"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
        />

        <TextInput
          style={styles.detailsInput}
          placeholder="Describe the issue..."
          value={details}
          onChangeText={setDetails}
          multiline
        />

        <TouchableOpacity style={styles.primaryButton} onPress={submitRefund}>
          <Text style={styles.primaryText}>Submit Refund Request</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.outlineButton}
          onPress={() => router.push("/customer/customer-support")}
        >
          <Text style={styles.outlineText}>Go to Customer Support</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Refund Review Process</Text>
        <Text style={styles.infoItem}>• Support reviews your order details</Text>
        <Text style={styles.infoItem}>• Farm or delivery proof may be checked</Text>
        <Text style={styles.infoItem}>• Refund can be approved, denied, or adjusted</Text>
        <Text style={styles.infoItem}>• Future production flow connects to Stripe refunds</Text>
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

  title: { color: "#FFFFFF", fontSize: 36, fontWeight: "900", marginBottom: 10 },

  subtitle: { color: "#E8F5E9", fontWeight: "700", lineHeight: 23 },

  sectionTitle: {
    color: farmTheme.colors.text,
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
    borderColor: farmTheme.colors.border,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 999,
    marginRight: 10,
  },

  chipActive: { backgroundColor: farmTheme.colors.primary, borderColor: farmTheme.colors.primary },

  chipText: { color: farmTheme.colors.text, fontWeight: "900" },

  chipTextActive: { color: "#FFFFFF" },

  formCard: {
    backgroundColor: "#FFFFFF",
    margin: 18,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    ...farmTheme.shadow,
  },

  formTitle: { color: farmTheme.colors.text, fontSize: 23, fontWeight: "900", marginBottom: 12 },

  input: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    padding: 14,
    color: farmTheme.colors.text,
    fontWeight: "700",
    marginBottom: 12,
  },

  detailsInput: {
    minHeight: 130,
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
    marginBottom: 10,
  },

  primaryText: { color: "#FFFFFF", fontWeight: "900" },

  outlineButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: farmTheme.colors.primary,
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
  },

  outlineText: { color: farmTheme.colors.primary, fontWeight: "900" },

  infoCard: {
    backgroundColor: "#064E3B",
    marginHorizontal: 18,
    borderRadius: 22,
    padding: 18,
  },

  infoTitle: { color: "#FFFFFF", fontSize: 23, fontWeight: "900", marginBottom: 10 },

  infoItem: { color: "#BBF7D0", fontWeight: "800", lineHeight: 25 },
});