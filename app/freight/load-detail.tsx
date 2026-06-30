// app/freight/load-detail.tsx

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
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../data/supabaseClient";

const ROUTES = {
  dashboard: "/freight/dashboard",
  board: "/freight/board",
  liveLoads: "/freight/live-loads",
  myLoads: "/freight/my-loads",
  loadChat: "/freight/load-chat",
  connectBank: "/freight/connect-bank",
  rateOptimizer: "/freight/rate-optimizer",
  tracking: "/freight/tracking",
  liveRoute: "/freight/live-route",
  proofOfPickup: "/freight/proof-of-pickup",
  proofOfDelivery: "/freight/proof-of-delivery",
  login: "/freight/login",
  register: "/freight/register",
} as const;

type FreightRoute = (typeof ROUTES)[keyof typeof ROUTES];

type LoadStatus =
  | "available"
  | "open"
  | "accepted"
  | "booked"
  | "arrived_pickup"
  | "picked_up"
  | "in_transit"
  | "arrived_dropoff"
  | "delivered"
  | "completed"
  | "cancelled";

type FreightCarrier = {
  id: string;
  freight_id?: string;
  freightId?: string;
  auth_user_id?: string;
  profile_id?: string;
  email?: string;
  companyName?: string;
  company_name?: string;
  businessName?: string;
  business_name?: string;
  contactName?: string;
  contact_name?: string;
  accountId?: string;
  account_id?: string;
  freightAccount?: string;
  freight_account?: string;
  stripeAccountId?: string;
  stripe_account_id?: string;
};

type FreightLoad = {
  id: string;
  farmer_id?: string | null;
  carrier_id?: string | null;
  title?: string | null;
  commodity?: string | null;
  pickup_city?: string | null;
  pickup_state?: string | null;
  delivery_city?: string | null;
  delivery_state?: string | null;
  rate?: number | null;
  status?: LoadStatus | string | null;
  created_at?: string | null;
  updated_at?: string | null;
  assigned_driver_id?: string | null;
  assigned_carrier_id?: string | null;
  ai_dispatch_score?: number | null;
  ai_dispatch_reason?: string | null;
  ai_dispatch_eta_minutes?: number | null;
  temperature_controlled?: boolean | null;
  priority_level?: string | null;
  farmer_name?: string | null;
  pickup_location?: string | null;
  dropoff_location?: string | null;
  pickup_date?: string | null;
  pickup_time?: string | null;
  dropoff_date?: string | null;
  dropoff_time?: string | null;
  equipment_type?: string | null;
  weight_lbs?: number | null;
  temperature_required?: string | null;
  distance_miles?: number | null;
  notes?: string | null;
  driver_id?: string | null;
  accepted_at?: string | null;
  arrived_pickup_at?: string | null;
  picked_up_at?: string | null;
  arrived_dropoff_at?: string | null;
  delivered_at?: string | null;
  proof_of_pickup_photo_url?: string | null;
  proof_of_delivery_photo_url?: string | null;
  freight_user_id?: string | null;
};

const COLORS = {
  bg: "#F7F7FB",
  card: "#FFFFFF",
  panel: "#F8FAFC",
  text: "#0F172A",
  muted: "#64748B",
  border: "#E5E7EB",
  borderDark: "#CBD5E1",
  primary: "#6D5DFB",
  primaryDark: "#4F46E5",
  primarySoft: "#EEF2FF",
  green: "#10B981",
  greenSoft: "#ECFDF5",
  amber: "#F59E0B",
  amberSoft: "#FFFBEB",
  red: "#EF4444",
  redSoft: "#FEF2F2",
  blue: "#2563EB",
  blueSoft: "#EFF6FF",
  purple: "#7C3AED",
  purpleSoft: "#F5F3FF",
  navy: "#020617",
  white: "#FFFFFF",
};

function clean(value: any) {
  return String(value ?? "").trim();
}

function normalize(value: any) {
  return clean(value).toLowerCase();
}

