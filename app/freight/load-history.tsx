// app/freight/load-history.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../data/supabaseClient";
import freightTheme from "../styles/freightTheme";

type LoadStatus =
  | "all"
  | "available"
  | "accepted"
  | "arrived_pickup"
  | "picked_up"
  | "in_transit"
  | "arrived_dropoff"
  | "delivered"
  | "cancelled";

type FreightLoad = any;

const FILTERS: { label: string; value: LoadStatus }[] = [
  { label: "All", value: "all" },
  { label: "Active", value: "in_transit" },
  { label: "Accepted", value: "accepted" },
  { label: "Delivered", value: "delivered" },
  { label: "Cancelled", value: "cancelled" },
];

const ACTIVE_STATUSES = [
  "accepted",
  "arrived_pickup",
  "picked_up",
  "in_transit",
  "arrived_dropoff",
];

export default function FreightLoadHistoryScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [carrier, setCarrier] = useState<any>(null);
  const [loads, setLoads] = useState<FreightLoad[]>([]);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<LoadStatus>("all");

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [])
  );

  const filteredLoads = useMemo(() => {
    const q = searchText.trim().toLowerCase();

    return loads.filter((item) => {
      const status = normalizeStatus(item);

      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "in_transit"
          ? ACTIVE_STATUSES.includes(status)
          : status === statusFilter;

      const searchable = [
        item.title,
        item.farmer_name,
        item.farmerName,
        item.pickup_location,
        item.pickupLocation,
        item.dropoff_location,
        item.dropoffLocation,
        item.commodity,
        item.equipment_type,
        item.equipmentType,
        item.status,
        item.accepted_by,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !q || searchable.includes(q);

      return matchesStatus && matchesSearch;
    });
  }, [loads, searchText, statusFilter]);

  const stats = useMemo(() => {
    const completed = loads.filter((item) => normalizeStatus(item) === "delivered");
    const active = loads.filter((item) => ACTIVE_STATUSES.includes(normalizeStatus(item)));
    const cancelled = loads.filter((item) => normalizeStatus(item) === "cancelled");

    const revenue = completed.reduce((sum, item) => sum + getRate(item), 0);
    const miles = completed.reduce((sum, item) => sum + getMiles(item), 0);

    return {
      total: loads.length,
      active: active.length,
      completed: completed.length,
      cancelled: cancelled.length,
      revenue,
      miles,
    };
  }, [loads]);

  async function getCurrentCarrier() {
    const raw =
      (await AsyncStorage.getItem("currentFreightCarrier")) ||
      (await AsyncStorage.getItem("currentFreight")) ||
      (await AsyncStorage.getItem("currentFreightUser")) ||
      (await AsyncStorage.getItem("currentUser"));

    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw);

      return {
        ...parsed,
        id: parsed.id || parsed.freightId || parsed.email,
        freightId: parsed.freightId || parsed.id || parsed.email,
        role: "freight",
      };
    } catch {
      return null;
    }
  }

  async function loadHistory() {
    try {
      setLoading(true);

      const currentCarrier = await getCurrentCarrier();

      if (!currentCarrier) {
        router.replace("/freight/login" as any);
        return;
      }

      setCarrier(currentCarrier);

      const carrierId =
        currentCarrier.id || currentCarrier.freightId || currentCarrier.email || "";

      const { data, error } = await supabase
        .from("freight_loads")
        .select("*")
        .or(`carrier_id.eq.${carrierId},driver_id.eq.${carrierId},posted_by_id.eq.${carrierId}`)
        .order("created_at", { ascending: false });

      if (error) {
        Alert.alert("History Error", error.message);
        setLoads([]);
        return;
      }

      setLoads(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.log("Freight load history error:", error);
      Alert.alert("History Error", error?.message || "Unable to load freight history.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function onRefresh() {
    setRefreshing(true);
    loadHistory();
  }

  function normalizeStatus(item: FreightLoad) {
    return String(item.status || "available")
      .toLowerCase()
      .replace(/\s+/g, "_");
  }

  function getRate(item: FreightLoad) {
    return Number(item.rate || item.payoutAmount || item.payout_amount || item.total || 0);
  }

  function getMiles(item: FreightLoad) {
    return Number(item.distance_miles || item.miles || item.estimated_miles || 0);
  }

  function ratePerMile(item: FreightLoad) {
    const miles = getMiles(item);
    return miles > 0 ? getRate(item) / miles : 0;
  }

  function formatMoney(value: number) {
    return `$${Number(value || 0).toFixed(2)}`;
  }

  function formatDate(value?: string | null) {
    if (!value) return "Pending";

    try {
      return new Date(value).toLocaleDateString();
    } catch {
      return "Pending";
    }
  }

  function formatStatus(value?: string) {
    return String(value || "available")
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function statusColor(status: string) {
    switch (status) {
      case "available":
        return "#2563EB";
      case "accepted":
        return freightTheme.colors.primary;
      case "arrived_pickup":
        return "#0EA5E9";
      case "picked_up":
        return "#F59E0B";
      case "in_transit":
        return "#7C3AED";
      case "arrived_dropoff":
        return "#0F766E";
      case "delivered":
        return "#10B981";
      case "cancelled":
        return "#DC2626";
      default:
        return "#64748B";
    }
  }

  function statusIcon(status: string): keyof typeof Ionicons.glyphMap {
    switch (status) {
      case "available":
        return "cube-outline";
      case "accepted":
        return "checkmark-circle-outline";
      case "arrived_pickup":
        return "location-outline";
      case "picked_up":
        return "archive-outline";
      case "in_transit":
        return "navigate-outline";
      case "arrived_dropoff":
        return "flag-outline";
      case "delivered":
        return "checkmark-done-outline";
      case "cancelled":
        return "close-circle-outline";
      default:
        return "ellipse-outline";
    }
  }

  function carrierName() {
    return (
      carrier?.companyName ||
      carrier?.businessName ||
      carrier?.contactName ||
      carrier?.username ||
      "Freight Connect Carrier"
    );
  }

  function openLoadDetails(item: FreightLoad) {
    router.push({
      pathname: "/freight/load-details",
      params: { loadId: item.id },
    } as any);
  }

  function renderLoad({ item }: { item: FreightLoad }) {
    const status = normalizeStatus(item);

    return (
      <TouchableOpacity style={styles.loadCard} onPress={() => openLoadDetails(item)}>
        <View style={styles.loadHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.loadTitle}>{item.title || "Farm2Home Freight Load"}</Text>
            <Text style={styles.loadDate}>
              Created: {formatDate(item.created_at || item.createdAt)}
            </Text>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: statusColor(status) }]}>
            <Ionicons name={statusIcon(status)} size={14} color="#FFFFFF" />
            <Text style={styles.statusText}>{formatStatus(status)}</Text>
          </View>
        </View>

        <View style={styles.routeBox}>
          <View style={styles.routeStop}>
            <Ionicons name="radio-button-on" size={18} color="#10B981" />
            <Text style={styles.routeText}>
              {item.pickup_location || item.pickupLocation || "Pickup location"}
            </Text>
          </View>

          <View style={styles.routeLine} />

          <View style={styles.routeStop}>
            <Ionicons name="location" size={18} color="#10B981" />
            <Text style={styles.routeText}>
              {item.dropoff_location || item.dropoffLocation || "Dropoff location"}
            </Text>
          </View>
        </View>

        <View style={styles.metaGrid}>
          <MetaBox label="Rate" value={formatMoney(getRate(item))} />
          <MetaBox label="Miles" value={`${getMiles(item).toFixed(0)} mi`} />
          <MetaBox label="Rate / Mile" value={`$${ratePerMile(item).toFixed(2)}`} />
          <MetaBox
            label="Settlement"
            value={item.payout_status || item.settlement_status || "Pending"}
          />
        </View>

        <Text style={styles.detailText}>
          Commodity: {item.commodity || "Not listed"} · Equipment:{" "}
          {item.equipment_type || item.equipmentType || "Not listed"}
        </Text>

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>
            Farmer: {item.farmer_name || item.farmerName || "Farm2Home Partner"}
          </Text>

          <Text style={styles.openText}>Open Details</Text>
        </View>
      </TouchableOpacity>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor="#020617" />
        <View style={styles.loadingScreen}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.loadingText}>Loading load history...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#020617" />

      <View style={styles.container}>
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.kicker}>Farm2Home Freight Connect</Text>
              <Text style={styles.title}>Load History</Text>
              <Text style={styles.subtitle}>
                Review completed, active, cancelled, and posted freight loads.
              </Text>
            </View>

            <View style={styles.heroIcon}>
              <Ionicons name="time-outline" size={34} color="#FFFFFF" />
            </View>
          </View>
        </View>

        <View style={styles.navRow}>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => router.push("/freight/dashboard" as any)}
          >
            <Ionicons name="grid-outline" size={18} color="#FFFFFF" />
            <Text style={styles.navText}>Dashboard</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navButtonOutline}
            onPress={() => router.push("/freight/earnings" as any)}
          >
            <Ionicons
              name="cash-outline"
              size={18}
              color={freightTheme.colors.primary}
            />
            <Text style={styles.navTextOutline}>Earnings</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View style={styles.carrierCard}>
            <Text style={styles.carrierName}>🚛 {carrierName()}</Text>
            <Text style={styles.carrierMeta}>
              Use this screen to review route history, payout records, and load
              settlement status.
            </Text>
          </View>

          <View style={styles.statsGrid}>
            <StatCard icon="cube-outline" label="Total Loads" value={String(stats.total)} accent />
            <StatCard icon="navigate-outline" label="Active" value={String(stats.active)} />
            <StatCard icon="checkmark-done-outline" label="Completed" value={String(stats.completed)} accent />
            <StatCard icon="close-circle-outline" label="Cancelled" value={String(stats.cancelled)} />
            <StatCard icon="cash-outline" label="Revenue" value={formatMoney(stats.revenue)} accent />
            <StatCard icon="speedometer-outline" label="Miles" value={stats.miles.toFixed(0)} />
          </View>

          <View style={styles.searchCard}>
            <Ionicons name="search-outline" size={20} color="#10B981" />
            <TextInput
              style={styles.searchInput}
              value={searchText}
              onChangeText={setSearchText}
              placeholder="Search route, farmer, commodity, equipment..."
              placeholderTextColor="#94A3B8"
            />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {FILTERS.map((filter) => {
              const active = statusFilter === filter.value;

              return (
                <TouchableOpacity
                  key={filter.value}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  onPress={() => setStatusFilter(filter.value)}
                >
                  <Text
                    style={[
                      styles.filterText,
                      active && styles.filterTextActive,
                    ]}
                  >
                    {filter.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={styles.sectionTitle}>Freight Loads</Text>

          <FlatList
            data={filteredLoads}
            keyExtractor={(item, index) => String(item.id || index)}
            renderItem={renderLoad}
            scrollEnabled={false}
            contentContainerStyle={{ paddingBottom: 110 }}
            ListEmptyComponent={
              <View style={styles.emptyCard}>
                <Ionicons name="file-tray-outline" size={38} color="#10B981" />
                <Text style={styles.emptyTitle}>No loads found.</Text>
                <Text style={styles.emptyText}>
                  Adjust your filters or refresh to check load history again.
                </Text>
              </View>
            }
          />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function MetaBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaBox}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
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

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: freightTheme.colors.background,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: freightTheme.colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: freightTheme.colors.mutedText,
    marginTop: 10,
    fontWeight: "800",
  },
  container: {
    flex: 1,
    backgroundColor: freightTheme.colors.background,
  },
  hero: {
    backgroundColor: "#020617",
    paddingTop: 22,
    paddingHorizontal: 20,
    paddingBottom: 26,
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
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#10B981",
  },
  kicker: {
    color: "#10B981",
    fontWeight: "900",
    fontSize: 12,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
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
    fontWeight: "700",
  },
  navRow: {
    flexDirection: "row",
    gap: 10,
    padding: 18,
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
  carrierCard: {
    backgroundColor: freightTheme.colors.card,
    marginHorizontal: 18,
    marginBottom: 14,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
  },
  carrierName: {
    color: freightTheme.colors.text,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 6,
  },
  carrierMeta: {
    color: freightTheme.colors.mutedText,
    fontWeight: "700",
    lineHeight: 22,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  statCard: {
    width: "48%",
    backgroundColor: freightTheme.colors.card,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
    borderRadius: 18,
    padding: 14,
  },
  statCardAccent: {
    backgroundColor: "#064E3B",
    borderColor: "#064E3B",
  },
  statValue: {
    color: freightTheme.colors.primary,
    fontSize: 22,
    fontWeight: "900",
    marginTop: 8,
  },
  statValueAccent: {
    color: "#FFFFFF",
  },
  statLabel: {
    color: freightTheme.colors.mutedText,
    fontWeight: "800",
    marginTop: 4,
  },
  statLabelAccent: {
    color: "#BBF7D0",
  },
  searchCard: {
    backgroundColor: freightTheme.colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginHorizontal: 18,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: freightTheme.colors.text,
    fontWeight: "700",
    paddingVertical: 12,
  },
  filterRow: {
    paddingHorizontal: 18,
    gap: 8,
    paddingBottom: 16,
  },
  filterChip: {
    backgroundColor: freightTheme.colors.card,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  filterChipActive: {
    backgroundColor: freightTheme.colors.primary,
    borderColor: freightTheme.colors.primary,
  },
  filterText: {
    color: freightTheme.colors.primary,
    fontWeight: "900",
  },
  filterTextActive: {
    color: "#FFFFFF",
  },
  sectionTitle: {
    color: freightTheme.colors.text,
    fontSize: 24,
    fontWeight: "900",
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  loadCard: {
    backgroundColor: freightTheme.colors.card,
    marginHorizontal: 18,
    marginBottom: 16,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
  },
  loadHeader: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    marginBottom: 12,
  },
  loadTitle: {
    color: freightTheme.colors.text,
    fontSize: 20,
    fontWeight: "900",
  },
  loadDate: {
    color: freightTheme.colors.mutedText,
    fontWeight: "700",
    marginTop: 4,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    maxWidth: 150,
  },
  statusText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 11,
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
    gap: 10,
  },
  routeLine: {
    width: 2,
    height: 22,
    backgroundColor: freightTheme.colors.border,
    marginLeft: 8,
    marginVertical: 8,
  },
  routeText: {
    color: freightTheme.colors.text,
    fontWeight: "900",
    fontSize: 15,
    flex: 1,
    lineHeight: 21,
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  metaBox: {
    width: "48%",
    backgroundColor: freightTheme.colors.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
  },
  metaLabel: {
    color: freightTheme.colors.mutedText,
    fontWeight: "900",
    fontSize: 11,
    textTransform: "uppercase",
  },
  metaValue: {
    color: freightTheme.colors.primary,
    fontSize: 16,
    fontWeight: "900",
    marginTop: 4,
  },
  detailText: {
    color: freightTheme.colors.mutedText,
    fontWeight: "700",
    lineHeight: 21,
  },
  footerRow: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: freightTheme.colors.border,
    paddingTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  footerText: {
    color: freightTheme.colors.mutedText,
    fontWeight: "700",
    flex: 1,
  },
  openText: {
    color: freightTheme.colors.primary,
    fontWeight: "900",
  },
  emptyCard: {
    backgroundColor: freightTheme.colors.card,
    marginHorizontal: 18,
    marginBottom: 16,
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
    alignItems: "center",
  },
  emptyTitle: {
    color: freightTheme.colors.text,
    fontSize: 20,
    fontWeight: "900",
    marginTop: 10,
    marginBottom: 6,
  },
  emptyText: {
    color: freightTheme.colors.mutedText,
    lineHeight: 22,
    fontWeight: "700",
    textAlign: "center",
  },
});