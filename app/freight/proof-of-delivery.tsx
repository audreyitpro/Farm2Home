// app/freight/proof-of-delivery.tsx

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
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../data/supabaseClient";

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

const FREIGHT_ROUTES = {
  dashboard: "/freight/dashboard",
  board: "/freight/board",
  myLoads: "/freight/my-loads",
  liveLoads: "/freight/live-loads",
  liveRoute: "/freight/live-route",
  support: "/freight/support",
  login: "/freight/login",
};

function normalize(value: any) {
  return String(value || "").trim().toLowerCase();
}

export default function FreightProofOfDeliveryScreen() {
  const params = useLocalSearchParams();
  const loadId = Array.isArray(params.loadId) ? params.loadId[0] : String(params.loadId || "");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [carrier, setCarrier] = useState<any>(null);
  const [load, setLoad] = useState<any>(null);

  const [receiverName, setReceiverName] = useState("");
  const [receiverSignature, setReceiverSignature] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [productCondition, setProductCondition] = useState("Good");
  const [temperatureVerified, setTemperatureVerified] = useState(false);
  const [deliveryConfirmed, setDeliveryConfirmed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadScreen();
    }, [loadId])
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

  async function loadScreen() {
    try {
      setLoading(true);

      const stored = await getStoredCarrier();
      const { data: authData } = await supabase.auth.getUser();
      const email = normalize(stored?.email || authData?.user?.email || "");

      if (!email) {
        router.replace(FREIGHT_ROUTES.login as any);
        return;
      }

      const { data: dbCarrier } = await supabase
        .from("freight_users")
        .select("*")
        .eq("email", email)
        .maybeSingle();

      const mergedCarrier = {
        ...(stored || {}),
        ...(dbCarrier || {}),
        id: dbCarrier?.id || stored?.id || stored?.freightId || "",
        freightId: dbCarrier?.id || stored?.freightId || stored?.id || "",
        email,
        role: "freight",
        companyName:
          dbCarrier?.company_name ||
          dbCarrier?.business_name ||
          stored?.companyName ||
          stored?.businessName ||
          "Freight Connect Carrier",
      };

      setCarrier(mergedCarrier);

      await AsyncStorage.setItem("currentFreight", JSON.stringify(mergedCarrier));
      await AsyncStorage.setItem("currentFreightCarrier", JSON.stringify(mergedCarrier));
      await AsyncStorage.setItem("currentUser", JSON.stringify(mergedCarrier));
      await AsyncStorage.setItem("userRole", "freight");

      if (!loadId) {
        Alert.alert("Missing Load", "No load ID was provided.");
        router.replace(FREIGHT_ROUTES.myLoads as any);
        return;
      }

      const { data: dbLoad, error } = await supabase
        .from("freight_loads")
        .select("*")
        .eq("id", loadId)
        .maybeSingle();

      if (error) throw error;

      if (!dbLoad) {
        Alert.alert("Load Not Found", "This freight load could not be found.");
        router.replace(FREIGHT_ROUTES.myLoads as any);
        return;
      }

      setLoad(dbLoad);
    } catch (error: any) {
      Alert.alert("Delivery Proof Error", error?.message || "Unable to load delivery proof.");
    } finally {
      setLoading(false);
    }
  }

  async function completeDelivery() {
    if (!load?.id) {
      Alert.alert("Missing Load", "Unable to complete delivery without a load.");
      return;
    }

    if (!receiverName.trim()) {
      Alert.alert("Receiver Required", "Enter the receiver name.");
      return;
    }

    if (!receiverSignature.trim()) {
      Alert.alert("Signature Required", "Enter receiver signature or confirmation name.");
      return;
    }

    if (!deliveryConfirmed) {
      Alert.alert("Confirm Delivery", "Please confirm the delivery was completed.");
      return;
    }

    try {
      setSubmitting(true);

      const now = new Date().toISOString();

      const payload = {
        status: "delivered",
        delivered_at: now,
        delivery_receiver_name: receiverName.trim(),
        delivery_signature: receiverSignature.trim(),
        delivery_notes: deliveryNotes.trim() || null,
        product_condition: productCondition,
        temperature_verified: temperatureVerified,
        delivery_confirmed_by: carrier?.companyName || carrier?.email || "Freight Carrier",
        updated_at: now,
      };

      const { error } = await supabase
        .from("freight_loads")
        .update(payload)
        .eq("id", load.id);

      if (error) throw error;

      Alert.alert("Delivery Completed", "Proof of delivery has been saved.", [
        {
          text: "My Loads",
          onPress: () => router.replace(FREIGHT_ROUTES.myLoads as any),
        },
      ]);
    } catch (error: any) {
      Alert.alert("Submit Error", error?.message || "Unable to complete delivery.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <ActivityIndicator size="large" color={COLORS.red} />
        <Text style={styles.centerText}>Loading proof of delivery...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />

      <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>Farm2Home Freight Connect</Text>
              <Text style={styles.title}>Proof of Delivery</Text>
              <Text style={styles.subtitle}>
                Confirm delivery, receiver details, product condition, and final route completion.
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{load?.title || load?.commodity || "Freight Load"}</Text>
            <Text style={styles.routeText}>{load?.pickup_location || "Pickup TBD"}</Text>
            <Text style={styles.arrow}>↓</Text>
            <Text style={styles.routeText}>{load?.dropoff_location || "Dropoff TBD"}</Text>
            <Text style={styles.metaText}>
              Rate: ${Number(load?.rate || 0).toFixed(2)} · Status: {String(load?.status || "active")}
            </Text>
          </View>

          <View style={styles.quickGrid}>
            <QuickLink icon="grid-outline" label="Dashboard" route={FREIGHT_ROUTES.dashboard} />
            <QuickLink icon="briefcase-outline" label="My Loads" route={FREIGHT_ROUTES.myLoads} />
            <QuickLink icon="pulse-outline" label="Live Loads" route={FREIGHT_ROUTES.liveLoads} />
            <QuickLink icon="map-outline" label="Live Route" route={FREIGHT_ROUTES.liveRoute} />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Delivery Confirmation</Text>

            <Label text="Receiver Name" />
            <TextInput
              style={styles.input}
              value={receiverName}
              onChangeText={setReceiverName}
              placeholder="Name of person receiving delivery"
              placeholderTextColor="#94A3B8"
            />

            <Label text="Receiver Signature / Confirmation Name" />
            <TextInput
              style={styles.input}
              value={receiverSignature}
              onChangeText={setReceiverSignature}
              placeholder="Typed signature"
              placeholderTextColor="#94A3B8"
            />

            <Label text="Product Condition" />
            <View style={styles.optionRow}>
              {["Good", "Damaged", "Shortage"].map((item) => (
                <TouchableOpacity
                  key={item}
                  style={[styles.optionButton, productCondition === item && styles.optionButtonActive]}
                  onPress={() => setProductCondition(item)}
                >
                  <Text
                    style={[
                      styles.optionButtonText,
                      productCondition === item && styles.optionButtonTextActive,
                    ]}
                  >
                    {item}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchText}>Temperature verified, if required</Text>
              <Switch
                value={temperatureVerified}
                onValueChange={setTemperatureVerified}
                trackColor={{ false: "#CBD5E1", true: "#FCA5A5" }}
                thumbColor={temperatureVerified ? COLORS.red : "#FFFFFF"}
              />
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchText}>Delivery completed and accepted</Text>
              <Switch
                value={deliveryConfirmed}
                onValueChange={setDeliveryConfirmed}
                trackColor={{ false: "#CBD5E1", true: "#FCA5A5" }}
                thumbColor={deliveryConfirmed ? COLORS.red : "#FFFFFF"}
              />
            </View>

            <Label text="Delivery Notes" />
            <TextInput
              style={[styles.input, styles.textArea]}
              value={deliveryNotes}
              onChangeText={setDeliveryNotes}
              placeholder="Add notes, condition issues, or receiver comments"
              placeholderTextColor="#94A3B8"
              multiline
              textAlignVertical="top"
            />
          </View>

          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.disabledButton]}
            onPress={completeDelivery}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark-done-outline" size={18} color="#FFFFFF" />
                <Text style={styles.submitText}>Complete Delivery</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.darkButton} onPress={() => router.replace(FREIGHT_ROUTES.myLoads as any)}>
            <Text style={styles.darkButtonText}>Back to My Loads</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Label({ text }: { text: string }) {
  return <Text style={styles.label}>{text}</Text>;
}

function QuickLink({ icon, label, route }: any) {
  return (
    <TouchableOpacity
      style={styles.quickLink}
      onPress={() =>
        route === FREIGHT_ROUTES.liveRoute
          ? router.push({ pathname: route as any, params: { loadId: "" } })
          : router.push(route as any)
      }
    >
      <Ionicons name={icon} size={22} color={COLORS.red} />
      <Text style={styles.quickText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  page: { flex: 1 },
  content: { paddingBottom: 90 },
  center: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  centerText: { color: COLORS.muted, marginTop: 12, fontWeight: "800" },
  hero: {
    backgroundColor: COLORS.black,
    paddingTop: 30,
    paddingHorizontal: 20,
    paddingBottom: 30,
    flexDirection: "row",
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
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 18,
    marginHorizontal: 18,
    marginTop: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTitle: { color: COLORS.text, fontSize: 22, fontWeight: "900", marginBottom: 10 },
  routeText: { color: COLORS.text, fontSize: 19, fontWeight: "900" },
  arrow: { color: COLORS.red, fontSize: 24, fontWeight: "900", marginVertical: 4 },
  metaText: { color: COLORS.muted, fontWeight: "800", marginTop: 10 },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 18,
    marginTop: 16,
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
  sectionTitle: { color: COLORS.text, fontSize: 22, fontWeight: "900", marginBottom: 12 },
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
  optionRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  optionButton: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  optionButtonActive: { backgroundColor: COLORS.red, borderColor: COLORS.red },
  optionButtonText: { color: COLORS.text, fontWeight: "900", fontSize: 12 },
  optionButtonTextActive: { color: "#FFFFFF" },
  switchRow: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 13,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  switchText: { color: COLORS.text, fontWeight: "900", flex: 1 },
  submitButton: {
    backgroundColor: COLORS.red,
    borderRadius: 16,
    padding: 17,
    marginHorizontal: 18,
    marginTop: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  disabledButton: { opacity: 0.65 },
  submitText: { color: "#FFFFFF", fontWeight: "900", fontSize: 15 },
  darkButton: {
    backgroundColor: COLORS.black,
    borderRadius: 16,
    padding: 17,
    marginHorizontal: 18,
    marginTop: 12,
    alignItems: "center",
  },
  darkButtonText: { color: "#FFFFFF", fontWeight: "900" },
});