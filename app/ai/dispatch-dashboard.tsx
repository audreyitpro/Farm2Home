// app/ai/dispatch-dashboard.tsx

import React, { useCallback, useMemo, useState } from "react";
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

import {
  DispatchMatch,
  autoAssignBestCarrier,
  getSmartDispatchMatches,
  recommendDispatchPlan,
} from "./smart-dispatch";

import freightTheme from "../styles/freightTheme";

export default function DispatchDashboard() {
  const [matches, setMatches] = useState<DispatchMatch[]>([]);
  const [recommendedPlan, setRecommendedPlan] = useState<DispatchMatch[]>([]);
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadDispatchMatches();
    }, [])
  );

  async function loadDispatchMatches() {
    try {
      setLoading(true);

      const matchData = await getSmartDispatchMatches();
      const planData = await recommendDispatchPlan();

      setMatches(matchData);
      setRecommendedPlan(planData);
    } catch (error) {
      console.log("AI dispatch load error:", error);
      Alert.alert("Dispatch Error", "Unable to load smart dispatch matches.");
    } finally {
      setLoading(false);
    }
  }

  async function assignCarrier(loadId: string) {
    try {
      setLoading(true);

      const result = await autoAssignBestCarrier(loadId);

      if (!result.assigned) {
        Alert.alert("Not Assigned", result.reason || "No carrier was assigned.");
        return;
      }

      Alert.alert(
        "Carrier Assigned",
        `${result.match?.carrier.companyName} was assigned to ${
          result.match?.load.title || "this load"
        }.`
      );

      await loadDispatchMatches();
    } catch (error) {
      console.log("Auto assign error:", error);
      Alert.alert("Assign Error", "Unable to auto-assign carrier.");
    } finally {
      setLoading(false);
    }
  }

  const stats = useMemo(() => {
    const topScore = matches.length > 0 ? Math.max(...matches.map((m) => m.score)) : 0;
    const strongMatches = matches.filter((m) => m.score >= 80).length;
    const mediumMatches = matches.filter((m) => m.score >= 60 && m.score < 80).length;

    return {
      total: matches.length,
      recommended: recommendedPlan.length,
      topScore,
      strongMatches,
      mediumMatches,
    };
  }, [matches, recommendedPlan]);

  function getScoreColor(score: number) {
    if (score >= 80) return "#10B981";
    if (score >= 60) return "#F59E0B";
    return "#EF4444";
  }

  function formatMoney(value: number) {
    return `$${Number(value || 0).toFixed(0)}`;
  }

  function renderMatchCard(item: DispatchMatch, recommended = false) {
    return (
      <View style={styles.matchCard}>
        <View style={styles.matchHeader}>
          <View style={styles.matchIcon}>
            <Ionicons name="sparkles-outline" size={22} color="#10B981" />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.loadTitle}>
              {item.load.title || "Farm2Home Load"}
            </Text>

            <Text style={styles.commodity}>
              {item.load.commodity || "Farm Freight"}
            </Text>
          </View>

          <View
            style={[
              styles.scoreBadge,
              {
                backgroundColor: getScoreColor(item.score),
              },
            ]}
          >
            <Text style={styles.scoreText}>{item.score}</Text>
          </View>
        </View>

        <View style={styles.routeBox}>
          <View style={styles.routeStop}>
            <Ionicons name="radio-button-on" size={17} color="#10B981" />
            <Text style={styles.routeText}>
              {item.load.pickupCity || "Pickup"}, {item.load.pickupState || ""}
            </Text>
          </View>

          <View style={styles.routeLine} />

          <View style={styles.routeStop}>
            <Ionicons name="location" size={17} color="#10B981" />
            <Text style={styles.routeText}>
              {item.load.deliveryCity || "Delivery"},{" "}
              {item.load.deliveryState || ""}
            </Text>
          </View>
        </View>

        <View style={styles.carrierBox}>
          <View style={styles.carrierHeader}>
            <Ionicons name="business-outline" size={20} color="#10B981" />
            <Text style={styles.carrierName}>{item.carrier.companyName}</Text>
          </View>

          <Text style={styles.metaText}>
            Contact: {item.carrier.contactName || "Not provided"}
          </Text>

          <Text style={styles.metaText}>
            Email: {item.carrier.email || "Not provided"}
          </Text>

          <Text style={styles.metaText}>
            Phone: {item.carrier.phone || "Not provided"}
          </Text>
        </View>

        <View style={styles.metricsRow}>
          <MiniMetric label="Rate" value={formatMoney(item.load.rate)} />
          <MiniMetric label="Miles" value={item.estimatedMiles} />
          <MiniMetric label="ETA Min" value={item.estimatedEtaMinutes} />
        </View>

        <Text style={styles.reasonTitle}>AI Match Reason</Text>
        <Text style={styles.reasonText}>{item.reason}</Text>

        {recommended ? (
          <View style={styles.recommendedBadge}>
            <Ionicons name="checkmark-circle-outline" size={16} color="#BBF7D0" />
            <Text style={styles.recommendedText}>Recommended Assignment</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={styles.assignButton}
          onPress={() => assignCarrier(item.load.id)}
        >
          <Ionicons name="flash-outline" size={18} color="#FFFFFF" />
          <Text style={styles.assignText}>Auto-Assign Best Carrier</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const topMatches = matches.slice(0, 20);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#020617" />

      <View style={styles.container}>
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>Farm2Home AI Dispatch</Text>

              <Text style={styles.title}>Smart Carrier Matching</Text>

              <Text style={styles.subtitle}>
                Rank carriers by pickup distance, equipment fit, refrigerated
                capability, load value, and regional route efficiency.
              </Text>
            </View>

            <View style={styles.heroIcon}>
              <Ionicons name="sparkles-outline" size={34} color="#FFFFFF" />
            </View>
          </View>
        </View>

        <View style={styles.navRow}>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => router.push("/admin/control-tower" as any)}
          >
            <Ionicons name="radio-outline" size={18} color="#FFFFFF" />
            <Text style={styles.navText}>Control Tower</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navButtonOutline}
            onPress={() => router.push("/freight/board" as any)}
          >
            <Ionicons name="list-outline" size={18} color="#10B981" />
            <Text style={styles.navTextOutline}>Freight Board</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.navRow}>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => router.push("/admin/live-operations-center" as any)}
          >
            <Ionicons name="navigate-outline" size={18} color="#FFFFFF" />
            <Text style={styles.navText}>Live Ops</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navButtonOutline}
            onPress={() => router.push("/freight/dashboard" as any)}
          >
            <Ionicons name="grid-outline" size={18} color="#10B981" />
            <Text style={styles.navTextOutline}>Freight Dashboard</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color="#10B981" />
            <Text style={styles.loadingText}>Running AI dispatch scoring...</Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.statsGrid}>
              <StatCard
                label="Total Matches"
                value={String(stats.total)}
                icon="git-compare-outline"
                accent
              />
              <StatCard
                label="Recommended"
                value={String(stats.recommended)}
                icon="checkmark-done-outline"
                accent
              />
              <StatCard
                label="Top Score"
                value={String(stats.topScore)}
                icon="speedometer-outline"
              />
              <StatCard
                label="Strong Matches"
                value={String(stats.strongMatches)}
                icon="flash-outline"
              />
              <StatCard
                label="Medium Matches"
                value={String(stats.mediumMatches)}
                icon="analytics-outline"
              />
            </View>

            <TouchableOpacity
              style={styles.refreshButton}
              onPress={loadDispatchMatches}
            >
              <Ionicons name="refresh-outline" size={18} color="#FFFFFF" />
              <Text style={styles.refreshText}>Refresh AI Matches</Text>
            </TouchableOpacity>

            <Text style={styles.sectionTitle}>Recommended Dispatch Plan</Text>

            {recommendedPlan.length === 0 ? (
              <EmptyCard
                title="No recommendations yet."
                text="Add open freight loads and approved freight carriers to generate AI matches."
              />
            ) : (
              recommendedPlan.map((item) => (
                <View key={`recommended-${item.load.id}`}>
                  {renderMatchCard(item, true)}
                </View>
              ))
            )}

            <Text style={styles.sectionTitle}>Top Carrier Matches</Text>

            <FlatList
              data={topMatches}
              keyExtractor={(item, index) =>
                `${item.load.id}-${item.carrier.id}-${index}`
              }
              scrollEnabled={false}
              contentContainerStyle={{ paddingBottom: 90 }}
              ListEmptyComponent={
                <EmptyCard
                  title="No AI matches found."
                  text="Make sure freight carriers are approved and freight loads are open."
                />
              }
              renderItem={({ item }) => renderMatchCard(item)}
            />
          </ScrollView>
        )}
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

