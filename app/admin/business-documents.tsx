// app/admin/business-documents.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
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

type BusinessDocument = {
  id: string;
  business_id?: string | null;
  verification_id?: string | null;
  farmer_id?: string | null;
  freight_id?: string | null;
  account_type?: string | null;
  business_name?: string | null;
  document_type?: string | null;
  file_name?: string | null;
  file_url?: string | null;
  url?: string | null;
  status?: string | null;
  created_at?: string | null;
};

type VerificationRecord = {
  id: string;
  business_name?: string | null;
  owner_name?: string | null;
  account_type?: string | null;
  status?: string | null;
};

export default function AdminBusinessDocuments() {
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<BusinessDocument[]>([]);
  const [verifications, setVerifications] = useState<VerificationRecord[]>([]);
  const [search, setSearch] = useState("");

  useFocusEffect(
    useCallback(() => {
      loadDocuments();
    }, [])
  );

  async function loadDocuments() {
    try {
      setLoading(true);

      const { data: businessDocs } = await supabase
        .from("business_documents")
        .select("*")
        .order("created_at", { ascending: false });

      const { data: adminDocs } = await supabase
        .from("admin_verification_documents")
        .select("*")
        .order("created_at", { ascending: false });

      const { data: verificationData } = await supabase
        .from("verification_records")
        .select("id, business_name, owner_name, account_type, status");

      const allDocs = [
        ...(Array.isArray(businessDocs) ? businessDocs : []),
        ...(Array.isArray(adminDocs) ? adminDocs : []),
      ] as BusinessDocument[];

      setDocuments(allDocs);
      setVerifications(
        Array.isArray(verificationData)
          ? (verificationData as VerificationRecord[])
          : []
      );
    } catch (error: any) {
      Alert.alert(
        "Documents Error",
        error?.message || "Unable to load business documents."
      );
    } finally {
      setLoading(false);
    }
  }

  const enrichedDocuments = useMemo(() => {
    return documents.map((doc) => {
      const record = verifications.find(
        (item) =>
          String(item.id) === String(doc.verification_id) ||
          String(item.id) === String(doc.business_id)
      );

      return {
        ...doc,
        business_name: doc.business_name || record?.business_name || "Business",
        account_type: doc.account_type || record?.account_type || "Business",
      };
    });
  }, [documents, verifications]);

  const filteredDocuments = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return enrichedDocuments;

    return enrichedDocuments.filter((doc) =>
      [
        doc.id,
        doc.business_name,
        doc.account_type,
        doc.document_type,
        doc.file_name,
        doc.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [enrichedDocuments, search]);

  const stats = useMemo(() => {
    const approved = enrichedDocuments.filter((doc) =>
      ["APPROVED", "approved"].includes(String(doc.status || ""))
    ).length;

    const pending = enrichedDocuments.filter((doc) =>
      ["PENDING", "pending", "REVIEW", "review", "SUBMITTED", "submitted"].includes(
        String(doc.status || "")
      )
    ).length;

    const rejected = enrichedDocuments.filter((doc) =>
      ["REJECTED", "rejected", "DENIED", "denied"].includes(String(doc.status || ""))
    ).length;

    return {
      total: enrichedDocuments.length,
      approved,
      pending,
      rejected,
      farmers: enrichedDocuments.filter((doc) =>
        String(doc.account_type || "").toLowerCase().includes("farmer")
      ).length,
      freight: enrichedDocuments.filter((doc) =>
        String(doc.account_type || "").toLowerCase().includes("freight")
      ).length,
    };
  }, [enrichedDocuments]);

  async function updateDocumentStatus(id: string, status: string) {
    try {
      const { error: businessError } = await supabase
        .from("business_documents")
        .update({ status })
        .eq("id", id);

      if (businessError) {
        await supabase
          .from("admin_verification_documents")
          .update({ status })
          .eq("id", id);
      }

      setDocuments((prev) =>
        prev.map((doc) => (doc.id === id ? { ...doc, status } : doc))
      );
    } catch (error: any) {
      Alert.alert(
        "Update Error",
        error?.message || "Unable to update document status."
      );
    }
  }

  async function openDocument(url?: string | null) {
    if (!url) {
      Alert.alert("No Document URL", "This record does not have a file URL.");
      return;
    }

    const canOpen = await Linking.canOpenURL(url);

    if (!canOpen) {
      Alert.alert("Open Failed", "Unable to open this document link.");
      return;
    }

    await Linking.openURL(url);
  }

  function getStatusColor(status?: string | null) {
    const value = String(status || "").toLowerCase();

    if (["approved", "active"].includes(value)) return ui.green;
    if (["pending", "review", "submitted"].includes(value)) return ui.orange;
    if (["rejected", "denied"].includes(value)) return ui.red;

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
        <Text style={styles.loadingText}>Loading business documents...</Text>
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
              <Text style={styles.logoSub}>Business Documents</Text>
            </View>
          </View>

          <NavButton label="Dashboard" icon="grid-outline" route="/admin/dashboard" />
          <NavButton label="Documents" icon="document-text-outline" route="/admin/business-documents" active />
          <NavButton label="Verification" icon="shield-checkmark-outline" route="/admin/verification-records" />
          <NavButton label="Farmers" icon="leaf-outline" route="/admin/farmers" />
          <NavButton label="Carriers" icon="business-outline" route="/admin/freight-carriers" />
          <NavButton label="Audit Log" icon="list-circle-outline" route="/admin/audit-log" />
        </View>

        <View style={styles.main}>
          <View style={styles.topbar}>
            <View>
              <Text style={styles.welcome}>Farm2Home Compliance</Text>
              <Text style={styles.pageTitle}>Business Documents</Text>
              <Text style={styles.pageSub}>
                Review farmer and freight carrier uploaded documents, approvals, and rejected files.
              </Text>
            </View>

            <TouchableOpacity style={styles.refreshPill} onPress={loadDocuments}>
              <Ionicons name="refresh-outline" size={18} color={ui.primary} />
              <Text style={styles.refreshPillText}>Refresh</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.statsGrid}>
              <StatCard label="Total Documents" value={String(stats.total)} icon="document-text-outline" accent />
              <StatCard label="Approved" value={String(stats.approved)} icon="checkmark-circle-outline" success />
              <StatCard label="Pending Review" value={String(stats.pending)} icon="time-outline" warning />
              <StatCard label="Rejected" value={String(stats.rejected)} icon="close-circle-outline" danger />
              <StatCard label="Farmer Docs" value={String(stats.farmers)} icon="leaf-outline" success />
              <StatCard label="Freight Docs" value={String(stats.freight)} icon="business-outline" />
            </View>

            <View style={styles.searchCard}>
              <Ionicons name="search-outline" size={20} color={ui.primary} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search document, business, type, status..."
                placeholderTextColor={ui.muted}
                style={styles.searchInput}
              />
            </View>

            <View style={styles.dataSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Document Directory</Text>
                <Text style={styles.sectionLink}>{filteredDocuments.length} records</Text>
              </View>

              <FlatList
                data={filteredDocuments}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                contentContainerStyle={{ paddingBottom: 80 }}
                ListEmptyComponent={
                  <EmptyCard
                    title="No business documents found."
                    text="Uploaded farmer and freight compliance documents will appear here."
                  />
                }
                renderItem={({ item }) => {
                  const fileUrl = item.file_url || item.url;

                  return (
                    <View style={styles.row}>
                      <View style={styles.avatar}>
                        <Ionicons name="document-text-outline" size={22} color={ui.primary} />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={styles.name}>
                          {item.document_type || item.file_name || "Business Document"}
                        </Text>
                        <Text style={styles.meta}>
                          Business: {item.business_name || "Unknown business"}
                        </Text>
                        <Text style={styles.meta}>
                          Type: {item.account_type || "Business"} • File:{" "}
                          {item.file_name || "Uploaded file"}
                        </Text>
                        <Text style={styles.meta}>
                          Created: {formatDate(item.created_at)}
                        </Text>
                      </View>

                      <View style={styles.rightCol}>
                        {renderBadge(item.status)}

                        <TouchableOpacity
                          style={styles.viewButton}
                          onPress={() => openDocument(fileUrl)}
                        >
                          <Text style={styles.viewButtonText}>Open</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.approveButton}
                          onPress={() => updateDocumentStatus(item.id, "APPROVED")}
                        >
                          <Text style={styles.approveButtonText}>Approve</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.rejectButton}
                          onPress={() => updateDocumentStatus(item.id, "REJECTED")}
                        >
                          <Text style={styles.rejectButtonText}>Reject</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                }}
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
      <Ionicons name="document-text-outline" size={30} color={ui.primary} />
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