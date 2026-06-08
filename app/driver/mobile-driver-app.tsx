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

import { API_BASE_URL } from "../config/api";
import { supabase } from "../services/supabaseClient";
import freightTheme from "../styles/freightTheme";

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

const ACTIVE_STATUSES = [
  "ACCEPTED",
  "BOOKED",
  "READY",
  "ARRIVED_PICKUP",
  "ARRIVED_PICKUP",
  "ARRIVED_PICKUP",
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

      if (!driverResult.error && driverResult.data) {
        dbDriver = driverResult.data;
      }
    }

    if (!dbDriver && authEmail) {
      const driverResult = await supabase
        .from("drivers")
        .select("*")
        .eq("email", authEmail)
        .maybeSingle();

      if (!driverResult.error && driverResult.data) {
        dbDriver = driverResult.data;
      }
    }

    if (authUserId) {
      const profileResult = await supabase
        .from("profiles")
        .select("*")
        .eq("auth_user_id", authUserId)
        .eq("role", "driver")
        .maybeSingle();

      if (!profileResult.error && profileResult.data) {
        profile = profileResult.data;
      }
    }

    if (!profile && authEmail) {
      const profileResult = await supabase
        .from("profiles")
        .select("*")
        .eq("email", authEmail)
        .eq("role", "driver")
        .maybeSingle();

      if (!profileResult.error && profileResult.data) {
        profile = profileResult.data;
      }
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
    if (subscriptionStatus === "canceled") return false;
    if (subscriptionStatus === "past_due") return false;
    if (subscriptionStatus === "unpaid") return false;
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

    try {
      const response = await fetch(`${API_BASE_URL}/orders`);
      const data = await response.json();

      if (response.ok && Array.isArray(data.orders)) {
        const mapped = data.orders
          .filter((order: any) => {
            const status = normalizeStatusValue(order.fulfillmentStatus || order.status || "NEW");

            const assignedToMe =
              order.assignedDriverId === activeDriverId ||
              order.driverId === activeDriverId;

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

    const { data: deliveryRows, error: deliveryError } = await supabase
      .from("delivery_orders")
      .select("*")
      .or(
        `driver_id.eq.${activeDriverId},assigned_driver_id.eq.${activeDriverId},status.in.(available,posted,open)`
      )
      .order("created_at", { ascending: false });

    if (!deliveryError && Array.isArray(deliveryRows)) {
      all.push(...deliveryRows.map(mapDeliveryOrder));
    }

    const { data: freightRows, error: freightError } = await supabase
      .from("freight_loads")
      .select("*")
      .or(`assigned_driver_id.eq.${activeDriverId},status.in.(available,posted,open)`)
      .order("created_at", { ascending: false });

    if (!freightError && Array.isArray(freightRows)) {
      all.push(...freightRows.map(mapFreightLoad));
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

      if (load.source === "api_order") {
        await acceptApiOrder(load, currentDriver);
      } else if (load.source === "delivery_order") {
        await acceptDeliveryOrder(load, currentDriver);
      } else if (load.source === "freight_load") {
        await acceptFreightLoad(load, currentDriver);
      }

      Alert.alert("Accepted", "This delivery is now assigned to you.");
      await loadDriverDashboard();
    } catch (error: any) {
      Alert.alert("Accept Error", error.message || "Unable to accept load.");
    } finally {
      setLoading(false);
    }
  }

  async function acceptApiOrder(load: DriverLoad, driver: DriverProfile) {
    const response = await fetch(`${API_BASE_URL}/orders/${load.id}/accept`, {
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
        assigned_driver_id: driver.id,
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
        assigned_driver_id: driver.id,
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
      assigned_driver_id: driver.id,
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
        const response = await fetch(`${API_BASE_URL}/orders/${load.id}/status`, {
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

      const payload = {
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
      };

      await supabase.from("driver_locations").insert(payload);
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
        return "#2563EB";
      case "BOOKED":
      case "ACCEPTED":
      case "READY":
        return "#7C3AED";
      case "ARRIVED_PICKUP":
        return "#0EA5E9";
      case "PICKED_UP":
        return "#F59E0B";
      case "IN_TRANSIT":
      case "ARRIVED_DROPOFF":
        return "#0F766E";
      case "DELIVERED":
      case "COMPLETED":
        return "#10B981";
      case "CANCELLED":
        return "#DC2626";
      default:
        return "#64748B";
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
        <TouchableOpacity
          style={styles.acceptButton}
          onPress={() => acceptLoad(load)}
          disabled={loading}
        >
          <Text style={styles.actionText}>Accept Delivery</Text>
        </TouchableOpacity>
      );
    }

    if (status === "BOOKED" || status === "ACCEPTED" || status === "READY") {
      return (
        <View style={styles.actionGrid}>
          <TouchableOpacity
            style={styles.blueButton}
            onPress={() => openLiveLocation(load)}
            disabled={loading}
          >
            <Text style={styles.actionText}>Live Tracking</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.orangeButton}
            onPress={() => updateLoadStatus(load, "arrived_pickup")}
            disabled={loading}
          >
            <Text style={styles.actionText}>Arrived Pickup</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.greenButton}
            onPress={() => openProofPickup(load)}
            disabled={loading}
          >
            <Text style={styles.actionText}>Proof Pickup</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (status === "PICKED_UP") {
      return (
        <View style={styles.actionGrid}>
          <TouchableOpacity
            style={styles.blueButton}
            onPress={() => updateLoadStatus(load, "in_transit")}
            disabled={loading}
          >
            <Text style={styles.actionText}>Start Delivery</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.mapButton}
            onPress={() => openLiveLocation(load)}
            disabled={loading}
          >
            <Text style={styles.actionText}>Live Tracking</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (status === "IN_TRANSIT" || status === "ARRIVED_DROPOFF") {
      return (
        <View style={styles.actionGrid}>
          <TouchableOpacity
            style={styles.orangeButton}
            onPress={() => updateLoadStatus(load, "arrived_dropoff")}
            disabled={loading}
          >
            <Text style={styles.actionText}>Arrived Dropoff</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.proofButton}
            onPress={() => openProofDelivery(load)}
            disabled={loading}
          >
            <Text style={styles.actionText}>Proof Delivery</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (status === "DELIVERED" || status === "COMPLETED") {
      return (
        <View style={styles.completedBadge}>
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

    const deliveryText = `${
      item.delivery_city || item.dropoffAddress || "Delivery"
    } ${item.delivery_state || ""}`.trim();

    return (
      <View style={styles.loadCard}>
        <TouchableOpacity onPress={() => openLoadDetails(item)}>
          <View style={styles.loadHeader}>
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
            <Ionicons name="radio-button-on" size={16} color="#10B981" />
            <View style={{ flex: 1 }}>
              <Text style={styles.routeLabel}>Pickup</Text>
              <Text style={styles.routeText}>{pickupText}</Text>
              {!!item.pickupAddress && (
                <Text style={styles.routeSubText}>{item.pickupAddress}</Text>
              )}
            </View>
            <Ionicons name="open-outline" size={16} color="#94A3B8" />
          </TouchableOpacity>

          <View style={styles.routeLine} />

          <TouchableOpacity
            style={styles.routeStop}
            onPress={() => openMap(item.dropoffAddress || deliveryText)}
          >
            <Ionicons name="location" size={16} color="#10B981" />
            <View style={{ flex: 1 }}>
              <Text style={styles.routeLabel}>Dropoff</Text>
              <Text style={styles.routeText}>{deliveryText}</Text>
              {!!item.dropoffAddress && (
                <Text style={styles.routeSubText}>{item.dropoffAddress}</Text>
              )}
            </View>
            <Ionicons name="open-outline" size={16} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        <View style={styles.metaGrid}>
          <View style={styles.metaPill}>
            <Text style={styles.metaText}>{money(item.rate || item.deliveryFee)}</Text>
          </View>

          <TouchableOpacity
            style={styles.metaPill}
            onPress={() => callCustomer(item.customerPhone)}
          >
            <Text style={styles.metaText}>Customer</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.metaPill} onPress={() => openLoadDetails(item)}>
            <Text style={styles.metaText}>Details</Text>
          </TouchableOpacity>
        </View>

        {!!item.notes && (
          <View style={styles.notesBox}>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text style={styles.notesText}>{item.notes}</Text>
          </View>
        )}

        <View style={styles.loadActions}>{renderActions(item)}</View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#020617" />

      <View style={styles.container}>
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>Driver Operations</Text>
              <Text style={styles.title}>Driver Hub</Text>
              <Text style={styles.subtitle}>
                Manage boards, active deliveries, location, proofs, earnings, and profile settings.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.profileCircle}
              onPress={() => router.push("/driver/profile" as any)}
            >
              <Ionicons name="person-circle-outline" size={32} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.navGrid}>
          <NavButton title="Board" onPress={() => router.push("/driver/board" as any)} />
          <NavButton title="My Deliveries" onPress={() => router.push("/driver/my-deliveries" as any)} />
          <NavButton title="Earnings" onPress={() => router.push("/driver/earnings" as any)} />
          <NavButton title="Profile" onPress={() => router.push("/driver/profile" as any)} />
        </View>

        {loading && loads.length === 0 ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={freightTheme.colors.primary} />
            <Text style={styles.loadingText}>Loading driver hub...</Text>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={refreshDashboard} />
            }
          >
            <View style={styles.driverCard}>
              <Text style={styles.driverName}>{driverName}</Text>
              <Text style={styles.driverMeta}>
                Manage active Farm2Home orders and delivery workflow.
              </Text>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.openLoads}</Text>
                <Text style={styles.statLabel}>Open</Text>
              </View>

              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.activeLoads}</Text>
                <Text style={styles.statLabel}>Active</Text>
              </View>

              <View style={styles.statCard}>
                <Text style={styles.statValue}>{stats.completedLoads}</Text>
                <Text style={styles.statLabel}>Done</Text>
              </View>
            </View>

            <View style={styles.earningsCard}>
              <View>
                <Text style={styles.earningsLabel}>Completed Delivery Earnings</Text>
                <Text style={styles.earningsValue}>{money(stats.earnings)}</Text>
              </View>
            </View>

            {activeDriverLoads.length > 0 && (
              <View style={styles.activeNotice}>
                <Text style={styles.activeNoticeText}>
                  You have {activeDriverLoads.length} active delivery workflow
                  {activeDriverLoads.length > 1 ? "s" : ""}.
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.refreshButton}
              onPress={loadDriverDashboard}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.refreshText}>Refresh Deliveries</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.sectionTitle}>Available and Assigned Deliveries</Text>

            <FlatList
              data={loads}
              keyExtractor={(item, index) => `${item.source}_${item.id}_${index}`}
              scrollEnabled={false}
              contentContainerStyle={{ paddingBottom: 110 }}
              ListEmptyComponent={
                <View style={styles.emptyCard}>
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

function NavButton({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.navButton} onPress={onPress}>
      <Text style={styles.navText}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: freightTheme.colors.background },
  container: { flex: 1, backgroundColor: freightTheme.colors.background },
  hero: {
    backgroundColor: "#020617",
    paddingTop: 18,
    paddingHorizontal: 20,
    paddingBottom: 22,
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
  },
  heroTop: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  profileCircle: {
    width: 48,
    height: 48,
    borderRadius: 16,
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
    fontSize: 12,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "900",
    marginBottom: 8,
  },
  subtitle: {
    color: "#D1D5DB",
    lineHeight: 22,
    fontSize: 14,
    fontWeight: "600",
  },
  navGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    padding: 16,
  },
  navButton: {
    width: "48%",
    backgroundColor: freightTheme.colors.card,
    borderWidth: 1,
    borderColor: freightTheme.colors.primary,
    padding: 13,
    borderRadius: 13,
    alignItems: "center",
  },
  navText: {
    color: freightTheme.colors.primary,
    fontWeight: "900",
  },
  loadingCard: {
    backgroundColor: freightTheme.colors.card,
    margin: 18,
    padding: 24,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
  },
  loadingText: {
    color: freightTheme.colors.mutedText,
    marginTop: 10,
    fontWeight: "800",
  },
  driverCard: {
    backgroundColor: freightTheme.colors.card,
    marginHorizontal: 18,
    marginBottom: 14,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
  },
  driverName: {
    color: freightTheme.colors.text,
    fontSize: 21,
    fontWeight: "900",
    marginBottom: 5,
  },
  driverMeta: {
    color: freightTheme.colors.mutedText,
    fontWeight: "700",
    lineHeight: 21,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: freightTheme.colors.card,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
    borderRadius: 16,
    padding: 13,
    alignItems: "center",
  },
  statValue: {
    color: freightTheme.colors.primary,
    fontSize: 23,
    fontWeight: "900",
  },
  statLabel: {
    color: freightTheme.colors.mutedText,
    fontWeight: "800",
    marginTop: 4,
  },
  earningsCard: {
    backgroundColor: "#064E3B",
    marginHorizontal: 18,
    marginBottom: 14,
    borderRadius: 16,
    padding: 16,
  },
  earningsLabel: { color: "#BBF7D0", fontWeight: "900", marginBottom: 6 },
  earningsValue: { color: "#FFFFFF", fontSize: 28, fontWeight: "900" },
  activeNotice: {
    backgroundColor: "#052E2B",
    marginHorizontal: 18,
    marginBottom: 14,
    borderRadius: 14,
    padding: 13,
    borderWidth: 1,
    borderColor: "#0F766E",
  },
  activeNoticeText: {
    color: "#CCFBF1",
    fontWeight: "800",
    lineHeight: 20,
  },
  refreshButton: {
    backgroundColor: "#334155",
    marginHorizontal: 18,
    padding: 14,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  refreshText: { color: "#FFFFFF", fontWeight: "900" },
  sectionTitle: {
    color: freightTheme.colors.text,
    fontSize: 22,
    fontWeight: "900",
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  emptyCard: {
    backgroundColor: freightTheme.colors.card,
    marginHorizontal: 18,
    padding: 22,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
    alignItems: "center",
  },
  emptyTitle: {
    color: freightTheme.colors.text,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 6,
  },
  emptyText: {
    color: freightTheme.colors.mutedText,
    lineHeight: 21,
    fontWeight: "700",
    textAlign: "center",
  },
  emptyButton: {
    backgroundColor: freightTheme.colors.primary,
    marginTop: 15,
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 13,
  },
  emptyButtonText: { color: "#FFFFFF", fontWeight: "900" },
  loadCard: {
    backgroundColor: freightTheme.colors.card,
    marginHorizontal: 18,
    marginBottom: 14,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
  },
  loadHeader: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
    alignItems: "flex-start",
  },
  loadTitle: {
    color: freightTheme.colors.text,
    fontSize: 19,
    fontWeight: "900",
  },
  commodity: {
    color: freightTheme.colors.mutedText,
    fontWeight: "700",
    marginTop: 3,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    maxWidth: 145,
  },
  statusText: { color: "#FFFFFF", fontWeight: "900", fontSize: 10 },
  routeBox: {
    backgroundColor: freightTheme.colors.surface,
    padding: 13,
    borderRadius: 13,
    marginBottom: 11,
  },
  routeStop: { flexDirection: "row", alignItems: "center", gap: 10 },
  routeLine: {
    width: 2,
    height: 21,
    backgroundColor: freightTheme.colors.border,
    marginLeft: 7,
    marginVertical: 7,
  },
  routeLabel: {
    color: freightTheme.colors.primary,
    fontWeight: "900",
    fontSize: 11,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  routeText: {
    color: freightTheme.colors.text,
    fontWeight: "900",
    fontSize: 14,
  },
  routeSubText: {
    color: freightTheme.colors.mutedText,
    marginTop: 2,
    fontWeight: "600",
    fontSize: 12,
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  metaPill: {
    backgroundColor: freightTheme.colors.surface,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  metaText: {
    color: freightTheme.colors.mutedText,
    fontWeight: "800",
  },
  notesBox: {
    backgroundColor: "#0F172A",
    borderRadius: 13,
    padding: 12,
    marginBottom: 11,
    borderWidth: 1,
    borderColor: "#1E293B",
  },
  notesLabel: {
    color: freightTheme.colors.primary,
    fontWeight: "900",
    marginBottom: 5,
  },
  notesText: {
    color: "#E5E7EB",
    fontWeight: "700",
    lineHeight: 20,
  },
  loadActions: { marginTop: 8 },
  actionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  acceptButton: {
    backgroundColor: freightTheme.colors.primary,
    paddingHorizontal: 17,
    paddingVertical: 13,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  blueButton: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 13,
    paddingVertical: 12,
    borderRadius: 12,
  },
  orangeButton: {
    backgroundColor: "#F59E0B",
    paddingHorizontal: 13,
    paddingVertical: 12,
    borderRadius: 12,
  },
  greenButton: {
    backgroundColor: "#10B981",
    paddingHorizontal: 13,
    paddingVertical: 12,
    borderRadius: 12,
  },
  mapButton: {
    backgroundColor: "#334155",
    paddingHorizontal: 13,
    paddingVertical: 12,
    borderRadius: 12,
  },
  proofButton: {
    backgroundColor: "#7C3AED",
    paddingHorizontal: 13,
    paddingVertical: 12,
    borderRadius: 12,
  },
  actionText: { color: "#FFFFFF", fontWeight: "900" },
  completedBadge: {
    backgroundColor: "#10B981",
    padding: 13,
    borderRadius: 13,
    alignItems: "center",
  },
  completedText: { color: "#FFFFFF", fontWeight: "900" },
});