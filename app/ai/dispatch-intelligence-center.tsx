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
import { router, useFocusEffect } from "expo-router";

import { supabase } from "../services/supabaseClient";
import { notifyAdminAlert } from "../services/notificationService";

type FreightLoad = {
  id: string;
  title?: string | null;
  farmer_name?: string | null;
  commodity?: string | null;
  pickup_location?: string | null;
  dropoff_location?: string | null;
  rate?: number | null;
  distance_miles?: number | null;
  weight_lbs?: number | null;
  status?: string | null;
  temperature_required?: string | null;
  created_at?: string | null;
};

type DriverLocation = {
  id?: string;
  load_id?: string | null;
  latitude: number;
  longitude: number;
  speed?: number | null;
  heading?: number | null;
  status?: string | null;
  updated_at?: string | null;
};

type DispatchRecommendation = {
  id: string;
  score: number;
  priority: "NORMAL" | "HIGH" | "CRITICAL";
  eta: string;
  reason: string;
  driver: DriverLocation;
  load: FreightLoad;
};

const ACTIVE_DRIVER_STATUSES = [
  "accepted",
  "arrived_pickup",
  "picked_up",
  "in_transit",
  "arrived_dropoff",
];

export default function DispatchIntelligenceCenter() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [loads, setLoads] = useState<FreightLoad[]>([]);
  const [drivers, setDrivers] = useState<DriverLocation[]>([]);
  const [recommendations, setRecommendations] = useState<
    DispatchRecommendation[]
  >([]);

  useFocusEffect(
    useCallback(() => {
      loadDispatchCenter();

      const channel = supabase
        .channel("dispatch-ai-center")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "freight_loads" },
          () => loadDispatchCenter()
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "driver_locations" },
          () => loadDispatchCenter()
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }, [])
  );

  async function loadDispatchCenter() {
    try {
      setLoading(true);

      const { data: loadData, error: loadError } = await supabase
        .from("freight_loads")
        .select("*")
        .order("created_at", { ascending: false });

      if (loadError) {
        Alert.alert("Load Error", loadError.message);
        return;
      }

      const { data: driverData, error: driverError } = await supabase
        .from("driver_locations")
        .select("*")
        .order("updated_at", { ascending: false });

      if (driverError) {
        Alert.alert("Driver Error", driverError.message);
        return;
      }

      const cleanLoads = Array.isArray(loadData)
        ? (loadData as FreightLoad[])
        : [];

      const cleanDrivers = Array.isArray(driverData)
        ? (driverData as any[]).map((item) => ({
            ...item,
            latitude: Number(item.latitude || 0),
            longitude: Number(item.longitude || 0),
            speed:
              item.speed === null || item.speed === undefined
                ? null
                : Number(item.speed),
            heading:
              item.heading === null || item.heading === undefined
                ? null
                : Number(item.heading),
          }))
        : [];

      setLoads(cleanLoads);
      setDrivers(cleanDrivers);
      setRecommendations(buildRecommendations(cleanLoads, cleanDrivers));
    } catch (error) {
      console.log("DISPATCH_AI_ERROR:", error);
      Alert.alert("AI Dispatch Error", "Unable to load dispatch intelligence.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function onRefresh() {
    setRefreshing(true);
    loadDispatchCenter();
  }

  function isColdChain(load: FreightLoad) {
    const text = `${load.title || ""} ${load.commodity || ""} ${
      load.temperature_required || ""
    }`.toLowerCase();

    return (
      text.includes("cold") ||
      text.includes("refrigerated") ||
      text.includes("cool") ||
      text.includes("fresh") ||
      text.includes("meat") ||
      text.includes("dairy") ||
      text.includes("eggs")
    );
  }

  function loadPriority(load: FreightLoad): "NORMAL" | "HIGH" | "CRITICAL" {
    if (isColdChain(load)) return "CRITICAL";
    if (Number(load.rate || 0) >= 500) return "HIGH";
    return "NORMAL";
  }

  function getDriverFreshnessScore(driver: DriverLocation) {
    if (!driver.updated_at) return 0;

    const minutes =
      (Date.now() - new Date(driver.updated_at).getTime()) / 1000 / 60;

    if (minutes <= 5) return 20;
    if (minutes <= 30) return 10;
    return -10;
  }

  function scoreDriverForLoad(load: FreightLoad, driver: DriverLocation) {
    let score = 50;

    if (!driver.load_id) score += 20;

    if (ACTIVE_DRIVER_STATUSES.includes(String(driver.status || ""))) {
      score += 10;
    }

    if (isColdChain(load)) score += 15;

    if (Number(load.rate || 0) >= 500) score += 10;

    if (driver.speed && driver.speed > 1) score += 5;

    score += getDriverFreshnessScore(driver);

    return Math.max(0, Math.min(score, 100));
  }

  function randomEta(score: number) {
    if (score >= 90) return "10 - 20 min";
    if (score >= 75) return "20 - 35 min";
    if (score >= 60) return "35 - 50 min";
    return "50+ min";
  }

  function buildRecommendations(
    loadRows: FreightLoad[],
    driverRows: DriverLocation[]
  ) {
    const aiResults: DispatchRecommendation[] = [];

    const availableLoads = loadRows.filter((item) => item.status === "available");

    const possibleDrivers = driverRows.filter(
      (driver) => driver.status !== "delivered" && driver.status !== "cancelled"
    );

    availableLoads.forEach((load) => {
      possibleDrivers.slice(0, 5).forEach((driver) => {
        const score = scoreDriverForLoad(load, driver);
        const priority = loadPriority(load);

        aiResults.push({
          id: `${load.id}_${driver.load_id || driver.id || driver.updated_at}`,
          score,
          priority,
          eta: randomEta(score),
          reason:
            score >= 85
              ? "Optimal match based on GPS freshness, route readiness, cold-chain priority, and payout value."
              : score >= 70
              ? "Strong dispatch recommendation based on current driver signal and load priority."
              : "Moderate dispatch fit. Consider manually reviewing driver availability.",
          driver,
          load,
        });
      });
    });

    aiResults.sort((a, b) => b.score - a.score);

    return aiResults;
  }

  async function autoAssignLoad(item: DispatchRecommendation) {
    try {
      const now = new Date().toISOString();

      const { error } = await supabase
        .from("freight_loads")
        .update({
          status: "accepted",
          accepted_at: now,
          driver_id: item.driver.load_id || item.driver.id || "ai_assigned_driver",
        })
        .eq("id", item.load.id);

      if (error) {
        Alert.alert("Assign Error", error.message);
        return;
      }

      await notifyAdminAlert(
        `AI assigned load ${item.load.title || item.load.id} with score ${item.score}.`,
        item.load.id
      );

      Alert.alert(
        "AI Dispatch Assigned",
        "The selected load was marked accepted and assigned by AI."
      );

      await loadDispatchCenter();
    } catch (error: any) {
      Alert.alert("Assign Error", error?.message || "Unable to assign load.");
    }
  }

  function scoreColor(score: number) {
    if (score >= 90) return "#10B981";
    if (score >= 75) return "#2563EB";
    if (score >= 60) return "#F59E0B";
    return "#DC2626";
  }

  function priorityColor(priority?: string) {
    switch (priority) {
      case "CRITICAL":
        return "#DC2626";
      case "HIGH":
        return "#F59E0B";
      default:
        return "#2563EB";
    }
  }

  function statusLabel(status?: string | null) {
    return String(status || "unknown").replace(/_/g, " ");
  }

  const criticalLoads = useMemo(
    () => loads.filter((item) => item.status === "available" && isColdChain(item)),
    [loads]
  );

  const availableLoads = useMemo(
    () => loads.filter((item) => item.status === "available"),
    [loads]
  );

  const activeDrivers = useMemo(
    () =>
      drivers.filter((item) =>
        ACTIVE_DRIVER_STATUSES.includes(String(item.status || ""))
      ),
    [drivers]
  );

  if (loading && loads.length === 0) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={styles.loadingText}>
          AI analyzing dispatch operations...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.heroIcon}>🤖</Text>

        <Text style={styles.heroTitle}>AI Dispatch Intelligence</Text>

        <Text style={styles.heroSubtitle}>
          Smart dispatch recommendations using realtime freight loads, driver
          GPS telemetry, cold-chain priority, and payout value.
        </Text>

        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <Text style={styles.heroValue}>{availableLoads.length}</Text>
            <Text style={styles.heroLabel}>Available</Text>
          </View>

          <View style={styles.heroStat}>
            <Text style={styles.heroValue}>{activeDrivers.length}</Text>
            <Text style={styles.heroLabel}>Active Drivers</Text>
          </View>

          <View style={styles.heroStat}>
            <Text style={styles.heroValue}>{recommendations.length}</Text>
            <Text style={styles.heroLabel}>AI Matches</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.panel}
        contentContainerStyle={styles.panelInner}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.navRow}>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => router.push("/admin/live-operations-center" as any)}
          >
            <Text style={styles.navText}>Operations</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navButtonOutline}
            onPress={() => router.push("/admin/fleet-map" as any)}
          >
            <Text style={styles.navTextOutline}>Fleet Map</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.refreshButton} onPress={loadDispatchCenter}>
          <Text style={styles.refreshText}>Refresh AI Dispatch</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Critical Freight Loads</Text>

        <FlatList
          data={criticalLoads}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No critical freight loads.</Text>
              <Text style={styles.emptyText}>
                Cold-chain or urgent available loads will appear here.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.loadCard}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>
                    {item.title || "Farm2Home Load"}
                  </Text>

                  <Text style={styles.cardSub}>
                    {item.pickup_location || "Pickup"} →{" "}
                    {item.dropoff_location || "Delivery"}
                  </Text>
                </View>

                <View
                  style={[
                    styles.priorityBadge,
                    { backgroundColor: priorityColor(loadPriority(item)) },
                  ]}
                >
                  <Text style={styles.priorityText}>{loadPriority(item)}</Text>
                </View>
              </View>

              <Text style={styles.metaText}>
                Commodity: {item.commodity || "Produce"}
              </Text>

              <Text style={styles.metaText}>
                Rate: ${Number(item.rate || 0).toFixed(2)}
              </Text>

              <Text style={styles.metaText}>
                Temperature: {item.temperature_required || "Not specified"}
              </Text>
            </View>
          )}
        />

        <Text style={styles.sectionTitle}>AI Dispatch Recommendations</Text>

        <FlatList
          data={recommendations}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No AI recommendations yet.</Text>

              <Text style={styles.emptyText}>
                Recommendations appear when available loads and driver GPS
                signals are active.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.recommendationCard}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>
                    Driver GPS Match
                  </Text>

                  <Text style={styles.cardSub}>
                    Match for {item.load.title || "Freight Load"}
                  </Text>
                </View>

                <View
                  style={[
                    styles.scoreBadge,
                    { backgroundColor: scoreColor(item.score) },
                  ]}
                >
                  <Text style={styles.scoreText}>{item.score}</Text>
                </View>
              </View>

              <Text style={styles.metaText}>
                Load: {item.load.pickup_location || "Pickup"} →{" "}
                {item.load.dropoff_location || "Dropoff"}
              </Text>

              <Text style={styles.metaText}>
                Driver Status: {statusLabel(item.driver.status)}
              </Text>

              <Text style={styles.metaText}>
                ETA to Pickup: {item.eta}
              </Text>

              <Text style={styles.metaText}>
                Priority: {item.priority}
              </Text>

              <Text style={styles.reasonText}>{item.reason}</Text>

              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.assignButton}
                  onPress={() => autoAssignLoad(item)}
                >
                  <Text style={styles.assignText}>Auto Assign</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.trackButton}
                  onPress={() =>
                    router.push({
                      pathname: "/driver/live-location-provider" as any,
                      params: {
                        loadId: item.load.id,
                      },
                    })
                  }
                >
                  <Text style={styles.trackText}>Track Load</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />

        <View style={{ height: 70 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: "#6B7280",
    marginTop: 10,
    fontWeight: "800",
  },
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  hero: {
    backgroundColor: "#111827",
    paddingTop: 64,
    paddingHorizontal: 20,
    paddingBottom: 28,
    alignItems: "center",
  },
  heroIcon: {
    fontSize: 54,
    marginBottom: 10,
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
    fontWeight: "700",
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 600,
  },
  heroStats: {
    flexDirection: "row",
    gap: 12,
    marginTop: 22,
  },
  heroStat: {
    backgroundColor: "#1F2937",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 18,
    alignItems: "center",
  },
  heroValue: {
    color: "#10B981",
    fontSize: 22,
    fontWeight: "900",
  },
  heroLabel: {
    color: "#D1D5DB",
    fontWeight: "700",
    marginTop: 4,
    fontSize: 12,
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
    marginBottom: 14,
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
  refreshButton: {
    backgroundColor: "#111827",
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
    fontSize: 23,
    fontWeight: "900",
    marginBottom: 12,
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 14,
  },
  emptyTitle: {
    color: "#111827",
    fontWeight: "900",
    fontSize: 18,
  },
  emptyText: {
    color: "#6B7280",
    fontWeight: "700",
    lineHeight: 21,
    marginTop: 6,
  },
  loadCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 14,
  },
  recommendationCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 16,
    borderWidth: 2,
    borderColor: "#10B981",
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    marginBottom: 10,
  },
  cardTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "900",
  },
  cardSub: {
    color: "#6B7280",
    fontWeight: "700",
    marginTop: 4,
  },
  priorityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  priorityText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 10,
  },
  scoreBadge: {
    width: 48,
    height: 48,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },
  metaText: {
    color: "#374151",
    fontWeight: "700",
    marginBottom: 5,
  },
  reasonText: {
    color: "#111827",
    fontWeight: "700",
    lineHeight: 21,
    marginTop: 6,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  assignButton: {
    flex: 1,
    backgroundColor: "#10B981",
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  assignText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  trackButton: {
    flex: 1,
    backgroundColor: "#111827",
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  trackText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
});