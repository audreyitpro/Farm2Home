// app/freight/live-route.tsx

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
import * as Location from "expo-location";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../data/supabaseClient";

const FREIGHT_ROUTES = {
  dashboard: "/freight/dashboard",
  board: "/freight/board",
  myLoads: "/freight/my-loads",
  liveLoads: "/freight/live-loads",
  proofOfPickup: "/freight/proof-of-pickup",
  proofOfDelivery: "/freight/proof-of-delivery",
  support: "/freight/support",
  login: "/freight/login",
  register: "/freight/register",
} as const;

type FreightRoute = (typeof FREIGHT_ROUTES)[keyof typeof FREIGHT_ROUTES];

type FreightLoad = {
  id: string;
  title?: string;
  commodity?: string;
  status?: string;
  pickup_location?: string;
  dropoff_location?: string;
  pickup_date?: string;
  pickup_time?: string;
  dropoff_date?: string;
  dropoff_time?: string;
  farmer_name?: string;
  equipment_type?: string;
  distance_miles?: number;
  rate?: number;
  carrier_id?: string | null;
  driver_id?: string | null;
  accepted_by?: string | null;
  accepted_at?: string | null;
  arrived_pickup_at?: string | null;
  picked_up_at?: string | null;
  in_transit_at?: string | null;
  arrived_dropoff_at?: string | null;
  delivered_at?: string | null;
  updated_at?: string | null;
  current_latitude?: number | null;
  current_longitude?: number | null;
  current_heading?: number | null;
  current_speed?: number | null;
  gps_accuracy?: number | null;
  gps_updated_at?: string | null;
  live_route_status?: string | null;
};

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

function normalize(value: any) {
  return String(value || "").trim().toLowerCase();
}

function goTo(route: FreightRoute) {
  router.push(route as any);
}