function money(value: any) {
  return `$${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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

function firstParam(value: any) {
  if (Array.isArray(value)) return clean(value[0]);
  return clean(value);
}

function formatStatus(value: any) {
  return clean(value || "available")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizedStatus(value: any): LoadStatus {
  const status = normalize(value || "available");

  if (["available", "open"].includes(status)) return "available";
  if (["accepted", "assigned", "booked"].includes(status)) return "accepted";
  if (["arrived_pickup", "arrived_at_pickup"].includes(status)) return "arrived_pickup";
  if (["picked_up", "pickup_confirmed"].includes(status)) return "picked_up";
  if (["in_transit", "on_route"].includes(status)) return "in_transit";
  if (["arrived_dropoff", "arrived_at_dropoff"].includes(status)) return "arrived_dropoff";
  if (["delivered", "completed", "complete"].includes(status)) return "delivered";
  if (["cancelled", "canceled"].includes(status)) return "cancelled";

  return "available";
}

function statusColor(status: any) {
  const value = normalizedStatus(status);
  if (value === "available") return COLORS.blue;
  if (value === "accepted") return COLORS.primary;
  if (value === "arrived_pickup") return COLORS.amber;
  if (value === "picked_up") return COLORS.amber;
  if (value === "in_transit") return COLORS.purple;
  if (value === "arrived_dropoff") return COLORS.purple;
  if (value === "delivered") return COLORS.green;
  if (value === "cancelled") return COLORS.red;
  return COLORS.muted;
}

function statusSoftColor(status: any) {
  const value = normalizedStatus(status);
  if (value === "available") return COLORS.blueSoft;
  if (value === "accepted") return COLORS.primarySoft;
  if (value === "arrived_pickup") return COLORS.amberSoft;
  if (value === "picked_up") return COLORS.amberSoft;
  if (value === "in_transit") return COLORS.purpleSoft;
  if (value === "arrived_dropoff") return COLORS.purpleSoft;
  if (value === "delivered") return COLORS.greenSoft;
  if (value === "cancelled") return COLORS.redSoft;
  return COLORS.panel;
}

function statusIcon(status: any): keyof typeof Ionicons.glyphMap {
  const value = normalizedStatus(status);
  if (value === "available") return "cube-outline";
  if (value === "accepted") return "checkmark-circle-outline";
  if (value === "arrived_pickup") return "location-outline";
  if (value === "picked_up") return "archive-outline";
  if (value === "in_transit") return "navigate-outline";
  if (value === "arrived_dropoff") return "flag-outline";
  if (value === "delivered") return "checkmark-done-outline";
  if (value === "cancelled") return "close-circle-outline";
  return "ellipse-outline";
}

function ratePerMile(load?: FreightLoad | null) {
  const miles = Number(load?.distance_miles || 0);
  const rate = Number(load?.rate || 0);
  if (!miles) return 0;
  return rate / miles;
}

function freightIdFromCarrier(carrier?: FreightCarrier | null) {
  return clean(carrier?.id || carrier?.freight_id || carrier?.freightId || carrier?.auth_user_id || carrier?.profile_id);
}

function carrierDisplayName(carrier?: FreightCarrier | null) {
  return (
    clean(carrier?.companyName || carrier?.businessName || carrier?.company_name || carrier?.business_name) ||
    clean(carrier?.contactName || carrier?.contact_name) ||
    "Farm2Home Freight Carrier"
  );
}

function isLoadOwnedByCarrier(load?: FreightLoad | null, carrier?: FreightCarrier | null) {
  const id = freightIdFromCarrier(carrier);
  if (!id || !load) return false;

  return [
    load.carrier_id,
    load.freight_user_id,
    load.driver_id,
    load.assigned_driver_id,
    load.assigned_carrier_id,
  ]
    .map(clean)
    .includes(id);
}

function routeValue(load?: FreightLoad | null, type: "pickup" | "dropoff" = "pickup") {
  if (!load) return "TBD";

  if (type === "pickup") {
    return (
      clean(load.pickup_location) ||
      [load.pickup_city, load.pickup_state].map(clean).filter(Boolean).join(", ") ||
      "Pickup TBD"
    );
  }

  return (
    clean(load.dropoff_location) ||
    [load.delivery_city, load.delivery_state].map(clean).filter(Boolean).join(", ") ||
    "Dropoff TBD"
  );
}

function scheduleValue(load?: FreightLoad | null, type: "pickup" | "dropoff" = "pickup") {
  if (!load) return "TBD";
  if (type === "pickup") return `${load.pickup_date || "TBD"} ${load.pickup_time || ""}`.trim();
  return `${load.dropoff_date || "TBD"} ${load.dropoff_time || ""}`.trim();
}

function goTo(route: FreightRoute) {
  router.push(route as any);
}

export default function FreightLoadDetailScreen() {
  const params = useLocalSearchParams();
  const loadId = firstParam(params.loadId || params.id);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState(false);

  const [carrier, setCarrier] = useState<FreightCarrier | null>(null);
  const [load, setLoad] = useState<FreightLoad | null>(null);
  const [messages, setMessages] = useState<any[]>([]);

  const [bidPerMile, setBidPerMile] = useState("");
  const [bidMessage, setBidMessage] = useState("");

  useFocusEffect(
    useCallback(() => {
      loadScreen();
    }, [loadId])
  );

  const status = normalizedStatus(load?.status);
  const totalRate = Number(load?.rate || 0);
  const totalMiles = Number(load?.distance_miles || 0);
  const rpm = ratePerMile(load);
  const carrierOwnsLoad = isLoadOwnedByCarrier(load, carrier);

  const isAvailable = ["available", "open"].includes(status);
  const canProgress = carrierOwnsLoad || isAvailable;

  const nextStep = useMemo(() => {
    if (status === "available") return { label: "Book Load", icon: "checkmark-circle-outline" as const, next: "accepted" };
    if (status === "accepted") return { label: "Arrived Pickup", icon: "location-outline" as const, next: "arrived_pickup" };
    if (status === "arrived_pickup") return { label: "Confirm Pickup", icon: "archive-outline" as const, next: "picked_up" };
    if (status === "picked_up") return { label: "Start Transit", icon: "navigate-outline" as const, next: "in_transit" };
    if (status === "in_transit") return { label: "Arrived Dropoff", icon: "flag-outline" as const, next: "arrived_dropoff" };
    if (status === "arrived_dropoff") return { label: "Complete Delivery", icon: "checkmark-done-outline" as const, next: "delivered" };
    return null;
  }, [status]);

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
    await AsyncStorage.multiSet([
      ["currentFreightCarrier", JSON.stringify(nextCarrier)],
      ["currentFreight", JSON.stringify(nextCarrier)],
      ["currentFreightUser", JSON.stringify(nextCarrier)],
      ["farm2homeCurrentFreight", JSON.stringify(nextCarrier)],
      ["currentUser", JSON.stringify(nextCarrier)],
      ["userRole", "freight"],
      ["currentUserRole", "freight"],
    ]);
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
      console.log("Load detail subscription lookup skipped:", error.message);
      return null;
    }

    return Array.isArray(data) && data.length > 0 ? data[0] : null;
  }

  async function persistCarrier(nextCarrier: any) {
    const id = clean(nextCarrier.id || nextCarrier.freightId || nextCarrier.freight_id || nextCarrier.auth_user_id);
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

    const normalized = {
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
        nextCarrier.contact_name ||
        "Farm2Home Freight Carrier",
      company_name:
        nextCarrier.company_name ||
        nextCarrier.companyName ||
        nextCarrier.business_name ||
        nextCarrier.businessName ||
        nextCarrier.contact_name ||
        "Farm2Home Freight Carrier",
      businessName:
        nextCarrier.businessName ||
        nextCarrier.companyName ||
        nextCarrier.business_name ||
        nextCarrier.company_name ||
        nextCarrier.contact_name ||
        "Farm2Home Freight Carrier",
      business_name:
        nextCarrier.business_name ||
        nextCarrier.businessName ||
        nextCarrier.company_name ||
        nextCarrier.companyName ||
        nextCarrier.contact_name ||
        "Farm2Home Freight Carrier",
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

    await saveFreightSession(normalized);
    setCarrier(normalized);
    return normalized;
  }

  async function loadScreen() {
    try {
      setLoading(true);

      const stored = await getStoredCarrier();
      const { data: authData } = await supabase.auth.getUser();

      const authId = clean(authData?.user?.id || "");
      const storedId = clean(stored?.id || stored?.freightId || stored?.freight_id || stored?.auth_user_id || "");
      const email = normalize(stored?.email || authData?.user?.email || "");
      const accountId = clean(stored?.accountId || stored?.account_id || "");

      if (!email && !authId && !storedId && !accountId) {
        router.replace(ROUTES.login as any);
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

      if (carrierError) {
        console.log("Load detail profile lookup skipped:", carrierError.message);
      }

      const dbCarrier = Array.isArray(dbCarrierRows) && dbCarrierRows.length > 0 ? dbCarrierRows[0] : null;

      if (!dbCarrier && !stored) {
        Alert.alert("Freight Profile Missing", "Please complete freight registration first.");
        router.replace(ROUTES.register as any);
        return;
      }

      const sub = await findSubscription(dbCarrier?.id || storedId || authId, normalize(dbCarrier?.email || email));
      const subAcct = pickAcct(sub?.freight_account, sub?.stripe_account_id);
      const rowAcct = pickAcct(dbCarrier?.freight_account, dbCarrier?.stripe_account_id);

      let mergedProfile = {
        ...(stored || {}),
        ...(dbCarrier || {}),
        id: dbCarrier?.id || storedId || authId,
        freightId: dbCarrier?.freight_id || dbCarrier?.id || storedId || authId,
        freight_id: dbCarrier?.freight_id || dbCarrier?.id || storedId || authId,
        email: normalize(dbCarrier?.email || email),
        stripe_customer_id: pickCus(dbCarrier?.stripe_customer_id, sub?.stripe_customer_id, stored?.stripe_customer_id),
        stripe_subscription_id: pickSub(
          dbCarrier?.stripe_subscription_id,
          dbCarrier?.subscription_id,
          sub?.stripe_subscription_id,
          stored?.stripe_subscription_id
        ),
        subscription_id: pickSub(
          dbCarrier?.subscription_id,
          dbCarrier?.stripe_subscription_id,
          sub?.stripe_subscription_id,
          stored?.subscription_id
        ),
        freight_account: pickAcct(dbCarrier?.freight_account, dbCarrier?.stripe_account_id, subAcct, stored?.freight_account),
        stripe_account_id: pickAcct(dbCarrier?.stripe_account_id, dbCarrier?.freight_account, subAcct, stored?.stripe_account_id),
      };

      if (dbCarrier?.id && subAcct && !rowAcct) {
        const updatePayload = {
          freight_account: subAcct,
          stripe_account_id: subAcct,
          stripe_connect_status: "started",
          updated_at: new Date().toISOString(),
        };
        await supabase.from("freight_users").update(updatePayload).eq("id", dbCarrier.id);
        mergedProfile = { ...mergedProfile, ...updatePayload };
      }

      await persistCarrier(mergedProfile);

      if (!loadId) {
        setLoad(null);
        return;
      }

      const { data: loadData, error: loadError } = await supabase
        .from("freight_loads")
        .select("*")
        .eq("id", loadId)
        .maybeSingle();

      if (loadError) throw loadError;
      setLoad(loadData || null);

      const { data: chatData, error: chatError } = await supabase
        .from("freight_load_messages")
        .select("*")
        .eq("load_id", loadId)
        .order("created_at", { ascending: false })
        .limit(5);

      if (chatError) {
        console.log("freight_load_messages skipped:", chatError.message);
        setMessages([]);
      } else {
        setMessages(Array.isArray(chatData) ? chatData : []);
      }
    } catch (error: any) {
      Alert.alert("Load Detail Error", error?.message || "Unable to load freight details.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadScreen();
  }

  async function createNotification(title: string, message: string) {
    if (!carrier?.id || !load?.id) return;

    const { error } = await supabase.from("freight_notifications").insert({
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

    if (error) console.log("freight notification skipped:", error.message);
  }

  async function updateLoadStatus(nextStatus: LoadStatus | string) {
    if (!load?.id || !carrier?.id) return;

    try {
      setUpdating(true);

      const now = new Date().toISOString();
      const carrierId = freightIdFromCarrier(carrier);

      const payload: any = {
        status: nextStatus,
        updated_at: now,
      };

      if (nextStatus === "accepted") {
        payload.carrier_id = carrierId;
        payload.freight_user_id = carrierId;
        payload.driver_id = carrierId;
        payload.assigned_driver_id = carrierId;
        payload.assigned_carrier_id = carrierId;
        payload.accepted_at = now;
      }

      if (nextStatus === "arrived_pickup") payload.arrived_pickup_at = now;
      if (nextStatus === "picked_up") payload.picked_up_at = now;
      if (nextStatus === "arrived_dropoff") payload.arrived_dropoff_at = now;
      if (nextStatus === "delivered") payload.delivered_at = now;

      let query = supabase.from("freight_loads").update(payload).eq("id", load.id);

      if (nextStatus === "accepted") {
        query = query.in("status", ["available", "open"]);
      }

      const { error } = await query;
      if (error) throw error;

      await createNotification(
        "Load Updated",
        `${load.title || load.commodity || "Freight Load"} is now ${formatStatus(nextStatus)}.`
      );

      await loadScreen();
    } catch (error: any) {
      Alert.alert("Update Error", error?.message || "Unable to update load.");
    } finally {
      setUpdating(false);
    }
  }

  async function submitBid() {
    if (!load?.id || !carrier?.id) return;

    const bidRate = Number(bidPerMile);

    if (!bidRate || Number.isNaN(bidRate) || bidRate <= 0) {
      Alert.alert("Invalid Bid", "Enter a valid bid per mile.");
      return;
    }

    try {
      setUpdating(true);

      const miles = Number(load.distance_miles || 0);
      const now = new Date().toISOString();

      const { error } = await supabase.from("freight_bids").insert({
        load_id: load.id,
        freight_id: carrier.id,
        carrier_id: carrier.id,
        carrier_company: carrierDisplayName(carrier),
        carrier_email: carrier.email,
        bid_per_mile: bidRate,
        total_bid: bidRate * miles,
        message: bidMessage.trim(),
        status: "pending",
        created_at: now,
        updated_at: now,
      });

      if (error) throw error;

      setBidPerMile("");
      setBidMessage("");
      Alert.alert("Bid Submitted", "Your freight bid was sent.");
    } catch (error: any) {
      Alert.alert("Bid Error", error?.message || "Unable to submit bid.");
    } finally {
      setUpdating(false);
    }
  }

  function openChat() {
    if (!load?.id) return;
    router.push({
      pathname: ROUTES.loadChat as any,
      params: { loadId: load.id },
    });
  }

  function openWithLoad(route: FreightRoute) {
    if (!load?.id) return;
    router.push({
      pathname: route as any,
      params: { loadId: load.id },
    });
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.centerText}>Loading load details...</Text>
      </SafeAreaView>
    );
  }

  if (!load) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.emptyTitle}>Load not found</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => router.replace(ROUTES.board as any)}>
          <Text style={styles.primaryButtonText}>Back to Load Board</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.shell}>
          <View style={styles.sidebar}>
            <View style={styles.brandRow}>
              <View style={styles.brandIcon}>
                <Ionicons name="cube-outline" size={28} color={COLORS.white} />
              </View>
              <View>
                <Text style={styles.brandTitle}>Farm2Home</Text>
                <Text style={styles.brandSubtitle}>Load Detail</Text>
              </View>
            </View>

            <View style={styles.sideDivider} />

            <SidebarLink icon="grid-outline" title="Dashboard" route={ROUTES.dashboard} />
            <SidebarLink icon="search-outline" title="Load Board" route={ROUTES.board} />
            <SidebarLink icon="briefcase-outline" title="My Loads" route={ROUTES.myLoads} />
            <SidebarLink icon="pulse-outline" title="Live Loads" route={ROUTES.liveLoads} />
            <SidebarLink icon="business-outline" title="Payouts" route={ROUTES.connectBank} />

            <View style={styles.sideNote}>
              <Text style={styles.sideNoteLabel}>Load ID</Text>
              <Text style={styles.sideNoteValue}>#{String(load.id).slice(-8)}</Text>
              <Text style={styles.sideNoteLabel}>Carrier</Text>
              <Text style={styles.sideNoteValue}>{carrierDisplayName(carrier)}</Text>
            </View>
          </View>

          <View style={styles.main}>
            <View style={styles.topPanel}>
              <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                <Ionicons name="chevron-back-outline" size={23} color={COLORS.primary} />
              </TouchableOpacity>

              <View style={{ flex: 1 }}>
                <Text style={styles.eyebrow}>Freight Dispatch Detail</Text>
                <Text style={styles.pageTitle}>{load.title || load.commodity || "Load Details"}</Text>
                <Text style={styles.pageSubtitle}>
                  Book, track, chat, prove pickup, prove delivery, and move the load through every active delivery step.
                </Text>
              </View>

              <View style={[styles.statusPill, { backgroundColor: statusColor(load.status) }]}>
                <Ionicons name={statusIcon(load.status)} size={14} color={COLORS.white} />
                <Text style={styles.statusPillText}>{formatStatus(load.status)}</Text>
              </View>
            </View>

            <View style={styles.commandCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.commandEyebrow}>Next Best Action</Text>
                <Text style={styles.commandTitle}>
                  {nextStep ? nextStep.label : status === "delivered" ? "Delivery Complete" : "Review Load"}
                </Text>
                <Text style={styles.commandText}>
                  {nextStep
                    ? "Use this action to keep the farmer, broker, and load board status up to date."
                    : "Open tracking, review proof photos, chat, or return to your booked loads."}
                </Text>
              </View>

              {nextStep ? (
                <TouchableOpacity
                  style={[styles.commandButton, updating && styles.disabledButton]}
                  onPress={() => updateLoadStatus(nextStep.next)}
                  disabled={updating || (!canProgress && nextStep.next !== "accepted")}
                >
                  {updating ? (
                    <ActivityIndicator color={COLORS.white} />
                  ) : (
                    <>
                      <Ionicons name={nextStep.icon} size={19} color={COLORS.white} />
                      <Text style={styles.commandButtonText}>{nextStep.label}</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.commandButton} onPress={() => goTo(ROUTES.myLoads)}>
                  <Ionicons name="briefcase-outline" size={19} color={COLORS.white} />
                  <Text style={styles.commandButtonText}>My Loads</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.metricGrid}>
              <MetricCard label="Carrier Rate" value={money(totalRate)} icon="cash-outline" />
              <MetricCard label="Rate / Mile" value={`${money(rpm)}/mi`} icon="trending-up-outline" />
              <MetricCard label="Miles" value={`${totalMiles.toFixed(0)} mi`} icon="speedometer-outline" />
              <MetricCard label="Priority" value={load.priority_level || "standard" } icon="flash-outline" />
            </View>

            <ProgressTracker status={status} load={load} />

            <View style={styles.gridTwo}>
              <View style={styles.card}>
                <SectionHeader icon="navigate-outline" title="Route & Schedule" subtitle="Pickup and delivery information." />

                <View style={styles.routeMapCard}>
                  <RouteStop label="Pickup" value={routeValue(load, "pickup")} sub={scheduleValue(load, "pickup")} start />
                  <View style={styles.verticalLine} />
                  <RouteStop label="Dropoff" value={routeValue(load, "dropoff")} sub={scheduleValue(load, "dropoff")} />
                </View>

                <View style={styles.quickActionRow}>
                  <SmallButton title="Tracking" icon="map-outline" onPress={() => openWithLoad(ROUTES.tracking)} />
                  <SmallButton title="Live Route" icon="navigate-outline" onPress={() => openWithLoad(ROUTES.liveRoute)} />
                </View>
              </View>

              <View style={styles.card}>
                <SectionHeader icon="cash-outline" title="Rate & Requirements" subtitle="Carrier payout and load requirements." />

                <View style={styles.rateBox}>
                  <Text style={styles.rateValue}>{money(totalRate)}</Text>
                  <Text style={styles.rateSub}>
                    {money(rpm)} / mile · {totalMiles.toFixed(0)} mi
                  </Text>
                </View>

                <InfoGrid
                  items={[
                    ["Equipment", load.equipment_type || "TBD"],
                    ["Weight", load.weight_lbs ? `${Number(load.weight_lbs).toLocaleString()} lbs` : "TBD"],
                    ["Temperature", load.temperature_required || (load.temperature_controlled ? "Required" : "Not required")],
                    ["Commodity", load.commodity || "Farm Freight"],
                  ]}
                />
              </View>
            </View>

            <View style={styles.card}>
              <SectionHeader icon="sparkles-outline" title="AI Dispatch Summary" subtitle="Dispatch score, ETA, and route notes." />

              <View style={styles.aiPanel}>
                <View style={styles.aiScoreCircle}>
                  <Text style={styles.aiScoreText}>{Number(load.ai_dispatch_score || 0).toFixed(0)}</Text>
                  <Text style={styles.aiScoreSub}>Score</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.aiTitle}>Recommended Dispatch Readiness</Text>
                  <Text style={styles.aiText}>
                    {load.ai_dispatch_reason ||
                      "No AI dispatch reason available yet. Once routing and carrier history are available, the app can show a better dispatch recommendation."}
                  </Text>
                  <Text style={styles.aiEta}>
                    ETA: {load.ai_dispatch_eta_minutes ? `${load.ai_dispatch_eta_minutes} minutes` : "Not calculated"}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.card}>
              <SectionHeader icon="people-outline" title="Farmer / Broker Details" subtitle="Load owner and contact context." />
              <InfoGrid
                items={[
                  ["Farmer", load.farmer_name || "Farm2Home Farmer"],
                  ["Farmer ID", load.farmer_id || "Not listed"],
                  ["Carrier ID", load.carrier_id || load.freight_user_id || "Not booked"],
                  ["Assigned Driver", load.assigned_driver_id || load.driver_id || "Not assigned"],
                ]}
              />
              {!!load.notes && (
                <View style={styles.notesBox}>
                  <Text style={styles.notesLabel}>Load Notes</Text>
                  <Text style={styles.notesText}>{load.notes}</Text>
                </View>
              )}
            </View>

            <View style={styles.card}>
              <SectionHeader icon="camera-outline" title="Proof & Delivery Documents" subtitle="Pickup and delivery evidence." />

              <View style={styles.proofGrid}>
                <ProofCard
                  title="Proof of Pickup"
                  status={load.proof_of_pickup_photo_url ? "Uploaded" : "Missing"}
                  active={Boolean(load.proof_of_pickup_photo_url)}
                  onPress={() => openWithLoad(ROUTES.proofOfPickup)}
                />
                <ProofCard
                  title="Proof of Delivery"
                  status={load.proof_of_delivery_photo_url ? "Uploaded" : "Missing"}
                  active={Boolean(load.proof_of_delivery_photo_url)}
                  onPress={() => openWithLoad(ROUTES.proofOfDelivery)}
                />
              </View>
            </View>

            <View style={styles.card}>
              <SectionHeader icon="chatbubbles-outline" title="Load Chat" subtitle="Recent messages with farmer, broker, or dispatch." />

              <FlatList
                data={messages}
                keyExtractor={(item, index) => String(item.id || index)}
                scrollEnabled={false}
                ListEmptyComponent={<Text style={styles.emptySmall}>No messages yet.</Text>}
                renderItem={({ item }) => (
                  <View style={styles.messageRow}>
                    <Text style={styles.messageName}>{item.sender_name || item.sender_role || "Message"}</Text>
                    <Text style={styles.messageText}>{item.message || item.body || ""}</Text>
                  </View>
                )}
              />

              <TouchableOpacity style={styles.primaryButton} onPress={openChat}>
                <Ionicons name="chatbubble-ellipses-outline" size={18} color={COLORS.white} />
                <Text style={styles.primaryButtonText}>Open Load Chat</Text>
              </TouchableOpacity>
            </View>

            {isAvailable ? (
              <View style={styles.card}>
                <SectionHeader icon="pricetag-outline" title="Submit Carrier Bid" subtitle="Send a rate-per-mile offer for available freight." />
                <TextInput
                  style={styles.input}
                  placeholder="Your bid per mile"
                  placeholderTextColor="#94A3B8"
                  keyboardType="decimal-pad"
                  value={bidPerMile}
                  onChangeText={setBidPerMile}
                />
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Message to farmer/broker"
                  placeholderTextColor="#94A3B8"
                  multiline
                  value={bidMessage}
                  onChangeText={setBidMessage}
                />

                <TouchableOpacity
                  style={[styles.primaryButton, updating && styles.disabledButton]}
                  onPress={submitBid}
                  disabled={updating}
                >
                  {updating ? (
                    <ActivityIndicator color={COLORS.white} />
                  ) : (
                    <>
                      <Ionicons name="send-outline" size={18} color={COLORS.white} />
                      <Text style={styles.primaryButtonText}>Submit Bid</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ) : null}

            <View style={styles.card}>
              <SectionHeader icon="flash-outline" title="Action Center" subtitle="Move the load through pickup, transit, proof, and delivery." />

              <View style={styles.actionGrid}>
                {isAvailable ? (
                  <ActionButton label="Book Load" icon="checkmark-circle-outline" onPress={() => updateLoadStatus("accepted")} disabled={updating} />
                ) : null}

                {status === "accepted" ? (
                  <ActionButton label="Arrived Pickup" icon="location-outline" onPress={() => updateLoadStatus("arrived_pickup")} disabled={updating} />
                ) : null}

                {status === "arrived_pickup" ? (
                  <>
                    <ActionButton label="Proof Pickup" icon="camera-outline" onPress={() => openWithLoad(ROUTES.proofOfPickup)} disabled={updating} />
                    <ActionButton label="Confirm Pickup" icon="archive-outline" onPress={() => updateLoadStatus("picked_up")} disabled={updating} />
                  </>
                ) : null}

                {status === "picked_up" ? (
                  <ActionButton label="Start Transit" icon="navigate-outline" onPress={() => updateLoadStatus("in_transit")} disabled={updating} />
                ) : null}

                {status === "in_transit" ? (
                  <ActionButton label="Arrived Dropoff" icon="flag-outline" onPress={() => updateLoadStatus("arrived_dropoff")} disabled={updating} />
                ) : null}

                {status === "arrived_dropoff" ? (
                  <>
                    <ActionButton label="Proof Delivery" icon="checkmark-done-outline" onPress={() => openWithLoad(ROUTES.proofOfDelivery)} disabled={updating} />
                    <ActionButton label="Complete Delivery" icon="checkmark-done-outline" onPress={() => updateLoadStatus("delivered")} disabled={updating} />
                  </>
                ) : null}

                <ActionButton label="Live Tracking" icon="map-outline" onPress={() => openWithLoad(ROUTES.tracking)} />
                <ActionButton label="Rate Optimizer" icon="trending-up-outline" onPress={() => goTo(ROUTES.rateOptimizer)} />
                <ActionButton label="Connect Bank" icon="business-outline" onPress={() => goTo(ROUTES.connectBank)} />
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
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
        <Ionicons name={icon} size={20} color={COLORS.white} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>
    </View>
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

function InfoGrid({ items }: { items: Array<[string, any]> }) {
  return (
    <View style={styles.infoGrid}>
      {items.map(([label, value]) => (
        <View style={styles.infoBox} key={label}>
          <Text style={styles.infoLabel}>{label}</Text>
          <Text style={styles.infoValue} numberOfLines={2}>
            {clean(value) || "TBD"}
          </Text>
        </View>
      ))}
    </View>
  );
}

function RouteStop({
  label,
  value,
  sub,
  start,
}: {
  label: string;
  value: string;
  sub: string;
  start?: boolean;
}) {
  return (
    <View style={styles.routeStop}>
      <View style={[styles.routeDot, start ? styles.routeDotStart : styles.routeDotEnd]}>
        <Ionicons name={start ? "radio-button-on-outline" : "location-outline"} size={18} color={start ? COLORS.green : COLORS.red} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.routeLabel}>{label}</Text>
        <Text style={styles.routeValue}>{value}</Text>
        <Text style={styles.routeSub}>{sub}</Text>
      </View>
    </View>
  );
}

function ProgressTracker({ status, load }: { status: LoadStatus; load: FreightLoad | null }) {
  const steps = [
    { key: "accepted", label: "Booked", time: load?.accepted_at },
    { key: "arrived_pickup", label: "At Pickup", time: load?.arrived_pickup_at },
    { key: "picked_up", label: "Picked Up", time: load?.picked_up_at },
    { key: "in_transit", label: "In Transit", time: "" },
    { key: "arrived_dropoff", label: "At Dropoff", time: load?.arrived_dropoff_at },
    { key: "delivered", label: "Delivered", time: load?.delivered_at },
  ];

  const order = ["available", "accepted", "arrived_pickup", "picked_up", "in_transit", "arrived_dropoff", "delivered"];
  const currentIndex = order.indexOf(status);

  return (
    <View style={styles.card}>
      <SectionHeader icon="git-branch-outline" title="Delivery Progress" subtitle="Live status path for the freight load." />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.progressRow}>
        {steps.map((step, index) => {
          const active = currentIndex >= order.indexOf(step.key);
          const current = status === step.key;

          return (
            <View key={step.key} style={[styles.progressStep, active && styles.progressStepActive, current && styles.progressStepCurrent]}>
              <View style={[styles.progressIcon, active && styles.progressIconActive]}>
                <Ionicons name={active ? "checkmark-outline" : "ellipse-outline"} size={16} color={active ? COLORS.white : COLORS.muted} />
              </View>
              <Text style={[styles.progressLabel, active && styles.progressLabelActive]}>{step.label}</Text>
              <Text style={styles.progressTime}>{step.time ? "Time saved" : current ? "Current" : "Pending"}</Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function ProofCard({
  title,
  status,
  active,
  onPress,
}: {
  title: string;
  status: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[styles.proofCard, active && styles.proofCardActive]} onPress={onPress}>
      <View style={[styles.proofIcon, active && styles.proofIconActive]}>
        <Ionicons name={active ? "checkmark-circle-outline" : "camera-outline"} size={22} color={active ? COLORS.white : COLORS.primary} />
      </View>
      <Text style={styles.proofTitle}>{title}</Text>
      <Text style={[styles.proofStatus, active && styles.proofStatusActive]}>{status}</Text>
    </TouchableOpacity>
  );
}

function ActionButton({
  label,
  icon,
  onPress,
  disabled,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity style={[styles.actionButton, disabled && styles.disabledButton]} onPress={onPress} disabled={disabled}>
      <Ionicons name={icon} size={18} color={COLORS.white} />
      <Text style={styles.actionButtonText}>{label}</Text>
    </TouchableOpacity>
  );
}

function SmallButton({
  title,
  icon,
  onPress,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.smallButton} onPress={onPress}>
      <Ionicons name={icon} size={17} color={COLORS.primary} />
      <Text style={styles.smallButtonText}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  content: { flexGrow: 1, paddingBottom: 40 },
  center: { flex: 1, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center", padding: 24 },
  centerText: { color: COLORS.muted, marginTop: 12, fontWeight: "800" },
  emptyTitle: { color: COLORS.text, fontSize: 22, fontWeight: "900", marginBottom: 14 },

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
  sideNote: {
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "#1E293B",
    borderRadius: 18,
    padding: 14,
    marginTop: 12,
    gap: 5,
  },
  sideNoteLabel: { color: "#A5B4FC", fontWeight: "900", textTransform: "uppercase", fontSize: 11, marginTop: 6 },
  sideNoteValue: { color: COLORS.white, fontWeight: "900" },

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
  backButton: {
    width: 46,
    height: 46,
    borderRadius: 18,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: { color: COLORS.primary, fontWeight: "900", fontSize: 12, letterSpacing: 1, textTransform: "uppercase" },
  pageTitle: { color: COLORS.text, fontSize: 31, fontWeight: "900", marginTop: 6 },
  pageSubtitle: { color: COLORS.muted, fontWeight: "700", lineHeight: 22, marginTop: 7, maxWidth: 760 },
  statusPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusPillText: { color: COLORS.white, fontWeight: "900", fontSize: 12 },

  commandCard: {
    backgroundColor: COLORS.navy,
    borderRadius: 26,
    padding: 20,
    marginBottom: 14,
    flexDirection: Platform.OS === "web" ? "row" : "column",
    alignItems: Platform.OS === "web" ? "center" : "stretch",
    gap: 14,
  },
  commandEyebrow: { color: "#A5B4FC", fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.8, fontSize: 11 },
  commandTitle: { color: COLORS.white, fontSize: 25, fontWeight: "900", marginTop: 5 },
  commandText: { color: "#CBD5E1", fontWeight: "700", marginTop: 6, lineHeight: 20 },
  commandButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minWidth: 180,
  },
  commandButtonText: { color: COLORS.white, fontWeight: "900" },

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
  metricValue: { color: COLORS.text, fontWeight: "900", fontSize: 20, marginTop: 5 },

  gridTwo: { flexDirection: Platform.OS === "web" ? "row" : "column", gap: 14, alignItems: "flex-start" },
  card: {
    flex: 1,
    width: "100%",
    backgroundColor: COLORS.white,
    borderRadius: 26,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
  },
  sectionHeader: { flexDirection: "row", gap: 12, alignItems: "flex-start", marginBottom: 16 },
  sectionIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: { color: COLORS.text, fontSize: 21, fontWeight: "900" },
  sectionSubtitle: { color: COLORS.muted, fontWeight: "700", lineHeight: 20, marginTop: 3 },

  routeMapCard: {
    backgroundColor: COLORS.panel,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
  },
  routeStop: { flexDirection: "row", gap: 11, alignItems: "flex-start" },
  routeDot: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  routeDotStart: { backgroundColor: COLORS.greenSoft },
  routeDotEnd: { backgroundColor: COLORS.redSoft },
  verticalLine: { width: 3, height: 30, backgroundColor: COLORS.borderDark, marginLeft: 16, marginVertical: 4, borderRadius: 999 },
  routeLabel: { color: COLORS.primary, fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  routeValue: { color: COLORS.text, fontWeight: "900", marginTop: 3, lineHeight: 20 },
  routeSub: { color: COLORS.muted, fontWeight: "700", marginTop: 3 },

  quickActionRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  smallButton: {
    flex: 1,
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

  rateBox: { backgroundColor: COLORS.navy, borderRadius: 18, padding: 16, marginBottom: 12 },
  rateValue: { color: COLORS.white, fontSize: 32, fontWeight: "900" },
  rateSub: { color: "#CBD5E1", fontWeight: "800", marginTop: 5 },

  infoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 6 },
  infoBox: {
    width: Platform.OS === "web" ? "23.5%" : "48%",
    backgroundColor: COLORS.panel,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 13,
  },
  infoLabel: { color: COLORS.muted, fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  infoValue: { color: COLORS.text, fontWeight: "800", marginTop: 5, lineHeight: 19 },

  progressRow: { gap: 10, paddingTop: 2 },
  progressStep: {
    minWidth: 130,
    backgroundColor: COLORS.panel,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
  },
  progressStepActive: { backgroundColor: COLORS.primarySoft, borderColor: "#C7D2FE" },
  progressStepCurrent: { borderColor: COLORS.primary, borderWidth: 2 },
  progressIcon: {
    width: 31,
    height: 31,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  progressIconActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  progressLabel: { color: COLORS.muted, fontWeight: "900", fontSize: 12 },
  progressLabelActive: { color: COLORS.text },
  progressTime: { color: COLORS.muted, fontWeight: "700", marginTop: 4, fontSize: 11 },

  aiPanel: {
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    borderRadius: 20,
    padding: 14,
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
  },
  aiScoreCircle: {
    width: 74,
    height: 74,
    borderRadius: 26,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  aiScoreText: { color: COLORS.white, fontWeight: "900", fontSize: 23 },
  aiScoreSub: { color: "#E0E7FF", fontWeight: "800", fontSize: 11 },
  aiTitle: { color: COLORS.text, fontWeight: "900", fontSize: 16 },
  aiText: { color: COLORS.muted, fontWeight: "700", lineHeight: 20, marginTop: 5 },
  aiEta: { color: COLORS.primary, fontWeight: "900", marginTop: 8 },

  proofGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  proofCard: {
    flex: 1,
    minWidth: 190,
    backgroundColor: COLORS.panel,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
  },
  proofCardActive: { backgroundColor: COLORS.greenSoft, borderColor: "#A7F3D0" },
  proofIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  proofIconActive: { backgroundColor: COLORS.green },
  proofTitle: { color: COLORS.text, fontWeight: "900" },
  proofStatus: { color: COLORS.muted, fontWeight: "800", marginTop: 4 },
  proofStatusActive: { color: COLORS.green },

  notesBox: { backgroundColor: COLORS.navy, borderRadius: 16, padding: 14, marginTop: 12 },
  notesLabel: { color: "#A5B4FC", fontWeight: "900", marginBottom: 5 },
  notesText: { color: "#CBD5E1", fontWeight: "700", lineHeight: 20 },

  messageRow: {
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 12,
    marginBottom: 9,
  },
  messageName: { color: COLORS.primary, fontWeight: "900", textTransform: "capitalize" },
  messageText: { color: COLORS.text, fontWeight: "700", marginTop: 4 },
  emptySmall: { color: COLORS.muted, fontWeight: "800", marginBottom: 12 },

  input: {
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.borderDark,
    borderRadius: 15,
    padding: 14,
    color: COLORS.text,
    fontWeight: "700",
    marginBottom: 12,
  },
  textArea: { minHeight: 90, textAlignVertical: "top" },

  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 15,
    padding: 15,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  primaryButtonText: { color: COLORS.white, fontWeight: "900", textAlign: "center" },
  actionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  actionButton: {
    width: Platform.OS === "web" ? "23.5%" : "48%",
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    padding: 15,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  disabledButton: { opacity: 0.6 },
  actionButtonText: { color: COLORS.white, fontWeight: "900", textAlign: "center", flexShrink: 1 },
});
