// app/freight/dashboard.tsx

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
  bg: "#F3F4F6",
  card: "#FFFFFF",
  surface: "#F9FAFB",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  black: "#050505",
  red: "#D71920",
  redDark: "#991B1B",
  green: "#16A34A",
  blue: "#2563EB",
  amber: "#D97706",
  purple: "#7C3AED",
  slate: "#475569",
};

function clean(value: any) {
  return String(value || "").trim();
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
  const found = values.find(isCus);
  return found ? clean(found) : "";
}

function pickSub(...values: any[]) {
  const found = values.find(isSub);
  return found ? clean(found) : "";
}

function pickAcct(...values: any[]) {
  const found = values.find(isAcct);
  return found ? clean(found) : "";
}

function money(value: number) {
  return `$${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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
  const dropoffRaw = row.dropoff_location || row.delivery_location || row.dropoff_address || row.destination || "";
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
    weight: row.weight_lbs
      ? `${Number(row.weight_lbs).toLocaleString()} lbs`
      : row.weight || "TBD",
    equipment: row.equipment_type || row.equipment || "Box Truck / Reefer / Flatbed",
    pickupDate:
      row.pickup_date && row.pickup_time
        ? `${row.pickup_date} · ${row.pickup_time}`
        : row.pickup_date || row.pickupDate || "TBD",
    status: mapStatus(row.status),
    created_at: row.created_at || null,
  };
}

function makeCarrierStatus(row: any, stored?: any): CarrierStatus {
  const id = clean(row?.id || row?.freight_id || row?.auth_user_id || stored?.id || stored?.freightId || "");
  const companyName =
    clean(row?.company_name || row?.business_name || stored?.companyName || stored?.businessName) ||
    "Farm2Home Freight Carrier";
  const contactName = clean(row?.contact_name || row?.full_name || row?.name || stored?.contactName || "");
  const stripeCustomerId = pickCus(row?.stripe_customer_id, stored?.stripeCustomerId, stored?.stripe_customer_id);
  const stripeSubscriptionId = pickSub(
    row?.stripe_subscription_id,
    row?.subscription_id,
    stored?.stripeSubscriptionId,
    stored?.stripe_subscription_id,
    stored?.subscriptionId,
    stored?.subscription_id
  );
  const stripeAccountId = pickAcct(
    row?.freight_account,
    row?.stripe_account_id,
    stored?.freightAccount,
    stored?.freight_account,
    stored?.stripeAccountId,
    stored?.stripe_account_id
  );

  return {
    id,
    freightId: id,
    accountId: clean(row?.account_id || stored?.accountId || stored?.account_id),
    companyName,
    contactName,
    email: normalize(row?.email || stored?.email),
    phone: clean(row?.phone || stored?.phone),
    username: normalize(row?.username || stored?.username),
    stripeCustomerId,
    stripeSubscriptionId,
    stripeAccountId,
    membershipStatus: clean(row?.membership_status || stored?.membershipStatus || stored?.membership_status || (stripeSubscriptionId ? "active" : "pending")),
    subscriptionStatus: clean(row?.subscription_status || stored?.subscriptionStatus || stored?.subscription_status || (stripeSubscriptionId ? "active" : "pending")),
    connectStatus: clean(row?.stripe_connect_status || stored?.stripeConnectStatus || stored?.stripe_connect_status || (stripeAccountId ? "started" : "not_started")),
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

    await AsyncStorage.setItem("currentFreight", JSON.stringify(sessionUser));
    await AsyncStorage.setItem("currentFreightCarrier", JSON.stringify(sessionUser));
    await AsyncStorage.setItem("currentFreightUser", JSON.stringify(sessionUser));
    await AsyncStorage.setItem("farm2homeCurrentFreight", JSON.stringify(sessionUser));
    await AsyncStorage.setItem("currentUser", JSON.stringify(sessionUser));
    await AsyncStorage.setItem("userRole", "freight");
    await AsyncStorage.setItem("currentUserRole", "freight");

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

      const dbCarrier = await findCarrierRow(authId, email);

      if (!dbCarrier) {
        Alert.alert("Freight Profile Missing", "Please complete freight registration first.");
        router.replace("/freight/register" as any);
        return;
      }

      const nextCarrier = await persistCarrier(makeCarrierStatus(dbCarrier, stored));
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
  const bookedLoads = useMemo(
    () => loads.filter((x) => ["BOOKED", "PICKED_UP", "IN_TRANSIT"].includes(x.status)),
    [loads]
  );
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
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <ActivityIndicator size="large" color={COLORS.red} />
        <Text style={styles.centerText}>Loading Farm2Home Freight...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshDashboard} />}
      >
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroEyebrow}>Farm2Home Freight Connect</Text>
              <Text style={styles.heroTitle}>Carrier Dashboard</Text>
              <Text style={styles.heroSubtitle}>
                Manage available loads, booked freight, route details, Stripe payout setup, rate
                optimization, and carrier profile status from one command center.
              </Text>
            </View>

            <TouchableOpacity style={styles.alertButton} onPress={() => goTo(ROUTES.notifications)}>
              <Ionicons name="notifications-outline" size={26} color="#FFFFFF" />
              {alertsCount > 0 ? (
                <View style={styles.alertDot}>
                  <Text style={styles.alertDotText}>{alertsCount}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          </View>

          <View style={styles.carrierCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.carrierLabel}>Carrier Account</Text>
              <Text style={styles.carrierName}>{carrier?.companyName || "Farm2Home Freight Carrier"}</Text>
              <Text style={styles.carrierSub}>
                {carrier?.email || "Freight carrier workspace"} · {carrier?.accountId || "Account ID pending"}
              </Text>
            </View>
            <TouchableOpacity style={styles.logoutButton} onPress={logout}>
              <Ionicons name="log-out-outline" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.setupCard}>
          <View style={styles.setupTop}>
            <View>
              <Text style={styles.setupLabel}>Profile Setup</Text>
              <Text style={styles.setupValue}>{setupScore}% Complete</Text>
            </View>
            <TouchableOpacity style={styles.setupButton} onPress={() => goTo(ROUTES.profile)}>
              <Text style={styles.setupButtonText}>Profile</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${setupScore}%` }]} />
          </View>
        </View>

        <View style={styles.statusGrid}>
          <StatusCard label="Freight ID" value={carrier?.freightId || "Missing"} ready={Boolean(carrier?.freightId)} />
          <StatusCard label="Account ID" value={carrier?.accountId || "Missing"} ready={Boolean(carrier?.accountId)} />
          <StatusCard label="Stripe Customer" value={carrier?.stripeCustomerId || "Missing"} ready={isCus(carrier?.stripeCustomerId)} />
          <StatusCard label="Subscription" value={carrier?.stripeSubscriptionId || "Missing"} ready={isSub(carrier?.stripeSubscriptionId)} />
          <StatusCard label="Connect Account" value={carrier?.stripeAccountId || "Missing"} ready={isAcct(carrier?.stripeAccountId)} />
          <StatusCard label="Payouts" value={carrier?.payoutsEnabled ? "Enabled" : carrier?.connectStatus || "Pending"} ready={Boolean(carrier?.payoutsEnabled || carrier?.onboardingComplete)} />
        </View>

        <View style={styles.primaryNav}>
          <NavButton title="Load Board" icon="search-outline" route={ROUTES.board} filled />
          <NavButton title="My Loads" icon="briefcase-outline" route={ROUTES.myLoads} />
        </View>

        <View style={styles.metricsRow}>
          <MetricCard icon="cube-outline" label="Available Loads" value={openLoads.length} route={ROUTES.board} />
          <MetricCard icon="briefcase-outline" label="Booked Loads" value={bookedLoads.length} route={ROUTES.myLoads} />
          <MetricCard icon="checkmark-done-outline" label="Delivered" value={deliveredLoads.length} route={ROUTES.myLoads} />
        </View>

        <View style={styles.revenueCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.revenueLabel}>Board Value</Text>
            <Text style={styles.revenueValue}>{money(totalVisibleRevenue)}</Text>
            <Text style={styles.revenueSub}>
              Booked value {money(bookedRevenue)} · Avg {money(avgRatePerMile)} / mi
            </Text>
          </View>

          <TouchableOpacity style={styles.revenueButton} onPress={() => goTo(ROUTES.rateOptimizer)}>
            <Ionicons name="trending-up-outline" size={18} color="#FFFFFF" />
            <Text style={styles.revenueButtonText}>Optimize</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Carrier Tools</Text>

        <View style={styles.toolGrid}>
          <ToolCard title="Available Loads" icon="cube-outline" route={ROUTES.board} />
          <ToolCard title="My Booked Loads" icon="briefcase-outline" route={ROUTES.myLoads} />
          <ToolCard title="Live Load Board" icon="pulse-outline" route={ROUTES.liveLoads} />
          <ToolCard title="Rate Optimizer" icon="trending-up-outline" route={ROUTES.rateOptimizer} />
          <ToolCard title="Route Details" icon="map-outline" route={ROUTES.loadDetail} />
          <ToolCard title="Payment Tracking" icon="receipt-outline" route={ROUTES.paymentSuccess} />
          <ToolCard title="Connect Bank / Payouts" icon="business-outline" route={ROUTES.connectBank} />
          <ToolCard title="Broker / Farmer Details" icon="people-outline" route={ROUTES.loadDetail} />
          <ToolCard title="Alerts" icon="notifications-outline" route={ROUTES.notifications} />
          <ToolCard title="Carrier Profile" icon="person-outline" route={ROUTES.profile} />
          <ToolCard title="Settings" icon="settings-outline" route={ROUTES.settings} />
          <ToolCard title="Support" icon="headset-outline" route={ROUTES.support} />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitleNoPad}>Truckstop-Style Load Board</Text>

          <TouchableOpacity style={styles.refreshButton} onPress={refreshDashboard}>
            <Ionicons name="refresh-outline" size={17} color={COLORS.red} />
            <Text style={styles.refreshText}>Refresh</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={loads}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <LoadCard
              load={item}
              onBook={() => bookLoad(item)}
              onPickup={() => updateLoadStatus(item, "PICKED_UP")}
              onTransit={() => updateLoadStatus(item, "IN_TRANSIT")}
              onDelivered={() => updateLoadStatus(item, "DELIVERED")}
            />
          )}
          scrollEnabled={false}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Ionicons name="cube-outline" size={42} color={COLORS.red} />
              <Text style={styles.emptyTitle}>No farm freight loads found</Text>
              <Text style={styles.emptyText}>
                Refresh the board or open Live Loads to check for farm, livestock, produce, hay,
                and refrigerated freight opportunities.
              </Text>
            </View>
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function NavButton({
  title,
  icon,
  route,
  filled,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: FreightRoute;
  filled?: boolean;
}) {
  return (
    <TouchableOpacity style={filled ? styles.navFilled : styles.navOutline} onPress={() => goTo(route)}>
      <Ionicons name={icon} size={18} color={filled ? "#FFFFFF" : COLORS.red} />
      <Text style={filled ? styles.navFilledText : styles.navOutlineText}>{title}</Text>
    </TouchableOpacity>
  );
}

