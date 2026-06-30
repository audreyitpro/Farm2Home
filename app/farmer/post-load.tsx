// app/farmer/post-load.tsx

import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { supabase } from "../services/supabaseClient";

type LoadType = "Livestock" | "Refrigerated Fresh Food" | "Other";
type PriorityLevel = "standard" | "rush" | "scheduled";

const MIN_RATE_PER_MILE = 1.5;
const MAX_RATE_PER_MILE = 3.5;

const COLORS = {
  bg: "#F6F8F2",
  card: "#FFFFFF",
  text: "#101828",
  muted: "#667085",
  border: "#D0D5DD",
  primary: "#635BFF",
  primaryDark: "#4638D8",
  green: "#2E7D32",
  greenDark: "#14532D",
  greenSoft: "#DCFCE7",
  orange: "#F59E0B",
  orangeSoft: "#FEF3C7",
  red: "#DC2626",
  redSoft: "#FEE2E2",
  surface: "#F8FAFC",
  navy: "#020617",
  white: "#FFFFFF",
};

const EQUIPMENT_OPTIONS = [
  {
    label: "Refrigerated Truck",
    type: "Refrigerated Fresh Food" as LoadType,
    icon: "snow-outline",
    description: "Fresh produce, meat, seafood, dairy, frozen or cooled items.",
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
    description: "Non-refrigerated packaged goods, supplies, and dry freight.",
  },
];

const ADDRESS_SUGGESTIONS = [
  {
    label: "Farm2Home",
    city: "Sterling Heights",
    state: "MI",
    address: "3876 Summit Dr, Sterling Heights, MI 48314",
    lat: 42.5803,
    lng: -83.0302,
  },
  {
    label: "Eastern Market",
    city: "Detroit",
    state: "MI",
    address: "2934 Russell St, Detroit, MI 48207",
    lat: 42.3480,
    lng: -83.0414,
  },
  {
    label: "Detroit Delivery Zone",
    city: "Detroit",
    state: "MI",
    address: "19376 Packard St, Detroit, MI 48234",
    lat: 42.4383,
    lng: -83.0301,
  },
  {
    label: "Royal Oak Pickup",
    city: "Royal Oak",
    state: "MI",
    address: "200 S Main St, Royal Oak, MI 48067",
    lat: 42.4882,
    lng: -83.1446,
  },
  {
    label: "Ann Arbor Delivery",
    city: "Ann Arbor",
    state: "MI",
    address: "500 S State St, Ann Arbor, MI 48109",
    lat: 42.2766,
    lng: -83.7416,
  },
];

const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  "sterling heights mi": { lat: 42.5803, lng: -83.0302 },
  "sterling heights, mi": { lat: 42.5803, lng: -83.0302 },
  "detroit mi": { lat: 42.3314, lng: -83.0458 },
  "detroit, mi": { lat: 42.3314, lng: -83.0458 },
  "royal oak mi": { lat: 42.4895, lng: -83.1446 },
  "royal oak, mi": { lat: 42.4895, lng: -83.1446 },
  "ann arbor mi": { lat: 42.2808, lng: -83.7430 },
  "ann arbor, mi": { lat: 42.2808, lng: -83.7430 },
};

const TIME_OPTIONS = [
  "06:00 AM",
  "07:00 AM",
  "08:00 AM",
  "09:00 AM",
  "10:00 AM",
  "11:00 AM",
  "12:00 PM",
  "01:00 PM",
  "02:00 PM",
  "03:00 PM",
  "04:00 PM",
  "05:00 PM",
  "06:00 PM",
  "07:00 PM",
  "08:00 PM",
];

function clean(value: any) {
  return String(value ?? "").trim();
}

function money(value: any) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function formatDate(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function firstParam(value: any) {
  if (Array.isArray(value)) return clean(value[0]);
  return clean(value);
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function monthName(date: Date) {
  return date.toLocaleString("default", { month: "long", year: "numeric" });
}

function parseCity(address: string) {
  const parts = address.split(",").map((part) => part.trim());
  return parts.length >= 2 ? parts[1] : "";
}

function parseState(address: string) {
  const parts = address.split(",").map((part) => part.trim());
  if (parts.length >= 3) return parts[2].split(" ")[0] || "";
  return "";
}

function normalizeLocation(value: string) {
  return clean(value)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\./g, "")
    .replace(/,/g, ",")
    .trim();
}

function findKnownLocation(address: string, city?: string) {
  const addressLower = normalizeLocation(address);
  const cityLower = normalizeLocation(city || "");

  const exactSuggestion = ADDRESS_SUGGESTIONS.find((item) => {
    const itemAddress = normalizeLocation(item.address);
    return addressLower === itemAddress || addressLower.includes(itemAddress) || itemAddress.includes(addressLower);
  });

  if (exactSuggestion) return { lat: exactSuggestion.lat, lng: exactSuggestion.lng };

  const suggestionByCity = ADDRESS_SUGGESTIONS.find((item) => {
    const key = `${item.city}, ${item.state}`.toLowerCase();
    return cityLower === key || addressLower.includes(key.toLowerCase());
  });

  if (suggestionByCity) return { lat: suggestionByCity.lat, lng: suggestionByCity.lng };

  const cityKey = cityLower || `${parseCity(address)} ${parseState(address)}`.toLowerCase();
  const cleanedCityKey = cityKey.replace(",", "").replace(/\s+/g, " ").trim();
  const withComma = cityKey.replace(/\s+/g, " ").trim();

  return CITY_COORDS[withComma] || CITY_COORDS[cleanedCityKey] || null;
}

function haversineMiles(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const earthRadiusMiles = 3958.8;
  const toRad = (value: number) => (value * Math.PI) / 180;

  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);

  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const straightLine = 2 * earthRadiusMiles * Math.asin(Math.sqrt(h));

  return straightLine * 1.22;
}

