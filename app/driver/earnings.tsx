// app/driver/earnings.tsx

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

import { supabase } from "../services/supabaseClient";

type EarningLoad = {
  id: string;
  source: "freight_load" | "delivery_order";
  title?: string;
  commodity?: string;
  status?: string;
  pickup_address?: string;
  dropoff_address?: string;
  pickup_city?: string;
  dropoff_city?: string;
  delivery_fee?: number;
  freight_total?: number;
  payout_amount?: number;
  total_due?: number;
  miles?: number;
  delivered_at?: string;
  created_at?: string;
  farmer_name?: string;
  farm_name?: string;
};

type EarningStats = {
  totalEarnings: number;
  weeklyEarnings: number;
  completedLoads: number;
  activeLoads: number;
  totalMiles: number;
  averageLoadPay: number;
  bonusEstimate: number;
};

const COLORS = {
  bg: "#F6F7FB",
  card: "#FFFFFF",
  text: "#151922",
  muted: "#7B8494",
  border: "#E6E8EF",
  red: "#E1122D",
  redSoft: "#FFE6EA",
  black: "#111827",
  soft: "#F3F4F8",
  green: "#10B981",
  blue: "#2563EB",
  orange: "#F59E0B",
  purple: "#7C3AED",
};

const ACTIVE_STATUSES = [
  "accepted",
  "booked",
  "arrived_pickup",
  "picked_up",
  "in_transit",
  "arrived_dropoff",
];

function normalize(value: any) {
  return String(value || "").trim().toLowerCase();
}

