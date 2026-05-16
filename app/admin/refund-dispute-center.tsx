import React, { useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

type DisputeStatus = "Open" | "Approved" | "Denied" | "Needs Info";

type Dispute = {
  id: string;
  orderId: string;
  customer: string;
  reason: string;
  amount: number;
  status: DisputeStatus;
};

const starterDisputes: Dispute[] = [
  {
    id: "d1",
    orderId: "ORD-10021",
    customer: "Sarah Johnson",
    reason: "Missing item",
    amount: 12.99,
    status: "Open",
  },
  {
    id: "d2",
    orderId: "ORD-10022",
    customer: "Marcus Lee",
    reason: "Damaged produce",
    amount: 21.99,
    status: "Needs Info",
  },
];

export default function RefundDisputeCenter() {
  const [disputes, setDisputes] = useState<Dispute[]>(starterDisputes);

  const openCount = useMemo(() => {
    return disputes.filter(
      (item) => item.status === "Open" || item.status === "Needs Info"
    ).length;
  }, [disputes]);

  function updateStatus(id: string, status: DisputeStatus) {
    setDisputes((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status } : item))
    );

    Alert.alert("Dispute Updated", `Dispute status changed to ${status}.`);
  }

  function statusStyle(status: DisputeStatus) {
    if (status === "Approved") return styles.approved;
    if (status === "Denied") return styles.denied;
    if (status === "Needs Info") return styles.needsInfo;
    return styles.open;
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Admin Support</Text>
        <Text style={styles.title}>Refund & Dispute Center</Text>
        <Text style={styles.subtitle}>
          Review customer refund requests, damaged item claims, missing items,
          and order disputes.
        </Text>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Open Cases</Text>
        <Text style={styles.summaryNumber}>{openCount}</Text>
        <Text style={styles.summaryText}>
          Active refunds and disputes requiring review.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Dispute Queue</Text>

      {disputes.map((item) => (
        <View key={item.id} style={styles.disputeCard}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.orderId}>{item.orderId}</Text>
              <Text style={styles.metaText}>{item.customer}</Text>
              <Text style={styles.metaText}>{item.reason}</Text>
            </View>

            <Text style={[styles.statusBadge, statusStyle(item.status)]}>
              {item.status}
            </Text>
          </View>

          <View style={styles.amountBox}>
            <Text style={styles.amountLabel}>Requested Refund</Text>
            <Text style={styles.amountValue}>${item.amount.toFixed(2)}</Text>
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.approveButton}
              onPress={() => updateStatus(item.id, "Approved")}
            >
              <Text style={styles.approveText}>Approve</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.infoButton}
              onPress={() => updateStatus(item.id, "Needs Info")}
            >
              <Text style={styles.infoText}>Need Info</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.denyButton}
              onPress={() => updateStatus(item.id, "Denied")}
            >
              <Text style={styles.denyText}>Deny</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Production Add-ons</Text>
        <Text style={styles.infoItem}>• Stripe refund API integration</Text>
        <Text style={styles.infoItem}>• Photo evidence review</Text>
        <Text style={styles.infoItem}>• Farmer response workflow</Text>
        <Text style={styles.infoItem}>• Delivery proof comparison</Text>
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
    backgroundColor: "#FFFFFF",
    margin: 18,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  summaryLabel: { color: "#6B7280", fontWeight: "900" },
  summaryNumber: { color: "#2563EB", fontSize: 44, fontWeight: "900", marginTop: 4 },
  summaryText: { color: "#6B7280", fontWeight: "700", lineHeight: 22, marginTop: 6 },
  sectionTitle: {
    color: "#111827",
    fontSize: 23,
    fontWeight: "900",
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  disputeCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    marginBottom: 12,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  headerRow: { flexDirection: "row", gap: 12 },
  orderId: { color: "#111827", fontSize: 19, fontWeight: "900" },
  metaText: { color: "#6B7280", fontWeight: "700", marginTop: 5 },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden",
    fontSize: 12,
    fontWeight: "900",
  },
  open: { backgroundColor: "#FEF3C7", color: "#92400E" },
  needsInfo: { backgroundColor: "#DBEAFE", color: "#1D4ED8" },
  approved: { backgroundColor: "#DCFCE7", color: "#166534" },
  denied: { backgroundColor: "#FEE2E2", color: "#991B1B" },
  amountBox: {
    backgroundColor: "#EFF6FF",
    borderRadius: 16,
    padding: 14,
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  amountLabel: { color: "#374151", fontWeight: "900" },
  amountValue: { color: "#2563EB", fontSize: 20, fontWeight: "900" },
  buttonRow: { flexDirection: "row", gap: 8, marginTop: 14 },
  approveButton: { flex: 1, backgroundColor: "#2563EB", padding: 13, borderRadius: 14, alignItems: "center" },
  approveText: { color: "#FFFFFF", fontWeight: "900" },
  infoButton: { flex: 1, backgroundColor: "#DBEAFE", padding: 13, borderRadius: 14, alignItems: "center" },
  infoText: { color: "#1D4ED8", fontWeight: "900" },
  denyButton: { flex: 1, backgroundColor: "#FEE2E2", padding: 13, borderRadius: 14, alignItems: "center" },
  denyText: { color: "#DC2626", fontWeight: "900" },
  infoCard: {
    backgroundColor: "#111827",
    marginHorizontal: 18,
    marginTop: 8,
    borderRadius: 22,
    padding: 18,
  },
  infoTitle: { color: "#FFFFFF", fontSize: 23, fontWeight: "900", marginBottom: 10 },
  infoItem: { color: "#BFDBFE", fontWeight: "800", lineHeight: 25 },
});