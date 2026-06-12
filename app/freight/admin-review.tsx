// app/freight/admin-review.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
  dashboard: "/freight/dashboard",
  managementCenter: "/freight/freight-management-center",
  compliance: "/freight/compliance",
  documents: "/freight/documents",
  legal: "/freight/legal",
  connectBank: "/freight/connect-bank",
  subscription: "/freight/subscription",
  profile: "/freight/profile",
  settings: "/freight/settings",
  support: "/freight/support",
  help: "/freight/help",
  board: "/freight/board",
  login: "/freight/login",
  register: "/freight/register",
} as const;

type FreightRoute = (typeof FREIGHT_ROUTES)[keyof typeof FREIGHT_ROUTES];

type FreightDocument = {
  id: string;
  freight_id?: string;
  document_type?: string;
  title?: string;
  file_name?: string;
  status?: string;
  review_status?: string;
  admin_notes?: string;
  rejection_reason?: string;
  reviewed_at?: string;
  created_at?: string;
  updated_at?: string;
};

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
  slate: "#64748B",
};

function normalize(value: any) {
  return String(value || "").trim().toLowerCase();
}

function goTo(route: FreightRoute) {
  router.push(route as any);
}

function formatDate(value?: string | null) {
  if (!value) return "Not reviewed yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not reviewed yet";
  return date.toLocaleString();
}

