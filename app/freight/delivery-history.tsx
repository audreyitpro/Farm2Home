// app/freight/delivery-history.tsx

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
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../data/supabaseClient";

const FREIGHT_ROUTES = {
  dashboard: "/freight/dashboard",
  board: "/freight/board",
  myLoads: "/freight/my-loads",
  liveLoads: "/freight/live-loads",
  liveRoute: "/freight/live-route",
  routeDetails: "/freight/route-details",
  earnings: "/freight/earnings",
  analytics: "/freight/analytics",
  connectBank: "/freight/connect-bank",
  settlements: "/freight/settlements",
  payoutCenter: "/freight/payout-center",
  support: "/freight/support",
  profile: "/freight/profile",
  settings: "/freight/settings",
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
  rate?: number;
  freight_total?: number;
  total_due?: number;
  payout_amount?: number;
  distance_miles?: number;
  miles?: number;
  status?: string;
  payout_status?: string;
  settlement_status?: string;
  delivered_at?: string;
  updated_at?: string;
  created_at?: string;
  carrier_id?: string;
  driver_id?: string;
  accepted_by?: string;
  delivery_receiver_name?: string;
  delivery_signature?: string;
  delivery_notes?: string;
  product_condition?: string;
};

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
  blue: "#2563EB",
  purple: "#7C3AED",
  slate: "#64748B",
};

function normalize(value: any) {
  return String(value || "").trim().toLowerCase();
}

function goTo(route: FreightRoute) {
  router.push(route as any);
}

