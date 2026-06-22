// app/freight/live-loads.tsx

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
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../data/supabaseClient";

const FREIGHT_ROUTES = {
  dashboard: "/freight/dashboard",
  board: "/freight/board",
  liveLoads: "/freight/live-loads",
  myLoads: "/freight/my-loads",
  liveRoute: "/freight/live-route",
  routeDetails: "/freight/route-details",
  routeExceptions: "/freight/route-exceptions",
  loadIssues: "/freight/load-issues",
  loadChat: "/freight/load-chat",
  communicationCenter: "/freight/communication-center",
  notifications: "/freight/notifications",
  proofOfPickup: "/freight/proof-of-pickup",
  proofOfDelivery: "/freight/proof-of-delivery",
  profile: "/freight/profile",
  settings: "/freight/settings",
  connectBank: "/freight/connect-bank",
  login: "/freight/login",
  register: "/freight/register",
} as const;

type FreightRoute = (typeof FREIGHT_ROUTES)[keyof typeof FREIGHT_ROUTES];

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
  freight_user_id?: string;
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
  if (value === "accepted" || value === "booked") return COLORS.primary;
  if (value === "arrived_pickup") return COLORS.teal;
  if (value === "picked_up") return COLORS.amber;
  if (value === "in_transit") return COLORS.purple;
  if (value === "arrived_dropoff") return COLORS.teal;
  if (value === "delivered" || value === "completed") return COLORS.green;
  return COLORS.slate;
}

