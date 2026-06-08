// app/driver/my-deliveries.tsx

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

import { API_BASE_URL } from "../config/api";
import { enforceSubscriptionAccess } from "../services/lockoutGuard";
import { supabase } from "../data/supabaseClient";

type DeliveryStatus =
  | "available"
  | "accepted"
  | "arrived_pickup"
  | "picked_up"
  | "in_transit"
  | "arrived_dropoff"
  | "delivered"
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
  delivery_fee?: number;
  miles?: number;
  pickup_notes?: string;
  delivery_notes?: string;
  status?: DeliveryStatus | string;
  visibility?: string;
  source?: string;
  assigned_driver_id?: string;
  assigned_driver_name?: string;
  driver_id?: string;
  driver_name?: string;
  accepted_at?: string;
  arrived_pickup_at?: string;
  picked_up_at?: string;
  arrived_dropoff_at?: string;
  delivered_at?: string;
  proof_of_pickup_url?: string;
  proof_of_delivery_url?: string;
  created_at?: string;
  updated_at?: string;
};

type DriverProfile = {
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
};

const COLORS = {
  bg: "#0F172A",
  card: "#FFFFFF",
  panel: "#1E293B",
  border: "#334155",
  text: "#111827",
  muted: "#64748B",
  lightText: "#CBD5E1",
  white: "#FFFFFF",
  green: "#22C55E",
  greenDark: "#15803D",
  blue: "#2563EB",
  redSoft: "#FEE2E2",
  redText: "#991B1B",
  dark: "#111827",
  greenSoft: "#DCFCE7",
  blueSoft: "#DBEAFE",
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

  const payoutTotals = useMemo(() => {
    const active = jobs.filter(
      (job) => job.status !== "cancelled" && job.status !== "completed" && job.status !== "delivered"
    );

    const completed = jobs.filter(
      (job) => job.status === "completed" || job.status === "delivered"
    );

    return {
      activeCount: active.length,
      completedCount: completed.length,
      totalPayout: jobs.reduce(
        (sum, job) => sum + Number(job.payout_amount || job.delivery_fee || 0),
        0
      ),
      completedPayout: completed.reduce(
        (sum, job) => sum + Number(job.payout_amount || job.delivery_fee || 0),
        0
      ),
    };
  }, [jobs]);

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

    try {
      const access = await enforceSubscriptionAccess({
        role: "driver",
        userId: currentDriver.id || "",
        email: currentDriver.email || "",
        redirectTo: "/subscription/subscription-locked",
      });

      setAccessAllowed(access.allowed);
      return access.allowed;
    } catch (error) {
      console.log("Driver access check error:", error);
      setAccessAllowed(true);
      return true;
    }
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

  function mapSupabaseDelivery(row: any): DeliveryJob {
    return {
      id: String(row.id),
      order_id: row.order_id || "",
      farmer_id: row.farmer_id || "",
      customer_id: row.customer_id || "",
      farm_name: row.farm_name || row.farmer_name || "Farm Delivery",
      customer_name: row.customer_name || "",
      customer_phone: row.customer_phone || "",
      pickup_address: row.pickup_address || "",
      dropoff_address: row.dropoff_address || "",
      delivery_window: row.delivery_window || "",
      payout_amount: Number(row.payout_amount || row.delivery_fee || 0),
      delivery_fee: Number(row.delivery_fee || row.payout_amount || 0),
      miles: Number(row.miles || 0),
      pickup_notes: row.pickup_notes || "",
      delivery_notes: row.delivery_notes || "",
      status: row.status || "accepted",
      source: row.source || "delivery_orders",
      assigned_driver_id: row.assigned_driver_id || row.driver_id || "",
      assigned_driver_name: row.assigned_driver_name || row.driver_name || "",
      driver_id: row.driver_id || row.assigned_driver_id || "",
      driver_name: row.driver_name || row.assigned_driver_name || "",
      accepted_at: row.accepted_at || row.assigned_at || "",
      arrived_pickup_at: row.arrived_pickup_at || "",
      picked_up_at: row.picked_up_at || "",
      arrived_dropoff_at: row.arrived_dropoff_at || "",
      delivered_at: row.delivered_at || "",
      proof_of_pickup_url: row.proof_of_pickup_url || "",
      proof_of_delivery_url: row.proof_of_delivery_url || "",
      created_at: row.created_at || "",
      updated_at: row.updated_at || "",
    };
  }

  async function loadAssignedJobs(driverId?: string) {
    try {
      const activeDriverId = driverId || driver?.id;

      if (!activeDriverId) return;

      setRefreshing(true);

      let loadedJobs: DeliveryJob[] = [];

      try {
        const response = await fetch(
          `${API_BASE_URL}/driver/assigned-jobs/${activeDriverId}`
        );

        const data = await response.json();

        if (response.ok && data.success) {
          loadedJobs = data.jobs || [];
        }
      } catch (apiError) {
        console.log("Assigned jobs API fallback to Supabase:", apiError);
      }

      if (loadedJobs.length === 0) {
        const { data, error } = await supabase
          .from("delivery_orders")
          .select("*")
          .or(`driver_id.eq.${activeDriverId},assigned_driver_id.eq.${activeDriverId}`)
          .order("created_at", { ascending: false });

        if (error) {
          console.log("Supabase delivery_orders load error:", error.message);
        }

        loadedJobs = Array.isArray(data) ? data.map(mapSupabaseDelivery) : [];
      }

      setJobs(loadedJobs);
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

      let apiUpdated = false;

      try {
        const response = await fetch(
          `${API_BASE_URL}/driver/update-delivery-status`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              deliveryJobId: job.id,
              driverId: driver.id,
              status,
            }),
          }
        );

        const data = await response.json();

        if (response.ok && data.success) {
          apiUpdated = true;
        }
      } catch (apiError) {
        console.log("Update status API fallback to Supabase:", apiError);
      }

      if (!apiUpdated) {
        const timestampField =
          status === "arrived_pickup"
            ? "arrived_pickup_at"
            : status === "picked_up"
            ? "picked_up_at"
            : status === "arrived_dropoff"
            ? "arrived_dropoff_at"
            : status === "delivered" || status === "completed"
            ? "delivered_at"
            : status === "accepted"
            ? "accepted_at"
            : "";

        const payload: any = {
          status,
          updated_at: new Date().toISOString(),
        };

        if (timestampField) {
          payload[timestampField] = new Date().toISOString();
        }

        const { error } = await supabase
          .from("delivery_orders")
          .update(payload)
          .eq("id", job.id);

        if (error) {
          throw error;
        }
      }

      Alert.alert("Delivery Updated", "Delivery status updated.");

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
      params: {
        loadId: job.id,
        deliveryJobId: job.id,
      },
    });
  }

  function openProofOfDelivery(job: DeliveryJob) {
    router.push({
      pathname: "/driver/proof-of-delivery" as any,
      params: {
        loadId: job.id,
        deliveryJobId: job.id,
      },
    });
  }

  function openLiveNavigation(job: DeliveryJob) {
    router.push({
      pathname: "/driver/live-location-provider" as any,
      params: {
        loadId: job.id,
        deliveryJobId: job.id,
      },
    });
  }

  function openChat(job: DeliveryJob) {
    router.push({
      pathname: "/driver/customer-chat" as any,
      params: {
        orderId: job.order_id || job.id,
        deliveryJobId: job.id,
        farmerId: job.farmer_id || "",
        customerId: job.customer_id || "",
      },
    });
  }

  function getStatusLabel(status?: string) {
    switch (status) {
      case "available":
        return "Available";
      case "accepted":
        return "Accepted";
      case "arrived_pickup":
        return "Arrived Pickup";
      case "picked_up":
        return "Picked Up";
      case "in_transit":
        return "In Transit";
      case "arrived_dropoff":
        return "Arrived Dropoff";
      case "delivered":
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
          label: "Start Transit",
          status: "in_transit" as DeliveryStatus,
        };

      case "in_transit":
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
    const completed = item.status === "completed" || item.status === "delivered";
    const cancelled = item.status === "cancelled";

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
              cancelled && styles.cancelledBadge,
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
              ${Number(item.payout_amount || item.delivery_fee || 0).toFixed(2)}
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

        <TouchableOpacity
          style={styles.navigationButton}
          onPress={() => openLiveNavigation(item)}
        >
          <Text style={styles.navigationButtonText}>Open Live Navigation</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.chatButton}
          onPress={() => openChat(item)}
        >
          <Text style={styles.chatButtonText}>Open Delivery Chat</Text>
        </TouchableOpacity>

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

        {!completed && !cancelled ? (
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
        <ActivityIndicator size="large" color={COLORS.green} />
        <Text style={styles.centeredText}>
          Checking driver delivery access...
        </Text>
      </View>
    );
  }

  if (!accessAllowed) {
    return (
      <View style={styles.centered}>
        <Text style={styles.lockTitle}>Driver Membership Required</Text>

        <Text style={styles.centeredText}>
          Please manage your driver membership to continue.
        </Text>

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
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshDeliveries}
          />
        }
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>My Deliveries</Text>

            <Text style={styles.subtitle}>
              Manage assigned Farm2Home deliveries, pickup milestones, delivery
              proof, and customer communication.
            </Text>

            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>
                  {payoutTotals.activeCount}
                </Text>
                <Text style={styles.summaryLabel}>Active</Text>
              </View>

              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>
                  {payoutTotals.completedCount}
                </Text>
                <Text style={styles.summaryLabel}>Completed</Text>
              </View>

              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>
                  ${payoutTotals.completedPayout.toFixed(2)}
                </Text>
                <Text style={styles.summaryLabel}>Completed Pay</Text>
              </View>
            </View>

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
  container: { flex: 1, backgroundColor: COLORS.bg },

  centered: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },

  centeredText: {
    color: COLORS.lightText,
    marginTop: 12,
    textAlign: "center",
    fontWeight: "800",
    lineHeight: 22,
  },

  lockTitle: {
    color: "#FCA5A5",
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
  },

  content: {
    padding: 16,
    paddingBottom: 110,
  },

  header: {
    marginBottom: 16,
  },

  title: {
    color: COLORS.white,
    fontSize: 28,
    fontWeight: "900",
    marginTop: 16,
  },

  subtitle: {
    color: COLORS.lightText,
    marginTop: 8,
    lineHeight: 21,
    fontWeight: "700",
    fontSize: 13,
  },

  summaryRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },

  summaryCard: {
    flex: 1,
    backgroundColor: COLORS.panel,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  summaryValue: {
    color: "#86EFAC",
    fontSize: 18,
    fontWeight: "900",
  },

  summaryLabel: {
    color: COLORS.lightText,
    fontSize: 10,
    fontWeight: "800",
    marginTop: 5,
  },

  boardButton: {
    backgroundColor: COLORS.green,
    paddingVertical: 13,
    borderRadius: 13,
    alignItems: "center",
    marginTop: 14,
  },

  boardButtonText: {
    color: "#052E16",
    fontWeight: "900",
  },

  manageButton: {
    backgroundColor: COLORS.green,
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 13,
    alignItems: "center",
    marginTop: 16,
  },

  manageButtonText: {
    color: "#052E16",
    fontWeight: "900",
  },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 15,
    marginBottom: 13,
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 10,
  },

  farmName: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900",
  },

  orderText: {
    color: COLORS.muted,
    fontWeight: "800",
    marginTop: 3,
    fontSize: 12,
  },

  statusBadge: {
    backgroundColor: COLORS.blueSoft,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
  },

  completedBadge: {
    backgroundColor: COLORS.greenSoft,
  },

  cancelledBadge: {
    backgroundColor: COLORS.redSoft,
  },

  statusText: {
    color: "#1D4ED8",
    fontWeight: "900",
    fontSize: 11,
  },

  sectionLabel: {
    color: COLORS.muted,
    fontWeight: "900",
    marginTop: 10,
    marginBottom: 3,
    fontSize: 12,
  },

  addressText: {
    color: COLORS.text,
    fontWeight: "800",
    lineHeight: 19,
    fontSize: 13,
  },

  notesText: {
    color: "#334155",
    fontWeight: "700",
    marginTop: 10,
    lineHeight: 19,
    fontSize: 12,
  },

  metaRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 13,
  },

  metaBox: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    borderRadius: 13,
    padding: 12,
  },

  metaLabel: {
    color: COLORS.muted,
    fontWeight: "900",
    fontSize: 11,
  },

  metaValue: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 17,
    marginTop: 3,
  },

  navigationButton: {
    backgroundColor: COLORS.blue,
    paddingVertical: 13,
    borderRadius: 13,
    alignItems: "center",
    marginTop: 14,
  },

  navigationButtonText: {
    color: COLORS.white,
    fontWeight: "900",
  },

  chatButton: {
    backgroundColor: COLORS.dark,
    paddingVertical: 13,
    borderRadius: 13,
    alignItems: "center",
    marginTop: 9,
  },

  chatButtonText: {
    color: COLORS.white,
    fontWeight: "900",
  },

  primaryButton: {
    backgroundColor: COLORS.greenDark,
    paddingVertical: 14,
    borderRadius: 13,
    alignItems: "center",
    marginTop: 9,
  },

  primaryButtonText: {
    color: COLORS.white,
    fontWeight: "900",
    fontSize: 15,
  },

  cancelButton: {
    backgroundColor: COLORS.redSoft,
    paddingVertical: 13,
    borderRadius: 13,
    alignItems: "center",
    marginTop: 9,
  },

  cancelButtonText: {
    color: COLORS.redText,
    fontWeight: "900",
  },

  disabled: {
    opacity: 0.6,
  },

  emptyBox: {
    backgroundColor: COLORS.panel,
    borderRadius: 16,
    padding: 22,
    alignItems: "center",
    marginTop: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  emptyTitle: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: "900",
  },

  emptyText: {
    color: COLORS.lightText,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 21,
    fontWeight: "700",
    fontSize: 13,
  },
});