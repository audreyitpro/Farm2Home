// app/admin/settings.tsx

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
  orderAlerts: boolean;
  freightAlerts: boolean;
  driverGpsAlerts: boolean;
  paymentAlerts: boolean;
  lightAdminUI: boolean;
  compactCards: boolean;
  privacyMode: boolean;
};

const SETTINGS_KEY = "farm2homeAdminSettings";

const DEFAULT_SETTINGS: AdminSettings = {
  pushAlerts: true,
  complianceAlerts: true,
  orderAlerts: true,
  freightAlerts: true,
  driverGpsAlerts: true,
  paymentAlerts: true,
  lightAdminUI: true,
  compactCards: false,
  privacyMode: false,
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
    Alert.alert("Settings Reset", "Admin settings were restored to default.");
  }

  async function signOut() {
    try {
      await logoutAdmin();
    } catch {}
    await AsyncStorage.removeItem("adminSession");
    router.replace("/admin/login" as any);
  }

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
          <NavButton label="Control Tower" icon="radio-outline" route="/admin/control-tower" />
          <NavButton label="Customers" icon="people-outline" route="/admin/customers" />
          <NavButton label="Farmers" icon="leaf-outline" route="/admin/farmers" />
          <NavButton label="Orders" icon="receipt-outline" route="/admin/orders" />
          <NavButton label="Settings" icon="settings-outline" route="/admin/settings" active />
        </View>

        <View style={styles.main}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            <View style={styles.topbar}>
              <View>
                <Text style={styles.welcome}>Farm2Home Admin Portal</Text>
                <Text style={styles.pageTitle}>Admin Settings</Text>
                <Text style={styles.pageSub}>
                  Manage admin alerts, display preferences, system shortcuts, and account access.
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
              </View>
            </View>

            <View style={styles.card}>
              <SectionHeader
                icon="notifications-outline"
                title="Notification Settings"
                subtitle="Control admin alerts for platform activity."
              />

              <SettingRow
                icon="notifications-outline"
                label="Push Alerts"
                description="Receive general admin push alerts."
                value={settings.pushAlerts}
                onChange={(v) => updateSetting("pushAlerts", v)}
              />

              <SettingRow
                icon="shield-checkmark-outline"
                label="Compliance Alerts"
                description="Notify when farmers or freight carriers need review."
                value={settings.complianceAlerts}
                onChange={(v) => updateSetting("complianceAlerts", v)}
              />

              <SettingRow
                icon="receipt-outline"
                label="Order Alerts"
                description="Notify when customer orders require attention."
                value={settings.orderAlerts}
                onChange={(v) => updateSetting("orderAlerts", v)}
              />

              <SettingRow
                icon="trail-sign-outline"
                label="Freight Alerts"
                description="Notify about new loads, active loads, and route issues."
                value={settings.freightAlerts}
                onChange={(v) => updateSetting("freightAlerts", v)}
              />

              <SettingRow
                icon="radio-outline"
                label="Driver GPS Alerts"
                description="Notify when GPS goes stale or driver route status changes."
                value={settings.driverGpsAlerts}
                onChange={(v) => updateSetting("driverGpsAlerts", v)}
              />

              <SettingRow
                icon="card-outline"
                label="Payment Alerts"
                description="Notify about Stripe, payout, and subscription issues."
                value={settings.paymentAlerts}
                onChange={(v) => updateSetting("paymentAlerts", v)}
              />
            </View>

            <View style={styles.card}>
              <SectionHeader
                icon="color-palette-outline"
                title="Display Settings"
                subtitle="Control admin interface preferences."
              />

              <SettingRow
                icon="sunny-outline"
                label="Fina Light Admin UI"
                description="Use the new light admin interface inspired by the Fina dashboard kit."
                value={settings.lightAdminUI}
                onChange={(v) => updateSetting("lightAdminUI", v)}
              />

              <SettingRow
                icon="albums-outline"
                label="Compact Cards"
                description="Show tighter spacing for admin cards."
                value={settings.compactCards}
                onChange={(v) => updateSetting("compactCards", v)}
              />

              <SettingRow
                icon="eye-off-outline"
                label="Privacy Mode"
                description="Hide sensitive account details on shared screens."
                value={settings.privacyMode}
                onChange={(v) => updateSetting("privacyMode", v)}
              />
            </View>

            <View style={styles.card}>
              <SectionHeader
                icon="construct-outline"
                title="System Shortcuts"
                subtitle="Open production and payment monitoring areas."
              />

              <ActionButton
                icon="server-outline"
                label="Production API Health"
                onPress={() =>
                  Alert.alert(
                    "API Health",
                    "Check Railway /health and /payments/health endpoints."
                  )
                }
              />

              <ActionButton
                icon="card-outline"
                label="Stripe Status"
                onPress={() =>
                  Alert.alert(
                    "Stripe",
                    "Review Stripe dashboard, webhooks, Connect payouts, and membership price IDs."
                  )
                }
              />

              <ActionButton
                icon="refresh-outline"
                label="Reset Admin Settings"
                onPress={resetSettings}
              />

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
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.actionButton} onPress={onPress}>
      <Ionicons name={icon} size={18} color={ui.primary} />
      <Text style={styles.actionText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: ui.bg,
  },
  shell: {
    flex: 1,
    backgroundColor: ui.bg,
  },
  sidebar: {
    backgroundColor: ui.card,
    borderBottomWidth: 1,
    borderBottomColor: ui.border,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 12,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  logoMark: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: ui.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 13,
  },
  logoTitle: {
    color: ui.text,
    fontWeight: "900",
    fontSize: 18,
  },
  logoSub: {
    color: ui.muted,
    fontWeight: "700",
    fontSize: 12,
  },
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
  navButtonActive: {
    backgroundColor: ui.primary,
  },
  navText: {
    color: ui.muted,
    fontWeight: "900",
    fontSize: 13,
  },
  navTextActive: {
    color: "#FFFFFF",
  },
  main: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  content: {
    paddingBottom: 90,
  },
  topbar: {
    backgroundColor: ui.card,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: ui.border,
    marginBottom: 14,
  },
  welcome: {
    color: ui.muted,
    fontWeight: "800",
    marginBottom: 4,
  },
  pageTitle: {
    color: ui.text,
    fontSize: 26,
    fontWeight: "900",
  },
  pageSub: {
    color: ui.muted,
    marginTop: 4,
    fontWeight: "700",
    maxWidth: 720,
  },
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
  adminLabel: {
    color: ui.muted,
    fontWeight: "900",
  },
  adminEmail: {
    color: ui.text,
    fontWeight: "900",
    fontSize: 18,
    marginTop: 4,
  },
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
  sectionTitle: {
    color: ui.text,
    fontSize: 21,
    fontWeight: "900",
  },
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
  settingLabel: {
    color: ui.text,
    fontWeight: "900",
  },
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
  actionText: {
    color: ui.primary,
    fontWeight: "900",
  },
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
  logoutText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
});