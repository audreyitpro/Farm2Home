// app/freight/service-area.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
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
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../data/supabaseClient";

const FREIGHT_ROUTES = {
  dashboard: "/freight/dashboard",
  managementCenter: "/freight/freight-management-center",
  board: "/freight/board",
  profile: "/freight/profile",
  equipment: "/freight/equipment",
  specialtyServices: "/freight/specialty-services",
  dispatchCenter: "/freight/dispatch-center",
  support: "/freight/support",
  login: "/freight/login",
  register: "/freight/register",
} as const;

type FreightRoute = (typeof FREIGHT_ROUTES)[keyof typeof FREIGHT_ROUTES];

const STATES = [
  "MI",
  "OH",
  "IN",
  "IL",
  "WI",
  "KY",
  "TN",
  "PA",
  "NY",
  "WV",
  "VA",
  "NC",
  "SC",
  "GA",
  "AL",
  "MS",
  "FL",
];

const COLORS = {
  bg: "#F4F5F7",
  card: "#FFFFFF",
  surface: "#F9FAFB",
  black: "#050505",
  red: "#D71920",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  green: "#16A34A",
  amber: "#D97706",
  blue: "#2563EB",
};

function normalize(value: any) {
  return String(value || "").trim().toLowerCase();
}

function goTo(route: FreightRoute) {
  router.push(route as any);
}

