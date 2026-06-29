// app/farmer/revenue-analytics.tsx

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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

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

const periods: Period[] = ["Today", "This Week", "This Month", "This Year"];

function money(value: any) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function isWithinPeriod(dateValue: string, period: Period) {
  const date = new Date(dateValue);
  const now = new Date();

  if (Number.isNaN(date.getTime())) return false;

  const start = new Date(now);

  if (period === "Today") {
    start.setHours(0, 0, 0, 0);
    return date >= start;
  }

  if (period === "This Week") {
    start.setDate(start.getDate() - start.getDay());
    start.setHours(0, 0, 0, 0);
    return date >= start;
  }

  if (period === "This Month") {
    return date >= new Date(now.getFullYear(), now.getMonth(), 1);
  }

  if (period === "This Year") {
    return date >= new Date(now.getFullYear(), 0, 1);
  }

  return true;
}

export default function RevenueAnalytics() {
  const [period, setPeriod] = useState<Period>("This Month");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [farmerProfile, setFarmerProfile] = useState<FarmerProfile | null>(null);
  const [payouts, setPayouts] = useState<FarmerPayout[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadRevenueAnalytics();
    }, [])
  );

  const filteredPayouts = useMemo(() => {
    return payouts.filter((item) => isWithinPeriod(item.created_at, period));
  }, [payouts, period]);

  const totals = useMemo(() => {
    const gross = filteredPayouts.reduce(
      (sum, item) => sum + Number(item.gross_amount || 0),
      0
    );

    const net = filteredPayouts.reduce(
      (sum, item) => sum + Number(item.net_amount || 0),
      0
    );

    const fees = filteredPayouts.reduce(
      (sum, item) => sum + Number(item.platform_fee || 0),
      0
    );

    const average = filteredPayouts.length ? net / filteredPayouts.length : 0;

    return {
      gross,
      net,
      fees,
      average,
      orders: filteredPayouts.length,
    };
  }, [filteredPayouts]);

  const feeRate = totals.gross > 0 ? (totals.fees / totals.gross) * 100 : 0;

  async function readCurrentFarmerEmail() {
    const saved =
      (await AsyncStorage.getItem("currentFarmer")) ||
      (await AsyncStorage.getItem("farm2homeCurrentFarmer")) ||
      (await AsyncStorage.getItem("farm2homeFarmerSession")) ||
      (await AsyncStorage.getItem("currentUser"));

    if (!saved) return "";

    try {
      const farmer = JSON.parse(saved);
      return String(farmer.email || farmer.farmer_email || "").trim().toLowerCase();
    } catch {
      return "";
    }
  }

  async function loadRevenueAnalytics() {
    try {
      setLoading(true);

      const farmerEmail = await readCurrentFarmerEmail();

      if (!farmerEmail) {
        setFarmerProfile(null);
        setPayouts([]);
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("farmer_profiles")
        .select("*")
        .eq("farmer_email", farmerEmail)
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
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadRevenueAnalytics();
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={farmTheme.colors.primary} />
        <Text style={styles.loadingText}>Loading market revenue...</Text>
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
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.push("/farmer/dashboard" as any)}
        >
          <Ionicons name="arrow-back-outline" size={22} color="#FFFFFF" />
        </TouchableOpacity>

        <Text style={styles.eyebrow}>Farm2Home Farmer Market</Text>
        <Text style={styles.title}>Revenue Analytics</Text>
        <Text style={styles.subtitle}>
          Track market sales, Stripe payouts, platform fees, subscription orders,
          and farmer business growth.
        </Text>

        <View style={styles.profileBadge}>
          <Text style={styles.profileText}>
            {farmerProfile?.farmer_name || "Farmer Profile Not Found"}
          </Text>
          <Text style={styles.profileSubText}>
            {farmerProfile?.stripe_account_id || "Stripe account not connected"}
          </Text>
        </View>
      </View>

      <View style={styles.flowCard}>
        <Text style={styles.flowTitle}>Revenue Flow</Text>
        <FlowStep number="1" text="Customer buys products or subscribes to bundles" />
        <FlowStep number="2" text="Stripe collects payment and records order revenue" />
        <FlowStep number="3" text="Farm2Home platform fee is deducted" />
        <FlowStep number="4" text="Farmer net payout is transferred through Stripe Connect" />
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
        <Text style={styles.revenueLabel}>{period} Net Farmer Earnings</Text>
        <Text style={styles.revenueNumber}>{money(totals.net)}</Text>
        <Text style={styles.revenueSub}>
          Actual farmer payout revenue after platform fees.
        </Text>

        <View style={styles.revenueMiniRow}>
          <MiniMetric label="Paid Orders" value={String(totals.orders)} />
          <MiniMetric label="Avg Payout" value={money(totals.average)} />
        </View>
      </View>

      <View style={styles.statsGrid}>
        <StatBox
          label="Gross Sales"
          value={money(totals.gross)}
          icon="cash-outline"
        />
        <StatBox
          label="Net Payouts"
          value={money(totals.net)}
          icon="wallet-outline"
        />
        <StatBox
          label="Platform Fees"
          value={money(totals.fees)}
          icon="pricetag-outline"
        />
        <StatBox
          label="Fee Rate"
          value={`${feeRate.toFixed(1)}%`}
          icon="analytics-outline"
        />
      </View>

      <View style={styles.actionCard}>
        <Text style={styles.actionTitle}>Use revenue to grow your farm</Text>
        <Text style={styles.actionText}>
          Review which orders paid out, compare fees, and use your best-selling
          products to build higher-value bundles.
        </Text>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push("/farmer/inventory-management" as any)}
          >
            <Ionicons name="basket-outline" size={17} color={farmTheme.colors.primary} />
            <Text style={styles.actionButtonText}>Products</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push("/farmer/farm-bundles" as any)}
          >
            <Ionicons name="cube-outline" size={17} color={farmTheme.colors.primary} />
            <Text style={styles.actionButtonText}>Bundles</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push("/farmer/orders" as any)}
          >
            <Ionicons name="receipt-outline" size={17} color={farmTheme.colors.primary} />
            <Text style={styles.actionButtonText}>Orders</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Payout Breakdown</Text>

      {filteredPayouts.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyEmoji}>💸</Text>
          <Text style={styles.emptyTitle}>No payouts found</Text>
          <Text style={styles.emptyText}>
            No farmer payouts were found for {period.toLowerCase()}. Once
            customer orders or subscriptions are paid, payouts will appear here.
          </Text>
        </View>
      ) : (
        filteredPayouts.map((payout) => (
          <View key={payout.id} style={styles.saleCard}>
            <View style={{ flex: 1 }}>
              <View style={styles.saleHeader}>
                <Text style={styles.saleProduct}>Order #{payout.order_id}</Text>
                <Text style={styles.statusPill}>{payout.payout_status}</Text>
              </View>

              <Text style={styles.saleMeta}>
                Transfer: {payout.stripe_transfer_id || "Pending transfer"}
              </Text>

              <Text style={styles.saleDate}>
                {new Date(payout.created_at).toLocaleString()}
              </Text>

              <View style={styles.payoutRow}>
                <Text style={styles.payoutSmall}>
                  Gross {money(payout.gross_amount)}
                </Text>
                <Text style={styles.payoutSmall}>
                  Fee {money(payout.platform_fee)}
                </Text>
              </View>
            </View>

            <View style={styles.amountBox}>
              <Text style={styles.saleRevenue}>
                {money(payout.net_amount)}
              </Text>
              <Text style={styles.grossText}>Net payout</Text>
            </View>
          </View>
        ))
      )}

      <View style={styles.aiCard}>
        <Text style={styles.aiTitle}>Farm Growth Insights</Text>
        <Text style={styles.aiText}>
          Based on this period, use your revenue data to decide what products to
          restock, which bundles to promote, and whether to adjust pricing.
        </Text>

        <Text style={styles.aiItem}>
          • {totals.orders} paid payout record(s) found for {period}.
        </Text>
        <Text style={styles.aiItem}>
          • Net farmer earnings: {money(totals.net)}.
        </Text>
        <Text style={styles.aiItem}>
          • Average payout per paid order: {money(totals.average)}.
        </Text>
        <Text style={styles.aiItem}>
          • Platform fees for this period: {money(totals.fees)}.
        </Text>
      </View>

      <View style={{ height: 90 }} />
    </ScrollView>
  );
}

