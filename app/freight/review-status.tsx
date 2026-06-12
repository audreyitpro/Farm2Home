// app/freight/review-status.tsx

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
  complianceVault: "/freight/compliance-vault",
  businessDocuments: "/freight/business-documents",
  carrierCertifications: "/freight/carrier-certifications",
  insurance: "/freight/insurance",
  safety: "/freight/safety",
  legal: "/freight/legal",
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

export default function FreightReviewStatusScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [carrier, setCarrier] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadReviewStatus();
    }, [])
  );

  const review = useMemo(() => {
    const pending = documents.filter((doc) =>
      ["submitted", "pending", "pending_review"].includes(
        normalize(doc.review_status || doc.status)
      )
    );

    const approved = documents.filter((doc) =>
      ["approved", "verified"].includes(normalize(doc.review_status || doc.status))
    );

    const rejected = documents.filter((doc) =>
      ["rejected", "denied"].includes(normalize(doc.review_status || doc.status))
    );

    const requiredTypes = [
      "business_license",
      "w_9",
      "ein_letter",
      "commercial_insurance",
      "cargo_insurance",
    ];

    const missing = requiredTypes.filter(
      (type) => !documents.some((doc) => normalize(doc.document_type) === type)
    );

    const legalAccepted = Boolean(
      carrier?.legal_accepted ||
        carrier?.legalAccepted ||
        carrier?.freight_terms_accepted ||
        carrier?.freightTermsAccepted
    );

    const safetyComplete = Boolean(
      carrier?.safety_confirmed ||
        carrier?.safetyConfirmed ||
        carrier?.safety_status === "complete"
    );

    const status =
      rejected.length > 0
        ? "Action Required"
        : missing.length > 0 || !legalAccepted || !safetyComplete
        ? "Incomplete"
        : pending.length > 0
        ? "Pending Review"
        : "Ready";

    return {
      pending,
      approved,
      rejected,
      missing,
      legalAccepted,
      safetyComplete,
      status,
    };
  }, [carrier, documents]);

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

  async function loadReviewStatus() {
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

      if (error) console.log("Review status carrier error:", error.message);

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
    } catch (error: any) {
      Alert.alert("Review Status Error", error?.message || "Unable to load review status.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadReviewStatus();
  }

  function statusColor() {
    if (review.status === "Ready") return COLORS.green;
    if (review.status === "Pending Review") return COLORS.blue;
    if (review.status === "Action Required") return COLORS.red;
    return COLORS.amber;
  }

  function renderDocument({ item }: { item: any }) {
    const status = item.review_status || item.status || "submitted";
    const rejected = ["rejected", "denied"].includes(normalize(status));

    return (
      <View style={styles.documentCard}>
        <View style={styles.documentTop}>
          <View style={[styles.documentIcon, { backgroundColor: rejected ? COLORS.red : COLORS.black }]}>
            <Ionicons name="document-text-outline" size={22} color="#FFFFFF" />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.documentTitle}>{item.title || item.file_name || "Document"}</Text>
            <Text style={styles.documentSub}>
              {String(item.document_type || "document").replace(/_/g, " ")} ·{" "}
              {formatDate(item.updated_at || item.created_at)}
            </Text>
          </View>

          <View style={[styles.badge, { backgroundColor: rejected ? COLORS.red : COLORS.amber }]}>
            <Text style={styles.badgeText}>{String(status).replace(/_/g, " ")}</Text>
          </View>
        </View>

        {!!item.review_notes && (
          <View style={styles.reviewNotes}>
            <Text style={styles.reviewNotesTitle}>Review Notes</Text>
            <Text style={styles.reviewNotesText}>{item.review_notes}</Text>
          </View>
        )}
      </View>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <ActivityIndicator size="large" color={COLORS.red} />
        <Text style={styles.centerText}>Loading review status...</Text>
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
            <Text style={styles.title}>Review Status</Text>
            <Text style={styles.subtitle}>
              View compliance vault review status, missing items, rejected documents,
              pending review items, and next actions.
            </Text>
          </View>

          <TouchableOpacity style={styles.heroIcon} onPress={() => goTo(FREIGHT_ROUTES.complianceVault)}>
            <Ionicons name="eye-outline" size={34} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>Current Review Status</Text>
          <Text style={[styles.statusValue, { color: statusColor() }]}>{review.status}</Text>
          <Text style={styles.statusSub}>
            {carrier?.companyName || carrier?.businessName || "Freight Connect Carrier"}
          </Text>
        </View>

        <View style={styles.statsGrid}>
          <StatCard label="Approved" value={String(review.approved.length)} icon="checkmark-circle-outline" />
          <StatCard label="Pending" value={String(review.pending.length)} icon="time-outline" />
          <StatCard label="Rejected" value={String(review.rejected.length)} icon="close-circle-outline" />
          <StatCard label="Missing" value={String(review.missing.length)} icon="alert-circle-outline" />
        </View>

        <View style={styles.quickGrid}>
          <QuickLink icon="lock-closed-outline" label="Vault" route={FREIGHT_ROUTES.complianceVault} />
          <QuickLink icon="folder-open-outline" label="Business Docs" route={FREIGHT_ROUTES.businessDocuments} />
          <QuickLink icon="ribbon-outline" label="Certifications" route={FREIGHT_ROUTES.carrierCertifications} />
          <QuickLink icon="shield-outline" label="Insurance" route={FREIGHT_ROUTES.insurance} />
          <QuickLink icon="shield-checkmark-outline" label="Safety" route={FREIGHT_ROUTES.safety} />
          <QuickLink icon="reader-outline" label="Legal" route={FREIGHT_ROUTES.legal} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Next Actions</Text>

          <ActionRow
            label="Legal records accepted"
            complete={review.legalAccepted}
            route={FREIGHT_ROUTES.legal}
          />
          <ActionRow
            label="Safety profile complete"
            complete={review.safetyComplete}
            route={FREIGHT_ROUTES.safety}
          />
          <ActionRow
            label="Required documents uploaded"
            complete={review.missing.length === 0}
            route={FREIGHT_ROUTES.businessDocuments}
          />
          <ActionRow
            label="No rejected documents"
            complete={review.rejected.length === 0}
            route={FREIGHT_ROUTES.businessDocuments}
          />
        </View>

        {review.missing.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Missing Required Items</Text>

            {review.missing.map((item) => (
              <View key={item} style={styles.missingRow}>
                <Ionicons name="alert-circle-outline" size={20} color={COLORS.amber} />
                <Text style={styles.missingText}>{item.replace(/_/g, " ")}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.sectionTitle}>Pending / Rejected Review Items</Text>

        <FlatList
          data={[...review.rejected, ...review.pending]}
          keyExtractor={(item, index) => String(item.id || index)}
          scrollEnabled={false}
          renderItem={renderDocument}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Ionicons name="checkmark-circle-outline" size={38} color={COLORS.green} />
              <Text style={styles.emptyTitle}>No pending or rejected items.</Text>
              <Text style={styles.emptyText}>
                Your review items are either approved or not yet submitted.
              </Text>
            </View>
          }
        />

        <TouchableOpacity style={styles.primaryButton} onPress={() => goTo(FREIGHT_ROUTES.complianceVault)}>
          <Ionicons name="lock-closed-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryText}>Open Compliance Vault</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.darkButton} onPress={() => goTo(FREIGHT_ROUTES.managementCenter)}>
          <Ionicons name="apps-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryText}>Management Center</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function ActionRow({
  label,
  complete,
  route,
}: {
  label: string;
  complete: boolean;
  route: string;
}) {
  return (
    <TouchableOpacity style={styles.actionRow} onPress={() => goTo(route)}>
      <Ionicons
        name={complete ? "checkmark-circle" : "alert-circle-outline"}
        size={21}
        color={complete ? COLORS.green : COLORS.amber}
      />
      <Text style={styles.actionText}>{label}</Text>
      <Text style={[styles.actionStatus, { color: complete ? COLORS.green : COLORS.amber }]}>
        {complete ? "Complete" : "Needed"}
      </Text>
    </TouchableOpacity>
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
  statusCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 22,
    marginHorizontal: 18,
    marginTop: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statusLabel: { color: COLORS.muted, fontWeight: "900", textTransform: "uppercase" },
  statusValue: { fontSize: 36, fontWeight: "900", marginTop: 6 },
  statusSub: { color: COLORS.text, fontWeight: "800", marginTop: 6 },
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
  actionRow: {
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
  actionText: { color: COLORS.text, fontWeight: "900", flex: 1 },
  actionStatus: { fontWeight: "900" },
  missingRow: {
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
  missingText: { color: COLORS.text, fontWeight: "900", textTransform: "capitalize" },
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
  },
  documentTop: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  documentIcon: {
    width: 46,
    height: 46,
    borderRadius: 18,
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
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    maxWidth: 120,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "capitalize",
  },
  reviewNotes: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 13,
    marginTop: 12,
  },
  reviewNotesTitle: { color: COLORS.text, fontWeight: "900", marginBottom: 4 },
  reviewNotesText: { color: COLORS.muted, fontWeight: "700", lineHeight: 20 },
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