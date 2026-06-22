// app/freight/live-route.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
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
import * as Location from "expo-location";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../data/supabaseClient";

const FREIGHT_ROUTES = {
  dashboard: "/freight/dashboard",
  board: "/freight/board",
  myLoads: "/freight/my-loads",
  liveLoads: "/freight/live-loads",
  tracking: "/freight/tracking",
  routeDetails: "/freight/route-details",
  routeExceptions: "/freight/route-exceptions",
  loadIssues: "/freight/load-issues",
  loadChat: "/freight/load-chat",
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

const ACTIVE_STATUSES = ["accepted", "booked", "arrived_pickup", "picked_up", "in_transit", "arrived_dropoff"];

const COLORS = {
  bg: "#F7F7FB",
  card: "#FFFFFF",
  panel: "#F8FAFC",
  text: "#0F172A",
  muted: "#64748B",
  border: "#E5E7EB",
  primary: "#6D5DFB",
  primarySoft: "#EEF2FF",
  green: "#10B981",
  amber: "#F59E0B",
  red: "#EF4444",
  blue: "#2563EB",
  teal: "#0F766E",
  purple: "#7C3AED",
  navy: "#020617",
  slate: "#64748B",
  white: "#FFFFFF",
};

function clean(value: any) {
  return String(value ?? "").trim();
}

function normalize(value: any) {
  return clean(value).toLowerCase();
}

function isCus(value: any) {
  return clean(value).startsWith("cus_");
}

function isSub(value: any) {
  return clean(value).startsWith("sub_");
}

function isAcct(value: any) {
  return clean(value).startsWith("acct_");
}

function pickCus(...values: any[]) {
  const found = values.find((value) => isCus(value));
  return found ? clean(found) : "";
}

function pickSub(...values: any[]) {
  const found = values.find((value) => isSub(value));
  return found ? clean(found) : "";
}

function pickAcct(...values: any[]) {
  const found = values.find((value) => isAcct(value));
  return found ? clean(found) : "";
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
  if (value === "accepted" || value === "booked") return COLORS.primary;
  if (value === "arrived_pickup") return COLORS.teal;
  if (value === "picked_up") return COLORS.amber;
  if (value === "in_transit") return COLORS.purple;
  if (value === "arrived_dropoff") return COLORS.teal;
  if (value === "delivered" || value === "completed") return COLORS.green;
  return COLORS.slate;
}

function statusIcon(status?: string): keyof typeof Ionicons.glyphMap {
  const value = normalize(status);
  if (value === "accepted" || value === "booked") return "checkmark-circle-outline";
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
    return carrier?.companyName || carrier?.businessName || carrier?.contactName || carrier?.email || "Freight Connect Carrier";
  }, [carrier]);

  const totalValue = useMemo(() => loads.reduce((sum, item) => sum + Number(item.rate || 0), 0), [loads]);
  const totalMiles = useMemo(() => loads.reduce((sum, item) => sum + Number(item.distance_miles || 0), 0), [loads]);
  const gpsCount = useMemo(() => loads.filter((item) => item.current_latitude && item.current_longitude).length, [loads]);

  async function getStoredCarrier() {
    const raw =
      (await AsyncStorage.getItem("currentFreightCarrier")) ||
      (await AsyncStorage.getItem("currentFreight")) ||
      (await AsyncStorage.getItem("currentFreightUser")) ||
      (await AsyncStorage.getItem("farm2homeCurrentFreight")) ||
      (await AsyncStorage.getItem("currentUser"));

    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async function saveFreightSession(nextCarrier: any) {
    await AsyncStorage.setItem("currentFreight", JSON.stringify(nextCarrier));
    await AsyncStorage.setItem("currentFreightCarrier", JSON.stringify(nextCarrier));
    await AsyncStorage.setItem("currentFreightUser", JSON.stringify(nextCarrier));
    await AsyncStorage.setItem("farm2homeCurrentFreight", JSON.stringify(nextCarrier));
    await AsyncStorage.setItem("currentUser", JSON.stringify(nextCarrier));
    await AsyncStorage.setItem("userRole", "freight");
    await AsyncStorage.setItem("currentUserRole", "freight");
  }

  async function findSubscription(id: string, email: string) {
    const filters = [id ? `freight_id.eq.${id}` : "", email ? `freight_email.eq.${email}` : ""]
      .filter(Boolean)
      .join(",");

    if (!filters) return null;

    const { data, error } = await supabase
      .from("freight_subscriptions")
      .select("*")
      .or(filters)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (error) {
      console.log("Live route subscription lookup error:", error.message);
      return null;
    }

    return Array.isArray(data) && data.length > 0 ? data[0] : null;
  }

  async function persistCarrier(nextCarrier: any) {
    const id = clean(nextCarrier.id || nextCarrier.freightId || nextCarrier.freight_id);
    const stripeCustomerId = pickCus(nextCarrier.stripeCustomerId, nextCarrier.stripe_customer_id);
    const stripeSubscriptionId = pickSub(
      nextCarrier.stripeSubscriptionId,
      nextCarrier.stripe_subscription_id,
      nextCarrier.subscriptionId,
      nextCarrier.subscription_id
    );
    const stripeAccountId = pickAcct(
      nextCarrier.freightAccount,
      nextCarrier.freight_account,
      nextCarrier.stripeAccountId,
      nextCarrier.stripe_account_id
    );

    const normalizedCarrier = {
      ...nextCarrier,
      id,
      freightId: id,
      freight_id: id,
      role: "freight",
      email: normalize(nextCarrier.email),
      companyName:
        nextCarrier.companyName ||
        nextCarrier.businessName ||
        nextCarrier.company_name ||
        nextCarrier.business_name ||
        "Freight Connect Carrier",
      company_name:
        nextCarrier.company_name ||
        nextCarrier.companyName ||
        nextCarrier.business_name ||
        nextCarrier.businessName ||
        "Freight Connect Carrier",
      businessName:
        nextCarrier.businessName ||
        nextCarrier.companyName ||
        nextCarrier.business_name ||
        nextCarrier.company_name ||
        "Freight Connect Carrier",
      business_name:
        nextCarrier.business_name ||
        nextCarrier.businessName ||
        nextCarrier.company_name ||
        nextCarrier.companyName ||
        "Freight Connect Carrier",
      accountId: clean(nextCarrier.accountId || nextCarrier.account_id || ""),
      account_id: clean(nextCarrier.account_id || nextCarrier.accountId || ""),
      stripeCustomerId,
      stripe_customer_id: stripeCustomerId,
      stripeSubscriptionId,
      stripe_subscription_id: stripeSubscriptionId,
      subscriptionId: stripeSubscriptionId,
      subscription_id: stripeSubscriptionId,
      freightAccount: stripeAccountId,
      freight_account: stripeAccountId,
      stripeAccountId,
      stripe_account_id: stripeAccountId,
    };

    await saveFreightSession(normalizedCarrier);
    setCarrier(normalizedCarrier);
    return normalizedCarrier;
  }

  async function loadLiveRoutes() {
    try {
      setLoading(true);

      const stored = await getStoredCarrier();
      const { data: authData } = await supabase.auth.getUser();

      const authId = clean(authData?.user?.id || "");
      const storedId = clean(stored?.id || stored?.freightId || stored?.freight_id || "");
      const email = normalize(stored?.email || authData?.user?.email || "");
      const accountId = clean(stored?.accountId || stored?.account_id || "");

      if (!email && !authId && !storedId && !accountId) {
        router.replace(FREIGHT_ROUTES.login as any);
        return;
      }

      const profileFilters = [
        authId ? `id.eq.${authId}` : "",
        authId ? `auth_user_id.eq.${authId}` : "",
        authId ? `profile_id.eq.${authId}` : "",
        authId ? `freight_id.eq.${authId}` : "",
        storedId ? `id.eq.${storedId}` : "",
        storedId ? `freight_id.eq.${storedId}` : "",
        storedId ? `auth_user_id.eq.${storedId}` : "",
        email ? `email.eq.${email}` : "",
        accountId ? `account_id.eq.${accountId}` : "",
      ]
        .filter(Boolean)
        .join(",");

      const { data: dbCarrierRows, error: carrierError } = await supabase
        .from("freight_users")
        .select("*")
        .or(profileFilters)
        .limit(1);

      if (carrierError) console.log("Live route carrier error:", carrierError.message);

      const dbCarrier = Array.isArray(dbCarrierRows) && dbCarrierRows.length > 0 ? dbCarrierRows[0] : null;

      if (!dbCarrier) {
        Alert.alert("Freight Profile Missing", "No freight profile was found. Please complete freight registration first.");
        router.replace(FREIGHT_ROUTES.register as any);
        return;
      }

      const sub = await findSubscription(dbCarrier.id || storedId || authId, normalize(dbCarrier.email || email));
      const subAcct = pickAcct(sub?.freight_account, sub?.stripe_account_id);
      const rowAcct = pickAcct(dbCarrier.freight_account, dbCarrier.stripe_account_id);

      let mergedCarrier = {
        ...(stored || {}),
        ...(dbCarrier || {}),
        id: dbCarrier.id,
        freightId: dbCarrier.freight_id || dbCarrier.id,
        freight_id: dbCarrier.freight_id || dbCarrier.id,
        email: normalize(dbCarrier.email || email),
        role: "freight",
        stripe_customer_id: pickCus(dbCarrier.stripe_customer_id, sub?.stripe_customer_id),
        stripe_subscription_id: pickSub(dbCarrier.stripe_subscription_id, dbCarrier.subscription_id, sub?.stripe_subscription_id),
        subscription_id: pickSub(dbCarrier.subscription_id, dbCarrier.stripe_subscription_id, sub?.stripe_subscription_id),
        freight_account: pickAcct(dbCarrier.freight_account, dbCarrier.stripe_account_id, subAcct),
        stripe_account_id: pickAcct(dbCarrier.stripe_account_id, dbCarrier.freight_account, subAcct),
      };

      if (subAcct && !rowAcct) {
        const updatePayload = {
          freight_account: subAcct,
          stripe_account_id: subAcct,
          stripe_connect_status: "started",
          updated_at: new Date().toISOString(),
        };
        await supabase.from("freight_users").update(updatePayload).eq("id", dbCarrier.id);
        mergedCarrier = { ...mergedCarrier, ...updatePayload };
      }

      const normalizedCarrier = await persistCarrier(mergedCarrier);

      let query = supabase.from("freight_loads").select("*");

      if (routeLoadId) {
        query = query.eq("id", routeLoadId);
      } else {
        query = query
          .or(
            `carrier_id.eq.${normalizedCarrier.id},freight_user_id.eq.${normalizedCarrier.id},driver_id.eq.${normalizedCarrier.id},accepted_by.eq.${normalizedCarrier.id}`
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
      Alert.alert("Location Permission Needed", "Please allow location access to update delivery tracking.");
      return null;
    }

    return Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
  }

  async function createNotification(load: FreightLoad, title: string, message: string) {
    if (!carrier?.id) return;

    await supabase.from("freight_notifications").insert({
      freight_user_id: carrier.id,
      freight_id: carrier.id,
      user_id: carrier.id,
      load_id: load.id,
      title,
      message,
      type: "load",
      is_read: false,
      read: false,
      created_at: new Date().toISOString(),
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
      await createNotification(load, "GPS Updated", `${load.title || "Freight load"} GPS location was updated.`);
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
      if (nextStatus === "delivered") {
        extraPayload.delivered_at = now;
        extraPayload.settlement_status = "pending";
        extraPayload.payout_status = "pending";
      }

      await saveGps(load, nextStatus, extraPayload);
      await createNotification(load, "Route Updated", `${load.title || "Freight load"} updated to ${friendlyStatus(nextStatus)}.`);

      Alert.alert("Route Updated", `Status updated to ${friendlyStatus(nextStatus)}.`);
      await loadLiveRoutes();
    } catch (error: any) {
      Alert.alert("Route Error", error?.message || "Unable to update route.");
    }
  }

  function openWithLoad(route: FreightRoute, load: FreightLoad) {
    router.push({
      pathname: route as any,
      params: { loadId: load.id },
    });
  }

  function openProofPickup(load: FreightLoad) {
    openWithLoad(FREIGHT_ROUTES.proofOfPickup, load);
  }

  function openProofDelivery(load: FreightLoad) {
    openWithLoad(FREIGHT_ROUTES.proofOfDelivery, load);
  }

  function renderActions(load: FreightLoad) {
    const currentStatus = normalize(load.status);

    return (
      <View style={styles.actionGrid}>
        <MilestoneButton icon="location-outline" label="Arrived Pickup" style={styles.tealAction} onPress={() => changeRouteStatus(load, "arrived_pickup")} />
        <MilestoneButton icon="camera-outline" label="Proof Pickup" style={styles.warningAction} onPress={() => openProofPickup(load)} />
        <MilestoneButton icon="archive-outline" label="Loaded" style={styles.primaryAction} onPress={() => changeRouteStatus(load, "picked_up")} />
        <MilestoneButton icon="navigate-outline" label="Start Transit" style={styles.purpleAction} onPress={() => changeRouteStatus(load, "in_transit")} />
        <MilestoneButton icon="flag-outline" label="Arrived Dropoff" style={styles.tealAction} onPress={() => changeRouteStatus(load, "arrived_dropoff")} />
        <MilestoneButton icon="checkmark-done-outline" label="Proof Delivery" style={styles.deliveredAction} onPress={() => openProofDelivery(load)} />
        <MilestoneButton icon="radio-outline" label="Update GPS" style={styles.secondaryAction} onPress={() => updateLocationOnly(load)} />
        <MilestoneButton icon="chatbubble-outline" label="Chat" style={styles.primaryAction} onPress={() => openWithLoad(FREIGHT_ROUTES.loadChat, load)} />

        <View style={styles.currentStepBox}>
          <Ionicons name={statusIcon(currentStatus)} size={18} color={COLORS.primary} />
          <Text style={styles.currentStep}>Current step: {friendlyStatus(currentStatus)}</Text>
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
            <Ionicons name={statusIcon(currentStatus)} size={14} color={COLORS.white} />
            <Text style={styles.statusText}>{friendlyStatus(currentStatus)}</Text>
          </View>
        </View>

        <View style={styles.mapPlaceholder}>
          <Ionicons name="map-outline" size={42} color={COLORS.primary} />
          <Text style={styles.mapTitle}>Route Map</Text>
          <Text style={styles.mapText}>Map integration placeholder. GPS coordinates sync below when updated.</Text>
        </View>

        <View style={styles.routeBox}>
          <View style={styles.routeStop}>
            <Ionicons name="radio-button-on" size={18} color={COLORS.green} />
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
            <Ionicons name="navigate-circle-outline" size={24} color={COLORS.primary} />
            <Text style={styles.locationTitle}>Live GPS</Text>
          </View>

          {item.current_latitude && item.current_longitude ? (
            <>
              <LocationRow label="Latitude" value={Number(item.current_latitude).toFixed(5)} />
              <LocationRow label="Longitude" value={Number(item.current_longitude).toFixed(5)} />
              <LocationRow label="Accuracy" value={item.gps_accuracy ? `${Number(item.gps_accuracy).toFixed(1)} meters` : "Not available"} />
              <LocationRow label="Updated" value={formatDateTime(item.gps_updated_at)} />
            </>
          ) : (
            <Text style={styles.locationText}>No GPS update yet. Tap Update GPS or update a route milestone.</Text>
          )}
        </View>

        <View style={styles.infoGrid}>
          <InfoBox label="Commodity" value={item.commodity || "Farm Freight"} />
          <InfoBox label="Equipment" value={item.equipment_type || "Standard"} />
          <InfoBox label="Miles" value={`${Number(item.distance_miles || 0).toFixed(0)} mi`} />
          <InfoBox label="Payout" value={money(Number(item.rate || 0))} />
        </View>

        <View style={styles.quickActionRow}>
          <SmallButton icon="trail-sign-outline" label="Details" onPress={() => openWithLoad(FREIGHT_ROUTES.routeDetails, item)} />
          <SmallButton icon="alert-circle-outline" label="Issue" onPress={() => openWithLoad(FREIGHT_ROUTES.loadIssues, item)} />
          <SmallButton icon="warning-outline" label="Exception" onPress={() => openWithLoad(FREIGHT_ROUTES.routeExceptions, item)} />
          <SmallButton icon="pulse-outline" label="Tracking" onPress={() => openWithLoad(FREIGHT_ROUTES.tracking, item)} />
        </View>

        {renderActions(item)}
      </View>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.centerText}>Loading live route...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />

      <View style={styles.shell}>
        <View style={styles.sidebar}>
          <View style={styles.brandRow}>
            <View style={styles.brandIcon}>
              <Ionicons name="map-outline" size={28} color={COLORS.white} />
            </View>
            <View>
              <Text style={styles.brandTitle}>Farm2Home</Text>
              <Text style={styles.brandSubtitle}>Live Route</Text>
            </View>
          </View>

          <View style={styles.sideDivider} />
          <SidebarLink icon="grid-outline" title="Dashboard" route={FREIGHT_ROUTES.dashboard} />
          <SidebarLink icon="search-outline" title="Load Board" route={FREIGHT_ROUTES.board} />
          <SidebarLink icon="briefcase-outline" title="My Loads" route={FREIGHT_ROUTES.myLoads} />
          <SidebarLink icon="pulse-outline" title="Live Loads" route={FREIGHT_ROUTES.liveLoads} />
          <SidebarLink icon="headset-outline" title="Support" route={FREIGHT_ROUTES.support} />

          <View style={styles.carrierPanel}>
            <Text style={styles.carrierLabel}>Carrier</Text>
            <Text style={styles.carrierName} numberOfLines={1}>{carrierName}</Text>
            <Text style={styles.carrierSub} numberOfLines={1}>{carrier?.accountId || carrier?.account_id || "Account pending"}</Text>
          </View>
        </View>

        <View style={styles.main}>
          <View style={styles.topPanel}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>Fina Admin Route Control</Text>
              <Text style={styles.pageTitle}>Live Route</Text>
              <Text style={styles.pageSubtitle}>
                {carrierName} · Update GPS, route progress, exceptions, issues, chat, proof pickup, and proof delivery.
              </Text>
            </View>

            <TouchableOpacity style={styles.topIconButton} onPress={() => goTo(FREIGHT_ROUTES.dashboard)}>
              <Ionicons name="grid-outline" size={23} color={COLORS.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <View style={styles.metricGrid}>
              <MetricCard label="Routes" value={String(loads.length)} icon="map-outline" />
              <MetricCard label="GPS Synced" value={String(gpsCount)} icon="radio-outline" />
              <MetricCard label="Miles" value={`${totalMiles.toFixed(0)} mi`} icon="speedometer-outline" />
              <MetricCard label="Value" value={money(totalValue)} icon="cash-outline" />
            </View>

            <View style={styles.navRow}>
              <NavButton title="My Loads" icon="briefcase-outline" route={FREIGHT_ROUTES.myLoads} />
              <NavButton title="Live Loads" icon="pulse-outline" route={FREIGHT_ROUTES.liveLoads} outline />
            </View>

            <FlatList
              data={loads}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <View style={styles.emptyCard}>
                  <Ionicons name="trail-sign-outline" size={38} color={COLORS.primary} />
                  <Text style={styles.emptyTitle}>No active routes</Text>
                  <Text style={styles.emptyText}>Claim a load first, then use Live Route to update GPS and delivery progress.</Text>

                  <TouchableOpacity style={styles.emptyButton} onPress={() => goTo(FREIGHT_ROUTES.board)}>
                    <Ionicons name="open-outline" size={18} color={COLORS.white} />
                    <Text style={styles.emptyButtonText}>Open Load Board</Text>
                  </TouchableOpacity>
                </View>
              }
              renderItem={renderRouteCard}
            />
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

function SidebarLink({
  icon,
  title,
  route,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  route: FreightRoute;
}) {
  return (
    <TouchableOpacity style={styles.sidebarLink} onPress={() => goTo(route)}>
      <Ionicons name={icon} size={18} color="#A5B4FC" />
      <Text style={styles.sidebarLinkText}>{title}</Text>
    </TouchableOpacity>
  );
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.metricCard}>
      <View style={styles.metricIcon}>
        <Ionicons name={icon} size={21} color={COLORS.primary} />
      </View>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue} numberOfLines={1}>{value}</Text>
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
    <TouchableOpacity style={outline ? styles.navOutline : styles.navButton} onPress={() => goTo(route)}>
      <Ionicons name={icon} size={18} color={outline ? COLORS.primary : COLORS.white} />
      <Text style={outline ? styles.navOutlineText : styles.navText}>{title}</Text>
    </TouchableOpacity>
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
      <Ionicons name={icon} size={17} color={COLORS.white} />
      <Text style={styles.actionText}>{label}</Text>
    </TouchableOpacity>
  );
}

function SmallButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.smallButton} onPress={onPress}>
      <Ionicons name={icon} size={17} color={COLORS.primary} />
      <Text style={styles.smallButtonText}>{label}</Text>
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
  center: { flex: 1, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center", padding: 24 },
  centerText: { color: COLORS.muted, marginTop: 12, fontWeight: "800" },
  shell: { flex: 1, flexDirection: Platform.OS === "web" ? "row" : "column" },
  sidebar: {
    backgroundColor: COLORS.navy,
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 22,
    width: Platform.OS === "web" ? 310 : "100%",
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  brandIcon: {
    width: 54,
    height: 54,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  brandTitle: { color: COLORS.white, fontSize: 21, fontWeight: "900" },
  brandSubtitle: { color: "#A5B4FC", fontWeight: "800", marginTop: 2 },
  sideDivider: { height: 1, backgroundColor: "#1E293B", marginVertical: 22 },
  sidebarLink: {
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 14,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    marginBottom: 8,
  },
  sidebarLinkText: { color: "#CBD5E1", fontWeight: "900" },
  carrierPanel: {
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "#1E293B",
    borderRadius: 18,
    padding: 14,
    marginTop: 12,
  },
  carrierLabel: { color: "#A5B4FC", fontWeight: "900", textTransform: "uppercase", fontSize: 11 },
  carrierName: { color: COLORS.white, fontWeight: "900", marginTop: 6 },
  carrierSub: { color: "#CBD5E1", fontWeight: "700", marginTop: 4 },
  main: { flex: 1, padding: 18 },
  topPanel: {
    backgroundColor: COLORS.white,
    borderRadius: 26,
    padding: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    gap: 14,
    alignItems: "flex-start",
    marginBottom: 14,
  },
  eyebrow: { color: COLORS.primary, fontWeight: "900", fontSize: 12, letterSpacing: 1, textTransform: "uppercase" },
  pageTitle: { color: COLORS.text, fontSize: 34, fontWeight: "900", marginTop: 6 },
  pageSubtitle: { color: COLORS.muted, marginTop: 7, lineHeight: 22, fontWeight: "700", maxWidth: 760 },
  topIconButton: {
    width: 50,
    height: 50,
    borderRadius: 18,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: { paddingBottom: 90 },
  metricGrid: { flexDirection: Platform.OS === "web" ? "row" : "column", gap: 12, marginBottom: 14 },
  metricCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 22,
    padding: 16,
  },
  metricIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  metricLabel: { color: COLORS.muted, fontWeight: "900", fontSize: 11, textTransform: "uppercase" },
  metricValue: { color: COLORS.text, fontWeight: "900", fontSize: 22, marginTop: 5 },
  navRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  navButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  navOutline: {
    flex: 1,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  navText: { color: COLORS.white, fontWeight: "900" },
  navOutlineText: { color: COLORS.primary, fontWeight: "900" },
  listContent: { paddingBottom: 20 },
  emptyCard: {
    backgroundColor: COLORS.white,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 22,
    padding: 24,
    alignItems: "center",
  },
  emptyTitle: { color: COLORS.text, fontSize: 20, fontWeight: "900", marginTop: 10, marginBottom: 6 },
  emptyText: { color: COLORS.muted, lineHeight: 22, textAlign: "center", fontWeight: "700" },
  emptyButton: {
    backgroundColor: COLORS.primary,
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    flexDirection: "row",
    gap: 8,
  },
  emptyButtonText: { color: COLORS.white, fontWeight: "900" },
  card: {
    backgroundColor: COLORS.white,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
    borderLeftWidth: 5,
    borderLeftColor: COLORS.primary,
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, gap: 10 },
  loadId: { color: COLORS.text, fontSize: 20, fontWeight: "900" },
  carrierMeta: { color: COLORS.muted, marginTop: 4, fontWeight: "700" },
  statusPill: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, flexDirection: "row", alignItems: "center", gap: 5, maxWidth: 170 },
  statusText: { color: COLORS.white, fontWeight: "900", fontSize: 11 },
  mapPlaceholder: {
    backgroundColor: COLORS.primarySoft,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    padding: 22,
    alignItems: "center",
    marginBottom: 14,
  },
  mapTitle: { color: COLORS.text, fontSize: 21, fontWeight: "900", marginTop: 8 },
  mapText: { color: COLORS.muted, fontWeight: "700", textAlign: "center", marginTop: 4, lineHeight: 20 },
  routeBox: {
    backgroundColor: COLORS.panel,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
  },
  routeStop: { flexDirection: "row", gap: 10, alignItems: "center" },
  routeLine: { width: 2, height: 24, backgroundColor: COLORS.border, marginLeft: 8, marginVertical: 8 },
  routeLabel: { color: COLORS.primary, fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  route: { color: COLORS.text, fontSize: 18, fontWeight: "900", lineHeight: 23, marginTop: 3 },
  locationBox: {
    backgroundColor: COLORS.panel,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  locationHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  locationTitle: { color: COLORS.text, fontWeight: "900", fontSize: 18 },
  locationRow: { backgroundColor: COLORS.white, borderRadius: 12, padding: 11, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border },
  locationLabel: { color: COLORS.primary, fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  locationValue: { color: COLORS.text, fontWeight: "800", marginTop: 3 },
  locationText: { color: COLORS.text, fontWeight: "700", lineHeight: 20 },
  infoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  infoBox: {
    width: Platform.OS === "web" ? "23.5%" : "48%",
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 12,
  },
  infoLabel: { color: COLORS.muted, fontWeight: "900", fontSize: 11, textTransform: "uppercase" },
  infoValue: { color: COLORS.text, fontWeight: "900", marginTop: 4 },
  quickActionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  smallButton: {
    width: Platform.OS === "web" ? "23.5%" : "48%",
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    justifyContent: "center",
    gap: 7,
    alignItems: "center",
  },
  smallButtonText: { color: COLORS.primary, fontWeight: "900", fontSize: 12 },
  actionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  actionButton: {
    flexGrow: 1,
    minWidth: Platform.OS === "web" ? "23.5%" : "47%",
    paddingHorizontal: 12,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  primaryAction: { backgroundColor: COLORS.primary },
  secondaryAction: { backgroundColor: COLORS.slate },
  warningAction: { backgroundColor: COLORS.amber },
  purpleAction: { backgroundColor: COLORS.purple },
  tealAction: { backgroundColor: COLORS.teal },
  deliveredAction: { backgroundColor: COLORS.green },
  actionText: { color: COLORS.white, fontWeight: "900", fontSize: 13 },
  currentStepBox: {
    backgroundColor: COLORS.panel,
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
  currentStep: { color: COLORS.muted, fontWeight: "800", flex: 1 },
});
