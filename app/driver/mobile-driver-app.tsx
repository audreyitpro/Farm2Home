// app/driver/mobile-driver-app.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Platform,
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
import * as Location from "expo-location";

import { getBackendUrl } from "../services/apiConfig";
import { supabase } from "../services/supabaseClient";

type LoadSource = "api_order" | "delivery_order" | "freight_load";

type DriverLoad = {
  id: string;
  source: LoadSource;
  order_id?: string;
  farmer_id?: string;
  customer_id?: string;
  title?: string;
  commodity?: string;
  pickup_city?: string;
  pickup_state?: string;
  pickupAddress?: string;
  delivery_city?: string;
  delivery_state?: string;
  dropoffAddress?: string;
  status?: string;
  fulfillmentStatus?: string;
  rate?: number;
  deliveryFee?: number;
  freightTotal?: number;
  totalDue?: number;
  miles?: number;
  customerName?: string;
  customerPhone?: string;
  notes?: string;
};

type DriverStats = {
  activeLoads: number;
  completedLoads: number;
  openLoads: number;
  earnings: number;
};

type DriverProfile = {
  id: string;
  driverId: string;
  email?: string;
  fullName?: string;
  name?: string;
  driverName?: string;
  username?: string;
  role: "driver";
  accountActive: boolean;
  membershipStatus: string;
  subscriptionStatus: string;
};

const COLORS = {
  bg: "#F6F7FB",
  card: "#FFFFFF",
  text: "#151922",
  surface: "#F8FAFC",
  white: "#FFFFFF",
  muted: "#7B8494",
  border: "#E6E8EF",
  red: "#E1122D",
  redDark: "#B80F25",
  redSoft: "#FFE6EA",
  black: "#111827",
  soft: "#F3F4F8",
  green: "#10B981",
  blue: "#2563EB",
  orange: "#F59E0B",
  purple: "#7C3AED",
};

const ACTIVE_STATUSES = [
  "ACCEPTED",
  "BOOKED",
  "READY",
  "ARRIVED_PICKUP",
  "PICKED_UP",
  "IN_TRANSIT",
  "ARRIVED_DROPOFF",
];

const OPEN_STATUSES = ["OPEN", "NEW", "AVAILABLE", "POSTED"];

function normalize(value: any) {
  return String(value || "").trim().toLowerCase();
}

function normalizeStatusValue(value: any) {
  return String(value || "OPEN").replace(/-/g, "_").toUpperCase();
}

