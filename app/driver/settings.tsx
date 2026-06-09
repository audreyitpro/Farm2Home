// app/driver/settings.tsx

import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";

import { supabase } from "../services/supabaseClient";

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
  slate: "#475569",
};

function normalize(value: any) {
  return String(value || "").trim().toLowerCase();
}

export default function DriverSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [driver, setDriver] = useState<any>(null);

  const [availableNow, setAvailableNow] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [farm2DriverEligible, setFarm2DriverEligible] = useState(true);
  const [freightEligible, setFreightEligible] = useState(true);

  const [serviceArea, setServiceArea] = useState("");
  const [serviceRadiusMiles, setServiceRadiusMiles] = useState("50");
  const [preferredLoadType, setPreferredLoadType] = useState("local");

  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, [])
  );

  async function getStoredDriver() {
    const raw =
      (await AsyncStorage.getItem("currentDriver")) ||
      (await AsyncStorage.getItem("farm2homeCurrentDriver")) ||
      (await AsyncStorage.getItem("farm2homeDriverSession")) ||
      (await AsyncStorage.getItem("currentUser"));

    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async function loadSettings() {
    try {
      setLoading(true);

      const stored = await getStoredDriver();
      const { data: authData } = await supabase.auth.getUser();
      const authUser = authData?.user;

      const driverId = stored?.id || stored?.driverId || authUser?.id || "";
      const email = normalize(stored?.email || authUser?.email || "");

      if (!driverId && !email) {
        router.replace("/driver/login" as any);
        return;
      }

      let dbDriver: any = null;

      if (driverId) {
        const result = await supabase
          .from("drivers")
          .select("*")
          .eq("id", driverId)
          .maybeSingle();

        if (!result.error && result.data) dbDriver = result.data;
      }

      if (!dbDriver && email) {
        const result = await supabase
          .from("drivers")
          .select("*")
          .eq("email", email)
          .maybeSingle();

        if (!result.error && result.data) dbDriver = result.data;
      }

      const merged = {
        ...(stored || {}),
        ...(dbDriver || {}),
        id: dbDriver?.id || driverId,
        driverId: dbDriver?.id || driverId,
        role: "driver",
        email: normalize(dbDriver?.email || stored?.email || email),
        fullName:
          dbDriver?.full_name ||
          dbDriver?.name ||
          stored?.fullName ||
          stored?.name ||
          "Farm2Home Driver",
        availableNow: dbDriver?.available_now ?? stored?.availableNow ?? true,
        notificationsEnabled:
          dbDriver?.notifications_enabled ?? stored?.notificationsEnabled ?? true,
        farm2DriverEligible:
          dbDriver?.farm2driver_eligible ?? stored?.farm2DriverEligible ?? true,
        freightEligible: dbDriver?.freight_eligible ?? stored?.freightEligible ?? true,
        serviceArea: dbDriver?.service_area || stored?.serviceArea || "",
        serviceRadiusMiles:
          dbDriver?.service_radius_miles || stored?.serviceRadiusMiles || 50,
        preferredLoadType:
          dbDriver?.preferred_load_type || stored?.preferredLoadType || "local",
      };

      setDriver(merged);
      setAvailableNow(Boolean(merged.availableNow));
      setNotificationsEnabled(Boolean(merged.notificationsEnabled));
      setFarm2DriverEligible(Boolean(merged.farm2DriverEligible));
      setFreightEligible(Boolean(merged.freightEligible));
      setServiceArea(String(merged.serviceArea || ""));
      setServiceRadiusMiles(String(merged.serviceRadiusMiles || 50));
      setPreferredLoadType(String(merged.preferredLoadType || "local"));

      await persistDriver(merged, false);
    } catch (error) {
      console.log("Load driver settings error:", error);
      Alert.alert("Settings Error", "Unable to load driver settings.");
    } finally {
      setLoading(false);
    }
  }

  async function persistDriver(updatedDriver: any, saveToSupabase = true) {
    const now = new Date().toISOString();

    const normalizedDriver = {
      ...updatedDriver,
      id: updatedDriver.id || updatedDriver.driverId,
      driverId: updatedDriver.driverId || updatedDriver.id,
      role: "driver",
      availableNow,
      notificationsEnabled,
      farm2DriverEligible,
      freightEligible,
      serviceArea: serviceArea.trim(),
      serviceRadiusMiles: Number(serviceRadiusMiles || 50),
      preferredLoadType: preferredLoadType || "local",
      updatedAt: now,
    };

    if (saveToSupabase && normalizedDriver.id) {
      const { error } = await supabase
        .from("drivers")
        .update({
          available_now: normalizedDriver.availableNow,
          notifications_enabled: normalizedDriver.notificationsEnabled,
          farm2driver_eligible: normalizedDriver.farm2DriverEligible,
          freight_eligible: normalizedDriver.freightEligible,
          service_area: normalizedDriver.serviceArea,
          service_radius_miles: normalizedDriver.serviceRadiusMiles,
          preferred_load_type: normalizedDriver.preferredLoadType,
          updated_at: now,
        })
        .eq("id", normalizedDriver.id);

      if (error) throw error;
    }

    await AsyncStorage.setItem("currentDriver", JSON.stringify(normalizedDriver));
    await AsyncStorage.setItem("currentUser", JSON.stringify(normalizedDriver));
    await AsyncStorage.setItem("farm2homeCurrentDriver", JSON.stringify(normalizedDriver));
    await AsyncStorage.setItem("farm2homeDriverSession", JSON.stringify(normalizedDriver));
    await AsyncStorage.setItem("userRole", "driver");
    await AsyncStorage.setItem("currentUserRole", "driver");

    setDriver(normalizedDriver);
  }

  async function saveSettings() {
    if (!driver?.id) {
      Alert.alert("No Driver", "No driver account was found.");
      return;
    }

    try {
      setSaving(true);

      await persistDriver(
        {
          ...driver,
          availableNow,
          notificationsEnabled,
          farm2DriverEligible,
          freightEligible,
          serviceArea,
          serviceRadiusMiles,
          preferredLoadType,
        },
        true
      );

      Alert.alert("Saved", "Driver settings updated.");
    } catch (error: any) {
      Alert.alert("Save Error", error?.message || "Unable to save settings.");
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();

    await AsyncStorage.multiRemove([
      "currentDriver",
      "currentUser",
      "farm2homeCurrentDriver",
      "farm2homeDriverSession",
      "userRole",
      "currentUserRole",
    ]);

    router.replace("/driver/login" as any);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.red} />
          <Text style={styles.centerText}>Loading driver settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />

      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <Text style={styles.eyebrow}>Farm2Driver Control Panel</Text>
            <Text style={styles.title}>Driver Settings</Text>
            <Text style={styles.subtitle}>
              Manage availability, load preferences, notifications, service area,
              local delivery access, and freight eligibility.
            </Text>
          </View>

          <View style={styles.statusCard}>
            <View>
              <Text style={styles.statusTitle}>
                {driver?.fullName || driver?.name || "Farm2Home Driver"}
              </Text>
              <Text style={styles.statusSub}>{driver?.email || "Driver account"}</Text>
            </View>

            <View
              style={[
                styles.statusBadge,
                { backgroundColor: availableNow ? COLORS.green : COLORS.slate },
              ]}
            >
              <Text style={styles.statusBadgeText}>
                {availableNow ? "Available" : "Offline"}
              </Text>
            </View>
          </View>

          <Card title="Availability">
            <SwitchRow
              title="Available Now"
              subtitle="Show your driver account as available for active delivery assignments."
              value={availableNow}
              onValueChange={setAvailableNow}
            />

            <SwitchRow
              title="Notifications"
              subtitle="Receive delivery, freight, chat, and board alerts."
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
            />
          </Card>

          <Card title="Service Area">
            <Label text="Primary Service Area" />
            <TextInput
              style={styles.input}
              value={serviceArea}
              onChangeText={setServiceArea}
              placeholder="Detroit Metro, Macomb County, etc."
              placeholderTextColor="#9CA3AF"
            />

            <Label text="Service Radius Miles" />
            <TextInput
              style={styles.input}
              value={serviceRadiusMiles}
              onChangeText={setServiceRadiusMiles}
              keyboardType="numeric"
              placeholder="50"
              placeholderTextColor="#9CA3AF"
            />
          </Card>

          <Card title="Load Preferences">
            <View style={styles.optionRow}>
              <OptionButton
                title="Local"
                active={preferredLoadType === "local"}
                onPress={() => setPreferredLoadType("local")}
              />
              <OptionButton
                title="Freight"
                active={preferredLoadType === "freight"}
                onPress={() => setPreferredLoadType("freight")}
              />
              <OptionButton
                title="Both"
                active={preferredLoadType === "both"}
                onPress={() => setPreferredLoadType("both")}
              />
            </View>

            <SwitchRow
              title="Farm2Driver Local Delivery"
              subtitle="Enable local customer and farmer delivery jobs."
              value={farm2DriverEligible}
              onValueChange={setFarm2DriverEligible}
            />

            <SwitchRow
              title="Freight Load Support"
              subtitle="Enable hay, livestock, large farm loads, and freight board work."
              value={freightEligible}
              onValueChange={setFreightEligible}
            />
          </Card>

          <Card title="Driver Shortcuts">
            <RouteButton title="Driver Hub" onPress={() => router.push("/driver/mobile-driver-app" as any)} />
            <RouteButton title="Driver Board" onPress={() => router.push("/driver/board" as any)} />
            <RouteButton title="My Deliveries" onPress={() => router.push("/driver/my-deliveries" as any)} />
            <RouteButton title="Earnings" onPress={() => router.push("/driver/earnings" as any)} />
            <RouteButton title="Profile" onPress={() => router.push("/driver/profile" as any)} />
            <RouteButton title="Notifications" onPress={() => router.push("/driver/notifications" as any)} />
          </Card>

          <TouchableOpacity
            style={[styles.primaryButton, saving && styles.disabledButton]}
            onPress={saveSettings}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Save Settings</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.darkButton} onPress={() => router.push("/driver/mobile-driver-app" as any)}>
            <Text style={styles.darkButtonText}>Back to Driver Hub</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.logoutButton} onPress={logout}>
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Card({ title, children }: any) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Label({ text }: { text: string }) {
  return <Text style={styles.label}>{text}</Text>;
}

