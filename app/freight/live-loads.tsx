// app/freight/live-loads.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../data/supabaseClient";

const FREIGHT_ROUTES = {
  dashboard: "/freight/dashboard",
  board: "/freight/board",
  liveLoads: "/freight/live-loads",
  myLoads: "/freight/my-loads",
  liveRoute: "/freight/live-route",
  proofOfPickup: "/freight/proof-of-pickup",
  proofOfDelivery: "/freight/proof-of-delivery",
  profile: "/freight/profile",
  settings: "/freight/settings",
  connectBank: "/freight/connect-bank",
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
  redDark: "#9F1117",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  green: "#16A34A",
  amber: "#D97706",
  purple: "#7C3AED",
  blue: "#2563EB",
  teal: "#0F766E",
  slate: "#64748B",
};

type FreightLoad = {
  id: string;
  title?: string;
  commodity?: string;
  farmer_name?: string;
  pickup_location?: string;
  dropoff_location?: string;
  pickup_date?: string;
  pickup_time?: string;
  dropoff_date?: string;
  dropoff_time?: string;
  equipment_type?: string;
  weight_lbs?: number;
  distance_miles?: number;
  rate?: number;
  status?: string;
  carrier_id?: string;
  driver_id?: string;
  accepted_by?: string;
  accepted_at?: string;
  arrived_pickup_at?: string;
  picked_up_at?: string;
  in_transit_at?: string;
  arrived_dropoff_at?: string;
  delivered_at?: string;
  updated_at?: string;
};

function normalize(value: any) {
  return String(value || "").trim().toLowerCase();
}

