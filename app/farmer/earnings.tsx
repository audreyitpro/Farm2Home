import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";

import { supabase } from "../services/supabaseClient";

type FarmerPayout = {
  id: number;
  order_id: string;
  farmer_name: string;
  stripe_account_id: string;
  stripe_transfer_id: string;
  gross_amount: number;
  platform_fee: number;
  net_amount: number;
  payout_status: string;
  created_at: string;
};

export default function FarmerEarningsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [payouts, setPayouts] = useState<FarmerPayout[]>([]);

  const [stats, setStats] = useState({
    totalGross: 0,
    totalNet: 0,
    totalOrders: 0,
  });

  const loadPayouts = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("farmer_payouts")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.log("Farmer payout fetch error:", error);
        return;
      }

      const payoutData = (data || []) as FarmerPayout[];

      setPayouts(payoutData);

      const totalGross = payoutData.reduce(
        (sum, item) => sum + Number(item.gross_amount || 0),
        0
      );

      const totalNet = payoutData.reduce(
        (sum, item) => sum + Number(item.net_amount || 0),
        0
      );

      setStats({
        totalGross,
        totalNet,
        totalOrders: payoutData.length,
      });
    } catch (error) {
      console.log("Load payouts error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadPayouts();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPayouts();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0B7A5C" />
        <Text style={styles.loadingText}>Loading earnings...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text style={styles.header}>Farmer Earnings Dashboard</Text>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Gross</Text>
          <Text style={styles.summaryValue}>
            ${stats.totalGross.toFixed(2)}
          </Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Net</Text>
          <Text style={styles.summaryValue}>
            ${stats.totalNet.toFixed(2)}
          </Text>
        </View>
      </View>

      <View style={styles.summaryCardLarge}>
        <Text style={styles.summaryLabel}>Orders Paid Out</Text>
        <Text style={styles.summaryLargeValue}>
          {stats.totalOrders}
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Recent Farmer Payouts</Text>

      {payouts.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            No payouts found yet.
          </Text>
        </View>
      ) : (
        payouts.map((item) => (
          <View key={item.id} style={styles.payoutCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.farmName}>
                {item.farmer_name}
              </Text>

              <Text style={styles.amount}>
                ${Number(item.net_amount).toFixed(2)}
              </Text>
            </View>

            <Text style={styles.label}>
              Order ID:
            </Text>

            <Text style={styles.value}>
              {item.order_id}
            </Text>

            <Text style={styles.label}>
              Stripe Transfer:
            </Text>

            <Text style={styles.value}>
              {item.stripe_transfer_id}
            </Text>

            <Text style={styles.label}>
              Stripe Account:
            </Text>

            <Text style={styles.value}>
              {item.stripe_account_id}
            </Text>

            <View style={styles.rowBetween}>
              <View>
                <Text style={styles.label}>
                  Gross
                </Text>

                <Text style={styles.money}>
                  ${Number(item.gross_amount).toFixed(2)}
                </Text>
              </View>

              <View>
                <Text style={styles.label}>
                  Platform Fee
                </Text>

                <Text style={styles.money}>
                  ${Number(item.platform_fee).toFixed(2)}
                </Text>
              </View>

              <View>
                <Text style={styles.label}>
                  Net
                </Text>

                <Text style={styles.moneyGreen}>
                  ${Number(item.net_amount).toFixed(2)}
                </Text>
              </View>
            </View>

            <View style={styles.statusContainer}>
              <Text style={styles.statusText}>
                {item.payout_status}
              </Text>
            </View>

            <Text style={styles.date}>
              {new Date(item.created_at).toLocaleString()}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F0",
    padding: 16,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F5F0",
  },

  loadingText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: "600",
    color: "#0B7A5C",
  },

  header: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0B7A5C",
    marginBottom: 20,
    marginTop: 10,
  },

  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    width: "48%",
    elevation: 3,
  },

  summaryCardLarge: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 22,
    elevation: 3,
  },

  summaryLabel: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
    fontWeight: "600",
  },

  summaryValue: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0B7A5C",
  },

  summaryLargeValue: {
    fontSize: 34,
    fontWeight: "900",
    color: "#0B7A5C",
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#222",
    marginBottom: 14,
  },

  payoutCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    elevation: 3,
  },

  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },

  farmName: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111",
    flex: 1,
    paddingRight: 10,
  },

  amount: {
    fontSize: 24,
    fontWeight: "900",
    color: "#0B7A5C",
  },

  label: {
    fontSize: 12,
    fontWeight: "700",
    color: "#777",
    marginTop: 8,
  },

  value: {
    fontSize: 13,
    color: "#111",
    marginTop: 4,
  },

  money: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111",
  },

  moneyGreen: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0B7A5C",
  },

  statusContainer: {
    marginTop: 16,
    backgroundColor: "#E6F7EE",
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: "center",
  },

  statusText: {
    color: "#0B7A5C",
    fontWeight: "800",
    fontSize: 13,
  },

  date: {
    marginTop: 12,
    fontSize: 12,
    color: "#777",
    textAlign: "right",
  },

  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 30,
    alignItems: "center",
  },

  emptyText: {
    fontSize: 16,
    color: "#666",
    fontWeight: "600",
  },
});