// app/freight/compliance-vault.tsx
// Combined freight compliance vault for documents, certifications, insurance,
// safety, legal records, tax summaries, and review status.

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../data/supabaseClient";

const FREIGHT_ROUTES = {
  managementCenter: "/freight/freight-management-center",
  compliance: "/freight/compliance",
  businessDocuments: "/freight/business-documents",
  carrierCertifications: "/freight/carrier-certifications",
  insurance: "/freight/insurance",
  safety: "/freight/safety",
  legal: "/freight/legal",
  taxCenter: "/freight/tax-center",
  reportExport: "/freight/report-export",
  adminReview: "/freight/admin-review",
  support: "/freight/support",
  login: "/freight/login",
  register: "/freight/register",
} as const;

const COLORS = {
  bg: "#F4F5F7",
  card: "#FFFFFF",
  surface: "#F9FAFB",
  black: "#050505",
  red: "#D71920",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  green: "#16A34A",
  amber: "#D97706",
  blue: "#2563EB",
};

function normalize(value: any) {
  return String(value || "").trim().toLowerCase();
}

function goTo(route: string) {
  router.push(route as any);
}

function formatDate(value?: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString();
}

function isApproved(value: any) {
  return ["approved", "verified", "complete", "active"].includes(normalize(value));
}

