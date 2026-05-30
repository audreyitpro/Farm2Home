// app/driver/board.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  SafeAreaView,
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

import { API_BASE_URL } from "../config/api";
import freightTheme from "../styles/freightTheme";

type DeliveryJob = {
  id: string;
  customerName?: string;
  customerEmail?: string;
  pickupCity?: string;
  deliveryCity?: string;
  pickupAddress?: string;
  dropoffAddress?: string;
  deliveryInfo?: any;
  deliveryFee?: number;
  tip?: number;
  total?: number;
  estimatedMiles?: number;
  fulfillmentStatus?: string;
  status?: string;
  assignedDriverId?: string;
  assignedFreightCarrierId?: string;
  routeGroup?: string;
};

type DriverProfile = {
  id?: string;
  driverId?: string;
  fullName?: string;
  name?: string;
  username?: string;
  email?: string;
  role?: string;
};

export default function DriverBoardScreen() {
  const [loading, setLoading] = useState(false);
  const [accessChecking, setAccessChecking] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [jobs, setJobs] = useState<DeliveryJob[]>([]);
  const [driver, setDriver] = useState<DriverProfile | null>(null);
  const [maxMiles, setMaxMiles] = useState("50");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useFocusEffect(
    useCallback(() => {
      initialize();
    }, [])
  );

  const selectedJobs = useMemo(
    () => jobs.filter((job) => selectedIds.includes(job.id)),
    [jobs, selectedIds]
  );

  const selectedPayout = useMemo(
    () =>
      selectedJobs.reduce(
        (sum, job) => sum + Number(job.deliveryFee || job.tip || 0),
        0
      ),
    [selectedJobs]
  );

  const selectedMiles = useMemo(
    () =>
      selectedJobs.reduce(
        (sum, job) => sum + Number(job.estimatedMiles || 0),
        0
      ),
    [selectedJobs]
  );

  async function getCurrentDriver(): Promise<DriverProfile | null> {
    const rawDriver =
      (await AsyncStorage.getItem("currentDriver")) ||
      (await AsyncStorage.getItem("currentUser"));

    if (!rawDriver) return null;

    try {
      const parsed = JSON.parse(rawDriver);

      if (parsed?.role && parsed.role !== "driver") return null;

      const currentDriver = {
        ...parsed,
        id: parsed.id || parsed.driverId || parsed.email || parsed.username,
        driverId: parsed.driverId || parsed.id || parsed.email || parsed.username,
        role: "driver",
      };

      return currentDriver;
    } catch {
      return null;
    }
  }

  async function initialize() {
    try {
      setAccessChecking(true);

      const currentDriver = await getCurrentDriver();

      if (!currentDriver) {
        router.replace("/driver/login" as any);
        return;
      }

      setDriver(currentDriver);

      await AsyncStorage.setItem("currentDriver", JSON.stringify(currentDriver));
      await AsyncStorage.setItem("currentUser", JSON.stringify(currentDriver));
      await AsyncStorage.setItem("userRole", "driver");
      await AsyncStorage.setItem("currentUserRole", "driver");

      await loadJobs();
    } catch (error) {
      console.log("Driver board initialize error:", error);
      Alert.alert("Driver Board Error", "Unable to load driver board.");
    } finally {
      setAccessChecking(false);
    }
  }

  async function loadJobs() {
    try {
      setRefreshing(true);

      const miles = Number(maxMiles || 9999);
      const safeMiles = Number.isFinite(miles) && miles > 0 ? miles : 9999;

      const response = await fetch(
        `${API_BASE_URL}/orders/driver-board?maxMiles=${safeMiles}`
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Unable to load driver board.");
      }

      const availableOrders = Array.isArray(data.availableOrders)
        ? data.availableOrders
        : [];

      setJobs(availableOrders);
    } catch (error: any) {
      console.log("Load driver board error:", error);
      Alert.alert("Load Error", error?.message || "Unable to load jobs.");
    } finally {
      setRefreshing(false);
    }
  }

  async function refreshBoard() {
    await loadJobs();
  }

  function pickupCity(job: DeliveryJob) {
    return (
      job.pickupCity ||
      job.deliveryInfo?.pickupCity ||
      job.deliveryInfo?.farmCity ||
      job.pickupAddress ||
      "Pickup"
    );
  }

  function deliveryCity(job: DeliveryJob) {
    return (
      job.deliveryCity ||
      job.deliveryInfo?.city ||
      job.deliveryInfo?.deliveryCity ||
      job.dropoffAddress ||
      "Delivery"
    );
  }

  function routeKey(job: DeliveryJob) {
    return `${String(pickupCity(job)).toLowerCase()}-${String(
      deliveryCity(job)
    ).toLowerCase()}`;
  }

  function payout(job: DeliveryJob) {
    return Number(job.deliveryFee || job.tip || 0);
  }

  function getDriverDisplayName(currentDriver?: DriverProfile | null) {
    return (
      currentDriver?.fullName ||
      currentDriver?.name ||
      currentDriver?.username ||
      currentDriver?.email ||
      "Farm2Home Driver"
    );
  }

  function toggleSelect(job: DeliveryJob) {
    if (selectedIds.includes(job.id)) {
      setSelectedIds((prev) => prev.filter((id) => id !== job.id));
      return;
    }

    if (selectedJobs.length > 0) {
      const first = selectedJobs[0];

      const samePickup =
        String(pickupCity(first)).toLowerCase() ===
        String(pickupCity(job)).toLowerCase();

      const sameDropoff =
        String(deliveryCity(first)).toLowerCase() ===
        String(deliveryCity(job)).toLowerCase();

      const sameRoute = routeKey(first) === routeKey(job);

      if (!samePickup && !sameDropoff && !sameRoute) {
        Alert.alert(
          "Different Area",
          "Select deliveries from the same pickup area, same delivery area, or same route direction."
        );
        return;
      }
    }

    setSelectedIds((prev) => [...prev, job.id]);
  }

  async function acceptJob(job: DeliveryJob) {
    try {
      const currentDriver = driver || (await getCurrentDriver());

      if (!currentDriver?.id) {
        Alert.alert("Driver Login Required", "Please login again.");
        router.replace("/driver/login" as any);
        return;
      }

      setLoading(true);

      const response = await fetch(`${API_BASE_URL}/orders/${job.id}/accept`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driverId: currentDriver.id,
          acceptedBy: getDriverDisplayName(currentDriver),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Unable to accept delivery.");
      }

      Alert.alert("Delivery Accepted", "This delivery is now assigned to you.");
      await loadJobs();

      router.push("/driver/mobile-driver-app" as any);
    } catch (error: any) {
      console.log("Accept job error:", error);
      Alert.alert("Accept Error", error?.message || "Unable to accept job.");
    } finally {
      setLoading(false);
    }
  }

  async function acceptSelectedJobs() {
    try {
      const currentDriver = driver || (await getCurrentDriver());

      if (!currentDriver?.id) {
        Alert.alert("Driver Login Required", "Please login again.");
        router.replace("/driver/login" as any);
        return;
      }

      if (selectedIds.length === 0) {
        Alert.alert("No Deliveries Selected", "Select one or more deliveries.");
        return;
      }

      setLoading(true);

      const response = await fetch(`${API_BASE_URL}/orders/batch-accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderIds: selectedIds,
          driverId: currentDriver.id,
          acceptedBy: getDriverDisplayName(currentDriver),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Unable to accept selected deliveries.");
      }

      Alert.alert(
        "Batch Accepted",
        `${data.totalAccepted || selectedIds.length} deliveries assigned to you.`
      );

      setSelectedIds([]);
      await loadJobs();

      router.push("/driver/mobile-driver-app" as any);
    } catch (error: any) {
      console.log("Batch accept error:", error);
      Alert.alert(
        "Batch Error",
        error?.message || "Unable to accept selected deliveries."
      );
    } finally {
      setLoading(false);
    }
  }

  function getStatusLabel(job: DeliveryJob) {
    return job.fulfillmentStatus || job.status || "Available";
  }

  function statusColor(status?: string) {
    const normalized = String(status || "").toUpperCase();

    switch (normalized) {
      case "OPEN":
      case "NEW":
      case "AVAILABLE":
        return "#2563EB";
      case "BOOKED":
      case "ACCEPTED":
        return "#7C3AED";
      case "PICKED_UP":
        return "#F59E0B";
      case "IN_TRANSIT":
        return "#0F766E";
      case "DELIVERED":
        return "#10B981";
      case "CANCELLED":
        return "#DC2626";
      default:
        return "#64748B";
    }
  }

  function formatStatus(status?: string) {
    return String(status || "Available")
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function renderJob({ item }: { item: DeliveryJob }) {
    const selected = selectedIds.includes(item.id);
    const status = getStatusLabel(item);
    const pickup = pickupCity(item);
    const delivery = deliveryCity(item);

    return (
      <View style={[styles.jobCard, selected && styles.selectedCard]}>
        <View style={styles.jobHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.farmName}>
              {item.customerName || item.customerEmail || "Farm2Home Delivery"}
            </Text>
            <Text style={styles.routeGroup}>
              {item.routeGroup || "Local driver delivery"}
            </Text>
          </View>

          <View style={[styles.badge, { backgroundColor: statusColor(status) }]}>
            <Text style={styles.badgeText}>{formatStatus(status)}</Text>
          </View>
        </View>

        <View style={styles.routeCard}>
          <View style={styles.routeStop}>
            <Ionicons name="radio-button-on" size={18} color="#10B981" />
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Pickup</Text>
              <Text style={styles.value}>{pickup}</Text>
            </View>
          </View>

          <View style={styles.routeLine} />

          <View style={styles.routeStop}>
            <Ionicons name="location" size={18} color="#10B981" />
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Dropoff</Text>
              <Text style={styles.value}>{delivery}</Text>
            </View>
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaBox}>
            <Ionicons name="navigate-outline" size={17} color="#10B981" />
            <Text style={styles.metaLabel}>Miles</Text>
            <Text style={styles.metaValue}>
              {Number(item.estimatedMiles || 0).toFixed(1)}
            </Text>
          </View>

          <View style={styles.metaBox}>
            <Ionicons name="cash-outline" size={17} color="#10B981" />
            <Text style={styles.metaLabel}>Payout</Text>
            <Text style={styles.metaValue}>${payout(item).toFixed(2)}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={selected ? styles.unselectButton : styles.selectButton}
          onPress={() => toggleSelect(item)}
          disabled={loading}
        >
          <Ionicons
            name={selected ? "remove-circle-outline" : "add-circle-outline"}
            size={18}
            color="#FFFFFF"
          />
          <Text style={styles.selectButtonText}>
            {selected ? "Remove From Batch" : "Select For Batch"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.acceptButton, loading && styles.disabled]}
          onPress={() => acceptJob(item)}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
              <Text style={styles.acceptButtonText}>Accept This Delivery</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  if (accessChecking) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor="#020617" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#22C55E" />
          <Text style={styles.centeredText}>Loading Driver Board...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#020617" />

      <View style={styles.container}>
        <FlatList
          data={jobs}
          keyExtractor={(item, index) => String(item.id || index)}
          renderItem={renderJob}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refreshBoard} />
          }
          ListHeaderComponent={
            <View style={styles.headerBox}>
              <View style={styles.hero}>
                <View style={styles.heroTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.eyebrow}>Driver Portal</Text>
                    <Text style={styles.header}>Driver Board</Text>
                    <Text style={styles.subheader}>
                      Select one or multiple nearby deliveries from the same
                      pickup area, dropoff area, or route direction.
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.profileButton}
                    onPress={() => router.push("/driver/profile" as any)}
                  >
                    <Ionicons
                      name="person-circle-outline"
                      size={34}
                      color="#FFFFFF"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.topActions}>
                <TouchableOpacity
                  style={styles.topActionButton}
                  onPress={() => router.push("/driver/mobile-driver-app" as any)}
                >
                  <Ionicons name="phone-portrait-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.topActionText}>Driver App</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.topActionOutline}
                  onPress={() => router.push("/driver/profile" as any)}
                >
                  <Ionicons
                    name="person-outline"
                    size={18}
                    color={freightTheme.colors.primary}
                  />
                  <Text style={styles.topActionOutlineText}>Profile</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.filterCard}>
                <Text style={styles.filterLabel}>Max miles willing to travel</Text>
                <TextInput
                  style={styles.input}
                  value={maxMiles}
                  onChangeText={setMaxMiles}
                  keyboardType="numeric"
                  placeholder="Max miles willing to travel"
                  placeholderTextColor="#94A3B8"
                />

                <TouchableOpacity
                  style={styles.refreshButton}
                  onPress={loadJobs}
                  disabled={refreshing}
                >
                  {refreshing ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="refresh-outline" size={18} color="#FFFFFF" />
                      <Text style={styles.refreshButtonText}>Refresh Board</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {selectedJobs.length > 0 && (
                <View style={styles.batchBox}>
                  <View style={styles.batchHeader}>
                    <Ionicons name="layers-outline" size={22} color="#BBF7D0" />
                    <Text style={styles.batchTitle}>
                      Selected: {selectedJobs.length} deliveries
                    </Text>
                  </View>

                  <Text style={styles.batchText}>
                    Total Payout: ${selectedPayout.toFixed(2)} · Total Miles:{" "}
                    {selectedMiles.toFixed(1)}
                  </Text>

                  <TouchableOpacity
                    style={[styles.batchButton, loading && styles.disabled]}
                    onPress={acceptSelectedJobs}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.batchButtonText}>
                        Accept Selected Deliveries
                      </Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.clearButton}
                    onPress={() => setSelectedIds([])}
                    disabled={loading}
                  >
                    <Text style={styles.batchButtonText}>Clear Selection</Text>
                  </TouchableOpacity>
                </View>
              )}

              <Text style={styles.sectionTitle}>Available Deliveries</Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="leaf-outline" size={34} color="#10B981" />
              <Text style={styles.emptyTitle}>No deliveries available</Text>
              <Text style={styles.emptyText}>
                Pull down to refresh. New farmer delivery orders will appear here.
              </Text>
            </View>
          }
          contentContainerStyle={styles.content}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: freightTheme.colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: freightTheme.colors.background,
  },
  centered: {
    flex: 1,
    backgroundColor: freightTheme.colors.background,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  centeredText: {
    color: "#CBD5E1",
    marginTop: 12,
    textAlign: "center",
    fontWeight: "800",
    lineHeight: 22,
  },
  content: {
    paddingBottom: 120,
  },
  headerBox: {
    marginBottom: 4,
  },
  hero: {
    backgroundColor: "#020617",
    paddingTop: 18,
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  eyebrow: {
    color: "#10B981",
    fontWeight: "900",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  header: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900",
    marginBottom: 10,
  },
  subheader: {
    color: "#CBD5E1",
    lineHeight: 22,
    fontWeight: "700",
  },
  profileButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#064E3B",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#10B981",
  },
  topActions: {
    flexDirection: "row",
    gap: 10,
    padding: 18,
  },
  topActionButton: {
    flex: 1,
    backgroundColor: freightTheme.colors.primary,
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  topActionOutline: {
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
  topActionText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  topActionOutlineText: {
    color: freightTheme.colors.primary,
    fontWeight: "900",
  },
  filterCard: {
    backgroundColor: freightTheme.colors.card,
    marginHorizontal: 18,
    marginBottom: 14,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
  },
  filterLabel: {
    color: freightTheme.colors.text,
    fontWeight: "900",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    color: "#111827",
    fontWeight: "800",
  },
  refreshButton: {
    backgroundColor: "#334155",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
  },
  refreshButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  batchBox: {
    backgroundColor: "#064E3B",
    borderRadius: 20,
    padding: 16,
    marginHorizontal: 18,
    marginBottom: 16,
  },
  batchHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  batchTitle: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 18,
  },
  batchText: {
    color: "#BBF7D0",
    fontWeight: "800",
    marginTop: 8,
  },
  batchButton: {
    backgroundColor: "#22C55E",
    padding: 14,
    borderRadius: 14,
    marginTop: 12,
    alignItems: "center",
  },
  clearButton: {
    backgroundColor: "#DC2626",
    padding: 14,
    borderRadius: 14,
    marginTop: 10,
    alignItems: "center",
  },
  batchButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  sectionTitle: {
    color: freightTheme.colors.text,
    fontSize: 24,
    fontWeight: "900",
    paddingHorizontal: 18,
    marginTop: 2,
    marginBottom: 12,
  },
  jobCard: {
    backgroundColor: freightTheme.colors.card,
    borderRadius: 22,
    padding: 18,
    marginHorizontal: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
  },
  selectedCard: {
    borderColor: "#22C55E",
    backgroundColor: "#052E2B",
  },
  jobHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    marginBottom: 14,
  },
  farmName: {
    flex: 1,
    color: freightTheme.colors.text,
    fontSize: 20,
    fontWeight: "900",
  },
  routeGroup: {
    color: freightTheme.colors.mutedText,
    fontWeight: "700",
    marginTop: 4,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    maxWidth: 140,
  },
  badgeText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 11,
  },
  routeCard: {
    backgroundColor: freightTheme.colors.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
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
  label: {
    color: freightTheme.colors.primary,
    fontWeight: "900",
    fontSize: 12,
    textTransform: "uppercase",
  },
  value: {
    color: freightTheme.colors.text,
    fontWeight: "900",
    lineHeight: 21,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 4,
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
    marginTop: 6,
  },
  metaValue: {
    color: freightTheme.colors.text,
    fontWeight: "900",
    fontSize: 18,
    marginTop: 4,
  },
  selectButton: {
    backgroundColor: "#2563EB",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
    flexDirection: "row",
    gap: 8,
  },
  unselectButton: {
    backgroundColor: "#DC2626",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
    flexDirection: "row",
    gap: 8,
  },
  selectButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  acceptButton: {
    backgroundColor: "#15803D",
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
  },
  acceptButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },
  disabled: {
    opacity: 0.6,
  },
  emptyBox: {
    backgroundColor: freightTheme.colors.card,
    borderRadius: 22,
    padding: 24,
    alignItems: "center",
    marginHorizontal: 18,
    marginTop: 20,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
  },
  emptyTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
    marginTop: 10,
  },
  emptyText: {
    color: "#CBD5E1",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 22,
    fontWeight: "700",
  },
});