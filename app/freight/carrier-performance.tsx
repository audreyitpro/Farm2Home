import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

type Metric = {
  id: string;
  label: string;
  value: string;
  detail: string;
};

const metrics: Metric[] = [
  {
    id: "on-time",
    label: "On-Time Delivery",
    value: "96%",
    detail: "Strong delivery performance this month.",
  },
  {
    id: "acceptance",
    label: "Load Acceptance",
    value: "88%",
    detail: "Accepted most dispatched freight opportunities.",
  },
  {
    id: "claims",
    label: "Claims Rate",
    value: "0.5%",
    detail: "Low freight damage or dispute rate.",
  },
  {
    id: "rating",
    label: "Broker Rating",
    value: "4.8",
    detail: "High carrier satisfaction score.",
  },
];

const recentLoads = [
  "Detroit, MI → Columbus, OH",
  "Sterling Heights, MI → Chicago, IL",
  "Ann Arbor, MI → Cleveland, OH",
];

export default function CarrierPerformance() {
  const performanceScore = useMemo(() => {
    return 94;
  }, []);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Freight Carrier Scorecard</Text>
        <Text style={styles.title}>Carrier Performance</Text>
        <Text style={styles.subtitle}>
          Monitor carrier quality, load acceptance, on-time delivery, claims,
          and broker score.
        </Text>
      </View>

      <View style={styles.scoreCard}>
        <Text style={styles.scoreLabel}>Overall Score</Text>
        <Text style={styles.scoreNumber}>{performanceScore}</Text>
        <Text style={styles.scoreText}>Excellent carrier performance</Text>
      </View>

      <Text style={styles.sectionTitle}>Performance Metrics</Text>

      <View style={styles.grid}>
        {metrics.map((metric) => (
          <View key={metric.id} style={styles.metricCard}>
            <Text style={styles.metricValue}>{metric.value}</Text>
            <Text style={styles.metricLabel}>{metric.label}</Text>
            <Text style={styles.metricDetail}>{metric.detail}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Recent Completed Loads</Text>

      {recentLoads.map((load) => (
        <View key={load} style={styles.loadCard}>
          <Text style={styles.loadRoute}>{load}</Text>
          <Text style={styles.loadMeta}>Completed · No exception reported</Text>
        </View>
      ))}

      <View style={styles.aiCard}>
        <Text style={styles.aiTitle}>AI Carrier Intelligence</Text>
        <Text style={styles.aiText}>
          Later this can rank carriers by risk, lane reliability, claim history,
          driver behavior, pickup compliance, and payment speed.
        </Text>

        <Text style={styles.aiItem}>• Predict late delivery risk</Text>
        <Text style={styles.aiItem}>• Identify best carriers by lane</Text>
        <Text style={styles.aiItem}>• Score driver communication</Text>
        <Text style={styles.aiItem}>• Track claims and service failures</Text>
      </View>

      <View style={{ height: 90 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F4F6" },

  hero: {
    backgroundColor: "#111827",
    paddingTop: 64,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },

  eyebrow: { color: "#93C5FD", fontWeight: "900", marginBottom: 8 },

  title: { color: "#FFFFFF", fontSize: 35, fontWeight: "900", marginBottom: 10 },

  subtitle: { color: "#D1D5DB", fontWeight: "700", lineHeight: 23 },

  scoreCard: {
    backgroundColor: "#111827",
    margin: 18,
    borderRadius: 24,
    padding: 22,
  },

  scoreLabel: { color: "#BFDBFE", fontWeight: "900" },

  scoreNumber: { color: "#FFFFFF", fontSize: 52, fontWeight: "900", marginTop: 6 },

  scoreText: { color: "#D1D5DB", fontWeight: "700", marginTop: 6 },

  sectionTitle: {
    color: "#111827",
    fontSize: 23,
    fontWeight: "900",
    paddingHorizontal: 18,
    marginBottom: 12,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingHorizontal: 18,
    marginBottom: 18,
  },

  metricCard: {
    width: "47%",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  metricValue: { color: "#2563EB", fontSize: 26, fontWeight: "900" },

  metricLabel: { color: "#111827", fontWeight: "900", marginTop: 5 },

  metricDetail: { color: "#6B7280", fontWeight: "700", lineHeight: 19, marginTop: 6 },

  loadCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    marginBottom: 12,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  loadRoute: { color: "#111827", fontSize: 18, fontWeight: "900" },

  loadMeta: { color: "#6B7280", fontWeight: "700", marginTop: 5 },

  aiCard: {
    backgroundColor: "#111827",
    marginHorizontal: 18,
    marginTop: 8,
    borderRadius: 22,
    padding: 18,
  },

  aiTitle: { color: "#FFFFFF", fontSize: 23, fontWeight: "900", marginBottom: 8 },

  aiText: { color: "#BFDBFE", fontWeight: "700", lineHeight: 22, marginBottom: 12 },

  aiItem: { color: "#DBEAFE", fontWeight: "800", lineHeight: 25 },
});