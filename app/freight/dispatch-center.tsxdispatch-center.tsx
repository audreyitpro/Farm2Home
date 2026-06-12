// app/freight/dispatch-center.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../data/supabaseClient";

const FREIGHT_ROUTES = {
  dashboard: "/freight/dashboard",
  managementCenter: "/freight/freight-management-center",
  board: "/freight/board",
  myLoads: "/freight/my-loads",
  liveLoads: "/freight/live-loads",
  liveRoute: "/freight/live-route",
  routeDetails: "/freight/route-details",
  proofOfPickup: "/freight/proof-of-pickup",
  proofOfDelivery: "/freight/proof-of-delivery",
  routeExceptions: "/freight/route-exceptions",
  loadIssues: "/freight/load-issues",
  disputes: "/freight/disputes",
  support: "/freight/support",
  notifications: "/freight/notifications",
  login: "/freight/login",
  register: "/freight/register",
} as const;

type FreightRoute = (typeof FREIGHT_ROUTES)[keyof typeof FREIGHT_ROUTES];

const ACTIVE_STATUSES = [
  "accepted",
  "arrived_pickup",
  "picked_up",
  "in_transit",
  "arrived_dropoff",
];

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
  blue: "#2563EB",
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

function statusColor(status: any) {
  const value = normalize(status);

  if (value === "accepted") return COLORS.red;
  if (value === "arrived_pickup") return COLORS.teal;
  if (value === "picked_up") return COLORS.amber;
  if (value === "in_transit") return COLORS.purple;
  if (value === "arrived_dropoff") return COLORS.blue;
  if (value === "delivered" || value === "completed") return COLORS.green;

  return COLORS.slate;
}

