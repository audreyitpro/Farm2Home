import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";

import { API_BASE_URL } from "../config/api";

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
  routeGroup?: string;
};

type DriverProfile = {
  id?: string;
  driverId?: string;
  fullName?: string;
  name?: string;
  username?: string;
  email?: string;
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

  async function getCurrentDriver() {
    const rawDriver =
      (await AsyncStorage.getItem("currentDriver")) ||
      (await AsyncStorage.getItem("currentUser"));

    if (!rawDriver) return null;

    try {
      const parsed = JSON.parse(rawDriver);

      if (parsed?.role && parsed.role !== "driver") return null;

      return {
        ...parsed,
        id: parsed.id || parsed.driverId || parsed.email,
        driverId: parsed.driverId || parsed.id || parsed.email,
        role: "driver",
      };
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

      const response = await fetch(
        `${API_BASE_URL}/orders/driver-board?maxMiles=${Number(maxMiles || 9999)}`
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Unable to load driver board.");
      }

      setJobs(Array.isArray(data.availableOrders) ? data.availableOrders : []);
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

  const selectedJobs = useMemo(
    () => jobs.filter((job) => selectedIds.includes(job.id)),
    [jobs, selectedIds]
  );

  const selectedPayout = selectedJobs.reduce(
    (sum, job) => sum + Number(job.deliveryFee || job.tip || 0),
    0
  );

  const selectedMiles = selectedJobs.reduce(
    (sum, job) => sum + Number(job.estimatedMiles || 0),
    0
  );

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
          acceptedBy:
            currentDriver.fullName ||
            currentDriver.name ||
            currentDriver.username ||
            currentDriver.email ||
            "Farm2Home Driver",
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
          acceptedBy:
            currentDriver.fullName ||
            currentDriver.name ||
            currentDriver.username ||
            currentDriver.email ||
            "Farm2Home Driver",
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
      Alert.alert("Batch Error", error?.message || "Unable to accept selected deliveries.");
    } finally {
      setLoading(false);
    }
  }

  function getStatusLabel(job: DeliveryJob) {
    return job.fulfillmentStatus || job.status || "Available";
  }

  function renderJob({ item }: { item: DeliveryJob }) {
    const selected = selectedIds.includes(item.id);

    return (
      <View style={[styles.jobCard, selected && styles.selectedCard]}>
        <View style={styles.jobHeader}>
          <Text style={styles.farmName}>
            {item.customerName || item.customerEmail || "Farm2Home Delivery"}
          </Text>

          <View style={styles.badge}>
            <Text style={styles.badgeText}>{getStatusLabel(item)}</Text>
          </View>
        </View>

        <Text style={styles.label}>Pickup</Text>
        <Text style={styles.value}>{pickupCity(item)}</Text>

        <Text style={styles.label}>Dropoff</Text>
        <Text style={styles.value}>{deliveryCity(item)}</Text>

        <View style={styles.metaRow}>
          <View style={styles.metaBox}>
            <Text style={styles.metaLabel}>Miles</Text>
            <Text style={styles.metaValue}>
              {Number(item.estimatedMiles || 0).toFixed(1)}
            </Text>
          </View>

          <View style={styles.metaBox}>
            <Text style={styles.metaLabel}>Payout</Text>
            <Text style={styles.metaValue}>
              ${Number(item.deliveryFee || item.tip || 0).toFixed(2)}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={selected ? styles.unselectButton : styles.selectButton}
          onPress={() => toggleSelect(item)}
        >
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
            <Text style={styles.acceptButtonText}>Accept This Delivery</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  if (accessChecking) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#22C55E" />
        <Text style={styles.centeredText}>Loading Driver Board...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={jobs}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderJob}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refreshBoard} />
        }
        ListHeaderComponent={
          <View style={styles.headerBox}>
            <Text style={styles.header}>Driver Board</Text>

            <Text style={styles.subheader}>
              Select one or multiple nearby deliveries from the same pickup
              area, dropoff area, or route direction.
            </Text>

            <TextInput
              style={styles.input}
              value={maxMiles}
              onChangeText={setMaxMiles}
              keyboardType="numeric"
              placeholder="Max miles willing to travel"
              placeholderTextColor="#94A3B8"
            />

            <TouchableOpacity style={styles.refreshButton} onPress={loadJobs}>
              <Text style={styles.refreshButtonText}>Refresh Board</Text>
            </TouchableOpacity>

            {selectedJobs.length > 0 && (
              <View style={styles.batchBox}>
                <Text style={styles.batchTitle}>
                  Selected: {selectedJobs.length} deliveries
                </Text>

                <Text style={styles.batchText}>
                  Total Payout: ${selectedPayout.toFixed(2)} · Total Miles:{" "}
                  {selectedMiles.toFixed(1)}
                </Text>

                <TouchableOpacity
                  style={styles.batchButton}
                  onPress={acceptSelectedJobs}
                  disabled={loading}
                >
                  <Text style={styles.batchButtonText}>
                    Accept Selected Deliveries
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={() => setSelectedIds([])}
                >
                  <Text style={styles.batchButtonText}>Clear Selection</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>No deliveries available</Text>
            <Text style={styles.emptyText}>
              Pull down to refresh. New farmer delivery orders will appear here.
            </Text>
          </View>
        }
        contentContainerStyle={styles.content}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  centered: {
    flex: 1,
    backgroundColor: "#0F172A",
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
  content: { padding: 18, paddingBottom: 120 },
  headerBox: { marginBottom: 18 },
  header: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "900",
    marginTop: 18,
  },
  subheader: {
    color: "#CBD5E1",
    marginTop: 8,
    lineHeight: 22,
    fontWeight: "700",
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginTop: 14,
    color: "#111827",
    fontWeight: "800",
  },
  refreshButton: {
    backgroundColor: "#334155",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 12,
  },
  refreshButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  batchBox: {
    backgroundColor: "#064E3B",
    borderRadius: 18,
    padding: 16,
    marginTop: 14,
  },
  batchTitle: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 18,
  },
  batchText: {
    color: "#BBF7D0",
    fontWeight: "800",
    marginTop: 6,
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
  jobCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  selectedCard: {
    borderColor: "#22C55E",
    backgroundColor: "#ECFDF5",
  },
  jobHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
  },
  farmName: {
    flex: 1,
    color: "#111827",
    fontSize: 20,
    fontWeight: "900",
  },
  badge: {
    backgroundColor: "#DBEAFE",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: {
    color: "#1D4ED8",
    fontWeight: "900",
    fontSize: 12,
  },
  label: {
    color: "#64748B",
    fontWeight: "900",
    marginTop: 14,
    marginBottom: 4,
  },
  value: {
    color: "#111827",
    fontWeight: "800",
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  metaBox: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    borderRadius: 16,
    padding: 14,
  },
  metaLabel: {
    color: "#64748B",
    fontWeight: "900",
  },
  metaValue: {
    color: "#111827",
    fontWeight: "900",
    fontSize: 18,
    marginTop: 4,
  },
  selectButton: {
    backgroundColor: "#2563EB",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 18,
  },
  unselectButton: {
    backgroundColor: "#DC2626",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 18,
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
    marginTop: 10,
  },
  acceptButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },
  disabled: { opacity: 0.6 },
  emptyBox: {
    backgroundColor: "#1E293B",
    borderRadius: 22,
    padding: 22,
    alignItems: "center",
    marginTop: 30,
  },
  emptyTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
  },
  emptyText: {
    color: "#CBD5E1",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 22,
    fontWeight: "700",
  },
});