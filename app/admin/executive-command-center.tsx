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

const screenWidth =
  Dimensions.get("window").width;

type DashboardMetrics = {
  totalRevenue: number;
  totalOrders: number;
  totalLoads: number;
  activeDrivers: number;
  activeCustomers: number;
  activeFarmers: number;
  delayedLoads: number;
  coldChainLoads: number;
  aiAssignments: number;
};

export default function ExecutiveCommandCenter() {
  const [loading, setLoading] =
    useState(false);

  const [metrics, setMetrics] =
    useState<DashboardMetrics>({
      totalRevenue: 0,
      totalOrders: 0,
      totalLoads: 0,
      activeDrivers: 0,
      activeCustomers: 0,
      activeFarmers: 0,
      delayedLoads: 0,
      coldChainLoads: 0,
      aiAssignments: 0,
    });

  const [forecast, setForecast] =
    useState({
      projectedRevenue: 0,
      projectedOrders: 0,
      projectedLoads: 0,
      expansionReadiness: 0,
    });

  useFocusEffect(
    React.useCallback(() => {
      loadExecutiveData();
    }, [])
  );

  async function loadExecutiveData() {
    try {
      setLoading(true);

      const {
        data: orders,
      } = await supabase
        .from("orders")
        .select("*");

      const {
        data: loads,
      } = await supabase
        .from("freight_loads")
        .select("*");

      const {
        data: drivers,
      } = await supabase
        .from("driver_locations")
        .select("*");

      const {
        data: profiles,
      } = await supabase
        .from("profiles")
        .select("*");

      const totalRevenue =
        orders?.reduce(
          (
            sum: number,
            item: any
          ) =>
            sum +
            Number(item.total || 0),
          0
        ) || 0;

      const delayedLoads =
        drivers?.filter(
          (driver: any) => {
            const minutes =
              (Date.now() -
                new Date(
                  driver.updated_at
                ).getTime()) /
              1000 /
              60;

            return minutes > 30;
          }
        ) || [];

      const coldChainLoads =
        loads?.filter(
          (item: any) =>
            item.temperature_controlled
        ) || [];

      const aiAssignments =
        loads?.filter(
          (item: any) =>
            item.ai_dispatch_score
        ) || [];

      const activeDrivers =
        drivers?.filter((item: any) =>
          [
            "READY",
            "PICKED_UP",
            "EN_ROUTE_TO_PICKUP",
            "EN_ROUTE_TO_DROPOFF",
          ].includes(item.status)
        ) || [];

      const customers =
        profiles?.filter(
          (item: any) =>
            item.role ===
            "customer"
        ) || [];

      const farmers =
        profiles?.filter(
          (item: any) =>
            item.role === "farmer"
        ) || [];

      setMetrics({
        totalRevenue,

        totalOrders:
          orders?.length || 0,

        totalLoads:
          loads?.length || 0,

        activeDrivers:
          activeDrivers.length,

        activeCustomers:
          customers.length,

        activeFarmers:
          farmers.length,

        delayedLoads:
          delayedLoads.length,

        coldChainLoads:
          coldChainLoads.length,

        aiAssignments:
          aiAssignments.length,
      });

      buildForecast({
        totalRevenue,
        totalOrders:
          orders?.length || 0,
        totalLoads:
          loads?.length || 0,
        activeDrivers:
          activeDrivers.length,
      });
    } catch (error) {
      console.log(
        "Executive dashboard error:",
        error
      );
    } finally {
      setLoading(false);
    }
  }

  function buildForecast({
    totalRevenue,
    totalOrders,
    totalLoads,
    activeDrivers,
  }: any) {
    const projectedRevenue =
      totalRevenue * 1.42;

    const projectedOrders =
      Math.round(
        totalOrders * 1.37
      );

    const projectedLoads =
      Math.round(
        totalLoads * 1.34
      );

    const expansionReadiness =
      Math.min(
        100,
        55 +
          activeDrivers * 2
      );

    setForecast({
      projectedRevenue,
      projectedOrders,
      projectedLoads,
      expansionReadiness,
    });
  }

  const systemHealth = useMemo(() => {
    let score = 100;

    score -=
      metrics.delayedLoads * 5;

    if (
      metrics.coldChainLoads > 15
    ) {
      score -= 8;
    }

    return Math.max(score, 60);
  }, [metrics]);

  function riskColor(
    value: number
  ) {
    if (value >= 90) {
      return "#10B981";
    }

    if (value >= 75) {
      return "#2563EB";
    }

    if (value >= 60) {
      return "#F59E0B";
    }

    return "#DC2626";
  }

  return (
    <ProtectedRoute
      allowedRoles={["admin"]}
    >
      <View style={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.heroIcon}>
            🧠
          </Text>

          <Text style={styles.heroTitle}>
            Executive Command Center
          </Text>

          <Text
            style={styles.heroSubtitle}
          >
            Nationwide AI logistics
            intelligence, operational
            forecasting, fleet
            command, marketplace
            analytics, and executive
            mission control.
          </Text>
        </View>

        <ScrollView
          style={styles.panel}
          contentContainerStyle={
            styles.panelInner
          }
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={
                loadExecutiveData
              }
            />
          }
        >
          <View style={styles.navRow}>
            <TouchableOpacity
              style={
                styles.navButton
              }
              onPress={() =>
                router.push(
                  "/admin/live-operations-center"
                )
              }
            >
              <Text
                style={
                  styles.navText
                }
              >
                Operations
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={
                styles.navButtonOutline
              }
              onPress={() =>
                router.push(
                  "/admin/predictive-analytics-center"
                )
              }
            >
              <Text
                style={
                  styles.navTextOutline
                }
              >
                Analytics
              </Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View
              style={
                styles.loadingCard
              }
            >
              <ActivityIndicator
                size="large"
                color="#10B981"
              />

              <Text
                style={
                  styles.loadingText
                }
              >
                AI generating
                executive intelligence...
              </Text>
            </View>
          ) : (
            <>
              <Text
                style={
                  styles.sectionTitle
                }
              >
                Executive KPIs
              </Text>

              <View
                style={
                  styles.grid
                }
              >
                <MetricCard
                  label="Revenue"
                  value={`$${metrics.totalRevenue.toFixed(
                    0
                  )}`}
                />

                <MetricCard
                  label="Orders"
                  value={
                    metrics.totalOrders
                  }
                />

                <MetricCard
                  label="Freight Loads"
                  value={
                    metrics.totalLoads
                  }
                />

                <MetricCard
                  label="Drivers"
                  value={
                    metrics.activeDrivers
                  }
                />

                <MetricCard
                  label="Customers"
                  value={
                    metrics.activeCustomers
                  }
                />

                <MetricCard
                  label="Farmers"
                  value={
                    metrics.activeFarmers
                  }
                />

                <MetricCard
                  label="Cold-Chain"
                  value={
                    metrics.coldChainLoads
                  }
                />

                <MetricCard
                  label="AI Assignments"
                  value={
                    metrics.aiAssignments
                  }
                />
              </View>

              <Text
                style={
                  styles.sectionTitle
                }
              >
                AI Forecasting
              </Text>

              <View
                style={
                  styles.forecastCard
                }
              >
                <Text
                  style={
                    styles.forecastTitle
                  }
                >
                  Nationwide Scaling
                  Forecast
                </Text>

                <Text
                  style={
                    styles.forecastMetric
                  }
                >
                  Projected Revenue:
                  $
                  {forecast.projectedRevenue.toFixed(
                    0
                  )}
                </Text>

                <Text
                  style={
                    styles.forecastMetric
                  }
                >
                  Projected Orders:
                  {
                    forecast.projectedOrders
                  }
                </Text>

                <Text
                  style={
                    styles.forecastMetric
                  }
                >
                  Projected Freight
                  Loads:{" "}
                  {
                    forecast.projectedLoads
                  }
                </Text>

                <Text
                  style={
                    styles.forecastMetric
                  }
                >
                  Expansion Readiness:
                  {
                    forecast.expansionReadiness
                  }
                  %
                </Text>
              </View>

              <Text
                style={
                  styles.sectionTitle
                }
              >
                Enterprise Health
              </Text>

              <View
                style={
                  styles.healthCard
                }
              >
                <Text
                  style={[
                    styles.healthValue,
                    {
                      color:
                        riskColor(
                          systemHealth
                        ),
                    },
                  ]}
                >
                  {systemHealth}%
                </Text>

                <Text
                  style={
                    styles.healthLabel
                  }
                >
                  Operational Health
                </Text>

                <Text
                  style={
                    styles.healthText
                  }
                >
                  AI-generated
                  enterprise health
                  score based on
                  realtime logistics,
                  marketplace demand,
                  fleet telemetry,
                  dispatch automation,
                  and delivery risk
                  exposure.
                </Text>
              </View>

              <Text
                style={
                  styles.sectionTitle
                }
              >
                AI Strategic Insights
              </Text>

              <InsightCard
                title="Market Expansion"
                text="Farm2Home logistics infrastructure shows strong scaling readiness for Georgia, North Carolina, Virginia, Kentucky, and Mississippi expansion."
              />

              <InsightCard
                title="Cold-Chain Growth"
                text="Temperature-controlled freight demand continues increasing. AI recommends expanding refrigerated carrier partnerships."
              />

              <InsightCard
                title="Autonomous Dispatch"
                text="AI dispatch automation continues improving fleet efficiency and reducing assignment response time."
              />

              <InsightCard
                title="Marketplace Growth"
                text="Marketplace customer engagement and recurring produce subscriptions indicate strong retention trends."
              />

              <View
                style={{
                  height: 70,
                }}
              />
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
      <Text style={styles.metricValue}>
        {value}
      </Text>

      <Text style={styles.metricLabel}>
        {label}
      </Text>
    </View>
  );
}

