// app/customer/order-tracking.tsx

import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { supabase } from "../data/supabaseClient";

const COLORS = {
  bg: "#F8FAF5",
  card: "#FFFFFF",
  text: "#172017",
  muted: "#64748B",
  border: "#E3E8DD",
  primary: "#2E7D32",
  primaryDark: "#14532D",
  soft: "#EEF5EA",
  dark: "#111827",
  blue: "#2563EB",
};

type DriverLocation = {
  id?: string;
  load_id?: string;
  order_id?: string;
  delivery_order_id?: string;
  driver_id?: string;
  latitude?: number;
  longitude?: number;
  speed?: number | null;
  heading?: number | null;
  accuracy?: number | null;
  status?: string;
  updated_at?: string;
};

type DeliveryOrder = {
  id: string;
  order_id?: string;
  farmer_id?: string;
  customer_id?: string;
  driver_id?: string;
  driver_name?: string;
  driver_email?: string;
  customer_name?: string;
  customer_phone?: string;
  pickup_address?: string;
  dropoff_address?: string;
  miles?: number;
  delivery_fee?: number;
  status?: string;
  source?: string;
  assigned_at?: string;
  accepted_at?: string;
  arrived_pickup_at?: string;
  picked_up_at?: string;
  in_transit_at?: string;
  arrived_dropoff_at?: string;
  delivered_at?: string;
  proof_of_pickup_url?: string;
  proof_of_delivery_url?: string;
  created_at?: string;
  updated_at?: string;
};

const TRACKING_STEPS = [
  {
    keys: ["available", "assigned", "accepted", "ready"],
    label: "Assigned",
    description: "A driver has been assigned or is preparing for pickup.",
  },
  {
    keys: ["arrived_pickup", "arrived_at_pickup"],
    label: "At Pickup",
    description: "The driver has arrived at the farm pickup location.",
  },
  {
    keys: ["picked_up"],
    label: "Picked Up",
    description: "Your order has been picked up from the farm.",
  },
  {
    keys: ["in_transit", "en_route_to_dropoff"],
    label: "In Transit",
    description: "The driver is on the way to the delivery address.",
  },
  {
    keys: ["arrived_dropoff", "arrived_at_dropoff"],
    label: "Arrived",
    description: "The driver has arrived at the dropoff location.",
  },
  {
    keys: ["delivered", "completed"],
    label: "Delivered",
    description: "Delivery has been completed.",
  },
];

function firstParam(value: any) {
  if (Array.isArray(value)) return value[0] || "";
  return value ? String(value) : "";
}

function normalizeStatus(status?: string) {
  const value = String(status || "").trim().replace(/-/g, "_").toLowerCase();

  if (value === "ready") return "accepted";
  if (value === "en_route_to_pickup") return "accepted";
  if (value === "arrived_at_pickup") return "arrived_pickup";
  if (value === "en_route_to_dropoff") return "in_transit";
  if (value === "arrived_at_dropoff") return "arrived_dropoff";

  return value || "assigned";
}

function friendlyStatus(status?: string) {
  switch (normalizeStatus(status)) {
    case "available":
      return "Waiting for Driver";
    case "assigned":
      return "Driver Assigned";
    case "accepted":
      return "Driver Preparing";
    case "arrived_pickup":
      return "Driver at Farm";
    case "picked_up":
      return "Order Picked Up";
    case "in_transit":
      return "Out for Delivery";
    case "arrived_dropoff":
      return "Driver Arrived";
    case "delivered":
    case "completed":
      return "Delivered";
    case "cancelled":
      return "Cancelled";
    default:
      return "Tracking Pending";
  }
}

function estimateEta(status?: string) {
  switch (normalizeStatus(status)) {
    case "available":
    case "assigned":
    case "accepted":
      return "Preparing route";
    case "arrived_pickup":
      return "At pickup location";
    case "picked_up":
      return "Leaving pickup";
    case "in_transit":
      return "Estimated 15–35 minutes";
    case "arrived_dropoff":
      return "Arriving now";
    case "delivered":
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    default:
      return "Waiting for update";
  }
}

