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

import { supabase } from "../data/supabaseClient";

import {
  VerificationRecord,
  approveVerificationRecord,
  getPendingVerificationRecords,
  getVerificationQueue,
  rejectVerificationRecord,
  requestMoreInfoForVerificationRecord,
} from "../data/adminStore";

function mapSupabaseRecord(row: any): VerificationRecord {
  const documents =
    Array.isArray(row.documents) && row.documents.length > 0
      ? row.documents.map((doc: any, index: number) => ({
          id: doc.id || `${row.id}_doc_${index}`,
          name: doc.name || doc.document_name || doc.type || "Document",
          type: doc.type || doc.document_type || "document",
          uri: doc.uri || doc.document_uri || "",
          status: doc.status || "PENDING",
          uploadedAt: doc.uploadedAt || doc.uploaded_at || row.submitted_at,
        }))
      : Object.entries(row.uploaded_docs || {}).map(([type, uri], index) => ({
          id: `${row.id}_${type}_${index}`,
          name: String(type).replace(/_/g, " "),
          type,
          uri: String(uri),
          status: "PENDING",
          uploadedAt: row.submitted_at,
        }));

  return {
    id: row.id,
    farmerId: row.farmer_id || row.id,
    accountType: row.account_type || "FARMER",
    businessName: row.business_name || row.farm_name || "",
    farmName: row.farm_name || row.business_name || "",
    companyName: row.company_name || "",
    ownerName: row.owner_name || "",
    email: row.email || "",
    state: row.state || "",
    status: row.status || "PENDING_ADMIN_REVIEW",
    complianceStatus: row.compliance_status || "pending_admin_review",
    adminReviewStatus: row.admin_review_status || "pending",
    reviewDecision: row.review_decision || "pending",
    approved: Boolean(row.approved),
    rejected: Boolean(row.rejected),
    needsMoreInfo: Boolean(row.needs_more_info),
    reviewed: Boolean(row.reviewed),
    accountActive: Boolean(row.account_active),
    complianceSubmitted: Boolean(row.compliance_submitted),
    farmerMembershipPaid: Boolean(row.farmer_membership_paid),
    applicationFeePaid: Boolean(row.application_fee_paid),
    farmerActivationPaid: Boolean(row.farmer_activation_paid),
    farmerMonthlySubscriptionPaid: Boolean(row.farmer_monthly_subscription_paid),
    stripeAccountId: row.stripe_account_id || "",
    farmerStripeAccountId: row.farmer_stripe_account_id || "",
    stripePayoutsEnabled: Boolean(row.stripe_payouts_enabled),
    stripeChargesEnabled: Boolean(row.stripe_charges_enabled),
    stripeOnboardingComplete: Boolean(row.stripe_onboarding_complete),
    pickupDeliveryOption: row.pickup_delivery_option || "",
    uploadedDocs: row.uploaded_docs || {},
    legalChecks: row.legal_checks || {},
    documents,
    adminNotes: row.admin_notes || [],
    submittedAt: row.submitted_at || row.created_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  } as any;
}

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

      const { data, error } = await supabase
        .from("admin_verifications")
        .select("*")
        .order("updated_at", { ascending: false });

      if (error) {
        console.log("SUPABASE ADMIN VERIFICATIONS LOAD ERROR:", error.message);
      }

      const supabaseRecords = Array.isArray(data)
        ? data.map(mapSupabaseRecord)
        : [];

      if (supabaseRecords.length > 0) {
        setRecords(supabaseRecords);
        return;
      }

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

  async function updateSupabaseStatus(
    id: string,
    status: "APPROVED" | "REJECTED" | "MORE_INFO_REQUIRED",
    note?: string
  ) {
    const now = new Date().toISOString();

    const payload: any = {
      status,
      updated_at: now,
      reviewed: true,
      admin_review_status:
        status === "APPROVED"
          ? "approved"
          : status === "REJECTED"
          ? "rejected"
          : "needs_more_info",
      review_decision:
        status === "APPROVED"
          ? "approved"
          : status === "REJECTED"
          ? "rejected"
          : "needs_more_info",
      approved: status === "APPROVED",
      rejected: status === "REJECTED",
      needs_more_info: status === "MORE_INFO_REQUIRED",
      account_active: status === "APPROVED",
      compliance_status:
        status === "APPROVED"
          ? "approved"
          : status === "REJECTED"
          ? "rejected"
          : "needs_more_info",
    };

    if (note) {
      payload.admin_notes = [
        {
          id: `note_${Date.now()}`,
          note,
          createdAt: now,
          status,
        },
      ];
    }

    const { error } = await supabase
      .from("admin_verifications")
      .update(payload)
      .eq("id", id);

    if (error) {
      console.log("SUPABASE ADMIN STATUS UPDATE ERROR:", error.message);
      throw new Error(error.message);
    }
  }

  async function approveRecord(id: string) {
    try {
      await updateSupabaseStatus(id, "APPROVED");
      await approveVerificationRecord(id);

      Alert.alert(
        "Approved",
        "This farmer has been approved. The farmer should now be routed to activation/subscription before store setup."
      );

      await loadRecords();
    } catch (error: any) {
      Alert.alert("Approval Error", error?.message || "Unable to approve.");
    }
  }

  async function rejectRecord(id: string) {
    try {
      const reason = rejectNotes[id] || "Rejected by admin.";

      await updateSupabaseStatus(id, "REJECTED", reason);
      await rejectVerificationRecord(id, reason);

      Alert.alert("Rejected", "This farmer has been rejected.");

      await loadRecords();
    } catch (error: any) {
      Alert.alert("Reject Error", error?.message || "Unable to reject.");
    }
  }

  async function requestMoreInfo(id: string) {
    try {
      const note = infoNotes[id] || "More information is required.";

      await updateSupabaseStatus(id, "MORE_INFO_REQUIRED", note);
      await requestMoreInfoForVerificationRecord(id, note);

      Alert.alert("More Info Requested", "The farmer was marked for more info.");

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
                {!!doc.uri && <Text style={styles.documentUri}>{doc.uri}</Text>}
              </View>
            ))}
          </View>
        )}

        {!!item.adminNotes?.length && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Admin Notes</Text>

            {item.adminNotes.map((note: any) => (
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
              Farmer and freight applications will appear here after they submit
              for admin review. This screen now reads from Supabase
              admin_verifications.
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
  documentUri: {
    color: "#334155",
    fontWeight: "600",
    marginTop: 6,
    fontSize: 11,
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