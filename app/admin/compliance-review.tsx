// app/admin/compliance-review.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../services/supabaseClient";
import {
  ComplianceRecord,
  getComplianceRecords,
  saveComplianceResult,
} from "../data/complianceStore";
import { updateFarmerStore } from "../data/farmerStore";

type ReviewFilter = "all" | "under_ai_review" | "approved" | "needs_more_info" | "rejected";

const ui = {
  bg: "#F4F7FB",
  dark: "#07111F",
  card: "#FFFFFF",
  border: "#E2E8F0",
  text: "#0F172A",
  muted: "#64748B",
  primary: "#2563EB",
  primarySoft: "#EFF6FF",
  green: "#16A34A",
  greenSoft: "#ECFDF5",
  orange: "#EA580C",
  orangeSoft: "#FFF7ED",
  red: "#DC2626",
  redSoft: "#FEF2F2",
  purple: "#7C3AED",
  purpleSoft: "#F5F3FF",
  white: "#FFFFFF",
};

function clean(value: any) {
  return String(value ?? "").trim();
}

function lower(value: any) {
  return clean(value).toLowerCase();
}

function prettyStatus(status?: string) {
  return clean(status || "under_ai_review")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function statusColor(status?: string) {
  if (status === "approved") return ui.green;
  if (status === "rejected") return ui.red;
  if (status === "needs_more_info") return ui.orange;
  return ui.primary;
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

  const adminStatus = lower(row.admin_review_status);
  const rawStatus = clean(row.status).toUpperCase();

  return {
    farmerId: clean(row.farmer_id || row.id),
    businessName:
      clean(row.business_name) ||
      clean(row.farm_name) ||
      clean(row.company_name) ||
      "Farm2Home Applicant",
    ownerName: clean(row.owner_name || row.contact_name) || "Not listed",
    state: clean(row.state) || "Not listed",
    status:
      adminStatus === "approved" || rawStatus === "APPROVED"
        ? "approved"
        : adminStatus === "rejected" || rawStatus === "REJECTED"
        ? "rejected"
        : adminStatus === "needs_more_info" || rawStatus === "MORE_INFO_REQUIRED"
        ? "needs_more_info"
        : "under_ai_review",
    documents: mappedDocuments,
    result: {
      score:
        adminStatus === "approved" || rawStatus === "APPROVED"
          ? 100
          : row.stripe_payouts_enabled || row.stripe_onboarding_complete
          ? 70
          : 0,
      idVerified: Boolean(row.id_verified),
      businessVerified: Boolean(row.business_verified || row.business_name),
      einVerified: Boolean(row.ein_verified),
      stateRegistrationVerified: Boolean(row.state_registration_verified),
      insuranceVerified: Boolean(row.insurance_verified),
      payoutVerified: Boolean(row.stripe_payouts_enabled || row.stripe_onboarding_complete),
      noFraudFlags: !Boolean(row.fraud_flag),
      missingItems: Array.isArray(row.missing_items) ? row.missing_items : [],
      verificationSources: ["Supabase admin_verifications"],
      reviewedAt: row.updated_at || row.created_at || new Date().toISOString(),
      autoApproved: false,
    },
  } as any;
}

export default function AdminComplianceReviewScreen() {
  const [records, setRecords] = useState<ComplianceRecord[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ReviewFilter>("all");

  useFocusEffect(
    useCallback(() => {
      initialize();
    }, [])
  );

  async function initialize() {
    const rawAdmin = await AsyncStorage.getItem("currentAdmin");

    if (!rawAdmin) {
      router.replace("/admin/login" as any);
      return;
    }

    try {
      const admin = JSON.parse(rawAdmin);

      if (admin.role !== "admin" || admin.isActive === false) {
        router.replace("/admin/login" as any);
        return;
      }

      await loadRecords();
    } catch {
      router.replace("/admin/login" as any);
    }
  }

  async function loadRecords() {
    try {
      const localRecords = await getComplianceRecords();

      const { data, error } = await supabase
        .from("admin_verifications")
        .select("*")
        .order("updated_at", { ascending: false });

      if (error) console.log("Compliance review Supabase load error:", error.message);

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

  async function onRefresh() {
    setRefreshing(true);
    await loadRecords();
    setRefreshing(false);
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

  const filteredRecords = useMemo(() => {
    const q = lower(search);

    return records.filter((record) => {
      const statusMatch = filter === "all" || record.status === filter;
      const searchMatch =
        !q ||
        lower(record.businessName).includes(q) ||
        lower(record.ownerName).includes(q) ||
        lower(record.state).includes(q) ||
        lower(record.farmerId).includes(q) ||
        lower(record.status).includes(q);

      return statusMatch && searchMatch;
    });
  }, [records, search, filter]);

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
        verificationSources: ["Admin manual review", "Farm2Home compliance rejection"],
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

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={ui.dark} />

      <ScrollView
        style={styles.page}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>Farm2Home Admin</Text>
            <Text style={styles.title}>Compliance Review</Text>
            <Text style={styles.subtitle}>
              Review farmer applications, AI compliance findings, documents, missing
              requirements, Stripe payout readiness, and final approval decisions.
            </Text>
          </View>

          <TouchableOpacity style={styles.refreshButton} onPress={loadRecords}>
            <Ionicons name="refresh-outline" size={18} color={ui.white} />
            <Text style={styles.refreshText}>Refresh</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.flowCard}>
          <Text style={styles.flowTitle}>Compliance Workflow</Text>
          <FlowStep number="1" text="Review submitted business and identity documents." />
          <FlowStep number="2" text="Check AI score, verification checklist, and missing items." />
          <FlowStep number="3" text="Approve, reject, or request more information." />
          <FlowStep number="4" text="Approved farmers unlock store access and move to subscription setup." />
        </View>

        <View style={styles.grid}>
          <Metric label="Total" value={summary.total} icon="folder-outline" color={ui.primary} />
          <Metric label="AI Review" value={summary.review} icon="sparkles-outline" color={ui.purple} />
          <Metric label="Approved" value={summary.approved} icon="checkmark-circle-outline" color={ui.green} />
          <Metric label="Needs Info" value={summary.needsInfo} icon="alert-circle-outline" color={ui.orange} />
          <Metric label="Rejected" value={summary.rejected} icon="close-circle-outline" color={ui.red} />
        </View>

        <View style={styles.navGrid}>
          <AdminNav label="Dashboard" icon="grid-outline" route="/admin/dashboard" />
          <AdminNav label="Documents" icon="document-text-outline" route="/admin/documents" />
          <AdminNav label="Verification" icon="checkmark-done-outline" route="/admin/verification-records" />
          <AdminNav label="Business Docs" icon="folder-open-outline" route="/admin/business-documents" />
        </View>

        <View style={styles.searchCard}>
          <Ionicons name="search-outline" size={20} color={ui.primary} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search farmer, owner, state, status, ID..."
            placeholderTextColor={ui.muted}
            style={styles.searchInput}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          <FilterChip label="All" active={filter === "all"} onPress={() => setFilter("all")} />
          <FilterChip label="AI Review" active={filter === "under_ai_review"} onPress={() => setFilter("under_ai_review")} />
          <FilterChip label="Approved" active={filter === "approved"} onPress={() => setFilter("approved")} />
          <FilterChip label="Needs Info" active={filter === "needs_more_info"} onPress={() => setFilter("needs_more_info")} />
          <FilterChip label="Rejected" active={filter === "rejected"} onPress={() => setFilter("rejected")} />
        </ScrollView>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Review Queue</Text>
          <Text style={styles.sectionSub}>{filteredRecords.length} record(s) shown</Text>
        </View>

        {filteredRecords.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>🛡️</Text>
            <Text style={styles.emptyTitle}>No compliance records found</Text>
            <Text style={styles.emptyText}>
              New farmer submissions will appear here after registration or compliance review.
            </Text>
          </View>
        ) : (
          filteredRecords.map((record) => (
            <ComplianceCard
              key={record.farmerId}
              record={record}
              onApprove={() => approveFarmer(record)}
              onNeedInfo={() => requestMoreInfo(record)}
              onReject={() => rejectFarmer(record)}
            />
          ))
        )}

        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function ComplianceCard({
  record,
  onApprove,
  onNeedInfo,
  onReject,
}: {
  record: ComplianceRecord;
  onApprove: () => void;
  onNeedInfo: () => void;
  onReject: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.recordIcon}>
          <Ionicons name="leaf-outline" size={22} color={ui.primary} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.businessName}>{record.businessName || "Unnamed Farm"}</Text>
          <Text style={styles.ownerName}>Owner: {record.ownerName || "Not listed"}</Text>
          <Text style={styles.ownerName}>State: {record.state || "Not listed"}</Text>
        </View>

        <View style={[styles.statusBadge, { backgroundColor: statusColor(String(record.status)) }]}>
          <Text style={styles.statusText}>{prettyStatus(String(record.status))}</Text>
        </View>
      </View>

      <View style={styles.scoreBox}>
        <View style={{ flex: 1 }}>
          <Text style={styles.scoreLabel}>AI Compliance Score</Text>
          <Text style={styles.scoreHelp}>Manual review can approve, reject, or request more info.</Text>
        </View>
        <Text style={styles.scoreValue}>{record.result?.score ?? 0}%</Text>
      </View>

      <View style={styles.subSection}>
        <Text style={styles.subTitle}>Verification Checklist</Text>
        <CheckRow label="Identity Verified" value={Boolean(record.result?.idVerified)} />
        <CheckRow label="Business Verified" value={Boolean(record.result?.businessVerified)} />
        <CheckRow label="EIN Verified" value={Boolean(record.result?.einVerified)} />
        <CheckRow label="State Registration Verified" value={Boolean(record.result?.stateRegistrationVerified)} />
        <CheckRow label="Insurance Verified" value={Boolean(record.result?.insuranceVerified)} />
        <CheckRow label="Stripe Payout Verified" value={Boolean(record.result?.payoutVerified)} />
        <CheckRow label="No Fraud Flags" value={Boolean(record.result?.noFraudFlags)} />
      </View>

      <View style={styles.subSection}>
        <Text style={styles.subTitle}>Uploaded Documents</Text>
        {record.documents.length === 0 ? (
          <Text style={styles.mutedText}>No documents uploaded.</Text>
        ) : (
          record.documents.map((doc: any) => (
            <View key={doc.id} style={styles.docRow}>
              <Ionicons name="document-text-outline" size={20} color={ui.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.docLabel}>{doc.label}</Text>
                <Text style={styles.docUri} numberOfLines={1}>{doc.uri}</Text>
              </View>
              <Text style={[styles.docStatus, doc.verified ? styles.verified : styles.unverified]}>
                {doc.verified ? "Verified" : "Pending"}
              </Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.subSection}>
        <Text style={styles.subTitle}>Missing / Needed</Text>
        {record.result?.missingItems?.length ? (
          record.result.missingItems.map((item) => (
            <Text key={item} style={styles.missingItem}>• {item}</Text>
          ))
        ) : (
          <Text style={styles.successText}>No missing items listed.</Text>
        )}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.approveButton} onPress={onApprove}>
          <Ionicons name="checkmark-circle-outline" size={17} color={ui.white} />
          <Text style={styles.actionText}>Approve</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.moreInfoButton} onPress={onNeedInfo}>
          <Ionicons name="alert-circle-outline" size={17} color={ui.white} />
          <Text style={styles.actionText}>Need Info</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.rejectButton} onPress={onReject}>
          <Ionicons name="close-circle-outline" size={17} color={ui.white} />
          <Text style={styles.actionText}>Reject</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
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

function FlowStep({ number, text }: { number: string; text: string }) {
  return (
    <View style={styles.flowStep}>
      <Text style={styles.flowNumber}>{number}</Text>
      <Text style={styles.flowText}>{text}</Text>
    </View>
  );
}

function Metric({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}) {
  return (
    <View style={styles.metric}>
      <View style={[styles.metricIcon, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function AdminNav({
  label,
  icon,
  route,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
}) {
  return (
    <TouchableOpacity style={styles.navButton} onPress={() => router.push(route as any)}>
      <Ionicons name={icon} size={18} color={ui.primary} />
      <Text style={styles.navText}>{label}</Text>
      <Ionicons name="chevron-forward-outline" size={17} color={ui.muted} />
    </TouchableOpacity>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[styles.filterChip, active && styles.filterChipActive]} onPress={onPress}>
      <Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: ui.dark },
  page: { flex: 1, backgroundColor: ui.bg },
  content: { padding: 16, paddingBottom: 90 },

  hero: {
    backgroundColor: ui.dark,
    borderRadius: 28,
    padding: 22,
    marginBottom: 14,
    flexDirection: "row",
    gap: 12,
  },
  kicker: {
    color: "#93C5FD",
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  title: { color: ui.white, fontSize: 33, fontWeight: "900", marginTop: 6 },
  subtitle: {
    color: "#CBD5E1",
    fontWeight: "700",
    lineHeight: 22,
    marginTop: 8,
  },
  refreshButton: {
    backgroundColor: ui.primary,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    alignSelf: "flex-start",
  },
  refreshText: { color: ui.white, fontWeight: "900" },

  flowCard: {
    backgroundColor: ui.card,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: ui.border,
    marginBottom: 14,
  },
  flowTitle: { color: ui.text, fontSize: 20, fontWeight: "900", marginBottom: 10 },
  flowStep: { flexDirection: "row", gap: 10, alignItems: "center", marginTop: 8 },
  flowNumber: {
    width: 30,
    height: 30,
    borderRadius: 12,
    backgroundColor: ui.primarySoft,
    color: ui.primary,
    textAlign: "center",
    textAlignVertical: "center",
    fontWeight: "900",
    overflow: "hidden",
  },
  flowText: { flex: 1, color: ui.text, fontWeight: "800", lineHeight: 20 },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metric: {
    flexGrow: 1,
    width: "47%",
    backgroundColor: ui.card,
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: ui.border,
  },
  metricIcon: {
    width: 40,
    height: 40,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  metricValue: { color: ui.text, fontSize: 22, fontWeight: "900" },
  metricLabel: { color: ui.muted, fontWeight: "800", marginTop: 4 },

  navGrid: { gap: 10, marginTop: 14 },
  navButton: {
    backgroundColor: ui.card,
    borderWidth: 1,
    borderColor: ui.border,
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  navText: { flex: 1, color: ui.text, fontWeight: "900" },

  searchCard: {
    backgroundColor: ui.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: ui.border,
    paddingHorizontal: 14,
    minHeight: 54,
    marginTop: 14,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInput: { flex: 1, color: ui.text, fontWeight: "800" },

  filterRow: { gap: 8, paddingBottom: 14 },
  filterChip: {
    backgroundColor: ui.card,
    borderWidth: 1,
    borderColor: ui.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    marginRight: 8,
  },
  filterChipActive: { backgroundColor: ui.primary, borderColor: ui.primary },
  filterText: { color: ui.text, fontWeight: "900" },
  filterTextActive: { color: ui.white },

  sectionHeader: { marginTop: 4, marginBottom: 12 },
  sectionTitle: { color: ui.text, fontSize: 23, fontWeight: "900" },
  sectionSub: { color: ui.muted, fontWeight: "700", marginTop: 4 },

  emptyCard: {
    backgroundColor: ui.card,
    borderRadius: 22,
    padding: 24,
    borderWidth: 1,
    borderColor: ui.border,
    alignItems: "center",
  },
  emptyEmoji: { fontSize: 38 },
  emptyTitle: { color: ui.text, fontWeight: "900", fontSize: 18, marginTop: 8 },
  emptyText: {
    color: ui.muted,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 21,
    marginTop: 6,
  },

  card: {
    backgroundColor: ui.card,
    borderRadius: 24,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: ui.border,
  },
  cardHeader: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  recordIcon: {
    width: 46,
    height: 46,
    borderRadius: 17,
    backgroundColor: ui.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  businessName: { color: ui.text, fontSize: 19, fontWeight: "900" },
  ownerName: { color: ui.muted, fontWeight: "700", marginTop: 4 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, maxWidth: 150 },
  statusText: { color: ui.white, fontWeight: "900", fontSize: 11, textAlign: "center" },

  scoreBox: {
    backgroundColor: ui.primary,
    borderRadius: 18,
    padding: 14,
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  scoreLabel: { color: ui.white, fontWeight: "900" },
  scoreHelp: { color: "#DBEAFE", fontWeight: "700", marginTop: 4, lineHeight: 20 },
  scoreValue: { color: ui.white, fontWeight: "900", fontSize: 28 },

  subSection: { marginTop: 16 },
  subTitle: { color: ui.text, fontSize: 17, fontWeight: "900", marginBottom: 8 },

  checkRow: {
    backgroundColor: ui.bg,
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
  missingItem: { color: ui.red, fontWeight: "800", marginBottom: 4 },
  successText: { color: ui.green, fontWeight: "900" },

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
  actionText: { color: ui.white, fontWeight: "900", fontSize: 12 },
});