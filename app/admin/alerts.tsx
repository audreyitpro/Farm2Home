// app/admin/alerts.tsx

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

type AdminAlertRow = {
  id: string;
  alert_type?: string | null;
  load_id?: string | null;
  title?: string | null;
  message?: string | null;
  risk_level?: string | null;
  score?: number | null;
  status?: string | null;
  metadata?: any;
  created_at?: string | null;
};

export default function AdminAlerts() {
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<AdminAlertRow[]>([]);
  const [search, setSearch] = useState("");

  useFocusEffect(
    useCallback(() => {
      loadAlerts();
    }, [])
  );

  async function loadAlerts() {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("admin_alerts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;

      setAlerts(Array.isArray(data) ? (data as AdminAlertRow[]) : []);
    } catch (error: any) {
      Alert.alert("Alerts Error", error?.message || "Unable to load alerts.");
    } finally {
      setLoading(false);
    }
  }

  const filteredAlerts = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return alerts;

    return alerts.filter((item) =>
      [
        item.id,
        item.alert_type,
        item.load_id,
        item.title,
        item.message,
        item.risk_level,
        item.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [alerts, search]);

  const stats = useMemo(() => {
    const open = alerts.filter((x) =>
      ["OPEN", "open", "NEW", "new"].includes(String(x.status || ""))
    ).length;

    const resolved = alerts.filter((x) =>
      ["RESOLVED", "resolved", "CLOSED", "closed"].includes(String(x.status || ""))
    ).length;

    const highRisk = alerts.filter((x) =>
      ["HIGH", "High", "CRITICAL", "Critical"].includes(String(x.risk_level || ""))
    ).length;

    const dispatch = alerts.filter((x) =>
      String(x.alert_type || "").toLowerCase().includes("dispatch")
    ).length;

    return {
      total: alerts.length,
      open,
      resolved,
      highRisk,
      dispatch,
    };
  }, [alerts]);

  async function updateAlertStatus(alertId: string, nextStatus: string) {
    try {
      const { error } = await supabase
        .from("admin_alerts")
        .update({ status: nextStatus })
        .eq("id", alertId);

      if (error) throw error;

      setAlerts((prev) =>
        prev.map((item) =>
          item.id === alertId ? { ...item, status: nextStatus } : item
        )
      );
    } catch (error: any) {
      Alert.alert(
        "Update Failed",
        error?.message || "Unable to update alert status."
      );
    }
  }

  function getRiskColor(risk?: string | null) {
    const value = String(risk || "").toLowerCase();

    if (value.includes("critical")) return ui.red;
    if (value.includes("high")) return ui.orange;
    if (value.includes("medium")) return ui.blue;
    if (value.includes("low")) return ui.green;

    return ui.primary;
  }

  function getStatusColor(status?: string | null) {
    const value = String(status || "").toLowerCase();

    if (["resolved", "closed", "complete"].includes(value)) return ui.green;
    if (["open", "new"].includes(value)) return ui.orange;
    if (["dismissed", "cancelled"].includes(value)) return ui.red;

    return ui.blue;
  }

  function renderBadge(label?: string | null, color?: string) {
    return (
      <View style={[styles.badge, { backgroundColor: color || ui.blue }]}>
        <Text style={styles.badgeText}>{label || "UNKNOWN"}</Text>
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
        <Text style={styles.loadingText}>Loading admin alerts...</Text>
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
              <Text style={styles.logoSub}>Alert Center</Text>
            </View>
          </View>

          <NavButton label="Dashboard" icon="grid-outline" route="/admin/dashboard" />
          <NavButton label="Control Tower" icon="radio-outline" route="/admin/control-tower" />
          <NavButton label="Alerts" icon="warning-outline" route="/admin/alerts" active />
          <NavButton label="Live Ops" icon="navigate-outline" route="/admin/live-operations-center" />
          <NavButton label="Analytics" icon="analytics-outline" route="/admin/analytics-center" />
          <NavButton label="AI Dispatch" icon="sparkles-outline" route="/ai/dispatch-intelligence-center" />
        </View>

        <View style={styles.main}>
          <View style={styles.topbar}>
            <View>
              <Text style={styles.welcome}>Farm2Home Admin</Text>
              <Text style={styles.pageTitle}>Alert Center</Text>
              <Text style={styles.pageSub}>
                Review dispatch, freight, compliance, and live operations alerts.
              </Text>
            </View>

            <TouchableOpacity style={styles.refreshPill} onPress={loadAlerts}>
              <Ionicons name="refresh-outline" size={18} color={ui.primary} />
              <Text style={styles.refreshPillText}>Refresh</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.statsGrid}>
              <StatCard label="Total Alerts" value={String(stats.total)} icon="warning-outline" accent />
              <StatCard label="Open" value={String(stats.open)} icon="alert-circle-outline" warning />
              <StatCard label="Resolved" value={String(stats.resolved)} icon="checkmark-circle-outline" success />
              <StatCard label="High Risk" value={String(stats.highRisk)} icon="flame-outline" danger />
              <StatCard label="Dispatch Alerts" value={String(stats.dispatch)} icon="sparkles-outline" />
            </View>

            <View style={styles.searchCard}>
              <Ionicons name="search-outline" size={20} color={ui.primary} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search alert type, title, load ID, status..."
                placeholderTextColor={ui.muted}
                style={styles.searchInput}
              />
            </View>

            <View style={styles.dataSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Alert Directory</Text>
                <Text style={styles.sectionLink}>{filteredAlerts.length} records</Text>
              </View>

              <FlatList
                data={filteredAlerts}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                contentContainerStyle={{ paddingBottom: 80 }}
                ListEmptyComponent={
                  <EmptyCard
                    title="No alerts found."
                    text="Dispatch AI and operations alerts will appear here."
                  />
                }
                renderItem={({ item }) => (
                  <View style={styles.row}>
                    <View style={styles.avatar}>
                      <Ionicons name="warning-outline" size={22} color={ui.primary} />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{item.title || "Admin Alert"}</Text>
                      <Text style={styles.meta}>
                        Type: {item.alert_type || "General"} • Load:{" "}
                        {item.load_id || "N/A"}
                      </Text>
                      <Text style={styles.message}>{item.message || "No message"}</Text>
                      <Text style={styles.meta}>
                        Score: {item.score ?? "N/A"} • Created:{" "}
                        {formatDate(item.created_at)}
                      </Text>
                    </View>

                    <View style={styles.rightCol}>
                      {renderBadge(item.risk_level, getRiskColor(item.risk_level))}
                      {renderBadge(item.status, getStatusColor(item.status))}

                      <TouchableOpacity
                        style={styles.viewButton}
                        onPress={() => updateAlertStatus(item.id, "RESOLVED")}
                      >
                        <Text style={styles.viewButtonText}>Resolve</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.mutedButton}
                        onPress={() => updateAlertStatus(item.id, "DISMISSED")}
                      >
                        <Text style={styles.mutedButtonText}>Dismiss</Text>
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
      <Ionicons name="warning-outline" size={30} color={ui.primary} />
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
    backgroundColor: ui.primary,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  viewButtonText: { color: "#FFFFFF", fontWeight: "900", fontSize: 12 },
  mutedButton: {
    backgroundColor: ui.soft,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: ui.border,
  },
  mutedButtonText: {
    color: ui.muted,
    fontWeight: "900",
    fontSize: 12,
  },
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