function statusLabel(value?: string) {
  return String(value || "pending_review")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function statusColor(status?: string) {
  const value = normalize(status);

  if (value.includes("approved")) return COLORS.green;
  if (value.includes("rejected") || value.includes("failed")) return COLORS.red;
  if (value.includes("needs") || value.includes("update")) return COLORS.amber;
  if (value.includes("submitted") || value.includes("review") || value.includes("pending")) {
    return COLORS.blue;
  }

  return COLORS.slate;
}

export default function FreightAdminReviewScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [carrier, setCarrier] = useState<any>(null);
  const [documents, setDocuments] = useState<FreightDocument[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadReview();
    }, [])
  );

  const reviewStats = useMemo(() => {
    const approved = documents.filter((doc) =>
      normalize(doc.review_status || doc.status).includes("approved")
    ).length;

    const rejected = documents.filter((doc) =>
      normalize(doc.review_status || doc.status).includes("rejected")
    ).length;

    const pending = documents.filter((doc) => {
      const status = normalize(doc.review_status || doc.status);
      return status.includes("pending") || status.includes("review") || status.includes("submitted");
    }).length;

    const needsUpdate = documents.filter((doc) => {
      const status = normalize(doc.review_status || doc.status);
      return status.includes("needs") || status.includes("update");
    }).length;

    return {
      total: documents.length,
      approved,
      rejected,
      pending,
      needsUpdate,
    };
  }, [documents]);

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
      businessName:
        nextCarrier.businessName ||
        nextCarrier.companyName ||
        nextCarrier.business_name ||
        nextCarrier.company_name ||
        "Freight Connect Carrier",
      complianceStatus:
        nextCarrier.complianceStatus ||
        nextCarrier.compliance_status ||
        "not_started",
      documentReviewStatus:
        nextCarrier.documentReviewStatus ||
        nextCarrier.document_review_status ||
        "pending_review",
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

  async function loadReview() {
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

      if (error) {
        console.log("Freight admin review profile error:", error.message);
      }

      if (!dbCarrier) {
        Alert.alert(
          "Freight Profile Missing",
          "No freight profile was found. Please complete freight registration first."
        );
        router.replace(FREIGHT_ROUTES.register as any);
        return;
      }

      const mergedCarrier = {
        ...(stored || {}),
        ...(dbCarrier || {}),
        id: dbCarrier.id,
        freightId: dbCarrier.id,
        role: "freight",
        email: normalize(dbCarrier.email || email),
        companyName:
          dbCarrier.company_name ||
          dbCarrier.business_name ||
          stored?.companyName ||
          stored?.businessName ||
          "Freight Connect Carrier",
        businessName:
          dbCarrier.business_name ||
          dbCarrier.company_name ||
          stored?.businessName ||
          stored?.companyName ||
          "Freight Connect Carrier",
        complianceStatus:
          dbCarrier.compliance_status ||
          stored?.complianceStatus ||
          "not_started",
        documentReviewStatus:
          dbCarrier.document_review_status ||
          stored?.documentReviewStatus ||
          "pending_review",
      };

      await persistCarrier(mergedCarrier);

      const { data: docData, error: docError } = await supabase
        .from("freight_documents")
        .select("*")
        .eq("freight_id", dbCarrier.id)
        .order("updated_at", { ascending: false });

      if (docError) {
        console.log("Freight review documents error:", docError.message);
        setDocuments([]);
      } else {
        setDocuments(Array.isArray(docData) ? docData : []);
      }
    } catch (error: any) {
      console.log("Freight admin review error:", error);
      Alert.alert("Review Error", error?.message || "Unable to load review status.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadReview();
  }

  function overallReviewStatus() {
    const status =
      carrier?.documentReviewStatus ||
      carrier?.document_review_status ||
      carrier?.complianceStatus ||
      carrier?.compliance_status ||
      "pending_review";

    if (reviewStats.rejected > 0) return "Needs Updates";
    if (reviewStats.total > 0 && reviewStats.approved === reviewStats.total) return "Approved";
    if (reviewStats.pending > 0) return "Pending Review";
    return statusLabel(status);
  }

  function overallColor() {
    const value = normalize(overallReviewStatus());

    if (value.includes("approved")) return COLORS.green;
    if (value.includes("needs") || value.includes("rejected")) return COLORS.amber;
    if (value.includes("pending")) return COLORS.blue;

    return COLORS.slate;
  }

  function renderDocument(doc: FreightDocument) {
    const reviewStatus = doc.review_status || doc.status || "pending_review";
    const hasProblem =
      normalize(reviewStatus).includes("rejected") ||
      normalize(reviewStatus).includes("needs");

    return (
      <View key={doc.id} style={styles.docCard}>
        <View style={styles.docTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.docTitle}>
              {doc.title || doc.document_type || doc.file_name || "Freight Document"}
            </Text>
            <Text style={styles.docSub}>{doc.file_name || "Uploaded document"}</Text>
          </View>

          <View style={[styles.docStatus, { backgroundColor: statusColor(reviewStatus) }]}>
            <Text style={styles.docStatusText}>{statusLabel(reviewStatus)}</Text>
          </View>
        </View>

        <View style={styles.infoBox}>
          <InfoRow label="Submitted" value={formatDate(doc.created_at)} />
          <InfoRow label="Last Updated" value={formatDate(doc.updated_at)} />
          <InfoRow label="Reviewed" value={formatDate(doc.reviewed_at)} />
        </View>

        {(doc.admin_notes || doc.rejection_reason || hasProblem) && (
          <View style={styles.noteBox}>
            <Text style={styles.noteTitle}>Admin Notes</Text>
            <Text style={styles.noteText}>
              {doc.rejection_reason ||
                doc.admin_notes ||
                "This document needs an update. Please upload a corrected version."}
            </Text>
          </View>
        )}

        {hasProblem && (
          <TouchableOpacity style={styles.replaceButton} onPress={() => goTo(FREIGHT_ROUTES.documents)}>
            <Ionicons name="cloud-upload-outline" size={18} color="#FFFFFF" />
            <Text style={styles.replaceText}>Upload Updated Document</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <ActivityIndicator size="large" color={COLORS.red} />
        <Text style={styles.centerText}>Loading document review status...</Text>
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
            <Text style={styles.title}>Admin Review</Text>
            <Text style={styles.subtitle}>
              Track whether your freight documents are pending, approved, rejected, or need updates.
            </Text>
          </View>

          <TouchableOpacity style={styles.heroIcon} onPress={() => goTo(FREIGHT_ROUTES.compliance)}>
            <Ionicons name="clipboard-outline" size={34} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.reviewCard}>
          <View style={styles.avatar}>
            <Ionicons name="business-outline" size={28} color="#FFFFFF" />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.carrierName}>
              {carrier?.companyName || "Freight Connect Carrier"}
            </Text>
            <Text style={styles.carrierEmail}>{carrier?.email || "Carrier workspace"}</Text>

            <View style={[styles.overallPill, { backgroundColor: overallColor() }]}>
              <Text style={styles.overallPillText}>{overallReviewStatus()}</Text>
            </View>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <StatCard label="Total" value={String(reviewStats.total)} icon="document-text-outline" />
          <StatCard label="Approved" value={String(reviewStats.approved)} icon="checkmark-circle-outline" />
          <StatCard label="Pending" value={String(reviewStats.pending)} icon="time-outline" />
          <StatCard label="Needs Updates" value={String(reviewStats.rejected + reviewStats.needsUpdate)} icon="alert-circle-outline" />
        </View>

        <View style={styles.quickGrid}>
          <QuickLink icon="document-attach-outline" label="Documents" route={FREIGHT_ROUTES.documents} />
          <QuickLink icon="shield-checkmark-outline" label="Compliance" route={FREIGHT_ROUTES.compliance} />
          <QuickLink icon="headset-outline" label="Support" route={FREIGHT_ROUTES.support} />
          <QuickLink icon="apps-outline" label="Management" route={FREIGHT_ROUTES.managementCenter} />
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Review Process</Text>
          <Text style={styles.noticeText}>
            Farm2Home reviews submitted carrier documents for accuracy, expiration, business
            identity, vehicle coverage, and freight safety readiness.
          </Text>
        </View>

        {documents.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="document-outline" size={38} color={COLORS.red} />
            <Text style={styles.emptyTitle}>No documents submitted.</Text>
            <Text style={styles.emptyText}>
              Upload your required carrier documents before admin review can begin.
            </Text>

            <TouchableOpacity style={styles.emptyButton} onPress={() => goTo(FREIGHT_ROUTES.documents)}>
              <Ionicons name="cloud-upload-outline" size={18} color="#FFFFFF" />
              <Text style={styles.emptyButtonText}>Upload Documents</Text>
            </TouchableOpacity>
          </View>
        ) : (
          documents.map(renderDocument)
        )}

        <TouchableOpacity style={styles.primaryButton} onPress={() => goTo(FREIGHT_ROUTES.documents)}>
          <Ionicons name="document-attach-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryText}>Open Documents</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.darkButton} onPress={() => goTo(FREIGHT_ROUTES.compliance)}>
          <Ionicons name="shield-checkmark-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryText}>Back to Compliance</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
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
  route: FreightRoute;
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
    alignItems: "flex-start",
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
  reviewCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 16,
    marginHorizontal: 18,
    marginTop: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
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
  overallPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 9,
  },
  overallPillText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
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
  notice: {
    backgroundColor: COLORS.black,
    marginHorizontal: 18,
    marginBottom: 16,
    borderRadius: 22,
    padding: 18,
  },
  noticeTitle: { color: "#FFFFFF", fontSize: 21, fontWeight: "900", marginBottom: 7 },
  noticeText: { color: "#D1D5DB", fontWeight: "700", lineHeight: 22 },
  docCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 18,
    marginHorizontal: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  docTop: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    marginBottom: 12,
  },
  docTitle: { color: COLORS.text, fontSize: 17, fontWeight: "900" },
  docSub: { color: COLORS.muted, fontWeight: "700", marginTop: 4 },
  docStatus: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    maxWidth: 135,
  },
  docStatusText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
  },
  infoBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 8,
  },
  infoLabel: { color: COLORS.muted, fontWeight: "900", flex: 1 },
  infoValue: { color: COLORS.text, fontWeight: "800", flex: 1, textAlign: "right" },
  noteBox: {
    backgroundColor: "#FFF1F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 16,
    padding: 13,
    marginTop: 12,
  },
  noteTitle: { color: COLORS.red, fontWeight: "900", marginBottom: 4 },
  noteText: { color: COLORS.text, fontWeight: "700", lineHeight: 21 },
  replaceButton: {
    backgroundColor: COLORS.red,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
  },
  replaceText: { color: "#FFFFFF", fontWeight: "900" },
  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    marginHorizontal: 18,
    marginBottom: 16,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "900",
    marginTop: 10,
  },
  emptyText: {
    color: COLORS.muted,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 22,
  },
  emptyButton: {
    backgroundColor: COLORS.red,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 14,
    marginTop: 16,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  emptyButtonText: { color: "#FFFFFF", fontWeight: "900" },
  primaryButton: {
    backgroundColor: COLORS.red,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 18,
    marginTop: 4,
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