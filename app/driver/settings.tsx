// app/driver/settings.tsx

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

import freightTheme from "../styles/freightTheme";

type DriverSettings = {
  pushNotifications: boolean;
  deliveryAlerts: boolean;
  earningsAlerts: boolean;
  membershipAlerts: boolean;
  gpsTracking: boolean;
  backgroundTracking: boolean;
  shareLocationWithCustomer: boolean;
  darkMode: boolean;
  privacyMode: boolean;
};

const SETTINGS_KEY = "farm2homeDriverSettings";

const DEFAULT_SETTINGS: DriverSettings = {
  pushNotifications: true,
  deliveryAlerts: true,
  earningsAlerts: true,
  membershipAlerts: true,
  gpsTracking: true,
  backgroundTracking: false,
  shareLocationWithCustomer: true,
  darkMode: true,
  privacyMode: false,
};

export default function DriverSettingsScreen() {
  const [driver, setDriver] = useState<any>(null);
  const [settings, setSettings] = useState<DriverSettings>(DEFAULT_SETTINGS);

  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, [])
  );

  async function loadSettings() {
    try {
      const rawDriver =
        (await AsyncStorage.getItem("currentDriver")) ||
        (await AsyncStorage.getItem("currentUser"));

      if (!rawDriver) {
        router.replace("/driver/login" as any);
        return;
      }

      const parsedDriver = JSON.parse(rawDriver);
      setDriver(parsedDriver);

      const rawSettings = await AsyncStorage.getItem(SETTINGS_KEY);

      if (rawSettings) {
        setSettings({
          ...DEFAULT_SETTINGS,
          ...JSON.parse(rawSettings),
        });
      } else {
        await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS));
        setSettings(DEFAULT_SETTINGS);
      }
    } catch (error) {
      console.log("Driver settings load error:", error);
      Alert.alert("Settings Error", "Unable to load driver settings.");
    }
  }

  async function updateSetting(key: keyof DriverSettings, value: boolean) {
    const nextSettings = {
      ...settings,
      [key]: value,
    };

    setSettings(nextSettings);
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(nextSettings));
  }

  async function resetSettings() {
    Alert.alert(
      "Reset Settings",
      "Are you sure you want to reset driver settings to default?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            setSettings(DEFAULT_SETTINGS);
            await AsyncStorage.setItem(
              SETTINGS_KEY,
              JSON.stringify(DEFAULT_SETTINGS)
            );
            Alert.alert("Reset Complete", "Driver settings were reset.");
          },
        },
      ]
    );
  }

  async function logout() {
    await AsyncStorage.removeItem("currentDriver");
    await AsyncStorage.removeItem("currentUser");
    await AsyncStorage.removeItem("userRole");
    await AsyncStorage.removeItem("currentUserRole");

    router.replace("/driver/login" as any);
  }

  function driverName() {
    return (
      driver?.fullName ||
      driver?.name ||
      driver?.username ||
      driver?.email ||
      "Farm2Home Driver"
    );
  }

  function accountStatus() {
    return driver?.membershipStatus || driver?.subscriptionStatus || "Active";
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
          <Ionicons name={icon} size={20} color="#10B981" />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.settingLabel}>{label}</Text>
          <Text style={styles.settingDescription}>{description}</Text>
        </View>

        <Switch
          value={value}
          onValueChange={onChange}
          trackColor={{ false: "#334155", true: "#064E3B" }}
          thumbColor={value ? "#10B981" : "#CBD5E1"}
        />
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
      <TouchableOpacity
        style={styles.quickLink}
        onPress={() => router.push(route as any)}
      >
        <Ionicons name={icon} size={22} color="#10B981" />
        <Text style={styles.quickLinkText}>{label}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#020617" />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>Farm2Home Driver</Text>
              <Text style={styles.title}>Driver Settings</Text>
              <Text style={styles.subtitle}>
                Manage alerts, GPS tracking, privacy, and Driver Portal
                preferences.
              </Text>
            </View>

            <View style={styles.heroIcon}>
              <Ionicons name="settings-outline" size={34} color="#FFFFFF" />
            </View>
          </View>
        </View>

        <View style={styles.accountCard}>
          <View>
            <Text style={styles.accountLabel}>Signed in as</Text>
            <Text style={styles.accountName}>{driverName()}</Text>
            <Text style={styles.accountMeta}>
              Membership: {accountStatus()}
            </Text>
          </View>

          <View style={styles.accountBadge}>
            <Ionicons name="shield-checkmark-outline" size={28} color="#BBF7D0" />
          </View>
        </View>

        <View style={styles.quickGrid}>
          <QuickLink
            icon="person-outline"
            label="Profile"
            route="/driver/profile"
          />
          <QuickLink
            icon="notifications-outline"
            label="Notifications"
            route="/driver/notifications"
          />
          <QuickLink
            icon="wallet-outline"
            label="Earnings"
            route="/driver/earnings"
          />
          <QuickLink
            icon="list-outline"
            label="Driver Board"
            route="/driver/board"
          />
        </View>

        <View style={styles.card}>
          <SectionHeader
            icon="notifications-outline"
            title="Notification Preferences"
            subtitle="Control alerts for delivery activity and account updates."
          />

          <SettingRow
            icon="notifications-outline"
            label="Push Notifications"
            description="Receive Farm2Home driver push notifications."
            value={settings.pushNotifications}
            onChange={(value) => updateSetting("pushNotifications", value)}
          />

          <SettingRow
            icon="cube-outline"
            label="Delivery Alerts"
            description="Alert me when new driver deliveries are available."
            value={settings.deliveryAlerts}
            onChange={(value) => updateSetting("deliveryAlerts", value)}
          />

          <SettingRow
            icon="wallet-outline"
            label="Earnings Alerts"
            description="Notify me when earnings or settlements update."
            value={settings.earningsAlerts}
            onChange={(value) => updateSetting("earningsAlerts", value)}
          />

          <SettingRow
            icon="card-outline"
            label="Membership Alerts"
            description="Notify me about membership and billing changes."
            value={settings.membershipAlerts}
            onChange={(value) => updateSetting("membershipAlerts", value)}
          />
        </View>

        <View style={styles.card}>
          <SectionHeader
            icon="navigate-outline"
            title="GPS Tracking"
            subtitle="Control live tracking preferences for active deliveries."
          />

          <SettingRow
            icon="radio-outline"
            label="GPS Tracking"
            description="Allow driver GPS updates during active delivery."
            value={settings.gpsTracking}
            onChange={(value) => updateSetting("gpsTracking", value)}
          />

          <SettingRow
            icon="phone-portrait-outline"
            label="Background Tracking"
            description="Allow location updates while the app is minimized."
            value={settings.backgroundTracking}
            onChange={(value) => updateSetting("backgroundTracking", value)}
          />

          <SettingRow
            icon="people-outline"
            label="Share Location With Customer"
            description="Allow customers to see delivery route progress."
            value={settings.shareLocationWithCustomer}
            onChange={(value) =>
              updateSetting("shareLocationWithCustomer", value)
            }
          />
        </View>

        <View style={styles.card}>
          <SectionHeader
            icon="lock-closed-outline"
            title="Privacy & Display"
            subtitle="Control visibility and app display preferences."
          />

          <SettingRow
            icon="moon-outline"
            label="Dark Mode"
            description="Use the Farm2Home dark driver interface."
            value={settings.darkMode}
            onChange={(value) => updateSetting("darkMode", value)}
          />

          <SettingRow
            icon="eye-off-outline"
            label="Privacy Mode"
            description="Hide sensitive info where possible on shared screens."
            value={settings.privacyMode}
            onChange={(value) => updateSetting("privacyMode", value)}
          />
        </View>

        <View style={styles.card}>
          <SectionHeader
            icon="construct-outline"
            title="Account Actions"
            subtitle="Manage profile, reset settings, or sign out."
          />

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push("/driver/profile" as any)}
          >
            <Ionicons name="person-outline" size={18} color="#FFFFFF" />
            <Text style={styles.buttonText}>Open Driver Profile</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={resetSettings}>
            <Ionicons name="refresh-outline" size={18} color="#10B981" />
            <Text style={styles.secondaryButtonText}>Reset Settings</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.logoutButton} onPress={logout}>
            <Ionicons name="log-out-outline" size={18} color="#FFFFFF" />
            <Text style={styles.buttonText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
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
        <Ionicons name={icon} size={20} color="#FFFFFF" />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: freightTheme.colors.background,
  },
  content: {
    paddingBottom: 90,
  },
  hero: {
    backgroundColor: "#020617",
    paddingTop: 22,
    paddingHorizontal: 20,
    paddingBottom: 26,
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#064E3B",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#10B981",
  },
  eyebrow: {
    color: "#10B981",
    fontWeight: "900",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900",
    marginBottom: 10,
  },
  subtitle: {
    color: "#D1D5DB",
    lineHeight: 23,
    fontSize: 15,
    fontWeight: "700",
  },
  accountCard: {
    backgroundColor: "#064E3B",
    borderRadius: 20,
    padding: 18,
    marginHorizontal: 18,
    marginTop: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#10B981",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  accountLabel: {
    color: "#BBF7D0",
    fontWeight: "900",
  },
  accountName: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
    marginTop: 4,
  },
  accountMeta: {
    color: "#D1FAE5",
    fontWeight: "700",
    marginTop: 4,
  },
  accountBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#052E2B",
    alignItems: "center",
    justifyContent: "center",
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 18,
    marginBottom: 16,
  },
  quickLink: {
    width: "48%",
    backgroundColor: freightTheme.colors.card,
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
    alignItems: "center",
    gap: 8,
  },
  quickLinkText: {
    color: freightTheme.colors.text,
    fontWeight: "900",
  },
  card: {
    backgroundColor: freightTheme.colors.card,
    padding: 18,
    borderRadius: 22,
    marginHorizontal: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
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
    borderRadius: 20,
    backgroundColor: freightTheme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    color: freightTheme.colors.text,
    fontSize: 21,
    fontWeight: "900",
  },
  sectionSubtitle: {
    color: freightTheme.colors.mutedText,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 3,
  },
  settingRow: {
    backgroundColor: freightTheme.colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  settingIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
  },
  settingLabel: {
    color: freightTheme.colors.text,
    fontWeight: "900",
    marginBottom: 3,
  },
  settingDescription: {
    color: freightTheme.colors.mutedText,
    fontWeight: "700",
    lineHeight: 19,
  },
  primaryButton: {
    backgroundColor: freightTheme.colors.primary,
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    flexDirection: "row",
    gap: 8,
  },
  secondaryButton: {
    backgroundColor: freightTheme.colors.surface,
    borderWidth: 1,
    borderColor: freightTheme.colors.primary,
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
  },
  secondaryButtonText: {
    color: freightTheme.colors.primary,
    fontWeight: "900",
  },
  logoutButton: {
    backgroundColor: "#DC2626",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
});