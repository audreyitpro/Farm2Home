import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";

import { supabase } from "../data/supabaseClient";

type AnalyticsStats = {
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  activeOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  totalLoads: number;
  openLoads: number;
  bookedLoads: number;
  deliveredLoads: number;
  freightRevenue: number;
  pendingVerifications: number;
  approvedFarmers: number;
  approvedCarriers: number;
};

type TopFarm = {
  farmer_id: string;
  farm_name: string;
  revenue: number;
  orders: number;
};

type StatusMetric = {
  status: string;
  count: number;
};

export default function AdminAnalyticsCenter() {
  const [loading, setLoading] = useState(false);

  const [stats, setStats] = useState<AnalyticsStats>({
    totalRevenue: 0,
    totalOrders: 0,
    avgOrderValue: 0,
    activeOrders: 0,
    deliveredOrders: 0,
    cancelledOrders: 0,
    totalLoads: 0,
    openLoads: 0,
    bookedLoads: 0,
    deliveredLoads: 0,
    freightRevenue: 0,
    pendingVerifications: 0,
    approvedFarmers: 0,
    approvedCarriers: 0,
  });

  const [orderStatuses, setOrderStatuses] = useState<StatusMetric[]>([]);
  const [loadStatuses, setLoadStatuses] = useState<StatusMetric[]>([]);
  const [topFarms, setTopFarms] = useState<TopFarm[]>([]);

  useFocusEffect(
    React.useCallback(() => {
      loadAnalytics();
    }, [])
  );

  async function loadAnalytics() {
    try {
      setLoading(true);

      const { data: orders, error: orderError } = await supabase
        .from("orders")
        .select(
          `
          *,
          farmers (
            id,
            farm_name
          )
        `
        );

      if (orderError) {
        console.log("Analytics orders error:", orderError.message);
      }

      const { data: loads, error: loadError } = await supabase
        .from("freight_loads")
        .select("*");

      if (loadError) {
        console.log("Analytics loads error:", loadError.message);
      }

      const { data: verifications, error: verificationError } = await supabase
        .from("verification_records")
        .select("*");

      if (verificationError) {
        console.log("Analytics verification error:", verificationError.message);
      }

      const { data: farmers, error: farmerError } = await supabase
        .from("farmers")
        .select("*");

      if (farmerError) {
        console.log("Analytics farmers error:", farmerError.message);
      }

      const { data: carriers, error: carrierError } = await supabase
        .from("freight_carriers")
        .select("*");

      if (carrierError) {
        console.log("Analytics carriers error:", carrierError.message);
      }

      const orderRows = orders || [];
      const loadRows = loads || [];
      const verificationRows = verifications || [];
      const farmerRows = farmers || [];
      const carrierRows = carriers || [];

      const totalRevenue = orderRows.reduce(
        (sum: number, item: any) => sum + Number(item.total || 0),
        0
      );

      const freightRevenue = loadRows.reduce(
        (sum: number, item: any) => sum + Number(item.rate || 0),
        0
      );

      const activeOrderStatuses = [
        "PAID",
        "ACCEPTED",
        "PREPARING",
        "READY_FOR_PICKUP",
        "PICKED_UP",
        "IN_TRANSIT",
        "PENDING_PAYMENT",
      ];

      const pendingVerificationStatuses = [
        "PENDING",
        "PENDING_VERIFICATION",
        "DOCUMENTS_SUBMITTED",
      ];

      const orderStatusCounts = buildStatusCounts(orderRows, "status");
      const loadStatusCounts = buildStatusCounts(loadRows, "status");
      const farmRevenue = buildTopFarmRevenue(orderRows);

      setOrderStatuses(orderStatusCounts);
      setLoadStatuses(loadStatusCounts);
      setTopFarms(farmRevenue);

      setStats({
        totalRevenue,
        totalOrders: orderRows.length,
        avgOrderValue: orderRows.length > 0 ? totalRevenue / orderRows.length : 0,
        activeOrders: orderRows.filter((item: any) =>
          activeOrderStatuses.includes(item.status)
        ).length,
        deliveredOrders: orderRows.filter(
          (item: any) => item.status === "DELIVERED"
        ).length,
        cancelledOrders: orderRows.filter(
          (item: any) =>
            item.status === "CANCELLED" || item.status === "REFUNDED"
        ).length,
        totalLoads: loadRows.length,
        openLoads: loadRows.filter((item: any) => item.status === "OPEN").length,
        bookedLoads: loadRows.filter(
          (item: any) => item.status === "BOOKED" || item.status === "ACCEPTED"
        ).length,
        deliveredLoads: loadRows.filter(
          (item: any) => item.status === "DELIVERED"
        ).length,
        freightRevenue,
        pendingVerifications: verificationRows.filter((item: any) =>
          pendingVerificationStatuses.includes(item.status)
        ).length,
        approvedFarmers: farmerRows.filter((item: any) => item.approved).length,
        approvedCarriers: carrierRows.filter((item: any) => item.approved)
          .length,
      });
    } catch (error) {
      console.log("Analytics load error:", error);
      Alert.alert("Analytics Error", "Unable to load analytics data.");
    } finally {
      setLoading(false);
    }
  }

  function buildStatusCounts(rows: any[], field: string): StatusMetric[] {
    const counts: Record<string, number> = {};

    rows.forEach((row) => {
      const status = row[field] || "UNKNOWN";
      counts[status] = (counts[status] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([status, count]) => ({
        status,
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }

  function buildTopFarmRevenue(orderRows: any[]): TopFarm[] {
    const farmMap: Record<string, TopFarm> = {};

    orderRows.forEach((order: any) => {
      const farmerId = order.farmer_id || "unknown";
      const farmName = order.farmers?.farm_name || "Unknown Farm";

      if (!farmMap[farmerId]) {
        farmMap[farmerId] = {
          farmer_id: farmerId,
          farm_name: farmName,
          revenue: 0,
          orders: 0,
        };
      }

      farmMap[farmerId].revenue += Number(order.total || 0);
      farmMap[farmerId].orders += 1;
    });

    return Object.values(farmMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }

  function formatMoney(value: number) {
    return `$${Number(value || 0).toFixed(2)}`;
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

  function renderBar(item: StatusMetric, maxCount: number, color: string) {
    const widthPercent =
      maxCount > 0 ? Math.max(12, (item.count / maxCount) * 100) : 12;

    return (
      <View style={styles.barRow}>
        <View style={styles.barLabelRow}>
          <Text style={styles.barLabel}>{item.status}</Text>
          <Text style={styles.barCount}>{item.count}</Text>
        </View>

        <View style={styles.barTrack}>
          <View
            style={[
              styles.barFill,
              {
                width: `${widthPercent}%`,
                backgroundColor: color,
              },
            ]}
          />
        </View>
      </View>
    );
  }

  const maxOrderStatus = Math.max(1, ...orderStatuses.map((item) => item.count));
  const maxLoadStatus = Math.max(1, ...loadStatuses.map((item) => item.count));

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Farm2Home Admin</Text>
        <Text style={styles.title}>Analytics Center</Text>
        <Text style={styles.subtitle}>
          Track revenue, orders, freight performance, verification volume, farm
          growth, and marketplace activity.
        </Text>
      </View>

      <View style={styles.navRow}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => router.push("/admin/control-tower")}
        >
          <Text style={styles.navText}>Control Tower</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButtonOutline}
          onPress={() => router.push("/ai/dispatch-dashboard")}
        >
          <Text style={styles.navTextOutline}>AI Dispatch</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.loadingText}>Loading analytics...</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.statsGrid}>
            {renderStat("Marketplace Revenue", formatMoney(stats.totalRevenue), true)}
            {renderStat("Freight Revenue", formatMoney(stats.freightRevenue), true)}
            {renderStat("Total Orders", stats.totalOrders)}
            {renderStat("Avg Order Value", formatMoney(stats.avgOrderValue))}
            {renderStat("Active Orders", stats.activeOrders)}
            {renderStat("Delivered Orders", stats.deliveredOrders)}
            {renderStat("Cancelled / Refunded", stats.cancelledOrders)}
            {renderStat("Total Loads", stats.totalLoads)}
            {renderStat("Open Loads", stats.openLoads)}
            {renderStat("Booked Loads", stats.bookedLoads)}
            {renderStat("Delivered Loads", stats.deliveredLoads)}
            {renderStat("Pending Reviews", stats.pendingVerifications)}
            {renderStat("Approved Farmers", stats.approvedFarmers)}
            {renderStat("Approved Carriers", stats.approvedCarriers)}
          </View>

          <TouchableOpacity style={styles.refreshButton} onPress={loadAnalytics}>
            <Text style={styles.refreshText}>Refresh Analytics</Text>
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>Order Status Breakdown</Text>

          <View style={styles.chartCard}>
            {orderStatuses.length === 0 ? (
              <Text style={styles.emptyText}>No order status data yet.</Text>
            ) : (
              orderStatuses.map((item) =>
                renderBar(item, maxOrderStatus, "#10B981")
              )
            )}
          </View>

          <Text style={styles.sectionTitle}>Freight Load Breakdown</Text>

          <View style={styles.chartCard}>
            {loadStatuses.length === 0 ? (
              <Text style={styles.emptyText}>No freight load data yet.</Text>
            ) : (
              loadStatuses.map((item) =>
                renderBar(item, maxLoadStatus, "#2563EB")
              )
            )}
          </View>

          <Text style={styles.sectionTitle}>Top Farms by Revenue</Text>

          <FlatList
            data={topFarms}
            keyExtractor={(item) => item.farmer_id}
            scrollEnabled={false}
            ListEmptyComponent={
              <View style={styles.chartCard}>
                <Text style={styles.emptyText}>No farm revenue data yet.</Text>
              </View>
            }
            renderItem={({ item, index }) => (
              <View style={styles.farmCard}>
                <View style={styles.rankCircle}>
                  <Text style={styles.rankText}>{index + 1}</Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.farmName}>{item.farm_name}</Text>
                  <Text style={styles.farmMeta}>{item.orders} orders</Text>
                </View>

                <Text style={styles.farmRevenue}>
                  {formatMoney(item.revenue)}
                </Text>
              </View>
            )}
          />

          <View style={styles.forecastCard}>
            <Text style={styles.forecastTitle}>AI Growth Snapshot</Text>

            <Text style={styles.forecastText}>
              Estimated monthly marketplace revenue at current pace:{" "}
              {formatMoney(stats.totalRevenue * 4)}
            </Text>

            <Text style={styles.forecastText}>
              Estimated monthly freight opportunity volume:{" "}
              {formatMoney(stats.freightRevenue * 4)}
            </Text>

            <Text style={styles.forecastText}>
              Recommended focus: grow approved farmers, increase recurring
              customer subscriptions, and convert open freight loads into booked
              carrier jobs.
            </Text>
          </View>

          <View style={{ height: 80 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },

  hero: {
    backgroundColor: "#111827",
    paddingTop: 66,
    paddingHorizontal: 20,
    paddingBottom: 28,
  },

  eyebrow: {
    color: "#10B981",
    fontWeight: "900",
    marginBottom: 8,
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
  },

  navRow: {
    flexDirection: "row",
    gap: 10,
    padding: 18,
  },

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

  navText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  navTextOutline: {
    color: "#10B981",
    fontWeight: "900",
  },

  loadingCard: {
    backgroundColor: "#FFFFFF",
    margin: 18,
    padding: 26,
    borderRadius: 20,
    alignItems: "center",
  },

  loadingText: {
    color: "#6B7280",
    marginTop: 10,
    fontWeight: "800",
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
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  statCardAccent: {
    backgroundColor: "#064E3B",
    borderColor: "#064E3B",
  },

  statValue: {
    color: "#111827",
    fontSize: 22,
    fontWeight: "900",
  },

  statValueAccent: {
    color: "#FFFFFF",
  },

  statLabel: {
    color: "#6B7280",
    fontWeight: "800",
    marginTop: 4,
  },

  statLabelAccent: {
    color: "#BBF7D0",
  },

  refreshButton: {
    backgroundColor: "#111827",
    marginHorizontal: 18,
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 18,
  },

  refreshText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  sectionTitle: {
    color: "#111827",
    fontSize: 24,
    fontWeight: "900",
    paddingHorizontal: 18,
    marginBottom: 12,
    marginTop: 8,
  },

  chartCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    marginBottom: 18,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  barRow: {
    marginBottom: 14,
  },

  barLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },

  barLabel: {
    color: "#111827",
    fontWeight: "900",
  },

  barCount: {
    color: "#6B7280",
    fontWeight: "900",
  },

  barTrack: {
    height: 12,
    backgroundColor: "#E5E7EB",
    borderRadius: 999,
    overflow: "hidden",
  },

  barFill: {
    height: "100%",
    borderRadius: 999,
  },

  emptyText: {
    color: "#6B7280",
    fontWeight: "700",
    lineHeight: 22,
  },

  farmCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    marginBottom: 12,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  rankCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
  },

  rankText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 18,
  },

  farmName: {
    color: "#111827",
    fontWeight: "900",
    fontSize: 17,
  },

  farmMeta: {
    color: "#6B7280",
    fontWeight: "700",
    marginTop: 3,
  },

  farmRevenue: {
    color: "#064E3B",
    fontWeight: "900",
    fontSize: 17,
  },

  forecastCard: {
    backgroundColor: "#064E3B",
    margin: 18,
    borderRadius: 22,
    padding: 18,
  },

  forecastTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 10,
  },

  forecastText: {
    color: "#BBF7D0",
    lineHeight: 23,
    fontWeight: "700",
    marginBottom: 8,
  },
});