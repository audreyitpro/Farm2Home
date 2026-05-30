// app/admin/platform-health.tsx

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
  TouchableOpacity,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../services/supabaseClient";

const API_BASE_URL = "https://farm2home-production-e4bd.up.railway.app";

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

type HealthItem = {
  id: string;
  name: string;
  status: "healthy" | "warning" | "error" | "checking";
  message: string;
};

export default function AdminPlatformHealth() {
  const [loading, setLoading] = useState(true);
  const [checks, setChecks] = useState<HealthItem[]>([]);

  useFocusEffect(
    useCallback(() => {
      runHealthChecks();
    }, [])
  );

  async function checkEndpoint(id: string, name: string, path: string): Promise<HealthItem> {
    try {
      const response = await fetch(`${API_BASE_URL}${path}`);
      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        return {
          id,
          name,
          status: "healthy",
          message: data?.message || data?.status || "Endpoint is responding.",
        };
      }

      return {
        id,
        name,
        status: "error",
        message: `HTTP ${response.status}`,
      };
    } catch {
      return {
        id,
        name,
        status: "error",
        message: "Endpoint is not reachable.",
      };
    }
  }

  async function checkTable(table: string): Promise<HealthItem> {
    try {
      const { error } = await supabase.from(table).select("*").limit(1);

      if (error) {
        return {
          id: table,
          name: table,
          status: "warning",
          message: error.message,
        };
      }

      return {
        id: table,
        name: table,
        status: "healthy",
        message: "Table is reachable.",
      };
    } catch {
      return {
        id: table,
        name: table,
        status: "error",
        message: "Unable to check table.",
      };
    }
  }

  async function runHealthChecks() {
    try {
      setLoading(true);

      const endpointChecks = await Promise.all([
        checkEndpoint("api_health", "Railway API Health", "/health"),
        checkEndpoint("payments_health", "Payments Health", "/payments/health"),
        checkEndpoint("driver_health", "Driver Routes Health", "/driver/health"),
      ]);

      const tableChecks = await Promise.all([
        checkTable("customers"),
        checkTable("farmers"),
        checkTable("orders"),
        checkTable("products"),
        checkTable("freight_loads"),
        checkTable("driver_locations"),
        checkTable("verification_records"),
        checkTable("admin_alerts"),
        checkTable("farmer_application_payments"),
        checkTable("marketplace_payouts"),
      ]);

      setChecks([...endpointChecks, ...tableChecks]);
    } catch (error: any) {
      Alert.alert("Health Check Error", error?.message || "Unable to run checks.");
    } finally {
      setLoading(false);
    }
  }

  const stats = useMemo(() => {
    return {
      total: checks.length,
      healthy: checks.filter((x) => x.status === "healthy").length,
      warnings: checks.filter((x) => x.status === "warning").length,
      errors: checks.filter((x) => x.status === "error").length,
    };
  }, [checks]);

  function getColor(status: HealthItem["status"]) {
    if (status === "healthy") return ui.green;
    if (status === "warning") return ui.orange;
    if (status === "error") return ui.red;
    return ui.blue;
  }

  function getIcon(status: HealthItem["status"]): keyof typeof Ionicons.glyphMap {
    if (status === "healthy") return "checkmark-circle-outline";
    if (status === "warning") return "warning-outline";
    if (status === "error") return "close-circle-outline";
    return "sync-outline";
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <StatusBar barStyle="dark-content" backgroundColor={ui.bg} />
        <ActivityIndicator size="large" color={ui.primary} />
        <Text style={styles.loadingText}>Checking platform health...</Text>
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
              <Text style={styles.logoSub}>Platform Health</Text>
            </View>
          </View>

          <NavButton label="Dashboard" icon="grid-outline" route="/admin/dashboard" />
          <NavButton label="Control Tower" icon="radio-outline" route="/admin/control-tower" />
          <NavButton label="Platform Health" icon="pulse-outline" route="/admin/platform-health" active />
          <NavButton label="Revenue" icon="cash-outline" route="/admin/revenue" />
          <NavButton label="Settings" icon="settings-outline" route="/admin/settings" />
        </View>

        <View style={styles.main}>
          <View style={styles.topbar}>
            <View>
              <Text style={styles.welcome}>Farm2Home Production</Text>
              <Text style={styles.pageTitle}>Platform Health</Text>
              <Text style={styles.pageSub}>
                Check Railway API, payments, driver routes, Stripe readiness, and Supabase table access.
              </Text>
            </View>

            <TouchableOpacity style={styles.refreshPill} onPress={runHealthChecks}>
              <Ionicons name="refresh-outline" size={18} color={ui.primary} />
              <Text style={styles.refreshPillText}>Run Checks</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.statsGrid}>
              <StatCard label="Total Checks" value={String(stats.total)} icon="list-outline" accent />
              <StatCard label="Healthy" value={String(stats.healthy)} icon="checkmark-circle-outline" success />
              <StatCard label="Warnings" value={String(stats.warnings)} icon="warning-outline" warning />
              <StatCard label="Errors" value={String(stats.errors)} icon="close-circle-outline" danger />
            </View>

            <View style={styles.infoCard}>
              <Ionicons name="server-outline" size={24} color={ui.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoTitle}>Production API</Text>
                <Text style={styles.infoText}>{API_BASE_URL}</Text>
              </View>
            </View>

            <View style={styles.dataSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Health Checklist</Text>
                <Text style={styles.sectionLink}>{checks.length} checks</Text>
              </View>

              <FlatList
                data={checks}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                contentContainerStyle={{ paddingBottom: 80 }}
                renderItem={({ item }) => {
                  const color = getColor(item.status);

                  return (
                    <View style={styles.row}>
                      <View style={[styles.avatar, { backgroundColor: `${color}18` }]}>
                        <Ionicons name={getIcon(item.status)} size={22} color={color} />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={styles.name}>{item.name}</Text>
                        <Text style={styles.meta}>{item.message}</Text>
                      </View>

                      <View style={[styles.badge, { backgroundColor: color }]}>
                        <Text style={styles.badgeText}>{item.status}</Text>
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
  infoCard: {
    backgroundColor: ui.card,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: ui.border,
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
  },
  infoTitle: { color: ui.text, fontWeight: "900", fontSize: 16 },
  infoText: { color: ui.muted, fontWeight: "800", marginTop: 4 },
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
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: 120,
  },
  badgeText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 10,
    textTransform: "uppercase",
    textAlign: "center",
  },
});