// app/freight/settings.tsx

import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
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

import { supabase } from "../data/supabaseClient";

const FREIGHT_ROUTES = {
  dashboard: "/freight/dashboard",
  board: "/freight/board",
  liveLoads: "/freight/live-loads",
  myLoads: "/freight/my-loads",
  connectBank: "/freight/connect-bank",
  subscription: "/freight/subscription",
  profile: "/freight/profile",
  settings: "/freight/settings",
  support: "/freight/support",
  help: "/freight/help",
} as const;

type FreightRoute = (typeof FREIGHT_ROUTES)[keyof typeof FREIGHT_ROUTES];

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
  darkMode: false,
  privacyMode: false,
};

const COLORS = {
  bg: "#F4F5F7",
  card: "#FFFFFF",
  surface: "#F9FAFB",
  black: "#050505",
  red: "#D71920",
  redDark: "#9F1117",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  green: "#16A34A",
  amber: "#D97706",
  slate: "#64748B",
};

function normalize(value: any) {
  return String(value || "").trim().toLowerCase();
}

function goTo(route: FreightRoute) {
  router.push(route as any);
}

export default function FreightSettingsScreen() {
  const [loading, setLoading] = useState(true);
  const [savingSync, setSavingSync] = useState(false);
  const [carrier, setCarrier] = useState<any>(null);
  const [settings, setSettings] = useState<FreightSettings>(DEFAULT_SETTINGS);

  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, [])
  );

  async function getStoredCarrier() {
    const raw =
      (await AsyncStorage.getItem("currentFreightCarrier")) ||
      (await AsyncStorage.getItem("currentFreight")) ||
      (await AsyncStorage.getItem("currentFreightUser")) ||
      (await AsyncStorage.getItem("currentUser"));

    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async function persistCarrier(nextCarrier: any) {
    const normalizedCarrier = {
      ...nextCarrier,
      id: nextCarrier.id || nextCarrier.freightId,
      freightId: nextCarrier.freightId || nextCarrier.id,
      role: "freight",
      email: normalize(nextCarrier.email),
      companyName:
        nextCarrier.companyName ||
        nextCarrier.businessName ||
        nextCarrier.company_name ||
        nextCarrier.business_name ||
        "Freight Connect Carrier",
      businessName:
        nextCarrier.businessName ||
        nextCarrier.companyName ||
        nextCarrier.business_name ||
        nextCarrier.company_name ||
        "Freight Connect Carrier",
      stripeAccountId:
        nextCarrier.stripeAccountId ||
        nextCarrier.stripe_account_id ||
        "",
      stripe_account_id:
        nextCarrier.stripe_account_id ||
        nextCarrier.stripeAccountId ||
        "",
    };

    await AsyncStorage.setItem("currentFreight", JSON.stringify(normalizedCarrier));
    await AsyncStorage.setItem("currentFreightCarrier", JSON.stringify(normalizedCarrier));
    await AsyncStorage.setItem("currentFreightUser", JSON.stringify(normalizedCarrier));
    await AsyncStorage.setItem("currentUser", JSON.stringify(normalizedCarrier));
    await AsyncStorage.setItem("userRole", "freight");
    await AsyncStorage.setItem("currentUserRole", "freight");

    setCarrier(normalizedCarrier);
    return normalizedCarrier;
  }

  async function loadSettings() {
    try {
      setLoading(true);

      const stored = await getStoredCarrier();
      const { data: authData } = await supabase.auth.getUser();
      const authUser = authData?.user;

      const email = normalize(stored?.email || authUser?.email || "");

      if (!email) {
        router.replace("/freight/login" as any);
        return;
      }

      const { data: dbCarrier, error } = await supabase
        .from("freight_users")
        .select("*")
        .eq("email", email)
        .maybeSingle();

      if (error) {
        console.log("Freight settings profile load error:", error.message);
      }

      if (!dbCarrier) {
        Alert.alert(
          "Freight Profile Missing",
          "No freight profile was found for this email. Please complete freight registration again."
        );
        router.replace("/freight/register" as any);
        return;
      }

      const mergedCarrier = {
        ...(stored || {}),
        ...(dbCarrier || {}),
        id: dbCarrier.id,
        freightId: dbCarrier.id,
        role: "freight",
        email: normalize(dbCarrier.email || email),
        companyName:
          dbCarrier.company_name ||
          dbCarrier.business_name ||
          stored?.companyName ||
          stored?.businessName ||
          stored?.contactName ||
          stored?.username ||
          "Freight Connect Carrier",
        businessName:
          dbCarrier.business_name ||
          dbCarrier.company_name ||
          stored?.businessName ||
          stored?.companyName ||
          "Freight Connect Carrier",
        contactName:
          dbCarrier.contact_name ||
          dbCarrier.name ||
          stored?.contactName ||
          stored?.name ||
          "",
        membershipStatus:
          dbCarrier.membership_status || stored?.membershipStatus || "Active",
        subscriptionStatus:
          dbCarrier.subscription_status || stored?.subscriptionStatus || "active",
        accountActive: dbCarrier.account_active ?? stored?.accountActive ?? true,
        stripeAccountId:
          dbCarrier.stripe_account_id ||
          stored?.stripeAccountId ||
          stored?.stripe_account_id ||
          "",
        stripe_account_id:
          dbCarrier.stripe_account_id ||
          stored?.stripe_account_id ||
          stored?.stripeAccountId ||
          "",
        payoutsEnabled:
          dbCarrier.payouts_enabled ??
          dbCarrier.stripe_payouts_enabled ??
          stored?.payoutsEnabled ??
          false,
        chargesEnabled:
          dbCarrier.charges_enabled ??
          dbCarrier.stripe_charges_enabled ??
          stored?.chargesEnabled ??
          false,
        onboardingComplete:
          dbCarrier.stripe_onboarding_complete ??
          stored?.onboardingComplete ??
          false,
      };

      await persistCarrier(mergedCarrier);

      const dbSettings: FreightSettings = {
        pushNotifications: dbCarrier.push_notifications ?? DEFAULT_SETTINGS.pushNotifications,
        newLoadAlerts: dbCarrier.new_load_alerts ?? DEFAULT_SETTINGS.newLoadAlerts,
        routeStatusAlerts: dbCarrier.route_status_alerts ?? DEFAULT_SETTINGS.routeStatusAlerts,
        payoutAlerts: dbCarrier.payout_alerts ?? DEFAULT_SETTINGS.payoutAlerts,
        billingAlerts: dbCarrier.billing_alerts ?? DEFAULT_SETTINGS.billingAlerts,
        gpsTracking: dbCarrier.gps_tracking ?? DEFAULT_SETTINGS.gpsTracking,
        backgroundRouteUpdates:
          dbCarrier.background_route_updates ?? DEFAULT_SETTINGS.backgroundRouteUpdates,
        showOnlyNearbyLoads:
          dbCarrier.show_only_nearby_loads ?? DEFAULT_SETTINGS.showOnlyNearbyLoads,
        showRefrigeratedLoads:
          dbCarrier.show_refrigerated_loads ?? DEFAULT_SETTINGS.showRefrigeratedLoads,
        showLivestockLoads:
          dbCarrier.show_livestock_loads ?? DEFAULT_SETTINGS.showLivestockLoads,
        darkMode: dbCarrier.dark_mode ?? DEFAULT_SETTINGS.darkMode,
        privacyMode: dbCarrier.privacy_mode ?? DEFAULT_SETTINGS.privacyMode,
      };

      const rawSettings = await AsyncStorage.getItem(SETTINGS_KEY);

      if (rawSettings) {
        const localSettings = JSON.parse(rawSettings);
        const mergedSettings = {
          ...DEFAULT_SETTINGS,
          ...dbSettings,
          ...localSettings,
        };
        setSettings(mergedSettings);
        await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(mergedSettings));
      } else {
        setSettings(dbSettings);
        await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(dbSettings));
      }
    } catch (error) {
      console.log("Freight settings load error:", error);
      Alert.alert("Settings Error", "Unable to load freight settings.");
    } finally {
      setLoading(false);
    }
  }

  async function syncCarrierSettings(nextSettings: FreightSettings) {
    const freightId = carrier?.id || carrier?.freightId;
    const email = normalize(carrier?.email);

    if (!freightId && !email) return;

    try {
      setSavingSync(true);

      const payload = {
        push_notifications: nextSettings.pushNotifications,
        new_load_alerts: nextSettings.newLoadAlerts,
        route_status_alerts: nextSettings.routeStatusAlerts,
        payout_alerts: nextSettings.payoutAlerts,
        billing_alerts: nextSettings.billingAlerts,
        gps_tracking: nextSettings.gpsTracking,
        background_route_updates: nextSettings.backgroundRouteUpdates,
        show_only_nearby_loads: nextSettings.showOnlyNearbyLoads,
        show_refrigerated_loads: nextSettings.showRefrigeratedLoads,
        show_livestock_loads: nextSettings.showLivestockLoads,
        dark_mode: nextSettings.darkMode,
        privacy_mode: nextSettings.privacyMode,
        updated_at: new Date().toISOString(),
      };

      let query = supabase.from("freight_users").update(payload);

      if (freightId) {
        query = query.eq("id", freightId);
      } else {
        query = query.eq("email", email);
      }

      const { error } = await query;

      if (error) {
        console.log("Freight settings sync error:", error.message);
      }
    } catch (error) {
      console.log("Freight settings sync skipped:", error);
    } finally {
      setSavingSync(false);
    }
  }

  async function updateSetting(key: keyof FreightSettings, value: boolean) {
    const nextSettings = {
      ...settings,
      [key]: value,
    };

    setSettings(nextSettings);
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(nextSettings));
    await syncCarrierSettings(nextSettings);
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
            await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS));
            await syncCarrierSettings(DEFAULT_SETTINGS);
            Alert.alert("Reset Complete", "Freight settings were reset.");
          },
        },
      ]
    );
  }

  async function logout() {
    await supabase.auth.signOut();

    await AsyncStorage.multiRemove([
      "currentFreightCarrier",
      "currentFreight",
      "currentFreightUser",
      "currentUser",
      "userRole",
      "currentUserRole",
    ]);

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

  function statusColor() {
    const status = normalize(accountStatus());

    if (status.includes("cancel")) return COLORS.red;
    if (status.includes("pending")) return COLORS.amber;
    if (status.includes("past_due") || status.includes("unpaid")) return COLORS.red;

    return COLORS.green;
  }

  function stripeStatusText() {
    if (carrier?.payoutsEnabled && carrier?.chargesEnabled && carrier?.onboardingComplete) {
      return "Payout Ready";
    }

    if (carrier?.stripeAccountId || carrier?.stripe_account_id) {
      return "Setup Incomplete";
    }

    return "Not Connected";
  }

  function stripeStatusColor() {
    if (carrier?.payoutsEnabled && carrier?.chargesEnabled && carrier?.onboardingComplete) {
      return COLORS.green;
    }

    if (carrier?.stripeAccountId || carrier?.stripe_account_id) {
      return COLORS.amber;
    }

    return COLORS.red;
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.red} />
          <Text style={styles.centerText}>Loading freight settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>Farm2Home Freight Connect</Text>
              <Text style={styles.title}>Freight Settings</Text>
              <Text style={styles.subtitle}>
                Manage carrier alerts, load board preferences, route tracking, privacy, and account actions.
              </Text>
            </View>

            <TouchableOpacity style={styles.heroIcon} onPress={() => goTo(FREIGHT_ROUTES.dashboard)}>
              <Ionicons name="settings-outline" size={34} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.accountCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.accountLabel}>Signed in as</Text>
            <Text style={styles.accountName}>{carrierName()}</Text>
            <Text style={styles.accountMeta}>Membership: {accountStatus()}</Text>

            <View style={[styles.accountPill, { backgroundColor: statusColor() }]}>
              <Text style={styles.accountPillText}>
                {carrier?.accountActive === false ? "Inactive" : "Carrier Active"}
              </Text>
            </View>
          </View>

          <View style={styles.accountBadge}>
            <Ionicons name="shield-checkmark-outline" size={28} color="#FFFFFF" />
          </View>
        </View>

        <View style={styles.stripeCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.stripeTitle}>Stripe Connect</Text>
            <Text style={styles.stripeMeta}>
              {carrier?.stripeAccountId || carrier?.stripe_account_id || "No account connected"}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.stripePill, { backgroundColor: stripeStatusColor() }]}
            onPress={() => goTo(FREIGHT_ROUTES.connectBank)}
          >
            <Text style={styles.accountPillText}>{stripeStatusText()}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.syncCard}>
          <Ionicons name="cloud-done-outline" size={20} color={COLORS.red} />
          <Text style={styles.syncText}>
            {savingSync ? "Syncing settings..." : "Settings saved locally and synced when available."}
          </Text>
        </View>

        <View style={styles.quickGrid}>
          <QuickLink icon="grid-outline" label="Dashboard" route={FREIGHT_ROUTES.dashboard} />
          <QuickLink icon="list-outline" label="Load Board" route={FREIGHT_ROUTES.board} />
          <QuickLink icon="briefcase-outline" label="My Loads" route={FREIGHT_ROUTES.myLoads} />
          <QuickLink icon="pulse-outline" label="Live Loads" route={FREIGHT_ROUTES.liveLoads} />
          <QuickLink icon="business-outline" label="Profile" route={FREIGHT_ROUTES.profile} />
          <QuickLink icon="card-outline" label="Subscription" route={FREIGHT_ROUTES.subscription} />
          <QuickLink icon="headset-outline" label="Support" route={FREIGHT_ROUTES.support} />
          <QuickLink icon="help-circle-outline" label="Help" route={FREIGHT_ROUTES.help} />
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
            description="Use the Freight Connect dark interface preference."
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

          <TouchableOpacity style={styles.primaryButton} onPress={() => goTo(FREIGHT_ROUTES.profile)}>
            <Ionicons name="business-outline" size={18} color="#FFFFFF" />
            <Text style={styles.buttonText}>Open Freight Profile</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={() => goTo(FREIGHT_ROUTES.connectBank)}>
            <Ionicons name="business-outline" size={18} color={COLORS.red} />
            <Text style={styles.secondaryButtonText}>Open Connect Bank</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={() => goTo(FREIGHT_ROUTES.subscription)}>
            <Ionicons name="card-outline" size={18} color={COLORS.red} />
            <Text style={styles.secondaryButtonText}>Open Subscription</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={() => goTo(FREIGHT_ROUTES.support)}>
            <Ionicons name="help-buoy-outline" size={18} color={COLORS.red} />
            <Text style={styles.secondaryButtonText}>Open Support</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={() => goTo(FREIGHT_ROUTES.help)}>
            <Ionicons name="help-circle-outline" size={18} color={COLORS.red} />
            <Text style={styles.secondaryButtonText}>Open Help</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={resetSettings}>
            <Ionicons name="refresh-outline" size={18} color={COLORS.red} />
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
        <Ionicons name={icon} size={20} color={COLORS.red} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.settingLabel}>{label}</Text>
        <Text style={styles.settingDescription}>{description}</Text>
      </View>

      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: "#CBD5E1", true: COLORS.red }}
        thumbColor="#FFFFFF"
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
  route: FreightRoute;
}) {
  return (
    <TouchableOpacity style={styles.quickLink} onPress={() => goTo(route)}>
      <Ionicons name={icon} size={22} color={COLORS.red} />
      <Text style={styles.quickLinkText}>{label}</Text>
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
  safe: { flex: 1, backgroundColor: COLORS.bg },
  center: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  centerText: { color: COLORS.muted, marginTop: 12, fontWeight: "800" },
  content: { paddingBottom: 90 },
  hero: {
    backgroundColor: COLORS.black,
    paddingTop: 28,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  heroTop: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 24,
    backgroundColor: COLORS.red,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: {
    color: "#FCA5A5",
    fontWeight: "900",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontSize: 12,
  },
  title: { color: "#FFFFFF", fontSize: 32, fontWeight: "900", marginBottom: 10 },
  subtitle: { color: "#D1D5DB", lineHeight: 22, fontSize: 14, fontWeight: "700" },
  accountCard: {
    backgroundColor: COLORS.red,
    borderRadius: 22,
    padding: 18,
    marginHorizontal: 18,
    marginTop: 18,
    marginBottom: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  accountLabel: { color: "#FFE4E6", fontWeight: "900" },
  accountName: { color: "#FFFFFF", fontSize: 22, fontWeight: "900", marginTop: 4 },
  accountMeta: { color: "#FFE4E6", fontWeight: "700", marginTop: 4 },
  accountPill: {
    alignSelf: "flex-start",
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  accountPillText: { color: "#FFFFFF", fontWeight: "900", fontSize: 12 },
  accountBadge: {
    width: 52,
    height: 52,
    borderRadius: 20,
    backgroundColor: COLORS.black,
    alignItems: "center",
    justifyContent: "center",
  },
  stripeCard: {
    backgroundColor: COLORS.black,
    marginHorizontal: 18,
    marginBottom: 14,
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  stripeTitle: { color: "#FFFFFF", fontWeight: "900", fontSize: 16 },
  stripeMeta: { color: "#D1D5DB", fontWeight: "700", marginTop: 4 },
  stripePill: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  syncCard: {
    backgroundColor: COLORS.card,
    marginHorizontal: 18,
    marginBottom: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  syncText: { color: COLORS.text, fontWeight: "800", flex: 1, lineHeight: 20 },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 18,
    marginBottom: 16,
  },
  quickLink: {
    width: "48%",
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    gap: 8,
  },
  quickLinkText: { color: COLORS.text, fontWeight: "900", textAlign: "center" },
  card: {
    backgroundColor: COLORS.card,
    padding: 18,
    borderRadius: 22,
    marginHorizontal: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionHeader: { flexDirection: "row", gap: 10, alignItems: "flex-start", marginBottom: 14 },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: COLORS.black,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: { color: COLORS.text, fontSize: 21, fontWeight: "900" },
  sectionSubtitle: { color: COLORS.muted, fontWeight: "700", lineHeight: 20, marginTop: 3 },
  settingRow: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  settingIcon: {
    width: 38,
    height: 38,
    borderRadius: 16,
    backgroundColor: "#FFF1F2",
    alignItems: "center",
    justifyContent: "center",
  },
  settingLabel: { color: COLORS.text, fontWeight: "900", marginBottom: 3 },
  settingDescription: { color: COLORS.muted, fontWeight: "700", lineHeight: 19 },
  primaryButton: {
    backgroundColor: COLORS.red,
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    flexDirection: "row",
    gap: 8,
  },
  secondaryButton: {
    backgroundColor: "#FFF1F2",
    borderWidth: 1,
    borderColor: COLORS.red,
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
  },
  secondaryButtonText: { color: COLORS.red, fontWeight: "900" },
  logoutButton: {
    backgroundColor: COLORS.redDark,
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
  },
  buttonText: { color: "#FFFFFF", fontWeight: "900" },
});