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
  AutonomousDispatchDecision,
  getAutonomousDispatchDecisions,
  getAutonomousDispatchHistory,
  getDispatchRiskAlerts,
  runAutonomousDispatch,
} from "./autonomous-dispatch";

type DispatchAlert = {
  loadId: string;
  loadTitle: string;
  priority: string;
  score: number;
  alert: string;
  reason: string;
};

type DispatchLog = {
  id: string;
  dry_run: boolean;
  only_critical: boolean;
  total_open_loads: number;
  auto_assignable_loads: number;
  manual_review_loads: number;
  critical_loads: number;
  successful_assignments: number;
  created_at: string;
};

export default function AutonomousDispatchDashboard() {
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);

  const [generatedAt, setGeneratedAt] = useState("");
  const [decisions, setDecisions] = useState<AutonomousDispatchDecision[]>([]);
  const [alerts, setAlerts] = useState<DispatchAlert[]>([]);
  const [history, setHistory] = useState<DispatchLog[]>([]);

  const [totalOpenLoads, setTotalOpenLoads] = useState(0);
  const [autoAssignableLoads, setAutoAssignableLoads] = useState(0);
  const [manualReviewLoads, setManualReviewLoads] = useState(0);
  const [criticalLoads, setCriticalLoads] = useState(0);

  useFocusEffect(
    useCallback(() => {
      loadAutonomousDispatch();
    }, [])
  );

  async function loadAutonomousDispatch() {
    try {
      setLoading(true);

      const summary = await getAutonomousDispatchDecisions();
      const riskAlerts = await getDispatchRiskAlerts();
      const logs = await getAutonomousDispatchHistory();

      setGeneratedAt(summary.generatedAt);
      setDecisions(summary.decisions);
      setAlerts(riskAlerts as DispatchAlert[]);
      setHistory(logs as DispatchLog[]);

      setTotalOpenLoads(summary.totalOpenLoads);
      setAutoAssignableLoads(summary.autoAssignableLoads);
      setManualReviewLoads(summary.manualReviewLoads);
      setCriticalLoads(summary.criticalLoads);
    } catch (error) {
      console.log("Autonomous dispatch dashboard error:", error);
      Alert.alert("Dispatch Error", "Unable to load autonomous dispatch data.");
    } finally {
      setLoading(false);
    }
  }

  async function dryRunDispatch() {
    try {
      setRunning(true);

      const result = await runAutonomousDispatch({
        dryRun: true,
      });

      Alert.alert(
        "Dry Run Complete",
        `${result.attemptedAssignments} loads were evaluated for autonomous assignment.`
      );

      await loadAutonomousDispatch();
    } catch (error: any) {
      Alert.alert(
        "Dry Run Error",
        error.message || "Unable to run dispatch dry run."
      );
    } finally {
      setRunning(false);
    }
  }

  async function runCriticalOnlyDispatch() {
    try {
      setRunning(true);

      const result = await runAutonomousDispatch({
        dryRun: false,
        onlyCritical: true,
      });

      Alert.alert(
        "Critical Dispatch Complete",
        `${result.successfulAssignments} critical loads were assigned.`
      );

      await loadAutonomousDispatch();
    } catch (error: any) {
      Alert.alert(
        "Critical Dispatch Error",
        error.message || "Unable to assign critical loads."
      );
    } finally {
      setRunning(false);
    }
  }

  function runFullAutonomousDispatch() {
    Alert.alert(
      "Run Full Autonomous Dispatch?",
      "This will automatically assign all qualified loads to their best carriers.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Run",
          style: "destructive",
          onPress: async () => {
            try {
              setRunning(true);

              const result = await runAutonomousDispatch({
                dryRun: false,
              });

              Alert.alert(
                "Autonomous Dispatch Complete",
                `${result.successfulAssignments} loads were assigned successfully.`
              );

              await loadAutonomousDispatch();
            } catch (error: any) {
              Alert.alert(
                "Dispatch Error",
                error.message || "Unable to run autonomous dispatch."
              );
            } finally {
              setRunning(false);
            }
          },
        },
      ]
    );
  }

  function priorityColor(priority: string) {
    switch (priority) {
      case "CRITICAL":
        return "#DC2626";
      case "HIGH":
        return "#F59E0B";
      case "MEDIUM":
        return "#2563EB";
      default:
        return "#64748B";
    }
  }

  function scoreColor(score: number) {
    if (score >= 80) return "#10B981";
    if (score >= 65) return "#F59E0B";
    return "#DC2626";
  }

  function formatDate(value?: string) {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleString();
  }

  function renderDecision(item: AutonomousDispatchDecision) {
    return (
      <View style={styles.decisionCard}>
        <View style={styles.decisionHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.loadTitle}>{item.loadTitle}</Text>
            <Text style={styles.loadSub}>Load #{item.loadId.slice(-6)}</Text>
          </View>

          <View
            style={[
              styles.priorityBadge,
              {
                backgroundColor: priorityColor(item.priority),
              },
            ]}
          >
            <Text style={styles.priorityText}>{item.priority}</Text>
          </View>
        </View>

        <View style={styles.scoreRow}>
          <View
            style={[
              styles.scoreBadge,
              {
                backgroundColor: scoreColor(item.score),
              },
            ]}
          >
            <Text style={styles.scoreText}>{item.score}</Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.carrierTitle}>Recommended Carrier</Text>
            <Text style={styles.carrierName}>
              {item.recommendedCarrierName || "No carrier found"}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.assignStatus,
            item.shouldAutoAssign ? styles.assignReady : styles.assignManual,
          ]}
        >
          <Text
            style={[
              styles.assignStatusText,
              item.shouldAutoAssign
                ? styles.assignReadyText
                : styles.assignManualText,
            ]}
          >
            {item.shouldAutoAssign
              ? "READY FOR AUTO-ASSIGN"
              : "MANUAL REVIEW REQUIRED"}
          </Text>
        </View>

        <Text style={styles.reasonText}>{item.reason}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Farm2Home AI</Text>

        <Text style={styles.title}>Autonomous Dispatch</Text>

        <Text style={styles.subtitle}>
          Review AI dispatch decisions, critical load alerts, carrier assignment
          recommendations, and autonomous assignment history.
        </Text>
      </View>

      <View style={styles.navRow}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => router.push("/ai/dispatch-dashboard")}
        >
          <Text style={styles.navText}>AI Dispatch</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButtonOutline}
          onPress={() => router.push("/admin/control-tower")}
        >
          <Text style={styles.navTextOutline}>Control Tower</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.loadingText}>
            Loading autonomous dispatch brain...
          </Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.statsGrid}>
            <StatCard label="Open Loads" value={totalOpenLoads} />
            <StatCard
              label="Auto-Assignable"
              value={autoAssignableLoads}
              accent
            />
            <StatCard label="Manual Review" value={manualReviewLoads} />
            <StatCard label="Critical Loads" value={criticalLoads} accent />
          </View>

          {!!generatedAt && (
            <Text style={styles.generatedText}>
              Last generated: {formatDate(generatedAt)}
            </Text>
          )}

          <View style={styles.actionPanel}>
            <Text style={styles.actionTitle}>Autonomous Controls</Text>

            <TouchableOpacity
              style={styles.dryRunButton}
              onPress={dryRunDispatch}
              disabled={running}
            >
              <Text style={styles.actionButtonText}>
                {running ? "Running..." : "Run Dry Run"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.criticalButton}
              onPress={runCriticalOnlyDispatch}
              disabled={running}
            >
              <Text style={styles.actionButtonText}>
                Assign Critical Only
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.fullRunButton}
              onPress={runFullAutonomousDispatch}
              disabled={running}
            >
              <Text style={styles.actionButtonText}>
                Run Full Autonomous Dispatch
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.refreshButton}
            onPress={loadAutonomousDispatch}
          >
            <Text style={styles.refreshText}>Refresh AI Decisions</Text>
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>Risk Alerts</Text>

          {alerts.length === 0 ? (
            <EmptyCard
              title="No risk alerts."
              text="Critical loads and low-score matches will appear here."
            />
          ) : (
            alerts.map((item) => (
              <View key={item.loadId} style={styles.alertCard}>
                <View style={styles.alertHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.alertTitle}>{item.loadTitle}</Text>
                    <Text style={styles.alertText}>{item.alert}</Text>
                  </View>

                  <View
                    style={[
                      styles.priorityBadge,
                      {
                        backgroundColor: priorityColor(item.priority),
                      },
                    ]}
                  >
                    <Text style={styles.priorityText}>{item.priority}</Text>
                  </View>
                </View>

                <Text style={styles.reasonText}>{item.reason}</Text>
              </View>
            ))
          )}

          <Text style={styles.sectionTitle}>AI Dispatch Decisions</Text>

          <FlatList
            data={decisions}
            keyExtractor={(item) => item.loadId}
            scrollEnabled={false}
            ListEmptyComponent={
              <EmptyCard
                title="No decisions available."
                text="Add open loads and approved carriers to generate AI dispatch decisions."
              />
            }
            renderItem={({ item }) => renderDecision(item)}
          />

          <Text style={styles.sectionTitle}>Dispatch History</Text>

          <FlatList
            data={history}
            keyExtractor={(item, index) => item.id || String(index)}
            scrollEnabled={false}
            contentContainerStyle={{ paddingBottom: 100 }}
            ListEmptyComponent={
              <EmptyCard
                title="No dispatch history yet."
                text="Dry runs and autonomous dispatch runs will be logged here."
              />
            }
            renderItem={({ item }) => (
              <View style={styles.historyCard}>
                <View style={styles.historyHeader}>
                  <Text style={styles.historyTitle}>
                    {item.dry_run
                      ? "Dry Run"
                      : item.only_critical
                      ? "Critical Dispatch"
                      : "Full Dispatch"}
                  </Text>

                  <Text style={styles.historyDate}>
                    {formatDate(item.created_at)}
                  </Text>
                </View>

                <Text style={styles.historyText}>
                  Open Loads: {item.total_open_loads}
                </Text>

                <Text style={styles.historyText}>
                  Auto-Assignable: {item.auto_assignable_loads}
                </Text>

                <Text style={styles.historyText}>
                  Manual Review: {item.manual_review_loads}
                </Text>

                <Text style={styles.historyText}>
                  Critical Loads: {item.critical_loads}
                </Text>

                <Text style={styles.historyText}>
                  Successful Assignments: {item.successful_assignments}
                </Text>
              </View>
            )}
          />

          <View style={{ height: 80 }} />
        </ScrollView>
      )}
    </View>
  );
}