function SwitchRow({ title, subtitle, value, onValueChange }: any) {
  return (
    <View style={styles.switchRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.switchTitle}>{title}</Text>
        {!!subtitle && <Text style={styles.switchSub}>{subtitle}</Text>}
      </View>

      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: "#CBD5E1", true: COLORS.red }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

function OptionButton({ title, active, onPress }: any) {
  return (
    <TouchableOpacity
      style={[styles.optionButton, active && styles.optionButtonActive]}
      onPress={onPress}
    >
      <Text style={[styles.optionButtonText, active && styles.optionButtonTextActive]}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

function RouteButton({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.routeButton} onPress={onPress}>
      <Text style={styles.routeButtonText}>{title}</Text>
      <Text style={styles.routeArrow}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  keyboard: { flex: 1 },
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingBottom: 90 },
  center: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  centerText: {
    color: COLORS.muted,
    marginTop: 10,
    fontWeight: "800",
  },
  hero: {
    backgroundColor: COLORS.black,
    paddingTop: 30,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  eyebrow: {
    color: "#FCA5A5",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    color: "#FFFFFF",
    marginTop: 6,
  },
  subtitle: {
    color: "#D1D5DB",
    fontWeight: "700",
    lineHeight: 21,
    marginTop: 8,
    fontSize: 13,
  },
  statusCard: {
    backgroundColor: COLORS.card,
    marginHorizontal: 18,
    marginTop: 16,
    marginBottom: 14,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900",
  },
  statusSub: {
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 3,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  statusBadgeText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 12,
  },
  card: {
    backgroundColor: COLORS.card,
    padding: 16,
    borderRadius: 20,
    marginHorizontal: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: "900",
    color: COLORS.text,
    marginBottom: 10,
  },
  label: {
    color: COLORS.text,
    marginTop: 8,
    marginBottom: 6,
    fontWeight: "900",
  },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 13,
    fontWeight: "700",
    marginBottom: 8,
    color: COLORS.text,
  },
  switchRow: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  switchTitle: {
    color: COLORS.text,
    fontWeight: "900",
  },
  switchSub: {
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 4,
    lineHeight: 18,
  },
  optionRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  optionButton: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  optionButtonActive: {
    backgroundColor: COLORS.red,
    borderColor: COLORS.red,
  },
  optionButtonText: {
    color: COLORS.text,
    fontWeight: "900",
  },
  optionButtonTextActive: {
    color: "#FFFFFF",
  },
  routeButton: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 13,
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  routeButtonText: {
    flex: 1,
    color: COLORS.text,
    fontWeight: "900",
  },
  routeArrow: {
    color: COLORS.red,
    fontSize: 24,
    fontWeight: "900",
  },
  primaryButton: {
    backgroundColor: COLORS.red,
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
    marginHorizontal: 18,
    marginTop: 2,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  darkButton: {
    backgroundColor: COLORS.black,
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
    marginHorizontal: 18,
    marginTop: 10,
  },
  darkButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  logoutButton: {
    backgroundColor: COLORS.slate,
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
    marginHorizontal: 18,
    marginTop: 10,
    marginBottom: 40,
  },
  logoutButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  disabledButton: {
    opacity: 0.65,
  },
});