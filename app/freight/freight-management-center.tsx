// app/freight/freight-management-center.tsx

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
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../data/supabaseClient";

const FREIGHT_ROUTES = {
  dashboard: "/freight/dashboard",
  managementCenter: "/freight/freight-management-center",
  board: "/freight/board",
  postLoad: "/freight/post-load",
  createLoad: "/freight/create-load",
  myLoads: "/freight/my-loads",
  liveLoads: "/freight/live-loads",
  liveRoute: "/freight/live-route",
  routeDetails: "/freight/route-details",
  deliveryHistory: "/freight/delivery-history",
  earnings: "/freight/earnings",
  analytics: "/freight/analytics",
  notifications: "/freight/notifications",
  connectBank: "/freight/connect-bank",
  subscription: "/freight/subscription",
  profile: "/freight/profile",
  settings: "/freight/settings",
  support: "/freight/support",
  help: "/freight/help",
  proofOfPickup: "/freight/proof-of-pickup",
  proofOfDelivery: "/freight/proof-of-delivery",
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

export default function FreightManagementCenterScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [carrier, setCarrier] = useState<any>(null);
  const [loads, setLoads] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadCenter();
    }, [])
  );

  const stats = useMemo(() => {
    const active = loads.filter((item) =>
      ["accepted", "arrived_pickup", "picked_up", "in_transit", "arrived_dropoff"].includes(
        normalize(item.status)
      )
    );

    const completed = loads.filter((item) =>
      ["delivered", "completed"].includes(normalize(item.status))
    );

    const available = loads.filter((item) => normalize(item.status) === "available");

    return {
      available: available.length,
      active: active.length,
      completed: completed.length,
      unread: notifications.filter((item) => !(item.read || item.is_read)).length,
      activeValue: active.reduce((sum, item) => sum + Number(item.rate || 0), 0),
      completedValue: completed.reduce((sum, item) => sum + Number(item.rate || 0), 0),
    };
  }, [loads, notifications]);

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
      stripeAccountId: nextCarrier.stripeAccountId || nextCarrier.stripe_account_id || "",
      stripe_account_id: nextCarrier.stripe_account_id || nextCarrier.stripeAccountId || "",
      payoutsEnabled: nextCarrier.payoutsEnabled ?? nextCarrier.payouts_enabled ?? false,
      chargesEnabled: nextCarrier.chargesEnabled ?? nextCarrier.charges_enabled ?? false,
      onboardingComplete:
        nextCarrier.onboardingComplete ?? nextCarrier.stripe_onboarding_complete ?? false,
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

  async function loadCenter() {
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

      if (carrierError) console.log("Freight center profile error:", carrierError.message);

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
        stripeAccountId:
          dbCarrier.stripe_account_id || stored?.stripeAccountId || stored?.stripe_account_id || "",
        stripe_account_id:
          dbCarrier.stripe_account_id || stored?.stripe_account_id || stored?.stripeAccountId || "",
        payoutsEnabled:
          dbCarrier.payouts_enabled ?? dbCarrier.stripe_payouts_enabled ?? stored?.payoutsEnabled ?? false,
        chargesEnabled:
          dbCarrier.charges_enabled ?? dbCarrier.stripe_charges_enabled ?? stored?.chargesEnabled ?? false,
        onboardingComplete:
          dbCarrier.stripe_onboarding_complete ?? stored?.onboardingComplete ?? false,
      };

      await persistCarrier(mergedCarrier);

      const { data: loadData, error: loadError } = await supabase
        .from("freight_loads")
        .select("*")
        .or(
          `status.eq.available,carrier_id.eq.${mergedCarrier.id},driver_id.eq.${mergedCarrier.id},accepted_by.eq.${mergedCarrier.id}`
        )
        .order("updated_at", { ascending: false });

      if (loadError) {
        console.log("Freight center loads error:", loadError.message);
        setLoads([]);
      } else {
        setLoads(Array.isArray(loadData) ? loadData : []);
      }

      const { data: notificationData, error: notificationError } = await supabase
        .from("notifications")
        .select("*")
        .or(`user_id.eq.${mergedCarrier.id},freight_id.eq.${mergedCarrier.id},role.eq.freight`)
        .order("created_at", { ascending: false })
        .limit(10);

      if (notificationError) {
        console.log("Freight center notifications error:", notificationError.message);
        setNotifications([]);
      } else {
        setNotifications(Array.isArray(notificationData) ? notificationData : []);
      }
    } catch (error: any) {
      console.log("Freight management center error:", error);
      Alert.alert("Center Error", error?.message || "Unable to load freight management center.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadCenter();
  }

  function stripeStatusText() {
    if (carrier?.payoutsEnabled && carrier?.chargesEnabled && carrier?.onboardingComplete) {
      return "Payout Ready";
    }

    if (carrier?.stripeAccountId || carrier?.stripe_account_id) {
      return "Setup Incomplete";
    }

    return "Not Connected";
  }

  function stripeStatusColor() {
    if (carrier?.payoutsEnabled && carrier?.chargesEnabled && carrier?.onboardingComplete) {
      return COLORS.green;
    }

    if (carrier?.stripeAccountId || carrier?.stripe_account_id) {
      return COLORS.amber;
    }

    return COLORS.red;
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <ActivityIndicator size="large" color={COLORS.red} />
        <Text style={styles.centerText}>Loading freight management center...</Text>
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
            <Text style={styles.title}>Freight Management Center</Text>
            <Text style={styles.subtitle}>
              Central operations hub for loads, routes, payouts, analytics, support, and account tools.
            </Text>
          </View>

          <TouchableOpacity style={styles.heroIcon} onPress={() => goTo(FREIGHT_ROUTES.dashboard)}>
            <Ionicons name="apps-outline" size={34} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.carrierCard}>
          <View style={styles.avatar}>
            <Ionicons name="business-outline" size={28} color="#FFFFFF" />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.carrierName}>{carrier?.companyName || "Freight Connect Carrier"}</Text>
            <Text style={styles.carrierEmail}>{carrier?.email || "Carrier workspace"}</Text>

            <View style={[styles.stripePill, { backgroundColor: stripeStatusColor() }]}>
              <Text style={styles.stripePillText}>Stripe Connect: {stripeStatusText()}</Text>
            </View>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <StatCard label="Available" value={String(stats.available)} icon="cube-outline" />
          <StatCard label="Active Loads" value={String(stats.active)} icon="navigate-outline" />
          <StatCard label="Completed" value={String(stats.completed)} icon="checkmark-done-outline" />
          <StatCard label="Unread Alerts" value={String(stats.unread)} icon="notifications-outline" />
          <StatCard label="Active Value" value={money(stats.activeValue)} icon="cash-outline" />
          <StatCard label="Completed Value" value={money(stats.completedValue)} icon="wallet-outline" />
        </View>

        <Section title="Operations" subtitle="Load movement, route tools, and dispatch workflow." />

        <View style={styles.grid}>
          <HubTile icon="grid-outline" title="Dashboard" route={FREIGHT_ROUTES.dashboard} />
          <HubTile icon="list-outline" title="Load Board" route={FREIGHT_ROUTES.board} />
          <HubTile icon="add-circle-outline" title="Post Load" route={FREIGHT_ROUTES.postLoad} />
          <HubTile icon="create-outline" title="Create Load" route={FREIGHT_ROUTES.createLoad} />
          <HubTile icon="briefcase-outline" title="My Loads" route={FREIGHT_ROUTES.myLoads} />
          <HubTile icon="pulse-outline" title="Live Loads" route={FREIGHT_ROUTES.liveLoads} />
          <HubTile icon="map-outline" title="Live Route" route={FREIGHT_ROUTES.liveRoute} />
          <HubTile icon="trail-sign-outline" title="Route Details" route={FREIGHT_ROUTES.routeDetails} />
        </View>

        <Section title="Delivery & History" subtitle="Proof workflow, completed deliveries, and route records." />

        <View style={styles.grid}>
          <HubTile icon="camera-outline" title="Proof Pickup" route={FREIGHT_ROUTES.proofOfPickup} />
          <HubTile icon="checkmark-done-outline" title="Proof Delivery" route={FREIGHT_ROUTES.proofOfDelivery} />
          <HubTile icon="time-outline" title="Delivery History" route={FREIGHT_ROUTES.deliveryHistory} />
          <HubTile icon="notifications-outline" title="Notifications" route={FREIGHT_ROUTES.notifications} />
        </View>

        <Section title="Financials" subtitle="Payouts, earnings, analytics, subscription, and bank setup." />

        <View style={styles.grid}>
          <HubTile icon="cash-outline" title="Earnings" route={FREIGHT_ROUTES.earnings} />
          <HubTile icon="analytics-outline" title="Analytics" route={FREIGHT_ROUTES.analytics} />
          <HubTile icon="business-outline" title="Connect Bank" route={FREIGHT_ROUTES.connectBank} />
          <HubTile icon="card-outline" title="Subscription" route={FREIGHT_ROUTES.subscription} />
        </View>

        <Section title="Account & Help" subtitle="Carrier profile, settings, support, and help center." />

        <View style={styles.grid}>
          <HubTile icon="person-outline" title="Profile" route={FREIGHT_ROUTES.profile} />
          <HubTile icon="settings-outline" title="Settings" route={FREIGHT_ROUTES.settings} />
          <HubTile icon="headset-outline" title="Support" route={FREIGHT_ROUTES.support} />
          <HubTile icon="help-circle-outline" title="Help" route={FREIGHT_ROUTES.help} />
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={() => goTo(FREIGHT_ROUTES.board)}>
          <Ionicons name="list-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>Open Freight Board</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.darkButton} onPress={() => goTo(FREIGHT_ROUTES.dashboard)}>
          <Ionicons name="grid-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>Back to Dashboard</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionSubtitle}>{subtitle}</Text>
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

