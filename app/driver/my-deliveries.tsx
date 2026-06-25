// app/driver/my-deliveries.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { getBackendUrl } from "../services/apiConfig";
import { supabase } from "../services/supabaseClient";

const COLORS = {
  bg: "#F6F7FB",
  card: "#FFFFFF",
  surface: "#F8FAFC",
  surface2: "#EEF2FF",
  text: "#101828",
  muted: "#667085",
  border: "#E5E7EB",
  primary: "#635BFF",
  primaryDark: "#4F46E5",
  primarySoft: "#EEF2FF",
  red: "#E1122D",
  redDark: "#B80F25",
  redSoft: "#FFE6EA",
  green: "#10B981",
  greenDark: "#047857",
  greenSoft: "#D1FAE5",
  blue: "#2563EB",
  blueSoft: "#DBEAFE",
  amber: "#F59E0B",
  amberSoft: "#FEF3C7",
  purple: "#7C3AED",
  purpleSoft: "#F3E8FF",
  navy: "#020617",
  navyCard: "#111827",
  white: "#FFFFFF",
};

type DeliveryKind = "customer_order" | "freight_load" | "delivery_order";

type DeliveryStatus =
  | "accepted"
  | "booked"
  | "ready"
  | "arrived_pickup"
  | "picked_up"
  | "in_transit"
  | "arrived_dropoff"
  | "delivered"
  | "completed"
  | "cancelled"
  | "canceled";

type DriverDelivery = {
  id: string;
  kind: DeliveryKind;
  status: DeliveryStatus;
  title: string;
  customerName?: string;
  customerPhone?: string;
  farmerName?: string;
  freightCarrierName?: string;
  pickupName?: string;
  pickupAddress?: string;
  pickupCity?: string;
  pickupState?: string;
  dropoffName?: string;
  dropoffAddress?: string;
  dropoffCity?: string;
  dropoffState?: string;
  distanceMiles?: number;
  payout?: number;
  orderTotal?: number;
  itemCount?: number;
  coldChain?: boolean;
  batchId?: string;
  sourceId?: string;
  createdAt?: string;
  updatedAt?: string;
  notes?: string;
  raw?: any;
};

type DriverSession = {
  id: string;
  driverId?: string;
  driver_id?: string;
  fullName?: string;
  full_name?: string;
  name?: string;
  username?: string;
  email?: string;
  role?: string;
};

const STATUS_LABELS: Record<string, string> = {
  accepted: "Accepted",
  booked: "Booked",
  ready: "Ready",
  arrived_pickup: "Arrived Pickup",
  picked_up: "Picked Up",
  in_transit: "In Transit",
  arrived_dropoff: "Arrived Dropoff",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
  canceled: "Canceled",
};

const STATUS_FLOW: DeliveryStatus[] = [
  "accepted",
  "arrived_pickup",
  "picked_up",
  "in_transit",
  "arrived_dropoff",
  "delivered",
];

