// app/driver/navigation-assistant.tsx

import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../services/supabaseClient";
import freightTheme from "../styles/freightTheme";

function getParamString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

export default function NavigationAssistantScreen() {
  const params = useLocalSearchParams();

  const loadId = getParamString(params.loadId);
  const orderId = getParamString(params.orderId);
  const proofId = loadId || orderId;

  const [loading, setLoading] = useState(false);
  const [selectedStop, setSelectedStop] = useState<"pickup" | "dropoff">("pickup");

  const [pickupAddress, setPickupAddress] = useState(getParamString(params.pickupAddress));
  const [dropoffAddress, setDropoffAddress] = useState(getParamString(params.dropoffAddress));
  const [pickupCity, setPickupCity] = useState(getParamString(params.pickupCity));
  const [dropoffCity, setDropoffCity] = useState(getParamString(params.dropoffCity));

  useEffect(() => {
    loadRouteDetails();
  }, [proofId]);

  const pickupDestination = useMemo(() => pickupAddress || pickupCity || "", [pickupAddress, pickupCity]);
  const dropoffDestination = useMemo(() => dropoffAddress || dropoffCity || "", [dropoffAddress, dropoffCity]);
  const activeDestination = selectedStop === "pickup" ? pickupDestination : dropoffDestination;

  async function loadRouteDetails() {
    if (!proofId) return;

    try {
      setLoading(true);

      let record: any = null;

      const loadResult = await supabase
        .from("freight_loads")
        .select("*")
        .eq("id", proofId)
        .maybeSingle();

      if (!loadResult.error && loadResult.data) {
        record = loadResult.data;
      }

      if (!record) {
        const orderResult = await supabase
          .from("orders")
          .select("*")
          .eq("id", proofId)
          .maybeSingle();

        if (!orderResult.error && orderResult.data) {
          record = orderResult.data;
        }
      }

      if (!record) return;

      const deliveryInfo = record.deliveryInfo || record.delivery_info || {};

      setPickupAddress(
        pickupAddress ||
          record.pickup_address ||
          record.pickupAddress ||
          deliveryInfo.pickupAddress ||
          deliveryInfo.farmAddress ||
          ""
      );

      setDropoffAddress(
        dropoffAddress ||
          record.dropoff_address ||
          record.dropoffAddress ||
          record.delivery_address ||
          record.deliveryAddress ||
          deliveryInfo.address ||
          deliveryInfo.deliveryAddress ||
          ""
      );

      setPickupCity(
        pickupCity ||
          record.pickup_city ||
          record.pickupCity ||
          deliveryInfo.pickupCity ||
          deliveryInfo.farmCity ||
          ""
      );

      setDropoffCity(
        dropoffCity ||
          record.delivery_city ||
          record.deliveryCity ||
          record.dropoff_city ||
          record.dropoffCity ||
          deliveryInfo.city ||
          deliveryInfo.deliveryCity ||
          ""
      );
    } catch (error) {
      console.log("Navigation route details skipped:", error);
    } finally {
      setLoading(false);
    }
  }

  function openMaps(destination?: string) {
    if (!destination) {
      Alert.alert(
        "Address Missing",
        "No address was provided for this stop. Go back to the delivery card and open navigation again."
      );
      return;
    }

    const encoded = encodeURIComponent(destination);

    const url =
      Platform.OS === "ios"
        ? `http://maps.apple.com/?daddr=${encoded}`
        : `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;

    Linking.openURL(url).catch(() => {
      Alert.alert("Navigation Error", "Unable to open maps on this device.");
    });
  }

  function openGoogleMaps(destination?: string) {
    if (!destination) {
      Alert.alert("Address Missing", "No destination is available.");
      return;
    }

    const encoded = encodeURIComponent(destination);
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encoded}`).catch(() => {
      Alert.alert("Navigation Error", "Unable to open Google Maps.");
    });
  }

  function openAppleMaps(destination?: string) {
    if (!destination) {
      Alert.alert("Address Missing", "No destination is available.");
      return;
    }

    const encoded = encodeURIComponent(destination);
    Linking.openURL(`http://maps.apple.com/?daddr=${encoded}`).catch(() => {
      Alert.alert("Navigation Error", "Unable to open Apple Maps.");
    });
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#020617" />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="navigate-outline" size={32} color="#FFFFFF" />
          </View>

          <Text style={styles.kicker}>Farm2Home Driver</Text>
          <Text style={styles.title}>Navigation Assistant</Text>
          <Text style={styles.subtitle}>
            Open route navigation for pickup and dropoff stops while keeping the
            Driver Portal workflow connected.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Delivery / Load ID</Text>
          <Text style={styles.cardValue}>{proofId || "No load selected"}</Text>

          {loading && (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#10B981" />
              <Text style={styles.loadingText}>Loading route details...</Text>
            </View>
          )}
        </View>

        <View style={styles.stopTabs}>
          <TouchableOpacity
            style={[styles.stopTab, selectedStop === "pickup" && styles.stopTabActive]}
            onPress={() => setSelectedStop("pickup")}
          >
            <Ionicons
              name="radio-button-on"
              size={18}
              color={selectedStop === "pickup" ? "#FFFFFF" : "#10B981"}
            />
            <Text style={[styles.stopTabText, selectedStop === "pickup" && styles.stopTabTextActive]}>
              Pickup
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.stopTab, selectedStop === "dropoff" && styles.stopTabActive]}
            onPress={() => setSelectedStop("dropoff")}
          >
            <Ionicons
              name="location"
              size={18}
              color={selectedStop === "dropoff" ? "#FFFFFF" : "#10B981"}
            />
            <Text style={[styles.stopTabText, selectedStop === "dropoff" && styles.stopTabTextActive]}>
              Dropoff
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="map-outline" size={24} color="#10B981" />
            <Text style={styles.sectionTitle}>
              {selectedStop === "pickup" ? "Pickup Stop" : "Dropoff Stop"}
            </Text>
          </View>

          <Text style={styles.addressLabel}>Destination</Text>
          <Text style={styles.addressText}>{activeDestination || "No address provided"}</Text>

          <TouchableOpacity style={styles.primaryButton} onPress={() => openMaps(activeDestination)}>
            <Ionicons name="navigate-circle-outline" size={19} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>Open Navigation</Text>
          </TouchableOpacity>

          <View style={styles.mapButtons}>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => openGoogleMaps(activeDestination)}>
              <Text style={styles.secondaryButtonText}>Google Maps</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={() => openAppleMaps(activeDestination)}>
              <Text style={styles.secondaryButtonText}>Apple Maps</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Driver Workflow</Text>

          <TouchableOpacity
            style={styles.workflowButton}
            onPress={() =>
              router.push({
                pathname: "/driver/live-location-provider",
                params: { loadId: proofId, orderId: proofId },
              } as any)
            }
          >
            <Ionicons name="radio-outline" size={18} color="#10B981" />
            <Text style={styles.workflowButtonText}>Live Location Provider</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.workflowButton}
            onPress={() =>
              router.push({
                pathname: "/driver/proof-of-pickup",
                params: { loadId: proofId, orderId: proofId },
              } as any)
            }
          >
            <Ionicons name="camera-outline" size={18} color="#10B981" />
            <Text style={styles.workflowButtonText}>Proof of Pickup</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.workflowButton}
            onPress={() =>
              router.push({
                pathname: "/driver/proof-of-delivery",
                params: { loadId: proofId, orderId: proofId },
              } as any)
            }
          >
            <Ionicons name="checkmark-done-outline" size={18} color="#10B981" />
            <Text style={styles.workflowButtonText}>Proof of Delivery</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.replace("/driver/mobile-driver-app" as any)}
        >
          <Text style={styles.backButtonText}>Back To Driver App</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: freightTheme.colors.background },
  content: { paddingBottom: 100 },
  hero: {
    backgroundColor: "#020617",
    paddingTop: 22,
    paddingHorizontal: 20,
    paddingBottom: 26,
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
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
    marginBottom: 14,
  },
  kicker: {
    color: "#10B981",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    color: "#FFFFFF",
    marginTop: 6,
  },
  subtitle: {
    color: "#CBD5E1",
    fontWeight: "700",
    lineHeight: 22,
    marginTop: 8,
  },
  card: {
    backgroundColor: freightTheme.colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
    padding: 18,
    marginHorizontal: 18,
    marginTop: 16,
  },
  cardTitle: {
    color: freightTheme.colors.primary,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  cardValue: {
    color: freightTheme.colors.text,
    fontSize: 15,
    fontWeight: "800",
    marginTop: 6,
  },
  loadingRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    marginTop: 12,
  },
  loadingText: {
    color: freightTheme.colors.mutedText,
    fontWeight: "800",
  },
  stopTabs: {
    flexDirection: "row",
    gap: 10,
    marginHorizontal: 18,
    marginTop: 16,
  },
  stopTab: {
    flex: 1,
    backgroundColor: freightTheme.colors.card,
    borderWidth: 1,
    borderColor: freightTheme.colors.primary,
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  stopTabActive: { backgroundColor: freightTheme.colors.primary },
  stopTabText: { color: freightTheme.colors.primary, fontWeight: "900" },
  stopTabTextActive: { color: "#FFFFFF" },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  sectionTitle: {
    color: freightTheme.colors.text,
    fontSize: 21,
    fontWeight: "900",
  },
  addressLabel: {
    color: freightTheme.colors.primary,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  addressText: {
    color: freightTheme.colors.text,
    fontWeight: "900",
    lineHeight: 22,
    marginTop: 5,
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: freightTheme.colors.primary,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryButtonText: { color: "#FFFFFF", fontWeight: "900" },
  mapButtons: { flexDirection: "row", gap: 10, marginTop: 10 },
  secondaryButton: {
    flex: 1,
    backgroundColor: freightTheme.colors.surface,
    borderWidth: 1,
    borderColor: freightTheme.colors.primary,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: freightTheme.colors.primary,
    fontWeight: "900",
  },
  workflowButton: {
    backgroundColor: freightTheme.colors.surface,
    borderRadius: 14,
    padding: 15,
    marginTop: 10,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  workflowButtonText: {
    color: freightTheme.colors.text,
    fontWeight: "900",
  },
  backButton: {
    backgroundColor: "#111827",
    marginHorizontal: 18,
    marginTop: 18,
    padding: 15,
    borderRadius: 16,
    alignItems: "center",
  },
  backButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
});