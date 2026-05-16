import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";

import { supabase } from "../services/supabaseClient";
import farmTheme from "../styles/farmTheme";

type Period = "Today" | "This Week" | "This Month" | "This Year";

type FarmerProfile = {
  id: string;
  farmer_name: string;
  farmer_email: string;
  stripe_account_id: string;
};

type FarmerPayout = {
  id: number;
  order_id: string;
  farmer_name: string;
  farmer_email?: string;
  stripe_account_id: string;
  stripe_transfer_id: string;
  gross_amount: number;
  platform_fee: number;
  net_amount: number;
  payout_status: string;
  created_at: string;
};

const FARMER_EMAIL = "sunnybrook@test.com";

function isWithinPeriod(dateValue: string, period: Period) {
  const date = new Date(dateValue);
  const now = new Date();

  if (Number.isNaN(date.getTime())) return false;

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  if (period === "Today") {
    return date >= startOfToday;
  }

  if (period === "This Week") {
    const startOfWeek = new Date(now);
    const day = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - day);
    startOfWeek.setHours(0, 0, 0, 0);

    return date >= startOfWeek;
  }

  if (period === "This Month") {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return date >= startOfMonth;
  }

  if (period === "This Year") {
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    return date >= startOfYear;
  }

  return true;
}

export default function RevenueAnalytics() {
  const [period, setPeriod] = useState<Period>("This Month");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [farmerProfile, setFarmerProfile] = useState<FarmerProfile | null>(
    null
  );
  const [payouts, setPayouts] = useState<FarmerPayout[]>([]);

  const periods: Period[] = ["Today", "This Week", "This Month", "This Year"];

  const loadRevenueAnalytics = async () => {
    try {
      setLoading(true);

      const { data: profileData, error: profileError } = await supabase
        .from("farmer_profiles")
        .select("*")
        .eq("farmer_email", FARMER_EMAIL)
        .single();

      if (profileError) {
        console.log("Farmer profile error:", profileError);
        setFarmerProfile(null);
        setPayouts([]);
        return;
      }

      const profile = profileData as FarmerProfile;
      setFarmerProfile(profile);

      const { data: payoutData, error: payoutError } = await supabase
        .from("farmer_payouts")
        .select("*")
        .eq("stripe_account_id", profile.stripe_account_id)
        .order("created_at", { ascending: false });

      if (payoutError) {
        console.log("Farmer payout load error:", payoutError);
        setPayouts([]);
        return;
      }

      setPayouts((payoutData || []) as FarmerPayout[]);
    } catch (error) {
      console.log("Revenue analytics load error:", error);
      setPayouts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadRevenueAnalytics();
    }, [])
  );

  const filteredPayouts = useMemo(() => {
    return payouts.filter((item) => isWithinPeriod(item.created_at, period));
  }, [payouts, period]);

  const totalGross = useMemo(() => {
    return filteredPayouts.reduce(
      (sum, item) => sum + Number(item.gross_amount || 0),
      0
    );
  }, [filteredPayouts]);

  const totalNet = useMemo(() => {
    return filteredPayouts.reduce(
      (sum, item) => sum + Number(item.net_amount || 0),
      0
    );
  }, [filteredPayouts]);

  const totalPlatformFees = useMemo(() => {
    return filteredPayouts.reduce(
      (sum, item) => sum + Number(item.platform_fee || 0),
      0
    );
  }, [filteredPayouts]);

  const averagePayout = useMemo(() => {
    if (filteredPayouts.length === 0) return 0;
    return totalNet / filteredPayouts.length;
  }, [filteredPayouts.length, totalNet]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRevenueAnalytics();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={farmTheme.colors.primary} />
        <Text style={styles.loadingText}>Loading revenue analytics...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Farm2Home Farmer Analytics</Text>
        <Text style={styles.title}>Revenue Analytics</Text>
        <Text style={styles.subtitle}>
          Track Stripe payouts, farmer revenue, order earnings, and marketplace
          performance.
        </Text>

        <View style={styles.profileBadge}>
          <Text style={styles.profileText}>
            {farmerProfile?.farmer_name || "Farmer Profile Not Found"}
          </Text>
          <Text style={styles.profileSubText}>
            {farmerProfile?.stripe_account_id || FARMER_EMAIL}
          </Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Time Period</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipRow}
      >
        {periods.map((item) => (
          <TouchableOpacity
            key={item}
            style={[styles.chip, period === item && styles.chipActive]}
            onPress={() => setPeriod(item)}
          >
            <Text
              style={[
                styles.chipText,
                period === item && styles.chipTextActive,
              ]}
            >
              {item}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.revenueCard}>
        <Text style={styles.revenueLabel}>{period} Net Earnings</Text>
        <Text style={styles.revenueNumber}>${totalNet.toFixed(2)}</Text>
        <Text style={styles.revenueSub}>
          Actual farmer payout revenue from Stripe Connect transfers
        </Text>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>${totalGross.toFixed(2)}</Text>
          <Text style={styles.statLabel}>Gross Payouts</Text>
        </View>

        <View style={styles.statBox}>
          <Text style={styles.statNumber}>${averagePayout.toFixed(2)}</Text>
          <Text style={styles.statLabel}>Avg Payout</Text>
        </View>

        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{filteredPayouts.length}</Text>
          <Text style={styles.statLabel}>Paid Orders</Text>
        </View>

        <View style={styles.statBox}>
          <Text style={styles.statNumber}>${totalPlatformFees.toFixed(2)}</Text>
          <Text style={styles.statLabel}>Platform Fees</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Payout Breakdown</Text>

      {filteredPayouts.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No payouts found</Text>
          <Text style={styles.emptyText}>
            This farmer has no payouts for {period.toLowerCase()}.
          </Text>
        </View>
      ) : (
        filteredPayouts.map((payout) => (
          <View key={payout.id} style={styles.saleCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.saleProduct}>{payout.farmer_name}</Text>

              <Text style={styles.saleMeta}>
                Order: {payout.order_id}
              </Text>

              <Text style={styles.saleMeta}>
                Transfer: {payout.stripe_transfer_id}
              </Text>

              <Text style={styles.saleMeta}>
                Status: {payout.payout_status}
              </Text>

              <Text style={styles.saleDate}>
                {new Date(payout.created_at).toLocaleString()}
              </Text>
            </View>

            <View style={styles.amountBox}>
              <Text style={styles.saleRevenue}>
                ${Number(payout.net_amount || 0).toFixed(2)}
              </Text>

              <Text style={styles.grossText}>
                Gross ${Number(payout.gross_amount || 0).toFixed(2)}
              </Text>
            </View>
          </View>
        ))
      )}

      <View style={styles.aiCard}>
        <Text style={styles.aiTitle}>AI Revenue Insights</Text>
        <Text style={styles.aiText}>
          Later this can forecast weekly sales, compare farm performance,
          identify best-selling products, and recommend pricing adjustments.
        </Text>

        <Text style={styles.aiItem}>
          • {farmerProfile?.farmer_name || "This farmer"} has{" "}
          {filteredPayouts.length} paid payout record(s) for {period}.
        </Text>
        <Text style={styles.aiItem}>
          • Total net earnings for this period: ${totalNet.toFixed(2)}
        </Text>
        <Text style={styles.aiItem}>
          • Average payout amount: ${averagePayout.toFixed(2)}
        </Text>
        <Text style={styles.aiItem}>
          • Stripe transfer IDs are now saved for payout reconciliation.
        </Text>
      </View>

      <View style={{ height: 90 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: farmTheme.colors.background },

  loadingContainer: {
    flex: 1,
    backgroundColor: farmTheme.colors.background,
    justifyContent: "center",
    alignItems: "center",
  },

  loadingText: {
    marginTop: 12,
    color: farmTheme.colors.primary,
    fontWeight: "800",
  },

  hero: {
    backgroundColor: farmTheme.colors.primary,
    paddingTop: 64,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },

  eyebrow: { color: "#D1FAE5", fontWeight: "900", marginBottom: 8 },

  title: { color: "#FFFFFF", fontSize: 35, fontWeight: "900", marginBottom: 10 },

  subtitle: { color: "#E8F5E9", fontWeight: "700", lineHeight: 23 },

  profileBadge: {
    backgroundColor: "rgba(255,255,255,0.14)",
    padding: 14,
    borderRadius: 16,
    marginTop: 18,
  },

  profileText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },

  profileSubText: {
    color: "#D1FAE5",
    fontWeight: "700",
    marginTop: 4,
  },

  sectionTitle: {
    color: farmTheme.colors.text,
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
    borderColor: farmTheme.colors.border,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 999,
    marginRight: 10,
  },

  chipActive: {
    backgroundColor: farmTheme.colors.primary,
    borderColor: farmTheme.colors.primary,
  },

  chipText: { color: farmTheme.colors.text, fontWeight: "900" },

  chipTextActive: { color: "#FFFFFF" },

  revenueCard: {
    backgroundColor: "#064E3B",
    margin: 18,
    borderRadius: 24,
    padding: 20,
  },

  revenueLabel: { color: "#BBF7D0", fontWeight: "900" },

  revenueNumber: {
    color: "#FFFFFF",
    fontSize: 44,
    fontWeight: "900",
    marginTop: 6,
  },

  revenueSub: { color: "#D1FAE5", fontWeight: "700", marginTop: 8 },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingHorizontal: 18,
  },

  statBox: {
    width: "47%",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    ...farmTheme.shadow,
  },

  statNumber: {
    color: farmTheme.colors.primary,
    fontSize: 22,
    fontWeight: "900",
  },

  statLabel: {
    color: farmTheme.colors.mutedText,
    fontWeight: "800",
    marginTop: 5,
  },

  saleCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    marginBottom: 12,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    flexDirection: "row",
    alignItems: "center",
  },

  saleProduct: { color: farmTheme.colors.text, fontSize: 18, fontWeight: "900" },

  saleMeta: {
    color: farmTheme.colors.mutedText,
    fontWeight: "700",
    marginTop: 4,
  },

  saleDate: {
    color: "#6B7280",
    fontWeight: "700",
    fontSize: 12,
    marginTop: 8,
  },

  amountBox: {
    alignItems: "flex-end",
    marginLeft: 12,
  },

  saleRevenue: {
    color: farmTheme.colors.primary,
    fontSize: 20,
    fontWeight: "900",
  },

  grossText: {
    color: farmTheme.colors.mutedText,
    fontWeight: "700",
    fontSize: 12,
    marginTop: 4,
  },

  emptyCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
  },

  emptyTitle: {
    color: farmTheme.colors.text,
    fontSize: 18,
    fontWeight: "900",
  },

  emptyText: {
    color: farmTheme.colors.mutedText,
    fontWeight: "700",
    marginTop: 8,
    lineHeight: 22,
  },

  aiCard: {
    backgroundColor: "#064E3B",
    marginHorizontal: 18,
    marginTop: 8,
    borderRadius: 22,
    padding: 18,
  },

  aiTitle: { color: "#FFFFFF", fontSize: 23, fontWeight: "900", marginBottom: 8 },

  aiText: { color: "#BBF7D0", fontWeight: "700", lineHeight: 22, marginBottom: 12 },

  aiItem: { color: "#D1FAE5", fontWeight: "800", lineHeight: 25 },
});