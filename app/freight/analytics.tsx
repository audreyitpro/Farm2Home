// app/freight/analytics.tsx

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
  board: "/freight/board",
  myLoads: "/freight/my-loads",
  liveLoads: "/freight/live-loads",
  profile: "/freight/profile",
  settings: "/freight/settings",
  connectBank: "/freight/connect-bank",
  subscription: "/freight/subscription",
  support: "/freight/support",
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
  slate: "#64748B",
};

type FreightLoad = {
  id: string;
  status?: string;
  rate?: number;
  total_due?: number;
  freight_total?: number;
  distance_miles?: number;
  miles?: number;
  commodity?: string;
  equipment_type?: string;
  pickup_location?: string;
  dropoff_location?: string;
  carrier_id?: string;
  driver_id?: string;
  accepted_by?: string;
  created_at?: string;
  updated_at?: string;
  delivered_at?: string;
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

function amount(load: FreightLoad) {
  return Number(load.rate || load.freight_total || load.total_due || 0);
}

function miles(load: FreightLoad) {
  return Number(load.distance_miles || load.miles || 0);
}

function goTo(route: FreightRoute) {
  router.push(route as any);
}

export default function FreightAnalyticsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [carrier, setCarrier] = useState<any>(null);
  const [loads, setLoads] = useState<FreightLoad[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadAnalytics();
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

  async function loadAnalytics() {
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
        console.log("Freight analytics profile error:", carrierError.message);
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
        .order("created_at", { ascending: false });

      if (error) {
        console.log("Freight analytics error:", error.message);
        setLoads([]);
        return;
      }

      setLoads(Array.isArray(data) ? data : []);
    } catch (error) {
      console.log("Load freight analytics error:", error);
      Alert.alert("Analytics Error", "Unable to load freight analytics.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadAnalytics();
  }

  const analytics = useMemo(() => {
    const active = loads.filter((x) =>
      ["accepted", "arrived_pickup", "picked_up", "in_transit", "arrived_dropoff"].includes(
        normalize(x.status)
      )
    );

    const completed = loads.filter((x) =>
      ["delivered", "completed"].includes(normalize(x.status))
    );

    const cancelled = loads.filter((x) => normalize(x.status) === "cancelled");

    const totalRevenue = loads.reduce((sum, x) => sum + amount(x), 0);
    const completedRevenue = completed.reduce((sum, x) => sum + amount(x), 0);
    const activeRevenue = active.reduce((sum, x) => sum + amount(x), 0);
    const totalMiles = loads.reduce((sum, x) => sum + miles(x), 0);
    const avgRatePerMile = totalMiles > 0 ? totalRevenue / totalMiles : 0;
    const avgLoadValue = loads.length > 0 ? totalRevenue / loads.length : 0;

    const refrigerated = loads.filter((x) =>
      normalize(x.equipment_type).includes("refriger")
    ).length;

    const livestock = loads.filter((x) =>
      normalize(x.commodity).includes("livestock")
    ).length;

    return {
      total: loads.length,
      active: active.length,
      completed: completed.length,
      cancelled: cancelled.length,
      totalRevenue,
      completedRevenue,
      activeRevenue,
      totalMiles,
      avgRatePerMile,
      avgLoadValue,
      refrigerated,
      livestock,
    };
  }, [loads]);

  const topCommodities = useMemo(() => {
    const map: Record<string, number> = {};

    loads.forEach((load) => {
      const key = load.commodity || "Farm Freight";
      map[key] = (map[key] || 0) + 1;
    });

    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [loads]);

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <ActivityIndicator size="large" color={COLORS.red} />
        <Text style={styles.centerText}>Loading freight analytics...</Text>
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
            <Text style={styles.title}>Freight Analytics</Text>
            <Text style={styles.subtitle}>
              Track carrier performance, completed value, live load value, mileage, and freight mix.
            </Text>
          </View>

          <TouchableOpacity style={styles.heroIcon} onPress={() => goTo(FREIGHT_ROUTES.dashboard)}>
            <Ionicons name="analytics-outline" size={34} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.carrierCard}>
          <View style={styles.avatar}>
            <Ionicons name="analytics-outline" size={28} color="#FFFFFF" />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.carrierName}>
              {carrier?.companyName || "Freight Connect Carrier"}
            </Text>
            <Text style={styles.carrierSub}>{carrier?.email || "Carrier workspace"}</Text>
          </View>
        </View>

        <View style={styles.grid}>
          <StatCard label="Total Loads" value={analytics.total} />
          <StatCard label="Active Loads" value={analytics.active} />
          <StatCard label="Completed" value={analytics.completed} />
          <StatCard label="Cancelled" value={analytics.cancelled} />
          <StatCard label="Total Value" value={money(analytics.totalRevenue)} />
          <StatCard label="Completed Value" value={money(analytics.completedRevenue)} />
          <StatCard label="Active Value" value={money(analytics.activeRevenue)} />
          <StatCard label="Total Miles" value={`${analytics.totalMiles.toFixed(0)} mi`} />
          <StatCard label="Avg Load" value={money(analytics.avgLoadValue)} />
          <StatCard label="Avg / Mile" value={money(analytics.avgRatePerMile)} />
        </View>

        <View style={styles.card}>
          <SectionHeader
            icon="speedometer-outline"
            title="Performance Summary"
            subtitle="Operational health for your freight carrier account."
          />

          <InfoRow
            label="Completion Rate"
            value={`${analytics.total ? Math.round((analytics.completed / analytics.total) * 100) : 0}%`}
          />
          <InfoRow
            label="Active Load Share"
            value={`${analytics.total ? Math.round((analytics.active / analytics.total) * 100) : 0}%`}
          />
          <InfoRow label="Refrigerated Loads" value={String(analytics.refrigerated)} />
          <InfoRow label="Livestock Loads" value={String(analytics.livestock)} />
        </View>

        <View style={styles.card}>
          <SectionHeader
            icon="leaf-outline"
            title="Top Commodities"
            subtitle="Most common freight categories assigned to your carrier."
          />

          {topCommodities.length === 0 ? (
            <Text style={styles.emptyText}>No commodity data yet.</Text>
          ) : (
            topCommodities.map(([name, count]) => (
              <View key={name} style={styles.commodityRow}>
                <Text style={styles.commodityName}>{name}</Text>
                <View style={styles.commodityBadge}>
                  <Text style={styles.commodityBadgeText}>{count}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.quickGrid}>
          <QuickLink icon="grid-outline" label="Dashboard" route={FREIGHT_ROUTES.dashboard} />
          <QuickLink icon="list-outline" label="Load Board" route={FREIGHT_ROUTES.board} />
          <QuickLink icon="briefcase-outline" label="My Loads" route={FREIGHT_ROUTES.myLoads} />
          <QuickLink icon="pulse-outline" label="Live Loads" route={FREIGHT_ROUTES.liveLoads} />
          <QuickLink icon="business-outline" label="Connect Bank" route={FREIGHT_ROUTES.connectBank} />
          <QuickLink icon="settings-outline" label="Settings" route={FREIGHT_ROUTES.settings} />
          <QuickLink icon="card-outline" label="Subscription" route={FREIGHT_ROUTES.subscription} />
          <QuickLink icon="headset-outline" label="Support" route={FREIGHT_ROUTES.support} />
        </View>
      </ScrollView>
    </SafeAreaView>
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
        <Ionicons name={icon} size={20} color="#FFFFFF" />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
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
      <Text style={styles.quickLinkText}>{label}</Text>
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
    marginTop: 8,
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
  carrierSub: { color: COLORS.muted, fontWeight: "700", marginTop: 4 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 18,
    marginBottom: 16,
  },
  statCard: {
    flexGrow: 1,
    flexBasis: "47%",
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 15,
  },
  statValue: { color: COLORS.black, fontSize: 21, fontWeight: "900" },
  statLabel: { color: COLORS.muted, fontWeight: "800", marginTop: 4 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 18,
    marginHorizontal: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionHeader: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    marginBottom: 14,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: COLORS.black,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: { color: COLORS.text, fontSize: 21, fontWeight: "900" },
  sectionSubtitle: {
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 3,
  },
  infoRow: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 13,
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  infoLabel: { color: COLORS.text, fontWeight: "900", flex: 1 },
  infoValue: { color: COLORS.red, fontWeight: "900" },
  commodityRow: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 13,
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  commodityName: { flex: 1, color: COLORS.text, fontWeight: "900" },
  commodityBadge: {
    backgroundColor: COLORS.red,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  commodityBadgeText: { color: "#FFFFFF", fontWeight: "900" },
  emptyText: { color: COLORS.muted, fontWeight: "700", lineHeight: 21 },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 18,
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
  quickLinkText: { color: COLORS.text, fontWeight: "900", textAlign: "center" },
});