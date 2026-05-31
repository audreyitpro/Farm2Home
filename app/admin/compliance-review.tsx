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

import { supabase } from "../services/supabaseClient";

import {
  ComplianceRecord,
  getComplianceRecords,
  saveComplianceResult,
} from "../data/complianceStore";

import { updateFarmerStore } from "../data/farmerStore";

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

function statusColor(status?: string) {
  if (status === "approved") return ui.green;
  if (status === "rejected") return ui.red;
  if (status === "needs_more_info") return ui.orange;
  if (status === "under_ai_review") return ui.blue;
  return "#64748B";
}

function prettyStatus(status?: string) {
  return String(status || "pending")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function mapAdminVerificationToComplianceRecord(row: any): ComplianceRecord {
  const mappedDocuments = Array.isArray(row.documents)
    ? row.documents.map((doc: any, index: number) => ({
        id: doc.id || `${row.id}_doc_${index}`,
        label: doc.label || doc.name || doc.type || "Document",
        type: doc.type || "document",
        uri: String(doc.uri || ""),
        verified:
          doc.verified === true ||
          String(doc.status || "").toUpperCase() === "VERIFIED",
      }))
    : Object.entries(row.uploaded_docs || {}).map(([key, value], index) => ({
        id: `${row.id}_${key}_${index}`,
        label: String(key).replace(/_/g, " "),
        type: String(key),
        uri: String(value),
        verified: false,
      }));

  const adminStatus = String(row.admin_review_status || "").toLowerCase();
  const rawStatus = String(row.status || "").toUpperCase();

  return {
  farmerId: String(row.farmer_id || row.id),
  businessName:
    row.business_name ||
    row.farm_name ||
    row.company_name ||
    "Farm2Home Applicant",

  ownerName: row.owner_name || row.contact_name || "Not listed",
  state: row.state || "Not listed",

  status:
    adminStatus === "approved" || rawStatus === "APPROVED"
      ? "approved"
      : adminStatus === "rejected" || rawStatus === "REJECTED"
      ? "rejected"
      : adminStatus === "needs_more_info" ||
        rawStatus === "MORE_INFO_REQUIRED"
      ? "needs_more_info"
      : "under_ai_review",

  documents: mappedDocuments,

  result: {
    score:
      adminStatus === "approved" || rawStatus === "APPROVED"
        ? 100
        : row.stripe_payouts_enabled ||
          row.stripe_onboarding_complete
        ? 70
        : 0,

    idVerified: Boolean(row.id_verified),
    businessVerified: Boolean(
      row.business_verified || row.business_name
    ),
    einVerified: Boolean(row.ein_verified),
    stateRegistrationVerified: Boolean(
      row.state_registration_verified
    ),
    insuranceVerified: Boolean(row.insurance_verified),

    payoutVerified: Boolean(
      row.stripe_payouts_enabled ||
      row.stripe_onboarding_complete
    ),

    noFraudFlags: !Boolean(row.fraud_flag),

    missingItems: [],

    verificationSources: [
      "Supabase admin_verifications",
    ],

    reviewedAt:
      row.updated_at ||
      row.created_at ||
      new Date().toISOString(),

    autoApproved: false,
  },
} as any;
  
}

export default function AdminComplianceReviewScreen() {
  const [records, setRecords] = useState<ComplianceRecord[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadRecords();
    }, [])
  );

  async function loadRecords() {
    try {
      const localRecords = await getComplianceRecords();

      const { data, error } = await supabase
        .from("admin_verifications")
        .select("*")
        .order("updated_at", { ascending: false });

      if (error) {
        console.log("Compliance review Supabase load error:", error.message);
      }

      const supabaseRecords = Array.isArray(data)
        ? data.map(mapAdminVerificationToComplianceRecord)
        : [];

      const mergedMap = new Map<string, ComplianceRecord>();

      [...supabaseRecords, ...localRecords].forEach((record: any) => {
        mergedMap.set(String(record.farmerId), record);
      });

      setRecords(Array.from(mergedMap.values()));
    } catch (error) {
      console.log("Compliance review load error:", error);
      setRecords([]);
    }
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

  async function updateAdminAndFarmer(
    record: ComplianceRecord,
    adminPayload: any,
    farmerPayload: any
  ) {
    const { error: adminError } = await supabase
      .from("admin_verifications")
      .update(adminPayload)
      .or(`id.eq.${record.farmerId},farmer_id.eq.${record.farmerId}`);

    if (adminError) throw adminError;

    const { error: farmerError } = await supabase
      .from("farmers")
      .update(farmerPayload)
      .eq("id", record.farmerId);

    if (farmerError) throw farmerError;
  }

  async function approveFarmer(record: ComplianceRecord) {
    try {
      const now = new Date().toISOString();

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
        reviewedAt: now,
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
        updatedAt: now,
      } as any);

      await updateAdminAndFarmer(
        record,
        {
          status: "APPROVED",
          compliance_status: "approved",
          admin_review_status: "approved",
          review_decision: "approved",
          approved: true,
          rejected: false,
          needs_more_info: false,
          reviewed: true,
          account_active: true,
          store_unlocked: true,
          approved_at: now,
          updated_at: now,
        },
        {
          compliance_status: "approved",
          admin_review_status: "approved",
          review_decision: "approved",
          approved: true,
          rejected: false,
          needs_more_info: false,
          reviewed: true,
          account_active: true,
          store_unlocked: true,
          approved_at: now,
          membership_status: "approved_pending_subscription",
          updated_at: now,
        }
      );

      Alert.alert("Approved", "Farmer has been approved.");
      await loadRecords();
    } catch (error: any) {
      Alert.alert("Approval Error", error?.message || "Unable to approve farmer.");
    }
  }

  async function rejectFarmer(record: ComplianceRecord) {
    try {
      const now = new Date().toISOString();

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
        reviewedAt: now,
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
        updatedAt: now,
      } as any);

      await updateAdminAndFarmer(
        record,
        {
          status: "REJECTED",
          compliance_status: "rejected",
          admin_review_status: "rejected",
          review_decision: "rejected",
          approved: false,
          rejected: true,
          needs_more_info: false,
          reviewed: true,
          account_active: false,
          store_unlocked: false,
          updated_at: now,
        },
        {
          compliance_status: "rejected",
          admin_review_status: "rejected",
          review_decision: "rejected",
          approved: false,
          rejected: true,
          needs_more_info: false,
          reviewed: true,
          account_active: false,
          store_unlocked: false,
          updated_at: now,
        }
      );

      Alert.alert("Rejected", "Farmer compliance application was rejected.");
      await loadRecords();
    } catch (error: any) {
      Alert.alert("Reject Error", error?.message || "Unable to reject farmer.");
    }
  }

  async function requestMoreInfo(record: ComplianceRecord) {
    try {
      const now = new Date().toISOString();

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
        missingItems: record.result?.missingItems?.length
          ? record.result.missingItems
          : ["Additional documents or clarification needed"],
        verificationSources: [
          ...(record.result?.verificationSources || []),
          "Admin requested more information",
        ],
        reviewedAt: now,
        autoApproved: false,
      };

      await saveComplianceResult(record.farmerId, result);

      await updateFarmerStore(record.farmerId, {
        approved: false,
        complianceStatus: "needs_more_info",
        adminReviewStatus: "needs_more_info",
        reviewDecision: "needs_more_info",
        status: "MORE_INFO_REQUIRED",
        updatedAt: now,
      } as any);

      await updateAdminAndFarmer(
        record,
        {
          status: "MORE_INFO_REQUIRED",
          compliance_status: "needs_more_info",
          admin_review_status: "needs_more_info",
          review_decision: "needs_more_info",
          approved: false,
          rejected: false,
          needs_more_info: true,
          reviewed: true,
          updated_at: now,
        },
        {
          compliance_status: "needs_more_info",
          admin_review_status: "needs_more_info",
          review_decision: "needs_more_info",
          approved: false,
          rejected: false,
          needs_more_info: true,
          reviewed: true,
          updated_at: now,
        }
      );

      Alert.alert("More Info Requested", "Farmer was marked as needing more info.");
      await loadRecords();
    } catch (error: any) {
      Alert.alert("Request Error", error?.message || "Unable to request more info.");
    }
  }

  function CheckRow({ label, value }: { label: string; value: boolean }) {
    return (
      <View style={styles.checkRow}>
        <Ionicons
          name={value ? "checkmark-circle-outline" : "close-circle-outline"}
          size={20}
          color={value ? ui.green : ui.orange}
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
            <Ionicons name="leaf-outline" size={22} color={ui.primary} />
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
          <CheckRow label="Business Verified" value={Boolean(record.result?.businessVerified)} />
          <CheckRow label="EIN Verified" value={Boolean(record.result?.einVerified)} />
          <CheckRow
            label="State Registration Verified"
            value={Boolean(record.result?.stateRegistrationVerified)}
          />
          <CheckRow label="Insurance Verified" value={Boolean(record.result?.insuranceVerified)} />
          <CheckRow label="Stripe Payout Verified" value={Boolean(record.result?.payoutVerified)} />
          <CheckRow label="No Fraud Flags" value={Boolean(record.result?.noFraudFlags)} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Uploaded Documents</Text>

          {record.documents.length === 0 ? (
            <Text style={styles.mutedText}>No documents uploaded.</Text>
          ) : (
            record.documents.map((doc: any) => (
              <View key={doc.id} style={styles.docRow}>
                <Ionicons name="document-text-outline" size={20} color={ui.primary} />

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
          <Pressable style={styles.approveButton} onPress={() => approveFarmer(record)}>
            <Ionicons name="checkmark-circle-outline" size={17} color="#FFFFFF" />
            <Text style={styles.actionText}>Approve</Text>
          </Pressable>

          <Pressable style={styles.moreInfoButton} onPress={() => requestMoreInfo(record)}>
            <Ionicons name="alert-circle-outline" size={17} color="#FFFFFF" />
            <Text style={styles.actionText}>Need Info</Text>
          </Pressable>

          <Pressable style={styles.rejectButton} onPress={() => rejectFarmer(record)}>
            <Ionicons name="close-circle-outline" size={17} color="#FFFFFF" />
            <Text style={styles.actionText}>Reject</Text>
          </Pressable>
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
              <Text style={styles.logoSub}>Compliance Review</Text>
            </View>
          </View>

          <NavButton label="Dashboard" icon="grid-outline" route="/admin/dashboard" />
          <NavButton label="Documents" icon="document-text-outline" route="/admin/documents" />
          <NavButton label="Compliance" icon="shield-checkmark-outline" route="/admin/compliance-review" active />
          <NavButton label="Business Docs" icon="folder-open-outline" route="/admin/business-documents" />
          <NavButton label="Verification" icon="checkmark-done-outline" route="/admin/verification-records" />
          <NavButton label="Settings" icon="settings-outline" route="/admin/admin-settings" />
        </View>

        <View style={styles.main}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            <View style={styles.topbar}>
              <View>
                <Text style={styles.welcome}>Farm2Home Admin Portal</Text>
                <Text style={styles.pageTitle}>Compliance Review</Text>
                <Text style={styles.pageSub}>
                  Review new registrations, AI compliance findings, uploaded documents,
                  missing requirements, legal checks, and approval decisions.
                </Text>
              </View>

              <TouchableOpacity style={styles.refreshPill} onPress={loadRecords}>
                <Ionicons name="refresh-outline" size={18} color={ui.primary} />
                <Text style={styles.refreshPillText}>Refresh</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.statsGrid}>
              <SummaryCard label="Total" value={String(summary.total)} icon="folder-outline" accent />
              <SummaryCard label="AI Review" value={String(summary.review)} icon="sparkles-outline" />
              <SummaryCard label="Approved" value={String(summary.approved)} icon="checkmark-circle-outline" success />
              <SummaryCard label="Needs Info" value={String(summary.needsInfo)} icon="alert-circle-outline" warning />
              <SummaryCard label="Rejected" value={String(summary.rejected)} icon="close-circle-outline" danger />
            </View>

            {records.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="file-tray-outline" size={38} color={ui.primary} />
                <Text style={styles.emptyTitle}>No compliance records yet</Text>
                <Text style={styles.emptyText}>
                  New farmer and freight submissions will appear here after they submit registration or compliance review.
                </Text>
              </View>
            ) : (
              records.map(renderRecord)
            )}
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
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
  content: { paddingBottom: 90 },
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
  emptyCard: {
    backgroundColor: ui.card,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: ui.border,
    alignItems: "center",
    marginBottom: 18,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: ui.text,
    marginTop: 10,
  },
  emptyText: {
    color: ui.muted,
    marginTop: 8,
    lineHeight: 21,
    fontWeight: "700",
    textAlign: "center",
  },
  card: {
    backgroundColor: ui.card,
    borderRadius: 24,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: ui.border,
  },
  cardHeader: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  recordIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: ui.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  businessName: { color: ui.text, fontSize: 21, fontWeight: "900" },
  ownerName: { color: ui.muted, fontWeight: "700", marginTop: 4 },
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
    backgroundColor: ui.primary,
    borderRadius: 18,
    padding: 14,
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  scoreLabel: { color: "#FFFFFF", fontWeight: "900" },
  scoreHelp: {
    color: "#EDE9FE",
    fontWeight: "700",
    marginTop: 4,
    lineHeight: 20,
  },
  scoreValue: { color: "#FFFFFF", fontWeight: "900", fontSize: 28 },
  section: { marginTop: 16 },
  sectionTitle: {
    color: ui.text,
    fontSize: 17,
    fontWeight: "900",
    marginBottom: 8,
  },
  checkRow: {
    backgroundColor: ui.soft,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: ui.border,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  checkText: { color: ui.text, fontWeight: "800", flex: 1 },
  checkStatus: { fontWeight: "900", fontSize: 12 },
  goodText: { color: ui.green },
  warnText: { color: ui.orange },
  mutedText: { color: ui.muted, fontWeight: "700" },
  docRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: ui.border,
    paddingVertical: 10,
  },
  docLabel: { color: ui.text, fontWeight: "900" },
  docUri: { color: ui.muted, marginTop: 3, fontSize: 12 },
  docStatus: { fontWeight: "900" },
  verified: { color: ui.green },
  unverified: { color: ui.orange },
  missingItem: {
    color: ui.red,
    fontWeight: "800",
    marginBottom: 4,
  },
  successText: { color: ui.green, fontWeight: "900" },
  sourceText: { color: ui.muted, fontWeight: "700", marginBottom: 4 },
  actions: { flexDirection: "row", gap: 8, marginTop: 18 },
  approveButton: {
    flex: 1,
    backgroundColor: ui.green,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 5,
  },
  moreInfoButton: {
    flex: 1,
    backgroundColor: ui.orange,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 5,
  },
  rejectButton: {
    flex: 1,
    backgroundColor: ui.red,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 5,
  },
  actionText: { color: "#FFFFFF", fontWeight: "900", fontSize: 12 },
});