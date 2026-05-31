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
import freightTheme from "../styles/freightTheme";

type FreightLoad = any;

type EarningStats = {
  totalEarnings: number;
  weeklyEarnings: number;
  completedLoads: number;
  activeLoads: number;
  totalMiles: number;
  averageLoadPay: number;
  bonusEstimate: number;
};

const TABLE_NAME = "freight_loads";

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

export default function DriverEarnings() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [driver, setDriver] = useState<any>(null);
  const [loads, setLoads] = useState<FreightLoad[]>([]);
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
    () => loads.filter((item) => normalize(item.status) === "delivered"),
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
        dbDriver?.membership_status ||
        stored?.membershipStatus ||
        "Active",
      subscriptionStatus:
        dbDriver?.subscription_status ||
        stored?.subscriptionStatus ||
        "active",
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
    if (subscriptionStatus === "canceled") return false;
    if (subscriptionStatus === "past_due") return false;
    if (subscriptionStatus === "unpaid") return false;

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

      let cloudLoads: FreightLoad[] = [];

      try {
        const { data, error } = await supabase
          .from(TABLE_NAME)
          .select("*")
          .or(
            `driver_id.eq.${driverId},carrier_id.eq.${driverId},assigned_driver_id.eq.${driverId}`
          )
          .order("created_at", { ascending: false });

        if (error) {
          console.log("DRIVER_EARNINGS_ERROR:", error.message);
        } else {
          cloudLoads = Array.isArray(data) ? data : [];
        }
      } catch (error) {
        console.log("Supabase earnings skipped:", error);
      }

      setLoads(cloudLoads);
      calculateStats(cloudLoads);
    } catch (error) {
      console.log("LOAD_EARNINGS_CRASH:", error);
      Alert.alert("Earnings Error", "Unable to load driver earnings.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function calculateStats(driverLoads: FreightLoad[]) {
    const completed = driverLoads.filter(
      (item) => normalize(item.status) === "delivered"
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

    const totalEarnings = completed.reduce(
      (sum, item) => sum + getLoadPay(item),
      0
    );

    const weeklyEarnings = weeklyCompleted.reduce(
      (sum, item) => sum + getLoadPay(item),
      0
    );

    const totalMiles = completed.reduce(
      (sum, item) => sum + getLoadMiles(item),
      0
    );

    const averageLoadPay =
      completed.length > 0 ? totalEarnings / completed.length : 0;

    const bonusEstimate =
      completed.length >= 10 ? 150 : completed.length >= 5 ? 50 : 0;

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

  function formatMoney(value: number) {
    return `$${Number(value || 0).toFixed(2)}`;
  }

  function statusColor(status?: string | null) {
    switch (normalize(status)) {
      case "delivered":
        return "#10B981";
      case "in_transit":
        return "#0F766E";
      case "picked_up":
        return "#F59E0B";
      case "accepted":
      case "booked":
      case "arrived_pickup":
      case "arrived_dropoff":
        return "#7C3AED";
      case "available":
      case "open":
        return "#2563EB";
      case "cancelled":
        return "#DC2626";
      default:
        return "#64748B";
    }
  }

  function statusLabel(status?: string | null) {
    return String(status || "unknown")
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function estimatedPayoutDate(deliveredAt?: string | null) {
    if (!deliveredAt) return "Pending";

    const payoutDate = new Date(deliveredAt);
    payoutDate.setDate(payoutDate.getDate() + 7);

    return payoutDate.toLocaleDateString();
  }

  function getLoadPay(item: FreightLoad) {
    return Number(
      item.rate ||
        item.deliveryFee ||
        item.delivery_fee ||
        item.driver_payout ||
        item.payout ||
        item.total ||
        0
    );
  }

  function getLoadMiles(item: FreightLoad) {
    return Number(
      item.distance_miles ||
        item.estimatedMiles ||
        item.estimated_miles ||
        item.miles ||
        0
    );
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

  function renderStat(
    label: string,
    value: string | number,
    icon: keyof typeof Ionicons.glyphMap,
    accent = false
  ) {
    return (
      <View style={[styles.statCard, accent && styles.statCardAccent]}>
        <Ionicons
          name={icon}
          size={22}
          color={accent ? "#BBF7D0" : freightTheme.colors.primary}
        />
        <Text style={[styles.statValue, accent && styles.statValueAccent]}>
          {value}
        </Text>
        <Text style={[styles.statLabel, accent && styles.statLabelAccent]}>
          {label}
        </Text>
      </View>
    );
  }

  function renderLoadCard(item: FreightLoad, completed = false) {
    return (
      <View style={styles.loadCard}>
        <View style={styles.loadHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.loadTitle}>{item.title || "Farm2Home Load"}</Text>
            <Text style={styles.commodity}>{item.commodity || "Farm Goods"}</Text>
          </View>

          <View
            style={[
              styles.statusBadge,
              { backgroundColor: statusColor(item.status) },
            ]}
          >
            <Text style={styles.statusText}>{statusLabel(item.status)}</Text>
          </View>
        </View>

        <View style={styles.routeBox}>
          <View style={styles.routeStop}>
            <Ionicons name="radio-button-on" size={18} color="#10B981" />
            <Text style={styles.routeText}>
              {item.pickup_location ||
                item.pickup_city ||
                item.pickupCity ||
                "Pickup location"}
            </Text>
          </View>

          <View style={styles.routeLine} />

          <View style={styles.routeStop}>
            <Ionicons name="location" size={18} color="#10B981" />
            <Text style={styles.routeText}>
              {item.dropoff_location ||
                item.delivery_city ||
                item.deliveryCity ||
                "Dropoff location"}
            </Text>
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
          Farmer: {item.farmer_name || item.farmers?.farm_name || "Farm2Home Farmer"}
        </Text>

        {completed ? (
          <Text style={styles.metaText}>
            Estimated payout date: {estimatedPayoutDate(item.delivered_at)}
          </Text>
        ) : (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() =>
              router.push({
                pathname: "/driver/live-location-provider",
                params: { loadId: item.id, orderId: item.id },
              } as any)
            }
          >
            <Ionicons name="navigate-outline" size={18} color="#FFFFFF" />
            <Text style={styles.actionText}>Open Load Workflow</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor="#020617" />
        <View style={styles.loadingScreen}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.loadingText}>Loading earnings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#020617" />

      <View style={styles.container}>
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>Farm2Home Driver</Text>
              <Text style={styles.title}>Earnings Center</Text>
              <Text style={styles.subtitle}>
                Track completed delivery payouts, weekly earnings, mileage,
                bonuses, and settlement estimates.
              </Text>
            </View>

            <View style={styles.walletIcon}>
              <Ionicons name="wallet-outline" size={34} color="#FFFFFF" />
            </View>
          </View>
        </View>

        <View style={styles.navRow}>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => router.push("/driver/mobile-driver-app" as any)}
          >
            <Ionicons name="phone-portrait-outline" size={18} color="#FFFFFF" />
            <Text style={styles.navText}>Driver App</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navButtonOutline}
            onPress={() => router.push("/driver/profile" as any)}
          >
            <Ionicons
              name="person-outline"
              size={18}
              color={freightTheme.colors.primary}
            />
            <Text style={styles.navTextOutline}>Profile</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View style={styles.driverCard}>
            <Text style={styles.driverName}>🚚 {getDriverName()}</Text>
            <Text style={styles.driverMeta}>
              Earnings are calculated from delivered loads assigned to this driver.
            </Text>
          </View>

          <View style={styles.statsGrid}>
            {renderStat("Total Earnings", formatMoney(stats.totalEarnings), "cash-outline", true)}
            {renderStat("Weekly Earnings", formatMoney(stats.weeklyEarnings), "calendar-outline", true)}
            {renderStat("Completed Loads", stats.completedLoads, "checkmark-done-outline")}
            {renderStat("Active Loads", stats.activeLoads, "navigate-outline")}
            {renderStat("Total Miles", stats.totalMiles.toFixed(0), "speedometer-outline")}
            {renderStat("Avg Load Pay", formatMoney(stats.averageLoadPay), "trending-up-outline")}
            {renderStat("Bonus Estimate", formatMoney(stats.bonusEstimate), "gift-outline", true)}
          </View>

          <TouchableOpacity style={styles.refreshButton} onPress={loadEarnings}>
            <Ionicons name="refresh-outline" size={18} color="#FFFFFF" />
            <Text style={styles.refreshText}>Refresh Earnings</Text>
          </TouchableOpacity>

          <View style={styles.settlementCard}>
            <View style={styles.settlementHeader}>
              <Ionicons name="receipt-outline" size={24} color="#BBF7D0" />
              <Text style={styles.settlementTitle}>Settlement Summary</Text>
            </View>

            <Text style={styles.settlementText}>
              Completed load payout: {formatMoney(stats.totalEarnings)}
            </Text>
            <Text style={styles.settlementText}>
              Bonus estimate: {formatMoney(stats.bonusEstimate)}
            </Text>
            <Text style={styles.settlementTotal}>
              Estimated total settlement:{" "}
              {formatMoney(stats.totalEarnings + stats.bonusEstimate)}
            </Text>
            <Text style={styles.settlementNote}>
              Final payout timing depends on admin approval, payment processor,
              dispute checks, and proof-of-delivery verification.
            </Text>
          </View>

          <Text style={styles.sectionTitle}>Active Loads</Text>

          <FlatList
            data={activeLoads}
            keyExtractor={(item, index) => String(item.id || index)}
            scrollEnabled={false}
            ListEmptyComponent={
              <View style={styles.emptyCard}>
                <Ionicons name="navigate-circle-outline" size={34} color="#10B981" />
                <Text style={styles.emptyTitle}>No active loads.</Text>
                <Text style={styles.emptyText}>
                  Accepted and in-transit loads will appear here.
                </Text>
              </View>
            }
            renderItem={({ item }) => renderLoadCard(item, false)}
          />

          <Text style={styles.sectionTitle}>Completed Loads</Text>

          <FlatList
            data={completedLoads}
            keyExtractor={(item, index) => String(item.id || index)}
            scrollEnabled={false}
            contentContainerStyle={{ paddingBottom: 110 }}
            ListEmptyComponent={
              <View style={styles.emptyCard}>
                <Ionicons name="checkmark-done-circle-outline" size={34} color="#10B981" />
                <Text style={styles.emptyTitle}>No completed loads yet.</Text>
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: freightTheme.colors.background },
  loadingScreen: {
    flex: 1,
    backgroundColor: freightTheme.colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: freightTheme.colors.mutedText,
    marginTop: 10,
    fontWeight: "800",
  },
  container: { flex: 1, backgroundColor: freightTheme.colors.background },
  hero: {
    backgroundColor: "#020617",
    paddingTop: 22,
    paddingHorizontal: 20,
    paddingBottom: 26,
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
  },
  heroTop: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  walletIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#064E3B",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#10B981",
  },
  eyebrow: {
    color: "#10B981",
    fontWeight: "900",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900",
    marginBottom: 10,
  },
  subtitle: {
    color: "#D1D5DB",
    lineHeight: 23,
    fontSize: 15,
    fontWeight: "700",
  },
  navRow: { flexDirection: "row", gap: 10, padding: 18 },
  navButton: {
    flex: 1,
    backgroundColor: freightTheme.colors.primary,
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  navButtonOutline: {
    flex: 1,
    backgroundColor: freightTheme.colors.card,
    borderWidth: 1,
    borderColor: freightTheme.colors.primary,
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  navText: { color: "#FFFFFF", fontWeight: "900" },
  navTextOutline: { color: freightTheme.colors.primary, fontWeight: "900" },
  driverCard: {
    backgroundColor: freightTheme.colors.card,
    marginHorizontal: 18,
    marginBottom: 14,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
  },
  driverName: {
    color: freightTheme.colors.text,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 6,
  },
  driverMeta: {
    color: freightTheme.colors.mutedText,
    fontWeight: "700",
    lineHeight: 22,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  statCard: {
    width: "48%",
    backgroundColor: freightTheme.colors.card,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
    borderRadius: 18,
    padding: 14,
  },
  statCardAccent: {
    backgroundColor: "#064E3B",
    borderColor: "#064E3B",
  },
  statValue: {
    color: freightTheme.colors.primary,
    fontSize: 22,
    fontWeight: "900",
    marginTop: 8,
  },
  statValueAccent: { color: "#FFFFFF" },
  statLabel: {
    color: freightTheme.colors.mutedText,
    fontWeight: "800",
    marginTop: 4,
  },
  statLabelAccent: { color: "#BBF7D0" },
  refreshButton: {
    backgroundColor: "#334155",
    marginHorizontal: 18,
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
    flexDirection: "row",
    gap: 8,
  },
  refreshText: { color: "#FFFFFF", fontWeight: "900" },
  settlementCard: {
    backgroundColor: "#064E3B",
    marginHorizontal: 18,
    marginBottom: 18,
    borderRadius: 20,
    padding: 18,
  },
  settlementHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  settlementTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
  },
  settlementText: {
    color: "#BBF7D0",
    fontWeight: "800",
    marginBottom: 6,
    lineHeight: 22,
  },
  settlementTotal: {
    color: "#FFFFFF",
    fontWeight: "900",
    marginTop: 4,
    marginBottom: 6,
    lineHeight: 22,
  },
  settlementNote: {
    color: "#D1FAE5",
    lineHeight: 22,
    marginTop: 8,
    fontWeight: "700",
  },
  sectionTitle: {
    color: freightTheme.colors.text,
    fontSize: 24,
    fontWeight: "900",
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  emptyCard: {
    backgroundColor: freightTheme.colors.card,
    marginHorizontal: 18,
    marginBottom: 16,
    padding: 22,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
    alignItems: "center",
  },
  emptyTitle: {
    color: freightTheme.colors.text,
    fontSize: 20,
    fontWeight: "900",
    marginTop: 10,
    marginBottom: 6,
  },
  emptyText: {
    color: freightTheme.colors.mutedText,
    lineHeight: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  loadCard: {
    backgroundColor: freightTheme.colors.card,
    marginHorizontal: 18,
    marginBottom: 16,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
  },
  loadHeader: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
    alignItems: "flex-start",
  },
  loadTitle: {
    color: freightTheme.colors.text,
    fontSize: 21,
    fontWeight: "900",
  },
  commodity: {
    color: freightTheme.colors.mutedText,
    fontWeight: "700",
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    maxWidth: 150,
  },
  statusText: { color: "#FFFFFF", fontWeight: "900", fontSize: 11 },
  routeBox: {
    backgroundColor: freightTheme.colors.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  routeStop: { flexDirection: "row", alignItems: "center", gap: 10 },
  routeLine: {
    width: 2,
    height: 22,
    backgroundColor: freightTheme.colors.border,
    marginLeft: 8,
    marginVertical: 8,
  },
  routeText: {
    color: freightTheme.colors.text,
    fontWeight: "900",
    fontSize: 16,
    flex: 1,
    lineHeight: 21,
  },
  metaText: {
    color: freightTheme.colors.mutedText,
    fontWeight: "700",
    marginTop: 8,
    lineHeight: 21,
  },
  payoutRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  payoutBox: {
    flex: 1,
    backgroundColor: freightTheme.colors.surface,
    borderRadius: 16,
    padding: 14,
  },
  payoutLabel: {
    color: freightTheme.colors.mutedText,
    fontWeight: "900",
    marginBottom: 4,
  },
  payoutValue: {
    color: freightTheme.colors.primary,
    fontSize: 22,
    fontWeight: "900",
  },
  actionButton: {
    backgroundColor: freightTheme.colors.primary,
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
  },
  actionText: { color: "#FFFFFF", fontWeight: "900" },
});