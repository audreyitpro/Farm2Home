// app/admin/verification-records.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
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

import { supabase } from "../services/supabaseClient";

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

type VerificationRow = {
  id: string;
  account_type?: string | null;
  business_name?: string | null;
  owner_name?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  farmer_id?: string | null;
  freight_id?: string | null;
  created_at?: string | null;
};

type DocumentRow = {
  id: string;
  verification_id?: string | null;
  business_id?: string | null;
  document_type?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type VerificationCard = VerificationRow & {
  documentCount: number;
  approvedDocs: number;
  pendingDocs: number;
};

export default function AdminVerificationRecords() {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<VerificationCard[]>([]);
  const [search, setSearch] = useState("");

  useFocusEffect(
    useCallback(() => {
      loadRecords();
    }, [])
  );

  async function loadRecords() {
    try {
      setLoading(true);

      const { data: verificationData } = await supabase
        .from("verification_records")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      const { data: adminVerificationData } = await supabase
        .from("admin_verifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      const { data: adminDocs } = await supabase
        .from("admin_verification_documents")
        .select("*");

      const { data: businessDocs } = await supabase
        .from("business_documents")
        .select("*");

      const cleanRecords = [
        ...(Array.isArray(verificationData)
          ? (verificationData as VerificationRow[])
          : []),
        ...(Array.isArray(adminVerificationData)
          ? (adminVerificationData as VerificationRow[])
          : []),
      ];

      const docs: DocumentRow[] = [
        ...(Array.isArray(adminDocs) ? (adminDocs as DocumentRow[]) : []),
        ...(Array.isArray(businessDocs) ? (businessDocs as DocumentRow[]) : []),
      ];

      const uniqueMap = new Map<string, VerificationRow>();

      cleanRecords.forEach((record) => {
        uniqueMap.set(String(record.id), record);
      });

      const mapped: VerificationCard[] = Array.from(uniqueMap.values()).map(
        (record) => {
          const relatedDocs = docs.filter(
            (doc) =>
              String(doc.verification_id || "") === String(record.id) ||
              String(doc.business_id || "") === String(record.farmer_id || "") ||
              String(doc.business_id || "") === String(record.freight_id || "")
          );

          return {
            ...record,
            documentCount: relatedDocs.length,
            approvedDocs: relatedDocs.filter((doc) =>
              ["APPROVED", "approved"].includes(String(doc.status || ""))
            ).length,
            pendingDocs: relatedDocs.filter((doc) =>
              ["PENDING", "pending", "REVIEW", "review"].includes(
                String(doc.status || "")
              )
            ).length,
          };
        }
      );

      setRecords(mapped);
    } catch (error: any) {
      Alert.alert(
        "Verification Error",
        error?.message || "Unable to load verification records."
      );
    } finally {
      setLoading(false);
    }
  }

  const filteredRecords = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return records;

    return records.filter((record) =>
      [
        record.id,
        record.account_type,
        record.business_name,
        record.owner_name,
        record.email,
        record.phone,
        record.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [records, search]);

  const stats = useMemo(() => {
    const pending = records.filter((record) =>
      [
        "PENDING",
        "PENDING_VERIFICATION",
        "DOCUMENTS_SUBMITTED",
        "PENDING_ADMIN_REVIEW",
        "pending",
        "pending_verification",
        "documents_submitted",
        "pending_admin_review",
      ].includes(String(record.status || ""))
    ).length;

    const approved = records.filter((record) =>
      ["APPROVED", "approved", "ACTIVE", "active"].includes(
        String(record.status || "")
      )
    ).length;

    const rejected = records.filter((record) =>
      ["REJECTED", "rejected", "DENIED", "denied"].includes(
        String(record.status || "")
      )
    ).length;

    const docs = records.reduce((sum, record) => sum + record.documentCount, 0);

    return {
      total: records.length,
      pending,
      approved,
      rejected,
      documents: docs,
    };
  }, [records]);

  async function updateStatus(id: string, status: string) {
    try {
      const { error } = await supabase
        .from("verification_records")
        .update({ status })
        .eq("id", id);

      if (error) {
        console.log("Verification status update error:", error.message);
      }

      setRecords((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status } : item))
      );
    } catch (error: any) {
      Alert.alert(
        "Update Error",
        error?.message || "Unable to update verification status."
      );
    }
  }

  function getStatusColor(status?: string | null) {
    const value = String(status || "").toLowerCase();

    if (["approved", "active"].includes(value)) return ui.green;
    if (
      [
        "pending",
        "pending_verification",
        "documents_submitted",
        "pending_admin_review",
        "review",
      ].includes(value)
    ) {
      return ui.orange;
    }
    if (["rejected", "denied", "suspended"].includes(value)) return ui.red;
    return ui.blue;
  }

  function renderBadge(status?: string | null) {
    return (
      <View style={[styles.badge, { backgroundColor: getStatusColor(status) }]}>
        <Text style={styles.badgeText}>{status || "UNKNOWN"}</Text>
      </View>
    );
  }

  function formatDate(value?: string | null) {
    if (!value) return "Unknown date";
    try {
      return new Date(value).toLocaleString();
    } catch {
      return "Unknown date";
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <StatusBar barStyle="dark-content" backgroundColor={ui.bg} />
        <ActivityIndicator size="large" color={ui.primary} />
        <Text style={styles.loadingText}>Loading verification records...</Text>
      </SafeAreaView>
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
              <Text style={styles.logoSub}>Verification Records</Text>
            </View>
          </View>

          <NavButton label="Dashboard" icon="grid-outline" route="/admin/dashboard" />
          <NavButton label="Control Tower" icon="radio-outline" route="/admin/control-tower" />
          <NavButton label="Documents" icon="document-text-outline" route="/admin/documents" />
          <NavButton label="Verification" icon="shield-checkmark-outline" route="/admin/verification-records" active />
          <NavButton label="Farmers" icon="leaf-outline" route="/admin/farmers" />
          <NavButton label="Carriers" icon="business-outline" route="/admin/freight-carriers" />
        </View>

        <View style={styles.main}>
          <View style={styles.topbar}>
            <View>
              <Text style={styles.welcome}>Farm2Home Compliance</Text>
              <Text style={styles.pageTitle}>Verification Records</Text>
              <Text style={styles.pageSub}>
                Review farmer and freight carrier compliance history, documents, and status.
              </Text>
            </View>

            <TouchableOpacity style={styles.refreshPill} onPress={loadRecords}>
              <Ionicons name="refresh-outline" size={18} color={ui.primary} />
              <Text style={styles.refreshPillText}>Refresh</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.statsGrid}>
              <StatCard label="Total Records" value={String(stats.total)} icon="shield-checkmark-outline" accent />
              <StatCard label="Pending" value={String(stats.pending)} icon="time-outline" warning />
              <StatCard label="Approved" value={String(stats.approved)} icon="checkmark-circle-outline" success />
              <StatCard label="Rejected" value={String(stats.rejected)} icon="close-circle-outline" danger />
              <StatCard label="Documents" value={String(stats.documents)} icon="document-text-outline" />
            </View>

            <View style={styles.searchCard}>
              <Ionicons name="search-outline" size={20} color={ui.primary} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search business, owner, email, account type, status..."
                placeholderTextColor={ui.muted}
                style={styles.searchInput}
              />
            </View>

            <View style={styles.dataSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Verification Directory</Text>
                <Text style={styles.sectionLink}>{filteredRecords.length} records</Text>
              </View>

              <FlatList
                data={filteredRecords}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                contentContainerStyle={{ paddingBottom: 80 }}
                ListEmptyComponent={
                  <EmptyCard
                    title="No verification records found."
                    text="Farmer and freight carrier verification records will appear here."
                  />
                }
                renderItem={({ item }) => (
                  <View style={styles.row}>
                    <View style={styles.avatar}>
                      <Ionicons name="shield-checkmark-outline" size={22} color={ui.primary} />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>
                        {item.business_name || "Verification Applicant"}
                      </Text>
                      <Text style={styles.meta}>
                        Type: {item.account_type || "Business"} • Owner:{" "}
                        {item.owner_name || "Not provided"}
                      </Text>
                      <Text style={styles.meta}>
                        {item.email || "No email"} • {item.phone || "No phone"}
                      </Text>
                      <Text style={styles.meta}>
                        Docs: {item.documentCount} • Approved: {item.approvedDocs} • Pending:{" "}
                        {item.pendingDocs}
                      </Text>
                      <Text style={styles.meta}>
                        Created: {formatDate(item.created_at)}
                      </Text>
                    </View>

                    <View style={styles.rightCol}>
                      {renderBadge(item.status)}

                      <TouchableOpacity
                        style={styles.viewButton}
                        onPress={() => router.push("/admin/documents" as any)}
                      >
                        <Text style={styles.viewButtonText}>Docs</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.approveButton}
                        onPress={() => updateStatus(item.id, "APPROVED")}
                      >
                        <Text style={styles.approveButtonText}>Approve</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.rejectButton}
                        onPress={() => updateStatus(item.id, "REJECTED")}
                      >
                        <Text style={styles.rejectButtonText}>Reject</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              />
            </View>
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

function StatCard({
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
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function EmptyCard({ title, text }: { title: string; text?: string }) {
  return (
    <View style={styles.emptyCard}>
      <Ionicons name="shield-checkmark-outline" size={30} color={ui.primary} />
      <Text style={styles.emptyTitle}>{title}</Text>
      {!!text && <Text style={styles.emptyText}>{text}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: ui.bg },
  loadingScreen: {
    flex: 1,
    backgroundColor: ui.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: { color: ui.muted, marginTop: 10, fontWeight: "800" },
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
  pageSub: { color: ui.muted, marginTop: 4, fontWeight: "700", maxWidth: 720 },
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
  statCard: {
    width: "48%",
    backgroundColor: ui.card,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: ui.border,
  },
  statIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  statValue: { color: ui.text, fontSize: 22, fontWeight: "900" },
  statLabel: { color: ui.muted, fontWeight: "800", marginTop: 4 },
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
    marginBottom: 14,
  },
  searchInput: { flex: 1, color: ui.text, fontWeight: "800" },
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
  sectionTitle: { color: ui.text, fontSize: 19, fontWeight: "900" },
  sectionLink: { color: ui.primary, fontWeight: "900", fontSize: 12 },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: ui.border,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 18,
    backgroundColor: ui.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { color: ui.text, fontWeight: "900", fontSize: 16 },
  meta: {
    color: ui.muted,
    fontWeight: "700",
    marginTop: 4,
    lineHeight: 18,
    fontSize: 12,
  },
  rightCol: { alignItems: "flex-end", gap: 8 },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: 150,
  },
  badgeText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 10,
    textTransform: "uppercase",
    textAlign: "center",
  },
  viewButton: {
    backgroundColor: ui.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  viewButtonText: { color: ui.primary, fontWeight: "900", fontSize: 12 },
  approveButton: {
    backgroundColor: "#DCFCE7",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  approveButtonText: { color: ui.green, fontWeight: "900", fontSize: 12 },
  rejectButton: {
    backgroundColor: "#FEE2E2",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  rejectButtonText: { color: ui.red, fontWeight: "900", fontSize: 12 },
  emptyCard: {
    borderTopWidth: 1,
    borderTopColor: ui.border,
    padding: 18,
    alignItems: "center",
  },
  emptyTitle: {
    color: ui.text,
    fontWeight: "900",
    fontSize: 17,
    marginTop: 8,
    textAlign: "center",
  },
  emptyText: {
    color: ui.muted,
    fontWeight: "700",
    lineHeight: 21,
    textAlign: "center",
    marginTop: 5,
  },
});