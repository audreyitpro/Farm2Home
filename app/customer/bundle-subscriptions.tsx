// app/customer/bundle-subscriptions.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../data/supabaseClient";

const COLORS = {
  bg: "#F6F8F2",
  card: "#FFFFFF",
  text: "#162115",
  muted: "#667085",
  border: "#E3E8DD",
  green: "#1FA463",
  greenDark: "#0B5D35",
  greenSoft: "#E9F8EF",
  orangeSoft: "#FFF3DE",
  blueSoft: "#DBEAFE",
  red: "#DC2626",
  redSoft: "#FEE2E2",
  white: "#FFFFFF",
};

type Customer = {
  id?: string;
  customer_id?: string;
  customerId?: string;
  email?: string;
  customer_email?: string;
  name?: string;
  full_name?: string;
};

type BundleSubscription = {
  id: string;
  customer_id?: string;
  customer_email?: string;
  farmer_id?: string;
  bundle_id?: string;
  bundle_name?: string;
  bundle_type?: string;
  fulfillment_method?: string;
  frequency?: string;
  price?: number;
  status?: string;
  next_delivery_date?: string;
  created_at?: string;
  updated_at?: string;
};

function clean(value: any) {
  return String(value ?? "").trim();
}

function normalize(value: any) {
  return clean(value).toLowerCase();
}

function money(value: any) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function getCustomerId(customer?: Customer | null) {
  return clean(customer?.customer_id || customer?.customerId || customer?.id);
}

function getCustomerEmail(customer?: Customer | null) {
  return normalize(customer?.customer_email || customer?.email);
}

function formatDate(value?: string) {
  if (!value) return "Not scheduled";

  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return value;
  }
}

export default function CustomerBundleSubscriptionsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [subscriptions, setSubscriptions] = useState<BundleSubscription[]>([]);

  useFocusEffect(
    useCallback(() => {
      initialize();
    }, [])
  );

  const stats = useMemo(() => {
    const active = subscriptions.filter(
      (item) => normalize(item.status || "active") === "active"
    ).length;

    const monthlySpend = subscriptions
      .filter((item) => normalize(item.status || "active") === "active")
      .reduce((sum, item) => {
        const price = Number(item.price || 0);
        return sum + (normalize(item.frequency) === "bi-monthly" ? price / 2 : price);
      }, 0);

    return {
      total: subscriptions.length,
      active,
      monthlySpend,
    };
  }, [subscriptions]);

  async function readCustomer() {
    const raw =
      (await AsyncStorage.getItem("currentCustomer")) ||
      (await AsyncStorage.getItem("farm2homeCurrentCustomer")) ||
      (await AsyncStorage.getItem("currentUser"));

    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async function initialize() {
    try {
      setLoading(true);

      const savedCustomer = await readCustomer();

      if (!getCustomerId(savedCustomer) && !getCustomerEmail(savedCustomer)) {
        Alert.alert("Customer Login Required", "Please login as a customer.");
        router.replace("/customer/login" as any);
        return;
      }

      setCustomer(savedCustomer);
      await loadSubscriptions(savedCustomer);
    } finally {
      setLoading(false);
    }
  }

  async function loadSubscriptions(activeCustomer: Customer | null = customer) {
    try {
      setRefreshing(true);

      const customerId = getCustomerId(activeCustomer);
      const customerEmail = getCustomerEmail(activeCustomer);

      let rows: BundleSubscription[] = [];

      if (customerId) {
        const { data, error } = await supabase
          .from("customer_bundle_subscriptions")
          .select("*")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false });

        if (!error && Array.isArray(data)) rows = data;
      }

      if (!rows.length && customerEmail) {
        const { data, error } = await supabase
          .from("customer_bundle_subscriptions")
          .select("*")
          .eq("customer_email", customerEmail)
          .order("created_at", { ascending: false });

        if (!error && Array.isArray(data)) rows = data;
      }

      setSubscriptions(rows);
    } catch (error: any) {
      Alert.alert(
        "Subscriptions Error",
        error?.message || "Unable to load bundle subscriptions."
      );
    } finally {
      setRefreshing(false);
    }
  }

  async function cancelSubscription(item: BundleSubscription) {
    Alert.alert(
      "Cancel Bundle",
      `Cancel ${item.bundle_name || "this bundle subscription"}?`,
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Cancel Bundle",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase
              .from("customer_bundle_subscriptions")
              .update({
                status: "cancelled",
                updated_at: new Date().toISOString(),
              })
              .eq("id", item.id);

            if (error) {
              Alert.alert("Cancel Error", error.message);
              return;
            }

            setSubscriptions((prev) =>
              prev.map((sub) =>
                sub.id === item.id
                  ? {
                      ...sub,
                      status: "cancelled",
                      updated_at: new Date().toISOString(),
                    }
                  : sub
              )
            );

            Alert.alert("Bundle Cancelled", "This bundle subscription was cancelled.");
          },
        },
      ]
    );
  }

  function getStatusStyle(status?: string) {
    const value = normalize(status || "active");

    if (value === "active") return styles.statusActive;
    if (["cancelled", "canceled"].includes(value)) return styles.statusCancelled;
    return styles.statusPending;
  }

  function renderSubscription({ item }: { item: BundleSubscription }) {
    const active = normalize(item.status || "active") === "active";

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.bundleName}>{item.bundle_name || "Farm Bundle"}</Text>
            <Text style={styles.bundleType}>{item.bundle_type || "Bundle"}</Text>
          </View>

          <Text style={styles.price}>{money(item.price)}</Text>
        </View>

        <View style={styles.statusRow}>
          <View style={[styles.statusPill, getStatusStyle(item.status)]}>
            <Text style={styles.statusText}>{item.status || "active"}</Text>
          </View>
        </View>

        <View style={styles.detailGrid}>
          <Detail
            icon="repeat-outline"
            label="Frequency"
            value={item.frequency || "monthly"}
          />
          <Detail
            icon="cube-outline"
            label="Fulfillment"
            value={item.fulfillment_method || "delivery"}
          />
          <Detail
            icon="calendar-outline"
            label="Next Date"
            value={formatDate(item.next_delivery_date)}
          />
          <Detail icon="cash-outline" label="Price" value={money(item.price)} />
        </View>

        {active ? (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => cancelSubscription(item)}
          >
            <Text style={styles.cancelText}>Cancel Subscription</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.marketButton}
            onPress={() => router.push("/customer/farm-bundles" as any)}
          >
            <Text style={styles.marketText}>Choose Another Bundle</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.green} size="large" />
        <Text style={styles.loadingText}>Loading bundle subscriptions...</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={subscriptions}
      keyExtractor={(item) => item.id}
      renderItem={renderSubscription}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => loadSubscriptions()} />
      }
      contentContainerStyle={styles.content}
      ListHeaderComponent={
        <>
          <View style={styles.topRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.push("/customer/dashboard" as any)}
            >
              <Ionicons name="arrow-back-outline" size={22} color={COLORS.text} />
            </TouchableOpacity>

            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>Farm2Home Bundles</Text>
              <Text style={styles.title}>My Bundle Subscriptions</Text>
              <Text style={styles.subtitle}>
                Manage monthly and bi-monthly meat or seafood bundles.
              </Text>
            </View>
          </View>

          <View style={styles.hero}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroBadge}>Recurring Farm Boxes</Text>
              <Text style={styles.heroTitle}>Track your bundle deliveries.</Text>
              <Text style={styles.heroText}>
                View fulfillment, frequency, next delivery date, and active status.
              </Text>
            </View>
            <Text style={styles.heroEmoji}>📦</Text>
          </View>

          <View style={styles.statsRow}>
            <Stat label="Total" value={String(stats.total)} />
            <Stat label="Active" value={String(stats.active)} />
            <Stat label="Monthly Avg" value={money(stats.monthlySpend)} />
          </View>

          <TouchableOpacity
            style={styles.shopButton}
            onPress={() => router.push("/customer/farm-bundles" as any)}
          >
            <Ionicons name="basket-outline" size={18} color={COLORS.white} />
            <Text style={styles.shopButtonText}>Shop Farm Bundles</Text>
          </TouchableOpacity>

          {!subscriptions.length ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyEmoji}>🧺</Text>
              <Text style={styles.emptyTitle}>No bundle subscriptions yet</Text>
              <Text style={styles.emptyText}>
                Shop meat and seafood bundles from local farmers.
              </Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => router.push("/customer/farm-bundles" as any)}
              >
                <Text style={styles.emptyButtonText}>Browse Bundles</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </>
      }
    />
  );
}

