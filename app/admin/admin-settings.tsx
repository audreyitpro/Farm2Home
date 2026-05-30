// app/admin/admin-settings.tsx

import React, { useCallback, useState } from "react";
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { logoutAdmin } from "../data/adminStore";

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

type AdminSettings = {
  pushAlerts: boolean;
  complianceAlerts: boolean;
  paymentAlerts: boolean;
  freightAlerts: boolean;
  driverGpsAlerts: boolean;
  orderAlerts: boolean;
  privacyMode: boolean;
  compactCards: boolean;
  productionMode: boolean;
};

const SETTINGS_KEY = "farm2homeAdminSettings";

const DEFAULT_SETTINGS: AdminSettings = {
  pushAlerts: true,
  complianceAlerts: true,
  paymentAlerts: true,
  freightAlerts: true,
  driverGpsAlerts: true,
  orderAlerts: true,
  privacyMode: false,
  compactCards: false,
  productionMode: true,
};

export default function AdminSettingsScreen() {
  const [admin, setAdmin] = useState<any>(null);
  const [settings, setSettings] = useState<AdminSettings>(DEFAULT_SETTINGS);

  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, [])
  );

  async function loadSettings() {
    try {
      const rawAdmin = await AsyncStorage.getItem("adminSession");
      if (rawAdmin) setAdmin(JSON.parse(rawAdmin));

      const rawSettings = await AsyncStorage.getItem(SETTINGS_KEY);
      if (rawSettings) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(rawSettings) });
      } else {
        await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS));
      }
    } catch {
      Alert.alert("Settings Error", "Unable to load admin settings.");
    }
  }

  async function updateSetting(key: keyof AdminSettings, value: boolean) {
    const next = { ...settings, [key]: value };
    setSettings(next);
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  }

  async function resetSettings() {
    setSettings(DEFAULT_SETTINGS);
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS));
    Alert.alert("Settings Reset", "Admin settings restored to default.");
  }

  async function signOut() {
    try {
      await logoutAdmin();
    } catch {}

    await AsyncStorage.removeItem("adminSession");
    router.replace("/admin/login" as any);
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
              <Text style={styles.logoSub}>Admin Settings</Text>
            </View>
          </View>

          <NavButton label="Dashboard" icon="grid-outline" route="/admin/dashboard" />
          <NavButton label="Platform Health" icon="pulse-outline" route="/admin/platform-health" />
          <NavButton label="System Audit" icon="shield-checkmark-outline" route="/admin/system-audit" />
          <NavButton label="Notifications" icon="notifications-outline" route="/admin/notifications" />
          <NavButton label="Settings" icon="settings-outline" route="/admin/admin-settings" active />
        </View>

        <View style={styles.main}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            <View style={styles.topbar}>
              <View>
                <Text style={styles.welcome}>Farm2Home Admin Portal</Text>
                <Text style={styles.pageTitle}>Admin Settings</Text>
                <Text style={styles.pageSub}>
                  Manage admin alerts, production preferences, security shortcuts, and account access.
                </Text>
              </View>
            </View>

            <View style={styles.adminCard}>
              <View style={styles.adminIcon}>
                <Ionicons name="shield-checkmark-outline" size={28} color={ui.primary} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.adminLabel}>Signed in as</Text>
                <Text style={styles.adminEmail}>{admin?.email || "Administrator"}</Text>
                <Text style={styles.adminRole}>Role: {admin?.role || "Admin"}</Text>
              </View>
            </View>

            <View style={styles.statsGrid}>
              <StatCard label="Mode" value={settings.productionMode ? "Production" : "Review"} icon="server-outline" accent />
              <StatCard label="Alerts" value={settings.pushAlerts ? "On" : "Off"} icon="notifications-outline" success={settings.pushAlerts} />
              <StatCard label="Privacy" value={settings.privacyMode ? "On" : "Off"} icon="eye-off-outline" />
              <StatCard label="UI" value={settings.compactCards ? "Compact" : "Fina"} icon="color-palette-outline" accent />
            </View>

            <View style={styles.card}>
              <SectionHeader
                icon="notifications-outline"
                title="Alert Settings"
                subtitle="Control which admin alerts should be active."
              />

              <SettingRow
                icon="notifications-outline"
                label="Push Alerts"
                description="Enable general admin alert notifications."
                value={settings.pushAlerts}
                onChange={(value) => updateSetting("pushAlerts", value)}
              />

              <SettingRow
                icon="shield-checkmark-outline"
                label="Compliance Alerts"
                description="Notify when farmers, carriers, or documents need review."
                value={settings.complianceAlerts}
                onChange={(value) => updateSetting("complianceAlerts", value)}
              />

              <SettingRow
                icon="card-outline"
                label="Payment Alerts"
                description="Notify about Stripe, subscription, payout, or application fee issues."
                value={settings.paymentAlerts}
                onChange={(value) => updateSetting("paymentAlerts", value)}
              />

              <SettingRow
                icon="cube-outline"
                label="Freight Alerts"
                description="Notify about freight load, route, carrier, and delivery problems."
                value={settings.freightAlerts}
                onChange={(value) => updateSetting("freightAlerts", value)}
              />

              <SettingRow
                icon="radio-outline"
                label="Driver GPS Alerts"
                description="Notify when driver GPS is stale or tracking has stopped."
                value={settings.driverGpsAlerts}
                onChange={(value) => updateSetting("driverGpsAlerts", value)}
              />

              <SettingRow
                icon="receipt-outline"
                label="Order Alerts"
                description="Notify when marketplace orders require admin attention."
                value={settings.orderAlerts}
                onChange={(value) => updateSetting("orderAlerts", value)}
              />
            </View>

            <View style={styles.card}>
              <SectionHeader
                icon="color-palette-outline"
                title="Display & Production"
                subtitle="Control the admin dashboard behavior."
              />

              <SettingRow
                icon="server-outline"
                label="Production Mode"
                description="Keep production health, Stripe, and Supabase checks enabled."
                value={settings.productionMode}
                onChange={(value) => updateSetting("productionMode", value)}
              />

              <SettingRow
                icon="albums-outline"
                label="Compact Cards"
                description="Use tighter spacing for admin dashboard cards."
                value={settings.compactCards}
                onChange={(value) => updateSetting("compactCards", value)}
              />

              <SettingRow
                icon="eye-off-outline"
                label="Privacy Mode"
                description="Hide sensitive identifiers when sharing your screen."
                value={settings.privacyMode}
                onChange={(value) => updateSetting("privacyMode", value)}
              />
            </View>

            <View style={styles.card}>
              <SectionHeader
                icon="apps-outline"
                title="Admin Shortcuts"
                subtitle="Open the main production admin screens."
              />

              <ActionButton icon="pulse-outline" label="Platform Health" route="/admin/platform-health" />
              <ActionButton icon="shield-checkmark-outline" label="System Audit" route="/admin/system-audit" />
              <ActionButton icon="cash-outline" label="Revenue Center" route="/admin/revenue" />
              <ActionButton icon="card-outline" label="Subscriptions" route="/admin/subscriptions" />
              <ActionButton icon="arrow-redo-outline" label="Payouts" route="/admin/payouts" />
              <ActionButton icon="business-outline" label="Freight Carriers" route="/admin/freight-carriers" />
              <ActionButton icon="map-outline" label="Fleet Map" route="/admin/fleet-map" />
            </View>

            <View style={styles.card}>
              <SectionHeader
                icon="construct-outline"
                title="System Actions"
                subtitle="Reset settings or sign out of the admin portal."
              />

              <TouchableOpacity style={styles.actionButton} onPress={resetSettings}>
                <Ionicons name="refresh-outline" size={18} color={ui.primary} />
                <Text style={styles.actionText}>Reset Admin Settings</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() =>
                  Alert.alert(
                    "Production Checklist",
                    "Check /health, /payments/health, /driver/health, Stripe webhooks, Supabase tables, Vercel build, and Railway deploy logs."
                  )
                }
              >
                <Ionicons name="checkmark-done-outline" size={18} color={ui.primary} />
                <Text style={styles.actionText}>View Production Checklist</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.logoutButton} onPress={signOut}>
                <Ionicons name="log-out-outline" size={18} color="#FFFFFF" />
                <Text style={styles.logoutText}>Logout Admin</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );

  function SettingRow({
    icon,
    label,
    description,
    value,
    onChange,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    description: string;
    value: boolean;
    onChange: (value: boolean) => void;
  }) {
    return (
      <View style={styles.settingRow}>
        <View style={styles.settingIcon}>
          <Ionicons name={icon} size={20} color={ui.primary} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.settingLabel}>{label}</Text>
          <Text style={styles.settingDescription}>{description}</Text>
        </View>

        <Switch
          value={value}
          onValueChange={onChange}
          trackColor={{ false: "#CBD5E1", true: ui.primarySoft }}
          thumbColor={value ? ui.primary : "#FFFFFF"}
        />
      </View>
    );
  }
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
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent?: boolean;
  success?: boolean;
}) {
  const color = success ? ui.green : accent ? ui.primary : ui.blue;

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

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIcon}>
        <Ionicons name={icon} size={20} color={ui.primary} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