function StatCard({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
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

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 18,
    marginBottom: 12,
  },

  statCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  statCardAccent: {
    backgroundColor: "#064E3B",
    borderColor: "#064E3B",
  },

  statValue: {
    color: "#10B981",
    fontSize: 25,
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

  generatedText: {
    color: "#6B7280",
    fontWeight: "800",
    paddingHorizontal: 18,
    marginBottom: 14,
  },

  actionPanel: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    marginBottom: 14,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  actionTitle: {
    color: "#111827",
    fontSize: 21,
    fontWeight: "900",
    marginBottom: 12,
  },

  dryRunButton: {
    backgroundColor: "#334155",
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 10,
  },

  criticalButton: {
    backgroundColor: "#F59E0B",
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 10,
  },

  fullRunButton: {
    backgroundColor: "#DC2626",
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
  },

  actionButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  refreshButton: {
    backgroundColor: "#111827",
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
    fontSize: 23,
    fontWeight: "900",
    paddingHorizontal: 18,
    marginBottom: 12,
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

  alertCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    marginBottom: 12,
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  alertHeader: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 8,
  },

  alertTitle: {
    color: "#111827",
    fontWeight: "900",
    fontSize: 17,
  },

  alertText: {
    color: "#374151",
    fontWeight: "700",
    marginTop: 4,
  },

  decisionCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    marginBottom: 14,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  decisionHeader: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },

  loadTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "900",
  },

  loadSub: {
    color: "#6B7280",
    fontWeight: "700",
    marginTop: 4,
  },

  priorityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    alignSelf: "flex-start",
  },

  priorityText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 11,
  },

  scoreRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    marginBottom: 12,
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

  carrierTitle: {
    color: "#6B7280",
    fontWeight: "700",
  },

  carrierName: {
    color: "#111827",
    fontWeight: "900",
    marginTop: 3,
  },

  assignStatus: {
    borderRadius: 14,
    padding: 10,
    marginBottom: 10,
    alignItems: "center",
  },

  assignReady: {
    backgroundColor: "#DCFCE7",
  },

  assignManual: {
    backgroundColor: "#FEF3C7",
  },

  assignStatusText: {
    fontWeight: "900",
  },

  assignReadyText: {
    color: "#166534",
  },

  assignManualText: {
    color: "#92400E",
  },

  reasonText: {
    color: "#374151",
    fontWeight: "700",
    lineHeight: 21,
  },

  historyCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    marginBottom: 12,
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 8,
  },

  historyTitle: {
    color: "#111827",
    fontWeight: "900",
    fontSize: 17,
  },

  historyDate: {
    color: "#6B7280",
    fontWeight: "700",
    flex: 1,
    textAlign: "right",
  },

  historyText: {
    color: "#374151",
    fontWeight: "700",
    marginBottom: 3,
  },
});