const FILTERS = [
  { key: "active", label: "Active", icon: "navigate-outline" },
  { key: "customer", label: "Customer", icon: "bag-handle-outline" },
  { key: "freight", label: "Freight", icon: "cube-outline" },
  { key: "completed", label: "Completed", icon: "checkmark-circle-outline" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

function clean(value: any) {
  return String(value ?? "").trim();
}

function normalize(value: any) {
  return clean(value).toLowerCase();
}

function money(value?: number) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function miles(value?: number) {
  if (value === undefined || value === null || Number.isNaN(Number(value))) return "Miles pending";
  return `${Number(value).toFixed(1)} mi`;
}

function formatDate(value?: string) {
  if (!value) return "Pending";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Pending";
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function normalizeStatus(value: any): DeliveryStatus {
  const status = normalize(value || "accepted").replace(/-/g, "_");

  if (status === "booked") return "booked";
  if (status === "ready") return "ready";
  if (status === "arrived_pickup") return "arrived_pickup";
  if (status === "picked_up") return "picked_up";
  if (status === "in_transit") return "in_transit";
  if (status === "arrived_dropoff") return "arrived_dropoff";
  if (status === "delivered") return "delivered";
  if (status === "completed") return "completed";
  if (status === "cancelled") return "cancelled";
  if (status === "canceled") return "canceled";

  return "accepted";
}

function nextStatus(status: DeliveryStatus): DeliveryStatus | null {
  const normalized = status === "booked" || status === "ready" ? "accepted" : status;
  const index = STATUS_FLOW.indexOf(normalized);
  if (index < 0 || index >= STATUS_FLOW.length - 1) return null;
  return STATUS_FLOW[index + 1];
}

function isComplete(status: DeliveryStatus) {
  return status === "delivered" || status === "completed";
}

function isCancelled(status: DeliveryStatus) {
  return status === "cancelled" || status === "canceled";
}

function statusTone(status: DeliveryStatus) {
  if (isComplete(status)) return COLORS.green;
  if (isCancelled(status)) return COLORS.red;
  if (status === "accepted" || status === "booked" || status === "ready") return COLORS.blue;
  if (status === "arrived_pickup" || status === "arrived_dropoff") return COLORS.amber;
  return COLORS.primary;
}

function statusBg(status: DeliveryStatus) {
  if (isComplete(status)) return COLORS.greenSoft;
  if (isCancelled(status)) return COLORS.redSoft;
  if (status === "accepted" || status === "booked" || status === "ready") return COLORS.blueSoft;
  if (status === "arrived_pickup" || status === "arrived_dropoff") return COLORS.amberSoft;
  return COLORS.primarySoft;
}

function getPayout(row: any) {
  return Number(
    row?.payout ??
      row?.driver_payout ??
      row?.payout_amount ??
      row?.rate ??
      row?.load_rate ??
      row?.delivery_fee ??
      row?.freight_total ??
      0
  );
}

function getMiles(row: any) {
  return Number(row?.distanceMiles ?? row?.distance_miles ?? row?.miles ?? row?.estimated_miles ?? 0);
}

function normalizeDelivery(row: any): DriverDelivery {
  const kind: DeliveryKind =
    row.kind ||
    row.delivery_kind ||
    row.type ||
    (row.source === "freight_load" || row.freight_load_id || row.freightCarrierName
      ? "freight_load"
      : row.order_id || row.delivery_order_id
        ? "delivery_order"
        : "customer_order");

  const status = normalizeStatus(row.status || row.delivery_status || row.load_status || row.fulfillmentStatus);

  const pickupAddress =
    row.pickupAddress ||
    row.pickup_address ||
    row.origin_address ||
    row.farm_address ||
    row.pickup?.address ||
    "";

  const dropoffAddress =
    row.dropoffAddress ||
    row.dropoff_address ||
    row.destination_address ||
    row.customer_address ||
    row.delivery_address ||
    row.dropoff?.address ||
    "";

  return {
    id: String(row.id || row.order_id || row.load_id || row.delivery_id),
    kind,
    status,
    title:
      row.title ||
      row.order_title ||
      row.load_title ||
      row.product_name ||
      row.farm_name ||
      (kind === "freight_load" ? "Farm Freight Load" : "Farm2Home Delivery"),
    customerName: row.customerName || row.customer_name || row.customer?.name || "Farm2Home Customer",
    customerPhone: row.customerPhone || row.customer_phone || row.customer?.phone || "",
    farmerName: row.farmerName || row.farmer_name || row.farmer?.business_name || row.farm_name || "",
    freightCarrierName:
      row.freightCarrierName ||
      row.freight_carrier_name ||
      row.carrier_name ||
      row.freight_user?.business_name ||
      "",
    pickupName:
      row.pickupName ||
      row.pickup_name ||
      row.farm_name ||
      row.origin_name ||
      row.pickup?.name ||
      "Pickup",
    pickupAddress,
    pickupCity: row.pickup_city || row.pickupCity || "",
    pickupState: row.pickup_state || row.pickupState || "",
    dropoffName:
      row.dropoffName ||
      row.dropoff_name ||
      row.destination_name ||
      row.customer_address_name ||
      row.dropoff?.name ||
      row.customer_name ||
      "Dropoff",
    dropoffAddress,
    dropoffCity: row.dropoff_city || row.dropoffCity || row.delivery_city || "",
    dropoffState: row.dropoff_state || row.dropoffState || row.delivery_state || "",
    distanceMiles: getMiles(row),
    payout: getPayout(row),
    orderTotal: Number(row.orderTotal ?? row.order_total ?? row.total ?? row.total_due ?? 0),
    itemCount: Number(row.itemCount ?? row.item_count ?? row.items?.length ?? 0),
    coldChain: Boolean(row.coldChain || row.cold_chain || row.temperature_controlled),
    batchId: row.batchId || row.batch_id || "",
    sourceId: row.order_id || row.load_id || "",
    createdAt: row.createdAt || row.created_at || "",
    updatedAt: row.updatedAt || row.updated_at || "",
    notes: row.notes || row.delivery_notes || row.special_instructions || row.pickup_notes || "",
    raw: row,
  };
}

function openMap(address?: string) {
  if (!address) {
    Alert.alert("Address missing", "This stop does not have an address yet.");
    return;
  }

  const encoded = encodeURIComponent(address);
  const url =
    Platform.OS === "ios"
      ? `http://maps.apple.com/?q=${encoded}`
      : `https://www.google.com/maps/search/?api=1&query=${encoded}`;

  Linking.openURL(url).catch(() => {
    Alert.alert("Map error", "Unable to open maps on this device.");
  });
}

function callPhone(phone?: string) {
  if (!phone) {
    Alert.alert("Phone missing", "No customer phone number is available.");
    return;
  }

  Linking.openURL(`tel:${phone}`).catch(() => {
    Alert.alert("Call error", "Unable to start the call.");
  });
}

export default function DriverMyDeliveriesScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<DriverDelivery[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<FilterKey>("active");
  const [driverName, setDriverName] = useState("Farm2Home Driver");
  const [driverId, setDriverId] = useState("");

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadDeliveries();
    }, [])
  );

  const filteredDeliveries = useMemo(() => {
    return deliveries.filter((delivery) => {
      if (filter === "freight") return delivery.kind === "freight_load" && !isComplete(delivery.status);
      if (filter === "customer") return delivery.kind !== "freight_load" && !isComplete(delivery.status);
      if (filter === "completed") return isComplete(delivery.status);
      return !isComplete(delivery.status) && !isCancelled(delivery.status);
    });
  }, [deliveries, filter]);

  const activeDeliveries = useMemo(
    () => deliveries.filter((delivery) => !isComplete(delivery.status) && !isCancelled(delivery.status)),
    [deliveries]
  );

  const currentRoute = activeDeliveries[0];

  const totals = useMemo(() => {
    const active = deliveries.filter((d) => !isComplete(d.status) && !isCancelled(d.status));
    const completed = deliveries.filter((d) => isComplete(d.status));

    return {
      active: active.length,
      completed: completed.length,
      payout: active.reduce((sum, item) => sum + Number(item.payout || 0), 0),
      completedPayout: completed.reduce((sum, item) => sum + Number(item.payout || 0), 0),
      freight: active.filter((item) => item.kind === "freight_load").length,
      customer: active.filter((item) => item.kind !== "freight_load").length,
      miles: active.reduce((sum, item) => sum + Number(item.distanceMiles || 0), 0),
    };
  }, [deliveries]);

  async function getCurrentDriver(): Promise<DriverSession | null> {
    const raw =
      (await AsyncStorage.getItem("currentDriver")) ||
      (await AsyncStorage.getItem("farm2homeCurrentDriver")) ||
      (await AsyncStorage.getItem("farm2homeDriverSession")) ||
      (await AsyncStorage.getItem("currentUser"));

    let parsed: any = null;

    if (raw) {
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = null;
      }
    }

    if (parsed?.role && parsed.role !== "driver") return null;

    const { data: authData } = await supabase.auth.getUser();
    const authUser = authData?.user;

    const authId = clean(authUser?.id || parsed?.id || parsed?.driverId || parsed?.driver_id || parsed?.authUserId);
    const authEmail = normalize(authUser?.email || parsed?.email);

    let dbDriver: any = null;

    if (authId) {
      const { data } = await supabase.from("drivers").select("*").eq("id", authId).maybeSingle();
      if (data) dbDriver = data;
    }

    if (!dbDriver && authEmail) {
      const { data } = await supabase.from("drivers").select("*").eq("email", authEmail).maybeSingle();
      if (data) dbDriver = data;
    }

    const stableId = dbDriver?.id || parsed?.id || parsed?.driverId || parsed?.driver_id || authId || "";

    if (!stableId) return null;

    const currentDriver = {
      ...(parsed || {}),
      ...(dbDriver || {}),
      id: stableId,
      driverId: stableId,
      driver_id: stableId,
      role: "driver",
      email: normalize(dbDriver?.email || parsed?.email || authEmail),
      fullName:
        dbDriver?.full_name ||
        dbDriver?.name ||
        parsed?.fullName ||
        parsed?.full_name ||
        parsed?.name ||
        "Farm2Home Driver",
      full_name:
        dbDriver?.full_name ||
        dbDriver?.name ||
        parsed?.fullName ||
        parsed?.full_name ||
        parsed?.name ||
        "Farm2Home Driver",
      name:
        dbDriver?.name ||
        dbDriver?.full_name ||
        parsed?.name ||
        parsed?.fullName ||
        "Farm2Home Driver",
      username: dbDriver?.username || parsed?.username || "",
    };

    await AsyncStorage.multiSet([
      ["currentDriver", JSON.stringify(currentDriver)],
      ["currentUser", JSON.stringify(currentDriver)],
      ["farm2homeCurrentDriver", JSON.stringify(currentDriver)],
      ["farm2homeDriverSession", JSON.stringify(currentDriver)],
      ["userRole", "driver"],
      ["currentUserRole", "driver"],
    ]);

    return currentDriver;
  }

  async function loadDeliveries() {
    try {
      const currentDriver = await getCurrentDriver();

      if (!currentDriver?.id) {
        setDeliveries([]);
        Alert.alert("Driver Login Required", "Please login as a driver.");
        router.replace("/driver/login" as any);
        return;
      }

      setDriverId(currentDriver.id);
      setDriverName(
        currentDriver.fullName ||
          currentDriver.full_name ||
          currentDriver.name ||
          currentDriver.username ||
          "Farm2Home Driver"
      );

      const rows = await loadDriverDeliveries(currentDriver.id);
      setDeliveries(rows);
    } catch (error: any) {
      console.log("Load deliveries error:", error);
      Alert.alert("Unable to load deliveries", error?.message || "Please check your connection and try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function loadDriverDeliveries(activeDriverId: string) {
    const all: DriverDelivery[] = [];

    try {
      const response = await fetch(
        `${getBackendUrl()}/driver/my-deliveries?driverId=${encodeURIComponent(activeDriverId)}`
      );

      if (response.ok) {
        const json = await response.json();
        const rows = Array.isArray(json) ? json : json.deliveries || json.data || [];
        all.push(...rows.map(normalizeDelivery));
      }
    } catch (error) {
      console.log("Backend my-deliveries skipped:", error);
    }

    try {
      const { data, error } = await supabase
        .from("delivery_orders")
        .select("*")
        .eq("driver_id", activeDriverId)
        .order("created_at", { ascending: false });

      if (error) console.log("delivery_orders skipped:", error.message);
      if (Array.isArray(data)) all.push(...data.map(normalizeDelivery));
    } catch (error) {
      console.log("delivery_orders fallback skipped:", error);
    }

    try {
      const { data, error } = await supabase
        .from("freight_loads")
        .select("*")
        .eq("assigned_driver_id", activeDriverId)
        .order("created_at", { ascending: false });

      if (error) console.log("freight_loads skipped:", error.message);
      if (Array.isArray(data)) {
        all.push(
          ...data.map((row) =>
            normalizeDelivery({
              ...row,
              kind: "freight_load",
            })
          )
        );
      }
    } catch (error) {
      console.log("freight_loads fallback skipped:", error);
    }

    return Array.from(new Map(all.map((row) => [`${row.kind}_${row.id}`, row])).values());
  }

  function refresh() {
    setRefreshing(true);
    loadDeliveries();
  }

  async function updateDeliveryStatus(delivery: DriverDelivery, status: DeliveryStatus) {
    try {
      setUpdatingId(delivery.id);

      let backendUpdated = false;

      try {
        const response = await fetch(`${getBackendUrl()}/driver/update-delivery-status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deliveryId: delivery.id,
            deliveryKind: delivery.kind,
            status,
            driverId,
          }),
        });

        backendUpdated = response.ok;
      } catch {
        backendUpdated = false;
      }

      const now = new Date().toISOString();

      if (!backendUpdated) {
        if (delivery.kind === "freight_load") {
          const { error } = await supabase
            .from("freight_loads")
            .update({
              status,
              updated_at: now,
              ...(status === "delivered" ? { delivered_at: now } : {}),
            })
            .eq("id", delivery.id);

          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("delivery_orders")
            .update({
              status,
              updated_at: now,
              ...(status === "arrived_pickup" ? { arrived_pickup_at: now } : {}),
              ...(status === "picked_up" ? { picked_up_at: now } : {}),
              ...(status === "in_transit" ? { in_transit_at: now } : {}),
              ...(status === "arrived_dropoff" ? { arrived_dropoff_at: now } : {}),
              ...(status === "delivered" ? { delivered_at: now } : {}),
            })
            .eq("id", delivery.id);

          if (error) throw error;
        }
      }

      setDeliveries((current) =>
        current.map((item) =>
          item.id === delivery.id && item.kind === delivery.kind
            ? { ...item, status, updatedAt: now }
            : item
        )
      );

      Alert.alert("Status Updated", `${delivery.title} marked ${STATUS_LABELS[status]}.`);
    } catch (error: any) {
      console.log("Status update error:", error);
      Alert.alert("Status update failed", error?.message || "The delivery status could not be updated.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function batchAdvance() {
    const selected = deliveries.filter((item) => selectedIds.includes(`${item.kind}_${item.id}`));
    const actionable = selected.filter((item) => nextStatus(item.status));

    if (actionable.length === 0) {
      Alert.alert("No batch action", "Selected deliveries cannot be advanced.");
      return;
    }

    Alert.alert("Advance selected deliveries?", `This will update ${actionable.length} selected delivery status.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Advance",
        onPress: async () => {
          for (const delivery of actionable) {
            const next = nextStatus(delivery.status);
            if (next) await updateDeliveryStatus(delivery, next);
          }
          setSelectedIds([]);
        },
      },
    ]);
  }

  function toggleSelected(delivery: DriverDelivery) {
    const key = `${delivery.kind}_${delivery.id}`;
    setSelectedIds((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
    );
  }

  function openProofPickup(delivery: DriverDelivery) {
    router.push({
      pathname: "/driver/proof-of-pickup",
      params: {
        loadId: delivery.kind === "freight_load" ? delivery.id : delivery.sourceId || delivery.id,
        orderId: delivery.sourceId || delivery.id,
        deliveryOrderId: delivery.kind !== "freight_load" ? delivery.id : "",
      },
    } as any);
  }

  function openProofDelivery(delivery: DriverDelivery) {
    router.push({
      pathname: "/driver/proof-of-delivery",
      params: {
        loadId: delivery.kind === "freight_load" ? delivery.id : delivery.sourceId || delivery.id,
        orderId: delivery.sourceId || delivery.id,
        deliveryOrderId: delivery.kind !== "freight_load" ? delivery.id : "",
      },
    } as any);
  }

  function openLiveTracking(delivery: DriverDelivery) {
    router.push({
      pathname: "/driver/live-location-provider",
      params: {
        loadId: delivery.kind === "freight_load" ? delivery.id : delivery.sourceId || delivery.id,
        orderId: delivery.sourceId || delivery.id,
        deliveryOrderId: delivery.kind !== "freight_load" ? delivery.id : "",
        autoTracking: "true",
      },
    } as any);
  }

  function renderStatusProgress(status: DeliveryStatus) {
    const activeIndex = Math.max(
      0,
      STATUS_FLOW.indexOf(status === "booked" || status === "ready" ? "accepted" : status)
    );

    return (
      <View style={styles.progressWrap}>
        {STATUS_FLOW.map((item, index) => {
          const active = index <= activeIndex;
          const last = index === STATUS_FLOW.length - 1;

          return (
            <View key={item} style={styles.progressItem}>
              <View style={[styles.progressDot, active && styles.progressDotActive]}>
                {active ? <Ionicons name="checkmark" size={10} color={COLORS.white} /> : null}
              </View>
              {!last && <View style={[styles.progressLine, active && styles.progressLineActive]} />}
            </View>
          );
        })}
      </View>
    );
  }

  function renderDelivery({ item }: { item: DriverDelivery }) {
    const next = nextStatus(item.status);
    const tone = statusTone(item.status);
    const selected = selectedIds.includes(`${item.kind}_${item.id}`);
    const pickupText = item.pickupAddress || [item.pickupCity, item.pickupState].filter(Boolean).join(", ") || "Pickup address pending";
    const dropoffText = item.dropoffAddress || [item.dropoffCity, item.dropoffState].filter(Boolean).join(", ") || "Dropoff address pending";

    return (
      <Pressable
        style={[styles.card, selected && styles.cardSelected]}
        onLongPress={() => toggleSelected(item)}
      >
        <View style={styles.cardTop}>
          <View style={[styles.kindIcon, item.kind === "freight_load" ? styles.kindIconFreight : styles.kindIconOrder]}>
            <Ionicons
              name={item.kind === "freight_load" ? "cube-outline" : "bag-handle-outline"}
              size={22}
              color={item.kind === "freight_load" ? COLORS.purple : COLORS.primary}
            />
          </View>

          <View style={{ flex: 1 }}>
            <View style={styles.rowWrap}>
              <Text style={[styles.kindPill, item.kind === "freight_load" && styles.kindPillFreight]}>
                {item.kind === "freight_load" ? "Freight Load" : "Customer Order"}
              </Text>
              {item.coldChain ? <Text style={styles.coldPill}>Cold Chain</Text> : null}
              {item.batchId ? <Text style={styles.batchPill}>Batch</Text> : null}
            </View>

            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardSub}>
              {item.kind === "freight_load"
                ? item.freightCarrierName || "Freight dispatch"
                : item.farmerName || "Local farm pickup"}
            </Text>
          </View>

          <View style={[styles.statusPill, { backgroundColor: statusBg(item.status) }]}>
            <Text style={[styles.statusText, { color: tone }]}>
              {STATUS_LABELS[item.status] || statusLabel(item.status)}
            </Text>
          </View>
        </View>

        {renderStatusProgress(item.status)}

        <View style={styles.routeBox}>
          <TouchableOpacity style={styles.routeItem} onPress={() => openMap(pickupText)} activeOpacity={0.85}>
            <View style={styles.routeDotStart} />
            <View style={{ flex: 1 }}>
              <Text style={styles.routeLabel}>Pickup</Text>
              <Text style={styles.routeName}>{item.pickupName || "Pickup location"}</Text>
              <Text style={styles.routeAddress}>{pickupText}</Text>
            </View>
            <Ionicons name="navigate-outline" size={18} color={COLORS.muted} />
          </TouchableOpacity>

          <View style={styles.routeLine} />

          <TouchableOpacity style={styles.routeItem} onPress={() => openMap(dropoffText)} activeOpacity={0.85}>
            <View style={styles.routeDotEnd} />
            <View style={{ flex: 1 }}>
              <Text style={styles.routeLabel}>Dropoff</Text>
              <Text style={styles.routeName}>{item.dropoffName || item.customerName || "Dropoff location"}</Text>
              <Text style={styles.routeAddress}>{dropoffText}</Text>
            </View>
            <Ionicons name="navigate-outline" size={18} color={COLORS.muted} />
          </TouchableOpacity>
        </View>

        <View style={styles.metricRow}>
          <Metric icon="cash-outline" label="Payout" value={money(item.payout)} />
          <Metric icon="speedometer-outline" label="Miles" value={miles(item.distanceMiles)} />
          <Metric
            icon={item.kind === "freight_load" ? "cube-outline" : "basket-outline"}
            label={item.kind === "freight_load" ? "Load" : "Items"}
            value={item.kind === "freight_load" ? item.batchId || "Single" : String(item.itemCount || 0)}
          />
        </View>

        {!!item.notes && (
          <View style={styles.notesBox}>
            <Text style={styles.notesLabel}>Delivery Notes</Text>
            <Text style={styles.notes}>{item.notes}</Text>
          </View>
        )}

        <View style={styles.utilityRow}>
          <SmallAction icon="call-outline" label="Call" onPress={() => callPhone(item.customerPhone)} />
          <SmallAction icon="radio-outline" label="Track" onPress={() => openLiveTracking(item)} />
          <SmallAction icon="camera-outline" label="Pickup Proof" onPress={() => openProofPickup(item)} />
          <SmallAction icon="checkmark-done-outline" label="Delivery Proof" onPress={() => openProofDelivery(item)} />
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.selectButton, selected && styles.selectButtonActive]}
            onPress={() => toggleSelected(item)}
            activeOpacity={0.9}
          >
            <Ionicons name={selected ? "checkbox-outline" : "square-outline"} size={17} color={COLORS.white} />
            <Text style={styles.selectButtonText}>{selected ? "Selected" : "Batch"}</Text>
          </TouchableOpacity>

          {next ? (
            <TouchableOpacity
              style={styles.primaryButton}
              disabled={updatingId === item.id}
              onPress={() => updateDeliveryStatus(item, next)}
              activeOpacity={0.9}
            >
              {updatingId === item.id ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <>
                  <Text style={styles.primaryButtonText}>Mark {STATUS_LABELS[next]}</Text>
                  <Ionicons name="arrow-forward-outline" size={17} color={COLORS.white} />
                </>
              )}
            </TouchableOpacity>
          ) : (
            <View style={styles.disabledButton}>
              <Ionicons name="checkmark-circle-outline" size={17} color={COLORS.muted} />
              <Text style={styles.disabledButtonText}>Complete</Text>
            </View>
          )}
        </View>
      </Pressable>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading driver deliveries...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.replace("/driver/mobile-driver-app" as any)} activeOpacity={0.9}>
          <Ionicons name="arrow-back-outline" size={20} color={COLORS.text} />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.headerEyebrow}>Farm2Driver Route Center</Text>
          <Text style={styles.headerTitle}>My Deliveries</Text>
          <Text style={styles.headerSub}>Welcome back, {driverName}</Text>
        </View>

        <TouchableOpacity style={styles.refreshButton} onPress={refresh} activeOpacity={0.9}>
          <Ionicons name="refresh-outline" size={20} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredDeliveries}
        keyExtractor={(item) => `${item.kind}-${item.id}`}
        renderItem={renderDelivery}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        ListHeaderComponent={
          <>
            <View style={styles.heroCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroLabel}>Active Route Value</Text>
                <Text style={styles.heroValue}>{money(totals.payout)}</Text>
                <Text style={styles.heroHint}>
                  {totals.active} active route{totals.active === 1 ? "" : "s"} • {miles(totals.miles)}
                </Text>
              </View>

              <View style={styles.heroIcon}>
                <Ionicons name="navigate-outline" size={28} color={COLORS.white} />
              </View>
            </View>

            <View style={styles.summaryGrid}>
              <SummaryTile label="Active" value={totals.active} icon="radio-outline" />
              <SummaryTile label="Orders" value={totals.customer} icon="bag-handle-outline" />
              <SummaryTile label="Freight" value={totals.freight} icon="cube-outline" />
              <SummaryTile label="Done" value={totals.completed} icon="checkmark-circle-outline" />
            </View>

            {currentRoute ? (
              <TouchableOpacity style={styles.currentRouteCard} onPress={() => openLiveTracking(currentRoute)} activeOpacity={0.9}>
                <View style={styles.currentRouteIcon}>
                  <Ionicons name="navigate-circle-outline" size={24} color={COLORS.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.currentRouteLabel}>Current Route</Text>
                  <Text style={styles.currentRouteTitle}>{currentRoute.title}</Text>
                  <Text style={styles.currentRouteSub}>{STATUS_LABELS[currentRoute.status] || statusLabel(currentRoute.status)}</Text>
                </View>
                <Ionicons name="chevron-forward-outline" size={22} color={COLORS.muted} />
              </TouchableOpacity>
            ) : null}

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
              {FILTERS.map((item) => {
                const active = filter === item.key;

                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[styles.filterButton, active && styles.filterButtonActive]}
                    onPress={() => setFilter(item.key)}
                    activeOpacity={0.9}
                  >
                    <Ionicons name={item.icon as any} size={16} color={active ? COLORS.white : COLORS.primary} />
                    <Text style={[styles.filterText, active && styles.filterTextActive]}>{item.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {selectedIds.length > 0 ? (
              <View style={styles.batchBar}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.batchText}>{selectedIds.length} selected</Text>
                  <Text style={styles.batchSub}>Advance multiple deliveries at once.</Text>
                </View>

                <TouchableOpacity style={styles.batchButton} onPress={batchAdvance} activeOpacity={0.9}>
                  <Text style={styles.batchButtonText}>Advance</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="cube-outline" size={34} color={COLORS.primary} />
            </View>
            <Text style={styles.emptyTitle}>No deliveries found</Text>
            <Text style={styles.emptyText}>
              Accepted customer orders and freight loads will appear here.
            </Text>

            <TouchableOpacity style={styles.emptyButton} onPress={() => router.push("/driver/board" as any)} activeOpacity={0.9}>
              <Text style={styles.emptyButtonText}>Open Driver Board</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function SummaryTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.summaryTile}>
      <View style={styles.summaryIcon}>
        <Ionicons name={icon} size={18} color={COLORS.primary} />
      </View>
      <Text style={styles.summaryTileValue}>{value}</Text>
      <Text style={styles.summaryTileLabel}>{label}</Text>
    </View>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.metric}>
      <Ionicons name={icon} size={15} color={COLORS.primary} />
      <View>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={styles.metricValue}>{value}</Text>
      </View>
    </View>
  );
}

function SmallAction({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.smallAction} onPress={onPress} activeOpacity={0.9}>
      <Ionicons name={icon} size={15} color={COLORS.primary} />
      <Text style={styles.smallActionText}>{label}</Text>
    </TouchableOpacity>
  );
}

