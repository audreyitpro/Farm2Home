import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { router } from "expo-router";

import { supabase } from "../services/supabaseClient";

type LoadType = "Livestock" | "Refrigerated Fresh Food" | "Other";

const MIN_RATE_PER_MILE = 1.5;
const MAX_RATE_PER_MILE = 3.5;

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

  function selectEquipment(value: string) {
    setRequiredEquipment(value);

    if (value === "Livestock Trailer") {
      setLoadType("Livestock");
    }

    if (value === "Refrigerated Truck") {
      setLoadType("Refrigerated Fresh Food");
    }

    if (value === "Dry Van") {
      setLoadType("Other");
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
      Alert.alert("Missing Miles", "Please enter total route miles.");
      return;
    }

    if (rateNumber < MIN_RATE_PER_MILE || rateNumber > MAX_RATE_PER_MILE) {
      Alert.alert("Invalid Rate", "Rate must be between $1.50 and $3.50 per mile.");
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
          loadType === "Refrigerated Fresh Food" ? "Refrigerated / Cool" : "Ambient",
        rate: Number(payoutAmount.toFixed(2)),
        distance_miles: Number(milesNumber.toFixed(1)),
        commodity: loadType,
        notes:
          description.trim() ||
          `Contact: ${contactName.trim()} | Phone: ${contactPhone.trim()} | Rate per mile: $${rateNumber.toFixed(
            2
          )}`,
        status: "available",
        created_at: now,
      };

      console.log("POSTING_FREIGHT_LOAD:", insertPayload);

      const { data, error } = await supabase
        .from("freight_loads")
        .insert(insertPayload)
        .select("id")
        .single();

      if (error) {
        console.log("SUPABASE_POST_LOAD_ERROR:", error);
        Alert.alert("Post Error", error.message);
        return;
      }

      console.log("POST_LOAD_SUCCESS:", data);

      Alert.alert(
        "Freight Load Created",
        "Your freight load has been posted to the live load board.",
        [
          {
            text: "View Live Board",
            onPress: () =>
              router.replace({
                pathname: "/freight/board" as any,
                params: {
                  createdLoadId: data?.id,
                },
              }),
          },
        ]
      );
    } catch (error: any) {
      console.log("POST_LOAD_CRASH:", error);
      Alert.alert("Post Error", error?.message || "Unable to post freight load.");
    } finally {
      setPosting(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Farmer Freight Load</Text>
      <Text style={styles.subtitle}>Create freight loads for Farm2Home drivers.</Text>

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

      {["Livestock Trailer", "Refrigerated Truck", "Dry Van"].map((item) => (
        <TouchableOpacity
          key={item}
          style={[
            styles.equipmentButton,
            requiredEquipment === item && styles.equipmentButtonActive,
          ]}
          onPress={() => selectEquipment(item)}
        >
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

      <TextInput
        style={[styles.input, styles.textArea]}
        value={description}
        onChangeText={setDescription}
        placeholder="Load Description"
        placeholderTextColor="#6B7280"
        multiline
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

      <TouchableOpacity style={styles.rateButton} onPress={() => setRatePerMile("1.50")}>
        <Text style={styles.rateButtonText}>Minimum $1.50 / mile</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.rateButton} onPress={() => setRatePerMile("3.50")}>
        <Text style={styles.rateButtonText}>Maximum $3.50 / mile</Text>
      </TouchableOpacity>

      <Text style={styles.payoutText}>
        {milesNumber.toFixed(1)} miles × ${rateNumber.toFixed(2)} / mile
      </Text>

      <Text style={styles.totalPayout}>Carrier Payout: ${payoutAmount.toFixed(2)}</Text>

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

      <TextInput
        style={styles.input}
        value={weight}
        onChangeText={setWeight}
        placeholder="Weight in lbs"
        placeholderTextColor="#6B7280"
        keyboardType="numeric"
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

      <TouchableOpacity
        style={[styles.postButton, posting && styles.disabledButton]}
        onPress={postLoad}
        disabled={posting}
      >
        {posting ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.postButtonText}>Post Freight Load</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.replace("/freight/board" as any)}>
        <Text style={styles.linkText}>Open Live Load Board</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F7F2" },
  content: { padding: 20, paddingBottom: 80 },
  title: {
    fontSize: 34,
    fontWeight: "900",
    color: "#1F7A3F",
    marginBottom: 10,
  },
  subtitle: {
    color: "#4B5563",
    lineHeight: 22,
    marginBottom: 18,
    fontWeight: "700",
  },
  label: {
    fontWeight: "900",
    marginBottom: 10,
    color: "#111827",
    fontSize: 16,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    color: "#111827",
    fontWeight: "700",
  },
  textArea: { minHeight: 100, textAlignVertical: "top" },
  equipmentButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#2F7D32",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    marginBottom: 10,
  },
  equipmentButtonActive: { backgroundColor: "#2F7D32" },
  equipmentButtonText: { color: "#2F7D32", fontWeight: "900" },
  equipmentButtonTextActive: { color: "#FFFFFF" },
  rateButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#2F7D32",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    marginBottom: 10,
  },
  rateButtonText: {
    color: "#2F7D32",
    fontWeight: "900",
    textAlign: "center",
  },
  payoutText: {
    color: "#4B5563",
    fontWeight: "800",
    marginBottom: 10,
  },
  totalPayout: {
    fontSize: 30,
    fontWeight: "900",
    color: "#064E3B",
    marginBottom: 18,
  },
  postButton: {
    backgroundColor: "#2F7D32",
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
    marginTop: 10,
  },
  postButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },
  disabledButton: { opacity: 0.65 },
  linkText: {
    color: "#2F7D32",
    fontWeight: "900",
    textAlign: "center",
    marginTop: 18,
  },
});