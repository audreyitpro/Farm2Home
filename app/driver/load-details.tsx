// app/driver/load-details.tsx

import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";

import { API_BASE_URL } from "../config/api";
import { supabase } from "../services/supabaseClient";
import freightTheme from "../styles/freightTheme";

type DriverProfile = {
  id?: string;
  driverId?: string;
  fullName?: string;
  name?: string;
  username?: string;
  email?: string;
};

type LoadDetails = {
  id: string;
  source: "delivery_order" | "freight_load" | "api_order";
  order_id?: string;
  farmer_id?: string;
  customer_id?: string;
  title?: string;
  load_type?: string;
  product_name?: string;
  farm_name?: string;
  customer_name?: string;
  customer_phone?: string;
  pickup_address?: string;
  dropoff_address?: string;
  miles?: number;
  delivery_fee?: number;
  freight_total?: number;
  product_total?: number;
  total_due?: number;
  status?: string;
  pickup_notes?: string;
  delivery_notes?: string;
  created_at?: string;
};

function getParamString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

function normalize(value: any) {
  return String(value || "").trim().toLowerCase();
}

function money(value: any) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function formatStatus(value?: string) {
  return String(value || "Available")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function DriverLoadDetailsScreen() {
  const params = useLocalSearchParams();

  const loadId = getParamString(params.loadId || params.id);
  const orderId = getParamString(params.orderId);
  const sourceParam = getParamString(params.source);

  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [driver, setDriver] = useState<DriverProfile | null>(null);
  const [load, setLoad] = useState<LoadDetails | null>(null);

  const payout = useMemo(() => {
    return Number(load?.delivery_fee || load?.freight_total || 0);
  }, [load]);

  useEffect(() => {
    initialize();
  }, [loadId, orderId]);

  async function initialize() {
    try {
      setLoading(true);

      const currentDriver = await getCurrentDriver();

      if (!currentDriver?.id) {
        router.replace("/driver/login" as any);
        return;
      }

      setDriver(currentDriver);

      const loaded = await loadDetails();
      setLoad(loaded);
    } catch (error: any) {
      Alert.alert("Load Error", error?.message || "Unable to load details.");
    } finally {
      setLoading(false);
    }
  }

  async function getStoredDriver() {
    const raw =
      (await AsyncStorage.getItem("currentDriver")) ||
      (await AsyncStorage.getItem("farm2homeCurrentDriver")) ||
      (await AsyncStorage.getItem("farm2homeDriverSession")) ||
      (await AsyncStorage.getItem("currentUser"));

    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async function getCurrentDriver() {
    const stored = await getStoredDriver();

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

    const stableId =
      dbDriver?.id ||
      stored?.id ||
      stored?.driverId ||
      authUserId ||
      "";

    if (!stableId) return null;

    const currentDriver = {
      ...(stored || {}),
      ...(dbDriver || {}),
      id: stableId,
      driverId: stableId,
      role: "driver",
      fullName:
        dbDriver?.full_name ||
        dbDriver?.name ||
        stored?.fullName ||
        stored?.name ||
        stored?.username ||
        "Farm2Home Driver",
      name:
        dbDriver?.name ||
        dbDriver?.full_name ||
        stored?.name ||
        stored?.fullName ||
        "Farm2Home Driver",
      email: normalize(dbDriver?.email || stored?.email || authEmail),
    };

    await AsyncStorage.setItem("currentDriver", JSON.stringify(currentDriver));
    await AsyncStorage.setItem("currentUser", JSON.stringify(currentDriver));
    await AsyncStorage.setItem("farm2homeCurrentDriver", JSON.stringify(currentDriver));
    await AsyncStorage.setItem("farm2homeDriverSession", JSON.stringify(currentDriver));
    await AsyncStorage.setItem("userRole", "driver");
    await AsyncStorage.setItem("currentUserRole", "driver");

    return currentDriver;
  }

  function driverDisplayName(currentDriver?: DriverProfile | null) {
    return (
      currentDriver?.fullName ||
      currentDriver?.name ||
      currentDriver?.username ||
      currentDriver?.email ||
      "Farm2Home Driver"
    );
  }

  async function loadDetails(): Promise<LoadDetails | null> {
    if (!loadId && !orderId) return null;

    if (sourceParam === "freight_load" || (!sourceParam && loadId)) {
      const { data } = await supabase
        .from("freight_loads")
        .select("*")
        .eq("id", loadId)
        .maybeSingle();

      if (data) return mapFreightLoad(data);
    }

    if (sourceParam === "delivery_order" || !sourceParam) {
      const target = loadId || orderId;

      let query = supabase.from("delivery_orders").select("*");

      if (loadId) query = query.eq("id", loadId);
      else query = query.eq("order_id", target);

      const { data } = await query.maybeSingle();

      if (data) return mapDeliveryOrder(data);
    }

    if (orderId || loadId) {
      try {
        const id = orderId || loadId;

        const response = await fetch(`${API_BASE_URL}/orders/${id}`);

        const data = await response.json();

        if (response.ok && data?.order) {
          return mapApiOrder(data.order);
        }
      } catch (error) {
        console.log("API order detail fallback skipped:", error);
      }
    }

    return null;
  }

  function mapDeliveryOrder(row: any): LoadDetails {
    return {
      id: String(row.id),
      source: "delivery_order",
      order_id: row.order_id || "",
      farmer_id: row.farmer_id || "",
      customer_id: row.customer_id || "",
      title: row.farm_name || row.farmer_name || "Farm Delivery",
      customer_name: row.customer_name || "",
      customer_phone: row.customer_phone || "",
      pickup_address: row.pickup_address || "",
      dropoff_address: row.dropoff_address || "",
      miles: Number(row.miles || 0),
      delivery_fee: Number(row.delivery_fee || row.payout_amount || 0),
      status: row.status || "available",
      pickup_notes: row.pickup_notes || "",
      delivery_notes: row.delivery_notes || "",
      created_at: row.created_at || "",
    };
  }

  function mapFreightLoad(row: any): LoadDetails {
    return {
      id: String(row.id),
      source: "freight_load",
      order_id: row.order_id || "",
      farmer_id: row.farmer_id || "",
      customer_id: row.customer_id || "",
      title: row.product_name || "Farm Freight Load",
      product_name: row.product_name || "",
      load_type: row.load_type || "Farm Freight",
      pickup_address: row.pickup_address || "",
      dropoff_address: row.dropoff_address || "",
      miles: Number(row.miles || 0),
      delivery_fee: Number(row.freight_total || row.delivery_fee || 0),
      freight_total: Number(row.freight_total || 0),
      product_total: Number(row.product_total || 0),
      total_due: Number(row.total_due || 0),
      status: row.status || "available",
      pickup_notes: row.pickup_notes || "",
      delivery_notes: row.delivery_notes || "",
      created_at: row.created_at || "",
    };
  }

  function mapApiOrder(row: any): LoadDetails {
    return {
      id: String(row.id),
      source: "api_order",
      order_id: row.id || "",
      title: row.customerName || row.customerEmail || "Farm2Home Delivery",
      customer_name: row.customerName || "",
      customer_phone: row.customerPhone || "",
      pickup_address: row.pickupAddress || row.pickup_address || "",
      dropoff_address: row.dropoffAddress || row.dropoff_address || "",
      miles: Number(row.estimatedMiles || row.miles || 0),
      delivery_fee: Number(row.deliveryFee || row.delivery_fee || row.tip || 0),
      status: row.status || row.fulfillmentStatus || "available",
      pickup_notes: row.pickupNotes || row.pickup_notes || "",
      delivery_notes: row.deliveryNotes || row.delivery_notes || "",
      created_at: row.created_at || "",
    };
  }

  async function acceptLoad() {
    if (!load || !driver?.id) return;

    try {
      setAccepting(true);

      if (load.source === "delivery_order") {
        await acceptDeliveryOrder();
      } else if (load.source === "freight_load") {
        await acceptFreightLoad();
      } else {
        await acceptApiOrder();
      }

      Alert.alert("Accepted", "This load is now assigned to you.", [
        {
          text: "My Deliveries",
          onPress: () => router.replace("/driver/my-deliveries" as any),
        },
      ]);
    } catch (error: any) {
      Alert.alert("Accept Error", error?.message || "Unable to accept load.");
    } finally {
      setAccepting(false);
    }
  }

  async function acceptDeliveryOrder() {
    if (!load || !driver?.id) return;

    const { error } = await supabase
      .from("delivery_orders")
      .update({
        status: "accepted",
        driver_id: driver.id,
        assigned_driver_id: driver.id,
        driver_name: driverDisplayName(driver),
        driver_email: driver.email || "",
        assigned_at: new Date().toISOString(),
        accepted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", load.id);

    if (error) throw error;
  }

  async function acceptFreightLoad() {
    if (!load || !driver?.id) return;

    const { error } = await supabase
      .from("freight_loads")
      .update({
        status: "accepted",
        assigned_driver_id: driver.id,
        driver_name: driverDisplayName(driver),
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
      driver_name: driverDisplayName(driver),
      driver_email: driver.email || "",
      pickup_address: load.pickup_address || "",
      dropoff_address: load.dropoff_address || "",
      miles: Number(load.miles || 0),
      delivery_fee: Number(load.delivery_fee || load.freight_total || 0),
      status: "accepted",
      source: "freight_load",
      assigned_at: new Date().toISOString(),
      accepted_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  async function acceptApiOrder() {
    if (!load || !driver?.id) return;

    const response = await fetch(`${API_BASE_URL}/orders/${load.id}/accept`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        driverId: driver.id,
        acceptedBy: driverDisplayName(driver),
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || "Unable to accept delivery.");
    }
  }

  function startLiveLocation() {
    if (!load) return;

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

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor="#020617" />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.centerText}>Loading load details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!load) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="light-content" backgroundColor="#020617" />
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Load not found</Text>
          <Text style={styles.emptyText}>This delivery may no longer be available.</Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.replace("/driver/board" as any)}
          >
            <Text style={styles.primaryButtonText}>Back to Driver Board</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isAccepted = ["accepted", "picked_up", "in_transit", "arrived_dropoff"].includes(
    String(load.status || "").toLowerCase()
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#020617" />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.kicker}>Driver Load Details</Text>
          <Text style={styles.title}>{load.title || "Farm2Home Load"}</Text>
          <Text style={styles.subtitle}>
            Review pickup, dropoff, payout, and delivery instructions.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Overview</Text>

          <InfoRow label="Status" value={formatStatus(load.status)} />
          <InfoRow label="Load Type" value={load.load_type || load.source} />
          <InfoRow label="Order ID" value={load.order_id || load.id} />
          <InfoRow label="Miles" value={`${Number(load.miles || 0).toFixed(1)} miles`} />
          <InfoRow label="Driver Payout" value={money(payout)} />
          <InfoRow label="Product Total" value={money(load.product_total || 0)} />
          <InfoRow label="Total Due" value={money(load.total_due || payout)} />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Route</Text>
          <InfoRow label="Pickup" value={load.pickup_address || "Pickup address pending"} />
          <InfoRow label="Dropoff" value={load.dropoff_address || "Dropoff address pending"} />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <InfoRow label="Pickup Notes" value={load.pickup_notes || "No pickup notes"} />
          <InfoRow label="Delivery Notes" value={load.delivery_notes || "No delivery notes"} />
        </View>

        {isAccepted ? (
          <TouchableOpacity style={styles.primaryButton} onPress={startLiveLocation}>
            <Text style={styles.primaryButtonText}>Start Live Location</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.primaryButton, accepting && styles.disabled]}
            onPress={acceptLoad}
            disabled={accepting}
          >
            {accepting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Accept Load</Text>
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.replace("/driver/board" as any)}
        >
          <Text style={styles.secondaryButtonText}>Back to Driver Board</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
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
  safe: { flex: 1, backgroundColor: freightTheme.colors.background },
  content: { paddingBottom: 100 },
  center: {
    flex: 1,
    backgroundColor: freightTheme.colors.background,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  centerText: {
    color: "#CBD5E1",
    marginTop: 12,
    fontWeight: "800",
  },
  emptyTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
  },
  emptyText: {
    color: "#CBD5E1",
    marginTop: 8,
    textAlign: "center",
    fontWeight: "700",
  },
  header: {
    backgroundColor: "#020617",
    paddingTop: 22,
    paddingHorizontal: 20,
    paddingBottom: 26,
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
  },
  kicker: {
    color: "#10B981",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    fontSize: 30,
    fontWeight: "900",
    color: "#FFFFFF",
    marginTop: 6,
  },
  subtitle: {
    color: "#CBD5E1",
    fontWeight: "700",
    lineHeight: 22,
    marginTop: 8,
  },
  card: {
    backgroundColor: freightTheme.colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: freightTheme.colors.border,
    padding: 16,
    marginHorizontal: 18,
    marginTop: 14,
  },
  sectionTitle: {
    color: freightTheme.colors.text,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 10,
  },
  infoRow: {
    backgroundColor: freightTheme.colors.surface,
    borderRadius: 13,
    padding: 13,
    marginBottom: 9,
  },
  infoLabel: {
    color: freightTheme.colors.primary,
    fontWeight: "900",
    fontSize: 11,
    textTransform: "uppercase",
  },
  infoValue: {
    color: freightTheme.colors.text,
    fontWeight: "800",
    marginTop: 4,
    lineHeight: 20,
  },
  primaryButton: {
    backgroundColor: freightTheme.colors.primary,
    borderRadius: 14,
    padding: 15,
    alignItems: "center",
    marginHorizontal: 18,
    marginTop: 18,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  secondaryButton: {
    backgroundColor: "#111827",
    borderRadius: 14,
    padding: 15,
    alignItems: "center",
    marginHorizontal: 18,
    marginTop: 10,
  },
  secondaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  disabled: {
    opacity: 0.65,
  },
});