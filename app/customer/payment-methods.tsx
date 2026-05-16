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

type PaymentMethod = {
  id: string;
  brand: string;
  last4: string;
  defaultPayment: boolean;
};

const initialPayments: PaymentMethod[] = [
  { id: "card-1", brand: "Visa", last4: "4242", defaultPayment: true },
  { id: "card-2", brand: "Mastercard", last4: "1881", defaultPayment: false },
];

export default function PaymentMethods() {
  const [payments, setPayments] = useState<PaymentMethod[]>(initialPayments);
  const [cardName, setCardName] = useState("");
  const [last4, setLast4] = useState("");
  const [defaultPayment, setDefaultPayment] = useState(false);

  function addPayment() {
    const cleanCardName = cardName.trim();
    const cleanLast4 = last4.trim();

    if (!cleanCardName || cleanLast4.length !== 4) {
      Alert.alert("Missing Details", "Enter card brand/name and last 4 digits.");
      return;
    }

    const newPayment: PaymentMethod = {
      id: `card-${Date.now()}`,
      brand: cleanCardName,
      last4: cleanLast4,
      defaultPayment,
    };

    setPayments((prev) => {
      const updatedPayments = defaultPayment
        ? prev.map((item) => ({ ...item, defaultPayment: false }))
        : prev;

      return [newPayment, ...updatedPayments];
    });

    setCardName("");
    setLast4("");
    setDefaultPayment(false);

    Alert.alert("Payment Saved", "Payment method saved for checkout.");
  }

  function makeDefault(id: string) {
    setPayments((prev) =>
      prev.map((item) => ({ ...item, defaultPayment: item.id === id }))
    );
  }

  function removePayment(id: string) {
    setPayments((prev) => {
      const removedPayment = prev.find((item) => item.id === id);
      const remainingPayments = prev.filter((item) => item.id !== id);

      if (removedPayment?.defaultPayment && remainingPayments.length > 0) {
        return remainingPayments.map((item, index) => ({
          ...item,
          defaultPayment: index === 0,
        }));
      }

      return remainingPayments;
    });
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Farm2Home Payments</Text>
        <Text style={styles.title}>Payment Methods</Text>
        <Text style={styles.subtitle}>
          Manage saved payment methods for checkout, subscriptions, and
          recurring produce boxes.
        </Text>
      </View>

      <View style={styles.noticeCard}>
        <Text style={styles.noticeTitle}>Stripe Ready</Text>
        <Text style={styles.noticeText}>
          This screen is UI-ready. In production, connect this to Stripe Setup
          Intents or Customer Portal.
        </Text>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.formTitle}>Add Payment Method</Text>

        <TextInput
          style={styles.input}
          placeholder="Card brand: Visa, Mastercard, Amex"
          placeholderTextColor="#8A8F98"
          value={cardName}
          onChangeText={setCardName}
        />

        <TextInput
          style={styles.input}
          placeholder="Last 4 digits"
          placeholderTextColor="#8A8F98"
          value={last4}
          onChangeText={setLast4}
          keyboardType="number-pad"
          maxLength={4}
        />

        <View style={styles.toggleRow}>
          <Text style={styles.toggleText}>Make default payment</Text>
          <Switch value={defaultPayment} onValueChange={setDefaultPayment} />
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={addPayment}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryText}>Save Payment Method</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Saved Payments</Text>

      {payments.map((item) => (
        <View key={item.id} style={styles.paymentCard}>
          <View style={styles.cardIcon}>
            <Text style={styles.cardIconText}>💳</Text>
          </View>

          <View style={styles.paymentInfo}>
            <Text style={styles.paymentBrand}>{item.brand}</Text>
            <Text style={styles.paymentLast4}>•••• •••• •••• {item.last4}</Text>
            {item.defaultPayment ? (
              <Text style={styles.defaultText}>Default payment</Text>
            ) : null}
          </View>

          <View style={styles.actions}>
            {!item.defaultPayment ? (
              <TouchableOpacity
                style={styles.smallButton}
                onPress={() => makeDefault(item.id)}
                activeOpacity={0.85}
              >
                <Text style={styles.smallButtonText}>Default</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => removePayment(item.id)}
              activeOpacity={0.85}
            >
              <Text style={styles.removeButtonText}>Remove</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      <View style={styles.bottomSpace} />
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
    fontSize: 36,
    fontWeight: "900",
    marginBottom: 10,
  },

  subtitle: {
    color: "#E8F5E9",
    fontWeight: "700",
    lineHeight: 23,
  },

  noticeCard: {
    backgroundColor: "#064E3B",
    margin: 18,
    borderRadius: 22,
    padding: 18,
  },

  noticeTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 8,
  },

  noticeText: {
    color: "#BBF7D0",
    fontWeight: "700",
    lineHeight: 22,
  },

  formCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    marginBottom: 18,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    ...farmTheme.shadow,
  },

  formTitle: {
    color: farmTheme.colors.text,
    fontSize: 23,
    fontWeight: "900",
    marginBottom: 12,
  },

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

  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
    gap: 12,
  },

  toggleText: {
    color: farmTheme.colors.text,
    fontWeight: "900",
    flex: 1,
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

  sectionTitle: {
    color: farmTheme.colors.text,
    fontSize: 23,
    fontWeight: "900",
    paddingHorizontal: 18,
    marginBottom: 12,
  },

  paymentCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    marginBottom: 12,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },

  cardIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#F0FDF4",
    alignItems: "center",
    justifyContent: "center",
  },

  cardIconText: {
    fontSize: 24,
  },

  paymentInfo: {
    flex: 1,
  },

  paymentBrand: {
    color: farmTheme.colors.text,
    fontSize: 18,
    fontWeight: "900",
  },

  paymentLast4: {
    color: farmTheme.colors.mutedText,
    fontWeight: "700",
    marginTop: 4,
  },

  defaultText: {
    color: farmTheme.colors.primary,
    fontWeight: "900",
    marginTop: 5,
  },

  actions: {
    gap: 8,
  },

  smallButton: {
    backgroundColor: farmTheme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    alignItems: "center",
  },

  smallButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  removeButton: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    alignItems: "center",
  },

  removeButtonText: {
    color: "#DC2626",
    fontWeight: "900",
  },

  bottomSpace: {
    height: 90,
  },
});