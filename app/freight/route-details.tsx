// app/freight/route-details.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../data/supabaseClient";

const FREIGHT_ROUTES = {
  dashboard: "/freight/dashboard",
  board: "/freight/board",
  myLoads: "/freight/my-loads",
  liveLoads: "/freight/live-loads",
  liveRoute: "/freight/live-route",
  proofOfPickup: "/freight/proof-of-pickup",
  proofOfDelivery: "/freight/proof-of-delivery",
  support: "/freight/support",
  earnings: "/freight/earnings",
  login: "/freight/login",
  register: "/freight/register",
} as const;

type FreightRoute = (typeof FREIGHT_ROUTES)[keyof typeof FREIGHT_ROUTES];

const COLORS = {
  bg: "#F4F5F7",
  card: "#FFFFFF",
  surface: "#F9FAFB",
  black: "#050505",
  red: "#D71920",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  green: "#16A34A",
  amber: "#D97706",
  purple: "#7C3AED",
  teal: "#0F766E",
  slate: "#64748B",
};

function normalize(value: any) {
  return String(value || "").trim().toLowerCase();
}

function goTo(route: FreightRoute) {
  router.push(route as any);
}

function money(value: any) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function statusLabel(value: any) {
  return String(value || "unknown")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDateTime(value?: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleString();
}

function statusColor(status: string) {
  const value = normalize(status);

  if (value === "accepted") return COLORS.red;
  if (value === "arrived_pickup") return COLORS.teal;
  if (value === "picked_up") return COLORS.amber;
  if (value === "in_transit") return COLORS.purple;
  if (value === "arrived_dropoff") return COLORS.teal;
  if (value === "delivered" || value === "completed") return COLORS.green;

  return COLORS.slate;
}

export default function FreightRouteDetailsScreen() {
  const params = useLocalSearchParams();
  const loadId = Array.isArray(params.loadId) ? params.loadId[0] : String(params.loadId || "");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [carrier, setCarrier] = useState<any>(null);
  const [load, setLoad] = useState<any>(null);

  useFocusEffect(
    useCallback(() => {
      loadRouteDetails();
    }, [loadId])
  );

  const timeline = useMemo(
    () => [
      { label: "Accepted", value: load?.accepted_at, icon: "checkmark-circle-outline" },
      { label: "Arrived Pickup", value: load?.arrived_pickup_at, icon: "location-outline" },
      { label: "Picked Up", value: load?.picked_up_at, icon: "archive-outline" },
      { label: "In Transit", value: load?.in_transit_at, icon: "navigate-outline" },
      { label: "Arrived Dropoff", value: load?.arrived_dropoff_at, icon: "flag-outline" },
      { label: "Delivered", value: load?.delivered_at, icon: "checkmark-done-outline" },
    ],
    [load]
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

  async function loadRouteDetails() {
    try {
      setLoading(true);

      const stored = await getStoredCarrier();
      const { data: authData } = await supabase.auth.getUser();
      const email = normalize(stored?.email || authData?.user?.email || "");

      if (!email) {
        router.replace(FREIGHT_ROUTES.login as any);
        return;
      }

      const { data: dbCarrier, error: carrierError } = await supabase
        .from("freight_users")
        .select("*")
        .eq("email", email)
        .maybeSingle();

      if (carrierError) {
        console.log("Route details carrier error:", carrierError.message);
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
      };

      await persistCarrier(mergedCarrier);

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
        Alert.alert("Load Not Found", "This route could not be found.");
        router.replace(FREIGHT_ROUTES.myLoads as any);
        return;
      }

      setLoad(dbLoad);
    } catch (error: any) {
      Alert.alert("Route Details Error", error?.message || "Unable to load route details.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadRouteDetails();
  }

  function openRoute(route: FreightRoute) {
    if (
      route === FREIGHT_ROUTES.liveRoute ||
      route === FREIGHT_ROUTES.proofOfPickup ||
      route === FREIGHT_ROUTES.proofOfDelivery
    ) {
      router.push({
        pathname: route as any,
        params: { loadId: load?.id || loadId },
      });
      return;
    }

    goTo(route);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <ActivityIndicator size="large" color={COLORS.red} />
        <Text style={styles.centerText}>Loading route details...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>Farm2Home Freight Connect</Text>
            <Text style={styles.title}>Route Details</Text>
            <Text style={styles.subtitle}>
              Review delivery timeline, proof status, GPS details, and freight route information.
            </Text>
          </View>

          <TouchableOpacity style={styles.heroIcon} onPress={() => goTo(FREIGHT_ROUTES.dashboard)}>
            <Ionicons name="trail-sign-outline" size={34} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.loadCard}>
          <View style={styles.loadTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.loadTitle}>{load?.title || load?.commodity || "Freight Load"}</Text>
              <Text style={styles.loadSub}>Load #{String(load?.id || "").slice(-6)}</Text>
            </View>

            <View style={[styles.statusPill, { backgroundColor: statusColor(load?.status) }]}>
              <Text style={styles.statusText}>{statusLabel(load?.status)}</Text>
            </View>
          </View>

          <View style={styles.routeBox}>
            <RouteStop label="Pickup" value={load?.pickup_location || "Pickup TBD"} icon="radio-button-on" />
            <View style={styles.routeLine} />
            <RouteStop label="Dropoff" value={load?.dropoff_location || "Dropoff TBD"} icon="location" />
          </View>

          <View style={styles.infoGrid}>
            <InfoBox label="Payout" value={money(load?.rate || load?.freight_total || load?.total_due)} />
            <InfoBox label="Miles" value={`${Number(load?.distance_miles || load?.miles || 0).toFixed(0)} mi`} />
            <InfoBox label="Equipment" value={load?.equipment_type || "Standard"} />
            <InfoBox label="Commodity" value={load?.commodity || "Farm Freight"} />
          </View>
        </View>

        <View style={styles.quickGrid}>
          <QuickAction icon="map-outline" label="Live Route" onPress={() => openRoute(FREIGHT_ROUTES.liveRoute)} />
          <QuickAction icon="camera-outline" label="Proof Pickup" onPress={() => openRoute(FREIGHT_ROUTES.proofOfPickup)} />
          <QuickAction icon="checkmark-done-outline" label="Proof Delivery" onPress={() => openRoute(FREIGHT_ROUTES.proofOfDelivery)} />
          <QuickAction icon="headset-outline" label="Support" onPress={() => openRoute(FREIGHT_ROUTES.support)} />
        </View>

        <View style={styles.card}>
          <SectionHeader
            icon="time-outline"
            title="Route Timeline"
            subtitle="Milestones captured during freight movement."
          />

          {timeline.map((item, index) => (
            <View key={item.label} style={styles.timelineRow}>
              <View style={[styles.timelineIcon, item.value && styles.timelineIconDone]}>
                <Ionicons
                  name={item.icon as any}
                  size={18}
                  color={item.value ? "#FFFFFF" : COLORS.red}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.timelineTitle}>{item.label}</Text>
                <Text style={styles.timelineDate}>{formatDateTime(item.value)}</Text>
              </View>

              {index < timeline.length - 1 && <View />}
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <SectionHeader
            icon="navigate-circle-outline"
            title="GPS Status"
            subtitle="Most recent live route coordinates."
          />

          <InfoRow label="Latitude" value={load?.current_latitude ? Number(load.current_latitude).toFixed(5) : "Not updated"} />
          <InfoRow label="Longitude" value={load?.current_longitude ? Number(load.current_longitude).toFixed(5) : "Not updated"} />
          <InfoRow label="GPS Accuracy" value={load?.gps_accuracy ? `${Number(load.gps_accuracy).toFixed(1)} meters` : "Not updated"} />
          <InfoRow label="Last GPS Update" value={formatDateTime(load?.gps_updated_at)} />
        </View>

        <View style={styles.card}>
          <SectionHeader
            icon="document-text-outline"
            title="Proof Status"
            subtitle="Pickup and delivery proof records."
          />

          <InfoRow label="Pickup Completed" value={load?.picked_up_at ? "Yes" : "No"} />
          <InfoRow label="Delivery Completed" value={load?.delivered_at ? "Yes" : "No"} />
          <InfoRow label="Receiver" value={load?.delivery_receiver_name || "Not recorded"} />
          <InfoRow label="Product Condition" value={load?.product_condition || "Not recorded"} />
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={() => openRoute(FREIGHT_ROUTES.myLoads)}>
          <Ionicons name="briefcase-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryText}>Back to My Loads</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.darkButton} onPress={() => openRoute(FREIGHT_ROUTES.dashboard)}>
          <Ionicons name="grid-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryText}>Freight Dashboard</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
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

function RouteStop({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.routeStop}>
      <Ionicons name={icon} size={18} color={COLORS.red} />
      <View style={{ flex: 1 }}>
        <Text style={styles.routeLabel}>{label}</Text>
        <Text style={styles.routeText}>{value}</Text>
      </View>
    </View>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoBox}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoRowLabel}>{label}</Text>
      <Text style={styles.infoRowValue}>{value}</Text>
    </View>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.quickAction} onPress={onPress}>
      <Ionicons name={icon} size={22} color={COLORS.red} />
      <Text style={styles.quickActionText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
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
  title: { color: "#FFFFFF", fontSize: 32, fontWeight: "900", marginBottom: 10 },
  subtitle: { color: "#D1D5DB", lineHeight: 22, fontWeight: "700" },
  loadCard: {
    backgroundColor: COLORS.card,
    marginHorizontal: 18,
    marginTop: 16,
    marginBottom: 14,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  loadTop: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    marginBottom: 12,
  },
  loadTitle: { color: COLORS.text, fontSize: 21, fontWeight: "900" },
  loadSub: { color: COLORS.muted, fontWeight: "700", marginTop: 4 },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  statusText: { color: "#FFFFFF", fontWeight: "900", fontSize: 12 },
  routeBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
  },
  routeStop: { flexDirection: "row", gap: 10, alignItems: "center" },
  routeLine: {
    width: 2,
    height: 22,
    backgroundColor: COLORS.border,
    marginLeft: 8,
    marginVertical: 8,
  },
  routeLabel: {
    color: COLORS.red,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  routeText: { color: COLORS.text, fontWeight: "900", marginTop: 3, lineHeight: 20 },
  infoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  infoBox: {
    width: "48%",
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
  },
  infoLabel: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  infoValue: { color: COLORS.text, fontWeight: "900", marginTop: 4 },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  quickAction: {
    width: "48%",
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    gap: 8,
  },
  quickActionText: { color: COLORS.text, fontWeight: "900", textAlign: "center" },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 18,
    marginHorizontal: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionHeader: { flexDirection: "row", gap: 10, alignItems: "flex-start", marginBottom: 14 },
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
  timelineRow: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 13,
    marginBottom: 10,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  timelineIcon: {
    width: 38,
    height: 38,
    borderRadius: 16,
    backgroundColor: "#FFF1F2",
    alignItems: "center",
    justifyContent: "center",
  },
  timelineIconDone: { backgroundColor: COLORS.red },
  timelineTitle: { color: COLORS.text, fontWeight: "900" },
  timelineDate: { color: COLORS.muted, fontWeight: "700", marginTop: 3 },
  infoRow: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 13,
    marginBottom: 9,
    flexDirection: "row",
    gap: 10,
  },
  infoRowLabel: { color: COLORS.text, fontWeight: "900", flex: 1 },
  infoRowValue: { color: COLORS.red, fontWeight: "900", flex: 1, textAlign: "right" },
  primaryButton: {
    backgroundColor: COLORS.red,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 18,
    marginTop: 4,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  darkButton: {
    backgroundColor: COLORS.black,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 18,
    marginTop: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryText: { color: "#FFFFFF", fontWeight: "900" },
});