function money(value: number) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function friendlyStatus(status?: string) {
  return String(status || "unknown")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function statusColor(status?: string) {
  const value = normalize(status);

  if (value === "accepted") return COLORS.red;
  if (value === "arrived_pickup") return COLORS.teal;
  if (value === "picked_up") return COLORS.amber;
  if (value === "in_transit") return COLORS.purple;
  if (value === "arrived_dropoff") return COLORS.teal;
  if (value === "delivered" || value === "completed") return COLORS.green;

  return COLORS.slate;
}

function statusIcon(status?: string): keyof typeof Ionicons.glyphMap {
  const value = normalize(status);

  if (value === "accepted") return "checkmark-circle-outline";
  if (value === "arrived_pickup") return "location-outline";
  if (value === "picked_up") return "archive-outline";
  if (value === "in_transit") return "navigate-outline";
  if (value === "arrived_dropoff") return "flag-outline";
  if (value === "delivered" || value === "completed") return "checkmark-done-outline";

  return "ellipse-outline";
}

function formatDateTime(value?: string | null) {
  if (!value) return "Not available";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";

  return date.toLocaleString();
}

export default function FreightLiveRouteScreen() {
  const params = useLocalSearchParams();
  const rawLoadId = params.loadId;
  const routeLoadId = Array.isArray(rawLoadId) ? rawLoadId[0] : String(rawLoadId || "");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [carrier, setCarrier] = useState<any>(null);
  const [loads, setLoads] = useState<FreightLoad[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadLiveRoutes();
    }, [routeLoadId])
  );

  const carrierName = useMemo(() => {
    return (
      carrier?.companyName ||
      carrier?.businessName ||
      carrier?.contactName ||
      carrier?.email ||
      "Freight Connect Carrier"
    );
  }, [carrier]);

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
        nextCarrier.stripeAccountId || nextCarrier.stripe_account_id || "",
      stripe_account_id:
        nextCarrier.stripe_account_id || nextCarrier.stripeAccountId || "",
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

  async function loadLiveRoutes() {
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
        console.log("Live route carrier error:", carrierError.message);
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

      let query = supabase.from("freight_loads").select("*");

      if (routeLoadId) {
        query = query.eq("id", routeLoadId);
      } else {
        query = query
          .or(
            `carrier_id.eq.${mergedCarrier.id},driver_id.eq.${mergedCarrier.id},accepted_by.eq.${mergedCarrier.id}`
          )
          .in("status", ACTIVE_STATUSES);
      }

      const { data, error } = await query.order("updated_at", { ascending: false });

      if (error) throw error;

      setLoads(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.log("Load live route error:", error);
      Alert.alert("Live Route Error", error?.message || "Unable to load live route.");
      setLoads([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadLiveRoutes();
  }

  async function getCurrentLocation() {
    const permission = await Location.requestForegroundPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        "Location Permission Needed",
        "Please allow location access to update delivery tracking."
      );
      return null;
    }

    return Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
  }

  async function saveGps(load: FreightLoad, nextStatus?: string, extraPayload: any = {}) {
    const currentLocation = await getCurrentLocation();
    if (!currentLocation) return;

    const coords = currentLocation.coords;
    const now = new Date().toISOString();

    const payload = {
      current_latitude: coords.latitude,
      current_longitude: coords.longitude,
      current_heading: coords.heading ?? null,
      current_speed: coords.speed ?? null,
      gps_accuracy: coords.accuracy ?? null,
      gps_updated_at: now,
      live_route_status: nextStatus || load.live_route_status || load.status || "accepted",
      updated_at: now,
      ...extraPayload,
    };

    const { error } = await supabase.from("freight_loads").update(payload).eq("id", load.id);

    if (error) throw error;
  }

  async function updateLocationOnly(load: FreightLoad) {
    try {
      await saveGps(load);
      Alert.alert("Location Updated", "Your GPS location was saved.");
      await loadLiveRoutes();
    } catch (error: any) {
      Alert.alert("GPS Error", error?.message || "Unable to update GPS location.");
    }
  }

  async function changeRouteStatus(load: FreightLoad, nextStatus: string) {
    try {
      const now = new Date().toISOString();

      const extraPayload: any = {
        status: nextStatus,
      };

      if (nextStatus === "arrived_pickup") extraPayload.arrived_pickup_at = now;
      if (nextStatus === "picked_up") extraPayload.picked_up_at = now;
      if (nextStatus === "in_transit") extraPayload.in_transit_at = now;
      if (nextStatus === "arrived_dropoff") extraPayload.arrived_dropoff_at = now;
      if (nextStatus === "delivered") extraPayload.delivered_at = now;

      await saveGps(load, nextStatus, extraPayload);

      Alert.alert("Route Updated", `Status updated to ${friendlyStatus(nextStatus)}.`);
      await loadLiveRoutes();
    } catch (error: any) {
      Alert.alert("Route Error", error?.message || "Unable to update route.");
    }
  }

  function openProofPickup(load: FreightLoad) {
    router.push({
      pathname: FREIGHT_ROUTES.proofOfPickup as any,
      params: { loadId: load.id },
    });
  }

  function openProofDelivery(load: FreightLoad) {
    router.push({
      pathname: FREIGHT_ROUTES.proofOfDelivery as any,
      params: { loadId: load.id },
    });
  }

  function renderActions(load: FreightLoad) {
    const currentStatus = normalize(load.status);

    return (
      <View style={styles.actionGrid}>
        <MilestoneButton
          icon="location-outline"
          label="Arrived Pickup"
          style={styles.tealAction}
          onPress={() => changeRouteStatus(load, "arrived_pickup")}
        />

        <MilestoneButton
          icon="camera-outline"
          label="Proof Pickup"
          style={styles.warningAction}
          onPress={() => openProofPickup(load)}
        />

        <MilestoneButton
          icon="navigate-outline"
          label="Start Transit"
          style={styles.purpleAction}
          onPress={() => changeRouteStatus(load, "in_transit")}
        />

        <MilestoneButton
          icon="flag-outline"
          label="Arrived Dropoff"
          style={styles.tealAction}
          onPress={() => changeRouteStatus(load, "arrived_dropoff")}
        />

        <MilestoneButton
          icon="checkmark-done-outline"
          label="Proof Delivery"
          style={styles.deliveredAction}
          onPress={() => openProofDelivery(load)}
        />

        <MilestoneButton
          icon="radio-outline"
          label="Update GPS"
          style={styles.secondaryAction}
          onPress={() => updateLocationOnly(load)}
        />

        <View style={styles.currentStepBox}>
          <Ionicons name={statusIcon(currentStatus)} size={18} color={COLORS.red} />
          <Text style={styles.currentStep}>
            Current step: {friendlyStatus(currentStatus)}
          </Text>
        </View>
      </View>
    );
  }

  function renderRouteCard({ item }: { item: FreightLoad }) {
    const currentStatus = item.status || "accepted";

    return (
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.loadId}>{item.title || `Load #${String(item.id).slice(-6)}`}</Text>
            <Text style={styles.carrierMeta}>Carrier: {carrierName}</Text>
          </View>

          <View style={[styles.statusPill, { backgroundColor: statusColor(currentStatus) }]}>
            <Ionicons name={statusIcon(currentStatus)} size={14} color="#FFFFFF" />
            <Text style={styles.statusText}>{friendlyStatus(currentStatus)}</Text>
          </View>
        </View>

        <View style={styles.routeBox}>
          <View style={styles.routeStop}>
            <Ionicons name="radio-button-on" size={18} color={COLORS.red} />
            <View style={{ flex: 1 }}>
              <Text style={styles.routeLabel}>Pickup</Text>
              <Text style={styles.route}>{item.pickup_location || "Pickup TBD"}</Text>
            </View>
          </View>

          <View style={styles.routeLine} />

          <View style={styles.routeStop}>
            <Ionicons name="location" size={18} color={COLORS.red} />
            <View style={{ flex: 1 }}>
              <Text style={styles.routeLabel}>Dropoff</Text>
              <Text style={styles.route}>{item.dropoff_location || "Dropoff TBD"}</Text>
            </View>
          </View>
        </View>

        <View style={styles.locationBox}>
          <View style={styles.locationHeader}>
            <Ionicons name="navigate-circle-outline" size={24} color={COLORS.red} />
            <Text style={styles.locationTitle}>Live GPS</Text>
          </View>

          {item.current_latitude && item.current_longitude ? (
            <>
              <LocationRow label="Latitude" value={Number(item.current_latitude).toFixed(5)} />
              <LocationRow label="Longitude" value={Number(item.current_longitude).toFixed(5)} />
              <LocationRow
                label="Accuracy"
                value={
                  item.gps_accuracy
                    ? `${Number(item.gps_accuracy).toFixed(1)} meters`
                    : "Not available"
                }
              />
              <LocationRow label="Updated" value={formatDateTime(item.gps_updated_at)} />
            </>
          ) : (
            <Text style={styles.locationText}>
              No GPS update yet. Tap Update GPS or update a route milestone.
            </Text>
          )}
        </View>

        <View style={styles.infoGrid}>
          <InfoBox label="Commodity" value={item.commodity || "Farm Freight"} />
          <InfoBox label="Equipment" value={item.equipment_type || "Standard"} />
          <InfoBox label="Miles" value={`${Number(item.distance_miles || 0).toFixed(0)} mi`} />
          <InfoBox label="Payout" value={money(Number(item.rate || 0))} />
        </View>

        {renderActions(item)}
      </View>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <ActivityIndicator size="large" color={COLORS.red} />
        <Text style={styles.centerText}>Loading live route...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />

      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>Farm2Home Freight Connect</Text>
            <Text style={styles.title}>Live Route</Text>
            <Text style={styles.subtitle}>
              {carrierName} · Update GPS and route progress for active deliveries.
            </Text>
          </View>

          <TouchableOpacity style={styles.heroIcon} onPress={() => goTo(FREIGHT_ROUTES.dashboard)}>
            <Ionicons name="map-outline" size={34} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.navRow}>
        <TouchableOpacity style={styles.navButton} onPress={() => goTo(FREIGHT_ROUTES.myLoads)}>
          <Ionicons name="briefcase-outline" size={18} color="#FFFFFF" />
          <Text style={styles.navText}>My Loads</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navButtonOutline} onPress={() => goTo(FREIGHT_ROUTES.liveLoads)}>
          <Ionicons name="pulse-outline" size={18} color={COLORS.red} />
          <Text style={styles.navTextOutline}>Live Loads</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={loads}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Ionicons name="trail-sign-outline" size={38} color={COLORS.red} />
            <Text style={styles.emptyTitle}>No active routes.</Text>
            <Text style={styles.emptyText}>
              Claim a load first, then use Live Route to update GPS and delivery progress.
            </Text>

            <TouchableOpacity style={styles.emptyButton} onPress={() => goTo(FREIGHT_ROUTES.board)}>
              <Ionicons name="open-outline" size={18} color="#FFFFFF" />
              <Text style={styles.emptyButtonText}>Open Load Board</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={renderRouteCard}
      />
    </SafeAreaView>
  );
}