function FlowStep({ number, text }: { number: string; text: string }) {
  return (
    <View style={styles.flowStep}>
      <Text style={styles.flowNumber}>{number}</Text>
      <Text style={styles.flowText}>{text}</Text>
    </View>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.miniMetric}>
      <Text style={styles.miniValue}>{value}</Text>
      <Text style={styles.miniLabel}>{label}</Text>
    </View>
  );
}

function StatBox({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.statBox}>
      <View style={styles.statIcon}>
        <Ionicons name={icon} size={18} color={farmTheme.colors.primary} />
      </View>
      <Text style={styles.statNumber}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
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
    paddingTop: 58,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },

  eyebrow: {
    color: "#D1FAE5",
    fontWeight: "900",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  title: {
    color: "#FFFFFF",
    fontSize: 35,
    fontWeight: "900",
    marginBottom: 10,
  },

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

  flowCard: {
    backgroundColor: "#FFFFFF",
    margin: 18,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    ...farmTheme.shadow,
  },

  flowTitle: {
    color: farmTheme.colors.text,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 12,
  },

  flowStep: {
    flexDirection: "row",
    gap: 12,
    marginTop: 10,
    alignItems: "center",
  },

  flowNumber: {
    width: 32,
    height: 32,
    borderRadius: 13,
    backgroundColor: "#E9F8EF",
    color: farmTheme.colors.primary,
    fontWeight: "900",
    textAlign: "center",
    textAlignVertical: "center",
    overflow: "hidden",
  },

  flowText: {
    flex: 1,
    color: farmTheme.colors.text,
    fontWeight: "800",
    lineHeight: 20,
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

  revenueMiniRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },

  miniMetric: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: 16,
    padding: 12,
  },

  miniValue: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 18,
  },

  miniLabel: {
    color: "#BBF7D0",
    fontWeight: "800",
    marginTop: 4,
    fontSize: 12,
  },

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

  statIcon: {
    width: 38,
    height: 38,
    borderRadius: 15,
    backgroundColor: "#E9F8EF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
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

  actionCard: {
    backgroundColor: "#FFFFFF",
    margin: 18,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    ...farmTheme.shadow,
  },

  actionTitle: {
    color: farmTheme.colors.text,
    fontWeight: "900",
    fontSize: 20,
  },

  actionText: {
    color: farmTheme.colors.mutedText,
    fontWeight: "700",
    lineHeight: 22,
    marginTop: 8,
  },

  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },

  actionButton: {
    backgroundColor: "#E9F8EF",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },

  actionButtonText: {
    color: farmTheme.colors.primary,
    fontWeight: "900",
  },

  saleCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    marginBottom: 12,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    flexDirection: "row",
    alignItems: "center",
    ...farmTheme.shadow,
  },

  saleHeader: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
  },

  saleProduct: { color: farmTheme.colors.text, fontSize: 18, fontWeight: "900" },

  statusPill: {
    backgroundColor: "#E9F8EF",
    color: farmTheme.colors.primary,
    fontWeight: "900",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: "hidden",
    fontSize: 11,
  },

  saleMeta: {
    color: farmTheme.colors.mutedText,
    fontWeight: "700",
    marginTop: 6,
  },

  saleDate: {
    color: "#6B7280",
    fontWeight: "700",
    fontSize: 12,
    marginTop: 8,
  },

  payoutRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
    flexWrap: "wrap",
  },

  payoutSmall: {
    backgroundColor: "#F9FAFB",
    color: farmTheme.colors.mutedText,
    fontWeight: "800",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: "hidden",
    fontSize: 11,
  },

  amountBox: {
    alignItems: "flex-end",
    marginLeft: 12,
  },

  saleRevenue: {
    color: farmTheme.colors.primary,
    fontSize: 21,
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
    borderRadius: 22,
    padding: 22,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    alignItems: "center",
    ...farmTheme.shadow,
  },

  emptyEmoji: { fontSize: 42 },

  emptyTitle: {
    color: farmTheme.colors.text,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 8,
  },

  emptyText: {
    color: farmTheme.colors.mutedText,
    fontWeight: "700",
    marginTop: 8,
    lineHeight: 22,
    textAlign: "center",
  },

  aiCard: {
    backgroundColor: "#064E3B",
    marginHorizontal: 18,
    marginTop: 8,
    borderRadius: 22,
    padding: 18,
  },

  aiTitle: {
    color: "#FFFFFF",
    fontSize: 23,
    fontWeight: "900",
    marginBottom: 8,
  },

  aiText: {
    color: "#BBF7D0",
    fontWeight: "700",
    lineHeight: 22,
    marginBottom: 12,
  },

  aiItem: { color: "#D1FAE5", fontWeight: "800", lineHeight: 25 },
});