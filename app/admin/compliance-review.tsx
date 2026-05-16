import React, { useCallback, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";

import {
  ComplianceRecord,
  getComplianceRecords,
  saveComplianceResult,
} from "../data/complianceStore";

import { updateFarmerStore } from "../data/farmerStore";

function statusColor(status?: string) {
  if (status === "approved") return "#047857";
  if (status === "rejected") return "#B91C1C";
  if (status === "needs_more_info") return "#B45309";
  if (status === "under_ai_review") return "#2563EB";
  return "#64748B";
}

export default function AdminComplianceReviewScreen() {
  const [records, setRecords] = useState<ComplianceRecord[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadRecords();
    }, [])
  );

  async function loadRecords() {
    const data = await getComplianceRecords();
    setRecords(data);
  }

  async function approveFarmer(record: ComplianceRecord) {
    const result = {
      farmerId: record.farmerId,
      businessName: record.businessName,
      ownerName: record.ownerName,
      state: record.state,
      status: "approved" as const,
      score: 100,
      idVerified: true,
      businessVerified: true,
      einVerified: true,
      stateRegistrationVerified: true,
      insuranceVerified: true,
      payoutVerified: true,
      noFraudFlags: true,
      missingItems: [],
      verificationSources: [
        "Admin manual review",
        "Document review",
        "Farm2Home compliance approval",
      ],
      reviewedAt: new Date().toISOString(),
      autoApproved: false,
    };

    await saveComplianceResult(record.farmerId, result);

    await updateFarmerStore(record.farmerId, {
      approved: true,
      complianceStatus: "approved",
    } as any);

    Alert.alert("Approved", "Farmer has been approved.");
    await loadRecords();
  }

  async function rejectFarmer(record: ComplianceRecord) {
    const result = {
      farmerId: record.farmerId,
      businessName: record.businessName,
      ownerName: record.ownerName,
      state: record.state,
      status: "rejected" as const,
      score: record.result?.score || 0,
      idVerified: false,
      businessVerified: false,
      einVerified: false,
      stateRegistrationVerified: false,
      insuranceVerified: false,
      payoutVerified: false,
      noFraudFlags: false,
      missingItems: record.result?.missingItems || ["Manual rejection"],
      verificationSources: [
        "Admin manual review",
        "Farm2Home compliance rejection",
      ],
      reviewedAt: new Date().toISOString(),
      autoApproved: false,
    };

    await saveComplianceResult(record.farmerId, result);

    await updateFarmerStore(record.farmerId, {
      approved: false,
      complianceStatus: "rejected",
    } as any);

    Alert.alert("Rejected", "Farmer compliance application was rejected.");
    await loadRecords();
  }

  async function requestMoreInfo(record: ComplianceRecord) {
    const result = {
      farmerId: record.farmerId,
      businessName: record.businessName,
      ownerName: record.ownerName,
      state: record.state,
      status: "needs_more_info" as const,
      score: record.result?.score || 0,
      idVerified: Boolean(record.result?.idVerified),
      businessVerified: Boolean(record.result?.businessVerified),
      einVerified: Boolean(record.result?.einVerified),
      stateRegistrationVerified: Boolean(record.result?.stateRegistrationVerified),
      insuranceVerified: Boolean(record.result?.insuranceVerified),
      payoutVerified: Boolean(record.result?.payoutVerified),
      noFraudFlags: Boolean(record.result?.noFraudFlags),
      missingItems:
        record.result?.missingItems?.length
          ? record.result.missingItems
          : ["Additional documents or clarification needed"],
      verificationSources: [
        ...(record.result?.verificationSources || []),
        "Admin requested more information",
      ],
      reviewedAt: new Date().toISOString(),
      autoApproved: false,
    };

    await saveComplianceResult(record.farmerId, result);

    await updateFarmerStore(record.farmerId, {
      approved: false,
      complianceStatus: "needs_more_info",
    } as any);

    Alert.alert("More Info Requested", "Farmer was marked as needing more info.");
    await loadRecords();
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Compliance Review</Text>
      <Text style={styles.subtitle}>
        Review farmers who need manual compliance approval.
      </Text>

      {records.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No compliance records yet</Text>
          <Text style={styles.emptyText}>
            Farmer submissions will appear here after documents are uploaded.
          </Text>
        </View>
      ) : (
        records.map((record) => (
          <View key={record.farmerId} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.businessName}>
                  {record.businessName || "Unnamed Farm"}
                </Text>
                <Text style={styles.ownerName}>
                  Owner: {record.ownerName || "Not listed"}
                </Text>
                <Text style={styles.ownerName}>State: {record.state}</Text>
              </View>

              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: statusColor(String(record.status)) },
                ]}
              >
                <Text style={styles.statusText}>{String(record.status)}</Text>
              </View>
            </View>

            <View style={styles.scoreBox}>
              <Text style={styles.scoreLabel}>AI Score</Text>
              <Text style={styles.scoreValue}>
                {record.result?.score ?? 0}%
              </Text>
            </View>

            <Text style={styles.sectionTitle}>Uploaded Documents</Text>

            {record.documents.length === 0 ? (
              <Text style={styles.mutedText}>No documents uploaded.</Text>
            ) : (
              record.documents.map((doc) => (
                <View key={doc.id} style={styles.docRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.docLabel}>{doc.label}</Text>
                    <Text style={styles.docUri} numberOfLines={1}>
                      {doc.uri}
                    </Text>
                  </View>

                  <Text
                    style={[
                      styles.docStatus,
                      doc.verified ? styles.verified : styles.unverified,
                    ]}
                  >
                    {doc.verified ? "Verified" : "Pending"}
                  </Text>
                </View>
              ))
            )}

            <Text style={styles.sectionTitle}>Missing / Needed</Text>

            {record.result?.missingItems?.length ? (
              record.result.missingItems.map((item) => (
                <Text key={item} style={styles.missingItem}>
                  • {item}
                </Text>
              ))
            ) : (
              <Text style={styles.successText}>No missing items listed.</Text>
            )}

            <Text style={styles.sectionTitle}>Verification Sources</Text>

            {(record.result?.verificationSources || []).map((source) => (
              <Text key={source} style={styles.sourceText}>
                • {source}
              </Text>
            ))}

            <View style={styles.actions}>
              <Pressable
                style={styles.approveButton}
                onPress={() => approveFarmer(record)}
              >
                <Text style={styles.actionText}>Approve</Text>
              </Pressable>

              <Pressable
                style={styles.moreInfoButton}
                onPress={() => requestMoreInfo(record)}
              >
                <Text style={styles.actionText}>Need Info</Text>
              </Pressable>

              <Pressable
                style={styles.rejectButton}
                onPress={() => rejectFarmer(record)}
              >
                <Text style={styles.actionText}>Reject</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}

      <Pressable
        style={styles.backButton}
        onPress={() => router.push("/admin/dashboard" as any)}
      >
        <Text style={styles.backButtonText}>Back to Admin Dashboard</Text>
      </Pressable>

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F5F7EF",
  },
  content: {
    padding: 18,
    paddingBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    color: "#14532D",
    marginTop: 20,
  },
  subtitle: {
    color: "#64745E",
    marginTop: 8,
    lineHeight: 22,
    marginBottom: 18,
    fontWeight: "700",
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#DDE7DB",
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#111827",
  },
  emptyText: {
    color: "#64745E",
    marginTop: 8,
    lineHeight: 21,
    fontWeight: "700",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#DDE7DB",
  },
  cardHeader: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  businessName: {
    color: "#111827",
    fontSize: 21,
    fontWeight: "900",
  },
  ownerName: {
    color: "#64745E",
    fontWeight: "700",
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  statusText: {
    color: "#FFFFFF",
    fontWeight: "900",
    textTransform: "capitalize",
    fontSize: 12,
  },
  scoreBox: {
    backgroundColor: "#ECFDF5",
    borderRadius: 18,
    padding: 14,
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  scoreLabel: {
    color: "#14532D",
    fontWeight: "900",
  },
  scoreValue: {
    color: "#047857",
    fontWeight: "900",
    fontSize: 18,
  },
  sectionTitle: {
    color: "#14532D",
    fontSize: 17,
    fontWeight: "900",
    marginTop: 16,
    marginBottom: 8,
  },
  mutedText: {
    color: "#64745E",
    fontWeight: "700",
  },
  docRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#EEF2E8",
    paddingVertical: 10,
  },
  docLabel: {
    color: "#111827",
    fontWeight: "900",
  },
  docUri: {
    color: "#64745E",
    marginTop: 3,
    fontSize: 12,
  },
  docStatus: {
    fontWeight: "900",
  },
  verified: {
    color: "#047857",
  },
  unverified: {
    color: "#B45309",
  },
  missingItem: {
    color: "#B91C1C",
    fontWeight: "800",
    marginBottom: 4,
  },
  successText: {
    color: "#047857",
    fontWeight: "900",
  },
  sourceText: {
    color: "#374151",
    fontWeight: "700",
    marginBottom: 4,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 18,
  },
  approveButton: {
    flex: 1,
    backgroundColor: "#047857",
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
  },
  moreInfoButton: {
    flex: 1,
    backgroundColor: "#B45309",
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
  },
  rejectButton: {
    flex: 1,
    backgroundColor: "#B91C1C",
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
  },
  actionText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  backButton: {
    backgroundColor: "#14532D",
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: "center",
    marginTop: 4,
  },
  backButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 15,
  },
});