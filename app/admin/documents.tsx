// app/admin/documents.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../data/supabaseClient";

import {
  VerificationRecord,
  approveVerificationRecord,
  getPendingVerificationRecords,
  getVerificationQueue,
  rejectVerificationRecord,
  requestMoreInfoForVerificationRecord,
} from "../data/adminStore";

type FilterType =
  | "all"
  | "farmer"
  | "freight"
  | "pending"
  | "approved"
  | "rejected";

const ui = {
  bg: "#F5F7FB",
  card: "#FFFFFF",
  border: "#E5E7EB",
  text: "#111827",
  muted: "#6B7280",
  soft: "#F9FAFB",
  primary: "#7C3AED",
  primarySoft: "#EDE9FE",
  green: "#10B981",
  blue: "#2563EB",
  orange: "#F59E0B",
  red: "#EF4444",
};

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
  const [searchText, setSearchText] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");

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

      Alert.alert("Approved", "This application has been approved and marked active.");
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

      Alert.alert("Rejected", "This application has been rejected.");
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

      Alert.alert("More Info Requested", "This record was marked for more info.");
      await loadRecords();
    } catch (error: any) {
      Alert.alert("Request Error", error?.message || "Unable to request more information.");
    }
  }

  function statusColor(status?: string) {
    switch (String(status || "").toUpperCase()) {
      case "APPROVED":
        return ui.green;
      case "REJECTED":
        return ui.red;
      case "MORE_INFO_REQUIRED":
        return ui.orange;
      case "STRIPE_COMPLETE_PENDING_REVIEW":
      case "STRIPE_CONNECTED_PENDING_REVIEW":
      case "PENDING_ADMIN_REVIEW":
      case "PENDING_VERIFICATION":
      case "DOCUMENTS_SUBMITTED":
        return ui.blue;
      case "STRIPE_PENDING":
      case "STRIPE_STARTED":
        return ui.primary;
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
    return item.accountType === "FREIGHT_CARRIER" ? "Freight Carrier" : "Farmer";
  }

  function getDisplayName(item: VerificationRecord) {
    return item.businessName || item.farmName || item.companyName || "Farm2Home Applicant";
  }

  const filteredRecords = useMemo(() => {
    const q = searchText.trim().toLowerCase();

    return records.filter((item) => {
      const accountType = String(item.accountType || "").toUpperCase();
      const status = String(item.status || "").toUpperCase();

      const matchesFilter =
        filter === "all" ||
        (filter === "farmer" && accountType !== "FREIGHT_CARRIER") ||
        (filter === "freight" && accountType === "FREIGHT_CARRIER") ||
        (filter === "approved" && status === "APPROVED") ||
        (filter === "rejected" && status === "REJECTED") ||
        (filter === "pending" && status !== "APPROVED" && status !== "REJECTED");

      const searchable = [
        item.businessName,
        item.farmName,
        item.companyName,
        item.ownerName,
        item.email,
        item.state,
        item.status,
        item.complianceStatus,
        item.accountType,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesFilter && (!q || searchable.includes(q));
    });
  }, [records, searchText, filter]);

  const summary = useMemo(() => {
    const farmers = records.filter((item) => item.accountType === "FARMER").length;
    const freight = records.filter((item) => item.accountType === "FREIGHT_CARRIER").length;
    const approved = records.filter((item) => item.status === "APPROVED").length;
    const rejected = records.filter((item) => item.status === "REJECTED").length;
    const pending = records.filter(
      (item) => item.status !== "APPROVED" && item.status !== "REJECTED"
    ).length;

    return {
      total: records.length,
      farmers,
      freight,
      approved,
      rejected,
      pending,
    };
  }, [records]);

  function FilterChip({ label, value }: { label: string; value: FilterType }) {
    const active = filter === value;

    return (
      <TouchableOpacity
        style={[styles.filterChip, active && styles.filterChipActive]}
        onPress={() => setFilter(value)}
      >
        <Text style={[styles.filterText, active && styles.filterTextActive]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  }

  function renderRecord({ item }: { item: VerificationRecord }) {
    const documentCount = item.documents?.length || 0;
    const uploadedDocCount = Object.keys(item.uploadedDocs || {}).length;

    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.accountIcon}>
            <Ionicons
              name={item.accountType === "FREIGHT_CARRIER" ? "trail-sign-outline" : "leaf-outline"}
              size={22}
              color={ui.primary}
            />
          </View>

          <View style={styles.headerText}>
            <Text style={styles.businessName}>{getDisplayName(item)}</Text>
            <Text style={styles.meta}>
              {getAccountLabel(item)} • {item.ownerName || "Owner not listed"}
            </Text>
            <Text style={styles.meta}>{item.email || "Email not listed"}</Text>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) }]}>
            <Text style={styles.statusText}>{prettyStatus(item.status)}</Text>
          </View>
        </View>

        <View style={styles.detailBox}>
          <Text style={styles.detailTitle}>Compliance Details</Text>

          <DetailRow label="ID" value={String(item.farmerId || item.carrierId || item.id)} />
          <DetailRow label="State" value={item.state || "Not provided"} />
          <DetailRow
            label="Stripe Account"
            value={item.stripeAccountId || item.farmerStripeAccountId || "Not connected"}
          />
          <DetailRow label="Stripe Payouts" value={item.stripePayoutsEnabled ? "Enabled" : "Pending"} />
          <DetailRow label="Stripe Charges" value={item.stripeChargesEnabled ? "Enabled" : "Pending"} />
          <DetailRow label="Stripe Onboarding" value={item.stripeOnboardingComplete ? "Complete" : "Pending"} />
          <DetailRow label="Pickup / Delivery" value={item.pickupDeliveryOption || "Not selected"} />
          <DetailRow label="Documents" value={`${documentCount} saved • ${uploadedDocCount} checklist items`} />
          <DetailRow label="Submitted" value={formatDate(item.submittedAt)} />
          <DetailRow label="Updated" value={formatDate(item.updatedAt)} />
        </View>

        {!!item.documents?.length && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Uploaded Documents</Text>

            {item.documents.map((doc: any) => (
              <View key={doc.id} style={styles.documentRow}>
                <Ionicons name="document-text-outline" size={18} color={ui.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.documentName}>{doc.name || doc.type}</Text>
                  <Text style={styles.documentMeta}>
                    {doc.type} • {doc.status}
                  </Text>
                  {!!doc.uri && <Text style={styles.documentUri}>{doc.uri}</Text>}
                </View>
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
          placeholderTextColor={ui.muted}
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
          placeholderTextColor={ui.muted}
          value={infoNotes[item.id] || ""}
          onChangeText={(text) =>
            setInfoNotes((prev) => ({
              ...prev,
              [item.id]: text,
            }))
          }
        />

        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.approveButton} onPress={() => approveRecord(item.id)}>
            <Ionicons name="checkmark-circle-outline" size={17} color="#FFFFFF" />
            <Text style={styles.buttonText}>Approve</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.moreInfoButton} onPress={() => requestMoreInfo(item.id)}>
            <Ionicons name="alert-circle-outline" size={17} color="#FFFFFF" />
            <Text style={styles.buttonText}>More Info</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.rejectButton} onPress={() => rejectRecord(item.id)}>
            <Ionicons name="close-circle-outline" size={17} color="#FFFFFF" />
            <Text style={styles.buttonText}>Reject</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={ui.bg} />

      <View style={styles.shell}>
        <View style={styles.sidebar}>
          <View style={styles.logoRow}>
            <View style={styles.logoMark}>
              <Text style={styles.logoText}>F2H</Text>
            </View>

            <View>
              <Text style={styles.logoTitle}>Farm2Home</Text>
              <Text style={styles.logoSub}>Compliance Queue</Text>
            </View>
          </View>

          <NavButton label="Dashboard" icon="grid-outline" route="/admin/dashboard" />
          <NavButton label="Documents" icon="document-text-outline" route="/admin/documents" active />
          <NavButton label="Compliance" icon="shield-checkmark-outline" route="/admin/compliance-review" />
          <NavButton label="Business Docs" icon="folder-open-outline" route="/admin/business-documents" />
          <NavButton label="Platform Health" icon="pulse-outline" route="/admin/platform-health" />
          <NavButton label="Settings" icon="settings-outline" route="/admin/admin-settings" />
        </View>

        <View style={styles.main}>
          <View style={styles.topbar}>
            <View>
              <Text style={styles.welcome}>Farm2Home Admin Portal</Text>
              <Text style={styles.pageTitle}>AI Compliance Queue</Text>
              <Text style={styles.pageSub}>
                Review farmer and freight submissions, Stripe readiness, uploaded documents, and final approval.
              </Text>
            </View>

            <TouchableOpacity style={styles.refreshPill} onPress={loadRecords}>
              <Ionicons name="refresh-outline" size={18} color={ui.primary} />
              <Text style={styles.refreshPillText}>Refresh</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.statsGrid}>
              <SummaryCard label="Total" value={String(summary.total)} icon="folder-outline" accent />
              <SummaryCard label="Pending" value={String(summary.pending)} icon="time-outline" warning />
              <SummaryCard label="Approved" value={String(summary.approved)} icon="checkmark-circle-outline" success />
              <SummaryCard label="Rejected" value={String(summary.rejected)} icon="close-circle-outline" danger />
              <SummaryCard label="Farmers" value={String(summary.farmers)} icon="leaf-outline" success />
              <SummaryCard label="Freight" value={String(summary.freight)} icon="trail-sign-outline" />
            </View>

            <View style={styles.searchCard}>
              <Ionicons name="search-outline" size={20} color={ui.primary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search business, owner, email, status..."
                placeholderTextColor={ui.muted}
                value={searchText}
                onChangeText={setSearchText}
              />
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              <FilterChip label="All" value="all" />
              <FilterChip label="Pending" value="pending" />
              <FilterChip label="Farmers" value="farmer" />
              <FilterChip label="Freight" value="freight" />
              <FilterChip label="Approved" value="approved" />
              <FilterChip label="Rejected" value="rejected" />
            </ScrollView>

            <View style={styles.dataSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderTitle}>Compliance Records</Text>
                <Text style={styles.sectionLink}>{filteredRecords.length} records</Text>
              </View>

              <FlatList
                data={filteredRecords}
                keyExtractor={(item, index) => item.id || `record_${index}`}
                renderItem={renderRecord}
                scrollEnabled={false}
                refreshControl={
                  <RefreshControl refreshing={refreshing} onRefresh={loadRecords} />
                }
                contentContainerStyle={{ paddingBottom: 80 }}
                ListEmptyComponent={
                  <EmptyCard
                    title="No Compliance Records"
                    text="Farmer and freight applications will appear here after they submit for admin review."
                    onRefresh={loadRecords}
                  />
                }
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailText}>{value}</Text>
    </View>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  accent = false,
  success = false,
  warning = false,
  danger = false,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent?: boolean;
  success?: boolean;
  warning?: boolean;
  danger?: boolean;
}) {
  const color = danger
    ? ui.red
    : warning
    ? ui.orange
    : success
    ? ui.green
    : accent
    ? ui.primary
    : ui.blue;

  return (
    <View style={styles.summaryCard}>
      <View style={[styles.summaryIcon, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function EmptyCard({
  title,
  text,
  onRefresh,
}: {
  title: string;
  text?: string;
  onRefresh: () => void;
}) {
  return (
    <View style={styles.emptyCard}>
      <Ionicons name="file-tray-outline" size={34} color={ui.primary} />
      <Text style={styles.emptyTitle}>{title}</Text>
      {!!text && <Text style={styles.emptyDescription}>{text}</Text>}

      <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
        <Text style={styles.refreshButtonText}>Refresh Queue</Text>
      </TouchableOpacity>
    </View>
  );
}

function NavButton({
  label,
  icon,
  route,
  active = false,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  active?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.navButton, active && styles.navButtonActive]}
      onPress={() => router.push(route as any)}
    >
      <Ionicons name={icon} size={18} color={active ? "#FFFFFF" : ui.muted} />
      <Text style={[styles.navText, active && styles.navTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: ui.bg },
  shell: { flex: 1, backgroundColor: ui.bg },
  sidebar: {
    backgroundColor: ui.card,
    borderBottomWidth: 1,
    borderBottomColor: ui.border,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 12,
  },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  logoMark: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: ui.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: { color: "#FFFFFF", fontWeight: "900", fontSize: 13 },
  logoTitle: { color: ui.text, fontWeight: "900", fontSize: 18 },
  logoSub: { color: ui.muted, fontWeight: "700", fontSize: 12 },
  navButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: ui.soft,
  },
  navButtonActive: { backgroundColor: ui.primary },
  navText: { color: ui.muted, fontWeight: "900", fontSize: 13 },
  navTextActive: { color: "#FFFFFF" },
  main: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  topbar: {
    backgroundColor: ui.card,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: ui.border,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  welcome: { color: ui.muted, fontWeight: "800", marginBottom: 4 },
  pageTitle: { color: ui.text, fontSize: 26, fontWeight: "900" },
  pageSub: { color: ui.muted, marginTop: 4, fontWeight: "700", maxWidth: 780 },
  refreshPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: ui.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  refreshPillText: { color: ui.primary, fontWeight: "900" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 14 },
  summaryCard: {
    width: "48%",
    backgroundColor: ui.card,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: ui.border,
  },
  summaryIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  summaryValue: { color: ui.text, fontSize: 22, fontWeight: "900" },
  summaryLabel: { color: ui.muted, fontWeight: "800", marginTop: 4 },
  searchCard: {
    backgroundColor: ui.card,
    borderRadius: 18,
    paddingHorizontal: 14,
    height: 52,
    borderWidth: 1,
    borderColor: ui.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  searchInput: { flex: 1, color: ui.text, fontWeight: "800" },
  filterRow: { gap: 8, paddingBottom: 14 },
  filterChip: {
    backgroundColor: ui.card,
    borderWidth: 1,
    borderColor: ui.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  filterChipActive: { backgroundColor: ui.primary, borderColor: ui.primary },
  filterText: { color: ui.primary, fontWeight: "900" },
  filterTextActive: { color: "#FFFFFF" },
  dataSection: {
    backgroundColor: ui.card,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: ui.border,
    marginBottom: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionHeaderTitle: { color: ui.text, fontSize: 19, fontWeight: "900" },
  sectionLink: { color: ui.primary, fontWeight: "900", fontSize: 12 },
  card: {
    backgroundColor: ui.soft,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: ui.border,
    marginBottom: 14,
  },
  header: { flexDirection: "row", marginBottom: 12, gap: 10 },
  accountIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: ui.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { flex: 1 },
  businessName: { fontSize: 18, fontWeight: "900", color: ui.text },
  meta: { color: ui.muted, fontWeight: "700", marginTop: 4 },
  statusBadge: {
    paddingHorizontal: 11,
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
    backgroundColor: ui.card,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: ui.border,
    marginTop: 8,
  },
  detailTitle: { color: ui.text, fontWeight: "900", marginBottom: 8, fontSize: 16 },
  detailRow: { marginBottom: 8 },
  detailLabel: {
    color: ui.primary,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  detailText: { color: ui.text, fontWeight: "700", marginTop: 3, lineHeight: 20 },
  section: { marginTop: 14 },
  sectionTitle: { fontWeight: "900", color: ui.text, marginBottom: 8, fontSize: 16 },
  documentRow: {
    backgroundColor: ui.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: ui.border,
    padding: 12,
    marginBottom: 8,
    flexDirection: "row",
    gap: 10,
  },
  documentName: { color: ui.text, fontWeight: "900" },
  documentMeta: { color: ui.muted, fontWeight: "700", marginTop: 4 },
  documentUri: { color: ui.muted, fontWeight: "600", marginTop: 6, fontSize: 11 },
  noteText: { color: ui.text, fontWeight: "700", lineHeight: 21, marginBottom: 4 },
  noteInput: {
    backgroundColor: ui.card,
    borderWidth: 1,
    borderColor: ui.border,
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
    color: ui.text,
    fontWeight: "700",
  },
  buttonRow: { flexDirection: "row", gap: 8, marginTop: 16 },
  approveButton: {
    flex: 1,
    backgroundColor: ui.green,
    padding: 13,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 5,
  },
  moreInfoButton: {
    flex: 1,
    backgroundColor: ui.orange,
    padding: 13,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 5,
  },
  rejectButton: {
    flex: 1,
    backgroundColor: ui.red,
    padding: 13,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 5,
  },
  buttonText: { color: "#FFFFFF", fontWeight: "900", fontSize: 12 },
  emptyCard: {
    backgroundColor: ui.card,
    borderRadius: 22,
    padding: 24,
    borderWidth: 1,
    borderColor: ui.border,
    alignItems: "center",
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: ui.text,
    marginTop: 10,
    marginBottom: 8,
  },
  emptyDescription: {
    color: ui.muted,
    textAlign: "center",
    lineHeight: 22,
    fontWeight: "700",
  },
  refreshButton: {
    backgroundColor: ui.primary,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 16,
    marginTop: 16,
  },
  refreshButtonText: { color: "#FFFFFF", fontWeight: "900" },
});