function money(value: number) {
  return `$${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function goTo(route: FreightRoute) {
  router.push(route as any);
}

function statusColor(status: string) {
  const value = normalize(status);

  if (value === "available") return COLORS.blue;
  if (value === "accepted") return COLORS.red;
  if (value === "arrived_pickup") return COLORS.teal;
  if (value === "picked_up") return COLORS.amber;
  if (value === "in_transit") return COLORS.purple;
  if (value === "arrived_dropoff") return COLORS.teal;
  if (value === "delivered" || value === "completed") return COLORS.green;

  return COLORS.slate;
}

function statusLabel(status: string) {
  return String(status || "available")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function FreightLiveLoadsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [carrier, setCarrier] = useState<any>(null);
  const [loads, setLoads] = useState<FreightLoad[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadLiveLoads();
    }, [])
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
      stripeAccountId:
        nextCarrier.stripeAccountId ||
        nextCarrier.stripe_account_id ||
        "",
      stripe_account_id:
        nextCarrier.stripe_account_id ||
        nextCarrier.stripeAccountId ||
        "",
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

  async function loadLiveLoads() {
    try {
      setLoading(true);

      const stored = await getStoredCarrier();
      const { data: authData } = await supabase.auth.getUser();
      const authUser = authData?.user;

      const email = normalize(stored?.email || authUser?.email || "");

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
        console.log("Freight live loads profile error:", carrierError.message);
      }

      if (!dbCarrier) {
        Alert.alert(
          "Freight Profile Missing",
          "No freight profile was found for this email. Please complete freight registration again."
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
          stored?.contactName ||
          "Freight Connect Carrier",
        businessName:
          dbCarrier.business_name ||
          dbCarrier.company_name ||
          stored?.businessName ||
          stored?.companyName ||
          "Freight Connect Carrier",
        stripeAccountId:
          dbCarrier.stripe_account_id ||
          stored?.stripeAccountId ||
          stored?.stripe_account_id ||
          "",
        stripe_account_id:
          dbCarrier.stripe_account_id ||
          stored?.stripe_account_id ||
          stored?.stripeAccountId ||
          "",
      };

      await persistCarrier(mergedCarrier);

      const carrierId = mergedCarrier.id;

      const { data, error } = await supabase
        .from("freight_loads")
        .select("*")
        .or(`carrier_id.eq.${carrierId},driver_id.eq.${carrierId},accepted_by.eq.${carrierId}`)
        .in("status", [
          "accepted",
          "arrived_pickup",
          "picked_up",
          "in_transit",
          "arrived_dropoff",
        ])
        .order("updated_at", { ascending: false });

      if (error) {
        console.log("Live freight loads error:", error.message);
        setLoads([]);
        return;
      }

      setLoads(Array.isArray(data) ? data : []);
    } catch (error) {
      console.log("Load live freight error:", error);
      Alert.alert("Live Loads Error", "Unable to load live freight loads.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadLiveLoads();
  }

  async function updateStatus(load: FreightLoad, nextStatus: string) {
    try {
      const now = new Date().toISOString();

      const payload: any = {
        status: nextStatus,
        updated_at: now,
      };

      if (nextStatus === "arrived_pickup") payload.arrived_pickup_at = now;
      if (nextStatus === "picked_up") payload.picked_up_at = now;
      if (nextStatus === "in_transit") payload.in_transit_at = now;
      if (nextStatus === "arrived_dropoff") payload.arrived_dropoff_at = now;
      if (nextStatus === "delivered") payload.delivered_at = now;

      const { error } = await supabase
        .from("freight_loads")
        .update(payload)
        .eq("id", load.id);

      if (error) throw error;

      await loadLiveLoads();
    } catch (error: any) {
      Alert.alert("Update Error", error?.message || "Unable to update load.");
    }
  }

  function openLiveRoute(load: FreightLoad) {
    router.push({
      pathname: FREIGHT_ROUTES.liveRoute as any,
      params: { loadId: load.id },
    });
  }

  function openProofOfPickup(load: FreightLoad) {
    router.push({
      pathname: FREIGHT_ROUTES.proofOfPickup as any,
      params: { loadId: load.id },
    });
  }

  function openProofOfDelivery(load: FreightLoad) {
    router.push({
      pathname: FREIGHT_ROUTES.proofOfDelivery as any,
      params: { loadId: load.id },
    });
  }

  function nextAction(load: FreightLoad) {
    const status = normalize(load.status);

    if (status === "accepted") {
      return (
        <ActionButton
          title="Arrived Pickup"
          icon="location-outline"
          onPress={() => updateStatus(load, "arrived_pickup")}
        />
      );
    }

    if (status === "arrived_pickup") {
      return (
        <ActionButton
          title="Proof of Pickup"
          icon="camera-outline"
          onPress={() => openProofOfPickup(load)}
        />
      );
    }

    if (status === "picked_up") {
      return (
        <ActionButton
          title="Start Transit"
          icon="navigate-outline"
          onPress={() => updateStatus(load, "in_transit")}
        />
      );
    }

    if (status === "in_transit") {
      return (
        <ActionButton
          title="Arrived Dropoff"
          icon="flag-outline"
          onPress={() => updateStatus(load, "arrived_dropoff")}
        />
      );
    }

    if (status === "arrived_dropoff") {
      return (
        <ActionButton
          title="Proof of Delivery"
          icon="checkmark-done-outline"
          onPress={() => openProofOfDelivery(load)}
        />
      );
    }

    return null;
  }

  const totalValue = useMemo(
    () => loads.reduce((sum, load) => sum + Number(load.rate || 0), 0),
    [loads]
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <ActivityIndicator size="large" color={COLORS.red} />
        <Text style={styles.centerText}>Loading live freight loads...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />

      <View style={styles.hero}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>Farm2Home Freight Connect</Text>
          <Text style={styles.title}>Live Loads</Text>
          <Text style={styles.subtitle}>
            Track active freight movement, route status, pickup progress, and dropoff workflow.
          </Text>
        </View>

        <TouchableOpacity style={styles.heroIcon} onPress={() => goTo(FREIGHT_ROUTES.dashboard)}>
          <Ionicons name="trail-sign-outline" size={32} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.summaryRow}>
        <SummaryCard label="Live Loads" value={loads.length} />
        <SummaryCard label="Route Value" value={money(totalValue)} />
      </View>

      <View style={styles.navRow}>
        <NavButton title="Dashboard" icon="grid-outline" route={FREIGHT_ROUTES.dashboard} />
        <NavButton title="Board" icon="list-outline" route={FREIGHT_ROUTES.board} outline />
      </View>

      <View style={styles.quickGrid}>
        <QuickLink icon="briefcase-outline" label="My Loads" route={FREIGHT_ROUTES.myLoads} />
        <QuickLink icon="person-outline" label="Profile" route={FREIGHT_ROUTES.profile} />
        <QuickLink icon="business-outline" label="Connect Bank" route={FREIGHT_ROUTES.connectBank} />
        <QuickLink icon="settings-outline" label="Settings" route={FREIGHT_ROUTES.settings} />
      </View>

      <FlatList
        data={loads}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Ionicons name="trail-sign-outline" size={38} color={COLORS.red} />
            <Text style={styles.emptyTitle}>No live freight loads.</Text>
            <Text style={styles.emptyText}>
              Accepted freight loads will appear here while they are active.
            </Text>

            <TouchableOpacity style={styles.emptyButton} onPress={() => goTo(FREIGHT_ROUTES.board)}>
              <Ionicons name="list-outline" size={18} color="#FFFFFF" />
              <Text style={styles.emptyButtonText}>Open Load Board</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.loadTitle}>{item.title || item.commodity || "Freight Load"}</Text>
                <Text style={styles.farmName}>{item.farmer_name || "Farm2Home Partner"}</Text>
              </View>

              <View style={[styles.statusPill, { backgroundColor: statusColor(item.status || "") }]}>
                <Text style={styles.statusText}>{statusLabel(item.status || "")}</Text>
              </View>
            </View>

            <View style={styles.routeBox}>
              <Text style={styles.routeLabel}>Pickup</Text>
              <Text style={styles.routeText}>{item.pickup_location || "Pickup TBD"}</Text>
              <View style={styles.routeLine} />
              <Text style={styles.routeLabel}>Dropoff</Text>
              <Text style={styles.routeText}>{item.dropoff_location || "Dropoff TBD"}</Text>
            </View>

            <View style={styles.infoGrid}>
              <Info label="Pickup" value={`${item.pickup_date || "TBD"} · ${item.pickup_time || "TBD"}`} />
              <Info label="Equipment" value={item.equipment_type || "Standard"} />
              <Info label="Miles" value={`${Number(item.distance_miles || 0).toFixed(0)} mi`} />
              <Info label="Rate" value={money(Number(item.rate || 0))} />
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.trackButton} onPress={() => openLiveRoute(item)}>
                <Ionicons name="map-outline" size={18} color={COLORS.red} />
                <Text style={styles.trackButtonText}>Live Route</Text>
              </TouchableOpacity>

              {nextAction(item)}
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function NavButton({
  title,
  icon,
  route,
  outline,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: FreightRoute;
  outline?: boolean;
}) {
  return (
    <TouchableOpacity
      style={outline ? styles.navOutline : styles.navButton}
      onPress={() => goTo(route)}
    >
      <Ionicons name={icon} size={18} color={outline ? COLORS.red : "#FFFFFF"} />
      <Text style={outline ? styles.navOutlineText : styles.navText}>{title}</Text>
    </TouchableOpacity>
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
      <Text style={styles.quickLinkText}>{label}</Text>
    </TouchableOpacity>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoBox}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoText}>{value}</Text>
    </View>
  );
}

function ActionButton({
  title,
  icon,
  onPress,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.actionButton} onPress={onPress}>
      <Ionicons name={icon} size={18} color="#FFFFFF" />
      <Text style={styles.actionText}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
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
    textTransform: "uppercase",
    letterSpacing: 1,
    fontSize: 12,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "900",
    marginTop: 6,
  },
  subtitle: {
    color: "#D1D5DB",
    lineHeight: 22,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 8,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 10,
    padding: 18,
    paddingBottom: 10,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 15,
  },
  summaryValue: { color: COLORS.black, fontSize: 22, fontWeight: "900" },
  summaryLabel: { color: COLORS.muted, fontWeight: "800", marginTop: 4 },
  navRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 18,
    marginBottom: 10,
  },
  navButton: {
    flex: 1,
    backgroundColor: COLORS.red,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  navOutline: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.red,
  },
  navText: { color: "#FFFFFF", fontWeight: "900" },
  navOutlineText: { color: COLORS.red, fontWeight: "900" },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 18,
    marginBottom: 10,
  },
  quickLink: {
    width: "48%",
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    gap: 7,
  },
  quickLinkText: { color: COLORS.text, fontWeight: "900", textAlign: "center" },
  listContent: { paddingHorizontal: 18, paddingBottom: 90 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.red,
  },
  cardTop: { flexDirection: "row", gap: 12, marginBottom: 12 },
  loadTitle: { color: COLORS.text, fontSize: 20, fontWeight: "900" },
  farmName: { color: COLORS.muted, fontWeight: "700", marginTop: 4 },
  statusPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  statusText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  routeBox: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  routeLabel: {
    color: COLORS.red,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  routeText: {
    color: COLORS.text,
    fontWeight: "900",
    marginTop: 4,
    lineHeight: 20,
  },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: COLORS.border,
    marginVertical: 8,
    marginLeft: 8,
  },
  infoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  infoBox: {
    flexBasis: "48%",
    flexGrow: 1,
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
  infoText: {
    color: COLORS.text,
    fontWeight: "800",
    marginTop: 5,
    lineHeight: 19,
  },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  trackButton: {
    flex: 1,
    backgroundColor: "#FFF1F2",
    borderWidth: 1,
    borderColor: COLORS.red,
    borderRadius: 14,
    padding: 13,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  trackButtonText: { color: COLORS.red, fontWeight: "900" },
  actionButton: {
    flex: 1,
    backgroundColor: COLORS.red,
    borderRadius: 14,
    padding: 13,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  actionText: { color: "#FFFFFF", fontWeight: "900" },
  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 20,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "900",
    marginTop: 10,
  },
  emptyText: {
    color: COLORS.muted,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 22,
  },
  emptyButton: {
    backgroundColor: COLORS.red,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 14,
    marginTop: 16,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  emptyButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
});