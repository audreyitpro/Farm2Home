import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";

import { supabase } from "../data/supabaseClient";

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

  async function getCurrentDriver() {
    const raw =
      (await AsyncStorage.getItem("currentDriver")) ||
      (await AsyncStorage.getItem("currentUser"));

    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw);

      if (parsed?.role && parsed.role !== "driver") return null;

      const normalized = {
        ...parsed,
        id: parsed.id || parsed.driverId || parsed.email || `driver_${Date.now()}`,
        driverId:
          parsed.driverId || parsed.id || parsed.email || `driver_${Date.now()}`,
        role: "driver",
        accountActive: parsed.accountActive !== false,
        membershipStatus: parsed.membershipStatus || "Active",
        subscriptionStatus: parsed.subscriptionStatus || "active",
      };

      await AsyncStorage.setItem("currentDriver", JSON.stringify(normalized));
      await AsyncStorage.setItem("currentUser", JSON.stringify(normalized));
      await AsyncStorage.setItem("userRole", "driver");
      await AsyncStorage.setItem("currentUserRole", "driver");

      return normalized;
    } catch {
      return null;
    }
  }

  async function loadEarnings() {
    try {
      setLoading(true);

      const currentDriver = await getCurrentDriver();

      if (!currentDriver) {
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
          .or(`driver_id.eq.${driverId},carrier_id.eq.${driverId}`)
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
      (item) => String(item.status || "").toLowerCase() === "delivered"
    );

    const active = driverLoads.filter((item) =>
      [
        "accepted",
        "booked",
        "arrived_pickup",
        "picked_up",
        "in_transit",
        "arrived_dropoff",
      ].includes(String(item.status || "").toLowerCase())
    );

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const weeklyCompleted = completed.filter((item) => {
      const dateValue = item.delivered_at || item.created_at;
      if (!dateValue) return false;
      return new Date(dateValue) >= sevenDaysAgo;
    });

    const totalEarnings = completed.reduce(
      (sum, item) => sum + Number(item.rate || item.deliveryFee || item.total || 0),
      0
    );

    const weeklyEarnings = weeklyCompleted.reduce(
      (sum, item) => sum + Number(item.rate || item.deliveryFee || item.total || 0),
      0
    );

    const totalMiles = completed.reduce(
      (sum, item) => sum + Number(item.distance_miles || 0),
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

  const completedLoads = useMemo(
    () => loads.filter((item) => String(item.status || "").toLowerCase() === "delivered"),
    [loads]
  );

  const activeLoads = useMemo(
    () =>
      loads.filter((item) =>
        [
          "accepted",
          "booked",
          "arrived_pickup",
          "picked_up",
          "in_transit",
          "arrived_dropoff",
        ].includes(String(item.status || "").toLowerCase())
      ),
    [loads]
  );

  function onRefresh() {
    setRefreshing(true);
    loadEarnings();
  }

  function formatMoney(value: number) {
    return `$${Number(value || 0).toFixed(2)}`;
  }

  function statusColor(status?: string | null) {
    switch (String(status || "").toLowerCase()) {
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
    return String(status || "unknown").replace(/_/g, " ");
  }

  function estimatedPayoutDate(deliveredAt?: string | null) {
    if (!deliveredAt) return "Pending";

    const payoutDate = new Date(deliveredAt);
    payoutDate.setDate(payoutDate.getDate() + 7);

    return payoutDate.toLocaleDateString();
  }

  function renderStat(label: string, value: string | number, accent = false) {
    return (
      <View style={[styles.statCard, accent && styles.statCardAccent]}>
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

        <Text style={styles.routeText}>
          📍 {item.pickup_location || item.pickup_city || "Pickup location"}
        </Text>

        <Text style={styles.arrow}>→</Text>

        <Text style={styles.routeText}>
          🏁 {item.dropoff_location || item.delivery_city || "Dropoff location"}
        </Text>

        <View style={styles.payoutRow}>
          <View>
            <Text style={styles.payoutLabel}>Payout</Text>
            <Text style={styles.payoutValue}>
              {formatMoney(Number(item.rate || item.deliveryFee || item.total || 0))}
            </Text>
          </View>

          <View>
            <Text style={styles.payoutLabel}>Miles</Text>
            <Text style={styles.payoutValue}>
              {Number(item.distance_miles || 0).toFixed(0)}
            </Text>
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
                params: { loadId: item.id },
              } as any)
            }
          >
            <Text style={styles.actionText}>Open Load Workflow</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={styles.loadingText}>Loading earnings...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Farm2Home Driver</Text>
        <Text style={styles.title}>Earnings Center</Text>
        <Text style={styles.subtitle}>
          Track completed load payouts, weekly earnings, mileage, bonuses, and
          settlement estimates.
        </Text>
      </View>

      <View style={styles.navRow}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => router.push("/driver/mobile-driver-app" as any)}
        >
          <Text style={styles.navText}>Driver App</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButtonOutline}
          onPress={() => router.push("/driver/profile" as any)}
        >
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
          <Text style={styles.driverName}>
            🚚 {driver?.fullName || driver?.name || driver?.username || "Farm2Home Driver"}
          </Text>
          <Text style={styles.driverMeta}>
            Earnings are calculated from delivered loads assigned to this driver.
          </Text>
        </View>

        <View style={styles.statsGrid}>
          {renderStat("Total Earnings", formatMoney(stats.totalEarnings), true)}
          {renderStat("Weekly Earnings", formatMoney(stats.weeklyEarnings), true)}
          {renderStat("Completed Loads", stats.completedLoads)}
          {renderStat("Active Loads", stats.activeLoads)}
          {renderStat("Total Miles", stats.totalMiles.toFixed(0))}
          {renderStat("Avg Load Pay", formatMoney(stats.averageLoadPay))}
          {renderStat("Bonus Estimate", formatMoney(stats.bonusEstimate), true)}
        </View>

        <TouchableOpacity style={styles.refreshButton} onPress={loadEarnings}>
          <Text style={styles.refreshText}>Refresh Earnings</Text>
        </TouchableOpacity>

        <View style={styles.settlementCard}>
          <Text style={styles.settlementTitle}>Settlement Summary</Text>
          <Text style={styles.settlementText}>
            Completed load payout: {formatMoney(stats.totalEarnings)}
          </Text>
          <Text style={styles.settlementText}>
            Bonus estimate: {formatMoney(stats.bonusEstimate)}
          </Text>
          <Text style={styles.settlementText}>
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
          keyExtractor={(item) => String(item.id)}
          scrollEnabled={false}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
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
          keyExtractor={(item) => String(item.id)}
          scrollEnabled={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
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
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    backgroundColor: "#F7F7F2",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: { color: "#4B5563", marginTop: 10, fontWeight: "800" },
  container: { flex: 1, backgroundColor: "#F7F7F2" },
  hero: {
    backgroundColor: "#111827",
    paddingTop: 62,
    paddingHorizontal: 20,
    paddingBottom: 26,
  },
  eyebrow: { color: "#10B981", fontWeight: "900", marginBottom: 8 },
  title: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900",
    marginBottom: 10,
  },
  subtitle: { color: "#D1D5DB", lineHeight: 23, fontSize: 15 },
  navRow: { flexDirection: "row", gap: 10, padding: 18 },
  navButton: {
    flex: 1,
    backgroundColor: "#10B981",
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  navButtonOutline: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#10B981",
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  navText: { color: "#FFFFFF", fontWeight: "900" },
  navTextOutline: { color: "#10B981", fontWeight: "900" },
  driverCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    marginBottom: 14,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  driverName: {
    color: "#111827",
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 6,
  },
  driverMeta: { color: "#6B7280", fontWeight: "700" },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  statCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 18,
    padding: 14,
  },
  statCardAccent: { backgroundColor: "#064E3B", borderColor: "#064E3B" },
  statValue: { color: "#10B981", fontSize: 22, fontWeight: "900" },
  statValueAccent: { color: "#FFFFFF" },
  statLabel: { color: "#6B7280", fontWeight: "800", marginTop: 4 },
  statLabelAccent: { color: "#BBF7D0" },
  refreshButton: {
    backgroundColor: "#334155",
    marginHorizontal: 18,
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 18,
  },
  refreshText: { color: "#FFFFFF", fontWeight: "900" },
  settlementCard: {
    backgroundColor: "#064E3B",
    marginHorizontal: 18,
    marginBottom: 18,
    borderRadius: 20,
    padding: 18,
  },
  settlementTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 10,
  },
  settlementText: {
    color: "#BBF7D0",
    fontWeight: "800",
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
    color: "#111827",
    fontSize: 24,
    fontWeight: "900",
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    marginBottom: 16,
    padding: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  emptyTitle: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 6,
  },
  emptyText: { color: "#6B7280", lineHeight: 22, fontWeight: "700" },
  loadCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    marginBottom: 16,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  loadHeader: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
    alignItems: "flex-start",
  },
  loadTitle: { color: "#111827", fontSize: 21, fontWeight: "900" },
  commodity: { color: "#6B7280", fontWeight: "700", marginTop: 4 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  statusText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 11,
    textTransform: "capitalize",
  },
  routeText: { color: "#111827", fontWeight: "900", fontSize: 16 },
  arrow: { color: "#10B981", fontWeight: "900", fontSize: 20, marginVertical: 4 },
  metaText: { color: "#6B7280", fontWeight: "700", marginTop: 8, lineHeight: 21 },
  payoutRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#F3F4F6",
    borderRadius: 16,
    padding: 14,
    marginTop: 12,
  },
  payoutLabel: { color: "#6B7280", fontWeight: "900", marginBottom: 4 },
  payoutValue: { color: "#10B981", fontSize: 22, fontWeight: "900" },
  actionButton: {
    backgroundColor: "#10B981",
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 12,
  },
  actionText: { color: "#FFFFFF", fontWeight: "900" },
});