function parseList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function FreightServiceAreaScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [carrier, setCarrier] = useState<any>(null);

  const [homeBase, setHomeBase] = useState("");
  const [serviceRadiusMiles, setServiceRadiusMiles] = useState("");
  const [maxTravelMiles, setMaxTravelMiles] = useState("");
  const [preferredPickupRegions, setPreferredPickupRegions] = useState("");
  const [preferredDeliveryRegions, setPreferredDeliveryRegions] = useState("");
  const [excludedRegions, setExcludedRegions] = useState("");
  const [preferredLanes, setPreferredLanes] = useState("");

  const [localDeliveryEnabled, setLocalDeliveryEnabled] = useState(true);
  const [interstateEnabled, setInterstateEnabled] = useState(false);
  const [longHaulEnabled, setLongHaulEnabled] = useState(false);
  const [aiMatchingEnabled, setAiMatchingEnabled] = useState(true);

  const [selectedStates, setSelectedStates] = useState<string[]>(["MI"]);

  useFocusEffect(
    useCallback(() => {
      loadServiceArea();
    }, [])
  );

  const completionReady = useMemo(() => {
    return Boolean(
      homeBase.trim() &&
        serviceRadiusMiles.trim() &&
        maxTravelMiles.trim() &&
        selectedStates.length > 0
    );
  }, [homeBase, serviceRadiusMiles, maxTravelMiles, selectedStates]);

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

  async function loadServiceArea() {
    try {
      setLoading(true);

      const stored = await getStoredCarrier();
      const { data: authData } = await supabase.auth.getUser();
      const email = normalize(stored?.email || authData?.user?.email || "");

      if (!email) {
        router.replace(FREIGHT_ROUTES.login as any);
        return;
      }

      const { data: dbCarrier, error } = await supabase
        .from("freight_users")
        .select("*")
        .eq("email", email)
        .maybeSingle();

      if (error) console.log("Service area profile error:", error.message);

      if (!dbCarrier) {
        Alert.alert("Freight Profile Missing", "Please complete freight registration first.");
        router.replace(FREIGHT_ROUTES.register as any);
        return;
      }

      await persistCarrier({
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
          "Freight Connect Carrier",
      });

      setHomeBase(dbCarrier.home_base_location || dbCarrier.base_location || "");
      setServiceRadiusMiles(
        dbCarrier.service_radius_miles ? String(dbCarrier.service_radius_miles) : ""
      );
      setMaxTravelMiles(dbCarrier.max_travel_miles ? String(dbCarrier.max_travel_miles) : "");
      setPreferredPickupRegions(
        Array.isArray(dbCarrier.preferred_pickup_regions)
          ? dbCarrier.preferred_pickup_regions.join(", ")
          : dbCarrier.preferred_pickup_regions || ""
      );
      setPreferredDeliveryRegions(
        Array.isArray(dbCarrier.preferred_delivery_regions)
          ? dbCarrier.preferred_delivery_regions.join(", ")
          : dbCarrier.preferred_delivery_regions || ""
      );
      setExcludedRegions(
        Array.isArray(dbCarrier.excluded_regions)
          ? dbCarrier.excluded_regions.join(", ")
          : dbCarrier.excluded_regions || ""
      );
      setPreferredLanes(dbCarrier.preferred_lanes || "");

      setLocalDeliveryEnabled(dbCarrier.local_delivery_enabled ?? true);
      setInterstateEnabled(Boolean(dbCarrier.interstate_enabled));
      setLongHaulEnabled(Boolean(dbCarrier.long_haul_lanes_enabled));
      setAiMatchingEnabled(dbCarrier.ai_load_matching_enabled ?? true);

      setSelectedStates(
        Array.isArray(dbCarrier.states_served) && dbCarrier.states_served.length > 0
          ? dbCarrier.states_served
          : ["MI"]
      );
    } catch (error: any) {
      Alert.alert("Service Area Error", error?.message || "Unable to load service area.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadServiceArea();
  }

  function toggleState(state: string) {
    setSelectedStates((prev) =>
      prev.includes(state) ? prev.filter((item) => item !== state) : [...prev, state]
    );
  }

  async function saveServiceArea() {
    if (!carrier?.id) {
      Alert.alert("Profile Missing", "Please log in again.");
      return;
    }

    if (!completionReady) {
      Alert.alert(
        "Missing Service Area",
        "Please enter home base, service radius, max travel distance, and at least one state served."
      );
      return;
    }

    try {
      setSaving(true);

      const now = new Date().toISOString();

      const payload = {
        home_base_location: homeBase.trim(),
        base_location: homeBase.trim(),
        service_radius_miles: Number(serviceRadiusMiles) || null,
        max_travel_miles: Number(maxTravelMiles) || null,
        states_served: selectedStates,
        preferred_pickup_regions: parseList(preferredPickupRegions),
        preferred_delivery_regions: parseList(preferredDeliveryRegions),
        excluded_regions: parseList(excludedRegions),
        preferred_lanes: preferredLanes.trim() || null,
        local_delivery_enabled: localDeliveryEnabled,
        interstate_enabled: interstateEnabled,
        long_haul_lanes_enabled: longHaulEnabled,
        ai_load_matching_enabled: aiMatchingEnabled,
        service_area_status: "complete",
        service_area_updated_at: now,
        updated_at: now,
      };

      const { error } = await supabase.from("freight_users").update(payload).eq("id", carrier.id);

      if (error) throw error;

      await persistCarrier({
        ...carrier,
        ...payload,
      });

      Alert.alert("Saved", "Freight service area has been saved.");
    } catch (error: any) {
      Alert.alert("Save Error", error?.message || "Unable to save service area.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <ActivityIndicator size="large" color={COLORS.red} />
        <Text style={styles.centerText}>Loading service area...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>Farm2Home Freight Connect</Text>
            <Text style={styles.title}>Service Area</Text>
            <Text style={styles.subtitle}>
              Configure home base, radius, states served, pickup regions, delivery regions,
              excluded areas, interstate operations, and AI load matching.
            </Text>
          </View>

          <TouchableOpacity style={styles.heroIcon} onPress={() => goTo(FREIGHT_ROUTES.board)}>
            <Ionicons name="map-outline" size={34} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.carrierCard}>
          <View style={styles.avatar}>
            <Ionicons name="business-outline" size={28} color="#FFFFFF" />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.carrierName}>
              {carrier?.companyName || "Freight Connect Carrier"}
            </Text>
            <Text style={styles.carrierEmail}>{carrier?.email || "Carrier workspace"}</Text>

            <View
              style={[
                styles.statusPill,
                { backgroundColor: completionReady ? COLORS.green : COLORS.amber },
              ]}
            >
              <Text style={styles.statusPillText}>
                {completionReady ? "Service Area Ready" : "Action Required"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.quickGrid}>
          <QuickLink icon="apps-outline" label="Management" route={FREIGHT_ROUTES.managementCenter} />
          <QuickLink icon="construct-outline" label="Specialty" route={FREIGHT_ROUTES.specialtyServices} />
          <QuickLink icon="car-outline" label="Equipment" route={FREIGHT_ROUTES.equipment} />
          <QuickLink icon="headset-outline" label="Support" route={FREIGHT_ROUTES.support} />
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>AI Load Matching</Text>
          <Text style={styles.noticeText}>
            Farm2Home can use these settings to recommend compatible freight only within your
            service area, preferred lanes, equipment range, and operating rules.
          </Text>
        </View>

        <View style={styles.card}>
          <SectionHeader icon="home-outline" title="Home Base & Distance" />

          <Label text="Home Terminal / Base Location" />
          <TextInput
            style={styles.input}
            value={homeBase}
            onChangeText={setHomeBase}
            placeholder="Example: Sterling Heights, MI"
            placeholderTextColor="#94A3B8"
          />

          <Label text="Local Service Radius Miles" />
          <TextInput
            style={styles.input}
            value={serviceRadiusMiles}
            onChangeText={setServiceRadiusMiles}
            keyboardType="numeric"
            placeholder="Example: 100"
            placeholderTextColor="#94A3B8"
          />

          <Label text="Maximum Travel Distance Miles" />
          <TextInput
            style={styles.input}
            value={maxTravelMiles}
            onChangeText={setMaxTravelMiles}
            keyboardType="numeric"
            placeholder="Example: 300"
            placeholderTextColor="#94A3B8"
          />
        </View>

        <View style={styles.card}>
          <SectionHeader icon="map-outline" title="States Served" />

          <View style={styles.stateGrid}>
            {STATES.map((state) => {
              const active = selectedStates.includes(state);

              return (
                <TouchableOpacity
                  key={state}
                  style={[styles.stateButton, active && styles.stateButtonActive]}
                  onPress={() => toggleState(state)}
                >
                  <Text style={[styles.stateText, active && styles.stateTextActive]}>
                    {state}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <SectionHeader icon="navigate-outline" title="Preferred Regions & Lanes" />

          <Label text="Preferred Pickup Regions" />
          <TextInput
            style={styles.input}
            value={preferredPickupRegions}
            onChangeText={setPreferredPickupRegions}
            placeholder="Example: Detroit, Ann Arbor, Flint"
            placeholderTextColor="#94A3B8"
          />

          <Label text="Preferred Delivery Regions" />
          <TextInput
            style={styles.input}
            value={preferredDeliveryRegions}
            onChangeText={setPreferredDeliveryRegions}
            placeholder="Example: Chicago, Columbus, Cleveland"
            placeholderTextColor="#94A3B8"
          />

          <Label text="Preferred Lanes" />
          <TextInput
            style={[styles.input, styles.textArea]}
            value={preferredLanes}
            onChangeText={setPreferredLanes}
            placeholder="Example: MI to OH, Detroit to Chicago, local farm delivery only"
            placeholderTextColor="#94A3B8"
            multiline
            textAlignVertical="top"
          />

          <Label text="Excluded Regions / States" />
          <TextInput
            style={styles.input}
            value={excludedRegions}
            onChangeText={setExcludedRegions}
            placeholder="Example: Downtown Chicago, Canada, NYC"
            placeholderTextColor="#94A3B8"
          />
        </View>

        <View style={styles.card}>
          <SectionHeader icon="options-outline" title="Operating Rules" />

          <SwitchRow
            label="Enable local farm delivery zone"
            value={localDeliveryEnabled}
            onChange={setLocalDeliveryEnabled}
          />

          <SwitchRow
            label="Enable interstate operations"
            value={interstateEnabled}
            onChange={setInterstateEnabled}
          />

          <SwitchRow
            label="Enable long-haul lanes"
            value={longHaulEnabled}
            onChange={setLongHaulEnabled}
          />

          <SwitchRow
            label="Enable AI load matching"
            value={aiMatchingEnabled}
            onChange={setAiMatchingEnabled}
          />
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, saving && styles.disabledButton]}
          onPress={saveServiceArea}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="save-outline" size={18} color="#FFFFFF" />
              <Text style={styles.primaryText}>Save Service Area</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.darkButton} onPress={() => goTo(FREIGHT_ROUTES.managementCenter)}>
          <Ionicons name="apps-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryText}>Management Center</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Label({ text }: { text: string }) {
  return <Text style={styles.label}>{text}</Text>;
}

function SectionHeader({
  icon,
  title,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIcon}>
        <Ionicons name={icon} size={20} color="#FFFFFF" />
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function SwitchRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.switchRow}>
      <Text style={styles.switchText}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: "#CBD5E1", true: "#FCA5A5" }}
        thumbColor={value ? COLORS.red : "#FFFFFF"}
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
      <Text style={styles.quickText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingBottom: 90 },
  center: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  centerText: { color: COLORS.muted, marginTop: 12, fontWeight: "800" },
  hero: {
    backgroundColor: COLORS.black,
    paddingTop: 30,
    paddingHorizontal: 20,
    paddingBottom: 30,
    flexDirection: "row",
    gap: 14,
    alignItems: "flex-start",
  },
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
  subtitle: { color: "#D1D5DB", lineHeight: 22, fontWeight: "700" },
  carrierCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 16,
    marginHorizontal: 18,
    marginTop: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: COLORS.red,
    alignItems: "center",
    justifyContent: "center",
  },
  carrierName: { color: COLORS.text, fontSize: 19, fontWeight: "900" },
  carrierEmail: { color: COLORS.muted, fontWeight: "700", marginTop: 4 },
  statusPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 9,
  },
  statusPillText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 18,
    marginBottom: 14,
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
  quickText: { color: COLORS.text, fontWeight: "900", textAlign: "center" },
  notice: {
    backgroundColor: COLORS.black,
    marginHorizontal: 18,
    marginBottom: 16,
    borderRadius: 22,
    padding: 18,
  },
  noticeTitle: { color: "#FFFFFF", fontSize: 21, fontWeight: "900", marginBottom: 7 },
  noticeText: { color: "#D1D5DB", fontWeight: "700", lineHeight: 22 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 18,
    marginHorizontal: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionHeader: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    marginBottom: 14,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: COLORS.black,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: { color: COLORS.text, fontSize: 21, fontWeight: "900", flex: 1 },
  label: { color: COLORS.text, fontWeight: "900", marginBottom: 7, marginTop: 8 },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 14,
    color: COLORS.text,
    fontWeight: "700",
    marginBottom: 12,
  },
  textArea: { minHeight: 110 },
  stateGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  stateButton: {
    width: "22%",
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  stateButtonActive: {
    backgroundColor: COLORS.red,
    borderColor: COLORS.red,
  },
  stateText: { color: COLORS.text, fontWeight: "900" },
  stateTextActive: { color: "#FFFFFF" },
  switchRow: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 13,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  switchText: { color: COLORS.text, fontWeight: "900", flex: 1, lineHeight: 20 },
  primaryButton: {
    backgroundColor: COLORS.red,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 18,
    marginTop: 4,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  disabledButton: { opacity: 0.6 },
  primaryText: { color: "#FFFFFF", fontWeight: "900" },
  darkButton: {
    backgroundColor: COLORS.black,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 18,
    marginTop: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
});