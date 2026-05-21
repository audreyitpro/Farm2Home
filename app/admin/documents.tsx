import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";

import {
  VerificationRecord,
  approveVerificationRecord,
  getPendingVerificationRecords,
  getVerificationQueue,
  rejectVerificationRecord,
  requestMoreInfoForVerificationRecord,
} from "../data/adminStore";

export default function AdminDocumentsScreen() {
  const [records, setRecords] = useState<VerificationRecord[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});
  const [infoNotes, setInfoNotes] = useState<Record<string, string>>({});

  useFocusEffect(
    useCallback(() => {
      loadRecords();
    }, [])
  );

  async function loadRecords() {
    try {
      setRefreshing(true);

      const pending = await getPendingVerificationRecords();
      const all = await getVerificationQueue();

      const combined = pending.length > 0 ? pending : all;

      setRecords(
        [...combined].sort((a, b) =>
          String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""))
        )
      );
    } catch (error) {
      console.log("Load admin verification queue error:", error);
      setRecords([]);
    } finally {
      setRefreshing(false);
    }
  }

  async function approveRecord(id: string) {
    try {
      await approveVerificationRecord(id);

      Alert.alert(
        "Approved",
        "This business has been approved and the farmer account is now active."
      );

      await loadRecords();
    } catch (error: any) {
      Alert.alert("Approval Error", error?.message || "Unable to approve.");
    }
  }

  async function rejectRecord(id: string) {
    try {
      const reason = rejectNotes[id] || "Rejected by admin.";

      await rejectVerificationRecord(id, reason);

      Alert.alert("Rejected", "This business has been rejected.");

      await loadRecords();
    } catch (error: any) {
      Alert.alert("Reject Error", error?.message || "Unable to reject.");
    }
  }

  async function requestMoreInfo(id: string) {
    try {
      const note = infoNotes[id] || "More information is required.";

      await requestMoreInfoForVerificationRecord(id, note);

      Alert.alert("More Info Requested", "The record was marked for more info.");

      await loadRecords();
    } catch (error: any) {
      Alert.alert(
        "Request Error",
        error?.message || "Unable to request more information."
      );
    }
  }

  function statusColor(status?: string) {
    switch (status) {
      case "APPROVED":
        return "#16A34A";
      case "REJECTED":
        return "#DC2626";
      case "MORE_INFO_REQUIRED":
        return "#F59E0B";
      case "STRIPE_COMPLETE_PENDING_REVIEW":
      case "STRIPE_CONNECTED_PENDING_REVIEW":
      case "PENDING_ADMIN_REVIEW":
      case "PENDING_VERIFICATION":
      case "DOCUMENTS_SUBMITTED":
        return "#2563EB";
      case "STRIPE_PENDING":
      case "STRIPE_STARTED":
        return "#7C3AED";
      default:
        return "#64748B";
    }
  }

  function prettyStatus(status?: string) {
    return String(status || "PENDING")
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function formatDate(value?: string) {
    if (!value) return "Date unavailable";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "Date unavailable";

    return date.toLocaleString();
  }

  function getAccountLabel(item: VerificationRecord) {
    return item.accountType === "FREIGHT_CARRIER"
      ? "Freight Carrier"
      : "Farmer";
  }

  function renderRecord({ item }: { item: VerificationRecord }) {
    const documentCount = item.documents?.length || 0;
    const uploadedDocCount = Object.keys(item.uploadedDocs || {}).length;

    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.businessName}>
              {item.businessName || item.farmName || item.companyName}
            </Text>

            <Text style={styles.meta}>
              {getAccountLabel(item)} · {item.ownerName || "Owner not listed"}
            </Text>

            <Text style={styles.meta}>{item.email || "Email not listed"}</Text>
          </View>

          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: statusColor(item.status),
              },
            ]}
          >
            <Text style={styles.statusText}>{prettyStatus(item.status)}</Text>
          </View>
        </View>

        <View style={styles.detailBox}>
          <Text style={styles.detailTitle}>Compliance Details</Text>

          <Text style={styles.detailText}>
            ID: {item.farmerId || item.carrierId || item.id}
          </Text>

          <Text style={styles.detailText}>
            State: {item.state || "Not provided"}
          </Text>

          <Text style={styles.detailText}>
            Stripe Account:{" "}
            {item.stripeAccountId || item.farmerStripeAccountId || "Not connected"}
          </Text>

          <Text style={styles.detailText}>
            Stripe Payouts: {item.stripePayoutsEnabled ? "Enabled" : "Pending"}
          </Text>

          <Text style={styles.detailText}>
            Stripe Charges: {item.stripeChargesEnabled ? "Enabled" : "Pending"}
          </Text>

          <Text style={styles.detailText}>
            Stripe Onboarding:{" "}
            {item.stripeOnboardingComplete ? "Complete" : "Pending"}
          </Text>

          <Text style={styles.detailText}>
            Pickup / Delivery: {item.pickupDeliveryOption || "Not selected"}
          </Text>

          <Text style={styles.detailText}>
            Documents: {documentCount} saved · {uploadedDocCount} checklist items
          </Text>

          <Text style={styles.detailText}>
            Submitted: {formatDate(item.submittedAt)}
          </Text>

          <Text style={styles.detailText}>
            Updated: {formatDate(item.updatedAt)}
          </Text>
        </View>

        {!!item.documents?.length && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Uploaded Documents</Text>

            {item.documents.map((doc) => (
              <View key={doc.id} style={styles.documentRow}>
                <Text style={styles.documentName}>{doc.name || doc.type}</Text>
                <Text style={styles.documentMeta}>
                  {doc.type} · {doc.status}
                </Text>
              </View>
            ))}
          </View>
        )}

        {!!item.adminNotes?.length && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Admin Notes</Text>

            {item.adminNotes.map((note) => (
              <Text key={note.id} style={styles.noteText}>
                • {note.note}
              </Text>
            ))}
          </View>
        )}

        <TextInput
          style={styles.noteInput}
          placeholder="Reason if rejecting"
          placeholderTextColor="#94A3B8"
          value={rejectNotes[item.id] || ""}
          onChangeText={(text) =>
            setRejectNotes((prev) => ({
              ...prev,
              [item.id]: text,
            }))
          }
        />

        <TextInput
          style={styles.noteInput}
          placeholder="Note if requesting more info"
          placeholderTextColor="#94A3B8"
          value={infoNotes[item.id] || ""}
          onChangeText={(text) =>
            setInfoNotes((prev) => ({
              ...prev,
              [item.id]: text,
            }))
          }
        />

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.approveButton}
            onPress={() => approveRecord(item.id)}
          >
            <Text style={styles.buttonText}>Approve</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.moreInfoButton}
            onPress={() => requestMoreInfo(item.id)}
          >
            <Text style={styles.buttonText}>More Info</Text>
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

  const summary = useMemo(() => {
    const farmers = records.filter((item) => item.accountType === "FARMER").length;
    const freight = records.filter(
      (item) => item.accountType === "FREIGHT_CARRIER"
    ).length;

    return {
      total: records.length,
      farmers,
      freight,
    };
  }, [records]);

  return (
    <View style={styles.page}>
      <View style={styles.hero}>
        <Text style={styles.title}>Admin AI Compliance Review</Text>

        <Text style={styles.subtitle}>
          Review farmer and freight submissions, Stripe readiness, documents,
          and final approval.
        </Text>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryChip}>Total: {summary.total}</Text>
          <Text style={styles.summaryChip}>Farmers: {summary.farmers}</Text>
          <Text style={styles.summaryChip}>Freight: {summary.freight}</Text>
        </View>
      </View>

      <FlatList
        data={records}
        keyExtractor={(item, index) => item.id || `record_${index}`}
        renderItem={renderRecord}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={loadRecords} />
        }
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No Compliance Records</Text>

            <Text style={styles.emptyDescription}>
              Farmer and freight applications will appear here after they save
              business info, connect Stripe, upload documents, or submit for
              admin review.
            </Text>

            <TouchableOpacity style={styles.refreshButton} onPress={loadRecords}>
              <Text style={styles.refreshButtonText}>Refresh Queue</Text>
            </TouchableOpacity>
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
  summaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  summaryChip: {
    backgroundColor: "#DCFCE7",
    color: "#166534",
    fontWeight: "900",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    overflow: "hidden",
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
  businessName: {
    fontSize: 22,
    fontWeight: "900",
    color: "#111827",
  },
  meta: {
    color: "#4B5563",
    fontWeight: "700",
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    alignSelf: "flex-start",
    maxWidth: 160,
  },
  statusText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 11,
    textAlign: "center",
  },
  detailBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginTop: 8,
  },
  detailTitle: {
    color: "#064E3B",
    fontWeight: "900",
    marginBottom: 8,
    fontSize: 16,
  },
  detailText: {
    color: "#334155",
    fontWeight: "700",
    marginBottom: 5,
    lineHeight: 20,
  },
  section: {
    marginTop: 14,
  },
  sectionTitle: {
    fontWeight: "900",
    color: "#111827",
    marginBottom: 8,
    fontSize: 16,
  },
  documentRow: {
    backgroundColor: "#F1F5F9",
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  documentName: {
    color: "#111827",
    fontWeight: "900",
  },
  documentMeta: {
    color: "#64748B",
    fontWeight: "700",
    marginTop: 4,
  },
  noteText: {
    color: "#334155",
    fontWeight: "700",
    lineHeight: 21,
    marginBottom: 4,
  },
  noteInput: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
    color: "#111827",
    fontWeight: "700",
  },
  buttonRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
  },
  approveButton: {
    flex: 1,
    backgroundColor: "#16A34A",
    padding: 13,
    borderRadius: 14,
    alignItems: "center",
  },
  moreInfoButton: {
    flex: 1,
    backgroundColor: "#F59E0B",
    padding: 13,
    borderRadius: 14,
    alignItems: "center",
  },
  rejectButton: {
    flex: 1,
    backgroundColor: "#DC2626",
    padding: 13,
    borderRadius: 14,
    alignItems: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 12,
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
  refreshButton: {
    backgroundColor: "#064E3B",
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 16,
    marginTop: 16,
  },
  refreshButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
});