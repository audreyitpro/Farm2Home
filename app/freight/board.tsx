// app/freight/board.tsx

import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../data/supabaseClient";

const FREIGHT_ROUTES = {
  dashboard: "/freight/dashboard",
  board: "/freight/board",
  myLoads: "/freight/my-loads",
  liveLoads: "/freight/live-loads",
  postLoad: "/freight/post-load",
  createLoad: "/freight/create-load",
  liveRoute: "/freight/live-route",
  proofOfPickup: "/freight/proof-of-pickup",
  proofOfDelivery: "/freight/proof-of-delivery",
  profile: "/freight/profile",
  settings: "/freight/settings",
  connectBank: "/freight/connect-bank",
  login: "/freight/login",
  register: "/freight/register",
} as const;

type FreightRoute = (typeof FREIGHT_ROUTES)[keyof typeof FREIGHT_ROUTES];

type LoadStatus =
  | "available"
  | "accepted"
  | "arrived_pickup"
  | "picked_up"
  | "in_transit"
  | "arrived_dropoff"
  | "delivered"
  | "completed"
  | "cancelled";

type FreightLoad = {
  id: string;
  title: string;
  farmer_name: string;
  pickup_location: string;
  dropoff_location: string;
  pickup_date: string;
  pickup_time: string;
  dropoff_date?: string | null;
  dropoff_time?: string | null;
  equipment_type: string;
  weight_lbs?: number | null;
  temperature_required?: string | null;
  rate: number;
  distance_miles?: number | null;
  commodity: string;
  notes?: string | null;
  status: LoadStatus;
  driver_id?: string | null;
  carrier_id?: string | null;
  accepted_by?: string | null;
  batch_id?: string | null;
  created_at?: string;
  updated_at?: string | null;
  accepted_at?: string | null;
  arrived_pickup_at?: string | null;
  picked_up_at?: string | null;
  in_transit_at?: string | null;
  arrived_dropoff_at?: string | null;
  delivered_at?: string | null;
};

const TABLE_NAME = "freight_loads";

const COLORS = {
  bg: "#F4F5F7",
  card: "#FFFFFF",
  surface: "#F9FAFB",
  black: "#050505",
  red: "#D71920",
  redDark: "#9F1117",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  green: "#16A34A",
  amber: "#D97706",
  purple: "#7C3AED",
  blue: "#2563EB",
  teal: "#0F766E",
  sky: "#0EA5E9",
  slate: "#64748B",
};

const fallbackLoads: FreightLoad[] = [
  {
    id: "demo-001",
    title: "Fresh Produce Load",
    farmer_name: "Green Valley Farms",
    pickup_location: "Sterling Heights, MI",
    dropoff_location: "Detroit, MI",
    pickup_date: "Today",
    pickup_time: "2:00 PM",
    equipment_type: "Box Truck",
    weight_lbs: 850,
    temperature_required: "Cool",
    rate: 325,
    distance_miles: 28,
    commodity: "Fresh vegetables",
    notes: "Handle carefully",
    status: "available",
  },
];

function normalize(value: any) {
  return String(value || "").trim().toLowerCase();
}

function cityKey(location: string) {
  return normalize(location).split(",")[0] || normalize(location);
}

function routeKey(load: FreightLoad) {
  return `${cityKey(load.pickup_location)}-${cityKey(load.dropoff_location)}`;
}

