// app/freight/settings.tsx

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

type FreightSettings = {
  pushNotifications: boolean;
  newLoadAlerts: boolean;
  routeStatusAlerts: boolean;
  payoutAlerts: boolean;
  billingAlerts: boolean;
  gpsTracking: boolean;
  backgroundRouteUpdates: boolean;
  showOnlyNearbyLoads: boolean;
  showRefrigeratedLoads: boolean;
  showLivestockLoads: boolean;
  darkMode: boolean;
  privacyMode: boolean;
};

const SETTINGS_KEY = "farm2homeFreightSettings";

const DEFAULT_SETTINGS: FreightSettings = {
  pushNotifications: true,
  newLoadAlerts: true,
  routeStatusAlerts: true,
  payoutAlerts: true,
  billingAlerts: true,
  gpsTracking: true,
  backgroundRouteUpdates: false,
  showOnlyNearbyLoads: false,
  showRefrigeratedLoads: true,
  showLivestockLoads: true,
  darkMode: true,
  privacyMode: false,
};

export default function FreightSettingsScreen() {
  const [carrier, setCarrier] = useState<any>(null);
  const [settings, setSettings] = useState<FreightSettings>(DEFAULT_SETTINGS);

  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, [])
  );

  async function loadSettings() {
    try {
      const rawCarrier =
        (await AsyncStorage.getItem("currentFreightCarrier")) ||
        (await AsyncStorage.getItem("currentFreight")) ||
        (await AsyncStorage.getItem("currentUser"));

      if (!rawCarrier) {
        router.replace("/freight/login" as any);
        return;
      }

      const parsedCarrier = JSON.parse(rawCarrier);
      setCarrier(parsedCarrier);

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
      console.log("Freight settings load error:", error);
      Alert.alert("Settings Error", "Unable to load freight settings.");
    }
  }

  async function updateSetting(key: keyof FreightSettings, value: boolean) {
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
      "Are you sure you want to reset Freight Connect settings to default?",
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
            Alert.alert("Reset Complete", "Freight settings were reset.");
          },
        },
      ]
    );
  }

  async function logout() {
    await AsyncStorage.removeItem("currentFreightCarrier");
    await AsyncStorage.removeItem("currentFreight");
    await AsyncStorage.removeItem("currentFreightUser");
    await AsyncStorage.removeItem("currentUser");
    await AsyncStorage.removeItem("userRole");
    await AsyncStorage.removeItem("currentUserRole");

    router.replace("/freight/login" as any);
  }

  function carrierName() {
    return (
      carrier?.companyName ||
      carrier?.businessName ||
      carrier?.contactName ||
      carrier?.username ||
      carrier?.email ||
      "Freight Connect Carrier"
    );
  }

  function accountStatus() {
    return carrier?.membershipStatus || carrier?.subscriptionStatus || "Active";
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
              <Text style={styles.eyebrow}>Farm2Home Freight Connect</Text>
              <Text style={styles.title}>Freight Settings</Text>
              <Text style={styles.subtitle}>
                Manage carrier alerts, load board preferences, route tracking,
                privacy, and account actions.
              </Text>
            </View>

            <View style={styles.heroIcon}>
              <Ionicons name="settings-outline" size={34} color="#FFFFFF" />
            </View>
          </View>
        </View>

        <View style={styles.accountCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.accountLabel}>Signed in as</Text>
            <Text style={styles.accountName}>{carrierName()}</Text>
            <Text style={styles.accountMeta}>Membership: {accountStatus()}</Text>
          </View>

          <View style={styles.accountBadge}>
            <Ionicons name="shield-checkmark-outline" size={28} color="#BBF7D0" />
          </View>
        </View>

        <View style={styles.quickGrid}>
          <QuickLink
            icon="grid-outline"
            label="Dashboard"
            route="/freight/dashboard"
          />
          <QuickLink icon="list-outline" label="Load Board" route="/freight/board" />
          <QuickLink
            icon="cash-outline"
            label="Earnings"
            route="/freight/earnings"
          />
          <QuickLink
            icon="business-outline"
            label="Profile"
            route="/freight/profile"
          />
        </View>

        <View style={styles.card}>
          <SectionHeader
            icon="notifications-outline"
            title="Notification Preferences"
            subtitle="Control alerts for loads, routes, payouts, and billing."
          />

          <SettingRow
            icon="notifications-outline"
            label="Push Notifications"
            description="Receive Freight Connect push notifications."
            value={settings.pushNotifications}
            onChange={(value) => updateSetting("pushNotifications", value)}
          />

          <SettingRow
            icon="cube-outline"
            label="New Load Alerts"
            description="Alert me when new matching freight loads are posted."
            value={settings.newLoadAlerts}
            onChange={(value) => updateSetting("newLoadAlerts", value)}
          />

          <SettingRow
            icon="navigate-outline"
            label="Route Status Alerts"
            description="Notify me about route, pickup, and dropoff updates."
            value={settings.routeStatusAlerts}
            onChange={(value) => updateSetting("routeStatusAlerts", value)}
          />

          <SettingRow
            icon="cash-outline"
            label="Payout Alerts"
            description="Notify me when settlements or earnings update."
            value={settings.payoutAlerts}
            onChange={(value) => updateSetting("payoutAlerts", value)}
          />

          <SettingRow
            icon="card-outline"
            label="Billing Alerts"
            description="Notify me about membership and payment changes."
            value={settings.billingAlerts}
            onChange={(value) => updateSetting("billingAlerts", value)}
          />
        </View>

        <View style={styles.card}>
          <SectionHeader
            icon="options-outline"
            title="Load Board Preferences"
            subtitle="Customize what freight opportunities appear first."
          />

          <SettingRow
            icon="location-outline"
            label="Show Only Nearby Loads"
            description="Prioritize loads near your service area."
            value={settings.showOnlyNearbyLoads}
            onChange={(value) => updateSetting("showOnlyNearbyLoads", value)}
          />

          <SettingRow
            icon="snow-outline"
            label="Show Refrigerated Loads"
            description="Include cold-chain and refrigerated food loads."
            value={settings.showRefrigeratedLoads}
            onChange={(value) => updateSetting("showRefrigeratedLoads", value)}
          />

          <SettingRow
            icon="paw-outline"
            label="Show Livestock Loads"
            description="Include livestock transport opportunities."
            value={settings.showLivestockLoads}
            onChange={(value) => updateSetting("showLivestockLoads", value)}
          />
        </View>

        <View style={styles.card}>
          <SectionHeader
            icon="map-outline"
            title="GPS & Live Route"
            subtitle="Control active route tracking preferences."
          />

          <SettingRow
            icon="radio-outline"
            label="GPS Tracking"
            description="Allow live GPS updates during active freight routes."
            value={settings.gpsTracking}
            onChange={(value) => updateSetting("gpsTracking", value)}
          />

          <SettingRow
            icon="phone-portrait-outline"
            label="Background Route Updates"
            description="Allow route updates while app is minimized."
            value={settings.backgroundRouteUpdates}
            onChange={(value) => updateSetting("backgroundRouteUpdates", value)}
          />
        </View>

        <View style={styles.card}>
          <SectionHeader
            icon="lock-closed-outline"
            title="Privacy & Display"
            subtitle="Control display and sensitive account visibility."
          />

          <SettingRow
            icon="moon-outline"
            label="Dark Mode"
            description="Use the Freight Connect dark interface."
            value={settings.darkMode}
            onChange={(value) => updateSetting("darkMode", value)}
          />

          <SettingRow
            icon="eye-off-outline"
            label="Privacy Mode"
            description="Hide sensitive carrier details on shared screens."
            value={settings.privacyMode}
            onChange={(value) => updateSetting("privacyMode", value)}
          />
        </View>

        <View style={styles.card}>
          <SectionHeader
            icon="construct-outline"
            title="Account Actions"
            subtitle="Manage profile, billing, preferences, or sign out."
          />

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push("/freight/profile" as any)}
          >
            <Ionicons name="business-outline" size={18} color="#FFFFFF" />
            <Text style={styles.buttonText}>Open Freight Profile</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push("/freight/earnings" as any)}
          >
            <Ionicons name="cash-outline" size={18} color="#10B981" />
            <Text style={styles.secondaryButtonText}>Open Earnings</Text>
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