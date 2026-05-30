// app/admin/compliance-review.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import {
  ComplianceRecord,
  getComplianceRecords,
  saveComplianceResult,
} from "../data/complianceStore";

import { updateFarmerStore } from "../data/farmerStore";
import freightTheme from "../styles/freightTheme";

function statusColor(status?: string) {
  if (status === "approved") return "#10B981";
  if (status === "rejected") return "#DC2626";
  if (status === "needs_more_info") return "#F59E0B";
  if (status === "under_ai_review") return "#2563EB";
  return "#64748B";
}

function prettyStatus(status?: string) {
  return String(status || "pending")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
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

  const summary = useMemo(() => {
    return {
      total: records.length,
      approved: records.filter((item) => item.status === "approved").length,
      rejected: records.filter((item) => item.status === "rejected").length,
      needsInfo: records.filter((item) => item.status === "needs_more_info").length,
      review: records.filter((item) => item.status === "under_ai_review").length,
    };
  }, [records]);

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
      accountActive: true,
      storeUnlocked: true,
      adminReviewStatus: "approved",
      reviewDecision: "approved",
      status: "APPROVED",
      updatedAt: new Date().toISOString(),
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
      accountActive: false,
      storeUnlocked: false,
      adminReviewStatus: "rejected",
      reviewDecision: "rejected",
      status: "REJECTED",
      updatedAt: new Date().toISOString(),
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
      adminReviewStatus: "needs_more_info",
      reviewDecision: "needs_more_info",
      status: "MORE_INFO_REQUIRED",
      updatedAt: new Date().toISOString(),
    } as any);

    Alert.alert("More Info Requested", "Farmer was marked as needing more info.");
    await loadRecords();
  }

  function CheckRow({
    label,
    value,
  }: {
    label: string;
    value: boolean;
  }) {
    return (
      <View style={styles.checkRow}>
        <Ionicons
          name={value ? "checkmark-circle-outline" : "close-circle-outline"}
          size={20}
          color={value ? "#10B981" : "#F59E0B"}
        />
        <Text style={styles.checkText}>{label}</Text>
        <Text style={[styles.checkStatus, value ? styles.goodText : styles.warnText]}>
          {value ? "Verified" : "Pending"}
        </Text>
      </View>
    );
  }

  function renderRecord(record: ComplianceRecord) {
    return (
      <View key={record.farmerId} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.recordIcon}>
            <Ionicons name="leaf-outline" size={22} color="#10B981" />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.businessName}>
              {record.businessName || "Unnamed Farm"}
            </Text>
            <Text style={styles.ownerName}>
              Owner: {record.ownerName || "Not listed"}
            </Text>
            <Text style={styles.ownerName}>State: {record.state || "Not listed"}</Text>
          </View>

          <View
            style={[
              styles.statusBadge,
              { backgroundColor: statusColor(String(record.status)) },
            ]}
          >
            <Text style={styles.statusText}>{prettyStatus(String(record.status))}</Text>
          </View>
        </View>

        <View style={styles.scoreBox}>
          <View>
            <Text style={styles.scoreLabel}>AI Compliance Score</Text>
            <Text style={styles.scoreHelp}>
              Manual review can approve, reject, or request more info.
            </Text>
          </View>

          <Text style={styles.scoreValue}>{record.result?.score ?? 0}%</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Verification Checklist</Text>

          <CheckRow label="Identity Verified" value={Boolean(record.result?.idVerified)} />
          <CheckRow
            label="Business Verified"
            value={Boolean(record.result?.businessVerified)}
          />
          <CheckRow label="EIN Verified" value={Boolean(record.result?.einVerified)} />
          <CheckRow
            label="State Registration Verified"
            value={Boolean(record.result?.stateRegistrationVerified)}
          />
          <CheckRow
            label="Insurance Verified"
            value={Boolean(record.result?.insuranceVerified)}
          />
          <CheckRow
            label="Stripe Payout Verified"
            value={Boolean(record.result?.payoutVerified)}
          />
          <CheckRow
            label="No Fraud Flags"
            value={Boolean(record.result?.noFraudFlags)}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Uploaded Documents</Text>

          {record.documents.length === 0 ? (
            <Text style={styles.mutedText}>No documents uploaded.</Text>
          ) : (
            record.documents.map((doc) => (
              <View key={doc.id} style={styles.docRow}>
                <Ionicons name="document-text-outline" size={20} color="#10B981" />

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
        </View>

        <View style={styles.section}>
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
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Verification Sources</Text>

          {(record.result?.verificationSources || []).length === 0 ? (
            <Text style={styles.mutedText}>No verification sources listed.</Text>
          ) : (
            (record.result?.verificationSources || []).map((source) => (
              <Text key={source} style={styles.sourceText}>
                • {source}
              </Text>
            ))
          )}
        </View>

        <View style={styles.actions}>
          <Pressable
            style={styles.approveButton}
            onPress={() => approveFarmer(record)}
          >
            <Ionicons name="checkmark-circle-outline" size={17} color="#FFFFFF" />
            <Text style={styles.actionText}>Approve</Text>
          </Pressable>

          <Pressable
            style={styles.moreInfoButton}
            onPress={() => requestMoreInfo(record)}
          >
            <Ionicons name="alert-circle-outline" size={17} color="#FFFFFF" />
            <Text style={styles.actionText}>Need Info</Text>
          </Pressable>

          <Pressable
            style={styles.rejectButton}
            onPress={() => rejectFarmer(record)}
          >
            <Ionicons name="close-circle-outline" size={17} color="#FFFFFF" />
            <Text style={styles.actionText}>Reject</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#020617" />

      <ScrollView style={styles.page} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.kicker}>Farm2Home Admin Portal</Text>
              <Text style={styles.title}>Compliance Review</Text>
              <Text style={styles.subtitle}>
                Review AI compliance findings, uploaded documents, missing
                requirements, legal checks, and final approval decisions.
              </Text>
            </View>

            <View style={styles.heroIcon}>
              <Ionicons name="shield-checkmark-outline" size={34} color="#FFFFFF" />
            </View>
          </View>
        </View>

        <View style={styles.navRow}>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => router.push("/admin/dashboard" as any)}
          >
            <Ionicons name="grid-outline" size={18} color="#FFFFFF" />
            <Text style={styles.navText}>Dashboard</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navButtonOutline}
            onPress={() => router.push("/admin/documents" as any)}
          >
            <Ionicons name="document-text-outline" size={18} color="#10B981" />
            <Text style={styles.navTextOutline}>Documents</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.summaryGrid}>
          <SummaryCard label="Total" value={String(summary.total)} accent />
          <SummaryCard label="AI Review" value={String(summary.review)} accent />
          <SummaryCard label="Approved" value={String(summary.approved)} />
          <SummaryCard label="Needs Info" value={String(summary.needsInfo)} />
          <SummaryCard label="Rejected" value={String(summary.rejected)} />
        </View>

        {records.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="file-tray-outline" size={38} color="#10B981" />
            <Text style={styles.emptyTitle}>No compliance records yet</Text>
            <Text style={styles.emptyText}>
              Farmer submissions will appear here after documents are uploaded.
            </Text>
          </View>
        ) : (
          records.map(renderRecord)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryCard({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <View style={[styles.summaryCard, accent && styles.summaryCardAccent]}>
      <Text style={[styles.summaryValue, accent && styles.summaryValueAccent]}>
        {value}
      </Text>
      <Text style={[styles.summaryLabel, accent && styles.summaryLabelAccent]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: freightTheme.colors.background,
  },
  page: {
    flex: 1,
    backgroundColor: freightTheme.colors.background,
  },
  content: {
    paddingBottom: 90,
  },
  hero: {
    backgroundColor: "#020617",
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 28,
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#064E3B",
    borderWidth: 1,
    borderColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
  },
  kicker: {
    color: "#10B981",
    fontWeight: "900",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  title: {
    fontSize: 34,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  subtitle: {
    color: "#CBD5E1",
    fontWeight: "700",
    marginTop: 8,
    lineHeight: 23,
  },
  navRow: {
    flexDirection: "row",
    gap: 10,
    padding: 18,
  },
  navButton: {
    flex: 1,
    backgroundColor: freightTheme.colors.primary,
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  navButtonOutline: {
    flex: 1,
    backgroundColor: freightTheme.colors.card,
    borderWidth: 1,
    borderColor: freightTheme.colors.primary,
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  navText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  navTextOutline: {
    color: freightTheme.colors.primary,
    fontWeight: "900",
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 18,
    marginBottom: 16,
  },
  summaryCard: {
    width: "31%",
    minWidth: 100,
    backgroundColor: freightTheme.colors.card,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
    alignItems: "center",
  },
  summaryCardAccent: {
    backgroundColor: "#064E3B",
    borderColor: "#064E3B",
  },
  summaryValue: {
    color: freightTheme.colors.primary,
    fontSize: 25,
    fontWeight: "900",
  },
  summaryValueAccent: {
    color: "#FFFFFF",
  },
  summaryLabel: {
    color: freightTheme.colors.mutedText,
    fontWeight: "800",
    marginTop: 4,
    textAlign: "center",
  },
  summaryLabelAccent: {
    color: "#BBF7D0",
  },
  emptyCard: {
    backgroundColor: freightTheme.colors.card,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
    marginHorizontal: 18,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: freightTheme.colors.text,
    marginTop: 10,
  },
  emptyText: {
    color: freightTheme.colors.mutedText,
    marginTop: 8,
    lineHeight: 21,
    fontWeight: "700",
    textAlign: "center",
  },
  card: {
    backgroundColor: freightTheme.colors.card,
    borderRadius: 24,
    padding: 18,
    marginHorizontal: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
  },
  cardHeader: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  recordIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
  },
  businessName: {
    color: freightTheme.colors.text,
    fontSize: 21,
    fontWeight: "900",
  },
  ownerName: {
    color: freightTheme.colors.mutedText,
    fontWeight: "700",
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    maxWidth: 145,
  },
  statusText: {
    color: "#FFFFFF",
    fontWeight: "900",
    textTransform: "capitalize",
    fontSize: 11,
    textAlign: "center",
  },
  scoreBox: {
    backgroundColor: "#064E3B",
    borderRadius: 18,
    padding: 14,
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    borderWidth: 1,
    borderColor: "#10B981",
  },
  scoreLabel: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  scoreHelp: {
    color: "#BBF7D0",
    fontWeight: "700",
    marginTop: 4,
    lineHeight: 20,
  },
  scoreValue: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 28,
  },
  section: {
    marginTop: 16,
  },
  sectionTitle: {
    color: freightTheme.colors.text,
    fontSize: 17,
    fontWeight: "900",
    marginBottom: 8,
  },
  checkRow: {
    backgroundColor: freightTheme.colors.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  checkText: {
    color: freightTheme.colors.text,
    fontWeight: "800",
    flex: 1,
  },
  checkStatus: {
    fontWeight: "900",
    fontSize: 12,
  },
  goodText: {
    color: "#10B981",
  },
  warnText: {
    color: "#F59E0B",
  },
  mutedText: {
    color: freightTheme.colors.mutedText,
    fontWeight: "700",
  },
  docRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: freightTheme.colors.border,
    paddingVertical: 10,
  },
  docLabel: {
    color: freightTheme.colors.text,
    fontWeight: "900",
  },
  docUri: {
    color: freightTheme.colors.mutedText,
    marginTop: 3,
    fontSize: 12,
  },
  docStatus: {
    fontWeight: "900",
  },
  verified: {
    color: "#10B981",
  },
  unverified: {
    color: "#F59E0B",
  },
  missingItem: {
    color: "#FCA5A5",
    fontWeight: "800",
    marginBottom: 4,
  },
  successText: {
    color: "#10B981",
    fontWeight: "900",
  },
  sourceText: {
    color: "#CBD5E1",
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
    backgroundColor: "#10B981",
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 5,
  },
  moreInfoButton: {
    flex: 1,
    backgroundColor: "#F59E0B",
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 5,
  },
  rejectButton: {
    flex: 1,
    backgroundColor: "#DC2626",
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 5,
  },
  actionText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 12,
  },
});