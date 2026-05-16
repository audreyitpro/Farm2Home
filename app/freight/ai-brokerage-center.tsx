import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";

import { supabase } from "../data/supabaseClient";
import ProtectedRoute from "../components/ProtectedRoute";

const screenWidth = Dimensions.get("window").width;

type LoadRow = {
  id: string;
  title?: string;
  commodity?: string;
  pickup_city?: string;
  pickup_state?: string;
  delivery_city?: string;
  delivery_state?: string;
  rate?: number;
  miles?: number;
  weight?: number;
  status?: string;
  temperature_controlled?: boolean;
  priority_level?: string;
  created_at?: string;
};

type CarrierInsight = {
  id: string;
  title: string;
  message: string;
  type: "MATCH" | "PROFIT" | "LANE" | "RISK" | "GROWTH";
};

export default function AiBrokerageCenter() {
  const [loading, setLoading] = useState(false);
  const [loads, setLoads] = useState<LoadRow[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [insights, setInsights] = useState<CarrierInsight[]>([]);

  useFocusEffect(
    React.useCallback(() => {
      loadBrokerageCenter();
    }, [])
  );

  async function loadBrokerageCenter() {
    try {
      setLoading(true);

      const { data: loadData } = await supabase
        .from("freight_loads")
        .select("*")
        .order("created_at", { ascending: false });

      const { data: driverData } = await supabase
        .from("driver_locations")
        .select("*")
        .order("updated_at", { ascending: false });

      const cleanLoads = (loadData || []) as LoadRow[];
      const cleanDrivers = driverData || [];

      setLoads(cleanLoads);
      setDrivers(cleanDrivers);
      setInsights(buildInsights(cleanLoads, cleanDrivers));
    } catch (error) {
      console.log("AI brokerage error:", error);
    } finally {
      setLoading(false);
    }
  }

  function buildInsights(loadRows: LoadRow[], driverRows: any[]): CarrierInsight[] {
    const results: CarrierInsight[] = [];

    const openLoads = loadRows.filter((item) =>
      ["OPEN", "POSTED"].includes(item.status || "")
    );

    if (openLoads.length > 0) {
      results.push({
        id: "load-match",
        title: "Carrier Match Opportunity",
        message: `${openLoads.length} open loads are available for AI carrier matching and smart dispatch.`,
        type: "MATCH",
      });
    }

    const premiumLoads = loadRows.filter(
      (item) =>
        item.temperature_controlled ||
        item.priority_level === "HIGH" ||
        item.priority_level === "CRITICAL"
    );

    if (premiumLoads.length > 0) {
      results.push({
        id: "premium",
        title: "Premium Freight Opportunity",
        message: `${premiumLoads.length} priority or temperature-controlled loads may support premium carrier pricing.`,
        type: "PROFIT",
      });
    }

    const activeDrivers = driverRows.filter((item: any) =>
      ["READY", "EN_ROUTE_TO_PICKUP", "PICKED_UP", "EN_ROUTE_TO_DROPOFF"].includes(
        item.status
      )
    );

    if (activeDrivers.length > 0) {
      results.push({
        id: "lane",
        title: "Lane Optimization Signal",
        message: `${activeDrivers.length} active drivers can be used for route clustering, lane balancing, and backhaul planning.`,
        type: "LANE",
      });
    }

    const staleDrivers = driverRows.filter((driver: any) => {
      if (!driver.updated_at) return false;

      const minutes =
        (Date.now() - new Date(driver.updated_at).getTime()) / 1000 / 60;

      return minutes > 45;
    });

    if (staleDrivers.length > 0) {
      results.push({
        id: "risk",
        title: "Carrier Tracking Risk",
        message: `${staleDrivers.length} drivers have stale GPS data. AI recommends dispatcher follow-up.`,
        type: "RISK",
      });
    }

    results.push({
      id: "growth",
      title: "Brokerage Growth Strategy",
      message:
        "AI recommends expanding carrier capacity in Michigan, Georgia, North Carolina, Virginia, Kentucky, and Mississippi for national scaling.",
      type: "GROWTH",
    });

    return results;
  }

  const openLoads = useMemo(
    () => loads.filter((item) => ["OPEN", "POSTED"].includes(item.status || "")),
    [loads]
  );

  const assignedLoads = useMemo(
    () =>
      loads.filter((item) =>
        ["ASSIGNED", "BOOKED", "ACCEPTED", "PICKED_UP", "IN_TRANSIT"].includes(
          item.status || ""
        )
      ),
    [loads]
  );

  const deliveredLoads = useMemo(
    () => loads.filter((item) => item.status === "DELIVERED"),
    [loads]
  );

  const totalFreightValue = useMemo(
    () => loads.reduce((sum, item) => sum + Number(item.rate || 0), 0),
    [loads]
  );

  const averageRate = useMemo(() => {
    if (loads.length === 0) return 0;
    return totalFreightValue / loads.length;
  }, [loads.length, totalFreightValue]);

  const profitabilityScore = useMemo(() => {
    let score = 70;

    score += openLoads.length * 2;
    score += deliveredLoads.length * 3;

    if (averageRate > 500) {
      score += 10;
    }

    return Math.min(score, 98);
  }, [openLoads.length, deliveredLoads.length, averageRate]);

  function insightColor(type: CarrierInsight["type"]) {
    switch (type) {
      case "MATCH":
        return "#10B981";
      case "PROFIT":
        return "#2563EB";
      case "LANE":
        return "#7C3AED";
      case "RISK":
        return "#DC2626";
      case "GROWTH":
        return "#F59E0B";
      default:
        return "#10B981";
    }
  }

  function loadProfitSignal(load: LoadRow) {
    const rate = Number(load.rate || 0);
    const miles = Number(load.miles || 0);

    if (!rate || !miles) {
      return "Needs rate/mileage validation";
    }

    const rpm = rate / miles;

    if (rpm >= 3) return "Strong profitability";
    if (rpm >= 2) return "Good lane opportunity";
    return "Low-margin lane";
  }

  return (
    <ProtectedRoute allowedRoles={["freight", "admin"]}>
      <View style={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.heroIcon}>🚛</Text>

          <Text style={styles.heroTitle}>AI Freight Brokerage Center</Text>

          <Text style={styles.heroSubtitle}>
            AI carrier matching, smart freight recommendations, lane
            optimization, profitability scoring, and nationwide brokerage
            intelligence.
          </Text>
        </View>

        <ScrollView
          style={styles.panel}
          contentContainerStyle={styles.panelInner}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={loadBrokerageCenter} />
          }
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.navRow}>
            <TouchableOpacity
              style={styles.navButton}
              onPress={() => router.push("/freight/dashboard")}
            >
              <Text style={styles.navText}>Freight Dashboard</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navButtonOutline}
              onPress={() => router.push("/freight/board")}
            >
              <Text style={styles.navTextOutline}>Load Board</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator size="large" color="#10B981" />
              <Text style={styles.loadingText}>
                AI analyzing brokerage intelligence...
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.sectionTitle}>Brokerage KPIs</Text>

              <View style={styles.grid}>
                <MetricCard label="Total Loads" value={loads.length} />
                <MetricCard label="Open Loads" value={openLoads.length} />
                <MetricCard label="Assigned" value={assignedLoads.length} />
                <MetricCard label="Delivered" value={deliveredLoads.length} />
                <MetricCard
                  label="Freight Value"
                  value={`$${totalFreightValue.toFixed(0)}`}
                />
                <MetricCard
                  label="Avg Rate"
                  value={`$${averageRate.toFixed(0)}`}
                />
                <MetricCard label="Drivers" value={drivers.length} />
                <MetricCard
                  label="Profitability"
                  value={`${profitabilityScore}%`}
                />
              </View>

              <Text style={styles.sectionTitle}>AI Brokerage Strategy</Text>

              <View style={styles.strategyCard}>
                <Text style={styles.strategyTitle}>
                  Carrier Matching Recommendation
                </Text>

                <Text style={styles.strategyText}>
                  AI recommends matching open freight with available drivers
                  based on driver freshness, lane profitability, cold-chain
                  priority, and delivery risk.
                </Text>

                <View style={styles.strategyRow}>
                  <StrategyBox value="+18%" label="Margin Potential" />
                  <StrategyBox value="+24%" label="Dispatch Speed" />
                  <StrategyBox value="-12%" label="Empty Miles" />
                </View>
              </View>

              <Text style={styles.sectionTitle}>AI Carrier Insights</Text>

              {insights.map((item) => (
                <View key={item.id} style={styles.insightCard}>
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.insightTitle}>{item.title}</Text>
                    </View>

                    <View
                      style={[
                        styles.typeBadge,
                        { backgroundColor: insightColor(item.type) },
                      ]}
                    >
                      <Text style={styles.typeText}>{item.type}</Text>
                    </View>
                  </View>

                  <Text style={styles.insightText}>{item.message}</Text>
                </View>
              ))}

              <Text style={styles.sectionTitle}>Smart Load Recommendations</Text>

              {loads.slice(0, 10).map((load) => (
                <View key={load.id} style={styles.loadCard}>
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.loadTitle}>
                        {load.title || "Farm2Home Freight Load"}
                      </Text>

                      <Text style={styles.loadSub}>
                        {load.pickup_city || "Pickup"}, {load.pickup_state || ""} →{" "}
                        {load.delivery_city || "Delivery"},{" "}
                        {load.delivery_state || ""}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor:
                            load.status === "OPEN"
                              ? "#10B981"
                              : load.status === "DELIVERED"
                              ? "#2563EB"
                              : "#F59E0B",
                        },
                      ]}
                    >
                      <Text style={styles.statusText}>{load.status || "OPEN"}</Text>
                    </View>
                  </View>

                  <Text style={styles.metaText}>
                    Commodity: {load.commodity || "Produce"}
                  </Text>

                  <Text style={styles.metaText}>
                    Rate: ${Number(load.rate || 0).toFixed(2)}
                  </Text>

                  <Text style={styles.metaText}>
                    Miles: {Number(load.miles || 0).toFixed(0)}
                  </Text>

                  <Text style={styles.signalText}>
                    AI Signal: {loadProfitSignal(load)}
                  </Text>

                  <TouchableOpacity
                    style={styles.trackButton}
                    onPress={() =>
                      router.push({
                        pathname: "/freight/tracking",
                        params: { loadId: load.id },
                      })
                    }
                  >
                    <Text style={styles.trackText}>View Load Intelligence</Text>
                  </TouchableOpacity>
                </View>
              ))}

              <View style={{ height: 80 }} />
            </>
          )}
        </ScrollView>
      </View>
    </ProtectedRoute>
  );
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function StrategyBox({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.strategyBox}>
      <Text style={styles.strategyValue}>{value}</Text>
      <Text style={styles.strategyLabel}>{label}</Text>
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
    paddingTop: 64,
    paddingBottom: 28,
    paddingHorizontal: 20,
    alignItems: "center",
  },

  heroIcon: {
    fontSize: 56,
    marginBottom: 12,
  },

  heroTitle: {
    color: "#FFFFFF",
    fontSize: 31,
    fontWeight: "900",
    marginBottom: 10,
    textAlign: "center",
  },

  heroSubtitle: {
    color: "#D1D5DB",
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 640,
  },

  panel: {
    flex: 1,
    marginTop: -24,
    backgroundColor: "#F3F4F6",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },

  panelInner: {
    padding: 18,
    paddingBottom: 80,
  },

  navRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
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
    padding: 24,
    borderRadius: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  loadingText: {
    color: "#6B7280",
    fontWeight: "800",
    marginTop: 10,
  },

  sectionTitle: {
    color: "#111827",
    fontSize: 23,
    fontWeight: "900",
    marginBottom: 12,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 18,
  },

  metricCard: {
    width: screenWidth > 600 ? "31%" : "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  metricValue: {
    color: "#111827",
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 6,
  },

  metricLabel: {
    color: "#6B7280",
    fontWeight: "700",
  },

  strategyCard: {
    backgroundColor: "#064E3B",
    borderRadius: 24,
    padding: 20,
    marginBottom: 18,
  },

  strategyTitle: {
    color: "#FFFFFF",
    fontSize: 23,
    fontWeight: "900",
    marginBottom: 10,
  },

  strategyText: {
    color: "#BBF7D0",
    lineHeight: 22,
    fontWeight: "700",
  },

  strategyRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },

  strategyBox: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 12,
    alignItems: "center",
  },

  strategyValue: {
    color: "#064E3B",
    fontSize: 22,
    fontWeight: "900",
  },

  strategyLabel: {
    color: "#374151",
    fontWeight: "800",
    fontSize: 11,
    marginTop: 4,
    textAlign: "center",
  },

  insightCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 10,
  },

  insightTitle: {
    color: "#111827",
    fontSize: 19,
    fontWeight: "900",
  },

  insightText: {
    color: "#374151",
    lineHeight: 22,
    fontWeight: "700",
  },

  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },

  typeText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 10,
  },

  loadCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  loadTitle: {
    color: "#111827",
    fontSize: 19,
    fontWeight: "900",
  },

  loadSub: {
    color: "#6B7280",
    fontWeight: "700",
    marginTop: 4,
    lineHeight: 20,
  },

  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },

  statusText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 10,
  },

  metaText: {
    color: "#374151",
    lineHeight: 22,
    fontWeight: "700",
  },

  signalText: {
    color: "#10B981",
    lineHeight: 22,
    fontWeight: "900",
    marginTop: 6,
  },

  trackButton: {
    backgroundColor: "#111827",
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 14,
  },

  trackText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
});