// app/admin/audit-log.tsx

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

type AuditItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  status: string;
  created_at?: string | null;
};

export default function AdminAuditLog() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<AuditItem[]>([]);
  const [search, setSearch] = useState("");

  useFocusEffect(
    useCallback(() => {
      loadAuditLog();
    }, [])
  );

  async function loadAuditLog() {
    try {
      setLoading(true);

      const { data: notes } = await supabase
        .from("admin_notes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      const { data: verifications } = await supabase
        .from("admin_verifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      const { data: alerts } = await supabase
        .from("admin_alerts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      const { data: records } = await supabase
        .from("verification_records")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      const auditItems: AuditItem[] = [];

      (Array.isArray(notes) ? notes : []).forEach((item: any) => {
        auditItems.push({
          id: `note_${item.id}`,
          type: "Admin Note",
          title: item.title || "Admin Note",
          message: item.note || item.message || "No note content.",
          status: item.status || "LOGGED",
          created_at: item.created_at,
        });
      });

      (Array.isArray(verifications) ? verifications : []).forEach((item: any) => {
        auditItems.push({
          id: `admin_verification_${item.id}`,
          type: "Admin Verification",
          title: item.business_name || item.farm_name || "Verification Review",
          message:
            item.notes ||
            item.message ||
            item.email ||
            "Admin verification record updated.",
          status: item.status || "REVIEW",
          created_at: item.created_at,
        });
      });

      (Array.isArray(alerts) ? alerts : []).forEach((item: any) => {
        auditItems.push({
          id: `alert_${item.id}`,
          type: "Admin Alert",
          title: item.title || item.alert_type || "Admin Alert",
          message: item.message || "Alert record created.",
          status: item.status || item.risk_level || "OPEN",
          created_at: item.created_at,
        });
      });

      (Array.isArray(records) ? records : []).forEach((item: any) => {
        auditItems.push({
          id: `verification_record_${item.id}`,
          type: "Verification Record",
          title: item.business_name || item.account_type || "Verification Record",
          message:
            item.email ||
            item.owner_name ||
            item.phone ||
            "Verification record changed.",
          status: item.status || "PENDING",
          created_at: item.created_at,
        });
      });

      auditItems.sort((a, b) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bTime - aTime;
      });

      setItems(auditItems);
    } catch (error: any) {
      Alert.alert("Audit Log Error", error?.message || "Unable to load audit log.");
    } finally {
      setLoading(false);
    }
  }

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;

    return items.filter((item) =>
      [item.type, item.title, item.message, item.status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [items, search]);

  const stats = useMemo(() => {
    return {
      total: items.length,
      notes: items.filter((x) => x.type === "Admin Note").length,
      verifications: items.filter(
        (x) => x.type === "Admin Verification" || x.type === "Verification Record"
      ).length,
      alerts: items.filter((x) => x.type === "Admin Alert").length,
      open: items.filter((x) =>
        ["OPEN", "PENDING", "REVIEW", "open", "pending", "review"].includes(x.status)
      ).length,
    };
  }, [items]);

  function getTypeColor(type: string) {
    if (type.includes("Alert")) return ui.orange;
    if (type.includes("Verification")) return ui.primary;
    if (type.includes("Note")) return ui.blue;
    return ui.green;
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
        <Text style={styles.loadingText}>Loading audit log...</Text>
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
              <Text style={styles.logoSub}>Audit Log</Text>
            </View>
          </View>

          <NavButton label="Dashboard" icon="grid-outline" route="/admin/dashboard" />
          <NavButton label="Control Tower" icon="radio-outline" route="/admin/control-tower" />
          <NavButton label="Documents" icon="document-text-outline" route="/admin/documents" />
          <NavButton label="Alerts" icon="warning-outline" route="/admin/alerts" />
          <NavButton label="Audit Log" icon="list-circle-outline" route="/admin/audit-log" active />
          <NavButton label="Settings" icon="settings-outline" route="/admin/settings" />
        </View>

        <View style={styles.main}>
          <View style={styles.topbar}>
            <View>
              <Text style={styles.welcome}>Farm2Home Admin Records</Text>
              <Text style={styles.pageTitle}>Audit Log</Text>
              <Text style={styles.pageSub}>
                Track admin notes, compliance changes, verification records, and alert activity.
              </Text>
            </View>

            <TouchableOpacity style={styles.refreshPill} onPress={loadAuditLog}>
              <Ionicons name="refresh-outline" size={18} color={ui.primary} />
              <Text style={styles.refreshPillText}>Refresh</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.statsGrid}>
              <StatCard label="Total Logs" value={String(stats.total)} icon="list-circle-outline" accent />
              <StatCard label="Admin Notes" value={String(stats.notes)} icon="create-outline" />
              <StatCard label="Verifications" value={String(stats.verifications)} icon="shield-checkmark-outline" accent />
              <StatCard label="Alerts" value={String(stats.alerts)} icon="warning-outline" warning />
              <StatCard label="Open Items" value={String(stats.open)} icon="alert-circle-outline" warning />
            </View>

            <View style={styles.searchCard}>
              <Ionicons name="search-outline" size={20} color={ui.primary} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search audit type, title, message, status..."
                placeholderTextColor={ui.muted}
                style={styles.searchInput}
              />
            </View>

            <View style={styles.dataSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Audit Trail</Text>
                <Text style={styles.sectionLink}>{filteredItems.length} records</Text>
              </View>

              <FlatList
                data={filteredItems}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                contentContainerStyle={{ paddingBottom: 80 }}
                ListEmptyComponent={
                  <EmptyCard
                    title="No audit records found."
                    text="Admin notes, alerts, and verification activity will appear here."
                  />
                }
                renderItem={({ item }) => {
                  const color = getTypeColor(item.type);

                  return (
                    <View style={styles.row}>
                      <View style={[styles.avatar, { backgroundColor: `${color}18` }]}>
                        <Ionicons name="document-text-outline" size={22} color={color} />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={styles.name}>{item.title}</Text>
                        <Text style={styles.meta}>Type: {item.type}</Text>
                        <Text style={styles.message} numberOfLines={3}>
                          {item.message}
                        </Text>
                        <Text style={styles.meta}>Created: {formatDate(item.created_at)}</Text>
                      </View>

                      <View style={styles.rightCol}>
                        <View style={[styles.badge, { backgroundColor: color }]}>
                          <Text style={styles.badgeText}>{item.status}</Text>
                        </View>

                        <TouchableOpacity
                          style={styles.viewButton}
                          onPress={() =>
                            Alert.alert(
                              item.title,
                              `${item.message}\n\nType: ${item.type}\nStatus: ${item.status}\nCreated: ${formatDate(
                                item.created_at
                              )}`
                            )
                          }
                        >
                          <Text style={styles.viewButtonText}>View</Text>
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
  warning = false,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent?: boolean;
  warning?: boolean;
}) {
  const color = warning ? ui.orange : accent ? ui.primary : ui.blue;

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
      <Ionicons name="list-circle-outline" size={30} color={ui.primary} />
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
  message: {
    color: ui.text,
    fontWeight: "700",
    marginTop: 6,
    lineHeight: 19,
    fontSize: 13,
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