function MilestoneButton({
  icon,
  label,
  style,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  style: any;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[styles.actionButton, style]} onPress={onPress}>
      <Ionicons name={icon} size={17} color="#FFFFFF" />
      <Text style={styles.actionText}>{label}</Text>
    </TouchableOpacity>
  );
}

function LocationRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.locationRow}>
      <Text style={styles.locationLabel}>{label}</Text>
      <Text style={styles.locationValue}>{value}</Text>
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
    paddingTop: 22,
    paddingHorizontal: 20,
    paddingBottom: 26,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 24,
    backgroundColor: COLORS.red,
    alignItems: "center",
    justifyContent: "center",
  },
  kicker: {
    color: "#FCA5A5",
    fontWeight: "900",
    fontSize: 12,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900",
    marginBottom: 10,
  },
  subtitle: {
    color: "#D1D5DB",
    marginTop: 2,
    lineHeight: 22,
    fontWeight: "700",
  },
  navRow: {
    flexDirection: "row",
    gap: 10,
    padding: 18,
  },
  navButton: {
    flex: 1,
    backgroundColor: COLORS.red,
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  navButtonOutline: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.red,
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  navText: { color: "#FFFFFF", fontWeight: "900" },
  navTextOutline: { color: COLORS.red, fontWeight: "900" },
  listContent: {
    paddingHorizontal: 18,
    paddingBottom: 90,
  },
  emptyCard: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 22,
    padding: 24,
    alignItems: "center",
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "900",
    marginTop: 10,
    marginBottom: 6,
  },
  emptyText: {
    color: COLORS.muted,
    lineHeight: 22,
    textAlign: "center",
    fontWeight: "700",
  },
  emptyButton: {
    backgroundColor: COLORS.red,
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    flexDirection: "row",
    gap: 8,
  },
  emptyButtonText: { color: "#FFFFFF", fontWeight: "900" },
  card: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
    gap: 10,
  },
  loadId: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "900",
  },
  carrierMeta: {
    color: COLORS.muted,
    marginTop: 4,
    fontWeight: "700",
  },
  statusPill: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    maxWidth: 170,
  },
  statusText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 11,
  },
  routeBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
  },
  routeStop: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  routeLine: {
    width: 2,
    height: 24,
    backgroundColor: COLORS.border,
    marginLeft: 8,
    marginVertical: 8,
  },
  routeLabel: {
    color: COLORS.red,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  route: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900",
    lineHeight: 23,
    marginTop: 3,
  },
  locationBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  locationHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  locationTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 18,
  },
  locationRow: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 11,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  locationLabel: {
    color: COLORS.red,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  locationValue: {
    color: COLORS.text,
    fontWeight: "800",
    marginTop: 3,
  },
  locationText: {
    color: COLORS.text,
    fontWeight: "700",
    lineHeight: 20,
  },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
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
    fontWeight: "900",
    fontSize: 11,
    textTransform: "uppercase",
  },
  infoValue: {
    color: COLORS.text,
    fontWeight: "900",
    marginTop: 4,
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  actionButton: {
    flexGrow: 1,
    minWidth: "47%",
    paddingHorizontal: 12,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  secondaryAction: { backgroundColor: COLORS.slate },
  warningAction: { backgroundColor: COLORS.amber },
  purpleAction: { backgroundColor: COLORS.purple },
  tealAction: { backgroundColor: COLORS.teal },
  deliveredAction: { backgroundColor: COLORS.green },
  actionText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 13,
  },
  currentStepBox: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 12,
    width: "100%",
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  currentStep: {
    color: COLORS.muted,
    fontWeight: "800",
    flex: 1,
  },
});