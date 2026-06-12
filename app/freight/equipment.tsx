// app/freight/equipment.tsx

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
  documents: "/freight/documents",
  insurance: "/freight/insurance",
  profile: "/freight/profile",
  settings: "/freight/settings",
  support: "/freight/support",
  board: "/freight/board",
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

const EQUIPMENT_TYPES = [
  "Cargo Van",
  "Sprinter Van",
  "Box Truck",
  "Refrigerated Truck",
  "Livestock Trailer",
  "Flatbed",
  "Dry Van",
  "Other",
];

function normalize(value: any) {
  return String(value || "").trim().toLowerCase();
}

function goTo(route: FreightRoute) {
  router.push(route as any);
}

export default function FreightEquipmentScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [carrier, setCarrier] = useState<any>(null);

  const [equipmentType, setEquipmentType] = useState("Cargo Van");
  const [vehicleYear, setVehicleYear] = useState("");
  const [vehicleMake, setVehicleMake] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [plateNumber, setPlateNumber] = useState("");
  const [vinLast4, setVinLast4] = useState("");
  const [maxWeightLbs, setMaxWeightLbs] = useState("");
  const [serviceRadiusMiles, setServiceRadiusMiles] = useState("");

  const [refrigeratedCapable, setRefrigeratedCapable] = useState(false);
  const [livestockCapable, setLivestockCapable] = useState(false);
  const [hazmatCapable, setHazmatCapable] = useState(false);
  const [medicalCourierCapable, setMedicalCourierCapable] = useState(false);
  const [tsaAirportCapable, setTsaAirportCapable] = useState(false);
  const [equipmentConfirmed, setEquipmentConfirmed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadEquipment();
    }, [])
  );

  const completion = useMemo(() => {
    const basicsComplete =
      Boolean(equipmentType) &&
      Boolean(vehicleYear.trim()) &&
      Boolean(vehicleMake.trim()) &&
      Boolean(vehicleModel.trim()) &&
      Boolean(plateNumber.trim()) &&
      Boolean(maxWeightLbs.trim()) &&
      Boolean(serviceRadiusMiles.trim());

    return {
      basicsComplete,
      complete: basicsComplete && equipmentConfirmed,
    };
  }, [
    equipmentType,
    vehicleYear,
    vehicleMake,
    vehicleModel,
    plateNumber,
    maxWeightLbs,
    serviceRadiusMiles,
    equipmentConfirmed,
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

  async function loadEquipment() {
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

      if (error) console.log("Freight equipment profile error:", error.message);

      if (!dbCarrier) {
        Alert.alert(
          "Freight Profile Missing",
          "No freight profile was found. Please complete freight registration first."
        );
        router.replace(FREIGHT_ROUTES.register as any);
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
          "Freight Connect Carrier",
        businessName:
          dbCarrier.business_name ||
          dbCarrier.company_name ||
          stored?.businessName ||
          stored?.companyName ||
          "Freight Connect Carrier",
      };

      await persistCarrier(mergedCarrier);

      setEquipmentType(dbCarrier.equipment_type || dbCarrier.vehicle_type || "Cargo Van");
      setVehicleYear(dbCarrier.vehicle_year ? String(dbCarrier.vehicle_year) : "");
      setVehicleMake(dbCarrier.vehicle_make || "");
      setVehicleModel(dbCarrier.vehicle_model || "");
      setPlateNumber(dbCarrier.plate_number || dbCarrier.vehicle_plate || "");
      setVinLast4(dbCarrier.vin_last4 || "");
      setMaxWeightLbs(dbCarrier.max_weight_lbs ? String(dbCarrier.max_weight_lbs) : "");
      setServiceRadiusMiles(
        dbCarrier.service_radius_miles ? String(dbCarrier.service_radius_miles) : ""
      );

      setRefrigeratedCapable(Boolean(dbCarrier.refrigerated_capable));
      setLivestockCapable(Boolean(dbCarrier.livestock_capable));
      setHazmatCapable(Boolean(dbCarrier.hazmat_capable));
      setMedicalCourierCapable(Boolean(dbCarrier.medical_courier_capable));
      setTsaAirportCapable(Boolean(dbCarrier.tsa_airport_capable));
      setEquipmentConfirmed(Boolean(dbCarrier.equipment_confirmed));
    } catch (error: any) {
      Alert.alert("Equipment Error", error?.message || "Unable to load equipment.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadEquipment();
  }

  async function saveEquipment() {
    if (!carrier?.id) {
      Alert.alert("Profile Missing", "Please log in again.");
      return;
    }

    if (!completion.basicsComplete) {
      Alert.alert(
        "Missing Equipment Details",
        "Please complete equipment type, vehicle details, max weight, and service radius."
      );
      return;
    }

    if (!equipmentConfirmed) {
      Alert.alert("Confirmation Required", "Confirm that your equipment information is accurate.");
      return;
    }

    try {
      setSaving(true);

      const now = new Date().toISOString();

      const payload = {
        equipment_type: equipmentType,
        vehicle_type: equipmentType,
        vehicle_year: Number(vehicleYear) || null,
        vehicle_make: vehicleMake.trim(),
        vehicle_model: vehicleModel.trim(),
        plate_number: plateNumber.trim(),
        vehicle_plate: plateNumber.trim(),
        vin_last4: vinLast4.trim() || null,
        max_weight_lbs: Number(maxWeightLbs) || null,
        service_radius_miles: Number(serviceRadiusMiles) || null,
        refrigerated_capable: refrigeratedCapable,
        livestock_capable: livestockCapable,
        hazmat_capable: hazmatCapable,
        medical_courier_capable: medicalCourierCapable,
        tsa_airport_capable: tsaAirportCapable,
        equipment_confirmed: true,
        equipment_status: "complete",
        updated_at: now,
      };

      const { error } = await supabase
        .from("freight_users")
        .update(payload)
        .eq("id", carrier.id);

      if (error) throw error;

      await persistCarrier({
        ...carrier,
        ...payload,
      });

      Alert.alert("Saved", "Freight equipment information has been saved.");
    } catch (error: any) {
      Alert.alert("Save Error", error?.message || "Unable to save equipment.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <ActivityIndicator size="large" color={COLORS.red} />
        <Text style={styles.centerText}>Loading freight equipment...</Text>
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
            <Text style={styles.title}>Equipment</Text>
            <Text style={styles.subtitle}>
              Manage vehicle type, freight capability, max weight, cold-chain, livestock,
              and specialty service options.
            </Text>
          </View>

          <TouchableOpacity style={styles.heroIcon} onPress={() => goTo(FREIGHT_ROUTES.compliance)}>
            <Ionicons name="car-outline" size={34} color="#FFFFFF" />
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
                { backgroundColor: completion.complete ? COLORS.green : COLORS.amber },
              ]}
            >
              <Text style={styles.statusPillText}>
                {completion.complete ? "Equipment Complete" : "Action Required"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.quickGrid}>
          <QuickLink icon="shield-checkmark-outline" label="Compliance" route={FREIGHT_ROUTES.compliance} />
          <QuickLink icon="person-outline" label="Profile" route={FREIGHT_ROUTES.profile} />
          <QuickLink icon="document-attach-outline" label="Documents" route={FREIGHT_ROUTES.documents} />
          <QuickLink icon="headset-outline" label="Support" route={FREIGHT_ROUTES.support} />
        </View>

        <View style={styles.card}>
          <SectionHeader
            icon="car-outline"
            title="Vehicle & Equipment Type"
            subtitle="Select the main equipment type used for freight jobs."
          />

          <View style={styles.optionGrid}>
            {EQUIPMENT_TYPES.map((item) => {
              const active = equipmentType === item;

              return (
                <TouchableOpacity
                  key={item}
                  style={[styles.optionButton, active && styles.optionButtonActive]}
                  onPress={() => setEquipmentType(item)}
                >
                  <Text style={[styles.optionText, active && styles.optionTextActive]}>
                    {item}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Label text="Vehicle Year" />
          <TextInput
            style={styles.input}
            value={vehicleYear}
            onChangeText={setVehicleYear}
            keyboardType="numeric"
            placeholder="Example: 2023"
            placeholderTextColor="#94A3B8"
          />

          <Label text="Vehicle Make" />
          <TextInput
            style={styles.input}
            value={vehicleMake}
            onChangeText={setVehicleMake}
            placeholder="Example: Ford"
            placeholderTextColor="#94A3B8"
          />

          <Label text="Vehicle Model" />
          <TextInput
            style={styles.input}
            value={vehicleModel}
            onChangeText={setVehicleModel}
            placeholder="Example: Transit"
            placeholderTextColor="#94A3B8"
          />

          <Label text="Plate Number" />
          <TextInput
            style={styles.input}
            value={plateNumber}
            onChangeText={setPlateNumber}
            autoCapitalize="characters"
            placeholder="Plate Number"
            placeholderTextColor="#94A3B8"
          />

          <Label text="VIN Last 4 Optional" />
          <TextInput
            style={styles.input}
            value={vinLast4}
            onChangeText={setVinLast4}
            maxLength={4}
            autoCapitalize="characters"
            placeholder="VIN Last 4"
            placeholderTextColor="#94A3B8"
          />
        </View>

        <View style={styles.card}>
          <SectionHeader
            icon="speedometer-outline"
            title="Capacity & Service Area"
            subtitle="Set load size and distance preferences."
          />

          <Label text="Max Weight Pounds" />
          <TextInput
            style={styles.input}
            value={maxWeightLbs}
            onChangeText={setMaxWeightLbs}
            keyboardType="numeric"
            placeholder="Example: 2500"
            placeholderTextColor="#94A3B8"
          />

          <Label text="Service Radius Miles" />
          <TextInput
            style={styles.input}
            value={serviceRadiusMiles}
            onChangeText={setServiceRadiusMiles}
            keyboardType="numeric"
            placeholder="Example: 150"
            placeholderTextColor="#94A3B8"
          />
        </View>

        <View style={styles.card}>
          <SectionHeader
            icon="construct-outline"
            title="Capabilities"
            subtitle="Select freight capabilities your equipment supports."
          />

          <SwitchRow
            label="Refrigerated / cold-chain capable"
            value={refrigeratedCapable}
            onChange={setRefrigeratedCapable}
          />

          <SwitchRow
            label="Livestock transport capable"
            value={livestockCapable}
            onChange={setLivestockCapable}
          />

          <SwitchRow
            label="Hazmat capable, if legally certified"
            value={hazmatCapable}
            onChange={setHazmatCapable}
          />

          <SwitchRow
            label="Medical courier capable"
            value={medicalCourierCapable}
            onChange={setMedicalCourierCapable}
          />

          <SwitchRow
            label="TSA / airport freight capable"
            value={tsaAirportCapable}
            onChange={setTsaAirportCapable}
          />

          <SwitchRow
            label="I confirm this equipment information is accurate"
            value={equipmentConfirmed}
            onChange={setEquipmentConfirmed}
          />
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, saving && styles.disabledButton]}
          onPress={saveEquipment}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="save-outline" size={18} color="#FFFFFF" />
              <Text style={styles.primaryText}>Save Equipment</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.darkButton} onPress={() => goTo(FREIGHT_ROUTES.compliance)}>
          <Ionicons name="shield-checkmark-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryText}>Back to Compliance</Text>
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
    alignItems: "flex-start",
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
  sectionTitle: { color: COLORS.text, fontSize: 21, fontWeight: "900" },
  sectionSubtitle: { color: COLORS.muted, fontWeight: "700", lineHeight: 20, marginTop: 3 },
  optionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  optionButton: {
    width: "48%",
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  optionButtonActive: {
    backgroundColor: COLORS.red,
    borderColor: COLORS.red,
  },
  optionText: { color: COLORS.text, fontWeight: "900", textAlign: "center" },
  optionTextActive: { color: "#FFFFFF" },
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