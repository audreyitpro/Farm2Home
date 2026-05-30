// app/freight/create-load.tsx

import React, { useState } from "react";
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
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../data/supabaseClient";
import freightTheme from "../styles/freightTheme";

type FreightLoadStatus = "available";

export default function FreightCreateLoadScreen() {
  const [loading, setLoading] = useState(false);

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

  async function getCurrentFreightUser() {
    const raw =
      (await AsyncStorage.getItem("currentFreightCarrier")) ||
      (await AsyncStorage.getItem("currentFreight")) ||
      (await AsyncStorage.getItem("currentFreightUser")) ||
      (await AsyncStorage.getItem("currentUser"));

    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw);

      return {
        ...parsed,
        id: parsed.id || parsed.freightId || parsed.email,
        freightId: parsed.freightId || parsed.id || parsed.email,
        role: "freight",
      };
    } catch {
      return null;
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

      const currentFreight = await getCurrentFreightUser();

      if (!currentFreight) {
        Alert.alert("Login Required", "Please log in to post freight loads.");
        router.replace("/freight/login" as any);
        return;
      }

      const now = new Date().toISOString();

      const loadId = `freight_${Date.now()}`;

      const payload = {
        id: loadId,
        title: title.trim(),
        farmer_name:
          farmerName.trim() ||
          currentFreight.companyName ||
          currentFreight.businessName ||
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

        posted_by_id: currentFreight.id || currentFreight.freightId || null,
        posted_by_name:
          currentFreight.companyName ||
          currentFreight.businessName ||
          currentFreight.contactName ||
          currentFreight.username ||
          "Freight Connect Carrier",

        created_at: now,
        updated_at: now,
      };

      const { error } = await supabase.from("freight_loads").insert(payload);

      if (error) {
        Alert.alert("Post Error", error.message);
        return;
      }

      Alert.alert("Freight Posted", "Your freight load is now live on the board.", [
        {
          text: "View Board",
          onPress: () =>
            router.replace({
              pathname: "/freight/board",
              params: { createdLoadId: loadId },
            } as any),
        },
      ]);
    } catch (error: any) {
      console.log("Create freight load error:", error);
      Alert.alert("Post Error", error?.message || "Unable to post freight load.");
    } finally {
      setLoading(false);
    }
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

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#020617" />

      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
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
                  Post a freight opportunity to the live load board for approved
                  carriers and drivers.
                </Text>
              </View>

              <View style={styles.heroIcon}>
                <Ionicons name="add-circle-outline" size={34} color="#FFFFFF" />
              </View>
            </View>
          </View>

          <View style={styles.navRow}>
            <TouchableOpacity
              style={styles.navButton}
              onPress={() => router.push("/freight/board" as any)}
            >
              <Ionicons name="list-outline" size={18} color="#FFFFFF" />
              <Text style={styles.navText}>Load Board</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navButtonOutline}
              onPress={() => router.push("/freight/dashboard" as any)}
            >
              <Ionicons
                name="grid-outline"
                size={18}
                color={freightTheme.colors.primary}
              />
              <Text style={styles.navTextOutline}>Dashboard</Text>
            </TouchableOpacity>
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
            <SectionHeader
              icon="map-outline"
              title="Route"
              subtitle="Pickup and dropoff locations."
            />

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
            <SectionHeader
              icon="calendar-outline"
              title="Schedule"
              subtitle="Pickup and delivery timing."
            />

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
            <SectionHeader
              icon="cash-outline"
              title="Carrier Rate"
              subtitle="Set the posted payout for this load."
            />

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

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.disabledButton]}
            onPress={submitLoad}
            disabled={loading}
          >
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

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: freightTheme.colors.background,
  },
  keyboard: {
    flex: 1,
    backgroundColor: freightTheme.colors.background,
  },
  content: {
    paddingBottom: 90,
  },
  hero: {
    backgroundColor: "#020617",
    paddingTop: 22,
    paddingHorizontal: 20,
    paddingBottom: 26,
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#064E3B",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#10B981",
  },
  kicker: {
    color: "#10B981",
    fontWeight: "900",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontSize: 12,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900",
    marginBottom: 10,
  },
  subtitle: {
    color: "#D1D5DB",
    lineHeight: 23,
    fontSize: 15,
    fontWeight: "700",
  },
  navRow: {
    flexDirection: "row",
    gap: 10,
    padding: 18,
  },
  navButton: {
    flex: 1,
    backgroundColor: freightTheme.colors.primary,
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  navButtonOutline: {
    flex: 1,
    backgroundColor: freightTheme.colors.card,
    borderWidth: 1,
    borderColor: freightTheme.colors.primary,
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  navText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  navTextOutline: {
    color: freightTheme.colors.primary,
    fontWeight: "900",
  },
  card: {
    backgroundColor: freightTheme.colors.card,
    borderRadius: 22,
    padding: 18,
    marginHorizontal: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
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
    borderRadius: 20,
    backgroundColor: freightTheme.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    color: freightTheme.colors.text,
    fontSize: 21,
    fontWeight: "900",
  },
  sectionSubtitle: {
    color: freightTheme.colors.mutedText,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 3,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 14,
    padding: 14,
    color: "#111827",
    fontWeight: "700",
    marginBottom: 12,
  },
  notesInput: {
    minHeight: 110,
  },
  submitButton: {
    backgroundColor: freightTheme.colors.primary,
    padding: 16,
    borderRadius: 16,
    marginHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  disabledButton: {
    opacity: 0.6,
  },
  submitText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },
});