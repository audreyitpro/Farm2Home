// app/freight/create-load.tsx

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
  board: "/freight/board",
  myLoads: "/freight/my-loads",
  liveLoads: "/freight/live-loads",
  postLoad: "/freight/post-load",
  createLoad: "/freight/create-load",
  profile: "/freight/profile",
  settings: "/freight/settings",
  connectBank: "/freight/connect-bank",
  login: "/freight/login",
  register: "/freight/register",
} as const;

type FreightRoute = (typeof FREIGHT_ROUTES)[keyof typeof FREIGHT_ROUTES];
type FreightLoadStatus = "available";

const COLORS = {
  bg: "#F4F5F7",
  card: "#FFFFFF",
  surface: "#F9FAFB",
  black: "#050505",
  red: "#D71920",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
};

function normalize(value: any) {
  return String(value || "").trim().toLowerCase();
}

function goTo(route: FreightRoute) {
  router.push(route as any);
}

export default function FreightCreateLoadScreen() {
  const [loading, setLoading] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [carrier, setCarrier] = useState<any>(null);

  const [title, setTitle] = useState("");
  const [farmerName, setFarmerName] = useState("");

  const [pickupLocation, setPickupLocation] = useState("");
  const [dropoffLocation, setDropoffLocation] = useState("");

  const [pickupDate, setPickupDate] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [dropoffDate, setDropoffDate] = useState("");
  const [dropoffTime, setDropoffTime] = useState("");

  const [commodity, setCommodity] = useState("");
  const [equipmentType, setEquipmentType] = useState("");
  const [weightLbs, setWeightLbs] = useState("");
  const [temperatureRequired, setTemperatureRequired] = useState("");

  const [rate, setRate] = useState("");
  const [distanceMiles, setDistanceMiles] = useState("");
  const [notes, setNotes] = useState("");

  useFocusEffect(
    useCallback(() => {
      loadCarrier();
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

  async function loadCarrier() {
    try {
      setLoadingProfile(true);

      const stored = await getStoredCarrier();
      const { data: authData } = await supabase.auth.getUser();
      const authUser = authData?.user;

      const email = normalize(stored?.email || authUser?.email || "");

      if (!email) {
        router.replace(FREIGHT_ROUTES.login as any);
        return;
      }

      const { data: dbCarrier, error } = await supabase
        .from("freight_users")
        .select("*")
        .eq("email", email)
        .maybeSingle();

      if (error) console.log("Create load freight profile error:", error.message);

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
        contactName:
          dbCarrier.contact_name ||
          dbCarrier.name ||
          stored?.contactName ||
          stored?.name ||
          "",
      };

      await persistCarrier(mergedCarrier);

      if (!farmerName) {
        setFarmerName(mergedCarrier.companyName || "");
      }
    } catch (error) {
      console.log("Load carrier error:", error);
      Alert.alert("Profile Error", "Unable to load freight profile.");
    } finally {
      setLoadingProfile(false);
    }
  }

  function validateForm() {
    if (!title.trim()) {
      Alert.alert("Title Required", "Enter a freight load title.");
      return false;
    }

    if (!pickupLocation.trim() || !dropoffLocation.trim()) {
      Alert.alert("Route Required", "Enter pickup and dropoff locations.");
      return false;
    }

    if (!pickupDate.trim() || !pickupTime.trim()) {
      Alert.alert("Pickup Required", "Enter pickup date and pickup time.");
      return false;
    }

    if (!commodity.trim() || !equipmentType.trim()) {
      Alert.alert("Load Details Required", "Enter commodity and equipment type.");
      return false;
    }

    if (!rate.trim() || Number(rate) <= 0) {
      Alert.alert("Rate Required", "Enter a valid carrier rate.");
      return false;
    }

    return true;
  }

  async function submitLoad() {
    if (loading) return;
    if (!validateForm()) return;

    try {
      setLoading(true);

      if (!carrier?.id) {
        Alert.alert("Login Required", "Please log in to post freight loads.");
        router.replace(FREIGHT_ROUTES.login as any);
        return;
      }

      const now = new Date().toISOString();

      const payload = {
        title: title.trim(),
        farmer_name:
          farmerName.trim() ||
          carrier.companyName ||
          carrier.businessName ||
          "Farm2Home Partner",

        pickup_location: pickupLocation.trim(),
        dropoff_location: dropoffLocation.trim(),

        pickup_date: pickupDate.trim(),
        pickup_time: pickupTime.trim(),
        dropoff_date: dropoffDate.trim() || null,
        dropoff_time: dropoffTime.trim() || null,

        commodity: commodity.trim(),
        equipment_type: equipmentType.trim(),
        weight_lbs: weightLbs.trim() ? Number(weightLbs) : null,
        temperature_required: temperatureRequired.trim() || null,

        rate: Number(rate),
        distance_miles: distanceMiles.trim() ? Number(distanceMiles) : null,
        notes: notes.trim() || null,

        status: "available" as FreightLoadStatus,

        carrier_id: null,
        driver_id: null,
        accepted_by: null,
        batch_id: null,

        posted_by_id: carrier.id,
        posted_by_name:
          carrier.companyName ||
          carrier.businessName ||
          carrier.contactName ||
          carrier.username ||
          "Freight Connect Carrier",
        posted_by_role: "freight",

        created_at: now,
        updated_at: now,
      };

      const { data, error } = await supabase
        .from("freight_loads")
        .insert(payload)
        .select("id")
        .single();

      if (error) throw error;

      Alert.alert("Freight Posted", "Your freight load is now live on the board.", [
        {
          text: "View Board",
          onPress: () =>
            router.replace({
              pathname: FREIGHT_ROUTES.board as any,
              params: { createdLoadId: data?.id || "" },
            }),
        },
      ]);
    } catch (error: any) {
      console.log("Create freight load error:", error);
      Alert.alert("Post Error", error?.message || "Unable to post freight load.");
    } finally {
      setLoading(false);
    }
  }

  if (loadingProfile) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <ActivityIndicator size="large" color={COLORS.red} />
        <Text style={styles.centerText}>Loading freight load creator...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />

      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.heroTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.kicker}>Farm2Home Freight Connect</Text>
                <Text style={styles.title}>Create Freight Load</Text>
                <Text style={styles.subtitle}>
                  Post a freight opportunity to the live load board for approved carriers and drivers.
                </Text>
              </View>

              <TouchableOpacity style={styles.heroIcon} onPress={() => goTo(FREIGHT_ROUTES.board)}>
                <Ionicons name="add-circle-outline" size={34} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.navRow}>
            <TouchableOpacity style={styles.navButton} onPress={() => goTo(FREIGHT_ROUTES.board)}>
              <Ionicons name="list-outline" size={18} color="#FFFFFF" />
              <Text style={styles.navText}>Load Board</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.navButtonOutline} onPress={() => goTo(FREIGHT_ROUTES.dashboard)}>
              <Ionicons name="grid-outline" size={18} color={COLORS.red} />
              <Text style={styles.navTextOutline}>Dashboard</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.quickGrid}>
            <QuickLink icon="briefcase-outline" label="My Loads" route={FREIGHT_ROUTES.myLoads} />
            <QuickLink icon="pulse-outline" label="Live Loads" route={FREIGHT_ROUTES.liveLoads} />
            <QuickLink icon="business-outline" label="Connect Bank" route={FREIGHT_ROUTES.connectBank} />
            <QuickLink icon="settings-outline" label="Settings" route={FREIGHT_ROUTES.settings} />
          </View>

          <View style={styles.card}>
            <SectionHeader
              icon="document-text-outline"
              title="Load Summary"
              subtitle="Basic title and posting information."
            />

            <TextInput
              style={styles.input}
              placeholder="Load Title"
              placeholderTextColor="#94A3B8"
              value={title}
              onChangeText={setTitle}
            />

            <TextInput
              style={styles.input}
              placeholder="Farmer / Business Name"
              placeholderTextColor="#94A3B8"
              value={farmerName}
              onChangeText={setFarmerName}
            />
          </View>

          <View style={styles.card}>
            <SectionHeader icon="map-outline" title="Route" subtitle="Pickup and dropoff locations." />

            <TextInput
              style={styles.input}
              placeholder="Pickup Location"
              placeholderTextColor="#94A3B8"
              value={pickupLocation}
              onChangeText={setPickupLocation}
            />

            <TextInput
              style={styles.input}
              placeholder="Dropoff Location"
              placeholderTextColor="#94A3B8"
              value={dropoffLocation}
              onChangeText={setDropoffLocation}
            />

            <TextInput
              style={styles.input}
              placeholder="Estimated Distance Miles"
              placeholderTextColor="#94A3B8"
              value={distanceMiles}
              onChangeText={setDistanceMiles}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.card}>
            <SectionHeader icon="calendar-outline" title="Schedule" subtitle="Pickup and delivery timing." />

            <TextInput
              style={styles.input}
              placeholder="Pickup Date"
              placeholderTextColor="#94A3B8"
              value={pickupDate}
              onChangeText={setPickupDate}
            />

            <TextInput
              style={styles.input}
              placeholder="Pickup Time"
              placeholderTextColor="#94A3B8"
              value={pickupTime}
              onChangeText={setPickupTime}
            />

            <TextInput
              style={styles.input}
              placeholder="Dropoff Date"
              placeholderTextColor="#94A3B8"
              value={dropoffDate}
              onChangeText={setDropoffDate}
            />

            <TextInput
              style={styles.input}
              placeholder="Dropoff Time"
              placeholderTextColor="#94A3B8"
              value={dropoffTime}
              onChangeText={setDropoffTime}
            />
          </View>

          <View style={styles.card}>
            <SectionHeader
              icon="cube-outline"
              title="Freight Details"
              subtitle="Commodity, equipment, weight, and temperature."
            />

            <TextInput
              style={styles.input}
              placeholder="Commodity"
              placeholderTextColor="#94A3B8"
              value={commodity}
              onChangeText={setCommodity}
            />

            <TextInput
              style={styles.input}
              placeholder="Equipment Type"
              placeholderTextColor="#94A3B8"
              value={equipmentType}
              onChangeText={setEquipmentType}
            />

            <TextInput
              style={styles.input}
              placeholder="Weight Pounds"
              placeholderTextColor="#94A3B8"
              value={weightLbs}
              onChangeText={setWeightLbs}
              keyboardType="numeric"
            />

            <TextInput
              style={styles.input}
              placeholder="Temperature Requirement"
              placeholderTextColor="#94A3B8"
              value={temperatureRequired}
              onChangeText={setTemperatureRequired}
            />
          </View>

          <View style={styles.card}>
            <SectionHeader icon="cash-outline" title="Carrier Rate" subtitle="Set the posted payout for this load." />

            <TextInput
              style={styles.input}
              placeholder="Carrier Rate"
              placeholderTextColor="#94A3B8"
              value={rate}
              onChangeText={setRate}
              keyboardType="numeric"
            />

            <TextInput
              style={[styles.input, styles.notesInput]}
              placeholder="Notes / Handling Instructions"
              placeholderTextColor="#94A3B8"
              value={notes}
              onChangeText={setNotes}
              multiline
              textAlignVertical="top"
            />
          </View>

          <TouchableOpacity style={[styles.submitButton, loading && styles.disabledButton]} onPress={submitLoad} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={18} color="#FFFFFF" />
                <Text style={styles.submitText}>Post Freight Load</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
  subtitle?: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIcon}>
        <Ionicons name={icon} size={20} color="#FFFFFF" />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {!!subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
      </View>
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
      <Ionicons name={icon} size={21} color={COLORS.red} />
      <Text style={styles.quickText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  keyboard: { flex: 1, backgroundColor: COLORS.bg },
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
    paddingTop: 22,
    paddingHorizontal: 20,
    paddingBottom: 26,
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
  kicker: {
    color: "#FCA5A5",
    fontWeight: "900",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontSize: 12,
  },
  title: { color: "#FFFFFF", fontSize: 34, fontWeight: "900", marginBottom: 10 },
  subtitle: { color: "#D1D5DB", lineHeight: 23, fontSize: 15, fontWeight: "700" },
  navRow: {
    flexDirection: "row",
    gap: 10,
    padding: 18,
    paddingBottom: 10,
  },
  navButton: {
    flex: 1,
    backgroundColor: COLORS.red,
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  navButtonOutline: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.red,
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  navText: { color: "#FFFFFF", fontWeight: "900" },
  navTextOutline: { color: COLORS.red, fontWeight: "900" },
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
    borderRadius: 16,
    padding: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    gap: 7,
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
    marginBottom: 16,
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
  notesInput: { minHeight: 110 },
  submitButton: {
    backgroundColor: COLORS.red,
    padding: 16,
    borderRadius: 16,
    marginHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  disabledButton: { opacity: 0.6 },
  submitText: { color: "#FFFFFF", fontWeight: "900", fontSize: 16 },
});