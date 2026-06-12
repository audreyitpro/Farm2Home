// app/freight/specialty-services.tsx

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
  compliance: "/freight/compliance",
  equipment: "/freight/equipment",
  safety: "/freight/safety",
  carrierCertifications: "/freight/carrier-certifications",
  board: "/freight/board",
  profile: "/freight/profile",
  support: "/freight/support",
  login: "/freight/login",
  register: "/freight/register",
} as const;

type FreightRoute = (typeof FREIGHT_ROUTES)[keyof typeof FREIGHT_ROUTES];

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

export default function FreightSpecialtyServicesScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [carrier, setCarrier] = useState<any>(null);

  const [refrigeratedLoads, setRefrigeratedLoads] = useState(false);
  const [livestockLoads, setLivestockLoads] = useState(false);
  const [hayBulkLoads, setHayBulkLoads] = useState(false);
  const [tsaAirportLoads, setTsaAirportLoads] = useState(false);
  const [medicalCourierLoads, setMedicalCourierLoads] = useState(false);
  const [localFarmDelivery, setLocalFarmDelivery] = useState(true);
  const [longHaulLanes, setLongHaulLanes] = useState(false);

  const [preferredLanes, setPreferredLanes] = useState("");
  const [maxDistanceMiles, setMaxDistanceMiles] = useState("");
  const [specialtyNotes, setSpecialtyNotes] = useState("");

  useFocusEffect(
    useCallback(() => {
      loadSpecialtyServices();
    }, [])
  );

  const activeCount = useMemo(() => {
    return [
      refrigeratedLoads,
      livestockLoads,
      hayBulkLoads,
      tsaAirportLoads,
      medicalCourierLoads,
      localFarmDelivery,
      longHaulLanes,
    ].filter(Boolean).length;
  }, [
    refrigeratedLoads,
    livestockLoads,
    hayBulkLoads,
    tsaAirportLoads,
    medicalCourierLoads,
    localFarmDelivery,
    longHaulLanes,
  ]);

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

  async function loadSpecialtyServices() {
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

      if (error) console.log("Specialty services profile error:", error.message);

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

      setRefrigeratedLoads(Boolean(dbCarrier.refrigerated_loads_enabled || dbCarrier.refrigerated_capable));
      setLivestockLoads(Boolean(dbCarrier.livestock_loads_enabled || dbCarrier.livestock_capable));
      setHayBulkLoads(Boolean(dbCarrier.hay_bulk_loads_enabled));
      setTsaAirportLoads(Boolean(dbCarrier.tsa_airport_loads_enabled || dbCarrier.tsa_airport_capable));
      setMedicalCourierLoads(Boolean(dbCarrier.medical_courier_loads_enabled || dbCarrier.medical_courier_capable));
      setLocalFarmDelivery(dbCarrier.local_farm_delivery_enabled ?? true);
      setLongHaulLanes(Boolean(dbCarrier.long_haul_lanes_enabled));

      setPreferredLanes(dbCarrier.preferred_lanes || "");
      setMaxDistanceMiles(dbCarrier.max_distance_miles ? String(dbCarrier.max_distance_miles) : "");
      setSpecialtyNotes(dbCarrier.specialty_service_notes || "");
    } catch (error: any) {
      Alert.alert("Specialty Services Error", error?.message || "Unable to load specialty services.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadSpecialtyServices();
  }

  async function saveSpecialtyServices() {
    if (!carrier?.id) {
      Alert.alert("Profile Missing", "Please log in again.");
      return;
    }

    try {
      setSaving(true);

      const now = new Date().toISOString();

      const payload = {
        refrigerated_loads_enabled: refrigeratedLoads,
        refrigerated_capable: refrigeratedLoads,
        livestock_loads_enabled: livestockLoads,
        livestock_capable: livestockLoads,
        hay_bulk_loads_enabled: hayBulkLoads,
        tsa_airport_loads_enabled: tsaAirportLoads,
        tsa_airport_capable: tsaAirportLoads,
        medical_courier_loads_enabled: medicalCourierLoads,
        medical_courier_capable: medicalCourierLoads,
        local_farm_delivery_enabled: localFarmDelivery,
        long_haul_lanes_enabled: longHaulLanes,
        preferred_lanes: preferredLanes.trim() || null,
        max_distance_miles: Number(maxDistanceMiles) || null,
        specialty_service_notes: specialtyNotes.trim() || null,
        specialty_services_updated_at: now,
        updated_at: now,
      };

      const { error } = await supabase.from("freight_users").update(payload).eq("id", carrier.id);

      if (error) throw error;

      await persistCarrier({
        ...carrier,
        ...payload,
      });

      Alert.alert("Saved", "Specialty freight services have been saved.");
    } catch (error: any) {
      Alert.alert("Save Error", error?.message || "Unable to save specialty services.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <ActivityIndicator size="large" color={COLORS.red} />
        <Text style={styles.centerText}>Loading specialty services...</Text>
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
            <Text style={styles.title}>Specialty Services</Text>
            <Text style={styles.subtitle}>
              Manage refrigerated loads, livestock, hay and bulk farm loads, TSA/airport freight,
              medical courier, local farm delivery, and long-haul lanes.
            </Text>
          </View>

          <TouchableOpacity style={styles.heroIcon} onPress={() => goTo(FREIGHT_ROUTES.board)}>
            <Ionicons name="construct-outline" size={34} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.carrierCard}>
          <View style={styles.avatar}>
            <Ionicons name="business-outline" size={28} color="#FFFFFF" />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.carrierName}>{carrier?.companyName || "Freight Connect Carrier"}</Text>
            <Text style={styles.carrierEmail}>{carrier?.email || "Carrier workspace"}</Text>

            <View style={styles.statusPill}>
              <Text style={styles.statusPillText}>{activeCount} specialty services active</Text>
            </View>
          </View>
        </View>

        <View style={styles.quickGrid}>
          <QuickLink icon="shield-checkmark-outline" label="Compliance" route={FREIGHT_ROUTES.compliance} />
          <QuickLink icon="car-outline" label="Equipment" route={FREIGHT_ROUTES.equipment} />
          <QuickLink icon="ribbon-outline" label="Certifications" route={FREIGHT_ROUTES.carrierCertifications} />
          <QuickLink icon="headset-outline" label="Support" route={FREIGHT_ROUTES.support} />
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Specialty Load Matching</Text>
          <Text style={styles.noticeText}>
            These selections help Farm2Home match your carrier profile with the correct load types.
            Only enable services you are equipped, insured, and legally able to complete.
          </Text>
        </View>

        <View style={styles.card}>
          <SectionHeader icon="snow-outline" title="Cold-Chain & Fresh Freight" />
          <SwitchRow
            label="Refrigerated / cold-chain loads"
            value={refrigeratedLoads}
            onChange={setRefrigeratedLoads}
          />
        </View>

        <View style={styles.card}>
          <SectionHeader icon="paw-outline" title="Livestock & Farm Bulk" />
          <SwitchRow
            label="Livestock transport"
            value={livestockLoads}
            onChange={setLivestockLoads}
          />
          <SwitchRow
            label="Hay, feed, bale, bulk farm loads"
            value={hayBulkLoads}
            onChange={setHayBulkLoads}
          />
        </View>

        <View style={styles.card}>
          <SectionHeader icon="airplane-outline" title="Airport, TSA, and Medical" />
          <SwitchRow
            label="TSA / airport freight"
            value={tsaAirportLoads}
            onChange={setTsaAirportLoads}
          />
          <SwitchRow
            label="Medical courier / healthcare logistics"
            value={medicalCourierLoads}
            onChange={setMedicalCourierLoads}
          />
        </View>

        <View style={styles.card}>
          <SectionHeader icon="navigate-outline" title="Delivery Lanes" />
          <SwitchRow
            label="Local farm delivery"
            value={localFarmDelivery}
            onChange={setLocalFarmDelivery}
          />
          <SwitchRow
            label="Long-haul lanes"
            value={longHaulLanes}
            onChange={setLongHaulLanes}
          />

          <Text style={styles.label}>Preferred Lanes</Text>
          <TextInput
            style={styles.input}
            value={preferredLanes}
            onChangeText={setPreferredLanes}
            placeholder="Example: Detroit to Chicago, MI to OH, local 100-mile radius"
            placeholderTextColor="#94A3B8"
          />

          <Text style={styles.label}>Max Distance Miles</Text>
          <TextInput
            style={styles.input}
            value={maxDistanceMiles}
            onChangeText={setMaxDistanceMiles}
            keyboardType="numeric"
            placeholder="Example: 250"
            placeholderTextColor="#94A3B8"
          />

          <Text style={styles.label}>Specialty Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={specialtyNotes}
            onChangeText={setSpecialtyNotes}
            placeholder="Add special equipment notes, restrictions, temperature capabilities, livestock requirements, or lane preferences."
            placeholderTextColor="#94A3B8"
            multiline
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, saving && styles.disabledButton]}
          onPress={saveSpecialtyServices}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="save-outline" size={18} color="#FFFFFF" />
              <Text style={styles.primaryText}>Save Specialty Services</Text>
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
    backgroundColor: COLORS.green,
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
  textArea: { minHeight: 120 },
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