function StatusCard({ label, value, ready }: { label: string; value: string; ready: boolean }) {
  return (
    <View style={styles.statusCardMini}>
      <View style={[styles.statusIconMini, { backgroundColor: ready ? "#DCFCE7" : "#FEF3C7" }]}>
        <Ionicons name={ready ? "checkmark-circle-outline" : "alert-circle-outline"} size={18} color={ready ? COLORS.green : COLORS.amber} />
      </View>
      <Text style={styles.statusLabelMini}>{label}</Text>
      <Text style={styles.statusValueMini} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function MetricCard({ icon, label, value, route }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: number; route: FreightRoute }) {
  return (
    <TouchableOpacity style={styles.metricCard} onPress={() => goTo(route)}>
      <Ionicons name={icon} size={24} color={COLORS.red} />
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function ToolCard({ title, icon, route }: { title: string; icon: keyof typeof Ionicons.glyphMap; route: FreightRoute }) {
  return (
    <TouchableOpacity style={styles.toolCard} onPress={() => goTo(route)}>
      <View style={styles.toolIcon}>
        <Ionicons name={icon} size={22} color={COLORS.red} />
      </View>
      <Text style={styles.toolTitle}>{title}</Text>
    </TouchableOpacity>
  );
}

function statusColor(status: LoadStatus) {
  if (status === "OPEN") return COLORS.blue;
  if (status === "BOOKED") return COLORS.red;
  if (status === "PICKED_UP") return COLORS.amber;
  if (status === "IN_TRANSIT") return COLORS.purple;
  if (status === "DELIVERED") return COLORS.green;
  return COLORS.slate;
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
              <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
              <Text style={styles.primaryActionText}>Book Load</Text>
            </TouchableOpacity>
          ) : null}

          {load.status === "BOOKED" ? (
            <TouchableOpacity style={styles.warningAction} onPress={onPickup}>
              <Ionicons name="archive-outline" size={18} color="#FFFFFF" />
              <Text style={styles.primaryActionText}>Confirm Pickup</Text>
            </TouchableOpacity>
          ) : null}

          {load.status === "PICKED_UP" ? (
            <TouchableOpacity style={styles.transitAction} onPress={onTransit}>
              <Ionicons name="navigate-outline" size={18} color="#FFFFFF" />
              <Text style={styles.primaryActionText}>Start Transit</Text>
            </TouchableOpacity>
          ) : null}

          {load.status === "IN_TRANSIT" ? (
            <TouchableOpacity style={styles.successAction} onPress={onDelivered}>
              <Ionicons name="checkmark-done-outline" size={18} color="#FFFFFF" />
              <Text style={styles.primaryActionText}>Complete</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity style={styles.secondaryAction} onPress={() => openLoad(ROUTES.loadDetail, load.id)}>
            <Ionicons name="document-text-outline" size={18} color={COLORS.red} />
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
      <Ionicons name={icon} size={16} color={COLORS.red} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || "TBD"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center", padding: 24 },
  centerText: { color: COLORS.muted, marginTop: 12, fontWeight: "800" },
  hero: { backgroundColor: COLORS.black, paddingTop: 28, paddingBottom: 28, paddingHorizontal: 20 },
  heroTop: { flexDirection: "row", gap: 14, alignItems: "flex-start" },
  heroEyebrow: { color: "#FCA5A5", fontSize: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 },
  heroTitle: { color: "#FFFFFF", fontSize: 34, fontWeight: "900", marginBottom: 10 },
  heroSubtitle: { color: "#D1D5DB", fontSize: 15, lineHeight: 23, fontWeight: "700" },
  alertButton: { width: 58, height: 58, borderRadius: 22, backgroundColor: COLORS.red, alignItems: "center", justifyContent: "center", position: "relative" },
  alertDot: { position: "absolute", right: -4, top: -4, backgroundColor: "#FFFFFF", borderRadius: 999, minWidth: 22, height: 22, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
  alertDotText: { color: COLORS.red, fontWeight: "900", fontSize: 11 },
  carrierCard: { marginTop: 18, borderRadius: 20, padding: 15, backgroundColor: "#111827", borderWidth: 1, borderColor: "#374151", flexDirection: "row", alignItems: "center", gap: 12 },
  carrierLabel: { color: "#FCA5A5", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  carrierName: { color: "#FFFFFF", fontSize: 20, fontWeight: "900", marginTop: 5 },
  carrierSub: { color: "#D1D5DB", fontWeight: "700", marginTop: 4 },
  logoutButton: { backgroundColor: COLORS.red, width: 42, height: 42, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  setupCard: { backgroundColor: COLORS.card, margin: 18, borderRadius: 22, padding: 18, borderWidth: 1, borderColor: COLORS.border },
  setupTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  setupLabel: { color: COLORS.muted, fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  setupValue: { color: COLORS.text, fontSize: 24, fontWeight: "900", marginTop: 4 },
  setupButton: { backgroundColor: COLORS.black, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11 },
  setupButtonText: { color: "#FFFFFF", fontWeight: "900" },
  progressTrack: { height: 10, borderRadius: 999, backgroundColor: "#E5E7EB", overflow: "hidden" },
  progressFill: { height: 10, borderRadius: 999, backgroundColor: COLORS.red },
  statusGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: 18, marginBottom: 4 },
  statusCardMini: { width: "48%", backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 18, padding: 14 },
  statusIconMini: { width: 34, height: 34, borderRadius: 13, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  statusLabelMini: { color: COLORS.muted, fontWeight: "900", fontSize: 11, textTransform: "uppercase" },
  statusValueMini: { color: COLORS.text, fontWeight: "900", marginTop: 4 },
  primaryNav: { flexDirection: "row", gap: 10, padding: 18 },
  navFilled: { flex: 1, backgroundColor: COLORS.red, borderRadius: 15, paddingVertical: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  navOutline: { flex: 1, backgroundColor: COLORS.card, borderColor: COLORS.red, borderWidth: 1, borderRadius: 15, paddingVertical: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  navFilledText: { color: "#FFFFFF", fontWeight: "900" },
  navOutlineText: { color: COLORS.red, fontWeight: "900" },
  metricsRow: { flexDirection: "row", gap: 10, paddingHorizontal: 18, marginBottom: 14 },
  metricCard: { flex: 1, backgroundColor: COLORS.card, borderRadius: 20, padding: 15, alignItems: "center", borderWidth: 1, borderColor: COLORS.border },
  metricValue: { fontSize: 28, fontWeight: "900", color: COLORS.text, marginTop: 7 },
  metricLabel: { color: COLORS.muted, fontWeight: "800", fontSize: 12, textAlign: "center", marginTop: 4 },
  revenueCard: { backgroundColor: COLORS.red, marginHorizontal: 18, borderRadius: 24, padding: 18, marginBottom: 18, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  revenueLabel: { color: "#FFE4E6", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  revenueValue: { color: "#FFFFFF", fontSize: 32, fontWeight: "900", marginTop: 4 },
  revenueSub: { color: "#FFE4E6", fontWeight: "800", marginTop: 4 },
  revenueButton: { backgroundColor: COLORS.black, paddingHorizontal: 14, paddingVertical: 13, borderRadius: 16, flexDirection: "row", gap: 7, alignItems: "center" },
  revenueButtonText: { color: "#FFFFFF", fontWeight: "900" },
  sectionTitle: { fontSize: 23, fontWeight: "900", color: COLORS.text, paddingHorizontal: 18, marginBottom: 12 },
  sectionTitleNoPad: { fontSize: 23, fontWeight: "900", color: COLORS.text, flex: 1 },
  toolGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: 18, marginBottom: 20 },
  toolCard: { width: "48%", backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 18, padding: 15, minHeight: 105, justifyContent: "space-between" },
  toolIcon: { width: 42, height: 42, borderRadius: 15, backgroundColor: "#FEF2F2", alignItems: "center", justifyContent: "center", marginBottom: 10 },
  toolTitle: { color: COLORS.text, fontWeight: "900", fontSize: 14, lineHeight: 19 },
  sectionHeader: { paddingHorizontal: 18, marginBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  refreshButton: { backgroundColor: COLORS.card, borderColor: COLORS.red, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 14, flexDirection: "row", alignItems: "center", gap: 6 },
  refreshText: { color: COLORS.red, fontWeight: "900" },
  listContent: { paddingBottom: 90 },
  loadCard: { backgroundColor: COLORS.card, marginHorizontal: 18, marginBottom: 16, borderRadius: 24, padding: 18, borderWidth: 1, borderColor: COLORS.border, borderLeftWidth: 5, borderLeftColor: COLORS.red },
  loadTop: { flexDirection: "row", gap: 12, marginBottom: 14 },
  loadTitle: { color: COLORS.text, fontSize: 20, fontWeight: "900" },
  loadSub: { color: COLORS.muted, fontWeight: "800", marginTop: 4 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, alignSelf: "flex-start" },
  statusText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },
  routeCard: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 18, padding: 14, marginBottom: 13 },
  routePoint: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  routeLine: { width: 1, height: 18, backgroundColor: COLORS.border, marginLeft: 8, marginVertical: 4 },
  routeLabel: { color: COLORS.muted, fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  routeValue: { color: COLORS.text, fontWeight: "900", fontSize: 15, marginTop: 2 },
  routeSmall: { color: COLORS.muted, fontWeight: "700", marginTop: 2, lineHeight: 18 },
  infoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  infoBox: { width: "48%", backgroundColor: COLORS.surface, borderRadius: 15, borderWidth: 1, borderColor: COLORS.border, padding: 12 },
  infoLabel: { color: COLORS.muted, fontSize: 11, fontWeight: "900", textTransform: "uppercase", marginTop: 6 },
  infoValue: { color: COLORS.text, fontWeight: "800", marginTop: 4, lineHeight: 19 },
  ratePanel: { borderTopWidth: 1, borderTopColor: COLORS.border, marginTop: 16, paddingTop: 16, flexDirection: "row", gap: 12, alignItems: "center" },
  rateLabel: { color: COLORS.muted, fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  rateValue: { color: COLORS.red, fontSize: 30, fontWeight: "900", marginTop: 4 },
  rateSmall: { color: COLORS.muted, fontWeight: "800", marginTop: 3 },
  loadActions: { minWidth: 145, gap: 8 },
  primaryAction: { backgroundColor: COLORS.red, paddingHorizontal: 13, paddingVertical: 13, borderRadius: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7 },
  warningAction: { backgroundColor: COLORS.amber, paddingHorizontal: 13, paddingVertical: 13, borderRadius: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7 },
  transitAction: { backgroundColor: COLORS.purple, paddingHorizontal: 13, paddingVertical: 13, borderRadius: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7 },
  successAction: { backgroundColor: COLORS.green, paddingHorizontal: 13, paddingVertical: 13, borderRadius: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7 },
  primaryActionText: { color: "#FFFFFF", fontWeight: "900" },
  secondaryAction: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.red, paddingHorizontal: 13, paddingVertical: 12, borderRadius: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7 },
  secondaryActionText: { color: COLORS.red, fontWeight: "900" },
  emptyCard: { marginHorizontal: 18, backgroundColor: COLORS.card, borderRadius: 24, borderWidth: 1, borderColor: COLORS.border, padding: 24, alignItems: "center" },
  emptyTitle: { color: COLORS.text, fontSize: 20, fontWeight: "900", marginTop: 10 },
  emptyText: { color: COLORS.muted, fontWeight: "700", textAlign: "center", marginTop: 8, lineHeight: 22 },
});
