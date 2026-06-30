// app/farmer/delivery-operations.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../data/supabaseClient";

const COLORS = {
  bg: "#F6F8F2",
  card: "#FFFFFF",
  text: "#172017",
  muted: "#64748B",
  border: "#E3E8DD",
  primary: "#2E7D32",
  primaryDark: "#14532D",
  green: "#16A34A",
  blue: "#2563EB",
  orange: "#F59E0B",
  red: "#DC2626",
  dark: "#111827",
  greenSoft: "#DCFCE7",
  blueSoft: "#DBEAFE",
  redSoft: "#FEE2E2",
  orangeSoft: "#FFF7ED",
  surface: "#F8FAFC",
  white: "#FFFFFF",
};

type TabKey = "overview" | "orders" | "loads" | "drivers";

type FarmerSession = {
  id?: string;
  farmer_id?: string;
  farmerId?: string;
  profile_id?: string;
  auth_user_id?: string;
  email?: string;
  farm_name?: string;
  farmName?: string;
  business_name?: string;
  businessName?: string;
};

type DeliveryOrder = {
  id: string;
  order_id?: string;
  farmer_id?: string;
  customer_id?: string;
  driver_id?: string;
  assigned_driver_id?: string;
  driver_name?: string;
  assigned_driver_name?: string;
  driver_email?: string;
  driver_phone?: string;
  customer_name?: string;
  customer_phone?: string;
  pickup_address?: string;
  dropoff_address?: string;
  delivery_address?: string;
  miles?: number;
  delivery_fee?: number;
  total?: number;
  status?: string;
  delivery_status?: string;
  source?: string;
  created_at?: string;
};

type FreightLoad = {
  id: string;
  farmer_id?: string;
  carrier_id?: string;
  title?: string;
  commodity?: string;
  pickup_city?: string;
  pickup_state?: string;
  delivery_city?: string;
  delivery_state?: string;
  pickup_location?: string;
  dropoff_location?: string;
  pickup_date?: string;
  pickup_time?: string;
  dropoff_date?: string;
  dropoff_time?: string;
  equipment_type?: string;
  weight_lbs?: number;
  temperature_required?: string;
  temperature_controlled?: boolean;
  priority_level?: string;
  rate?: number;
  distance_miles?: number;
  status?: string;
  driver_id?: string;
  assigned_driver_id?: string;
  assigned_carrier_id?: string;
  ai_dispatch_score?: number;
  ai_dispatch_reason?: string;
  ai_dispatch_eta_minutes?: number;
  accepted_at?: string;
  arrived_pickup_at?: string;
  picked_up_at?: string;
  arrived_dropoff_at?: string;
  delivered_at?: string;
  farmer_name?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
};

