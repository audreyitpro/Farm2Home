// app/farmer/post-load.tsx

import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";

import { supabase } from "../services/supabaseClient";

const COLORS = {
  bg: "#F5F7FB",
  card: "#FFFFFF",
  text: "#101828",
  muted: "#667085",
  border: "#E5E7EB",
  navy: "#07111F",
  navy2: "#111827",
  green: "#16A34A",
  greenDark: "#14532D",
  greenSoft: "#DCFCE7",
  blue: "#2563EB",
  blueSoft: "#DBEAFE",
  orange: "#F59E0B",
  orangeSoft: "#FEF3C7",
  red: "#EF4444",
  redSoft: "#FEE2E2",
  purple: "#635BFF",
  purpleSoft: "#EEF2FF",
  white: "#FFFFFF",
};

type LoadType = "Livestock" | "Refrigerated Fresh Food" | "Other";
type Priority = "standard" | "rush" | "scheduled";

const MIN_RATE_PER_MILE = 1.5;
const MAX_RATE_PER_MILE = 3.5;

const EQUIPMENT_OPTIONS = [
  {
    label: "Refrigerated Truck",
    type: "Refrigerated Fresh Food" as LoadType,
    icon: "snow-outline",
    description: "Produce, meat, seafood, dairy, frozen, or cooled items.",
  },
  {
    label: "Livestock Trailer",
    type: "Livestock" as LoadType,
    icon: "paw-outline",
    description: "Livestock, animals, farm transport, and agriculture hauls.",
  },
  {
    label: "Dry Van",
    type: "Other" as LoadType,
    icon: "cube-outline",
    description: "Packaged goods, farm supplies, hay, equipment, or dry freight.",
  },
  {
    label: "Box Truck",
    type: "Other" as LoadType,
    icon: "bus-outline",
    description: "Local farm deliveries, palletized orders, and store drop-offs.",
  },
];

const COMMODITY_OPTIONS = [
  "Fresh Produce",
  "Meat",
  "Seafood",
  "Dairy",
  "Eggs",
  "Livestock",
  "Hay & Feed",
  "Farm Supplies",
  "Mixed Farm Goods",
];

function clean(value: any) {
  return String(value ?? "").trim();
}

function money(value: any) {
  const amount = Number(value || 0);
  return `$${amount.toFixed(2)}`;
}

function getParamString(value: any) {
  if (Array.isArray(value)) return clean(value[0]);
  return clean(value);
}

function makeTempRouteDistance(pickup: string, dropoff: string) {
  const seed = `${pickup}-${dropoff}`.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return Math.max(8, Math.round((seed % 165) + 18));
}