function statusLabel(status?: string) {
  return String(status || "accepted")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function FreightLiveLoadsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState("");
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
      console.log("Live loads subscription lookup error:", error.message);
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

  async function loadLiveLoads() {
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

      if (carrierError) console.log("Freight live loads profile error:", carrierError.message);

      const dbCarrier = Array.isArray(dbCarrierRows) && dbCarrierRows.length > 0 ? dbCarrierRows[0] : null;

      if (!dbCarrier) {
        Alert.alert(
          "Freight Profile Missing",
          "No freight profile was found. Please complete freight registration again."
        );
        router.replace(FREIGHT_ROUTES.register as any);
        return;
      }

      const sub = await findSubscription(dbCarrier.id || storedId || authId, normalize(dbCarrier.email || email));
      const subAcct = pickAcct(sub?.freight_account, sub?.stripe_account_id);
      const rowAcct = pickAcct(dbCarrier.freight_account, dbCarrier.stripe_account_id);

      let mergedProfile = {
        ...(stored || {}),
        ...(dbCarrier || {}),
        id: dbCarrier.id,
        freightId: dbCarrier.freight_id || dbCarrier.id,
        freight_id: dbCarrier.freight_id || dbCarrier.id,
        email: normalize(dbCarrier.email || email),
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
        mergedProfile = { ...mergedProfile, ...updatePayload };
      }

      const mergedCarrier = await persistCarrier(mergedProfile);
      const carrierId = mergedCarrier.id;

      const { data, error } = await supabase
        .from("freight_loads")
        .select("*")
        .or(
          `carrier_id.eq.${carrierId},freight_user_id.eq.${carrierId},driver_id.eq.${carrierId},accepted_by.eq.${carrierId}`
        )
        .in("status", ["accepted", "booked", "arrived_pickup", "picked_up", "in_transit", "arrived_dropoff"])
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

  async function updateStatus(load: FreightLoad, nextStatus: string) {
    try {
      setUpdatingId(load.id);

      const now = new Date().toISOString();

      const payload: any = {
        status: nextStatus,
        updated_at: now,
      };

      if (nextStatus === "arrived_pickup") payload.arrived_pickup_at = now;
      if (nextStatus === "picked_up") payload.picked_up_at = now;
      if (nextStatus === "in_transit") payload.in_transit_at = now;
      if (nextStatus === "arrived_dropoff") payload.arrived_dropoff_at = now;
      if (nextStatus === "delivered") {
        payload.delivered_at = now;
        payload.settlement_status = "pending";
        payload.payout_status = "pending";
      }

      const { error } = await supabase.from("freight_loads").update(payload).eq("id", load.id);
      if (error) throw error;

      await createNotification(
        load,
        "Live Load Updated",
        `${load.title || "Freight Load"} marked as ${statusLabel(nextStatus)}.`
      );

      await loadLiveLoads();
    } catch (error: any) {
      Alert.alert("Update Error", error?.message || "Unable to update load.");
    } finally {
      setUpdatingId("");
    }
  }

  function openRoute(route: FreightRoute, load: FreightLoad) {
    router.push({
      pathname: route as any,
      params: { loadId: load.id },
    });
  }

  function nextAction(load: FreightLoad) {
    const status = normalize(load.status);
    const busy = updatingId === load.id;

    if (status === "accepted" || status === "booked") {
      return (
        <ActionButton
          title="Arrived Pickup"
          icon="location-outline"
          loading={busy}
          onPress={() => updateStatus(load, "arrived_pickup")}
        />
      );
    }

    if (status === "arrived_pickup") {
      return (
        <ActionButton
          title="Proof Pickup"
          icon="camera-outline"
          loading={busy}
          onPress={() => openRoute(FREIGHT_ROUTES.proofOfPickup, load)}
        />
      );
    }

    if (status === "picked_up") {
      return (
        <ActionButton
          title="Start Transit"
          icon="navigate-outline"
          loading={busy}
          onPress={() => updateStatus(load, "in_transit")}
        />
      );
    }

    if (status === "in_transit") {
      return (
        <ActionButton
          title="Arrived Dropoff"
          icon="flag-outline"
          loading={busy}
          onPress={() => updateStatus(load, "arrived_dropoff")}
        />
      );
    }

    if (status === "arrived_dropoff") {
      return (
        <ActionButton
          title="Proof Delivery"
          icon="checkmark-done-outline"
          loading={busy}
          onPress={() => openRoute(FREIGHT_ROUTES.proofOfDelivery, load)}
        />
      );
    }

    return null;
  }

  const totalValue = useMemo(() => loads.reduce((sum, load) => sum + Number(load.rate || 0), 0), [loads]);
  const totalMiles = useMemo(() => loads.reduce((sum, load) => sum + Number(load.distance_miles || 0), 0), [loads]);
  const inTransit = useMemo(() => loads.filter((load) => normalize(load.status) === "in_transit").length, [loads]);
  const pickupStage = useMemo(
    () => loads.filter((load) => ["accepted", "booked", "arrived_pickup"].includes(normalize(load.status))).length,
    [loads]
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.centerText}>Loading live freight loads...</Text>
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
              <Ionicons name="pulse-outline" size={28} color={COLORS.white} />
            </View>
            <View>
              <Text style={styles.brandTitle}>Farm2Home</Text>
              <Text style={styles.brandSubtitle}>Live Loads</Text>
            </View>
          </View>

          <View style={styles.sideDivider} />
          <SidebarLink icon="grid-outline" title="Dashboard" route={FREIGHT_ROUTES.dashboard} />
          <SidebarLink icon="search-outline" title="Load Board" route={FREIGHT_ROUTES.board} />
          <SidebarLink icon="briefcase-outline" title="My Loads" route={FREIGHT_ROUTES.myLoads} />
          <SidebarLink icon="pulse-outline" title="Live Loads" active route={FREIGHT_ROUTES.liveLoads} />
          <SidebarLink icon="chatbubbles-outline" title="Chat Center" route={FREIGHT_ROUTES.communicationCenter} />
          <SidebarLink icon="notifications-outline" title="Alerts" route={FREIGHT_ROUTES.notifications} />

          <View style={styles.carrierPanel}>
            <Text style={styles.carrierLabel}>Carrier</Text>
            <Text style={styles.carrierName} numberOfLines={1}>
              {carrier?.companyName || "Freight Carrier"}
            </Text>
            <Text style={styles.carrierSub} numberOfLines={1}>
              {carrier?.accountId || carrier?.account_id || "Account pending"}
            </Text>
          </View>
        </View>

        <View style={styles.main}>
          <View style={styles.topPanel}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>Fina Admin Live Operations</Text>
              <Text style={styles.pageTitle}>Live Loads</Text>
              <Text style={styles.pageSubtitle}>
                Track active freight movement, route status, pickup progress, chat, issues, and dropoff workflow.
              </Text>
            </View>

            <TouchableOpacity style={styles.topIconButton} onPress={() => goTo(FREIGHT_ROUTES.dashboard)}>
              <Ionicons name="grid-outline" size={23} color={COLORS.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <View style={styles.metricGrid}>
              <MetricCard label="Live Loads" value={String(loads.length)} icon="pulse-outline" />
              <MetricCard label="Pickup Stage" value={String(pickupStage)} icon="location-outline" />
              <MetricCard label="In Transit" value={String(inTransit)} icon="navigate-outline" />
              <MetricCard label="Route Value" value={money(totalValue)} icon="cash-outline" />
            </View>

            <View style={styles.valueCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.valueLabel}>Active Route Miles</Text>
                <Text style={styles.valueAmount}>{totalMiles.toFixed(0)} mi</Text>
                <Text style={styles.valueSub}>Active freight value: {money(totalValue)}</Text>
              </View>

              <TouchableOpacity style={styles.valueButton} onPress={() => goTo(FREIGHT_ROUTES.communicationCenter)}>
                <Ionicons name="chatbubbles-outline" size={18} color={COLORS.white} />
                <Text style={styles.valueButtonText}>Chat</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.navRow}>
              <NavButton title="Dashboard" icon="grid-outline" route={FREIGHT_ROUTES.dashboard} />
              <NavButton title="Chat Center" icon="chatbubbles-outline" route={FREIGHT_ROUTES.communicationCenter} outline />
            </View>

            <FlatList
              data={loads}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <View style={styles.emptyCard}>
                  <Ionicons name="trail-sign-outline" size={38} color={COLORS.primary} />
                  <Text style={styles.emptyTitle}>No live freight loads</Text>
                  <Text style={styles.emptyText}>Accepted freight loads will appear here while they are active.</Text>

                  <TouchableOpacity style={styles.emptyButton} onPress={() => goTo(FREIGHT_ROUTES.board)}>
                    <Ionicons name="list-outline" size={18} color={COLORS.white} />
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
                    <View style={styles.routeStop}>
                      <Ionicons name="radio-button-on-outline" size={18} color={COLORS.green} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.routeLabel}>Pickup</Text>
                        <Text style={styles.routeText}>{item.pickup_location || "Pickup TBD"}</Text>
                      </View>
                    </View>

                    <View style={styles.routeLine} />

                    <View style={styles.routeStop}>
                      <Ionicons name="location-outline" size={18} color={COLORS.red} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.routeLabel}>Dropoff</Text>
                        <Text style={styles.routeText}>{item.dropoff_location || "Dropoff TBD"}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.infoGrid}>
                    <Info label="Pickup" value={`${item.pickup_date || "TBD"} · ${item.pickup_time || "TBD"}`} />
                    <Info label="Equipment" value={item.equipment_type || "Standard"} />
                    <Info label="Miles" value={`${Number(item.distance_miles || 0).toFixed(0)} mi`} />
                    <Info label="Rate" value={money(Number(item.rate || 0))} />
                  </View>

                  <View style={styles.actionRow}>{nextAction(item)}</View>

                  <View style={styles.secondaryGrid}>
                    <TouchableOpacity style={styles.secondaryButton} onPress={() => openRoute(FREIGHT_ROUTES.liveRoute, item)}>
                      <Ionicons name="map-outline" size={18} color={COLORS.primary} />
                      <Text style={styles.secondaryText}>Live Route</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.secondaryButton} onPress={() => openRoute(FREIGHT_ROUTES.routeDetails, item)}>
                      <Ionicons name="trail-sign-outline" size={18} color={COLORS.primary} />
                      <Text style={styles.secondaryText}>Details</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.secondaryButton} onPress={() => openRoute(FREIGHT_ROUTES.loadChat, item)}>
                      <Ionicons name="chatbubble-outline" size={18} color={COLORS.primary} />
                      <Text style={styles.secondaryText}>Chat</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.secondaryButton} onPress={() => openRoute(FREIGHT_ROUTES.loadIssues, item)}>
                      <Ionicons name="alert-circle-outline" size={18} color={COLORS.primary} />
                      <Text style={styles.secondaryText}>Issue</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
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
  active,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  route: FreightRoute;
  active?: boolean;
}) {
  return (
    <TouchableOpacity style={[styles.sidebarLink, active && styles.sidebarLinkActive]} onPress={() => goTo(route)}>
      <Ionicons name={icon} size={18} color={active ? COLORS.white : "#A5B4FC"} />
      <Text style={[styles.sidebarLinkText, active && styles.sidebarLinkTextActive]}>{title}</Text>
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
  loading,
  onPress,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.actionButton} onPress={onPress} disabled={loading}>
      {loading ? (
        <ActivityIndicator size="small" color={COLORS.white} />
      ) : (
        <Ionicons name={icon} size={18} color={COLORS.white} />
      )}
      <Text style={styles.actionText}>{title}</Text>
    </TouchableOpacity>
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
  sidebarLinkActive: { backgroundColor: COLORS.primary },
  sidebarLinkText: { color: "#CBD5E1", fontWeight: "900" },
  sidebarLinkTextActive: { color: COLORS.white },
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
  pageSubtitle: { color: COLORS.muted, fontWeight: "700", lineHeight: 22, marginTop: 7, maxWidth: 760 },
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
  valueCard: {
    backgroundColor: COLORS.navy,
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  valueLabel: { color: "#A5B4FC", fontWeight: "900", textTransform: "uppercase", fontSize: 12 },
  valueAmount: { color: COLORS.white, fontSize: 30, fontWeight: "900", marginTop: 4 },
  valueSub: { color: "#CBD5E1", fontWeight: "800", marginTop: 4 },
  valueButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 12,
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
  },
  valueButtonText: { color: COLORS.white, fontWeight: "900" },
  navRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  navButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  navOutline: {
    flex: 1,
    backgroundColor: COLORS.primarySoft,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    borderWidth: 1,
    borderColor: "#C7D2FE",
  },
  navText: { color: COLORS.white, fontWeight: "900" },
  navOutlineText: { color: COLORS.primary, fontWeight: "900" },
  listContent: { paddingBottom: 20 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 5,
    borderLeftColor: COLORS.primary,
  },
  cardTop: { flexDirection: "row", gap: 12, marginBottom: 12 },
  loadTitle: { color: COLORS.text, fontSize: 20, fontWeight: "900" },
  farmName: { color: COLORS.muted, fontWeight: "700", marginTop: 4 },
  statusPill: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999 },
  statusText: { color: COLORS.white, fontSize: 12, fontWeight: "900" },
  routeBox: {
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
  },
  routeStop: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  routeLabel: { color: COLORS.primary, fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  routeText: { color: COLORS.text, fontWeight: "900", marginTop: 4, lineHeight: 20 },
  routeLine: { width: 2, height: 22, backgroundColor: COLORS.border, marginVertical: 8, marginLeft: 8 },
  infoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  infoBox: {
    flexBasis: Platform.OS === "web" ? "23.5%" : "48%",
    flexGrow: 1,
    backgroundColor: COLORS.panel,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
  },
  infoLabel: { color: COLORS.muted, fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  infoText: { color: COLORS.text, fontWeight: "800", marginTop: 5, lineHeight: 19 },
  actionRow: { marginTop: 14 },
  actionButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    padding: 13,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  actionText: { color: COLORS.white, fontWeight: "900" },
  secondaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  secondaryButton: {
    width: Platform.OS === "web" ? "23.5%" : "48%",
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  secondaryText: { color: COLORS.primary, fontWeight: "900", fontSize: 12 },
  emptyCard: {
    backgroundColor: COLORS.white,
    borderRadius: 22,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 20,
  },
  emptyTitle: { color: COLORS.text, fontSize: 20, fontWeight: "900", marginTop: 10 },
  emptyText: { color: COLORS.muted, fontWeight: "700", textAlign: "center", marginTop: 8, lineHeight: 22 },
  emptyButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 14,
    marginTop: 16,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  emptyButtonText: { color: COLORS.white, fontWeight: "900" },
});