type Driver = {
  id: string;
  driver_id?: string;
  driver_name?: string;
  driver_email?: string;
  driver_phone?: string;
  status?: string;
  source?: "internal" | "matched";
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

function firstParam(value: any) {
  if (Array.isArray(value)) return value[0] || "";
  return value ? String(value) : "";
}

function getFarmerId(farmer?: FarmerSession | null) {
  return clean(
    farmer?.farmer_id ||
      farmer?.farmerId ||
      farmer?.id ||
      farmer?.profile_id ||
      farmer?.auth_user_id
  );
}

function getFarmName(farmer?: FarmerSession | null) {
  return (
    clean(farmer?.farm_name || farmer?.farmName) ||
    clean(farmer?.business_name || farmer?.businessName) ||
    "Farm2Home Farmer"
  );
}

function rowMatchesFarmer(row: any, farmerId: string, farmerEmail: string) {
  const ids = [
    row?.farmer_id,
    row?.seller_id,
    row?.vendor_id,
    row?.store_id,
    row?.farm_id,
    row?.owner_id,
    row?.user_id,
    row?.profile_id,
    row?.auth_user_id,
  ].map(clean);

  const emails = [
    row?.farmer_email,
    row?.seller_email,
    row?.vendor_email,
    row?.email,
  ].map(normalize);

  return Boolean(
    (farmerId && ids.includes(farmerId)) ||
      (farmerEmail && emails.includes(farmerEmail))
  );
}

function statusValue(item: DeliveryOrder | FreightLoad) {
  return clean((item as DeliveryOrder).delivery_status || item.status || "available");
}

function statusLabel(value?: string) {
  return clean(value || "available").replace(/_/g, " ");
}

function statusTone(value?: string) {
  const status = normalize(value || "available");

  if (["completed", "complete", "delivered"].includes(status)) return "green";
  if (["cancelled", "canceled", "rejected", "failed"].includes(status)) return "red";
  if (["pending", "available", "open", "posted"].includes(status)) return "orange";
  if (["assigned", "driver_assigned", "accepted", "in_progress", "out_for_delivery"].includes(status)) {
    return "blue";
  }

  return "dark";
}

function getAssignedDriverId(order: DeliveryOrder) {
  return clean(order.driver_id || order.assigned_driver_id);
}

function getAssignedDriverName(order: DeliveryOrder) {
  return clean(order.driver_name || order.assigned_driver_name);
}

function deliveryPickup(order: DeliveryOrder) {
  return clean(order.pickup_address || "Farm pickup location");
}

function deliveryDropoff(order: DeliveryOrder) {
  return clean(order.dropoff_address || order.delivery_address || "Customer delivery address");
}

function freightPickup(load: FreightLoad) {
  return (
    clean(load.pickup_location) ||
    [load.pickup_city, load.pickup_state].map(clean).filter(Boolean).join(", ") ||
    "Pickup location"
  );
}

function freightDropoff(load: FreightLoad) {
  return (
    clean(load.dropoff_location) ||
    [load.delivery_city, load.delivery_state].map(clean).filter(Boolean).join(", ") ||
    "Dropoff location"
  );
}

async function safeSelectRecent(table: string, limit = 300) {
  try {
    let result = await supabase
      .from(table)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (!result.error) return Array.isArray(result.data) ? result.data : [];

    console.log(`${table} created_at order skipped:`, result.error.message);

    result = await supabase.from(table).select("*").limit(limit);

    if (!result.error) return Array.isArray(result.data) ? result.data : [];

    console.log(`${table} select skipped:`, result.error.message);
    return [];
  } catch (error: any) {
    console.log(`${table} select failed:`, error?.message || error);
    return [];
  }
}

export default function FarmerDeliveryOperationsScreen() {
  const params = useLocalSearchParams();
  const farmerIdParam = firstParam(params.farmerId || params.farmer_id || params.id);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [farmer, setFarmer] = useState<FarmerSession | null>(null);
  const [farmerId, setFarmerId] = useState("");

  const [deliveries, setDeliveries] = useState<DeliveryOrder[]>([]);
  const [freightLoads, setFreightLoads] = useState<FreightLoad[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedTab, setSelectedTab] = useState<TabKey>("overview");

  useFocusEffect(
    useCallback(() => {
      initialize();
    }, [farmerIdParam])
  );

  const stats = useMemo(() => {
    const activeDeliveries = deliveries.filter((d) => {
      const status = normalize(statusValue(d));
      return !["completed", "complete", "delivered", "cancelled", "canceled"].includes(status);
    }).length;

    const openDeliveries = deliveries.filter((d) => !getAssignedDriverId(d)).length;
    const completedDeliveries = deliveries.filter((d) =>
      ["completed", "complete", "delivered"].includes(normalize(statusValue(d)))
    ).length;

    const activeLoads = freightLoads.filter((f) => {
      const status = normalize(statusValue(f));
      return !["completed", "complete", "delivered", "cancelled", "canceled"].includes(status);
    }).length;

    const revenue =
      deliveries.reduce((sum, d) => sum + Number(d.delivery_fee || d.total || 0), 0) +
      freightLoads.reduce((sum, f) => sum + Number(f.rate || 0), 0);

    return {
      deliveries: deliveries.length,
      openDeliveries,
      activeDeliveries,
      completedDeliveries,
      freight: freightLoads.length,
      activeLoads,
      drivers: drivers.length,
      revenue,
    };
  }, [deliveries, freightLoads, drivers]);

  async function readLocalFarmer() {
    const raw =
      (await AsyncStorage.getItem("currentFarmer")) ||
      (await AsyncStorage.getItem("farm2homeCurrentFarmer")) ||
      (await AsyncStorage.getItem("farm2homeFarmerSession")) ||
      (await AsyncStorage.getItem("currentUser"));

    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async function findSupabaseFarmer(localFarmer: FarmerSession | null) {
    const { data: authData } = await supabase.auth.getUser();
    const authUser = authData?.user;

    const id = clean(farmerIdParam || getFarmerId(localFarmer) || authUser?.id);
    const email = normalize(localFarmer?.email || authUser?.email);

    const rows = await safeSelectRecent("farmers", 500);

    if (id) {
      const found = rows.find((row: any) =>
        [row?.id, row?.farmer_id, row?.profile_id, row?.auth_user_id].map(clean).includes(id)
      );

      if (found) return found;
    }

    if (email) {
      const found = rows.find((row: any) => normalize(row?.email) === email);
      if (found) return found;
    }

    return null;
  }

  async function saveFarmerSession(nextFarmer: FarmerSession) {
    const id = getFarmerId(nextFarmer);

    const normalized = {
      ...nextFarmer,
      id,
      farmer_id: id,
      farmerId: id,
      role: "farmer",
      email: normalize(nextFarmer.email),
    };

    await AsyncStorage.multiSet([
      ["currentFarmer", JSON.stringify(normalized)],
      ["farm2homeCurrentFarmer", JSON.stringify(normalized)],
      ["farm2homeFarmerSession", JSON.stringify(normalized)],
      ["currentUser", JSON.stringify(normalized)],
      ["userRole", "farmer"],
      ["currentUserRole", "farmer"],
    ]);

    setFarmer(normalized);
    setFarmerId(id);

    return normalized;
  }

  async function initialize() {
    try {
      setLoading(true);

      const localFarmer = await readLocalFarmer();
      const dbFarmer = await findSupabaseFarmer(localFarmer);

      const merged: FarmerSession = {
        ...(localFarmer || {}),
        ...(dbFarmer || {}),
        id: clean(
          dbFarmer?.id ||
            dbFarmer?.farmer_id ||
            localFarmer?.id ||
            localFarmer?.farmer_id ||
            localFarmer?.farmerId ||
            farmerIdParam
        ),
        farmer_id: clean(
          dbFarmer?.farmer_id ||
            dbFarmer?.id ||
            localFarmer?.farmer_id ||
            localFarmer?.id ||
            localFarmer?.farmerId ||
            farmerIdParam
        ),
        farmerId: clean(
          dbFarmer?.farmer_id ||
            dbFarmer?.id ||
            localFarmer?.farmer_id ||
            localFarmer?.id ||
            localFarmer?.farmerId ||
            farmerIdParam
        ),
      };

      if (!getFarmerId(merged)) {
        Alert.alert("Farmer Login Required", "Please login as a farmer.");
        router.replace("/farmer/login" as any);
        return;
      }

      const saved = await saveFarmerSession(merged);
      await loadOperations(getFarmerId(saved), normalize(saved.email));
    } catch (error: any) {
      console.log("Delivery operations load error:", error);
      Alert.alert("Load Error", error?.message || "Unable to load delivery operations.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function loadOperations(id: string, email = "") {
    try {
      setRefreshing(true);

      const loadedDeliveries: DeliveryOrder[] = [];
      const loadedFreight: FreightLoad[] = [];

      const deliveryRows = await safeSelectRecent("delivery_orders", 300);
      const filteredDeliveries = deliveryRows.filter((row: any) => rowMatchesFarmer(row, id, email));

      loadedDeliveries.push(
        ...filteredDeliveries.map((row: any) => ({
          id: clean(row.id || row.order_id || `delivery_${loadedDeliveries.length}`),
          order_id: clean(row.order_id || row.id),
          farmer_id: clean(row.farmer_id),
          customer_id: clean(row.customer_id),
          driver_id: clean(row.driver_id),
          assigned_driver_id: clean(row.assigned_driver_id),
          driver_name: clean(row.driver_name || row.driverName),
          assigned_driver_name: clean(row.assigned_driver_name),
          driver_email: clean(row.driver_email),
          driver_phone: clean(row.driver_phone),
          customer_name: clean(row.customer_name || row.customerName),
          customer_phone: clean(row.customer_phone || row.phone),
          pickup_address: clean(row.pickup_address || row.pickupAddress || row.origin),
          dropoff_address: clean(row.dropoff_address || row.dropoffAddress || row.destination),
          delivery_address: clean(row.delivery_address),
          miles: Number(row.miles || row.distance_miles || 0),
          delivery_fee: Number(row.delivery_fee || row.deliveryFee || row.fee || row.total || 0),
          total: Number(row.total || 0),
          status: clean(row.status || row.delivery_status || row.order_status || "available"),
          delivery_status: clean(row.delivery_status || row.status || "available"),
          source: "delivery_orders",
          created_at: clean(row.created_at),
        }))
      );

      const freightRows = await safeSelectRecent("freight_loads", 300);
      const filteredFreight = freightRows.filter((row: any) => rowMatchesFarmer(row, id, email));

      loadedFreight.push(
        ...filteredFreight.map((row: any) => ({
          id: clean(row.id),
          farmer_id: clean(row.farmer_id),
          carrier_id: clean(row.carrier_id),
          title: clean(row.title || row.commodity || "Farm Freight Load"),
          commodity: clean(row.commodity || "Farm Goods"),
          pickup_city: clean(row.pickup_city),
          pickup_state: clean(row.pickup_state),
          delivery_city: clean(row.delivery_city),
          delivery_state: clean(row.delivery_state),
          pickup_location: clean(row.pickup_location),
          dropoff_location: clean(row.dropoff_location),
          pickup_date: clean(row.pickup_date),
          pickup_time: clean(row.pickup_time),
          dropoff_date: clean(row.dropoff_date),
          dropoff_time: clean(row.dropoff_time),
          equipment_type: clean(row.equipment_type || "Equipment"),
          weight_lbs: Number(row.weight_lbs || 0),
          temperature_required: clean(row.temperature_required),
          temperature_controlled: Boolean(row.temperature_controlled),
          priority_level: clean(row.priority_level || "normal"),
          rate: Number(row.rate || 0),
          distance_miles: Number(row.distance_miles || 0),
          status: clean(row.status || "available"),
          driver_id: clean(row.driver_id),
          assigned_driver_id: clean(row.assigned_driver_id),
          assigned_carrier_id: clean(row.assigned_carrier_id),
          ai_dispatch_score: Number(row.ai_dispatch_score || 0),
          ai_dispatch_reason: clean(row.ai_dispatch_reason),
          ai_dispatch_eta_minutes: Number(row.ai_dispatch_eta_minutes || 0),
          accepted_at: clean(row.accepted_at),
          arrived_pickup_at: clean(row.arrived_pickup_at),
          picked_up_at: clean(row.picked_up_at),
          arrived_dropoff_at: clean(row.arrived_dropoff_at),
          delivered_at: clean(row.delivered_at),
          farmer_name: clean(row.farmer_name),
          notes: clean(row.notes),
          created_at: clean(row.created_at),
          updated_at: clean(row.updated_at),
        }))
      );

      setDeliveries(
        Array.from(new Map(loadedDeliveries.map((item) => [item.id, item])).values())
      );

      setFreightLoads(
        Array.from(new Map(loadedFreight.map((item) => [item.id, item])).values())
      );

      await loadDrivers(id);
    } catch (error: any) {
      Alert.alert("Operations Error", error?.message || "Unable to load delivery operations.");
    } finally {
      setRefreshing(false);
    }
  }

  async function loadDrivers(id: string) {
    try {
      const [internalResult, matchedResult] = await Promise.all([
        supabase
          .from("farmer_internal_drivers")
          .select("*")
          .eq("farmer_id", id)
          .eq("is_active", true)
          .order("created_at", { ascending: false }),
        supabase
          .from("farmer_drivers")
          .select("*")
          .eq("farmer_id", id)
          .eq("status", "active")
          .order("created_at", { ascending: false }),
      ]);

      const internal: Driver[] =
        !internalResult.error && Array.isArray(internalResult.data)
          ? internalResult.data.map((d: any) => ({
              ...d,
              id: clean(d.id),
              driver_id: clean(d.driver_id || d.id),
              source: "internal",
            }))
          : [];

      const matched: Driver[] =
        !matchedResult.error && Array.isArray(matchedResult.data)
          ? matchedResult.data.map((d: any) => ({
              ...d,
              id: clean(d.id),
              driver_id: clean(d.driver_id || d.id),
              source: "matched",
            }))
          : [];

      setDrivers([...internal, ...matched]);
    } catch (error) {
      console.log("Load drivers skipped:", error);
      setDrivers([]);
    }
  }

  async function refreshData() {
    if (!farmerId) {
      await initialize();
      return;
    }

    await loadOperations(farmerId, normalize(farmer?.email));
  }

  async function assignDeliveryDriver(delivery: DeliveryOrder, driver: Driver) {
    try {
      const driverId = clean(driver.driver_id || driver.id);
      const driverName = clean(driver.driver_name || "Farm Driver");
      const isReassign = Boolean(getAssignedDriverId(delivery));
      const now = new Date().toISOString();

      if (!driverId) {
        Alert.alert("Missing Driver", "Driver ID was not found.");
        return;
      }

      const { error: deliveryError } = await supabase
        .from("delivery_orders")
        .update({
          driver_id: driverId,
          assigned_driver_id: driverId,
          driver_name: driverName,
          assigned_driver_name: driverName,
          driver_email: clean(driver.driver_email),
          driver_phone: clean(driver.driver_phone),
          status: "assigned",
          delivery_status: "driver_assigned",
          assigned_at: now,
          reassigned_at: isReassign ? now : null,
          updated_at: now,
        })
        .eq("id", delivery.id);

      if (deliveryError) throw deliveryError;

      const { error: assignmentError } = await supabase
        .from("driver_delivery_assignments")
        .upsert(
          {
            farmer_id: farmerId,
            delivery_order_id: delivery.id,
            order_id: delivery.order_id || "",
            driver_id: driverId,
            driver_name: driverName,
            driver_email: clean(driver.driver_email),
            driver_phone: clean(driver.driver_phone),
            status: "assigned",
            pickup_address: deliveryPickup(delivery),
            dropoff_address: deliveryDropoff(delivery),
            customer_name: delivery.customer_name || "",
            created_at: now,
            updated_at: now,
          },
          { onConflict: "delivery_order_id" }
        );

      if (assignmentError) {
        console.log("driver_delivery_assignments upsert skipped:", assignmentError.message);
      }

      await refreshData();

      Alert.alert(
        isReassign ? "Driver Re-assigned" : "Driver Assigned",
        `${driverName} is now assigned to this delivery.`
      );
    } catch (error: any) {
      Alert.alert("Assign Error", error?.message || "Unable to assign driver.");
    }
  }

  async function updateDeliveryStatus(delivery: DeliveryOrder, nextStatus: string) {
    try {
      const now = new Date().toISOString();

      const { error } = await supabase
        .from("delivery_orders")
        .update({
          status: nextStatus,
          delivery_status: nextStatus,
          updated_at: now,
        })
        .eq("id", delivery.id);

      if (error) throw error;

      await supabase
        .from("driver_delivery_assignments")
        .update({
          status: nextStatus,
          updated_at: now,
        })
        .eq("delivery_order_id", delivery.id);

      await refreshData();
    } catch (error: any) {
      Alert.alert("Status Error", error?.message || "Unable to update delivery.");
    }
  }

  async function cancelFreightLoad(load: FreightLoad) {
    Alert.alert("Cancel Freight Load", "Remove this load from the freight board?", [
      { text: "Keep", style: "cancel" },
      {
        text: "Cancel Load",
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase
            .from("freight_loads")
            .update({
              status: "cancelled",
              updated_at: new Date().toISOString(),
            })
            .eq("id", load.id);

          if (error) {
            Alert.alert("Cancel Error", error.message);
            return;
          }

          await refreshData();
        },
      },
    ]);
  }

  function openDriverChat(delivery: DeliveryOrder) {
    router.push({
      pathname: "/farmer/driver-chat",
      params: {
        farmerId,
        orderId: delivery.order_id || delivery.id || "",
        deliveryOrderId: delivery.id,
        driverId: getAssignedDriverId(delivery),
      },
    } as any);
  }

  function openTracking(delivery: DeliveryOrder) {
    router.push({
      pathname: "/customer/order-tracking",
      params: {
        orderId: delivery.order_id || delivery.id || "",
        deliveryOrderId: delivery.id,
      },
    } as any);
  }

  function openAssignedDrivers() {
    router.push({
      pathname: "/farmer/assigned-drivers",
      params: farmerId ? { farmerId } : {},
    } as any);
  }

  function postLoad() {
    router.push({
      pathname: "/farmer/post-load",
      params: farmerId ? { farmerId } : {},
    } as any);
  }

  function openOrders() {
    router.push({
      pathname: "/farmer/delivery-orders",
      params: farmerId ? { farmerId } : {},
    } as any);
  }

  function openBoard() {
    router.push("/freight/board" as any);
  }

  function renderDeliveryCard(delivery: DeliveryOrder) {
    const assignedDriverId = getAssignedDriverId(delivery);
    const assignedDriverName = getAssignedDriverName(delivery);
    const currentStatus = statusValue(delivery);
    const isAssigned = Boolean(assignedDriverId || assignedDriverName);

    return (
      <View key={delivery.id} style={styles.dispatchCard}>
        <View style={styles.cardTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardEyebrow}>Customer Delivery</Text>
            <Text style={styles.cardTitle}>
              Order #{String(delivery.order_id || delivery.id).slice(-8)}
            </Text>
            <Text style={styles.cardSub}>
              {delivery.customer_name || "Customer"} · {delivery.customer_phone || "No phone"}
            </Text>
          </View>

          <StatusBadge status={currentStatus} />
        </View>

        <View style={styles.routeMapCard}>
          <View style={styles.routeTimeline}>
            <View style={styles.pinStart}>
              <Ionicons name="storefront-outline" size={17} color={COLORS.primaryDark} />
            </View>
            <View style={styles.routeLine} />
            <View style={styles.pinEnd}>
              <Ionicons name="flag-outline" size={17} color="#92400E" />
            </View>
          </View>

          <View style={{ flex: 1 }}>
            <RouteText label="Pickup" value={deliveryPickup(delivery)} />
            <RouteText label="Dropoff" value={deliveryDropoff(delivery)} />
          </View>
        </View>

        <View style={styles.metaGrid}>
          <MiniMetric label="Miles" value={Number(delivery.miles || 0).toFixed(1)} />
          <MiniMetric label="Delivery Fee" value={money(delivery.delivery_fee || delivery.total)} />
          <MiniMetric label="Driver" value={assignedDriverName || assignedDriverId || "Open"} />
        </View>

        <View style={styles.assignmentBox}>
          <View style={{ flex: 1 }}>
            <Text style={styles.assignmentLabel}>Assign / Re-assign Driver</Text>
            <Text style={styles.assignmentSub}>
              {drivers.length ? "Tap a driver below to dispatch this order." : "Add an internal driver or match a Farm2Driver driver."}
            </Text>
          </View>

          <TouchableOpacity style={styles.driverManageButton} onPress={openAssignedDrivers}>
            <Ionicons name="people-outline" size={16} color={COLORS.primaryDark} />
            <Text style={styles.driverManageText}>Manage</Text>
          </TouchableOpacity>
        </View>

        {drivers.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.driverChipRow}>
            {drivers.map((driver) => {
              const driverId = clean(driver.driver_id || driver.id);
              const active = driverId === assignedDriverId;
              const reassign = isAssigned && !active;

              return (
                <TouchableOpacity
                  key={`${delivery.id}-${driverId}`}
                  style={[
                    styles.driverChip,
                    active && styles.driverChipActive,
                    reassign && styles.driverChipReassign,
                  ]}
                  onPress={() => assignDeliveryDriver(delivery, driver)}
                >
                  <Ionicons
                    name={active ? "checkmark-circle-outline" : reassign ? "swap-horizontal-outline" : "person-add-outline"}
                    size={16}
                    color={COLORS.white}
                  />
                  <Text style={styles.driverChipText}>
                    {active
                      ? `Assigned: ${driver.driver_name}`
                      : reassign
                        ? `Re-assign: ${driver.driver_name}`
                        : `Assign: ${driver.driver_name}`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : null}

        <View style={styles.buttonRow}>
          <SmallAction icon="navigate-outline" label="Track" onPress={() => openTracking(delivery)} />
          <SmallAction icon="chatbubble-outline" label="Chat" onPress={() => openDriverChat(delivery)} disabled={!isAssigned} />
          <SmallAction icon="car-outline" label="Out for Delivery" onPress={() => updateDeliveryStatus(delivery, "out_for_delivery")} />
          <SmallAction icon="checkmark-done-outline" label="Delivered" onPress={() => updateDeliveryStatus(delivery, "delivered")} />
        </View>
      </View>
    );
  }

  function renderFreightCard(load: FreightLoad) {
    return (
      <View key={load.id} style={styles.dispatchCard}>
        <View style={styles.cardTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardEyebrow}>Freight Load</Text>
            <Text style={styles.cardTitle}>{load.title || "Farm Freight Load"}</Text>
            <Text style={styles.cardSub}>
              {load.equipment_type || "Equipment"} · {load.commodity || "Farm Goods"}
            </Text>
          </View>

          <StatusBadge status={load.status || "available"} />
        </View>

        <View style={styles.routeMapCard}>
          <View style={styles.routeTimeline}>
            <View style={styles.pinStart}>
              <Ionicons name="storefront-outline" size={17} color={COLORS.primaryDark} />
            </View>
            <View style={styles.routeLine} />
            <View style={styles.pinEnd}>
              <Ionicons name="flag-outline" size={17} color="#92400E" />
            </View>
          </View>

          <View style={{ flex: 1 }}>
            <RouteText label="Pickup" value={freightPickup(load)} />
            <RouteText label="Dropoff" value={freightDropoff(load)} />
          </View>
        </View>

        <View style={styles.metaGrid}>
          <MiniMetric label="Miles" value={Number(load.distance_miles || 0).toFixed(1)} />
          <MiniMetric label="Payout" value={money(load.rate)} />
          <MiniMetric label="Pickup" value={`${load.pickup_date || "Date"} ${load.pickup_time || ""}`} />
          <MiniMetric label="Priority" value={load.priority_level || "normal"} />
        </View>

        {load.ai_dispatch_reason ? (
          <View style={styles.aiBox}>
            <Ionicons name="sparkles-outline" size={16} color={COLORS.primaryDark} />
            <Text style={styles.aiText}>
              AI Score {Number(load.ai_dispatch_score || 0).toFixed(0)} · {load.ai_dispatch_reason}
            </Text>
          </View>
        ) : null}

        <View style={styles.buttonRow}>
          <SmallAction icon="trail-sign-outline" label="Open Board" onPress={openBoard} />
          <SmallAction icon="close-circle-outline" label="Cancel" danger onPress={() => cancelFreightLoad(load)} />
        </View>
      </View>
    );
  }

  function renderDriverCard(driver: Driver) {
    return (
      <View key={`${driver.source}-${driver.id}`} style={styles.driverCard}>
        <View style={styles.driverAvatar}>
          <Text style={styles.driverAvatarText}>
            {clean(driver.driver_name || "D").slice(0, 1).toUpperCase()}
          </Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.driverName}>{driver.driver_name || "Farm Driver"}</Text>
          <Text style={styles.driverMeta}>
            {driver.driver_email || "No email"} · {driver.driver_phone || "No phone"}
          </Text>
          <Text style={styles.driverSource}>
            {driver.source === "matched" ? "Farm2Driver matched driver" : "Internal farm driver"}
          </Text>
        </View>
      </View>
    );
  }

  function renderOverview() {
    const priorityDeliveries = deliveries.slice(0, 3);
    const priorityLoads = freightLoads.slice(0, 2);

    return (
      <>
        <View style={styles.commandCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.commandTitle}>Dispatch Command Center</Text>
            <Text style={styles.commandText}>
              Assign delivery orders, re-assign drivers, post freight loads, track routes, and keep customer deliveries moving.
            </Text>
          </View>

          <View style={styles.commandIcon}>
            <Ionicons name="navigate-outline" size={30} color={COLORS.white} />
          </View>
        </View>

        <View style={styles.quickGrid}>
          <QuickAction icon="add-circle-outline" title="Post Load" sub="Large freight" onPress={postLoad} />
          <QuickAction icon="receipt-outline" title="Orders" sub="Customer orders" onPress={openOrders} />
          <QuickAction icon="people-outline" title="Drivers" sub="Assign team" onPress={openAssignedDrivers} />
          <QuickAction icon="refresh-outline" title="Refresh" sub="Live data" onPress={refreshData} />
        </View>

        <SectionTitle title="Live Route Map" subtitle="Visual dispatch overview for active orders and loads." />

        <View style={styles.bigMapCard}>
          <View style={styles.bigMapTop}>
            <View>
              <Text style={styles.bigMapTitle}>Farm Delivery Route</Text>
              <Text style={styles.bigMapSub}>
                {stats.activeDeliveries + stats.activeLoads} active movement(s)
              </Text>
            </View>

            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>Live</Text>
            </View>
          </View>

          <View style={styles.mapCanvas}>
            <View style={[styles.mapBubble, { top: 20, left: 22 }]}>
              <Ionicons name="storefront-outline" size={15} color={COLORS.primaryDark} />
              <Text style={styles.mapBubbleText}>Farm</Text>
            </View>

            <View style={[styles.mapBubble, { top: 82, right: 28 }]}>
              <Ionicons name="car-outline" size={15} color={COLORS.blue} />
              <Text style={styles.mapBubbleText}>Driver</Text>
            </View>

            <View style={[styles.mapBubble, { bottom: 25, left: 76 }]}>
              <Ionicons name="home-outline" size={15} color="#92400E" />
              <Text style={styles.mapBubbleText}>Customer</Text>
            </View>

            <View style={styles.routeCurveOne} />
            <View style={styles.routeCurveTwo} />
          </View>
        </View>

        <SectionTitle title="Priority Deliveries" subtitle="Newest customer delivery orders needing dispatch attention." />

        {priorityDeliveries.length ? (
          priorityDeliveries.map(renderDeliveryCard)
        ) : (
          <EmptyCard
            icon="cube-outline"
            title="No delivery orders yet"
            text="New farm delivery orders will appear here when customers place orders."
            button="View Orders"
            onPress={openOrders}
          />
        )}

        <SectionTitle title="Freight Loads" subtitle="Large farm loads posted for drivers or freight carriers." />

        {priorityLoads.length ? (
          priorityLoads.map(renderFreightCard)
        ) : (
          <EmptyCard
            icon="trail-sign-outline"
            title="No freight loads yet"
            text="Post a farm load when you need freight or larger delivery support."
            button="Post Load"
            onPress={postLoad}
          />
        )}
      </>
    );
  }

  function renderTabContent() {
    if (selectedTab === "overview") return renderOverview();

    if (selectedTab === "orders") {
      return (
        <>
          <SectionTitle title="Delivery Orders" subtitle="Assign, re-assign, track, chat, and close customer deliveries." />
          {deliveries.length ? (
            deliveries.map(renderDeliveryCard)
          ) : (
            <EmptyCard
              icon="cube-outline"
              title="No delivery orders yet"
              text="Customer delivery orders will appear here after checkout."
              button="View Orders"
              onPress={openOrders}
            />
          )}
        </>
      );
    }

    if (selectedTab === "loads") {
      return (
        <>
          <SectionTitle title="Freight Loads" subtitle="Post larger farm delivery jobs and monitor board status." />
          <TouchableOpacity style={styles.postLoadButton} onPress={postLoad}>
            <Ionicons name="add-circle-outline" size={18} color={COLORS.white} />
            <Text style={styles.postLoadText}>Post New Load</Text>
          </TouchableOpacity>

          {freightLoads.length ? (
            freightLoads.map(renderFreightCard)
          ) : (
            <EmptyCard
              icon="trail-sign-outline"
              title="No freight loads yet"
              text="Post a load when you need freight or larger delivery support."
              button="Post Load"
              onPress={postLoad}
            />
          )}
        </>
      );
    }

    return (
      <>
        <SectionTitle title="Driver Network" subtitle="Internal farm drivers and matched Farm2Driver drivers." />
        <TouchableOpacity style={styles.postLoadButton} onPress={openAssignedDrivers}>
          <Ionicons name="person-add-outline" size={18} color={COLORS.white} />
          <Text style={styles.postLoadText}>Manage Drivers</Text>
        </TouchableOpacity>

        {drivers.length ? (
          drivers.map(renderDriverCard)
        ) : (
          <EmptyCard
            icon="people-outline"
            title="No drivers yet"
            text="Add internal drivers or match Farm2Driver drivers for deliveries."
            button="Add Driver"
            onPress={openAssignedDrivers}
          />
        )}
      </>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading delivery operations...</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={[{ id: "content" }]}
      keyExtractor={(item) => item.id}
      renderItem={() => (
        <View>
          <View style={styles.hero}>
            <View style={styles.heroTop}>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => router.push("/farmer/dashboard" as any)}
              >
                <Ionicons name="arrow-back-outline" size={21} color={COLORS.white} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.refreshButton} onPress={refreshData}>
                <Ionicons name="refresh-outline" size={17} color={COLORS.dark} />
                <Text style={styles.refreshText}>Refresh</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.heroBadge}>Farm2Home Logistics</Text>
            <Text style={styles.heroTitle}>Delivery Operations</Text>
            <Text style={styles.heroText}>
              {getFarmName(farmer)} delivery workflow, freight loads, drivers, tracking, and dispatch communications.
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <SummaryCard label="Deliveries" value={String(stats.deliveries)} icon="cube-outline" />
            <SummaryCard label="Active" value={String(stats.activeDeliveries)} icon="radio-outline" />
            <SummaryCard label="Freight" value={String(stats.freight)} icon="trail-sign-outline" />
            <SummaryCard label="Revenue" value={money(stats.revenue)} icon="cash-outline" />
          </View>

          <View style={styles.tabRow}>
            <TabButton label="Overview" value="overview" selected={selectedTab} onPress={setSelectedTab} />
            <TabButton label="Orders" value="orders" selected={selectedTab} onPress={setSelectedTab} />
            <TabButton label="Loads" value="loads" selected={selectedTab} onPress={setSelectedTab} />
            <TabButton label="Drivers" value="drivers" selected={selectedTab} onPress={setSelectedTab} />
          </View>

          <View style={styles.contentBody}>{renderTabContent()}</View>
        </View>
      )}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshData} />}
      contentContainerStyle={styles.listContent}
    />
  );
}

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.summaryCard}>
      <View style={styles.summaryIcon}>
        <Ionicons name={icon} size={19} color={COLORS.primaryDark} />
      </View>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function TabButton({
  label,
  value,
  selected,
  onPress,
}: {
  label: string;
  value: TabKey;
  selected: TabKey;
  onPress: (value: TabKey) => void;
}) {
  const active = value === selected;

  return (
    <TouchableOpacity style={[styles.tabButton, active && styles.tabButtonActive]} onPress={() => onPress(value)}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.sectionTitleWrap}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionSub}>{subtitle}</Text>
    </View>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const tone = statusTone(status);
  const style =
    tone === "green"
      ? styles.statusGreen
      : tone === "red"
        ? styles.statusRed
        : tone === "orange"
          ? styles.statusOrange
          : tone === "blue"
            ? styles.statusBlue
            : styles.statusDark;

  return <Text style={[styles.statusBadge, style]}>{statusLabel(status)}</Text>;
}