export default function FarmerPostLoadScreen() {
  const params = useLocalSearchParams();
  const farmerIdParam = getParamString(params.farmerId || params.farmer_id);

  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  const [farmerId, setFarmerId] = useState(farmerIdParam);
  const [farmerName, setFarmerName] = useState("Farm2Home Farm");
  const [farmerEmail, setFarmerEmail] = useState("");

  const [loadTitle, setLoadTitle] = useState("Fresh Produce Delivery");
  const [loadType, setLoadType] = useState<LoadType>("Refrigerated Fresh Food");
  const [requiredEquipment, setRequiredEquipment] = useState("Refrigerated Truck");
  const [commodity, setCommodity] = useState("Fresh Produce");
  const [priority, setPriority] = useState<Priority>("standard");

  const [pickupLocation, setPickupLocation] = useState("");
  const [pickupAddress, setPickupAddress] = useState("");
  const [dropoffLocation, setDropoffLocation] = useState("");
  const [dropoffAddress, setDropoffAddress] = useState("");

  const [pickupDate, setPickupDate] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [dropoffDate, setDropoffDate] = useState("");
  const [dropoffTime, setDropoffTime] = useState("");

  const [weight, setWeight] = useState("");
  const [pieces, setPieces] = useState("");
  const [pallets, setPallets] = useState("");
  const [miles, setMiles] = useState("");
  const [ratePerMile, setRatePerMile] = useState("1.75");

  const [temperatureMin, setTemperatureMin] = useState("34");
  const [temperatureMax, setTemperatureMax] = useState("40");
  const [requiresLiftgate, setRequiresLiftgate] = useState(false);
  const [requiresPalletJack, setRequiresPalletJack] = useState(false);
  const [proofOfDeliveryRequired, setProofOfDeliveryRequired] = useState(true);
  const [insuranceRequired, setInsuranceRequired] = useState(true);

  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    initialize();
  }, []);

  const milesNumber = Number(miles || 0);
  const rateNumber = Number(ratePerMile || 0);
  const payoutAmount = milesNumber * rateNumber;
  const isRefrigerated = loadType === "Refrigerated Fresh Food" || requiredEquipment === "Refrigerated Truck";

  const selectedEquipment = useMemo(() => {
    return EQUIPMENT_OPTIONS.find((item) => item.label === requiredEquipment) || EQUIPMENT_OPTIONS[0];
  }, [requiredEquipment]);

  const completion = useMemo(() => {
    const required = [
      farmerName,
      loadTitle,
      pickupLocation,
      pickupAddress,
      dropoffLocation,
      dropoffAddress,
      pickupDate,
      pickupTime,
      contactName,
      contactPhone,
      milesNumber > 0 ? "ok" : "",
      rateNumber >= MIN_RATE_PER_MILE && rateNumber <= MAX_RATE_PER_MILE ? "ok" : "",
    ];

    const complete = required.filter((item) => clean(item)).length;
    return Math.round((complete / required.length) * 100);
  }, [farmerName, loadTitle, pickupLocation, pickupAddress, dropoffLocation, dropoffAddress, pickupDate, pickupTime, contactName, contactPhone, milesNumber, rateNumber]);

  const readyToPost = completion === 100;

  async function initialize() {
    try {
      setLoading(true);

      const saved =
        (await AsyncStorage.getItem("currentFarmer")) ||
        (await AsyncStorage.getItem("farm2homeCurrentFarmer")) ||
        (await AsyncStorage.getItem("farm2homeFarmerSession")) ||
        (await AsyncStorage.getItem("currentUser"));

      if (saved) {
        const farmer = JSON.parse(saved);
        const id = clean(farmerIdParam || farmer.id || farmer.farmerId || farmer.farmer_id || farmer.profile_id);
        const name = clean(farmer.farmName || farmer.farm_name || farmer.businessName || farmer.business_name || farmer.name || "Farm2Home Farm");
        const email = clean(farmer.email || farmer.farmer_email || "");
        const phone = clean(farmer.phone || farmer.phone_number || farmer.business_phone || "");
        const farmAddress = clean(farmer.farm_address || farmer.address || farmer.location || farmer.city || "");

        setFarmerId(id);
        setFarmerName(name);
        setFarmerEmail(email);
        setContactName(clean(farmer.full_name || farmer.owner_name || farmer.contact_name || name));
        setContactPhone(phone);
        setPickupLocation(name);
        setPickupAddress(farmAddress);
      }
    } catch (error) {
      console.log("Post load initialize skipped:", error);
    } finally {
      setLoading(false);
    }
  }

  function selectEquipment(value: string) {
    const selected = EQUIPMENT_OPTIONS.find((item) => item.label === value);
    setRequiredEquipment(value);

    if (selected) {
      setLoadType(selected.type);
      if (selected.type === "Livestock") setCommodity("Livestock");
      if (selected.type === "Refrigerated Fresh Food" && commodity === "Livestock") setCommodity("Fresh Produce");
    }
  }

  function estimateMiles() {
    if (!pickupAddress.trim() || !dropoffAddress.trim()) {
      Alert.alert("Route Needed", "Enter pickup and dropoff addresses first.");
      return;
    }

    const estimated = makeTempRouteDistance(pickupAddress, dropoffAddress);
    setMiles(String(estimated));
  }

  function setRatePreset(value: string) {
    setRatePerMile(value);
  }

  async function postLoad() {
    if (!readyToPost) {
      Alert.alert("Missing Load Details", "Complete farm, route, schedule, contact, miles, and valid rate before posting.");
      return;
    }

    try {
      setPosting(true);
      const now = new Date().toISOString();
      const temperatureRequired = isRefrigerated ? `${temperatureMin || "34"}-${temperatureMax || "40"}°F` : "Ambient";

      const insertPayload = {
        farmer_id: farmerId || null,
        farmer_name: farmerName.trim(),
        farmer_email: farmerEmail || null,
        title: loadTitle.trim(),
        commodity,
        load_type: loadType,
        equipment_type: requiredEquipment,
        pickup_location: pickupLocation.trim(),
        pickup_address: pickupAddress.trim(),
        dropoff_location: dropoffLocation.trim(),
        dropoff_address: dropoffAddress.trim(),
        pickup_date: pickupDate.trim(),
        pickup_time: pickupTime.trim(),
        dropoff_date: dropoffDate.trim() || null,
        dropoff_time: dropoffTime.trim() || null,
        weight_lbs: Number(weight || 0) || null,
        pieces: Number(pieces || 0) || null,
        pallets: Number(pallets || 0) || null,
        distance_miles: Number(milesNumber.toFixed(1)),
        rate_per_mile: Number(rateNumber.toFixed(2)),
        rate: Number(payoutAmount.toFixed(2)),
        payout_amount: Number(payoutAmount.toFixed(2)),
        temperature_required: temperatureRequired,
        priority,
        requires_liftgate: requiresLiftgate,
        requires_pallet_jack: requiresPalletJack,
        proof_of_delivery_required: proofOfDeliveryRequired,
        insurance_required: insuranceRequired,
        contact_name: contactName.trim(),
        contact_phone: contactPhone.trim(),
        notes: description.trim(),
        description: description.trim(),
        status: "available",
        source: "farmer_post_load",
        posted_by_role: "farmer",
        created_at: now,
        updated_at: now,
      };

      const { data, error } = await supabase
        .from("freight_loads")
        .insert(insertPayload)
        .select("id")
        .single();

      if (error) throw error;

      Alert.alert("Load Posted", "Your farm load is now available on the live freight board.", [
        {
          text: "View Live Board",
          onPress: () =>
            router.replace({
              pathname: "/freight/board" as any,
              params: { createdLoadId: data?.id },
            }),
        },
      ]);
    } catch (error: any) {
      Alert.alert("Post Error", error?.message || "Unable to post freight load.");
    } finally {
      setPosting(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.green} />
        <Text style={styles.centerText}>Loading load builder...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView style={styles.page} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.topRow}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.push("/farmer/dashboard" as any)}>
              <Ionicons name="arrow-back-outline" size={22} color={COLORS.white} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.boardButtonTop} onPress={() => router.replace("/freight/board" as any)}>
              <Ionicons name="trail-sign-outline" size={16} color={COLORS.navy} />
              <Text style={styles.boardButtonTopText}>Board</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.heroMainRow}>
            <View style={styles.heroIcon}>
              <Ionicons name={selectedEquipment.icon as any} size={30} color={COLORS.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>Farm2Home Logistics</Text>
              <Text style={styles.title}>Post Farm Load</Text>
              <Text style={styles.subtitle}>Create a driver-ready load with route, payout, equipment, map preview, and delivery requirements.</Text>
            </View>
          </View>
        </View>

        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <View>
              <Text style={styles.progressTitle}>Load Setup Progress</Text>
              <Text style={styles.progressSub}>{readyToPost ? "Ready to post" : "Complete all required fields"}</Text>
            </View>
            <Text style={styles.progressPercent}>{completion}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${completion}%` }]} />
          </View>
        </View>

        <View style={styles.mapCard}>
          <View style={styles.mapHeaderRow}>
            <View>
              <Text style={styles.mapTitle}>Route Map Preview</Text>
              <Text style={styles.mapSub}>Pickup to delivery route summary</Text>
            </View>
            <TouchableOpacity style={styles.estimateButton} onPress={estimateMiles}>
              <Ionicons name="navigate-outline" size={16} color={COLORS.greenDark} />
              <Text style={styles.estimateText}>Estimate Miles</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.fakeMap}>
            <View style={styles.mapPinStart}>
              <Ionicons name="home-outline" size={18} color={COLORS.white} />
            </View>
            <View style={styles.routeLine} />
            <View style={styles.routeDot} />
            <View style={styles.mapPinEnd}>
              <Ionicons name="flag-outline" size={18} color={COLORS.white} />
            </View>
          </View>

          <View style={styles.routeSummaryRow}>
            <RoutePoint label="Pickup" value={pickupAddress || pickupLocation || "Enter pickup address"} color={COLORS.green} />
            <RoutePoint label="Dropoff" value={dropoffAddress || dropoffLocation || "Enter dropoff address"} color={COLORS.purple} />
          </View>
        </View>

        <View style={styles.previewGrid}>
          <MetricCard label="Payout" value={money(payoutAmount)} icon="cash-outline" />
          <MetricCard label="Miles" value={milesNumber ? milesNumber.toFixed(1) : "0"} icon="speedometer-outline" />
          <MetricCard label="Rate/Mile" value={money(rateNumber)} icon="pricetag-outline" />
          <MetricCard label="Equipment" value={requiredEquipment} icon={selectedEquipment.icon as any} small />
        </View>

        <View style={styles.card}>
          <SectionTitle step="Step 1" title="Farm Load Details" subtitle="Tell drivers what they are hauling and what equipment is required." />

          <TextInput style={styles.input} value={farmerName} onChangeText={setFarmerName} placeholder="Farm / Business Name" placeholderTextColor="#94A3B8" />
          <TextInput style={styles.input} value={loadTitle} onChangeText={setLoadTitle} placeholder="Load Title" placeholderTextColor="#94A3B8" />

          <Text style={styles.label}>Commodity</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {COMMODITY_OPTIONS.map((item) => (
              <Chip key={item} label={item} active={commodity === item} onPress={() => setCommodity(item)} />
            ))}
          </ScrollView>

          <Text style={styles.label}>Required Equipment</Text>
          {EQUIPMENT_OPTIONS.map((item) => {
            const active = requiredEquipment === item.label;
            return (
              <TouchableOpacity key={item.label} style={[styles.equipmentCard, active && styles.equipmentCardActive]} onPress={() => selectEquipment(item.label)} activeOpacity={0.9}>
                <View style={[styles.equipmentIcon, active && styles.equipmentIconActive]}>
                  <Ionicons name={item.icon as any} size={22} color={active ? COLORS.white : COLORS.greenDark} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.equipmentTitle, active && styles.equipmentTitleActive]}>{item.label}</Text>
                  <Text style={[styles.equipmentDescription, active && styles.equipmentDescriptionActive]}>{item.description}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.card}>
          <SectionTitle step="Step 2" title="Pickup & Dropoff" subtitle="Add location names and full addresses for navigation." />

          <TextInput style={styles.input} value={pickupLocation} onChangeText={setPickupLocation} placeholder="Pickup Location Name" placeholderTextColor="#94A3B8" />
          <TextInput style={[styles.input, styles.textAreaSmall]} value={pickupAddress} onChangeText={setPickupAddress} placeholder="Pickup Full Address" placeholderTextColor="#94A3B8" multiline />
          <TextInput style={styles.input} value={dropoffLocation} onChangeText={setDropoffLocation} placeholder="Dropoff Location Name" placeholderTextColor="#94A3B8" />
          <TextInput style={[styles.input, styles.textAreaSmall]} value={dropoffAddress} onChangeText={setDropoffAddress} placeholder="Dropoff Full Address" placeholderTextColor="#94A3B8" multiline />
        </View>

        <View style={styles.card}>
          <SectionTitle step="Step 3" title="Schedule & Priority" subtitle="Set pickup timing and service priority." />

          <View style={styles.twoCol}>
            <TextInput style={[styles.input, styles.flexInput]} value={pickupDate} onChangeText={setPickupDate} placeholder="Pickup Date" placeholderTextColor="#94A3B8" />
            <TextInput style={[styles.input, styles.flexInput]} value={pickupTime} onChangeText={setPickupTime} placeholder="Pickup Time" placeholderTextColor="#94A3B8" />
          </View>

          <View style={styles.twoCol}>
            <TextInput style={[styles.input, styles.flexInput]} value={dropoffDate} onChangeText={setDropoffDate} placeholder="Dropoff Date" placeholderTextColor="#94A3B8" />
            <TextInput style={[styles.input, styles.flexInput]} value={dropoffTime} onChangeText={setDropoffTime} placeholder="Dropoff Time" placeholderTextColor="#94A3B8" />
          </View>

          <Text style={styles.label}>Priority</Text>
          <View style={styles.segmentRow}>
            <Segment label="Standard" active={priority === "standard"} onPress={() => setPriority("standard")} />
            <Segment label="Rush" active={priority === "rush"} onPress={() => setPriority("rush")} />
            <Segment label="Scheduled" active={priority === "scheduled"} onPress={() => setPriority("scheduled")} />
          </View>
        </View>

        <View style={styles.card}>
          <SectionTitle step="Step 4" title="Load Size & Requirements" subtitle="Give drivers the essentials before they accept." />

          <View style={styles.twoCol}>
            <TextInput style={[styles.input, styles.flexInput]} value={weight} onChangeText={setWeight} placeholder="Weight lbs" placeholderTextColor="#94A3B8" keyboardType="numeric" />
            <TextInput style={[styles.input, styles.flexInput]} value={pallets} onChangeText={setPallets} placeholder="Pallets" placeholderTextColor="#94A3B8" keyboardType="numeric" />
          </View>
          <TextInput style={styles.input} value={pieces} onChangeText={setPieces} placeholder="Pieces / Cases / Boxes" placeholderTextColor="#94A3B8" keyboardType="numeric" />

          {isRefrigerated ? (
            <View style={styles.tempBox}>
              <Text style={styles.tempTitle}>Temperature Range</Text>
              <View style={styles.twoColNoMargin}>
                <TextInput style={[styles.input, styles.flexInput]} value={temperatureMin} onChangeText={setTemperatureMin} placeholder="Min °F" placeholderTextColor="#94A3B8" keyboardType="numeric" />
                <TextInput style={[styles.input, styles.flexInput]} value={temperatureMax} onChangeText={setTemperatureMax} placeholder="Max °F" placeholderTextColor="#94A3B8" keyboardType="numeric" />
              </View>
            </View>
          ) : null}

          <ToggleRow label="Liftgate Required" value={requiresLiftgate} onValueChange={setRequiresLiftgate} />
          <ToggleRow label="Pallet Jack Required" value={requiresPalletJack} onValueChange={setRequiresPalletJack} />
          <ToggleRow label="Proof of Delivery Required" value={proofOfDeliveryRequired} onValueChange={setProofOfDeliveryRequired} />
          <ToggleRow label="Insurance Required" value={insuranceRequired} onValueChange={setInsuranceRequired} />
        </View>

        <View style={styles.card}>
          <SectionTitle step="Step 5" title="Rate & Payout" subtitle={`Allowed range: ${money(MIN_RATE_PER_MILE)} to ${money(MAX_RATE_PER_MILE)} per mile.`} />

          <View style={styles.twoCol}>
            <TextInput style={[styles.input, styles.flexInput]} value={miles} onChangeText={setMiles} placeholder="Total Miles" placeholderTextColor="#94A3B8" keyboardType="numeric" />
            <TextInput style={[styles.input, styles.flexInput]} value={ratePerMile} onChangeText={setRatePerMile} placeholder="Rate / Mile" placeholderTextColor="#94A3B8" keyboardType="numeric" />
          </View>

          <View style={styles.rateRow}>
            <TouchableOpacity style={styles.rateButton} onPress={() => setRatePreset("1.50")}><Text style={styles.rateButtonText}>Min $1.50</Text></TouchableOpacity>
            <TouchableOpacity style={styles.rateButton} onPress={() => setRatePreset("2.25")}><Text style={styles.rateButtonText}>Good $2.25</Text></TouchableOpacity>
            <TouchableOpacity style={styles.rateButton} onPress={() => setRatePreset("3.50")}><Text style={styles.rateButtonText}>Max $3.50</Text></TouchableOpacity>
          </View>

          <View style={styles.payoutBox}>
            <Text style={styles.payoutText}>{milesNumber.toFixed(1)} miles × {money(rateNumber)} / mile</Text>
            <Text style={styles.totalPayout}>Carrier Payout: {money(payoutAmount)}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <SectionTitle step="Step 6" title="Contact & Notes" subtitle="Add contact and instructions drivers should know." />
          <TextInput style={styles.input} value={contactName} onChangeText={setContactName} placeholder="Contact Name" placeholderTextColor="#94A3B8" />
          <TextInput style={styles.input} value={contactPhone} onChangeText={setContactPhone} placeholder="Contact Phone" placeholderTextColor="#94A3B8" keyboardType="phone-pad" />
          <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription} placeholder="Load description, dock notes, handling instructions, delivery notes..." placeholderTextColor="#94A3B8" multiline />
        </View>

        <TouchableOpacity style={[styles.postButton, (!readyToPost || posting) && styles.disabledButton]} onPress={postLoad} disabled={!readyToPost || posting}>
          {posting ? <ActivityIndicator color={COLORS.white} /> : <><Ionicons name="trail-sign-outline" size={20} color={COLORS.white} /><Text style={styles.postButtonText}>Post Load to Live Board</Text></>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.boardLink} onPress={() => router.replace("/freight/board" as any)}>
          <Text style={styles.linkText}>Open Live Load Board</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SectionTitle({ step, title, subtitle }: { step: string; title: string; subtitle: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.stepText}>{step}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionSub}>{subtitle}</Text>
    </View>
  );
}

function RoutePoint({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.routePoint}>
      <View style={[styles.routePointDot, { backgroundColor: color }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.routePointLabel}>{label}</Text>
        <Text style={styles.routePointText} numberOfLines={2}>{value}</Text>
      </View>
    </View>
  );
}

function MetricCard({ label, value, icon, small }: { label: string; value: string; icon: keyof typeof Ionicons.glyphMap; small?: boolean }) {
  return (
    <View style={styles.metricCard}>
      <Ionicons name={icon} size={18} color={COLORS.purple} />
      <Text style={[styles.metricValue, small && styles.metricSmall]} numberOfLines={1}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Segment({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.segment, active && styles.segmentActive]} onPress={onPress}>
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ToggleRow({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (value: boolean) => void }) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingBottom: 100 },
  center: { flex: 1, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center" },
  centerText: { marginTop: 10, color: COLORS.muted, fontWeight: "800" },

  hero: { backgroundColor: COLORS.navy, paddingTop: 56, paddingHorizontal: 18, paddingBottom: 28, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
  backButton: { width: 44, height: 44, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" },
  boardButtonTop: { backgroundColor: COLORS.white, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 9, flexDirection: "row", alignItems: "center", gap: 6 },
  boardButtonTopText: { color: COLORS.navy, fontWeight: "900" },
  heroMainRow: { flexDirection: "row", gap: 14, alignItems: "center" },
  heroIcon: { width: 62, height: 62, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.16)", justifyContent: "center", alignItems: "center" },
  eyebrow: { color: "#A5B4FC", fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.7, fontSize: 12 },
  title: { color: COLORS.white, fontSize: 31, fontWeight: "900", marginTop: 4, lineHeight: 36 },
  subtitle: { color: "#E0E7FF", lineHeight: 21, marginTop: 6, fontWeight: "700" },

  progressCard: { backgroundColor: COLORS.card, marginHorizontal: 18, marginTop: -18, borderRadius: 22, padding: 16, borderWidth: 1, borderColor: COLORS.border },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", gap: 12, marginBottom: 10 },
  progressTitle: { color: COLORS.text, fontWeight: "900", fontSize: 18 },
  progressSub: { color: COLORS.muted, fontWeight: "700", marginTop: 3 },
  progressPercent: { color: COLORS.purple, fontWeight: "900", fontSize: 24 },
  progressTrack: { height: 10, backgroundColor: COLORS.purpleSoft, borderRadius: 999, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: COLORS.purple, borderRadius: 999 },

  mapCard: { backgroundColor: COLORS.card, margin: 18, marginBottom: 12, borderRadius: 24, padding: 16, borderWidth: 1, borderColor: COLORS.border },
  mapHeaderRow: { flexDirection: "row", justifyContent: "space-between", gap: 12, marginBottom: 12 },
  mapTitle: { color: COLORS.text, fontWeight: "900", fontSize: 20 },
  mapSub: { color: COLORS.muted, fontWeight: "700", marginTop: 3 },
  estimateButton: { backgroundColor: COLORS.greenSoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start" },
  estimateText: { color: COLORS.greenDark, fontWeight: "900", fontSize: 12 },
  fakeMap: { height: 170, borderRadius: 22, backgroundColor: "#EAF2FF", overflow: "hidden", justifyContent: "center", paddingHorizontal: 36, marginBottom: 14 },
  mapPinStart: { position: "absolute", left: 32, top: 46, width: 42, height: 42, borderRadius: 16, backgroundColor: COLORS.green, alignItems: "center", justifyContent: "center", zIndex: 3 },
  mapPinEnd: { position: "absolute", right: 32, bottom: 42, width: 42, height: 42, borderRadius: 16, backgroundColor: COLORS.purple, alignItems: "center", justifyContent: "center", zIndex: 3 },
  routeLine: { height: 4, backgroundColor: COLORS.purple, borderRadius: 999, transform: [{ rotate: "-10deg" }] },
  routeDot: { position: "absolute", left: "50%", top: 72, width: 18, height: 18, borderRadius: 999, backgroundColor: COLORS.orange, borderWidth: 3, borderColor: COLORS.white },
  routeSummaryRow: { gap: 10 },
  routePoint: { flexDirection: "row", gap: 10, alignItems: "flex-start", backgroundColor: COLORS.bg, borderRadius: 16, padding: 12 },
  routePointDot: { width: 12, height: 12, borderRadius: 999, marginTop: 4 },
  routePointLabel: { color: COLORS.muted, fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  routePointText: { color: COLORS.text, fontWeight: "800", lineHeight: 19, marginTop: 2 },

  previewGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginHorizontal: 18, marginBottom: 12 },
  metricCard: { flexGrow: 1, width: "47%", backgroundColor: COLORS.card, borderRadius: 20, padding: 14, borderWidth: 1, borderColor: COLORS.border },
  metricValue: { color: COLORS.text, fontWeight: "900", fontSize: 22, marginTop: 7 },
  metricSmall: { fontSize: 15 },
  metricLabel: { color: COLORS.muted, fontWeight: "800", marginTop: 3, fontSize: 12 },

  card: { backgroundColor: COLORS.card, marginHorizontal: 18, marginBottom: 14, borderRadius: 24, padding: 16, borderWidth: 1, borderColor: COLORS.border },
  sectionHeader: { marginBottom: 12 },
  stepText: { color: COLORS.purple, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 4, fontSize: 12 },
  sectionTitle: { color: COLORS.text, fontSize: 22, fontWeight: "900" },
  sectionSub: { color: COLORS.muted, fontWeight: "700", lineHeight: 20, marginTop: 4 },
  label: { fontWeight: "900", marginBottom: 10, color: COLORS.text, fontSize: 15 },
  input: { backgroundColor: "#F9FAFB", borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 16, padding: 14, marginBottom: 12, color: COLORS.text, fontWeight: "800" },
  textArea: { minHeight: 105, textAlignVertical: "top" },
  textAreaSmall: { minHeight: 76, textAlignVertical: "top" },
  twoCol: { flexDirection: "row", gap: 10 },
  twoColNoMargin: { flexDirection: "row", gap: 10 },
  flexInput: { flex: 1 },
  chipRow: { gap: 8, paddingBottom: 12 },
  chip: { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 9 },
  chipActive: { backgroundColor: COLORS.purple, borderColor: COLORS.purple },
  chipText: { color: COLORS.purple, fontWeight: "900" },
  chipTextActive: { color: COLORS.white },

  equipmentCard: { backgroundColor: "#F9FAFB", borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 18, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  equipmentCardActive: { backgroundColor: COLORS.greenDark, borderColor: COLORS.greenDark },
  equipmentIcon: { width: 46, height: 46, borderRadius: 16, backgroundColor: COLORS.greenSoft, alignItems: "center", justifyContent: "center" },
  equipmentIconActive: { backgroundColor: "rgba(255,255,255,0.18)" },
  equipmentTitle: { color: COLORS.text, fontWeight: "900", fontSize: 16 },
  equipmentTitleActive: { color: COLORS.white },
  equipmentDescription: { color: COLORS.muted, fontWeight: "700", lineHeight: 19, marginTop: 3 },
  equipmentDescriptionActive: { color: "#DCFCE7" },

  segmentRow: { flexDirection: "row", backgroundColor: COLORS.purpleSoft, borderRadius: 16, padding: 5, gap: 4 },
  segment: { flex: 1, borderRadius: 13, paddingVertical: 11, alignItems: "center" },
  segmentActive: { backgroundColor: COLORS.purple },
  segmentText: { color: COLORS.purple, fontWeight: "900", fontSize: 12 },
  segmentTextActive: { color: COLORS.white },
  tempBox: { backgroundColor: COLORS.blueSoft, borderRadius: 18, padding: 12, marginBottom: 12 },
  tempTitle: { color: COLORS.blue, fontWeight: "900", marginBottom: 10 },
  toggleRow: { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, padding: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 9 },
  toggleLabel: { color: COLORS.text, fontWeight: "900" },

  rateRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  rateButton: { flex: 1, backgroundColor: COLORS.greenSoft, borderRadius: 14, padding: 12, alignItems: "center" },
  rateButtonText: { color: COLORS.greenDark, fontWeight: "900", textAlign: "center" },
  payoutBox: { backgroundColor: COLORS.greenSoft, borderRadius: 18, padding: 15 },
  payoutText: { color: COLORS.greenDark, fontWeight: "800", marginBottom: 6 },
  totalPayout: { fontSize: 25, fontWeight: "900", color: COLORS.greenDark },

  postButton: { backgroundColor: COLORS.purple, borderRadius: 18, padding: 18, alignItems: "center", justifyContent: "center", marginHorizontal: 18, marginTop: 2, flexDirection: "row", gap: 9 },
  postButtonText: { color: COLORS.white, fontWeight: "900", fontSize: 16 },
  disabledButton: { opacity: 0.55 },
  boardLink: { paddingVertical: 18, alignItems: "center" },
  linkText: { color: COLORS.purple, fontWeight: "900", textAlign: "center" },
});
