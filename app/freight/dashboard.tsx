// app/freight/dashboard.tsx

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

const ROUTES = {
  dashboard: "/freight/dashboard",
  board: "/freight/board",
  liveLoads: "/freight/live-loads",
  loadDetail: "/freight/load-detail",
  myLoads: "/freight/my-loads",
  rateOptimizer: "/freight/rate-optimizer",
  paymentSuccess: "/freight/payment-success",
  connectBank: "/freight/connect-bank",
  notifications: "/freight/notifications",
  profile: "/freight/profile",
  settings: "/freight/settings",
  support: "/freight/support",
} as const;

type FreightRoute = (typeof ROUTES)[keyof typeof ROUTES];

type LoadStatus =
  | "OPEN"
  | "BOOKED"
  | "PICKED_UP"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "CANCELLED";

type FreightLoad = {
  id: string;
  title: string;
  commodity: string;
  pickupCity: string;
  pickupState: string;
  deliveryCity: string;
  deliveryState: string;
  pickupLocation: string;
  deliveryLocation: string;
  farmerName: string;
  brokerName: string;
  rate: number;
  miles: number;
  weight: string;
  equipment: string;
  pickupDate: string;
  status: LoadStatus;
  created_at?: string | null;
};

type CarrierStatus = {
  id: string;
  freightId: string;
  accountId: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  username: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripeAccountId: string;
  membershipStatus: string;
  subscriptionStatus: string;
  connectStatus: string;
  payoutsEnabled: boolean;
  chargesEnabled: boolean;
  onboardingComplete: boolean;
  accountActive: boolean;
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
  purple: "#7C3AED",
  navy: "#020617",
  dark: "#111827",
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

function shortId(value?: string) {
  const id = clean(value);
  if (!id) return "Missing";
  if (id.length <= 14) return id;
  return `${id.slice(0, 8)}...${id.slice(-5)}`;
}

function splitCityState(location?: string | null) {
  const raw = clean(location);
  const parts = raw.split(",").map((x) => x.trim());
  return {
    city: parts[0] || "TBD",
    state: parts[1] || "",
  };
}

function mapStatus(status: any): LoadStatus {
  const value = normalize(status);
  if (["available", "open", "posted"].includes(value)) return "OPEN";
  if (["accepted", "assigned", "booked"].includes(value)) return "BOOKED";
  if (["picked_up", "arrived_pickup", "loaded"].includes(value)) return "PICKED_UP";
  if (["in_transit", "arrived_dropoff", "en_route"].includes(value)) return "IN_TRANSIT";
  if (["delivered", "completed"].includes(value)) return "DELIVERED";
  if (["cancelled", "canceled"].includes(value)) return "CANCELLED";
  return "OPEN";
}

function toDbStatus(status: LoadStatus) {
  if (status === "OPEN") return "available";
  if (status === "BOOKED") return "accepted";
  if (status === "PICKED_UP") return "picked_up";
  if (status === "IN_TRANSIT") return "in_transit";
  if (status === "DELIVERED") return "delivered";
  return "cancelled";
}

function mapLoad(row: any): FreightLoad {
  const pickupRaw = row.pickup_location || row.pickup_address || row.origin || "";
  const dropoffRaw =
    row.dropoff_location || row.delivery_location || row.dropoff_address || row.destination || "";
  const pickup = splitCityState(pickupRaw);
  const dropoff = splitCityState(dropoffRaw);

  return {
    id: String(row.id),
    title: row.title || row.load_title || row.commodity || "Farm Freight Load",
    commodity: row.commodity || row.product_name || row.cargo_type || "Farm Freight",
    pickupCity: pickup.city,
    pickupState: pickup.state,
    deliveryCity: dropoff.city,
    deliveryState: dropoff.state,
    pickupLocation: pickupRaw || "Pickup TBD",
    deliveryLocation: dropoffRaw || "Delivery TBD",
    farmerName: row.farmer_name || row.farm_name || "Farm2Home Farmer",
    brokerName: row.broker_name || row.farmer_name || row.farm_name || "Farm2Home Broker",
    rate: Number(row.rate || row.freight_total || row.total_due || row.payout_amount || row.carrier_rate || 0),
    miles: Number(row.distance_miles || row.miles || row.route_miles || 0),
    weight: row.weight_lbs ? `${Number(row.weight_lbs).toLocaleString()} lbs` : row.weight || "TBD",
    equipment: row.equipment_type || row.equipment || "Box Truck / Reefer / Flatbed",
    pickupDate:
      row.pickup_date && row.pickup_time
        ? `${row.pickup_date} · ${row.pickup_time}`
        : row.pickup_date || row.pickupDate || "TBD",
    status: mapStatus(row.status),
    created_at: row.created_at || null,
  };
}

function makeCarrierStatus(row: any, stored?: any, subscription?: any): CarrierStatus {
  const id = clean(row?.id || row?.freight_id || row?.auth_user_id || stored?.id || stored?.freightId || subscription?.freight_id || "");
  const companyName =
    clean(row?.company_name || row?.business_name || stored?.companyName || stored?.businessName || subscription?.name) ||
    "Farm2Home Freight Carrier";

  const stripeCustomerId = pickCus(
    row?.stripe_customer_id,
    stored?.stripeCustomerId,
    stored?.stripe_customer_id,
    subscription?.stripe_customer_id
  );

  const stripeSubscriptionId = pickSub(
    row?.stripe_subscription_id,
    row?.subscription_id,
    stored?.stripeSubscriptionId,
    stored?.stripe_subscription_id,
    stored?.subscriptionId,
    stored?.subscription_id,
    subscription?.stripe_subscription_id,
    subscription?.subscription_id
  );

  const stripeAccountId = pickAcct(
    row?.freight_account,
    row?.stripe_account_id,
    stored?.freightAccount,
    stored?.freight_account,
    stored?.stripeAccountId,
    stored?.stripe_account_id,
    subscription?.freight_account,
    subscription?.stripe_account_id
  );

  return {
    id,
    freightId: id,
    accountId: clean(row?.account_id || stored?.accountId || stored?.account_id),
    companyName,
    contactName: clean(row?.contact_name || row?.full_name || row?.name || stored?.contactName || ""),
    email: normalize(row?.email || stored?.email || subscription?.freight_email),
    phone: clean(row?.phone || stored?.phone),
    username: normalize(row?.username || stored?.username || subscription?.username),
    stripeCustomerId,
    stripeSubscriptionId,
    stripeAccountId,
    membershipStatus: clean(
      row?.membership_status || stored?.membershipStatus || stored?.membership_status || (stripeSubscriptionId ? "active" : "pending")
    ),
    subscriptionStatus: clean(
      row?.subscription_status ||
        stored?.subscriptionStatus ||
        stored?.subscription_status ||
        subscription?.subscription_status ||
        (stripeSubscriptionId ? "active" : "pending")
    ),
    connectStatus: clean(
      row?.stripe_connect_status || stored?.stripeConnectStatus || stored?.stripe_connect_status || (stripeAccountId ? "started" : "not_started")
    ),
    payoutsEnabled: Boolean(row?.payouts_enabled || row?.stripe_payouts_enabled || stored?.payoutsEnabled || stored?.payouts_enabled),
    chargesEnabled: Boolean(row?.charges_enabled || row?.stripe_charges_enabled || stored?.chargesEnabled || stored?.charges_enabled),
    onboardingComplete: Boolean(row?.stripe_onboarding_complete || stored?.stripeOnboardingComplete || stored?.stripe_onboarding_complete),
    accountActive: row?.account_active === false ? false : stored?.account_active === false ? false : true,
  };
}

function goTo(route: FreightRoute) {
  router.push(route as any);
}

function openLoad(route: FreightRoute, loadId?: string) {
  if (!loadId) {
    goTo(route);
    return;
  }

  router.push({
    pathname: route as any,
    params: { loadId },
  });
}

export default function FreightDashboard() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [carrier, setCarrier] = useState<CarrierStatus | null>(null);
  const [loads, setLoads] = useState<FreightLoad[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [])
  );

  async function getStoredCarrier() {
    const saved =
      (await AsyncStorage.getItem("currentFreight")) ||
      (await AsyncStorage.getItem("currentFreightCarrier")) ||
      (await AsyncStorage.getItem("currentFreightUser")) ||
      (await AsyncStorage.getItem("currentUser"));

    if (!saved) return null;

    try {
      return JSON.parse(saved);
    } catch {
      return null;
    }
  }

  async function persistCarrier(nextCarrier: CarrierStatus) {
    const sessionUser = {
      ...nextCarrier,
      id: nextCarrier.id,
      freightId: nextCarrier.id,
      freight_id: nextCarrier.id,
      accountId: nextCarrier.accountId,
      account_id: nextCarrier.accountId,
      companyName: nextCarrier.companyName,
      company_name: nextCarrier.companyName,
      businessName: nextCarrier.companyName,
      business_name: nextCarrier.companyName,
      contactName: nextCarrier.contactName,
      contact_name: nextCarrier.contactName,
      stripeCustomerId: nextCarrier.stripeCustomerId,
      stripe_customer_id: nextCarrier.stripeCustomerId,
      stripeSubscriptionId: nextCarrier.stripeSubscriptionId,
      stripe_subscription_id: nextCarrier.stripeSubscriptionId,
      subscriptionId: nextCarrier.stripeSubscriptionId,
      subscription_id: nextCarrier.stripeSubscriptionId,
      freightAccount: nextCarrier.stripeAccountId,
      freight_account: nextCarrier.stripeAccountId,
      stripeAccountId: nextCarrier.stripeAccountId,
      stripe_account_id: nextCarrier.stripeAccountId,
      membershipStatus: nextCarrier.membershipStatus,
      membership_status: nextCarrier.membershipStatus,
      subscriptionStatus: nextCarrier.subscriptionStatus,
      subscription_status: nextCarrier.subscriptionStatus,
      accountActive: nextCarrier.accountActive,
      account_active: nextCarrier.accountActive,
      role: "freight",
      updatedAt: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await AsyncStorage.multiSet([
      ["currentFreight", JSON.stringify(sessionUser)],
      ["currentFreightCarrier", JSON.stringify(sessionUser)],
      ["currentFreightUser", JSON.stringify(sessionUser)],
      ["farm2homeCurrentFreight", JSON.stringify(sessionUser)],
      ["currentUser", JSON.stringify(sessionUser)],
      ["userRole", "freight"],
      ["currentUserRole", "freight"],
    ]);

    setCarrier(nextCarrier);
    return nextCarrier;
  }

  async function findCarrierRow(userId: string, email: string) {
    if (userId) {
      const { data, error } = await supabase
        .from("freight_users")
        .select("*")
        .or(`id.eq.${userId},freight_id.eq.${userId},auth_user_id.eq.${userId},profile_id.eq.${userId}`)
        .maybeSingle();

      if (!error && data) return data;
    }

    if (email) {
      const { data, error } = await supabase
        .from("freight_users")
        .select("*")
        .eq("email", email)
        .maybeSingle();

      if (!error && data) return data;
    }

    return null;
  }

  async function findSubscription(userId: string, email: string) {
    const filters = [
      userId ? `freight_id.eq.${userId}` : "",
      email ? `freight_email.eq.${email}` : "",
    ]
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
      console.log("Freight dashboard subscription lookup error:", error.message);
      return null;
    }

    return Array.isArray(data) && data.length > 0 ? data[0] : null;
  }

  async function syncSubscriptionIntoCarrier(carrierRow: any, subscription: any) {
    if (!carrierRow?.id || !subscription) return carrierRow;

    const updates: any = {};

    if (subscription?.stripe_customer_id && !pickCus(carrierRow?.stripe_customer_id)) {
      updates.stripe_customer_id = subscription.stripe_customer_id;
    }

    if (subscription?.stripe_subscription_id && !pickSub(carrierRow?.stripe_subscription_id, carrierRow?.subscription_id)) {
      updates.stripe_subscription_id = subscription.stripe_subscription_id;
      updates.subscription_id = subscription.stripe_subscription_id;
      updates.subscription_status = subscription.subscription_status || "active";
      updates.membership_status = "active";
      updates.freight_membership_paid = true;
      updates.application_submitted = true;
    }

    const subAcct = pickAcct(subscription?.freight_account, subscription?.stripe_account_id);
    const rowAcct = pickAcct(carrierRow?.freight_account, carrierRow?.stripe_account_id);

    if (subAcct && !rowAcct) {
      updates.freight_account = subAcct;
      updates.stripe_account_id = subAcct;
      updates.stripe_connect_status = "started";
    }

    if (Object.keys(updates).length === 0) return carrierRow;

    const { data, error } = await supabase
      .from("freight_users")
      .update({
        ...updates,
        account_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", carrierRow.id)
      .select()
      .maybeSingle();

    if (error) {
      console.log("Freight dashboard subscription sync error:", error.message);
      return { ...carrierRow, ...updates };
    }

    return data || { ...carrierRow, ...updates };
  }

  async function loadDashboard() {
    try {
      setLoading(true);

      const stored = await getStoredCarrier();
      const { data: authData } = await supabase.auth.getUser();
      const authId = authData?.user?.id || stored?.id || stored?.freightId || "";
      const email = normalize(stored?.email || authData?.user?.email || "");

      if (!authId && !email) {
        router.replace("/freight/login" as any);
        return;
      }

      let dbCarrier = await findCarrierRow(authId, email);

      if (!dbCarrier) {
        Alert.alert("Freight Profile Missing", "Please complete freight registration first.");
        router.replace("/freight/register" as any);
        return;
      }

      const subscription = await findSubscription(dbCarrier.id || authId, email || normalize(dbCarrier.email));
      dbCarrier = await syncSubscriptionIntoCarrier(dbCarrier, subscription);

      const nextCarrier = await persistCarrier(makeCarrierStatus(dbCarrier, stored, subscription));
      await loadLoads(nextCarrier.id);
    } catch (error: any) {
      console.log("Freight dashboard error:", error);
      Alert.alert("Dashboard Error", error?.message || "Unable to load freight dashboard.");
      setLoads([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function loadLoads(carrierId: string) {
    try {
      const filters = [
        "status.eq.available",
        "status.eq.open",
        `carrier_id.eq.${carrierId}`,
        `freight_user_id.eq.${carrierId}`,
        `driver_id.eq.${carrierId}`,
        `accepted_by.eq.${carrierId}`,
      ].join(",");

      const { data, error } = await supabase
        .from("freight_loads")
        .select("*")
        .or(filters)
        .order("created_at", { ascending: false });

      if (error) {
        console.log("Freight loads error:", error.message);
        setLoads([]);
        return;
      }

      setLoads(Array.isArray(data) ? data.map(mapLoad) : []);
    } catch (error) {
      console.log("Freight load sync skipped:", error);
      setLoads([]);
    }
  }

  async function refreshDashboard() {
    setRefreshing(true);
    await loadDashboard();
  }

  async function logout() {
    await AsyncStorage.multiRemove([
      "currentFreight",
      "currentFreightCarrier",
      "currentFreightUser",
      "farm2homeCurrentFreight",
      "currentUser",
      "userRole",
      "currentUserRole",
    ]);
    await supabase.auth.signOut();
    router.replace("/freight/login" as any);
  }

  async function updateLoadStatus(load: FreightLoad, nextStatus: LoadStatus) {
    if (!carrier?.id) {
      Alert.alert("Carrier Missing", "Please log in again.");
      return;
    }

    const now = new Date().toISOString();
    const payload: any = {
      status: toDbStatus(nextStatus),
      updated_at: now,
    };

    if (nextStatus === "BOOKED") {
      payload.carrier_id = carrier.id;
      payload.freight_user_id = carrier.id;
      payload.accepted_by = carrier.id;
      payload.accepted_at = now;
      payload.carrier_name = carrier.companyName;
      payload.carrier_email = carrier.email || null;
    }

    if (nextStatus === "PICKED_UP") payload.picked_up_at = now;
    if (nextStatus === "IN_TRANSIT") payload.in_transit_at = now;

    if (nextStatus === "DELIVERED") {
      payload.delivered_at = now;
      payload.settlement_status = "pending";
      payload.payout_status = "pending";
    }

    const { error } = await supabase.from("freight_loads").update(payload).eq("id", load.id);

    if (error) {
      Alert.alert("Update Failed", error.message);
      return;
    }

    await supabase.from("freight_notifications").insert({
      freight_user_id: carrier.id,
      freight_id: carrier.id,
      user_id: carrier.id,
      load_id: load.id,
      title:
        nextStatus === "BOOKED"
          ? "Load Booked"
          : nextStatus === "PICKED_UP"
          ? "Pickup Confirmed"
          : nextStatus === "IN_TRANSIT"
          ? "Load In Transit"
          : nextStatus === "DELIVERED"
          ? "Delivery Completed"
          : "Load Updated",
      message: `${load.title} is now ${nextStatus.replace(/_/g, " ")}.`,
      type: "load",
      is_read: false,
      read: false,
      created_at: now,
    });

    await loadLoads(carrier.id);
  }

  async function bookLoad(load: FreightLoad) {
    await updateLoadStatus(load, "BOOKED");

    Alert.alert("Load Booked", `${load.title} has been added to My Booked Loads.`, [
      { text: "View My Loads", onPress: () => goTo(ROUTES.myLoads) },
      { text: "Stay Here", style: "cancel" },
    ]);
  }

  const openLoads = useMemo(() => loads.filter((x) => x.status === "OPEN"), [loads]);
  const bookedLoads = useMemo(() => loads.filter((x) => ["BOOKED", "PICKED_UP", "IN_TRANSIT"].includes(x.status)), [loads]);
  const deliveredLoads = useMemo(() => loads.filter((x) => x.status === "DELIVERED"), [loads]);
  const totalVisibleRevenue = useMemo(() => loads.reduce((sum, item) => sum + Number(item.rate || 0), 0), [loads]);
  const bookedRevenue = useMemo(() => bookedLoads.reduce((sum, item) => sum + Number(item.rate || 0), 0), [bookedLoads]);
  const avgRatePerMile = useMemo(() => {
    const totalMiles = loads.reduce((sum, item) => sum + Number(item.miles || 0), 0);
    if (!totalMiles) return 0;
    return totalVisibleRevenue / totalMiles;
  }, [loads, totalVisibleRevenue]);
  const alertsCount = useMemo(() => loads.filter((x) => x.status === "OPEN" || x.status === "IN_TRANSIT").length, [loads]);

  const setupScore = useMemo(() => {
    let score = 0;
    if (carrier?.accountId) score += 20;
    if (isCus(carrier?.stripeCustomerId)) score += 20;
    if (isSub(carrier?.stripeSubscriptionId)) score += 20;
    if (isAcct(carrier?.stripeAccountId)) score += 20;
    if (carrier?.accountActive) score += 20;
    return score;
  }, [carrier]);

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.centerText}>Loading Farm2Home Freight...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshDashboard} />}
      >
        <View style={styles.shell}>
          <View style={styles.sidebar}>
            <View style={styles.brandRow}>
              <View style={styles.brandIcon}>
                <Ionicons name="trail-sign-outline" size={28} color={COLORS.white} />
              </View>
              <View>
                <Text style={styles.brandTitle}>Farm2Home</Text>
                <Text style={styles.brandSubtitle}>Freight Connect</Text>
              </View>
            </View>

            <View style={styles.sideDivider} />

            <SidebarLink icon="grid-outline" title="Dashboard" active route={ROUTES.dashboard} />
            <SidebarLink icon="search-outline" title="Load Board" route={ROUTES.board} />
            <SidebarLink icon="briefcase-outline" title="My Loads" route={ROUTES.myLoads} />
            <SidebarLink icon="pulse-outline" title="Live Loads" route={ROUTES.liveLoads} />
            <SidebarLink icon="business-outline" title="Connect Bank" route={ROUTES.connectBank} />
            <SidebarLink icon="notifications-outline" title="Notifications" route={ROUTES.notifications} />
            <SidebarLink icon="person-outline" title="Profile" route={ROUTES.profile} />
            <SidebarLink icon="settings-outline" title="Settings" route={ROUTES.settings} />

            <TouchableOpacity style={styles.logoutButton} onPress={logout}>
              <Ionicons name="log-out-outline" size={18} color={COLORS.white} />
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.main}>
            <View style={styles.topPanel}>
              <View style={{ flex: 1 }}>
                <Text style={styles.eyebrow}>Fina Admin Style Command Center</Text>
                <Text style={styles.pageTitle}>Carrier Dashboard</Text>
                <Text style={styles.pageSubtitle}>
                  Manage load board activity, booked freight, route status, payout setup, and carrier account health.
                </Text>
              </View>

              <TouchableOpacity style={styles.alertButton} onPress={() => goTo(ROUTES.notifications)}>
                <Ionicons name="notifications-outline" size={23} color={COLORS.primary} />
                {alertsCount > 0 ? (
                  <View style={styles.alertDot}>
                    <Text style={styles.alertDotText}>{alertsCount}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            </View>

            <View style={styles.carrierPanel}>
              <View style={styles.carrierAvatar}>
                <Ionicons name="business-outline" size={26} color={COLORS.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.carrierName}>{carrier?.companyName || "Farm2Home Freight Carrier"}</Text>
                <Text style={styles.carrierSub}>
                  {carrier?.email || "carrier workspace"} · {carrier?.accountId || "Account ID pending"}
                </Text>
              </View>
              <View style={[styles.readyPill, { backgroundColor: setupScore === 100 ? COLORS.greenSoft : COLORS.amberSoft }]}>
                <Ionicons
                  name={setupScore === 100 ? "checkmark-circle-outline" : "alert-circle-outline"}
                  size={17}
                  color={setupScore === 100 ? COLORS.green : COLORS.amber}
                />
                <Text style={[styles.readyPillText, { color: setupScore === 100 ? COLORS.green : COLORS.amber }]}>
                  {setupScore === 100 ? "Ready" : `${setupScore}%`}
                </Text>
              </View>
            </View>

            <View style={styles.metricGrid}>
              <DashboardMetric icon="cube-outline" label="Available Loads" value={String(openLoads.length)} route={ROUTES.board} />
              <DashboardMetric icon="briefcase-outline" label="Booked Loads" value={String(bookedLoads.length)} route={ROUTES.myLoads} />
              <DashboardMetric icon="cash-outline" label="Board Value" value={money(totalVisibleRevenue)} route={ROUTES.rateOptimizer} />
              <DashboardMetric icon="trending-up-outline" label="Avg Rate / Mile" value={`${money(avgRatePerMile)}/mi`} route={ROUTES.rateOptimizer} />
            </View>

            <View style={styles.gridTwo}>
              <View style={styles.card}>
                <SectionHeader
                  icon="shield-checkmark-outline"
                  title="Account Health"
                  subtitle="Stripe and registration fields synced from freight_users and freight_subscriptions."
                />

                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${setupScore}%` }]} />
                </View>

                <View style={styles.statusGrid}>
                  <StatusRow label="Freight ID" value={shortId(carrier?.freightId)} ready={Boolean(carrier?.freightId)} />
                  <StatusRow label="Account ID" value={carrier?.accountId || "Missing"} ready={Boolean(carrier?.accountId)} />
                  <StatusRow label="Customer" value={shortId(carrier?.stripeCustomerId)} ready={isCus(carrier?.stripeCustomerId)} />
                  <StatusRow label="Subscription" value={shortId(carrier?.stripeSubscriptionId)} ready={isSub(carrier?.stripeSubscriptionId)} />
                  <StatusRow label="Connect" value={shortId(carrier?.stripeAccountId)} ready={isAcct(carrier?.stripeAccountId)} />
                  <StatusRow
                    label="Payouts"
                    value={carrier?.payoutsEnabled ? "Enabled" : carrier?.connectStatus || "Pending"}
                    ready={Boolean(carrier?.payoutsEnabled || carrier?.onboardingComplete)}
                  />
                </View>

                <TouchableOpacity style={styles.primaryButton} onPress={() => goTo(ROUTES.connectBank)}>
                  <Ionicons name="business-outline" size={18} color={COLORS.white} />
                  <Text style={styles.primaryButtonText}>Manage Connect Bank</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.card}>
                <SectionHeader
                  icon="analytics-outline"
                  title="Revenue Snapshot"
                  subtitle="Visible load board value and booked freight value."
                />

                <View style={styles.revenueBox}>
                  <Text style={styles.revenueLabel}>Board Value</Text>
                  <Text style={styles.revenueValue}>{money(totalVisibleRevenue)}</Text>
                  <Text style={styles.revenueSub}>Booked freight value: {money(bookedRevenue)}</Text>
                </View>

                <TouchableOpacity style={styles.secondaryButton} onPress={() => goTo(ROUTES.rateOptimizer)}>
                  <Ionicons name="trending-up-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.secondaryButtonText}>Open Rate Optimizer</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.card}>
              <SectionHeader
                icon="apps-outline"
                title="Carrier Tools"
                subtitle="Quick access to core freight operations."
              />

              <View style={styles.toolGrid}>
                <ToolCard title="Available Loads" icon="cube-outline" route={ROUTES.board} />
                <ToolCard title="My Loads" icon="briefcase-outline" route={ROUTES.myLoads} />
                <ToolCard title="Live Loads" icon="pulse-outline" route={ROUTES.liveLoads} />
                <ToolCard title="Rate Optimizer" icon="trending-up-outline" route={ROUTES.rateOptimizer} />
                <ToolCard title="Connect Bank" icon="business-outline" route={ROUTES.connectBank} />
                <ToolCard title="Notifications" icon="notifications-outline" route={ROUTES.notifications} />
                <ToolCard title="Profile" icon="person-outline" route={ROUTES.profile} />
                <ToolCard title="Support" icon="headset-outline" route={ROUTES.support} />
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.listHeader}>
                <SectionHeader
                  icon="list-outline"
                  title="Load Board Preview"
                  subtitle="Open and active freight opportunities."
                />

                <TouchableOpacity style={styles.refreshButton} onPress={refreshDashboard}>
                  <Ionicons name="refresh-outline" size={17} color={COLORS.primary} />
                  <Text style={styles.refreshText}>Refresh</Text>
                </TouchableOpacity>
              </View>

              <FlatList
                data={loads}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                  <View style={styles.emptyCard}>
                    <Ionicons name="cube-outline" size={42} color={COLORS.primary} />
                    <Text style={styles.emptyTitle}>No farm freight loads found</Text>
                    <Text style={styles.emptyText}>
                      Refresh the board or open Live Loads to check for farm, livestock, produce, hay, and refrigerated freight opportunities.
                    </Text>
                    <TouchableOpacity style={styles.primaryButton} onPress={() => goTo(ROUTES.board)}>
                      <Text style={styles.primaryButtonText}>Open Load Board</Text>
                    </TouchableOpacity>
                  </View>
                }
                renderItem={({ item }) => (
                  <LoadCard
                    load={item}
                    onBook={() => bookLoad(item)}
                    onPickup={() => updateLoadStatus(item, "PICKED_UP")}
                    onTransit={() => updateLoadStatus(item, "IN_TRANSIT")}
                    onDelivered={() => updateLoadStatus(item, "DELIVERED")}
                  />
                )}
              />
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

function DashboardMetric({
  icon,
  label,
  value,
  route,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  route: FreightRoute;
}) {
  return (
    <TouchableOpacity style={styles.metricCard} onPress={() => goTo(route)}>
      <View style={styles.metricIcon}>
        <Ionicons name={icon} size={21} color={COLORS.primary} />
      </View>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue} numberOfLines={1}>{value}</Text>
    </TouchableOpacity>
  );
}

function StatusRow({ label, value, ready }: { label: string; value: string; ready: boolean }) {
  return (
    <View style={styles.statusRow}>
      <View style={[styles.statusIcon, ready ? styles.statusGood : styles.statusWarn]}>
        <Ionicons
          name={ready ? "checkmark-outline" : "alert-circle-outline"}
          size={16}
          color={ready ? COLORS.white : COLORS.amber}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.statusLabel}>{label}</Text>
        <Text style={styles.statusValue} numberOfLines={1}>{value}</Text>
      </View>
    </View>
  );
}

function ToolCard({ title, icon, route }: { title: string; icon: keyof typeof Ionicons.glyphMap; route: FreightRoute }) {
  return (
    <TouchableOpacity style={styles.toolCard} onPress={() => goTo(route)}>
      <View style={styles.toolIcon}>
        <Ionicons name={icon} size={22} color={COLORS.primary} />
      </View>
      <Text style={styles.toolTitle}>{title}</Text>
    </TouchableOpacity>
  );
}

function statusColor(status: LoadStatus) {
  if (status === "OPEN") return COLORS.blue;
  if (status === "BOOKED") return COLORS.primary;
  if (status === "PICKED_UP") return COLORS.amber;
  if (status === "IN_TRANSIT") return COLORS.purple;
  if (status === "DELIVERED") return COLORS.green;
  return COLORS.muted;
}

function LoadCard({
  load,
  onBook,
  onPickup,
  onTransit,
  onDelivered,
}: {
  load: FreightLoad;
  onBook: () => void;
  onPickup: () => void;
  onTransit: () => void;
  onDelivered: () => void;
}) {
  const ratePerMile = load.miles > 0 ? load.rate / load.miles : 0;

  return (
    <View style={styles.loadCard}>
      <View style={styles.loadTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.loadTitle}>{load.title}</Text>
          <Text style={styles.loadSub}>{load.commodity}</Text>
        </View>

        <View style={[styles.statusBadge, { backgroundColor: statusColor(load.status) }]}>
          <Text style={styles.statusText}>{load.status.replace(/_/g, " ")}</Text>
        </View>
      </View>

      <View style={styles.routeCard}>
        <View style={styles.routePoint}>
          <Ionicons name="radio-button-on-outline" size={18} color={COLORS.green} />
          <View style={{ flex: 1 }}>
            <Text style={styles.routeLabel}>Pickup</Text>
            <Text style={styles.routeValue}>{load.pickupCity}, {load.pickupState}</Text>
            <Text style={styles.routeSmall}>{load.pickupLocation}</Text>
          </View>
        </View>

        <View style={styles.routeLine} />

        <View style={styles.routePoint}>
          <Ionicons name="location-outline" size={18} color={COLORS.red} />
          <View style={{ flex: 1 }}>
            <Text style={styles.routeLabel}>Delivery</Text>
            <Text style={styles.routeValue}>{load.deliveryCity}, {load.deliveryState}</Text>
            <Text style={styles.routeSmall}>{load.deliveryLocation}</Text>
          </View>
        </View>
      </View>

      <View style={styles.infoGrid}>
        <InfoBox icon="calendar-outline" label="Pickup" value={load.pickupDate} />
        <InfoBox icon="car-outline" label="Equipment" value={load.equipment} />
        <InfoBox icon="scale-outline" label="Weight" value={load.weight} />
        <InfoBox icon="people-outline" label="Broker / Farmer" value={load.brokerName} />
      </View>

      <View style={styles.ratePanel}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rateLabel}>Carrier Rate</Text>
          <Text style={styles.rateValue}>{money(load.rate)}</Text>
          <Text style={styles.rateSmall}>{load.miles || 0} miles · {money(ratePerMile)} / mile</Text>
        </View>

        <View style={styles.loadActions}>
          {load.status === "OPEN" ? (
            <TouchableOpacity style={styles.primaryAction} onPress={onBook}>
              <Ionicons name="checkmark-circle-outline" size={18} color={COLORS.white} />
              <Text style={styles.primaryActionText}>Book Load</Text>
            </TouchableOpacity>
          ) : null}

          {load.status === "BOOKED" ? (
            <TouchableOpacity style={styles.warningAction} onPress={onPickup}>
              <Ionicons name="archive-outline" size={18} color={COLORS.white} />
              <Text style={styles.primaryActionText}>Confirm Pickup</Text>
            </TouchableOpacity>
          ) : null}

          {load.status === "PICKED_UP" ? (
            <TouchableOpacity style={styles.transitAction} onPress={onTransit}>
              <Ionicons name="navigate-outline" size={18} color={COLORS.white} />
              <Text style={styles.primaryActionText}>Start Transit</Text>
            </TouchableOpacity>
          ) : null}

          {load.status === "IN_TRANSIT" ? (
            <TouchableOpacity style={styles.successAction} onPress={onDelivered}>
              <Ionicons name="checkmark-done-outline" size={18} color={COLORS.white} />
              <Text style={styles.primaryActionText}>Complete</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity style={styles.secondaryAction} onPress={() => openLoad(ROUTES.loadDetail, load.id)}>
            <Ionicons name="document-text-outline" size={18} color={COLORS.primary} />
            <Text style={styles.secondaryActionText}>Details</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function InfoBox({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.infoBox}>
      <Ionicons name={icon} size={16} color={COLORS.primary} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || "TBD"}</Text>
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
  scrollContent: { flexGrow: 1, paddingBottom: 40 },
  shell: {
    flex: 1,
    flexDirection: Platform.OS === "web" ? "row" : "column",
    minHeight: Platform.OS === "web" ? 840 : undefined,
  },
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
  logoutButton: {
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1E293B",
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },
  logoutText: { color: COLORS.white, fontWeight: "900" },
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
  alertButton: {
    width: 50,
    height: 50,
    borderRadius: 18,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  alertDot: {
    position: "absolute",
    right: -4,
    top: -4,
    backgroundColor: COLORS.red,
    borderRadius: 999,
    minWidth: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  alertDotText: { color: COLORS.white, fontWeight: "900", fontSize: 11 },
  carrierPanel: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    gap: 13,
    alignItems: "center",
    marginBottom: 14,
  },
  carrierAvatar: {
    width: 58,
    height: 58,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  carrierName: { color: COLORS.text, fontSize: 20, fontWeight: "900" },
  carrierSub: { color: COLORS.muted, fontWeight: "700", marginTop: 4 },
  readyPill: {
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 8,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  readyPillText: { fontWeight: "900", fontSize: 12 },
  metricGrid: {
    flexDirection: Platform.OS === "web" ? "row" : "column",
    gap: 12,
    marginBottom: 14,
  },
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
  metricValue: { color: COLORS.text, fontWeight: "900", fontSize: 23, marginTop: 5 },
  gridTwo: {
    flexDirection: Platform.OS === "web" ? "row" : "column",
    gap: 14,
    alignItems: "flex-start",
  },
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
  progressTrack: { height: 10, borderRadius: 999, backgroundColor: "#E5E7EB", overflow: "hidden", marginBottom: 14 },
  progressFill: { height: 10, borderRadius: 999, backgroundColor: COLORS.primary },
  statusGrid: { gap: 10 },
  statusRow: {
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  statusIcon: { width: 32, height: 32, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  statusGood: { backgroundColor: COLORS.green },
  statusWarn: { backgroundColor: COLORS.amberSoft },
  statusLabel: { color: COLORS.text, fontWeight: "900" },
  statusValue: { color: COLORS.muted, fontWeight: "700", marginTop: 2 },
  primaryButton: {
    backgroundColor: COLORS.primary,
    padding: 15,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
    width: "100%",
  },
  primaryButtonText: { color: COLORS.white, fontWeight: "900", textAlign: "center", flexShrink: 1 },
  secondaryButton: {
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    padding: 15,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
    width: "100%",
  },
  secondaryButtonText: { color: COLORS.primary, fontWeight: "900", textAlign: "center", flexShrink: 1 },
  revenueBox: { backgroundColor: COLORS.navy, borderRadius: 20, padding: 18 },
  revenueLabel: { color: "#A5B4FC", fontWeight: "900", textTransform: "uppercase", fontSize: 12 },
  revenueValue: { color: COLORS.white, fontSize: 34, fontWeight: "900", marginTop: 5 },
  revenueSub: { color: "#CBD5E1", fontWeight: "800", marginTop: 5 },
  toolGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  toolCard: {
    width: Platform.OS === "web" ? "23.5%" : "48%",
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 15,
    minHeight: 104,
    justifyContent: "space-between",
  },
  toolIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  toolTitle: { color: COLORS.text, fontWeight: "900", fontSize: 14, lineHeight: 19 },
  listHeader: {
    flexDirection: Platform.OS === "web" ? "row" : "column",
    justifyContent: "space-between",
    gap: 10,
  },
  refreshButton: {
    alignSelf: Platform.OS === "web" ? "flex-start" : "stretch",
    backgroundColor: COLORS.primarySoft,
    borderColor: "#C7D2FE",
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  refreshText: { color: COLORS.primary, fontWeight: "900" },
  listContent: { paddingBottom: 10 },
  loadCard: {
    backgroundColor: COLORS.white,
    marginBottom: 16,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 5,
    borderLeftColor: COLORS.primary,
  },
  loadTop: { flexDirection: "row", gap: 12, marginBottom: 14 },
  loadTitle: { color: COLORS.text, fontSize: 20, fontWeight: "900" },
  loadSub: { color: COLORS.muted, fontWeight: "800", marginTop: 4 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, alignSelf: "flex-start" },
  statusText: { color: COLORS.white, fontSize: 11, fontWeight: "900" },
  routeCard: {
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 14,
    marginBottom: 13,
  },
  routePoint: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  routeLine: { width: 1, height: 18, backgroundColor: COLORS.border, marginLeft: 8, marginVertical: 4 },
  routeLabel: { color: COLORS.muted, fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  routeValue: { color: COLORS.text, fontWeight: "900", fontSize: 15, marginTop: 2 },
  routeSmall: { color: COLORS.muted, fontWeight: "700", marginTop: 2, lineHeight: 18 },
  infoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  infoBox: {
    width: Platform.OS === "web" ? "23.5%" : "48%",
    backgroundColor: COLORS.panel,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
  },
  infoLabel: { color: COLORS.muted, fontSize: 11, fontWeight: "900", textTransform: "uppercase", marginTop: 6 },
  infoValue: { color: COLORS.text, fontWeight: "800", marginTop: 4, lineHeight: 19 },
  ratePanel: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: 16,
    paddingTop: 16,
    flexDirection: Platform.OS === "web" ? "row" : "column",
    gap: 12,
    alignItems: Platform.OS === "web" ? "center" : "stretch",
  },
  rateLabel: { color: COLORS.muted, fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  rateValue: { color: COLORS.primary, fontSize: 30, fontWeight: "900", marginTop: 4 },
  rateSmall: { color: COLORS.muted, fontWeight: "800", marginTop: 3 },
  loadActions: { minWidth: 145, gap: 8 },
  primaryAction: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 13,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  warningAction: {
    backgroundColor: COLORS.amber,
    paddingHorizontal: 13,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  transitAction: {
    backgroundColor: COLORS.purple,
    paddingHorizontal: 13,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  successAction: {
    backgroundColor: COLORS.green,
    paddingHorizontal: 13,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  primaryActionText: { color: COLORS.white, fontWeight: "900" },
  secondaryAction: {
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    paddingHorizontal: 13,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  secondaryActionText: { color: COLORS.primary, fontWeight: "900" },
  emptyCard: {
    backgroundColor: COLORS.panel,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 24,
    alignItems: "center",
  },
  emptyTitle: { color: COLORS.text, fontSize: 20, fontWeight: "900", marginTop: 10 },
  emptyText: { color: COLORS.muted, fontWeight: "700", textAlign: "center", marginTop: 8, lineHeight: 22 },
});