function RouteText({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.routeTextBlock}>
      <Text style={styles.routeLabel}>{label}</Text>
      <Text style={styles.routeValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.miniMetric}>
      <Text style={styles.miniMetricValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.miniMetricLabel}>{label}</Text>
    </View>
  );
}

function SmallAction({
  icon,
  label,
  onPress,
  danger,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.smallAction, danger && styles.smallActionDanger, disabled && styles.smallActionDisabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <Ionicons name={icon} size={15} color={danger ? COLORS.red : COLORS.primaryDark} />
      <Text style={[styles.smallActionText, danger && styles.smallActionDangerText]}>{label}</Text>
    </TouchableOpacity>
  );
}

function QuickAction({
  icon,
  title,
  sub,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  sub: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.quickAction} onPress={onPress}>
      <View style={styles.quickIcon}>
        <Ionicons name={icon} size={20} color={COLORS.primaryDark} />
      </View>
      <Text style={styles.quickTitle}>{title}</Text>
      <Text style={styles.quickSub}>{sub}</Text>
    </TouchableOpacity>
  );
}

function EmptyCard({
  icon,
  title,
  text,
  button,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  text: string;
  button: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.emptyCard}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={26} color={COLORS.primaryDark} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
      <TouchableOpacity style={styles.emptyButton} onPress={onPress}>
        <Text style={styles.emptyButtonText}>{button}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.bg },
  loadingText: { marginTop: 12, color: COLORS.primary, fontWeight: "800" },
  listContent: { backgroundColor: COLORS.bg, paddingBottom: 100 },

  hero: {
    backgroundColor: COLORS.dark,
    paddingTop: Platform.OS === "ios" ? 58 : 42,
    paddingHorizontal: 18,
    paddingBottom: 28,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  backButton: {
    width: 46,
    height: 46,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.13)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  refreshButton: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    paddingHorizontal: 13,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  refreshText: { color: COLORS.dark, fontWeight: "900", fontSize: 12 },
  heroBadge: {
    color: "#BBF7D0",
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    fontSize: 12,
  },
  heroTitle: { color: COLORS.white, fontSize: 34, fontWeight: "900", marginTop: 6 },
  heroText: { color: "#DCFCE7", fontWeight: "700", lineHeight: 22, marginTop: 8 },

  summaryRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: 18, marginTop: -18, marginBottom: 14 },
  summaryCard: {
    width: Platform.OS === "web" ? "24%" : "48%",
    minWidth: 145,
    flexGrow: 1,
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.dark,
    shadowOpacity: Platform.OS === "ios" ? 0.06 : 0,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  summaryIcon: {
    width: 38,
    height: 38,
    borderRadius: 15,
    backgroundColor: COLORS.greenSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 9,
  },
  summaryValue: { fontSize: 21, fontWeight: "900", color: COLORS.primary },
  summaryLabel: { marginTop: 4, color: COLORS.muted, fontWeight: "800", fontSize: 12 },

  tabRow: {
    flexDirection: "row",
    backgroundColor: COLORS.greenSoft,
    marginHorizontal: 18,
    marginBottom: 16,
    borderRadius: 18,
    padding: 5,
  },
  tabButton: { flex: 1, borderRadius: 14, paddingVertical: 11, alignItems: "center" },
  tabButtonActive: { backgroundColor: COLORS.primary },
  tabText: { color: COLORS.primaryDark, fontWeight: "900", fontSize: 12 },
  tabTextActive: { color: COLORS.white },

  contentBody: { paddingHorizontal: 18 },
  commandCard: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: 26,
    padding: 18,
    marginBottom: 14,
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
  },
  commandTitle: { color: COLORS.white, fontWeight: "900", fontSize: 24 },
  commandText: { color: "#DCFCE7", fontWeight: "700", lineHeight: 21, marginTop: 7 },
  commandIcon: {
    width: 64,
    height: 64,
    borderRadius: 23,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },

  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
  quickAction: {
    width: "47.8%",
    flexGrow: 1,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  quickIcon: {
    width: 38,
    height: 38,
    borderRadius: 15,
    backgroundColor: COLORS.greenSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  quickTitle: { color: COLORS.text, fontWeight: "900", fontSize: 15 },
  quickSub: { color: COLORS.muted, fontWeight: "700", fontSize: 12, marginTop: 3 },

  sectionTitleWrap: { marginTop: 4, marginBottom: 12 },
  sectionTitle: { color: COLORS.text, fontWeight: "900", fontSize: 22 },
  sectionSub: { color: COLORS.muted, fontWeight: "700", lineHeight: 20, marginTop: 4 },

  bigMapCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 24,
    padding: 15,
    marginBottom: 18,
  },
  bigMapTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  bigMapTitle: { color: COLORS.text, fontWeight: "900", fontSize: 18 },
  bigMapSub: { color: COLORS.muted, fontWeight: "700", marginTop: 3 },
  livePill: {
    backgroundColor: COLORS.greenSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  liveDot: { width: 8, height: 8, borderRadius: 999, backgroundColor: COLORS.green },
  liveText: { color: COLORS.primaryDark, fontWeight: "900", fontSize: 12 },
  mapCanvas: {
    height: 180,
    borderRadius: 22,
    backgroundColor: "#EAF7EE",
    overflow: "hidden",
    position: "relative",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  mapBubble: {
    position: "absolute",
    backgroundColor: COLORS.white,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    zIndex: 3,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  mapBubbleText: { color: COLORS.text, fontWeight: "900", fontSize: 12 },
  routeCurveOne: {
    position: "absolute",
    left: 72,
    top: 62,
    width: "62%",
    height: 4,
    borderRadius: 999,
    backgroundColor: COLORS.green,
    transform: [{ rotate: "18deg" }],
  },
  routeCurveTwo: {
    position: "absolute",
    left: 104,
    top: 116,
    width: "42%",
    height: 4,
    borderRadius: 999,
    backgroundColor: COLORS.orange,
    transform: [{ rotate: "-24deg" }],
  },

  dispatchCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 15,
    marginBottom: 14,
  },
  cardTopRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 12 },
  cardEyebrow: { color: COLORS.primary, fontWeight: "900", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.7 },
  cardTitle: { color: COLORS.text, fontWeight: "900", fontSize: 19, marginTop: 3 },
  cardSub: { color: COLORS.muted, fontWeight: "700", marginTop: 4 },

  statusBadge: {
    color: COLORS.white,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden",
    fontWeight: "900",
    fontSize: 10,
    textTransform: "uppercase",
  },
  statusGreen: { backgroundColor: COLORS.green },
  statusRed: { backgroundColor: COLORS.red },
  statusOrange: { backgroundColor: COLORS.orange },
  statusBlue: { backgroundColor: COLORS.blue },
  statusDark: { backgroundColor: COLORS.dark },

  routeMapCard: {
    backgroundColor: COLORS.greenSoft,
    borderRadius: 20,
    padding: 13,
    flexDirection: "row",
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  routeTimeline: { width: 34, alignItems: "center", paddingVertical: 3 },
  pinStart: { width: 30, height: 30, borderRadius: 12, backgroundColor: COLORS.white, alignItems: "center", justifyContent: "center" },
  routeLine: { width: 3, flex: 1, backgroundColor: COLORS.primary, marginVertical: 4, borderRadius: 999 },
  pinEnd: { width: 30, height: 30, borderRadius: 12, backgroundColor: COLORS.orangeSoft, alignItems: "center", justifyContent: "center" },
  routeTextBlock: { marginBottom: 8 },
  routeLabel: { color: COLORS.muted, fontWeight: "900", fontSize: 11, textTransform: "uppercase" },
  routeValue: { color: COLORS.text, fontWeight: "800", marginTop: 2, lineHeight: 19 },

  metaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  miniMetric: { flexGrow: 1, flexBasis: "30%", backgroundColor: COLORS.surface, borderRadius: 16, padding: 10 },
  miniMetricValue: { color: COLORS.text, fontWeight: "900", fontSize: 14 },
  miniMetricLabel: { color: COLORS.muted, fontWeight: "800", fontSize: 11, marginTop: 3 },

  aiBox: {
    marginTop: 12,
    backgroundColor: COLORS.greenSoft,
    borderRadius: 16,
    padding: 11,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  aiText: { flex: 1, color: COLORS.primaryDark, fontWeight: "800", lineHeight: 18 },

  assignmentBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 12,
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  assignmentLabel: { color: COLORS.text, fontWeight: "900" },
  assignmentSub: { color: COLORS.muted, fontWeight: "700", marginTop: 3, fontSize: 12 },
  driverManageButton: {
    backgroundColor: COLORS.greenSoft,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  driverManageText: { color: COLORS.primaryDark, fontWeight: "900", fontSize: 12 },

  driverChipRow: { gap: 8, paddingTop: 12 },
  driverChip: {
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  driverChipActive: { backgroundColor: COLORS.blue },
  driverChipReassign: { backgroundColor: COLORS.orange },
  driverChipText: { color: COLORS.white, fontWeight: "900", fontSize: 12 },

  buttonRow: { marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  smallAction: {
    backgroundColor: COLORS.greenSoft,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  smallActionDanger: { backgroundColor: COLORS.redSoft },
  smallActionDisabled: { opacity: 0.45 },
  smallActionText: { color: COLORS.primaryDark, fontWeight: "900", fontSize: 12 },
  smallActionDangerText: { color: COLORS.red },

  driverCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 22,
    padding: 14,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  driverAvatar: {
    width: 50,
    height: 50,
    borderRadius: 18,
    backgroundColor: COLORS.primaryDark,
    alignItems: "center",
    justifyContent: "center",
  },
  driverAvatarText: { color: COLORS.white, fontWeight: "900", fontSize: 20 },
  driverName: { color: COLORS.text, fontWeight: "900", fontSize: 16 },
  driverMeta: { color: COLORS.muted, fontWeight: "700", marginTop: 3, fontSize: 12 },
  driverSource: { color: COLORS.primaryDark, fontWeight: "900", marginTop: 4, fontSize: 12 },

  postLoadButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  postLoadText: { color: COLORS.white, fontWeight: "900" },

  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    marginBottom: 14,
  },
  emptyIcon: {
    width: 54,
    height: 54,
    borderRadius: 20,
    backgroundColor: COLORS.greenSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { color: COLORS.text, fontWeight: "900", fontSize: 18, marginTop: 10 },
  emptyText: { color: COLORS.muted, fontWeight: "700", textAlign: "center", marginTop: 6, lineHeight: 20 },
  emptyButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 11,
    marginTop: 14,
  },
  emptyButtonText: { color: COLORS.white, fontWeight: "900" },
});