function formatStatus(status?: string) {
  return String(status || "OPEN")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function money(value: any) {
  return `$${Number(value || 0).toFixed(2)}`;
}

export default function MobileDriverApp() {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [driverId, setDriverId] = useState("");
  const [driverName, setDriverName] = useState("Farm2Home Driver");
  const [loads, setLoads] = useState<DriverLoad[]>([]);
  const [stats, setStats] = useState<DriverStats>({
    activeLoads: 0,
    completedLoads: 0,
    openLoads: 0,
    earnings: 0,
  });

  useFocusEffect(
    useCallback(() => {
      loadDriverDashboard();
    }, [])
  );

  const activeDriverLoads = useMemo(() => {
    return loads.filter((load) => ACTIVE_STATUSES.includes(normalizeStatus(load)));
  }, [loads]);

  async function getCurrentDriver(): Promise<DriverProfile | null> {
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

    const authUserId =
      authUser?.id || parsed?.authUserId || parsed?.id || parsed?.driverId || "";

    const authEmail = normalize(authUser?.email || parsed?.email || "");

    let dbDriver: any = null;
    let profile: any = null;

    if (authUserId) {
      const driverResult = await supabase
        .from("drivers")
        .select("*")
        .eq("id", authUserId)
        .maybeSingle();

      if (!driverResult.error && driverResult.data) dbDriver = driverResult.data;
    }

    if (!dbDriver && authEmail) {
      const driverResult = await supabase
        .from("drivers")
        .select("*")
        .eq("email", authEmail)
        .maybeSingle();

      if (!driverResult.error && driverResult.data) dbDriver = driverResult.data;
    }

    if (authUserId) {
      const profileResult = await supabase
        .from("profiles")
        .select("*")
        .eq("auth_user_id", authUserId)
        .eq("role", "driver")
        .maybeSingle();

      if (!profileResult.error && profileResult.data) profile = profileResult.data;
    }

    if (!profile && authEmail) {
      const profileResult = await supabase
        .from("profiles")
        .select("*")
        .eq("email", authEmail)
        .eq("role", "driver")
        .maybeSingle();

      if (!profileResult.error && profileResult.data) profile = profileResult.data;
    }

    const stableId =
      dbDriver?.id ||
      parsed?.id ||
      parsed?.driverId ||
      authUserId ||
      profile?.auth_user_id ||
      "";

    if (!stableId) return null;

    const driver: DriverProfile = {
      ...(parsed || {}),
      ...(dbDriver || {}),
      id: stableId,
      driverId: stableId,
      role: "driver",
      email: normalize(dbDriver?.email || profile?.email || parsed?.email || authEmail),
      fullName:
        dbDriver?.full_name ||
        dbDriver?.name ||
        profile?.full_name ||
        parsed?.fullName ||
        parsed?.name ||
        "Farm2Home Driver",
      name:
        dbDriver?.name ||
        dbDriver?.full_name ||
        profile?.full_name ||
        parsed?.name ||
        parsed?.fullName ||
        "Farm2Home Driver",
      username: dbDriver?.username || profile?.username || parsed?.username || "",
      accountActive:
        dbDriver?.account_active ??
        profile?.account_active ??
        parsed?.accountActive ??
        true,
      membershipStatus:
        dbDriver?.membership_status || parsed?.membershipStatus || "Active",
      subscriptionStatus:
        dbDriver?.subscription_status || parsed?.subscriptionStatus || "active",
    };

    await AsyncStorage.setItem("currentDriver", JSON.stringify(driver));
    await AsyncStorage.setItem("currentUser", JSON.stringify(driver));
    await AsyncStorage.setItem("farm2homeCurrentDriver", JSON.stringify(driver));
    await AsyncStorage.setItem("farm2homeDriverSession", JSON.stringify(driver));
    await AsyncStorage.setItem("userRole", "driver");
    await AsyncStorage.setItem("currentUserRole", "driver");

    return driver;
  }

  function driverHasAccess(driver: DriverProfile) {
    const subscriptionStatus = normalize(driver.subscriptionStatus);
    const membershipStatus = normalize(driver.membershipStatus);

    if (driver.accountActive === false) return false;
    if (["canceled", "past_due", "unpaid"].includes(subscriptionStatus)) return false;
    if (membershipStatus === "canceled") return false;

    return true;
  }

  async function loadDriverDashboard() {
    try {
      setLoading(true);

      const currentDriver = await getCurrentDriver();

      if (!currentDriver) {
        Alert.alert("Driver Login Required", "Please login as a driver.");
        router.replace("/driver/login" as any);
        return;
      }

      if (!driverHasAccess(currentDriver)) {
        Alert.alert(
          "Membership Required",
          "Your driver account is inactive or subscription is not active."
        );
        router.replace("/driver/login" as any);
        return;
      }

      const localDriverId = currentDriver.id || currentDriver.driverId || "";
      const localDriverName =
        currentDriver.fullName ||
        currentDriver.name ||
        currentDriver.driverName ||
        currentDriver.username ||
        "Farm2Home Driver";

      setDriverId(localDriverId);
      setDriverName(localDriverName);

      const loadedLoads = await loadAllDriverLoads(localDriverId);
      setLoads(loadedLoads);
      setStats(calculateStats(loadedLoads));
    } catch (error) {
      console.log("Driver dashboard error:", error);
      Alert.alert("Load Error", "Unable to load driver dashboard.");
    } finally {
      setLoading(false);
    }
  }

  async function loadAllDriverLoads(activeDriverId: string) {
    const all: DriverLoad[] = [];
    const openStatuses = ["available", "posted", "open", "new", "AVAILABLE", "POSTED", "OPEN", "NEW"];

    try {
      const response = await fetch(`${getBackendUrl()}/orders`);
      const data = await response.json();

      if (response.ok && Array.isArray(data.orders)) {
        const mapped = data.orders
          .filter((order: any) => {
            const status = normalizeStatusValue(order.fulfillmentStatus || order.status || "NEW");
            const assignedToMe =
              order.assignedDriverId === activeDriverId || order.driverId === activeDriverId;

            const openForDriver =
              !order.assignedDriverId &&
              !order.driverId &&
              !order.assignedFreightCarrierId &&
              OPEN_STATUSES.includes(status);

            return assignedToMe || openForDriver;
          })
          .map(mapApiOrder);

        all.push(...mapped);
      }
    } catch (error) {
      console.log("Backend orders skipped:", error);
    }

    try {
      const { data: assignedDeliveryRows, error: assignedDeliveryError } = await supabase
        .from("delivery_orders")
        .select("*")
        .eq("driver_id", activeDriverId)
        .order("created_at", { ascending: false });

      if (assignedDeliveryError) {
        console.log("delivery_orders driver_id query skipped:", assignedDeliveryError.message);
      }

      if (Array.isArray(assignedDeliveryRows)) {
        all.push(...assignedDeliveryRows.map(mapDeliveryOrder));
      }
    } catch (error) {
      console.log("delivery_orders assigned skipped:", error);
    }

    try {
      const { data: openDeliveryRows, error: openDeliveryError } = await supabase
        .from("delivery_orders")
        .select("*")
        .in("status", openStatuses)
        .order("created_at", { ascending: false });

      if (openDeliveryError) {
        console.log("delivery_orders open query skipped:", openDeliveryError.message);
      }

      if (Array.isArray(openDeliveryRows)) {
        all.push(...openDeliveryRows.map(mapDeliveryOrder));
      }
    } catch (error) {
      console.log("delivery_orders open skipped:", error);
    }

    try {
      const { data: assignedFreightRows, error: assignedFreightError } = await supabase
        .from("freight_loads")
        .select("*")
        .eq("assigned_driver_id", activeDriverId)
        .order("created_at", { ascending: false });

      if (assignedFreightError) {
        console.log("freight_loads assigned query skipped:", assignedFreightError.message);
      }

      if (Array.isArray(assignedFreightRows)) {
        all.push(...assignedFreightRows.map(mapFreightLoad));
      }
    } catch (error) {
      console.log("freight_loads assigned skipped:", error);
    }

    try {
      const { data: openFreightRows, error: openFreightError } = await supabase
        .from("freight_loads")
        .select("*")
        .in("status", openStatuses)
        .order("created_at", { ascending: false });

      if (openFreightError) {
        console.log("freight_loads open query skipped:", openFreightError.message);
      }

      if (Array.isArray(openFreightRows)) {
        all.push(...openFreightRows.map(mapFreightLoad));
      }
    } catch (error) {
      console.log("freight_loads open skipped:", error);
    }

    return Array.from(
      new Map(all.map((load) => [`${load.source}_${load.id}`, load])).values()
    );
  }

  function mapApiOrder(order: any): DriverLoad {
    return {
      ...order,
      id: String(order.id || order.orderId || order.loadId),
      source: "api_order",
      order_id: order.id || order.orderId || "",
      status: order.fulfillmentStatus || order.status || "OPEN",
      fulfillmentStatus: order.fulfillmentStatus || order.status || "OPEN",
      title: order.title || order.orderTitle || "Farm2Home Delivery Order",
      commodity: order.commodity || order.itemsSummary || "Farm2Home Groceries",
      pickup_city:
        order.pickup_city ||
        order.pickupCity ||
        order.deliveryInfo?.pickupCity ||
        order.deliveryInfo?.farmCity ||
        order.pickupAddress ||
        "Pickup",
      pickup_state:
        order.pickup_state ||
        order.pickupState ||
        order.deliveryInfo?.pickupState ||
        "",
      pickupAddress:
        order.pickupAddress ||
        order.deliveryInfo?.pickupAddress ||
        order.deliveryInfo?.farmAddress ||
        "",
      delivery_city:
        order.delivery_city ||
        order.deliveryCity ||
        order.deliveryInfo?.city ||
        order.deliveryInfo?.deliveryCity ||
        order.dropoffAddress ||
        order.deliveryInfo?.address ||
        "Delivery",
      delivery_state:
        order.delivery_state ||
        order.deliveryState ||
        order.deliveryInfo?.state ||
        "",
      dropoffAddress:
        order.dropoffAddress ||
        order.deliveryInfo?.address ||
        order.deliveryInfo?.deliveryAddress ||
        "",
      rate: Number(order.deliveryFee || order.rate || order.tip || 0),
      deliveryFee: Number(order.deliveryFee || order.rate || order.tip || 0),
      customerName:
        order.customerName ||
        order.customer?.name ||
        order.deliveryInfo?.name ||
        "Farm2Home Customer",
      customerPhone:
        order.customerPhone ||
        order.customer?.phone ||
        order.deliveryInfo?.phone ||
        "",
      notes:
        order.notes ||
        order.deliveryNotes ||
        order.deliveryInfo?.notes ||
        order.specialInstructions ||
        "",
    };
  }

  function mapDeliveryOrder(row: any): DriverLoad {
    return {
      id: String(row.id),
      source: "delivery_order",
      order_id: row.order_id || "",
      farmer_id: row.farmer_id || "",
      customer_id: row.customer_id || "",
      status: row.status || "available",
      title: row.farm_name || row.farmer_name || "Farm Delivery",
      commodity: row.source || "Farm2Driver Delivery",
      pickup_city: row.pickup_city || row.pickup_address || "Pickup",
      pickupAddress: row.pickup_address || "",
      delivery_city: row.dropoff_city || row.dropoff_address || "Delivery",
      dropoffAddress: row.dropoff_address || "",
      rate: Number(row.delivery_fee || row.payout_amount || 0),
      deliveryFee: Number(row.delivery_fee || row.payout_amount || 0),
      miles: Number(row.miles || 0),
      customerName: row.customer_name || "Farm2Home Customer",
      customerPhone: row.customer_phone || "",
      notes: row.delivery_notes || row.pickup_notes || "",
    };
  }

  function mapFreightLoad(row: any): DriverLoad {
    return {
      id: String(row.id),
      source: "freight_load",
      order_id: row.order_id || "",
      farmer_id: row.farmer_id || "",
      customer_id: row.customer_id || "",
      status: row.status || "available",
      title: row.product_name || "Farm Freight Load",
      commodity: row.load_type || "Farm Freight",
      pickup_city: row.pickup_city || row.pickup_address || "Pickup",
      pickupAddress: row.pickup_address || "",
      delivery_city: row.dropoff_city || row.dropoff_address || "Delivery",
      dropoffAddress: row.dropoff_address || "",
      rate: Number(row.freight_total || row.delivery_fee || 0),
      deliveryFee: Number(row.freight_total || row.delivery_fee || 0),
      freightTotal: Number(row.freight_total || 0),
      totalDue: Number(row.total_due || 0),
      miles: Number(row.miles || 0),
      customerName: "Freight Customer",
      customerPhone: "",
      notes: row.delivery_notes || row.pickup_notes || "",
    };
  }

  function calculateStats(items: DriverLoad[]) {
    return {
      activeLoads: items.filter((item) => ACTIVE_STATUSES.includes(normalizeStatus(item))).length,
      completedLoads: items.filter((item) =>
        ["DELIVERED", "COMPLETED"].includes(normalizeStatus(item))
      ).length,
      openLoads: items.filter((item) => OPEN_STATUSES.includes(normalizeStatus(item))).length,
      earnings: items
        .filter((item) => ["DELIVERED", "COMPLETED"].includes(normalizeStatus(item)))
        .reduce((sum, item) => sum + Number(item.rate || item.deliveryFee || 0), 0),
    };
  }

  async function refreshDashboard() {
    setRefreshing(true);
    await loadDriverDashboard();
    setRefreshing(false);
  }

  async function acceptLoad(load: DriverLoad) {
    try {
      setLoading(true);

      const currentDriver = await getCurrentDriver();

      if (!currentDriver?.id) {
        Alert.alert("Driver Missing", "Please log in again.");
        return;
      }

      if (load.source === "api_order") await acceptApiOrder(load, currentDriver);
      if (load.source === "delivery_order") await acceptDeliveryOrder(load, currentDriver);
      if (load.source === "freight_load") await acceptFreightLoad(load, currentDriver);

      Alert.alert("Accepted", "This delivery is now assigned to you.");
      await loadDriverDashboard();
    } catch (error: any) {
      Alert.alert("Accept Error", error.message || "Unable to accept load.");
    } finally {
      setLoading(false);
    }
  }

  async function acceptApiOrder(load: DriverLoad, driver: DriverProfile) {
    const response = await fetch(`${getBackendUrl()}/orders/${load.id}/accept`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        driverId: driver.id,
        acceptedBy: getDriverDisplayName(driver),
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || "Unable to accept order.");
    }
  }

  async function acceptDeliveryOrder(load: DriverLoad, driver: DriverProfile) {
    const { error } = await supabase
      .from("delivery_orders")
      .update({
        status: "accepted",
        driver_id: driver.id,
        driver_name: getDriverDisplayName(driver),
        driver_email: driver.email || "",
        assigned_at: new Date().toISOString(),
        accepted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", load.id);

    if (error) throw error;
  }

  async function acceptFreightLoad(load: DriverLoad, driver: DriverProfile) {
    const { error } = await supabase
      .from("freight_loads")
      .update({
        status: "accepted",
        driver_name: getDriverDisplayName(driver),
        driver_email: driver.email || "",
        accepted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", load.id);

    if (error) throw error;

    await supabase.from("delivery_orders").insert({
      order_id: load.order_id || load.id,
      farmer_id: load.farmer_id || null,
      customer_id: load.customer_id || null,
      driver_id: driver.id,
      driver_name: getDriverDisplayName(driver),
      driver_email: driver.email || "",
      pickup_address: load.pickupAddress || "",
      dropoff_address: load.dropoffAddress || "",
      miles: Number(load.miles || 0),
      delivery_fee: Number(load.deliveryFee || load.freightTotal || 0),
      status: "accepted",
      source: "freight_load",
      assigned_at: new Date().toISOString(),
      accepted_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  async function updateLoadStatus(load: DriverLoad, nextStatus: string) {
    try {
      setLoading(true);

      const now = new Date().toISOString();
      const dbStatus = normalize(nextStatus);

      const payload: any = {
        status: dbStatus,
        updated_at: now,
      };

      if (dbStatus === "arrived_pickup") payload.arrived_pickup_at = now;
      if (dbStatus === "picked_up") payload.picked_up_at = now;
      if (dbStatus === "in_transit") payload.in_transit_at = now;
      if (dbStatus === "arrived_dropoff") payload.arrived_dropoff_at = now;
      if (dbStatus === "delivered") payload.delivered_at = now;

      if (load.source === "api_order") {
        const response = await fetch(`${getBackendUrl()}/orders/${load.id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: nextStatus.toUpperCase(),
            driverId,
          }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || "Unable to update order.");
        }
      }

      if (load.source === "delivery_order") {
        const { error } = await supabase
          .from("delivery_orders")
          .update(payload)
          .eq("id", load.id);

        if (error) throw error;
      }

      if (load.source === "freight_load") {
        const { error } = await supabase
          .from("freight_loads")
          .update(payload)
          .eq("id", load.id);

        if (error) throw error;
      }

      await updateDriverGps(load, dbStatus);

      Alert.alert("Status Updated", `Delivery marked as ${formatStatus(dbStatus)}.`);
      await loadDriverDashboard();
    } catch (error: any) {
      Alert.alert("Update Error", error.message || "Unable to update load.");
    } finally {
      setLoading(false);
    }
  }

  async function updateDriverGps(load: DriverLoad, status: string) {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) return;

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      await supabase.from("driver_locations").insert({
        load_id: load.source === "freight_load" ? load.id : load.order_id || load.id,
        order_id: load.order_id || load.id,
        delivery_order_id: load.source === "delivery_order" ? load.id : null,
        driver_id: driverId,
        carrier_id: driverId,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        speed: location.coords.speed || null,
        heading: location.coords.heading || null,
        status,
        updated_at: new Date().toISOString(),
      });
    } catch (error) {
      console.log("Save driver GPS skipped:", error);
    }
  }

  function getDriverDisplayName(driver: DriverProfile) {
    return (
      driver.fullName ||
      driver.name ||
      driver.driverName ||
      driver.username ||
      "Farm2Home Driver"
    );
  }

  function normalizeStatus(load: DriverLoad) {
    return normalizeStatusValue(load.status || load.fulfillmentStatus || "OPEN");
  }

  function statusColor(status?: string) {
    switch (normalizeStatusValue(status)) {
      case "OPEN":
      case "NEW":
      case "AVAILABLE":
      case "POSTED":
        return COLORS.blue;
      case "BOOKED":
      case "ACCEPTED":
      case "READY":
        return COLORS.purple;
      case "ARRIVED_PICKUP":
        return "#0EA5E9";
      case "PICKED_UP":
        return COLORS.orange;
      case "IN_TRANSIT":
      case "ARRIVED_DROPOFF":
        return "#0F766E";
      case "DELIVERED":
      case "COMPLETED":
        return COLORS.green;
      case "CANCELLED":
        return COLORS.red;
      default:
        return COLORS.muted;
    }
  }

  function openMap(address?: string) {
    if (!address) {
      Alert.alert("Address Missing", "No address is available for this stop.");
      return;
    }

    const encoded = encodeURIComponent(address);
    const url =
      Platform.OS === "ios"
        ? `http://maps.apple.com/?q=${encoded}`
        : `https://www.google.com/maps/search/?api=1&query=${encoded}`;

    Linking.openURL(url).catch(() => {
      Alert.alert("Map Error", "Unable to open maps on this device.");
    });
  }

  function callCustomer(phone?: string) {
    if (!phone) {
      Alert.alert("Phone Missing", "No customer phone number is available.");
      return;
    }

    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert("Call Error", "Unable to call from this device.");
    });
  }

  function openLoadDetails(load: DriverLoad) {
    router.push({
      pathname: "/driver/load-details",
      params: {
        loadId: load.id,
        orderId: load.order_id || load.id,
        source: load.source,
      },
    } as any);
  }

  function openLiveLocation(load: DriverLoad) {
    router.push({
      pathname: "/driver/live-location-provider",
      params: {
        loadId: load.source === "freight_load" ? load.id : load.order_id || load.id,
        orderId: load.order_id || load.id,
        deliveryOrderId: load.source === "delivery_order" ? load.id : "",
        autoTracking: "true",
      },
    } as any);
  }

  function openProofPickup(load: DriverLoad) {
    router.push({
      pathname: "/driver/proof-of-pickup",
      params: {
        loadId: load.source === "freight_load" ? load.id : load.order_id || load.id,
        orderId: load.order_id || load.id,
        deliveryOrderId: load.source === "delivery_order" ? load.id : "",
      },
    } as any);
  }

  function openProofDelivery(load: DriverLoad) {
    router.push({
      pathname: "/driver/proof-of-delivery",
      params: {
        loadId: load.source === "freight_load" ? load.id : load.order_id || load.id,
        orderId: load.order_id || load.id,
        deliveryOrderId: load.source === "delivery_order" ? load.id : "",
      },
    } as any);
  }

  function renderActions(load: DriverLoad) {
    const status = normalizeStatus(load);

    if (OPEN_STATUSES.includes(status)) {
      return (
        <TouchableOpacity style={styles.primaryAction} onPress={() => acceptLoad(load)}>
          <Text style={styles.actionText}>Accept Delivery</Text>
        </TouchableOpacity>
      );
    }

    if (status === "BOOKED" || status === "ACCEPTED" || status === "READY") {
      return (
        <View style={styles.actionGrid}>
          <ActionButton label="Track" icon="navigate" onPress={() => openLiveLocation(load)} />
          <ActionButton
            label="Arrived"
            icon="pin"
            onPress={() => updateLoadStatus(load, "arrived_pickup")}
            color={COLORS.orange}
          />
          <ActionButton
            label="Proof Pickup"
            icon="camera"
            onPress={() => openProofPickup(load)}
            color={COLORS.green}
          />
        </View>
      );
    }

    if (status === "PICKED_UP") {
      return (
        <View style={styles.actionGrid}>
          <ActionButton
            label="Start Route"
            icon="car"
            onPress={() => updateLoadStatus(load, "in_transit")}
          />
          <ActionButton
            label="Live Track"
            icon="navigate-circle"
            onPress={() => openLiveLocation(load)}
            color={COLORS.black}
          />
        </View>
      );
    }

    if (status === "IN_TRANSIT" || status === "ARRIVED_DROPOFF") {
      return (
        <View style={styles.actionGrid}>
          <ActionButton
            label="Arrived Drop"
            icon="location"
            onPress={() => updateLoadStatus(load, "arrived_dropoff")}
            color={COLORS.orange}
          />
          <ActionButton
            label="Proof Delivery"
            icon="checkmark-done"
            onPress={() => openProofDelivery(load)}
            color={COLORS.purple}
          />
        </View>
      );
    }

    if (status === "DELIVERED" || status === "COMPLETED") {
      return (
        <View style={styles.completedBadge}>
          <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
          <Text style={styles.completedText}>Completed</Text>
        </View>
      );
    }

    return null;
  }

  function renderLoadCard({ item }: { item: DriverLoad }) {
    const status = normalizeStatus(item);
    const pickupText = `${item.pickup_city || item.pickupAddress || "Pickup"} ${
      item.pickup_state || ""
    }`.trim();
    const deliveryText = `${item.delivery_city || item.dropoffAddress || "Delivery"} ${
      item.delivery_state || ""
    }`.trim();

    return (
      <View style={styles.loadCard}>
        <TouchableOpacity onPress={() => openLoadDetails(item)} activeOpacity={0.8}>
          <View style={styles.loadHeader}>
            <View style={styles.loadIcon}>
              <Ionicons
                name={item.source === "freight_load" ? "cube" : "bag-handle"}
                size={21}
                color={COLORS.red}
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.loadTitle}>{item.title || "Farm2Home Delivery"}</Text>
              <Text style={styles.commodity}>{item.commodity || "Farm Goods"}</Text>
            </View>

            <View style={[styles.statusBadge, { backgroundColor: statusColor(status) }]}>
              <Text style={styles.statusText}>{formatStatus(status)}</Text>
            </View>
          </View>
        </TouchableOpacity>

        <View style={styles.routeBox}>
          <TouchableOpacity
            style={styles.routeStop}
            onPress={() => openMap(item.pickupAddress || pickupText)}
          >
            <View style={styles.routeDotStart} />
            <View style={{ flex: 1 }}>
              <Text style={styles.routeLabel}>Sender / Pickup</Text>
              <Text style={styles.routeText}>{pickupText}</Text>
              {!!item.pickupAddress && <Text style={styles.routeSubText}>{item.pickupAddress}</Text>}
            </View>
            <Ionicons name="open-outline" size={17} color={COLORS.muted} />
          </TouchableOpacity>

          <View style={styles.routeLine} />

          <TouchableOpacity
            style={styles.routeStop}
            onPress={() => openMap(item.dropoffAddress || deliveryText)}
          >
            <View style={styles.routeDotEnd} />
            <View style={{ flex: 1 }}>
              <Text style={styles.routeLabel}>Receiver / Dropoff</Text>
              <Text style={styles.routeText}>{deliveryText}</Text>
              {!!item.dropoffAddress && <Text style={styles.routeSubText}>{item.dropoffAddress}</Text>}
            </View>
            <Ionicons name="open-outline" size={17} color={COLORS.muted} />
          </TouchableOpacity>
        </View>

        <View style={styles.metaGrid}>
          <MetaPill icon="cash" text={money(item.rate || item.deliveryFee)} />
          <MetaPill icon="speedometer" text={item.miles ? `${item.miles} mi` : "Miles pending"} />
          <TouchableOpacity style={styles.metaPill} onPress={() => callCustomer(item.customerPhone)}>
            <Ionicons name="call" size={14} color={COLORS.red} />
            <Text style={styles.metaText}>Contact</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.metaPill} onPress={() => openLoadDetails(item)}>
            <Ionicons name="document-text" size={14} color={COLORS.red} />
            <Text style={styles.metaText}>Details</Text>
          </TouchableOpacity>
        </View>

        {!!item.notes && (
          <View style={styles.notesBox}>
            <Text style={styles.notesLabel}>Delivery Notes</Text>
            <Text style={styles.notesText}>{item.notes}</Text>
          </View>
        )}

        <View style={styles.loadActions}>{renderActions(item)}</View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.red} />

      <View style={styles.container}>
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>Farm2Driver</Text>
              <Text style={styles.title}>Home</Text>
              <Text style={styles.subtitle}>Welcome back, {driverName}</Text>
            </View>

            <TouchableOpacity
              style={styles.profileCircle}
              onPress={() => router.push("/driver/profile" as any)}
            >
              <Ionicons name="person" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.heroStats}>
            <View>
              <Text style={styles.heroStatLabel}>Today Earnings</Text>
              <Text style={styles.heroStatValue}>{money(stats.earnings)}</Text>
            </View>

            <TouchableOpacity style={styles.heroSmallButton} onPress={() => router.push("/driver/earnings" as any)}>
              <Text style={styles.heroSmallButtonText}>View</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.quickActions}>
          <QuickButton icon="grid" label="Board" onPress={() => router.push("/driver/board" as any)} />
          <QuickButton icon="cube" label="Loads" onPress={() => router.push("/driver/my-deliveries" as any)} />
          <QuickButton icon="wallet" label="Wallet" onPress={() => router.push("/driver/earnings" as any)} />
          <QuickButton icon="notifications" label="Alerts" onPress={() => router.push("/driver/notifications" as any)} />
        </View>

        {loading && loads.length === 0 ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={COLORS.red} />
            <Text style={styles.loadingText}>Loading driver hub...</Text>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshDashboard} />}
          >
            <View style={styles.summaryRow}>
              <SummaryCard label="Open" value={stats.openLoads} icon="add-circle" />
              <SummaryCard label="Active" value={stats.activeLoads} icon="navigate" />
              <SummaryCard label="Done" value={stats.completedLoads} icon="checkmark-circle" />
            </View>

            {activeDriverLoads.length > 0 && (
              <TouchableOpacity
                style={styles.activeNotice}
                onPress={() => router.push("/driver/my-deliveries" as any)}
              >
                <Ionicons name="radio" size={20} color="#FFFFFF" />
                <Text style={styles.activeNoticeText}>
                  {activeDriverLoads.length} active route{activeDriverLoads.length > 1 ? "s" : ""}
                </Text>
                <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.refreshButton} onPress={loadDriverDashboard} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="refresh" size={18} color="#FFFFFF" />
                  <Text style={styles.refreshText}>Refresh Deliveries</Text>
                </>
              )}
            </TouchableOpacity>

            <DriverActionHub />

            <Text style={styles.sectionTitle}>My Shipments</Text>

            <FlatList
              data={loads}
              keyExtractor={(item, index) => `${item.source}_${item.id}_${index}`}
              scrollEnabled={false}
              contentContainerStyle={{ paddingBottom: 120 }}
              ListEmptyComponent={
                <View style={styles.emptyCard}>
                  <Ionicons name="cube-outline" size={38} color={COLORS.red} />
                  <Text style={styles.emptyTitle}>No deliveries available</Text>
                  <Text style={styles.emptyText}>
                    Open the Driver Board to select available deliveries in your area.
                  </Text>

                  <TouchableOpacity
                    style={styles.emptyButton}
                    onPress={() => router.push("/driver/board" as any)}
                  >
                    <Text style={styles.emptyButtonText}>Open Driver Board</Text>
                  </TouchableOpacity>
                </View>
              }
              renderItem={renderLoadCard}
            />
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

function QuickButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.quickButton} onPress={onPress}>
      <View style={styles.quickIcon}>
        <Ionicons name={icon} size={20} color={COLORS.red} />
      </View>
      <Text style={styles.quickLabel}>{label}</Text>
    </TouchableOpacity>
  );
}


function DriverActionHub() {
  const actions: Array<{
    title: string;
    subtitle: string;
    icon: keyof typeof Ionicons.glyphMap;
    route: string;
    primary?: boolean;
  }> = [
    {
      title: "Driver Board",
      subtitle: "Find, select, and accept available deliveries.",
      icon: "grid-outline",
      route: "/driver/board",
      primary: true,
    },
    {
      title: "My Deliveries",
      subtitle: "Manage active shipments and route progress.",
      icon: "cube-outline",
      route: "/driver/my-deliveries",
      primary: true,
    },
    {
      title: "Earnings",
      subtitle: "View wallet, settlement, and payout totals.",
      icon: "wallet-outline",
      route: "/driver/earnings",
      primary: true,
    },
    {
      title: "Driver Profile",
      subtitle: "Manage profile, compliance, Stripe, and account.",
      icon: "person-circle-outline",
      route: "/driver/profile",
      primary: true,
    },
    {
      title: "Live Deliveries",
      subtitle: "Track live delivery movement.",
      icon: "navigate-circle-outline",
      route: "/driver/live-deliveries",
    },
    {
      title: "Live Location Provider",
      subtitle: "Start or stop driver location sharing.",
      icon: "location-outline",
      route: "/driver/live-location-provider",
    },
    {
      title: "Load Details",
      subtitle: "Review delivery pickup, dropoff, and load notes.",
      icon: "document-text-outline",
      route: "/driver/load-details",
    },
    {
      title: "Delivery History",
      subtitle: "View completed and previous deliveries.",
      icon: "time-outline",
      route: "/driver/delivery-history",
    },
    {
      title: "Proof of Pickup",
      subtitle: "Capture pickup photo, signature, and confirmation.",
      icon: "camera-outline",
      route: "/driver/proof-of-pickup",
    },
    {
      title: "Proof of Delivery",
      subtitle: "Capture final proof and delivery confirmation.",
      icon: "checkmark-done-outline",
      route: "/driver/proof-of-delivery",
    },
    {
      title: "Navigation Assistant",
      subtitle: "Open route and dispatch navigation support.",
      icon: "map-outline",
      route: "/driver/navigation-assistant",
    },
    {
      title: "Notifications",
      subtitle: "Dispatch alerts, messages, and delivery updates.",
      icon: "notifications-outline",
      route: "/driver/notifications",
    },
    {
      title: "Customer Chat",
      subtitle: "Message customers on assigned orders.",
      icon: "chatbubble-ellipses-outline",
      route: "/driver/customer-chat",
    },
    {
      title: "Farmer Chat",
      subtitle: "Message farms and pickup contacts.",
      icon: "leaf-outline",
      route: "/driver/farmer-chat",
    },
    {
      title: "Subscription",
      subtitle: "Manage driver membership status.",
      icon: "card-outline",
      route: "/driver/subscription",
    },
    {
      title: "Settings",
      subtitle: "Update driver app and notification settings.",
      icon: "settings-outline",
      route: "/driver/settings",
    },
    {
      title: "Support",
      subtitle: "Contact Farm2Home driver support.",
      icon: "help-circle-outline",
      route: "/driver/support",
    },
    {
      title: "Help",
      subtitle: "Open driver help and workflow guidance.",
      icon: "information-circle-outline",
      route: "/driver/help",
    },
  ];

  return (
    <View style={styles.actionHub}>
      <View style={styles.actionHubHeader}>
        <View style={styles.actionHubIcon}>
          <Ionicons name="apps-outline" size={22} color={COLORS.red} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.actionHubTitle}>Driver Tools</Text>
          <Text style={styles.actionHubSubtitle}>
            Quick access to dispatch, routes, proof screens, chats, wallet, and settings.
          </Text>
        </View>
      </View>

      <View style={styles.actionHubGrid}>
        {actions.map((item) => (
          <TouchableOpacity
            key={item.route}
            style={[styles.actionCard, item.primary && styles.actionCardPrimary]}
            onPress={() => router.push(item.route as any)}
            activeOpacity={0.9}
          >
            <View style={[styles.actionIcon, item.primary && styles.actionIconPrimary]}>
              <Ionicons
                name={item.icon}
                size={20}
                color={item.primary ? COLORS.white : COLORS.red}
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={[styles.actionTitle, item.primary && styles.actionTitlePrimary]}>
                {item.title}
              </Text>
              <Text style={[styles.actionSubtitle, item.primary && styles.actionSubtitlePrimary]}>
                {item.subtitle}
              </Text>
            </View>

            <Ionicons
              name="chevron-forward-outline"
              size={18}
              color={item.primary ? COLORS.white : COLORS.muted}
            />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}


function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.summaryCard}>
      <Ionicons name={icon} size={20} color={COLORS.red} />
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function MetaPill({
  icon,
  text,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
}) {
  return (
    <View style={styles.metaPill}>
      <Ionicons name={icon} size={14} color={COLORS.red} />
      <Text style={styles.metaText}>{text}</Text>
    </View>
  );
}

function ActionButton({
  label,
  icon,
  onPress,
  color = COLORS.blue,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  color?: string;
}) {
  return (
    <TouchableOpacity style={[styles.actionButton, { backgroundColor: color }]} onPress={onPress}>
      <Ionicons name={icon} size={16} color="#FFFFFF" />
      <Text style={styles.actionText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  actionHub: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actionHubHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  actionHubIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: COLORS.redSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  actionHubTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "900",
  },
  actionHubSubtitle: {
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 3,
    lineHeight: 19,
  },
  actionHubGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  actionCard: {
    width: Platform.OS === "web" ? "32.5%" : "100%",
    minWidth: Platform.OS === "web" ? 250 : undefined,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  actionCardPrimary: {
    backgroundColor: COLORS.red,
    borderColor: COLORS.red,
  },
  actionIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: COLORS.redSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  actionIconPrimary: {
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  actionTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 14,
  },
  actionTitlePrimary: {
    color: COLORS.white,
  },
  actionSubtitle: {
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 3,
    fontSize: 12,
    lineHeight: 17,
  },
  actionSubtitlePrimary: {
    color: "rgba(255,255,255,0.86)",
  },

  safe: { flex: 1, backgroundColor: COLORS.bg },
  container: { flex: 1, backgroundColor: COLORS.bg },
  hero: {
    backgroundColor: COLORS.red,
    paddingTop: 18,
    paddingHorizontal: 20,
    paddingBottom: 22,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 14 },
  profileCircle: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: {
    color: "#FFE6EA",
    fontWeight: "900",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontSize: 12,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900",
  },
  subtitle: {
    color: "#FFFFFF",
    opacity: 0.9,
    lineHeight: 20,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 4,
  },
  heroStats: {
    marginTop: 18,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: 20,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  heroStatLabel: { color: "#FFE6EA", fontWeight: "900", fontSize: 12 },
  heroStatValue: { color: "#FFFFFF", fontSize: 30, fontWeight: "900", marginTop: 4 },
  heroSmallButton: {
    marginLeft: "auto",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  heroSmallButtonText: { color: COLORS.red, fontWeight: "900" },
  quickActions: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginTop: -18,
    marginBottom: 14,
    gap: 10,
  },
  quickButton: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  quickIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: COLORS.redSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  quickLabel: { color: COLORS.text, fontWeight: "900", fontSize: 12 },
  loadingCard: {
    backgroundColor: COLORS.card,
    margin: 18,
    padding: 24,
    borderRadius: 18,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  loadingText: { color: COLORS.muted, marginTop: 10, fontWeight: "800" },
  summaryRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 14,
    alignItems: "center",
  },
  summaryValue: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: "900",
    marginTop: 6,
  },
  summaryLabel: { color: COLORS.muted, fontWeight: "800", marginTop: 2 },
  activeNotice: {
    backgroundColor: COLORS.black,
    marginHorizontal: 18,
    marginBottom: 14,
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  activeNoticeText: {
    flex: 1,
    color: "#FFFFFF",
    fontWeight: "900",
  },
  refreshButton: {
    backgroundColor: COLORS.red,
    marginHorizontal: 18,
    padding: 14,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    flexDirection: "row",
    gap: 8,
  },
  refreshText: { color: "#FFFFFF", fontWeight: "900" },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "900",
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  emptyCard: {
    backgroundColor: COLORS.card,
    marginHorizontal: 18,
    padding: 24,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 10,
    marginBottom: 6,
  },
  emptyText: {
    color: COLORS.muted,
    lineHeight: 21,
    fontWeight: "700",
    textAlign: "center",
  },
  emptyButton: {
    backgroundColor: COLORS.red,
    marginTop: 15,
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 13,
  },
  emptyButtonText: { color: "#FFFFFF", fontWeight: "900" },
  loadCard: {
    backgroundColor: COLORS.card,
    marginHorizontal: 18,
    marginBottom: 14,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  loadHeader: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
    alignItems: "flex-start",
  },
  loadIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: COLORS.redSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  loadTitle: { color: COLORS.text, fontSize: 18, fontWeight: "900" },
  commodity: { color: COLORS.muted, fontWeight: "700", marginTop: 3 },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    maxWidth: 145,
  },
  statusText: { color: "#FFFFFF", fontWeight: "900", fontSize: 10 },
  routeBox: {
    backgroundColor: COLORS.soft,
    padding: 13,
    borderRadius: 16,
    marginBottom: 11,
  },
  routeStop: { flexDirection: "row", alignItems: "center", gap: 10 },
  routeDotStart: {
    width: 12,
    height: 12,
    borderRadius: 999,
    backgroundColor: COLORS.green,
  },
  routeDotEnd: {
    width: 12,
    height: 12,
    borderRadius: 999,
    backgroundColor: COLORS.red,
  },
  routeLine: {
    width: 2,
    height: 23,
    backgroundColor: COLORS.border,
    marginLeft: 5,
    marginVertical: 7,
  },
  routeLabel: {
    color: COLORS.red,
    fontWeight: "900",
    fontSize: 11,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  routeText: { color: COLORS.text, fontWeight: "900", fontSize: 14 },
  routeSubText: { color: COLORS.muted, marginTop: 2, fontWeight: "600", fontSize: 12 },
  metaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  metaPill: {
    backgroundColor: COLORS.soft,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 8,
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
  },
  metaText: { color: COLORS.muted, fontWeight: "800" },
  notesBox: {
    backgroundColor: "#FFF5F7",
    borderRadius: 14,
    padding: 12,
    marginBottom: 11,
    borderWidth: 1,
    borderColor: "#FFD6DE",
  },
  notesLabel: { color: COLORS.red, fontWeight: "900", marginBottom: 5 },
  notesText: { color: COLORS.text, fontWeight: "700", lineHeight: 20 },
  loadActions: { marginTop: 8 },
  actionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  primaryAction: {
    backgroundColor: COLORS.red,
    paddingHorizontal: 17,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButton: {
    paddingHorizontal: 13,
    paddingVertical: 12,
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  actionText: { color: "#FFFFFF", fontWeight: "900" },
  completedBadge: {
    backgroundColor: COLORS.green,
    padding: 13,
    borderRadius: 13,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  completedText: { color: "#FFFFFF", fontWeight: "900" },
});