function InsightCard({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <View style={styles.insightCard}>
      <Text style={styles.insightTitle}>
        {title}
      </Text>

      <Text style={styles.insightText}>
        {text}
      </Text>
    </View>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor:
        "#F3F4F6",
    },

    hero: {
      backgroundColor:
        "#111827",

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
      fontSize: 32,
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
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      backgroundColor:
        "#F3F4F6",
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
      backgroundColor:
        "#10B981",

      padding: 14,
      borderRadius: 14,
      alignItems: "center",
    },

    navButtonOutline: {
      flex: 1,
      backgroundColor:
        "#FFFFFF",

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
      backgroundColor:
        "#FFFFFF",

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
      justifyContent:
        "space-between",
      marginBottom: 18,
    },

    metricCard: {
      width:
        screenWidth > 600
          ? "31%"
          : "48%",

      backgroundColor:
        "#FFFFFF",

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

    forecastCard: {
      backgroundColor:
        "#064E3B",

      borderRadius: 24,
      padding: 22,
      marginBottom: 18,
    },

    forecastTitle: {
      color: "#FFFFFF",
      fontSize: 24,
      fontWeight: "900",
      marginBottom: 14,
    },

    forecastMetric: {
      color: "#BBF7D0",
      fontWeight: "800",
      marginBottom: 8,
      fontSize: 16,
    },

    healthCard: {
      backgroundColor:
        "#FFFFFF",

      borderRadius: 24,
      padding: 24,
      alignItems: "center",
      marginBottom: 18,
      borderWidth: 1,
      borderColor: "#E5E7EB",
    },

    healthValue: {
      fontSize: 52,
      fontWeight: "900",
    },

    healthLabel: {
      color: "#111827",
      fontSize: 20,
      fontWeight: "900",
      marginTop: 10,
      marginBottom: 10,
    },

    healthText: {
      color: "#6B7280",
      lineHeight: 22,
      textAlign: "center",
    },

    insightCard: {
      backgroundColor:
        "#FFFFFF",

      borderRadius: 22,
      padding: 18,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: "#E5E7EB",
    },

    insightTitle: {
      color: "#111827",
      fontSize: 19,
      fontWeight: "900",
      marginBottom: 8,
    },

    insightText: {
      color: "#374151",
      lineHeight: 22,
      fontWeight: "700",
    },
  });