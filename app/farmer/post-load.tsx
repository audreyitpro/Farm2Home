import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { supabase } from "../services/supabaseClient";

type LoadType = "Livestock" | "Refrigerated Fresh Food" | "Other";

const MIN_RATE_PER_MILE = 1.5;
const MAX_RATE_PER_MILE = 3.5;

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

export default function FarmerPostLoadScreen() {
  const [farmerName, setFarmerName] = useState("Green Valley Farms");
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
  const [ratePerMile, setRatePerMile] = useState("1.50");

  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [description, setDescription] = useState("");

  const [posting, setPosting] = useState(false);

  const milesNumber = Number(miles || 0);
  const rateNumber = Number(ratePerMile || 0);
  const payoutAmount = milesNumber * rateNumber;

  const selectedEquipment = useMemo(() => {
    return (
      EQUIPMENT_OPTIONS.find((item) => item.label === requiredEquipment) ||
      EQUIPMENT_OPTIONS[0]
    );
  }, [requiredEquipment]);

  const readyToPost = useMemo(() => {
    return Boolean(
      farmerName.trim() &&
        loadTitle.trim() &&
        pickupLocation.trim() &&
        dropoffLocation.trim() &&
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
    pickupLocation,
    dropoffLocation,
    pickupDate,
    pickupTime,
    contactName,
    contactPhone,
    milesNumber,
    rateNumber,
  ]);

  function selectEquipment(value: string) {
    const selected = EQUIPMENT_OPTIONS.find((item) => item.label === value);
    setRequiredEquipment(value);

    if (selected) {
      setLoadType(selected.type);
    }
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
        title: loadTitle.trim(),
        farmer_name: farmerName.trim(),
        pickup_location: pickupLocation.trim(),
        dropoff_location: dropoffLocation.trim(),
        pickup_date: pickupDate.trim(),
        pickup_time: pickupTime.trim(),
        dropoff_date: dropoffDate.trim() || null,
        dropoff_time: dropoffTime.trim() || null,
        equipment_type: requiredEquipment,
        weight_lbs: Number(weight || 0) || null,
        temperature_required:
          loadType === "Refrigerated Fresh Food"
            ? "Refrigerated / Cool"
            : "Ambient",
        rate: Number(payoutAmount.toFixed(2)),
        distance_miles: Number(milesNumber.toFixed(1)),
        commodity: loadType,
        notes:
          description.trim() ||
          `Contact: ${contactName.trim()} | Phone: ${contactPhone.trim()} | Rate per mile: $${rateNumber.toFixed(
            2
          )}`,
        contact_name: contactName.trim(),
        contact_phone: contactPhone.trim(),
        status: "available",
        source: "farmer_post_load",
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
          <Ionicons name="arrow-back-outline" size={22} color="#111827" />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>Farm2Home Logistics</Text>
          <Text style={styles.title}>Post Farm Load</Text>
          <Text style={styles.subtitle}>
            Create a live freight load for drivers and carriers.
          </Text>
        </View>
      </View>

      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name={selectedEquipment.icon as any} size={30} color="#FFFFFF" />
        </View>
        <Text style={styles.heroBadge}>Load Board Posting</Text>
        <Text style={styles.heroTitle}>Move farm goods with the right driver.</Text>
        <Text style={styles.heroText}>
          Build the load, set route and payout, then post it to the live board.
        </Text>
      </View>

      <View style={styles.flowCard}>
        <Text style={styles.flowTitle}>Posting Flow</Text>
        <FlowStep number="1" text="Choose equipment and load type" />
        <FlowStep number="2" text="Enter pickup and dropoff route" />
        <FlowStep number="3" text="Set schedule, miles, and carrier payout" />
        <FlowStep number="4" text="Add contact details and post to the load board" />
      </View>

      <View style={styles.previewCard}>
        <View style={styles.previewTop}>
          <View>
            <Text style={styles.previewLabel}>Carrier Payout</Text>
            <Text style={styles.previewAmount}>${payoutAmount.toFixed(2)}</Text>
          </View>

          <View style={styles.statusPill}>
            <Text style={styles.statusText}>
              {readyToPost ? "Ready" : "Incomplete"}
            </Text>
          </View>
        </View>

        <Text style={styles.previewRoute}>
          {pickupLocation || "Pickup location"} → {dropoffLocation || "Dropoff location"}
        </Text>
        <Text style={styles.previewMeta}>
          {milesNumber.toFixed(1)} miles × ${rateNumber.toFixed(2)} / mile ·{" "}
          {requiredEquipment}
        </Text>
      </View>

      <View style={styles.card}>
        <SectionTitle
          step="Step 1"
          title="Farm Load Details"
          subtitle="Tell drivers what they are hauling."
        />

        <TextInput
          style={styles.input}
          value={farmerName}
          onChangeText={setFarmerName}
          placeholder="Farm / Business Name"
          placeholderTextColor="#6B7280"
        />

        <TextInput
          style={styles.input}
          value={loadTitle}
          onChangeText={setLoadTitle}
          placeholder="Load Title"
          placeholderTextColor="#6B7280"
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
                  color={active ? "#FFFFFF" : "#2F7D32"}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.equipmentTitle,
                    active && styles.equipmentTitleActive,
                  ]}
                >
                  {item.label}
                </Text>
                <Text
                  style={[
                    styles.equipmentDescription,
                    active && styles.equipmentDescriptionActive,
                  ]}
                >
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
          placeholderTextColor="#6B7280"
          multiline
        />
      </View>

      <View style={styles.card}>
        <SectionTitle
          step="Step 2"
          title="Route"
          subtitle="Add the pickup and dropoff locations."
        />

        <TextInput
          style={styles.input}
          value={pickupLocation}
          onChangeText={setPickupLocation}
          placeholder="Pickup Location"
          placeholderTextColor="#6B7280"
        />

        <TextInput
          style={styles.input}
          value={dropoffLocation}
          onChangeText={setDropoffLocation}
          placeholder="Dropoff Location"
          placeholderTextColor="#6B7280"
        />

        <TextInput
          style={styles.input}
          value={weight}
          onChangeText={setWeight}
          placeholder="Weight in lbs"
          placeholderTextColor="#6B7280"
          keyboardType="numeric"
        />
      </View>

      <View style={styles.card}>
        <SectionTitle
          step="Step 3"
          title="Schedule"
          subtitle="Set when the driver needs to pick up and deliver."
        />

        <TextInput
          style={styles.input}
          value={pickupDate}
          onChangeText={setPickupDate}
          placeholder="Pickup Date"
          placeholderTextColor="#6B7280"
        />

        <TextInput
          style={styles.input}
          value={pickupTime}
          onChangeText={setPickupTime}
          placeholder="Pickup Time"
          placeholderTextColor="#6B7280"
        />

        <TextInput
          style={styles.input}
          value={dropoffDate}
          onChangeText={setDropoffDate}
          placeholder="Dropoff Date"
          placeholderTextColor="#6B7280"
        />

        <TextInput
          style={styles.input}
          value={dropoffTime}
          onChangeText={setDropoffTime}
          placeholder="Dropoff Time"
          placeholderTextColor="#6B7280"
        />
      </View>

      <View style={styles.card}>
        <SectionTitle
          step="Step 4"
          title="Rate & Payout"
          subtitle="Set a fair payout so drivers can accept the load."
        />

        <TextInput
          style={styles.input}
          value={miles}
          onChangeText={setMiles}
          placeholder="Total Miles"
          placeholderTextColor="#6B7280"
          keyboardType="numeric"
        />

        <TextInput
          style={styles.input}
          value={ratePerMile}
          onChangeText={setRatePerMile}
          placeholder="Rate Per Mile"
          placeholderTextColor="#6B7280"
          keyboardType="numeric"
        />

        <View style={styles.rateRow}>
          <TouchableOpacity
            style={styles.rateButton}
            onPress={() => setRatePerMile("1.50")}
          >
            <Text style={styles.rateButtonText}>Min $1.50/mi</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.rateButton}
            onPress={() => setRatePerMile("3.50")}
          >
            <Text style={styles.rateButtonText}>Max $3.50/mi</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.payoutBox}>
          <Text style={styles.payoutText}>
            {milesNumber.toFixed(1)} miles × ${rateNumber.toFixed(2)} / mile
          </Text>
          <Text style={styles.totalPayout}>
            Carrier Payout: ${payoutAmount.toFixed(2)}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <SectionTitle
          step="Step 5"
          title="Contact"
          subtitle="Driver contact information for this load."
        />

        <TextInput
          style={styles.input}
          value={contactName}
          onChangeText={setContactName}
          placeholder="Contact Name"
          placeholderTextColor="#6B7280"
        />

        <TextInput
          style={styles.input}
          value={contactPhone}
          onChangeText={setContactPhone}
          placeholder="Contact Phone"
          placeholderTextColor="#6B7280"
          keyboardType="phone-pad"
        />
      </View>

      <TouchableOpacity
        style={[styles.postButton, (!readyToPost || posting) && styles.disabledButton]}
        onPress={postLoad}
        disabled={!readyToPost || posting}
      >
        {posting ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            <Ionicons name="trail-sign-outline" size={20} color="#FFFFFF" />
            <Text style={styles.postButtonText}>Post Load to Live Board</Text>
          </>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.boardLink}
        onPress={() => router.replace("/freight/board" as any)}
      >
        <Text style={styles.linkText}>Open Live Load Board</Text>
      </TouchableOpacity>
    </ScrollView>
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

