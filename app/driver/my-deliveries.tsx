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

import { enforceSubscriptionAccess } from "../services/lockoutGuard";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  "https://farm2home-production-e4bd.up.railway.app";

type DeliveryStatus =
  | "accepted"
  | "arrived_pickup"
  | "picked_up"
  | "arrived_dropoff"
  | "completed"
  | "cancelled";

type DeliveryJob = {
  id: string;
  order_id?: string;
  farmer_id?: string;
  customer_id?: string;
  farm_name?: string;
  customer_name?: string;
  customer_phone?: string;
  pickup_address?: string;
  dropoff_address?: string;
  delivery_window?: string;
  payout_amount?: number;
  miles?: number;
  pickup_notes?: string;
  delivery_notes?: string;
  status?: DeliveryStatus | string;
  visibility?: string;
  assigned_driver_id?: string;
  assigned_driver_name?: string;
  accepted_at?: string;
  arrived_pickup_at?: string;
  picked_up_at?: string;
  arrived_dropoff_at?: string;
  delivered_at?: string;
  proof_of_pickup_url?: string;
  proof_of_delivery_url?: string;
  created_at?: string;
};

type DriverProfile = {
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
};

export default function DriverMyDeliveriesScreen() {
  const [driver, setDriver] = useState<DriverProfile | null>(null);
  const [jobs, setJobs] = useState<DeliveryJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState("");
  const [accessAllowed, setAccessAllowed] = useState(false);
  const [accessChecking, setAccessChecking] = useState(true);

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

  async function checkDriverAccess(activeDriver?: DriverProfile | null) {
    const currentDriver = activeDriver || driver || (await getCurrentDriver());

    if (!currentDriver?.id) {
      router.replace("/driver/login" as any);
      return false;
    }

    const access = await enforceSubscriptionAccess({
      role: "driver",
      userId: currentDriver.id || "",
      email: currentDriver.email || "",
      redirectTo: "/subscription/subscription-locked",
    });

    setAccessAllowed(access.allowed);
    return access.allowed;
  }

  async function initialize() {
    try {
      setLoading(true);
      setAccessChecking(true);

      const currentDriver = await getCurrentDriver();

      if (!currentDriver?.id) {
        Alert.alert(
          "Driver Login Required",
          "Please login before viewing your deliveries."
        );
        router.replace("/driver/login" as any);
        return;
      }

      setDriver(currentDriver);

      const allowed = await checkDriverAccess(currentDriver);

      if (allowed) {
        await loadAssignedJobs(currentDriver.id);
      }
    } catch (error) {
      console.log("Driver deliveries initialize error:", error);
      setAccessAllowed(false);
    } finally {
      setLoading(false);
      setAccessChecking(false);
    }
  }

  async function loadAssignedJobs(driverId?: string) {
    try {
      const activeDriverId = driverId || driver?.id;

      if (!activeDriverId) return;

      setRefreshing(true);

      const response = await fetch(
        `${API_BASE_URL}/driver/assigned-jobs/${activeDriverId}`
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Unable to load assigned deliveries.");
      }

      setJobs(data.jobs || []);
    } catch (error: any) {
      console.log("Load assigned deliveries error:", error);
      Alert.alert(
        "Load Error",
        error?.message || "Unable to load your deliveries."
      );
    } finally {
      setRefreshing(false);
    }
  }

  async function refreshDeliveries() {
    const allowed = await checkDriverAccess();

    if (!allowed) return;

    await loadAssignedJobs(driver?.id);
  }

  async function updateDeliveryStatus(job: DeliveryJob, status: DeliveryStatus) {
    try {
      const allowed = await checkDriverAccess();

      if (!allowed) return;

      if (!driver?.id) {
        Alert.alert("Driver Error", "Please login again.");
        router.replace("/driver/login" as any);
        return;
      }

      setUpdatingId(job.id);

      const response = await fetch(`${API_BASE_URL}/driver/update-delivery-status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deliveryJobId: job.id,
          driverId: driver.id,
          status,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Unable to update delivery status.");
      }

      Alert.alert("Delivery Updated", data.message || "Delivery status updated.");

      await loadAssignedJobs(driver.id);
    } catch (error: any) {
      console.log("Update delivery status error:", error);
      Alert.alert(
        "Update Error",
        error?.message || "Unable to update delivery status."
      );
    } finally {
      setUpdatingId("");
    }
  }

  function openProofOfPickup(job: DeliveryJob) {
    router.push({
      pathname: "/driver/proof-of-pickup" as any,
      params: { loadId: job.id, deliveryJobId: job.id },
    });
  }

  function openProofOfDelivery(job: DeliveryJob) {
    router.push({
      pathname: "/driver/proof-of-delivery" as any,
      params: { loadId: job.id, deliveryJobId: job.id },
    });
  }

  function getStatusLabel(status?: string) {
    switch (status) {
      case "accepted":
        return "Accepted";
      case "arrived_pickup":
        return "Arrived Pickup";
      case "picked_up":
        return "Picked Up";
      case "arrived_dropoff":
        return "Arrived Dropoff";
      case "completed":
        return "Completed";
      case "cancelled":
        return "Cancelled";
      default:
        return status || "Assigned";
    }
  }

  function getNextAction(job: DeliveryJob) {
    switch (job.status) {
      case "accepted":
        return {
          label: "Arrived Pickup",
          status: "arrived_pickup" as DeliveryStatus,
        };
      case "arrived_pickup":
        return {
          label: "Proof of Pickup",
          proof: "pickup",
        };
      case "picked_up":
        return {
          label: "Arrived Dropoff",
          status: "arrived_dropoff" as DeliveryStatus,
        };
      case "arrived_dropoff":
        return {
          label: "Proof of Delivery",
          proof: "delivery",
        };
      default:
        return null;
    }
  }

  function renderJob({ item }: { item: DeliveryJob }) {
    const nextAction = getNextAction(item);
    const isUpdating = updatingId === item.id;
    const completed = item.status === "completed";

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.farmName}>
              {item.farm_name || "Farm Delivery"}
            </Text>

            <Text style={styles.orderText}>
              Order #{String(item.order_id || item.id).slice(-6)}
            </Text>
          </View>

          <View
            style={[
              styles.statusBadge,
              completed && styles.completedBadge,
              item.status === "cancelled" && styles.cancelledBadge,
            ]}
          >
            <Text style={styles.statusText}>{getStatusLabel(item.status)}</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Pickup</Text>
        <Text style={styles.addressText}>
          {item.pickup_address || "Farm pickup location"}
        </Text>

        <Text style={styles.sectionLabel}>Dropoff</Text>
        <Text style={styles.addressText}>
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
            <Text style={styles.sectionLabel}>Delivery Window</Text>
            <Text style={styles.addressText}>{item.delivery_window}</Text>
          </>
        )}

        {!!item.customer_name && (
          <>
            <Text style={styles.sectionLabel}>Customer</Text>
            <Text style={styles.addressText}>
              {item.customer_name}
              {item.customer_phone ? ` · ${item.customer_phone}` : ""}
            </Text>
          </>
        )}

        {!!item.pickup_notes && (
          <Text style={styles.notesText}>Pickup Notes: {item.pickup_notes}</Text>
        )}

        {!!item.delivery_notes && (
          <Text style={styles.notesText}>
            Delivery Notes: {item.delivery_notes}
          </Text>
        )}

        {nextAction ? (
          <TouchableOpacity
            style={[styles.primaryButton, isUpdating && styles.disabled]}
            onPress={() => {
              if (nextAction.proof === "pickup") {
                openProofOfPickup(item);
                return;
              }

              if (nextAction.proof === "delivery") {
                openProofOfDelivery(item);
                return;
              }

              if (nextAction.status) {
                updateDeliveryStatus(item, nextAction.status);
              }
            }}
            disabled={isUpdating}
          >
            {isUpdating ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>{nextAction.label}</Text>
            )}
          </TouchableOpacity>
        ) : null}

        {!completed && item.status !== "cancelled" ? (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => updateDeliveryStatus(item, "cancelled")}
            disabled={isUpdating}
          >
            <Text style={styles.cancelButtonText}>Cancel Delivery</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  if (loading || accessChecking) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#22C55E" />
        <Text style={styles.centeredText}>Checking driver delivery access...</Text>
      </View>
    );
  }

  if (!accessAllowed) {
    return (
      <View style={styles.centered}>
        <Text style={styles.lockTitle}>Driver Membership Required</Text>
        <Text style={styles.centeredText}>Redirecting to subscription page...</Text>

        <TouchableOpacity
          style={styles.manageButton}
          onPress={() => router.push("/driver/subscription" as any)}
        >
          <Text style={styles.manageButtonText}>Manage Driver Membership</Text>
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
          <RefreshControl refreshing={refreshing} onRefresh={refreshDeliveries} />
        }
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>My Deliveries</Text>

            <Text style={styles.subtitle}>
              Track assigned Farm2Home delivery jobs, complete pickup, and
              submit proof of delivery.
            </Text>

            <TouchableOpacity
              style={styles.boardButton}
              onPress={() => router.push("/driver/board" as any)}
            >
              <Text style={styles.boardButtonText}>Back to Driver Board</Text>
            </TouchableOpacity>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>🚚</Text>
            <Text style={styles.emptyTitle}>No assigned deliveries</Text>
            <Text style={styles.emptyText}>
              Accept a delivery from the Driver Board. Assigned jobs will appear
              here.
            </Text>
          </View>
        }
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
  content: {
    padding: 18,
    paddingBottom: 120,
  },
  header: {
    marginBottom: 18,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "900",
    marginTop: 18,
  },
  subtitle: {
    color: "#CBD5E1",
    marginTop: 8,
    lineHeight: 22,
    fontWeight: "700",
  },
  boardButton: {
    backgroundColor: "#22C55E",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 16,
  },
  boardButtonText: {
    color: "#052E16",
    fontWeight: "900",
  },
  manageButton: {
    backgroundColor: "#22C55E",
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 16,
  },
  manageButtonText: {
    color: "#052E16",
    fontWeight: "900",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  farmName: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "900",
  },
  orderText: {
    color: "#64748B",
    fontWeight: "800",
    marginTop: 4,
  },
  statusBadge: {
    backgroundColor: "#DBEAFE",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  completedBadge: {
    backgroundColor: "#DCFCE7",
  },
  cancelledBadge: {
    backgroundColor: "#FEE2E2",
  },
  statusText: {
    color: "#1D4ED8",
    fontWeight: "900",
    fontSize: 12,
  },
  sectionLabel: {
    color: "#64748B",
    fontWeight: "900",
    marginTop: 12,
    marginBottom: 4,
  },
  addressText: {
    color: "#111827",
    fontWeight: "800",
    lineHeight: 20,
  },
  notesText: {
    color: "#334155",
    fontWeight: "700",
    marginTop: 12,
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
  primaryButton: {
    backgroundColor: "#15803D",
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 18,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 16,
  },
  cancelButton: {
    backgroundColor: "#FEE2E2",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 10,
  },
  cancelButtonText: {
    color: "#991B1B",
    fontWeight: "900",
  },
  disabled: {
    opacity: 0.6,
  },
  emptyBox: {
    backgroundColor: "#1E293B",
    borderRadius: 22,
    padding: 22,
    alignItems: "center",
    marginTop: 30,
  },
  emptyIcon: {
    fontSize: 42,
    marginBottom: 8,
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