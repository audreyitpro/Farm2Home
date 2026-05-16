import React, { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";

import { getComplianceFindings } from "../data/complianceStore";

type AdminComplianceFinding = {
  id: string;
  farmerId?: string;
  farmName?: string;
  uploadedDocumentName?: string;
  aiStatus?: "Pass" | "Needs Review" | "Fail" | "Approved" | "Rejected";
  findings?: string[];
  missingItems?: string[];
  reviewedAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

export default function AdminDocumentsScreen() {
  const [records, setRecords] = useState<AdminComplianceFinding[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadRecords();
    }, [])
  );

  async function loadRecords() {
    try {
      const findings = await getComplianceFindings();

      const safeFindings = Array.isArray(findings)
        ? ([...findings].reverse() as AdminComplianceFinding[])
        : [];

      setRecords(safeFindings);
    } catch (error) {
      console.log("Load compliance error:", error);
      setRecords([]);
    }
  }

  async function approveRecord(id: string) {
    setRecords((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, aiStatus: "Approved" } : item
      )
    );

    Alert.alert("Approved", "Business has been approved.");
  }

  async function rejectRecord(id: string) {
    setRecords((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, aiStatus: "Rejected" } : item
      )
    );

    Alert.alert("Rejected", "Business has been rejected.");
  }

  function statusColor(status?: string) {
    switch (status) {
      case "Approved":
      case "Pass":
        return "#16A34A";
      case "Rejected":
      case "Fail":
        return "#DC2626";
      case "Needs Review":
        return "#F59E0B";
      default:
        return "#2563EB";
    }
  }

  function renderRecord({ item }: { item: AdminComplianceFinding }) {
    const status = item.aiStatus || "Needs Review";

    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.farmName}>
              {item.farmName || "Farm Compliance Review"}
            </Text>

            <Text style={styles.document}>
              {item.uploadedDocumentName || "Document not provided"}
            </Text>
          </View>

          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: statusColor(status),
              },
            ]}
          >
            <Text style={styles.statusText}>{status}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Findings</Text>

          {item.findings?.length ? (
            item.findings.map((finding, index) => (
              <Text key={`finding_${index}`} style={styles.goodText}>
                • {finding}
              </Text>
            ))
          ) : (
            <Text style={styles.emptyText}>No findings available.</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Missing Items</Text>

          {item.missingItems?.length ? (
            item.missingItems.map((missing, index) => (
              <Text key={`missing_${index}`} style={styles.badText}>
                • {missing}
              </Text>
            ))
          ) : (
            <Text style={styles.goodText}>• No missing items</Text>
          )}
        </View>

        <Text style={styles.date}>
          Submitted:{" "}
          {item.reviewedAt ||
            (item.createdAt
              ? new Date(item.createdAt).toLocaleString()
              : "Date unavailable")}
        </Text>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.approveButton}
            onPress={() => approveRecord(item.id)}
          >
            <Text style={styles.buttonText}>Approve</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.rejectButton}
            onPress={() => rejectRecord(item.id)}
          >
            <Text style={styles.buttonText}>Reject</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <View style={styles.hero}>
        <Text style={styles.title}>Admin Compliance Review</Text>

        <Text style={styles.subtitle}>
          Review farmer and freight compliance submissions.
        </Text>
      </View>

      <FlatList
        data={records}
        keyExtractor={(item, index) => item.id || `record_${index}`}
        renderItem={renderRecord}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No Documents Submitted</Text>

            <Text style={styles.emptyDescription}>
              Compliance submissions from farmers and freight carriers will
              appear here.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F7F7F2",
  },
  hero: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12,
  },
  title: {
    fontSize: 30,
    fontWeight: "900",
    color: "#064E3B",
  },
  subtitle: {
    color: "#4B5563",
    fontWeight: "700",
    marginTop: 6,
    lineHeight: 22,
  },
  list: {
    padding: 18,
    paddingTop: 8,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 16,
  },
  header: {
    flexDirection: "row",
    marginBottom: 12,
    gap: 10,
  },
  headerText: {
    flex: 1,
  },
  farmName: {
    fontSize: 22,
    fontWeight: "900",
    color: "#111827",
  },
  document: {
    color: "#4B5563",
    fontWeight: "700",
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  statusText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 12,
  },
  section: {
    marginTop: 10,
  },
  sectionTitle: {
    fontWeight: "900",
    color: "#111827",
    marginBottom: 6,
  },
  goodText: {
    color: "#166534",
    fontWeight: "700",
    lineHeight: 22,
  },
  badText: {
    color: "#991B1B",
    fontWeight: "700",
    lineHeight: 22,
  },
  emptyText: {
    color: "#6B7280",
    fontWeight: "700",
  },
  date: {
    marginTop: 14,
    color: "#6B7280",
    fontWeight: "700",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  approveButton: {
    flex: 1,
    backgroundColor: "#16A34A",
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  rejectButton: {
    flex: 1,
    backgroundColor: "#DC2626",
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 24,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#111827",
    marginBottom: 8,
  },
  emptyDescription: {
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 22,
    fontWeight: "700",
  },
});