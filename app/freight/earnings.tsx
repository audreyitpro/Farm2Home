// app/freight/earnings.tsx

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
import freightTheme from "../styles/freightTheme";

type FreightLoad = any;

type EarningsStats = {
  totalEarnings: number;
  weeklyEarnings: number;
  monthlyEarnings: number;
  completedLoads: number;
  activeLoads: number;
  pendingPayouts: number;
  totalMiles: number;
  averageRate: number;
};

const ACTIVE_STATUSES = ["accepted", "picked_up", "in_transit", "arrived_dropoff"];

export default function FreightEarningsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [carrier, setCarrier] = useState<any>(null);
  const [loads, setLoads] = useState<FreightLoad[]>([]);

  const [stats, setStats] = useState<EarningsStats>({
    totalEarnings: 0,
    weeklyEarnings: 0,
    monthlyEarnings: 0,
    completedLoads: 0,
    activeLoads: 0,
    pendingPayouts: 0,
    totalMiles: 0,
    averageRate: 0,
  });

  useFocusEffect(
    useCallback(() => {
      loadEarnings();
    }, [])
  );

  const completedLoads = useMemo(
    () =>
      loads.filter(
        (item) => String(item.status || "").toLowerCase() === "delivered"
      ),
    [loads]
  );

  async function getCurrentCarrier() {
    const raw =
      (await AsyncStorage.getItem("currentFreightCarrier")) ||
      (await AsyncStorage.getItem("currentFreight")) ||
      (await AsyncStorage.getItem("currentUser"));

    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw);

      return {
        ...parsed,
        id: parsed.id || parsed.freightId || parsed.email,
        freightId: parsed.freightId || parsed.id || parsed.email,
        role: "freight",
        accountActive: parsed.accountActive !== false,
        membershipStatus: parsed.membershipStatus || "Active",
        subscriptionStatus: parsed.subscriptionStatus || "active",
      };
    } catch {
      return null;
    }
  }

  async function loadEarnings() {
    try {
      setLoading(true);

      const currentCarrier = await getCurrentCarrier();

      if (!currentCarrier) {
        router.replace("/freight/login" as any);
        return;
      }

      setCarrier(currentCarrier);

      await AsyncStorage.setItem("currentFreight", JSON.stringify(currentCarrier));
      await AsyncStorage.setItem(
        "currentFreightCarrier",
        JSON.stringify(currentCarrier)
      );
      await AsyncStorage.setItem("currentUser", JSON.stringify(currentCarrier));
      await AsyncStorage.setItem("userRole", "freight");
      await AsyncStorage.setItem("currentUserRole", "freight");

      const carrierId =
        currentCarrier.id || currentCarrier.freightId || currentCarrier.email || "";

      let cloudLoads: FreightLoad[] = [];

      try {
        const { data, error } = await supabase
          .from("freight_loads")
          .select("*")
          .or(`carrier_id.eq.${carrierId},driver_id.eq.${carrierId}`)
          .order("created_at", { ascending: false });

        if (error) {
          console.log("Freight earnings error:", error.message);
        } else {
          cloudLoads = Array.isArray(data) ? data : [];
        }
      } catch (error) {
        console.log("Freight earnings Supabase skipped:", error);
      }

      setLoads(cloudLoads);
      calculateStats(cloudLoads);
    } catch (error) {
      console.log("Freight earnings load crash:", error);
      Alert.alert("Earnings Error", "Unable to load freight earnings.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function calculateStats(items: FreightLoad[]) {
    const completed = items.filter(
      (item) => String(item.status || "").toLowerCase() === "delivered"
    );

    const active = items.filter((item) =>
      ACTIVE_STATUSES.includes(String(item.status || "").toLowerCase())
    );

    const now = new Date();

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);

    const totalEarnings = completed.reduce((sum, item) => sum + getRate(item), 0);

    const weeklyEarnings = completed
      .filter((item) => {
        const dateValue = item.delivered_at || item.updated_at || item.created_at;
        return dateValue ? new Date(dateValue) >= sevenDaysAgo : false;
      })
      .reduce((sum, item) => sum + getRate(item), 0);

    const monthlyEarnings = completed
      .filter((item) => {
        const dateValue = item.delivered_at || item.updated_at || item.created_at;
        return dateValue ? new Date(dateValue) >= thirtyDaysAgo : false;
      })
      .reduce((sum, item) => sum + getRate(item), 0);

    const totalMiles = completed.reduce((sum, item) => sum + getMiles(item), 0);

    const pendingPayouts = completed
      .filter((item) => {
        const payoutStatus = String(item.payout_status || "").toLowerCase();
        return payoutStatus !== "paid";
      })
      .reduce((sum, item) => sum + getRate(item), 0);

    setStats({
      totalEarnings,
      weeklyEarnings,
      monthlyEarnings,
      completedLoads: completed.length,
      activeLoads: active.length,
      pendingPayouts,
      totalMiles,
      averageRate: completed.length > 0 ? totalEarnings / completed.length : 0,
    });
  }

  function onRefresh() {
    setRefreshing(true);
    loadEarnings();
  }

  function getRate(item: FreightLoad) {
    return Number(item.rate || item.payoutAmount || item.payout_amount || item.total || 0);
  }

  function getMiles(item: FreightLoad) {
    return Number(item.distance_miles || item.miles || item.estimated_miles || 0);
  }

  function formatMoney(value: number) {
    return `$${Number(value || 0).toFixed(2)}`;
  }

  function formatDate(value?: string | null) {
    if (!value) return "Pending";

    try {
      return new Date(value).toLocaleDateString();
    } catch {
      return "Pending";
    }
  }

  function statusLabel(status?: string) {
    return String(status || "unknown")
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function carrierName() {
    return (
      carrier?.companyName ||
      carrier?.businessName ||
      carrier?.ownerName ||
      carrier?.fullName ||
      carrier?.email ||
      "Freight Connect Carrier"
    );
  }

  function payoutStatus(item: FreightLoad) {
    return item.payout_status || item.settlement_status || "Pending";
  }

  function renderLoad({ item }: { item: FreightLoad }) {
    const paid = String(payoutStatus(item)).toLowerCase() === "paid";

    return (
      <View style={styles.loadCard}>
        <View style={styles.loadHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.loadTitle}>{item.title || "Farm2Home Freight Load"}</Text>
            <Text style={styles.loadDate}>
              Delivered: {formatDate(item.delivered_at || item.updated_at)}
            </Text>
          </View>

          <View style={[styles.statusBadge, paid ? styles.paidBadge : styles.pendingBadge]}>
            <Text style={styles.statusText}>{payoutStatus(item)}</Text>
          </View>
        </View>

        <View style={styles.routeBox}>
          <View style={styles.routeStop}>
            <Ionicons name="radio-button-on" size={18} color="#10B981" />
            <Text style={styles.routeText}>
              {item.pickup_location || item.pickupLocation || "Pickup location"}
            </Text>
          </View>

          <View style={styles.routeLine} />

          <View style={styles.routeStop}>
            <Ionicons name="location" size={18} color="#10B981" />
            <Text style={styles.routeText}>
              {item.dropoff_location || item.dropoffLocation || "Dropoff location"}
            </Text>
          </View>
        </View>

        <View style={styles.metaGrid}>
          <View style={styles.metaBox}>
            <Text style={styles.metaLabel}>Payout</Text>
            <Text style={styles.metaValue}>{formatMoney(getRate(item))}</Text>
          </View>

          <View style={styles.metaBox}>
            <Text style={styles.metaLabel}>Miles</Text>
            <Text style={styles.metaValue}>{getMiles(item).toFixed(0)}</Text>
          </View>
        </View>

        <Text style={styles.detailText}>
          Status: {statusLabel(item.status)} · Farmer:{" "}
          {item.farmer_name || item.farmerName || "Farm2Home Farmer"}
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor="#020617" />
        <View style={styles.loadingScreen}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.loadingText}>Loading freight earnings...</Text>
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
              <Text style={styles.eyebrow}>Farm2Home Freight Connect</Text>
              <Text style={styles.title}>Freight Earnings</Text>
              <Text style={styles.subtitle}>
                Track carrier payouts, completed loads, route revenue, and
                settlement status.
              </Text>
            </View>

            <View style={styles.heroIcon}>
              <Ionicons name="cash-outline" size={34} color="#FFFFFF" />
            </View>
          </View>
        </View>

        <View style={styles.navRow}>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => router.push("/freight/dashboard" as any)}
          >
            <Ionicons name="grid-outline" size={18} color="#FFFFFF" />
            <Text style={styles.navText}>Dashboard</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navButtonOutline}
            onPress={() => router.push("/freight/board" as any)}
          >
            <Ionicons
              name="list-outline"
              size={18}
              color={freightTheme.colors.primary}
            />
            <Text style={styles.navTextOutline}>Board</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View style={styles.carrierCard}>
            <Text style={styles.carrierName}>🚛 {carrierName()}</Text>
            <Text style={styles.carrierMeta}>
              Earnings are calculated from delivered freight loads assigned to
              this carrier.
            </Text>
          </View>

          <View style={styles.statsGrid}>
            <StatCard label="Total Earnings" value={formatMoney(stats.totalEarnings)} icon="cash-outline" accent />
            <StatCard label="This Week" value={formatMoney(stats.weeklyEarnings)} icon="calendar-outline" accent />
            <StatCard label="This Month" value={formatMoney(stats.monthlyEarnings)} icon="trending-up-outline" />
            <StatCard label="Pending Payouts" value={formatMoney(stats.pendingPayouts)} icon="time-outline" />
            <StatCard label="Completed Loads" value={String(stats.completedLoads)} icon="checkmark-done-outline" />
            <StatCard label="Active Loads" value={String(stats.activeLoads)} icon="navigate-outline" />
            <StatCard label="Total Miles" value={stats.totalMiles.toFixed(0)} icon="speedometer-outline" />
            <StatCard label="Avg Load Pay" value={formatMoney(stats.averageRate)} icon="analytics-outline" />
          </View>

          <View style={styles.settlementCard}>
            <View style={styles.settlementHeader}>
              <Ionicons name="receipt-outline" size={24} color="#BBF7D0" />
              <Text style={styles.settlementTitle}>Settlement Summary</Text>
            </View>

            <Text style={styles.settlementText}>
              Completed freight revenue: {formatMoney(stats.totalEarnings)}
            </Text>
            <Text style={styles.settlementText}>
              Pending payout estimate: {formatMoney(stats.pendingPayouts)}
            </Text>
            <Text style={styles.settlementText}>
              Completed loads: {stats.completedLoads}
            </Text>
            <Text style={styles.settlementNote}>
              Final payout timing depends on proof of delivery, admin review,
              Stripe processing, and dispute checks.
            </Text>
          </View>

          <View style={styles.actionGrid}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push("/freight/profile" as any)}
            >
              <Ionicons name="business-outline" size={18} color="#FFFFFF" />
              <Text style={styles.actionText}>Payout Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButtonOutline}
              onPress={loadEarnings}
            >
              <Ionicons
                name="refresh-outline"
                size={18}
                color={freightTheme.colors.primary}
              />
              <Text style={styles.actionTextOutline}>Refresh</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>Completed Load Payments</Text>

          <FlatList
            data={completedLoads}
            keyExtractor={(item, index) => String(item.id || index)}
            scrollEnabled={false}
            contentContainerStyle={{ paddingBottom: 110 }}
            ListEmptyComponent={
              <View style={styles.emptyCard}>
                <Ionicons name="receipt-outline" size={38} color="#10B981" />
                <Text style={styles.emptyTitle}>No completed load payments yet.</Text>
                <Text style={styles.emptyText}>
                  Completed freight deliveries will appear here after delivery
                  confirmation.
                </Text>
              </View>
            }
            renderItem={renderLoad}
          />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function StatCard({
  label,
  value,
  icon,
  accent = false,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent?: boolean;
}) {
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

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: freightTheme.colors.background,
  },
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
  container: {
    flex: 1,
    backgroundColor: freightTheme.colors.background,
  },
  hero: {
    backgroundColor: "#020617",
    paddingTop: 22,
    paddingHorizontal: 20,
    paddingBottom: 26,
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  heroIcon: {
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
  navRow: {
    flexDirection: "row",
    gap: 10,
    padding: 18,
  },
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
  navText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  navTextOutline: {
    color: freightTheme.colors.primary,
    fontWeight: "900",
  },
  carrierCard: {
    backgroundColor: freightTheme.colors.card,
    marginHorizontal: 18,
    marginBottom: 14,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
  },
  carrierName: {
    color: freightTheme.colors.text,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 6,
  },
  carrierMeta: {
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
  statValueAccent: {
    color: "#FFFFFF",
  },
  statLabel: {
    color: freightTheme.colors.mutedText,
    fontWeight: "800",
    marginTop: 4,
  },
  statLabelAccent: {
    color: "#BBF7D0",
  },
  settlementCard: {
    backgroundColor: "#064E3B",
    marginHorizontal: 18,
    marginBottom: 16,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#10B981",
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
  settlementNote: {
    color: "#D1FAE5",
    lineHeight: 22,
    marginTop: 8,
    fontWeight: "700",
  },
  actionGrid: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 18,
    marginBottom: 18,
  },
  actionButton: {
    flex: 1,
    backgroundColor: freightTheme.colors.primary,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  actionButtonOutline: {
    flex: 1,
    backgroundColor: freightTheme.colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: freightTheme.colors.primary,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  actionText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  actionTextOutline: {
    color: freightTheme.colors.primary,
    fontWeight: "900",
  },
  sectionTitle: {
    color: freightTheme.colors.text,
    fontSize: 24,
    fontWeight: "900",
    paddingHorizontal: 18,
    marginBottom: 12,
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
    alignItems: "flex-start",
    marginBottom: 12,
  },
  loadTitle: {
    color: freightTheme.colors.text,
    fontSize: 20,
    fontWeight: "900",
  },
  loadDate: {
    color: freightTheme.colors.mutedText,
    fontWeight: "700",
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  paidBadge: {
    backgroundColor: "#10B981",
  },
  pendingBadge: {
    backgroundColor: "#F59E0B",
  },
  statusText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 11,
    textTransform: "capitalize",
  },
  routeBox: {
    backgroundColor: freightTheme.colors.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
  },
  routeStop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
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
    fontSize: 15,
    flex: 1,
    lineHeight: 21,
  },
  metaGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  metaBox: {
    flex: 1,
    backgroundColor: freightTheme.colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
  },
  metaLabel: {
    color: freightTheme.colors.mutedText,
    fontWeight: "900",
    marginBottom: 4,
  },
  metaValue: {
    color: freightTheme.colors.primary,
    fontSize: 22,
    fontWeight: "900",
  },
  detailText: {
    color: freightTheme.colors.mutedText,
    fontWeight: "700",
    lineHeight: 21,
  },
  emptyCard: {
    backgroundColor: freightTheme.colors.card,
    marginHorizontal: 18,
    marginBottom: 16,
    padding: 24,
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
});