function HubTile({
  icon,
  title,
  route,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  route: FreightRoute;
}) {
  return (
    <TouchableOpacity style={styles.tile} onPress={() => goTo(route)}>
      <View style={styles.tileIcon}>
        <Ionicons name={icon} size={24} color={COLORS.red} />
      </View>

      <Text style={styles.tileTitle}>{title}</Text>
      <Ionicons name="chevron-forward-outline" size={18} color={COLORS.muted} />
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
  title: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "900",
    marginBottom: 10,
  },
  subtitle: {
    color: "#D1D5DB",
    lineHeight: 22,
    fontWeight: "700",
  },
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
    alignItems: "center",
    gap: 14,
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
  stripePill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 9,
  },
  stripePillText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
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
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 15,
  },
  statValue: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "900",
    marginTop: 8,
  },
  statLabel: { color: COLORS.muted, fontWeight: "800", marginTop: 4 },
  section: {
    paddingHorizontal: 18,
    marginTop: 12,
    marginBottom: 10,
  },
  sectionTitle: { color: COLORS.text, fontSize: 24, fontWeight: "900" },
  sectionSubtitle: {
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 21,
    marginTop: 4,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 18,
    marginBottom: 10,
  },
  tile: {
    width: "48%",
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 15,
    minHeight: 122,
    justifyContent: "space-between",
  },
  tileIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: "#FFF1F2",
    alignItems: "center",
    justifyContent: "center",
  },
  tileTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 15,
    marginTop: 10,
  },
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
  primaryButtonText: { color: "#FFFFFF", fontWeight: "900" },
});