export default function FreightComplianceVaultScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [carrier, setCarrier] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [taxSummaries, setTaxSummaries] = useState<any[]>([]);
  const [reportExports, setReportExports] = useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadVault();
    }, [])
  );

  const vault = useMemo(() => {
    const approvedDocs = documents.filter((doc) => isApproved(doc.review_status || doc.status));
    const pendingDocs = documents.filter((doc) =>
      ["submitted", "pending", "pending_review"].includes(normalize(doc.review_status || doc.status))
    );
    const rejectedDocs = documents.filter((doc) =>
      ["rejected", "denied"].includes(normalize(doc.review_status || doc.status))
    );

    const legalAccepted = Boolean(
      carrier?.legal_accepted ||
        carrier?.legalAccepted ||
        carrier?.freight_terms_accepted ||
        carrier?.freightTermsAccepted
    );

    const safetyReady = Boolean(
      carrier?.safety_confirmed ||
        carrier?.safetyConfirmed ||
        carrier?.safety_status === "complete"
    );

    const insuranceReady = documents.some((doc) =>
      ["commercial_insurance", "cargo_insurance", "insurance"].includes(normalize(doc.document_type))
    );

    const certCount = [
      carrier?.twic_certified,
      carrier?.tsa_certified,
      carrier?.medical_logistics_certified,
      carrier?.refrigerated_certified || carrier?.refrigerated_capable,
      carrier?.livestock_certified || carrier?.livestock_capable,
      carrier?.food_safety_certified,
    ].filter(Boolean).length;

    const businessDocsReady = documents.some((doc) =>
      ["business_license", "w_9", "ein_letter"].includes(normalize(doc.document_type))
    );

    const reviewReady =
      businessDocsReady && insuranceReady && legalAccepted && safetyReady && pendingDocs.length === 0;

    return {
      totalDocs: documents.length,
      approvedDocs: approvedDocs.length,
      pendingDocs: pendingDocs.length,
      rejectedDocs: rejectedDocs.length,
      legalAccepted,
      safetyReady,
      insuranceReady,
      certCount,
      businessDocsReady,
      taxSummaries: taxSummaries.length,
      reportExports: reportExports.length,
      reviewReady,
    };
  }, [carrier, documents, taxSummaries, reportExports]);

  async function getStoredCarrier() {
    const raw =
      (await AsyncStorage.getItem("currentFreightCarrier")) ||
      (await AsyncStorage.getItem("currentFreight")) ||
      (await AsyncStorage.getItem("currentFreightUser")) ||
      (await AsyncStorage.getItem("currentUser"));

    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async function persistCarrier(nextCarrier: any) {
    const normalizedCarrier = {
      ...nextCarrier,
      id: nextCarrier.id || nextCarrier.freightId,
      freightId: nextCarrier.freightId || nextCarrier.id,
      role: "freight",
      email: normalize(nextCarrier.email),
      companyName:
        nextCarrier.companyName ||
        nextCarrier.businessName ||
        nextCarrier.company_name ||
        nextCarrier.business_name ||
        "Freight Connect Carrier",
    };

    await AsyncStorage.setItem("currentFreight", JSON.stringify(normalizedCarrier));
    await AsyncStorage.setItem("currentFreightCarrier", JSON.stringify(normalizedCarrier));
    await AsyncStorage.setItem("currentFreightUser", JSON.stringify(normalizedCarrier));
    await AsyncStorage.setItem("currentUser", JSON.stringify(normalizedCarrier));
    await AsyncStorage.setItem("userRole", "freight");
    await AsyncStorage.setItem("currentUserRole", "freight");

    setCarrier(normalizedCarrier);
    return normalizedCarrier;
  }

  async function loadVault() {
    try {
      setLoading(true);

      const stored = await getStoredCarrier();
      const { data: authData } = await supabase.auth.getUser();
      const email = normalize(stored?.email || authData?.user?.email || "");

      if (!email) {
        router.replace(FREIGHT_ROUTES.login as any);
        return;
      }

      const { data: dbCarrier, error } = await supabase
        .from("freight_users")
        .select("*")
        .eq("email", email)
        .maybeSingle();

      if (error) console.log("Compliance vault carrier error:", error.message);

      if (!dbCarrier) {
        Alert.alert("Freight Profile Missing", "Please complete freight registration first.");
        router.replace(FREIGHT_ROUTES.register as any);
        return;
      }

      const mergedCarrier = await persistCarrier({
        ...(stored || {}),
        ...(dbCarrier || {}),
        id: dbCarrier.id,
        freightId: dbCarrier.id,
        email: normalize(dbCarrier.email || email),
        companyName:
          dbCarrier.company_name ||
          dbCarrier.business_name ||
          stored?.companyName ||
          stored?.businessName ||
          "Freight Connect Carrier",
      });

      const { data: docData } = await supabase
        .from("freight_documents")
        .select("*")
        .eq("freight_id", mergedCarrier.id)
        .order("updated_at", { ascending: false });

      setDocuments(Array.isArray(docData) ? docData : []);

      const { data: taxData } = await supabase
        .from("freight_tax_summaries")
        .select("*")
        .eq("freight_id", mergedCarrier.id)
        .order("tax_year", { ascending: false });

      setTaxSummaries(Array.isArray(taxData) ? taxData : []);

      const { data: exportData } = await supabase
        .from("freight_report_exports")
        .select("*")
        .eq("freight_id", mergedCarrier.id)
        .order("generated_at", { ascending: false });

      setReportExports(Array.isArray(exportData) ? exportData : []);
    } catch (error: any) {
      Alert.alert("Vault Error", error?.message || "Unable to load compliance vault.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadVault();
  }

  async function submitForReview() {
    if (!carrier?.id) {
      Alert.alert("Profile Missing", "Please log in again.");
      return;
    }

    try {
      const now = new Date().toISOString();

      const { error } = await supabase
        .from("freight_users")
        .update({
          compliance_vault_submitted: true,
          compliance_review_status: "pending_review",
          compliance_status: "pending_review",
          compliance_vault_submitted_at: now,
          updated_at: now,
        })
        .eq("id", carrier.id);

      if (error) throw error;

      await persistCarrier({
        ...carrier,
        compliance_vault_submitted: true,
        compliance_review_status: "pending_review",
        compliance_status: "pending_review",
      });

      Alert.alert("Submitted", "Compliance vault was submitted for review.", [
        { text: "Review Status", onPress: () => goTo(FREIGHT_ROUTES.adminReview) },
      ]);
    } catch (error: any) {
      Alert.alert("Submit Error", error?.message || "Unable to submit compliance vault.");
    }
  }

  function statusColor(status: any) {
    const value = normalize(status);

    if (["approved", "verified", "complete", "active"].includes(value)) return COLORS.green;
    if (["rejected", "denied", "expired"].includes(value)) return COLORS.red;
    if (["submitted", "pending", "pending_review"].includes(value)) return COLORS.amber;

    return COLORS.blue;
  }

  function renderDocument({ item }: { item: any }) {
    const status = item.review_status || item.status || "submitted";

    return (
      <View style={styles.documentCard}>
        <View style={styles.documentIcon}>
          <Ionicons name="document-text-outline" size={21} color="#FFFFFF" />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.documentTitle}>{item.title || item.file_name || "Compliance Document"}</Text>
          <Text style={styles.documentSub}>
            {String(item.document_type || "document").replace(/_/g, " ")} · {formatDate(item.updated_at || item.created_at)}
          </Text>
        </View>

        <View style={[styles.statusBadge, { backgroundColor: statusColor(status) }]}>
          <Text style={styles.statusText}>{String(status).replace(/_/g, " ")}</Text>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <ActivityIndicator size="large" color={COLORS.red} />
        <Text style={styles.centerText}>Loading compliance vault...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>Farm2Home Freight Connect</Text>
            <Text style={styles.title}>Compliance Vault</Text>
            <Text style={styles.subtitle}>
              Business documents, certifications, insurance, safety, legal records,
              tax summaries, report exports, and compliance review status.
            </Text>
          </View>

          <TouchableOpacity style={styles.heroIcon} onPress={() => goTo(FREIGHT_ROUTES.compliance)}>
            <Ionicons name="lock-closed-outline" size={34} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.carrierCard}>
          <View style={styles.avatar}>
            <Ionicons name="business-outline" size={28} color="#FFFFFF" />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.carrierName}>{carrier?.companyName || "Freight Connect Carrier"}</Text>
            <Text style={styles.carrierEmail}>{carrier?.email || "Carrier workspace"}</Text>

            <View style={[styles.statusPill, { backgroundColor: vault.reviewReady ? COLORS.green : COLORS.amber }]}>
              <Text style={styles.statusPillText}>
                {vault.reviewReady ? "Vault Ready" : "Vault Needs Review"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <StatCard label="Documents" value={String(vault.totalDocs)} icon="document-attach-outline" />
          <StatCard label="Approved" value={String(vault.approvedDocs)} icon="checkmark-circle-outline" />
          <StatCard label="Pending" value={String(vault.pendingDocs)} icon="time-outline" />
          <StatCard label="Certifications" value={String(vault.certCount)} icon="ribbon-outline" />
          <StatCard label="Tax Summaries" value={String(vault.taxSummaries)} icon="document-text-outline" />
          <StatCard label="Reports" value={String(vault.reportExports)} icon="download-outline" />
        </View>

        <View style={styles.quickGrid}>
          <QuickLink icon="business-outline" label="Business Docs" route={FREIGHT_ROUTES.businessDocuments} />
          <QuickLink icon="ribbon-outline" label="Certifications" route={FREIGHT_ROUTES.carrierCertifications} />
          <QuickLink icon="shield-outline" label="Insurance" route={FREIGHT_ROUTES.insurance} />
          <QuickLink icon="shield-checkmark-outline" label="Safety" route={FREIGHT_ROUTES.safety} />
          <QuickLink icon="reader-outline" label="Legal" route={FREIGHT_ROUTES.legal} />
          <QuickLink icon="document-text-outline" label="Tax Center" route={FREIGHT_ROUTES.taxCenter} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Vault Checklist</Text>

          <ChecklistRow label="Business documents uploaded" complete={vault.businessDocsReady} />
          <ChecklistRow label="Insurance documents uploaded" complete={vault.insuranceReady} />
          <ChecklistRow label="Legal records accepted" complete={vault.legalAccepted} />
          <ChecklistRow label="Safety profile complete" complete={vault.safetyReady} />
          <ChecklistRow label="No rejected documents" complete={vault.rejectedDocs === 0} />
          <ChecklistRow label="No pending document review" complete={vault.pendingDocs === 0} />
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Compliance Vault Review</Text>
          <Text style={styles.noticeText}>
            Submit the vault when all business, insurance, legal, safety, and certification
            documents are uploaded and ready for Farm2Home review.
          </Text>

          <TouchableOpacity style={styles.syncButton} onPress={submitForReview}>
            <Ionicons name="send-outline" size={18} color="#FFFFFF" />
            <Text style={styles.primaryText}>Submit Vault for Review</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Recent Vault Documents</Text>

        <FlatList
          data={documents.slice(0, 10)}
          keyExtractor={(item, index) => String(item.id || index)}
          scrollEnabled={false}
          renderItem={renderDocument}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Ionicons name="lock-closed-outline" size={38} color={COLORS.red} />
              <Text style={styles.emptyTitle}>No vault documents yet.</Text>
              <Text style={styles.emptyText}>
                Add business documents, insurance, certifications, and compliance records.
              </Text>
            </View>
          }
        />

        <TouchableOpacity style={styles.primaryButton} onPress={() => goTo(FREIGHT_ROUTES.businessDocuments)}>
          <Ionicons name="folder-open-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryText}>Open Business Documents</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.darkButton} onPress={() => goTo(FREIGHT_ROUTES.managementCenter)}>
          <Ionicons name="apps-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryText}>Management Center</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function ChecklistRow({ label, complete }: { label: string; complete: boolean }) {
  return (
    <View style={styles.checkRow}>
      <Ionicons
        name={complete ? "checkmark-circle" : "alert-circle-outline"}
        size={21}
        color={complete ? COLORS.green : COLORS.amber}
      />
      <Text style={styles.checkText}>{label}</Text>
      <Text style={[styles.checkStatus, { color: complete ? COLORS.green : COLORS.amber }]}>
        {complete ? "Complete" : "Needed"}
      </Text>
    </View>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={22} color={COLORS.red} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function QuickLink({
  icon,
  label,
  route,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  route: string;
}) {
  return (
    <TouchableOpacity style={styles.quickLink} onPress={() => goTo(route)}>
      <Ionicons name={icon} size={22} color={COLORS.red} />
      <Text style={styles.quickText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingBottom: 90 },
  center: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  centerText: { color: COLORS.muted, marginTop: 12, fontWeight: "800" },
  hero: {
    backgroundColor: COLORS.black,
    paddingTop: 30,
    paddingHorizontal: 20,
    paddingBottom: 30,
    flexDirection: "row",
    gap: 14,
  },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 24,
    backgroundColor: COLORS.red,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: {
    color: "#FCA5A5",
    fontWeight: "900",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontSize: 12,
  },
  title: { color: "#FFFFFF", fontSize: 32, fontWeight: "900", marginBottom: 10 },
  subtitle: { color: "#D1D5DB", lineHeight: 22, fontWeight: "700" },
  carrierCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 16,
    marginHorizontal: 18,
    marginTop: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: COLORS.red,
    alignItems: "center",
    justifyContent: "center",
  },
  carrierName: { color: COLORS.text, fontSize: 19, fontWeight: "900" },
  carrierEmail: { color: COLORS.muted, fontWeight: "700", marginTop: 4 },
  statusPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 9,
  },
  statusPillText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  statCard: {
    width: "48%",
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statValue: { color: COLORS.text, fontSize: 22, fontWeight: "900", marginTop: 7 },
  statLabel: { color: COLORS.muted, fontWeight: "800", marginTop: 4 },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  quickLink: {
    width: "48%",
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    gap: 8,
  },
  quickText: { color: COLORS.text, fontWeight: "900", textAlign: "center" },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 18,
    marginHorizontal: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTitle: { color: COLORS.text, fontSize: 21, fontWeight: "900", marginBottom: 12 },
  checkRow: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 13,
    marginBottom: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  checkText: { color: COLORS.text, fontWeight: "900", flex: 1 },
  checkStatus: { fontWeight: "900" },
  notice: {
    backgroundColor: COLORS.black,
    marginHorizontal: 18,
    marginBottom: 16,
    borderRadius: 22,
    padding: 18,
  },
  noticeTitle: { color: "#FFFFFF", fontSize: 21, fontWeight: "900", marginBottom: 7 },
  noticeText: { color: "#D1D5DB", fontWeight: "700", lineHeight: 22 },
  syncButton: {
    backgroundColor: COLORS.red,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 23,
    fontWeight: "900",
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  documentCard: {
    backgroundColor: COLORS.card,
    marginHorizontal: 18,
    marginBottom: 14,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  documentIcon: {
    width: 46,
    height: 46,
    borderRadius: 18,
    backgroundColor: COLORS.red,
    alignItems: "center",
    justifyContent: "center",
  },
  documentTitle: { color: COLORS.text, fontSize: 17, fontWeight: "900" },
  documentSub: {
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 4,
    textTransform: "capitalize",
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    maxWidth: 120,
  },
  statusText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "capitalize",
  },
  emptyCard: {
    backgroundColor: COLORS.card,
    marginHorizontal: 18,
    borderRadius: 22,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyTitle: { color: COLORS.text, fontSize: 20, fontWeight: "900", marginTop: 10 },
  emptyText: {
    color: COLORS.muted,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 22,
  },
  primaryButton: {
    backgroundColor: COLORS.red,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 18,
    marginTop: 10,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  darkButton: {
    backgroundColor: COLORS.black,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 18,
    marginTop: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryText: { color: "#FFFFFF", fontWeight: "900" },
});