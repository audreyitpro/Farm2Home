// app/admin/analytics-center.tsx

import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../services/supabaseClient";

const ui = {
  bg: "#F5F7FB",
  card: "#FFFFFF",
  border: "#E5E7EB",
  text: "#111827",
  muted: "#6B7280",
  soft: "#F9FAFB",
  primary: "#7C3AED",
  primarySoft: "#EDE9FE",
  green: "#10B981",
  blue: "#2563EB",
  orange: "#F59E0B",
  red: "#EF4444",
};

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

      if (orderError) console.log("Analytics orders error:", orderError.message);

      const { data: loads, error: loadError } = await supabase
        .from("freight_loads")
        .select("*");

      if (loadError) console.log("Analytics loads error:", loadError.message);

      const { data: verifications, error: verificationError } = await supabase
        .from("verification_records")
        .select("*");

      if (verificationError) {
        console.log("Analytics verification error:", verificationError.message);
      }

      const { data: farmers, error: farmerError } = await supabase
        .from("farmers")
        .select("*");

      if (farmerError) console.log("Analytics farmers error:", farmerError.message);

      const { data: carriers, error: carrierError } = await supabase
        .from("freight_carriers")
        .select("*");

      if (carrierError) console.log("Analytics carriers error:", carrierError.message);

      const orderRows = Array.isArray(orders) ? orders : [];
      const loadRows = Array.isArray(loads) ? loads : [];
      const verificationRows = Array.isArray(verifications) ? verifications : [];
      const farmerRows = Array.isArray(farmers) ? farmers : [];
      const carrierRows = Array.isArray(carriers) ? carriers : [];

      const totalRevenue = orderRows.reduce(
        (sum: number, item: any) =>
          sum + Number(item.total || item.total_amount || item.amount || 0),
        0
      );

      const freightRevenue = loadRows.reduce(
        (sum: number, item: any) =>
          sum + Number(item.rate || item.amount || item.price || 0),
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
        "paid",
        "accepted",
        "preparing",
        "ready_for_pickup",
        "picked_up",
        "in_transit",
        "pending_payment",
      ];

      const pendingVerificationStatuses = [
        "PENDING",
        "PENDING_VERIFICATION",
        "DOCUMENTS_SUBMITTED",
        "PENDING_ADMIN_REVIEW",
        "pending",
        "pending_verification",
        "documents_submitted",
        "pending_admin_review",
      ];

      setOrderStatuses(buildStatusCounts(orderRows, "status"));
      setLoadStatuses(buildStatusCounts(loadRows, "status"));
      setTopFarms(buildTopFarmRevenue(orderRows));

      setStats({
        totalRevenue,
        totalOrders: orderRows.length,
        avgOrderValue: orderRows.length > 0 ? totalRevenue / orderRows.length : 0,
        activeOrders: orderRows.filter((item: any) =>
          activeOrderStatuses.includes(String(item.status || ""))
        ).length,
        deliveredOrders: orderRows.filter((item: any) =>
          ["DELIVERED", "delivered"].includes(String(item.status || ""))
        ).length,
        cancelledOrders: orderRows.filter((item: any) =>
          ["CANCELLED", "REFUNDED", "cancelled", "refunded"].includes(
            String(item.status || "")
          )
        ).length,
        totalLoads: loadRows.length,
        openLoads: loadRows.filter((item: any) =>
          ["OPEN", "available", "AVAILABLE", "open", "pending", "PENDING"].includes(
            String(item.status || "")
          )
        ).length,
        bookedLoads: loadRows.filter((item: any) =>
          [
            "BOOKED",
            "ACCEPTED",
            "accepted",
            "ASSIGNED",
            "assigned",
            "arrived_pickup",
            "PICKED_UP",
            "picked_up",
            "IN_TRANSIT",
            "in_transit",
          ].includes(String(item.status || ""))
        ).length,
        deliveredLoads: loadRows.filter((item: any) =>
          ["DELIVERED", "delivered"].includes(String(item.status || ""))
        ).length,
        freightRevenue,
        pendingVerifications: verificationRows.filter((item: any) =>
          pendingVerificationStatuses.includes(String(item.status || ""))
        ).length,
        approvedFarmers: farmerRows.filter(
          (item: any) =>
            item.approved === true ||
            item.status === "APPROVED" ||
            item.status === "approved"
        ).length,
        approvedCarriers: carrierRows.filter(
          (item: any) =>
            item.approved === true ||
            item.status === "APPROVED" ||
            item.status === "approved"
        ).length,
      });
    } catch (error: any) {
      console.log("Analytics load error:", error);
      Alert.alert(
        "Analytics Error",
        error?.message || "Unable to load analytics data."
      );
    } finally {
      setLoading(false);
    }
  }

  function buildStatusCounts(rows: any[], field: string): StatusMetric[] {
    const counts: Record<string, number> = {};

    rows.forEach((row) => {
      const status = String(row[field] || "UNKNOWN").toUpperCase();
      counts[status] = (counts[status] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);
  }

  function buildTopFarmRevenue(orderRows: any[]): TopFarm[] {
    const farmMap: Record<string, TopFarm> = {};

    orderRows.forEach((order: any) => {
      const farmerId = String(order.farmer_id || order.farm_id || "unknown");
      const farmName =
        order.farmers?.farm_name ||
        order.farm_name ||
        order.farmer_name ||
        "Unknown Farm";

      if (!farmMap[farmerId]) {
        farmMap[farmerId] = {
          farmer_id: farmerId,
          farm_name: farmName,
          revenue: 0,
          orders: 0,
        };
      }

      farmMap[farmerId].revenue += Number(
        order.total || order.total_amount || order.amount || 0
      );
      farmMap[farmerId].orders += 1;
    });

    return Object.values(farmMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }

  function formatMoney(value: number) {
    return `$${Number(value || 0).toFixed(2)}`;
  }

  function renderBar(item: StatusMetric, maxCount: number) {
    const widthPercent =
      maxCount > 0 ? Math.max(12, (item.count / maxCount) * 100) : 12;

    return (
      <View style={styles.barRow} key={item.status}>
        <View style={styles.barLabelRow}>
          <Text style={styles.barLabel}>{item.status}</Text>
          <Text style={styles.barCount}>{item.count}</Text>
        </View>

        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${widthPercent}%` }]} />
        </View>
      </View>
    );
  }

  const maxOrderStatus = Math.max(1, ...orderStatuses.map((item) => item.count));
  const maxLoadStatus = Math.max(1, ...loadStatuses.map((item) => item.count));

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={ui.bg} />

      <View style={styles.shell}>
        <View style={styles.sidebar}>
          <View style={styles.logoRow}>
            <View style={styles.logoMark}>
              <Text style={styles.logoText}>F2H</Text>
            </View>
            <View>
              <Text style={styles.logoTitle}>Farm2Home</Text>
              <Text style={styles.logoSub}>Admin Analytics</Text>
            </View>
          </View>

          <NavButton label="Dashboard" icon="grid-outline" route="/admin/dashboard" />
          <NavButton label="Control Tower" icon="radio-outline" route="/admin/control-tower" />
          <NavButton label="Live Ops" icon="navigate-outline" route="/admin/live-operations-center" />
          <NavButton label="Analytics" icon="analytics-outline" route="/admin/analytics-center" active />
          <NavButton label="Documents" icon="document-text-outline" route="/admin/documents" />
          <NavButton label="AI Dispatch" icon="sparkles-outline" route="/ai/dispatch-intelligence-center" />
        </View>

        <View style={styles.main}>
          <View style={styles.topbar}>
            <View>
              <Text style={styles.welcome}>Welcome back, Admin</Text>
              <Text style={styles.pageTitle}>Analytics Center</Text>
              <Text style={styles.pageSub}>
                Revenue, marketplace, freight, farmer, and carrier performance.
              </Text>
            </View>

            <TouchableOpacity style={styles.refreshPill} onPress={loadAnalytics}>
              <Ionicons name="refresh-outline" size={18} color={ui.primary} />
              <Text style={styles.refreshPillText}>Refresh</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator size="large" color={ui.primary} />
              <Text style={styles.loadingText}>Loading analytics...</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.statsGrid}>
                <StatCard label="Marketplace Revenue" value={formatMoney(stats.totalRevenue)} icon="cash-outline" accent />
                <StatCard label="Freight Revenue" value={formatMoney(stats.freightRevenue)} icon="trail-sign-outline" accent />
                <StatCard label="Total Orders" value={String(stats.totalOrders)} icon="receipt-outline" />
                <StatCard label="Avg Order Value" value={formatMoney(stats.avgOrderValue)} icon="analytics-outline" />
                <StatCard label="Active Orders" value={String(stats.activeOrders)} icon="time-outline" />
                <StatCard label="Delivered Orders" value={String(stats.deliveredOrders)} icon="checkmark-done-outline" />
                <StatCard label="Cancelled / Refunded" value={String(stats.cancelledOrders)} icon="close-circle-outline" danger />
                <StatCard label="Total Loads" value={String(stats.totalLoads)} icon="cube-outline" />
                <StatCard label="Open Loads" value={String(stats.openLoads)} icon="file-tray-outline" />
                <StatCard label="Booked Loads" value={String(stats.bookedLoads)} icon="navigate-outline" />
                <StatCard label="Delivered Loads" value={String(stats.deliveredLoads)} icon="flag-outline" />
                <StatCard label="Pending Reviews" value={String(stats.pendingVerifications)} icon="shield-checkmark-outline" warning />
                <StatCard label="Approved Farmers" value={String(stats.approvedFarmers)} icon="leaf-outline" success />
                <StatCard label="Approved Carriers" value={String(stats.approvedCarriers)} icon="business-outline" success />
              </View>

              <View style={styles.dashboardGrid}>
                <View style={styles.chartCard}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Order Status Breakdown</Text>
                    <Text style={styles.sectionLink}>Orders</Text>
                  </View>

                  {orderStatuses.length === 0 ? (
                    <Text style={styles.emptyText}>No order status data yet.</Text>
                  ) : (
                    orderStatuses.map((item) => renderBar(item, maxOrderStatus))
                  )}
                </View>

                <View style={styles.chartCard}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Freight Load Breakdown</Text>
                    <Text style={styles.sectionLink}>Freight</Text>
                  </View>

                  {loadStatuses.length === 0 ? (
                    <Text style={styles.emptyText}>No freight load data yet.</Text>
                  ) : (
                    loadStatuses.map((item) => renderBar(item, maxLoadStatus))
                  )}
                </View>
              </View>

              <View style={styles.chartCard}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Top Farms by Revenue</Text>
                  <Text style={styles.sectionLink}>Top 10</Text>
                </View>

                <FlatList
                  data={topFarms}
                  keyExtractor={(item) => item.farmer_id}
                  scrollEnabled={false}
                  ListEmptyComponent={
                    <Text style={styles.emptyText}>No farm revenue data yet.</Text>
                  }
                  renderItem={({ item, index }) => (
                    <View style={styles.farmRow}>
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
              </View>

              <View style={styles.forecastCard}>
                <View style={styles.forecastHeader}>
                  <View style={styles.forecastIcon}>
                    <Ionicons name="sparkles-outline" size={22} color={ui.primary} />
                  </View>
                  <Text style={styles.forecastTitle}>AI Growth Snapshot</Text>
                </View>

                <Text style={styles.forecastText}>
                  Estimated monthly marketplace revenue at current pace:{" "}
                  <Text style={styles.forecastStrong}>
                    {formatMoney(stats.totalRevenue * 4)}
                  </Text>
                </Text>

                <Text style={styles.forecastText}>
                  Estimated monthly freight opportunity volume:{" "}
                  <Text style={styles.forecastStrong}>
                    {formatMoney(stats.freightRevenue * 4)}
                  </Text>
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
      </View>
    </SafeAreaView>
  );
}

function NavButton({
  label,
  icon,
  route,
  active = false,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  active?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.navButton, active && styles.navButtonActive]}
      onPress={() => router.push(route as any)}
    >
      <Ionicons name={icon} size={18} color={active ? "#FFFFFF" : ui.muted} />
      <Text style={[styles.navText, active && styles.navTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function StatCard({
  label,
  value,
  icon,
  accent = false,
  warning = false,
  danger = false,
  success = false,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent?: boolean;
  warning?: boolean;
  danger?: boolean;
  success?: boolean;
}) {
  const color = danger
    ? ui.red
    : warning
    ? ui.orange
    : success
    ? ui.green
    : accent
    ? ui.primary
    : ui.blue;

  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: ui.bg,
  },
  shell: {
    flex: 1,
    backgroundColor: ui.bg,
  },
  sidebar: {
    backgroundColor: ui.card,
    borderBottomWidth: 1,
    borderBottomColor: ui.border,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 12,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  logoMark: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: ui.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 13,
  },
  logoTitle: {
    color: ui.text,
    fontWeight: "900",
    fontSize: 18,
  },
  logoSub: {
    color: ui.muted,
    fontWeight: "700",
    fontSize: 12,
  },
  navButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: ui.soft,
  },
  navButtonActive: {
    backgroundColor: ui.primary,
  },
  navText: {
    color: ui.muted,
    fontWeight: "900",
    fontSize: 13,
  },
  navTextActive: {
    color: "#FFFFFF",
  },
  main: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  topbar: {
    backgroundColor: ui.card,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: ui.border,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  welcome: {
    color: ui.muted,
    fontWeight: "800",
    marginBottom: 4,
  },
  pageTitle: {
    color: ui.text,
    fontSize: 26,
    fontWeight: "900",
  },
  pageSub: {
    color: ui.muted,
    marginTop: 4,
    fontWeight: "700",
  },
  refreshPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: ui.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  refreshPillText: {
    color: ui.primary,
    fontWeight: "900",
  },
  loadingCard: {
    backgroundColor: ui.card,
    padding: 28,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: ui.border,
    alignItems: "center",
  },
  loadingText: {
    color: ui.muted,
    marginTop: 10,
    fontWeight: "800",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 14,
  },
  statCard: {
    width: "48%",
    backgroundColor: ui.card,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: ui.border,
  },
  statIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  statValue: {
    color: ui.text,
    fontSize: 22,
    fontWeight: "900",
  },
  statLabel: {
    color: ui.muted,
    fontWeight: "800",
    marginTop: 4,
  },
  dashboardGrid: {
    gap: 12,
    marginBottom: 14,
  },
  chartCard: {
    backgroundColor: ui.card,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: ui.border,
    marginBottom: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sectionTitle: {
    color: ui.text,
    fontSize: 19,
    fontWeight: "900",
  },
  sectionLink: {
    color: ui.primary,
    fontWeight: "900",
    fontSize: 12,
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
    color: ui.text,
    fontWeight: "900",
  },
  barCount: {
    color: ui.muted,
    fontWeight: "900",
  },
  barTrack: {
    height: 12,
    backgroundColor: "#EEF2FF",
    borderRadius: 999,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: ui.primary,
  },
  emptyText: {
    color: ui.muted,
    fontWeight: "700",
    lineHeight: 22,
  },
  farmRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: ui.border,
  },
  rankCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: ui.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: {
    color: ui.primary,
    fontWeight: "900",
    fontSize: 17,
  },
  farmName: {
    color: ui.text,
    fontWeight: "900",
    fontSize: 16,
  },
  farmMeta: {
    color: ui.muted,
    fontWeight: "700",
    marginTop: 3,
  },
  farmRevenue: {
    color: ui.primary,
    fontWeight: "900",
    fontSize: 16,
  },
  forecastCard: {
    backgroundColor: ui.card,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: ui.border,
    marginBottom: 18,
  },
  forecastHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 12,
  },
  forecastIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: ui.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  forecastTitle: {
    color: ui.text,
    fontSize: 21,
    fontWeight: "900",
  },
  forecastText: {
    color: ui.muted,
    lineHeight: 23,
    fontWeight: "700",
    marginBottom: 8,
  },
  forecastStrong: {
    color: ui.primary,
    fontWeight: "900",
  },
});