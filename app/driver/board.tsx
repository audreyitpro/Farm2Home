import React, { useCallback, useState } from "react";
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

import { API_BASE_URL } from "../config/api";
import { enforceSubscriptionAccess } from "../services/lockoutGuard";

type DeliveryJob = {
  id: string;
  order_id: string;
  farmer_id?: string;
  farm_name?: string;
  customer_name?: string;
  pickup_address?: string;
  dropoff_address?: string;
  delivery_window?: string;
  miles?: number;
  payout_amount?: number;
  status?: string;
  visibility?: string;
  assigned_driver_id?: string;
};

type DriverProfile = {
  id?: string;
  name?: string;
  email?: string;
  driverSubscriptionActive?: boolean;
};

export default function DriverBoardScreen() {
  const [loading, setLoading] = useState(false);
  const [accessChecking, setAccessChecking] = useState(true);
  const [accessAllowed, setAccessAllowed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [jobs, setJobs] = useState<DeliveryJob[]>([]);
  const [driver, setDriver] = useState<DriverProfile | null>(null);

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
      return JSON.parse(rawDriver);
    } catch {
      return null;
    }
  }

  async function checkDriverAccess(currentDriver?: DriverProfile | null) {
    const activeDriver = currentDriver || driver || (await getCurrentDriver());

    const access = await enforceSubscriptionAccess({
      role: "driver",
      userId: activeDriver?.id || "",
      email: activeDriver?.email || "",
      redirectTo: "/subscription/subscription-locked",
    });

    setAccessAllowed(access.allowed);
    return access.allowed;
  }

  async function initialize() {
    try {
      setAccessChecking(true);

      const currentDriver = await getCurrentDriver();

      if (currentDriver) {
        setDriver(currentDriver);
      }

      const allowed = await checkDriverAccess(currentDriver);

      if (allowed) {
        await loadJobs();
      }
    } catch (error) {
      console.log("Driver board initialize error:", error);
      setAccessAllowed(false);
    } finally {
      setAccessChecking(false);
    }
  }

  async function loadJobs() {
    try {
      setRefreshing(true);

      const response = await fetch(`${API_BASE_URL}/driver/driver-board`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Unable to load driver board.");
      }

      setJobs(data.jobs || []);
    } catch (error: any) {
      console.log("Load driver board error:", error);
      Alert.alert("Load Error", error?.message || "Unable to load jobs.");
    } finally {
      setRefreshing(false);
    }
  }

  async function refreshBoard() {
    const allowed = await checkDriverAccess();
    if (!allowed) return;

    await loadJobs();
  }

  async function acceptJob(job: DeliveryJob) {
    try {
      const currentDriver = driver || (await getCurrentDriver());

      if (!currentDriver?.id) {
        Alert.alert(
          "Driver Login Required",
          "Please login or create a driver profile before accepting jobs."
        );
        return;
      }

      const allowed = await checkDriverAccess(currentDriver);

      if (!allowed) return;

      setLoading(true);

      const response = await fetch(`${API_BASE_URL}/driver/accept-delivery-job`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deliveryJobId: job.id,
          driverId: currentDriver.id,
          driverName: currentDriver.name || currentDriver.email || "Driver",
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Unable to accept delivery.");
      }

      Alert.alert("Delivery Accepted", "This delivery is now assigned to you.");

      await loadJobs();

      router.push({
        pathname: "/driver/my-deliveries",
        params: { deliveryJobId: job.id },
      } as any);
    } catch (error: any) {
      console.log("Accept job error:", error);
      Alert.alert("Accept Error", error?.message || "Unable to accept job.");
    } finally {
      setLoading(false);
    }
  }

  function getStatusLabel(job: DeliveryJob) {
    if (job.visibility === "preferred_only") return "Preferred Drivers First";
    if (job.status === "open_board") return "Open Board";
    return job.status || "Available";
  }

  function renderJob({ item }: { item: DeliveryJob }) {
    return (
      <View style={styles.jobCard}>
        <View style={styles.jobHeader}>
          <Text style={styles.farmName}>{item.farm_name || "Farm Delivery"}</Text>

          <View style={styles.badge}>
            <Text style={styles.badgeText}>{getStatusLabel(item)}</Text>
          </View>
        </View>

        <Text style={styles.label}>Pickup</Text>
        <Text style={styles.value}>{item.pickup_address || "Farm pickup"}</Text>

        <Text style={styles.label}>Dropoff</Text>
        <Text style={styles.value}>
          {item.dropoff_address || "Customer delivery address"}
        </Text>

        <View style={styles.metaRow}>
          <View style={styles.metaBox}>
            <Text style={styles.metaLabel}>Miles</Text>
            <Text style={styles.metaValue}>
              {Number(item.miles || 0).toFixed(1)}
            </Text>
          </View>

          <View style={styles.metaBox}>
            <Text style={styles.metaLabel}>Payout</Text>
            <Text style={styles.metaValue}>
              ${Number(item.payout_amount || 0).toFixed(2)}
            </Text>
          </View>
        </View>

        {!!item.delivery_window && (
          <>
            <Text style={styles.label}>Delivery Window</Text>
            <Text style={styles.value}>{item.delivery_window}</Text>
          </>
        )}

        <TouchableOpacity
          style={[styles.acceptButton, loading && styles.disabled]}
          onPress={() => acceptJob(item)}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.acceptButtonText}>Accept Delivery</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  if (accessChecking) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#22C55E" />
        <Text style={styles.centeredText}>Checking Driver Board access...</Text>
      </View>
    );
  }

  if (!accessAllowed) {
    return (
      <View style={styles.centered}>
        <Text style={styles.lockTitle}>Driver Membership Required</Text>
        <Text style={styles.centeredText}>Redirecting to subscription page...</Text>

        <TouchableOpacity
          style={styles.subscriptionButton}
          onPress={() => router.push("/driver/subscription" as any)}
        >
          <Text style={styles.subscriptionButtonText}>
            Manage Driver Board Membership
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={jobs}
        keyExtractor={(item) => item.id}
        renderItem={renderJob}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refreshBoard} />
        }
        ListHeaderComponent={
          <View style={styles.headerBox}>
            <Text style={styles.header}>Driver Board</Text>

            <Text style={styles.subheader}>
              Accept available local farm delivery orders. Preferred farmer
              drivers get first access, then unclaimed deliveries open to the
              paid Driver Board.
            </Text>

            <TouchableOpacity
              style={styles.subscriptionButton}
              onPress={() => router.push("/driver/subscription" as any)}
            >
              <Text style={styles.subscriptionButtonText}>
                Manage Driver Board Membership
              </Text>
            </TouchableOpacity>
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
  lockTitle: {
    color: "#FCA5A5",
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center",
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
  subscriptionButton: {
    backgroundColor: "#22C55E",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 16,
  },
  subscriptionButtonText: {
    color: "#052E16",
    fontWeight: "900",
    textAlign: "center",
  },
  jobCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
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
  acceptButton: {
    backgroundColor: "#15803D",
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 18,
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