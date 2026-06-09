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

import { getBackendUrl } from "../services/apiConfig";
import { supabase } from "../services/supabaseClient";

type DeliveryJob = {
  id: string;
  source?: "api_order" | "delivery_order" | "freight_load";
  order_id?: string;
  farmer_id?: string;
  customer_id?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  farmName?: string;
  productName?: string;
  loadType?: string;
  pickupCity?: string;
  deliveryCity?: string;
  pickupAddress?: string;
  dropoffAddress?: string;
  deliveryInfo?: any;
  deliveryFee?: number;
  freightTotal?: number;
  productTotal?: number;
  totalDue?: number;
  tip?: number;
  total?: number;
  estimatedMiles?: number;
  fulfillmentStatus?: string;
  status?: string;
  assignedDriverId?: string;
  assignedFreightCarrierId?: string;
  routeGroup?: string;
  created_at?: string;
};

type DriverProfile = {
  id?: string;
  driverId?: string;
  authUserId?: string;
  profileId?: string;
  fullName?: string;
  name?: string;
  username?: string;
  email?: string;
  role?: string;
  accountActive?: boolean;
  membershipStatus?: string;
  subscriptionStatus?: string;
};

const COLORS = {
  bg: "#F6F7FB",
  card: "#FFFFFF",
  text: "#151922",
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

function normalize(value: any) {
  return String(value || "").trim().toLowerCase();
}

function formatMoney(value: any) {
  return `$${Number(value || 0).toFixed(2)}`;
}

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
    () => selectedJobs.reduce((sum, job) => sum + payout(job), 0),
    [selectedJobs]
  );

  const selectedMiles = useMemo(
    () => selectedJobs.reduce((sum, job) => sum + Number(job.estimatedMiles || 0), 0),
    [selectedJobs]
  );

  async function getStoredDriver() {
    const rawDriver =
      (await AsyncStorage.getItem("currentDriver")) ||
      (await AsyncStorage.getItem("farm2homeCurrentDriver")) ||
      (await AsyncStorage.getItem("farm2homeDriverSession")) ||
      (await AsyncStorage.getItem("currentUser"));

    if (!rawDriver) return null;

    try {
      return JSON.parse(rawDriver);
    } catch {
      return null;
    }
  }

  async function getCurrentDriver(): Promise<DriverProfile | null> {
    const stored = await getStoredDriver();

    if (stored?.role && stored.role !== "driver") return null;

    const { data: authData } = await supabase.auth.getUser();
    const authUser = authData?.user;

    const authUserId =
      authUser?.id ||
      stored?.authUserId ||
      stored?.id ||
      stored?.driverId ||
      "";

    const authEmail = normalize(authUser?.email || stored?.email || "");

    let dbDriver: any = null;
    let profile: any = null;

    if (authUserId) {
      const result = await supabase
        .from("drivers")
        .select("*")
        .eq("id", authUserId)
        .maybeSingle();

      if (!result.error && result.data) dbDriver = result.data;
    }

    if (!dbDriver && authEmail) {
      const result = await supabase
        .from("drivers")
        .select("*")
        .eq("email", authEmail)
        .maybeSingle();

      if (!result.error && result.data) dbDriver = result.data;
    }

    if (authUserId) {
      const result = await supabase
        .from("profiles")
        .select("*")
        .eq("auth_user_id", authUserId)
        .eq("role", "driver")
        .maybeSingle();

      if (!result.error && result.data) profile = result.data;
    }

    if (!profile && authEmail) {
      const result = await supabase
        .from("profiles")
        .select("*")
        .eq("email", authEmail)
        .eq("role", "driver")
        .maybeSingle();

      if (!result.error && result.data) profile = result.data;
    }

    const stableId =
      dbDriver?.id ||
      stored?.id ||
      stored?.driverId ||
      authUserId ||
      profile?.auth_user_id ||
      "";

    if (!stableId) return null;

    const currentDriver: DriverProfile = {
      ...(stored || {}),
      ...(dbDriver || {}),
      id: stableId,
      driverId: stableId,
      authUserId: dbDriver?.auth_user_id || profile?.auth_user_id || authUserId,
      profileId: dbDriver?.profile_id || stored?.profileId || profile?.id || "",
      role: "driver",
      fullName:
        dbDriver?.full_name ||
        dbDriver?.name ||
        profile?.full_name ||
        stored?.fullName ||
        stored?.name ||
        "Farm2Home Driver",
      name:
        dbDriver?.name ||
        dbDriver?.full_name ||
        profile?.full_name ||
        stored?.name ||
        stored?.fullName ||
        "Farm2Home Driver",
      username: dbDriver?.username || profile?.username || stored?.username || "",
      email: normalize(dbDriver?.email || profile?.email || stored?.email || authEmail),
      accountActive:
        dbDriver?.account_active ??
        profile?.account_active ??
        stored?.accountActive ??
        true,
      membershipStatus:
        dbDriver?.membership_status || stored?.membershipStatus || "Active",
      subscriptionStatus:
        dbDriver?.subscription_status || stored?.subscriptionStatus || "active",
    };

    await AsyncStorage.setItem("currentDriver", JSON.stringify(currentDriver));
    await AsyncStorage.setItem("currentUser", JSON.stringify(currentDriver));
    await AsyncStorage.setItem("farm2homeCurrentDriver", JSON.stringify(currentDriver));
    await AsyncStorage.setItem("farm2homeDriverSession", JSON.stringify(currentDriver));
    await AsyncStorage.setItem("userRole", "driver");
    await AsyncStorage.setItem("currentUserRole", "driver");

    return currentDriver;
  }

  function driverHasAccess(currentDriver: DriverProfile) {
    const membershipStatus = normalize(currentDriver.membershipStatus);
    const subscriptionStatus = normalize(currentDriver.subscriptionStatus);

    if (currentDriver.accountActive === false) return false;
    if (membershipStatus === "canceled") return false;
    if (["canceled", "past_due", "unpaid"].includes(subscriptionStatus)) return false;

    return true;
  }

  async function initialize() {
    try {
      setAccessChecking(true);

      const currentDriver = await getCurrentDriver();

      if (!currentDriver) {
        router.replace("/driver/login" as any);
        return;
      }

      if (!driverHasAccess(currentDriver)) {
        Alert.alert(
          "Driver Membership Required",
          "Your driver account is inactive or subscription is not active."
        );
        router.replace("/driver/login" as any);
        return;
      }

      setDriver(currentDriver);
      await loadJobs();
    } catch (error) {
      console.log("Driver board initialize error:", error);
      Alert.alert("Driver Board Error", "Unable to load driver board.");
    } finally {
      setAccessChecking(false);
    }
  }

  function mapApiOrder(row: any): DeliveryJob {
    return {
      ...row,
      id: String(row.id),
      source: "api_order",
      customerName: row.customerName || row.customer_name || "Farm2Home Delivery",
      customerEmail: row.customerEmail || row.customer_email || "",
      customerPhone: row.customerPhone || row.customer_phone || "",
      pickupCity: row.pickupCity || row.pickup_city || row.pickupAddress || "",
      deliveryCity: row.deliveryCity || row.delivery_city || row.dropoffAddress || "",
      pickupAddress: row.pickupAddress || row.pickup_address || "",
      dropoffAddress: row.dropoffAddress || row.dropoff_address || "",
      deliveryFee: Number(row.deliveryFee || row.delivery_fee || row.payout_amount || 0),
      tip: Number(row.tip || 0),
      estimatedMiles: Number(row.estimatedMiles || row.miles || 0),
      status: row.status || row.fulfillmentStatus || "available",
    };
  }

  function mapDeliveryOrder(row: any): DeliveryJob {
    return {
      id: String(row.id),
      source: "delivery_order",
      order_id: row.order_id || "",
      farmer_id: row.farmer_id || "",
      customer_id: row.customer_id || "",
      farmName: row.farm_name || row.farmer_name || "Farm Delivery",
      customerName: row.customer_name || "Customer Delivery",
      customerPhone: row.customer_phone || "",
      pickupAddress: row.pickup_address || "",
      dropoffAddress: row.dropoff_address || "",
      pickupCity: row.pickup_city || row.pickup_address || "Pickup",
      deliveryCity: row.dropoff_city || row.dropoff_address || "Dropoff",
      deliveryFee: Number(row.delivery_fee || row.payout_amount || 0),
      estimatedMiles: Number(row.miles || 0),
      status: row.status || "available",
      assignedDriverId: row.driver_id || row.assigned_driver_id || "",
      routeGroup: row.source || "Farm2Driver Delivery",
      created_at: row.created_at || "",
    };
  }

  function mapFreightLoad(row: any): DeliveryJob {
    return {
      id: String(row.id),
      source: "freight_load",
      order_id: row.order_id || "",
      farmer_id: row.farmer_id || "",
      customer_id: row.customer_id || "",
      productName: row.product_name || "Farm Freight Load",
      loadType: row.load_type || "farm_freight",
      customerName: row.product_name || "Farm Freight Load",
      pickupAddress: row.pickup_address || "",
      dropoffAddress: row.dropoff_address || "",
      pickupCity: row.pickup_city || row.pickup_address || "Pickup",
      deliveryCity: row.dropoff_city || row.dropoff_address || "Dropoff",
      deliveryFee: Number(row.freight_total || row.delivery_fee || 0),
      freightTotal: Number(row.freight_total || 0),
      productTotal: Number(row.product_total || 0),
      totalDue: Number(row.total_due || 0),
      estimatedMiles: Number(row.miles || 0),
      status: row.status || "available",
      assignedDriverId: row.assigned_driver_id || "",
      routeGroup: "Farm Freight",
      created_at: row.created_at || "",
    };
  }

  async function loadJobs() {
    try {
      setRefreshing(true);

      const miles = Number(maxMiles || 9999);
      const safeMiles = Number.isFinite(miles) && miles > 0 ? miles : 9999;

      let allJobs: DeliveryJob[] = [];

      try {
        const response = await fetch(
          `${getBackendUrl()}/orders/driver-board?maxMiles=${safeMiles}`
        );

        const data = await response.json();

        if (response.ok && data.success) {
          const availableOrders = Array.isArray(data.availableOrders)
            ? data.availableOrders
            : [];

          allJobs = availableOrders.map(mapApiOrder);
        }
      } catch (apiError) {
        console.log("Driver board API fallback to Supabase:", apiError);
      }

      const { data: deliveryRows, error: deliveryError } = await supabase
        .from("delivery_orders")
        .select("*")
        .in("status", ["available", "posted", "open"])
        .order("created_at", { ascending: false });

      if (!deliveryError && Array.isArray(deliveryRows)) {
        allJobs = [...allJobs, ...deliveryRows.map(mapDeliveryOrder)];
      }

      const { data: freightRows, error: freightError } = await supabase
        .from("freight_loads")
        .select("*")
        .in("status", ["available", "posted", "open"])
        .order("created_at", { ascending: false });

      if (!freightError && Array.isArray(freightRows)) {
        allJobs = [...allJobs, ...freightRows.map(mapFreightLoad)];
      }

      const filtered = allJobs.filter((job) => {
        const jobMiles = Number(job.estimatedMiles || 0);
        if (!jobMiles) return true;
        return jobMiles <= safeMiles;
      });

      const unique = Array.from(
        new Map(filtered.map((job) => [`${job.source}_${job.id}`, job])).values()
      );

      setJobs(unique);
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
    return Number(job.deliveryFee || job.freightTotal || job.tip || 0);
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
          "Select deliveries from the same pickup area, dropoff area, or route direction."
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

      if (job.source === "api_order") {
        await acceptApiJob(job, currentDriver);
      } else if (job.source === "delivery_order") {
        await acceptDeliveryOrder(job, currentDriver);
      } else if (job.source === "freight_load") {
        await acceptFreightLoad(job, currentDriver);
      }

      Alert.alert("Delivery Accepted", "This job is now assigned to you.");
      setSelectedIds([]);
      await loadJobs();

      router.push("/driver/my-deliveries" as any);
    } catch (error: any) {
      console.log("Accept job error:", error);
      Alert.alert("Accept Error", error?.message || "Unable to accept job.");
    } finally {
      setLoading(false);
    }
  }

  async function acceptApiJob(job: DeliveryJob, currentDriver: DriverProfile) {
    const response = await fetch(`${getBackendUrl()}/orders/${job.id}/accept`, {
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
  }

  async function acceptDeliveryOrder(job: DeliveryJob, currentDriver: DriverProfile) {
    const { error } = await supabase
      .from("delivery_orders")
      .update({
        status: "accepted",
        driver_id: currentDriver.id,
        assigned_driver_id: currentDriver.id,
        driver_name: getDriverDisplayName(currentDriver),
        driver_email: currentDriver.email || "",
        assigned_at: new Date().toISOString(),
        accepted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    if (error) throw error;
  }

  async function acceptFreightLoad(job: DeliveryJob, currentDriver: DriverProfile) {
    const { error } = await supabase
      .from("freight_loads")
      .update({
        status: "accepted",
        assigned_driver_id: currentDriver.id,
        driver_name: getDriverDisplayName(currentDriver),
        driver_email: currentDriver.email || "",
        accepted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    if (error) throw error;

    await supabase.from("delivery_orders").insert({
      order_id: job.order_id || job.id,
      farmer_id: job.farmer_id || null,
      customer_id: job.customer_id || null,
      driver_id: currentDriver.id,
      assigned_driver_id: currentDriver.id,
      driver_name: getDriverDisplayName(currentDriver),
      driver_email: currentDriver.email || "",
      pickup_address: job.pickupAddress || "",
      dropoff_address: job.dropoffAddress || "",
      miles: Number(job.estimatedMiles || 0),
      delivery_fee: payout(job),
      status: "accepted",
      source: "freight_load",
      assigned_at: new Date().toISOString(),
      accepted_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
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

      for (const job of selectedJobs) {
        if (job.source === "api_order") await acceptApiJob(job, currentDriver);
        if (job.source === "delivery_order") await acceptDeliveryOrder(job, currentDriver);
        if (job.source === "freight_load") await acceptFreightLoad(job, currentDriver);
      }

      Alert.alert("Batch Accepted", `${selectedJobs.length} deliveries assigned to you.`);

      setSelectedIds([]);
      await loadJobs();
      router.push("/driver/my-deliveries" as any);
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

  function statusColor(status?: string) {
    const normalized = String(status || "").toUpperCase();

    switch (normalized) {
      case "OPEN":
      case "POSTED":
      case "NEW":
      case "AVAILABLE":
        return COLORS.blue;
      case "BOOKED":
      case "ACCEPTED":
        return COLORS.purple;
      case "PICKED_UP":
        return COLORS.orange;
      case "IN_TRANSIT":
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
    const title =
      item.productName ||
      item.farmName ||
      item.customerName ||
      item.customerEmail ||
      "Farm2Home Delivery";

    return (
      <View style={[styles.jobCard, selected && styles.selectedCard]}>
        <View style={styles.jobHeader}>
          <View style={styles.jobIcon}>
            <Ionicons
              name={item.source === "freight_load" ? "cube" : "bag-handle"}
              size={21}
              color={COLORS.red}
            />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.farmName}>{title}</Text>
            <Text style={styles.routeGroup}>
              {item.routeGroup || item.loadType || "Local driver delivery"}
            </Text>
          </View>

          <View style={[styles.badge, { backgroundColor: statusColor(status) }]}>
            <Text style={styles.badgeText}>{formatStatus(status)}</Text>
          </View>
        </View>

        <View style={styles.routeCard}>
          <View style={styles.routeStop}>
            <View style={styles.routeDotStart} />
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Sender / Pickup</Text>
              <Text style={styles.value}>{pickup}</Text>
            </View>
          </View>

          <View style={styles.routeLine} />

          <View style={styles.routeStop}>
            <View style={styles.routeDotEnd} />
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Receiver / Dropoff</Text>
              <Text style={styles.value}>{delivery}</Text>
            </View>
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaBox}>
            <Ionicons name="navigate-outline" size={16} color={COLORS.red} />
            <Text style={styles.metaLabel}>Miles</Text>
            <Text style={styles.metaValue}>
              {Number(item.estimatedMiles || 0).toFixed(1)}
            </Text>
          </View>

          <View style={styles.metaBox}>
            <Ionicons name="cash-outline" size={16} color={COLORS.red} />
            <Text style={styles.metaLabel}>Payout</Text>
            <Text style={styles.metaValue}>{formatMoney(payout(item))}</Text>
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
        <StatusBar barStyle="light-content" backgroundColor={COLORS.red} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.red} />
          <Text style={styles.centeredText}>Loading Driver Board...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.red} />

      <View style={styles.container}>
        <FlatList
          data={jobs}
          keyExtractor={(item, index) => `${item.source}_${item.id}_${index}`}
          renderItem={renderJob}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refreshBoard} />
          }
          ListHeaderComponent={
            <View style={styles.headerBox}>
              <View style={styles.hero}>
                <View style={styles.heroTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.eyebrow}>Farm2Driver</Text>
                    <Text style={styles.header}>Driver Board</Text>
                    <Text style={styles.subheader}>
                      Select available farm delivery, grocery, and freight shipments.
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.profileButton}
                    onPress={() => router.push("/driver/profile" as any)}
                  >
                    <Ionicons name="person" size={24} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.topActions}>
                <TouchableOpacity
                  style={styles.topActionButton}
                  onPress={() => router.push("/driver/my-deliveries" as any)}
                >
                  <Ionicons name="cube-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.topActionText}>My Shipments</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.topActionOutline}
                  onPress={() => router.push("/driver/mobile-driver-app" as any)}
                >
                  <Ionicons name="home-outline" size={18} color={COLORS.red} />
                  <Text style={styles.topActionOutlineText}>Home</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.filterCard}>
                <Text style={styles.filterLabel}>Search Radius</Text>
                <Text style={styles.filterHint}>
                  Enter the max miles you are willing to travel for pickup or delivery.
                </Text>

                <View style={styles.searchRow}>
                  <TextInput
                    style={styles.input}
                    value={maxMiles}
                    onChangeText={setMaxMiles}
                    keyboardType="numeric"
                    placeholder="50"
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
                      <Ionicons name="search" size={20} color="#FFFFFF" />
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {selectedJobs.length > 0 && (
                <View style={styles.batchBox}>
                  <View style={styles.batchHeader}>
                    <Ionicons name="layers-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.batchTitle}>
                      {selectedJobs.length} selected
                    </Text>
                  </View>

                  <Text style={styles.batchText}>
                    Total payout: {formatMoney(selectedPayout)} · Total miles:{" "}
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
                    <Text style={styles.clearButtonText}>Clear Selection</Text>
                  </TouchableOpacity>
                </View>
              )}

              <Text style={styles.sectionTitle}>Available Shipments</Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="cube-outline" size={38} color={COLORS.red} />
              <Text style={styles.emptyTitle}>No deliveries available</Text>
              <Text style={styles.emptyText}>
                Pull down to refresh. New farmer delivery and freight jobs will appear here.
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
  safe: { flex: 1, backgroundColor: COLORS.bg },
  container: { flex: 1, backgroundColor: COLORS.bg },
  centered: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  centeredText: {
    color: COLORS.muted,
    marginTop: 12,
    textAlign: "center",
    fontWeight: "800",
    lineHeight: 22,
  },
  content: { paddingBottom: 120 },
  headerBox: { marginBottom: 4 },
  hero: {
    backgroundColor: COLORS.red,
    paddingTop: 18,
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 14 },
  eyebrow: {
    color: "#FFE6EA",
    fontWeight: "900",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontSize: 12,
  },
  header: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "900",
  },
  subheader: {
    color: "#FFFFFF",
    opacity: 0.9,
    lineHeight: 20,
    fontWeight: "700",
    fontSize: 13,
    marginTop: 4,
  },
  profileButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  topActions: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    marginTop: -18,
    marginBottom: 14,
  },
  topActionButton: {
    flex: 1,
    backgroundColor: COLORS.red,
    padding: 14,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  topActionOutline: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  topActionText: { color: "#FFFFFF", fontWeight: "900" },
  topActionOutlineText: {
    color: COLORS.red,
    fontWeight: "900",
  },
  filterCard: {
    backgroundColor: COLORS.card,
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterLabel: {
    color: COLORS.text,
    fontWeight: "900",
    marginBottom: 4,
    fontSize: 16,
  },
  filterHint: {
    color: COLORS.muted,
    fontWeight: "700",
    marginBottom: 10,
    lineHeight: 19,
  },
  searchRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.soft,
    borderRadius: 14,
    padding: 13,
    color: COLORS.text,
    fontWeight: "900",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  refreshButton: {
    backgroundColor: COLORS.red,
    width: 50,
    height: 50,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  batchBox: {
    backgroundColor: COLORS.black,
    borderRadius: 18,
    padding: 15,
    marginHorizontal: 16,
    marginBottom: 14,
  },
  batchHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  batchTitle: { color: "#FFFFFF", fontWeight: "900", fontSize: 16 },
  batchText: { color: "#E5E7EB", fontWeight: "800", marginTop: 8 },
  batchButton: {
    backgroundColor: COLORS.red,
    padding: 13,
    borderRadius: 14,
    marginTop: 12,
    alignItems: "center",
  },
  clearButton: {
    backgroundColor: "#374151",
    padding: 13,
    borderRadius: 14,
    marginTop: 9,
    alignItems: "center",
  },
  batchButtonText: { color: "#FFFFFF", fontWeight: "900" },
  clearButtonText: { color: "#FFFFFF", fontWeight: "900" },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "900",
    paddingHorizontal: 16,
    marginTop: 2,
    marginBottom: 12,
  },
  jobCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 15,
    marginHorizontal: 16,
    marginBottom: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  selectedCard: {
    borderColor: COLORS.red,
    backgroundColor: "#FFF7F8",
  },
  jobHeader: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    marginBottom: 12,
  },
  jobIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: COLORS.redSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  farmName: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900",
  },
  routeGroup: {
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 3,
    fontSize: 12,
  },
  badge: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
    maxWidth: 140,
  },
  badgeText: { color: "#FFFFFF", fontWeight: "900", fontSize: 10 },
  routeCard: {
    backgroundColor: COLORS.soft,
    borderRadius: 16,
    padding: 13,
    marginBottom: 12,
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
    height: 22,
    backgroundColor: COLORS.border,
    marginLeft: 5,
    marginVertical: 7,
  },
  label: {
    color: COLORS.red,
    fontWeight: "900",
    fontSize: 11,
    textTransform: "uppercase",
  },
  value: {
    color: COLORS.text,
    fontWeight: "900",
    lineHeight: 20,
    marginTop: 2,
    fontSize: 13,
  },
  metaRow: { flexDirection: "row", gap: 10, marginBottom: 4 },
  metaBox: {
    flex: 1,
    backgroundColor: COLORS.soft,
    borderRadius: 14,
    padding: 12,
  },
  metaLabel: {
    color: COLORS.muted,
    fontWeight: "900",
    marginTop: 5,
    fontSize: 11,
  },
  metaValue: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 17,
    marginTop: 3,
  },
  selectButton: {
    backgroundColor: COLORS.blue,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 15,
    flexDirection: "row",
    gap: 8,
  },
  unselectButton: {
    backgroundColor: COLORS.black,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 15,
    flexDirection: "row",
    gap: 8,
  },
  selectButtonText: { color: "#FFFFFF", fontWeight: "900" },
  acceptButton: {
    backgroundColor: COLORS.red,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 9,
    flexDirection: "row",
    gap: 8,
  },
  acceptButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 15,
  },
  disabled: { opacity: 0.6 },
  emptyBox: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 10,
  },
  emptyText: {
    color: COLORS.muted,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 21,
    fontWeight: "700",
    fontSize: 13,
  },
});