function ActionButton({
  icon,
  label,
  route,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  route: string;
}) {
  return (
    <TouchableOpacity style={styles.actionButton} onPress={() => router.push(route as any)}>
      <Ionicons name={icon} size={18} color={ui.primary} />
      <Text style={styles.actionText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: ui.bg },
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
  content: { paddingBottom: 90 },
  topbar: {
    backgroundColor: ui.card,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: ui.border,
    marginBottom: 14,
  },
  welcome: { color: ui.muted, fontWeight: "800", marginBottom: 4 },
  pageTitle: { color: ui.text, fontSize: 26, fontWeight: "900" },
  pageSub: { color: ui.muted, marginTop: 4, fontWeight: "700", maxWidth: 780 },
  adminCard: {
    backgroundColor: ui.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: ui.border,
    padding: 18,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    marginBottom: 14,
  },
  adminIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: ui.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  adminLabel: { color: ui.muted, fontWeight: "900" },
  adminEmail: { color: ui.text, fontWeight: "900", fontSize: 18, marginTop: 4 },
  adminRole: { color: ui.primary, fontWeight: "900", marginTop: 5 },
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
  statValue: { color: ui.text, fontSize: 21, fontWeight: "900" },
  statLabel: { color: ui.muted, fontWeight: "800", marginTop: 4 },
  card: {
    backgroundColor: ui.card,
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: ui.border,
  },
  sectionHeader: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    marginBottom: 14,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: ui.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: { color: ui.text, fontSize: 21, fontWeight: "900" },
  sectionSubtitle: {
    color: ui.muted,
    fontWeight: "700",
    marginTop: 3,
    lineHeight: 20,
  },
  settingRow: {
    backgroundColor: ui.soft,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: ui.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  settingIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: ui.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  settingLabel: { color: ui.text, fontWeight: "900" },
  settingDescription: {
    color: ui.muted,
    fontWeight: "700",
    lineHeight: 19,
    marginTop: 3,
  },
  actionButton: {
    backgroundColor: ui.soft,
    borderWidth: 1,
    borderColor: ui.border,
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  actionText: { color: ui.primary, fontWeight: "900" },
  logoutButton: {
    backgroundColor: ui.red,
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  logoutText: { color: "#FFFFFF", fontWeight: "900" },
});