function FlowStep({ number, text }: { number: string; text: string }) {
  return (
    <View style={styles.flowStep}>
      <Text style={styles.flowNumber}>{number}</Text>
      <Text style={styles.flowText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F7F2" },
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
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: {
    color: "#2F7D32",
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontSize: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    color: "#111827",
    marginTop: 2,
  },
  subtitle: {
    color: "#4B5563",
    lineHeight: 22,
    marginTop: 5,
    fontWeight: "700",
  },

  hero: {
    backgroundColor: "#14532D",
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
    color: "#BBF7D0",
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    fontSize: 12,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "900",
    marginTop: 7,
    lineHeight: 31,
  },
  heroText: {
    color: "#DCFCE7",
    marginTop: 8,
    lineHeight: 22,
    fontWeight: "700",
  },

  flowCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 14,
  },
  flowTitle: {
    color: "#111827",
    fontSize: 21,
    fontWeight: "900",
    marginBottom: 10,
  },
  flowStep: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    marginTop: 8,
  },
  flowNumber: {
    width: 30,
    height: 30,
    borderRadius: 12,
    backgroundColor: "#DCFCE7",
    color: "#14532D",
    textAlign: "center",
    textAlignVertical: "center",
    fontWeight: "900",
    overflow: "hidden",
  },
  flowText: {
    flex: 1,
    color: "#111827",
    fontWeight: "800",
    lineHeight: 19,
  },

  previewCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 14,
  },
  previewTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  previewLabel: {
    color: "#6B7280",
    fontWeight: "900",
  },
  previewAmount: {
    color: "#14532D",
    fontWeight: "900",
    fontSize: 30,
    marginTop: 2,
  },
  statusPill: {
    backgroundColor: "#DCFCE7",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    alignSelf: "flex-start",
  },
  statusText: {
    color: "#14532D",
    fontWeight: "900",
  },
  previewRoute: {
    color: "#111827",
    fontWeight: "900",
    fontSize: 16,
  },
  previewMeta: {
    color: "#6B7280",
    fontWeight: "700",
    marginTop: 6,
    lineHeight: 20,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 14,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  stepText: {
    color: "#2F7D32",
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 4,
  },
  sectionTitle: {
    color: "#111827",
    fontSize: 22,
    fontWeight: "900",
  },
  sectionSub: {
    color: "#6B7280",
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 4,
  },

  label: {
    fontWeight: "900",
    marginBottom: 10,
    color: "#111827",
    fontSize: 16,
  },
  input: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 16,
    padding: 15,
    marginBottom: 12,
    color: "#111827",
    fontWeight: "800",
  },
  textArea: { minHeight: 100, textAlignVertical: "top" },

  equipmentCard: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  equipmentCardActive: {
    backgroundColor: "#2F7D32",
    borderColor: "#2F7D32",
  },
  equipmentIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
  },
  equipmentIconActive: {
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  equipmentTitle: {
    color: "#111827",
    fontWeight: "900",
    fontSize: 16,
  },
  equipmentTitleActive: { color: "#FFFFFF" },
  equipmentDescription: {
    color: "#6B7280",
    fontWeight: "700",
    lineHeight: 19,
    marginTop: 3,
  },
  equipmentDescriptionActive: { color: "#E8F5E9" },

  rateRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  rateButton: {
    flex: 1,
    backgroundColor: "#DCFCE7",
    borderRadius: 14,
    padding: 13,
    alignItems: "center",
  },
  rateButtonText: {
    color: "#14532D",
    fontWeight: "900",
    textAlign: "center",
  },
  payoutBox: {
    backgroundColor: "#F0FDF4",
    borderRadius: 18,
    padding: 15,
  },
  payoutText: {
    color: "#4B5563",
    fontWeight: "800",
    marginBottom: 6,
  },
  totalPayout: {
    fontSize: 26,
    fontWeight: "900",
    color: "#064E3B",
  },

  postButton: {
    backgroundColor: "#2F7D32",
    borderRadius: 18,
    padding: 18,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    flexDirection: "row",
    gap: 9,
  },
  postButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },
  disabledButton: { opacity: 0.65 },
  boardLink: {
    paddingVertical: 18,
    alignItems: "center",
  },
  linkText: {
    color: "#2F7D32",
    fontWeight: "900",
    textAlign: "center",
  },
});