export default function FreightDispatchCenterScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [carrier, setCarrier] = useState<any>(null);
  const [loads, setLoads] = useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadDispatchCenter();
    }, [])
  );

  const stats = useMemo(() => {
    const active = loads.filter((item) => ACTIVE_STATUSES.includes(normalize(item.status)));
    const pickupNeeded = loads.filter((item) =>
      ["accepted", "arrived_pickup"].includes(normalize(item.status))
    );
    const inTransit = loads.filter((item) =>
      ["picked_up", "in_transit"].includes(normalize(item.status))
    );
    const deliveryNeeded = loads.filter((item) =>
      ["arrived_dropoff"].includes(normalize(item.status))
    );
    const exceptions = loads.filter((item) => item.route_exception_status || item.route_exception_type);
    const issues = loads.filter((item) => item.dispute_status || item.dispute_reason);

    return {
      active: active.length,
      pickupNeeded: pickupNeeded.length,
      inTransit: inTransit.length,
      deliveryNeeded: deliveryNeeded.length,
      exceptions: exceptions.length,
      issues: issues.length,
      activeValue: active.reduce(
        (sum, item) => sum + Number(item.rate || item.freight_total || item.total_due || 0),
        0
      ),
    };
  }, [loads]);

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

  async function loadDispatchCenter() {
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

      if (carrierError) console.log("Dispatch center carrier error:", carrierError.message);

      if (!dbCarrier) {
        Alert.alert("Freight Profile Missing", "Please complete freight registration first.");
        router.replace(FREIGHT_ROUTES.register as any);
        return;
      }

      const mergedCarrier = await persistCarrier({
        ...(stored || {}),
        ...(dbCarrier || {}),
        id: dbCarrier.id,
        freightId: dbCarrier.id,
        role: "freight",
        email: normalize(dbCarrier.email || email),
        companyName:
          dbCarrier.company_name ||
          dbCarrier.business_name ||
          stored?.companyName ||
          stored?.businessName ||
          "Freight Connect Carrier",
      });

      const { data, error } = await supabase
        .from("freight_loads")
        .select("*")
        .or(
          `carrier_id.eq.${mergedCarrier.id},driver_id.eq.${mergedCarrier.id},accepted_by.eq.${mergedCarrier.id}`
        )
        .in("status", ACTIVE_STATUSES)
        .order("updated_at", { ascending: false });

      if (error) {
        console.log("Dispatch center loads error:", error.message);
        setLoads([]);
      } else {
        setLoads(Array.isArray(data) ? data : []);
      }
    } catch (error: any) {
      Alert.alert("Dispatch Error", error?.message || "Unable to load dispatch center.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadDispatchCenter();
  }

  function openWithLoad(route: FreightRoute, loadId: string) {
    router.push({
      pathname: route as any,
      params: { loadId },
    });
  }

  function nextAction(load: any) {
    const status = normalize(load.status);

    if (status === "accepted") return "Arrive Pickup";
    if (status === "arrived_pickup") return "Proof Pickup";
    if (status === "picked_up") return "Start Live Route";
    if (status === "in_transit") return "Arrive Dropoff";
    if (status === "arrived_dropoff") return "Proof Delivery";

    return "Route Details";
  }

  function handleNextAction(load: any) {
    const status = normalize(load.status);

    if (status === "arrived_pickup") {
      openWithLoad(FREIGHT_ROUTES.proofOfPickup, load.id);
      return;
    }

    if (status === "arrived_dropoff") {
      openWithLoad(FREIGHT_ROUTES.proofOfDelivery, load.id);
      return;
    }

    if (status === "accepted" || status === "picked_up" || status === "in_transit") {
      openWithLoad(FREIGHT_ROUTES.liveRoute, load.id);
      return;
    }

    openWithLoad(FREIGHT_ROUTES.routeDetails, load.id);
  }

  function renderLoad({ item }: { item: any }) {
    const hasException = Boolean(item.route_exception_status || item.route_exception_type);
    const hasIssue = Boolean(item.dispute_status || item.dispute_reason);

    return (
      <View style={styles.loadCard}>
        <View style={styles.loadTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.loadTitle}>{item.title || item.commodity || "Active Freight Load"}</Text>
            <Text style={styles.loadRoute}>
              {item.pickup_location || "Pickup"} → {item.dropoff_location || "Dropoff"}
            </Text>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) }]}>
            <Text style={styles.statusText}>{statusLabel(item.status)}</Text>
          </View>
        </View>

        <View style={styles.infoGrid}>
          <InfoBox label="Payout" value={money(item.rate || item.freight_total || item.total_due)} />
          <InfoBox label="Miles" value={`${Number(item.distance_miles || item.miles || 0).toFixed(0)} mi`} />
          <InfoBox label="Equipment" value={item.equipment_type || "Standard"} />
          <InfoBox label="Farmer" value={item.farmer_name || "Farm2Home Farm"} />
        </View>

        {(hasException || hasIssue) && (
          <View style={styles.warningBox}>
            <Ionicons name="warning-outline" size={20} color={COLORS.red} />
            <Text style={styles.warningText}>
              {hasIssue ? "Load issue / dispute flag active." : "Route exception active."}
            </Text>
          </View>
        )}

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.primarySmall} onPress={() => handleNextAction(item)}>
            <Ionicons name="navigate-outline" size={17} color="#FFFFFF" />
            <Text style={styles.primarySmallText}>{nextAction(item)}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.outlineSmall}
            onPress={() => openWithLoad(FREIGHT_ROUTES.routeDetails, item.id)}
          >
            <Ionicons name="trail-sign-outline" size={17} color={COLORS.red} />
            <Text style={styles.outlineSmallText}>Details</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.toolRow}>
          <ToolButton
            icon="warning-outline"
            label="Exception"
            onPress={() => goTo(FREIGHT_ROUTES.routeExceptions)}
          />
          <ToolButton
            icon="alert-circle-outline"
            label="Issue"
            onPress={() => goTo(FREIGHT_ROUTES.loadIssues)}
          />
          <ToolButton
            icon="headset-outline"
            label="Support"
            onPress={() => goTo(FREIGHT_ROUTES.support)}
          />
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <ActivityIndicator size="large" color={COLORS.red} />
        <Text style={styles.centerText}>Loading dispatch center...</Text>
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
            <Text style={styles.title}>Dispatch Center</Text>
            <Text style={styles.subtitle}>
              Manage active loads, proof workflow, route exceptions, live route updates,
              load issues, and dispatch support.
            </Text>
          </View>

          <TouchableOpacity style={styles.heroIcon} onPress={() => goTo(FREIGHT_ROUTES.dashboard)}>
            <Ionicons name="navigate-circle-outline" size={34} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.carrierCard}>
          <View style={styles.avatar}>
            <Ionicons name="business-outline" size={28} color="#FFFFFF" />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.carrierName}>{carrier?.companyName || "Freight Connect Carrier"}</Text>
            <Text style={styles.carrierEmail}>{carrier?.email || "Carrier workspace"}</Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <StatCard label="Active Loads" value={String(stats.active)} icon="cube-outline" />
          <StatCard label="Pickup Needed" value={String(stats.pickupNeeded)} icon="location-outline" />
          <StatCard label="In Transit" value={String(stats.inTransit)} icon="navigate-outline" />
          <StatCard label="Delivery Needed" value={String(stats.deliveryNeeded)} icon="flag-outline" />
          <StatCard label="Exceptions" value={String(stats.exceptions)} icon="warning-outline" />
          <StatCard label="Active Value" value={money(stats.activeValue)} icon="cash-outline" />
        </View>

        <View style={styles.quickGrid}>
          <QuickLink icon="pulse-outline" label="Live Loads" route={FREIGHT_ROUTES.liveLoads} />
          <QuickLink icon="map-outline" label="Live Route" route={FREIGHT_ROUTES.liveRoute} />
          <QuickLink icon="warning-outline" label="Exceptions" route={FREIGHT_ROUTES.routeExceptions} />
          <QuickLink icon="alert-circle-outline" label="Load Issues" route={FREIGHT_ROUTES.loadIssues} />
          <QuickLink icon="camera-outline" label="Proof Pickup" route={FREIGHT_ROUTES.proofOfPickup} />
          <QuickLink icon="checkmark-done-outline" label="Proof Delivery" route={FREIGHT_ROUTES.proofOfDelivery} />
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Dispatch Workflow</Text>
          <Text style={styles.noticeText}>
            Use dispatch tools to move loads from accepted, arrived pickup, picked up,
            in transit, arrived dropoff, then proof of delivery.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Active Dispatch Loads</Text>

        <FlatList
          data={loads}
          keyExtractor={(item, index) => String(item.id || index)}
          scrollEnabled={false}
          renderItem={renderLoad}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Ionicons name="cube-outline" size={38} color={COLORS.red} />
              <Text style={styles.emptyTitle}>No active dispatch loads.</Text>
              <Text style={styles.emptyText}>
                Accepted and in-transit freight loads will appear here.
              </Text>

              <TouchableOpacity style={styles.emptyButton} onPress={() => goTo(FREIGHT_ROUTES.board)}>
                <Ionicons name="list-outline" size={18} color="#FFFFFF" />
                <Text style={styles.emptyButtonText}>Open Load Board</Text>
              </TouchableOpacity>
            </View>
          }
        />

        <TouchableOpacity style={styles.primaryButton} onPress={() => goTo(FREIGHT_ROUTES.liveLoads)}>
          <Ionicons name="pulse-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryText}>Open Live Loads</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.darkButton} onPress={() => goTo(FREIGHT_ROUTES.managementCenter)}>
          <Ionicons name="apps-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryText}>Management Center</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
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

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={22} color={COLORS.red} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
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

function ToolButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.toolButton} onPress={onPress}>
      <Ionicons name={icon} size={16} color={COLORS.red} />
      <Text style={styles.toolText}>{label}</Text>
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
  carrierCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 16,
    marginHorizontal: 18,
    marginTop: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: COLORS.red,
    alignItems: "center",
    justifyContent: "center",
  },
  carrierName: { color: COLORS.text, fontSize: 19, fontWeight: "900" },
  carrierEmail: { color: COLORS.muted, fontWeight: "700", marginTop: 4 },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  statCard: {
    width: "48%",
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statValue: { color: COLORS.text, fontSize: 22, fontWeight: "900", marginTop: 7 },
  statLabel: { color: COLORS.muted, fontWeight: "800", marginTop: 4 },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 18,
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
  notice: {
    backgroundColor: COLORS.black,
    marginHorizontal: 18,
    marginBottom: 16,
    borderRadius: 22,
    padding: 18,
  },
  noticeTitle: { color: "#FFFFFF", fontSize: 21, fontWeight: "900", marginBottom: 7 },
  noticeText: { color: "#D1D5DB", fontWeight: "700", lineHeight: 22 },
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
  loadTitle: { color: COLORS.text, fontSize: 18, fontWeight: "900" },
  loadRoute: { color: COLORS.muted, fontWeight: "700", marginTop: 4 },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    maxWidth: 140,
  },
  statusText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
  },
  infoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  infoBox: {
    width: "48%",
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 12,
  },
  infoLabel: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  infoValue: { color: COLORS.text, fontWeight: "900", marginTop: 4 },
  warningBox: {
    backgroundColor: "#FFF1F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  warningText: { color: COLORS.red, fontWeight: "900", flex: 1 },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  primarySmall: {
    flex: 1,
    backgroundColor: COLORS.red,
    borderRadius: 14,
    padding: 13,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  primarySmallText: { color: "#FFFFFF", fontWeight: "900" },
  outlineSmall: {
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
  outlineSmallText: { color: COLORS.red, fontWeight: "900" },
  toolRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  toolButton: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    gap: 4,
  },
  toolText: { color: COLORS.text, fontSize: 11, fontWeight: "900" },
  emptyCard: {
    backgroundColor: COLORS.card,
    marginHorizontal: 18,
    borderRadius: 22,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyTitle: { color: COLORS.text, fontSize: 20, fontWeight: "900", marginTop: 10 },
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
  emptyButtonText: { color: "#FFFFFF", fontWeight: "900" },
  primaryButton: {
    backgroundColor: COLORS.red,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 18,
    marginTop: 10,
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