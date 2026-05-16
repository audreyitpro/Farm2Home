import React, { useMemo, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";

import farmTheme from "../styles/farmTheme";

type LoadOption = {
  id: string;
  origin: string;
  destination: string;
  pickupWindow: string;
  deliveryWindow: string;
  equipment: string;
  rate: number;
  miles: number;
  broker: string;
};

const loads: LoadOption[] = [
  {
    id: "load-1001",
    origin: "Detroit, MI",
    destination: "Columbus, OH",
    pickupWindow: "Today 2 PM - 5 PM",
    deliveryWindow: "Tomorrow 8 AM - 12 PM",
    equipment: "Cargo Van",
    rate: 650,
    miles: 205,
    broker: "Farm2Home Logistics",
  },
  {
    id: "load-1002",
    origin: "Sterling Heights, MI",
    destination: "Chicago, IL",
    pickupWindow: "Tomorrow 9 AM - 12 PM",
    deliveryWindow: "Tomorrow 5 PM - 9 PM",
    equipment: "Box Truck",
    rate: 980,
    miles: 295,
    broker: "ASO Freight Partner",
  },
  {
    id: "load-1003",
    origin: "Ann Arbor, MI",
    destination: "Cleveland, OH",
    pickupWindow: "Friday 8 AM - 10 AM",
    deliveryWindow: "Friday 3 PM - 6 PM",
    equipment: "Sprinter Van",
    rate: 720,
    miles: 170,
    broker: "FreshRoute Network",
  },
];

export default function CarrierBooking() {
  const [selectedLoadId, setSelectedLoadId] = useState("load-1001");

  const selectedLoad = useMemo(() => {
    return loads.find((load) => load.id === selectedLoadId) || loads[0];
  }, [selectedLoadId]);

  const ratePerMile = selectedLoad.rate / selectedLoad.miles;

  function bookLoad() {
    Alert.alert(
      "Load Booked",
      `${selectedLoad.origin} → ${selectedLoad.destination}\nRate: $${selectedLoad.rate.toFixed(
        2
      )}\n\nNext step: proof of pickup.`
    );

    router.push("/freight/proof-of-pickup");
  }

  function callBroker() {
    Alert.alert(
      "Broker Contact",
      `${selectedLoad.broker} contact action will connect to phone/chat later.`
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Farm2Home Freight</Text>
        <Text style={styles.title}>Carrier Booking</Text>
        <Text style={styles.subtitle}>
          Review available loads, compare rates, and book carrier freight.
        </Text>
      </View>

      <View style={styles.selectedCard}>
        <Text style={styles.badge}>Selected Load</Text>
        <Text style={styles.routeText}>
          {selectedLoad.origin} → {selectedLoad.destination}
        </Text>
        <Text style={styles.metaText}>
          {selectedLoad.equipment} · {selectedLoad.miles} miles
        </Text>

        <View style={styles.rateBox}>
          <View>
            <Text style={styles.rateLabel}>Carrier Rate</Text>
            <Text style={styles.rateValue}>${selectedLoad.rate.toFixed(2)}</Text>
          </View>

          <View>
            <Text style={styles.rateLabel}>Rate / Mile</Text>
            <Text style={styles.rateValue}>${ratePerMile.toFixed(2)}</Text>
          </View>
        </View>

        <Text style={styles.windowText}>Pickup: {selectedLoad.pickupWindow}</Text>
        <Text style={styles.windowText}>Delivery: {selectedLoad.deliveryWindow}</Text>
        <Text style={styles.windowText}>Broker: {selectedLoad.broker}</Text>

        <TouchableOpacity style={styles.primaryButton} onPress={bookLoad}>
          <Text style={styles.primaryText}>Book This Load</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.outlineButton} onPress={callBroker}>
          <Text style={styles.outlineText}>Contact Broker</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Available Loads</Text>

      {loads.map((load) => {
        const active = selectedLoad.id === load.id;

        return (
          <TouchableOpacity
            key={load.id}
            style={[styles.loadCard, active && styles.loadCardActive]}
            onPress={() => setSelectedLoadId(load.id)}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.loadRoute}>
                {load.origin} → {load.destination}
              </Text>
              <Text style={styles.loadMeta}>
                {load.equipment} · {load.miles} miles · {load.broker}
              </Text>
              <Text style={styles.loadWindow}>Pickup: {load.pickupWindow}</Text>
            </View>

            <View style={styles.priceBlock}>
              <Text style={styles.loadRate}>${load.rate}</Text>
              <Text style={styles.loadRateSub}>
                ${(load.rate / load.miles).toFixed(2)}/mi
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}

      <View style={styles.aiCard}>
        <Text style={styles.aiTitle}>AI Booking Intelligence</Text>
        <Text style={styles.aiText}>
          Later this can recommend loads based on lane history, driver location,
          equipment, rate per mile, weather, and delivery risk.
        </Text>
      </View>

      <View style={{ height: 90 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F4F6" },

  hero: {
    backgroundColor: "#111827",
    paddingTop: 64,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },

  eyebrow: { color: "#93C5FD", fontWeight: "900", marginBottom: 8 },

  title: { color: "#FFFFFF", fontSize: 36, fontWeight: "900", marginBottom: 10 },

  subtitle: { color: "#D1D5DB", fontWeight: "700", lineHeight: 23 },

  selectedCard: {
    backgroundColor: "#FFFFFF",
    margin: 18,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  badge: {
    alignSelf: "flex-start",
    backgroundColor: "#DBEAFE",
    color: "#1D4ED8",
    fontWeight: "900",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: 10,
  },

  routeText: { color: "#111827", fontSize: 24, fontWeight: "900" },

  metaText: { color: "#6B7280", fontWeight: "800", marginTop: 6 },

  rateBox: {
    backgroundColor: "#EFF6FF",
    borderRadius: 18,
    padding: 15,
    marginTop: 14,
    marginBottom: 14,
    flexDirection: "row",
    justifyContent: "space-between",
  },

  rateLabel: { color: "#374151", fontWeight: "900" },

  rateValue: { color: "#2563EB", fontSize: 24, fontWeight: "900", marginTop: 4 },

  windowText: { color: "#374151", fontWeight: "800", lineHeight: 24 },

  primaryButton: {
    backgroundColor: "#2563EB",
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 16,
    marginBottom: 10,
  },

  primaryText: { color: "#FFFFFF", fontWeight: "900" },

  outlineButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#2563EB",
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
  },

  outlineText: { color: "#2563EB", fontWeight: "900" },

  sectionTitle: {
    color: "#111827",
    fontSize: 23,
    fontWeight: "900",
    paddingHorizontal: 18,
    marginBottom: 12,
  },

  loadCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    marginBottom: 12,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    flexDirection: "row",
    gap: 12,
  },

  loadCardActive: {
    borderColor: "#2563EB",
    borderWidth: 2,
    backgroundColor: "#EFF6FF",
  },

  loadRoute: { color: "#111827", fontSize: 18, fontWeight: "900" },

  loadMeta: { color: "#6B7280", fontWeight: "700", marginTop: 5 },

  loadWindow: { color: "#374151", fontWeight: "800", marginTop: 6 },

  priceBlock: { alignItems: "flex-end", justifyContent: "center" },

  loadRate: { color: "#2563EB", fontSize: 20, fontWeight: "900" },

  loadRateSub: { color: "#6B7280", fontWeight: "800", marginTop: 4 },

  aiCard: {
    backgroundColor: "#111827",
    marginHorizontal: 18,
    marginTop: 8,
    borderRadius: 22,
    padding: 18,
  },

  aiTitle: { color: "#FFFFFF", fontSize: 23, fontWeight: "900", marginBottom: 8 },

  aiText: { color: "#BFDBFE", fontWeight: "700", lineHeight: 22 },
});