function statusLabel(value: any) {
  return clean(value || "pending")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  loadingText: { marginTop: 12, color: COLORS.muted, fontWeight: "800" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 14,
    backgroundColor: COLORS.navy,
    gap: 12,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
  },
  headerEyebrow: {
    color: "#A5B4FC",
    fontWeight: "900",
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  headerTitle: { color: COLORS.white, fontSize: 24, fontWeight: "900", marginTop: 2 },
  headerSub: { color: "#CBD5E1", fontWeight: "700", marginTop: 2 },
  refreshButton: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  listContent: { padding: 16, paddingBottom: 44 },

  heroCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 26,
    padding: 20,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  heroLabel: { color: "#E0E7FF", fontWeight: "900", textTransform: "uppercase", fontSize: 12 },
  heroValue: { color: COLORS.white, fontSize: 38, fontWeight: "900", marginTop: 6 },
  heroHint: { color: COLORS.white, opacity: 0.9, fontWeight: "800", marginTop: 5 },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },

  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 14,
  },
  summaryTile: {
    flex: 1,
    minWidth: Platform.OS === "web" ? 140 : "47%",
    backgroundColor: COLORS.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
  },
  summaryIcon: {
    width: 34,
    height: 34,
    borderRadius: 13,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  summaryTileValue: { color: COLORS.text, fontSize: 24, fontWeight: "900" },
  summaryTileLabel: { color: COLORS.muted, fontWeight: "900", marginTop: 2 },

  currentRouteCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  currentRouteIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  currentRouteLabel: { color: COLORS.primary, fontWeight: "900", fontSize: 12, textTransform: "uppercase" },
  currentRouteTitle: { color: COLORS.text, fontWeight: "900", fontSize: 16, marginTop: 2 },
  currentRouteSub: { color: COLORS.muted, fontWeight: "800", marginTop: 2 },

  filters: { gap: 10, paddingBottom: 14 },
  filterButton: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  filterButtonActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterText: { color: COLORS.text, fontWeight: "900" },
  filterTextActive: { color: COLORS.white },

  batchBar: {
    backgroundColor: COLORS.navy,
    borderRadius: 20,
    padding: 14,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  batchText: { color: COLORS.white, fontWeight: "900" },
  batchSub: { color: "#CBD5E1", fontWeight: "700", marginTop: 2 },
  batchButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  batchButtonText: { color: COLORS.white, fontWeight: "900" },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
  },
  cardSelected: { borderColor: COLORS.primary, borderWidth: 2 },
  cardTop: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  kindIcon: {
    width: 46,
    height: 46,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  kindIconOrder: { backgroundColor: COLORS.primarySoft },
  kindIconFreight: { backgroundColor: COLORS.purpleSoft },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  kindPill: {
    backgroundColor: COLORS.primarySoft,
    color: COLORS.primaryDark,
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: "hidden",
    fontSize: 12,
  },
  kindPillFreight: { backgroundColor: COLORS.purpleSoft, color: COLORS.purple },
  coldPill: {
    backgroundColor: COLORS.blueSoft,
    color: "#075985",
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: "hidden",
    fontSize: 12,
  },
  batchPill: {
    backgroundColor: COLORS.amberSoft,
    color: "#92400E",
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: "hidden",
    fontSize: 12,
  },
  cardTitle: { color: COLORS.text, fontSize: 18, fontWeight: "900" },
  cardSub: { color: COLORS.muted, fontWeight: "700", marginTop: 3 },
  statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  statusText: { fontWeight: "900", fontSize: 12 },

  progressWrap: { flexDirection: "row", alignItems: "center", marginTop: 15, marginBottom: 4 },
  progressItem: { flexDirection: "row", alignItems: "center", flex: 1 },
  progressDot: {
    width: 18,
    height: 18,
    borderRadius: 999,
    backgroundColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  progressDotActive: { backgroundColor: COLORS.primary },
  progressLine: { flex: 1, height: 3, backgroundColor: COLORS.border },
  progressLineActive: { backgroundColor: COLORS.primary },

  routeBox: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 14,
    marginTop: 14,
  },
  routeItem: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  routeDotStart: { width: 12, height: 12, borderRadius: 999, backgroundColor: COLORS.blue, marginTop: 4 },
  routeDotEnd: { width: 12, height: 12, borderRadius: 999, backgroundColor: COLORS.green, marginTop: 4 },
  routeLine: { width: 2, height: 22, backgroundColor: COLORS.border, marginLeft: 5, marginVertical: 5 },
  routeLabel: { color: COLORS.muted, fontWeight: "900", fontSize: 12, textTransform: "uppercase" },
  routeName: { color: COLORS.text, fontWeight: "900", marginTop: 2 },
  routeAddress: { color: COLORS.muted, fontWeight: "700", marginTop: 2 },

  metricRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  metric: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metricLabel: { color: COLORS.muted, fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  metricValue: { color: COLORS.text, fontWeight: "900", marginTop: 1 },

  notesBox: {
    marginTop: 12,
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FED7AA",
    borderRadius: 16,
    padding: 12,
  },
  notesLabel: { color: "#9A3412", fontWeight: "900", marginBottom: 4 },
  notes: { color: COLORS.text, fontWeight: "700", lineHeight: 20 },

  utilityRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  smallAction: {
    backgroundColor: COLORS.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  smallActionText: { color: COLORS.primary, fontWeight: "900", fontSize: 12 },

  actionRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  selectButton: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 13,
    backgroundColor: COLORS.navyCard,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  selectButtonActive: { backgroundColor: COLORS.primaryDark },
  selectButtonText: { color: COLORS.white, fontWeight: "900" },
  primaryButton: {
    flex: 1.6,
    borderRadius: 16,
    paddingVertical: 13,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  primaryButtonText: { color: COLORS.white, fontWeight: "900" },
  disabledButton: {
    flex: 1.6,
    borderRadius: 16,
    paddingVertical: 13,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  disabledButtonText: { color: COLORS.muted, fontWeight: "900" },

  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 28,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    marginTop: 20,
  },
  emptyIcon: {
    width: 66,
    height: 66,
    borderRadius: 24,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: { color: COLORS.text, fontSize: 22, fontWeight: "900" },
  emptyText: { color: COLORS.muted, fontWeight: "700", textAlign: "center", marginTop: 8, lineHeight: 21 },
  emptyButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 16,
    marginTop: 16,
  },
  emptyButtonText: { color: COLORS.white, fontWeight: "900" },
});
