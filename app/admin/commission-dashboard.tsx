import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

type Period = "Today" | "This Week" | "This Month" | "This Year";

type CommissionLine = {
  id: string;
  source: string;
  grossSales: number;
  commissionRate: number;
};

const lines: CommissionLine[] = [
  { id: "marketplace", source: "Marketplace Orders", grossSales: 12500, commissionRate: 0.12 },
  { id: "subscriptions", source: "Customer Subscriptions", grossSales: 6200, commissionRate: 0.18 },
  { id: "farmer-plans", source: "Farmer Plans", grossSales: 3400, commissionRate: 1 },
  { id: "freight", source: "Freight Loads", grossSales: 18500, commissionRate: 0.08 },
];

export default function CommissionDashboard() {
  const [period, setPeriod] = useState<Period>("This Month");

  const periods: Period[] = ["Today", "This Week", "This Month", "This Year"];

  const totalGross = useMemo(() => {
    return lines.reduce((sum, line) => sum + line.grossSales, 0);
  }, []);

  const totalCommission = useMemo(() => {
    return lines.reduce(
      (sum, line) => sum + line.grossSales * line.commissionRate,
      0
    );
  }, []);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Admin Revenue</Text>
        <Text style={styles.title}>Commission Dashboard</Text>
        <Text style={styles.subtitle}>
          Monitor platform revenue from marketplace commissions, subscriptions,
          farmer plans, and freight loads.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Time Period</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
        {periods.map((item) => (
          <TouchableOpacity
            key={item}
            style={[styles.chip, period === item && styles.chipActive]}
            onPress={() => setPeriod(item)}
          >
            <Text style={[styles.chipText, period === item && styles.chipTextActive]}>
              {item}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.revenueCard}>
        <Text style={styles.revenueLabel}>{period} Platform Commission</Text>
        <Text style={styles.revenueNumber}>${totalCommission.toFixed(2)}</Text>
        <Text style={styles.revenueSub}>
          Gross platform volume: ${totalGross.toFixed(2)}
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Revenue Streams</Text>

      {lines.map((line) => {
        const commission = line.grossSales * line.commissionRate;

        return (
          <View key={line.id} style={styles.lineCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.lineSource}>{line.source}</Text>
              <Text style={styles.lineMeta}>
                Gross sales: ${line.grossSales.toFixed(2)}
              </Text>
              <Text style={styles.lineMeta}>
                Rate: {(line.commissionRate * 100).toFixed(0)}%
              </Text>
            </View>

            <Text style={styles.lineCommission}>${commission.toFixed(2)}</Text>
          </View>
        );
      })}

      <View style={styles.aiCard}>
        <Text style={styles.aiTitle}>AI Commission Intelligence</Text>
        <Text style={styles.aiText}>
          Later this can forecast revenue, identify top-performing channels,
          optimize pricing, and alert admin when commission trends drop.
        </Text>
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
  sectionTitle: {
    color: "#111827",
    fontSize: 23,
    fontWeight: "900",
    paddingHorizontal: 18,
    marginTop: 18,
    marginBottom: 12,
  },
  chipRow: { paddingLeft: 18, marginBottom: 4 },
  chip: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 999,
    marginRight: 10,
  },
  chipActive: { backgroundColor: "#2563EB", borderColor: "#2563EB" },
  chipText: { color: "#111827", fontWeight: "900" },
  chipTextActive: { color: "#FFFFFF" },
  revenueCard: {
    backgroundColor: "#111827",
    margin: 18,
    borderRadius: 24,
    padding: 20,
  },
  revenueLabel: { color: "#BFDBFE", fontWeight: "900" },
  revenueNumber: { color: "#FFFFFF", fontSize: 42, fontWeight: "900", marginTop: 6 },
  revenueSub: { color: "#D1D5DB", fontWeight: "700", marginTop: 8 },
  lineCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    marginBottom: 12,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  lineSource: { color: "#111827", fontSize: 18, fontWeight: "900" },
  lineMeta: { color: "#6B7280", fontWeight: "700", marginTop: 5 },
  lineCommission: { color: "#2563EB", fontSize: 20, fontWeight: "900" },
  aiCard: {
    backgroundColor: "#111827",
    marginHorizontal: 18,
    marginTop: 8,
    borderRadius: 22,
    padding: 18,
  },
  aiTitle: { color: "#FFFFFF", fontSize: 23, fontWeight: "900", marginBottom: 8 },
  aiText: { color: "#BFDBFE", fontWeight: "700", lineHeight: 22 },
});