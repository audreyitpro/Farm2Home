// app/admin/profile.tsx

import React, { useCallback, useState } from "react";
import {
  Alert,
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

export default function AdminProfile() {
  const [admin, setAdmin] = useState<any>(null);

  useFocusEffect(
    useCallback(() => {
      loadAdmin();
    }, [])
  );

  async function loadAdmin() {
    try {
      const rawAdmin = await AsyncStorage.getItem("adminSession");
      if (rawAdmin) {
        setAdmin(JSON.parse(rawAdmin));
      }
    } catch {
      Alert.alert("Profile Error", "Unable to load admin profile.");
    }
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
              <Text style={styles.logoSub}>Admin Profile</Text>
            </View>
          </View>

          <NavButton label="Dashboard" icon="grid-outline" route="/admin/dashboard" />
          <NavButton label="Control Tower" icon="radio-outline" route="/admin/control-tower" />
          <NavButton label="Analytics" icon="analytics-outline" route="/admin/analytics-center" />
          <NavButton label="Settings" icon="settings-outline" route="/admin/settings" />
          <NavButton label="Profile" icon="person-circle-outline" route="/admin/profile" active />
        </View>

        <View style={styles.main}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            <View style={styles.topbar}>
              <View>
                <Text style={styles.welcome}>Farm2Home Admin Portal</Text>
                <Text style={styles.pageTitle}>Admin Profile</Text>
                <Text style={styles.pageSub}>
                  View admin account details, shortcuts, security actions, and platform access.
                </Text>
              </View>
            </View>

            <View style={styles.profileCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(admin?.email || "A").slice(0, 1).toUpperCase()}
                </Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.profileName}>
                  {admin?.name || "Farm2Home Administrator"}
                </Text>
                <Text style={styles.profileEmail}>
                  {admin?.email || "admin@farm2home.com"}
                </Text>
                <Text style={styles.profileRole}>
                  Role: {admin?.role || "Admin"}
                </Text>
              </View>
            </View>

            <View style={styles.statsGrid}>
              <StatCard label="Access Level" value="Admin" icon="shield-checkmark-outline" accent />
              <StatCard label="Session" value="Active" icon="checkmark-circle-outline" success />
              <StatCard label="Platform" value="Farm2Home" icon="leaf-outline" />
              <StatCard label="Security" value="Enabled" icon="lock-closed-outline" success />
            </View>

            <View style={styles.card}>
              <SectionHeader
                icon="apps-outline"
                title="Admin Shortcuts"
                subtitle="Open the major Farm2Home admin areas."
              />

              <ActionButton icon="radio-outline" label="Control Tower" route="/admin/control-tower" />
              <ActionButton icon="people-outline" label="Customers" route="/admin/customers" />
              <ActionButton icon="leaf-outline" label="Farmers" route="/admin/farmers" />
              <ActionButton icon="car-outline" label="Drivers" route="/admin/drivers" />
              <ActionButton icon="business-outline" label="Freight Carriers" route="/admin/freight-carriers" />
              <ActionButton icon="receipt-outline" label="Orders" route="/admin/orders" />
              <ActionButton icon="analytics-outline" label="Analytics" route="/admin/analytics-center" />
            </View>

            <View style={styles.card}>
              <SectionHeader
                icon="shield-outline"
                title="Security"
                subtitle="Manage login session and account safety."
              />

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() =>
                  Alert.alert(
                    "Security",
                    "For production, manage password resets and admin MFA in your admin login system."
                  )
                }
              >
                <Ionicons name="key-outline" size={18} color={ui.primary} />
                <Text style={styles.actionText}>Password & Access Settings</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() =>
                  Alert.alert(
                    "Session Active",
                    `Current admin: ${admin?.email || "Administrator"}`
                  )
                }
              >
                <Ionicons name="desktop-outline" size={18} color={ui.primary} />
                <Text style={styles.actionText}>View Session Info</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.logoutButton} onPress={signOut}>
                <Ionicons name="log-out-outline" size={18} color="#FFFFFF" />
                <Text style={styles.logoutText}>Logout Admin</Text>
              </TouchableOpacity>
            </View>

            <View style={{ height: 80 }} />
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
    <TouchableOpacity
      style={styles.actionButton}
      onPress={() => router.push(route as any)}
    >
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
  pageSub: { color: ui.muted, marginTop: 4, fontWeight: "700", maxWidth: 720 },
  profileCard: {
    backgroundColor: ui.card,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: ui.border,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: ui.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#FFFFFF", fontWeight: "900", fontSize: 28 },
  profileName: { color: ui.text, fontWeight: "900", fontSize: 20 },
  profileEmail: { color: ui.muted, fontWeight: "800", marginTop: 4 },
  profileRole: { color: ui.primary, fontWeight: "900", marginTop: 6 },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 14,
  },
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