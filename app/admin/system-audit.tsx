// app/admin/system-audit.tsx

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
  actor?: string | null;
  target_id?: string | null;
  created_at?: string | null;
};

export default function AdminSystemAudit() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<AuditItem[]>([]);
  const [search, setSearch] = useState("");

  useFocusEffect(
    useCallback(() => {
      loadAudit();
    }, [])
  );

  async function safeRead(table: string) {
    try {
      const { data } = await supabase
        .from(table)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  async function loadAudit() {
    try {
      setLoading(true);

      const [
        auditLogs,
        adminActions,
        farmers,
        carriers,
        drivers,
        orders,
        alerts,
        payouts,
      ] = await Promise.all([
        safeRead("audit_logs"),
        safeRead("admin_actions"),
        safeRead("farmers"),
        safeRead("freight_carriers"),
        safeRead("drivers"),
        safeRead("orders"),
        safeRead("admin_alerts"),
        safeRead("marketplace_payouts"),
      ]);

      const rows: AuditItem[] = [];

      auditLogs.forEach((x: any) =>
        rows.push({
          id: `audit_${x.id}`,
          type: "Audit Log",
          title: x.title || x.action || "System Audit Event",
          message: x.message || x.description || x.status || "Audit record created.",
          status: x.status || "LOGGED",
          actor: x.actor || x.admin_email || x.user_email,
          target_id: x.target_id || x.record_id,
          created_at: x.created_at,
        })
      );

      adminActions.forEach((x: any) =>
        rows.push({
          id: `action_${x.id}`,
          type: "Admin Action",
          title: x.action || x.title || "Admin Action",
          message: x.message || x.notes || "Admin action recorded.",
          status: x.status || "ACTION",
          actor: x.admin_email || x.actor,
          target_id: x.target_id || x.record_id,
          created_at: x.created_at,
        })
      );

      farmers.forEach((x: any) =>
        rows.push({
          id: `farmer_${x.id}`,
          type: "Farmer Record",
          title: x.farm_name || "Farmer Account",
          message: `Farmer status: ${x.status || "unknown"}`,
          status: x.status || "UNKNOWN",
          actor: x.email,
          target_id: x.id,
          created_at: x.created_at,
        })
      );

      carriers.forEach((x: any) =>
        rows.push({
          id: `carrier_${x.id}`,
          type: "Carrier Record",
          title: x.company_name || "Freight Carrier",
          message: `Carrier status: ${x.status || "unknown"}`,
          status: x.status || "UNKNOWN",
          actor: x.email,
          target_id: x.id,
          created_at: x.created_at,
        })
      );

      drivers.forEach((x: any) =>
        rows.push({
          id: `driver_${x.id}`,
          type: "Driver Record",
          title: x.full_name || x.name || "Driver Account",
          message: `Driver status: ${x.status || "unknown"}`,
          status: x.status || "UNKNOWN",
          actor: x.email,
          target_id: x.id,
          created_at: x.created_at,
        })
      );

      orders.forEach((x: any) =>
        rows.push({
          id: `order_${x.id}`,
          type: "Order Status",
          title: `Order #${String(x.id).slice(-6)}`,
          message: `Order status: ${x.status || "unknown"}`,
          status: x.status || "UNKNOWN",
          target_id: x.id,
          created_at: x.created_at,
        })
      );

      alerts.forEach((x: any) =>
        rows.push({
          id: `alert_${x.id}`,
          type: "Admin Alert",
          title: x.title || x.alert_type || "Admin Alert",
          message: x.message || "Alert created.",
          status: x.status || x.risk_level || "OPEN",
          target_id: x.load_id,
          created_at: x.created_at,
        })
      );

      payouts.forEach((x: any) =>
        rows.push({
          id: `payout_${x.id}`,
          type: "Payout Review",
          title: `Payout #${String(x.id).slice(-6)}`,
          message: `Payout status: ${x.status || "unknown"}`,
          status: x.status || "UNKNOWN",
          target_id: x.order_id || x.farmer_id,
          created_at: x.created_at,
        })
      );

      rows.sort((a, b) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bTime - aTime;
      });

      setItems(rows);
    } catch (error: any) {
      Alert.alert("System Audit Error", error?.message || "Unable to load audit.");
    } finally {
      setLoading(false);
    }
  }

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;

    return items.filter((item) =>
      [
        item.id,
        item.type,
        item.title,
        item.message,
        item.status,
        item.actor,
        item.target_id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [items, search]);

  const stats = useMemo(() => ({
    total: items.length,
    admin: items.filter((x) => x.type.includes("Admin")).length,
    approvals: items.filter((x) =>
      ["approved", "rejected", "pending_admin_review"].includes(
        String(x.status || "").toLowerCase()
      )
    ).length,
    orders: items.filter((x) => x.type === "Order Status").length,
    payouts: items.filter((x) => x.type === "Payout Review").length,
    alerts: items.filter((x) => x.type === "Admin Alert").length,
  }), [items]);

  function getColor(item: AuditItem) {
    const value = String(item.status || "").toLowerCase();

    if (["approved", "active", "paid", "delivered", "resolved"].includes(value)) {
      return ui.green;
    }

    if (["pending", "review", "open", "warning", "pending_admin_review"].includes(value)) {
      return ui.orange;
    }

    if (["rejected", "failed", "cancelled", "canceled", "error"].includes(value)) {
      return ui.red;
    }

    if (item.type.includes("Payout")) return ui.green;
    if (item.type.includes("Alert")) return ui.orange;
    if (item.type.includes("Admin")) return ui.primary;

    return ui.blue;
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
        <Text style={styles.loadingText}>Loading system audit...</Text>
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
              <Text style={styles.logoSub}>System Audit</Text>
            </View>
          </View>

          <NavButton label="Dashboard" icon="grid-outline" route="/admin/dashboard" />
          <NavButton label="Control Tower" icon="radio-outline" route="/admin/control-tower" />
          <NavButton label="System Audit" icon="shield-checkmark-outline" route="/admin/system-audit" active />
          <NavButton label="Audit Log" icon="list-circle-outline" route="/admin/audit-log" />
          <NavButton label="Alerts" icon="warning-outline" route="/admin/alerts" />
          <NavButton label="Platform Health" icon="pulse-outline" route="/admin/platform-health" />
        </View>

        <View style={styles.main}>
          <View style={styles.topbar}>
            <View>
              <Text style={styles.welcome}>Farm2Home Admin Security</Text>
              <Text style={styles.pageTitle}>System Audit</Text>
              <Text style={styles.pageSub}>
                Review admin actions, approvals, order changes, payouts, alerts, and security events.
              </Text>
            </View>

            <TouchableOpacity style={styles.refreshPill} onPress={loadAudit}>
              <Ionicons name="refresh-outline" size={18} color={ui.primary} />
              <Text style={styles.refreshPillText}>Refresh</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.statsGrid}>
              <StatCard label="Total Events" value={String(stats.total)} icon="list-outline" accent />
              <StatCard label="Admin Events" value={String(stats.admin)} icon="person-circle-outline" />
              <StatCard label="Approvals" value={String(stats.approvals)} icon="checkmark-circle-outline" success />
              <StatCard label="Order Events" value={String(stats.orders)} icon="receipt-outline" />
              <StatCard label="Payout Events" value={String(stats.payouts)} icon="cash-outline" success />
              <StatCard label="Alerts" value={String(stats.alerts)} icon="warning-outline" warning />
            </View>

            <View style={styles.searchCard}>
              <Ionicons name="search-outline" size={20} color={ui.primary} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search audit events, status, actor, target..."
                placeholderTextColor={ui.muted}
                style={styles.searchInput}
              />
            </View>

            <View style={styles.dataSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>System Audit Trail</Text>
                <Text style={styles.sectionLink}>{filteredItems.length} records</Text>
              </View>

              <FlatList
                data={filteredItems}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                contentContainerStyle={{ paddingBottom: 80 }}
                ListEmptyComponent={
                  <EmptyCard
                    title="No audit events found."
                    text="System events will appear as users and admins use the platform."
                  />
                }
                renderItem={({ item }) => {
                  const color = getColor(item);

                  return (
                    <View style={styles.row}>
                      <View style={[styles.avatar, { backgroundColor: `${color}18` }]}>
                        <Ionicons name="shield-checkmark-outline" size={22} color={color} />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={styles.name}>{item.title}</Text>
                        <Text style={styles.meta}>Type: {item.type}</Text>
                        <Text style={styles.message}>{item.message}</Text>
                        <Text style={styles.meta}>
                          Actor: {item.actor || "System"} • Target: {item.target_id || "N/A"}
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
                              `${item.message}\n\nType: ${item.type}\nStatus: ${
                                item.status
                              }\nActor: ${item.actor || "System"}\nCreated: ${formatDate(
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
  success = false,
  warning = false,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent?: boolean;
  success?: boolean;
  warning?: boolean;
}) {
  const color = warning ? ui.orange : success ? ui.green : accent ? ui.primary : ui.blue;

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
  pageSub: { color: ui.muted, marginTop: 4, fontWeight: "700", maxWidth: 760 },
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