function MiniMetric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <View style={styles.metricMini}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function EmptyCard({ title, text }: { title: string; text: string }) {
  return (
    <View style={styles.emptyCard}>
      <Ionicons name="file-tray-outline" size={34} color="#10B981" />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: freightTheme.colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: freightTheme.colors.background,
  },
  hero: {
    backgroundColor: "#020617",
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 28,
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
    borderWidth: 1,
    borderColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: {
    color: "#10B981",
    fontWeight: "900",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900",
    marginBottom: 10,
  },
  subtitle: {
    color: "#CBD5E1",
    lineHeight: 23,
    fontSize: 15,
    fontWeight: "700",
  },
  navRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 14,
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
  loadingCard: {
    backgroundColor: freightTheme.colors.card,
    margin: 18,
    padding: 26,
    borderRadius: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
  },
  loadingText: {
    color: freightTheme.colors.mutedText,
    marginTop: 10,
    fontWeight: "800",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 18,
    marginBottom: 14,
  },
  statCard: {
    width: "48%",
    backgroundColor: freightTheme.colors.card,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
    borderRadius: 18,
    padding: 15,
  },
  statCardAccent: {
    backgroundColor: "#064E3B",
    borderColor: "#064E3B",
  },
  statValue: {
    color: freightTheme.colors.primary,
    fontSize: 25,
    fontWeight: "900",
    marginTop: 8,
  },
  statValueAccent: {
    color: "#FFFFFF",
  },
  statLabel: {
    color: freightTheme.colors.mutedText,
    fontWeight: "800",
    fontSize: 12,
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
    justifyContent: "center",
    marginBottom: 18,
    flexDirection: "row",
    gap: 8,
  },
  refreshText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  sectionTitle: {
    color: freightTheme.colors.text,
    fontSize: 24,
    fontWeight: "900",
    paddingHorizontal: 18,
    marginBottom: 12,
    marginTop: 4,
  },
  emptyCard: {
    backgroundColor: freightTheme.colors.card,
    marginHorizontal: 18,
    marginBottom: 18,
    padding: 22,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
    alignItems: "center",
  },
  emptyTitle: {
    color: freightTheme.colors.text,
    fontSize: 19,
    fontWeight: "900",
    marginTop: 10,
    marginBottom: 6,
    textAlign: "center",
  },
  emptyText: {
    color: freightTheme.colors.mutedText,
    lineHeight: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  matchCard: {
    backgroundColor: freightTheme.colors.card,
    marginHorizontal: 18,
    marginBottom: 16,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
  },
  matchHeader: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
    alignItems: "flex-start",
  },
  matchIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
  },
  loadTitle: {
    color: freightTheme.colors.text,
    fontSize: 19,
    fontWeight: "900",
  },
  commodity: {
    color: freightTheme.colors.mutedText,
    fontWeight: "700",
    marginTop: 4,
  },
  scoreBadge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreText: {
    color: "#FFFFFF",
    fontWeight: "900",
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
    gap: 8,
  },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: freightTheme.colors.border,
    marginLeft: 8,
    marginVertical: 6,
  },
  routeText: {
    color: freightTheme.colors.text,
    fontWeight: "800",
    flex: 1,
  },
  carrierBox: {
    backgroundColor: freightTheme.colors.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
  },
  carrierHeader: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    marginBottom: 6,
  },
  carrierName: {
    color: freightTheme.colors.text,
    fontWeight: "900",
    flex: 1,
  },
  metaText: {
    color: freightTheme.colors.mutedText,
    fontWeight: "700",
    marginBottom: 3,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  metricMini: {
    flex: 1,
    backgroundColor: "#064E3B",
    padding: 12,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#10B981",
  },
  metricValue: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  metricLabel: {
    color: "#BBF7D0",
    fontWeight: "700",
    fontSize: 12,
    marginTop: 3,
  },
  reasonTitle: {
    color: freightTheme.colors.text,
    fontWeight: "900",
    marginBottom: 4,
  },
  reasonText: {
    color: freightTheme.colors.mutedText,
    fontWeight: "700",
    lineHeight: 21,
  },
  recommendedBadge: {
    backgroundColor: "#064E3B",
    borderRadius: 999,
    padding: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    flexDirection: "row",
    gap: 6,
    borderWidth: 1,
    borderColor: "#10B981",
  },
  recommendedText: {
    color: "#BBF7D0",
    fontWeight: "900",
  },
  assignButton: {
    backgroundColor: freightTheme.colors.primary,
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
  },
  assignText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
});