function money(value: number) {
  return `$${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function amount(load: FreightLoad) {
  return Number(load.rate || load.freight_total || load.total_due || load.payout_amount || 0);
}

function miles(load: FreightLoad) {
  return Number(load.distance_miles || load.miles || 0);
}

function formatDate(value?: string | null) {
  if (!value) return "Not available";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function statusLabel(value?: string) {
  return String(value || "delivered")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function payoutStatus(load: FreightLoad) {
  return load.payout_status || load.settlement_status || "Pending";
}

function payoutColor(load: FreightLoad) {
  const status = normalize(payoutStatus(load));

  if (status === "paid" || status === "settled") return COLORS.green;
  if (status === "processing") return COLORS.blue;
  if (status === "failed" || status === "disputed" || status === "hold") return COLORS.red;

  return COLORS.amber;
}

export default function FreightDeliveryHistoryScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [carrier, setCarrier] = useState<any>(null);
  const [loads, setLoads] = useState<FreightLoad[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [])
  );

  const stats = useMemo(() => {
    const totalValue = loads.reduce((sum, item) => sum + amount(item), 0);
    const totalMiles = loads.reduce((sum, item) => sum + miles(item), 0);
    const paidValue = loads
      .filter((item) => ["paid", "settled"].includes(normalize(payoutStatus(item))))
      .reduce((sum, item) => sum + amount(item), 0);
    const pendingValue = totalValue - paidValue;

    return {
      completed: loads.length,
      totalValue,
      totalMiles,
      paidValue,
      pendingValue,
      avgValue: loads.length ? totalValue / loads.length : 0,
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

  async function loadHistory() {
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
        console.log("Delivery history carrier error:", carrierError.message);
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

      const { data, error } = await supabase
        .from("freight_loads")
        .select("*")
        .or(
          `carrier_id.eq.${mergedCarrier.id},driver_id.eq.${mergedCarrier.id},accepted_by.eq.${mergedCarrier.id}`
        )
        .in("status", ["delivered", "completed"])
        .order("delivered_at", { ascending: false });

      if (error) {
        console.log("Delivery history load error:", error.message);
        setLoads([]);
        return;
      }

      setLoads(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.log("Delivery history error:", error);
      Alert.alert("Delivery History Error", error?.message || "Unable to load delivery history.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadHistory();
  }

  function openRouteDetails(load: FreightLoad) {
    router.push({
      pathname: FREIGHT_ROUTES.routeDetails as any,
      params: { loadId: load.id },
    });
  }

  function renderLoad({ item }: { item: FreightLoad }) {
    return (
      <View style={styles.loadCard}>
        <View style={styles.loadHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.loadTitle}>
              {item.title || item.commodity || "Completed Freight Load"}
            </Text>
            <Text style={styles.loadSub}>
              Delivered {formatDate(item.delivered_at || item.updated_at)}
            </Text>
          </View>

          <View style={[styles.payoutBadge, { backgroundColor: payoutColor(item) }]}>
            <Text style={styles.payoutBadgeText}>{payoutStatus(item)}</Text>
          </View>
        </View>

        <View style={styles.routeBox}>
          <View style={styles.routeStop}>
            <Ionicons name="radio-button-on" size={18} color={COLORS.red} />
            <View style={{ flex: 1 }}>
              <Text style={styles.routeLabel}>Pickup</Text>
              <Text style={styles.routeText}>{item.pickup_location || "Pickup TBD"}</Text>
            </View>
          </View>

          <View style={styles.routeLine} />

          <View style={styles.routeStop}>
            <Ionicons name="location" size={18} color={COLORS.red} />
            <View style={{ flex: 1 }}>
              <Text style={styles.routeLabel}>Dropoff</Text>
              <Text style={styles.routeText}>{item.dropoff_location || "Dropoff TBD"}</Text>
            </View>
          </View>
        </View>

        <View style={styles.infoGrid}>
          <InfoBox label="Payout" value={money(amount(item))} />
          <InfoBox label="Miles" value={`${miles(item).toFixed(0)} mi`} />
          <InfoBox label="Equipment" value={item.equipment_type || "Standard"} />
          <InfoBox label="Status" value={statusLabel(item.status)} />
        </View>

        <View style={styles.deliveryBox}>
          <Text style={styles.deliveryLabel}>Delivery Confirmation</Text>
          <Text style={styles.deliveryText}>
            Receiver: {item.delivery_receiver_name || "Not recorded"}
          </Text>
          <Text style={styles.deliveryText}>
            Condition: {item.product_condition || "Not recorded"}
          </Text>
          {!!item.delivery_notes && (
            <Text style={styles.deliveryText}>Notes: {item.delivery_notes}</Text>
          )}
        </View>

        <TouchableOpacity style={styles.routeButton} onPress={() => openRouteDetails(item)}>
          <Ionicons name="trail-sign-outline" size={18} color={COLORS.red} />
          <Text style={styles.routeButtonText}>View Route Details</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <ActivityIndicator size="large" color={COLORS.red} />
        <Text style={styles.centerText}>Loading delivery history...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />

      <View style={styles.hero}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>Farm2Home Freight Connect</Text>
          <Text style={styles.title}>Delivery History</Text>
          <Text style={styles.subtitle}>
            Review completed deliveries, payout status, delivery dates, route history, and proof records.
          </Text>
        </View>

        <TouchableOpacity style={styles.heroIcon} onPress={() => goTo(FREIGHT_ROUTES.dashboard)}>
          <Ionicons name="time-outline" size={34} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>{carrier?.companyName || "Freight Connect Carrier"}</Text>
        <Text style={styles.summaryText}>Completed delivery performance summary</Text>
      </View>

      <View style={styles.statsGrid}>
        <StatCard label="Completed" value={String(stats.completed)} />
        <StatCard label="Total Value" value={money(stats.totalValue)} />
        <StatCard label="Paid" value={money(stats.paidValue)} />
        <StatCard label="Pending" value={money(stats.pendingValue)} />
        <StatCard label="Miles" value={`${stats.totalMiles.toFixed(0)} mi`} />
        <StatCard label="Avg Load" value={money(stats.avgValue)} />
      </View>

      <View style={styles.quickGrid}>
        <QuickLink icon="grid-outline" label="Dashboard" route={FREIGHT_ROUTES.dashboard} />
        <QuickLink icon="briefcase-outline" label="My Loads" route={FREIGHT_ROUTES.myLoads} />
        <QuickLink icon="cash-outline" label="Earnings" route={FREIGHT_ROUTES.earnings} />
        <QuickLink icon="receipt-outline" label="Settlements" route={FREIGHT_ROUTES.settlements} />
      </View>

      <FlatList
        data={loads}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Ionicons name="archive-outline" size={38} color={COLORS.red} />
            <Text style={styles.emptyTitle}>No completed deliveries yet.</Text>
            <Text style={styles.emptyText}>
              Delivered freight loads will appear here after proof of delivery is completed.
            </Text>

            <TouchableOpacity style={styles.emptyButton} onPress={() => goTo(FREIGHT_ROUTES.board)}>
              <Ionicons name="list-outline" size={18} color="#FFFFFF" />
              <Text style={styles.emptyButtonText}>Open Load Board</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={renderLoad}
      />
    </SafeAreaView>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
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
  summaryCard: {
    backgroundColor: COLORS.card,
    marginHorizontal: 18,
    marginTop: 16,
    marginBottom: 14,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryTitle: { color: COLORS.text, fontSize: 20, fontWeight: "900" },
  summaryText: { color: COLORS.muted, fontWeight: "800", marginTop: 5 },
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
  statValue: { color: COLORS.red, fontSize: 22, fontWeight: "900" },
  statLabel: { color: COLORS.muted, fontWeight: "800", marginTop: 5 },
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
  listContent: { paddingHorizontal: 18, paddingBottom: 90 },
  loadCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  loadHeader: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    marginBottom: 12,
  },
  loadTitle: { color: COLORS.text, fontSize: 20, fontWeight: "900" },
  loadSub: { color: COLORS.muted, fontWeight: "700", marginTop: 4 },
  payoutBadge: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  payoutBadgeText: { color: "#FFFFFF", fontWeight: "900", fontSize: 12 },
  routeBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
  },
  routeStop: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  routeLine: {
    width: 2,
    height: 22,
    backgroundColor: COLORS.border,
    marginLeft: 8,
    marginVertical: 8,
  },
  routeLabel: {
    color: COLORS.red,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  routeText: {
    color: COLORS.text,
    fontWeight: "900",
    marginTop: 3,
    lineHeight: 20,
  },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  infoBox: {
    width: "48%",
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
  },
  infoLabel: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  infoValue: {
    color: COLORS.text,
    fontWeight: "900",
    marginTop: 4,
  },
  deliveryBox: {
    backgroundColor: COLORS.black,
    borderRadius: 16,
    padding: 14,
    marginTop: 12,
  },
  deliveryLabel: {
    color: "#FCA5A5",
    fontWeight: "900",
    marginBottom: 6,
    textTransform: "uppercase",
    fontSize: 12,
  },
  deliveryText: {
    color: "#D1D5DB",
    fontWeight: "700",
    lineHeight: 21,
  },
  routeButton: {
    backgroundColor: "#FFF1F2",
    borderWidth: 1,
    borderColor: COLORS.red,
    borderRadius: 14,
    padding: 13,
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  routeButtonText: { color: COLORS.red, fontWeight: "900" },
  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 20,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "900",
    marginTop: 10,
  },
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
});