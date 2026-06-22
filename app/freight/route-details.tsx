// app/freight/route-details.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../data/supabaseClient";

const FREIGHT_ROUTES = {
  dashboard: "/freight/dashboard",
  board: "/freight/board",
  myLoads: "/freight/my-loads",
  liveLoads: "/freight/live-loads",
  liveRoute: "/freight/live-route",
  tracking: "/freight/tracking",
  loadChat: "/freight/load-chat",
  loadIssues: "/freight/load-issues",
  routeExceptions: "/freight/route-exceptions",
  proofOfPickup: "/freight/proof-of-pickup",
  proofOfDelivery: "/freight/proof-of-delivery",
  support: "/freight/support",
  earnings: "/freight/earnings",
  login: "/freight/login",
  register: "/freight/register",
} as const;

type FreightRoute = (typeof FREIGHT_ROUTES)[keyof typeof FREIGHT_ROUTES];

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
  purple: "#7C3AED",
  teal: "#0F766E",
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
  if (value === "accepted" || value === "booked") return COLORS.primary;
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

  const completedSteps = useMemo(() => timeline.filter((item) => item.value).length, [timeline]);
  const routeProgress = useMemo(() => Math.round((completedSteps / timeline.length) * 100), [completedSteps, timeline.length]);

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
      console.log("Route details subscription lookup error:", error.message);
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

  async function loadRouteDetails() {
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

      if (carrierError) console.log("Route details carrier error:", carrierError.message);

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
      route === FREIGHT_ROUTES.proofOfDelivery ||
      route === FREIGHT_ROUTES.tracking ||
      route === FREIGHT_ROUTES.loadChat ||
      route === FREIGHT_ROUTES.loadIssues ||
      route === FREIGHT_ROUTES.routeExceptions
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
        <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.centerText}>Loading route details...</Text>
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
              <Ionicons name="trail-sign-outline" size={28} color={COLORS.white} />
            </View>
            <View>
              <Text style={styles.brandTitle}>Farm2Home</Text>
              <Text style={styles.brandSubtitle}>Route Details</Text>
            </View>
          </View>

          <View style={styles.sideDivider} />
          <SidebarLink icon="grid-outline" title="Dashboard" route={FREIGHT_ROUTES.dashboard} />
          <SidebarLink icon="search-outline" title="Load Board" route={FREIGHT_ROUTES.board} />
          <SidebarLink icon="briefcase-outline" title="My Loads" route={FREIGHT_ROUTES.myLoads} />
          <SidebarLink icon="pulse-outline" title="Live Loads" route={FREIGHT_ROUTES.liveLoads} />
          <SidebarLink icon="map-outline" title="Live Route" route={FREIGHT_ROUTES.liveRoute} />

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
          <ScrollView
            contentContainerStyle={styles.content}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.topPanel}>
              <View style={{ flex: 1 }}>
                <Text style={styles.eyebrow}>Fina Admin Route Summary</Text>
                <Text style={styles.pageTitle}>Route Details</Text>
                <Text style={styles.pageSubtitle}>
                  Review delivery timeline, proof status, GPS details, chat, exceptions, issues, and freight route information.
                </Text>
              </View>

              <TouchableOpacity style={styles.topIconButton} onPress={() => goTo(FREIGHT_ROUTES.dashboard)}>
                <Ionicons name="grid-outline" size={23} color={COLORS.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.metricGrid}>
              <MetricCard label="Progress" value={`${routeProgress}%`} icon="analytics-outline" />
              <MetricCard label="Payout" value={money(load?.rate || load?.freight_total || load?.total_due)} icon="cash-outline" />
              <MetricCard label="Miles" value={`${Number(load?.distance_miles || load?.miles || 0).toFixed(0)} mi`} icon="speedometer-outline" />
              <MetricCard label="Status" value={statusLabel(load?.status)} icon="flag-outline" />
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
              <QuickAction icon="pulse-outline" label="Tracking" onPress={() => openRoute(FREIGHT_ROUTES.tracking)} />
              <QuickAction icon="chatbubbles-outline" label="Chat" onPress={() => openRoute(FREIGHT_ROUTES.loadChat)} />
              <QuickAction icon="alert-circle-outline" label="Issue" onPress={() => openRoute(FREIGHT_ROUTES.loadIssues)} />
              <QuickAction icon="warning-outline" label="Exception" onPress={() => openRoute(FREIGHT_ROUTES.routeExceptions)} />
              <QuickAction icon="camera-outline" label="Proof Pickup" onPress={() => openRoute(FREIGHT_ROUTES.proofOfPickup)} />
              <QuickAction icon="checkmark-done-outline" label="Proof Delivery" onPress={() => openRoute(FREIGHT_ROUTES.proofOfDelivery)} />
              <QuickAction icon="headset-outline" label="Support" onPress={() => openRoute(FREIGHT_ROUTES.support)} />
            </View>

            <View style={styles.card}>
              <SectionHeader icon="time-outline" title="Route Timeline" subtitle="Milestones captured during freight movement." />

              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${routeProgress}%` }]} />
              </View>

              {timeline.map((item) => (
                <View key={item.label} style={styles.timelineRow}>
                  <View style={[styles.timelineIcon, item.value && styles.timelineIconDone]}>
                    <Ionicons name={item.icon as any} size={18} color={item.value ? COLORS.white : COLORS.primary} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.timelineTitle}>{item.label}</Text>
                    <Text style={styles.timelineDate}>{formatDateTime(item.value)}</Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.gridTwo}>
              <View style={styles.card}>
                <SectionHeader icon="navigate-circle-outline" title="GPS Status" subtitle="Most recent live route coordinates." />
                <InfoRow label="Latitude" value={load?.current_latitude ? Number(load.current_latitude).toFixed(5) : "Not updated"} />
                <InfoRow label="Longitude" value={load?.current_longitude ? Number(load.current_longitude).toFixed(5) : "Not updated"} />
                <InfoRow label="GPS Accuracy" value={load?.gps_accuracy ? `${Number(load.gps_accuracy).toFixed(1)} meters` : "Not updated"} />
                <InfoRow label="Last GPS Update" value={formatDateTime(load?.gps_updated_at)} />
              </View>

              <View style={styles.card}>
                <SectionHeader icon="document-text-outline" title="Proof Status" subtitle="Pickup and delivery proof records." />
                <InfoRow label="Pickup Completed" value={load?.picked_up_at ? "Yes" : "No"} />
                <InfoRow label="Delivery Completed" value={load?.delivered_at ? "Yes" : "No"} />
                <InfoRow label="Receiver" value={load?.delivery_receiver_name || "Not recorded"} />
                <InfoRow label="Product Condition" value={load?.product_condition || "Not recorded"} />
              </View>
            </View>

            <View style={styles.navRow}>
              <TouchableOpacity style={styles.primaryButton} onPress={() => openRoute(FREIGHT_ROUTES.myLoads)}>
                <Ionicons name="briefcase-outline" size={18} color={COLORS.white} />
                <Text style={styles.primaryText}>Back to My Loads</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.darkButton} onPress={() => openRoute(FREIGHT_ROUTES.dashboard)}>
                <Ionicons name="grid-outline" size={18} color={COLORS.white} />
                <Text style={styles.primaryText}>Freight Dashboard</Text>
              </TouchableOpacity>
            </View>
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
      <Ionicons name={icon} size={18} color={label === "Pickup" ? COLORS.green : COLORS.red} />
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
      <View style={styles.quickIcon}>
        <Ionicons name={icon} size={22} color={COLORS.primary} />
      </View>
      <Text style={styles.quickActionText}>{label}</Text>
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
  content: { paddingBottom: 90 },
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
  eyebrow: { color: COLORS.primary, fontWeight: "900", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1, fontSize: 12 },
  pageTitle: { color: COLORS.text, fontSize: 34, fontWeight: "900", marginBottom: 8 },
  pageSubtitle: { color: COLORS.muted, lineHeight: 22, fontWeight: "700", maxWidth: 760 },
  topIconButton: {
    width: 50,
    height: 50,
    borderRadius: 18,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
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
  loadCard: {
    backgroundColor: COLORS.white,
    marginBottom: 14,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 5,
    borderLeftColor: COLORS.primary,
  },
  loadTop: { flexDirection: "row", gap: 12, alignItems: "flex-start", marginBottom: 12 },
  loadTitle: { color: COLORS.text, fontSize: 21, fontWeight: "900" },
  loadSub: { color: COLORS.muted, fontWeight: "700", marginTop: 4 },
  statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  statusText: { color: COLORS.white, fontWeight: "900", fontSize: 12 },
  routeBox: {
    backgroundColor: COLORS.panel,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
  },
  routeStop: { flexDirection: "row", gap: 10, alignItems: "center" },
  routeLine: { width: 2, height: 22, backgroundColor: COLORS.border, marginLeft: 8, marginVertical: 8 },
  routeLabel: { color: COLORS.primary, fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  routeText: { color: COLORS.text, fontWeight: "900", marginTop: 3, lineHeight: 20 },
  infoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  infoBox: {
    width: Platform.OS === "web" ? "23.5%" : "48%",
    backgroundColor: COLORS.panel,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
  },
  infoLabel: { color: COLORS.muted, fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  infoValue: { color: COLORS.text, fontWeight: "900", marginTop: 4 },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 },
  quickAction: {
    width: Platform.OS === "web" ? "23.5%" : "48%",
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 102,
    justifyContent: "space-between",
  },
  quickIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  quickActionText: { color: COLORS.text, fontWeight: "900" },
  gridTwo: { flexDirection: Platform.OS === "web" ? "row" : "column", gap: 14, alignItems: "flex-start" },
  card: {
    flex: 1,
    width: "100%",
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionHeader: { flexDirection: "row", gap: 10, alignItems: "flex-start", marginBottom: 14 },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: { color: COLORS.text, fontSize: 21, fontWeight: "900" },
  sectionSubtitle: { color: COLORS.muted, fontWeight: "700", lineHeight: 20, marginTop: 3 },
  progressTrack: { height: 10, borderRadius: 999, backgroundColor: "#E5E7EB", overflow: "hidden", marginBottom: 14 },
  progressFill: { height: 10, borderRadius: 999, backgroundColor: COLORS.primary },
  timelineRow: {
    backgroundColor: COLORS.panel,
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
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineIconDone: { backgroundColor: COLORS.primary },
  timelineTitle: { color: COLORS.text, fontWeight: "900" },
  timelineDate: { color: COLORS.muted, fontWeight: "700", marginTop: 3 },
  infoRow: {
    backgroundColor: COLORS.panel,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 13,
    marginBottom: 9,
    flexDirection: "row",
    gap: 10,
  },
  infoRowLabel: { color: COLORS.text, fontWeight: "900", flex: 1 },
  infoRowValue: { color: COLORS.primary, fontWeight: "900", flex: 1, textAlign: "right" },
  navRow: { flexDirection: Platform.OS === "web" ? "row" : "column", gap: 10 },
  primaryButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  darkButton: {
    flex: 1,
    backgroundColor: COLORS.navy,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  primaryText: { color: COLORS.white, fontWeight: "900" },
});
