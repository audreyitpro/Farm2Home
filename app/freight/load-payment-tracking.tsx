import React, { useMemo, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type PaymentStatus = "Pending POD" | "Approved" | "Processing" | "Paid";

type PaymentItem = {
  id: string;
  loadId: string;
  lane: string;
  rate: number;
  accessorials: number;
  deductions: number;
  status: PaymentStatus;
};

const payments: PaymentItem[] = [
  {
    id: "p1",
    loadId: "load-1001",
    lane: "Detroit, MI → Columbus, OH",
    rate: 650,
    accessorials: 50,
    deductions: 0,
    status: "Approved",
  },
  {
    id: "p2",
    loadId: "load-1002",
    lane: "Sterling Heights, MI → Chicago, IL",
    rate: 980,
    accessorials: 0,
    deductions: 25,
    status: "Processing",
  },
  {
    id: "p3",
    loadId: "load-1003",
    lane: "Ann Arbor, MI → Cleveland, OH",
    rate: 720,
    accessorials: 35,
    deductions: 0,
    status: "Paid",
  },
];

export default function LoadPaymentTracking() {
  const [selectedStatus, setSelectedStatus] = useState<PaymentStatus | "All">("All");

  const statuses: Array<PaymentStatus | "All"> = [
    "All",
    "Pending POD",
    "Approved",
    "Processing",
    "Paid",
  ];

  const filteredPayments = useMemo(() => {
    if (selectedStatus === "All") return payments;
    return payments.filter((payment) => payment.status === selectedStatus);
  }, [selectedStatus]);

  const totalReceivable = useMemo(() => {
    return payments.reduce(
      (sum, payment) => sum + payment.rate + payment.accessorials - payment.deductions,
      0
    );
  }, []);

  function requestPayout(payment: PaymentItem) {
    Alert.alert(
      "Payout Requested",
      `${payment.loadId} payout request submitted for $${(
        payment.rate +
        payment.accessorials -
        payment.deductions
      ).toFixed(2)}.`
    );
  }

  function netAmount(payment: PaymentItem) {
    return payment.rate + payment.accessorials - payment.deductions;
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Freight Payments</Text>
        <Text style={styles.title}>Load Payment Tracking</Text>
        <Text style={styles.subtitle}>
          Track carrier receivables, accessorials, deductions, payout status,
          and completed load payments.
        </Text>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Total Receivable</Text>
        <Text style={styles.summaryAmount}>${totalReceivable.toFixed(2)}</Text>
        <Text style={styles.summaryText}>
          Includes load rates, accessorials, and deductions.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Filter Status</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
        {statuses.map((item) => (
          <TouchableOpacity
            key={item}
            style={[styles.chip, selectedStatus === item && styles.chipActive]}
            onPress={() => setSelectedStatus(item)}
          >
            <Text style={[styles.chipText, selectedStatus === item && styles.chipTextActive]}>
              {item}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.sectionTitle}>Payments</Text>

      {filteredPayments.map((payment) => (
        <View key={payment.id} style={styles.paymentCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.loadId}>{payment.loadId}</Text>
            <Text style={styles.lane}>{payment.lane}</Text>

            <Text style={styles.detail}>Rate: ${payment.rate.toFixed(2)}</Text>
            <Text style={styles.detail}>Accessorials: ${payment.accessorials.toFixed(2)}</Text>
            <Text style={styles.detail}>Deductions: ${payment.deductions.toFixed(2)}</Text>

            <Text style={styles.net}>Net: ${netAmount(payment).toFixed(2)}</Text>
          </View>

          <View style={styles.statusCol}>
            <Text style={styles.statusBadge}>{payment.status}</Text>

            <TouchableOpacity
              style={styles.payoutButton}
              onPress={() => requestPayout(payment)}
            >
              <Text style={styles.payoutText}>Payout</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      <View style={styles.aiCard}>
        <Text style={styles.aiTitle}>AI Payment Intelligence</Text>
        <Text style={styles.aiText}>
          Later this can flag late payments, detect missing PODs, estimate cash
          flow, and automate payout workflows.
        </Text>
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

  title: { color: "#FFFFFF", fontSize: 34, fontWeight: "900", marginBottom: 10 },

  subtitle: { color: "#D1D5DB", fontWeight: "700", lineHeight: 23 },

  summaryCard: {
    backgroundColor: "#111827",
    margin: 18,
    borderRadius: 22,
    padding: 20,
  },

  summaryLabel: { color: "#BFDBFE", fontWeight: "900" },

  summaryAmount: { color: "#FFFFFF", fontSize: 44, fontWeight: "900", marginTop: 6 },

  summaryText: { color: "#D1D5DB", fontWeight: "700", marginTop: 8 },

  sectionTitle: {
    color: "#111827",
    fontSize: 23,
    fontWeight: "900",
    paddingHorizontal: 18,
    marginBottom: 12,
  },

  chipRow: { paddingLeft: 18, marginBottom: 16 },

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

  paymentCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    marginBottom: 12,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    flexDirection: "row",
    gap: 12,
  },

  loadId: { color: "#111827", fontSize: 19, fontWeight: "900" },

  lane: { color: "#6B7280", fontWeight: "700", marginTop: 4, marginBottom: 8 },

  detail: { color: "#374151", fontWeight: "700", lineHeight: 22 },

  net: { color: "#2563EB", fontSize: 18, fontWeight: "900", marginTop: 8 },

  statusCol: { alignItems: "flex-end", justifyContent: "space-between" },

  statusBadge: {
    backgroundColor: "#DBEAFE",
    color: "#1D4ED8",
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden",
    textAlign: "center",
  },

  payoutButton: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },

  payoutText: { color: "#FFFFFF", fontWeight: "900" },

  aiCard: {
    backgroundColor: "#111827",
    marginHorizontal: 18,
    marginTop: 8,
    borderRadius: 22,
    padding: 18,
  },

  aiTitle: { color: "#FFFFFF", fontSize: 23, fontWeight: "900", marginBottom: 8 },

  aiText: { color: "#BFDBFE", fontWeight: "700", lineHeight: 22 },
});