function money(value: number) {
  return `$${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function goTo(route: FreightRoute) {
  router.push(route as any);
}

export default function FreightBoardScreen() {
  const params = useLocalSearchParams();

  const [carrier, setCarrier] = useState<any>(null);
  const [loads, setLoads] = useState<FreightLoad[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessChecking, setAccessChecking] = useState(true);
  const [accessAllowed, setAccessAllowed] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [maxMiles, setMaxMiles] = useState("150");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const rawCreatedLoadId = params.createdLoadId;
  const createdLoadId = Array.isArray(rawCreatedLoadId)
    ? rawCreatedLoadId[0] || ""
    : String(rawCreatedLoadId || "");

  useFocusEffect(
    useCallback(() => {
      setAccessChecking(true);
      loadBoard();
    }, [])
  );

  useEffect(() => {
    if (createdLoadId) {
      Alert.alert("Freight Posted", "Your freight load is now live on the board.");
    }
  }, [createdLoadId]);

  async function getStoredFreightUser() {
    const raw =
      (await AsyncStorage.getItem("currentFreightCarrier")) ||
      (await AsyncStorage.getItem("currentFreight")) ||
      (await AsyncStorage.getItem("currentFreightUser")) ||
      (await AsyncStorage.getItem("currentUser"));

    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async function persistCarrier(nextCarrier: any) {
    const normalizedCarrier = {
      ...nextCarrier,
      id: nextCarrier.id || nextCarrier.freightId,
      freightId: nextCarrier.freightId || nextCarrier.id,
      role: "freight",
      email: normalize(nextCarrier.email),
      companyName:
        nextCarrier.companyName ||
        nextCarrier.businessName ||
        nextCarrier.company_name ||
        nextCarrier.business_name ||
        "Freight Connect Carrier",
      businessName:
        nextCarrier.businessName ||
        nextCarrier.companyName ||
        nextCarrier.business_name ||
        nextCarrier.company_name ||
        "Freight Connect Carrier",
      accountActive: nextCarrier.accountActive ?? nextCarrier.account_active ?? true,
      membershipStatus:
        nextCarrier.membershipStatus ||
        nextCarrier.membership_status ||
        "Active",
      subscriptionStatus:
        nextCarrier.subscriptionStatus ||
        nextCarrier.subscription_status ||
        "active",
      stripeAccountId:
        nextCarrier.stripeAccountId ||
        nextCarrier.stripe_account_id ||
        "",
      stripe_account_id:
        nextCarrier.stripe_account_id ||
        nextCarrier.stripeAccountId ||
        "",
    };

    await AsyncStorage.setItem("currentFreight", JSON.stringify(normalizedCarrier));
    await AsyncStorage.setItem("currentFreightCarrier", JSON.stringify(normalizedCarrier));
    await AsyncStorage.setItem("currentFreightUser", JSON.stringify(normalizedCarrier));
    await AsyncStorage.setItem("currentUser", JSON.stringify(normalizedCarrier));
    await AsyncStorage.setItem("userRole", "freight");
    await AsyncStorage.setItem("currentUserRole", "freight");

    setCarrier(normalizedCarrier);
    return normalizedCarrier;
  }

  async function checkFreightAccess() {
    const stored = await getStoredFreightUser();
    const { data: authData } = await supabase.auth.getUser();
    const authUser = authData?.user;
    const email = normalize(stored?.email || authUser?.email || "");

    if (!email) {
      setAccessAllowed(false);
      router.replace(FREIGHT_ROUTES.login as any);
      return null;
    }

    const { data: dbCarrier, error } = await supabase
      .from("freight_users")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (error) {
      console.log("Freight board profile error:", error.message);
    }

    if (!dbCarrier) {
      setAccessAllowed(false);
      Alert.alert(
        "Freight Profile Missing",
        "No freight profile was found for this email. Please complete freight registration again."
      );
      router.replace(FREIGHT_ROUTES.register as any);
      return null;
    }

    const mergedCarrier = {
      ...(stored || {}),
      ...(dbCarrier || {}),
      id: dbCarrier.id,
      freightId: dbCarrier.id,
      email: normalize(dbCarrier.email || email),
      role: "freight",
      companyName:
        dbCarrier.company_name ||
        dbCarrier.business_name ||
        stored?.companyName ||
        stored?.businessName ||
        stored?.contactName ||
        "Freight Connect Carrier",
      businessName:
        dbCarrier.business_name ||
        dbCarrier.company_name ||
        stored?.businessName ||
        stored?.companyName ||
        "Freight Connect Carrier",
      contactName:
        dbCarrier.contact_name ||
        dbCarrier.name ||
        stored?.contactName ||
        stored?.name ||
        "",
      username: dbCarrier.username || stored?.username || "",
      accountActive: dbCarrier.account_active ?? stored?.accountActive ?? true,
      membershipStatus:
        dbCarrier.membership_status || stored?.membershipStatus || "Active",
      subscriptionStatus:
        dbCarrier.subscription_status || stored?.subscriptionStatus || "active",
      stripeAccountId:
        dbCarrier.stripe_account_id ||
        stored?.stripeAccountId ||
        stored?.stripe_account_id ||
        "",
      stripe_account_id:
        dbCarrier.stripe_account_id ||
        stored?.stripe_account_id ||
        stored?.stripeAccountId ||
        "",
    };

    await persistCarrier(mergedCarrier);
    setAccessAllowed(true);
    return mergedCarrier;
  }

  async function loadBoard() {
    try {
      const currentFreight = await checkFreightAccess();

      if (!currentFreight?.id) {
        setLoads([]);
        return;
      }

      const currentFreightId = currentFreight.id;

      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select("*")
        .or(
          `status.eq.available,carrier_id.eq.${currentFreightId},driver_id.eq.${currentFreightId},accepted_by.eq.${currentFreightId}`
        )
        .order("created_at", { ascending: false });

      if (error) {
        console.log("Freight board error:", error.message);
        setLoads(fallbackLoads);
      } else {
        setLoads(Array.isArray(data) && data.length > 0 ? (data as FreightLoad[]) : fallbackLoads);
      }
    } catch (err) {
      console.log("Freight board exception:", err);
      setLoads(fallbackLoads);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setAccessChecking(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadBoard();
  }

  const filteredLoads = useMemo(() => {
    const q = query.trim().toLowerCase();
    const miles = Number(maxMiles || 9999);
    const safeMiles = Number.isFinite(miles) && miles > 0 ? miles : 9999;

    return loads.filter((load) => {
      const matchesMiles = Number(load.distance_miles || 0) <= safeMiles;

      const matchesQuery =
        !q ||
        load.title?.toLowerCase().includes(q) ||
        load.pickup_location?.toLowerCase().includes(q) ||
        load.dropoff_location?.toLowerCase().includes(q) ||
        load.farmer_name?.toLowerCase().includes(q) ||
        load.commodity?.toLowerCase().includes(q) ||
        load.equipment_type?.toLowerCase().includes(q);

      return matchesMiles && matchesQuery;
    });
  }, [loads, query, maxMiles]);

  const selectedLoads = useMemo(
    () => filteredLoads.filter((item) => selectedIds.includes(item.id)),
    [filteredLoads, selectedIds]
  );

  const selectedTotalRate = selectedLoads.reduce((sum, item) => sum + Number(item.rate || 0), 0);
  const selectedTotalMiles = selectedLoads.reduce((sum, item) => sum + Number(item.distance_miles || 0), 0);

  const availableCount = filteredLoads.filter((item) => item.status === "available").length;

  const activeCount = filteredLoads.filter((item) =>
    ["accepted", "arrived_pickup", "picked_up", "in_transit", "arrived_dropoff"].includes(
      item.status
    )
  ).length;

  function toggleSelect(load: FreightLoad) {
    if (load.status !== "available") {
      Alert.alert("Unavailable", "Only available loads can be selected for batch pickup.");
      return;
    }

    if (selectedIds.includes(load.id)) {
      setSelectedIds((prev) => prev.filter((id) => id !== load.id));
      return;
    }

    if (selectedLoads.length > 0) {
      const first = selectedLoads[0];

      const samePickup = cityKey(first.pickup_location) === cityKey(load.pickup_location);
      const sameDropoff = cityKey(first.dropoff_location) === cityKey(load.dropoff_location);
      const sameRoute = routeKey(first) === routeKey(load);

      if (!samePickup && !sameDropoff && !sameRoute) {
        Alert.alert(
          "Different Area",
          "For batch selection, choose loads with the same pickup area, same dropoff area, or same route direction."
        );
        return;
      }
    }

    setSelectedIds((prev) => [...prev, load.id]);
  }

  async function saveLoadUpdates(load: FreightLoad, updates: Partial<FreightLoad>) {
    const safeUpdates = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    setLoads((prev) =>
      prev.map((item) => (item.id === load.id ? { ...item, ...safeUpdates } : item))
    );

    if (!load.id.startsWith("demo")) {
      const { error } = await supabase.from(TABLE_NAME).update(safeUpdates).eq("id", load.id);

      if (error) {
        Alert.alert("Update Warning", error.message);
      }
    }
  }

  async function acceptFreightLoad(load: FreightLoad) {
    try {
      const currentFreight = await checkFreightAccess();
      if (!currentFreight?.id) return;

      const freightCarrierId = currentFreight.id;

      const acceptedBy =
        currentFreight.companyName ||
        currentFreight.businessName ||
        currentFreight.contactName ||
        currentFreight.username ||
        "Farm2Home Freight Carrier";

      const updates = {
        status: "accepted" as LoadStatus,
        carrier_id: freightCarrierId,
        accepted_by: acceptedBy,
        accepted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (!load.id.startsWith("demo")) {
        const { error } = await supabase.from(TABLE_NAME).update(updates).eq("id", load.id);

        if (error) {
          Alert.alert("Accept Error", error.message);
          return;
        }
      }

      setSelectedIds((prev) => prev.filter((id) => id !== load.id));
      Alert.alert("Load Accepted", "This freight load is now assigned to your freight account.");
      await loadBoard();
    } catch (err: any) {
      console.log("Accept load error:", err);
      Alert.alert("Error", err?.message || "Unable to accept freight load.");
    }
  }

  async function acceptSelectedLoads() {
    if (selectedLoads.length === 0) {
      Alert.alert("No Loads Selected", "Select one or more available loads first.");
      return;
    }

    const currentFreight = await checkFreightAccess();

    if (!currentFreight?.id) {
      Alert.alert("Account Missing", "Please log in again.");
      return;
    }

    const freightCarrierId = currentFreight.id;

    const acceptedBy =
      currentFreight.companyName ||
      currentFreight.businessName ||
      currentFreight.contactName ||
      currentFreight.username ||
      "Farm2Home Freight Carrier";

    const batchId = `freight_batch_${Date.now()}`;
    const acceptedAt = new Date().toISOString();

    try {
      for (const load of selectedLoads) {
        if (load.id.startsWith("demo")) continue;

        const { error } = await supabase
          .from(TABLE_NAME)
          .update({
            status: "accepted",
            carrier_id: freightCarrierId,
            accepted_by: acceptedBy,
            accepted_at: acceptedAt,
            updated_at: acceptedAt,
            batch_id: batchId,
          })
          .eq("id", load.id);

        if (error) {
          Alert.alert("Batch Error", error.message);
          return;
        }
      }

      setSelectedIds([]);
      Alert.alert(
        "Batch Accepted",
        `${selectedLoads.length} loads were assigned to you in one freight route batch.`
      );
      await loadBoard();
    } catch (error: any) {
      Alert.alert("Batch Error", error?.message || "Unable to accept selected loads.");
    }
  }

  async function handleLoadAction(load: FreightLoad) {
    try {
      const currentFreight = await checkFreightAccess();
      if (!currentFreight?.id) return;

      if (load.status === "available") {
        await acceptFreightLoad(load);
        return;
      }

      if (load.status === "accepted") {
        await saveLoadUpdates(load, {
          status: "arrived_pickup",
          arrived_pickup_at: new Date().toISOString(),
        });
        return;
      }

      if (load.status === "arrived_pickup") {
        router.push({
          pathname: FREIGHT_ROUTES.proofOfPickup as any,
          params: { loadId: load.id },
        });
        return;
      }

      if (load.status === "picked_up") {
        await saveLoadUpdates(load, {
          status: "in_transit",
          in_transit_at: new Date().toISOString(),
        });
        return;
      }

      if (load.status === "in_transit") {
        await saveLoadUpdates(load, {
          status: "arrived_dropoff",
          arrived_dropoff_at: new Date().toISOString(),
        });
        return;
      }

      if (load.status === "arrived_dropoff") {
        router.push({
          pathname: FREIGHT_ROUTES.proofOfDelivery as any,
          params: { loadId: load.id },
        });
        return;
      }

      if (load.status === "delivered" || load.status === "completed") {
        Alert.alert("Delivered", "This freight load has already been completed.");
      }
    } catch (err) {
      console.log("Load action error:", err);
      Alert.alert("Error", "Unable to update freight load.");
    }
  }

  async function goToPostFreight() {
    const currentFreight = await checkFreightAccess();
    if (!currentFreight?.id) return;
    goTo(FREIGHT_ROUTES.postLoad);
  }

  function openLiveRoute(load: FreightLoad) {
    router.push({
      pathname: FREIGHT_ROUTES.liveRoute as any,
      params: { loadId: load.id },
    });
  }

  function getButtonLabel(status: LoadStatus) {
    switch (status) {
      case "available":
        return "Accept Load";
      case "accepted":
        return "Arrived Pickup";
      case "arrived_pickup":
        return "Proof Of Pickup";
      case "picked_up":
        return "Start Transit";
      case "in_transit":
        return "Arrived Dropoff";
      case "arrived_dropoff":
        return "Proof Of Delivery";
      case "delivered":
      case "completed":
        return "Delivered";
      default:
        return "View";
    }
  }

  function getStatusColor(status: LoadStatus) {
    switch (status) {
      case "available":
        return COLORS.blue;
      case "accepted":
        return COLORS.red;
      case "arrived_pickup":
        return COLORS.sky;
      case "picked_up":
        return COLORS.amber;
      case "in_transit":
        return COLORS.purple;
      case "arrived_dropoff":
        return COLORS.teal;
      case "delivered":
      case "completed":
        return COLORS.green;
      case "cancelled":
        return COLORS.redDark;
      default:
        return COLORS.slate;
    }
  }

  function statusIcon(status: LoadStatus): keyof typeof Ionicons.glyphMap {
    switch (status) {
      case "available":
        return "cube-outline";
      case "accepted":
        return "checkmark-circle-outline";
      case "arrived_pickup":
        return "location-outline";
      case "picked_up":
        return "archive-outline";
      case "in_transit":
        return "navigate-outline";
      case "arrived_dropoff":
        return "flag-outline";
      case "delivered":
      case "completed":
        return "checkmark-done-outline";
      case "cancelled":
        return "close-circle-outline";
      default:
        return "ellipse-outline";
    }
  }

  function formatStatus(status: LoadStatus) {
    return String(status || "available")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function ratePerMile(load: FreightLoad) {
    const miles = Number(load.distance_miles || 0);
    if (!miles) return 0;
    return Number(load.rate || 0) / miles;
  }

  if (loading || accessChecking) {
    return (
      <SafeAreaView style={styles.centered}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <ActivityIndicator size="large" color={COLORS.red} />
        <Text style={styles.loadingText}>Checking Freight Access...</Text>
      </SafeAreaView>
    );
  }

  if (!accessAllowed) {
    return (
      <SafeAreaView style={styles.centered}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <Text style={styles.lockTitle}>Login Required</Text>
        <Text style={styles.loadingText}>Redirecting to freight login...</Text>
      </SafeAreaView>
    );
  }

  function renderLoadCard({ item }: { item: FreightLoad }) {
    const selected = selectedIds.includes(item.id);

    return (
      <View style={[styles.card, selected && styles.selectedCard]}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.loadTitle}>{item.title}</Text>
            <Text style={styles.farmName}>{item.farmer_name}</Text>
          </View>

          <View style={styles.rateBox}>
            <Text style={styles.rate}>{money(Number(item.rate || 0))}</Text>
            <Text style={styles.rateLabel}>Rate</Text>
          </View>
        </View>

        <View style={[styles.statusPill, { backgroundColor: getStatusColor(item.status) }]}>
          <Ionicons name={statusIcon(item.status)} size={14} color="#FFFFFF" />
          <Text style={styles.statusPillText}>{formatStatus(item.status)}</Text>
        </View>

        <View style={styles.routeContainer}>
          <View style={styles.routeStop}>
            <Ionicons name="radio-button-on" size={18} color={COLORS.red} />
            <View style={{ flex: 1 }}>
              <Text style={styles.routeLabel}>Pickup</Text>
              <Text style={styles.routeText}>{item.pickup_location}</Text>
              <Text style={styles.routeSub}>
                {item.pickup_date} • {item.pickup_time}
              </Text>
            </View>
          </View>

          <View style={styles.routeLine} />

          <View style={styles.routeStop}>
            <Ionicons name="location" size={18} color={COLORS.red} />
            <View style={{ flex: 1 }}>
              <Text style={styles.routeLabel}>Dropoff</Text>
              <Text style={styles.routeText}>{item.dropoff_location}</Text>
              <Text style={styles.routeSub}>
                {item.dropoff_date || "Scheduled"} • {item.dropoff_time || "TBD"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.infoGrid}>
          <InfoBox icon="leaf-outline" label="Commodity" value={item.commodity} />
          <InfoBox icon="car-outline" label="Equipment" value={item.equipment_type} />
          <InfoBox
            icon="scale-outline"
            label="Weight"
            value={`${Number(item.weight_lbs || 0).toLocaleString()} lbs`}
          />
          <InfoBox
            icon="speedometer-outline"
            label="Miles"
            value={`${Number(item.distance_miles || 0).toFixed(0)} mi`}
          />
        </View>

        <View style={styles.rateSummary}>
          <Text style={styles.rateSummaryLabel}>Rate Per Mile</Text>
          <Text style={styles.rateSummaryValue}>${ratePerMile(item).toFixed(2)} / mi</Text>
        </View>

        {!!item.notes && (
          <View style={styles.notesBox}>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text style={styles.notesText}>{item.notes}</Text>
          </View>
        )}

        {item.status === "available" && (
          <TouchableOpacity
            style={selected ? styles.unselectButton : styles.selectButton}
            onPress={() => toggleSelect(item)}
          >
            <Ionicons
              name={selected ? "remove-circle-outline" : "add-circle-outline"}
              size={18}
              color="#FFFFFF"
            />
            <Text style={styles.actionButtonText}>
              {selected ? "Remove From Batch" : "Select For Batch"}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.actionButton, ["delivered", "completed"].includes(item.status) && styles.disabledButton]}
          onPress={() => handleLoadAction(item)}
          disabled={["delivered", "completed"].includes(item.status)}
        >
          <Ionicons name={statusIcon(item.status)} size={18} color="#FFFFFF" />
          <Text style={styles.actionButtonText}>{getButtonLabel(item.status)}</Text>
        </TouchableOpacity>

        {item.status !== "available" && (
          <TouchableOpacity style={styles.liveRouteButton} onPress={() => openLiveRoute(item)}>
            <Ionicons name="map-outline" size={18} color={COLORS.red} />
            <Text style={styles.liveRouteText}>Open Live Route</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />

      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>Farm2Home Freight Connect</Text>
          <Text style={styles.title}>Live Load Board</Text>
          <Text style={styles.subtitle}>
            Select one or multiple nearby loads traveling through the same area.
          </Text>
        </View>

        <TouchableOpacity style={styles.postButton} onPress={goToPostFreight}>
          <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
          <Text style={styles.postButtonText}>Post</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.navRow}>
        <TouchableOpacity style={styles.navButton} onPress={() => goTo(FREIGHT_ROUTES.dashboard)}>
          <Ionicons name="grid-outline" size={18} color="#FFFFFF" />
          <Text style={styles.navText}>Dashboard</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navButtonOutline} onPress={() => goTo(FREIGHT_ROUTES.profile)}>
          <Ionicons name="business-outline" size={18} color={COLORS.red} />
          <Text style={styles.navTextOutline}>Profile</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.quickGrid}>
        <QuickLink icon="briefcase-outline" label="My Loads" route={FREIGHT_ROUTES.myLoads} />
        <QuickLink icon="pulse-outline" label="Live Loads" route={FREIGHT_ROUTES.liveLoads} />
        <QuickLink icon="business-outline" label="Connect Bank" route={FREIGHT_ROUTES.connectBank} />
        <QuickLink icon="settings-outline" label="Settings" route={FREIGHT_ROUTES.settings} />
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{availableCount}</Text>
          <Text style={styles.summaryLabel}>Available</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{activeCount}</Text>
          <Text style={styles.summaryLabel}>Active</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{filteredLoads.length}</Text>
          <Text style={styles.summaryLabel}>Visible</Text>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={20} color={COLORS.red} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search freight, city, farmer, equipment..."
            placeholderTextColor="#94A3B8"
            style={styles.searchInput}
          />
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="speedometer-outline" size={20} color={COLORS.red} />
          <TextInput
            value={maxMiles}
            onChangeText={setMaxMiles}
            placeholder="Max miles willing to travel"
            placeholderTextColor="#94A3B8"
            keyboardType="numeric"
            style={styles.searchInput}
          />
        </View>
      </View>

      {selectedLoads.length > 0 && (
        <View style={styles.batchBar}>
          <View style={styles.batchHeader}>
            <Ionicons name="layers-outline" size={22} color="#FFFFFF" />
            <Text style={styles.batchTitle}>Selected: {selectedLoads.length} loads</Text>
          </View>

          <Text style={styles.batchText}>
            Total Rate: {money(selectedTotalRate)} · Total Miles: {selectedTotalMiles.toFixed(0)}
          </Text>

          <View style={styles.batchButtons}>
            <TouchableOpacity style={styles.batchAcceptButton} onPress={acceptSelectedLoads}>
              <Text style={styles.batchButtonText}>Accept Selected Loads</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.batchClearButton} onPress={() => setSelectedIds([])}>
              <Text style={styles.batchButtonText}>Clear</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <FlatList
        data={filteredLoads}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.listContent}
        renderItem={renderLoadCard}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Ionicons name="cube-outline" size={38} color={COLORS.red} />
            <Text style={styles.emptyTitle}>No freight loads found.</Text>
            <Text style={styles.emptyText}>
              Adjust your filters or refresh the board to check for new loads.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function QuickLink({
  icon,
  label,
  route,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  route: FreightRoute;
}) {
  return (
    <TouchableOpacity style={styles.quickLink} onPress={() => goTo(route)}>
      <Ionicons name={icon} size={21} color={COLORS.red} />
      <Text style={styles.quickText}>{label}</Text>
    </TouchableOpacity>
  );
}

function InfoBox({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoBox}>
      <Ionicons name={icon} size={17} color={COLORS.red} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoText}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.muted,
    textAlign: "center",
  },
  lockTitle: {
    color: COLORS.red,
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center",
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    backgroundColor: COLORS.black,
    paddingHorizontal: 20,
    paddingTop: 26,
    paddingBottom: 26,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  kicker: {
    color: "#FCA5A5",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900",
    marginTop: 6,
  },
  subtitle: {
    color: "#CBD5E1",
    fontSize: 15,
    marginTop: 8,
    lineHeight: 22,
    fontWeight: "700",
  },
  postButton: {
    backgroundColor: COLORS.red,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  postButtonText: {
    fontWeight: "900",
    color: "#FFFFFF",
  },
  navRow: {
    flexDirection: "row",
    gap: 10,
    padding: 18,
    paddingBottom: 10,
  },
  navButton: {
    flex: 1,
    backgroundColor: COLORS.red,
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  navButtonOutline: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.red,
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  navText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  navTextOutline: {
    color: COLORS.red,
    fontWeight: "900",
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  quickLink: {
    width: "48%",
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    gap: 7,
  },
  quickText: {
    color: COLORS.text,
    fontWeight: "900",
    textAlign: "center",
  },
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
    color: COLORS.black,
    fontSize: 25,
    fontWeight: "900",
  },
  summaryLabel: {
    color: COLORS.muted,
    fontWeight: "800",
    marginTop: 4,
    textAlign: "center",
  },
  searchContainer: {
    paddingHorizontal: 18,
    gap: 10,
    marginBottom: 14,
  },
  searchBox: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: COLORS.text,
    fontWeight: "700",
    paddingVertical: 13,
  },
  batchBar: {
    backgroundColor: COLORS.red,
    marginHorizontal: 18,
    marginBottom: 14,
    borderRadius: 18,
    padding: 16,
  },
  batchHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  batchTitle: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 18,
  },
  batchText: {
    color: "#FFE4E6",
    fontWeight: "800",
    marginTop: 8,
  },
  batchButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  batchAcceptButton: {
    flex: 1,
    backgroundColor: COLORS.black,
    padding: 13,
    borderRadius: 14,
    alignItems: "center",
  },
  batchClearButton: {
    backgroundColor: COLORS.redDark,
    padding: 13,
    borderRadius: 14,
    alignItems: "center",
  },
  batchButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
  listContent: {
    paddingHorizontal: 18,
    paddingBottom: 90,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  selectedCard: {
    borderColor: COLORS.red,
    borderWidth: 2,
    backgroundColor: "#FFF1F2",
  },
  cardTop: {
    flexDirection: "row",
    marginBottom: 12,
    gap: 12,
  },
  loadTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: COLORS.text,
  },
  farmName: {
    marginTop: 4,
    color: COLORS.muted,
    fontWeight: "700",
  },
  rateBox: {
    backgroundColor: COLORS.black,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: "center",
  },
  rate: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 18,
  },
  rateLabel: {
    color: "#D1D5DB",
    fontSize: 11,
    fontWeight: "800",
  },
  statusPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  statusPillText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "capitalize",
  },
  routeContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
  },
  routeStop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  routeLine: {
    width: 2,
    height: 24,
    backgroundColor: COLORS.border,
    marginLeft: 8,
    marginVertical: 8,
  },
  routeLabel: {
    fontSize: 11,
    color: COLORS.red,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  routeText: {
    fontSize: 15,
    color: COLORS.text,
    marginTop: 3,
    fontWeight: "900",
    lineHeight: 20,
  },
  routeSub: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 3,
    fontWeight: "700",
  },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  infoBox: {
    flexBasis: "48%",
    flexGrow: 1,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 12,
  },
  infoLabel: {
    fontSize: 11,
    color: COLORS.muted,
    fontWeight: "900",
    textTransform: "uppercase",
    marginTop: 6,
  },
  infoText: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: "800",
    marginTop: 4,
    lineHeight: 19,
  },
  rateSummary: {
    backgroundColor: COLORS.black,
    borderRadius: 14,
    padding: 13,
    marginTop: 12,
  },
  rateSummaryLabel: {
    color: "#D1D5DB",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  rateSummaryValue: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
    marginTop: 4,
  },
  notesBox: {
    backgroundColor: COLORS.black,
    borderRadius: 14,
    padding: 13,
    marginTop: 12,
  },
  notesLabel: {
    color: "#FCA5A5",
    fontWeight: "900",
    marginBottom: 4,
  },
  notesText: {
    color: "#CBD5E1",
    fontWeight: "700",
    lineHeight: 20,
  },
  selectButton: {
    backgroundColor: COLORS.blue,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
    flexDirection: "row",
    gap: 8,
  },
  unselectButton: {
    backgroundColor: COLORS.redDark,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    backgroundColor: COLORS.red,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
  },
  disabledButton: {
    backgroundColor: COLORS.slate,
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 14,
  },
  liveRouteButton: {
    backgroundColor: "#FFF1F2",
    borderWidth: 1,
    borderColor: COLORS.red,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
  },
  liveRouteText: {
    color: COLORS.red,
    fontWeight: "900",
  },
  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 20,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "900",
    marginTop: 10,
  },
  emptyText: {
    color: COLORS.muted,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 22,
  },
});