function getStepIndex(status?: string) {
  const normalized = normalizeStatus(status);

  const index = TRACKING_STEPS.findIndex((step) =>
    step.keys.includes(normalized)
  );

  return index < 0 ? 0 : index;
}

function formatDate(value?: string) {
  if (!value) return "No update yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No update yet";
  return date.toLocaleString();
}

export default function CustomerOrderTracking() {
  const params = useLocalSearchParams();

  const orderId = firstParam(params.orderId);
  const loadId = firstParam(params.loadId);
  const deliveryOrderId = firstParam(params.deliveryOrderId || params.deliveryJobId);

  const [loading, setLoading] = useState(true);
  const [delivery, setDelivery] = useState<DeliveryOrder | null>(null);
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);

  const activeStatus = useMemo(() => {
    return normalizeStatus(driverLocation?.status || delivery?.status || "");
  }, [driverLocation, delivery]);

  const currentStepIndex = getStepIndex(activeStatus);
  const progress = Math.round(((currentStepIndex + 1) / TRACKING_STEPS.length) * 100);

  useEffect(() => {
    loadTracking();

    const channelKey = deliveryOrderId || loadId || orderId || `tracking-${Date.now()}`;

    const deliveryChannel = supabase
      .channel(`customer-delivery-${channelKey}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "delivery_orders",
        },
        (payload) => {
          const row: any = payload.new;
          if (!row) return;

          const matches =
            (deliveryOrderId && String(row.id) === String(deliveryOrderId)) ||
            (orderId && String(row.order_id) === String(orderId)) ||
            (loadId && String(row.id) === String(loadId));

          if (matches) {
            setDelivery(mapDelivery(row));
          }
        }
      )
      .subscribe();

    const locationChannel = supabase
      .channel(`customer-location-${channelKey}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "driver_locations",
        },
        (payload) => {
          const row: any = payload.new;
          if (!row) return;

          const matches =
            (loadId && String(row.load_id) === String(loadId)) ||
            (orderId && String(row.order_id) === String(orderId)) ||
            (deliveryOrderId && String(row.delivery_order_id) === String(deliveryOrderId)) ||
            (delivery?.driver_id && String(row.driver_id) === String(delivery.driver_id));

          if (matches) {
            setDriverLocation(mapLocation(row));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(deliveryChannel);
      supabase.removeChannel(locationChannel);
    };
  }, [orderId, loadId, deliveryOrderId, delivery?.driver_id]);

  function mapDelivery(row: any): DeliveryOrder {
    return {
      id: String(row.id || ""),
      order_id: row.order_id || "",
      farmer_id: row.farmer_id || "",
      customer_id: row.customer_id || "",
      driver_id: row.driver_id || row.assigned_driver_id || "",
      driver_name: row.driver_name || row.assigned_driver_name || "",
      driver_email: row.driver_email || "",
      customer_name: row.customer_name || "",
      customer_phone: row.customer_phone || "",
      pickup_address: row.pickup_address || "",
      dropoff_address: row.dropoff_address || "",
      miles: Number(row.miles || 0),
      delivery_fee: Number(row.delivery_fee || row.payout_amount || 0),
      status: normalizeStatus(row.status || ""),
      source: row.source || "",
      assigned_at: row.assigned_at || "",
      accepted_at: row.accepted_at || row.assigned_at || "",
      arrived_pickup_at: row.arrived_pickup_at || "",
      picked_up_at: row.picked_up_at || "",
      in_transit_at: row.in_transit_at || "",
      arrived_dropoff_at: row.arrived_dropoff_at || "",
      delivered_at: row.delivered_at || "",
      proof_of_pickup_url: row.proof_of_pickup_url || "",
      proof_of_delivery_url: row.proof_of_delivery_url || "",
      created_at: row.created_at || "",
      updated_at: row.updated_at || "",
    };
  }

  function mapLocation(row: any): DriverLocation {
    return {
      id: row.id || "",
      load_id: row.load_id || "",
      order_id: row.order_id || "",
      delivery_order_id: row.delivery_order_id || "",
      driver_id: row.driver_id || row.carrier_id || "",
      latitude: Number(row.latitude || 0),
      longitude: Number(row.longitude || 0),
      speed: row.speed !== null && row.speed !== undefined ? Number(row.speed) : null,
      heading: row.heading !== null && row.heading !== undefined ? Number(row.heading) : null,
      accuracy:
        row.accuracy !== null && row.accuracy !== undefined ? Number(row.accuracy) : null,
      status: normalizeStatus(row.status || ""),
      updated_at: row.updated_at || "",
    };
  }

  async function loadTracking() {
    try {
      setLoading(true);

      const loadedDelivery = await loadDeliveryOrder();
      await loadDriverLocation(loadedDelivery);
    } catch (error: any) {
      Alert.alert("Tracking Error", error?.message || "Unable to load tracking.");
    } finally {
      setLoading(false);
    }
  }

  async function loadDeliveryOrder() {
    let query = supabase.from("delivery_orders").select("*");

    if (deliveryOrderId) {
      query = query.eq("id", deliveryOrderId);
    } else if (orderId) {
      query = query.eq("order_id", orderId);
    } else if (loadId) {
      query = query.eq("id", loadId);
    } else {
      setDelivery(null);
      return null;
    }

    const { data, error } = await query
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      console.log("Delivery order tracking error:", error.message);
      return null;
    }

    if (Array.isArray(data) && data[0]) {
      const mapped = mapDelivery(data[0]);
      setDelivery(mapped);
      return mapped;
    }

    return null;
  }

  async function loadDriverLocation(activeDelivery?: DeliveryOrder | null) {
    let locationData: any[] | null = null;

    if (deliveryOrderId || activeDelivery?.id) {
      const { data } = await supabase
        .from("driver_locations")
        .select("*")
        .eq("delivery_order_id", deliveryOrderId || activeDelivery?.id)
        .order("updated_at", { ascending: false })
        .limit(1);

      locationData = data;
    }

    if ((!locationData || locationData.length === 0) && orderId) {
      const { data } = await supabase
        .from("driver_locations")
        .select("*")
        .eq("order_id", orderId)
        .order("updated_at", { ascending: false })
        .limit(1);

      locationData = data;
    }

    if ((!locationData || locationData.length === 0) && loadId) {
      const { data } = await supabase
        .from("driver_locations")
        .select("*")
        .eq("load_id", loadId)
        .order("updated_at", { ascending: false })
        .limit(1);

      locationData = data;
    }

    const driverId = activeDelivery?.driver_id || delivery?.driver_id;

    if ((!locationData || locationData.length === 0) && driverId) {
      const { data } = await supabase
        .from("driver_locations")
        .select("*")
        .eq("driver_id", driverId)
        .order("updated_at", { ascending: false })
        .limit(1);

      locationData = data;
    }

    if (Array.isArray(locationData) && locationData[0]) {
      setDriverLocation(mapLocation(locationData[0]));
    }
  }

  function openMap() {
    if (!driverLocation?.latitude || !driverLocation?.longitude) {
      Alert.alert("Location Not Available", "Driver GPS is not available yet.");
      return;
    }

    const lat = driverLocation.latitude;
    const lng = driverLocation.longitude;

    const url =
      Platform.OS === "ios"
        ? `http://maps.apple.com/?ll=${lat},${lng}`
        : `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

    Linking.openURL(url);
  }

  function openChat() {
    router.push({
      pathname: "/chat/chat-center",
      params: {
        conversationId: delivery?.id
          ? `delivery_${delivery.id}`
          : orderId
          ? `order_${orderId}`
          : "support",
        orderId: delivery?.order_id || orderId,
        deliveryOrderId: delivery?.id || deliveryOrderId,
        driverId: delivery?.driver_id || driverLocation?.driver_id || "",
        role: "customer",
      },
    } as any);
  }

  function openProof(url?: string) {
    if (!url) {
      Alert.alert("Proof Not Available", "Proof image is not available yet.");
      return;
    }

    Linking.openURL(url);
  }

  function stepCompleted(index: number) {
    return index <= currentStepIndex;
  }

  return (
    <View style={styles.page}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.topBar}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.push("/customer/orders" as any)}
          >
            <Text style={styles.backText}>‹</Text>
          </Pressable>

          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Order Tracking</Text>
            <Text style={styles.subtitle}>Live delivery status and driver updates</Text>
          </View>
        </View>

        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Current Status</Text>
              <Text style={styles.statusTitle}>{friendlyStatus(activeStatus)}</Text>
              <Text style={styles.statusSub}>ETA: {estimateEta(activeStatus)}</Text>
            </View>

            <View style={styles.progressCircle}>
              <Text style={styles.progressText}>{progress}%</Text>
            </View>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Delivery Details</Text>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>Loading tracking details...</Text>
            </View>
          ) : (
            <>
              <InfoRow label="Order ID" value={delivery?.order_id || orderId || "Not provided"} />
              <InfoRow label="Delivery ID" value={delivery?.id || deliveryOrderId || "Pending"} />
              <InfoRow label="Driver" value={delivery?.driver_name || "Not assigned yet"} />
              <InfoRow label="Pickup" value={delivery?.pickup_address || "Pickup location pending"} />
              <InfoRow label="Dropoff" value={delivery?.dropoff_address || "Dropoff location pending"} />
              <InfoRow label="Miles" value={`${Number(delivery?.miles || 0).toFixed(1)} miles`} />
              <InfoRow label="Delivery Fee" value={`$${Number(delivery?.delivery_fee || 0).toFixed(2)}`} />
              <InfoRow
                label="Last Update"
                value={
                  driverLocation?.updated_at
                    ? formatDate(driverLocation.updated_at)
                    : delivery?.updated_at
                    ? formatDate(delivery.updated_at)
                    : "No update yet"
                }
              />
            </>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Driver Location</Text>

          {driverLocation?.latitude && driverLocation?.longitude ? (
            <>
              <View style={styles.locationBox}>
                <Text style={styles.locationTitle}>GPS Connected</Text>
                <Text style={styles.locationText}>
                  {driverLocation.latitude.toFixed(5)}, {driverLocation.longitude.toFixed(5)}
                </Text>
                <Text style={styles.locationSub}>
                  Driver GPS updates when location sharing is active.
                </Text>
              </View>

              <Pressable style={styles.primaryButton} onPress={openMap}>
                <Text style={styles.primaryButtonText}>Open Map</Text>
              </Pressable>
            </>
          ) : (
            <View style={styles.locationBox}>
              <Text style={styles.locationTitle}>Waiting for GPS</Text>
              <Text style={styles.locationSub}>
                Location appears once the driver starts live tracking.
              </Text>
            </View>
          )}

          <Pressable style={styles.secondaryButton} onPress={loadTracking}>
            <Text style={styles.secondaryButtonText}>Refresh Tracking</Text>
          </Pressable>

          <Pressable style={styles.darkButton} onPress={openChat}>
            <Text style={styles.darkButtonText}>Message Support</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Proofs</Text>

          <Pressable
            style={styles.proofButton}
            onPress={() => openProof(delivery?.proof_of_pickup_url)}
          >
            <Text style={styles.proofButtonText}>View Proof of Pickup</Text>
          </Pressable>

          <Pressable
            style={styles.proofButton}
            onPress={() => openProof(delivery?.proof_of_delivery_url)}
          >
            <Text style={styles.proofButtonText}>View Proof of Delivery</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Delivery Timeline</Text>

          {TRACKING_STEPS.map((step, index) => {
            const complete = stepCompleted(index);
            const active = index === currentStepIndex;

            return (
              <View key={step.label} style={styles.timelineRow}>
                <View style={styles.timelineLeft}>
                  <View
                    style={[
                      styles.timelineDot,
                      complete && styles.timelineDotComplete,
                      active && styles.timelineDotActive,
                    ]}
                  >
                    <Text style={styles.timelineDotText}>{index + 1}</Text>
                  </View>

                  {index < TRACKING_STEPS.length - 1 && (
                    <View
                      style={[
                        styles.timelineLine,
                        complete && styles.timelineLineComplete,
                      ]}
                    />
                  )}
                </View>

                <View style={styles.timelineContent}>
                  <Text
                    style={[
                      styles.timelineTitle,
                      complete && styles.timelineTitleComplete,
                      active && styles.timelineTitleActive,
                    ]}
                  >
                    {step.label}
                  </Text>
                  <Text style={styles.timelineDescription}>{step.description}</Text>
                </View>
              </View>
            );
          })}
        </View>

        <Pressable
          style={styles.outlineButton}
          onPress={() => router.push("/customer/orders" as any)}
        >
          <Text style={styles.outlineButtonText}>Back to Orders</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 16, paddingBottom: 44 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  backText: {
    fontSize: 28,
    fontWeight: "900",
    color: COLORS.text,
    marginTop: -4,
  },
  title: { color: COLORS.text, fontSize: 24, fontWeight: "900" },
  subtitle: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  statusCard: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  statusHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  label: {
    color: "#BBF7D0",
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 5,
  },
  statusTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
  },
  statusSub: {
    color: "#DCFCE7",
    fontWeight: "800",
    marginTop: 5,
  },
  progressCircle: {
    width: 62,
    height: 62,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  progressText: { color: "#FFFFFF", fontWeight: "900", fontSize: 17 },
  progressTrack: {
    height: 10,
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 999,
    overflow: "hidden",
    marginTop: 16,
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#FFFFFF",
  },
  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  cardTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 18,
    marginBottom: 10,
  },
  loadingBox: {
    alignItems: "center",
    padding: 18,
  },
  loadingText: {
    marginTop: 10,
    color: COLORS.primary,
    fontWeight: "800",
  },
  infoRow: {
    backgroundColor: COLORS.soft,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  infoLabel: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 4,
  },
  infoValue: {
    color: COLORS.text,
    fontWeight: "800",
    lineHeight: 19,
  },
  locationBox: {
    backgroundColor: COLORS.soft,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  locationTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 16,
  },
  locationText: {
    color: COLORS.primaryDark,
    fontWeight: "900",
    marginTop: 6,
  },
  locationSub: {
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 19,
    marginTop: 5,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    marginBottom: 8,
  },
  primaryButtonText: { color: "#FFFFFF", fontWeight: "900" },
  secondaryButton: {
    backgroundColor: COLORS.blue,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    marginBottom: 8,
  },
  secondaryButtonText: { color: "#FFFFFF", fontWeight: "900" },
  darkButton: {
    backgroundColor: COLORS.dark,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  darkButtonText: { color: "#FFFFFF", fontWeight: "900" },
  proofButton: {
    backgroundColor: COLORS.soft,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    marginBottom: 8,
  },
  proofButtonText: {
    color: COLORS.primary,
    fontWeight: "900",
  },
  timelineRow: {
    flexDirection: "row",
    minHeight: 68,
  },
  timelineLeft: {
    width: 34,
    alignItems: "center",
  },
  timelineDot: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },
  timelineDotComplete: {
    backgroundColor: COLORS.primary,
  },
  timelineDotActive: {
    backgroundColor: COLORS.blue,
  },
  timelineDotText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 12,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 5,
    borderRadius: 999,
  },
  timelineLineComplete: {
    backgroundColor: COLORS.primary,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 12,
  },
  timelineTitle: {
    color: COLORS.muted,
    fontWeight: "900",
    fontSize: 15,
  },
  timelineTitleComplete: {
    color: COLORS.text,
  },
  timelineTitleActive: {
    color: COLORS.blue,
  },
  timelineDescription: {
    color: COLORS.muted,
    fontWeight: "700",
    lineHeight: 18,
    fontSize: 12,
    marginTop: 3,
  },
  outlineButton: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  outlineButtonText: {
    color: COLORS.primary,
    fontWeight: "900",
  },
});