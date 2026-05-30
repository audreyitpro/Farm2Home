// app/driver/delivery-history.tsx

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

type DeliveryRecord = any;

type HistoryStats = {
  completedDeliveries: number;
  totalEarnings: number;
  totalMiles: number;
  averagePayout: number;
};

const ACTIVE_STATUSES = [
  "accepted",
  "booked",
  "arrived_pickup",
  "picked_up",
  "in_transit",
  "arrived_dropoff",
];

export default function DriverDeliveryHistoryScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [driver, setDriver] = useState<any>(null);
  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>([]);
  const [searchText, setSearchText] = useState("");

  const [stats, setStats] = useState<HistoryStats>({
    completedDeliveries: 0,
    totalEarnings: 0,
    totalMiles: 0,
    averagePayout: 0,
  });

  useFocusEffect(
    useCallback(() => {
      loadDeliveryHistory();
    }, [])
  );

  const filteredDeliveries = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    if (!query) return deliveries;

    return deliveries.filter((item) => {
      const searchable = [
        item.title,
        item.commodity,
        item.customerName,
        item.customer_name,
        item.farmer_name,
        item.pickup_location,
        item.pickup_city,
        item.pickupCity,
        item.dropoff_location,
        item.delivery_city,
        item.deliveryCity,
        item.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [deliveries, searchText]);

  async function getCurrentDriver() {
    const raw =
      (await AsyncStorage.getItem("currentDriver")) ||
      (await AsyncStorage.getItem("currentUser"));

    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw);

      if (parsed?.role && parsed.role !== "driver") return null;

      const stableId =
        parsed.id ||
        parsed.driverId ||
        parsed.email ||
        parsed.username ||
        `driver_${Date.now()}`;

      const normalized = {
        ...parsed,
        id: stableId,
        driverId: parsed.driverId || stableId,
        role: "driver",
        accountActive: parsed.accountActive !== false,
        membershipStatus: parsed.membershipStatus || "Active",
        subscriptionStatus: parsed.subscriptionStatus || "active",
      };

      await AsyncStorage.setItem("currentDriver", JSON.stringify(normalized));
      await AsyncStorage.setItem("currentUser", JSON.stringify(normalized));
      await AsyncStorage.setItem("userRole", "driver");
      await AsyncStorage.setItem("currentUserRole", "driver");

      return normalized;
    } catch {
      return null;
    }
  }

  async function loadDeliveryHistory() {
    try {
      setLoading(true);

      const currentDriver = await getCurrentDriver();

      if (!currentDriver) {
        router.replace("/driver/login" as any);
        return;
      }

      setDriver(currentDriver);

      const driverId =
        currentDriver.id || currentDriver.driverId || currentDriver.email || "";

      let cloudLoads: DeliveryRecord[] = [];

      try {
        const { data, error } = await supabase
          .from("freight_loads")
          .select("*")
          .or(`driver_id.eq.${driverId},carrier_id.eq.${driverId}`)
          .order("created_at", { ascending: false });

        if (error) {
          console.log("DRIVER_HISTORY_FREIGHT_ERROR:", error.message);
        } else {
          cloudLoads = Array.isArray(data) ? data : [];
        }
      } catch (error) {
        console.log("Freight history skipped:", error);
      }

      let orderLoads: DeliveryRecord[] = [];

      try {
        const { data, error } = await supabase
          .from("orders")
          .select("*")
          .or(`driver_id.eq.${driverId},assignedDriverId.eq.${driverId}`)
          .order("created_at", { ascending: false });

        if (error) {
          console.log("DRIVER_HISTORY_ORDERS_ERROR:", error.message);
        } else {
          orderLoads = Array.isArray(data) ? data : [];
        }
      } catch (error) {
        console.log("Order history skipped:", error);
      }

      const merged = [...cloudLoads, ...orderLoads].filter(
        (item, index, list) =>
          index === list.findIndex((other) => String(other.id) === String(item.id))
      );

      const completed = merged.filter(
        (item) => normalizeStatus(item) === "delivered"
      );

      setDeliveries(completed);
      calculateStats(completed);
    } catch (error) {
      console.log("LOAD_DELIVERY_HISTORY_CRASH:", error);
      Alert.alert("History Error", "Unable to load delivery history.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function calculateStats(items: DeliveryRecord[]) {
    const totalEarnings = items.reduce((sum, item) => sum + getPayout(item), 0);
    const totalMiles = items.reduce((sum, item) => sum + getMiles(item), 0);

    setStats({
      completedDeliveries: items.length,
      totalEarnings,
      totalMiles,
      averagePayout: items.length > 0 ? totalEarnings / items.length : 0,
    });
  }

  function onRefresh() {
    setRefreshing(true);
    loadDeliveryHistory();
  }

  function normalizeStatus(item: DeliveryRecord) {
    return String(item.status || item.fulfillmentStatus || "")
      .toLowerCase()
      .replace(/\s+/g, "_");
  }

  function formatStatus(status?: string | null) {
    return String(status || "delivered")
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function formatMoney(value: number) {
    return `$${Number(value || 0).toFixed(2)}`;
  }

  function formatDate(value?: string | null) {
    if (!value) return "Date pending";

    try {
      return new Date(value).toLocaleDateString();
    } catch {
      return "Date pending";
    }
  }

  function getPayout(item: DeliveryRecord) {
    return Number(
      item.rate ||
        item.deliveryFee ||
        item.delivery_fee ||
        item.tip ||
        item.total ||
        0
    );
  }

  function getMiles(item: DeliveryRecord) {
    return Number(
      item.distance_miles ||
        item.estimatedMiles ||
        item.estimated_miles ||
        item.miles ||
        0
    );
  }

  function pickupLocation(item: DeliveryRecord) {
    return (
      item.pickup_location ||
      item.pickup_city ||
      item.pickupCity ||
      item.deliveryInfo?.pickupCity ||
      item.deliveryInfo?.farmCity ||
      item.pickupAddress ||
      "Pickup location"
    );
  }

  function dropoffLocation(item: DeliveryRecord) {
    return (
      item.dropoff_location ||
      item.delivery_city ||
      item.deliveryCity ||
      item.deliveryInfo?.city ||
      item.deliveryInfo?.deliveryCity ||
      item.dropoffAddress ||
      item.deliveryInfo?.address ||
      "Dropoff location"
    );
  }

  function hasProof(item: DeliveryRecord) {
    return Boolean(
      item.proof_of_delivery_photo_url ||
        item.delivery_photo_uri ||
        item.proofOfDeliveryPhotoUrl
    );
  }

  function driverName() {
    return (
      driver?.fullName ||
      driver?.name ||
      driver?.username ||
      driver?.email ||
      "Farm2Home Driver"
    );
  }

  function renderDeliveryCard({ item }: { item: DeliveryRecord }) {
    const proofAttached = hasProof(item);

    return (
      <View style={styles.deliveryCard}>
        <View style={styles.deliveryHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.deliveryTitle}>
              {item.title || "Farm2Home Delivery"}
            </Text>
            <Text style={styles.deliveryDate}>
              Delivered: {formatDate(item.delivered_at || item.updated_at)}
            </Text>
          </View>

          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>
              {formatStatus(item.status || item.fulfillmentStatus)}
            </Text>
          </View>
        </View>

        <View style={styles.routeBox}>
          <View style={styles.routeStop}>
            <Ionicons name="radio-button-on" size={18} color="#10B981" />
            <Text style={styles.routeText}>{pickupLocation(item)}</Text>
          </View>

          <View style={styles.routeLine} />

          <View style={styles.routeStop}>
            <Ionicons name="location" size={18} color="#10B981" />
            <Text style={styles.routeText}>{dropoffLocation(item)}</Text>
          </View>
        </View>

        <View style={styles.metaGrid}>
          <View style={styles.metaBox}>
            <Text style={styles.metaLabel}>Payout</Text>
            <Text style={styles.metaValue}>{formatMoney(getPayout(item))}</Text>
          </View>

          <View style={styles.metaBox}>
            <Text style={styles.metaLabel}>Miles</Text>
            <Text style={styles.metaValue}>{getMiles(item).toFixed(1)}</Text>
          </View>
        </View>

        <View style={styles.detailBox}>
          <Text style={styles.detailText}>
            Farmer: {item.farmer_name || item.farmers?.farm_name || "Farm2Home Farmer"}
          </Text>
          <Text style={styles.detailText}>
            Customer:{" "}
            {item.customerName ||
              item.customer_name ||
              item.customerEmail ||
              item.deliveryInfo?.name ||
              "Farm2Home Customer"}
          </Text>
        </View>

        <View
          style={[
            styles.proofBadge,
            proofAttached ? styles.proofBadgeComplete : styles.proofBadgeMissing,
          ]}
        >
          <Ionicons
            name={proofAttached ? "checkmark-circle" : "alert-circle-outline"}
            size={18}
            color="#FFFFFF"
          />
          <Text style={styles.proofText}>
            {proofAttached ? "Proof of Delivery Attached" : "Proof Not Found"}
          </Text>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor="#020617" />
        <View style={styles.loadingScreen}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.loadingText}>Loading delivery history...</Text>
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
              <Text style={styles.eyebrow}>Farm2Home Driver</Text>
              <Text style={styles.title}>Delivery History</Text>
              <Text style={styles.subtitle}>
                Review completed deliveries, payouts, mileage, proof status, and
                route details.
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
            onPress={() => router.push("/driver/mobile-driver-app" as any)}
          >
            <Ionicons name="phone-portrait-outline" size={18} color="#FFFFFF" />
            <Text style={styles.navText}>Driver App</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navButtonOutline}
            onPress={() => router.push("/driver/earnings" as any)}
          >
            <Ionicons
              name="wallet-outline"
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
          <View style={styles.driverCard}>
            <Text style={styles.driverName}>🚚 {driverName()}</Text>
            <Text style={styles.driverMeta}>
              Completed deliveries assigned to your driver account.
            </Text>
          </View>

          <View style={styles.statsGrid}>
            <StatCard
              icon="checkmark-done-outline"
              label="Completed"
              value={String(stats.completedDeliveries)}
              accent
            />
            <StatCard
              icon="cash-outline"
              label="Earnings"
              value={formatMoney(stats.totalEarnings)}
              accent
            />
            <StatCard
              icon="speedometer-outline"
              label="Miles"
              value={stats.totalMiles.toFixed(1)}
            />
            <StatCard
              icon="trending-up-outline"
              label="Avg Pay"
              value={formatMoney(stats.averagePayout)}
            />
          </View>

          <View style={styles.searchCard}>
            <Ionicons name="search-outline" size={20} color="#10B981" />
            <TextInput
              style={styles.searchInput}
              value={searchText}
              onChangeText={setSearchText}
              placeholder="Search by farmer, customer, city, status..."
              placeholderTextColor="#94A3B8"
            />
          </View>

          <TouchableOpacity style={styles.refreshButton} onPress={loadDeliveryHistory}>
            <Ionicons name="refresh-outline" size={18} color="#FFFFFF" />
            <Text style={styles.refreshText}>Refresh History</Text>
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>Completed Deliveries</Text>

          <FlatList
            data={filteredDeliveries}
            keyExtractor={(item, index) => String(item.id || index)}
            scrollEnabled={false}
            contentContainerStyle={{ paddingBottom: 110 }}
            ListEmptyComponent={
              <View style={styles.emptyCard}>
                <Ionicons name="file-tray-outline" size={34} color="#10B981" />
                <Text style={styles.emptyTitle}>No completed deliveries found.</Text>
                <Text style={styles.emptyText}>
                  Completed deliveries will appear here after proof of delivery is
                  submitted.
                </Text>
              </View>
            }
            renderItem={renderDeliveryCard}
          />
        </ScrollView>
      </View>
    </SafeAreaView>
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
  eyebrow: {
    color: "#10B981",
    fontWeight: "900",
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
  driverCard: {
    backgroundColor: freightTheme.colors.card,
    marginHorizontal: 18,
    marginBottom: 14,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
  },
  driverName: {
    color: freightTheme.colors.text,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 6,
  },
  driverMeta: {
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
  refreshButton: {
    backgroundColor: "#334155",
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
  },
  deliveryCard: {
    backgroundColor: freightTheme.colors.card,
    marginHorizontal: 18,
    marginBottom: 16,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
  },
  deliveryHeader: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    marginBottom: 12,
  },
  deliveryTitle: {
    color: freightTheme.colors.text,
    fontSize: 21,
    fontWeight: "900",
  },
  deliveryDate: {
    color: freightTheme.colors.mutedText,
    fontWeight: "700",
    marginTop: 4,
  },
  statusBadge: {
    backgroundColor: "#10B981",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    maxWidth: 130,
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
    fontSize: 16,
    flex: 1,
    lineHeight: 21,
  },
  metaGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  metaBox: {
    flex: 1,
    backgroundColor: freightTheme.colors.surface,
    borderRadius: 16,
    padding: 14,
  },
  metaLabel: {
    color: freightTheme.colors.mutedText,
    fontWeight: "900",
    marginBottom: 4,
  },
  metaValue: {
    color: freightTheme.colors.primary,
    fontSize: 22,
    fontWeight: "900",
  },
  detailBox: {
    backgroundColor: "#0F172A",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1E293B",
    padding: 13,
    marginBottom: 12,
  },
  detailText: {
    color: "#CBD5E1",
    fontWeight: "700",
    lineHeight: 21,
  },
  proofBadge: {
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  proofBadgeComplete: {
    backgroundColor: "#10B981",
  },
  proofBadgeMissing: {
    backgroundColor: "#DC2626",
  },
  proofText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  emptyCard: {
    backgroundColor: freightTheme.colors.card,
    marginHorizontal: 18,
    marginBottom: 16,
    padding: 22,
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