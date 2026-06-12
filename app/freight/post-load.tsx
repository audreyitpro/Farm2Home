// app/freight/post-load.tsx

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

type LoadType = "Livestock" | "Refrigerated Fresh Food" | "Other";

const MIN_RATE_PER_MILE = 1.5;
const MAX_RATE_PER_MILE = 4.5;

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "";

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
};

function normalize(value: any) {
  return String(value || "").trim().toLowerCase();
}

function goTo(route: FreightRoute) {
  router.push(route as any);
}

export default function FreightPostLoadScreen() {
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [posting, setPosting] = useState(false);
  const [calculatingMiles, setCalculatingMiles] = useState(false);
  const [carrier, setCarrier] = useState<any>(null);

  const [farmerName, setFarmerName] = useState("");
  const [loadTitle, setLoadTitle] = useState("Fresh Produce Delivery");
  const [loadType, setLoadType] = useState<LoadType>("Refrigerated Fresh Food");
  const [requiredEquipment, setRequiredEquipment] = useState("Refrigerated Truck");

  const [pickupLocation, setPickupLocation] = useState("");
  const [dropoffLocation, setDropoffLocation] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [dropoffDate, setDropoffDate] = useState("");
  const [dropoffTime, setDropoffTime] = useState("");

  const [weight, setWeight] = useState("");
  const [miles, setMiles] = useState("");
  const [distanceText, setDistanceText] = useState("");
  const [ratePerMile, setRatePerMile] = useState("1.50");

  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [description, setDescription] = useState("");

  const milesNumber = Number(miles || 0);
  const rateNumber = Number(ratePerMile || 0);
  const payoutAmount = milesNumber * rateNumber;

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
      stripeAccountId:
        nextCarrier.stripeAccountId || nextCarrier.stripe_account_id || "",
      stripe_account_id:
        nextCarrier.stripe_account_id || nextCarrier.stripeAccountId || "",
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

      if (error) {
        console.log("Post load freight profile error:", error.message);
      }

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
        email: normalize(dbCarrier.email || email),
        role: "freight",
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
        phone: dbCarrier.phone || stored?.phone || "",
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
      };

      await persistCarrier(mergedCarrier);

      if (!farmerName) setFarmerName(mergedCarrier.companyName || "");
      if (!contactName) setContactName(mergedCarrier.contactName || mergedCarrier.companyName || "");
      if (!contactPhone) setContactPhone(mergedCarrier.phone || "");
    } catch (error) {
      console.log("Load post freight profile error:", error);
      Alert.alert("Profile Error", "Unable to load freight profile.");
    } finally {
      setLoadingProfile(false);
    }
  }

  function selectEquipment(value: string) {
    setRequiredEquipment(value);

    if (value === "Livestock Trailer") setLoadType("Livestock");
    if (value === "Refrigerated Truck") setLoadType("Refrigerated Fresh Food");
    if (value === "Dry Van") setLoadType("Other");
  }

  async function calculateDistance() {
    if (!pickupLocation.trim() || !dropoffLocation.trim()) {
      Alert.alert("Missing Locations", "Please enter pickup and dropoff locations.");
      return;
    }

    if (!GOOGLE_MAPS_API_KEY) {
      Alert.alert(
        "Manual Miles Needed",
        "Google Maps API key is not connected yet. Please enter total miles manually."
      );
      return;
    }

    try {
      setCalculatingMiles(true);

      const origin = encodeURIComponent(pickupLocation.trim());
      const destination = encodeURIComponent(dropoffLocation.trim());

      const url =
        `https://maps.googleapis.com/maps/api/distancematrix/json` +
        `?origins=${origin}` +
        `&destinations=${destination}` +
        `&units=imperial` +
        `&key=${GOOGLE_MAPS_API_KEY}`;

      const response = await fetch(url);
      const data = await response.json();
      const element = data?.rows?.[0]?.elements?.[0];

      if (data?.status !== "OK") {
        Alert.alert("Google Maps Error", data?.error_message || `API status: ${data?.status || "Unknown"}`);
        return;
      }

      if (element?.status !== "OK") {
        Alert.alert("Route Error", `Route status: ${element?.status || "Unknown"}. Enter miles manually.`);
        return;
      }

      const meters = Number(element.distance?.value || 0);
      const calculatedMiles = meters / 1609.344;

      setMiles(calculatedMiles.toFixed(1));
      setDistanceText(element.distance?.text || `${calculatedMiles.toFixed(1)} miles`);

      Alert.alert("Distance Calculated", `${calculatedMiles.toFixed(1)} miles`);
    } catch (error: any) {
      console.log("Distance calculation error:", error);
      Alert.alert("Distance Error", error?.message || "Unable to calculate distance. Enter miles manually.");
    } finally {
      setCalculatingMiles(false);
    }
  }

  async function postLoad() {
    if (
      !farmerName.trim() ||
      !loadTitle.trim() ||
      !pickupLocation.trim() ||
      !dropoffLocation.trim() ||
      !pickupDate.trim() ||
      !pickupTime.trim() ||
      !contactName.trim() ||
      !contactPhone.trim()
    ) {
      Alert.alert("Missing Information", "Please complete all required fields.");
      return;
    }

    if (milesNumber <= 0) {
      Alert.alert("Missing Miles", "Please calculate or enter route miles.");
      return;
    }

    if (rateNumber < MIN_RATE_PER_MILE || rateNumber > MAX_RATE_PER_MILE) {
      Alert.alert("Invalid Rate", "Rate must be between $1.50 and $4.50 per mile.");
      return;
    }

    try {
      setPosting(true);

      const now = new Date().toISOString();
      const freightId = carrier?.id || carrier?.freightId || null;

      const payload = {
        title: loadTitle.trim(),
        farmer_name: farmerName.trim(),
        pickup_location: pickupLocation.trim(),
        dropoff_location: dropoffLocation.trim(),
        pickup_date: pickupDate.trim(),
        pickup_time: pickupTime.trim(),
        dropoff_date: dropoffDate.trim() || null,
        dropoff_time: dropoffTime.trim() || null,
        equipment_type: requiredEquipment,
        weight_lbs: Number(String(weight || "").replace(/[^0-9.]/g, "")) || null,
        temperature_required:
          requiredEquipment === "Refrigerated Truck" ? "Cool / Refrigerated" : null,
        rate: Number(payoutAmount.toFixed(2)),
        distance_miles: Number(milesNumber.toFixed(1)),
        commodity: loadType,
        notes: description.trim() || null,
        status: "available",
        created_by: freightId,
        posted_by_role: "freight",
        contact_name: contactName.trim(),
        contact_phone: contactPhone.trim(),
        created_at: now,
        updated_at: now,
      };

      const { data, error } = await supabase
        .from("freight_loads")
        .insert(payload)
        .select("id")
        .single();

      if (error) throw error;

      Alert.alert(
        "Load Posted",
        "Your freight load is now visible on the freight board.",
        [
          {
            text: "Open Freight Board",
            onPress: () =>
              router.replace({
                pathname: FREIGHT_ROUTES.board as any,
                params: { createdLoadId: data?.id || "" },
              }),
          },
        ]
      );
    } catch (error: any) {
      console.log("Post freight load error:", error);
      Alert.alert("Post Error", error?.message || "Unable to post freight load.");
    } finally {
      setPosting(false);
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

      <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>Farm2Home Freight Connect</Text>
              <Text style={styles.title}>Post Freight Load</Text>
              <Text style={styles.subtitle}>
                Create freight opportunities with route mileage, carrier payout, equipment type,
                and delivery details.
              </Text>
            </View>

            <TouchableOpacity style={styles.heroIcon} onPress={() => goTo(FREIGHT_ROUTES.board)}>
              <Ionicons name="add-circle-outline" size={34} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.quickGrid}>
            <QuickLink icon="grid-outline" label="Dashboard" route={FREIGHT_ROUTES.dashboard} />
            <QuickLink icon="list-outline" label="Load Board" route={FREIGHT_ROUTES.board} />
            <QuickLink icon="briefcase-outline" label="My Loads" route={FREIGHT_ROUTES.myLoads} />
            <QuickLink icon="pulse-outline" label="Live Loads" route={FREIGHT_ROUTES.liveLoads} />
          </View>

          <View style={styles.card}>
            <SectionHeader
              icon="business-outline"
              title="Load Owner"
              subtitle="Who is posting or coordinating this freight load."
            />

            <Label text="Farm / Business Name" />
            <TextInput
              style={styles.input}
              value={farmerName}
              onChangeText={setFarmerName}
              placeholder="Farm / Business Name"
              placeholderTextColor="#94A3B8"
            />

            <Label text="Load Title" />
            <TextInput
              style={styles.input}
              value={loadTitle}
              onChangeText={setLoadTitle}
              placeholder="Load Title"
              placeholderTextColor="#94A3B8"
            />

            <Label text="Contact Name" />
            <TextInput
              style={styles.input}
              value={contactName}
              onChangeText={setContactName}
              placeholder="Contact Name"
              placeholderTextColor="#94A3B8"
            />

            <Label text="Contact Phone" />
            <TextInput
              style={styles.input}
              value={contactPhone}
              onChangeText={setContactPhone}
              placeholder="Contact Phone"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.card}>
            <SectionHeader
              icon="car-outline"
              title="Equipment"
              subtitle="Choose the equipment needed for this load."
            />

            {["Livestock Trailer", "Refrigerated Truck", "Dry Van"].map((item) => (
              <TouchableOpacity
                key={item}
                style={[
                  styles.equipmentButton,
                  requiredEquipment === item && styles.equipmentButtonActive,
                ]}
                onPress={() => selectEquipment(item)}
              >
                <Ionicons
                  name={
                    item === "Livestock Trailer"
                      ? "paw-outline"
                      : item === "Refrigerated Truck"
                      ? "snow-outline"
                      : "cube-outline"
                  }
                  size={19}
                  color={requiredEquipment === item ? "#FFFFFF" : COLORS.red}
                />
                <Text
                  style={[
                    styles.equipmentButtonText,
                    requiredEquipment === item && styles.equipmentButtonTextActive,
                  ]}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            ))}

            <Label text="Load Description" />
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Load Description"
              placeholderTextColor="#94A3B8"
              multiline
            />

            <Label text="Weight" />
            <TextInput
              style={styles.input}
              value={weight}
              onChangeText={setWeight}
              placeholder="Weight in pounds"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
            />
          </View>

          <View style={styles.card}>
            <SectionHeader
              icon="map-outline"
              title="Route"
              subtitle="Pickup, dropoff, dates, and route distance."
            />

            <Label text="Pickup Location / Origin" />
            <TextInput
              style={styles.input}
              value={pickupLocation}
              onChangeText={setPickupLocation}
              placeholder="Pickup Location / Origin"
              placeholderTextColor="#94A3B8"
            />

            <Label text="Dropoff Location / Destination" />
            <TextInput
              style={styles.input}
              value={dropoffLocation}
              onChangeText={setDropoffLocation}
              placeholder="Dropoff Location / Destination"
              placeholderTextColor="#94A3B8"
            />

            <TouchableOpacity style={styles.calculateButton} onPress={calculateDistance}>
              {calculatingMiles ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="navigate-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.calculateButtonText}>Calculate Distance & Miles</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.distanceBox}>
              <Text style={styles.distanceTitle}>Distance & Payout</Text>
              <Text style={styles.distanceText}>{distanceText || "Distance not calculated yet"}</Text>

              <Label text="Total Miles" />
              <TextInput
                style={styles.input}
                value={miles}
                onChangeText={setMiles}
                placeholder="Total Miles"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
              />

              <Label text="Rate Per Mile" />
              <TextInput
                style={styles.input}
                value={ratePerMile}
                onChangeText={setRatePerMile}
                placeholder="Rate Per Mile"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
              />

              <View style={styles.rateButtonsRow}>
                <TouchableOpacity style={styles.rateButton} onPress={() => setRatePerMile("1.50")}>
                  <Text style={styles.rateButtonText}>Minimum $1.50 / mile</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.rateButton} onPress={() => setRatePerMile("4.50")}>
                  <Text style={styles.rateButtonText}>Maximum $4.50 / mile</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.payoutText}>
                {milesNumber.toFixed(1)} miles × ${rateNumber.toFixed(2)} / mile
              </Text>

              <Text style={styles.totalPayout}>Carrier Payout: ${payoutAmount.toFixed(2)}</Text>
            </View>

            <Label text="Pickup Date" />
            <TextInput
              style={styles.input}
              value={pickupDate}
              onChangeText={setPickupDate}
              placeholder="Pickup Date"
              placeholderTextColor="#94A3B8"
            />

            <Label text="Pickup Time" />
            <TextInput
              style={styles.input}
              value={pickupTime}
              onChangeText={setPickupTime}
              placeholder="Pickup Time"
              placeholderTextColor="#94A3B8"
            />

            <Label text="Dropoff Date Optional" />
            <TextInput
              style={styles.input}
              value={dropoffDate}
              onChangeText={setDropoffDate}
              placeholder="Dropoff Date"
              placeholderTextColor="#94A3B8"
            />

            <Label text="Dropoff Time Optional" />
            <TextInput
              style={styles.input}
              value={dropoffTime}
              onChangeText={setDropoffTime}
              placeholder="Dropoff Time"
              placeholderTextColor="#94A3B8"
            />
          </View>

          <TouchableOpacity
            style={[styles.postButton, posting && styles.disabledButton]}
            onPress={postLoad}
            disabled={posting}
          >
            {posting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={18} color="#FFFFFF" />
                <Text style={styles.postButtonText}>Post Freight Load</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.darkButton} onPress={() => goTo(FREIGHT_ROUTES.board)}>
            <Ionicons name="list-outline" size={18} color="#FFFFFF" />
            <Text style={styles.postButtonText}>Back to Freight Board</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
  page: { flex: 1, backgroundColor: COLORS.bg },
  container: { flex: 1, backgroundColor: COLORS.bg },
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
    paddingTop: 28,
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
  subtitle: { color: "#D1D5DB", lineHeight: 22, fontSize: 14, fontWeight: "700" },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 18,
    marginTop: 18,
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
  label: { fontWeight: "900", marginBottom: 7, color: COLORS.text },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    color: COLORS.text,
    fontWeight: "700",
  },
  textArea: { minHeight: 100, textAlignVertical: "top" },
  equipmentButton: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.red,
    borderRadius: 14,
    padding: 15,
    alignItems: "center",
    marginBottom: 10,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
  },
  equipmentButtonActive: { backgroundColor: COLORS.red },
  equipmentButtonText: { color: COLORS.red, fontWeight: "900" },
  equipmentButtonTextActive: { color: "#FFFFFF" },
  calculateButton: {
    backgroundColor: COLORS.black,
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    flexDirection: "row",
    gap: 8,
  },
  calculateButtonText: { color: "#FFFFFF", fontWeight: "900" },
  distanceBox: {
    backgroundColor: "#FFF1F2",
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  distanceTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: COLORS.red,
    marginBottom: 10,
  },
  distanceText: {
    color: COLORS.muted,
    marginBottom: 14,
    fontWeight: "700",
  },
  rateButtonsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  rateButton: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.red,
    borderRadius: 12,
    padding: 13,
    alignItems: "center",
  },
  rateButtonText: {
    color: COLORS.red,
    fontWeight: "900",
    textAlign: "center",
  },
  payoutText: {
    color: COLORS.muted,
    fontWeight: "800",
    marginBottom: 10,
  },
  totalPayout: {
    fontSize: 28,
    fontWeight: "900",
    color: COLORS.red,
  },
  postButton: {
    backgroundColor: COLORS.red,
    borderRadius: 16,
    padding: 17,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 18,
    marginTop: 4,
    flexDirection: "row",
    gap: 8,
  },
  darkButton: {
    backgroundColor: COLORS.black,
    borderRadius: 16,
    padding: 17,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 18,
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
  },
  disabledButton: { opacity: 0.65 },
  postButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 15,
  },
});