function Detail({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailCard}>
      <Ionicons name={icon} size={18} color={COLORS.greenDark} />
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.bg },
  loadingText: { marginTop: 10, color: COLORS.muted, fontWeight: "800" },
  content: { padding: 16, paddingBottom: 110, backgroundColor: COLORS.bg },
  topRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: { color: COLORS.green, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.8, fontSize: 12 },
  title: { color: COLORS.text, fontSize: 27, fontWeight: "900", marginTop: 2 },
  subtitle: { color: COLORS.muted, fontWeight: "700", lineHeight: 20, marginTop: 4 },
  hero: {
    backgroundColor: COLORS.green,
    borderRadius: 28,
    padding: 20,
    marginBottom: 14,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  heroBadge: { color: "#D9F99D", fontWeight: "900", textTransform: "uppercase", fontSize: 11 },
  heroTitle: { color: COLORS.white, fontSize: 25, fontWeight: "900", marginTop: 6 },
  heroText: { color: COLORS.white, opacity: 0.9, fontWeight: "700", lineHeight: 20, marginTop: 8 },
  heroEmoji: { fontSize: 46 },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statValue: { color: COLORS.greenDark, fontWeight: "900", fontSize: 22 },
  statLabel: { color: COLORS.muted, fontWeight: "800", marginTop: 3 },
  shopButton: {
    backgroundColor: COLORS.green,
    borderRadius: 18,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  shopButtonText: { color: COLORS.white, fontWeight: "900", fontSize: 15 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  bundleName: { color: COLORS.text, fontWeight: "900", fontSize: 19 },
  bundleType: { color: COLORS.muted, fontWeight: "800", marginTop: 3 },
  price: { color: COLORS.greenDark, fontWeight: "900", fontSize: 19 },
  statusRow: { flexDirection: "row", marginTop: 12 },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  statusActive: { backgroundColor: COLORS.greenSoft },
  statusCancelled: { backgroundColor: COLORS.redSoft },
  statusPending: { backgroundColor: COLORS.orangeSoft },
  statusText: {
    color: COLORS.text,
    fontWeight: "900",
    textTransform: "capitalize",
  },
  detailGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 12,
  },
  detailCard: {
    flex: 1,
    minWidth: 140,
    backgroundColor: COLORS.greenSoft,
    borderRadius: 16,
    padding: 12,
  },
  detailLabel: {
    color: COLORS.muted,
    fontWeight: "900",
    fontSize: 12,
    marginTop: 5,
  },
  detailValue: {
    color: COLORS.text,
    fontWeight: "900",
    marginTop: 3,
    textTransform: "capitalize",
  },
  cancelButton: {
    backgroundColor: COLORS.red,
    borderRadius: 16,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 14,
  },
  cancelText: { color: COLORS.white, fontWeight: "900" },
  marketButton: {
    backgroundColor: COLORS.greenSoft,
    borderRadius: 16,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 14,
  },
  marketText: { color: COLORS.greenDark, fontWeight: "900" },
  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    marginBottom: 12,
  },
  emptyEmoji: { fontSize: 42 },
  emptyTitle: { color: COLORS.text, fontWeight: "900", fontSize: 18, marginTop: 8 },
  emptyText: { color: COLORS.muted, fontWeight: "700", textAlign: "center", marginTop: 6 },
  emptyButton: {
    backgroundColor: COLORS.green,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 11,
    marginTop: 14,
  },
  emptyButtonText: { color: COLORS.white, fontWeight: "900" },
});