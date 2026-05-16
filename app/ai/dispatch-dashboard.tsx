import React, { useCallback, useState } from "react";
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

import {
  DispatchMatch,
  autoAssignBestCarrier,
  getSmartDispatchMatches,
  recommendDispatchPlan,
} from "./smart-dispatch";

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

  function getScoreColor(score: number) {
    if (score >= 80) return "#22C55E";
    if (score >= 60) return "#F59E0B";
    return "#EF4444";
  }

  function renderMatchCard(item: DispatchMatch, recommended = false) {
    return (
      <View style={styles.matchCard}>
        <View style={styles.matchHeader}>
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
          <Text style={styles.routeText}>
            📍 {item.load.pickupCity || "Pickup"},{" "}
            {item.load.pickupState || ""}
          </Text>

          <Text style={styles.arrow}>→</Text>

          <Text style={styles.routeText}>
            🏁 {item.load.deliveryCity || "Delivery"},{" "}
            {item.load.deliveryState || ""}
          </Text>
        </View>

        <View style={styles.carrierBox}>
          <Text style={styles.carrierName}>🚛 {item.carrier.companyName}</Text>

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
          <MiniMetric label="Rate" value={`$${item.load.rate.toFixed(0)}`} />
          <MiniMetric label="Miles" value={item.estimatedMiles} />
          <MiniMetric label="ETA Min" value={item.estimatedEtaMinutes} />
        </View>

        <Text style={styles.reasonTitle}>AI Match Reason</Text>
        <Text style={styles.reasonText}>{item.reason}</Text>

        {recommended ? (
          <View style={styles.recommendedBadge}>
            <Text style={styles.recommendedText}>Recommended Assignment</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={styles.assignButton}
          onPress={() => assignCarrier(item.load.id)}
        >
          <Text style={styles.assignText}>Auto-Assign Best Carrier</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const topMatches = matches.slice(0, 20);

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Farm2Home AI Dispatch</Text>

        <Text style={styles.title}>Smart Carrier Matching</Text>

        <Text style={styles.subtitle}>
          Automatically rank carriers by pickup distance, equipment fit,
          refrigerated capability, load value, and regional route efficiency.
        </Text>
      </View>

      <View style={styles.navRow}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => router.push("/freight/board")}
        >
          <Text style={styles.navText}>Freight Board</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButtonOutline}
          onPress={() => router.push("/freight/dashboard")}
        >
          <Text style={styles.navTextOutline}>Dashboard</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.loadingText}>Running AI dispatch scoring...</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.statsRow}>
            <StatCard label="Total Matches" value={matches.length} />
            <StatCard label="Recommended" value={recommendedPlan.length} />
            <StatCard label="Top Score" value={matches[0]?.score || 0} />
          </View>

          <TouchableOpacity
            style={styles.refreshButton}
            onPress={loadDispatchMatches}
          >
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
            ListEmptyComponent={
              <EmptyCard
                title="No AI matches found."
                text="Make sure freight carriers are approved and freight loads are open."
              />
            }
            renderItem={({ item }) => renderMatchCard(item)}
          />

          <View style={{ height: 60 }} />
        </ScrollView>
      )}
    </View>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
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
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
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
    paddingTop: 62,
    paddingHorizontal: 20,
    paddingBottom: 26,
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
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  loadingText: {
    color: "#6B7280",
    marginTop: 10,
    fontWeight: "800",
  },

  statsRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 18,
    marginBottom: 14,
  },

  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 18,
    padding: 14,
    alignItems: "center",
  },

  statValue: {
    color: "#10B981",
    fontSize: 26,
    fontWeight: "900",
  },

  statLabel: {
    color: "#6B7280",
    fontWeight: "800",
    fontSize: 12,
    marginTop: 4,
    textAlign: "center",
  },

  refreshButton: {
    backgroundColor: "#334155",
    marginHorizontal: 18,
    padding: 14,
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
    marginTop: 4,
  },

  emptyCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    marginBottom: 18,
    padding: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  emptyTitle: {
    color: "#111827",
    fontSize: 19,
    fontWeight: "900",
    marginBottom: 6,
  },

  emptyText: {
    color: "#6B7280",
    lineHeight: 22,
  },

  matchCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    marginBottom: 16,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  matchHeader: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },

  loadTitle: {
    color: "#111827",
    fontSize: 19,
    fontWeight: "900",
  },

  commodity: {
    color: "#6B7280",
    fontWeight: "700",
    marginTop: 4,
  },

  scoreBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },

  scoreText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  routeBox: {
    backgroundColor: "#F3F4F6",
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },

  routeText: {
    color: "#374151",
    fontWeight: "800",
    marginBottom: 4,
  },

  arrow: {
    color: "#10B981",
    fontSize: 20,
    fontWeight: "900",
  },

  carrierBox: {
    marginBottom: 12,
  },

  carrierName: {
    color: "#111827",
    fontWeight: "900",
    marginBottom: 4,
  },

  metaText: {
    color: "#6B7280",
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
    backgroundColor: "#ECFDF5",
    padding: 12,
    borderRadius: 14,
    alignItems: "center",
  },

  metricValue: {
    color: "#065F46",
    fontWeight: "900",
  },

  metricLabel: {
    color: "#047857",
    fontWeight: "700",
    fontSize: 12,
    marginTop: 3,
  },

  reasonTitle: {
    color: "#111827",
    fontWeight: "900",
    marginBottom: 4,
  },

  reasonText: {
    color: "#374151",
    fontWeight: "700",
    lineHeight: 21,
  },

  recommendedBadge: {
    backgroundColor: "#DCFCE7",
    borderRadius: 999,
    padding: 10,
    alignItems: "center",
    marginTop: 12,
  },

  recommendedText: {
    color: "#166534",
    fontWeight: "900",
  },

  assignButton: {
    backgroundColor: "#10B981",
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 12,
  },

  assignText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
});