function formatMoney(value: number) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function statusLabel(status?: string | null) {
  return String(status || "unknown")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function DriverEarnings() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [driver, setDriver] = useState<any>(null);
  const [loads, setLoads] = useState<EarningLoad[]>([]);
  const [stats, setStats] = useState<EarningStats>({
    totalEarnings: 0,
    weeklyEarnings: 0,
    completedLoads: 0,
    activeLoads: 0,
    totalMiles: 0,
    averageLoadPay: 0,
    bonusEstimate: 0,
  });

  useFocusEffect(
    useCallback(() => {
      loadEarnings();
    }, [])
  );

  const completedLoads = useMemo(
    () =>
      loads.filter((item) =>
        ["delivered", "completed"].includes(normalize(item.status))
      ),
    [loads]
  );

  const activeLoads = useMemo(
    () => loads.filter((item) => ACTIVE_STATUSES.includes(normalize(item.status))),
    [loads]
  );

  async function getCurrentDriver() {
    const raw =
      (await AsyncStorage.getItem("currentDriver")) ||
      (await AsyncStorage.getItem("farm2homeCurrentDriver")) ||
      (await AsyncStorage.getItem("farm2homeDriverSession")) ||
      (await AsyncStorage.getItem("currentUser"));

    let stored: any = null;

    if (raw) {
      try {
        stored = JSON.parse(raw);
      } catch {
        stored = null;
      }
    }

    if (stored?.role && stored.role !== "driver") return null;

    const { data: authData } = await supabase.auth.getUser();
    const authUser = authData?.user;

    const authUserId =
      authUser?.id ||
      stored?.authUserId ||
      stored?.id ||
      stored?.driverId ||
      "";

    const authEmail = normalize(authUser?.email || stored?.email || "");

    let dbDriver: any = null;
    let profile: any = null;

    if (authUserId) {
      const result = await supabase
        .from("drivers")
        .select("*")
        .eq("id", authUserId)
        .maybeSingle();

      if (!result.error && result.data) dbDriver = result.data;
    }

    if (!dbDriver && authEmail) {
      const result = await supabase
        .from("drivers")
        .select("*")
        .eq("email", authEmail)
        .maybeSingle();

      if (!result.error && result.data) dbDriver = result.data;
    }

    if (authUserId) {
      const result = await supabase
        .from("profiles")
        .select("*")
        .eq("auth_user_id", authUserId)
        .eq("role", "driver")
        .maybeSingle();

      if (!result.error && result.data) profile = result.data;
    }

    if (!profile && authEmail) {
      const result = await supabase
        .from("profiles")
        .select("*")
        .eq("email", authEmail)
        .eq("role", "driver")
        .maybeSingle();

      if (!result.error && result.data) profile = result.data;
    }

    const stableId =
      dbDriver?.id ||
      stored?.id ||
      stored?.driverId ||
      authUserId ||
      profile?.auth_user_id ||
      "";

    if (!stableId) return null;

    const normalizedDriver = {
      ...(stored || {}),
      ...(dbDriver || {}),
      id: stableId,
      driverId: stableId,
      authUserId: dbDriver?.auth_user_id || profile?.auth_user_id || authUserId,
      profileId: dbDriver?.profile_id || stored?.profileId || profile?.id || "",
      role: "driver",
      fullName:
        dbDriver?.full_name ||
        dbDriver?.name ||
        profile?.full_name ||
        stored?.fullName ||
        stored?.name ||
        stored?.username ||
        "Farm2Home Driver",
      name:
        dbDriver?.name ||
        dbDriver?.full_name ||
        profile?.full_name ||
        stored?.name ||
        stored?.fullName ||
        "Farm2Home Driver",
      username: dbDriver?.username || profile?.username || stored?.username || "",
      email: normalize(dbDriver?.email || profile?.email || stored?.email || authEmail),
      accountActive:
        dbDriver?.account_active ??
        profile?.account_active ??
        stored?.accountActive ??
        true,
      membershipStatus:
        dbDriver?.membership_status || stored?.membershipStatus || "Active",
      subscriptionStatus:
        dbDriver?.subscription_status || stored?.subscriptionStatus || "active",
    };

    await AsyncStorage.setItem("currentDriver", JSON.stringify(normalizedDriver));
    await AsyncStorage.setItem("currentUser", JSON.stringify(normalizedDriver));
    await AsyncStorage.setItem("farm2homeCurrentDriver", JSON.stringify(normalizedDriver));
    await AsyncStorage.setItem("farm2homeDriverSession", JSON.stringify(normalizedDriver));
    await AsyncStorage.setItem("userRole", "driver");
    await AsyncStorage.setItem("currentUserRole", "driver");

    return normalizedDriver;
  }

  function driverHasAccess(currentDriver: any) {
    const membershipStatus = normalize(currentDriver?.membershipStatus);
    const subscriptionStatus = normalize(currentDriver?.subscriptionStatus);

    if (currentDriver?.accountActive === false) return false;
    if (membershipStatus === "canceled") return false;
    if (["canceled", "past_due", "unpaid"].includes(subscriptionStatus)) return false;

    return true;
  }

  async function loadEarnings() {
    try {
      setLoading(true);

      const currentDriver = await getCurrentDriver();

      if (!currentDriver) {
        router.replace("/driver/login" as any);
        return;
      }

      if (!driverHasAccess(currentDriver)) {
        Alert.alert(
          "Driver Membership Required",
          "Your driver account is inactive or subscription is not active."
        );
        router.replace("/driver/login" as any);
        return;
      }

      setDriver(currentDriver);

      const driverId =
        currentDriver.id || currentDriver.driverId || currentDriver.email || "";

      const allLoads: EarningLoad[] = [];

      const { data: freightRows, error: freightError } = await supabase
        .from("freight_loads")
        .select("*")
        .or(
          `driver_id.eq.${driverId},carrier_id.eq.${driverId},assigned_driver_id.eq.${driverId}`
        )
        .order("created_at", { ascending: false });

      if (!freightError && Array.isArray(freightRows)) {
        allLoads.push(...freightRows.map(mapFreightLoad));
      }

      const { data: deliveryRows, error: deliveryError } = await supabase
        .from("delivery_orders")
        .select("*")
        .or(`driver_id.eq.${driverId},assigned_driver_id.eq.${driverId}`)
        .order("created_at", { ascending: false });

      if (!deliveryError && Array.isArray(deliveryRows)) {
        allLoads.push(...deliveryRows.map(mapDeliveryOrder));
      }

      const uniqueLoads = Array.from(
        new Map(allLoads.map((item) => [`${item.source}_${item.id}`, item])).values()
      );

      setLoads(uniqueLoads);
      calculateStats(uniqueLoads);
    } catch (error) {
      console.log("LOAD_EARNINGS_CRASH:", error);
      Alert.alert("Earnings Error", "Unable to load driver earnings.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function mapFreightLoad(item: any): EarningLoad {
    return {
      id: String(item.id),
      source: "freight_load",
      title: item.product_name || item.title || "Farm Freight Load",
      commodity: item.load_type || item.commodity || "Farm Freight",
      status: item.status || "unknown",
      pickup_address: item.pickup_address || item.pickup_location || "",
      dropoff_address: item.dropoff_address || item.dropoff_location || "",
      pickup_city: item.pickup_city || "",
      dropoff_city: item.dropoff_city || item.delivery_city || "",
      delivery_fee: Number(item.delivery_fee || 0),
      freight_total: Number(item.freight_total || 0),
      payout_amount: Number(item.payout_amount || item.driver_payout || 0),
      total_due: Number(item.total_due || 0),
      miles: Number(item.miles || item.distance_miles || item.estimated_miles || 0),
      delivered_at: item.delivered_at || "",
      created_at: item.created_at || "",
      farmer_name: item.farmer_name || "",
      farm_name: item.farm_name || "",
    };
  }

  function mapDeliveryOrder(item: any): EarningLoad {
    return {
      id: String(item.id),
      source: "delivery_order",
      title: item.farm_name || item.farmer_name || "Farm Delivery",
      commodity: item.source || "Farm2Driver Delivery",
      status: item.status || "unknown",
      pickup_address: item.pickup_address || "",
      dropoff_address: item.dropoff_address || "",
      pickup_city: item.pickup_city || "",
      dropoff_city: item.dropoff_city || "",
      delivery_fee: Number(item.delivery_fee || item.payout_amount || 0),
      freight_total: 0,
      payout_amount: Number(item.payout_amount || item.delivery_fee || 0),
      total_due: Number(item.total_due || item.delivery_fee || 0),
      miles: Number(item.miles || 0),
      delivered_at: item.delivered_at || "",
      created_at: item.created_at || "",
      farmer_name: item.farmer_name || "",
      farm_name: item.farm_name || "",
    };
  }

  function calculateStats(driverLoads: EarningLoad[]) {
    const completed = driverLoads.filter((item) =>
      ["delivered", "completed"].includes(normalize(item.status))
    );

    const active = driverLoads.filter((item) =>
      ACTIVE_STATUSES.includes(normalize(item.status))
    );

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const weeklyCompleted = completed.filter((item) => {
      const dateValue = item.delivered_at || item.created_at;
      if (!dateValue) return false;
      return new Date(dateValue) >= sevenDaysAgo;
    });

    const totalEarnings = completed.reduce((sum, item) => sum + getLoadPay(item), 0);
    const weeklyEarnings = weeklyCompleted.reduce((sum, item) => sum + getLoadPay(item), 0);
    const totalMiles = completed.reduce((sum, item) => sum + getLoadMiles(item), 0);
    const averageLoadPay = completed.length > 0 ? totalEarnings / completed.length : 0;
    const bonusEstimate = completed.length >= 10 ? 150 : completed.length >= 5 ? 50 : 0;

    setStats({
      totalEarnings,
      weeklyEarnings,
      completedLoads: completed.length,
      activeLoads: active.length,
      totalMiles,
      averageLoadPay,
      bonusEstimate,
    });
  }

  function onRefresh() {
    setRefreshing(true);
    loadEarnings();
  }

  function statusColor(status?: string | null) {
    switch (normalize(status)) {
      case "delivered":
      case "completed":
        return COLORS.green;
      case "in_transit":
        return "#0F766E";
      case "picked_up":
        return COLORS.orange;
      case "accepted":
      case "booked":
      case "arrived_pickup":
      case "arrived_dropoff":
        return COLORS.purple;
      case "available":
      case "posted":
      case "open":
        return COLORS.blue;
      case "cancelled":
        return COLORS.red;
      default:
        return COLORS.muted;
    }
  }

  function estimatedPayoutDate(deliveredAt?: string | null) {
    if (!deliveredAt) return "Pending";

    const payoutDate = new Date(deliveredAt);
    payoutDate.setDate(payoutDate.getDate() + 7);

    return payoutDate.toLocaleDateString();
  }

  function getLoadPay(item: EarningLoad) {
    return Number(
      item.payout_amount ||
        item.delivery_fee ||
        item.freight_total ||
        item.total_due ||
        0
    );
  }

  function getLoadMiles(item: EarningLoad) {
    return Number(item.miles || 0);
  }

  function getDriverName() {
    return (
      driver?.fullName ||
      driver?.name ||
      driver?.username ||
      driver?.email ||
      "Farm2Home Driver"
    );
  }

  function openWorkflow(item: EarningLoad) {
    router.push({
      pathname: "/driver/live-location-provider",
      params: {
        loadId: item.source === "freight_load" ? item.id : "",
        deliveryOrderId: item.source === "delivery_order" ? item.id : "",
        orderId: item.id,
        autoTracking: "true",
      },
    } as any);
  }

  function renderLoadCard(item: EarningLoad, completed = false) {
    return (
      <View style={styles.loadCard}>
        <View style={styles.loadHeader}>
          <View style={styles.loadIcon}>
            <Ionicons
              name={item.source === "freight_load" ? "cube" : "bag-handle"}
              size={21}
              color={COLORS.red}
            />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.loadTitle}>{item.title || "Farm2Home Load"}</Text>
            <Text style={styles.commodity}>{item.commodity || "Farm Goods"}</Text>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) }]}>
            <Text style={styles.statusText}>{statusLabel(item.status)}</Text>
          </View>
        </View>

        <View style={styles.routeBox}>
          <View style={styles.routeStop}>
            <View style={styles.routeDotStart} />
            <View style={{ flex: 1 }}>
              <Text style={styles.routeLabel}>Pickup</Text>
              <Text style={styles.routeText}>
                {item.pickup_address || item.pickup_city || "Pickup location"}
              </Text>
            </View>
          </View>

          <View style={styles.routeLine} />

          <View style={styles.routeStop}>
            <View style={styles.routeDotEnd} />
            <View style={{ flex: 1 }}>
              <Text style={styles.routeLabel}>Dropoff</Text>
              <Text style={styles.routeText}>
                {item.dropoff_address || item.dropoff_city || "Dropoff location"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.payoutRow}>
          <View style={styles.payoutBox}>
            <Text style={styles.payoutLabel}>Payout</Text>
            <Text style={styles.payoutValue}>{formatMoney(getLoadPay(item))}</Text>
          </View>

          <View style={styles.payoutBox}>
            <Text style={styles.payoutLabel}>Miles</Text>
            <Text style={styles.payoutValue}>{getLoadMiles(item).toFixed(0)}</Text>
          </View>
        </View>

        <Text style={styles.metaText}>
          Farmer: {item.farmer_name || item.farm_name || "Farm2Home Farmer"}
        </Text>

        {completed ? (
          <View style={styles.payoutDateBox}>
            <Ionicons name="calendar" size={16} color={COLORS.red} />
            <Text style={styles.payoutDateText}>
              Estimated payout: {estimatedPayoutDate(item.delivered_at)}
            </Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.actionButton} onPress={() => openWorkflow(item)}>
            <Ionicons name="navigate" size={17} color="#FFFFFF" />
            <Text style={styles.actionText}>Open Load Workflow</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.red} />
        <View style={styles.loadingScreen}>
          <ActivityIndicator size="large" color={COLORS.red} />
          <Text style={styles.loadingText}>Loading earnings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.red} />

      <View style={styles.container}>
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>Farm2Driver Wallet</Text>
              <Text style={styles.title}>Earnings</Text>
              <Text style={styles.subtitle}>Welcome back, {getDriverName()}</Text>
            </View>

            <TouchableOpacity
              style={styles.profileCircle}
              onPress={() => router.push("/driver/profile" as any)}
            >
              <Ionicons name="person" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Available Balance Estimate</Text>
            <Text style={styles.balanceValue}>
              {formatMoney(stats.totalEarnings + stats.bonusEstimate)}
            </Text>
            <Text style={styles.balanceSub}>
              Includes completed loads and bonus estimate.
            </Text>
          </View>
        </View>

        <View style={styles.navRow}>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => router.push("/driver/mobile-driver-app" as any)}
          >
            <Ionicons name="home" size={17} color="#FFFFFF" />
            <Text style={styles.navText}>Driver Hub</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navButtonOutline}
            onPress={() => router.push("/driver/my-deliveries" as any)}
          >
            <Ionicons name="cube-outline" size={17} color={COLORS.red} />
            <Text style={styles.navTextOutline}>My Shipments</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View style={styles.statsGrid}>
            <WalletStat
              label="Total"
              value={formatMoney(stats.totalEarnings)}
              icon="wallet"
              accent
            />
            <WalletStat
              label="Weekly"
              value={formatMoney(stats.weeklyEarnings)}
              icon="trending-up"
              accent
            />
            <WalletStat label="Completed" value={stats.completedLoads} icon="checkmark-circle" />
            <WalletStat label="Active" value={stats.activeLoads} icon="navigate" />
            <WalletStat label="Miles" value={stats.totalMiles.toFixed(0)} icon="speedometer" />
            <WalletStat
              label="Avg Pay"
              value={formatMoney(stats.averageLoadPay)}
              icon="cash"
            />
          </View>

          <TouchableOpacity style={styles.refreshButton} onPress={loadEarnings}>
            <Ionicons name="refresh" size={18} color="#FFFFFF" />
            <Text style={styles.refreshText}>Refresh Earnings</Text>
          </TouchableOpacity>

          <View style={styles.settlementCard}>
            <Text style={styles.settlementTitle}>Settlement Summary</Text>

            <SettlementRow label="Completed load payout" value={formatMoney(stats.totalEarnings)} />
            <SettlementRow label="Bonus estimate" value={formatMoney(stats.bonusEstimate)} />

            <View style={styles.settlementTotalRow}>
              <Text style={styles.settlementTotalLabel}>Estimated settlement</Text>
              <Text style={styles.settlementTotal}>
                {formatMoney(stats.totalEarnings + stats.bonusEstimate)}
              </Text>
            </View>

            <Text style={styles.settlementNote}>
              Final payout timing depends on admin approval, payment processor,
              dispute checks, and proof-of-delivery verification.
            </Text>
          </View>

          <Text style={styles.sectionTitle}>Active Shipments</Text>

          <FlatList
            data={activeLoads}
            keyExtractor={(item, index) => `${item.source}_${item.id}_${index}`}
            scrollEnabled={false}
            ListEmptyComponent={
              <View style={styles.emptyCard}>
                <Ionicons name="cube-outline" size={34} color={COLORS.red} />
                <Text style={styles.emptyTitle}>No active loads</Text>
                <Text style={styles.emptyText}>
                  Accepted and in-transit loads will appear here.
                </Text>
              </View>
            }
            renderItem={({ item }) => renderLoadCard(item, false)}
          />

          <Text style={styles.sectionTitle}>Completed Shipments</Text>

          <FlatList
            data={completedLoads}
            keyExtractor={(item, index) => `${item.source}_${item.id}_${index}`}
            scrollEnabled={false}
            contentContainerStyle={{ paddingBottom: 110 }}
            ListEmptyComponent={
              <View style={styles.emptyCard}>
                <Ionicons name="checkmark-circle-outline" size={34} color={COLORS.red} />
                <Text style={styles.emptyTitle}>No completed loads yet</Text>
                <Text style={styles.emptyText}>
                  Completed deliveries will appear here after proof of delivery.
                </Text>
              </View>
            }
            renderItem={({ item }) => renderLoadCard(item, true)}
          />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function WalletStat({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  accent?: boolean;
}) {
  return (
    <View style={[styles.statCard, accent && styles.statCardAccent]}>
      <View style={[styles.statIcon, accent && styles.statIconAccent]}>
        <Ionicons name={icon} size={19} color={accent ? "#FFFFFF" : COLORS.red} />
      </View>
      <Text style={[styles.statValue, accent && styles.statValueAccent]}>{value}</Text>
      <Text style={[styles.statLabel, accent && styles.statLabelAccent]}>{label}</Text>
    </View>
  );
}

function SettlementRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.settlementRow}>
      <Text style={styles.settlementText}>{label}</Text>
      <Text style={styles.settlementValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  loadingScreen: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: COLORS.muted,
    marginTop: 10,
    fontWeight: "800",
  },
  container: { flex: 1, backgroundColor: COLORS.bg },
  hero: {
    backgroundColor: COLORS.red,
    paddingTop: 22,
    paddingHorizontal: 20,
    paddingBottom: 26,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  profileCircle: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: {
    color: "#FFE6EA",
    fontWeight: "900",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontSize: 12,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900",
  },
  subtitle: {
    color: "#FFFFFF",
    opacity: 0.9,
    lineHeight: 21,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 4,
  },
  balanceCard: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 22,
    padding: 17,
    marginTop: 18,
  },
  balanceLabel: {
    color: "#FFE6EA",
    fontWeight: "900",
    fontSize: 12,
    textTransform: "uppercase",
  },
  balanceValue: {
    color: "#FFFFFF",
    fontSize: 38,
    fontWeight: "900",
    marginTop: 4,
  },
  balanceSub: {
    color: "#FFFFFF",
    opacity: 0.9,
    fontWeight: "700",
    marginTop: 4,
  },
  navRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    marginTop: -18,
    marginBottom: 14,
  },
  navButton: {
    flex: 1,
    backgroundColor: COLORS.red,
    padding: 14,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  navButtonOutline: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  navText: { color: "#FFFFFF", fontWeight: "900" },
  navTextOutline: { color: COLORS.red, fontWeight: "900" },
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
    padding: 14,
  },
  statCardAccent: {
    backgroundColor: COLORS.black,
    borderColor: COLORS.black,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 13,
    backgroundColor: COLORS.redSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  statIconAccent: {
    backgroundColor: COLORS.red,
  },
  statValue: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "900",
  },
  statValueAccent: { color: "#FFFFFF" },
  statLabel: {
    color: COLORS.muted,
    fontWeight: "800",
    marginTop: 5,
  },
  statLabelAccent: { color: "#D1D5DB" },
  refreshButton: {
    backgroundColor: COLORS.red,
    marginHorizontal: 18,
    padding: 14,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    flexDirection: "row",
    gap: 8,
  },
  refreshText: { color: "#FFFFFF", fontWeight: "900" },
  settlementCard: {
    backgroundColor: COLORS.card,
    marginHorizontal: 18,
    marginBottom: 18,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  settlementTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 10,
  },
  settlementRow: {
    backgroundColor: COLORS.soft,
    borderRadius: 13,
    padding: 12,
    marginBottom: 8,
    flexDirection: "row",
    gap: 10,
  },
  settlementText: {
    flex: 1,
    color: COLORS.muted,
    fontWeight: "800",
  },
  settlementValue: {
    color: COLORS.text,
    fontWeight: "900",
  },
  settlementTotalRow: {
    backgroundColor: COLORS.black,
    borderRadius: 15,
    padding: 14,
    marginTop: 4,
  },
  settlementTotalLabel: {
    color: "#D1D5DB",
    fontWeight: "900",
    fontSize: 12,
    textTransform: "uppercase",
  },
  settlementTotal: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 24,
    marginTop: 4,
  },
  settlementNote: {
    color: COLORS.muted,
    lineHeight: 21,
    marginTop: 12,
    fontWeight: "700",
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "900",
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  emptyCard: {
    backgroundColor: COLORS.card,
    marginHorizontal: 18,
    marginBottom: 14,
    padding: 22,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 10,
    marginBottom: 6,
  },
  emptyText: {
    color: COLORS.muted,
    lineHeight: 21,
    fontWeight: "700",
    textAlign: "center",
  },
  loadCard: {
    backgroundColor: COLORS.card,
    marginHorizontal: 18,
    marginBottom: 14,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  loadHeader: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
    alignItems: "flex-start",
  },
  loadIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: COLORS.redSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  loadTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900",
  },
  commodity: {
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 3,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    maxWidth: 150,
  },
  statusText: { color: "#FFFFFF", fontWeight: "900", fontSize: 10 },
  routeBox: {
    backgroundColor: COLORS.soft,
    borderRadius: 16,
    padding: 13,
    marginBottom: 12,
  },
  routeStop: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  routeDotStart: {
    width: 12,
    height: 12,
    borderRadius: 999,
    backgroundColor: COLORS.green,
  },
  routeDotEnd: {
    width: 12,
    height: 12,
    borderRadius: 999,
    backgroundColor: COLORS.red,
  },
  routeLine: {
    width: 2,
    height: 22,
    backgroundColor: COLORS.border,
    marginLeft: 5,
    marginVertical: 7,
  },
  routeLabel: {
    color: COLORS.red,
    fontWeight: "900",
    fontSize: 11,
    textTransform: "uppercase",
    marginBottom: 3,
  },
  routeText: {
    color: COLORS.text,
    fontWeight: "800",
    lineHeight: 20,
  },
  metaText: {
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 8,
    lineHeight: 20,
  },
  payoutRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  payoutBox: {
    flex: 1,
    backgroundColor: COLORS.soft,
    borderRadius: 14,
    padding: 13,
  },
  payoutLabel: {
    color: COLORS.muted,
    fontWeight: "900",
    marginBottom: 4,
  },
  payoutValue: {
    color: COLORS.red,
    fontSize: 20,
    fontWeight: "900",
  },
  payoutDateBox: {
    backgroundColor: COLORS.redSoft,
    borderRadius: 13,
    padding: 12,
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  payoutDateText: {
    color: COLORS.red,
    fontWeight: "900",
    flex: 1,
  },
  actionButton: {
    backgroundColor: COLORS.red,
    padding: 13,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
  },
  actionText: { color: "#FFFFFF", fontWeight: "900" },
});