export default function FarmerPostLoadScreen() {
  const params = useLocalSearchParams();
  const farmerIdParam = firstParam(params.farmerId || params.farmer_id || params.id);

  const [farmerId, setFarmerId] = useState(farmerIdParam);
  const [farmerName, setFarmerName] = useState("Farm2Home");

  const [loadTitle, setLoadTitle] = useState("Fresh Produce Delivery");
  const [loadType, setLoadType] = useState<LoadType>("Refrigerated Fresh Food");
  const [requiredEquipment, setRequiredEquipment] = useState("Refrigerated Truck");

  const [pickupName, setPickupName] = useState("Farm2Home");
  const [pickupCity, setPickupCity] = useState("Sterling Heights, MI");
  const [pickupAddress, setPickupAddress] = useState("3876 Summit Dr, Sterling Heights, MI 48314");

  const [dropoffName, setDropoffName] = useState("");
  const [dropoffCity, setDropoffCity] = useState("");
  const [dropoffAddress, setDropoffAddress] = useState("");

  const [pickupDate, setPickupDate] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [dropoffDate, setDropoffDate] = useState("");
  const [dropoffTime, setDropoffTime] = useState("");
  const [priorityLevel, setPriorityLevel] = useState<PriorityLevel>("standard");

  const [weight, setWeight] = useState("");
  const [miles, setMiles] = useState("");
  const [ratePerMile, setRatePerMile] = useState("1.50");
  const [milesAutoCalculated, setMilesAutoCalculated] = useState(false);
  const [milesCalculating, setMilesCalculating] = useState(false);
  const [milesMessage, setMilesMessage] = useState("");

  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [description, setDescription] = useState("");

  const [posting, setPosting] = useState(false);

  const [calendarTarget, setCalendarTarget] = useState<"pickup" | "dropoff" | null>(null);
  const [timeTarget, setTimeTarget] = useState<"pickup" | "dropoff" | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  const milesNumber = Number(miles || 0);
  const rateNumber = Number(ratePerMile || 0);
  const payoutAmount = milesNumber * rateNumber;

  const selectedEquipment = useMemo(() => {
    return EQUIPMENT_OPTIONS.find((item) => item.label === requiredEquipment) || EQUIPMENT_OPTIONS[0];
  }, [requiredEquipment]);

  const readyToPost = useMemo(() => {
    return Boolean(
      farmerName.trim() &&
        loadTitle.trim() &&
        pickupName.trim() &&
        pickupCity.trim() &&
        pickupAddress.trim() &&
        dropoffName.trim() &&
        dropoffCity.trim() &&
        dropoffAddress.trim() &&
        pickupDate.trim() &&
        pickupTime.trim() &&
        contactName.trim() &&
        contactPhone.trim() &&
        milesNumber > 0 &&
        rateNumber >= MIN_RATE_PER_MILE &&
        rateNumber <= MAX_RATE_PER_MILE
    );
  }, [
    farmerName,
    loadTitle,
    pickupName,
    pickupCity,
    pickupAddress,
    dropoffName,
    dropoffCity,
    dropoffAddress,
    pickupDate,
    pickupTime,
    contactName,
    contactPhone,
    milesNumber,
    rateNumber,
  ]);

  React.useEffect(() => {
    hydrateFarmer();
  }, []);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      autoCalculateMiles();
    }, 700);

    return () => clearTimeout(timer);
  }, [pickupAddress, pickupCity, dropoffAddress, dropoffCity]);

  async function hydrateFarmer() {
    try {
      const raw =
        (await AsyncStorage.getItem("currentFarmer")) ||
        (await AsyncStorage.getItem("farm2homeCurrentFarmer")) ||
        (await AsyncStorage.getItem("farm2homeFarmerSession")) ||
        (await AsyncStorage.getItem("currentUser"));

      if (!raw) return;

      const farmer = JSON.parse(raw);
      const activeFarmerId = clean(farmerIdParam || farmer.id || farmer.farmer_id || farmer.farmerId);
      const activeFarmName = clean(
        farmer.farm_name ||
          farmer.farmName ||
          farmer.business_name ||
          farmer.businessName ||
          farmer.name
      );

      if (activeFarmerId) setFarmerId(activeFarmerId);
      if (activeFarmName) {
        setFarmerName(activeFarmName);
        setPickupName(activeFarmName);
      }

      const city = clean(farmer.city || farmer.farm_city);
      const state = clean(farmer.state || farmer.farm_state);
      const address = clean(farmer.address || farmer.farm_address || farmer.pickup_address);

      if (city) setPickupCity(state ? `${city}, ${state}` : city);
      if (address) setPickupAddress(address);
    } catch {
      return;
    }
  }

  function autoCalculateMiles() {
    const pickupReady = pickupAddress.trim().length > 8 || pickupCity.trim().length > 3;
    const dropoffReady = dropoffAddress.trim().length > 8 || dropoffCity.trim().length > 3;

    if (!pickupReady || !dropoffReady) {
      setMilesAutoCalculated(false);
      setMilesMessage("");
      return;
    }

    setMilesCalculating(true);

    const pickupPoint = findKnownLocation(pickupAddress, pickupCity);
    const dropoffPoint = findKnownLocation(dropoffAddress, dropoffCity);

    if (pickupPoint && dropoffPoint) {
      const calculatedMiles = haversineMiles(pickupPoint, dropoffPoint);
      const finalMiles = Math.max(1, calculatedMiles);

      setMiles(finalMiles.toFixed(1));
      setMilesAutoCalculated(true);
      setMilesMessage("Miles auto-calculated from pickup and dropoff.");
      setMilesCalculating(false);
      return;
    }

    setMilesAutoCalculated(false);
    setMilesMessage("Enter a known city/address or manually enter miles.");
    setMilesCalculating(false);
  }

  function manualSetMiles(value: string) {
    setMiles(value);
    setMilesAutoCalculated(false);
    setMilesMessage(value ? "Miles manually entered." : "");
  }

  function selectEquipment(value: string) {
    const selected = EQUIPMENT_OPTIONS.find((item) => item.label === value);
    setRequiredEquipment(value);

    if (selected) {
      setLoadType(selected.type);
    }
  }

  function applyAddress(
    target: "pickup" | "dropoff",
    selected: { label: string; city: string; state: string; address: string }
  ) {
    if (target === "pickup") {
      setPickupName(selected.label);
      setPickupCity(`${selected.city}, ${selected.state}`);
      setPickupAddress(selected.address);
    } else {
      setDropoffName(selected.label);
      setDropoffCity(`${selected.city}, ${selected.state}`);
      setDropoffAddress(selected.address);
    }
  }

  function openCalendar(target: "pickup" | "dropoff") {
    setCalendarTarget(target);
    setCalendarMonth(new Date());
  }

  function openTime(target: "pickup" | "dropoff") {
    setTimeTarget(target);
  }

  function selectDate(date: string) {
    if (calendarTarget === "pickup") setPickupDate(date);
    if (calendarTarget === "dropoff") setDropoffDate(date);
    setCalendarTarget(null);
  }

  function selectTime(time: string) {
    if (timeTarget === "pickup") setPickupTime(time);
    if (timeTarget === "dropoff") setDropoffTime(time);
    setTimeTarget(null);
  }

  async function postLoad() {
    if (!readyToPost) {
      Alert.alert(
        "Missing Load Details",
        "Complete farm, route, schedule, contact, miles, and valid rate before posting."
      );
      return;
    }

    try {
      setPosting(true);

      const now = new Date().toISOString();

      const insertPayload = {
        farmer_id: farmerId || null,
        farmer_name: farmerName.trim(),

        title: loadTitle.trim(),
        commodity: loadType,

        pickup_city: parseCity(pickupAddress) || pickupCity,
        pickup_state: parseState(pickupAddress),
        delivery_city: parseCity(dropoffAddress) || dropoffCity,
        delivery_state: parseState(dropoffAddress),

        pickup_location: pickupAddress.trim(),
        dropoff_location: dropoffAddress.trim(),

        pickup_date: pickupDate.trim(),
        pickup_time: pickupTime.trim(),
        dropoff_date: dropoffDate.trim() || null,
        dropoff_time: dropoffTime.trim() || null,

        equipment_type: requiredEquipment,
        weight_lbs: Number(weight || 0) || null,
        temperature_controlled: loadType === "Refrigerated Fresh Food",
        temperature_required:
          loadType === "Refrigerated Fresh Food" ? "Refrigerated / Cool" : "Ambient",

        rate: Number(payoutAmount.toFixed(2)),
        distance_miles: Number(milesNumber.toFixed(1)),
        priority_level: priorityLevel,

        notes:
          description.trim() ||
          `Pickup: ${pickupName.trim()} | Dropoff: ${dropoffName.trim()} | Contact: ${contactName.trim()} | Phone: ${contactPhone.trim()} | Rate per mile: $${rateNumber.toFixed(2)} | Miles ${milesAutoCalculated ? "auto-calculated" : "manual"}`,

        status: "available",
        created_at: now,
        updated_at: now,
      };

      const { data, error } = await supabase
        .from("freight_loads")
        .insert(insertPayload)
        .select("id")
        .single();

      if (error) {
        Alert.alert("Post Error", error.message);
        return;
      }

      Alert.alert(
        "Load Posted",
        "Your farm load is now available on the live freight board.",
        [
          {
            text: "View Live Board",
            onPress: () =>
              router.replace({
                pathname: "/freight/board" as any,
                params: { createdLoadId: data?.id },
              }),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert("Post Error", error?.message || "Unable to post freight load.");
    } finally {
      setPosting(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.push("/farmer/dashboard" as any)}
        >
          <Ionicons name="arrow-back-outline" size={22} color={COLORS.text} />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>Farm2Home Logistics</Text>
          <Text style={styles.title}>Post Farm Load</Text>
          <Text style={styles.subtitle}>
            Create a live freight load with address lookup, auto miles, calendar scheduling, and driver payout.
          </Text>
        </View>
      </View>

      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name={selectedEquipment.icon as any} size={30} color={COLORS.white} />
        </View>
        <Text style={styles.heroBadge}>Load Board Posting</Text>
        <Text style={styles.heroTitle}>Move farm goods with the right driver.</Text>
        <Text style={styles.heroText}>
          Build the load, set pickup and dropoff, auto-calculate miles, then post it to the live board.
        </Text>
      </View>

      <View style={styles.previewCard}>
        <View style={styles.previewTop}>
          <View>
            <Text style={styles.previewLabel}>Carrier Payout</Text>
            <Text style={styles.previewAmount}>{money(payoutAmount)}</Text>
          </View>

          <View style={[styles.statusPill, readyToPost ? styles.readyPill : styles.incompletePill]}>
            <Text style={[styles.statusText, readyToPost ? styles.readyText : styles.incompleteText]}>
              {readyToPost ? "Ready" : "Incomplete"}
            </Text>
          </View>
        </View>

        <View style={styles.routePreview}>
          <View style={styles.routeTimeline}>
            <View style={styles.pinStart}>
              <Ionicons name="storefront-outline" size={18} color={COLORS.greenDark} />
            </View>
            <View style={styles.routeLine} />
            <View style={styles.pinEnd}>
              <Ionicons name="flag-outline" size={18} color="#92400E" />
            </View>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.previewRouteLabel}>Pickup</Text>
            <Text style={styles.previewRouteText}>{pickupAddress || "Pickup address"}</Text>
            <Text style={styles.previewRouteLabel}>Dropoff</Text>
            <Text style={styles.previewRouteText}>{dropoffAddress || "Dropoff address"}</Text>
          </View>
        </View>

        <View style={styles.milesPreviewRow}>
          <Text style={styles.previewMeta}>
            {milesNumber.toFixed(1)} miles × ${rateNumber.toFixed(2)} / mile · {requiredEquipment}
          </Text>

          {milesAutoCalculated ? (
            <View style={styles.autoBadge}>
              <Ionicons name="checkmark-circle-outline" size={14} color={COLORS.greenDark} />
              <Text style={styles.autoBadgeText}>Auto Miles</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.card}>
        <SectionTitle step="Step 1" title="Farm Load Details" subtitle="Tell drivers what they are hauling." />

        <TextInput
          style={styles.input}
          value={farmerName}
          onChangeText={setFarmerName}
          placeholder="Farm / Business Name"
          placeholderTextColor="#98A2B3"
        />

        <TextInput
          style={styles.input}
          value={loadTitle}
          onChangeText={setLoadTitle}
          placeholder="Load Title"
          placeholderTextColor="#98A2B3"
        />

        <Text style={styles.label}>Required Equipment</Text>

        {EQUIPMENT_OPTIONS.map((item) => {
          const active = requiredEquipment === item.label;

          return (
            <TouchableOpacity
              key={item.label}
              style={[styles.equipmentCard, active && styles.equipmentCardActive]}
              onPress={() => selectEquipment(item.label)}
              activeOpacity={0.9}
            >
              <View style={[styles.equipmentIcon, active && styles.equipmentIconActive]}>
                <Ionicons
                  name={item.icon as any}
                  size={22}
                  color={active ? COLORS.white : COLORS.green}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={[styles.equipmentTitle, active && styles.equipmentTitleActive]}>
                  {item.label}
                </Text>
                <Text style={[styles.equipmentDescription, active && styles.equipmentDescriptionActive]}>
                  {item.description}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}

        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder="Load Description / Special Instructions"
          placeholderTextColor="#98A2B3"
          multiline
        />
      </View>

      <View style={styles.card}>
        <SectionTitle
          step="Step 2"
          title="Pickup & Dropoff"
          subtitle="Start typing a location or address, then select from suggestions."
        />

        <AddressAutocomplete
          title="Pickup"
          locationName={pickupName}
          city={pickupCity}
          address={pickupAddress}
          onChangeName={setPickupName}
          onChangeCity={setPickupCity}
          onChangeAddress={setPickupAddress}
          onSelect={(item) => applyAddress("pickup", item)}
        />

        <AddressAutocomplete
          title="Dropoff"
          locationName={dropoffName}
          city={dropoffCity}
          address={dropoffAddress}
          onChangeName={setDropoffName}
          onChangeCity={setDropoffCity}
          onChangeAddress={setDropoffAddress}
          onSelect={(item) => applyAddress("dropoff", item)}
        />

        <TextInput
          style={styles.input}
          value={weight}
          onChangeText={setWeight}
          placeholder="Weight in lbs"
          placeholderTextColor="#98A2B3"
          keyboardType="numeric"
        />
      </View>

      <View style={styles.card}>
        <SectionTitle
          step="Step 3"
          title="Schedule & Priority"
          subtitle="Use calendar and time selectors for pickup and dropoff."
        />

        <View style={styles.twoColumn}>
          <DateTimeButton
            label="Pickup Date"
            value={pickupDate}
            icon="calendar-outline"
            onPress={() => openCalendar("pickup")}
          />
          <DateTimeButton
            label="Pickup Time"
            value={pickupTime}
            icon="time-outline"
            onPress={() => openTime("pickup")}
          />
        </View>

        <View style={styles.twoColumn}>
          <DateTimeButton
            label="Dropoff Date"
            value={dropoffDate}
            icon="calendar-outline"
            onPress={() => openCalendar("dropoff")}
          />
          <DateTimeButton
            label="Dropoff Time"
            value={dropoffTime}
            icon="time-outline"
            onPress={() => openTime("dropoff")}
          />
        </View>

        <Text style={styles.label}>Priority</Text>

        <View style={styles.priorityRow}>
          <PriorityButton label="Standard" value="standard" active={priorityLevel === "standard"} onPress={setPriorityLevel} />
          <PriorityButton label="Rush" value="rush" active={priorityLevel === "rush"} onPress={setPriorityLevel} />
          <PriorityButton label="Scheduled" value="scheduled" active={priorityLevel === "scheduled"} onPress={setPriorityLevel} />
        </View>
      </View>

      <View style={styles.card}>
        <SectionTitle
          step="Step 4"
          title="Rate & Payout"
          subtitle="Miles are auto-calculated after pickup and dropoff are selected. You can still edit them manually."
        />

        <View style={styles.milesInputWrap}>
          <TextInput
            style={[styles.input, styles.milesInput]}
            value={miles}
            onChangeText={manualSetMiles}
            placeholder={milesCalculating ? "Calculating miles..." : "Total Miles"}
            placeholderTextColor="#98A2B3"
            keyboardType="numeric"
          />

          <TouchableOpacity style={styles.recalcButton} onPress={autoCalculateMiles}>
            <Ionicons name="map-outline" size={17} color={COLORS.primary} />
            <Text style={styles.recalcText}>Recalc</Text>
          </TouchableOpacity>
        </View>

        {milesMessage ? (
          <View style={[styles.milesMessageBox, milesAutoCalculated ? styles.milesSuccess : styles.milesWarning]}>
            <Ionicons
              name={milesAutoCalculated ? "checkmark-circle-outline" : "information-circle-outline"}
              size={16}
              color={milesAutoCalculated ? COLORS.greenDark : "#92400E"}
            />
            <Text style={[styles.milesMessageText, milesAutoCalculated ? styles.milesSuccessText : styles.milesWarningText]}>
              {milesMessage}
            </Text>
          </View>
        ) : null}

        <TextInput
          style={styles.input}
          value={ratePerMile}
          onChangeText={setRatePerMile}
          placeholder="Rate Per Mile"
          placeholderTextColor="#98A2B3"
          keyboardType="numeric"
        />

        <View style={styles.rateRow}>
          <TouchableOpacity style={styles.rateButton} onPress={() => setRatePerMile("1.50")}>
            <Text style={styles.rateButtonText}>Min $1.50/mi</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.rateButton} onPress={() => setRatePerMile("3.50")}>
            <Text style={styles.rateButtonText}>Max $3.50/mi</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.payoutBox}>
          <Text style={styles.payoutText}>
            {milesNumber.toFixed(1)} miles × ${rateNumber.toFixed(2)} / mile
          </Text>
          <Text style={styles.totalPayout}>Carrier Payout: {money(payoutAmount)}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <SectionTitle step="Step 5" title="Contact" subtitle="Driver contact information for this load." />

        <TextInput
          style={styles.input}
          value={contactName}
          onChangeText={setContactName}
          placeholder="Contact Name"
          placeholderTextColor="#98A2B3"
        />

        <TextInput
          style={styles.input}
          value={contactPhone}
          onChangeText={setContactPhone}
          placeholder="Contact Phone"
          placeholderTextColor="#98A2B3"
          keyboardType="phone-pad"
        />
      </View>

      <TouchableOpacity
        style={[styles.postButton, (!readyToPost || posting) && styles.disabledButton]}
        onPress={postLoad}
        disabled={!readyToPost || posting}
      >
        {posting ? (
          <ActivityIndicator color={COLORS.white} />
        ) : (
          <>
            <Ionicons name="trail-sign-outline" size={20} color={COLORS.white} />
            <Text style={styles.postButtonText}>Post Load to Live Board</Text>
          </>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.boardLink} onPress={() => router.replace("/freight/board" as any)}>
        <Text style={styles.linkText}>Open Live Load Board</Text>
      </TouchableOpacity>

      <CalendarModal
        visible={Boolean(calendarTarget)}
        calendarMonth={calendarMonth}
        onClose={() => setCalendarTarget(null)}
        onPrev={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
        onNext={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
        onSelect={selectDate}
      />

      <TimeModal
        visible={Boolean(timeTarget)}
        onClose={() => setTimeTarget(null)}
        onSelect={selectTime}
      />
    </ScrollView>
  );
}

function AddressAutocomplete({
  title,
  locationName,
  city,
  address,
  onChangeName,
  onChangeCity,
  onChangeAddress,
  onSelect,
}: {
  title: string;
  locationName: string;
  city: string;
  address: string;
  onChangeName: (value: string) => void;
  onChangeCity: (value: string) => void;
  onChangeAddress: (value: string) => void;
  onSelect: (item: { label: string; city: string; state: string; address: string; lat?: number; lng?: number }) => void;
}) {
  const [focusedField, setFocusedField] = useState<"name" | "city" | "address" | null>(null);

  const searchText = focusedField === "name" ? locationName : focusedField === "city" ? city : address;

  const suggestions = useMemo(() => {
    const q = clean(searchText).toLowerCase();
    if (!q || q.length < 2) return [];

    return ADDRESS_SUGGESTIONS.filter((item) => {
      const full = `${item.label} ${item.city} ${item.state} ${item.address}`.toLowerCase();
      return full.includes(q);
    }).slice(0, 6);
  }, [searchText]);

  return (
    <View style={styles.addressBox}>
      <Text style={styles.addressTitle}>{title}</Text>

      <TextInput
        style={styles.input}
        value={locationName}
        onChangeText={onChangeName}
        onFocus={() => setFocusedField("name")}
        placeholder={`${title} Location Name`}
        placeholderTextColor="#98A2B3"
      />

      <TextInput
        style={styles.input}
        value={city}
        onChangeText={onChangeCity}
        onFocus={() => setFocusedField("city")}
        placeholder={`${title} City`}
        placeholderTextColor="#98A2B3"
      />

      <TextInput
        style={styles.input}
        value={address}
        onChangeText={onChangeAddress}
        onFocus={() => setFocusedField("address")}
        placeholder={`${title} Full Address`}
        placeholderTextColor="#98A2B3"
        multiline
      />

      {suggestions.length ? (
        <View style={styles.suggestionBox}>
          {suggestions.map((item) => (
            <TouchableOpacity
              key={`${title}-${item.address}`}
              style={styles.suggestionRow}
              onPress={() => {
                onSelect(item);
                setFocusedField(null);
              }}
            >
              <View style={styles.suggestionIcon}>
                <Ionicons name="location-outline" size={16} color={COLORS.primary} />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.suggestionTitle}>{item.label}</Text>
                <Text style={styles.suggestionText}>{item.address}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function DateTimeButton({
  label,
  value,
  icon,
  onPress,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.dateTimeButton} onPress={onPress}>
      <Ionicons name={icon} size={18} color={COLORS.primary} />
      <View style={{ flex: 1 }}>
        <Text style={styles.dateTimeLabel}>{label}</Text>
        <Text style={[styles.dateTimeValue, !value && styles.placeholderText]}>
          {value || `Select ${label}`}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function PriorityButton({
  label,
  value,
  active,
  onPress,
}: {
  label: string;
  value: PriorityLevel;
  active: boolean;
  onPress: (value: PriorityLevel) => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.priorityButton, active && styles.priorityButtonActive]}
      onPress={() => onPress(value)}
    >
      <Text style={[styles.priorityText, active && styles.priorityTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function CalendarModal({
  visible,
  calendarMonth,
  onClose,
  onPrev,
  onNext,
  onSelect,
}: {
  visible: boolean;
  calendarMonth: Date;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSelect: (date: string) => void;
}) {
  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const totalDays = daysInMonth(year, month);

  const days: Array<number | null> = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: totalDays }, (_, index) => index + 1),
  ];

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <TouchableOpacity style={styles.modalArrow} onPress={onPrev}>
              <Ionicons name="chevron-back-outline" size={22} color={COLORS.text} />
            </TouchableOpacity>

            <Text style={styles.modalTitle}>{monthName(calendarMonth)}</Text>

            <TouchableOpacity style={styles.modalArrow} onPress={onNext}>
              <Ionicons name="chevron-forward-outline" size={22} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.weekRow}>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <Text key={day} style={styles.weekDay}>{day}</Text>
            ))}
          </View>

          <View style={styles.calendarGrid}>
            {days.map((day, index) => {
              if (!day) return <View key={`blank-${index}`} style={styles.calendarDayBlank} />;

              const date = new Date(year, month, day);
              const dateText = formatDate(date);
              const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));

              return (
                <TouchableOpacity
                  key={dateText}
                  style={[styles.calendarDay, isPast && styles.calendarDayDisabled]}
                  disabled={isPast}
                  onPress={() => onSelect(dateText)}
                >
                  <Text style={[styles.calendarDayText, isPast && styles.calendarDayTextDisabled]}>
                    {day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity style={styles.modalClose} onPress={onClose}>
            <Text style={styles.modalCloseText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function TimeModal({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (time: string) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Select Time</Text>

          <View style={styles.timeGrid}>
            {TIME_OPTIONS.map((time) => (
              <TouchableOpacity key={time} style={styles.timeOption} onPress={() => onSelect(time)}>
                <Ionicons name="time-outline" size={16} color={COLORS.primary} />
                <Text style={styles.timeOptionText}>{time}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.modalClose} onPress={onClose}>
            <Text style={styles.modalCloseText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function SectionTitle({
  step,
  title,
  subtitle,
}: {
  step: string;
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.stepText}>{step}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionSub}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 18, paddingBottom: 90 },

  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: {
    color: COLORS.primary,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontSize: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    color: COLORS.text,
    marginTop: 2,
  },
  subtitle: {
    color: COLORS.muted,
    lineHeight: 22,
    marginTop: 5,
    fontWeight: "700",
  },

  hero: {
    backgroundColor: COLORS.navy,
    borderRadius: 30,
    padding: 20,
    marginBottom: 14,
  },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.16)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  heroBadge: {
    color: "#C7D2FE",
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    fontSize: 12,
  },
  heroTitle: {
    color: COLORS.white,
    fontSize: 26,
    fontWeight: "900",
    marginTop: 7,
    lineHeight: 31,
  },
  heroText: {
    color: "#E0E7FF",
    marginTop: 8,
    lineHeight: 22,
    fontWeight: "700",
  },

  previewCard: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
  },
  previewTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  previewLabel: {
    color: COLORS.muted,
    fontWeight: "900",
  },
  previewAmount: {
    color: COLORS.greenDark,
    fontWeight: "900",
    fontSize: 30,
    marginTop: 2,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    alignSelf: "flex-start",
  },
  readyPill: { backgroundColor: COLORS.greenSoft },
  incompletePill: { backgroundColor: COLORS.orangeSoft },
  statusText: { fontWeight: "900" },
  readyText: { color: COLORS.greenDark },
  incompleteText: { color: "#92400E" },
  routePreview: {
    backgroundColor: COLORS.greenSoft,
    borderRadius: 18,
    padding: 12,
    flexDirection: "row",
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  routeTimeline: { width: 34, alignItems: "center", paddingVertical: 3 },
  pinStart: {
    width: 30,
    height: 30,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
  },
  routeLine: {
    width: 3,
    flex: 1,
    backgroundColor: COLORS.green,
    marginVertical: 4,
    borderRadius: 999,
  },
  pinEnd: {
    width: 30,
    height: 30,
    borderRadius: 12,
    backgroundColor: COLORS.orangeSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  previewRouteLabel: {
    color: COLORS.muted,
    fontWeight: "900",
    fontSize: 11,
    textTransform: "uppercase",
  },
  previewRouteText: {
    color: COLORS.text,
    fontWeight: "800",
    marginTop: 2,
    marginBottom: 8,
    lineHeight: 19,
  },
  milesPreviewRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  previewMeta: {
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 20,
  },
  autoBadge: {
    backgroundColor: COLORS.greenSoft,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 6,
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
  },
  autoBadgeText: {
    color: COLORS.greenDark,
    fontWeight: "900",
    fontSize: 11,
  },

  card: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  stepText: {
    color: COLORS.primary,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 4,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "900",
  },
  sectionSub: {
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 4,
  },

  label: {
    fontWeight: "900",
    marginBottom: 10,
    color: COLORS.text,
    fontSize: 16,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 15,
    marginBottom: 12,
    color: COLORS.text,
    fontWeight: "800",
  },
  textArea: { minHeight: 100, textAlignVertical: "top" },

  equipmentCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  equipmentCardActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  equipmentIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: COLORS.greenSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  equipmentIconActive: {
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  equipmentTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 16,
  },
  equipmentTitleActive: { color: COLORS.white },
  equipmentDescription: {
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 19,
    marginTop: 3,
  },
  equipmentDescriptionActive: { color: "#E0E7FF" },

  addressBox: {
    backgroundColor: "#FBFCFE",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    marginBottom: 14,
  },
  addressTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 17,
    marginBottom: 10,
  },
  suggestionBox: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
    marginBottom: 8,
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F6",
  },
  suggestionIcon: {
    width: 34,
    height: 34,
    borderRadius: 13,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  suggestionTitle: { color: COLORS.text, fontWeight: "900" },
  suggestionText: { color: COLORS.muted, fontWeight: "700", marginTop: 3 },

  twoColumn: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  dateTimeButton: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dateTimeLabel: {
    color: COLORS.muted,
    fontWeight: "900",
    fontSize: 11,
    textTransform: "uppercase",
  },
  dateTimeValue: {
    color: COLORS.text,
    fontWeight: "900",
    marginTop: 3,
  },
  placeholderText: {
    color: "#98A2B3",
  },
  priorityRow: {
    flexDirection: "row",
    backgroundColor: "#EEF2FF",
    borderRadius: 18,
    padding: 5,
    gap: 5,
  },
  priorityButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  priorityButtonActive: {
    backgroundColor: COLORS.primary,
  },
  priorityText: {
    color: COLORS.primary,
    fontWeight: "900",
  },
  priorityTextActive: {
    color: COLORS.white,
  },

  milesInputWrap: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
  },
  milesInput: {
    flex: 1,
  },
  recalcButton: {
    backgroundColor: "#EEF2FF",
    borderRadius: 16,
    paddingHorizontal: 13,
    paddingVertical: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  recalcText: {
    color: COLORS.primary,
    fontWeight: "900",
  },
  milesMessageBox: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
  },
  milesSuccess: {
    backgroundColor: COLORS.greenSoft,
  },
  milesWarning: {
    backgroundColor: COLORS.orangeSoft,
  },
  milesMessageText: {
    flex: 1,
    fontWeight: "800",
  },
  milesSuccessText: {
    color: COLORS.greenDark,
  },
  milesWarningText: {
    color: "#92400E",
  },

  rateRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  rateButton: {
    flex: 1,
    backgroundColor: COLORS.greenSoft,
    borderRadius: 14,
    padding: 13,
    alignItems: "center",
  },
  rateButtonText: {
    color: COLORS.greenDark,
    fontWeight: "900",
    textAlign: "center",
  },
  payoutBox: {
    backgroundColor: COLORS.greenSoft,
    borderRadius: 18,
    padding: 15,
  },
  payoutText: {
    color: COLORS.muted,
    fontWeight: "800",
    marginBottom: 6,
  },
  totalPayout: {
    fontSize: 26,
    fontWeight: "900",
    color: COLORS.greenDark,
  },

  postButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    padding: 18,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    flexDirection: "row",
    gap: 9,
  },
  postButtonText: {
    color: COLORS.white,
    fontWeight: "900",
    fontSize: 16,
  },
  disabledButton: { opacity: 0.65 },
  boardLink: {
    paddingVertical: 18,
    alignItems: "center",
  },
  linkText: {
    color: COLORS.primary,
    fontWeight: "900",
    textAlign: "center",
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(2,6,23,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  modalCard: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 16,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  modalArrow: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 20,
    textAlign: "center",
    marginBottom: 10,
  },
  weekRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  weekDay: {
    flex: 1,
    textAlign: "center",
    color: COLORS.muted,
    fontWeight: "900",
    fontSize: 12,
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  calendarDay: {
    width: `${100 / 7}%`,
    paddingVertical: 10,
    alignItems: "center",
  },
  calendarDayBlank: {
    width: `${100 / 7}%`,
    paddingVertical: 10,
  },
  calendarDayDisabled: {
    opacity: 0.35,
  },
  calendarDayText: {
    width: 34,
    height: 34,
    borderRadius: 13,
    backgroundColor: "#EEF2FF",
    textAlign: "center",
    textAlignVertical: "center",
    color: COLORS.primary,
    fontWeight: "900",
    overflow: "hidden",
  },
  calendarDayTextDisabled: {
    color: COLORS.muted,
    backgroundColor: "#F2F4F7",
  },
  modalClose: {
    backgroundColor: COLORS.navy,
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    marginTop: 14,
  },
  modalCloseText: {
    color: COLORS.white,
    fontWeight: "900",
  },
  timeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  timeOption: {
    width: "31.5%",
    minWidth: 95,
    flexGrow: 1,
    backgroundColor: "#EEF2FF",
    borderRadius: 15,
    padding: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  timeOptionText: {
    color: COLORS.primary,
    fontWeight: "900",
  },
});
