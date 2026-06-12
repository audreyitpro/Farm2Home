// app/freight/carrier-booking.tsx

import React, { useMemo, useState } from "react";
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

const FREIGHT_ROUTES = {
  dashboard: "/freight/dashboard",
  board: "/freight/board",
  myLoads: "/freight/my-loads",
  liveLoads: "/freight/live-loads",
  proofOfPickup: "/freight/proof-of-pickup",
  support: "/freight/support",
} as const;

type FreightRoute = (typeof FREIGHT_ROUTES)[keyof typeof FREIGHT_ROUTES];

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

function goTo(route: FreightRoute) {
  router.push(route as any);
}

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
      )}\n\nNext step: proof of pickup.`,
      [
        {
          text: "Continue",
          onPress: () =>
            router.push({
              pathname: FREIGHT_ROUTES.proofOfPickup as any,
              params: { loadId: selectedLoad.id },
            }),
        },
      ]
    );
  }

  function callBroker() {
    Alert.alert(
      "Broker Contact",
      `${selectedLoad.broker} contact action will connect to phone/chat later.`
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>Farm2Home Freight Connect</Text>
            <Text style={styles.title}>Carrier Booking</Text>
            <Text style={styles.subtitle}>
              Review available loads, compare rates, and book carrier freight.
            </Text>
          </View>

          <TouchableOpacity style={styles.heroIcon} onPress={() => goTo(FREIGHT_ROUTES.dashboard)}>
            <Ionicons name="calendar-outline" size={34} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.quickGrid}>
          <QuickLink icon="grid-outline" label="Dashboard" route={FREIGHT_ROUTES.dashboard} />
          <QuickLink icon="list-outline" label="Load Board" route={FREIGHT_ROUTES.board} />
          <QuickLink icon="briefcase-outline" label="My Loads" route={FREIGHT_ROUTES.myLoads} />
          <QuickLink icon="pulse-outline" label="Live Loads" route={FREIGHT_ROUTES.liveLoads} />
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

          <InfoLine icon="time-outline" text={`Pickup: ${selectedLoad.pickupWindow}`} />
          <InfoLine icon="flag-outline" text={`Delivery: ${selectedLoad.deliveryWindow}`} />
          <InfoLine icon="business-outline" text={`Broker: ${selectedLoad.broker}`} />

          <TouchableOpacity style={styles.primaryButton} onPress={bookLoad}>
            <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
            <Text style={styles.primaryText}>Book This Load</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.outlineButton} onPress={callBroker}>
            <Ionicons name="call-outline" size={18} color={COLORS.red} />
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

          <TouchableOpacity style={styles.aiButton} onPress={() => goTo(FREIGHT_ROUTES.support)}>
            <Ionicons name="headset-outline" size={18} color="#FFFFFF" />
            <Text style={styles.aiButtonText}>Need Booking Help?</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 90 }} />
      </ScrollView>
    </SafeAreaView>
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
      <Ionicons name={icon} size={22} color={COLORS.red} />
      <Text style={styles.quickText}>{label}</Text>
    </TouchableOpacity>
  );
}

function InfoLine({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.infoLine}>
      <Ionicons name={icon} size={17} color={COLORS.red} />
      <Text style={styles.windowText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  container: { flex: 1, backgroundColor: COLORS.bg },
  hero: {
    backgroundColor: COLORS.black,
    paddingTop: 30,
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
  title: { color: "#FFFFFF", fontSize: 34, fontWeight: "900", marginBottom: 10 },
  subtitle: { color: "#D1D5DB", fontWeight: "700", lineHeight: 23 },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 18,
    marginTop: 18,
    marginBottom: 14,
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
  selectedCard: {
    backgroundColor: COLORS.card,
    marginHorizontal: 18,
    marginBottom: 18,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: "#FFF1F2",
    color: COLORS.red,
    fontWeight: "900",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: 10,
  },
  routeText: { color: COLORS.text, fontSize: 24, fontWeight: "900" },
  metaText: { color: COLORS.muted, fontWeight: "800", marginTop: 6 },
  rateBox: {
    backgroundColor: "#FFF1F2",
    borderRadius: 18,
    padding: 15,
    marginTop: 14,
    marginBottom: 14,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  rateLabel: { color: COLORS.text, fontWeight: "900" },
  rateValue: { color: COLORS.red, fontSize: 24, fontWeight: "900", marginTop: 4 },
  infoLine: { flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 6 },
  windowText: { color: COLORS.text, fontWeight: "800", lineHeight: 24, flex: 1 },
  primaryButton: {
    backgroundColor: COLORS.red,
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    marginBottom: 10,
    flexDirection: "row",
    gap: 8,
  },
  primaryText: { color: "#FFFFFF", fontWeight: "900" },
  outlineButton: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.red,
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  outlineText: { color: COLORS.red, fontWeight: "900" },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 23,
    fontWeight: "900",
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  loadCard: {
    backgroundColor: COLORS.card,
    marginHorizontal: 18,
    marginBottom: 12,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    gap: 12,
  },
  loadCardActive: {
    borderColor: COLORS.red,
    borderWidth: 2,
    backgroundColor: "#FFF1F2",
  },
  loadRoute: { color: COLORS.text, fontSize: 18, fontWeight: "900" },
  loadMeta: { color: COLORS.muted, fontWeight: "700", marginTop: 5 },
  loadWindow: { color: COLORS.text, fontWeight: "800", marginTop: 6 },
  priceBlock: { alignItems: "flex-end", justifyContent: "center" },
  loadRate: { color: COLORS.red, fontSize: 20, fontWeight: "900" },
  loadRateSub: { color: COLORS.muted, fontWeight: "800", marginTop: 4 },
  aiCard: {
    backgroundColor: COLORS.black,
    marginHorizontal: 18,
    marginTop: 8,
    borderRadius: 22,
    padding: 18,
  },
  aiTitle: { color: "#FFFFFF", fontSize: 23, fontWeight: "900", marginBottom: 8 },
  aiText: { color: "#D1D5DB", fontWeight: "700", lineHeight: 22 },
  aiButton: {
    backgroundColor: COLORS.red,
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
    flexDirection: "row",
    gap: 8,
  },
  aiButtonText: { color: "#FFFFFF", fontWeight: "900" },
});